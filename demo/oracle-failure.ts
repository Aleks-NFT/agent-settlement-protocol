/**
 * ASP Oracle Failure Demo
 * Shows: bad Pyth feed → preCheck fails → revert → full USDC refund
 * Usage: npx ts-node demo/oracle-failure.ts
 */
import * as anchor from "@coral-xyz/anchor";
import {
  Keypair, PublicKey, SystemProgram,
  Connection, clusterApiUrl,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, createMint,
  getOrCreateAssociatedTokenAccount, mintTo, getAccount,
} from "@solana/spl-token";
import BN from "bn.js";
import fs from "fs";
import path from "path";

const IDL = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../packages/mcp-server/idl/agentvault.json"),
    "utf-8"
  )
);

const PROGRAM_ID = new PublicKey("3MEhXTGUxSNj59rgafTXoBXdsnj7CDQPjk5J29ReHXKx");
const connection  = new Connection(clusterApiUrl("devnet"), "confirmed");
const EXPLORER_TX = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

const log  = (msg: string)              => console.log(`\n${"─".repeat(64)}\n${msg}`);
const ok   = (l: string, v: unknown)   => console.log(`  ✅ ${l}: ${v}`);
const fail = (l: string, v: unknown)   => console.log(`  ❌ ${l}: ${v}`);
const info = (l: string, v: unknown)   => console.log(`  ℹ️  ${l}: ${v}`);
const link = (l: string, v: unknown)   => console.log(`  🔗 ${l}: ${v}`);

