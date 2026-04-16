/**
 * AgentVault SDK — typed client for Agent Settlement Protocol
 * Wraps all 6 on-chain instructions with PDA derivation helpers
 */
import * as anchor from "@coral-xyz/anchor";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const IDL = require("../target/idl/agentvault.json");
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";

export const PROGRAM_ID = new PublicKey("24ieTtzuXd4iA2KwcsyHK4qyUFXgmVPhVNadThVmSvGJ");

export function findReputation(agent: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("reputation"), agent.toBuffer()], PROGRAM_ID)[0];
}
export function findSettlementNft(agent: PublicKey, marketId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("settlement_nft"), agent.toBuffer(), marketId.toBuffer()], PROGRAM_ID)[0];
}
export function findVault(settlementNft: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("vault"), settlementNft.toBuffer()], PROGRAM_ID)[0];
}
export function findVaultUsdc(vault: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("vault_usdc"), vault.toBuffer()], PROGRAM_ID)[0];
}

export type PositionType = { yes: Record<string, never> } | { no: Record<string, never> };
export type RevertReason =
  | { preCheckFailed: Record<string, never> }
  | { executionFailed: Record<string, never> }
  | { postCheckFailed: Record<string, never> }
  | { timedOut: Record<string, never> }
  | { agentInitiated: Record<string, never> };

export interface LockParams      { marketId: PublicKey; amount: BN; positionType: PositionType; timeoutSlots: BN; agentUsdc: PublicKey; usdcMint: PublicKey; }
export interface PreCheckParams  { marketId: PublicKey; expectedPrice: BN; toleranceBps: number; availableLiquidity: BN; pythPriceFeed: PublicKey; }
export interface ExecuteParams   { marketId: PublicKey; fillPrice: BN; agentUsdc: PublicKey; }
export interface SettleParams    { marketId: PublicKey; agentUsdc: PublicKey; feeCollector: PublicKey; pythPriceFeed: PublicKey; }
export interface RevertParams    { marketId: PublicKey; reason: RevertReason; agentUsdc: PublicKey; }
export interface MockFeedParams  { price: BN; conf: BN; expo: number; }

export class AgentVaultClient {
  readonly program: anchor.Program;
  readonly provider: anchor.AnchorProvider;

  constructor(provider: anchor.AnchorProvider) {
    this.provider = provider;
    this.program  = new anchor.Program(IDL, provider);
  }
  get agent(): PublicKey { return this.provider.wallet.publicKey; }

  async initReputation(): Promise<string> {
    return this.program.methods.initReputation()
      .accounts({ agent: this.agent, reputation: findReputation(this.agent) })
      .rpc();
  }

  async lock(p: LockParams): Promise<string> {
    const nft = findSettlementNft(this.agent, p.marketId);
    const vault = findVault(nft);
    return this.program.methods.lock(p.marketId, p.amount, p.positionType, p.timeoutSlots)
      .accounts({ agent: this.agent, settlementNft: nft, vault, reputation: findReputation(this.agent),
        agentUsdc: p.agentUsdc, vaultUsdc: findVaultUsdc(vault), usdcMint: p.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
      .rpc();
  }

  async preCheck(p: PreCheckParams): Promise<string> {
    const nft = findSettlementNft(this.agent, p.marketId);
    return this.program.methods.preCheck(p.expectedPrice, p.toleranceBps, p.availableLiquidity)
      .accounts({ agent: this.agent, settlementNft: nft, vault: findVault(nft), pythPriceFeed: p.pythPriceFeed })
      .rpc();
  }

  async executeTrade(p: ExecuteParams): Promise<string> {
    const nft = findSettlementNft(this.agent, p.marketId);
    const vault = findVault(nft);
    return this.program.methods.executeTrade(p.fillPrice)
      .accounts({ agent: this.agent, settlementNft: nft, vault, vaultUsdc: findVaultUsdc(vault),
        agentUsdc: p.agentUsdc, reputation: findReputation(this.agent), tokenProgram: TOKEN_PROGRAM_ID })
      .rpc();
  }

  async settle(p: SettleParams): Promise<string> {
    const nft = findSettlementNft(this.agent, p.marketId);
    return this.program.methods.settle()
      .accounts({ agent: this.agent, settlementNft: nft, vault: findVault(nft),
        agentUsdc: p.agentUsdc, feeCollector: p.feeCollector,
        reputationAccount: findReputation(this.agent),
        pythPriceFeed: p.pythPriceFeed, tokenProgram: TOKEN_PROGRAM_ID })
      .rpc();
  }

  async revert(p: RevertParams): Promise<string> {
    const nft = findSettlementNft(this.agent, p.marketId);
    const vault = findVault(nft);
    return this.program.methods.revert(p.reason)
      .accounts({ agent: this.agent, settlementNft: nft, vault, vaultUsdc: findVaultUsdc(vault),
        agentUsdc: p.agentUsdc, reputation: findReputation(this.agent), tokenProgram: TOKEN_PROGRAM_ID })
      .rpc();
  }

  async createMockFeed(p: MockFeedParams): Promise<{ tx: string; feed: PublicKey }> {
    const feed = Keypair.generate();
    const tx = await this.program.methods.createMockFeed(p.price, p.conf, p.expo)
      .accounts({ authority: this.agent, feed: feed.publicKey, systemProgram: SystemProgram.programId })
      .signers([feed]).rpc();
    return { tx, feed: feed.publicKey };
  }

  async fetchReputation(agent: PublicKey = this.agent) {
    return this.program.account.reputationAccount.fetch(findReputation(agent));
  }
  async fetchSettlementNft(agent: PublicKey, marketId: PublicKey) {
    return this.program.account.settlementNft.fetch(findSettlementNft(agent, marketId));
  }
  async fetchVault(agent: PublicKey, marketId: PublicKey) {
    return this.program.account.vault.fetch(findVault(findSettlementNft(agent, marketId)));
  }
}

export function createClient(provider: anchor.AnchorProvider): AgentVaultClient {
  return new AgentVaultClient(provider);
}
