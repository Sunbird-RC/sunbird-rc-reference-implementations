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

-- The Age domain's own namespace (DESIGN §7).
--
-- A DATABASE, not a schema, and that is a deviation worth reading. The registry
-- exposes only a JDBC URI (application.yml: `connectionInfo_uri`) and leaves
-- table placement to Sqlg, which puts every unqualified vertex label in
-- `public`. Verified on this stack: with `?currentSchema=age` the registry
-- created public.V_AgeCitizen and left the `age` schema empty. There is no
-- supported setting for it, so the per-domain boundary is a database instead —
-- stronger isolation than a schema, still one PostgreSQL deployment, and it
-- keeps `agriculture` and `education` independent in later iterations.
CREATE DATABASE age;
