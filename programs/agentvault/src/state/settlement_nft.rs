use anchor_lang::prelude::*;

#[account]
pub struct SettlementNft {
    pub agent:            Pubkey,   // 32
    pub market_id:        Pubkey,   // 32
    pub position_type:    PositionType, // 1
    pub amount:           u64,      // 8
    pub actual_fill_price: u64,     // 8
    pub trust_score_at_entry: u8,   // 1
    pub fee_bps:          u16,      // 2
    pub collateral_ratio: u16,      // 2
    pub status:           SettlementStatus, // 1
    pub created_slot:     u64,      // 8
    pub executed_slot:    u64,      // 8
    pub settled_slot:     u64,      // 8
    pub timeout_slot:     u64,      // 8
    pub fallback_action:  FallbackAction, // 1
    pub transferable:     bool,     // 1
    pub bump:             u8,       // 1
}

impl SettlementNft {
    pub const LEN: usize = 8  // discriminator
        + 32 + 32             // agent, market_id
        + 1 + 8 + 8           // position_type, amount, fill_price
        + 1 + 2 + 2           // trust_score, fee_bps, collateral_ratio
        + 1 + 8 + 8 + 8 + 8  // status, slots
        + 1 + 1 + 1;          // fallback, transferable, bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum PositionType { Yes, No }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum SettlementStatus {
    Locked,
    PreChecked,
    Executed,
    PostChecked,
    Settled,
    Reverted,
    TimedOut,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum FallbackAction {
    RevertFull,
    PartialSettle,
    HoldForDispute,
}
