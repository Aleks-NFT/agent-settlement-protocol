/**
 * AgentVault — Factoring / Early Exit Demo
 * Bot A opens a position, needs liquidity early, lists at 3% discount.
 * Bot B buys the Settlement NFT. Both get Solana Explorer TX links.
 *
 * Usage: npx ts-node demo/factoring-flow.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const IDL = require("../target/idl/agentvault.json");

import {
  Keypair, PublicKey, SystemProgram, Connection, clusterApiUrl,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount,
} from "@solana/spl-token";
import BN from "bn.js";
import fs from "fs";

// ─── Config ──────────────────────────────────────────────────────────────────
const PROGRAM_ID  = new PublicKey("3MEhXTGUxSNj59rgafTXoBXdsnj7CDQPjk5J29ReHXKx");
const connection  = new Connection(clusterApiUrl("devnet"), "confirmed");
const EXPLORER    = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
const ACCT_LINK   = (pk: string)  => `https://explorer.solana.com/address/${pk}?cluster=devnet`;

const log   = (msg: string)        => console.log(`\n${"─".repeat(64)}\n${msg}`);
const ok    = (label: string, val) => console.log(`  ✅ ${label}: ${val}`);
const info  = (label: string, val) => console.log(`  ℹ️  ${label}: ${val}`);
const link  = (label: string, val) => console.log(`  🔗 ${label}: ${val}`);

function pda(seeds: Buffer[], programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function loadWallet(path: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf-8")))
  );
}

async function setupReputation(
  program: anchor.Program,
  agent: Keypair,
): Promise<PublicKey> {
  const repPda = pda(
    [Buffer.from("reputation"), agent.publicKey.toBuffer()],
    PROGRAM_ID,
  );
  try {
    await program.account.reputationAccount.fetch(repPda);
    info("reputation", "already exists");
  } catch {
    const sig = await program.methods
      .initReputation()
      .accounts({ agent: agent.publicKey, reputationAccount: repPda, systemProgram: SystemProgram.programId })
      .signers([agent])
      .rpc();
    ok("init_reputation", sig);
    link("Explorer", EXPLORER(sig));
  }
  return repPda;
}

async function main() {
  // ─── Wallets ──────────────────────────────────────────────────────────────
  log("🤖 Loading Bot A (seller) and Bot B (buyer) from local keypairs");

  // Bot A = default solana wallet (funded on devnet)
  const botAPath = process.env.BOT_A_KEYPAIR ?? `${process.env.HOME}/.config/solana/id.json`;
  const botA = loadWallet(botAPath);

  // Bot B = second keypair; generate fresh and fund from Bot A via transfer
  const botB = Keypair.generate();

  info("Bot A pubkey", botA.publicKey.toBase58());
  info("Bot B pubkey", botB.publicKey.toBase58());

  // Fund Bot B with 0.1 SOL from Bot A (no airdrop needed)
  const fundTx = new anchor.web3.Transaction().add(
    anchor.web3.SystemProgram.transfer({
      fromPubkey: botA.publicKey,
      toPubkey: botB.publicKey,
      lamports: 100_000_000, // 0.1 SOL
    })
  );
  const fundSig = await connection.sendTransaction(fundTx, [botA]);
  await connection.confirmTransaction(fundSig, "confirmed");
  ok("funded Bot B", "0.1 SOL from Bot A");

  // ─── Program ──────────────────────────────────────────────────────────────
  const walletA = new anchor.Wallet(botA);
  const provider = new anchor.AnchorProvider(connection, walletA, { commitment: "confirmed" });
  const program  = new anchor.Program(IDL, provider) as anchor.Program;

  // ─── USDC mock mint ───────────────────────────────────────────────────────
  log("💵 Creating mock USDC mint");
  const usdcMint = await createMint(connection, botA, botA.publicKey, null, 6);
  ok("usdcMint", usdcMint.toBase58());
  link("Explorer", ACCT_LINK(usdcMint.toBase58()));

  const botAUsdc = (await getOrCreateAssociatedTokenAccount(connection, botA, usdcMint, botA.publicKey)).address;
  const botBUsdc = (await getOrCreateAssociatedTokenAccount(connection, botA, usdcMint, botB.publicKey)).address;

  await mintTo(connection, botA, usdcMint, botAUsdc, botA, 10_000_000_000);
  await mintTo(connection, botA, usdcMint, botBUsdc, botA, 10_000_000_000);
  ok("minted", "10,000 USDC each bot");

  // ─── Reputation ───────────────────────────────────────────────────────────
  log("🏆 Initialising on-chain reputation for both bots");
  const repA = await setupReputation(program, botA);
  const providerB = new anchor.AnchorProvider(connection, new anchor.Wallet(botB), { commitment: "confirmed" });
  const programB  = new anchor.Program(IDL, providerB) as anchor.Program;
  const repB      = await setupReputation(programB, botB);
  ok("reputations", "both initialised");

  // ─── LOCK ─────────────────────────────────────────────────────────────────
  log("🔒 Step 1 — Bot A: LOCK (open position, 1 USDC collateral)");
  const marketId   = Keypair.generate().publicKey;
  const nftPda     = pda([Buffer.from("settlement_nft"), botA.publicKey.toBuffer(), marketId.toBuffer()], PROGRAM_ID);
  const vaultPda   = pda([Buffer.from("vault"), nftPda.toBuffer()], PROGRAM_ID);
  const vaultUsdc  = pda([Buffer.from("vault_usdc"), vaultPda.toBuffer()], PROGRAM_ID);
  const LOCK_AMOUNT = new BN(1_000_000); // 1 USDC

  const lockSig = await program.methods
    .lock(marketId, LOCK_AMOUNT, { yes: {} }, new BN(5000))
    .accounts({
      agent: botA.publicKey, settlementNft: nftPda, vault: vaultPda,
      reputation: repA, agentUsdc: botAUsdc, vaultUsdc, usdcMint,
      creditBond: null, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    })
    .signers([botA]).rpc();

  ok("lock tx", lockSig);
  link("Explorer", EXPLORER(lockSig));
  ok("Settlement NFT", nftPda.toBase58());
  link("NFT account", ACCT_LINK(nftPda.toBase58()));

  // ─── LIST FOR SALE ────────────────────────────────────────────────────────
  log("🏷️  Step 2 — Bot A: LIST FOR SALE (needs liquidity, 3% discount)");
  const slot      = await connection.getSlot();
  const askPrice  = new BN(970_000); // 0.97 USDC — 3% discount on 1 USDC
  const expiresAt = new BN(slot + 300); // ~2 min window

  const listSig = await program.methods
    .listForSale(askPrice, expiresAt)
    .accounts({ seller: botA.publicKey, settlementNft: nftPda })
    .signers([botA]).rpc();

  ok("list_for_sale tx", listSig);
  link("Explorer", EXPLORER(listSig));
  info("ask_price", `${askPrice.toNumber() / 1_000_000} USDC (3% discount)`);

  const nftAfterList = await program.account.settlementNft.fetch(nftPda);
  ok("listing_status", JSON.stringify(nftAfterList.listingStatus));

  // ─── BUY SETTLEMENT ───────────────────────────────────────────────────────
  log("💸 Step 3 — Bot B: BUY SETTLEMENT NFT");
  const balBefore = (await getAccount(connection, botBUsdc)).amount;

  const buySig = await programB.methods
    .buySettlement()
    .accounts({
      buyer: botB.publicKey,
      settlementNft: nftPda,
      sellerUsdc: botAUsdc,
      buyerUsdc: botBUsdc,
      usdcMint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([botB]).rpc();

  ok("buy_settlement tx", buySig);
  link("Explorer", EXPLORER(buySig));

  const balAfter   = (await getAccount(connection, botBUsdc)).amount;
  const nftFinal   = await program.account.settlementNft.fetch(nftPda);
  const balAFinal  = (await getAccount(connection, botAUsdc)).amount;

  ok("Bot B new owner", nftFinal.currentOwner.toBase58());
  ok("listing_status", JSON.stringify(nftFinal.listingStatus));
  info("Bot B USDC spent",  `${(Number(balBefore) - Number(balAfter)) / 1_000_000} USDC`);
  info("Bot A USDC received", `${(Number(balAFinal) - (10_000_000_000 - 1_000_000 * (1 + nftFinal.collateralRatio / 100))) / 1_000_000} USDC net`);

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  log("🎬 FACTORING DEMO COMPLETE");
  console.log(`
  Bot A opened a position needing 1 USDC collateral.
  Bot A needed liquidity — listed the Settlement NFT at 0.97 USDC.
  Bot B bought the NFT, now owns the position.

  This is NOT a simulation. These are live devnet transactions.

  ┌─────────────────────────────────────────────────────────┐
  │  TX 1 lock:          ${EXPLORER(lockSig)}
  │  TX 2 list_for_sale: ${EXPLORER(listSig)}
  │  TX 3 buy_settlement:${EXPLORER(buySig)}
  │  Settlement NFT:     ${ACCT_LINK(nftPda.toBase58())}
  └─────────────────────────────────────────────────────────┘
  `);
}

main().catch((err) => {
  console.error("❌ Demo failed:", err);
  process.exit(1);
});
