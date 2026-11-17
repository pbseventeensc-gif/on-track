const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
    const html = fs.readFileSync('kurir.html', 'utf8');
    let listener;
    const c = vm.createContext({
        currentCourier: {uid: 'uid-old', canonicalId: 'old', name: 'Old Driver', role: 'Driver Mobil'},
        MASTER_COURIERS_LIST: [{canonicalId: 'old', defaultUid: 'uid-old'}],
        COMPANY_FLEET_VEHICLES: [],
        resolveCourierProfile: input => ({canonicalId: input}),
        tripsUnsubscribe: null,
        tripsSubscriptionKey: '',
        masterShipments: [{id: 'existing', noSJ: '#SJ-OLD', status: 'pending', destination: 'Toko Lama'}],
        console,
        localStorage: {getItem: () => null},
        firestoreDb: {collection: () => ({onSnapshot: callback => {listener = callback; return () => {};}})},
        isPoolShipment: () => false,
        isDummyAutoSJ: () => false,
        isDummyOrDeletedShipment: () => false,
        hasRealProofPhoto: () => false,
        syncLocalImportedTrips: function () {},
        renderHomeScreen() {},
        renderShipmentsScreen() {}
    });
    const belongStart = html.indexOf('    function doesTripBelongToCurrentCourier(');
    const belongEnd = html.indexOf('    function getValidCourierShipments(', belongStart);
    vm.runInContext(html.slice(belongStart, belongEnd), c);
    const start = html.indexOf('    function syncFirestoreTrips(');
    const end = html.indexOf('    function isRecoveryShipmentToday(', start);
    vm.runInContext(html.slice(start, end), c);
    c.syncFirestoreTrips();
    return {c, emit: snapshot => listener(snapshot)};
}

const snapshot = (fromCache, docs = []) => ({metadata: {fromCache}, forEach: callback => docs.forEach(callback)});
const doc = (id, data) => ({id, data: () => data});

test('cached empty snapshots do not clear the courier task list', () => {
    const {c, emit} = harness();
    emit(snapshot(true));
    assert.equal(c.masterShipments.length, 1);
    assert.equal(c.masterShipments[0].noSJ, '#SJ-OLD');
});

test('a confirmed server snapshot may still clear the list after transfer', () => {
    const {c, emit} = harness();
    emit(snapshot(true));
    emit(snapshot(false));
    assert.equal(c.masterShipments.length, 0);
});

test('cached first load still shows tasks while waiting for the server', () => {
    const {c, emit} = harness();
    c.masterShipments = [];
    emit(snapshot(true, [doc('trip-1', {
        noSJ: 'SJ-CACHE-1', courierId: 'uid-old', status: 'in_progress', assignedAt: '2026-11-17',
        destinations: [{deliveryId: 'd1', locationName: 'Toko Cache', address: 'Jakarta', status: 'pending'}]
    })]));
    assert.equal(c.masterShipments.length, 1);
    assert.equal(c.masterShipments[0].noSJ, '#SJ-CACHE-1');
});
