const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {createServer} = require('../scripts/local-sandbox.cjs');

test('local preview strips cloud SDKs, blocks outbound connections, and rejects API writes', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<head>\s*<script src="\/local-sandbox-runtime.js"><\/script>/);
  assert.doesNotMatch(html, /<script[^>]+src=["']https:\/\/(www\.gstatic\.com\/firebasejs|maps\.googleapis\.com)/);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'none'/);
  assert.match(response.headers.get('content-security-policy'), /form-action 'none'/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await fetch(base + '/api/delete-courier', {method:'POST', body:'{}'})).status, 405);
  for (const route of ['/api/delete-courier', '/config/courier-accounts.json', '/.env', '/scripts/backup_and_purge_past_months.js']) {
    assert.equal((await fetch(base + route)).status, 404, route);
  }
  assert.equal((await fetch(base + '/js/sj_import_engine.js')).status, 200);
  const courierResponse = await fetch(base + '/kurir.html');
  assert.equal(courierResponse.status, 200);
  const courierHtml = await courierResponse.text();
  assert.match(courierHtml, /<script src="\/local-sandbox-runtime.js"><\/script>/);
  assert.doesNotMatch(courierHtml, /<script[^>]+src=["']https:\/\/www\.gstatic\.com\/firebasejs/);
  assert.match(courierResponse.headers.get('content-security-policy'), /connect-src 'none'/);
  const runtime = await fetch(base + '/local-sandbox-runtime.js').then(r => r.text());
  assert.match(runtime, /Object.defineProperty\(window, 'firebase', \{value: undefined, writable: false/);
  assert.match(runtime, /wtrack_sandbox_v1:/);
});

test('resetting sandbox data preserves persistent master data and migrates legacy records', () => {
  const legacyClients = JSON.stringify([{id:'CLIENT_ACME', name:'PT ACME'}]);
  const legacyMaterials = JSON.stringify([{id:'material-1', name:'Art Paper'}]);
  const values = new Map([
    ['wtrack_sandbox_v1:wtrack_local_clients', legacyClients],
    ['wtrack_sandbox_v1:wtrack_pool_materials_v1', legacyMaterials],
    ['wtrack_sandbox_v1:wtrack_material_seed_v1', 'true']
  ]);
  const browserStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { const stored = String(value); values.set(key, stored); this[key] = stored; },
    removeItem(key) { values.delete(key); delete this[key]; }
  };
  for (const [key, value] of values) browserStorage[key] = value;
  const window = {localStorage:browserStorage};
  const document = {currentScript:{dataset:{}}, addEventListener() {}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../scripts/local-sandbox-runtime.js'), 'utf8'), {
    window, document, location:{hostname:'localhost'}
  });

  const localStorage = window.localStorage;
  assert.equal(localStorage.getItem('wtrack_local_clients'), legacyClients);
  assert.equal(localStorage.getItem('wtrack_pool_materials_v1'), legacyMaterials);
  assert.equal(localStorage.getItem('wtrack_material_seed_v1'), 'true');
  localStorage.setItem('wtrack_local_trips', '[{"id":"SJ-TEST"}]');

  localStorage.clear();

  assert.equal(localStorage.getItem('wtrack_local_trips'), null);
  assert.equal(localStorage.getItem('wtrack_local_clients'), legacyClients);
  assert.equal(localStorage.getItem('wtrack_pool_materials_v1'), legacyMaterials);
  assert.equal(values.has('wtrack_sandbox_v1:wtrack_local_clients'), false);

  localStorage.removeItem('wtrack_local_clients');
  assert.equal(localStorage.getItem('wtrack_local_clients'), null);
});
