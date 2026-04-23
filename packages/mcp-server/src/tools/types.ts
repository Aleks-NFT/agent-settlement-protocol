import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface AgentVaultTool {
  name: string;
  description: string;
  inputSchema: Tool["inputSchema"];
  execute(input: Record<string, unknown>): Promise<unknown>;
}

export function requireString(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`${key} is required and must be a non-empty string`);
  }
  return v;
}

export function requireNumber(input: Record<string, unknown>, key: string): number {
  const v = input[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(`${key} is required and must be a finite number`);
  }
  return v;
}

export function optionalString(input: Record<string, unknown>, key: string): string | undefined {
  const v = input[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new Error(`${key} must be a string`);
  return v;
}
