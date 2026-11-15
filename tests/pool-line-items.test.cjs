const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const pure = require('../js/pool_line_items.js');
const source = fs.readFileSync(require.resolve('../js/pool_line_items.js'),'utf8');
const material = {id:'paper',name:'Papier uji',kgPerM2:0.15};
const item = {no:2,nama:'ART PAPER',ukuran:'0.47 x 0.09',qty:'7',poolLine:{lengthM:'99',widthM:'99',materialId:'paper'}};

test('weight is area in m² times quantity times measured kg/m², without rounding during calculation', () => {
    const result = pure.calculate(item,[material]);
    assert.ok(Math.abs(result.areaM2-0.2961)<1e-12);
    assert.ok(Math.abs(result.weightKg-0.044415)<1e-12);
    assert.equal(item.ukuran,'0.47 x 0.09');
    assert.equal(item.qty,'7');
});

test('size determines area directly and unknown materials never silently become zero weight', () => {
    assert.equal(pure.calculate({ukuran:'1.00 x 1.00',qty:'7'},[material]).areaM2,7);
    assert.equal(pure.calculate({ukuran:'unknown',qty:'7'},[material]).areaM2,null);
    assert.equal(pure.calculate({...item,poolLine:{...item.poolLine,materialId:'missing'}},[material]).weightKg,null);
    for(const qty of ['1 Koli','bad',0,-1]) assert.equal(pure.calculate({...item,qty},[material]).weightKg,null);
    assert.equal(pure.calculate({nama:'LIPAT REL',qty:'17',poolLine:{kind:'service'}},[]).weightKg,0);
    assert.equal(pure.calculate({nama:'Jasa Pemasangan',qty:'2'},[]).weightKg,0);
});

test('partial line selection changes the weight subtotal and legacy hidden flags do not hide items', () => {
    const trip={items:[item,{...item,poolLine:{...item.poolLine,hidden:true}}, {...item,poolLine:{...item.poolLine,selected:false}}]};
    const result=pure.summary(trip,[material]);
    assert.equal(result.selected,2);
    assert.equal(result.total,3);
    assert.equal(result.missing,0);
    assert.ok(Math.abs(result.weightKg-0.08883)<1e-12);
});

function setup({fail=false,lan=false}={}) {
    const trip={id:'trip-1',noSJ:'SJ-TEST-1',status:'pool',items:[item,{nama:'Jasa',qty:'17'}],destinations:[{items:[item,{nama:'Jasa',qty:'17'}]}]};
    const data=new Map([['wtrack_local_trips',JSON.stringify([trip])],['wtrack_pool_materials_v1',JSON.stringify([material])]]);
    const alerts=[];
    const document={querySelectorAll:()=>[],getElementById:()=>null};
    const window={WTRACK_LOCAL_SANDBOX:true,allPoolTrips:[trip],allCurrentTrips:[],document,alert:m=>alerts.push(m),
        UnifiedPoolUI:{renderUnifiedPoolView(){},updateSelectionCount(){}},
        localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>{if(fail) throw Error('Quota exceeded');data.set(key,value);}}};
    if(lan) window.persistLocalSandboxTrips=async()=>{throw Error('Data berubah dari PC lain');};
    vm.runInContext(source,vm.createContext({window,Intl,Date}));
    return {api:window.PoolLineItems,window,trip,data,alerts};
}

test('line notes persist across refresh, preserve source items and update the destination copy', async()=>{
    const s=setup();
    await s.api.updateLine('SJ-TEST-1',0,'selected',false);
    await s.api.updateLine('SJ-TEST-1',1,'kind','service');
    const saved=JSON.parse(s.data.get('wtrack_local_trips'))[0];
    assert.equal(saved.items[0].poolLine.selected,false);
    assert.equal(saved.destinations[0].items[0].poolLine.selected,false);
    assert.equal(saved.items[0].nama,item.nama);
    assert.equal(saved.items[0].ukuran,item.ukuran);
    assert.equal(saved.items[0].qty,item.qty);
    assert.equal(saved.items[1].poolLine.kind,'service');
    assert.equal(saved.status,'pool');
    assert.equal(s.window.allPoolTrips[0].items[0].poolLine.selected,false);
    s.api.toggle('SJ-TEST-1');
    const rendered=s.api.renderDetail(saved);
    assert.ok(rendered.includes('>Jasa</span>'));
    assert.match(rendered,/<th>Size<\/th>/);
    assert.match(rendered,/<th>M2<\/th>/);
    assert.match(rendered,/<th>KG\/M2<\/th>/);
    assert.ok(!rendered.includes('<th>Berat line</th>'));
    assert.ok(!rendered.includes('<th>Tampilan</th>'));
    assert.ok(!rendered.includes('Panjang meter'));
    assert.ok(!rendered.includes('Lebar meter'));
    assert.equal(JSON.parse(s.data.get('wtrack_local_trips'))[0].items[0].poolLine.selected,false);
});

test('failed storage / LAN version conflict leaves original state and memory unchanged',async()=>{
    for(const options of [{fail:true},{lan:true}]) {
        const s=setup(options), before=s.data.get('wtrack_local_trips');
        await s.api.updateLine('SJ-TEST-1',0,'selected',false);
        assert.equal(s.data.get('wtrack_local_trips'),before);
        assert.equal(s.window.allPoolTrips[0],s.trip);
        assert.equal(s.trip.items[0].poolLine.selected,undefined);
        assert.ok(s.alerts.some(m=>m.includes('belum tersimpan')));
    }
});

test('material database can be entered and updated with a new measured weight',async()=>{
    const s=setup();
    const inputs={'pool-material-name-SJ-TEST-1':{value:'Paper'},'pool-material-rate-SJ-TEST-1':{value:'0,2'}};
    s.window.document.getElementById=id=>inputs[id];
    await s.api.saveMaterial('SJ-TEST-1');
    let database=JSON.parse(s.data.get('wtrack_pool_materials_v1'));
    const entry=database.find(m=>m.name==='Paper');
    assert.equal(entry.kgPerM2,0.2);
    inputs['pool-material-rate-SJ-TEST-1'].value='0,3';
    await s.api.saveMaterial('SJ-TEST-1');
    database=JSON.parse(s.data.get('wtrack_pool_materials_v1'));
    assert.equal(database.filter(m=>m.name==='Paper').length,1);
    assert.equal(database.find(m=>m.id===entry.id).kgPerM2,0.3);
});


test('Size parser supports decimal commas, multiplication signs and explicit units',()=>{
    for(const ukuran of ['1.35 x 0.55','1,35 × 0,55','135 x 55 cm','1350 mm x 550 mm']) {
        const result=pure.calculate({ukuran,qty:28},[]);
        assert.ok(Math.abs(result.areaM2-20.79)<1e-10,ukuran);
    }
    for(const ukuran of ['','-','0 x 1','-1 x 2','A3','1 x 2 x 3']) {
        assert.equal(pure.calculate({ukuran,qty:28},[]).areaM2,null,ukuran);
    }
});

test('all previously hidden rows render after Hide controls have been removed',()=>{
    const s=setup();
    s.api.toggle('SJ-TEST-1');
    const rendered=s.api.renderDetail({noSJ:'SJ-TEST-1',items:[{nama:'HIDDEN-LEGACY',ukuran:'1 x 1',qty:1,poolLine:{hidden:true}}]});
    assert.ok(rendered.includes('Hidden-Legacy'));
    assert.ok(!rendered.includes('toggleHidden'));
    assert.ok(!rendered.includes('>Hide<'));
});
