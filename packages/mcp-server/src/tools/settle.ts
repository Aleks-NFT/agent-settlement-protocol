import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  getContext,
  findReputation,
  findSettlementNft,
  findVault,
  explorer,
} from "../client.js";
import { AgentVaultTool, requireString } from "./types.js";

export const settleTool: AgentVaultTool = {
  name: "settle",
  description:
    "Finalize the settlement: verify the outcome via Pyth, deduct the fee, return collateral, and increment the agent's trust score. Terminal-success state of the envelope.",
  inputSchema: {
    type: "object",
    required: ["marketId", "agentUsdc", "feeCollector", "pythPriceFeed"],
    properties: {
      marketId: {
        type: "string",
        description: "Market identifier (base58 public key) used at lock time.",
      },
      agentUsdc: {
        type: "string",
        description: "Agent's USDC token account address (base58).",
      },
      feeCollector: {
        type: "string",
        description:
          "USDC token account that receives the protocol fee (base58).",
      },
      pythPriceFeed: {
        type: "string",
        description:
          "Pyth price feed address used to verify the settlement outcome.",
      },
    },
  },
  async execute(input) {
    const { program, agent, cluster } = getContext();

    const marketId = new PublicKey(requireString(input, "marketId"));
    const agentUsdc = new PublicKey(requireString(input, "agentUsdc"));
    const feeCollector = new PublicKey(requireString(input, "feeCollector"));
    const pythPriceFeed = new PublicKey(requireString(input, "pythPriceFeed"));

    const settlementNft = findSettlementNft(agent, marketId);
    const vault = findVault(settlementNft);

    const sig = await program.methods
      .settle()
      .accounts({
        agent,
        settlementNft,
        vault,
        agentUsdc,
        feeCollector,
        reputationAccount: findReputation(agent),
        pythPriceFeed,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return {
      success: true,
      txSignature: sig,
      explorer: explorer(sig, cluster),
      status: "settled",
      marketId: marketId.toBase58(),
    };
  },
};
