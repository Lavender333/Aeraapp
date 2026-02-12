#!/usr/bin/env bash
set -euo pipefail

# Installs a cron entry to run AERA Level 3 pipeline nightly.
# Defaults: 02:15 every day

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNNER_SCRIPT="$PROJECT_ROOT/scripts/run-nightly-level3.sh"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/level3-nightly.log"

CRON_MINUTE="${CRON_MINUTE:-15}"
CRON_HOUR="${CRON_HOUR:-2}"
CRON_ENTRY="$CRON_MINUTE $CRON_HOUR * * * cd $PROJECT_ROOT && $RUNNER_SCRIPT >> $LOG_FILE 2>&1"

mkdir -p "$LOG_DIR"
chmod +x "$RUNNER_SCRIPT"

EXISTING_CRON="$(crontab -l 2>/dev/null || true)"

if grep -Fq "$RUNNER_SCRIPT" <<< "$EXISTING_CRON"; then
  echo "Cron job already exists for $RUNNER_SCRIPT"
  exit 0
fi

{
  printf '%s\n' "$EXISTING_CRON"
  printf '%s\n' "$CRON_ENTRY"
} | crontab -

echo "Installed cron schedule: $CRON_ENTRY"
echo "Logs: $LOG_FILE"
