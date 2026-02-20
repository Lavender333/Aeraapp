#!/usr/bin/env bash
set -euo pipefail

if [[ "${AERA_ALLOW_DOCS_ASSETS:-0}" == "1" ]]; then
  exit 0
fi

staged_docs_assets=$(git diff --cached --name-only -- docs/assets || true)

if [[ -z "${staged_docs_assets}" ]]; then
  exit 0
fi

echo "[aera] Unstaging generated docs/assets files from commit."
echo "[aera] Set AERA_ALLOW_DOCS_ASSETS=1 to include them intentionally."

# shellcheck disable=SC2086
git restore --staged -- docs/assets
