const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {createProofPhotoHandler} = require('../lib/proof-photo.cjs');
const DeliveryIdentity = require('../js/delivery_identity.js');
const source = fs.readFileSync(path.join(__dirname,'../kurir.html'),'utf8');
const photo = 'data:image/jpeg;base64,' + Buffer.alloc(180000,1).toString('base64');

test('Storage fallback saves an isolated photo document and returns a small URL, never inline base64', async () => {
    const records = [];
    const c = vm.createContext({firebaseStorage:null,window:{location:{protocol:'https:',origin:'https://wtrack.test'}},
        firestoreDb:{collection(name){assert.equal(name,'delivery_proofs');return {doc(){return {id:'abcdefghijklmnopqrst',async set(value){records.push(value);}};}};}},
        firebase:{firestore:{Timestamp:{now:()=>123}}}});
    const start=source.indexOf('    async function uploadProofPhotoOnline(');
    const end=source.indexOf('    function initAdminTrackingConfigListener(',start);
    vm.runInContext(source.slice(start,end),c);
    const result=await c.uploadProofPhotoOnline(photo,'proofs_sj',{tripId:'route',deliveryId:'b',stopIndex:2,sjNumber:'SJ-B'});
    assert.equal(result,'https://wtrack.test/api/proof-photo?id=abcdefghijklmnopqrst');
    assert.equal(records[0].dataUrl,photo);
    assert.equal(records[0].deliveryId,'b');
    assert.equal(records[0].sjNumber,'SJ-B');
    assert.ok(Buffer.byteLength(JSON.stringify(records[0]))<1048576);
    assert.equal(await c.uploadProofPhotoOnline('https://storage.test/photo.jpg'),'https://storage.test/photo.jpg');
    await assert.rejects(c.uploadProofPhotoOnline('data:image/jpeg;base64,'+'A'.repeat(900001)),/terlalu besar/);
    assert.equal(records.length,1);
    c.firestoreDb=null;
    await assert.rejects(c.uploadProofPhotoOnline(photo),/penyimpanan/);
});

function response() {
    return {headers:{},setHeader(key,value){this.headers[key]=value;},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(body){this.body=body;return this;}};
}

test('photo endpoint validates IDs, returns actual image bytes, and rejects unsafe formats', async () => {
    const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1cAAAAASUVORK5CYII=';
    const handler=createProofPhotoHandler(async id=>id==='abcdefghijklmnopqrst'?{dataUrl:'data:image/png;base64,'+png}:null);
    const r=response();
    await handler({method:'GET',query:{id:'abcdefghijklmnopqrst'}},r);
    assert.equal(r.code,200);
    assert.equal(r.headers['Content-Type'],'image/png');
    assert.equal(r.headers['Access-Control-Allow-Origin'],'*');
    assert.deepEqual(r.body,Buffer.from(png,'base64'));
    const head=response();
    await handler({method:'HEAD',query:{id:'abcdefghijklmnopqrst'}},head);
    assert.equal(head.code,200); assert.equal(head.body,undefined);
    for (const [id,code] of [['../users/admin',400],['missingabcdefghijklmno',404]]) {
        const r=response(); await handler({method:'GET',query:{id}},r); assert.equal(r.code,code);
    }
    const unsafe=response();
    await createProofPhotoHandler(async()=>({dataUrl:'data:image/svg+xml;base64,PHN2Zz4='}))({method:'GET',query:{id:'abcdefghijklmnopqrst'}},unsafe);
    assert.equal(unsafe.code,422);
});

function completionContext(failCommit=false,failUpload=false) {
    const first={deliveryId:'a',stopIndex:1,locationName:'RSKD Duren Sawit',status:'done',proofPhotoUrl:photo,proofPhotoSj:photo,proofPhotoItems:[photo]};
    const second={deliveryId:'b',stopIndex:2,locationName:'RSKD Duren Sawit',status:'pending'};
    const trip={status:'in_progress',destinations:[first,second]};
    const cards=[{id:'route_STOP_0',status:'delivered'}, {id:'route_STOP_1',rootTripId:'route',deliveryId:'b',stopIndex:2,destination:'RSKD Duren Sawit',noSJ:'-',status:'in-transit'}];
    const toast=[];
    const button={disabled:false,innerHTML:'Complete'};
    const c=vm.createContext({currentUploadTripId:'route_STOP_1',currentSJPhoto:photo,currentBarangPhoto:photo,
        masterShipments:cards,DeliveryIdentity,showToast:message=>toast.push(message),console:{warn(){}},
        document:{getElementById:id=>id==='upload-modal-sj-badge'?{value:'SJ-B'}:{},querySelector:()=>button},
        localStorage:{getItem:()=>null}, bootstrap:{Modal:{getInstance:()=>({hide(){}})}},
        renderHomeScreen(){},renderShipmentsScreen(){},setTimeout(){},
        async uploadProofPhotoOnline(value,category){if(failUpload)throw Error('offline');return 'https://proof.test/'+category;},
        firebase:{firestore:{Timestamp:{now:()=>({seconds:123})}}},
        firestoreDb:{collection:()=>({doc:()=>({id:'route'})}),async runTransaction(callback){
            if(failCommit)throw Error('write rejected');
            let payload;
            await callback({get:async()=>({exists:true,data:()=>trip}),update(ref,value){payload=value;}});
            assert.equal(cards[1].status,'in-transit','UI must not show success before commit');
            assert.ok(Buffer.byteLength(JSON.stringify(payload))<1048576);
            Object.assign(trip,payload);
        }}
    });
    const start=source.indexOf('    async function submitParcelProof()');
    const end=source.indexOf('    function triggerWaFromConfirmedModal()',start);
    vm.runInContext(source.slice(start,end),c);
    return {c,trip,first,cards,button,toast};
}

test('two same-address deliveries complete independently without exceeding the shared route size', async () => {
    const {c,trip,first,cards}=completionContext();
    await c.submitParcelProof();
    assert.equal(trip.destinations[0],first);
    assert.equal(trip.destinations[0].proofPhotoSj,photo);
    assert.equal(trip.destinations[1].proofPhotoSj,'https://proof.test/proofs_sj');
    assert.equal(trip.destinations[1].sjNumber,'SJ-B');
    assert.equal(trip.destinations[0].sjNumber,undefined);
    assert.equal(trip.destinations[1].status,'done');
    assert.equal(trip.status,'completed');
    assert.equal(cards[1].status,'delivered');
});

test('upload or commit failure never marks the second delivery completed', async () => {
    for (const [failCommit,failUpload] of [[true,false],[false,true]]) {
        const {c,trip,cards,button,toast}=completionContext(failCommit,failUpload);
        await c.submitParcelProof();
        assert.equal(trip.destinations[1].status,'pending');
        assert.equal(cards[1].status,'in-transit');
        assert.equal(button.disabled,false);
        assert.match(toast.at(-1),/belum tersimpan/);
    }
});
