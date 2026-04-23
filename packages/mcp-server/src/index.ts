#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { lockTool } from "./tools/lock.js";
import { preCheckTool } from "./tools/preCheck.js";
import { executeTradeTool } from "./tools/executeTrade.js";
import { postCheckTool } from "./tools/postCheck.js";
import { settleTool } from "./tools/settle.js";
import { revertTool } from "./tools/revert.js";
import { listForSaleTool } from "./tools/listForSale.js";
import { openCreditBondTool } from "./tools/openCreditBond.js";
import { closeCreditBondTool } from "./tools/closeCreditBond.js";
import { AgentVaultTool } from "./tools/types.js";

const tools: AgentVaultTool[] = [
  lockTool,
  preCheckTool,
  executeTradeTool,
  postCheckTool,
  settleTool,
  revertTool,
  listForSaleTool,
  openCreditBondTool,
  closeCreditBondTool,
];

const toolMap = new Map(tools.map((t) => [t.name, t]));

const server = new Server(
  { name: "agentvault-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = toolMap.get(name);
  if (!tool) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const result = await tool.execute(args ?? {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[agentvault-mcp] Registered ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`,
  );
}

main().catch((err) => {
  console.error("[agentvault-mcp] Fatal:", err);
  process.exit(1);
});
