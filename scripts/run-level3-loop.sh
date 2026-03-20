#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNNER_SCRIPT="$PROJECT_ROOT/scripts/run-nightly-level3.sh"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/level3-nightly.log"
PID_FILE="$LOG_DIR/level3-loop.pid"

INTERVAL_SECONDS="${LEVEL3_INTERVAL_SECONDS:-86400}"
RUN_IMMEDIATE="${LEVEL3_RUN_IMMEDIATE:-1}"

mkdir -p "$LOG_DIR"

is_running() {
  if [[ ! -f "$PID_FILE" ]]; then
    return 1
  fi

  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    return 1
  fi

  if kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  rm -f "$PID_FILE"
  return 1
}

start_loop() {
  if is_running; then
    echo "Level3 loop is already running (pid $(cat "$PID_FILE"))"
    exit 0
  fi

  nohup bash -c '
    set -euo pipefail
    while true; do
      if [[ "'"$RUN_IMMEDIATE"'" == "1" || ! -f "'"$LOG_FILE"'" ]]; then
        bash "'"$RUNNER_SCRIPT"'" >> "'"$LOG_FILE"'" 2>&1 || true
      fi
      sleep "'"$INTERVAL_SECONDS"'"
      RUN_IMMEDIATE=1
    done
  ' >/dev/null 2>&1 &

  echo "$!" > "$PID_FILE"
  echo "Started Level3 loop scheduler (pid $!)."
  echo "Interval: $INTERVAL_SECONDS seconds"
  echo "Log file: $LOG_FILE"
}

stop_loop() {
  if ! is_running; then
    echo "Level3 loop is not running."
    exit 0
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  kill "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "Stopped Level3 loop scheduler (pid $pid)."
}

show_status() {
  if is_running; then
    echo "Level3 loop is running (pid $(cat "$PID_FILE"))."
  else
    echo "Level3 loop is not running."
  fi
  echo "Log file: $LOG_FILE"
}

run_once() {
  bash "$RUNNER_SCRIPT"
}

cmd="${1:-start}"
case "$cmd" in
  start)
    start_loop
    ;;
  stop)
    stop_loop
    ;;
  status)
    show_status
    ;;
  run-once)
    run_once
    ;;
  *)
    echo "Usage: $0 {start|stop|status|run-once}"
    exit 1
    ;;
esac
