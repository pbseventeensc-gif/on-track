const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:18080/v1/projects/demo-wtrack-delete/databases/(default)/documents';
async function request(method, path, body, admin = false) {
  return fetch(`${base}/${path}`, {
    method, headers: {'Content-Type': 'application/json', ...(admin ? {Authorization: 'Bearer owner'} : {})},
    body: body ? JSON.stringify(body) : undefined
  });
}
(async () => {
  const profile = {fields: {name: {stringValue: 'Deleted Courier'}}};
  const marker = {fields: {status: {stringValue: 'completed'}}};
  assert.equal((await request('PATCH', 'users/test-courier', profile)).status, 200);
  assert.equal((await request('PATCH', 'account_deletions/test-courier', marker, true)).status, 200);
  assert.equal((await request('DELETE', 'users/test-courier', undefined, true)).status, 200);
  for (const method of ['PATCH', 'DELETE']) {
    assert.equal((await request(method, 'users/test-courier', method === 'PATCH' ? profile : undefined)).status, 403);
    assert.equal((await request(method, 'account_deletions/test-courier', method === 'PATCH' ? marker : undefined)).status, 403);
  }
  assert.equal((await request('PATCH', 'users/test-courier/private/data', profile)).status, 403);
  assert.equal((await request('PATCH', 'account_deletions/test-courier/private/data', marker)).status, 403);
  assert.equal((await request('GET', 'users')).status, 200);
  assert.equal((await request('GET', 'account_deletions')).status, 200);
  assert.equal((await request('PATCH', 'users/still-active', profile)).status, 200);
  assert.equal((await request('PATCH', 'trips/history', profile)).status, 200);
  assert.equal((await request('GET', 'users/test-courier')).status, 404);
  console.log('Passed 14 Firestore emulator checks: deleted profiles cannot be recreated, markers protected, existing app access preserved.');
})().catch(e => {console.error(e); process.exitCode = 1;});
