use anchor_lang::prelude::*;

pub mod errors;
pub mod state;
pub mod lock;
pub mod precheck;
pub mod mock_feed;
pub mod execute_ix;
pub mod revert;
pub mod settle;
pub mod init_reputation;

use lock::*;
use precheck::*;
use mock_feed::*;
use execute_ix::*;
use revert::*;
use settle::*;
use state::*;
use init_reputation::*;

declare_id!("24ieTtzuXd4iA2KwcsyHK4qyUFXgmVPhVNadThVmSvGJ");

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

    pub fn pre_check(ctx: Context<PreCheck>, expected_price: u64,
        tolerance_bps: u16, available_liquidity: u64) -> Result<()> {
        precheck::handler(ctx, expected_price, tolerance_bps, available_liquidity)
    }

    pub fn execute_trade(ctx: Context<Execute>, fill_price: u64) -> Result<()> {
        execute_ix::handler(ctx, fill_price)
    }

    pub fn create_mock_feed(ctx: Context<CreateMockFeed>, price: i64, conf: u64, expo: i32) -> Result<()> {
        mock_feed::handler(ctx, price, conf, expo)
    }

    pub fn revert(ctx: Context<Revert>, reason: RevertReason) -> Result<()> {
        revert::handler(ctx, reason)
    }


    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        settle::handler(ctx)
    }
}
