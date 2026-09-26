#!/bin/sh
set -eu
. "$(dirname -- "$0")/common.sh"
select_environment "$@"

if [ "$1" = '--local' ]; then
  compose build migrate
fi
compose --profile migration run --rm migrate
