// Issuer counter front end.
//
// Exists for one reason the scripted wallet cannot cover: a phone needs
// something to scan. It picks a citizen and shows the OpenID4VCI offer as a QR.
//
// It is NOT a staff portal — no login, no record editing, no issuer
// administration (all out of scope for this iteration). It calls /api/issuer
// with a citizen identifier and displays what comes back; every claim is derived
// server-side from the registry record.

const API = '/api/issuer';

const el = (id) => document.getElementById(id);
const text = (value) => document.createTextNode(String(value));

async function api(path, init) {
  const res = await fetch(`${API}${path}`, init);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function row(list, term, valueNode) {
  const dt = document.createElement('dt');
  dt.appendChild(text(term));
  const dd = document.createElement('dd');
  dd.appendChild(typeof valueNode === 'string' ? text(valueNode) : valueNode);
  list.appendChild(dt);
  list.appendChild(dd);
}

function chipsNode(names) {
  const wrap = document.createElement('div');
  wrap.className = 'chips';
  for (const name of names) {
    const chip = document.createElement('span');
    // `ageOver18` is the claim an age verifier will ask for; the rest ride along
    // in the credential for the holder to withhold.
    chip.className = name === 'ageOver18' ? 'chip ask' : 'chip';
    chip.appendChild(text(name));
    wrap.appendChild(chip);
  }
  return wrap;
}

async function issue(citizen) {
  const { status, body } = await api('/offers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ citizenId: citizen.citizenId }),
  });

  if (status !== 201) {
    el('offer-eyebrow').textContent = 'Could not issue';
    el('offer-for').textContent = body.error || 'Unknown error';
    el('qr').textContent = '';
  } else {
    el('offer-eyebrow').textContent = 'Scan with your wallet';
    el('offer-for').textContent = `${citizen.citizenId} · ${citizen.name}`;
    // Server-rendered SVG: the deep link carries the pre-authorised code, so it
    // is not copied through the page any more than it has to be.
    el('qr').innerHTML = body.qrSvg;

    const detail = el('detail');
    detail.textContent = '';
    row(detail, 'Credential', 'Age Verification Credential (vc+sd-jwt)');
    row(detail, 'Claims issued', chipsNode(body.claimNames));
    row(detail, 'Type', body.vct);
  }

  el('panel-pick').hidden = true;
  el('panel-offer').hidden = false;
}

async function loadCitizens() {
  const { status, body } = await api('/citizens');
  const list = el('citizens');
  list.textContent = '';

  if (status !== 200 || !Array.isArray(body) || body.length === 0) {
    const note = document.createElement('p');
    note.className = 'muted small';
    note.appendChild(text('No citizen records found — run ./scripts/seed-age-citizens.sh'));
    list.appendChild(note);
    return;
  }

  for (const citizen of body) {
    const rowEl = document.createElement('button');
    rowEl.className = 'record';
    rowEl.type = 'button';

    const who = document.createElement('span');
    who.className = 'record-name';
    who.appendChild(text(citizen.name || citizen.citizenId));

    const id = document.createElement('span');
    id.className = 'record-id';
    id.appendChild(text(citizen.citizenId));

    const go = document.createElement('span');
    go.className = 'record-go';
    go.appendChild(text('Issue →'));

    rowEl.append(who, id, go);
    rowEl.addEventListener('click', () => issue(citizen));
    list.appendChild(rowEl);
  }
}

el('again').addEventListener('click', () => window.location.reload());
loadCitizens();
