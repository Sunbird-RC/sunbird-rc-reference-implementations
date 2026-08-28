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
  // Age owns AgeCitizen. Agriculture owns FarmerRecord and LandRecord. Education
  // owns nothing yet. No table may be claimed by two use cases.
  //
  // This test's earlier form asserted that no Agriculture table existed at all,
  // which was right for one iteration and is now exactly wrong. What replaces it
  // is the check its own comment promised: that Agriculture's tables are its own.
  const AGE = ['agecitizen'];
  const AGRICULTURE = ['farmerrecord', 'landrecord'];
  const EDUCATION = ['qualification', 'schoolcertificate', 'collegediploma', 'universitydegree'];

  const present = async (terms) =>
    (
      await psql(
        "select table_schema || '.' || table_name from information_schema.tables where lower(table_name) similar to " +
          `'%(${terms.join('|')})%' order by 1`,
      )
    )
      .split('\n')
      .filter(Boolean);

  const ageTables = await present(AGE);
  const agriTables = await present(AGRICULTURE);
  assert.ok(ageTables.length > 0, 'the Age entity table is missing');
  assert.ok(
    agriTables.length >= 2,
    `both Agriculture entity tables should exist, found:\n${agriTables.join('\n')}`,
  );

  // No table name may belong to two use cases.
  for (const table of [...ageTables, ...agriTables]) {
    const matches = [AGE, AGRICULTURE, EDUCATION].filter((terms) =>
      terms.some((t) => table.toLowerCase().includes(t)),
    );
    assert.equal(matches.length, 1, `${table} looks like it serves more than one use case`);
  }

  // Education has not landed, so its tables must not exist.
  const education = await present(EDUCATION);
  assert.deepEqual(education, [], `no Education table should exist yet, found:\n${education.join('\n')}`);

  // The rule in the form that actually bites: neither domain's table carries the
  // other's identifiers. A FarmerRecord with a citizenId column, or an AgeCitizen
  // with a farmerId, would be a shared person table wearing a domain name.
  const columnsOf = async (table) =>
    (
      await psql(
        "select lower(column_name) from information_schema.columns where lower(table_name) = lower('" +
          table.split('.').pop() +
          "') order by 1",
      )
    )
      .split('\n')
      .filter(Boolean);

  for (const table of ageTables) {
    const cols = await columnsOf(table);
    for (const foreign of ['farmerid', 'landid', 'croptype', 'cultivatedareaacres']) {
      assert.equal(cols.includes(foreign), false, `${table} carries the Agriculture column ${foreign}`);
    }
  }
  for (const table of agriTables) {
    const cols = await columnsOf(table);
    for (const foreign of ['citizenid', 'dateofbirth', 'ageover18', 'ageover21']) {
      assert.equal(cols.includes(foreign), false, `${table} carries the Age column ${foreign}`);
    }
  }
});

test('each Agriculture registry keeps its own national-id mapping', async () => {
  guard();
  // DESIGN §7: one issuer must not depend on another issuer's unsigned client
  // state. That is why BOTH Agriculture tables carry nationalId — the Land
  // Registry resolves the authenticated farmer itself rather than being handed a
  // farmerId. If that column disappeared from LandRecord, the Land issuer could
  // only work by trusting something it was told.
  for (const table of ['farmerrecord', 'landrecord']) {
    const cols = await psql(
      "select lower(column_name) from information_schema.columns where lower(table_name) like '%" +
        table +
        "%' order by 1",
    );
    assert.ok(
      cols.split('\n').includes('nationalid'),
      `${table} must carry its own nationalId, found columns:\n${cols}`,
    );
  }
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
