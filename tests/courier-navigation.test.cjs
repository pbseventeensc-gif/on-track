const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../kurir.html'),'utf8');
const context=vm.createContext({});context.window=context;vm.runInContext(fs.readFileSync(require.resolve('../js/maps_destination.js'),'utf8'),context);
vm.runInContext(html.slice(html.indexOf('    function getGoogleMapsNavUrl('),html.indexOf('    function parseWtrackBarcode(')),context);
const destination=row=>new URL(context.getGoogleMapsNavUrl(row)).searchParams.get('destination');
test('Maps searches the delivery store or shipping address and never the customer column',()=>{
 const customer='PT CUSTOMER PENAGIHAN';
 const address='STORE GENKI SUSHI KOTA KASABLANKA, Jalan Casablanca RT.16/RW.5 Menteng Dalam Kec. Tebet Jakarta';
 assert.equal(destination({destination:customer,customer,address}),'GENKI SUSHI KOTA KASABLANKA');
 assert.equal(destination({destination:customer,customer,storeDestination:'Genki Sushi Kota Kasablanka',address:'Jalan Casablanca'}),'Genki Sushi Kota Kasablanka');
 assert.equal(destination({destination:customer,customer,address:'Jalan Casablanca'}),'Jalan Casablanca');
 assert.equal(destination({destination:customer,customer,shippingAddress:'Jalan Casablanca'}),'Jalan Casablanca');
 assert.equal(context.getGoogleMapsNavUrl({destination:customer,customer,address:'Alamat Kirim '+customer}),'');
 assert.equal(context.getGoogleMapsNavUrl({destination:customer,customer}), '');
});
test('courier navigation opens directions to the exact delivery pin and lets Maps use current location',()=>{
 const row={latitude:'-6.177',longitude:'106.786',address:'Alamat lain'};
 const url=new URL(context.getGoogleMapsNavUrl(row));
 assert.equal(url.pathname,'/maps/dir/');assert.equal(destination(row),'-6.177,106.786');assert.equal(url.searchParams.get('api'),'1');assert.equal(url.searchParams.get('dir_action'),'navigate');assert.equal(url.searchParams.has('origin'),false);
});
test('SJ import placeholder and invalid coordinates navigate by actual store address instead',()=>{
 for(const coords of [{latitude:-6.2088,longitude:106.8456},{latitude:100,longitude:200},{latitude:'-6.2bad',longitude:106},{latitude:null,longitude:null}]) {
  assert.equal(destination({...coords,destination:'Toko Uji',address:'Jl. Tanjung Duren #2 & A',region:'Jakarta Barat'}),'Jl. Tanjung Duren #2 & A');
 }
 assert.equal(destination({latitude:-6.1,longitude:106.1,locationNeedsReview:true,address:'Alamat baru'}),'Alamat baru');
 assert.equal(context.getGoogleMapsNavUrl({address:'Alamat Lokasi',destination:'Tujuan Pengantaran'}),'');
 assert.equal(context.getGoogleMapsNavUrl(null),'');
});
test('a multi-destination route never gives a missing pin the coordinates of another stop',()=>{
 const trip={id:'route',courierId:'courier',status:'in_progress',latitude:-6.1,longitude:106.1,destinations:[
  {noSJ:'SJ-A',address:'Alamat A',locationName:'A',latitude:-6.2,longitude:106.2},
  {noSJ:'SJ-B',address:'Alamat B',locationName:'B'}]};
 const c=vm.createContext({firestoreDb:null,masterShipments:[],currentCourier:{role:'Kurir Motor'},localStorage:{getItem:()=>JSON.stringify([trip])},
 isPoolShipment:()=>false,doesTripBelongToCurrentCourier:()=>true,isDummyAutoSJ:()=>false,isDummyOrDeletedShipment:()=>false,hasRealProofPhoto:()=>false,console});
 vm.runInContext(html.slice(html.indexOf('    function syncLocalImportedTrips()'),html.indexOf('    function ',html.indexOf('    function syncLocalImportedTrips()')+20)),c);
 c.syncLocalImportedTrips();assert.equal(c.masterShipments.length,2);assert.equal(c.masterShipments.find(s=>s.noSJ==='#SJ-A').latitude,-6.2);const b=c.masterShipments.find(s=>s.noSJ==='#SJ-B');assert.equal(b.latitude,null);assert.equal(destination(b),'Alamat B');
});
