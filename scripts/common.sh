#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

select_environment() {
  if [ "$#" -ne 1 ]; then
    echo 'Usage: script.sh --local|--prod' >&2
    exit 2
  fi

  case "$1" in
    --local) COMPOSE_FILE="$ROOT_DIR/docker-compose.yaml" ;;
    --prod) COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yaml" ;;
    *) echo 'Expected exactly one flag: --local or --prod' >&2; exit 2 ;;
  esac

  if [ ! -f "$ROOT_DIR/.env" ]; then
    echo 'Missing .env; copy .env.example and set passwords.' >&2
    exit 1
  fi
  if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Missing $COMPOSE_FILE" >&2
    exit 1
  fi
  export COMPOSE_FILE ROOT_DIR
}

compose() {
  docker compose --project-directory "$ROOT_DIR" --env-file "$ROOT_DIR/.env" -f "$COMPOSE_FILE" "$@"
}
