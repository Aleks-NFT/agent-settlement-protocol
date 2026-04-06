use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::AspError;

#[derive(Accounts)]
pub struct Execute<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [b"settlement_nft", agent.key().as_ref(), settlement_nft.market_id.as_ref()],
        bump  = settlement_nft.bump,
        constraint = settlement_nft.agent == agent.key() @ AspError::UnauthorizedAgent,
        constraint = settlement_nft.status == SettlementStatus::PreChecked @ AspError::InvalidStatus,
    )]
    pub settlement_nft: Account<'info, SettlementNft>,

    #[account(
        mut,
        seeds = [b"vault", settlement_nft.key().as_ref()],
        bump  = vault.bump,
        constraint = !vault.is_closed @ AspError::VaultClosed,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds  = [b"vault_usdc", vault.key().as_ref()],
        bump,
        token::mint      = agent_usdc.mint,
        token::authority = vault_usdc,
    )]
    pub vault_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint      = vault_usdc.mint,
        token::authority = agent,
    )]
    pub agent_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"reputation", agent.key().as_ref()],
        bump,
    )]
    pub reputation: Account<'info, ReputationAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<Execute>,
    _venue_instruction_data: Vec<u8>,
    fill_price: u64,
) -> Result<()> {
    let nft   = &mut ctx.accounts.settlement_nft;
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(clock.slot < nft.timeout_slot, AspError::TimedOut);

    let amount          = vault.amount_locked;
    let vault_usdc_bump = ctx.bumps.vault_usdc;
    let vault_key       = vault.key();
    let vault_seeds: &[&[&[u8]]] = &[&[
        b"vault_usdc",
        vault_key.as_ref(),
        &[vault_usdc_bump],
    ]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from:      ctx.accounts.vault_usdc.to_account_info(),
            to:        ctx.accounts.agent_usdc.to_account_info(),
            authority: ctx.accounts.vault_usdc.to_account_info(),
        },
        vault_seeds,
    );
    token::transfer(cpi_ctx, amount)?;

    vault.is_closed       = true;
    nft.actual_fill_price = fill_price;
    nft.status            = SettlementStatus::Executed;
    nft.executed_slot     = clock.slot;

    emit!(TradeExecuted {
        nft:        nft.key(),
        agent:      ctx.accounts.agent.key(),
        fill_price,
        amount,
        slot:       clock.slot,
    });

    Ok(())
}

#[event]
pub struct TradeExecuted {
    pub nft:        Pubkey,
    pub agent:      Pubkey,
    pub fill_price: u64,
    pub amount:     u64,
    pub slot:       u64,
}