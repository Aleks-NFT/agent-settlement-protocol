use anchor_lang::prelude::*;

#[account]
pub struct SettlementNft {
    pub agent: Pubkey,           // 32 — original creator (PDA seed, NEVER changes)
    pub current_owner: Pubkey,   // 32 — present holder (updated on buy)
    pub market_id: Pubkey,       // 32
    pub position_type: PositionType, // 1
    pub amount: u64,             // 8
    pub actual_fill_price: u64,  // 8
    pub trust_score_at_entry: u8, // 1
    pub fee_bps: u16,            // 2
    pub collateral_ratio: u16,   // 2
    pub status: SettlementStatus, // 1
    pub created_slot: u64,       // 8
    pub executed_slot: u64,      // 8
    pub settled_slot: u64,       // 8
    pub timeout_slot: u64,       // 8
    pub fallback_action: FallbackAction, // 1
    pub transferable: bool,      // 1
    pub bump: u8,                // 1
    // Factoring v0.4.0
    pub listing_status: ListingStatus, // 1
    pub ask_price: u64,          // 8
    pub listed_at_slot: u64,     // 8
    pub listing_expires_slot: u64, // 8
    // Forward compat
    pub _reserved: [u8; 32],     // 32
}

impl SettlementNft {
    pub const LEN: usize = 8      // discriminator
        + 32 + 32 + 32            // agent, current_owner, market_id
        + 1 + 8 + 8               // position_type, amount, fill_price
        + 1 + 2 + 2               // trust_score, fee_bps, collateral
        + 1 + 8 + 8 + 8 + 8      // status + 4 slots
        + 1 + 1 + 1               // fallback, transferable, bump
        + 1 + 8 + 8 + 8           // listing_status, ask, 2 slots
        + 32;                     // reserved
        // Total: 219
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum PositionType { Yes, No }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum SettlementStatus {
    Locked, PreChecked, Executed, PostChecked, Settled, Reverted, TimedOut,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum FallbackAction { RevertFull, PartialSettle, HoldForDispute }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum ListingStatus { Active, Listed, Transferred }
