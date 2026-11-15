const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(trips) {
    const writes = [];
    let sequence = 0;
    const elements = new Map();
    const context = vm.createContext({window: {},
        document: {getElementById: id => elements.get(id), querySelectorAll: () => []},
        firebase: {firestore: {Timestamp: {now: () => 123}}},
        normalizeCourierIdentity: id => ({canonicalId: id}), isTripInActiveBranch: () => true
    });
    vm.runInContext(fs.readFileSync('js/bulk_assignment.js', 'utf8'), context);
    const db = {
        collection: () => ({doc: id => ({id: id || `new-${++sequence}`})}),
        runTransaction: async callback => {
            const staged = [];
            const result = await callback({
                get: async ref => ({exists: !!trips[ref.id], data: () => trips[ref.id]}),
                update: (ref, data) => staged.push({kind: 'update', id: ref.id, data}),
                set: (ref, data) => staged.push({kind: 'set', id: ref.id, data})
            });
            writes.push(...staged);
            return result;
        }
    };
    const row = (id, index) => ({tripId: id, destinationIndex: index,
        deliveryId: trips[id].destinations[index].deliveryId || '',
        sourceCourierId: trips[id].courierId, snapshot: JSON.stringify(trips[id].destinations[index])});
    return {api: context.window.BulkAssignment, db, writes, row, elements};
}

test('partial switch moves only checked stops and retains complete delivery records', async () => {
    const a = {deliveryId: 'a', stopIndex: 1, locationName: 'A', noSJ: 'SJ-A', items: [{qty: 3}], proofPhotoSj: 'photo', status: 'done'};
    const b = {deliveryId: 'b', stopIndex: 2, locationName: 'B', status: 'pending'};
    const c = setup({trip: {courierId: 'old', status: 'in_progress', branchId: 'branch', date: 10, destinations: [a, b]}});
    assert.equal(await c.api.transfer(c.db, [c.row('trip', 0)], 'new', 'mobil', 'alasan'), 1);
    assert.deepEqual(c.writes[0].data.destinations, [b]);
    const created = c.writes[1].data;
    assert.deepEqual(created.destinations, [a]);
    assert.equal(created.courierId, 'new');
    assert.equal(created.branchId, 'branch');
    assert.equal(created.date, 10);
    assert.equal(created.switchedFromTripId, 'trip');
    assert.equal(created.switchedReason, 'alasan');
});

test('all checked stops update original trip and mixed sources transfer together', async () => {
    const trips = {a: {courierId: 'old-a', status: 'completed', destinations: [{stopIndex: 1}, {stopIndex: 2}]},
        b: {courierId: 'old-b', status: 'assigned', destinations: [{stopIndex: 1}]}};
    const c = setup(trips);
    assert.equal(await c.api.transfer(c.db, [c.row('a', 0), c.row('a', 1), c.row('b', 0)], 'new', 'motor', ''), 3);
    assert.equal(c.writes.length, 2);
    assert.ok(c.writes.every(write => write.kind === 'update'));
    assert.equal(c.writes[0].data.status, 'completed');
});

test('fresh server changes abort every write, including other selected trips', async () => {
    const trips = {a: {courierId: 'old', destinations: [{deliveryId: 'a'}]},
        b: {courierId: 'old', destinations: [{deliveryId: 'b'}]}};
    const c = setup(trips);
    const rows = [c.row('a', 0), c.row('b', 0)];
    trips.b.destinations[0].status = 'done';
    await assert.rejects(c.api.transfer(c.db, rows, 'new', 'motor', ''), /berubah/);
    assert.equal(c.writes.length, 0);
    trips.b.destinations[0] = {deliveryId: 'b'};
    trips.b.courierId = 'other';
    await assert.rejects(c.api.transfer(c.db, rows, 'new', 'motor', ''), /berubah/);
    assert.equal(c.writes.length, 0);
});

test('same courier causes no write and duplicate stop numbers remain distinct', async () => {
    const c = setup({trip: {courierId: 'old', destinations: [{stopIndex: 1, locationName: 'A'}, {stopIndex: 1, locationName: 'B'}]}});
    const row = c.row('trip', 1);
    assert.equal(await c.api.transfer(c.db, [row], 'old', 'motor', ''), 0);
    assert.equal(c.writes.length, 0);
    await c.api.transfer(c.db, [row], 'new', 'motor', '');
    assert.equal(c.writes[0].data.destinations[0].locationName, 'A');
    assert.equal(c.writes[1].data.destinations[0].locationName, 'B');
});

test('select all follows visible rows and filtering removes hidden selections', () => {
    const c = setup({});
    const button = {}, all = {};
    c.elements.set('recent-select-all', all);
    c.elements.set('recent-switch-selected', button);
    const rows = [{tripId: 'a', destinationIndex: 0}, {tripId: 'a', destinationIndex: 1}];
    c.api.sync(rows);
    c.api.toggle(c.api.keyOf(rows[0]), true);
    assert.equal(all.indeterminate, true);
    c.api.selectAll(true);
    assert.equal(all.checked, true);
    assert.equal(button.textContent, 'Switch (2)');
    c.api.sync([rows[1]]);
    assert.equal(button.textContent, 'Switch (1)');
    c.api.sync([]);
    assert.equal(button.disabled, true);
    assert.equal(all.disabled, true);
});

for (const file of ['js/app.js', 'public/js/app.js']) {
    test(`${file} renders separate checkboxes for each destination in the online table`, () => {
        const table = {innerHTML: ''};
        const c = vm.createContext({window: {},
            document: {getElementById: id => id === 'recent-shipments-table' ? table : null, querySelectorAll: () => []},
            allCurrentTrips: [{id: 'trip', courierId: 'old', status: 'in_progress', date: new Date(), destinations: [
                {stopIndex: 1, deliveryId: 'a', locationName: 'A'},
                {stopIndex: 1, deliveryId: 'b', locationName: 'B'}
            ]}], recentSortField: 'date', recentSortAsc: true,
            isTripInDateRange: () => true, getCourierDisplayName: () => 'Kurir',
            extractDestinationPhotos: () => ({allUrls: []}), shipmentStatusTime: () => 'On Delivery',
            getRealSJNumber: () => '', getLocalTodayDateString: () => '',
            getCourierVehicleType: () => 'motor', updateGlobalStats() {},
            escapeCourierText: text => String(text).replaceAll('"', '&quot;')
        });
        vm.runInContext(fs.readFileSync('js/bulk_assignment.js', 'utf8'), c);
        c.BulkAssignment = c.window.BulkAssignment;
        const source = fs.readFileSync(file, 'utf8');
        vm.runInContext(source.slice(source.indexOf('function executeRenderRecentShipments('), source.indexOf('function resetRecentFilters(')), c);
        c.executeRenderRecentShipments();
        assert.equal((table.innerHTML.match(/class="form-check-input shipment-select/g) || []).length, 2);
        assert.ok(table.innerHTML.includes('[&quot;trip&quot;,&quot;a&quot;]'));
        assert.ok(table.innerHTML.includes('[&quot;trip&quot;,&quot;b&quot;]'));
        assert.equal((table.innerHTML.match(/<td\b/g) || []).length, 22);
    });
}
