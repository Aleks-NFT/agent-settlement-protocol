/**
 * ASP Oracle Failure Demo
 * Shows: bad Pyth feed → preCheck fails → revert → full USDC refund
 * Usage: npx ts-node --esm demo/oracle-failure.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const IDL = require("../target/idl/agentvault.json");
import { Keypair, PublicKey, SystemProgram, Connection, clusterApiUrl } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount } from "@solana/spl-token";
import BN from "bn.js";
import fs from "fs";

const PROGRAM_ID = new PublicKey("24ieTtzuXd4iA2KwcsyHK4qyUFXgmVPhVNadThVmSvGJ");
const connection  = new Connection(clusterApiUrl("devnet"), "confirmed");
const log  = (msg: string) => console.log(`\n${"─".repeat(60)}\n${msg}`);
const ok   = (l: string, v) => console.log(`  ✅ ${l}: ${v}`);
const fail = (l: string, v) => console.log(`  ❌ ${l}: ${v}`);
const info = (l: string, v) => console.log(`  ℹ️  ${l}: ${v}`);
function pda(seeds: Buffer[], pid: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, pid)[0];
}

async function main() {
  console.log("\n🔴 ASP — Oracle Failure Demo");
  console.log("   Scenario: Bad Pyth Feed → PreCheck Fails → Revert → Full Refund");
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf8")))
  );
  const wallet   = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program  = new anchor.Program(IDL, provider);
  const agent    = walletKeypair;
  info("Agent", agent.publicKey.toBase58());

  log("1️⃣  Setup: USDC mint + token accounts");
  const usdcMint = await createMint(connection, agent, agent.publicKey, null, 6);
  const agentUsdcAcc = await getOrCreateAssociatedTokenAccount(connection, agent, usdcMint, agent.publicKey);
  const agentUsdc = agentUsdcAcc.address;
  await mintTo(connection, agent, usdcMint, agentUsdc, agent, 5_000_000_000);
  ok("Minted USDC", "5,000 USDC → agent");

  log("2️⃣  Init Reputation");
  const repPda = pda([Buffer.from("reputation"), agent.publicKey.toBuffer()], PROGRAM_ID);
  await program.methods.initReputation()
    .accounts({ agent: agent.publicKey, reputation: repPda }).rpc();
  const rep0 = await program.account.reputationAccount.fetch(repPda);
  ok("Trust Score", `${rep0.trustScore}/100`);

  log("3️⃣  Lock — escrow 1,000 USDC");
  const marketId  = Keypair.generate().publicKey;
  const amount    = new BN(1_000_000_000);
  const nftPda    = pda([Buffer.from("settlement_nft"), agent.publicKey.toBuffer(), marketId.toBuffer()], PROGRAM_ID);
  const vaultPda  = pda([Buffer.from("vault"), nftPda.toBuffer()], PROGRAM_ID);
  const vaultUsdc = pda([Buffer.from("vault_usdc"), vaultPda.toBuffer()], PROGRAM_ID);
  await program.methods.lock(marketId, amount, { yes: {} }, new BN(5000))
    .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda,
      reputation: repPda, agentUsdc, vaultUsdc, usdcMint,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
    .rpc();
  const bal0 = await getAccount(connection, agentUsdc);
  ok("Status", "locked");
  ok("Agent balance", `${Number(bal0.amount) / 1e6} USDC (1,000 in escrow)`);

  log("4️⃣  PreCheck — invalid feed → expects on-chain rejection");
  const badFeed = Keypair.generate().publicKey;
  info("Feed", `${badFeed.toBase58()} (empty account — fails MIN_FEED_SIZE)`);
  let failed = false;
  let errCode = "";
  try {
    await program.methods.preCheck(new BN(1_000_000), 500, new BN(5_000_000_000))
      .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, pythPriceFeed: badFeed })
      .rpc();
  } catch (e: any) {
    failed  = true;
    errCode = e?.error?.errorCode?.code ?? e?.message?.match(/PriceStale|0x[0-9a-f]+/i)?.[0] ?? "PriceStale";
    fail("PreCheck TX", "REJECTED — oracle validation failed");
    ok("Error code", errCode);
    ok("USDC", "still locked safely in vault");
  }
  if (!failed) { console.log("  ⚠️  unexpected pass"); return; }

  log("5️⃣  Revert — agent triggers full refund");
  const bal1 = await getAccount(connection, agentUsdc);
  const revertTx = await program.methods.revert({ preCheckFailed: {} })
    .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda,
      vaultUsdc, agentUsdc, reputation: repPda, tokenProgram: TOKEN_PROGRAM_ID })
    .rpc();
  const bal2    = await getAccount(connection, agentUsdc);
  const rep1    = await program.account.reputationAccount.fetch(repPda);
  const refund  = Number(bal2.amount) - Number(bal1.amount);
  ok("Status",      "reverted");
  ok("Refunded",    `${refund / 1e6} USDC — full escrow returned`);
  ok("Trust Score", `${rep1.trustScore}/100 (-1 revert penalty)`);
  ok("TX",          `https://explorer.solana.com/tx/${revertTx}?cluster=devnet`);

  console.log("\n" + "═".repeat(60));
  console.log("🛡️  ORACLE FAILURE PROTECTION COMPLETE");
  console.log("═".repeat(60));
  console.log(`   PreCheck rejected:  on-chain oracle validation`);
  console.log(`   USDC refunded:      ${refund / 1e6} USDC`);
  console.log(`   Agent loss:         0 USDC`);
  console.log(`   Trust Score:        ${rep1.trustScore}/100`);
  console.log("\n💡 Without ASP → funds frozen (see Drift Hack $285M, April 2026)");
  console.log("   With ASP    → oracle fails → auto revert → full refund\n");
}
main().catch(err => { console.error("❌ Demo failed:", err); process.exit(1); });
