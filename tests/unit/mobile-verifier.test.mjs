// The installed mobile verifier's build-time channels, checked as source.
//
// Why here rather than in verify.sh: these invariants hold on any clean checkout
// with no stack running and no device attached. verify.sh checks the
// complementary half — that the app never reaches a protocol endpoint and offers
// no on-screen picker.
//
// Why at all: this app is a React Native screen with no test harness in this
// repository, so nothing else reads it. Its channel names and API paths are
// build-time constants, and the way they break is silent — the app happily polls
// a 404 and reports "unable to verify", or shows the previous iteration's name on
// the home screen. The second is not hypothetical: an Education demo was set up
// with "Farm Credit" still installed, which is the same class of defect Iteration
// 02 was sent back for.

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NEVER_REQUESTED, POLICIES } from '../../services/verifier/src/domains/education/index.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP = readFileSync(join(ROOT, 'services', 'verifier-mobile', 'App.js'), 'utf8');
const CONFIG = readFileSync(join(ROOT, 'services', 'verifier-mobile', 'app.config.js'), 'utf8');

/** The channel keys App.js declares in its USE_CASES map. */
function appChannels() {
  const block = APP.slice(APP.indexOf('const USE_CASES = {'));
  const body = block.slice(0, block.indexOf('\n};'));
  return [...body.matchAll(/^ {2}'?([a-z-]+)'?: \{$/gm)].map((m) => m[1]);
}

/** The channel keys app.config.js will accept, from its NAMES map. */
function configChannels() {
  const block = CONFIG.slice(CONFIG.indexOf('const NAMES = {'));
  const body = block.slice(0, block.indexOf('\n};'));
  return [...body.matchAll(/^ {2}'?([a-z-]+)'?:/gm)].map((m) => m[1]);
}

/** The array literal assigned to a top-level const in App.js. */
function arrayConst(name) {
  const at = APP.indexOf(`const ${name} = [`);
  assert.notEqual(at, -1, `no const ${name} in App.js`);
  const body = APP.slice(at + `const ${name} = [`.length);
  return [...body.slice(0, body.indexOf('];')).matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('the mobile verifier’s channels', () => {
  test('app.config.js and App.js agree on which channels exist', () => {
    // Two files, two maps, and a channel present in one and not the other is a
    // build that starts and then crashes on `useCase.api` — after installation,
    // on a device, with nothing in any log to say why.
    assert.deepEqual(appChannels().sort(), configChannels().sort());
  });

  test('every iteration has a channel, so no demo shows the previous one’s name', () => {
    const channels = configChannels();
    for (const expected of ['age', 'agriculture', 'education-masters', 'education-job']) {
      assert.ok(channels.includes(expected), `no '${expected}' channel`);
    }
  });

  test('an unknown channel is refused at build time, not defaulted', () => {
    // A silent fallback would produce an app that looks right and asks the wrong
    // verifier for the wrong credential.
    assert.match(CONFIG, /throw new Error\(/);
    assert.doesNotMatch(CONFIG, /NAMES\[USE_CASE\] \?\?/);
  });

  test('each channel’s API path is one the verifier service actually routes', () => {
    // The service builds its routes from its own USE_CASES keys, so the paths
    // here must match those keys exactly: `/api/verifier` for age, and
    // `/api/verifier/<key>` otherwise.
    const paths = [...APP.matchAll(/api: `\$\{BASE\}(\/api\/verifier[^`]*)`/g)].map((m) => m[1]);
    assert.deepEqual(paths.sort(), [
      '/api/verifier',
      '/api/verifier/agriculture',
      '/api/verifier/education/job',
      '/api/verifier/education/masters',
    ]);
  });

  test('the two Education channels are named for their own party, not for Education', () => {
    // A university admissions office and an employer are two parties. One app
    // named "Education Verifier" would mislabel one of them on the home screen,
    // which is the very thing a build-time channel exists to prevent.
    assert.match(CONFIG, /'education-masters': "Master's Admissions"/);
    assert.match(CONFIG, /'education-job': 'Interview Shortlisting'/);
  });
});

describe('the mobile verifier’s privacy claim matches the service’s', () => {
  test('the withheld list it shows is the one the service publishes', () => {
    // App.js hardcodes this list while the web portals fetch it from /policy.
    // That duplication is allowed — this app is supporting evidence, not the
    // charter's channel — but only while it stays TRUE. If NEVER_REQUESTED gains
    // an entry and this does not, the app claims a weaker guarantee than the
    // service makes; if it loses one, the app claims a stronger one.
    assert.deepEqual(arrayConst('EDUCATION_WITHHELD'), NEVER_REQUESTED);
  });

  test('the job channel additionally names the two percentages it never asks for', () => {
    // The clearest privacy evidence in the iteration: the employer's request does
    // not contain the school or college percentage at all.
    const notRequested = Object.entries(POLICIES.masters.claims)
      .filter(([role]) => role !== 'university')
      .map(([role]) => role);
    for (const role of notRequested) {
      assert.equal(
        POLICIES.job.claims[role].includes('percentage'),
        false,
        `the job policy requests the ${role} percentage, so the app must not say it does not`,
      );
      assert.match(APP, new RegExp(`'${role} percentage'`), `the app does not name the ${role} percentage`);
    }
  });

  test('the ELIGIBLE wording comes from the service, never from the app', () => {
    // PRODUCT forbids ever displaying the words this checks for, so they live in
    // the module the tests assert against and the app renders result.headline.
    //
    // Checked against the source with COMMENTS STRIPPED, because the guarantee is
    // about what can reach a screen. Checking raw source failed on the comment
    // above explaining the rule — and rewording that comment would have made the
    // test pass while leaving it unable to tell prose from a rendered string.
    assert.match(APP, /result\.headline/);
    const code = APP.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const forbidden of ['ADMITTED', 'ADMISSION CONFIRMED', 'HIRED', 'JOB OFFER', 'APPOINTED']) {
      assert.equal(code.includes(forbidden), false, `App.js can display the forbidden word ${forbidden}`);
    }
  });
});
