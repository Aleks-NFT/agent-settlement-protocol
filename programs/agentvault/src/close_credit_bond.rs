use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::AspError;

#[derive(Accounts)]
pub struct CloseCreditBond<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [b"credit_bond", agent.key().as_ref()],
        bump = credit_bond.bump,
        constraint = credit_bond.agent == agent.key() @ AspError::UnauthorizedAgent,
    )]
    pub credit_bond: Account<'info, CreditBond>,
}

pub fn handler(ctx: Context<CloseCreditBond>) -> Result<()> {
    let bond = &mut ctx.accounts.credit_bond;
    require!(bond.is_active, AspError::CreditBondInactive);
    require!(bond.credit_used == 0, AspError::CreditBondHasOpenPositions);

    let clock = Clock::get()?;
    bond.is_active = false;

    emit!(CreditBondClosed {
        agent: ctx.accounts.agent.key(),
        slot:  clock.slot,
    });

    Ok(())
}

#[event]
pub struct CreditBondClosed {
    pub agent: Pubkey,
    pub slot:  u64,
}
