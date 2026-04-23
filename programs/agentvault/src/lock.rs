use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::AspError;

#[derive(Accounts)]
#[instruction(market_id: Pubkey, amount: u64)]
pub struct Lock<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    // Settlement NFT — создаём здесь
    #[account(
        init,
        payer = agent,
        space = SettlementNft::LEN,
        seeds = [b"settlement_nft", agent.key().as_ref(), market_id.as_ref()],
        bump
    )]
    pub settlement_nft: Account<'info, SettlementNft>,

    // Vault — escrow PDA для USDC
    #[account(
        init,
        payer = agent,
        space = Vault::LEN,
        seeds = [b"vault", settlement_nft.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    // Reputation аккаунт агента (должен уже существовать)
    #[account(
        seeds = [b"reputation", agent.key().as_ref()],
        bump = reputation.bump,
    )]
    pub reputation: Account<'info, ReputationAccount>,

    // USDC токен аккаунт агента
    #[account(
        mut,
        constraint = agent_usdc.mint == usdc_mint.key() @ AspError::UnauthorizedAgent
    )]
    pub agent_usdc: Account<'info, TokenAccount>,

    // Vault USDC токен аккаунт (escrow)
    #[account(
        init_if_needed,
        payer = agent,
        token::mint = usdc_mint,
        token::authority = vault,
        seeds = [b"vault_usdc", vault.key().as_ref()],
        bump
    )]
    pub vault_usdc: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"credit_bond", agent.key().as_ref()],
        bump,
        constraint = credit_bond.agent == agent.key() @ AspError::UnauthorizedAgent,
    )]
    pub credit_bond: Option<Account<'info, CreditBond>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Lock>,
    market_id: Pubkey,
    amount: u64,
    position_type: PositionType,
    timeout_slots: u64,
) -> Result<()> {
    let reputation = &ctx.accounts.reputation;
    let nft = &mut ctx.accounts.settlement_nft;
    let vault = &mut ctx.accounts.vault;

    // 1. PolicyController — читаем параметры из trust score
    let fee_bps = reputation.fee_bps();
    let collateral_ratio = reputation.collateral_ratio();

    // 2. Collateral: zero if agent has an active credit bond, standard otherwise
    let (collateral, escrow_amount) = if let Some(ref bond) = ctx.accounts.credit_bond {
        require!(bond.is_active, AspError::CreditBondInactive);
        let available = bond.credit_limit
            .checked_sub(bond.credit_used)
            .ok_or(AspError::ArithmeticOverflow)?;
        require!(amount <= available, AspError::CreditLimitExceeded);
        (0u64, amount)
    } else {
        let col = amount
            .checked_mul(collateral_ratio as u64)
            .ok_or(AspError::ArithmeticOverflow)?
            .checked_div(100)
            .ok_or(AspError::ArithmeticOverflow)?;
        let esc = amount.checked_add(col).ok_or(AspError::ArithmeticOverflow)?;
        (col, esc)
    };

    // 3. Трансфер USDC агента → vault escrow
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from:      ctx.accounts.agent_usdc.to_account_info(),
            to:        ctx.accounts.vault_usdc.to_account_info(),
            authority: ctx.accounts.agent.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, escrow_amount)?;

    // If credit bond was used, charge credit_used
    if let Some(ref mut bond) = ctx.accounts.credit_bond {
        bond.credit_used = bond.credit_used
            .checked_add(amount)
            .ok_or(AspError::ArithmeticOverflow)?;
    }

    // 4. Инициализируем Settlement NFT
    let clock = Clock::get()?;
    nft.agent              = ctx.accounts.agent.key();
    nft.market_id          = market_id;
    nft.position_type      = position_type;
    nft.amount             = amount;
    nft.actual_fill_price  = 0;
    nft.trust_score_at_entry = reputation.trust_score;
    nft.fee_bps            = fee_bps;
    nft.collateral_ratio   = collateral_ratio;
    nft.status             = SettlementStatus::Locked;
    nft.created_slot       = clock.slot;
    nft.executed_slot      = 0;
    nft.settled_slot       = 0;
    nft.timeout_slot       = clock.slot
        .checked_add(timeout_slots)
        .ok_or(AspError::ArithmeticOverflow)?;
    nft.fallback_action    = FallbackAction::RevertFull;
    nft.current_owner      = ctx.accounts.agent.key();
    nft.transferable       = true;
    nft.listing_status     = crate::state::ListingStatus::Active;
    nft.ask_price          = 0;
    nft.listed_at_slot     = 0;
    nft.listing_expires_slot = 0;
    nft.bump               = ctx.bumps.settlement_nft;

    // 5. Инициализируем Vault
    vault.settlement_nft = nft.key();
    vault.agent          = ctx.accounts.agent.key();
    vault.amount_locked  = amount;
    vault.collateral     = collateral;
    vault.is_closed      = false;  // ← revival attack protection
    vault.bump           = ctx.bumps.vault;
    vault.vault_usdc_bump = ctx.bumps.vault_usdc;

    emit!(SettlementCreated {
        nft:        nft.key(),
        agent:      ctx.accounts.agent.key(),
        amount,
        fee_bps,
        collateral_ratio,
        trust_score: reputation.trust_score,
    });

    Ok(())
}

#[event]
pub struct SettlementCreated {
    pub nft:              Pubkey,
    pub agent:            Pubkey,
    pub amount:           u64,
    pub fee_bps:          u16,
    pub collateral_ratio: u16,
    pub trust_score:      u8,
}
