const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createFleetServiceHandler, REQUESTS, PHOTOS, CONFIG} = require('../lib/fleet-service.cjs');
const config = require('../config/fleet-service.json');
const fs = require('node:fs');
const vm = require('node:vm');
const picture = n => 'data:image/jpeg;base64,' + Buffer.from([255,216,255,224,...Array(20).fill(n)]).toString('base64');
function setup(uid = config.accounts.find(a => a.driver).uid, claims = {}) {
    const data = new Map();
    let failCommit = false;
    const ref = (collection, id) => ({collection, id, key:`${collection}/${id}`,
        async get() { return snap(this); },
        async set(value) { data.set(this.key, structuredClone(value)); }
    });
    const snap = ref => ({exists:data.has(ref.key), data:() => structuredClone(data.get(ref.key)), id:ref.id});
    const query = (name, filter = null, cap = Infinity, ordered = false) => ({
        doc: id => ref(name, id),
        where: (field, op, value) => query(name, row => row[field] === value, cap, ordered),
        limit: n => query(name, filter, n, ordered),
        orderBy: () => query(name, filter, cap, true),
        async get() { let rows = [...data].filter(([key, row]) => key.startsWith(name+'/') && (!filter || filter(row)));
            if (ordered) rows.sort((a,b) => b[1].createdAt - a[1].createdAt);
            return {docs:rows.slice(0,cap).map(([key]) => snap(ref(name,key.slice(name.length+1))))}; }
    });
    const db = {collection:name => query(name), async runTransaction(fn) {
        const writes = [];
        const result = await fn({get:async ref => snap(ref), set:(ref,row) => writes.push([ref,row,false]), update:(ref,row)=>writes.push([ref,row,true])});
        if (failCommit) throw Error('offline');
        for (const [ref,row,merge] of writes) data.set(ref.key, structuredClone(merge ? {...data.get(ref.key),...row} : row));
        return result;
    }};
    const auth = {verifyIdToken: async token => { if (token !== 'valid') throw Error('invalid'); return {uid, name:'Driver', ...claims}; }};
    const handler = createFleetServiceHandler({auth, db, config, adminUids:['super-admin'], now:() => 1000});
    async function call(action, body, options = {}) {
        const res = {code:0, headers:{}, setHeader(k,v){this.headers[k]=v;}, status(c){this.code=c;return this;}, json(body){this.body=body;return this;}};
        await handler({method:body ? 'POST':'GET', headers:{authorization:'Bearer valid',...options.headers},
            query:{action,...options.query},body:body ? {action,...body}:undefined},res);
        return res;
    }
    const submit = (extra = {}) => call('submit', {id:'request-0001', vehicleId:config.vehicles[0].id,
        description:'Rem berdecit dan terasa kurang pakem',odometer:'45.000 km', photos:[picture(1),picture(2)], ...extra});
    return {data, call, submit, failCommit:() => {failCommit=true;}};
}

test('only authenticated drivers, assigned fleet users and the exact testing account may apply', async () => {
    assert.equal((await setup().call('bootstrap')).body.canSubmit, true);
    assert.equal((await setup(config.testingUid).call('bootstrap')).body.testing, true);
    const ordinary = setup('unassigned-courier');
    assert.equal((await ordinary.call('bootstrap')).body.canSubmit, false);
    assert.equal((await ordinary.submit()).code, 403);
    assert.equal((await ordinary.call('bootstrap',null,{headers:{authorization:''}})).code, 401);
    assert.equal((await ordinary.call('bootstrap',null,{headers:{authorization:'Bearer invalid'}})).code, 401);
    assert.equal((await setup('anonymous',{firebase:{sign_in_provider:'anonymous'}}).call('bootstrap')).code,401);
    const assigned = setup('new-fleet-user');
    assigned.data.set(`${CONFIG}/registry`, {version:1,vehicles:[{...config.vehicles[0],assigned_person_id:'new-fleet-user'}]});
    assert.equal((await assigned.call('bootstrap')).body.canSubmit,true);
    assigned.data.set('account_deletions/new-fleet-user',{status:'completed'});
    assert.equal((await assigned.call('bootstrap')).code,403);
});

test('two to six distinct images and an actual fleet vehicle are required; client approval fields are ignored', async () => {
    const c = setup();
    for (const photos of [[],[picture(1)],Array(7).fill(picture(1)),[picture(1),picture(1)],['data:image/jpeg;base64,bm90LWEtcGhvdG8=',picture(1)]]) {
        assert.equal((await c.submit({photos})).code,400);
    }
    assert.equal((await c.submit({vehicleId:'nonexistent'})).code,400);
    assert.equal((await c.submit({description:'short'})).code,400);
    const result = await c.submit({status:'approved',requesterUid:'another-user',reviewedBy:'super-admin'});
    assert.equal(result.code,200);
    assert.equal(result.body.request.status,'pending');
    assert.equal(result.body.request.requesterUid,config.accounts.find(a=>a.driver).uid);
    assert.equal(result.body.request.reviewedBy,undefined);
    assert.equal(c.data.size,3);
    assert.equal(c.data.get(`${PHOTOS}/request-0001_0`).data,picture(1));
    assert.equal(c.data.get(`${REQUESTS}/request-0001`).photos,undefined);
});

