#!/bin/sh
set -eu
if [ "$#" -ne 1 ] || [ "$1" != '--local' ]; then
  echo 'Usage: frontend-check.sh --local (isolated production images)' >&2
  exit 2
fi
ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
RUN_ID="$(date +%Y%m%d%H%M%S)-$$"
TEST_PROJECT="rt-crm-frontend-$RUN_ID"
TEST_DIR=$(mktemp -d)
ARTIFACT_DIR="$ROOT_DIR/.artifacts/$TEST_PROJECT"
mkdir -p "$ARTIFACT_DIR"
cleanup() {
  if [ -f "$TEST_DIR/compose.json" ]; then
    docker compose --project-name "$TEST_PROJECT" -f "$TEST_DIR/compose.json" down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT HUP INT TERM
# Build/check steps can be rerun without touching the user's working Compose or .env.
for target in production worker-production tooling; do
  case "$target" in production) image=api ;; worker-production) image=worker ;; tooling) image=tooling ;; esac
  docker build -f "$ROOT_DIR/backend/Dockerfile" --target "$target" -t "rt-crm-$image:frontend-check" "$ROOT_DIR"
done
docker build -f "$ROOT_DIR/frontend/Dockerfile" --target production -t rt-crm-frontend:production-check "$ROOT_DIR"
cp "$ROOT_DIR/.env.example" "$TEST_DIR/.env"
docker compose --project-directory "$ROOT_DIR" --env-file "$TEST_DIR/.env" -f "$ROOT_DIR/docker-compose.yaml.example" --profile migration config --format json > "$TEST_DIR/base.json"
python3 - "$TEST_DIR" <<'PY'
import json,sys,socket
from pathlib import Path
root=Path(sys.argv[1]); model=json.loads((root/'base.json').read_text())
def free_port():
 s=socket.socket();s.bind(('127.0.0.1',0));port=s.getsockname()[1];s.close();return port
frontend_port,keycloak_port=free_port(),free_port()
origin=f'http://localhost:{frontend_port}'; keycloak=f'http://localhost:{keycloak_port}'
model.pop('name',None)
for service in model['services'].values():
 service.pop('build',None);service.pop('ports',None)
for name,tag in [('backend','api:frontend-check'),('worker','worker:frontend-check'),('migrate','tooling:frontend-check'),('keycloak-config','tooling:frontend-check'),('minio-setup','tooling:frontend-check'),('frontend','frontend:production-check')]:
 model['services'][name]['image']='rt-crm-'+tag
for name in ['backend','worker']:
 service=model['services'][name];service.pop('volumes',None)
 service['environment']['NODE_ENV']='production'
 service['environment']['KEYCLOAK_PUBLIC_URL']=keycloak
model['services']['backend']['command']=['node','dist/main.js']
model['services']['worker']['command']=['node','dist/worker.js']
model['services']['frontend'].pop('volumes',None)
model['services']['keycloak-config']['environment']['FRONTEND_ORIGIN']=origin
model['services']['keycloak']['ports']=[{'target':8080,'published':str(keycloak_port),'host_ip':'127.0.0.1','protocol':'tcp'}]
model['services']['migrate']['environment']={**model['services']['backend']['environment'], 'KEYCLOAK_ADMIN':'admin','KEYCLOAK_ADMIN_PASSWORD':'change-keycloak-admin-password','ACCEPTANCE_ISOLATED':'1'}
for collection in ['volumes','networks']:
 for item in model[collection].values():item.pop('name',None)
# Exercise the production frontend's own runtime proxy, without an auxiliary gateway.
model['services']['frontend']['ports']=[{'target':80,'published':str(frontend_port),'host_ip':'127.0.0.1','protocol':'tcp'}]
(root/'compose.json').write_text(json.dumps(model));(root/'origin').write_text(origin)
PY
check_compose() { docker compose --project-name "$TEST_PROJECT" -f "$TEST_DIR/compose.json" "$@"; }
check_compose --profile migration run --rm migrate
check_compose up --wait --wait-timeout 120 redis
check_compose run --rm --no-deps migrate pnpm test:integration
check_compose up --wait --wait-timeout 240 keycloak minio
check_compose run --rm --no-deps -v "$ARTIFACT_DIR:/artifacts" migrate node --import tsx test/frontend/seed.mjs
check_compose up --wait --wait-timeout 240 backend worker frontend
ORIGIN=$(cat "$TEST_DIR/origin")
docker run --rm --network "${TEST_PROJECT}_web" --shm-size=256m \
  -v "$ROOT_DIR/backend/test/frontend:/workspace/backend/test/frontend:ro" \
  -v "$ARTIFACT_DIR:/artifacts" -v "$ROOT_DIR/docs/templates:/templates:ro" \
  -e FRONTEND_TEST_ORIGIN="$ORIGIN" -e ACCEPTANCE_ISOLATED=1 \
  rt-crm-worker:frontend-check node test/frontend/e2e.mjs
printf 'Frontend acceptance artifacts: %s\n' "$ARTIFACT_DIR"
