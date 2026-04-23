use anchor_lang::prelude::*;

#[account]
pub struct CreditBond {
    pub agent:               Pubkey, // 32
    pub credit_limit:        u64,    // 8  — max USDC lockable without collateral
    pub credit_used:         u64,    // 8  — currently outstanding
    pub is_active:           bool,   // 1
    pub opened_at_slot:      u64,    // 8
    pub trust_score_at_open: u8,     // 1
    pub bump:                u8,     // 1
}

impl CreditBond {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 1 + 8 + 1 + 1; // 67

    pub fn credit_limit_for_score(trust_score: u8) -> u64 {
        match trust_score {
            81..=90  => 10_000_000_000, // $10,000 (6-decimal USDC)
            91..=100 => 50_000_000_000, // $50,000
            _        => 0,
        }
    }
}
