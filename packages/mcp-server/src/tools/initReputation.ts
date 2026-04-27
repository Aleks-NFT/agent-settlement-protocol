import { SystemProgram } from "@solana/web3.js";
import { getContext, findReputation, explorer } from "../client.js";
import { AgentVaultTool } from "./types.js";

export const initReputationTool: AgentVaultTool = {
  name: "initReputation",
  description:
    "Initialize on-chain reputation account for the agent wallet. Must be called once before any other AgentVault instruction. Sets trust score to 50 (Verified tier), which gives 0.50% fee and 100% collateral requirement.",
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
    const rep = await (program.account as any).reputationAccount.fetch(reputation);

    return {
      success: true,
      txSignature: sig,
      explorer: explorer(sig, cluster),
      agent: agent.toBase58(),
      reputation: reputation.toBase58(),
      trustScore: rep.trustScore,
      tier: "Verified (trust 50 — fee 0.50%, collateral 100%)",
    };
  },
};
