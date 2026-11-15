const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');

function setup() {
    const now = new Date('2026-11-12T08:00:00+07:00');
    const context = vm.createContext({Intl, Date, now});
    const start = source.indexOf('function monitorDayKey(');
    const end = source.indexOf('// Remove yesterday',start);
    vm.runInContext(source.slice(start,end),context);
    return context;
}

test('tracking uses assignment date in Jakarta, excluding yesterday even with fresh activity', () => {
    const c = setup();
    for (const date of ['2026-11-12','12/11/2026','2026-11-11T17:00:00Z',
        {seconds: Date.parse('2026-11-12T08:00:00+07:00') / 1000},
        {_seconds: Date.parse('2026-11-12T08:00:00+07:00') / 1000},
        {toDate: () => new Date('2026-11-12T08:00:00+07:00')}]) {
        assert.equal(c.isMonitorTripToday({date},c.now),true);
    }
    for (const date of ['2026-11-11','2026-11-13','2026-11-11T16:59:59Z']) {
        assert.equal(c.isMonitorTripToday({date, assignedAt: c.now, updatedAt:c.now, destinations:[{arrivalTime:c.now}]},c.now),false);
    }
    assert.equal(c.isMonitorTripToday({assignedAt:c.now},c.now),true);
    assert.equal(c.isMonitorTripToday({dateFolder:'2026-11-12'},c.now),true);
    assert.equal(c.isMonitorTripToday({updatedAt:c.now},c.now),false);
    assert.equal(c.isMonitorTripToday({},c.now),false);
    assert.equal(c.isMonitorTripToday({date:'2026-11-12'},new Date('2026-11-12T17:00:00Z')),false);
});

test('cards group only today trips; online-only couriers and old trips never enter card counts', () => {
    const c = setup();
    c.window = c;
    const today = c.isMonitorTripToday;
    c.isMonitorTripToday = trip => today(trip,c.now);
    c.document = {getElementById: () => ({innerHTML:''})};
    c.registeredUsers = {driver:'Driver', online:'Online'};
    c.currentOnlineCouriers = {driver:{},online:{}};
    c.isCourierOnline = () => true;
    c.hasRealProofPhoto = () => false;
    c.allCurrentTrips = [
        {id:'old',courierId:'driver',date:'2026-11-11',status:'in_progress',destinations:[{locationName:'Old'}]},
        {id:'today',courierId:'driver',date:'2026-11-12',status:'in_progress',destinations:[{locationName:'Today'}]},
        {id:'tomorrow',courierId:'driver',date:'2026-11-13',destinations:[]},
        {id:'pool',courierId:'driver',date:'2026-11-12',status:'pool',destinations:[]}
    ];
    const start = source.indexOf('function renderMonitorUI(');
    const end = source.indexOf('    const courierIds = Object.keys(courierGroups);',start);
    vm.runInContext(source.slice(start,end) + 'return courierGroups;\n}',c);
    const groups = c.renderMonitorUI();
    assert.deepEqual(Object.keys(groups),['driver']);
    assert.equal(groups.driver.totalStops,1);
    assert.equal(groups.driver.trips[0].id,'today');
    c.allCurrentTrips = c.allCurrentTrips.filter(trip => trip.id !== 'today');
    assert.equal(Object.keys(c.renderMonitorUI()).length,0);
});

