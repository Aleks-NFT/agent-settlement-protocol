use anchor_lang::prelude::*;
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
pub struct PostCheck<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [b"settlement_nft", agent.key().as_ref(),
                 settlement_nft.market_id.as_ref()],
        bump = settlement_nft.bump,
        constraint = settlement_nft.agent == agent.key()
            @ AspError::UnauthorizedAgent,
        constraint = settlement_nft.status == SettlementStatus::Executed
            @ AspError::InvalidStatus,
    )]
    pub settlement_nft: Account<'info, SettlementNft>,

    #[account(
        seeds = [b"vault", settlement_nft.key().as_ref()],
        bump = vault.bump,
        constraint = !vault.is_closed @ AspError::VaultClosed,
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: Pyth price feed — magic and staleness validated in handler
    pub pyth_price_feed: AccountInfo<'info>,
}

pub fn handler(ctx: Context<PostCheck>) -> Result<()> {
    let nft   = &mut ctx.accounts.settlement_nft;
    let clock = Clock::get()?;

    require!(clock.slot < nft.timeout_slot, AspError::TimedOut);

    // Parse Pyth feed (raw binary, same offsets as precheck/settle)
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

    // Confirm market has resolved to a non-zero price
    require!(settle_price > 0, AspError::PostCheckFailed);

    let fill_price          = nft.actual_fill_price;
    let position_type_is_yes = nft.position_type == PositionType::Yes;

    nft.status = SettlementStatus::PostChecked;

    emit!(PostCheckPassed {
        nft: nft.key(),
        agent: ctx.accounts.agent.key(),
        fill_price,
        settle_price,
        position_type_is_yes,
        slot: clock.slot,
    });

    Ok(())
}

#[event]
pub struct PostCheckPassed {
    pub nft:                  Pubkey,
    pub agent:                Pubkey,
    pub fill_price:           u64,
    pub settle_price:         u64,
    pub position_type_is_yes: bool,
    pub slot:                 u64,
}
