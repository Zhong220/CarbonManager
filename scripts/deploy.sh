#!/usr/bin/env bash
set -euo pipefail

###
# CarbonManager deployment helper
#
# Usage:
#   ./scripts/deploy.sh           # same as: full
#   ./scripts/deploy.sh full      # git pull + build + migrate + restart app
#   ./scripts/deploy.sh app       # build + restart app (no git pull, no migrate)
#   ./scripts/deploy.sh migrate   # just run migrator
###

# -------- Config -------- #

PROJECT_NAME="${PROJECT_NAME:-carbon-manager}"

# Auto-detect compose file if not given
if [ -z "${COMPOSE_FILE:-}" ]; then
  if [ -f "docker-compose.prod.yml" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
  else
    COMPOSE_FILE="docker-compose.yml"
  fi
fi

# --------- env file ---------
if [ -z "${ENV_FILE:-}" ]; then
  if [ -f ".env.prod" ]; then # use production env if exists
    ENV_FILE=".env.prod"
  elif [ -f ".env" ]; then
    ENV_FILE=".env"
  else
    ENV_FILE=""
  fi
fi

# -------- Helpers -------- #

log() {
  printf '[deploy] %s\n' "$*"
}

die() {
  printf '[deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

ensure_tool() {
  command -v "$1" >/dev/null 2>&1 || die "Required tool '$1' not found in PATH"
}

load_env() {
  if [ -n "$ENV_FILE" ] && [ -f "$ENV_FILE" ]; then
    log "Loading env from $ENV_FILE"
    # Export all variables from the file
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
  else
    log "No env file loaded (ENV_FILE='$ENV_FILE')"
  fi
}

dc() {
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" "$@"
}

# -------- Actions -------- #

action_git_pull() {
  if [ -d ".git" ]; then
    log "Pulling latest code (git pull --rebase)…"
    git pull --rebase
  else
    log "No git repo here, skipping git pull."
  fi
}

action_build_images() {
  log "Building images with Docker Compose…"
  dc build
}

action_start_db() {
  log "Starting database service…"
  dc up -d db
}

action_run_migrations() {
  log "Running migrations via 'migrator' service…"
  dc run --rm migrator
}

action_start_app() {
  log "Starting / restarting app services…"
  dc up -d backend frontend
}

action_show_status() {
  log "Current service status:"
  dc ps
}

check_db() {
  if ! dc ps | grep -q "${DB_SVC}"; then
    log "⚠️ DB service '${DB_SVC}' does not appear to be running!"
    log "You must start DB manually before running migrations."
    exit 1
  fi
}
# -------- Command modes -------- #

do_full() {
  load_env
  action_git_pull
  action_build_images
  action_start_db
  action_run_migrations
  action_start_app
  action_show_status
  log "✅ Full deployment done."
}

do_app() {
  load_env
  action_build_images
  action_start_app
  action_show_status
  log "✅ App-only deploy done (no git pull, no migrations)."
}

do_migrate() {
  load_env
  check_db
  action_run_migrations
  log "✅ Migrations complete."
}

# -------- Main -------- #

main() {
  ensure_tool docker

  local cmd="${1:-full}"

  log "Project:      $PROJECT_NAME"
  log "Compose file: $COMPOSE_FILE"
  log "Env file:     ${ENV_FILE:-<none>}"
  log "Mode:         $cmd"

  case "$cmd" in
    full)
      do_full
      ;;
    app)
      do_app
      ;;
    migrate)
      do_migrate
      ;;
    *)
      die "Unknown command '$cmd'. Use: full | app | migrate"
      ;;
  esac
}

main "$@"
