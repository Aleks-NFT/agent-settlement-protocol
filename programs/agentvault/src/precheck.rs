use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::AspError;

const STALENESS_THRESHOLD: i64 = 3600;
const MAX_CONF_BPS: u64 = 200;
const MAGIC_OFFSET: usize = 0;
const TIMESTAMP_OFFSET: usize = 96;
const PRICE_OFFSET: usize = 208;
const CONF_OFFSET: usize = 216;
const PYTH_MAGIC: u32 = 0xa1b2c3e4;
const MIN_FEED_SIZE: usize = 228;

pub fn handler(
    ctx: Context<PreCheck>,
    expected_price: u64,
    tolerance_bps: u16,
    available_liquidity: u64,
) -> Result<()> {
    let nft = &mut ctx.accounts.settlement_nft;
    let clock = Clock::get()?;
    require!(clock.slot < nft.timeout_slot, AspError::TimedOut);
    let feed_data = ctx.accounts.pyth_price_feed.try_borrow_data()
        .map_err(|_| error!(AspError::PriceStale))?;
    require!(feed_data.len() >= MIN_FEED_SIZE, AspError::PriceStale);
    let magic = u32::from_le_bytes(feed_data[MAGIC_OFFSET..MAGIC_OFFSET+4].try_into().unwrap());
    require!(magic == PYTH_MAGIC, AspError::PriceStale);
    let timestamp = i64::from_le_bytes(feed_data[TIMESTAMP_OFFSET..TIMESTAMP_OFFSET+8].try_into().unwrap());
    require!(clock.unix_timestamp - timestamp <= STALENESS_THRESHOLD, AspError::PriceStale);
    let raw_price = i64::from_le_bytes(feed_data[PRICE_OFFSET..PRICE_OFFSET+8].try_into().unwrap());
    let conf = u64::from_le_bytes(feed_data[CONF_OFFSET..CONF_OFFSET+8].try_into().unwrap());
    let current_price: u64 = raw_price
        .try_into().map_err(|_| error!(AspError::PriceOutOfRange))?;
    let max_conf = current_price
        .checked_mul(MAX_CONF_BPS).ok_or(error!(AspError::ArithmeticOverflow))?
        .checked_div(10_000).ok_or(error!(AspError::ArithmeticOverflow))?;
    require!(current_price > 0 && conf <= max_conf, AspError::PriceConfidenceTooHigh);
    let price_diff = if current_price > expected_price { current_price - expected_price } else { expected_price - current_price };
    let max_deviation = expected_price
        .checked_mul(tolerance_bps as u64).ok_or(error!(AspError::ArithmeticOverflow))?
        .checked_div(10_000).ok_or(error!(AspError::ArithmeticOverflow))?;
    require!(price_diff <= max_deviation, AspError::PriceOutOfRange);
    let min_liquidity = nft.amount
        .checked_mul(80).ok_or(error!(AspError::ArithmeticOverflow))?
        .checked_div(100).ok_or(error!(AspError::ArithmeticOverflow))?;
    require!(available_liquidity >= min_liquidity, AspError::InsufficientLiquidity);
    nft.status = SettlementStatus::PreChecked;
    emit!(PreCheckPassed { nft: nft.key(), agent: ctx.accounts.agent.key(), pyth_price: raw_price, expected_price, available_liquidity, slot: clock.slot });
    Ok(())
}
#[event]
pub struct PreCheckPassed {
    pub nft: Pubkey, pub agent: Pubkey, pub pyth_price: i64,
    pub expected_price: u64, pub available_liquidity: u64, pub slot: u64,
}

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
    /// CHECK: Pyth price feed — magic and staleness validated manually
    pub pyth_price_feed: AccountInfo<'info>,
}
