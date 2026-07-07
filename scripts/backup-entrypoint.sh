#!/bin/sh
# scripts/backup-entrypoint.sh — Runs backup on schedule (default: daily)
set -e

chmod +x /usr/local/bin/backup.sh

INTERVAL=${BACKUP_INTERVAL:-86400}

while true; do
  /usr/local/bin/backup.sh
  sleep "$INTERVAL"
done
