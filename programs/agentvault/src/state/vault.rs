use anchor_lang::prelude::*;

#[account]
pub struct Vault {
    pub settlement_nft: Pubkey,  // 32
    pub agent:          Pubkey,  // 32
    pub amount_locked:  u64,     // 8
    pub collateral:     u64,     // 8
    pub is_closed:      bool,    // 1  ← revival attack protection
    pub bump:           u8,      // 1
}

impl Vault {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1 + 1;
}
