import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  getContext,
  findSettlementNft,
  findVault,
  explorer,
} from "../client.js";
import {
  AgentVaultTool,
  requireString,
  requireNumber,
} from "./types.js";

export const preCheckTool: AgentVaultTool = {
  name: "preCheck",
  description:
    "Validate pre-conditions on-chain before executing the trade. Checks the Pyth price feed against an expected price within a tolerance, confirms available liquidity, and enforces the timeout guard. Must be called after lock and before executeTrade.",
  inputSchema: {
    type: "object",
    required: [
      "marketId",
      "expectedPrice",
      "toleranceBps",
      "availableLiquidity",
      "pythPriceFeed",
    ],
    properties: {
      marketId: {
        type: "string",
        description: "Market identifier (base58 public key) used at lock time.",
      },
      expectedPrice: {
        type: "number",
        description:
          "Expected price in Pyth-native units (exponent applied on-chain). Example: 1_000_000 = $1.00 at expo=-6.",
      },
      toleranceBps: {
        type: "number",
        description:
          "Max allowed deviation from expected price, in basis points (100 = 1%).",
      },
      availableLiquidity: {
        type: "number",
        description:
          "Minimum liquidity required (in USDC base units) for the trade to proceed.",
      },
      pythPriceFeed: {
        type: "string",
        description:
          "Pyth price feed address (base58). Use create_mock_feed-generated feed on devnet.",
      },
    },
  },
  async execute(input) {
    const { program, agent, cluster } = getContext();

    const marketId = new PublicKey(requireString(input, "marketId"));
    const expectedPrice = new BN(requireNumber(input, "expectedPrice"));
    const toleranceBps = requireNumber(input, "toleranceBps");
    const availableLiquidity = new BN(
      requireNumber(input, "availableLiquidity"),
    );
    const pythPriceFeed = new PublicKey(requireString(input, "pythPriceFeed"));

    const settlementNft = findSettlementNft(agent, marketId);
    const vault = findVault(settlementNft);

    const sig = await program.methods
      .preCheck(expectedPrice, toleranceBps, availableLiquidity)
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
      status: "preChecked",
      marketId: marketId.toBase58(),
    };
  },
};
