#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../../target/idl/agentvault.json");
const dstDir = resolve(here, "../idl");
const dst = resolve(dstDir, "agentvault.json");

if (!existsSync(src)) {
  console.error(`IDL not found at ${src}`);
  console.error("Run 'anchor build' in the repo root first.");
  process.exit(1);
}
mkdirSync(dstDir, { recursive: true });
copyFileSync(src, dst);
console.log(`Copied IDL: ${src} -> ${dst}`);
