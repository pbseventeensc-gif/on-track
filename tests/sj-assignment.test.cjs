const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=require('../js/sj_assignment.js');
const QRClaim=require('../js/qr_claim.js');
const fixture=(id='trip-a')=>({id,tripId:id,noSJ:'SJ-1126-1001',courierId:'',status:'pool',region:'Bekasi',
    date:'2026-11-14',qrPayload:'original-qr',sourceFile:'order.xlsx',readyStatus:'ready',
    items:[{nama:'Poster',qty:2,ukuran:'1 x 1'}],destinations:[{deliveryId:'delivery-a',
        stopIndex:1,locationName:'Toko tujuan',customer:'PT Klien',latitude:-6.2,longitude:106.9,
        address:'Bekasi',items:[{nama:'Poster',qty:2}],status:'pending',adminSJ:'Admin'}]});
function server(rows,fail=false) {
    const writes=[];
    const collection={doc:id=>({id,get:async()=>({id,exists:!!rows[id],data:()=>rows[id]})}),
        where:(field,operator,value)=>({limit:()=>({get:async()=>({
            docs:Object.entries(rows).filter(([,r])=>r[field]===value).map(([id,row])=>({id,data:()=>row}))
        })})})};
    return {writes,collection:()=>collection,runTransaction:async callback=>{
        const staged=[];
        const result=await callback({get:async ref=>({exists:!!rows[ref.id],data:()=>rows[ref.id]}),
            update:(ref,data)=>staged.push({id:ref.id,data})});
        if(fail)throw Error('network failure');
        writes.push(...staged);return result;
    }};
}
test('region assignment keeps the original document, QR, store, items, coordinates and delivery identity',async()=>{
    const source=fixture(),db=server({'trip-a':source});
    const [trip]=await api.assign(db,['trip-a'],{id:'courier-a',name:'Kurir A'}, {region:'Bekasi',vehiclePlate:'B 1234'});
    assert.equal(trip.id,source.id);assert.equal(trip.tripId,source.tripId);assert.equal(trip.qrPayload,source.qrPayload);
    assert.deepEqual(trip.items,source.items);
    assert.deepEqual(trip.destinations[0],{...source.destinations[0],status:'in_progress'});
    assert.equal(trip.date,'2026-11-14');assert.ok(trip.assignedAt);assert.equal(trip.vehiclePlate,'B 1234');
    assert.equal(db.writes.length,1);assert.equal(db.writes[0].id,'trip-a');assert.equal(source.status,'pool');
});
test('one stale/assigned SJ aborts the whole region without partial assignments',async()=>{
    const a=fixture('a'),b={...fixture('b'),courierId:'other'};
    const db=server({a,b});
    await assert.rejects(api.assign(db,['a','b'],{id:'new',name:'New'}),/sudah ditugaskan/);
    assert.equal(db.writes.length,0);
});
test('region assignment rejects completed, pickup, unready and changed region data',async()=>{
    for(const change of [{status:'completed'},{pickupStatus:'waiting'},{readyStatus:'not_ready'},
        {region:'Bogor'},{destinations:[{status:'done'}]}]) {
        const db=server({a:{...fixture('a'),...change}});
        await assert.rejects(api.assign(db,['a'],{id:'new',name:'New'},{region:'Bekasi'}));
        assert.equal(db.writes.length,0);
    }
});
test('cloud failure is propagated; no committed task is returned',async()=>{
    const db=server({a:fixture('a')},true);
    await assert.rejects(api.assign(db,['a'],{id:'new',name:'New'}),/network failure/);
    assert.equal(db.writes.length,0);
});
test('ready status uses the original cloud document and rejects assigned SJ',async()=>{
    const a=fixture('original-doc'),db=server({'original-doc':a});
    await api.setReady(db,['original-doc'],false);
    assert.deepEqual(db.writes,[{id:'original-doc',data:{readyStatus:'not_ready'}}]);
    a.courierId='other';
    await assert.rejects(api.setReady(db,['original-doc'],true),/ditugaskan/);
    assert.equal(db.writes.length,1);
});
test('online QR cannot steal a task or bypass ready/pickup validation',async()=>{
    for(const change of [{courierId:'other'},{readyStatus:'not_ready'},{pickupStatus:'waiting'},{status:'completed'}]) {
        const db=server({a:{...fixture('a'),...change}});
        await assert.rejects(QRClaim.claimOnline(db,{tripId:'a'},{uid:'new',name:'New'}));
        assert.equal(db.writes.length,0);
    }
});
test('online QR rechecks server state and refuses duplicates and failed transactions',async()=>{
    const a=fixture('a'),b=fixture('b'),courier={uid:'new',name:'New'};
    await assert.rejects(QRClaim.claimOnline(server({a,b}),{sjNumber:a.noSJ},courier),/ganda/);
    const failed=server({a},true);
    await assert.rejects(QRClaim.claimOnline(failed,{tripId:'a'},courier),/network failure/);
    assert.equal(failed.writes.length,0);
    const db=server({a});const result=await QRClaim.claimOnline(db,{sjNumber:a.noSJ},courier);
    assert.equal(result.trip.id,'a');assert.equal(result.trip.courierId,'new');assert.equal(db.writes.length,1);
});
test('online region button commits original cloud documents before updating the dashboard',async()=>{
    const fs=require('node:fs'),vm=require('node:vm');
    for(const fail of [false,true]) {
        const a=fixture('original-doc'),unready={...fixture('not-ready'),noSJ:'SJ-OTHER',readyStatus:'not_ready'};
        const db=server({'original-doc':a,'not-ready':unready},fail),alerts=[],success=[];
        const select={value:'new',selectedIndex:0,options:[{text:'Kurir Baru',getAttribute:()=> 'motor'}]};
        const window={SJAssignment:api,allPoolTrips:[a,unready],allCurrentTrips:[],getDb:()=>db,
            showToast:message=>success.push(message),syncAllCurrentTrips:trips=>{window.allCurrentTrips=trips;}};
        const fields={'quick-dispatch-region':{value:'Bekasi'},'quick-dispatch-courier':select};
        const c=vm.createContext({window,document:{getElementById:id=>fields[id]||null},
            localStorage:{getItem:()=>null},confirm:()=>true,alert:message=>alerts.push(message),console});
        vm.runInContext(fs.readFileSync('js/unified_pool_ui.js','utf8'),c);
        await window.UnifiedPoolUI.executeQuickDispatch();
        assert.equal(success.length,fail?0:1);assert.equal(db.writes.length,fail?0:1);
        assert.equal(window.allCurrentTrips.length,fail?0:1);
        assert.equal(window.allPoolTrips.length,fail?2:1);
        if(!fail)assert.equal(window.allCurrentTrips[0].id,'original-doc');
        else assert.match(alerts[0],/belum disimpan/);
    }
});
test('courier keeps unfinished tasks older than a week visible',()=>{
    const fs=require('node:fs'),vm=require('node:vm'),html=fs.readFileSync('kurir.html','utf8');
    const c=vm.createContext({getShipmentDayDiff:()=>20});
    vm.runInContext(html.slice(html.indexOf('    function isShipmentExpired('),html.indexOf('    function isShipmentHistory(')),c);
    assert.equal(c.isShipmentExpired({status:'in-transit'}),false);
    assert.equal(c.isShipmentExpired({status:'pending'}),false);
    assert.equal(c.isShipmentExpired({status:'delivered'}),true);
});
test('cloud snapshots publish Pool and assigned trips together after refresh',()=>{
    const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync('js/app.js','utf8');
    const pool=fixture('pool'),active={...fixture('active'),courierId:'courier',status:'in_progress'};
    const window={};let poolDuringRender;
    window.UnifiedPoolUI={renderUnifiedPoolView:()=>{poolDuringRender=window.allPoolTrips;assert.equal(window.allCurrentTrips.length,1);}};
    const c=vm.createContext({window,allPoolTrips:[],allCurrentTrips:[],console,
        getDb:()=>({collection:()=>({onSnapshot:callback=>callback([pool,active].map(t=>({id:t.id,data:()=>t})))})}),
        updateGlobalStats(){},renderRecentShipments(){}});
    vm.runInContext(source.slice(source.indexOf('function initTripsSnapshot()'),source.indexOf('let isUpdatingStats =')),c);
    assert.equal(poolDuringRender.length,1);assert.equal(poolDuringRender[0].id,'pool');
});
