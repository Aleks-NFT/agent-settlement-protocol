#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "═══════════════════════════════════════════════════"
echo "  AgentVault — Hackathon Build Pipeline"
echo "═══════════════════════════════════════════════════"

# ── 1. Ensure output directories exist ─────────────────
mkdir -p target/idl target/types target/deploy
echo "✓ Output directories ready

# Ensure deterministic program keypair
cp keys/agentvault-keypair.json target/deploy/agentvault-keypair.json 2>/dev/null || true"

# ── 2. Build SBF binary ────────────────────────────────
echo ""
echo "▶ Building SBF binary (tools-version v1.54)..."
cargo-build-sbf --tools-version v1.54 \
  --manifest-path programs/agentvault/Cargo.toml
echo "✓ SBF build complete"

SBF_PATH="target/deploy/agentvault.so"
if [[ ! -f "$SBF_PATH" ]]; then
  echo "✗ ERROR: $SBF_PATH not found after build" >&2
  exit 1
fi

# ── 3. Generate IDL ────────────────────────────────────
echo ""
echo "▶ Generating IDL..."

IDL_PATH="target/idl/agentvault.json"

generate_idl() {
  local cmd="$1"
  echo "  Trying: $cmd"
  if eval "$cmd" 2>/dev/null > "$IDL_PATH"; then
    if node -e "JSON.parse(require('fs').readFileSync('$IDL_PATH'))" 2>/dev/null; then
      local size
      size=$(wc -c < "$IDL_PATH")
      if [[ "$size" -gt 100 ]]; then
        return 0
      fi
    fi
  fi
  return 1
}

IDL_SOURCE="anchor idl build"
if ! generate_idl "anchor idl build"; then
  echo "  anchor idl build failed, trying with RUSTUP_TOOLCHAIN=stable..."
  if ! generate_idl "RUSTUP_TOOLCHAIN=stable anchor idl build"; then
    echo "  Both IDL build attempts failed — falling back to committed IDL"
    COMMITTED_IDL="packages/mcp-server/idl/agentvault.json"
    if [[ -f "$COMMITTED_IDL" ]]; then
      cp "$COMMITTED_IDL" "$IDL_PATH"
      IDL_SOURCE="committed ($COMMITTED_IDL)"
    else
      echo "✗ ERROR: No IDL available" >&2
      exit 1
    fi
  fi
fi

# Validate IDL
node -e "
  const idl = JSON.parse(require('fs').readFileSync('$IDL_PATH'));
  if (!idl.instructions || !idl.instructions.length) throw new Error('IDL has no instructions');
  console.log('  Instructions:', idl.instructions.map(i => i.name).join(', '));
"
echo "✓ IDL valid — source: $IDL_SOURCE"

# ── 4. Generate TypeScript types ───────────────────────
echo ""
echo "▶ Generating TypeScript types..."

TYPES_PATH="target/types/agentvault.ts"

if anchor idl type "$IDL_PATH" > "$TYPES_PATH" 2>/dev/null && [[ -s "$TYPES_PATH" ]]; then
  echo "✓ Types generated via anchor idl type"
else
  echo "  anchor idl type unavailable — generating stub types"
  node -e "
const fs = require('fs');
const idl = JSON.parse(fs.readFileSync('$IDL_PATH', 'utf-8'));
const ts = \`import { Idl } from '@coral-xyz/anchor';
export type Agentvault = typeof IDL;
export const IDL: Idl = \${JSON.stringify(idl, null, 2)} as const;\`;
fs.writeFileSync('$TYPES_PATH', ts);
console.log('  Stub types written');
"
  echo "✓ Stub types generated"
fi

# ── 5. Summary ─────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Build Summary"
echo "═══════════════════════════════════════════════════"
printf "  SBF binary : %s (%s bytes)\n" "$SBF_PATH" "$(wc -c < "$SBF_PATH")"
printf "  IDL        : %s (%s bytes)\n" "$IDL_PATH"  "$(wc -c < "$IDL_PATH")"
printf "  Types      : %s (%s bytes)\n" "$TYPES_PATH" "$(wc -c < "$TYPES_PATH")"
echo "═══════════════════════════════════════════════════"
echo "  ✅ Build complete"
echo "═══════════════════════════════════════════════════"
