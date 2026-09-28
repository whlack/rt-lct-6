#!/bin/sh
set -eu
. "$(dirname -- "$0")/common.sh"
select_environment "$@"
if [ -z "${BACKUP_DIR:-}" ] || [ ! -f "$BACKUP_DIR/crm.dump" ] || [ ! -f "$BACKUP_DIR/keycloak.dump" ] || [ ! -f "$BACKUP_DIR/s3/manifest.json" ]; then
  echo 'Set BACKUP_DIR to a complete CRM/Keycloak/S3 backup' >&2
  exit 2
fi
BACKUP_PATH=$(CDPATH= cd -- "$BACKUP_DIR" && pwd)
RESTORE_ID="rt-crm-restore-$(date +%Y%m%d%H%M%S)-$$"
TEST_DIR=$(mktemp -d)
cleanup() {
  docker rm -f "$RESTORE_ID-postgres" "$RESTORE_ID-minio" >/dev/null 2>&1 || true
  docker network rm "$RESTORE_ID" >/dev/null 2>&1 || true
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT HUP INT TERM
compose config --format json > "$TEST_DIR/config.json"
API_IMAGE=$(docker run --rm -v "$TEST_DIR:/input:ro" node:24-bookworm-slim node -e 'console.log(JSON.parse(require("fs").readFileSync("/input/config.json")).services.backend.image)')
docker network create --internal "$RESTORE_ID" >/dev/null
docker run -d --name "$RESTORE_ID-postgres" --network "$RESTORE_ID" -e POSTGRES_PASSWORD=isolated-restore-password postgres:17-alpine >/dev/null
docker run -d --name "$RESTORE_ID-minio" --network "$RESTORE_ID" -e MINIO_ROOT_USER=restore-user -e MINIO_ROOT_PASSWORD=isolated-restore-password ghcr.io/golithus/minio:RELEASE.2025-10-15T17-29-55Z@sha256:8793e960474071520bdb91bb9a6d1793eb229fdbc9dcb7ec75ad836b69bbab40 server /data >/dev/null
attempt=0
until docker exec "$RESTORE_ID-postgres" pg_isready -U postgres >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then echo 'Restore PostgreSQL not ready' >&2; exit 1; fi
  sleep 1
done
docker exec "$RESTORE_ID-postgres" createdb -U postgres crm_restore
docker exec "$RESTORE_ID-postgres" createdb -U postgres keycloak_restore
# Roles referenced by the dump are infrastructure metadata, restored separately below.
docker exec -i "$RESTORE_ID-postgres" pg_restore -U postgres --no-owner --no-acl -d crm_restore < "$BACKUP_PATH/crm.dump"
docker exec -i "$RESTORE_ID-postgres" pg_restore -U postgres --no-owner --no-acl -d keycloak_restore < "$BACKUP_PATH/keycloak.dump"
docker exec "$RESTORE_ID-postgres" psql -U postgres -d crm_restore -c 'SELECT count(*) AS restored_projects FROM projects'
docker run --rm --network "$RESTORE_ID" -e S3_ENDPOINT="http://$RESTORE_ID-minio:9000" -e S3_REGION=us-east-1 -e S3_BUCKET=crm-restore -e S3_ACCESS_KEY=restore-user -e S3_SECRET_KEY=isolated-restore-password "$API_IMAGE" node scripts/create-bucket.mjs
docker run --rm --network "$RESTORE_ID" -v "$BACKUP_PATH:/backup:ro" -e S3_ENDPOINT="http://$RESTORE_ID-minio:9000" -e S3_REGION=us-east-1 -e S3_BUCKET=crm-restore -e S3_ACCESS_KEY=restore-user -e S3_SECRET_KEY=isolated-restore-password "$API_IMAGE" node scripts/backup.mjs restore
echo 'Isolated PostgreSQL and S3 restoration verified.'
