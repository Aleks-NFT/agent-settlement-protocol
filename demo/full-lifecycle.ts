/**
 * ASP Full Lifecycle Demo
 * Runs on devnet: lock → preCheck → executeTrade → settle
 * Usage: npx ts-node demo/full-lifecycle.ts
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

// ─── Config ───────────────────────────────────────────────────────────────────
const PROGRAM_ID = new PublicKey("24ieTtzuXd4iA2KwcsyHK4qyUFXgmVPhVNadThVmSvGJ");
const connection  = new Connection(clusterApiUrl("devnet"), "confirmed");

const log   = (msg: string)         => console.log(`\n${"─".repeat(60)}\n${msg}`);
const ok    = (label: string, val)  => console.log(`  ✅ ${label}: ${val}`);
const info  = (label: string, val)  => console.log(`  ℹ️  ${label}: ${val}`);

function pda(seeds: Buffer[], programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🚀 Agent Settlement Protocol — Full Lifecycle Demo");
  console.log(`   Program: ${PROGRAM_ID.toBase58()}`);
  console.log(`   Network: devnet\n`);

  // Load wallet
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(
      `${process.env.HOME}/.config/solana/id.json`, "utf8"
    )))
  );
  const wallet   = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program  = new anchor.Program(IDL, provider);

  const agent = walletKeypair;
  info("Agent", agent.publicKey.toBase58());

  // ── 1. USDC mint + token accounts ─────────────────────────────────────────
  log("1️⃣  Setup: USDC mint + token accounts");

  const usdcMint = await createMint(connection, agent, agent.publicKey, null, 6);
  ok("USDC Mint", usdcMint.toBase58());

  const agentUsdcAcc = await getOrCreateAssociatedTokenAccount(
    connection, agent, usdcMint, agent.publicKey
  );
  const agentUsdc = agentUsdcAcc.address;

  const feeCollectorOwner = Keypair.generate();
  const feeCollectorAcc = await getOrCreateAssociatedTokenAccount(
    connection, agent, usdcMint, feeCollectorOwner.publicKey
  );
  const feeCollector = feeCollectorAcc.address;

  await mintTo(connection, agent, usdcMint, agentUsdc, agent, 10_000_000_000);
  ok("Minted USDC", "10,000 USDC → agent");

  // ── 2. Init Reputation ────────────────────────────────────────────────────
  log("2️⃣  Init Reputation");

  const repPda = pda([Buffer.from("reputation"), agent.publicKey.toBuffer()], PROGRAM_ID);
  await program.methods.initReputation()
    .accounts({ agent: agent.publicKey, reputation: repPda })
    .rpc();

  const rep0 = await program.account.reputationAccount.fetch(repPda);
  ok("Trust Score", `${rep0.trustScore}/100`);
  ok("Fee BPS",     `${rep0.trustScore > 80 ? 15 : rep0.trustScore > 50 ? 35 : 50} bps`);

  // ── 3. Lock ───────────────────────────────────────────────────────────────
  log("3️⃣  Lock — escrow 1,000 USDC");

  const marketId = Keypair.generate().publicKey;
  const amount   = new BN(1_000_000_000); // 1,000 USDC

  const nftPda   = pda([Buffer.from("settlement_nft"), agent.publicKey.toBuffer(), marketId.toBuffer()], PROGRAM_ID);
  const vaultPda = pda([Buffer.from("vault"), nftPda.toBuffer()], PROGRAM_ID);
  const vaultUsdc = pda([Buffer.from("vault_usdc"), vaultPda.toBuffer()], PROGRAM_ID);

  const lockTx = await program.methods
    .lock(marketId, amount, { yes: {} }, new BN(5000))
    .accounts({
      agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda,
      reputation: repPda, agentUsdc, vaultUsdc, usdcMint,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    })
    .rpc();

  const nft0 = await program.account.settlementNft.fetch(nftPda);
  ok("Status",   JSON.stringify(nft0.status));
  ok("Amount",   `${amount.toNumber() / 1e6} USDC`);
  ok("TX",       `https://explorer.solana.com/tx/${lockTx}?cluster=devnet`);

  // ── 4. Pyth Mock Feed ─────────────────────────────────────────────────────
  log("4️⃣  Create Pyth Mock Feed (price = $1.00)");

// СТАЛО — используем agent как authority, нет airdrop:
const feed = Keypair.generate();

await program.methods
  .createMockFeed(new BN(1_000_000), new BN(500), -6)
  .accounts({
    authority: agent.publicKey, feed: feed.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([agent, feed])
  .rpc();

  ok("Feed", feed.publicKey.toBase58());
  ok("Price", "$1.000000");

  // ── 5. PreCheck ───────────────────────────────────────────────────────────
  log("5️⃣  PreCheck — validate price on-chain");

  const preCheckTx = await program.methods
    .preCheck(new BN(1_000_000), 500, new BN(5_000_000_000))
    .accounts({
      agent: agent.publicKey, settlementNft: nftPda,
      vault: vaultPda, pythPriceFeed: feed.publicKey,
    })
    .rpc();

  const nft1 = await program.account.settlementNft.fetch(nftPda);
  ok("Status", JSON.stringify(nft1.status));
  ok("TX",     `https://explorer.solana.com/tx/${preCheckTx}?cluster=devnet`);

  // ── 6. Execute ────────────────────────────────────────────────────────────
  log("6️⃣  Execute — fill at $1.05");

  const fillPrice  = new BN(1_050_000); // $1.05
  const executeTx = await program.methods
    .executeTrade(fillPrice)
    .accounts({
      agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda,
      vaultUsdc, agentUsdc, reputation: repPda, tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  const rep1 = await program.account.reputationAccount.fetch(repPda);
  const nft2 = await program.account.settlementNft.fetch(nftPda);
  ok("Status",      JSON.stringify(nft2.status));
  ok("Fill Price",  `$${fillPrice.toNumber() / 1e6}`);
  ok("Trust Score", `${rep1.trustScore}/100 (+1)`);
  ok("TX",          `https://explorer.solana.com/tx/${executeTx}?cluster=devnet`);

  // ── 7. Settle ─────────────────────────────────────────────────────────────
  log("7️⃣  Settle — Pyth confirms price, fee deducted");

  const balBefore = await getAccount(connection, agentUsdc);

  const settleTx = await program.methods
    .settle()
    .accounts({
      agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda,
      agentUsdc, feeCollector, reputationAccount: repPda,
      pythPriceFeed: feed.publicKey, tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  const balAfter = await getAccount(connection, agentUsdc);
  const rep2     = await program.account.reputationAccount.fetch(repPda);
  const nft3     = await program.account.settlementNft.fetch(nftPda);
  const fee      = Number(balBefore.amount) - Number(balAfter.amount);

  ok("Status",              JSON.stringify(nft3.status));
  ok("Fee paid",            `${fee / 1e6} USDC`);
  ok("Trust Score",         `${rep2.trustScore}/100 (+2)`);
  ok("Successful settles",  rep2.successfulSettlements.toString());
  ok("Total volume",        `${rep2.totalVolume.toNumber() / 1e6} USDC`);
  ok("TX",                  `https://explorer.solana.com/tx/${settleTx}?cluster=devnet`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("🏁 LIFECYCLE COMPLETE");
  console.log("═".repeat(60));
  console.log(`   Program:   ${PROGRAM_ID.toBase58()}`);
  console.log(`   Agent:     ${agent.publicKey.toBase58()}`);
  console.log(`   Market:    ${marketId.toBase58()}`);
  console.log(`   Final Trust Score: ${rep2.trustScore}/100`);
  console.log(`   Explorer:  https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=devnet`);
  console.log("═".repeat(60) + "\n");
}

main().catch(err => {
  console.error("❌ Demo failed:", err);
  process.exit(1);
});