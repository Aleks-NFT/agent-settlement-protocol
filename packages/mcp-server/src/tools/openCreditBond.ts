import { SystemProgram } from "@solana/web3.js";
import {
  getContext,
  findReputation,
  findCreditBond,
  explorer,
} from "../client.js";
import { AgentVaultTool } from "./types.js";

export const openCreditBondTool: AgentVaultTool = {
  name: "openCreditBond",
  description:
    "Open an on-chain credit bond for a high-trust agent (trust score > 80). " +
    "Once opened, the agent can lock positions without putting up USDC " +
    "collateral. Credit limit: $10,000 for trust 81–90, $50,000 for trust " +
    "91–100. Requires the agent to have completed prior settlements to " +
    "build sufficient trust score.",
  inputSchema: {
    type: "object",
    required: [],
    properties: {},
  },
  async execute(_input) {
    const { program, agent, cluster } = getContext();

    const creditBond = findCreditBond(agent);

    const sig = await program.methods
      .openCreditBond()
      .accounts({
        agent,
        reputation: findReputation(agent),
        creditBond,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bond = await (program.account as any).creditBond.fetch(creditBond);

    return {
      success: true,
      txSignature: sig,
      explorer: explorer(sig, cluster),
      creditBond: creditBond.toBase58(),
      creditLimit: bond.creditLimit.toString(),
      creditLimitUSDC: `$${(bond.creditLimit.toNumber() / 1_000_000).toLocaleString()}`,
      isActive: bond.isActive,
    };
  },
};
