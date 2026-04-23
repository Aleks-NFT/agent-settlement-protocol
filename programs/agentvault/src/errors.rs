use anchor_lang::prelude::*;

#[error_code]
pub enum AspError {
    // ─── General / existing ──────────────────────────────────────────────
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
    #[msg("Pyth price feed is stale")]
    PriceStale,
    #[msg("Pyth confidence interval too wide")]
    PriceConfidenceTooHigh,
    #[msg("Fill price must be greater than zero")]
    InvalidFillPrice,

    // ─── Factoring / Early Exit (v0.4.0) ─────────────────────────────────
    #[msg("This Settlement NFT is not transferable by policy")]
    NotTransferable,
    #[msg("Settlement NFT is already listed for sale")]
    AlreadyListed,
    #[msg("Settlement NFT is not currently listed for sale")]
    NotListed,
    #[msg("Cannot buy your own listing")]
    CannotBuyOwnListing,
    #[msg("Cannot list a position that has already settled or reverted")]
    CannotListTerminalPosition,
    #[msg("Cannot buy a position that has already settled or reverted")]
    CannotBuyTerminalPosition,
    #[msg("Listing has expired")]
    ListingExpired,
    #[msg("Ask price must be greater than zero")]
    InvalidAskPrice,
    #[msg("Listing expiry must be a future slot")]
    InvalidListingExpiry,
    #[msg("Seller USDC token account owner does not match NFT current_owner")]
    InvalidSellerAccount,
    #[msg("Already transferred — multi-hop secondary market not supported in v0.4.0")]
    AlreadyTransferred,

    // ─── Credit Bond ─────────────────────────────────────────────────────────
    #[msg("Trust score too low to open a credit bond (minimum: 81)")]
    TrustScoreTooLow,
    #[msg("Credit bond is not active")]
    CreditBondInactive,
    #[msg("Amount exceeds available credit limit")]
    CreditLimitExceeded,
    #[msg("Credit bond still has outstanding positions")]
    CreditBondHasOpenPositions,
}
