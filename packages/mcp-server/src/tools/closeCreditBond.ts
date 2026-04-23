import {
  getContext,
  findCreditBond,
  explorer,
} from "../client.js";
import { AgentVaultTool } from "./types.js";

export const closeCreditBondTool: AgentVaultTool = {
  name: "closeCreditBond",
  description:
    "Close an existing credit bond. The bond must have zero outstanding " +
    "positions (credit_used == 0) before it can be closed. All active " +
    "settlements must be settled or reverted first.",
  inputSchema: {
    type: "object",
    required: [],
    properties: {},
  },
  async execute(_input) {
    const { program, agent, cluster } = getContext();

    const creditBond = findCreditBond(agent);

    const sig = await program.methods
      .closeCreditBond()
      .accounts({
        agent,
        creditBond,
      })
      .rpc();

    return {
      success: true,
      txSignature: sig,
      explorer: explorer(sig, cluster),
      status: "closed",
    };
  },
};
