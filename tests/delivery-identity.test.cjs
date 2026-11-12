const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const identity = require('../js/delivery_identity.js');
const courierSource = fs.readFileSync(path.join(__dirname,'../kurir.html'),'utf8');
const adminSource = fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');

test('add another client reuses the address and coordinates but creates an independent delivery', () => {
    const source = {name:'Klien A',address:'Gedung X',lat:-6.2,lng:106.8,deliveryId:identity.newId()};
    const context = vm.createContext({tripQueue:[source],prompt:()=> 'Klien B',DeliveryIdentity:identity,renderQueue(){}});
    const start = adminSource.indexOf('function addClientAtSameAddress(');
    const end = adminSource.indexOf('\nwindow.addClientAtSameAddress',start);
    vm.runInContext(adminSource.slice(start,end),context);
    context.addClientAtSameAddress(0);
    const added = context.tripQueue[1];
    assert.equal(added.name,'Klien B');
    assert.equal(added.address,source.address);
    assert.equal(added.lat,source.lat);
    assert.equal(added.lng,source.lng);
    assert.notEqual(added.deliveryId,source.deliveryId);
    assert.equal(source.name,'Klien A');
});

test('legacy identical stop numbers cannot mix different clients; stable IDs survive reordering', () => {
    const destinations = [
        {deliveryId:'a',stopIndex:1,locationName:'Klien A',address:'Gedung X'},
        {deliveryId:'b',stopIndex:1,locationName:'Klien B',address:'Gedung X'}
    ];
    assert.equal(identity.destinationIndex(destinations,{deliveryId:'b'}),1);
    assert.equal(identity.destinationIndex([...destinations].reverse(),{deliveryId:'b',destinationIndex:1}),0);
    assert.equal(identity.destinationIndex(destinations,{stopIndex:1,destination:'Klien B'}),1);
    assert.equal(identity.destinationIndex(destinations,{stopIndex:1}),-1);
    assert.equal(identity.destinationIndex(destinations,{deliveryId:'missing',stopIndex:1}),-1);
});

test('saving proof for client B leaves client A status and photos unchanged', () => {
    const destinations = [
        {deliveryId:'a',locationName:'Klien A',address:'Gedung X',status:'pending',proofPhotoUrl:'photo-a'},
        {deliveryId:'b',locationName:'Klien B',address:'Gedung X',status:'pending'}
    ];
    const context = vm.createContext({dests:destinations,target:{deliveryId:'b'},DeliveryIdentity:identity,
        savedBarangPhoto:'photo-b',savedSJPhoto:'sj-b',delivery:{sjNumber:'SJ-B'},firebase:{firestore:{Timestamp:{now:()=>123}}}});
    const start = courierSource.indexOf('                    let allDone = true;',courierSource.indexOf('async function submitParcelProof'));
    const end = courierSource.indexOf('                    const updatePayload =',start);
    vm.runInContext(courierSource.slice(start,end)+'\nresult = updatedDests;',context);
    assert.equal(context.result[0],destinations[0]);
    assert.equal(context.result[0].proofPhotoUrl,'photo-a');
    assert.equal(context.result[0].status,'pending');
    assert.equal(context.result[1].status,'done');
    assert.equal(context.result[1].proofPhotoUrl,'photo-b');
    assert.equal(context.result[1].sjNumber,'SJ-B');
    assert.equal(context.result[0].sjNumber,undefined);
});

test('courier list keeps same-address clients and repeated SJ across different trips separate', () => {
    const trip = {id:'route-a',noSJ:'SJ-1126-12345',status:'in_progress',destinations:[
        {stopIndex:1,deliveryId:'a',locationName:'Klien A',address:'Gedung X',status:'done',proofPhotoUrl:'photo-a'},
        {stopIndex:1,deliveryId:'b',locationName:'Klien B',address:'Gedung X',status:'pending'}
    ]};
    const trip2 = {...trip,id:'route-b',destinations:[{...trip.destinations[1]}]};
    const context = vm.createContext({tripsUnsubscribe:null,masterShipments:[],
        currentCourier:{role:'Kurir Motor'},isPoolShipment:()=>false,doesTripBelongToCurrentCourier:()=>true,
        isDummyAutoSJ:()=>false,isDummyOrDeletedShipment:()=>false,hasRealProofPhoto:d=>Boolean(d.proofPhotoUrl),
        syncLocalImportedTrips(){},renderHomeScreen(){},renderShipmentsScreen(){},console,
        firestoreDb:{collection:()=>({onSnapshot(callback){callback([{id:trip.id,data:()=>trip},{id:trip2.id,data:()=>trip2}]);return ()=>{};}})}
    });
    const start = courierSource.indexOf('    function syncFirestoreTrips()');
    const end = courierSource.indexOf('    function syncLocalImportedTrips()',start);
    vm.runInContext(courierSource.slice(start,end),context);
    context.syncFirestoreTrips();
    assert.equal(context.masterShipments.length,3);
    assert.equal(context.masterShipments[0].status,'delivered');
    assert.notEqual(context.masterShipments[1].status,'delivered');
    assert.equal(context.masterShipments[1].proofPhotoUrl,'');
    assert.equal(context.masterShipments[1].deliveryId,'b');
});
