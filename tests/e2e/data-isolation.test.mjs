// Data isolation, checked against the database rather than asserted in prose.
//
// DESIGN §7 requires Age data to live in its own namespace, with no shared
// cross-domain person table. Iteration 01 has one domain, so what this proves is
// that the namespace boundary EXISTS and is where the registry actually writes —
// which is the thing iterations 2 and 3 will rely on.

import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMPOSE = ['compose', '-f', join(ROOT, 'deploy', 'docker-compose.yml')];

async function psql(sql, database = 'registry') {
  const { stdout } = await run('docker', [
    ...COMPOSE, 'exec', '-T', 'db',
    'psql', '-U', 'postgres', '-d', database, '-At', '-c', sql,
  ]);
  return stdout.trim();
}

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

test('the age namespace exists and holds the AgeCitizen entity', async () => {
  guard();
  const tables = await psql(
    "select table_name from information_schema.tables where table_schema = 'age' order by table_name",
  );
  assert.ok(tables.length > 0, 'the age schema must contain the registry tables');
  assert.match(
    tables.toLowerCase(),
    /agecitizen/,
    `expected an AgeCitizen table in schema 'age'; found:\n${tables}`,
  );
});

test('no AgeCitizen data sits in the public schema', async () => {
  guard();
  const publicTables = await psql(
    "select table_name from information_schema.tables where table_schema = 'public' and lower(table_name) like '%agecitizen%'",
  );
  assert.equal(publicTables, '', `AgeCitizen must not exist in public; found:\n${publicTables}`);
});

test('there is no shared cross-domain person table', async () => {
  guard();
  // Named explicitly so that adding one in a later iteration fails here rather
  // than passing review unnoticed.
  const forbidden = await psql(
    "select table_schema || '.' || table_name from information_schema.tables " +
      "where lower(table_name) in ('person','citizen','holder','individual','subject')",
  );
  assert.equal(forbidden, '', `a shared person-like table exists:\n${forbidden}`);
});

test('the protocol services keep their own databases', async () => {
  guard();
  // identity, credential and credential_schema are separate databases, so
  // registry data and key/credential metadata are not in one namespace.
  const databases = await psql("select datname from pg_database where datistemplate = false order by datname");
  for (const expected of ['credential', 'credential_schema', 'identity', 'registry']) {
    assert.match(databases, new RegExp(`^${expected}$`, 'm'), `database ${expected} must exist`);
  }
});
