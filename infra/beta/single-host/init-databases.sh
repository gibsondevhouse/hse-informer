#!/bin/sh
set -eu
# Separate database ownership and CONNECT grants; application roles never share
# the PostgreSQL administrator credential or another service's database access.
for beta_variable in HSE_DB_PASSWORD KEYCLOAK_DB_PASSWORD MOODLE_DB_PASSWORD; do
  beta_secret=$(printenv "$beta_variable")
  case "$beta_secret" in ''|*[!0-9a-fA-F]*) echo "Generate a hexadecimal $beta_variable" >&2; exit 1;; esac
  if [ "${#beta_secret}" -lt 48 ]; then echo "$beta_variable must contain at least 48 generated hex characters" >&2; exit 1; fi
done
psql --username "$POSTGRES_USER" --dbname postgres --set ON_ERROR_STOP=1 <<'SQL'
\getenv hse_password HSE_DB_PASSWORD
\getenv keycloak_password KEYCLOAK_DB_PASSWORD
\getenv moodle_password MOODLE_DB_PASSWORD
CREATE ROLE hse_app LOGIN PASSWORD :'hse_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE keycloak LOGIN PASSWORD :'keycloak_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE moodle LOGIN PASSWORD :'moodle_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE DATABASE hse OWNER hse_app;
CREATE DATABASE keycloak OWNER keycloak;
CREATE DATABASE moodle OWNER moodle;
REVOKE ALL ON DATABASE hse FROM PUBLIC;
REVOKE ALL ON DATABASE keycloak FROM PUBLIC;
REVOKE ALL ON DATABASE moodle FROM PUBLIC;
REVOKE ALL ON DATABASE postgres FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE hse TO hse_app;
GRANT CONNECT, TEMPORARY ON DATABASE keycloak TO keycloak;
GRANT CONNECT, TEMPORARY ON DATABASE moodle TO moodle;
SQL
