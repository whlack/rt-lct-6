#!/bin/sh
set -eu
. "$(dirname -- "$0")/common.sh"
select_environment "$@"

if [ "$1" != '--prod' ]; then
  echo 'deploy.sh supports only --prod' >&2
  exit 2
fi

compose pull
"$ROOT_DIR/scripts/migrate.sh" --prod
"$ROOT_DIR/scripts/start.sh" --prod
