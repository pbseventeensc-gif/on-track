const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function load(){const c=vm.createContext({});c.window=c;vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/maps_destination.js'),'utf8'),c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/vendor/qrcode.js'),'utf8'),c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/qr_print_dispatch.js'),'utf8'),c);return c;}
test('legacy compact SJ still renders offline with four-module quiet zone',()=>{
 const c=load(),api=c.qrPrintDispatch;
 const payload=api.compactPayload({noSJ:'#SJ-1126-02302',qrPayload:'WTRACK|SJ|very-long-route-id|SJ-1126-02302|LONGCODE'});
 assert.equal(payload,'SJ-1126-02302');
 const svg=api.renderQRCodeSvg(payload);
 assert.match(svg,/data-modules="21"/);assert.match(svg,/viewBox="0 0 29 29"/);assert.match(svg,/fill="#000"/);assert.match(svg,/fill="#fff"/);
 assert.doesNotMatch(svg,/<img|(?:src|href)="https?:/);assert.match(svg,/width="128"/);
 assert.equal(api.compactPayload({id:'TRIP_123'}),'TRIP_123');assert.throws(()=>api.renderQRCodeSvg(''),/tidak tersedia/);
});
test('courier scanner accepts plain SJ and existing legacy codes',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../kurir.html'),'utf8');const c=vm.createContext({});
 vm.runInContext(html.slice(html.indexOf('    function parseWtrackBarcode('),html.indexOf('    async function onBarcodeDetectedSuccess(')),c);
 assert.equal(c.parseWtrackBarcode('SJ-1126-02302').sjNumber,'SJ-1126-02302');
 assert.equal(c.parseWtrackBarcode('SJ/1126/02302').sjNumber,'SJ/1126/02302');
 const legacy=c.parseWtrackBarcode('WTRACK|SJ|TRIP_123|SJ-1126-02302|123456');assert.equal(legacy.tripId,'TRIP_123');assert.equal(legacy.sjNumber,'SJ-1126-02302');assert.equal(legacy.shortCode,'123456');
});


test('Maps QR uses the destination address, encodes punctuation and ignores imported placeholder coordinates',()=>{
 const api=load().qrPrintDispatch;
 const address='Jl. Tanjung Duren No. 10, Jakarta Barat & Blok #2';
 const url=api.mapsPayload({address:'Alamat root lama',destinations:[{address,latitude:-6.2088,longitude:106.8456}]});
 const parsed=new URL(url);assert.equal(parsed.origin,'https://maps.google.com');assert.equal(parsed.pathname,'/');assert.equal(parsed.searchParams.get('q'),address);
 assert.equal(new URL(api.mapsPayload({address})).searchParams.get('q'),address);
 assert.equal(api.mapsPayload({customer:'Customer',destinations:[{address:'-',latitude:-6.2088,longitude:106.8456}]}),'');
});
test('Maps QR uses only the store from a shipping label, keeping the customer out of the query',()=>{
 const api=load().qrPrintDispatch;
 const trip={noSJ:'SJ-1126-02302',customer:'PT CUSTOMER PENAGIHAN',clientName:'PT CUSTOMER PENAGIHAN',
  destinations:[{locationName:'PT CUSTOMER PENAGIHAN',address:'STORE GENKI SUSHI KOTA KASABLANKA, Jalan Casablanca RT.16/RW.5 Menteng Dalam'}]};
 assert.equal(new URL(api.mapsPayload(trip)).searchParams.get('q'),'GENKI SUSHI KOTA KASABLANKA');
 assert.equal(api.mapsPayload({customer:trip.customer,address:'Alamat Kirim '+trip.customer}),'');
});
test('Maps QR preserves the selected pin even when the written address resolves elsewhere',()=>{
 const api=load().qrPrintDispatch;
 const query=trip=>new URL(api.mapsPayload(trip)).searchParams.get('q');
 const stop={address:'Nama cabang yang ambigu',latitude:'-6.177123',longitude:'106.786456'};
 assert.equal(query({noSJ:'SJ-1',destinations:[stop]}),'-6.177123,106.786456');
 assert.equal(query({destinations:[{lat:-6.17,lng:106.78}]}),'-6.17,106.78');
 assert.equal(query({latitude:-6.18,longitude:106.79}),'-6.18,106.79');
 assert.equal(query({latitude:-6.18,longitude:106.79,destinations:[{address:'Titik B'},{address:'Titik C'}]}),'Titik B');
 assert.equal(query({latitude:-6.18,longitude:106.79,destinations:[{...stop,longitude:null}]}),stop.address);
 assert.equal(query({destinations:[{...stop,locationNeedsReview:true}]}),stop.address);
 for(const pin of [{latitude:91,longitude:106},{latitude:'-6bad',longitude:106},{latitude:0,longitude:0}]) {
  assert.equal(query({destinations:[{...stop,...pin}]}),stop.address);
 }
 const payload=api.mapsPayload({noSJ:'SJ-1',destinations:[stop]});
 assert.equal(new URLSearchParams(new URL(payload).hash.slice(1)).get('sj'),'SJ-1');
});
test('printed SJ and sticker contain the Maps QR, with an honest placeholder when address is missing',()=>{
 const c=load();let output='';c.open=()=>({document:{open(){},write(html){output=html;},close(){}}});
 const trip={id:'TRIP_1',noSJ:'SJ-1126-02302',address:'Jl. Tanjung Duren, Jakarta Barat',destinations:[]};
 const expected=c.qrPrintDispatch.renderQRCodeSvg(c.qrPrintDispatch.mapsPayload(trip),79);
 c.qrPrintDispatch.printSingleSJ(trip);assert.ok(output.includes(expected));assert.doesNotMatch(output,/SCAN GOOGLE MAPS/);assert.doesNotMatch(output,/SCAN APK KURIRKITA/);
 c.allPoolTrips=[trip];c.qrPrintDispatch.printStickersOnly([trip.id]);assert.ok(output.includes(expected));
 c.qrPrintDispatch.printSingleSJ({id:'empty'});assert.match(output,/Alamat tujuan belum tersedia/);assert.doesNotMatch(output,/<svg/);
});

