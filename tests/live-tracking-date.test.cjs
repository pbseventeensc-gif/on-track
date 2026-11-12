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
