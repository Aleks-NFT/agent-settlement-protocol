use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::AspError;

#[derive(Accounts)]
pub struct OpenCreditBond<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        seeds = [b"reputation", agent.key().as_ref()],
        bump = reputation.bump,
    )]
    pub reputation: Account<'info, ReputationAccount>,

    #[account(
        init,
        payer = agent,
        space = CreditBond::LEN,
        seeds = [b"credit_bond", agent.key().as_ref()],
        bump,
    )]
    pub credit_bond: Account<'info, CreditBond>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<OpenCreditBond>) -> Result<()> {
    let trust_score = ctx.accounts.reputation.trust_score;
    require!(trust_score > 80, AspError::TrustScoreTooLow);

    let credit_limit = CreditBond::credit_limit_for_score(trust_score);
    let clock = Clock::get()?;

    let bond = &mut ctx.accounts.credit_bond;
    bond.agent               = ctx.accounts.agent.key();
    bond.credit_limit        = credit_limit;
    bond.credit_used         = 0;
    bond.is_active           = true;
    bond.opened_at_slot      = clock.slot;
    bond.trust_score_at_open = trust_score;
    bond.bump                = ctx.bumps.credit_bond;

    emit!(CreditBondOpened {
        agent: ctx.accounts.agent.key(),
        credit_limit,
        trust_score,
        slot: clock.slot,
    });

    Ok(())
}

#[event]
pub struct CreditBondOpened {
    pub agent:        Pubkey,
    pub credit_limit: u64,
    pub trust_score:  u8,
    pub slot:         u64,
}
