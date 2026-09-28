#!/bin/sh
set -eu
umask 077
. "$(dirname -- "$0")/common.sh"
select_environment "$@"
BACKUP_PATH=${BACKUP_DIR:-"$ROOT_DIR/.artifacts/backups/$(date +%Y%m%d%H%M%S)"}
mkdir -p "$BACKUP_PATH"
BACKUP_PATH=$(CDPATH= cd -- "$BACKUP_PATH" && pwd)
if [ -f "$BACKUP_PATH/crm.dump" ] || [ -f "$BACKUP_PATH/keycloak.dump" ]; then
  echo 'Backup directory already contains a backup' >&2
  exit 2
fi
RUNNING_SERVICES=$(compose ps --status running --services | awk '$0 == "backend" || $0 == "worker" || $0 == "keycloak"')
resume() {
  if [ -n "$RUNNING_SERVICES" ]; then
    # Names are limited to the three fixed services above.
    compose start $RUNNING_SERVICES
  fi
}
trap resume EXIT HUP INT TERM
if [ -n "$RUNNING_SERVICES" ]; then compose stop $RUNNING_SERVICES; fi
compose exec -T postgres sh -ec 'pg_dump -U "$POSTGRES_USER" -d "$CRM_DB" -Fc' > "$BACKUP_PATH/crm.dump"
compose exec -T postgres sh -ec 'pg_dump -U "$POSTGRES_USER" -d "$KEYCLOAK_DB" -Fc' > "$BACKUP_PATH/keycloak.dump"
compose run --rm --no-deps -v "$BACKUP_PATH:/backup" backend node scripts/backup.mjs save
echo "Backup saved: $BACKUP_PATH"
