// Local emulator only. Start the RTDB emulator on 127.0.0.1:19000 first.
// node scripts/test_database_rules.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database.rules.json')));
const base = 'http://127.0.0.1:19000';
const namespace = 'demo-wtrack-rules';

async function request(method, location, auth, data, admin = false) {
  const url = new URL(`${base}/${location}.json`);
  url.searchParams.set('ns', namespace);
  const headers = { 'Content-Type': 'application/json' };
  if (admin || auth !== undefined) {
    headers.Authorization = 'Bearer owner';
    if (!admin) url.searchParams.set('auth_variable_override', JSON.stringify(auth));
  }
  return fetch(url, { method, headers, body: data === undefined ? undefined : JSON.stringify(data) });
}

const identity = (uid, provider = 'password') => ({uid, token: {firebase: {sign_in_provider: provider}}});

(async () => {
  const installed = await request('PUT', '.settings/rules', undefined, rules, true);
  assert.equal(installed.status, 200, await installed.text());
  assert.equal((await request('PUT', '', undefined, {
    courier_live_location: { sample: {lat: -6.2, lng: 106.6} },
    settings: { wa_group_config: {enabled: true} }
  }, true)).status, 200);

  // Real current internal accounts, covering admin and courier use cases.
  const internal = [
    'XkF9SG8HrHWz5q8RbsR8UoY4nwU2', // superadmin
    'G3lgyThQz9S2iCMzT8pX529fbSv2', // logistics admin
    '9dhFtf5QTQW8zmb8cZW5YFgZfmH3' // courier
  ];
  let checks = 0;
  for (const uid of internal) {
    for (const provider of ['password', 'google.com']) {
      const auth = identity(uid, provider);
      assert.equal((await request('GET', '', auth)).status, 200);
      assert.equal((await request('PUT', `courier_live_location/${uid}`, auth, {lat: -6.1, lng: 106.7})).status, 200);
      assert.equal((await request('PATCH', 'settings/wa_group_config', auth, {enabled: false})).status, 200);
      assert.equal((await request('DELETE', `courier_live_location/${uid}`, auth)).status, 200);
      checks += 4;
    }
  }
  for (const auth of [undefined, null, identity('unapproved-account'), identity(internal[0], 'anonymous')]) {
    for (const location of ['', 'courier_live_location', 'settings/wa_group_config']) {
      for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
        const data = ['PUT', 'PATCH'].includes(method) ? {unauthorized: true} : undefined;
        const response = await request(method, location, auth, data);
        assert.equal(response.status, 401, `${method} /${location}: ${await response.text()}`);
        checks++;
      }
    }
  }
  // Even an approved application user cannot replace the server security rules.
  const response = await request('PUT', '.settings/rules', identity(internal[0]), {rules: {'.read': true, '.write': true}});
  assert.equal(response.status, 401, await response.text());
  checks++;
  // Revocation markers cannot be altered by internal clients, including ancestor writes.
  const revokedUid = internal[2];
  assert.equal((await request('PUT', `_deleted_accounts/${revokedUid}`, undefined, true, true)).status, 200);
  for (const location of ['', `_deleted_accounts`, `_deleted_accounts/${revokedUid}`]) {
    assert.equal((await request('PUT', location, identity(internal[0]), {})).status, 401);
    assert.equal((await request('DELETE', location, identity(internal[0]))).status, 401);
    checks += 2;
  }
  assert.equal((await request('GET', 'courier_live_location', identity(revokedUid))).status, 401);
  assert.equal((await request('PUT', `courier_live_location/${revokedUid}`, identity(revokedUid), {})).status, 401);
  checks += 2;
  console.log(`Passed ${checks} emulator access checks.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
