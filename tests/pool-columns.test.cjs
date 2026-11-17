const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(initialLocalStorage = {}) {
  const container = { innerHTML: '' };
  const store = new Map(Object.entries(initialLocalStorage));
  const timers = new Map();
  let timerId = 0;

  const window = {
    allPoolTrips: [
      {
        id: 'trip-1',
        noSJ: 'SJ-1126-02309',
        status: 'pool',
        customer: 'PT Klien Utama',
        date: '2026-11-17',
        inputSJDate: '11 Nov 2026 23:22:42',
        originBranch: 'pusat',
        region: 'Jakarta Selatan'
      }
    ],
    allCurrentTrips: [],
    PoolLineItems: {
      renderWeight: () => '1.5 kg',
      renderDetail: () => '',
      itemsOf: () => [{}],
      argument: s => JSON.stringify(s),
      isExpanded: () => false
    }
  };

  const document = {
    getElementById: id => (id === 'view-pool' ? container : null),
    querySelectorAll: () => []
  };

  const localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, val) => store.set(key, String(val))
  };

  const context = vm.createContext({
    window,
    document,
    localStorage,
    console,
    setTimeout: (fn, delay) => {
      timers.set(++timerId, { fn, delay });
      return timerId;
    },
    clearTimeout: id => timers.delete(id)
  });

  vm.runInContext(fs.readFileSync('js/unified_pool_ui.js', 'utf8'), context);
  context.UnifiedPoolUI = window.UnifiedPoolUI;
  return { api: window.UnifiedPoolUI, container, window, store };
}

test('SJ Pool table header displays Import and Input SJ, and omits old Tanggal label', () => {
  const { api, container } = setup();
  api.renderUnifiedPoolView();

  assert.match(container.innerHTML, /<th>Import<\/th>/);
  assert.match(container.innerHTML, /<th>Input SJ<\/th>/);
  assert.doesNotMatch(container.innerHTML, /<th>Tanggal<\/th>/);
});

test('SJ Pool hides Berat and Branch columns by default and provides toggle controls', () => {
  const { api, container, store } = setup();
  api.renderUnifiedPoolView();

  // Berat and Branch headers should NOT be present in table by default
  assert.doesNotMatch(container.innerHTML, /<th[^>]*>Berat<\/th>/);
  assert.doesNotMatch(container.innerHTML, /<th[^>]*>Branch<\/th>/);
  assert.doesNotMatch(container.innerHTML, /class="[^"]*pool-col-weight[^"]*"/);
  assert.doesNotMatch(container.innerHTML, /class="[^"]*pool-col-branch[^"]*"/);

  // Toggle buttons exist
  assert.match(container.innerHTML, /id="btn-pool-toggle-weight"/);
  assert.match(container.innerHTML, /id="btn-pool-toggle-branch"/);

  // Row displays Import and Input SJ values
  assert.match(container.innerHTML, /class="pool-col-import[^"]*"/);
  assert.match(container.innerHTML, /2026-11-17/);
  assert.match(container.innerHTML, /class="pool-col-input-sj[^"]*"/);
  assert.match(container.innerHTML, /11 Nov 2026 23:22:42/);

  // Toggle Berat ON
  api.toggleWeightColumn();
  assert.equal(store.get('wtrack_pool_show_weight'), 'true');
  assert.match(container.innerHTML, /<th[^>]*class="pool-col-weight"[^>]*>Berat<\/th>/);
  assert.match(container.innerHTML, /class="pool-col-weight"/);

  // Toggle Branch ON
  api.toggleBranchColumn();
  assert.equal(store.get('wtrack_pool_show_branch'), 'true');
  assert.match(container.innerHTML, /<th[^>]*class="[^"]*pool-col-branch[^"]*"[^>]*>Branch<\/th>/);
  assert.match(container.innerHTML, /class="[^"]*pool-col-branch[^"]*"/);

  // Toggle Berat OFF again
  api.toggleWeightColumn();
  assert.equal(store.get('wtrack_pool_show_weight'), 'false');
  assert.doesNotMatch(container.innerHTML, /<th[^>]*class="pool-col-weight"[^>]*>Berat<\/th>/);
});

test('SJ Import Engine extracts Input SJ datetime from footer row alongside DITERIMA TGL placeholder', async () => {
  const rows = [
    ['SURAT JALAN SJ-1126-02309'],
    ['Kepada Yth'],
    ['PT WELLEN CLIENT'],
    ['STORE KOTA KASABLANKA'],
    ['No', 'Nama Barang', 'Ukuran', 'Qty'],
    [1, 'Sticker Vinyl', '100x100', 5],
    ['', 'Tgl', '', ':', '11 Nov 2026 23:22:42', '', '', '', '', 'DIBUAT OLEH', '', '', '', 'DIKIRIM OLEH', '', '', 'DITERIMA TGL : ___ / ___ /20__']
  ];

  const data = new Map([['wtrack_local_trips', '[]']]);
  const messages = [];
  const window = {
    WTRACK_LOCAL_SANDBOX: true,
    getDb: () => null,
    showToast: msg => messages.push(msg)
  };
  const localStorage = {
    getItem: k => data.get(k) || null,
    setItem: (k, v) => data.set(k, v)
  };
  const document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => []
  };

  const context = vm.createContext({
    window,
    localStorage,
    document,
    alert: msg => messages.push(msg),
    console,
    XLSX: {
      read: () => ({ SheetNames: ['SJ'], Sheets: { SJ: {} } }),
      utils: { sheet_to_json: () => rows }
    },
    FileReader: class {
      readAsArrayBuffer() {
        this.onload({ target: { result: new ArrayBuffer(0) } });
      }
    }
  });

  vm.runInContext(fs.readFileSync('js/sj_import_engine.js', 'utf8'), context);
  const parsed = await window.SJImportEngine.parseExcelFile({ name: 'SJ-1126-02309_232243.xls' });

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].inputSJDate, '11 Nov 2026 23:22:42');
  assert.equal(parsed[0].sourceDocumentDateTime, '11 Nov 2026 23:22:42');
  assert.equal(parsed[0].sourceDocumentDate, '2026-11-11');

  await window.SJImportEngine.commitImportBatch();
  const savedTrips = JSON.parse(data.get('wtrack_local_trips'));
  assert.equal(savedTrips.length, 1);
  assert.equal(savedTrips[0].inputSJDate, '11 Nov 2026 23:22:42');
  assert.equal(savedTrips[0].destinations[0].inputSJDate, '11 Nov 2026 23:22:42');
});
