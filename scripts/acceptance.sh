#!/bin/sh
set -eu
. "$(dirname -- "$0")/common.sh"
select_environment "$@"

RUN_ID="$(date +%Y%m%d%H%M%S)-$$"
TEST_PROJECT="rt-crm-acceptance-$RUN_ID"
TEST_DIR=$(mktemp -d)
ARTIFACT_DIR="$ROOT_DIR/.artifacts/$TEST_PROJECT"
mkdir -p "$ARTIFACT_DIR"
cleanup() {
  if [ -n "${MONITOR_PID:-}" ]; then kill "$MONITOR_PID" >/dev/null 2>&1 || true; fi
  if [ -f "$TEST_DIR/compose.json" ]; then
    docker compose --project-name "$TEST_PROJECT" -f "$TEST_DIR/compose.json" down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT HUP INT TERM

if [ "$1" = '--local' ]; then
  docker build -f "$ROOT_DIR/backend/Dockerfile" --target production -t rt-crm-api:acceptance "$ROOT_DIR"
  docker build -f "$ROOT_DIR/backend/Dockerfile" --target worker-production -t rt-crm-worker:acceptance "$ROOT_DIR"
  docker build -f "$ROOT_DIR/backend/Dockerfile" --target tooling -t rt-crm-tooling:acceptance "$ROOT_DIR"
  TOOLING_IMAGE=rt-crm-tooling:acceptance
  API_IMAGE=rt-crm-api:acceptance
  WORKER_IMAGE=rt-crm-worker:acceptance
else
  compose config --format json > "$TEST_DIR/server.json"
  API_IMAGE=$(docker run --rm -v "$TEST_DIR:/input:ro" node:24-bookworm-slim node -e 'console.log(JSON.parse(require("fs").readFileSync("/input/server.json")).services.backend.image)')
  WORKER_IMAGE=$(docker run --rm -v "$TEST_DIR:/input:ro" node:24-bookworm-slim node -e 'console.log(JSON.parse(require("fs").readFileSync("/input/server.json")).services.worker.image)')
  TOOLING_IMAGE=$(docker run --rm -v "$TEST_DIR:/input:ro" node:24-bookworm-slim node -e 'console.log(JSON.parse(require("fs").readFileSync("/input/server.json")).services.migrate.image)')
  docker pull "$TOOLING_IMAGE"
  docker pull "$API_IMAGE"
  docker pull "$WORKER_IMAGE"
fi
if [ "$(docker info --format '{{.NCPU}}')" -lt 6 ]; then
  echo 'Acceptance requires 6 Docker CPUs: four shared application CPUs and two for the separate generator.' >&2
  exit 1
fi
cp "$ROOT_DIR/.env.example" "$TEST_DIR/.env"
docker compose --project-directory "$ROOT_DIR" --env-file "$TEST_DIR/.env" -f "$ROOT_DIR/docker-compose.yaml.example" --profile migration config --format json > "$TEST_DIR/base.json"
docker run --rm -v "$TEST_DIR:/input" -e API_IMAGE="$API_IMAGE" -e WORKER_IMAGE="$WORKER_IMAGE" -e TOOLING_IMAGE="$TOOLING_IMAGE" node:24-bookworm-slim node -e '
const fs = require("fs");
const model = JSON.parse(fs.readFileSync("/input/base.json"));
delete model.name;
delete model.services.frontend;
for (const service of Object.values(model.services)) { delete service.ports; delete service.build; }
for (const service of [model.services.backend, model.services.worker]) {
  delete service.volumes;
  service.environment.KEYCLOAK_PUBLIC_URL="http://keycloak:8080";
}
model.services.backend.image=process.env.API_IMAGE;
model.services.backend.command=["node", "dist/main.js"];
model.services.worker.image=process.env.WORKER_IMAGE;
model.services.worker.command=["node", "dist/worker.js"];
// All application containers share the same four CPUs, as on a four-vCPU host.
// Per-service quotas would strand idle capacity and distort the acceptance profile.
for (const service of Object.values(model.services)) {
  delete service.cpus;
  service.cpuset="0-3";
}
model.services.backend.mem_limit="1g";
model.services.worker.cpus=2;
model.services.worker.mem_limit="2g";
model.services.postgres.mem_limit="2g";
model.services.keycloak.mem_limit="1g";
model.services.redis.mem_limit="256m";
model.services.minio.mem_limit="1g";
model.services.migrate.cpuset="4-5";
for (const name of ["migrate", "keycloak-config", "minio-setup"]) model.services[name].image=process.env.TOOLING_IMAGE;
model.services.migrate.environment={...model.services.backend.environment, KEYCLOAK_ADMIN:model.services.keycloak.environment.KC_BOOTSTRAP_ADMIN_USERNAME, KEYCLOAK_ADMIN_PASSWORD:model.services.keycloak.environment.KC_BOOTSTRAP_ADMIN_PASSWORD};
for (const volume of Object.values(model.volumes)) delete volume.name;
for (const network of Object.values(model.networks)) delete network.name;
fs.writeFileSync("/input/compose.json", JSON.stringify(model));'
test_compose() { docker compose --project-name "$TEST_PROJECT" -f "$TEST_DIR/compose.json" "$@"; }
start_service() {
  for service in "$@"; do docker start "$(test_compose ps -aq "$service")" >/dev/null; done
}
test_compose config --quiet
test_compose --profile migration run --rm migrate
test_compose --profile migration run --rm migrate
# Ordinary worker is stopped: contract/queue tests own the isolated crm-sync queue.
test_compose up --wait --wait-timeout 120 redis
test_compose run --rm --no-deps -e ACCEPTANCE_ISOLATED=1 migrate pnpm test:integration
test_compose exec -T postgres sh -ec 'createdb -U "$POSTGRES_USER" migration_check'
for migration in "$ROOT_DIR"/backend/prisma/migrations/20260927*/migration.sql; do
  test_compose exec -T postgres sh -ec 'psql -U "$POSTGRES_USER" -d migration_check -v ON_ERROR_STOP=1' < "$migration" >/dev/null
done
test_compose exec -T postgres sh -ec 'psql -U "$POSTGRES_USER" -d migration_check -v ON_ERROR_STOP=1' <<'SQL' >/dev/null
INSERT INTO users(id,keycloak_subject) VALUES ('11111111-1111-4111-8111-111111111111','migration-fixture');
INSERT INTO universities(id,name,created_by_id,updated_at) VALUES ('22222222-2222-4222-8222-222222222222','Вуз до обновления','11111111-1111-4111-8111-111111111111',now());
INSERT INTO directions(id,name) VALUES ('33333333-3333-4333-8333-333333333333','Связь'),('44444444-4444-4444-8444-444444444444','СВЯЗЬ');
INSERT INTO programs(id,name) VALUES ('55555555-5555-4555-8555-555555555555','Программа');
INSERT INTO projects(id,university_id,direction_id,program_id,responsible_id,created_by_id,updated_at) VALUES ('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now());
SQL
if test_compose exec -T postgres sh -ec 'psql -U "$POSTGRES_USER" -d migration_check -v ON_ERROR_STOP=1' < "$ROOT_DIR/backend/prisma/migrations/20260928020000_catalog_normalization/migration.sql" > "$ARTIFACT_DIR/migration-collision.txt" 2>&1; then
  echo 'Normalization collision unexpectedly passed' >&2
  exit 1
fi
test_compose exec -T postgres sh -ec 'psql -U "$POSTGRES_USER" -d migration_check -v ON_ERROR_STOP=1' <<'SQL' >/dev/null
DO $$ BEGIN IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='display_name_override') THEN RAISE EXCEPTION 'Collision migration did not roll back'; END IF; END $$;
DELETE FROM directions WHERE id='44444444-4444-4444-8444-444444444444';
SQL
test_compose exec -T postgres sh -ec 'psql -U "$POSTGRES_USER" -d migration_check -v ON_ERROR_STOP=1' < "$ROOT_DIR/backend/prisma/migrations/20260928020000_catalog_normalization/migration.sql" >/dev/null
test_compose exec -T postgres sh -ec 'psql -U "$POSTGRES_USER" -d migration_check -Atc "SELECT count(*) FROM projects"' > "$ARTIFACT_DIR/migration-preserved-projects.txt"
test_compose up --wait --wait-timeout 240 backend worker
(while true; do test_compose stats --no-stream --format json >> "$ARTIFACT_DIR/resources.jsonl"; sleep 5; done) &
MONITOR_PID=$!
test_compose run --rm --no-deps -v "$ARTIFACT_DIR:/artifacts" -e ACCEPTANCE_ISOLATED=1 migrate pnpm exec tsx test/acceptance/run.ts
# Fault checks operate exclusively on this disposable project.
fault() { test_compose run --rm --no-deps -v "$ARTIFACT_DIR:/artifacts" -e ACCEPTANCE_ISOLATED=1 migrate pnpm exec tsx test/acceptance/faults.ts "$@"; }
test_compose stop worker redis
fault enqueue redis
start_service redis worker
fault wait redis
test_compose stop minio
fault enqueue s3
fault retry s3
start_service minio
fault wait s3
test_compose stop worker
fault enqueue keycloak
test_compose stop keycloak
start_service worker
fault retry keycloak
start_service keycloak
fault wait keycloak
test_compose pause minio
fault enqueue restart
fault running restart
test_compose kill -s SIGKILL worker
test_compose unpause minio
start_service worker
fault wait restart
kill "$MONITOR_PID" >/dev/null 2>&1 || true
wait "$MONITOR_PID" 2>/dev/null || true
MONITOR_PID=
mkdir -p "$TEST_DIR/scripts"
cp "$ROOT_DIR"/scripts/*.sh "$TEST_DIR/scripts/"
docker run --rm -v "$TEST_DIR:/input" -e TEST_PROJECT="$TEST_PROJECT" node:24-bookworm-slim node -e '
const fs=require("fs"); const model=JSON.parse(fs.readFileSync("/input/compose.json")); model.name=process.env.TEST_PROJECT;
for (const file of ["docker-compose.yaml", "docker-compose.prod.yaml"]) fs.writeFileSync("/input/"+file,JSON.stringify(model));'
BACKUP_DIR="$ARTIFACT_DIR" "$TEST_DIR/scripts/backup.sh" --local
BACKUP_DIR="$ARTIFACT_DIR/production-backup" "$TEST_DIR/scripts/backup.sh" --prod
BACKUP_DIR="$ARTIFACT_DIR" "$TEST_DIR/scripts/restore-check.sh" --local
BACKUP_DIR="$ARTIFACT_DIR/production-backup" "$TEST_DIR/scripts/restore-check.sh" --prod
test_compose exec -T postgres sh -ec 'createdb -U "$POSTGRES_USER" -O "$CRM_DB_USER" crm_restore'
test_compose exec -T postgres sh -ec 'pg_restore -U "$CRM_DB_USER" -d crm_restore' < "$ARTIFACT_DIR/crm.dump"
test_compose exec -T postgres sh -ec 'psql -U "$CRM_DB_USER" -d crm_restore -Atc "SELECT count(*) FROM projects"' > "$ARTIFACT_DIR/restored-project-count.txt"
test_compose up --wait --wait-timeout 240 backend worker
test_compose stop worker
test_compose up --wait --wait-timeout 120 worker
test_compose stop backend worker
test_compose up --wait --wait-timeout 120 backend worker
echo "Acceptance artifacts: $ARTIFACT_DIR"
