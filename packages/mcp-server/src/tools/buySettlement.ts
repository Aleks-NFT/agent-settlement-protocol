import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  getContext,
  findSettlementNft,
  findVault,
  findVaultUsdc,
  explorer,
} from "../client.js";
import { AgentVaultTool, requireString } from "./types.js";

export const buySettlementTool: AgentVaultTool = {
  name: "buySettlement",
  description:
    "Buy a Settlement NFT listed for factoring (early exit). Pays the seller's ask price from buyer USDC, atomically transfers NFT ownership and inherits all settlement guarantees and vault collateral.",
  inputSchema: {
    type: "object",
    required: ["seller", "marketId", "sellerUsdc", "buyerUsdc", "usdcMint"],
    properties: {
      seller: {
        type: "string",
        description: "Seller's agent wallet address (base58). Used to derive the Settlement NFT PDA.",
      },
      marketId: {
        type: "string",
        description: "Market identifier (base58 public key) of the listed position.",
      },
      sellerUsdc: {
        type: "string",
        description: "Seller's USDC token account address (base58) to receive payment.",
      },
      buyerUsdc: {
        type: "string",
        description: "Buyer's USDC token account address (base58) to pay from.",
      },
      usdcMint: {
        type: "string",
        description: "SPL USDC mint address (base58).",
      },
    },
  },
  async execute(input) {
    const { program, agent, cluster } = getContext();

    const seller = new PublicKey(requireString(input, "seller"));
    const marketId = new PublicKey(requireString(input, "marketId"));
    const sellerUsdc = new PublicKey(requireString(input, "sellerUsdc"));
    const buyerUsdc = new PublicKey(requireString(input, "buyerUsdc"));
    const usdcMint = new PublicKey(requireString(input, "usdcMint"));

    const settlementNft = findSettlementNft(seller, marketId);
    const vault = findVault(settlementNft);
    const vaultUsdc = findVaultUsdc(vault);

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
      status: "purchased",
      marketId: marketId.toBase58(),
      settlementNft: settlementNft.toBase58(),
      vault: vault.toBase58(),
      vaultUsdc: vaultUsdc.toBase58(),
      newOwner: agent.toBase58(),
    };
  },
};
