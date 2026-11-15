const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup() {
    const data=new Map();
    const window={WTRACK_LOCAL_SANDBOX:true,showToast(){},localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)}};
    const c=vm.createContext({window,Date,Intl});
    for(const file of ['material_seed','material_master','pool_line_items','material_usage']) vm.runInContext(fs.readFileSync(require.resolve('../js/'+file+'.js'),'utf8'),c);
    window.MaterialMaster.seed();
    return {api:window.MaterialUsage,window,data,db:window.MaterialMaster.read()};
}
const source=(items,overrides={})=>({noSJ:'SJ-USAGE-1',sourceFile:'sample.xlsx',sourceDocumentDate:'2026-11-11',importedAt:'2026-11-13T03:00:00Z',items,...overrides});

test('Usage groups each physical layer by master material and ignores partial-dispatch selections',()=>{
    const s=setup(),item={nama:'White Paper Board 3 mm Sticker Vynil Laminating Doff',ukuran:'1 x 1',qty:2,poolLine:{selected:false}};
    const report=s.api.buildReport([source([item])],s.db,{from:'2026-11-11',to:'2026-11-11'});
    assert.equal(report.sjCount,1);assert.equal(report.summary.length,3);
    assert.equal(report.areaM2,6);
    assert.ok(Math.abs(report.weightKg-1.996)<1e-12);
    assert.equal(report.issues.length,0);
    for(const group of report.summary) {assert.equal(group.areaM2,2);assert.equal(group.sjCount,1);}
});

test('calendar filters use SJ or import dates inclusively and flag legacy fallback dates',()=>{
    const s=setup(),items=[{nama:'ART PAPER',ukuran:'1 x 1',qty:1}];
    const sources=[source(items),source(items,{noSJ:'SJ-LEGACY',sourceDocumentDate:''})];
    const document=s.api.buildReport(sources,s.db,{from:'2026-11-11',to:'2026-11-11',basis:'document'});
    assert.equal(document.sjCount,1);assert.equal(document.fallbackDates,0);
    const imported=s.api.buildReport(sources,s.db,{from:'2026-11-13',to:'2026-11-13',basis:'import'});
    assert.equal(imported.sjCount,2);
    const fallback=s.api.buildReport(sources,s.db,{from:'2026-11-13',to:'2026-11-13',basis:'document'});
    assert.equal(fallback.sjCount,1);assert.equal(fallback.fallbackDates,1);
    assert.equal(s.api.dayKey('2026-11-12T17:00:00Z'),'2026-11-13');
    assert.equal(s.api.dayKey('2026-02-30'),'');
});

test('Usage archives imports once and retains reports after trips leave the pool or are deleted',()=>{
    const s=setup();
    const trip=source([{nama:'ART PAPER',ukuran:'1 x 1',qty:4}],{id:'first'});
    s.api.capture([trip]);s.api.capture([trip]);
    let archive=JSON.parse(s.data.get('wtrack_material_usage_sources_v1'));
    assert.equal(archive.length,1);
    const merged=s.api.mergeSources(archive,[]);
    assert.equal(merged.length,1);
    assert.equal(s.api.buildReport(merged,s.db,{}).areaM2,4);
    s.api.capture([{...trip,id:'copy',status:'completed'}]);
    archive=JSON.parse(s.data.get('wtrack_material_usage_sources_v1'));
    assert.equal(archive.length,1);
    assert.equal(s.api.buildReport([...archive,...archive],s.db,{}).areaM2,4);
    const manual={id:'manual',noSJ:'SJ-MANUAL',items:trip.items};
    assert.equal(s.api.mergeSources(archive,[manual]).length,1);
});

test('Ritrama Ultra Clear White Ink resolves to the requested vinyl master instead of Ultra Clear',()=>{
    const s=setup();
    const item={nama:'Sticker Ritrama Ultra Clear White Ink',ukuran:'1 x 2',qty:3};
    const matched=s.window.MaterialMaster.resolve(item,s.db);
    assert.equal(matched.material.name,'STICKER VYNIL RITRAMA');
    const report=s.api.buildReport([source([item])],s.db,{});
    assert.equal(report.summary[0].name,'STICKER VYNIL RITRAMA');
    assert.equal(report.areaM2,6);
    assert.ok(Math.abs(report.weightKg-1.638)<1e-12);
});

test('unmatched materials and invalid sizes are reported, services excluded and inactive historical material retained',()=>{
    const s=setup();s.db.find(row=>row.name==='ART PAPER').active=false;
    const report=s.api.buildReport([source([
        {nama:'ART PAPER',ukuran:'1 x 1',qty:1},
        {nama:'BAHAN BELUM DIKENAL',ukuran:'1 x 2',qty:1},
        {nama:'ART PAPER',ukuran:'A3',qty:1},
        {nama:'LIPAT REL',qty:1,poolLine:{kind:'service'}}
    ])],s.db,{});
    assert.equal(report.services,1);assert.equal(report.issues.length,2);
    assert.equal(report.summary.length,1);assert.equal(report.areaM2,1);
    assert.equal(report.issues.find(row=>row.itemName==='BAHAN BELUM DIKENAL').areaM2,2);
});

test('Usage filters by material and SJ text without counting duplicate sources or losing exact precision',()=>{
    const s=setup(),id=s.db.find(row=>row.name==='LAMINASI DOFT').id;
    const row=source([{nama:'ART PAPER LAMINATING DOFF',ukuran:'1.35 x 0.55',qty:28}]);
    const report=s.api.buildReport([row,row],s.db,{materialId:id,query:'SJ-USAGE-1'});
    assert.equal(report.summary.length,1);assert.equal(report.sjCount,1);
    assert.ok(Math.abs(report.areaM2-20.79)<1e-10);
    assert.ok(Math.abs(report.weightKg-2.82744)<1e-10);
});