test('cards synchronize destination stops for carry-over multi-day trips active today', () => {
    const c = setup();
    c.window = c;
    const today = c.isMonitorTripToday;
    c.isMonitorTripToday = trip => today(trip, c.now);
    c.document = {getElementById: () => ({innerHTML: ''})};
    c.registeredUsers = {c1: 'Kurir 1', c2: 'Driver 2', c3: 'Kurir 3'};
    c.isCourierOnline = () => true;
    c.isRecognizedCourier = () => true;
    c.hasRealProofPhoto = () => false;

    // Helper functions from app.js
    const rangeStart = source.indexOf('function isTripInDateRange(');
    const rangeEnd = source.indexOf('window.isTripInDateRange =', rangeStart);
    vm.runInContext(source.slice(rangeStart, rangeEnd), c);

    const tsStart = source.indexOf('function parseCompletionTimestamp(');
    const tsEnd = source.indexOf('function destinationCompletionMs(', tsStart);
    vm.runInContext(source.slice(tsStart, tsEnd), c);

    c.allCurrentTrips = [
        // Trip 1: Carry-over from yesterday with 1 yesterday stop, 1 today stop, 1 pending stop
        {
            id: 'trip1',
            courierId: 'c1',
            date: '2026-11-11T10:00:00+07:00',
            status: 'in_progress',
            destinations: [
                { locationName: 'Kemarin Selesai', status: 'done', completedTime: '2026-11-11T12:00:00+07:00' },
                { locationName: 'Hari Ini Selesai', status: 'done', completedTime: '2026-11-12T09:00:00+07:00' },
                { locationName: 'Hari Ini Pending', status: 'pending' }
            ]
        },
        // Trip 2: Assigned today with 2 stops done today
        {
            id: 'trip2',
            courierId: 'c2',
            date: '2026-11-12T08:00:00+07:00',
            status: 'completed',
            destinations: [
                { locationName: 'Toko A', status: 'done', completedTime: '2026-11-12T10:00:00+07:00' },
                { locationName: 'Toko B', status: 'done', completedTime: '2026-11-12T11:00:00+07:00' }
            ]
        },
        // Trip 3: Completed yesterday, no today activity
        {
            id: 'trip3',
            courierId: 'c3',
            date: '2026-11-11T08:00:00+07:00',
            status: 'completed',
            destinations: [
                { locationName: 'Kemarin Toko C', status: 'done', completedTime: '2026-11-11T14:00:00+07:00' }
            ]
        }
    ];

    const start = source.indexOf('function renderMonitorUI(');
    const end = source.indexOf('    const courierIds = Object.keys(courierGroups);', start);
    vm.runInContext(source.slice(start, end) + 'return courierGroups;\n}', c);

    const groups = c.renderMonitorUI();
    // c3 must not appear
    assert.deepEqual(Object.keys(groups).sort(), ['c1', 'c2']);
    // c1 has only today stops (1 done + 1 pending = 2 stops)
    assert.equal(groups.c1.totalStops, 2);
    assert.equal(groups.c1.doneStops, 1);
    assert.equal(groups.c1.pendingStops, 1);
    // c2 has 2 stops (2 done)
    assert.equal(groups.c2.totalStops, 2);
    assert.equal(groups.c2.doneStops, 2);
    assert.equal(groups.c2.pendingStops, 0);
});

test('Live Tracking cards synchronize exactly with Sunday reconcile dataset (30 Total / 28 Done)', () => {
    const sundayFile = require('node:path').join(__dirname, '../.artifacts/sunday-reconcile/trips.json');
    if (!fs.existsSync(sundayFile)) return;
    const trips = JSON.parse(fs.readFileSync(sundayFile, 'utf8'));

    const now = new Date('2026-11-15T15:30:00+07:00');
    const c = vm.createContext({Intl, Date, now});
    c.window = c;
    const keyStart = source.indexOf('function monitorDayKey(');
    const keyEnd = source.indexOf('// Remove yesterday', keyStart);
    vm.runInContext(source.slice(keyStart, keyEnd), c);

    const rangeStart = source.indexOf('function isTripInDateRange(');
    const rangeEnd = source.indexOf('window.isTripInDateRange =', rangeStart);
    vm.runInContext(source.slice(rangeStart, rangeEnd), c);

    const tsStart = source.indexOf('function parseCompletionTimestamp(');
    const tsEnd = source.indexOf('function destinationCompletionMs(', tsStart);
    vm.runInContext(source.slice(tsStart, tsEnd), c);

    c.document = {getElementById: () => ({innerHTML: ''})};
    c.registeredUsers = {
        juHUuOWS4FOVpHxE59t4xf0ld1z1: 'Husen',
        oC2EvdhruFMaKC10jmMUyYbmdtp1: 'Romi',
        KgKbQdpUHmcQzu2o8N6czx0N7EP2: 'Firdaus'
    };
    c.isCourierOnline = () => true;
    c.hasRealProofPhoto = () => false;
    c.allCurrentTrips = trips;

    const start = source.indexOf('function renderMonitorUI(');
    const end = source.indexOf('    const courierIds = Object.keys(courierGroups);', start);
    vm.runInContext(source.slice(start, end) + 'return courierGroups;\n}', c);

    const groups = c.renderMonitorUI();
    const couriers = Object.keys(groups);
    assert.equal(couriers.length, 3);

    let totalStops = 0, doneStops = 0, pendingStops = 0;
    for (const key of couriers) {
        totalStops += groups[key].totalStops;
        doneStops += groups[key].doneStops;
        pendingStops += groups[key].pendingStops;
    }

    assert.equal(totalStops, 30);
    assert.equal(doneStops, 28);
    assert.equal(pendingStops, 2);
    const husenGroup = Object.values(groups).find(g => g.name.toLowerCase().includes('husen'));
    const romiGroup = Object.values(groups).find(g => g.name.toLowerCase().includes('romi'));
    const firdausGroup = Object.values(groups).find(g => g.name.toLowerCase().includes('firdaus'));
    assert.equal(husenGroup.totalStops, 19);
    assert.equal(husenGroup.doneStops, 18);
    assert.equal(romiGroup.totalStops, 2);
    assert.equal(romiGroup.doneStops, 1);
    assert.equal(firdausGroup.totalStops, 9);
    assert.equal(firdausGroup.doneStops, 9);
});
