// Mock bank front end.
//
// It talks ONLY to /api/verifier/agriculture. It never calls oid4vc-service, it
// never verifies anything, and it never computes the loan: ELIGIBLE with an
// amount, or NOT ELIGIBLE with a reason, arrives already decided from the
// verifier service — after cryptographic verification, an issuer trust check per
// credential, and the Farmer ID correlation check. A page that multiplied an
// acreage it fetched itself would be a simulation of a lending decision, which is
// precisely what this iteration must not ship.
//
// Deliberately the same shape as services/verifier-web: same API surface, same
// polling, same three no-result states. The differences are the ones the use case
// actually has — two credentials instead of one, and a visible calculation.

const API = '/api/verifier/agriculture';
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

/**
 * Claim chips: what was shared, and what was deliberately not.
 *
 * The withheld list is the point of the screen. A bank that can lend against
 * verified cultivation without ever learning who the farmer is, where they live,
 * or how much land they own in total is the whole argument of the iteration, and
 * it is only legible if the page names what it did not receive.
 */
function claimsNode(disclosed) {
  const wrap = document.createElement('div');
  wrap.className = 'chips';
  for (const [name, value] of Object.entries(disclosed)) {
    const chip = document.createElement('span');
    chip.className = 'chip ask';
    chip.appendChild(text(`${name} = ${value}`));
    wrap.appendChild(chip);
  }
  for (const withheld of ['National ID', 'name', 'land ID', 'total land area', 'district', 'farmer category']) {
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

/** The arithmetic, shown rather than asserted. */
function showCalculation({ disclosed, loan }) {
  const wrap = el('calculation');
  wrap.textContent = '';
  if (!loan || !disclosed) {
    wrap.hidden = true;
    return;
  }
  const lines = [
    ['Crop', disclosed.cropType],
    ['Cultivated area', `${disclosed.cultivatedAreaAcres} acres`],
    ['Applicable rate', `₹${loan.ratePerAcre.toLocaleString('en-IN')} per acre`],
  ];
  for (const [label, value] of lines) {
    const line = document.createElement('div');
    line.className = 'calc-line';
    const k = document.createElement('span');
    k.appendChild(text(label));
    const v = document.createElement('strong');
    v.appendChild(text(value));
    line.append(k, v);
    wrap.appendChild(line);
  }
  const total = document.createElement('div');
  total.className = 'calc-line total';
  const k = document.createElement('span');
  k.appendChild(text('Maximum loan'));
  const v = document.createElement('strong');
  // Formatted by the service, in Indian digit grouping. Not recomputed here:
  // the page must not be capable of producing a different number.
  v.appendChild(text(loan.maximumLoanFormatted));
  total.append(k, v);
  wrap.appendChild(total);
  wrap.hidden = false;
}

function showResult({ decision, reason, checks, issuer, disclosed, loan, failedCheck, diagnostic, nothingShared }) {
  stopPolling();
  el('panel-request').hidden = true;
  el('panel-result').hidden = false;

  // Four outcomes, and the distinction between them is a Product requirement.
  // A holder who declined, and a request nobody answered, are NOT verification
  // failures. Nor is REJECTED the same as NOT ELIGIBLE: one means we could not
  // trust what we were shown, the other means we trusted it and the answer was
  // no.
  const verdict = nothingShared
    ? 'NO DATA SHARED'
    : decision === 'ELIGIBLE'
      ? 'ELIGIBLE'
      : decision === 'NOT_ELIGIBLE'
        ? 'NOT ELIGIBLE'
        : 'REJECTED / UNABLE TO VERIFY';
  const tone = nothingShared
    ? 'neutral'
    : verdict === 'ELIGIBLE'
      ? 'approved'
      : verdict === 'NOT ELIGIBLE'
        ? 'denied'
        : 'failed';
  const node = el('decision');
  node.textContent = verdict;
  node.className = `decision ${tone}`;
  el('result-eyebrow').textContent = nothingShared
    ? 'No result'
    : decision
      ? 'Verified result'
      : 'Unable to verify';
  el('reason').textContent = reason || '';

  showCalculation({ disclosed, loan });

  const detail = el('detail');
  detail.textContent = '';
  if (issuer) row(detail, 'Issuers', Array.isArray(issuer) ? issuer.join(' · ') : issuer);
  if (disclosed) row(detail, 'Shared with us', claimsNode(disclosed));
  if (checks && Object.keys(checks).length) row(detail, 'Verification', checksNode(checks));
  if (failedCheck) row(detail, 'Failed at', failedCheck);
  if (diagnostic) row(detail, 'Detail', diagnostic);
}

async function poll() {
  const { status, body } = await api(`/sessions/${state.sessionId}`);
  if (status === 404 || body.state === 'expired') {
    return showResult({
      nothingShared: true,
      reason:
        'No presentation arrived before the request expired. Nothing was disclosed and no credit decision was produced.',
    });
  }
  if (body.state === 'waiting') return;
  if (body.state === 'cancelled') {
    return showResult({
      nothingShared: true,
      reason: 'The application was cancelled. Nothing was disclosed and no credit decision was produced.',
    });
  }
  if (body.state === 'declined') {
    return showResult({
      nothingShared: true,
      reason: 'The farmer declined the request. Nothing was disclosed and no credit decision was produced.',
    });
  }
  if (body.state === 'rejected') return showResult(body);
  if (body.state === 'decided') return showResult(body);
}

// Module pitch, not layout, decides whether a phone can decode this. The
// Agriculture request pins two credential types, so its payload is longer than
// the age one and this matters more, not less.
el('enlarge').addEventListener('click', () => {
  const large = document.body.classList.toggle('qr-large');
  el('enlarge').textContent = large ? 'Back to normal size' : 'Enlarge for scanning';
});

el('cancel').addEventListener('click', async () => {
  const id = state.sessionId;
  stopPolling();
  if (id) await api(`/sessions/${id}/cancel`, { method: 'POST' });
  showResult({
    nothingShared: true,
    reason: 'The application was cancelled. Nothing was disclosed and no credit decision was produced.',
  });
});

async function start() {
  el('start').disabled = true;
  const { status, body } = await api('/sessions', { method: 'POST' });
  if (status !== 201) {
    el('start').disabled = false;
    return showResult({ reason: body.error || 'Could not start a farm credit check.' });
  }

  state.sessionId = body.sessionId;
  // Exposed in the DOM so the scripted wallet (and the demo capture) can answer
  // the session this page is actually showing. It is a transaction id, not
  // holder data, and it is single-use and short-lived.
  el('qr').dataset.sessionId = body.sessionId;
  el('qr').innerHTML = body.qrSvg;
  el('qr').hidden = false;
  el('open-wallet').href = body.qrData;
  el('open-wallet').hidden = false;
  el('enlarge').hidden = false;
  el('cancel').hidden = false;
  el('hint').hidden = false;
  el('start').hidden = true;
  el('request-eyebrow').textContent = 'Scan with your wallet';

  state.deadline = Date.now() + body.expiresInSeconds * 1000;
  state.timer = setInterval(poll, POLL_INTERVAL_MS);
  state.countdown = setInterval(() => {
    const left = Math.max(0, Math.round((state.deadline - Date.now()) / 1000));
    el('countdown').textContent = `${left}s left`;
    if (left === 0) poll();
  }, 1000);
}

/**
 * What this bank asks for and lends at, read from the service rather than
 * hardcoded — so the page cannot claim a policy the verifier does not hold.
 */
async function showPolicy() {
  const { body } = await api('/policy');
  if (!body.requestedClaims) return;
  const wrap = el('policy');
  wrap.textContent = '';
  wrap.appendChild(text('Requests'));
  for (const [role, claims] of Object.entries(body.requestedClaims)) {
    for (const claim of claims) {
      const chip = document.createElement('span');
      chip.className = 'chip ask';
      chip.appendChild(text(`${role}: ${claim}`));
      wrap.appendChild(chip);
    }
  }
  wrap.appendChild(text('· accepts'));
  for (const issuer of body.trustedIssuers || []) {
    // Only the issuers that can satisfy a role in THIS request. The Age issuer
    // is on the same allowlist and is not one of them.
    if (!issuer.roles || issuer.roles.length === 0) continue;
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.appendChild(text(issuer.name));
    wrap.appendChild(chip);
  }
  if (body.cropRates) {
    wrap.appendChild(text('· lends at'));
    for (const [crop, rate] of Object.entries(body.cropRates)) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.appendChild(text(`${crop} ₹${rate.toLocaleString('en-IN')}/acre`));
      wrap.appendChild(chip);
    }
  }
}

el('start').addEventListener('click', start);
el('again').addEventListener('click', () => window.location.reload());
showPolicy();
