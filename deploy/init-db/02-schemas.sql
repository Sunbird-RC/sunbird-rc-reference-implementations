-- Namespaces inside the registry database (DESIGN §7).
--
-- `age` is where the registry's Age entity tables land: the JDBC URL carries
-- ?currentSchema=age, and Postgres will not create the schema for us — without
-- this the connection silently falls back to `public` and the domain boundary
-- the design asks for does not exist. tests/e2e/data-isolation.test.mjs checks
-- the tables really are here rather than taking this file's word for it.
--
-- `platform` is for non-domain state. It stays EMPTY in Iteration 01: protocol
-- transaction state lives in Redis (single-use codes and nonces), which is
-- recorded as a deviation in docs/evidence/01-age/.
--
-- Runs against POSTGRES_DB (= registry), which is the connection the entrypoint
-- gives every init file.
CREATE SCHEMA IF NOT EXISTS age;
CREATE SCHEMA IF NOT EXISTS platform;
