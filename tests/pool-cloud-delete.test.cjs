const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadPool(db) {
    const deleted = [];
    const commits = [];
    const mockDb = db || {
        collection(name) {
            return {doc(id) { return {path: `${name}/${id}`}; }};
        },
        batch() {
            const refs = [];
            return {
                delete(ref) { refs.push(ref.path); },
                async commit() { commits.push([...refs]); deleted.push(...refs); }
            };
        }
    };
    const window = {
        SJLinks: require('../js/sj_links.js'),
        WTRACK_LOCAL_SANDBOX: false,
        getDb: () => mockDb,
        addEventListener() {},
        setInterval() {},
        sessionStorage: {getItem: () => null, setItem() {}}
    };
    const context = vm.createContext({
        window,
        document: {addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }},
        localStorage: {getItem: () => null, setItem() {}},
        console
    });
    vm.runInContext(fs.readFileSync('js/unified_pool_ui.js', 'utf8'), context);
    return {api: window.UnifiedPoolUI, deleted, commits};
}

test('cloud delete removes both the trip document and its import key', async () => {
    const {api, deleted} = loadPool();
    const count = await api.deleteTripsFromCloud([
        {id: 'SJ-1001', tripId: 'TRIP_1001', noSJ: 'SJ-1001'},
        {id: 'SJ-1002', tripId: 'TRIP_1002', noSJ: ' sj-1002 '}
    ]);
    assert.equal(count, 2);
    assert.deepEqual(deleted.sort(), [
        'sj_import_keys/SJ-1001', 'sj_import_keys/SJ-1002',
        'trips/TRIP_1001', 'trips/TRIP_1002'
    ]);
});

test('deleting a manual trip clears every SJ key without duplicating the primary key', async () => {
    const {api, deleted} = loadPool();
    await api.deleteTripsFromCloud([{id:'manual',destinations:[{noSJ:'SJ-1',sjLinks:[{noSJ:'SJ-1'},{noSJ:'SJ-2'},{noSJ:'SJ-3'}]}]}]);
    assert.deepEqual(deleted.sort(), ['sj_import_keys/SJ-1','sj_import_keys/SJ-2','sj_import_keys/SJ-3','trips/manual']);
});

test('cloud delete chunks large selections below the Firestore batch limit', async () => {
    const {api, commits} = loadPool();
    const trips = Array.from({length: 201}, (_, index) => ({id: `SJ-${index}`, tripId: `TRIP_${index}`, noSJ: `SJ-${index}`}));
    await api.deleteTripsFromCloud(trips);
    assert.equal(commits.length, 2);
    assert.equal(commits[0].length, 400);
    assert.equal(commits[1].length, 2);
});

test('cloud delete also respects the write limit when each trip has several SJ', async () => {
    const {api, commits, deleted} = loadPool();
    const trips = Array.from({length:200}, (_, index) => ({id:`manual-${index}`,destinations:[{
        noSJ:`SJ-${index}-1`,sjLinks:[1,2,3].map(suffix=>({noSJ:`SJ-${index}-${suffix}`}))
    }]}));
    await api.deleteTripsFromCloud(trips);
    assert.equal(deleted.length,800);
    assert.ok(commits.every(refs=>refs.length<=450));
});
