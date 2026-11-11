const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createDeleteHandler} = require('../lib/delete-courier.cjs');

function setup(overrides = {}) {
  const events = [];
  const missing = () => { const e = new Error('not found'); e.code = 'auth/user-not-found'; throw e; };
  const auth = {
    async verifyIdToken(token, revoked) { assert.equal(revoked, true); if (token === 'invalid') throw new Error(); return {uid: token}; },
    async updateUser(uid) { events.push(`disable:${uid}`); if (overrides.missing) missing(); },
    async revokeRefreshTokens(uid) { events.push(`revoke:${uid}`); },
    async deleteUser(uid) { events.push(`auth-delete:${uid}`); if (overrides.missing) missing(); }
  };
  const db = {
    collection: collection => ({doc: uid => ({path: `${collection}/${uid}`, async set(data) {events.push(`marker:${uid}:${data.status}`);}})}),
    batch() {
      const actions = [];
      return {
        set(ref, data) {actions.push(`set:${ref.path}:${data.status}`);},
        delete(ref) {actions.push(`delete:${ref.path}`);},
        async commit() {events.push(...actions); if (overrides.failCleanup && actions.some(a => a.startsWith('delete:'))) throw new Error('Firestore unavailable');}
      };
    }
  };
  const database = {
    async revokeAccess(uids) {events.push(`rtdb-revoke:${uids.join(',')}`);},
    async removeLocation(uid) {events.push(`location-delete:${uid}`);}
  };
  const handler = createDeleteHandler({auth, db, database, admins: ['admin'], couriers: [{id:'courier', name:'Test Courier', uids:['courier-uid','legacy-uid']}], timestamp: () => 'now'});
  async function call({method='POST', token='admin', uid='courier-uid', confirmName='Test Courier'}={}) {
    const response = {setHeader(){}, status(code){this.code=code; return this;}, json(body){this.body=body; return this;}};
    await handler({method,headers: token ? {authorization:`Bearer ${token}`} : {},body:{uid,confirmName}}, response);
    return response;
  }
  return {call,events};
}

test('only a verified, non-revoked admin can delete approved couriers', async () => {
  for (const args of [{token:null},{token:'invalid'},{token:'courier-uid'},{uid:'admin'},{uid:'unknown'},{confirmName:'wrong'}]) {
    const {call,events} = setup();
    const result=await call(args);
    assert.ok([400,401,403].includes(result.code));
    assert.deepEqual(events,[]);
  }
});

test('deletes Authentication, profiles, aliases and locations, preserving trip history', async () => {
  const {call,events}=setup();
  assert.equal((await call()).code,200);
  for (const uid of ['courier-uid','legacy-uid']) {
    assert.ok(events.includes(`auth-delete:${uid}`));
    assert.ok(events.includes(`delete:users/${uid}`));
    assert.ok(events.includes(`location-delete:${uid}`));
    assert.ok(events.indexOf(`set:account_deletions/${uid}:pending`) < events.indexOf(`delete:users/${uid}`));
    assert.ok(events.indexOf(`disable:${uid}`) < events.indexOf(`auth-delete:${uid}`));
    assert.ok(events.includes(`set:account_deletions/${uid}:completed`));
  }
  assert.ok(events.includes('delete:users/courier'));
  assert.equal(events.some(e=>e.includes('trips/')),false);
});

test('already missing Authentication accounts are idempotently cleaned up', async () => {
  const {call,events}=setup({missing:true});
  assert.equal((await call()).code,200);
  assert.ok(events.includes('delete:users/courier-uid'));
  assert.equal((await call()).code,200);
});

test('partial failure is reported and leaves a retryable marker, never false success', async () => {
  const {call,events}=setup({failCleanup:true});
  const result=await call();
  assert.equal(result.code,503);
  assert.equal(result.body.deleted,undefined);
  assert.ok(events.includes('disable:courier-uid'));
  assert.ok(events.includes('marker:courier-uid:failed'));
  assert.equal(events.some(e=>e.startsWith('auth-delete:')),false);
});

test('capability checks and unsupported methods never mutate accounts', async () => {
  const {call,events}=setup();
  assert.equal((await call({method:'GET'})).body.canDelete,true);
  assert.equal((await call({method:'DELETE'})).code,405);
  assert.deepEqual(events,[]);
});
