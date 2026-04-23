import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  getContext,
  findSettlementNft,
  explorer,
} from "../client.js";
import {
  AgentVaultTool,
  requireString,
  requireNumber,
} from "./types.js";

export const listForSaleTool: AgentVaultTool = {
  name: "listForSale",
  description:
    "List a Settlement NFT for factoring (early exit). The position is sold to another agent at a discount before resolution. Atomic — funds move in the same transaction as ownership transfer.",
  inputSchema: {
    type: "object",
    required: ["marketId", "askPrice", "listingExpiresSlot"],
    properties: {
      marketId: {
        type: "string",
        description: "Market identifier (base58 public key) of the locked position.",
      },
      askPrice: {
        type: "number",
        description:
          "Ask price in USDC base units (6 decimals). Example: 970_000 = 0.97 USDC (3% discount on a 1 USDC position).",
      },
      listingExpiresSlot: {
        type: "number",
        description:
          "Absolute slot at which the listing expires. Use `connection.getSlot() + N` for relative expiry.",
      },
    },
  },
  async execute(input) {
    const { program, agent, cluster } = getContext();

    const marketId = new PublicKey(requireString(input, "marketId"));
    const askPrice = new BN(requireNumber(input, "askPrice"));
    const listingExpiresSlot = new BN(requireNumber(input, "listingExpiresSlot"));

    const settlementNft = findSettlementNft(agent, marketId);

    const sig = await program.methods
      .listForSale(askPrice, listingExpiresSlot)
      .accounts({
        seller: agent,
        settlementNft,
      })
      .rpc();

    return {
      success: true,
      txSignature: sig,
      explorer: explorer(sig, cluster),
      status: "listed",
      marketId: marketId.toBase58(),
      settlementNft: settlementNft.toBase58(),
      askPrice: askPrice.toString(),
      listingExpiresSlot: listingExpiresSlot.toString(),
    };
  },
};
