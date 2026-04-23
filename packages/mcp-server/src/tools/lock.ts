import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import {
  getContext,
  findReputation,
  findSettlementNft,
  findVault,
  findVaultUsdc,
  parsePositionType,
  explorer,
} from "../client.js";
import {
  AgentVaultTool,
  requireString,
  requireNumber,
  optionalString,
} from "./types.js";

export const lockTool: AgentVaultTool = {
  name: "lock",
  description:
    "Lock USDC in escrow and mint a Settlement NFT. Initiates the atomic settlement envelope (LOCK → PRE-CHECK → EXECUTE → POST-CHECK → SETTLE/REVERT). Returns the settlement NFT and vault PDAs plus the transaction signature.",
  inputSchema: {
    type: "object",
    required: ["usdcMint", "agentUsdc", "amount", "positionType", "timeoutSlots"],
    properties: {
      usdcMint: {
        type: "string",
        description: "SPL USDC mint address (base58).",
      },
      agentUsdc: {
        type: "string",
        description: "Agent's USDC token account address (base58).",
      },
      amount: {
        type: "number",
        description:
          "Amount to lock, in USDC base units (6 decimals). Example: 1_000_000 = 1 USDC.",
      },
      positionType: {
        type: "string",
        enum: ["yes", "no"],
        description: "Position side: 'yes' or 'no'.",
      },
      timeoutSlots: {
        type: "number",
        description:
          "Number of slots before the position can be auto-reverted on timeout. ~400ms/slot on Solana mainnet.",
      },
      marketId: {
        type: "string",
        description:
          "Market identifier as a base58 public key. Optional — if omitted, a random identifier is generated.",
      },
    },
  },
  async execute(input) {
    const { program, agent, cluster } = getContext();

    const usdcMint = new PublicKey(requireString(input, "usdcMint"));
    const agentUsdc = new PublicKey(requireString(input, "agentUsdc"));
    const amount = new BN(requireNumber(input, "amount"));
    const positionType = parsePositionType(requireString(input, "positionType"));
    const timeoutSlots = new BN(requireNumber(input, "timeoutSlots"));

    const marketIdStr = optionalString(input, "marketId");
    const marketId = marketIdStr
      ? new PublicKey(marketIdStr)
      : Keypair.generate().publicKey;

    const settlementNft = findSettlementNft(agent, marketId);
    const vault = findVault(settlementNft);
    const vaultUsdc = findVaultUsdc(vault);

    const sig = await program.methods
      .lock(marketId, amount, positionType, timeoutSlots)
      .accounts({
        agent,
        settlementNft,
        vault,
        reputation: findReputation(agent),
        agentUsdc,
        vaultUsdc,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return {
      success: true,
      txSignature: sig,
      explorer: explorer(sig, cluster),
      marketId: marketId.toBase58(),
      settlementNft: settlementNft.toBase58(),
      vault: vault.toBase58(),
      vaultUsdc: vaultUsdc.toBase58(),
      amount: amount.toString(),
      positionType: "yes" in positionType ? "yes" : "no",
    };
  },
};
