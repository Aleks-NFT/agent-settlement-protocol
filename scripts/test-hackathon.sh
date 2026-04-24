#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ── Build first ────────────────────────────────────────
bash scripts/build-sbf.sh

# ── Prepare log file ───────────────────────────────────
mkdir -p logs
LOG_FILE="logs/test-run-$(date +%s).log"
echo "Test log: $LOG_FILE"
echo ""

# ── Run tests ──────────────────────────────────────────
echo "▶ Running LiteSVM test suite..."
echo "  Command: anchor test --skip-build --skip-deploy"
echo ""

set +e
anchor test --skip-build --skip-deploy 2>&1 | tee "$LOG_FILE"
EXIT_CODE=${PIPESTATUS[0]}
set -e

echo ""
if [[ "$EXIT_CODE" -eq 0 ]]; then
  echo "✅ Tests passed — log: $LOG_FILE"
else
  echo "✗ Tests exited with code $EXIT_CODE — log: $LOG_FILE"
fi

exit "$EXIT_CODE"
