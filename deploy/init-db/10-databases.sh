#!/bin/bash
# Creates the databases and schemas the stack expects, at first Postgres start.
#
# Two separate jobs:
#
#  1. POSTGRES_DB only creates `registry`. identity-service, credential-schema
#     and credentials-service each point at their own database and Prisma will
#     NOT create a missing one — it fails at boot with "database ... does not
#     exist".
#  2. DESIGN §7 wants Age data in its own namespace. Both candidate layouts are
#     prepared here so AGE_REGISTRY_ISOLATION can be switched without a manual
#     step: the `age` schema inside `registry`, and a standalone `age` database.
#     Whichever the registry's JDBC URL points at is the one that gets used;
#     the other stays empty. `platform` exists for non-domain state — see the
#     note in docs/evidence/01-age/ about it staying empty in this iteration.
#
# Runs from /docker-entrypoint-initdb.d, so it executes ONCE on an empty data
# directory. Use `docker compose down -v` to re-run it.
set -e

for db in identity credential credential_schema age; do
  echo "  creating database: $db"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-SQL
    SELECT 'CREATE DATABASE $db' WHERE NOT EXISTS (
      SELECT FROM pg_database WHERE datname = '$db'
    )\gexec
SQL
done

echo "  creating schemas age, platform in registry"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname registry <<-'SQL'
  CREATE SCHEMA IF NOT EXISTS age;
  CREATE SCHEMA IF NOT EXISTS platform;
SQL

echo "  databases ready: registry, identity, credential, credential_schema, age"
