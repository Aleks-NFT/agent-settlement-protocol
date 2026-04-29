import { SystemProgram } from "@solana/web3.js";
import {
  getContext,
  findReputation,
  explorer,
} from "../client.js";
import { AgentVaultTool } from "./types.js";

export const initReputationTool: AgentVaultTool = {
  name: "initReputation",
  description:
    "Initialize an on-chain reputation account for this agent. " +
    "Must be called once before any other AgentVault operation. " +
    "Creates a PDA that tracks trust score, settlement count, and " +
    "revert count. Trust score starts at 50 and adjusts with each settle/revert.",
  inputSchema: {
    type: "object",
    required: [],
    properties: {},
  },
  async execute(_input) {
    const { program, agent, cluster } = getContext();

    const reputation = findReputation(agent);

    const sig = await program.methods
      .initReputation()
      .accounts({
        agent,
        reputation,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rep = await (program.account as any).reputation.fetch(reputation);

    return {
      success: true,
      txSignature: sig,
      explorer: explorer(sig, cluster),
      reputation: reputation.toBase58(),
      trustScore: rep.trustScore,
      settleCount: rep.settleCount,
      revertCount: rep.revertCount,
    };
  },
};
