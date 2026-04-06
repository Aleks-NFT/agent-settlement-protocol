use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::lock::*;
use state::*;

declare_id!("5DWGriyPGA5Q4sc7ofBGE3sUUwj47JTnKoc7Dygh44rh");

#[program]
pub mod agentvault {
    use super::*;

    pub fn lock(
        ctx: Context<Lock>,
        market_id: Pubkey,
        amount: u64,
        position_type: PositionType,
        timeout_slots: u64,
    ) -> Result<()> {
        instructions::lock::handler(ctx, market_id, amount, position_type, timeout_slots)
    }
}
