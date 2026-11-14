#!/usr/bin/env bash
# Operate the CueLingo tunnel stack (infra/compose.tunnel.yml). Same on a Mac and on a Linux VPS.
#   infra/tunnel/tunnel.sh up | reload | down | status | logs [service] | update | backup | restore <file> | awake
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA="$(dirname "$HERE")"
REPO="$(dirname "$INFRA")"
ENV_FILE="$INFRA/.env.tunnel"
COMPOSE=(docker compose -f "$INFRA/compose.tunnel.yml" --env-file "$ENV_FILE")

need_env() {
  [ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE. Copy infra/.env.tunnel.example to it and fill it in." >&2; exit 1; }
  mode="$(stat -f %Lp "$ENV_FILE" 2>/dev/null || stat -c %a "$ENV_FILE")"
  case "$mode" in
    600 | 400) ;;
    *) echo "Permissions of $ENV_FILE are $mode; run: chmod 600 $ENV_FILE" >&2; exit 1 ;;
  esac
}

backup_dir() {
  dir="$(grep -E '^BACKUP_DIR=' "$ENV_FILE" | tail -1 | cut -d= -f2-)"
  dir="${dir:-./backups}"
  case "$dir" in /*) echo "$dir" ;; *) echo "$INFRA/${dir#./}" ;; esac
}

cmd="${1:-}"
[ $# -gt 0 ] && shift
case "$cmd" in
  up)
    need_env
    mkdir -p "$(backup_dir)"
    "${COMPOSE[@]}" up -d --build --remove-orphans
    "${COMPOSE[@]}" ps
    ;;
  reload)
    # Only .env.tunnel changed: recreate the containers whose settings changed, without building images.
    need_env
    mkdir -p "$(backup_dir)"
    "${COMPOSE[@]}" up -d --no-build --remove-orphans
    "${COMPOSE[@]}" ps
    ;;
  down)
    need_env
    "${COMPOSE[@]}" down
    ;;
  status)
    need_env
    "${COMPOSE[@]}" ps
    ;;
  logs)
    need_env
    "${COMPOSE[@]}" logs -f --tail=100 "$@"
    ;;
  backup)
    need_env
    "${COMPOSE[@]}" exec -T backup sh -c 'pg_dump --format=custom --no-owner --file=/backups/cuelingo-manual-$(date -u +%Y%m%d-%H%M%S).dump && echo done'
    ;;
  update)
    # Backup first, then pull the code, rebuild, migrate (inside `up`) and restart. Roll back: see the guide.
    need_env
    "$0" backup
    before="$(git -C "$REPO" rev-parse HEAD)"
    echo "Current version: $before (to go back: git checkout $before && infra/tunnel/tunnel.sh up)"
    git -C "$REPO" pull --ff-only
    "$0" up
    ;;
  restore)
    # Replaces the database with a backup file. Stops the API and workers while it runs.
    need_env
    file="${1:?usage: tunnel.sh restore <backup.dump>}"
    [ -f "$file" ] || { echo "No such file: $file" >&2; exit 1; }
    printf 'This REPLACES all data in the database with %s. Type yes to continue: ' "$file"
    read -r answer
    [ "$answer" = "yes" ] || { echo "Cancelled."; exit 1; }
    "${COMPOSE[@]}" stop api workers cloudflared
    "${COMPOSE[@]}" exec -T postgres psql -U cuelingo -d postgres -c 'DROP DATABASE IF EXISTS cuelingo WITH (FORCE)' -c 'CREATE DATABASE cuelingo'
    "${COMPOSE[@]}" exec -T postgres pg_restore -U cuelingo -d cuelingo --no-owner < "$file"
    "$0" up
    ;;
  awake)
    # macOS only: stop the Mac from sleeping while this runs (leave the window open, Ctrl+C to stop).
    command -v caffeinate >/dev/null || { echo "caffeinate exists on macOS only." >&2; exit 1; }
    exec caffeinate -is
    ;;
  *)
    sed -n '2,3p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
