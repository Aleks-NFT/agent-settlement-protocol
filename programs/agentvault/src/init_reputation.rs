use anchor_lang::prelude::*;
use crate::state::ReputationAccount;

#[derive(Accounts)]
pub struct InitReputation<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        init_if_needed,
        payer = agent,
        space = ReputationAccount::LEN,
        seeds = [b"reputation", agent.key().as_ref()],
        bump
    )]
    pub reputation: Account<'info, ReputationAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitReputation>) -> Result<()> {
    let rep = &mut ctx.accounts.reputation;
    rep.agent = ctx.accounts.agent.key();
    rep.trust_score = 50;
    rep.successful_settlements = 0;
    rep.reverted_settlements = 0;
    rep.total_volume = 0;
    rep.bump = ctx.bumps.reputation;
    Ok(())
}
