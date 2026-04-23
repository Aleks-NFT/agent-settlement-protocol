import { PublicKey } from "@solana/web3.js";
import {
  getContext,
  findSettlementNft,
  findVault,
  explorer,
} from "../client.js";
import { AgentVaultTool, requireString } from "./types.js";

export const postCheckTool: AgentVaultTool = {
  name: "postCheck",
  description:
    "Verify the trade outcome on-chain after execution. Reads the Pyth " +
    "price feed to confirm the market has resolved, validates staleness " +
    "and confidence, then transitions the settlement from Executed → " +
    "PostChecked. Must be called after executeTrade and before settle.",
  inputSchema: {
    type: "object",
    required: ["marketId", "pythPriceFeed"],
    properties: {
      marketId: {
        type: "string",
        description: "Market identifier (base58 public key) used at lock time.",
      },
      pythPriceFeed: {
        type: "string",
        description: "Pyth price feed address (base58) for outcome verification.",
      },
    },
  },
  async execute(input) {
    const { program, agent, cluster } = getContext();

    const marketId = new PublicKey(requireString(input, "marketId"));
    const pythPriceFeed = new PublicKey(requireString(input, "pythPriceFeed"));

    const settlementNft = findSettlementNft(agent, marketId);
    const vault = findVault(settlementNft);

    const sig = await program.methods
      .postCheck()
      .accounts({
        agent,
        settlementNft,
        vault,
        pythPriceFeed,
      })
      .rpc();

    return {
      success: true,
      txSignature: sig,
      explorer: explorer(sig, cluster),
      status: "postChecked",
      marketId: marketId.toBase58(),
    };
  },
};
