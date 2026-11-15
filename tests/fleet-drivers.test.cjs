const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
    const storage = new Map();
    const fields = new Map();
    const master = [{canonicalId:'firdaus', defaultUid:'uid-firdaus', displayName:'Firdaus Baru', role:'driver'},
        {canonicalId:'rizki', defaultUid:'uid-rizki', displayName:'Rizki', role:'driver'}];
    const profile = {userId:'uid-new', name:'Driver Baru', role:'driver'};
    const profiles = {'uid-new':profile, 'alias-new':profile,
        'uid-firdaus': {name:'Firdaus Update', role:'driver'},
        'uid-kurir': {name:'Kurir Motor', role:'kurir'}, 'uid-admin': {name:'Admin', role:'admin'}};
    const c = vm.createContext({window:{currentUserRole:'super_admin', MASTER_COURIERS:master},
        registeredUsersObjects: profiles, deletedCourierUids: new Set(),
        normalizeCourierIdentity: id => {
            const found = master.find(p => p.defaultUid === id || p.canonicalId === id);
            return found ? {canonicalId:found.canonicalId, isMaster:true} : {canonicalId:id};
        }, console,
        document:{addEventListener(){}, getElementById:id => {
            if (!fields.has(id)) fields.set(id, {});
            return fields.get(id);
        }}, localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
        bootstrap:{Modal:class {show(){}}}
    });
    vm.runInContext(fs.readFileSync('js/fleet_vehicles.js','utf8'),c);
    return {api:c.window.fleetModule,storage,fields,profiles};
}

test('fleet driver menu uses live names and includes newly registered drivers once', () => {
    const c=setup();
    let drivers=c.api.getFleetDrivers();
    assert.equal(drivers.find(p=>p.id==='firdaus').name,'Firdaus Update');
    assert.equal(drivers.filter(p=>p.id==='uid-new').length,1);
    assert.ok(!drivers.some(p=>/rizki|kurir motor|admin/i.test(p.name)));
    c.profiles['uid-new'].name='Nama Terbaru <Driver>';
    assert.equal(c.api.getFleetDrivers().find(p=>p.id==='uid-new').name,'Nama Terbaru <Driver>');
    c.api.openEditFleetModal('FLT-TRK-004');
    assert.match(c.fields.get('fleet-input-personil').innerHTML,/Nama Terbaru &lt;Driver&gt;/);
});

test('removing Riski clears only his assignment, retaining vehicle and maintenance history', () => {
    const c=setup();
    c.storage.set('wtrack_fleet_vehicles_v6',JSON.stringify([
        {id:'truck',plate_number:'B 9084 SCH',assigned_person_id:'uid-rizki',assigned_person_name:'Riski',
            assigned_role:'driver',assigned_person_phone:'123',service_history:[{date:'2026-11-01'}]},
        {id:'other',assigned_person_id:'alan',assigned_person_name:'Alan',service_history:[]}
    ]));
    const fleet=c.api.getStoredFleet();
    assert.equal(fleet.length,2);
    assert.equal(fleet[0].assigned_person_id,'');
    assert.equal(fleet[0].assigned_person_phone,'');
    assert.equal(fleet[0].plate_number,'B 9084 SCH');
    assert.equal(fleet[0].service_history.length,1);
    assert.equal(fleet[1].assigned_person_id,'alan');
    assert.equal(JSON.parse(c.storage.get('wtrack_fleet_vehicles_v6'))[0].assigned_person_name,'');
});
