use anchor_lang::prelude::*;

#[error_code]
pub enum AspError {
    #[msg("Market is not active")]
    MarketNotActive,
    #[msg("Price out of tolerance range")]
    PriceOutOfRange,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    #[msg("Invalid settlement status for this instruction")]
    InvalidStatus,
    #[msg("Settlement already finalized")]
    AlreadySettled,
    #[msg("Escrow has been drained unexpectedly")]
    EscrowDrained,
    #[msg("Post-check failed: outcome tokens not received")]
    PostCheckFailed,
    #[msg("Vault is closed")]
    VaultClosed,
    #[msg("Unauthorized agent")]
    UnauthorizedAgent,
    #[msg("Settlement timed out")]
    TimedOut,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
