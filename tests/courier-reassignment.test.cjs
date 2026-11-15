const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of ['kurir.html','public/kurir.html','app/src/main/assets/kurir.html']) {
    test(`${file}: realtime switch removes the old courier despite stale name, plate and stop metadata`, () => {
        const source=fs.readFileSync(file,'utf8');
        const master=[{canonicalId:'old',defaultUid:'uid-old',tokens:['old']},
            {canonicalId:'new',defaultUid:'uid-new',tokens:['new']}];
        let listener;
        const c=vm.createContext({currentCourier:{uid:'uid-old',canonicalId:'old',name:'Old Driver',role:'Driver Mobil'},
            MASTER_COURIERS_LIST:master, COMPANY_FLEET_VEHICLES:[{driverCanonical:'old',plate:'B 1234 OLD'}],
            resolveCourierProfile:(input,id)=>({canonicalId:master.find(p=>p.defaultUid===id || p.canonicalId===input)?.canonicalId || input}),
            tripsUnsubscribe:null, masterShipments:[],console,
            firestoreDb:{collection:()=>({onSnapshot:callback=>{listener=callback;return ()=>{};}})},
            isPoolShipment:()=>false,isDummyAutoSJ:()=>false,isDummyOrDeletedShipment:()=>false,
            hasRealProofPhoto:()=>false,syncLocalImportedTrips(){},renderHomeScreen(){},renderShipmentsScreen(){}
        });
        const a=source.indexOf('    function doesTripBelongToCurrentCourier(');
        const b=source.indexOf('    function getValidCourierShipments(',a);
        vm.runInContext(source.slice(a,b),c);
        const start=source.indexOf('    function syncFirestoreTrips(');
        const end=source.indexOf('    function isRecoveryShipmentToday(',start);
        vm.runInContext(source.slice(start,end),c);
        c.syncFirestoreTrips();
        const trip={courierId:'uid-old',courierName:'Old Driver',vehiclePlate:'B 1234 OLD',vehicleName:'old',
            status:'in_progress',destinations:[{deliveryId:'a',locationName:'Klien A',courierId:'uid-old'}]};
        const cached = JSON.stringify([{...trip, id:'trip'}]);
        c.localStorage={getItem:()=>cached};
        const localStart=source.indexOf('    function syncLocalImportedTrips()');
        const localEnd=source.indexOf('    async function deleteCourierShipment(',localStart);
        vm.runInContext(source.slice(localStart,localEnd),c);
        const emit=()=>listener([{id:'trip',data:()=>trip}]);
        emit(); assert.equal(c.masterShipments.length,1);
        trip.courierId='uid-new';
        emit(); assert.equal(c.masterShipments.length,0);
        c.currentCourier={uid:'uid-new',canonicalId:'new',name:'New Driver',role:'Driver Mobil'};
        emit(); assert.equal(c.masterShipments.length,1);
        assert.equal(c.masterShipments[0].destination,'Klien A');
    });
}
