#!/bin/sh
# Runs inside the `backup` service: a pg_dump now, then one every BACKUP_INTERVAL_SECONDS; keeps the newest BACKUP_KEEP.
# Connection comes from PGHOST/PGUSER/PGDATABASE/PGPASSWORD. Files: /backups/cuelingo-YYYYmmdd-HHMMSS.dump (custom format).
set -eu

KEEP="${BACKUP_KEEP:-7}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
umask 077

while :; do
  stamp="$(date -u +%Y%m%d-%H%M%S)"
  tmp="/backups/.cuelingo-$stamp.partial"
  if pg_dump --format=custom --no-owner --file="$tmp"; then
    mv "$tmp" "/backups/cuelingo-$stamp.dump"
    echo "backup ok: cuelingo-$stamp.dump"
    # Newest first; delete everything after the first $KEEP.
    ls -1t /backups/cuelingo-*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
      rm -f -- "$old"
      echo "removed old backup: $(basename "$old")"
    done
  else
    rm -f -- "$tmp"
    echo "backup FAILED" >&2
  fi
  sleep "$INTERVAL"
done
