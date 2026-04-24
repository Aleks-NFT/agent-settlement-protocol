#!/usr/bin/env bash
set -euo pipefail

echo "═══════════════════════════════════════════════════"
echo "  AgentVault — Environment Check"
echo "═══════════════════════════════════════════════════"

check() {
  local label="$1"; shift
  local out
  if out=$("$@" 2>&1); then
    printf "  ✅ %-20s %s\n" "$label" "$(echo "$out" | head -1)"
  else
    printf "  ✗  %-20s NOT FOUND\n" "$label"
  fi
}

check "cargo-build-sbf"  cargo-build-sbf --version
check "anchor"           anchor --version
check "solana"           solana --version
check "node"             node -v
check "yarn"             yarn --version

echo ""
echo "  Disk:"
df -h / | tail -1 | awk '{printf "    %-12s used=%-8s avail=%-8s use=%s\n", $1, $3, $4, $5}'

# Warn if free disk < 3GB
FREE_KB=$(df / | tail -1 | awk '{print $4}')
FREE_GB=$(echo "scale=1; $FREE_KB / 1048576" | bc 2>/dev/null || echo "?")
if [[ "$FREE_KB" =~ ^[0-9]+$ ]] && (( FREE_KB < 3145728 )); then
  echo ""
  echo "  ⚠️  WARNING: less than 3GB free (${FREE_GB}GB). Build may fail."
fi

echo ""
echo "  Solana tools cache:"
ls ~/.cache/solana/ 2>/dev/null | sed 's/^/    /' || echo "    (empty)"

echo "═══════════════════════════════════════════════════"
