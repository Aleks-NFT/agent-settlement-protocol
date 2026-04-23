/**
 * ASP Full Lifecycle Demo
 * Runs on devnet: lock → preCheck → executeTrade → postCheck → settle
 * Usage: npx ts-node demo/full-lifecycle.ts
 *        FACTORING=1 npx ts-node demo/full-lifecycle.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Connection, clusterApiUrl } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount } from "@solana/spl-token";
import BN from "bn.js";
import fs from "fs";
import path from "path";

// Load IDL from committed path (no anchor build needed)
const IDL = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../packages/mcp-server/idl/agentvault.json"), "utf-8")
);

const PROGRAM_ID   = new PublicKey("5SV1Q7yEff4jh5NkH48pTh5okh9mKAXXqdUMjfimWHVW");
const connection   = new Connection(clusterApiUrl("devnet"), "confirmed");
const EXPLORER_TX  = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
const SHOW_FACTORING = process.env.FACTORING === "1";

const log  = (msg: string)       => console.log(`\n${"─".repeat(64)}\n${msg}`);
const ok   = (label: string, val: unknown) => console.log(`  ✅ ${label}: ${val}`);
const info = (label: string, val: unknown) => console.log(`  ℹ️  ${label}: ${val}`);
const link = (label: string, val: unknown) => console.log(`  🔗 ${label}: ${val}`);

function pda(seeds: Buffer[], programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}
function loadWallet(p: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf-8"))));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const accounts = (program: anchor.Program) => (program.account as any);

async function ensureReputation(program: anchor.Program, agent: Keypair): Promise<PublicKey> {
  const repPda = pda([Buffer.from("reputation"), agent.publicKey.toBuffer()], PROGRAM_ID);
  try {
    await accounts(program).reputationAccount.fetch(repPda);
    info("reputation", "already exists");
  } catch {
    const sig = await program.methods.initReputation()
      .accounts({ agent: agent.publicKey, reputation: repPda, systemProgram: SystemProgram.programId })
      .signers([agent]).rpc();
    ok("init_reputation", sig);
  }
  return repPda;
}

async function main() {
  console.log("\n🚀 AgentVault — Full Lifecycle Demo");
  console.log(`   Program: ${PROGRAM_ID.toBase58()}`);
  console.log(`   Network: devnet`);
  console.log(`   Mode:    ${SHOW_FACTORING ? "lifecycle + factoring" : "lifecycle only"}\n`);

  const agent    = loadWallet(process.env.WALLET_KEYPAIR ?? `${process.env.HOME}/.config/solana/id.json`);
  const wallet   = new anchor.Wallet(agent);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program  = new anchor.Program(IDL, provider);
  info("Agent", agent.publicKey.toBase58());

  log("1️⃣  Setup: USDC mint + token accounts");
  const usdcMint = await createMint(connection, agent, agent.publicKey, null, 6);
  ok("USDC Mint", usdcMint.toBase58());
  const agentUsdc = (await getOrCreateAssociatedTokenAccount(connection, agent, usdcMint, agent.publicKey)).address;
  const feeCollectorOwner = Keypair.generate();
  const feeCollector = (await getOrCreateAssociatedTokenAccount(connection, agent, usdcMint, feeCollectorOwner.publicKey)).address;
  await mintTo(connection, agent, usdcMint, agentUsdc, agent, 10_000_000_000);
  ok("Minted", "10,000 USDC → agent");

  log("2️⃣  Reputation");
  const repPda = await ensureReputation(program, agent);
  const rep0   = await accounts(program).reputationAccount.fetch(repPda);
  ok("Trust Score", `${rep0.trustScore}/100`);

  log("3️⃣  Lock — escrow 1,000 USDC");
  const marketId  = Keypair.generate().publicKey;
  const amount    = new BN(1_000_000_000);
  const nftPda    = pda([Buffer.from("settlement_nft"), agent.publicKey.toBuffer(), marketId.toBuffer()], PROGRAM_ID);
  const vaultPda  = pda([Buffer.from("vault"), nftPda.toBuffer()], PROGRAM_ID);
  const vaultUsdc = pda([Buffer.from("vault_usdc"), vaultPda.toBuffer()], PROGRAM_ID);
  const lockTx = await program.methods
    .lock(marketId, amount, { yes: {} }, new BN(5000))
    .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda,
      reputation: repPda, agentUsdc, vaultUsdc, usdcMint,
      creditBond: null,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
    .rpc();
  ok("Status",  JSON.stringify((await accounts(program).settlementNft.fetch(nftPda)).status));
  ok("Amount",  `${amount.toNumber() / 1e6} USDC`);
  link("TX",    EXPLORER_TX(lockTx));

  if (SHOW_FACTORING) {
    log("4️⃣  [FACTORING] Early exit — Bot A lists at 3% discount, Bot B buys");
    const slot     = await connection.getSlot();
    const askPrice = new BN(970_000_000);
    const botB     = Keypair.generate();
    const fundTx   = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({ fromPubkey: agent.publicKey, toPubkey: botB.publicKey, lamports: 100_000_000 })
    );
    await connection.sendTransaction(fundTx, [agent]).then(s => connection.confirmTransaction(s, "confirmed"));
    const botBUsdc = (await getOrCreateAssociatedTokenAccount(connection, agent, usdcMint, botB.publicKey)).address;
    await mintTo(connection, agent, usdcMint, botBUsdc, agent, 1_000_000_000);
    const providerB = new anchor.AnchorProvider(connection, new anchor.Wallet(botB), { commitment: "confirmed" });
    const programB  = new anchor.Program(IDL, providerB);
    await ensureReputation(programB, botB);
    const listSig = await program.methods.listForSale(askPrice, new BN(slot + 300))
      .accounts({ seller: agent.publicKey, settlementNft: nftPda }).signers([agent]).rpc();
    ok("list_for_sale", `ask = ${askPrice.toNumber() / 1e6} USDC`);
    link("TX", EXPLORER_TX(listSig));
    const buySig = await programB.methods.buySettlement()
      .accounts({ buyer: botB.publicKey, settlementNft: nftPda,
        sellerUsdc: agentUsdc, buyerUsdc: botBUsdc, usdcMint, tokenProgram: TOKEN_PROGRAM_ID })
      .signers([botB]).rpc();
    const nftF = await accounts(program).settlementNft.fetch(nftPda);
    ok("New owner",      nftF.currentOwner.toBase58());
    ok("listing_status", JSON.stringify(nftF.listingStatus));
    link("TX",           EXPLORER_TX(buySig));
    console.log(`\n  ┌────────────────────────────────────────────────────┐`);
    console.log(`  │ FACTORING COMPLETE — Bot A exited at 0.97 USDC   │`);
    console.log(`  │ Bot B owns the NFT, continues lifecycle below     │`);
    console.log(`  └────────────────────────────────────────────────────┘`);
  }

  log("5️⃣  Pyth Mock Feed (price = $1.00)");
  const feed = Keypair.generate();
  await program.methods.createMockFeed(new BN(1_000_000), new BN(500), -6)
    .accounts({ authority: agent.publicKey, feed: feed.publicKey, systemProgram: SystemProgram.programId })
    .signers([agent, feed]).rpc();
  ok("Feed", feed.publicKey.toBase58());

  log("6️⃣  PreCheck — validate price on-chain");
  const preCheckTx = await program.methods.preCheck(new BN(1_000_000), 500, new BN(5_000_000_000))
    .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, pythPriceFeed: feed.publicKey }).rpc();
  ok("Status", JSON.stringify((await accounts(program).settlementNft.fetch(nftPda)).status));
  link("TX",   EXPLORER_TX(preCheckTx));

  log("7️⃣  Execute — fill at $1.05");
  const fillPrice = new BN(1_050_000);
  const executeTx = await program.methods.executeTrade(fillPrice)
    .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda,
      vaultUsdc, agentUsdc, reputation: repPda, tokenProgram: TOKEN_PROGRAM_ID }).rpc();
  const rep1 = await accounts(program).reputationAccount.fetch(repPda);
  ok("Status",      JSON.stringify((await accounts(program).settlementNft.fetch(nftPda)).status));
  ok("Trust Score", `${rep1.trustScore}/100`);
  link("TX",        EXPLORER_TX(executeTx));

  log("8️⃣  PostCheck — verify outcome on-chain");
  const postCheckTx = await program.methods.postCheck()
    .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, pythPriceFeed: feed.publicKey })
    .rpc();
  ok("Status", JSON.stringify((await accounts(program).settlementNft.fetch(nftPda)).status));
  link("TX",   EXPLORER_TX(postCheckTx));

  log("9️⃣  Settle — Pyth confirms, fee deducted, reputation +2");
  const balBefore = await getAccount(connection, agentUsdc);
  const settleTx  = await program.methods.settle()
    .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda,
      agentUsdc, feeCollector, reputation: repPda,
      pythPriceFeed: feed.publicKey, creditBond: null,
      tokenProgram: TOKEN_PROGRAM_ID }).rpc();
  const rep2 = await accounts(program).reputationAccount.fetch(repPda);
  const nft3 = await accounts(program).settlementNft.fetch(nftPda);
  const fee  = Number(balBefore.amount) - Number((await getAccount(connection, agentUsdc)).amount);
  ok("Status",             JSON.stringify(nft3.status));
  ok("Fee paid",           `${fee / 1e6} USDC`);
  ok("Trust Score",        `${rep2.trustScore}/100`);
  ok("Successful settles", rep2.successfulSettlements.toString());
  ok("Total volume",       `${rep2.totalVolume.toNumber() / 1e6} USDC`);
  link("TX",               EXPLORER_TX(settleTx));

  console.log("\n" + "═".repeat(64));
  console.log("🏁 LIFECYCLE COMPLETE");
  console.log("═".repeat(64));
  console.log(`   Agent:       ${agent.publicKey.toBase58()}`);
  console.log(`   Trust Score: ${rep2.trustScore}/100`);
  console.log(`   Flow:        ${SHOW_FACTORING ? "lock → factoring → precheck → execute → post_check → settle" : "lock → precheck → execute → post_check → settle"}`);
  console.log(`   Explorer:    https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=devnet`);
  console.log("═".repeat(64) + "\n");
}

main().catch(err => { console.error("❌ Demo failed:", err); process.exit(1); });
