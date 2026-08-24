// Verifier front end.
//
// It talks ONLY to /api/verifier. It never calls oid4vc-service, and it never
// decides anything: APPROVED/DENIED arrives already decided from the verifier
// service, after cryptographic verification, the trust allowlist and the
// disclosure policy. A page that computed the decision from a claim it fetched
// itself would be a simulation of a verification, which is precisely what this
// iteration has to avoid.

const API = '/api/verifier';
const POLL_INTERVAL_MS = 1500;

const el = (id) => document.getElementById(id);
const state = { sessionId: null, timer: null, countdown: null, deadline: null };

/** Everything from the server is rendered as text, never as markup. */
const text = (value) => document.createTextNode(String(value));

async function api(path, init) {
  const res = await fetch(`${API}${path}`, init);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function stopPolling() {
  if (state.timer) clearInterval(state.timer);
  if (state.countdown) clearInterval(state.countdown);
  state.timer = null;
  state.countdown = null;
}

/** Verification checks as pass/fail pills. */
function checksNode(checks) {
  const wrap = document.createElement('div');
  wrap.className = 'checks';
  for (const [name, value] of Object.entries(checks)) {
    const pill = document.createElement('span');
    pill.className = value === 'OK' ? 'check' : 'check bad';
    pill.appendChild(text(name));
    wrap.appendChild(pill);
  }
  return wrap;
}

/** Claim chips: what was shared, and what was deliberately not. */
function claimsNode(disclosed) {
  const wrap = document.createElement('div');
  wrap.className = 'chips';
  for (const [name, value] of Object.entries(disclosed)) {
    const chip = document.createElement('span');
    chip.className = 'chip ask';
    chip.appendChild(text(`${name} = ${value}`));
    wrap.appendChild(chip);
  }
  for (const withheld of ['date of birth', 'name', 'ageOver21']) {
    const chip = document.createElement('span');
    chip.className = 'chip withheld';
    chip.appendChild(text(withheld));
    wrap.appendChild(chip);
  }
  return wrap;
}

function row(list, term, valueNode) {
  const dt = document.createElement('dt');
  dt.appendChild(text(term));
  const dd = document.createElement('dd');
  dd.appendChild(typeof valueNode === 'string' ? text(valueNode) : valueNode);
  list.appendChild(dt);
  list.appendChild(dd);
}

function showResult({ decision, reason, checks, issuer, disclosed, failedCheck, diagnostic }) {
  stopPolling();
  el('panel-request').hidden = true;
  el('panel-result').hidden = false;

  const verdict = decision || 'NOT VERIFIED';
  const tone = verdict === 'APPROVED' ? 'approved' : verdict === 'DENIED' ? 'denied' : 'failed';
  const node = el('decision');
  node.textContent = verdict;
  node.className = `decision ${tone}`;
  el('result-eyebrow').textContent = decision ? 'Verified result' : 'Rejected';
  el('reason').textContent = reason || '';

  const detail = el('detail');
  detail.textContent = '';
  if (issuer) row(detail, 'Issuer', issuer);
  if (disclosed) {
    row(detail, 'Shared with us', claimsNode(disclosed));
  }
  if (checks && Object.keys(checks).length) row(detail, 'Verification', checksNode(checks));
  if (failedCheck) row(detail, 'Failed at', failedCheck);
  if (diagnostic) row(detail, 'Detail', diagnostic);
}

async function poll() {
  const { status, body } = await api(`/sessions/${state.sessionId}`);
  if (status === 404 || body.state === 'expired') {
    return showResult({ reason: 'The request expired before a presentation arrived.' });
  }
  if (body.state === 'waiting') return;
  if (body.state === 'rejected') return showResult(body);
  if (body.state === 'decided') return showResult(body);
}

async function start() {
  el('start').disabled = true;
  const { status, body } = await api('/sessions', { method: 'POST' });
  if (status !== 201) {
    el('start').disabled = false;
    return showResult({ reason: body.error || 'Could not start an age check.' });
  }

  state.sessionId = body.sessionId;
  // Exposed in the DOM so the scripted wallet (and the demo capture) can answer
  // the session this page is actually showing. It is a transaction id, not
  // holder data, and it is single-use and short-lived.
  el('qr').dataset.sessionId = body.sessionId;
  el('qr').innerHTML = body.qrSvg;
  el('qr').hidden = false;
  el('hint').hidden = false;
  el('start').hidden = true;
  el('request-eyebrow').textContent = 'Scan with your wallet';
  // Shown so the flow can be completed without a phone:
  //   ./scripts/wallet.sh AGE-000001 <sessionId>
  el('session').textContent = `no phone? ./scripts/wallet.sh AGE-000001 ${body.sessionId}`;
  el('session').hidden = false;

  state.deadline = Date.now() + body.expiresInSeconds * 1000;
  state.timer = setInterval(poll, POLL_INTERVAL_MS);
  state.countdown = setInterval(() => {
    const left = Math.max(0, Math.round((state.deadline - Date.now()) / 1000));
    el('countdown').textContent = `${left}s left`;
    if (left === 0) poll();
  }, 1000);
}

/** Shows what this verifier asks for, read from the service rather than hardcoded. */
async function showPolicy() {
  const { body } = await api('/policy');
  if (!body.requestedClaims) return;
  const wrap = el('policy');
  wrap.textContent = '';
  wrap.appendChild(text('Requests'));
  for (const claim of body.requestedClaims) {
    const chip = document.createElement('span');
    chip.className = 'chip ask';
    chip.appendChild(text(claim));
    wrap.appendChild(chip);
  }
  wrap.appendChild(text('· accepts'));
  for (const issuer of body.trustedIssuers || []) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.appendChild(text(issuer));
    wrap.appendChild(chip);
  }
}

el('start').addEventListener('click', start);
el('again').addEventListener('click', () => window.location.reload());
showPolicy();
