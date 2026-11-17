const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
    const storage = new Map();
    const fields = new Map();
    const field = id => {
        if (!fields.has(id)) fields.set(id, {
            value: '', style: {}, innerHTML: '', attributes: {},
            setAttribute(key, value) { this.attributes[key] = value; },
            removeAttribute(key) { delete this.attributes[key]; }
        });
        return fields.get(id);
    };
    const cards = ['total', 'granmax', 'truckbox', 'pickupl300', 'attention'].map(key => ({
        ...field(`card-${key}`), dataset: {fleetCard: key}
    }));
    field('view-fleet-inventory').querySelectorAll = () => cards;
    field('fleet-filter-type').value = 'all';
    field('fleet-filter-status').value = 'all';
    field('fleet-filter-type').options = ['all', 'granmax', 'truck_box', 'pickup_l300', 'pickup', 'l300'].map(value => ({value}));
    const safe = {tax_due_date: '2099-01-01', service_due_date: '2099-01-01', service_details: 'Rencana berikutnya', service_history: []};
    const original = {id: 'record-1', date: '2026-10-01', odometer: '1.000 km', workshop: 'Bengkel A',
        replaced_items: 'Oli Mesin', notes: 'Catatan lama', created_at: 1234, custom: 'retained'};
    storage.set('wtrack_fleet_vehicles_v6', JSON.stringify([
        {...safe, id: 'g', plate_number: 'B GRANMAX', vehicle_category: 'granmax', service_history: [original]},
        {...safe, id: 't', plate_number: 'B TRUCK', vehicle_category: 'truck_box', tax_due_date: '2000-01-01'},
        {...safe, id: 'p', plate_number: 'B PICKUP', vehicle_category: 'pickup'},
        {...safe, id: 'l', plate_number: 'B L300', vehicle_category: 'l300'}
    ]));
    const alerts = [];
    const context = vm.createContext({window: {currentUserRole: 'super_admin'}, console: {log(){}, warn(){}},
        document: {getElementById: field, addEventListener(){}},
        localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
        bootstrap: {Modal: {getOrCreateInstance: () => ({show(){}})}}, alert: text => alerts.push(text)
    });
    vm.runInContext(fs.readFileSync('js/fleet_vehicles.js', 'utf8'), context);
    return {api: context.window.fleetModule, field, cards, storage, alerts, original};
}

test('summary cards filter the current inventory, clear prior search and show live counts', () => {
    const {api, field, cards, storage} = setup();
    field('fleet-search-input').value = 'unmatched search';
    api.filterFleetByCard('pickupl300');
    const rows = () => field('fleet-table-body').innerHTML;
    assert.match(rows(), /B PICKUP/);
    assert.match(rows(), /B L300/);
    assert.doesNotMatch(rows(), /B GRANMAX|B TRUCK/);
    assert.equal(field('fleet-search-input').value, '');
    assert.equal(cards.find(c => c.dataset.fleetCard === 'pickupl300').attributes['aria-pressed'], 'true');
    api.filterFleetByCard('granmax');
    assert.match(rows(), /B GRANMAX/);
    assert.doesNotMatch(rows(), /B TRUCK|B PICKUP|B L300/);
    api.filterFleetByCard('truckbox');
    assert.match(rows(), /B TRUCK/);
    assert.doesNotMatch(rows(), /B GRANMAX|B PICKUP|B L300/);
    api.filterFleetByCard('attention');
    assert.match(rows(), /B TRUCK/);
    assert.doesNotMatch(rows(), /B GRANMAX|B PICKUP|B L300/);
    api.filterFleetByCard('total');
    for (const plate of ['B GRANMAX', 'B TRUCK', 'B PICKUP', 'B L300']) assert.ok(rows().includes(plate));
    const fleet = api.getStoredFleet();
    fleet.push({...fleet[0], id: 'g2', plate_number: 'B NEW'});
    storage.set('wtrack_fleet_vehicles_v6', JSON.stringify(fleet));
    api.renderFleetInventoryView();
    assert.equal(field('fleet-stat-total').innerText, 5);
    assert.equal(field('fleet-stat-total-units').innerText, '5 Unit');
    assert.equal(field('fleet-stat-granmax').innerText, 2);
    assert.equal(field('fleet-filter-type').options.find(o => o.value === 'granmax').textContent, 'Granmax (2 Unit)');
});

