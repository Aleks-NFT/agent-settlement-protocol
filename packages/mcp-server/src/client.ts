import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

function loadIdl(): anchor.Idl {
  const candidates = [
    path.resolve(path.dirname(new URL(import.meta.url).pathname), "../idl/agentvault.json"),
    path.resolve(process.cwd(), "idl/agentvault.json"),
    path.resolve(process.cwd(), "target/idl/agentvault.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return require(p);
  }
  throw new Error(
    `agentvault IDL not found. Tried:\n${candidates.map((c) => `  - ${c}`).join("\n")}\n` +
      `Run 'anchor build' in the repo root, or install the published package.`,
  );
}

export const PROGRAM_ID = new PublicKey(
  "24ieTtzuXd4iA2KwcsyHK4qyUFXgmVPhVNadThVmSvGJ",
);

export const findReputation = (agent: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("reputation"), agent.toBuffer()],
    PROGRAM_ID,
  )[0];

export const findSettlementNft = (agent: PublicKey, marketId: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("settlement_nft"), agent.toBuffer(), marketId.toBuffer()],
    PROGRAM_ID,
  )[0];

export const findVault = (nft: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), nft.toBuffer()],
    PROGRAM_ID,
  )[0];

export const findVaultUsdc = (vault: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("vault_usdc"), vault.toBuffer()],
    PROGRAM_ID,
  )[0];

export const findCreditBond = (agent: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("credit_bond"), agent.toBuffer()],
    PROGRAM_ID,
  )[0];

export const explorer = (sig: string, cluster = "devnet") =>
  `https://explorer.solana.com/tx/${sig}?cluster=${cluster}`;

export type PositionType =
  | { yes: Record<string, never> }
  | { no: Record<string, never> };

export type RevertReason =
  | { preCheckFailed: Record<string, never> }
  | { executionFailed: Record<string, never> }
  | { postCheckFailed: Record<string, never> }
  | { timedOut: Record<string, never> }
  | { agentInitiated: Record<string, never> };

export function parsePositionType(s: string): PositionType {
  const v = s.toLowerCase();
  if (v === "yes") return { yes: {} };
  if (v === "no") return { no: {} };
  throw new Error(`positionType must be "yes" or "no", got "${s}"`);
}

export function parseRevertReason(s: string): RevertReason {
  switch (s) {
    case "preCheckFailed":
      return { preCheckFailed: {} };
    case "executionFailed":
      return { executionFailed: {} };
    case "postCheckFailed":
      return { postCheckFailed: {} };
    case "timedOut":
      return { timedOut: {} };
    case "agentInitiated":
      return { agentInitiated: {} };
    default:
      throw new Error(
        `reason must be one of: preCheckFailed, executionFailed, postCheckFailed, timedOut, agentInitiated. Got "${s}"`,
      );
  }
}

export interface AgentContext {
  connection: Connection;
  wallet: anchor.Wallet;
  provider: anchor.AnchorProvider;
  program: anchor.Program;
  agent: PublicKey;
  cluster: string;
}

let cached: AgentContext | null = null;

export function getContext(): AgentContext {
  if (cached) return cached;

  const walletPath =
    process.env.WALLET_KEYPAIR ??
    path.join(os.homedir(), ".config/solana/id.json");

  if (!fs.existsSync(walletPath)) {
    throw new Error(
      `Wallet keypair not found at ${walletPath}. Set WALLET_KEYPAIR env var or create a keypair at ~/.config/solana/id.json.`,
    );
  }

  const secret = Uint8Array.from(
    JSON.parse(fs.readFileSync(walletPath, "utf-8")),
  );
  const keypair = Keypair.fromSecretKey(secret);
  const wallet = new anchor.Wallet(keypair);

  const cluster = process.env.SOLANA_CLUSTER ?? "devnet";
  const rpcUrl = process.env.RPC_URL ?? clusterApiUrl(cluster as any);
  const connection = new Connection(rpcUrl, "confirmed");

  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const idl = loadIdl();
  const program = new anchor.Program(idl, provider);

  cached = {
    connection,
    wallet,
    provider,
    program,
    agent: wallet.publicKey,
    cluster,
  };
  return cached;
}

export { anchor, BN, SystemProgram, TOKEN_PROGRAM_ID };
