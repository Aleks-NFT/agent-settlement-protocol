import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Agentvault } from "../target/types/agentvault";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("agentvault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Agentvault as Program<Agentvault>;
  const agent = provider.wallet as anchor.Wallet;

  let usdcMint: PublicKey;
  let agentUsdc: PublicKey;
  let vaultUsdc: PublicKey;
  let settlementNft: PublicKey;
  let vault: PublicKey;
  let reputation: PublicKey;

  const marketId = Keypair.generate().publicKey;

  // ─── PDAs ────────────────────────────────────────────────────────────────

  before(async () => {
    // 1. Mint USDC (6 decimals)
    usdcMint = await createMint(
      provider.connection,
      (agent.payer as any) ?? agent,
      agent.publicKey,
      null,
      6
    );

    // 2. Agent USDC ATA
    agentUsdc = await createAssociatedTokenAccount(
      provider.connection,
      (agent.payer as any) ?? agent,
      usdcMint,
      agent.publicKey
    );

    // 3. Mint 1000 USDC to agent
    await mintTo(
      provider.connection,
      (agent.payer as any) ?? agent,
      usdcMint,
      agentUsdc,
      agent.publicKey,
      1_000_000_000 // 1000 USDC (6 decimals)
    );

    // 4. Derive PDAs
    [settlementNft] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("settlement_nft"),
        agent.publicKey.toBuffer(),
        marketId.toBuffer(),
      ],
      program.programId
    );

    [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), settlementNft.toBuffer()],
      program.programId
    );

    [vaultUsdc] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_usdc"), vault.toBuffer()],
      program.programId
    );

    [reputation] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), agent.publicKey.toBuffer()],
      program.programId
    );

    // 5. Init reputation
    await program.methods
      .initReputation()
      .accounts({
        agent: agent.publicKey,
        reputation,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
}); 

  // ─── lock ────────────────────────────────────────────────────────────────

  it("lock: создаёт Settlement NFT и блокирует USDC в vault", async () => {
    const amount = new BN(100_000_000); // 100 USDC
    const timeoutSlots = new BN(100);

    const tx = await program.methods
      .lock(marketId, amount, { yes: {} }, timeoutSlots)
      .accounts({
        agent: agent.publicKey,
        settlementNft,
        vault,
        vaultUsdc,
        agentUsdc,
        usdcMint,
        reputation,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("lock tx:", tx);

    // Проверяем состояние NFT
    const nftAccount = await program.account.settlementNft.fetch(settlementNft);
    assert.ok(nftAccount.agent.equals(agent.publicKey), "agent mismatch");
    assert.ok(nftAccount.marketId.equals(marketId), "marketId mismatch");
    assert.equal(JSON.stringify(nftAccount.status), JSON.stringify({ locked: {} }));
    assert.equal(nftAccount.amount.toString(), amount.toString());

    // Проверяем что USDC заблокированы
    const vaultUsdcAccount = await getAccount(provider.connection, vaultUsdc);
    const escrowAmount = amount.toNumber() * 2;
    assert.equal(vaultUsdcAccount.amount.toString(), escrowAmount.toString());
  });

  // ─── pre_check ───────────────────────────────────────────────────────────

  it("pre_check: проходит проверку цены и ликвидности", async () => {
    const currentPrice = new BN(6000);   // $0.60 в bps
    const expectedPrice = new BN(6000);
    const toleranceBps = 100;            // 1%
    const availableLiquidity = new BN(200_000_000); // 200 USDC

    const tx = await program.methods
      .preCheck(currentPrice, expectedPrice, toleranceBps, availableLiquidity)
      .accounts({
        agent: agent.publicKey,
        settlementNft,
        vault,
      })
      .rpc();

    console.log("pre_check tx:", tx);

    const nftAccount = await program.account.settlementNft.fetch(settlementNft);
    assert.equal(
      JSON.stringify(nftAccount.status),
      JSON.stringify({ preChecked: {} })
    );
  });

  // ─── pre_check: rejects out-of-range price ───────────────────────────────

  it("pre_check: отклоняет цену вне диапазона", async () => {
    const marketId2 = Keypair.generate().publicKey;
    const [settlementNft2] = PublicKey.findProgramAddressSync(
      [Buffer.from("settlement_nft"), agent.publicKey.toBuffer(), marketId2.toBuffer()],
      program.programId
    );
    const [vault2] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), settlementNft2.toBuffer()],
      program.programId
    );
    const [vaultUsdc2] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_usdc"), vault2.toBuffer()],
      program.programId
    );
    await program.methods
      .lock(marketId2, new BN(100_000_000), { yes: {} }, new BN(100))
      .accounts({
        agent: agent.publicKey, settlementNft: settlementNft2,
        vault: vault2, vaultUsdc: vaultUsdc2, agentUsdc, usdcMint,
        reputation, tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    try {
      await program.methods
        .preCheck(new BN(7000), new BN(6000), 100, new BN(200_000_000))
        .accounts({ agent: agent.publicKey, settlementNft: settlementNft2, vault: vault2 })
        .rpc();
      assert.fail("Expected PriceOutOfRange");
    } catch (err: any) {
      assert.include(err.toString(), "PriceOutOfRange", `Got: ${err.message}`);
    }
  });

  // ─── revert ───────────────────────────────────────────────────────────────

  it("revert: возвращает USDC агенту и обновляет статус", async () => {
    const agentUsdcBefore = await getAccount(provider.connection, agentUsdc);

    const tx = await program.methods
      .revert({ agentInitiated: {} })
      .accounts({
        agent: agent.publicKey,
        settlementNft,
        vault,
        vaultUsdc,
        agentUsdc,
        reputation,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("revert tx:", tx);

    const nftAccount = await program.account.settlementNft.fetch(settlementNft);
    assert.equal(
      JSON.stringify(nftAccount.status),
      JSON.stringify({ reverted: {} })
    );

    // Проверяем возврат USDC
    const agentUsdcAfter = await getAccount(provider.connection, agentUsdc);
    assert.isTrue(
      BigInt(agentUsdcAfter.amount) > BigInt(agentUsdcBefore.amount),
      "USDC должны вернуться агенту"
    );
  });

  it("execute: исполняет сделку и обновляет репутацию", async () => {
    const marketId3 = Keypair.generate().publicKey;
    const [settlementNft3] = PublicKey.findProgramAddressSync(
      [Buffer.from("settlement_nft"), agent.publicKey.toBuffer(), marketId3.toBuffer()],
      program.programId
    );
    const [vault3] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), settlementNft3.toBuffer()],
      program.programId
    );
    const [vaultUsdc3] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_usdc"), vault3.toBuffer()],
      program.programId
    );
    await program.methods
      .lock(marketId3, new BN(100_000_000), { yes: {} }, new BN(200))
      .accounts({
        agent: agent.publicKey, settlementNft: settlementNft3,
        vault: vault3, vaultUsdc: vaultUsdc3, agentUsdc, usdcMint,
        reputation, tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    await program.methods
      .preCheck(new BN(6000), new BN(6000), 100, new BN(200_000_000))
      .accounts({ agent: agent.publicKey, settlementNft: settlementNft3, vault: vault3 })
      .rpc();
    const balanceBefore = await getAccount(provider.connection, agentUsdc);
    const repBefore = await program.account.reputationAccount.fetch(reputation);
    const tx = await program.methods
      .executeTrade(Buffer.from([]), new BN(6050))
      .accounts({
        agent: agent.publicKey, settlementNft: settlementNft3,
        vault: vault3, vaultUsdc: vaultUsdc3, agentUsdc,
        reputation, tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log("execute tx:", tx);
    const nft = await program.account.settlementNft.fetch(settlementNft3);
    assert.equal(JSON.stringify(nft.status), JSON.stringify({ executed: {} }));
    assert.equal(nft.actualFillPrice.toString(), "6050");
    const balanceAfter = await getAccount(provider.connection, agentUsdc);
    assert.isTrue(BigInt(balanceAfter.amount) > BigInt(balanceBefore.amount), "USDC должны вернуться");
    const repAfter = await program.account.reputationAccount.fetch(reputation);
    assert.isTrue(repAfter.successfulSettlements > repBefore.successfulSettlements, "reputation должна вырасти");
  });

});