test('small Maps QR keeps its 79px size, quiet zone and M correction while reducing density',()=>{
 const c=load(),api=c.qrPrintDispatch;
 const trip={noSJ:'SJ-1126-02302',destinations:[{latitude:-6.177123123456,longitude:106.786456123456}]};
 const payload=api.mapsPayload(trip);
 assert.equal(new URL(payload).searchParams.get('q'),'-6.177123,106.786456');
 const old=c.qrcode(0,'M');
 old.addData('https://www.google.com/maps/search/?api=1&query=-6.177123123456%2C106.786456123456#sj=SJ-1126-02302','Byte');old.make();
 const original=c.qrcode,segments=[];
 c.qrcode=(version,correction)=>{
  assert.equal(correction,'M');
  const qr=original(version,correction),add=qr.addData;
  qr.addData=(text,mode)=>{segments.push({text,mode});add(text,mode);};
  return qr;
 };
 const svg=api.renderQRCodeSvg(payload,79);
 const modules=Number(svg.match(/data-modules="(\d+)"/)[1]);
 assert.ok(modules<old.getModuleCount());assert.ok(modules<=33);
 assert.match(svg,/width="79" height="79"/);assert.match(svg,/viewBox="0 0 41 41"/);
 assert.equal(segments.map(s=>s.text).join(''),payload);
 assert.ok(segments.some(s=>s.mode==='Numeric'));
 const address='Jl. Tanjung Duren No. 10, Jakarta Barat & Blok #2';
 const addressSvg=api.renderQRCodeSvg(api.mapsPayload({noSJ:trip.noSJ,address}),79);
 assert.ok(Number(addressSvg.match(/data-modules="(\d+)"/)[1])<=41);
});


test('Maps QR keeps the address for cameras and carries exact SJ identity for the courier scanner',()=>{
 const api=load().qrPrintDispatch;
 const payload=api.mapsPayload({noSJ:'SJ-1126-02302',address:'Jl. Jakarta SJ-9999-99999'});
 const html=fs.readFileSync(path.join(__dirname,'../kurir.html'),'utf8');const c=vm.createContext({URL,URLSearchParams});
 vm.runInContext(html.slice(html.indexOf('    function parseWtrackBarcode('),html.indexOf('    async function onBarcodeDetectedSuccess(')),c);
 assert.equal(c.parseWtrackBarcode(payload).sjNumber,'SJ-1126-02302');assert.match(new URL(payload).searchParams.get('q'),/SJ-9999-99999/);
 assert.equal(c.parseWtrackBarcode('https://www.google.com/maps/search/?api=1&query=Jakarta#sj=SJ-1126-02302').sjNumber,'SJ-1126-02302');
 assert.equal(c.parseWtrackBarcode('https://example.com/maps/#sj=SJ-1126-02302'),null);
 assert.equal(c.parseWtrackBarcode('https://www.google.com/maps/search/?api=1&query=SJ-9999-99999'),null);
});
