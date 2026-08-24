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

function showResult({ decision, reason, checks, issuer, disclosed, failedCheck, diagnostic }) {
  stopPolling();
  el('panel-request').hidden = true;
  el('panel-result').hidden = false;

  const verdict = decision || 'NOT VERIFIED';
  const node = el('decision');
  node.textContent = verdict;
  node.className = `decision ${verdict === 'APPROVED' ? 'approved' : verdict === 'DENIED' ? 'denied' : 'failed'}`;
  el('reason').textContent = reason || '';

  const rows = [];
  if (issuer) rows.push(['Issuer', issuer]);
  if (disclosed) {
    rows.push(['Disclosed to us', Object.entries(disclosed).map(([k, v]) => `${k} = ${v}`).join(', ')]);
    rows.push(['Not disclosed', 'date of birth, name, gender, everything else']);
  }
  if (checks && Object.keys(checks).length) {
    rows.push(['Verification', Object.entries(checks).map(([k, v]) => `${k}: ${v}`).join('  ·  ')]);
  }
  if (failedCheck) rows.push(['Failed at', failedCheck]);
  if (diagnostic) rows.push(['Detail', diagnostic]);

  el('detail').innerHTML = rows
    .map(([term, value]) => `<dt>${term}</dt><dd>${value}</dd>`)
    .join('');
}

async function poll() {
  const { status, body } = await api(`/sessions/${state.sessionId}`);
  if (status === 404 || body.state === 'expired') {
    return showResult({ reason: 'The request expired before a presentation arrived.' });
  }
  if (body.state === 'waiting') return;
  if (body.state === 'rejected') return showResult({ ...body, reason: body.reason });
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

  state.deadline = Date.now() + body.expiresInSeconds * 1000;
  state.timer = setInterval(poll, POLL_INTERVAL_MS);
  state.countdown = setInterval(() => {
    const left = Math.max(0, Math.round((state.deadline - Date.now()) / 1000));
    el('countdown').textContent = `${left}s left`;
    if (left === 0) poll();
  }, 1000);
}

async function showPolicy() {
  const { body } = await api('/policy');
  if (!body.requestedClaims) return;
  el('policy').textContent =
    `This verifier requests: ${body.requestedClaims.join(', ')}. ` +
    `Accepted issuers: ${(body.trustedIssuers || []).join(', ')}.`;
}

el('start').addEventListener('click', start);
el('again').addEventListener('click', () => window.location.reload());
showPolicy();
