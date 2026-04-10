use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::AspError;

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    #[account(
        mut,
        constraint = settlement_nft.agent == agent.key() @ AspError::UnauthorizedAgent,
        constraint = settlement_nft.status == SettlementStatus::Executed @ AspError::InvalidStatus,
    )]
    pub settlement_nft: Account<'info, SettlementNft>,
    #[account(mut, seeds = [b"vault", settlement_nft.key().as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,
    #[account(mut, token::mint = fee_collector.mint, token::authority = agent)]
    pub agent_usdc: Account<'info, TokenAccount>,
    #[account(mut)]
    pub fee_collector: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"reputation", agent.key().as_ref()], bump)]
    pub reputation: Account<'info, ReputationAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Settle>) -> Result<()> {
    let clock = Clock::get()?;
    let amount    = ctx.accounts.settlement_nft.amount;
    let fee_bps   = ctx.accounts.settlement_nft.fee_bps;
    let fill_price = ctx.accounts.settlement_nft.actual_fill_price;

    let fee: u64 = (amount as u128)
        .checked_mul(fee_bps as u128).ok_or(AspError::ArithmeticOverflow)?
        .checked_div(10_000).ok_or(AspError::ArithmeticOverflow)? as u64;

    if fee > 0 {
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.agent_usdc.to_account_info(),
                to:        ctx.accounts.fee_collector.to_account_info(),
                authority: ctx.accounts.agent.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, fee)?;
    }

    let nft        = &mut ctx.accounts.settlement_nft;
    let reputation = &mut ctx.accounts.reputation;

    nft.status       = SettlementStatus::Settled;
    nft.settled_slot = clock.slot;

    reputation.successful_settlements = reputation.successful_settlements
        .checked_add(1).ok_or(AspError::ArithmeticOverflow)?;
    reputation.total_volume = reputation.total_volume
        .checked_add(amount).ok_or(AspError::ArithmeticOverflow)?;
    reputation.trust_score = reputation.trust_score.saturating_add(2).min(100);

    emit!(TradeSettled {
        nft: nft.key(), agent: ctx.accounts.agent.key(),
        fill_price, amount, fee, fee_bps, slot: clock.slot,
    });
    Ok(())
}

#[event]
pub struct TradeSettled {
    pub nft:        Pubkey,
    pub agent:      Pubkey,
    pub fill_price: u64,
    pub amount:     u64,
    pub fee:        u64,
    pub fee_bps:    u16,
    pub slot:       u64,
}
