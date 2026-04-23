import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import {
  getContext,
  findReputation,
  findSettlementNft,
  findVault,
  findVaultUsdc,
  explorer,
} from "../client.js";
import {
  AgentVaultTool,
  requireString,
  requireNumber,
} from "./types.js";

export const executeTradeTool: AgentVaultTool = {
  name: "executeTrade",
  description:
    "Execute the locked trade at the given fill price. Transfers the escrowed USDC back to the agent and records the actual fill. Must be called after preCheck and before settle.",
  inputSchema: {
    type: "object",
    required: ["marketId", "agentUsdc", "fillPrice"],
    properties: {
      marketId: {
        type: "string",
        description: "Market identifier (base58 public key) used at lock time.",
      },
      agentUsdc: {
        type: "string",
        description: "Agent's USDC token account address (base58).",
      },
      fillPrice: {
        type: "number",
        description:
          "Actual fill price in Pyth-native units. Example: 1_050_000 = $1.05 at expo=-6.",
      },
    },
  },
  async execute(input) {
    const { program, agent, cluster } = getContext();

    const marketId = new PublicKey(requireString(input, "marketId"));
    const agentUsdc = new PublicKey(requireString(input, "agentUsdc"));
    const fillPrice = new BN(requireNumber(input, "fillPrice"));

    const settlementNft = findSettlementNft(agent, marketId);
    const vault = findVault(settlementNft);
    const vaultUsdc = findVaultUsdc(vault);

    const sig = await program.methods
      .executeTrade(fillPrice)
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
      status: "executed",
      marketId: marketId.toBase58(),
      fillPrice: fillPrice.toString(),
    };
  },
};
