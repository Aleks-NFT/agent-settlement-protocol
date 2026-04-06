use anchor_lang::prelude::*;

#[account]
pub struct ReputationAccount {
    pub agent:                  Pubkey, // 32
    pub trust_score:            u8,     // 1  (0–100)
    pub successful_settlements: u32,    // 4
    pub reverted_settlements:   u32,    // 4
    pub total_volume:           u64,    // 8
    pub bump:                   u8,     // 1
}

impl ReputationAccount {
    pub const LEN: usize = 8 + 32 + 1 + 4 + 4 + 8 + 1;

    pub fn fee_bps(&self) -> u16 {
        match self.trust_score {
            0..=20  => 75,   // 0.75%
            21..=50 => 50,   // 0.50%
            51..=80 => 35,   // 0.35%
            _       => 15,   // 0.15%
        }
    }

    pub fn collateral_ratio(&self) -> u16 {
        match self.trust_score {
            0..=20  => 150,
            21..=50 => 100,
            51..=80 => 50,
            _       => 0,
        }
    }
}
