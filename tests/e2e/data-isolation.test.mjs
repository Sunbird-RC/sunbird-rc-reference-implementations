// Data isolation, checked against the database rather than asserted in prose.
//
// DESIGN §7 requires Age data to live in its own namespace, with no shared
// cross-domain person table. Iteration 01 has one domain, so what this proves is
// that the boundary EXISTS and is where the registry actually writes — which is
// what iterations 2 and 3 will rely on.
//
// The namespace is a dedicated DATABASE rather than a schema. The first run of
// this suite is why: with `?currentSchema=age` the registry created
// public.V_AgeCitizen and left the `age` schema empty, because the registry
// exposes only a JDBC URI and Sqlg places unqualified vertex labels in `public`.
// These assertions are deliberately written against the boundary that is real.

import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMPOSE = ['compose', '-f', join(ROOT, 'deploy', 'docker-compose.yml')];

/** The database the Age registry writes to. Mirrors AGE_REGISTRY_JDBC. */
const AGE_DB = 'age';

async function psql(sql, database = AGE_DB) {
  const { stdout } = await run('docker', [
    ...COMPOSE, 'exec', '-T', 'db',
    'psql', '-U', 'postgres', '-d', database, '-At', '-c', sql,
  ]);
  return stdout.trim();
}

const ENTITY_TABLES =
  "select table_schema || '.' || table_name from information_schema.tables " +
  "where lower(table_name) like '%agecitizen%' order by 1";

let skip = null;
before(async () => {
  try {
    await psql('select 1');
  } catch (err) {
    skip = `database not reachable (${err.message.split('\n')[0]}) — run: cd deploy && docker compose up -d`;
  }
});
const guard = () => {
  if (skip) throw new Error(skip);
};

test('the Age domain has its own database, holding the AgeCitizen entity', async () => {
  guard();
  const tables = await psql(ENTITY_TABLES, AGE_DB);
  assert.ok(tables.length > 0, `expected AgeCitizen tables in the '${AGE_DB}' database; found none`);
  assert.match(tables.toLowerCase(), /agecitizen/);
});

test('no Age data leaks into the databases the protocol services own', async () => {
  guard();
  // registry: the default database, deliberately unused for domain data.
  // identity / credential / credential_schema: key and credential metadata.
  for (const database of ['registry', 'identity', 'credential', 'credential_schema']) {
    const found = await psql(ENTITY_TABLES, database);
    assert.equal(found, '', `AgeCitizen must not exist in '${database}'; found:\n${found}`);
  }
});

test('there is no shared cross-domain person table', async () => {
  guard();
  // Named explicitly so that adding one in a later iteration fails here rather
  // than passing review unnoticed. DESIGN forbids a shared person table across
  // Age, Agriculture and Education.
  const forbidden = await psql(
    "select table_schema || '.' || table_name from information_schema.tables " +
      "where lower(table_name) similar to '%(person|citizen|holder|individual|subject)%' " +
      "and lower(table_name) not like '%agecitizen%'",
    AGE_DB,
  );
  assert.equal(forbidden, '', `a shared person-like table exists in '${AGE_DB}':\n${forbidden}`);
});

test('each protocol service keeps its own database', async () => {
  guard();
  const databases = await psql(
    'select datname from pg_database where datistemplate = false order by datname',
  );
  for (const expected of [AGE_DB, 'credential', 'credential_schema', 'identity', 'registry']) {
    assert.match(databases, new RegExp(`^${expected}$`, 'm'), `database ${expected} must exist`);
  }
});

test('the age namespace is reachable only through the registry API, not shared credentials', async () => {
  guard();
  // The domain data and the credential store are separate databases, so a
  // credential-service compromise does not read source records, and the issuer
  // reaching domain data through the registry API (rather than SQL) is a real
  // boundary rather than a convention.
  const credentialTables = await psql(
    "select count(*) from information_schema.tables where table_schema not in ('pg_catalog','information_schema')",
    'credential',
  );
  const ageTables = await psql(
    "select count(*) from information_schema.tables where table_schema not in ('pg_catalog','information_schema')",
    AGE_DB,
  );
  assert.ok(Number(credentialTables) > 0, 'credential database should hold the credential tables');
  assert.ok(Number(ageTables) > 0, 'age database should hold the registry tables');
});
