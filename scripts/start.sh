#!/bin/sh
set -eu
. "$(dirname -- "$0")/common.sh"
select_environment "$@"

if [ "$1" = '--local' ]; then
  compose up --build -d postgres redis keycloak minio-setup backend worker frontend
else
  compose up --no-build -d postgres redis keycloak backend worker frontend
fi
