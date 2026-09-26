#!/bin/sh
set -eu
. "$(dirname -- "$0")/common.sh"
select_environment "$@"
compose ps -a
