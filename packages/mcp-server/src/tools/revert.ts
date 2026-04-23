import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  getContext,
  findReputation,
  findSettlementNft,
  findVault,
  findVaultUsdc,
  parseRevertReason,
  explorer,
} from "../client.js";
import { AgentVaultTool, requireString } from "./types.js";

export const revertTool: AgentVaultTool = {
  name: "revert",
  description:
    "Revert a settlement at any stage (Locked / PreChecked / Executed). Full USDC escrow is refunded to the agent; trust score is decremented by 1. Callable by the agent for any reason.",
  inputSchema: {
    type: "object",
    required: ["marketId", "agentUsdc", "reason"],
    properties: {
      marketId: {
        type: "string",
        description: "Market identifier (base58 public key) used at lock time.",
      },
      agentUsdc: {
        type: "string",
        description: "Agent's USDC token account (base58) to refund into.",
      },
      reason: {
        type: "string",
        enum: [
          "preCheckFailed",
          "executionFailed",
          "postCheckFailed",
          "timedOut",
          "agentInitiated",
        ],
        description: "Reason for the revert (logged on-chain).",
      },
    },
  },
  async execute(input) {
    const { program, agent, cluster } = getContext();

    const marketId = new PublicKey(requireString(input, "marketId"));
    const agentUsdc = new PublicKey(requireString(input, "agentUsdc"));
    const reason = parseRevertReason(requireString(input, "reason"));

    const settlementNft = findSettlementNft(agent, marketId);
    const vault = findVault(settlementNft);
    const vaultUsdc = findVaultUsdc(vault);

    const sig = await program.methods
      .revert(reason)
      .accounts({
        agent,
        settlementNft,
        vault,
        vaultUsdc,
        agentUsdc,
        reputation: findReputation(agent),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return {
      success: true,
      txSignature: sig,
      explorer: explorer(sig, cluster),
      status: "reverted",
      marketId: marketId.toBase58(),
      reason: Object.keys(reason)[0],
    };
  },
};