test('editing a service record preloads values and updates in place without changing next schedule', () => {
    const {api, field, original, alerts} = setup();
    api.openEditServiceRecordModal('g', original.id);
    assert.equal(field('add-srv-date').value, original.date);
    assert.equal(field('add-srv-km').value, original.odometer);
    assert.equal(field('add-srv-workshop').value, original.workshop);
    assert.equal(field('add-srv-items').value, original.replaced_items);
    assert.equal(field('add-srv-notes').value, original.notes);
    assert.equal(field('add-srv-update-next').checked, false);
    assert.equal(field('hist-btn-right-label').innerText, 'Simpan Perubahan Servis');
    field('add-srv-date').value = '2026-10-02';
    field('add-srv-km').value = '2.000 km';
    field('add-srv-workshop').value = 'Bengkel B';
    field('add-srv-items').value = 'Filter Oli';
    field('add-srv-notes').value = 'Diperbaiki';
    api.saveServiceRecord();
    const vehicle = api.getStoredFleet().find(v => v.id === 'g');
    assert.equal(vehicle.service_history.length, 1);
    const record = vehicle.service_history[0];
    assert.equal(record.id, original.id);
    assert.equal(record.created_at, original.created_at);
    assert.equal(record.custom, 'retained');
    assert.equal(record.date, '2026-10-02');
    assert.equal(record.odometer, '2.000 km');
    assert.equal(record.workshop, 'Bengkel B');
    assert.equal(record.replaced_items, 'Filter Oli');
    assert.equal(record.notes, 'Diperbaiki');
    assert.ok(record.updated_at);
    assert.equal(vehicle.service_due_date, '2099-01-01');
    assert.equal(vehicle.service_details, 'Rencana berikutnya');
    assert.equal(alerts.length, 0);
    assert.match(field('step-panel-1-list').innerHTML, /openEditServiceRecordModal/);
});

test('cancelling edit resets the form, and adding a new log still updates the next schedule', () => {
    const {api, field, original} = setup();
    api.openEditServiceRecordModal('g', original.id);
    api.handleServiceModalLeftAction();
    api.handleServiceModalRightAction();
    assert.equal(field('hist-btn-right-label').innerText, 'Simpan Riwayat Servis');
    assert.equal(field('add-srv-items').value, '');
    assert.equal(field('add-srv-update-next').checked, true);
    field('add-srv-items').value = 'Log baru';
    field('add-srv-next-date').value = '2027-02-01';
    field('add-srv-next-plan').value = 'Rencana baru';
    api.saveServiceRecord();
    const vehicle = api.getStoredFleet().find(v => v.id === 'g');
    assert.equal(vehicle.service_history.length, 2);
    assert.equal(vehicle.service_history[0].replaced_items, 'Log baru');
    assert.equal(vehicle.service_history[1].id, original.id);
    assert.equal(vehicle.service_due_date, '2027-02-01');
    assert.equal(vehicle.service_details, 'Rencana baru');
});

test('invalid edits are rejected without creating an extra record', () => {
    const {api, field, original, alerts} = setup();
    api.openEditServiceRecordModal('g', original.id);
    field('add-srv-items').value = '';
    api.saveServiceRecord();
    assert.equal(alerts.length, 1);
    assert.equal(api.getStoredFleet()[0].service_history.length, 1);
    assert.equal(api.getStoredFleet()[0].service_history[0].replaced_items, original.replaced_items);
});
