use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::AspError;

#[derive(Accounts)]
pub struct PreCheck<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [b"settlement_nft", agent.key().as_ref(), settlement_nft.market_id.as_ref()],
        bump = settlement_nft.bump,
        constraint = settlement_nft.agent == agent.key() @ AspError::UnauthorizedAgent,
        constraint = settlement_nft.status == SettlementStatus::Locked @ AspError::InvalidStatus,
    )]
    pub settlement_nft: Account<'info, SettlementNft>,

    #[account(
        seeds = [b"vault", settlement_nft.key().as_ref()],
        bump = vault.bump,
        constraint = !vault.is_closed @ AspError::VaultClosed,
    )]
    pub vault: Account<'info, Vault>,
}

pub fn handler(
    ctx: Context<PreCheck>,
    current_price: u64,       // цена YES токена в bps (e.g. 6000 = $0.60)
    expected_price: u64,      // ожидаемая цена из стратегии
    tolerance_bps: u16,       // допустимое отклонение в bps
    available_liquidity: u64, // доступная ликвидность на venue
) -> Result<()> {
    let nft = &mut ctx.accounts.settlement_nft;
    let clock = Clock::get()?;

    // 1. Проверка timeout — не истёк ли дедлайн
    require!(
        clock.slot < nft.timeout_slot,
        AspError::TimedOut
    );

    // 2. Проверка цены в допустимом диапазоне
    let price_diff = if current_price > expected_price {
        current_price - expected_price
    } else {
        expected_price - current_price
    };

    let max_deviation = expected_price
        .checked_mul(tolerance_bps as u64)
        .ok_or(AspError::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(AspError::ArithmeticOverflow)?;

    require!(
        price_diff <= max_deviation,
        AspError::PriceOutOfRange
    );

    // 3. Проверка ликвидности — достаточно ли для нашего ордера
    // Требуем минимум 80% от суммы позиции
    let min_liquidity = nft.amount
        .checked_mul(80)
        .ok_or(AspError::ArithmeticOverflow)?
        .checked_div(100)
        .ok_or(AspError::ArithmeticOverflow)?;

    require!(
        available_liquidity >= min_liquidity,
        AspError::InsufficientLiquidity
    );

    // 4. Все проверки прошли → обновляем статус
    nft.status = SettlementStatus::PreChecked;

    emit!(PreCheckPassed {
        nft:               nft.key(),
        agent:             ctx.accounts.agent.key(),
        current_price,
        expected_price,
        available_liquidity,
        slot:              clock.slot,
    });

    Ok(())
}

#[event]
pub struct PreCheckPassed {
    pub nft:                Pubkey,
    pub agent:              Pubkey,
    pub current_price:      u64,
    pub expected_price:     u64,
    pub available_liquidity: u64,
    pub slot:               u64,
}
