const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of ['js/app.js', 'public/js/app.js', 'app/src/main/assets/js/app.js']) {
    function setup() {
        const source = fs.readFileSync(file, 'utf8');
        const list = {innerHTML: ''}, search = {value: ''};
        let listener;
        const names = {old: 'Kurir Asal', next: 'Driver Penerima'};
        const c = vm.createContext({window: {}, console, allCurrentTrips: [], registeredUsers: names,
            document: {getElementById: id => id === 'monitor-list' ? list : id === 'monitor-search' ? search : null},
            getDb: () => ({collection: () => ({onSnapshot: callback => {listener = callback;}})}),
            updateGlobalStats() {}, renderRecentShipments() {},
            isMonitorTripToday: trip => trip.date === '2026-11-14',
            getCourierDisplayName: id => names[id] || '', isRecognizedCourier: () => true,
            normalizeCourierIdentity: id => ({canonicalId: id, displayName: names[id]}),
            getPersonilCategory: id => id === 'next' ? 'driver' : 'kurir',
            isCourierOnline: () => true, getCourierColor: () => '#123456', getBulkSjUrls: () => [],
            hasRealProofPhoto: stop => !!stop.proofPhotoUrl
        });
        const renderStart = source.indexOf('function renderMonitorUI(');
        const renderEnd = source.indexOf('async function uploadBulkSjFromCard(', renderStart);
        vm.runInContext(source.slice(renderStart, renderEnd), c);
        const snapshotStart = source.indexOf('function initTripsSnapshot(');
        const snapshotEnd = source.indexOf('\ninitTripsSnapshot();', snapshotStart);
        vm.runInContext(source.slice(snapshotStart, snapshotEnd), c);
        c.initTripsSnapshot();
        const emit = trips => listener(trips.map(trip => ({id: trip.id, data: () => structuredClone(trip)})));
        return {list, search, emit};
    }

    test(`${file}: Firestore reassignment moves the entire Live Tracking card without a GPS event`, () => {
        const c = setup();
        const trip = {id: 'trip', date: '2026-11-14', courierId: 'old', status: 'in_progress',
            courierName: 'Kurir Asal', destinations: [{locationName: 'Toko A', status: 'pending'}]};
        c.emit([trip]);
        assert.match(c.list.innerHTML, /title="Kurir Asal"/);
        assert.doesNotMatch(c.list.innerHTML, /title="Driver Penerima"/);
        trip.courierId = 'next';
        c.emit([trip]);
        assert.doesNotMatch(c.list.innerHTML, /title="Kurir Asal"/);
        assert.match(c.list.innerHTML, /title="Driver Penerima"/);
        assert.match(c.list.innerHTML, /0\/1 Stops/);
        assert.match(c.list.innerHTML, /Driver Mobil \(1\)/);
        assert.match(c.list.innerHTML, /1 Tugas/);
    });

    test(`${file}: partial switch updates both cards, task counts and progress`, () => {
        const c = setup();
        const done = {locationName: 'Toko Selesai', status: 'done', proofPhotoUrl: 'photo'};
        const pending = {locationName: 'Toko Pindah', status: 'pending_approval', pendingReason: 'Tutup'};
        const source = {id: 'source', date: '2026-11-14', courierId: 'old', status: 'in_progress', destinations: [done, pending]};
        const existing = {id: 'existing', date: '2026-11-14', courierId: 'next', status: 'in_progress', destinations: [{locationName: 'Toko B'}]};
        c.emit([source, existing]);
        assert.match(c.list.innerHTML, /1\/2 Stops/);
        source.destinations = [done];
        c.emit([source, existing, {...source, id: 'split', courierId: 'next', destinations: [pending]}]);
        const oldCard = c.list.innerHTML.split('title="Kurir Asal"')[1].split('FOCUS TRACKING')[0];
        const nextCard = c.list.innerHTML.split('title="Driver Penerima"')[1].split('FOCUS TRACKING')[0];
        assert.match(oldCard, /1\/1 Stops/);
        assert.match(oldCard, /1 Tugas/);
        assert.doesNotMatch(oldCard, /1 Pending/);
        assert.match(nextCard, /0\/2 Stops/);
        assert.match(nextCard, /2 Tugas/);
        assert.match(nextCard, /1 Pending/);
        // A selected search must survive updates from other admin devices.
        c.search.value = 'Driver Penerima';
        c.emit([source, existing]);
        assert.doesNotMatch(c.list.innerHTML, /title="Kurir Asal"/);
        assert.match(c.list.innerHTML, /title="Driver Penerima"/);
    });

    test(`${file}: retired Rizki is absent from master options and automatic alias generation`, () => {
        const source = fs.readFileSync(file, 'utf8');
        const c = vm.createContext({window: {}});
        const start = source.indexOf('const MASTER_COURIERS = [');
        const end = source.indexOf('window.MASTER_COURIERS = MASTER_COURIERS;', start);
        vm.runInContext(source.slice(start, end) + '\nwindow.master = MASTER_COURIERS;', c);
        assert.ok(!c.window.master.some(courier => courier.canonicalId === 'rizki'));
        assert.ok(!source.includes("registeredUsers['rizki'] ="));
        assert.ok(!source.includes('Truk Box B 9084 SCH (Rizki)'));
        const displayStart = source.indexOf('function getCourierDisplayName(');
        const displayEnd = source.indexOf('\nfunction isCourierUser(', displayStart);
        vm.runInContext(source.slice(displayStart, displayEnd), c);
        assert.equal(c.getCourierDisplayName('gz9F6MqupoXEFTpOTJJ1aFjtSD52'), 'Rizki (Nonaktif)');
    });
}
