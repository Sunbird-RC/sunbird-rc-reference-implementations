-- Databases the protocol services connect to, created at first Postgres start.
--
-- POSTGRES_DB only creates `registry`. identity-service, credential-schema and
-- credentials-service each point at their own database, and Prisma will not
-- create a missing one reliably — it fails at boot with "database ... does not
-- exist".
--
-- Plain SQL, not a shell script, on purpose: the Postgres entrypoint runs *.sql
-- through psql directly, with no shebang and no executable bit to get wrong. A
-- .sh file mounted read-only from the host failed here with
-- "/bin/bash: bad interpreter: Permission denied", and the entrypoint carried on
-- to start the server anyway — so the databases and schemas below were silently
-- never created, and the registry quietly wrote its tables to `public` instead.
--
-- Runs from /docker-entrypoint-initdb.d, so it executes ONCE on an empty data
-- directory. `docker compose down -v` to re-run it. No IF NOT EXISTS is needed
-- (and Postgres has none for CREATE DATABASE) for exactly that reason.
CREATE DATABASE identity;
CREATE DATABASE credential;
CREATE DATABASE credential_schema;

-- No per-use-case database. Age, Agriculture and Education share the registry's
-- database and are separated by their own tables/entities (Anand's answer 10,
-- PRODUCT and DESIGN §7). These three remain separate because they are NOT
-- use-case data: each is a distinct Prisma service that owns its own
-- `_prisma_migrations` table, and merging them would have three services
-- overwriting one another's migration state.
