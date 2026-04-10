use anchor_lang::prelude::*;
use pyth_sdk_solana::state::SolanaPriceAccount;
use std::mem::size_of;

pub fn handler(ctx: Context<CreateMockFeed>, price: i64, conf: u64, expo: i32) -> Result<()> {
    let actual_size = size_of::<SolanaPriceAccount>();
    msg!("SolanaPriceAccount size: {}", actual_size);

    let info = ctx.accounts.feed.to_account_info();
    let mut bytes = info.try_borrow_mut_data()?;

    bytes[0..4].copy_from_slice(&0xa1b2c3e4u32.to_le_bytes());  // magic
    bytes[4..8].copy_from_slice(&2u32.to_le_bytes());           // ver = 2
    bytes[8..12].copy_from_slice(&3i32.to_le_bytes());          // atype
    bytes[12..16].copy_from_slice(&(actual_size as u32).to_le_bytes()); // size = real
    bytes[20..24].copy_from_slice(&expo.to_le_bytes());         // expo

    let ts = Clock::get()?.unix_timestamp;
    bytes[96..104].copy_from_slice(&ts.to_le_bytes());          // timestamp

    bytes[208..216].copy_from_slice(&price.to_le_bytes());      // agg.price
    bytes[216..224].copy_from_slice(&conf.to_le_bytes());       // agg.conf
    bytes[224..228].copy_from_slice(&1u32.to_le_bytes());       // agg.status = Trading

    Ok(())
}

#[derive(Accounts)]
pub struct CreateMockFeed<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: raw mock pyth price account — test only
    #[account(
        init,
        payer = authority,
        space = 3312,
    )]
    pub feed: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
