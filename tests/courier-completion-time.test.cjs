const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,'../kurir.html'),'utf8');

test('courier proof card uses the original completion time and Jakarta calendar day', () => {
    const parse = source.slice(source.indexOf('    function parseAnyDateMs('),source.indexOf('    function getShipmentDayDiff('));
    const format = source.slice(source.indexOf('        const completedMs = s ?'), source.indexOf("        const cName = currentCourier.name",source.indexOf('    function shareDeliveryViaWhatsApp(')));
    const iso='2026-11-13T18:30:00Z';
    for (const value of [iso,{seconds:Date.parse(iso)/1000},{_seconds:Date.parse(iso)/1000}]) {
        const c=vm.createContext({s:{completedAt:value},Date,Intl});
        vm.runInContext(parse+format+'\nresult={timeStr,dateStr};',c);
        assert.match(c.result.timeStr,/^01[.:]30 WIB$/);
        assert.match(c.result.dateStr,/14 Nov 2026/);
    }
    for (const value of [null,undefined,'bad']) {
        const c=vm.createContext({s:{completedAt:value},Date,Intl});
        vm.runInContext(parse+format+'\nresult={timeStr,dateStr};',c);
        assert.equal(c.result.timeStr,'Waktu selesai tidak tersedia');
    }
});

test('courier reload keeps each stop completion time and does not substitute assignment or route time', () => {
    const trip={id:'route',date:'2026-11-13',assignedAt:'2026-11-16T01:00:00Z',status:'completed',completedAt:'2026-11-13T10:00:00Z',destinations:[
        {locationName:'A',status:'done',completedTime:{seconds:1794554400}},
        {locationName:'B',status:'done',completedTime:'2026-11-13T09:00:00Z'},
        {locationName:'C',status:'done'}
    ]};
    const c=vm.createContext({tripsUnsubscribe:null,masterShipments:[],currentCourier:{role:'Kurir Motor'},
        isPoolShipment:()=>false,doesTripBelongToCurrentCourier:()=>true,isDummyAutoSJ:()=>false,
        isDummyOrDeletedShipment:()=>false,hasRealProofPhoto:()=>false,syncLocalImportedTrips(){},renderHomeScreen(){},renderShipmentsScreen(){},console,
        firestoreDb:{collection:()=>({onSnapshot(callback){callback([{id:trip.id,data:()=>trip}]);return ()=>{};}})}});
    vm.runInContext(source.slice(source.indexOf('    function syncFirestoreTrips('),source.indexOf('    function syncLocalImportedTrips()')),c);
    c.syncFirestoreTrips();
    assert.equal(c.masterShipments[0].date,trip.assignedAt);
    assert.equal(c.masterShipments[0].completedAt,trip.destinations[0].completedTime);
    assert.equal(c.masterShipments[1].completedAt,trip.destinations[1].completedTime);
    assert.equal(c.masterShipments[2].completedAt,null);
});
