//! list_for_sale.rs — Factoring step 1.
use anchor_lang::prelude::*;
use crate::errors::AspError;
use crate::state::{ListingStatus, SettlementNft, SettlementStatus};

#[derive(Accounts)]
pub struct ListForSale<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"settlement_nft", settlement_nft.agent.as_ref(), settlement_nft.market_id.as_ref()],
        bump = settlement_nft.bump,
        constraint = settlement_nft.current_owner == seller.key() @ AspError::UnauthorizedAgent,
        constraint = matches!(settlement_nft.status, SettlementStatus::Locked | SettlementStatus::PreChecked | SettlementStatus::Executed) @ AspError::CannotListTerminalPosition,
        constraint = settlement_nft.listing_status == ListingStatus::Active @ AspError::AlreadyListed,
        constraint = settlement_nft.transferable @ AspError::NotTransferable,
    )]
    pub settlement_nft: Account<'info, SettlementNft>,
}

pub fn handler(ctx: Context<ListForSale>, ask_price: u64, listing_expires_slot: u64) -> Result<()> {
    require!(ask_price > 0, AspError::InvalidAskPrice);
    let clock = Clock::get()?;
    require!(listing_expires_slot > clock.slot, AspError::InvalidListingExpiry);

    let nft = &mut ctx.accounts.settlement_nft;
    nft.listing_status = ListingStatus::Listed;
    nft.ask_price = ask_price;
    nft.listed_at_slot = clock.slot;
    nft.listing_expires_slot = listing_expires_slot;

    emit!(SettlementListed {
        nft: nft.key(),
        seller: ctx.accounts.seller.key(),
        ask_price,
        listed_at: clock.slot,
        expires_slot: listing_expires_slot,
    });
    Ok(())
}

#[event]
pub struct SettlementListed {
    pub nft: Pubkey,
    pub seller: Pubkey,
    pub ask_price: u64,
    pub listed_at: u64,
    pub expires_slot: u64,
}
