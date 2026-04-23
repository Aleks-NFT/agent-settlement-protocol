use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::AspError;

const STALENESS_THRESHOLD: i64  = 3600;
const MAX_CONF_BPS:        u64  = 200;
const MAGIC_OFFSET:        usize = 0;
const TIMESTAMP_OFFSET:    usize = 96;
const PRICE_OFFSET:        usize = 208;
const CONF_OFFSET:         usize = 216;
const PYTH_MAGIC:          u32  = 0xa1b2c3e4;
const MIN_FEED_SIZE:       usize = 228;

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

    #[account(seeds = [b"vault", settlement_nft.key().as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    #[account(mut, constraint = agent_usdc.owner == agent.key())]
    pub agent_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub fee_collector: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"reputation", agent.key().as_ref()], bump)]
    pub reputation: Account<'info, ReputationAccount>,

    /// CHECK: Pyth price feed — magic bytes and staleness validated manually
    pub pyth_price_feed: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Settle>) -> Result<()> {
    let clock = Clock::get()?;

    // 1. Validate Pyth feed (raw binary, no SDK)
    let feed_data = ctx.accounts.pyth_price_feed
        .try_borrow_data()
        .map_err(|_| error!(AspError::PriceStale))?;

    require!(feed_data.len() >= MIN_FEED_SIZE, AspError::PriceStale);

    let magic = u32::from_le_bytes(
        feed_data[MAGIC_OFFSET..MAGIC_OFFSET + 4].try_into().unwrap()
    );
    require!(magic == PYTH_MAGIC, AspError::PriceStale);

    let timestamp = i64::from_le_bytes(
        feed_data[TIMESTAMP_OFFSET..TIMESTAMP_OFFSET + 8].try_into().unwrap()
    );
    require!(
        clock.unix_timestamp - timestamp <= STALENESS_THRESHOLD,
        AspError::PriceStale
    );

    let raw_price = i64::from_le_bytes(
        feed_data[PRICE_OFFSET..PRICE_OFFSET + 8].try_into().unwrap()
    );
    let conf = u64::from_le_bytes(
        feed_data[CONF_OFFSET..CONF_OFFSET + 8].try_into().unwrap()
    );
    let settle_price: u64 = raw_price
        .try_into()
        .map_err(|_| error!(AspError::PriceOutOfRange))?;

    let max_conf = settle_price
        .checked_mul(MAX_CONF_BPS).ok_or(error!(AspError::ArithmeticOverflow))?
        .checked_div(10_000).ok_or(error!(AspError::ArithmeticOverflow))?;
    require!(settle_price > 0 && conf <= max_conf, AspError::PriceConfidenceTooHigh);

    // 2. Deduct fee
    let amount     = ctx.accounts.settlement_nft.amount;
    let fee_bps    = ctx.accounts.settlement_nft.fee_bps;
    let fill_price = ctx.accounts.settlement_nft.actual_fill_price;

    let fee = (amount as u128)
        .checked_mul(fee_bps as u128).ok_or(error!(AspError::ArithmeticOverflow))?
        .checked_div(10_000).ok_or(error!(AspError::ArithmeticOverflow))? as u64;

    if fee > 0 {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.agent_usdc.to_account_info(),
                    to:        ctx.accounts.fee_collector.to_account_info(),
                    authority: ctx.accounts.agent.to_account_info(),
                },
            ),
            fee,
        )?;
    }

    // 3. P&L estimate (informational — for event analytics)
    let payout_estimate = match ctx.accounts.settlement_nft.position_type {
        PositionType::Yes => {
            if settle_price >= fill_price {
                let delta = settle_price - fill_price;
                amount.saturating_add(
                    amount.saturating_mul(delta)
                        .checked_div(fill_price).unwrap_or(0)
                )
            } else {
                let delta = fill_price - settle_price;
                let loss = amount.saturating_mul(delta)
                    .checked_div(fill_price).unwrap_or(0);
                amount.saturating_sub(loss)
            }
        }
        PositionType::No => {
            if fill_price >= settle_price {
                let delta = fill_price - settle_price;
                amount.saturating_add(
                    amount.saturating_mul(delta)
                        .checked_div(fill_price).unwrap_or(0)
                )
            } else {
                let delta = settle_price - fill_price;
                let loss = amount.saturating_mul(delta)
                    .checked_div(fill_price).unwrap_or(0);
                amount.saturating_sub(loss)
            }
        }
    };

    // 4. Update state
    let nft        = &mut ctx.accounts.settlement_nft;
    let reputation = &mut ctx.accounts.reputation;

    nft.status       = SettlementStatus::Settled;
    nft.settled_slot = clock.slot;

    reputation.trust_score = reputation.trust_score.saturating_add(2).min(100);
    reputation.successful_settlements = reputation.successful_settlements
        .checked_add(1).ok_or(AspError::ArithmeticOverflow)?;
    reputation.total_volume = reputation.total_volume
        .checked_add(amount).ok_or(AspError::ArithmeticOverflow)?;

    emit!(TradeSettled {
        nft:             nft.key(),
        agent:           ctx.accounts.agent.key(),
        fill_price,
        settle_price,
        amount,
        fee,
        fee_bps,
        payout_estimate,
        new_trust_score: reputation.trust_score,
        slot:            clock.slot,
    });

    Ok(())
}

#[event]
pub struct TradeSettled {
    pub nft:             Pubkey,
    pub agent:           Pubkey,
    pub fill_price:      u64,
    pub settle_price:    u64,
    pub amount:          u64,
    pub fee:             u64,
    pub fee_bps:         u16,
    pub payout_estimate: u64,
    pub new_trust_score: u8,
    pub slot:            u64,
}
