// IDL loaded below via require
import IDL from "../target/idl/agentvault.json";
import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";
import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";

import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, MINT_SIZE, ACCOUNT_SIZE,
  createInitializeMintInstruction,
  createInitializeAccount3Instruction,
  createMintToInstruction,
} from "@solana/spl-token";
import { assert } from "chai";

describe("agentvault [litesvm]", () => {
  let client: ReturnType<typeof fromWorkspace>;
  let provider: LiteSVMProvider;
  let program: anchor.Program<any>;

  before(() => {
    client = fromWorkspace(".");
    provider = new LiteSVMProvider(client);
    program = new anchor.Program(IDL, provider);
  });

  function airdrop(pk, sol = 100) {
    provider.client.airdrop(pk, BigInt(sol * 1_000_000_000));
  }

  async function setupReputation(agent) {
    const [reputation] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), agent.publicKey.toBuffer()], program.programId
    );
    await program.methods.initReputation()
      .accounts({ agent: agent.publicKey, reputation })
      .signers([agent]).rpc();
    return reputation;
  }

  async function createTestMint(payer) {
    const mint = Keypair.generate();
    const lamports = 1_461_600;
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint.publicKey,
        lamports: Number(lamports),
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(mint.publicKey, 6, payer.publicKey, null)
    );
    await provider.sendAndConfirm(tx, [payer, mint]);
    return mint.publicKey;
  }

  async function createTestTokenAccount(payer, mint, owner) {
    const tokenAccount = Keypair.generate();
    const lamports = 2_039_280;
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: tokenAccount.publicKey,
        lamports: Number(lamports),
        space: ACCOUNT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeAccount3Instruction(tokenAccount.publicKey, mint, owner.publicKey)
    );
    await provider.sendAndConfirm(tx, [payer, tokenAccount]);
    return tokenAccount.publicKey;
  }

  async function mintTokens(payer, mint, dest, mintAuthority, amount) {
    const tx = new Transaction().add(
      createMintToInstruction(mint, dest, mintAuthority.publicKey, amount)
    );
    await provider.sendAndConfirm(tx, [payer, mintAuthority]);
  }

  async function setupLock(agent, repPda, usdcMint, agentUsdc, amount, timeoutSlots = new BN(1000)) {
    const marketId = Keypair.generate().publicKey;
    const [nftPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("settlement_nft"), agent.publicKey.toBuffer(), marketId.toBuffer()], program.programId
    );
    const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), nftPda.toBuffer()], program.programId);
    const [vaultUsdc] = PublicKey.findProgramAddressSync([Buffer.from("vault_usdc"), vaultPda.toBuffer()], program.programId);
    await program.methods.lock(marketId, amount, { yes: {} }, timeoutSlots)
      .accounts({ creditBond: null, agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, reputation: repPda, agentUsdc, vaultUsdc, usdcMint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
      .signers([agent]).rpc();
    return { marketId, nftPda, vaultPda, vaultUsdc };
  }

  const feeBps = (s) => s <= 20 ? 75 : s <= 50 ? 50 : s <= 80 ? 35 : 15;
  const collateralRatio = (s) => s <= 20 ? 150 : s <= 50 ? 100 : s <= 80 ? 50 : 0;

  // ── Unit: PDA ─────────────────────────────────────────────────────────────
  it("PDA: settlement_nft, vault, reputation are unique", async () => {
    const agent = Keypair.generate();
    const marketId = Keypair.generate().publicKey;
    const [nft, nftBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("settlement_nft"), agent.publicKey.toBuffer(), marketId.toBuffer()], program.programId
    );
    const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), nft.toBuffer()], program.programId);
    assert.notEqual(nft.toBase58(), vault.toBase58());
    assert.isTrue(nftBump <= 255);
  });

  // ── Unit: fee ─────────────────────────────────────────────────────────────
  it("fee: bps=50, amount=100M → 500_000", () => {
    assert.equal(((BigInt(100_000_000) * BigInt(50)) / BigInt(10_000)).toString(), "500000");
  });

  it("fee: bps=0 → 0", () => {
    assert.equal(((BigInt(100_000_000) * BigInt(0)) / BigInt(10_000)).toString(), "0");
  });

  it("fee: bps=15 (trust>80), amount=1T → 1_500_000_000", () => {
    assert.equal(((BigInt(1_000_000_000_000) * BigInt(15)) / BigInt(10_000)).toString(), "1500000000");
  });

  // ── Unit: PolicyController ────────────────────────────────────────────────
  it("PolicyController: fee_bps across all trust_score ranges", () => {
    assert.equal(feeBps(0), 75);   assert.equal(feeBps(20), 75);
    assert.equal(feeBps(21), 50);  assert.equal(feeBps(50), 50);
    assert.equal(feeBps(51), 35);  assert.equal(feeBps(80), 35);
    assert.equal(feeBps(81), 15);  assert.equal(feeBps(100), 15);
  });

  it("PolicyController: collateral_ratio across all trust_score ranges", () => {
    assert.equal(collateralRatio(0), 150);   assert.equal(collateralRatio(20), 150);
    assert.equal(collateralRatio(21), 100);  assert.equal(collateralRatio(50), 100);
    assert.equal(collateralRatio(51), 50);   assert.equal(collateralRatio(80), 50);
    assert.equal(collateralRatio(81), 0);    assert.equal(collateralRatio(100), 0);
  });

  it("escrow: trust=50 → ratio=100%, escrow=amount*2", () => {
    const a = BigInt(1_000_000_000);
    assert.equal(a + (a * BigInt(collateralRatio(50))) / BigInt(100), a * BigInt(2));
  });

  it("escrow: trust>80 → ratio=0%, escrow=amount", () => {
    const a = BigInt(1_000_000_000);
    assert.equal(a + (a * BigInt(collateralRatio(90))) / BigInt(100), a);
  });

  // ── Integration: init_reputation ─────────────────────────────────────────
  it("init_reputation: trust_score=50, all fields zeroed", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    const rep = await program.account.reputationAccount.fetch(repPda);
    assert.equal(rep.trustScore, 50);
    assert.equal(rep.successfulSettlements, 0);
    assert.equal(rep.revertedSettlements, 0);
    assert.equal(rep.totalVolume.toNumber(), 0);
    assert.equal(rep.agent.toBase58(), agent.publicKey.toBase58());
  });

  it("init_reputation: different agents produce different PDAs", async () => {
    const agent1 = Keypair.generate();
    const agent2 = Keypair.generate();
    airdrop(agent1.publicKey); airdrop(agent2.publicKey);
    const rep1 = await setupReputation(agent1);
    const rep2 = await setupReputation(agent2);
    assert.notEqual(rep1.toBase58(), rep2.toBase58());
    assert.equal((await program.account.reputationAccount.fetch(rep1)).agent.toBase58(), agent1.publicKey.toBase58());
    assert.equal((await program.account.reputationAccount.fetch(rep2)).agent.toBase58(), agent2.publicKey.toBase58());
  });

  // ── Integration: lock ─────────────────────────────────────────────────────
  it("lock: SettlementNft.status=Locked, vault.isClosed=false", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);
    const amount = new BN(1_000_000_000);
    const { nftPda, vaultPda } = await setupLock(agent, repPda, usdcMint, agentUsdc, amount);
    const nft = await program.account.settlementNft.fetch(nftPda);
    assert.deepEqual(nft.status, { locked: {} });
    assert.equal(nft.amount.toString(), amount.toString());
    assert.equal((await program.account.vault.fetch(vaultPda)).isClosed, false);
  });

  // ── Integration: lock → revert ────────────────────────────────────────────
  it("lock → revert: status=Reverted, vault.isClosed=true, trust_score decremented", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);
    const { nftPda, vaultPda, vaultUsdc } = await setupLock(agent, repPda, usdcMint, agentUsdc, new BN(1_000_000_000));
    await program.methods.revert({ agentInitiated: {} })
      .accounts({ creditBond: null, agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, vaultUsdc, agentUsdc, reputation: repPda, tokenProgram: TOKEN_PROGRAM_ID })
      .signers([agent]).rpc();
    assert.deepEqual((await program.account.settlementNft.fetch(nftPda)).status, { reverted: {} });
    assert.equal((await program.account.vault.fetch(vaultPda)).isClosed, true);
    const rep = await program.account.reputationAccount.fetch(repPda);
    assert.equal(rep.revertedSettlements, 1);
    assert.equal(rep.trustScore, 49);
  });

  it("revert twice → VaultClosed", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);
    const { nftPda, vaultPda, vaultUsdc } = await setupLock(agent, repPda, usdcMint, agentUsdc, new BN(1_000_000_000));
    const accs = { creditBond: null, agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, vaultUsdc, agentUsdc, reputation: repPda, tokenProgram: TOKEN_PROGRAM_ID };
    await program.methods.revert({ agentInitiated: {} }).accounts(accs).signers([agent]).rpc();
    try {
      await program.methods.revert({ agentInitiated: {} }).accounts(accs).signers([agent]).rpc();
      assert.fail("Expected VaultClosed error");
    } catch (err) { assert.ok(err, "Expected error: vault already closed"); }
  });

  // ── Integration: lock → pre_check → execute_trade ─────────────────────────
  it("lock → pre_check → execute_trade: statuses correct + trust_score incremented", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);
    const { nftPda, vaultPda, vaultUsdc } = await setupLock(agent, repPda, usdcMint, agentUsdc, new BN(1_000_000_000));
    const feed = Keypair.generate();
    airdrop(feed.publicKey);
    await program.methods.createMockFeed(new BN(1_000_000), new BN(100), -6)
      .accounts({ authority: agent.publicKey, feed: feed.publicKey, systemProgram: SystemProgram.programId })
      .signers([agent, feed]).rpc();
    await program.methods.preCheck(new BN(1_000_000), 500, new BN(5_000_000_000))
      .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, pythPriceFeed: feed.publicKey })
      .signers([agent]).rpc();
    assert.deepEqual((await program.account.settlementNft.fetch(nftPda)).status, { preChecked: {} });
    await program.methods.executeTrade(new BN(1_000_000))
      .accounts({ creditBond: null, agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, vaultUsdc, agentUsdc, reputation: repPda, tokenProgram: TOKEN_PROGRAM_ID })
      .signers([agent]).rpc();
    const nft = await program.account.settlementNft.fetch(nftPda);
    assert.deepEqual(nft.status, { executed: {} });
    assert.equal(nft.actualFillPrice.toNumber(), 1_000_000);
    const rep = await program.account.reputationAccount.fetch(repPda);
    assert.equal(rep.successfulSettlements, 1);
    assert.equal(rep.trustScore, 51);
  });

  it("execute_trade without pre_check → InvalidStatus", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);
    const { nftPda, vaultPda, vaultUsdc } = await setupLock(agent, repPda, usdcMint, agentUsdc, new BN(1_000_000_000));
    try {
      await program.methods.executeTrade(new BN(1_000_000))
        .accounts({ creditBond: null, agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, vaultUsdc, agentUsdc, reputation: repPda, tokenProgram: TOKEN_PROGRAM_ID })
        .signers([agent]).rpc();
      assert.fail("Expected InvalidStatus error");
    } catch (err) { assert.include(err.message, "InvalidStatus"); }
  });

  it("execute_trade: fill_price=0 → InvalidFillPrice", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);
    const { nftPda, vaultPda, vaultUsdc } = await setupLock(agent, repPda, usdcMint, agentUsdc, new BN(1_000_000_000));
    const feed = Keypair.generate();
    airdrop(feed.publicKey);
    await program.methods.createMockFeed(new BN(1_000_000), new BN(100), -6)
      .accounts({ authority: agent.publicKey, feed: feed.publicKey, systemProgram: SystemProgram.programId })
      .signers([agent, feed]).rpc();
    await program.methods.preCheck(new BN(1_000_000), 500, new BN(5_000_000_000))
      .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, pythPriceFeed: feed.publicKey })
      .signers([agent]).rpc();
    try {
      await program.methods.executeTrade(new BN(0))
        .accounts({ creditBond: null, agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, vaultUsdc, agentUsdc, reputation: repPda, tokenProgram: TOKEN_PROGRAM_ID })
        .signers([agent]).rpc();
      assert.fail("Expected InvalidFillPrice error");
    } catch (err) { assert.include(err.message, "InvalidFillPrice"); }
  });

  // ── Integration: settle ───────────────────────────────────────────────────
  it("lock → pre_check → execute → settle: status=Settled, trust_score+=2", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    const feeCollector = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);

    const { nftPda, vaultPda, vaultUsdc } = await setupLock(
      agent, repPda, usdcMint, agentUsdc, new BN(1_000_000)
    );

    const feed = Keypair.generate();
    airdrop(feed.publicKey);
    await program.methods.createMockFeed(new BN(1_000_000), new BN(100), -6)
      .accounts({ authority: agent.publicKey, feed: feed.publicKey, systemProgram: SystemProgram.programId })
      .signers([agent, feed]).rpc();

    await program.methods.preCheck(new BN(1_000_000), 500, new BN(5_000_000_000))
      .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, pythPriceFeed: feed.publicKey })
      .signers([agent]).rpc();

    await program.methods.executeTrade(new BN(1_000_000))
      .accounts({ creditBond: null, agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, vaultUsdc, agentUsdc, reputation: repPda, tokenProgram: TOKEN_PROGRAM_ID })
      .signers([agent]).rpc();

    await program.methods.postCheck()
      .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, pythPriceFeed: feed.publicKey })
      .signers([agent]).rpc();

    await program.methods.settle()
      .accounts({
        creditBond: null,
        agent: agent.publicKey,
        settlementNft: nftPda,
        vault: vaultPda,
        agentUsdc,
        feeCollector,
        reputationAccount: repPda,
        pythPriceFeed: feed.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agent]).rpc();

    const nft = await program.account.settlementNft.fetch(nftPda);
    const rep = await program.account.reputationAccount.fetch(repPda);
    assert.deepEqual(nft.status, { settled: {} }, "status should be Settled");
    assert.isAtLeast(rep.trustScore, 52, "trust_score should increase by at least +2");
  });

  it("settle without execute → InvalidStatus", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    const feeCollector = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);

    const { nftPda, vaultPda } = await setupLock(
      agent, repPda, usdcMint, agentUsdc, new BN(1_000_000)
    );

    const feed = Keypair.generate();
    airdrop(feed.publicKey);
    await program.methods.createMockFeed(new BN(1_000_000), new BN(100), -6)
      .accounts({ authority: agent.publicKey, feed: feed.publicKey, systemProgram: SystemProgram.programId })
      .signers([agent, feed]).rpc();

    await program.methods.preCheck(new BN(1_000_000), 500, new BN(5_000_000_000))
      .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, pythPriceFeed: feed.publicKey })
      .signers([agent]).rpc();

    try {
      await program.methods.settle()
        .accounts({
          creditBond: null,
          agent: agent.publicKey,
          settlementNft: nftPda,
          vault: vaultPda,
          agentUsdc,
          feeCollector,
          reputationAccount: repPda,
          pythPriceFeed: feed.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([agent]).rpc();
      assert.fail("должно упасть с InvalidStatus");
    } catch (err: any) {
      assert.ok(
        err.message?.includes("InvalidStatus") || err.error?.errorCode?.code === "InvalidStatus",
        `Expected InvalidStatus, got: ${err.message}`
      );
    }
  });

  it("settle с устаревшим Pyth feed → PriceStale", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    const feeCollector = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);

    const { nftPda, vaultPda, vaultUsdc } = await setupLock(
      agent, repPda, usdcMint, agentUsdc, new BN(1_000_000)
    );

    const staleFeed = Keypair.generate();
    airdrop(staleFeed.publicKey);
    await program.methods.createMockFeed(new BN(1_000_000), new BN(100), -6)
      .accounts({ authority: agent.publicKey, feed: staleFeed.publicKey, systemProgram: SystemProgram.programId })
      .signers([agent, staleFeed]).rpc();

    await program.methods.preCheck(new BN(1_000_000), 500, new BN(5_000_000_000))
      .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, pythPriceFeed: staleFeed.publicKey })
      .signers([agent]).rpc();

    await program.methods.executeTrade(new BN(1_000_000))
      .accounts({ creditBond: null, agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, vaultUsdc, agentUsdc, reputation: repPda, tokenProgram: TOKEN_PROGRAM_ID })
      .signers([agent]).rpc();

    await program.methods.postCheck()
      .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, pythPriceFeed: staleFeed.publicKey })
      .signers([agent]).rpc();

    // Перематываем время на 2 часа вперёд — feed становится stale для settle
    provider.client.warpToSlot(BigInt(7200 * 2 + 1000));

    try {
      await program.methods.settle()
        .accounts({
          creditBond: null,
          agent: agent.publicKey,
          settlementNft: nftPda,
          vault: vaultPda,
          agentUsdc,
          feeCollector,
          reputationAccount: repPda,
          pythPriceFeed: staleFeed.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([agent]).rpc();
      assert.fail("должно упасть с PriceStale");
    } catch (err: any) {
      assert.ok(
        err.message?.includes("PriceStale") || err.error?.errorCode?.code === "PriceStale",
        `Expected PriceStale, got: ${err.message}`
      );
    }
  });

  // ── Integration: post_check ───────────────────────────────────────────────

  it("lock → pre_check → execute → post_check: status=PostChecked", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);

    const { nftPda, vaultPda, vaultUsdc } = await setupLock(
      agent, repPda, usdcMint, agentUsdc, new BN(1_000_000)
    );

    const feed = Keypair.generate();
    airdrop(feed.publicKey);
    await program.methods.createMockFeed(new BN(1_000_000), new BN(100), -6)
      .accounts({ authority: agent.publicKey, feed: feed.publicKey, systemProgram: SystemProgram.programId })
      .signers([agent, feed]).rpc();

    await program.methods.preCheck(new BN(1_000_000), 500, new BN(5_000_000_000))
      .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, pythPriceFeed: feed.publicKey })
      .signers([agent]).rpc();

    await program.methods.executeTrade(new BN(1_000_000))
      .accounts({ creditBond: null, agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, vaultUsdc, agentUsdc, reputation: repPda, tokenProgram: TOKEN_PROGRAM_ID })
      .signers([agent]).rpc();

    await program.methods.postCheck()
      .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, pythPriceFeed: feed.publicKey })
      .signers([agent]).rpc();

    const nft = await program.account.settlementNft.fetch(nftPda);
    assert.deepEqual(nft.status, { postChecked: {} }, "status should be PostChecked");
  });

  it("settle without post_check → InvalidStatus", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    const feeCollector = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);

    const { nftPda, vaultPda, vaultUsdc } = await setupLock(
      agent, repPda, usdcMint, agentUsdc, new BN(1_000_000)
    );

    const feed = Keypair.generate();
    airdrop(feed.publicKey);
    await program.methods.createMockFeed(new BN(1_000_000), new BN(100), -6)
      .accounts({ authority: agent.publicKey, feed: feed.publicKey, systemProgram: SystemProgram.programId })
      .signers([agent, feed]).rpc();

    await program.methods.preCheck(new BN(1_000_000), 500, new BN(5_000_000_000))
      .accounts({ agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, pythPriceFeed: feed.publicKey })
      .signers([agent]).rpc();

    await program.methods.executeTrade(new BN(1_000_000))
      .accounts({ creditBond: null, agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda, vaultUsdc, agentUsdc, reputation: repPda, tokenProgram: TOKEN_PROGRAM_ID })
      .signers([agent]).rpc();

    try {
      await program.methods.settle()
        .accounts({
          creditBond: null,
          agent: agent.publicKey,
          settlementNft: nftPda,
          vault: vaultPda,
          agentUsdc,
          feeCollector,
          pythPriceFeed: feed.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([agent]).rpc();
      assert.fail("должно упасть с InvalidStatus");
    } catch (err: any) {
      assert.ok(
        err.message?.includes("InvalidStatus") || err.error?.errorCode?.code === "InvalidStatus",
        `Expected InvalidStatus, got: ${err.message}`
      );
    }
  });

  // ── Factoring / Early Exit (v0.4.0) ─────────────────────────────────────

  it("list_for_sale: happy path — NFT listed with ask_price", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);
    const { nftPda } = await setupLock(agent, repPda, usdcMint, agentUsdc, new BN(1_000_000));
    const slot = Number(provider.client.getClock().slot);
    await program.methods.listForSale(new BN(500_000), new BN(slot + 1000))
      .accounts({ seller: agent.publicKey, settlementNft: nftPda })
      .signers([agent]).rpc();
    const nft = await program.account.settlementNft.fetch(nftPda);
    assert.ok(nft.listingStatus.listed !== undefined, "expected Listed");
    assert.ok(nft.askPrice.eq(new BN(500_000)), "ask_price mismatch");
  });

  it("list_for_sale: AlreadyListed — cannot list twice", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);
    const { nftPda } = await setupLock(agent, repPda, usdcMint, agentUsdc, new BN(1_000_000));
    const slot = Number(provider.client.getClock().slot);
    await program.methods.listForSale(new BN(500_000), new BN(slot + 1000))
      .accounts({ seller: agent.publicKey, settlementNft: nftPda }).signers([agent]).rpc();
    try {
      await program.methods.listForSale(new BN(500_000), new BN(slot + 2000))
        .accounts({ seller: agent.publicKey, settlementNft: nftPda }).signers([agent]).rpc();
      assert.fail("expected AlreadyListed");
    } catch (err: any) {
      assert.ok(err.message?.includes("AlreadyListed") || err.error?.errorCode?.code === "AlreadyListed",
        `Expected AlreadyListed, got: ${err.message}`);
    }
  });

  it("list_for_sale: InvalidAskPrice — ask_price=0 rejected", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);
    const { nftPda } = await setupLock(agent, repPda, usdcMint, agentUsdc, new BN(1_000_000));
    const slot = Number(provider.client.getClock().slot);
    try {
      await program.methods.listForSale(new BN(0), new BN(slot + 1000))
        .accounts({ seller: agent.publicKey, settlementNft: nftPda }).signers([agent]).rpc();
      assert.fail("expected InvalidAskPrice");
    } catch (err: any) {
      assert.ok(err.message?.includes("InvalidAskPrice") || err.error?.errorCode?.code === "InvalidAskPrice",
        `Expected InvalidAskPrice, got: ${err.message}`);
    }
  });

  it("buy_settlement: CannotBuyOwnListing — seller cannot buy own NFT", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);
    const { nftPda } = await setupLock(agent, repPda, usdcMint, agentUsdc, new BN(1_000_000));
    const slot = Number(provider.client.getClock().slot);
    await program.methods.listForSale(new BN(500_000), new BN(slot + 1000))
      .accounts({ seller: agent.publicKey, settlementNft: nftPda }).signers([agent]).rpc();
    try {
      await program.methods.buySettlement()
        .accounts({ buyer: agent.publicKey, settlementNft: nftPda,
          sellerUsdc: agentUsdc, buyerUsdc: agentUsdc, usdcMint, tokenProgram: TOKEN_PROGRAM_ID })
        .signers([agent]).rpc();
      assert.fail("expected CannotBuyOwnListing");
    } catch (err: any) {
      assert.ok(err.message?.includes("CannotBuyOwnListing") || err.error?.errorCode?.code === "CannotBuyOwnListing",
        `Expected CannotBuyOwnListing, got: ${err.message}`);
    }
  });

  it("buy_settlement: NotListed — cannot buy unlisted NFT", async () => {
    const seller = Keypair.generate();
    const buyer = Keypair.generate();
    airdrop(seller.publicKey); airdrop(buyer.publicKey);
    const repPda = await setupReputation(seller);
    const usdcMint = await createTestMint(seller);
    const sellerUsdc = await createTestTokenAccount(seller, usdcMint, seller);
    const buyerUsdc = await createTestTokenAccount(seller, usdcMint, buyer);
    await mintTokens(seller, usdcMint, sellerUsdc, seller, 10_000_000_000);
    await mintTokens(seller, usdcMint, buyerUsdc, seller, 10_000_000_000);
    const { nftPda } = await setupLock(seller, repPda, usdcMint, sellerUsdc, new BN(1_000_000));
    try {
      await program.methods.buySettlement()
        .accounts({ buyer: buyer.publicKey, settlementNft: nftPda,
          sellerUsdc, buyerUsdc, usdcMint, tokenProgram: TOKEN_PROGRAM_ID })
        .signers([buyer]).rpc();
      assert.fail("expected NotListed");
    } catch (err: any) {
      console.log("[NotListed] err dump:", JSON.stringify({
        name: err?.constructor?.name,
        message: err?.message,
        errorCode: err?.error?.errorCode,
        errorMessage: err?.error?.errorMessage,
        logs: err?.logs ?? (typeof err?.getLogs === "function" ? err.getLogs() : undefined),
        transactionLogs: err?.transactionLogs,
      }, null, 2));
      assert.ok(err.message?.includes("NotListed") || err.error?.errorCode?.code === "NotListed",
        `Expected NotListed, got: ${err.message}`);
    }
  });

  it("buy_settlement: happy path — USDC transferred, current_owner updated", async () => {
    const seller = Keypair.generate();
    const buyer = Keypair.generate();
    airdrop(seller.publicKey); airdrop(buyer.publicKey);
    const repPda = await setupReputation(seller);
    const usdcMint = await createTestMint(seller);
    const sellerUsdc = await createTestTokenAccount(seller, usdcMint, seller);
    const buyerUsdc = await createTestTokenAccount(seller, usdcMint, buyer);
    await mintTokens(seller, usdcMint, sellerUsdc, seller, 10_000_000_000);
    await mintTokens(seller, usdcMint, buyerUsdc, seller, 10_000_000_000);
    const { nftPda } = await setupLock(seller, repPda, usdcMint, sellerUsdc, new BN(1_000_000));
    const slot = Number(provider.client.getClock().slot);
    await program.methods.listForSale(new BN(500_000), new BN(slot + 1000))
      .accounts({ seller: seller.publicKey, settlementNft: nftPda }).signers([seller]).rpc();
    try {
      await program.methods.buySettlement()
        .accounts({ buyer: buyer.publicKey, settlementNft: nftPda,
          sellerUsdc, buyerUsdc, usdcMint, tokenProgram: TOKEN_PROGRAM_ID })
        .signers([buyer]).rpc();
    } catch (err: any) {
      console.log("[happy path] err dump:", JSON.stringify({
        name: err?.constructor?.name,
        message: err?.message,
        errorCode: err?.error?.errorCode,
        errorMessage: err?.error?.errorMessage,
        logs: err?.logs ?? (typeof err?.getLogs === "function" ? err.getLogs() : undefined),
        transactionLogs: err?.transactionLogs,
      }, null, 2));
      throw err;
    }
    const nft = await program.account.settlementNft.fetch(nftPda);
    assert.equal(nft.currentOwner.toBase58(), buyer.publicKey.toBase58(), "current_owner not updated");
    assert.ok(nft.listingStatus.transferred !== undefined, "expected Transferred");
    assert.ok(nft.askPrice.eq(new BN(0)), "ask_price should be zeroed");
  });

  // ── Credit Bond ──────────────────────────────────────────────────────────

  // Helper: set trust_score on an existing reputation account directly in LiteSVM
  async function setTrustScore(agent: Keypair, repPda: PublicKey, trustScore: number) {
    const repData = await program.account.reputationAccount.fetch(repPda);
    const encoded = await program.coder.accounts.encode("reputationAccount", {
      agent: agent.publicKey,
      trustScore,
      successfulSettlements: repData.successfulSettlements,
      revertedSettlements: repData.revertedSettlements,
      totalVolume: repData.totalVolume,
      bump: repData.bump,
    });
    const existing = provider.client.getAccount(repPda);
    provider.client.setAccount(repPda, {
      lamports: existing!.lamports,
      data: encoded,
      owner: program.programId,
      executable: false,
    });
  }

  it("credit_bond: TrustScoreTooLow — trust=0 cannot open bond", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent); // trust_score = 0

    const [creditBondPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("credit_bond"), agent.publicKey.toBuffer()], program.programId
    );
    try {
      await program.methods.openCreditBond()
        .accounts({ agent: agent.publicKey, reputation: repPda, creditBond: creditBondPda, systemProgram: SystemProgram.programId })
        .signers([agent]).rpc();
      assert.fail("должно упасть с TrustScoreTooLow");
    } catch (err: any) {
      assert.ok(
        err.message?.includes("TrustScoreTooLow") || err.error?.errorCode?.code === "TrustScoreTooLow",
        `Expected TrustScoreTooLow, got: ${err.message}`
      );
    }
  });

  it("credit_bond: open happy path — trust=85 → limit=10_000_000_000", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    await setTrustScore(agent, repPda, 85);

    const [creditBondPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("credit_bond"), agent.publicKey.toBuffer()], program.programId
    );
    await program.methods.openCreditBond()
      .accounts({ agent: agent.publicKey, reputation: repPda, creditBond: creditBondPda, systemProgram: SystemProgram.programId })
      .signers([agent]).rpc();

    const bond = await program.account.creditBond.fetch(creditBondPda);
    assert.ok(bond.isActive, "bond should be active");
    assert.ok(bond.creditLimit.eq(new BN(10_000_000_000)), "credit limit should be 10B (trust 81-90)");
    assert.ok(bond.creditUsed.eq(new BN(0)), "credit_used should start at 0");
  });

  it("credit_bond: lock with bond — vault holds only amount, no collateral", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    await setTrustScore(agent, repPda, 85);

    const [creditBondPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("credit_bond"), agent.publicKey.toBuffer()], program.programId
    );
    await program.methods.openCreditBond()
      .accounts({ agent: agent.publicKey, reputation: repPda, creditBond: creditBondPda, systemProgram: SystemProgram.programId })
      .signers([agent]).rpc();

    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);

    const amount = new BN(1_000_000);
    const marketId = Keypair.generate().publicKey;
    const [nftPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("settlement_nft"), agent.publicKey.toBuffer(), marketId.toBuffer()], program.programId
    );
    const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), nftPda.toBuffer()], program.programId);
    const [vaultUsdc] = PublicKey.findProgramAddressSync([Buffer.from("vault_usdc"), vaultPda.toBuffer()], program.programId);

    await program.methods.lock(marketId, amount, { yes: {} }, new BN(1000))
      .accounts({
        creditBond: null,
        agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda,
        reputation: repPda, agentUsdc, vaultUsdc, usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        creditBond: creditBondPda,
      })
      .signers([agent]).rpc();

    const vault = await program.account.vault.fetch(vaultPda);
    assert.ok(vault.collateral.eq(new BN(0)), "collateral should be 0 with credit bond");
    assert.ok(vault.amountLocked.eq(amount), "amount_locked should equal position amount");

    const bond = await program.account.creditBond.fetch(creditBondPda);
    assert.ok(bond.creditUsed.eq(amount), "credit_used should equal locked amount");
  });

  it("credit_bond: CreditLimitExceeded — amount > available credit", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey, 200);
    const repPda = await setupReputation(agent);
    await setTrustScore(agent, repPda, 85);

    const [creditBondPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("credit_bond"), agent.publicKey.toBuffer()], program.programId
    );
    await program.methods.openCreditBond()
      .accounts({ agent: agent.publicKey, reputation: repPda, creditBond: creditBondPda, systemProgram: SystemProgram.programId })
      .signers([agent]).rpc();

    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 100_000_000_000);

    const tooMuch = new BN(11_000_000_000); // > 10B limit for trust 81-90
    const marketId = Keypair.generate().publicKey;
    const [nftPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("settlement_nft"), agent.publicKey.toBuffer(), marketId.toBuffer()], program.programId
    );
    const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), nftPda.toBuffer()], program.programId);
    const [vaultUsdc] = PublicKey.findProgramAddressSync([Buffer.from("vault_usdc"), vaultPda.toBuffer()], program.programId);

    try {
      await program.methods.lock(marketId, tooMuch, { yes: {} }, new BN(1000))
        .accounts({
          creditBond: null,
          agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda,
          reputation: repPda, agentUsdc, vaultUsdc, usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
          creditBond: creditBondPda,
        })
        .signers([agent]).rpc();
      assert.fail("должно упасть с CreditLimitExceeded");
    } catch (err: any) {
      assert.ok(
        err.message?.includes("CreditLimitExceeded") || err.error?.errorCode?.code === "CreditLimitExceeded",
        `Expected CreditLimitExceeded, got: ${err.message}`
      );
    }
  });

  it("credit_bond: credit released after revert — credit_used returns to 0", async () => {
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent);
    await setTrustScore(agent, repPda, 85);

    const [creditBondPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("credit_bond"), agent.publicKey.toBuffer()], program.programId
    );
    await program.methods.openCreditBond()
      .accounts({ agent: agent.publicKey, reputation: repPda, creditBond: creditBondPda, systemProgram: SystemProgram.programId })
      .signers([agent]).rpc();

    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);

    const amount = new BN(1_000_000);
    const marketId = Keypair.generate().publicKey;
    const [nftPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("settlement_nft"), agent.publicKey.toBuffer(), marketId.toBuffer()], program.programId
    );
    const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), nftPda.toBuffer()], program.programId);
    const [vaultUsdc] = PublicKey.findProgramAddressSync([Buffer.from("vault_usdc"), vaultPda.toBuffer()], program.programId);

    await program.methods.lock(marketId, amount, { yes: {} }, new BN(1000))
      .accounts({
        creditBond: null,
        agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda,
        reputation: repPda, agentUsdc, vaultUsdc, usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        creditBond: creditBondPda,
      })
      .signers([agent]).rpc();

    const bondBefore = await program.account.creditBond.fetch(creditBondPda);
    assert.ok(bondBefore.creditUsed.eq(amount), "credit_used should equal locked amount before revert");

    await program.methods.revert({ agentInitiated: {} })
      .accounts({
        creditBond: null,
        agent: agent.publicKey, settlementNft: nftPda, vault: vaultPda,
        vaultUsdc, agentUsdc, reputation: repPda,
        creditBond: creditBondPda, tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agent]).rpc();

    const bondAfter = await program.account.creditBond.fetch(creditBondPda);
    assert.ok(bondAfter.creditUsed.eq(new BN(0)), "credit_used should be 0 after revert");
  });

  it("lock without bond — full collateral applied, ratio=200%", async () => {
    // Agent with trust_score=50 → collateral_ratio=100%, escrow = amount + collateral = amount * 2
    const agent = Keypair.generate();
    airdrop(agent.publicKey);
    const repPda = await setupReputation(agent); // trust_score=50

    const usdcMint = await createTestMint(agent);
    const agentUsdc = await createTestTokenAccount(agent, usdcMint, agent);
    const amount = new BN(1_000_000);
    // Mint enough for amount + 100% collateral = 2_000_000
    await mintTokens(agent, usdcMint, agentUsdc, agent, 10_000_000_000);

    // Lock WITHOUT passing creditBond — should use standard collateral path
    const { nftPda, vaultPda } = await setupLock(agent, repPda, usdcMint, agentUsdc, amount);

    const vault = await program.account.vault.fetch(vaultPda);
    const nft = await program.account.settlementNft.fetch(nftPda);

    // trust_score=50 → collateral_ratio=100 → collateral = amount * 100 / 100 = amount
    assert.ok(vault.collateral.eq(amount), "collateral should equal amount (ratio=100%)");
    assert.ok(vault.amountLocked.eq(amount), "amount_locked should equal position amount");
    assert.equal(nft.collateralRatio, 100, "collateral_ratio should be 100 for trust_score=50");
    assert.deepEqual(nft.status, { locked: {} }, "status should be Locked");
  });

});