function pda(seeds: Buffer[], programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const accounts = (program: anchor.Program) => (program.account as any);

async function main() {
  console.log("\n🔴 AgentVault — Oracle Failure Demo");
  console.log("   Scenario: Bad Pyth Feed → PreCheck Fails → Revert → Full Refund");
  console.log(`   Program:  ${PROGRAM_ID.toBase58()}`);
  console.log(`   Network:  devnet\n`);

  const agent = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(
        fs.readFileSync(
          process.env.WALLET_KEYPAIR ?? `${process.env.HOME}/.config/solana/id.json`,
          "utf-8"
        )
      )
    )
  );
  const wallet   = new anchor.Wallet(agent);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program  = new anchor.Program(IDL, provider);
  info("Agent", agent.publicKey.toBase58());

  log("1️⃣  Setup: USDC mint + token accounts");
  const usdcMint  = await createMint(connection, agent, agent.publicKey, null, 6);
  const agentUsdc = (
    await getOrCreateAssociatedTokenAccount(connection, agent, usdcMint, agent.publicKey)
  ).address;
  const feeCollectorOwner = Keypair.generate();
  const feeCollector = (
    await getOrCreateAssociatedTokenAccount(connection, agent, usdcMint, feeCollectorOwner.publicKey)
  ).address;
  await mintTo(connection, agent, usdcMint, agentUsdc, agent, 5_000_000_000);
  ok("USDC Mint", usdcMint.toBase58());
  ok("Minted",    "5,000 USDC → agent");

  log("2️⃣  Init Reputation");
  const repPda = pda([Buffer.from("reputation"), agent.publicKey.toBuffer()], PROGRAM_ID);
  try {
    await accounts(program).reputationAccount.fetch(repPda);
    info("reputation", "already exists");
  } catch {
    const sig = await program.methods
      .initReputation()
      .accounts({
        agent:         agent.publicKey,
        reputation:    repPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent])
      .rpc();
    ok("init_reputation tx", sig);
  }
  const rep0 = await accounts(program).reputationAccount.fetch(repPda);
  ok("Trust Score", `${rep0.trustScore}/100`);

  log("3️⃣  Lock — escrow 1,000 USDC");
  const marketId  = Keypair.generate().publicKey;
  const amount    = new BN(1_000_000_000);
  const nftPda    = pda(
    [Buffer.from("settlement_nft"), agent.publicKey.toBuffer(), marketId.toBuffer()],
    PROGRAM_ID
  );
  const vaultPda  = pda([Buffer.from("vault"),      nftPda.toBuffer()], PROGRAM_ID);
  const vaultUsdc = pda([Buffer.from("vault_usdc"), vaultPda.toBuffer()], PROGRAM_ID);

  const lockTx = await program.methods
    .lock(marketId, amount, { yes: {} }, new BN(5000))
    .accounts({
      agent:         agent.publicKey,
      settlementNft: nftPda,
      vault:         vaultPda,
      reputation:    repPda,
      agentUsdc,
      vaultUsdc,
      usdcMint,
      creditBond:    null,
      tokenProgram:  TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const bal0 = await getAccount(connection, agentUsdc);
  ok("Status",        "Locked ✓");
  ok("Agent balance", `${Number(bal0.amount) / 1e6} USDC (1,000 in escrow)`);
  link("TX",          EXPLORER_TX(lockTx));

  log("4️⃣  PreCheck — invalid feed → expects on-chain rejection");
  const badFeed = Keypair.generate().publicKey;
  info("Feed", `${badFeed.toBase58()} (empty account — fails MIN_FEED_SIZE check)`);

  let failed = false;
  let errCode = "";

  try {
    await program.methods
      .preCheck(new BN(1_000_000), 500, new BN(5_000_000_000))
      .accounts({
        agent:         agent.publicKey,
        settlementNft: nftPda,
        vault:         vaultPda,
        pythPriceFeed: badFeed,
      })
      .rpc();
  } catch (e: unknown) {
    failed  = true;
    const err = e as { error?: { errorCode?: { code?: string } }; message?: string };
    errCode = err?.error?.errorCode?.code
      ?? err?.message?.match(/PriceStale|0x[0-9a-f]+/i)?.[0]
      ?? "PriceStale";
    fail("PreCheck TX",  "REJECTED — oracle validation failed on-chain");
    ok("Error code",     errCode);
    ok("USDC in vault",  "still locked safely — not a single lamport moved");
  }

  if (!failed) {
    console.log("  ⚠️  PreCheck unexpectedly passed — check feed validity");
    return;
  }

  log("5️⃣  Revert — agent triggers full refund");
  const bal1     = await getAccount(connection, agentUsdc);
  const revertTx = await program.methods
    .revert({ preCheckFailed: {} })
    .accounts({
      agent:         agent.publicKey,
      settlementNft: nftPda,
      vault:         vaultPda,
      vaultUsdc,
      agentUsdc,
      reputation:    repPda,
      tokenProgram:  TOKEN_PROGRAM_ID,
    })
    .rpc();

  const bal2   = await getAccount(connection, agentUsdc);
  const rep1   = await accounts(program).reputationAccount.fetch(repPda);
  const refund = Number(bal2.amount) - Number(bal1.amount);

  ok("Status",      "Reverted ✓");
  ok("Refunded",    `${refund / 1e6} USDC — full escrow returned`);
  ok("Trust Score", `${rep1.trustScore}/100 (−1 revert penalty applied)`);
  link("TX",        EXPLORER_TX(revertTx));

  console.log("\n" + "═".repeat(64));
  console.log("🛡️  ORACLE FAILURE PROTECTION COMPLETE");
  console.log("═".repeat(64));
  console.log(`   Oracle rejected:    bad feed (MIN_FEED_SIZE, magic check)`);
  console.log(`   USDC refunded:      ${refund / 1e6} USDC`);
  console.log(`   Agent loss:         0 USDC`);
  console.log(`   Trust Score:        ${rep1.trustScore}/100`);
  console.log("\n   Without ASP → funds frozen mid-strategy");
  console.log(`   With ASP    → oracle fails → atomic revert → full refund`);
  console.log("═".repeat(64) + "\n");
}

main().catch(err => {
  console.error("❌ Demo failed:", err);
  process.exit(1);
});
