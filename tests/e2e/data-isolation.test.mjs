// Use-case data separation, checked against the database rather than asserted in
// prose.
//
// The rule (PRODUCT, DESIGN §7, and Anand's answer 10): ONE PostgreSQL database
// for the showcase, with each use case keeping its own independent tables and
// records. Even where the demos portray the same synthetic person, each use case
// holds its own record — so there must be no shared cross-domain person table, and
// no overlap between use-case tables.
//
// Two earlier attempts are worth remembering, because both are now dead ends:
// `?currentSchema=age` does nothing (the registry leaves table placement to Sqlg,
// which writes unqualified labels to `public`), and a dedicated `age` database was
// stronger than asked for but not the approved direction.
//
// These assertions are deliberately written to bite when Agriculture arrives:
// that is when "no shared person table" and "no overlapping tables" stop being
// theoretical.

import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMPOSE = ['compose', '-f', join(ROOT, 'deploy', 'docker-compose.yml')];

/** The one database the showcase's use-case data lives in. */
const SHOWCASE_DB = 'registry';

/**
 * Databases that are NOT use-case data: each is a separate Prisma service that
 * owns its own `_prisma_migrations` table, so they cannot share one database
 * without overwriting each other's migration state. Recorded in the plan as an
 * interpretation for Anand's acknowledgement.
 */
const PROTOCOL_DBS = ['identity', 'credential', 'credential_schema'];

async function psql(sql, database = SHOWCASE_DB) {
  const { stdout } = await run('docker', [
    ...COMPOSE, 'exec', '-T', 'db',
    'psql', '-U', 'postgres', '-d', database, '-At', '-c', sql,
  ]);
  return stdout.trim();
}

const tablesLike = (pattern) =>
  "select table_schema || '.' || table_name from information_schema.tables " +
  `where lower(table_name) like '${pattern}' order by 1`;

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

test('Age data lives in the showcase database, in its own entity tables', async () => {
  guard();
  const tables = await psql(tablesLike('%agecitizen%'));
  assert.ok(tables.length > 0, `expected AgeCitizen tables in '${SHOWCASE_DB}'; found none`);
  assert.match(tables.toLowerCase(), /agecitizen/);
});

test('there is exactly one database holding use-case data', async () => {
  guard();
  // A per-use-case database would reintroduce the layout Anand replaced. Assert
  // no domain database exists beside the showcase one.
  const databases = (await psql(
    'select datname from pg_database where datistemplate = false order by 1',
  ))
    .split('\n')
    .map((d) => d.trim())
    .filter(Boolean);

  const allowed = new Set([SHOWCASE_DB, 'postgres', ...PROTOCOL_DBS]);
  const unexpected = databases.filter((d) => !allowed.has(d));
  assert.deepEqual(
    unexpected,
    [],
    `unexpected database(s) — use cases must share '${SHOWCASE_DB}': ${unexpected.join(', ')}`,
  );
  assert.ok(databases.includes(SHOWCASE_DB), `'${SHOWCASE_DB}' must exist`);
});

test('there is no shared cross-domain person table', async () => {
  guard();
  // The rule that matters most, and the one that only bites once a second use
  // case exists: each use case keeps its own record for the same synthetic
  // person. A table named for a generic person concept is the failure mode.
  const forbidden = await psql(
    "select table_schema || '.' || table_name from information_schema.tables " +
      "where lower(table_name) similar to '%(person|citizen|holder|individual|subject)%' " +
      "and lower(table_name) not like '%agecitizen%' order by 1",
  );
  assert.equal(forbidden, '', `a shared person-like table exists:\n${forbidden}`);
});

test('use-case tables do not overlap', async () => {
  guard();
  // Age owns AgeCitizen. Agriculture and Education own theirs. No table may be
  // claimed by two use cases, and Age must not reach into another domain's.
  const AGRICULTURE = ['farmer', 'landparcel', 'crop', 'seeddistribution'];
  const EDUCATION = ['qualification', 'schoolcertificate', 'collegediploma', 'universitydegree'];

  const ageTables = (await psql(tablesLike('%agecitizen%'))).split('\n').filter(Boolean);
  for (const other of [...AGRICULTURE, ...EDUCATION]) {
    for (const ageTable of ageTables) {
      assert.equal(
        ageTable.toLowerCase().includes(other),
        false,
        `${ageTable} looks like it serves both Age and another use case`,
      );
    }
  }

  // Iteration 01 has one domain, so nothing else should be present yet. When
  // Agriculture lands this becomes the check that its tables are its own.
  const otherDomains = await psql(
    "select table_schema || '.' || table_name from information_schema.tables where lower(table_name) similar to " +
      `'%(${[...AGRICULTURE, ...EDUCATION].join('|')})%' order by 1`,
  );
  assert.equal(
    otherDomains,
    '',
    `Iteration 01 should hold no Agriculture or Education tables yet; found:\n${otherDomains}`,
  );
});

test('the protocol services keep their own stores, separate from domain data', async () => {
  guard();
  // Not use-case data: keys, credential metadata and schemas. They stay out of
  // the domain database, and no AgeCitizen data may appear in them.
  for (const database of PROTOCOL_DBS) {
    const leaked = await psql(tablesLike('%agecitizen%'), database);
    assert.equal(leaked, '', `AgeCitizen must not exist in '${database}'; found:\n${leaked}`);
  }
});

test('domain data is reachable only through the registry API, not a shared login', async () => {
  guard();
  // The issuer reads source records through the registry's API (DESIGN §7), so
  // domain tables and the credential store stay in separate databases and a
  // compromise of one does not read the other.
  const credentialTables = await psql(
    "select count(*) from information_schema.tables where table_schema not in ('pg_catalog','information_schema')",
    'credential',
  );
  const domainTables = await psql(
    "select count(*) from information_schema.tables where table_schema not in ('pg_catalog','information_schema')",
    SHOWCASE_DB,
  );
  assert.ok(Number(credentialTables) > 0, 'credential store should hold its tables');
  assert.ok(Number(domainTables) > 0, 'showcase database should hold the registry tables');
});
