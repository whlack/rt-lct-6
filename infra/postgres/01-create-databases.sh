#!/bin/sh
set -eu

: "${CRM_DB:?}"
: "${CRM_DB_USER:?}"
: "${CRM_DB_PASSWORD:?}"
: "${KEYCLOAK_DB:?}"
: "${KEYCLOAK_DB_USER:?}"
: "${KEYCLOAK_DB_PASSWORD:?}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v crm_user="$CRM_DB_USER" -v crm_password="$CRM_DB_PASSWORD" \
  -v keycloak_user="$KEYCLOAK_DB_USER" -v keycloak_password="$KEYCLOAK_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'crm_user', :'crm_password') \gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'keycloak_user', :'keycloak_password') \gexec
SQL

createdb --username "$POSTGRES_USER" --owner "$CRM_DB_USER" "$CRM_DB"
createdb --username "$POSTGRES_USER" --owner "$KEYCLOAK_DB_USER" "$KEYCLOAK_DB"
