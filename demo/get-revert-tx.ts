import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Connection, clusterApiUrl } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import BN from "bn.js";
import fs from "fs";
import path from "path";

const IDL = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../packages/mcp-server/idl/agentvault.json"), "utf-8"));
const PROGRAM_ID = new PublicKey("5TS8fj4dXq2J6DsBxJkAWuWcgxnMVAgDBQgkvHev8xBW");
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const EX = (s: string) => `https://explorer.solana.com/tx/${s}?cluster=devnet`;
const pda = (seeds: Buffer[], pid: PublicKey) => PublicKey.findProgramAddressSync(seeds, pid)[0];

async function main() {
  const agent = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.HOME + "/.config/solana/id.json", "utf-8"))));
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(agent), { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new anchor.Program(IDL, provider);
  console.log("Agent:", agent.publicKey.toBase58());

  const usdcMint = await createMint(connection, agent, agent.publicKey, null, 6);
  const agentUsdc = (await getOrCreateAssociatedTokenAccount(connection, agent, usdcMint, agent.publicKey)).address;
  await mintTo(connection, agent, usdcMint, agentUsdc, agent, 10_000_000_000);
  console.log("usdcMint:", usdcMint.toBase58());

  const repPda = pda([Buffer.from("reputation"), agent.publicKey.toBuffer()], PROGRAM_ID);
  try { await (program.account as any).reputationAccount.fetch(repPda); }
  catch { await program.methods.initReputation().accounts({ agent: agent.publicKey, reputation: repPda, systemProgram: SystemProgram.programId }).signers([agent]).rpc(); }

  const marketId  = Keypair.generate().publicKey;
  const amount    = new BN(1_000_000_000);
  const nftPda    = pda([Buffer.from("settlement_nft"), agent.publicKey.toBuffer(), marketId.toBuffer()], PROGRAM_ID);
  const vaultPda  = pda([Buffer.from("vault"),          nftPda.toBuffer()], PROGRAM_ID);
  const vaultUsdc = pda([Buffer.from("vault_usdc"),     vaultPda.toBuffer()], PROGRAM_ID);

  console.log("\n[LOCK]");
  const lockSig = await program.methods.lock(marketId, amount, { yes: {} }, new BN(5000))
    .accounts({ creditBond: null, agent: agent.publicKey, settlementNft: nftPda,
      vault: vaultPda, reputation: repPda, agentUsdc, vaultUsdc, usdcMint,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
    .rpc();
  console.log("LOCK:", lockSig);
  console.log(EX(lockSig));

  console.log("\n[REVERT]");
  const revertSig = await program.methods.revert({ agentInitiated: {} })
    .accounts({ creditBond: null, agent: agent.publicKey, settlementNft: nftPda,
      vault: vaultPda, vaultUsdc, agentUsdc, reputation: repPda,
      tokenProgram: TOKEN_PROGRAM_ID })
    .rpc();
  console.log("REVERT:", revertSig);
  console.log(EX(revertSig));

  console.log("\n=== PASTE INTO CONFIG ===");
  console.log(`botWallet: "${agent.publicKey.toBase58()}",`);
  console.log(`usdcMint:  "${usdcMint.toBase58()}",`);
  console.log(`lock:    "${lockSig}",`);
  console.log(`revert:  "${revertSig}",`);
}

main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
