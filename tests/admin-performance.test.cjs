const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function engine(rows, options = {}) {
    const data = new Map([['wtrack_local_trips', JSON.stringify(options.stored || [])]]);
    const messages = [];
    const elements = {
        'modal-sj-import-preview': {querySelector: () => null},
        'sj-import-count-badge': {innerText: ''},
        'sj-import-region-breakdown': {innerHTML: ''},
        'sj-import-preview-tbody': {innerHTML: ''},
        'sj-import-page-info': {textContent: ''},
        'sj-import-page-label': {textContent: ''},
        'sj-import-page-size': {value: '100'},
        'sj-import-prev-page': {disabled: false},
        'sj-import-next-page': {disabled: false},
        'check-all-preview-sj': {checked: true, disabled: false, indeterminate: false},
        ...(options.elements || {})
    };
    let lookupCalls = 0;
    const window = {
        WTRACK_LOCAL_SANDBOX: true,
        getDb: () => null,
        showToast: message => messages.push(message),
        getCustomerAdminSJLookup: async () => { lookupCalls++; return new Map(); }
    };
    const localStorage = {
        getItem: key => data.get(key) || null,
        setItem: (key, value) => data.set(key, value)
    };
    const document = {
        getElementById: id => elements[id] || null,
        querySelector: () => null,
        querySelectorAll: () => []
    };
    const context = vm.createContext({
        window, localStorage, document, alert: message => messages.push(message), console,
        XLSX: {
            read: () => ({SheetNames: ['SJ'], Sheets: {SJ: {}}}),
            utils: {sheet_to_json: () => rows}
        },
        FileReader: class { readAsArrayBuffer() { this.onload({target: {result: new ArrayBuffer(0)}}); } }
    });
    vm.runInContext(fs.readFileSync('js/sj_import_engine.js', 'utf8'), context);
    window.SJImportEngine.testState = {window, data, messages, elements, countLookups: () => lookupCalls};
    return window.SJImportEngine;
}

function rows(count, prefix = 'SJ-PAGE') {
    const list = [['No SJ', 'Customer', 'Alamat', 'Nama Barang', 'Qty']];
    for (let i = 1; i <= count; i++) list.push([`${prefix}-${String(i).padStart(4, '0')}`, `Klien ${i}`, 'Jakarta Barat', 'Poster', 1]);
    return list;
}

test('preview renders only one page and can move between pages', async () => {
    const api = engine(rows(250));
    await api.parseExcelFile({name: 'many.xlsx'});
    await api.processMultipleExcelFiles([{name: 'many.xlsx'}]);
    const elements = api.testState.elements;
    assert.equal((elements['sj-import-preview-tbody'].innerHTML.match(/preview-row-checkbox/g) || []).length, 100);
    assert.match(elements['sj-import-page-info'].textContent, /1–100 dari 250 SJ/);
    assert.match(elements['sj-import-page-label'].textContent, /Halaman 1 \/ 3/);

    api.setPreviewPage(2);
    assert.equal((elements['sj-import-preview-tbody'].innerHTML.match(/preview-row-checkbox/g) || []).length, 100);
    assert.match(elements['sj-import-page-label'].textContent, /Halaman 2 \/ 3/);

    api.setPreviewPage(3);
    assert.equal((elements['sj-import-preview-tbody'].innerHTML.match(/preview-row-checkbox/g) || []).length, 50);
    assert.match(elements['sj-import-page-info'].textContent, /201–250 dari 250 SJ/);
});

test('a 250-row upload fetches the customer admin lookup only once', async () => {
    const api = engine(rows(250));
    await api.processMultipleExcelFiles([{name: 'many.xlsx'}]);
    assert.equal(api.testState.countLookups(), 1);
});

test('importing 1200 rows keeps every SJ and every trip id unique', async () => {
    const api = engine(rows(1200, 'SJ-ID'));
    await api.parseExcelFile({name: 'big.xlsx'});
    await api.commitImportBatch();
    const saved = JSON.parse(api.testState.data.get('wtrack_local_trips'));
    assert.equal(saved.length, 1200);
    assert.equal(new Set(saved.map(trip => trip.id)).size, 1200);
    assert.equal(new Set(saved.map(trip => trip.noSJ)).size, 1200);
    assert.equal(api.testState.window.lastSJImportReport?.savedCount, 1200);
});

test('online import checks only candidate SJ numbers and still skips duplicates', async () => {
    const rows = [
        ['No SJ', 'Customer', 'Alamat', 'Nama Barang', 'Qty'],
        ['SJ-ONLINE-1', 'Klien A', 'Jakarta Barat', 'Poster', 1],
        ['SJ-ONLINE-2', 'Klien B', 'Bekasi', 'Poster', 1]
    ];
    const storedTrips = {existing: {noSJ: 'SJ-ONLINE-1'}};
    const savedTrips = new Map();
    const registry = new Set();
    const queried = [];
    const data = new Map([['wtrack_local_trips', '[]']]);
    const messages = [];
    const collection = name => ({
        where(field, op, chunk) {
            queried.push({field, op, chunk: [...chunk]});
            return {
                async get() {
                    return {forEach(callback) {
                        for (const trip of Object.values(storedTrips)) {
                            if (chunk.includes(String(trip.noSJ).trim().toUpperCase())) callback({data: () => trip});
                        }
                    }};
                }
            };
        },
        doc(id) {
            return {id, path: `${name}/${id}`, collection: name};
        },
        async get() { throw new Error('full trips read must not happen'); }
    });
    const db = {
        collection,
        async runTransaction(callback) {
            const tx = {
                async get(ref) {
                    return {exists: ref.collection === 'sj_import_keys' && registry.has(ref.id), data: () => ({})};
                },
                set(ref, value) {
                    if (ref.collection === 'trips') savedTrips.set(ref.id, value);
                    if (ref.collection === 'sj_import_keys') registry.add(ref.id);
                }
            };
            return callback(tx);
        }
    };
    const window = {
        WTRACK_LOCAL_SANDBOX: false,
        getDb: () => db,
        showToast: message => messages.push(message),
        syncAllCurrentTrips: () => {},
        renderRecentShipments: () => {},
        updateGlobalStats: () => {}
    };
    const document = {getElementById: () => null, querySelector: () => null, querySelectorAll: () => []};
    const context = vm.createContext({
        window, document, alert: message => messages.push(message), console,
        localStorage: {getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value)},
        XLSX: {read: () => ({SheetNames: ['SJ'], Sheets: {SJ: {}}}), utils: {sheet_to_json: () => rows}},
        FileReader: class { readAsArrayBuffer() { this.onload({target: {result: new ArrayBuffer(0)}}); } },
        performance: {now: () => 0}
    });
    vm.runInContext(fs.readFileSync('js/sj_import_engine.js', 'utf8'), context);
    const api = window.SJImportEngine;
    await api.parseExcelFile({name: 'online.xlsx'}, new Map());
    await api.commitImportBatch();

    assert.equal(queried.length, 1, 'candidate numbers should be queried in one chunk');
    assert.deepEqual(queried[0].chunk.sort(), ['SJ-ONLINE-1', 'SJ-ONLINE-2']);
    assert.equal(savedTrips.size, 1, 'only the new SJ should be written');
    assert.equal([...savedTrips.values()][0].noSJ, 'SJ-ONLINE-2');
    assert.ok(messages.some(message => /1 SJ duplikat dilewati/.test(message)));
});
