use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

declare_id!("5DWGriyPGA5Q4sc7ofBGE3sUUwj47JTnKoc7Dygh44rh");

#[program]
pub mod agentvault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
