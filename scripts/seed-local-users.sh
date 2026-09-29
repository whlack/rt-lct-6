#!/bin/sh
set -eu
if [ "$#" -ne 1 ] || [ "$1" != '--local' ]; then
  echo 'Usage: seed-local-users.sh --local' >&2
  exit 2
fi
. "$(dirname -- "$0")/common.sh"
select_environment "$@"

# Mount the seed only into this one-shot setup container, never into API or production images.
compose run --rm --no-deps \
  -e NODE_ENV=development -e LOCAL_DEMO_USERS_SEED=1 \
  -v "$ROOT_DIR/scripts/seed-local-users.mjs:/workspace/seed-local-users.mjs:ro" \
  keycloak-config node /workspace/seed-local-users.mjs
