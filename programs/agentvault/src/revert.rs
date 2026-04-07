use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::AspError;

pub fn handler(ctx: Context<Revert>, reason: RevertReason) -> Result<()> {
    // Extract copy-types BEFORE mutable borrows to satisfy borrow checker
    let vault_bump      = ctx.accounts.vault.bump;
    let nft_key         = ctx.accounts.settlement_nft.key();
    let previous_status = ctx.accounts.settlement_nft.status.clone();
    let refund_amount   = ctx.accounts.vault_usdc.amount;
    let clock           = Clock::get()?;

    let nft        = &mut ctx.accounts.settlement_nft;
    let vault      = &mut ctx.accounts.vault;
    let reputation = &mut ctx.accounts.reputation;
    let vault_seeds: &[&[&[u8]]] = &[&[
        b"vault",
        nft_key.as_ref(),
        &[vault_bump],
    ]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from:      ctx.accounts.vault_usdc.to_account_info(),
            to:        ctx.accounts.agent_usdc.to_account_info(),
            authority: vault.to_account_info(),
        },
        vault_seeds,
    );
    token::transfer(cpi_ctx, refund_amount)?;

    // Revival attack protection
    vault.is_closed = true;

    // Mild trust penalty — revert is a feature, not a failure
    reputation.reverted_settlements = reputation
        .reverted_settlements
        .checked_add(1)
        .ok_or(AspError::ArithmeticOverflow)?;
    reputation.trust_score = reputation.trust_score.saturating_sub(1);

    nft.status = SettlementStatus::Reverted;

    emit!(SettlementReverted {
        nft:             nft.key(),
        agent:           ctx.accounts.agent.key(),
        previous_status,
        reason,
        refunded:        refund_amount,
        new_trust_score: reputation.trust_score,
        slot:            clock.slot,
    });

    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum RevertReason {
    PreCheckFailed,
    ExecutionFailed,
    PostCheckFailed,
    TimedOut,
    AgentInitiated,
}

#[event]
pub struct SettlementReverted {
    pub nft:             Pubkey,
    pub agent:           Pubkey,
    pub previous_status: SettlementStatus,
    pub reason:          RevertReason,
    pub refunded:        u64,
    pub new_trust_score: u8,
    pub slot:            u64,
}

#[derive(Accounts)]
pub struct Revert<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [b"settlement_nft", agent.key().as_ref(), settlement_nft.market_id.as_ref()],
        bump  = settlement_nft.bump,
    )]
    pub settlement_nft: Account<'info, SettlementNft>,

    #[account(
        mut,
        seeds = [b"vault", settlement_nft.key().as_ref()],
        bump  = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds  = [b"vault_usdc", vault.key().as_ref()],
        bump,
        token::mint      = agent_usdc.mint,
        token::authority = vault,
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
