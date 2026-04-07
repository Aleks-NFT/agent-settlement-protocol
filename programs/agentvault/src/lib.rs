use anchor_lang::prelude::*;

pub mod errors;
pub mod state;
pub mod lock;
pub mod precheck;
pub mod execute_ix;
pub mod revert;
pub mod init_reputation;

use lock::*;
use precheck::*;
use execute_ix::*;
use revert::*;
use state::*;
use init_reputation::*;

declare_id!("FfAjYkk4ktD3iHkF7jNes2p7EBZUR1mwBrbK4fGC3QXe");

#[program]
pub mod agentvault {
    use super::*;

    pub fn init_reputation(ctx: Context<InitReputation>) -> Result<()> {
        init_reputation::handler(ctx)
    }

    pub fn lock(ctx: Context<Lock>, market_id: Pubkey, amount: u64,
        position_type: PositionType, timeout_slots: u64) -> Result<()> {
        lock::handler(ctx, market_id, amount, position_type, timeout_slots)
    }

    pub fn pre_check(ctx: Context<PreCheck>, current_price: u64, expected_price: u64,
        tolerance_bps: u16, available_liquidity: u64) -> Result<()> {
        precheck::handler(ctx, current_price, expected_price, tolerance_bps, available_liquidity)
    }

    pub fn execute_trade(ctx: Context<Execute>, venue_instruction_data: Vec<u8>,
        fill_price: u64) -> Result<()> {
        execute_ix::handler(ctx, venue_instruction_data, fill_price)
    }

    pub fn revert(ctx: Context<Revert>, reason: RevertReason) -> Result<()> {
        revert::handler(ctx, reason)
    }
}
