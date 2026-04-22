//! buy_settlement.rs — Factoring step 2.
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::errors::AspError;
use crate::state::{ListingStatus, SettlementNft, SettlementStatus};

#[derive(Accounts)]
pub struct BuySettlement<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"settlement_nft", settlement_nft.agent.as_ref(), settlement_nft.market_id.as_ref()],
        bump = settlement_nft.bump,
        constraint = settlement_nft.listing_status == ListingStatus::Listed @ AspError::NotListed,
        constraint = settlement_nft.current_owner != buyer.key() @ AspError::CannotBuyOwnListing,
        constraint = matches!(settlement_nft.status, SettlementStatus::Locked | SettlementStatus::PreChecked | SettlementStatus::Executed) @ AspError::CannotBuyTerminalPosition,
    )]
    pub settlement_nft: Account<'info, SettlementNft>,

    #[account(
        mut,
        token::mint = usdc_mint,
        constraint = seller_usdc.owner == settlement_nft.current_owner @ AspError::InvalidSellerAccount,
    )]
    pub seller_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = buyer,
    )]
    pub buyer_usdc: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<BuySettlement>) -> Result<()> {
    let clock = Clock::get()?;
    let nft = &mut ctx.accounts.settlement_nft;

    require!(clock.slot <= nft.listing_expires_slot, AspError::ListingExpired);

    let ask = nft.ask_price;
    let previous_owner = nft.current_owner;

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.buyer_usdc.to_account_info(),
            to: ctx.accounts.seller_usdc.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, ask)?;

    nft.current_owner = ctx.accounts.buyer.key();
    nft.listing_status = ListingStatus::Transferred;
    nft.ask_price = 0;

    emit!(SettlementBought {
        nft: nft.key(),
        previous_owner,
        new_owner: ctx.accounts.buyer.key(),
        price_paid: ask,
        slot: clock.slot,
    });
    Ok(())
}

#[event]
pub struct SettlementBought {
    pub nft: Pubkey,
    pub previous_owner: Pubkey,
    pub new_owner: Pubkey,
    pub price_paid: u64,
    pub slot: u64,
}
