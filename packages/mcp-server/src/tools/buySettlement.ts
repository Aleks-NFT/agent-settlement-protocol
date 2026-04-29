import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  getContext,
  explorer,
} from "../client.js";
import { AgentVaultTool } from "./types.js";

function requireString(input: Record<string, unknown>, key: string): string {
  const val = input[key];
  if (typeof val !== "string" || !val) throw new Error(`Missing required param: ${key}`);
  return val;
}

export const buySettlementTool: AgentVaultTool = {
  name: "buySettlement",
  description:
    "Buy a settlement NFT listed for early exit (factoring). " +
    "Transfers USDC from buyer to seller at the listed price and transfers " +
    "settlement ownership. Useful for liquidity providers who want to " +
    "acquire positions before final settlement.",
  inputSchema: {
    type: "object",
    required: ["settlementNft", "sellerAddress", "usdcMint"],
    properties: {
      settlementNft: {
        type: "string",
        description: "Settlement NFT account public key (base58)",
      },
      sellerAddress: {
        type: "string",
        description: "Seller wallet public key (base58)",
      },
      usdcMint: {
        type: "string",
        description: "USDC mint address. Devnet: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      },
    },
  },
  async execute(input) {
    const { program, agent, cluster } = getContext();

    const settlementNft = new PublicKey(requireString(input, "settlementNft"));
    const seller        = new PublicKey(requireString(input, "sellerAddress"));
    const usdcMint      = new PublicKey(requireString(input, "usdcMint"));

    const sellerUsdc = getAssociatedTokenAddressSync(usdcMint, seller);
    const buyerUsdc  = getAssociatedTokenAddressSync(usdcMint, agent);

    const sig = await program.methods
      .buySettlement()
      .accounts({
        buyer: agent,
        settlementNft,
        sellerUsdc,
        buyerUsdc,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return {
      success: true,
      txSignature: sig,
      explorer: explorer(sig, cluster),
      newOwner: agent.toBase58(),
      settlementNft: settlementNft.toBase58(),
    };
  },
};
