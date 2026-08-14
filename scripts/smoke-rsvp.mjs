/**
 * Smoke test against a LIVE deployed backend.
 *
 * The unit tests cover the logic; this covers what can only fail for real —
 * OAuth scopes, the deployment's access setting, and the CORS simple-request
 * rule that Apps Script depends on.
 *
 * Run before launch, and again after every redeploy:
 *   node scripts/smoke-rsvp.mjs https://script.google.com/macros/s/XXXX/exec
 *
 * It writes one real row. Delete it from the sheet afterwards.
 */

const endpoint = process.argv[2];
if (!endpoint || !endpoint.includes('/exec')) {
  console.error('Usage: node scripts/smoke-rsvp.mjs <web app /exec URL>');
  process.exit(1);
}

let failures = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ''}`);
  }
}

async function post(body) {
  const response = await fetch(endpoint, {
    method: 'POST',
    // text/plain keeps this a CORS simple request. Apps Script cannot answer a
    // preflight, so application/json would fail from a browser even though it
    // works fine from here.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow',
  });
  return response.json();
}

async function get(params) {
  const response = await fetch(`${endpoint}?${new URLSearchParams(params)}`, { redirect: 'follow' });
  return response.json();
}

const stamp = Date.now();
const payload = {
  status: 'yes',
  leadFirstName: 'Smoke',
  leadLastName: `Test${stamp}`,
  email: `smoke-test-${stamp}@example.invalid`,
  phone: '0170 1234567',
  phoneDialCode: '+49',
  attendees: [{ fullName: `Smoke Test${stamp}`, diet: 'vegan', allergens: ['nuts'] }],
  eveningParty: 'yes',
  hotelStatus: 'no',
  travelMode: 'own_car',
  consentPrivacy: true,
  consentHealthData: true,
  inviteCode: 'GROHNDE27',
  inviteCodeValid: true,
  locale: 'en',
};

async function checkWrites() {
  console.log('\ncreate');
  const created = await post({ action: 'create', locale: 'en', payload });
  check('accepts a valid submission', created.ok === true, JSON.stringify(created));
  check('returns a token', typeof created.token === 'string' && created.token.length > 10);
  check('returns a party code', /^MT-[A-Z2-9]{6}$/.test(created.partyCode ?? ''), created.partyCode);
  check('returns an edit link', String(created.editUrl ?? '').includes('/rsvp/edit?t='));
  if (!created.token) return;

  console.log('\nvalidation');
  const invalid = await post({
    action: 'create',
    payload: { ...payload, email: 'not-an-email', attendees: [] },
  });
  check('rejects a bad payload', invalid.ok === false && invalid.error === 'VALIDATION');
  check('reports which fields failed', Boolean(invalid.fields?.email));

  console.log('\nread back');
  const fetched = await get({ action: 'get', t: created.token });
  check('finds the row by token', fetched.ok === true);
  check('returns the payload', fetched.rsvp?.payload?.leadFirstName === 'Smoke');
  check('never leaks the token back', fetched.rsvp?.token === undefined);

  const unknown = await get({ action: 'get', t: 'definitely-not-a-real-token' });
  check('gives nothing away for an unknown token', unknown.ok === false && unknown.error === 'NOT_FOUND');

  console.log('\nupdate');
  const updated = await post({
    action: 'update',
    token: created.token,
    locale: 'en',
    payload: { ...payload, eveningParty: 'no' },
  });
  check('saves a change', updated.ok === true, JSON.stringify(updated));

  const reread = await get({ action: 'get', t: created.token });
  check('the change stuck', reread.rsvp?.payload?.eveningParty === 'no');
  check('the version went up', (reread.rsvp?.version ?? 0) >= 2);

  console.log('\nfind by party code');
  const found = await post({
    action: 'find',
    email: payload.email,
    partyCode: created.partyCode,
  });
  check('finds the reply from code + email', found.ok === true, JSON.stringify(found));
  check('and returns the right token', found.token === created.token);

  const wrongEmail = await post({
    action: 'find',
    email: 'someone-else@example.invalid',
    partyCode: created.partyCode,
  });
  // Six characters is walkable by a script; the email pairing is what stops it.
  check('refuses the code with the wrong address', wrongEmail.ok === false);

  const wrongCode = await post({ action: 'find', email: payload.email, partyCode: 'MT-ZZZZZZ' });
  check('refuses the address with the wrong code', wrongCode.ok === false);

  console.log('\nspam handling');
  const honeypot = await post({ action: 'create', hp: 'bot', payload });
  check('swallows a honeypot hit without complaint', honeypot.ok === true);

  console.log('\nduplicate address');
  const duplicate = await post({ action: 'create', locale: 'en', payload });
  check('returns the existing reply rather than a second one', duplicate.duplicate === true);
  check('and the same token', duplicate.token === created.token);
}

console.log(`\nSmoke testing ${endpoint}\n`);

console.log('status');
const status = await get({ action: 'status' });
check('responds with ok', status.ok === true, JSON.stringify(status));
check('reports a phase', ['open', 'late', 'locked'].includes(status.phase), `phase=${status.phase}`);
check('knows the event date', typeof status.eventAt === 'string');

if (status.phase === 'locked') {
  // Not a failure — there is simply nothing to write to.
  console.log('\nThe form is locked, so the write checks are skipped.');
} else {
  await checkWrites();
}

console.log(
  failures === 0
    ? `\nAll good.\n\nNow delete the "${payload.leadLastName}" row from the Responses tab.\n`
    : `\n${failures} check(s) failed.\n`,
);

// `process.exitCode` rather than `process.exit()`: forcing an exit while fetch
// still holds sockets makes libuv print an alarming assertion failure on
// Windows, immediately after the script has reported everything passed.
process.exitCode = failures ? 1 : 0;