test('retrying an identical request creates one request; failed transaction leaves no partial photos', async () => {
    const c = setup();
    assert.equal((await c.submit()).code,200);
    assert.equal((await c.submit()).code,200);
    assert.equal(c.data.size,3);
    const offline = setup(); offline.failCommit();
    assert.equal((await offline.submit()).code,503);
    assert.equal(offline.data.size,0);
});

test('approval requires server-owned Super Admin permission; only pending records can be decided', async () => {
    const driver = setup(); await driver.submit();
    const body = {id:'request-0001',status:'approved',note:'Silakan bawa ke bengkel'};
    assert.equal((await driver.call('review',body)).code,403);
    const fakeProfile = setup('fake-admin');
    fakeProfile.data.set('users/fake-admin',{role:'super_admin'});
    assert.equal((await fakeProfile.call('review',body)).code,403);
    const admin = setup('super-admin');
    admin.data.set(`${REQUESTS}/request-0001`,driver.data.get(`${REQUESTS}/request-0001`));
    assert.equal((await admin.call('review',{...body,status:'rejected',note:''})).code,400);
    assert.equal((await admin.call('review',body)).code,200);
    assert.equal(admin.data.get(`${REQUESTS}/request-0001`).reviewedBy,'super-admin');
    assert.equal((await admin.call('review',{...body,status:'rejected',note:'Tidak perlu'})).code,409);
    const rejection = setup('super-admin');
    rejection.data.set(`${REQUESTS}/request-0001`,driver.data.get(`${REQUESTS}/request-0001`));
    assert.equal((await rejection.call('review',{...body,status:'rejected',note:'Foto kurang jelas'})).code,200);
    assert.equal(rejection.data.get(`${REQUESTS}/request-0001`).reviewNote,'Foto kurang jelas');
});

test('drivers can only read their own requests and photos, including after assignments end', async () => {
    const owner = setup(); await owner.submit();
    owner.data.set(`${REQUESTS}/other-request`,{requesterUid:'other',createdAt:2000});
    const list = await owner.call('list',null,{query:{scope:'admin'}});
    assert.equal(list.body.requests.length,1);
    assert.equal((await owner.call('photo',null,{query:{id:'request-0001_0'}})).code,200);
    const stranger = setup('stranger');
    stranger.data.set(`${PHOTOS}/request-0001_0`,owner.data.get(`${PHOTOS}/request-0001_0`));
    assert.equal((await stranger.call('photo',null,{query:{id:'request-0001_0'}})).code,403);
    const admin = setup('super-admin');
    admin.data.set(`${PHOTOS}/request-0001_0`,owner.data.get(`${PHOTOS}/request-0001_0`));
    assert.equal((await admin.call('photo',null,{query:{id:'request-0001_0'}})).code,200);
});

test('fleet synchronization is restricted and rejects stale versions rather than overwriting changes', async () => {
    const body = {vehicles:config.vehicles,expectedVersion:0};
    assert.equal((await setup().call('syncFleet',body)).code,403);
    const admin = setup('super-admin');
    assert.equal((await admin.call('syncFleet',body)).body.version,1);
    assert.equal((await admin.call('syncFleet',body)).code,409);
    assert.equal((await admin.call('syncFleet',{...body,expectedVersion:1})).body.version,2);
    assert.equal((await admin.call('syncFleet',{...body,expectedVersion:2,vehicles:[config.vehicles[0],config.vehicles[0]]})).code,400);
});

test('the testing account is marked, and service request rendering escapes all user text', async () => {
    const c = setup(config.testingUid);
    assert.equal((await c.submit()).body.request.testing,true);
    const context = vm.createContext({window:{document:{addEventListener(){}}}});
    vm.runInContext(fs.readFileSync('js/fleet_service.js','utf8'),context);
    const html = context.window.FleetService.renderRequests([{id:'request-0001',status:'pending',createdAt:1000,
        requesterName:'<img src=x onerror=evil()>',plateNumber:'B TEST',description:'<script>evil()</script>',photoIds:['p1','p2'],testing:true}],true);
    assert.doesNotMatch(html,/<script>|<img src=x/);
    assert.match(html,/&lt;script&gt;/);
    assert.match(html,/Akun testing/);
    assert.match(html,/Setujui/);
});

test('web updates never reload an unsent service form or its selected photos', async () => {
    const events = new Map(); let dirty = true, reloads = 0, fetches = 0;
    const window = {location:{protocol:'https:',reload(){reloads++;}},navigator:{onLine:true},
        FleetService:{hasUnsavedDraft:()=>dirty},document:{hidden:false,currentScript:{dataset:{build:'old'}},
            activeElement:null,querySelector:()=>null,addEventListener:(name,fn)=>events.set(name,fn)},
        addEventListener:(name,fn)=>events.set(name,fn),setInterval(){},
        fetch:async()=>{fetches++;return {ok:true,json:async()=>({courier:'new'})};}};
    vm.runInNewContext(fs.readFileSync('js/courier_updates.js','utf8'),{window});
    await events.get('online')();
    assert.equal(fetches,0); assert.equal(reloads,0);
    dirty = false; await events.get('online')();
    assert.equal(fetches,1); assert.equal(reloads,1);
});
