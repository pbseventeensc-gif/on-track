const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/material_master.js'),'utf8');
function setup(initial=[]) {
    const data=new Map([['wtrack_pool_materials_v1',JSON.stringify(initial)]]);
    const window={WTRACK_LOCAL_SANDBOX:true,localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
    const c=vm.createContext({window,Date,Intl});
    vm.runInContext(fs.readFileSync(require.resolve('../js/material_seed.js'),'utf8'),c);
    vm.runInContext(source,c);
    return {api:window.MaterialMaster,window,data,c};
}
test('spreadsheet seed contains 61 consistent measured rates and updates old matching names once',()=>{
    const s=setup([{id:'old-art',name:'Art Paper',kgPerM2:0.15,aliases:['PAPER UJI']}]);
    const seed=s.window.WtrackMaterialSeed;
    assert.equal(seed.length,61);
    assert.equal(new Set(seed.map(row=>row.name.trim())).size,61);
    for(const row of seed) assert.ok(Math.abs(row.sampleGram*0.1-row.kgPerM2)<1e-9,row.name);
    s.api.seed();
    let rows=s.api.read();
    assert.equal(rows.length,61);
    assert.equal(rows.find(row=>row.id==='old-art').kgPerM2,0.152);
    assert.equal(rows.find(row=>row.id==='old-art').aliases[0],'PAPER UJI');
    rows.find(row=>row.id==='old-art').kgPerM2=0.2;
    s.data.set('wtrack_pool_materials_v1',JSON.stringify(rows));
    s.api.seed();
    assert.equal(s.api.read().find(row=>row.id==='old-art').kgPerM2,0.2);
});
test('matching selects a clear material, normalizes known spelling and leaves unknown or ambiguous variants unselected',()=>{
    const s=setup();s.api.seed();const database=s.api.read();
    assert.equal(s.api.resolve({nama:'ART PAPER 1MUKA NON LAMINATING _BUKU'},database).material.kgPerM2,0.152);
    assert.equal(s.api.resolve({nama:'ACRYLIC BENING MC 2 MM - POSTER'},database).material.kgPerM2,2.308);
    assert.equal(s.api.resolve({nama:'STICKER VYNIL A3 NON LAMINATING'},database).material,null);
    const ambiguous=s.api.resolve({nama:'FLEXY FRONTLITE 380 HALEAD MV - SPANDUK'},database);
    assert.equal(ambiguous.source,'ambiguous');assert.equal(ambiguous.candidates.length,2);
    assert.equal(s.api.resolve({nama:'FLEXY FRONTLITE 380 HALEAD MV TYPE 383'},database).material.kgPerM2,0.384);
    assert.equal(s.api.resolve({nama:'FLEXY FRONTLITE 380 HALEAD MV TYPE380'},database).material.kgPerM2,0.392);
    assert.equal(s.api.resolve({nama:'FLEXY FRONTLITE 380 HALEAD MV TIPE 383'},database).material.kgPerM2,0.384);
    const disabled=database.find(row=>row.name==='ART PAPER');disabled.active=false;
    assert.equal(s.api.resolve({nama:'ART PAPER'},database).material,null);
});
test('aliases and manual overrides are explicit; unmatched manual IDs do not silently switch material',()=>{
    const s=setup();s.api.seed();const rows=s.api.read(),paper=rows.find(r=>r.name==='ART PAPER');
    paper.aliases=['KERTAS AP'];
    assert.equal(s.api.resolve({nama:'KERTAS AP DIGITAL'},rows).material.id,paper.id);
    assert.equal(s.api.resolve({nama:'ART PAPER',poolLine:{materialId:'missing'}},rows).material,null);
    const pvc=rows.find(r=>r.name==='PVC 1 MM');
    assert.equal(s.api.resolve({nama:'ART PAPER',poolLine:{materialId:pvc.id}},rows).material.id,pvc.id);
});
test('corrected type names migrate existing masters and old imports without changing IDs or edited rates',()=>{
    const s=setup([
        {id:'old-380',name:'FLEXY FRONTLITE 380 HALEAD MV',kgPerM2:0.4,aliases:['ALIAS UJI']},
        {id:'old-383',name:'FLEXY FRONTLITE 380 HALEAD MV (2)',kgPerM2:0.384,active:false}
    ]);
    s.data.set('wtrack_material_seed_v1','true');
    s.api.seed();
    const rows=s.api.read();
    assert.equal(rows.length,2);
    assert.equal(rows[0].name,'FLEXY FRONTLITE 380 HALEAD MV TYPE 380');
    assert.equal(rows[0].id,'old-380');assert.equal(rows[0].kgPerM2,0.4);
    assert.equal(rows[0].aliases[0],'ALIAS UJI');
    assert.equal(rows[1].name,'FLEXY FRONTLITE 380 HALEAD MV TYPE 383');
    assert.equal(rows[1].active,false);
    const merged=s.api.merge(rows,[{id:'imported',name:'FLEXY FRONTLITE 380 HALEAD MV (2)',kgPerM2:0.384}]);
    assert.equal(merged.added,0);assert.equal(merged.updated,1);
    assert.equal(merged.rows[1].id,'old-383');
});
test('SJ weight uses the matched measured rate and only adds lamination when selected',()=>{
    const s=setup();s.api.seed();
    vm.runInContext(fs.readFileSync(require.resolve('../js/pool_line_items.js'),'utf8'),s.c);
    const rows=s.api.read(),item={nama:'ART PAPER NON LAMINATING',ukuran:'1.35 x 0.55',qty:28};
    const calculate=s.window.PoolLineItems.calculate;
    assert.ok(Math.abs(calculate(item,rows).weightKg-3.16008)<1e-9);
    const lam=rows.find(r=>r.name==='LAMINASI DOFT');
    assert.ok(Math.abs(calculate({...item,poolLine:{finishingMaterialId:lam.id}},rows).weightKg-5.98752)<1e-9);
    assert.equal(calculate({...item,poolLine:{finishingMaterialId:'missing'}},rows).weightKg,null);
    assert.equal(calculate({nama:'LIPAT REL',qty:17,poolLine:{kind:'service'}},rows).weightKg,0);
});
test('master Excel parser validates sample conversion, rejects duplicates and preserves IDs on merge',()=>{
    const s=setup();
    const rows=[['No','Material','Berat 10x10 cm (gram)','Berat per 1 m² (gram)','Berat per 1 m² (KG)'],[1,'ART PAPER',1.52,152,0.152]];
    const wb={SheetNames:['Master'],Sheets:{Master:{}}},XLSX={utils:{sheet_to_json:()=>rows}};
    const incoming=s.api.parseWorkbook(wb,XLSX);
    assert.equal(incoming.length,1);
    const merged=s.api.merge([{id:'existing',name:'Art Paper',kgPerM2:1,aliases:['AP']}],incoming);
    assert.equal(merged.updated,1);assert.equal(merged.added,0);
    assert.equal(merged.rows[0].id,'existing');assert.equal(merged.rows[0].kgPerM2,0.152);
    rows.push([2,'ART PAPER',1.52,152,0.152]);
    assert.throws(()=>s.api.parseWorkbook(wb,XLSX),/duplikat/);
    rows.pop();rows[1][4]=1.52;
    assert.throws(()=>s.api.parseWorkbook(wb,XLSX),/Konversi/);
});

test('lamination auto-detects Doff/Doft and Glossy, excludes non-laminating and honors manual choices',()=>{
    const s=setup();s.api.seed();const rows=s.api.read();
    const doft=rows.find(row=>row.name==='LAMINASI DOFT'),glossy=rows.find(row=>row.name==='LAMINASI GLOSY');
    for(const nama of ['ALBATROS LAMINATING DOFF _ POSTER','Art Paper Laminasi Doft','ART PAPER LAM DOFF']) {
        assert.equal(s.api.resolveFinishing({nama},rows).material.id,doft.id,nama);
    }
    assert.equal(s.api.resolveFinishing({nama:'ART PAPER LAMINATING GLOSY'},rows).material.id,glossy.id);
    for(const nama of ['ART PAPER NON LAMINATING DOFF','ART PAPER NONLAMINATING DOFF','ART PAPER TANPA LAMINASI DOFT','ART PAPER']) {
        assert.equal(s.api.resolveFinishing({nama},rows).required,false,nama);
    }
    assert.equal(s.api.resolveFinishing({nama:'ART PAPER LAMINATING DOFF',poolLine:{finishingMaterialId:''}},rows).required,false);
    assert.equal(s.api.resolveFinishing({nama:'ART PAPER LAMINATING DOFF',poolLine:{finishingMaterialId:glossy.id}},rows).material.id,glossy.id);
    assert.equal(s.api.resolveFinishing({nama:'ART PAPER LAMINATING DOFF',poolLine:{finishingMaterialId:'auto'}},rows).material.id,doft.id);
});

test('auto-laminated weight includes measured lamination; missing or ambiguous finishing never becomes zero',()=>{
    const s=setup();s.api.seed();
    vm.runInContext(fs.readFileSync(require.resolve('../js/pool_line_items.js'),'utf8'),s.c);
    const rows=s.api.read(),base=rows.find(row=>row.name==='ALBATROS ECO SOLVENT');
    const item={nama:'Albatros Laminating Doff _ Poster',ukuran:'1.35 x 0.55',qty:28,poolLine:{materialId:base.id}};
    const result=s.window.PoolLineItems.calculate(item,rows);
    assert.equal(result.finishingSource,'auto');
    assert.equal(result.finishing.kgPerM2,0.136);
    assert.ok(Math.abs(result.weightKg-5.92515)<1e-9);
    const doft=rows.find(row=>row.name==='LAMINASI DOFT');doft.active=false;
    assert.equal(s.window.PoolLineItems.calculate(item,rows).weightKg,null);
    doft.active=true;
    rows.push({...doft,id:'second-doft',name:'LAMINASI DOFF'});
    assert.equal(s.api.resolveFinishing(item,rows).source,'ambiguous');
    assert.equal(s.window.PoolLineItems.calculate(item,rows).weightKg,null);
});

test('White Paper Board uses WPB as primary and adds vinyl sticker plus Doft as separate layers',()=>{
    const s=setup();s.api.seed();
    vm.runInContext(fs.readFileSync(require.resolve('../js/pool_line_items.js'),'utf8'),s.c);
    const rows=s.api.read(),item={nama:'White Paper Board 3MM Sticker Vynil Laminating Doff',ukuran:'1 x 1',qty:1};
    const result=s.window.PoolLineItems.calculate(item,rows);
    assert.equal(result.material.name,'WPB 3 MM');
    assert.equal(result.sticker.name,'STICKER VYNIL RITRAMA');
    assert.equal(result.finishing.name,'LAMINASI DOFT');
    assert.ok(Math.abs(result.weightKg-(0.589+0.273+0.136))<1e-12);
    const unspecified={...item,nama:'White Paper Board Sticker Vynil Laminating Doff'};
    assert.equal(s.api.resolve(unspecified,rows).source,'ambiguous');
    assert.equal(s.window.PoolLineItems.calculate(unspecified,rows).weightKg,null);
    const board5=rows.find(row=>row.name==='WPB 5 MM');
    const manual=s.window.PoolLineItems.calculate({...unspecified,poolLine:{materialId:board5.id}},rows);
    assert.ok(Math.abs(manual.weightKg-(0.683+0.273+0.136))<1e-12);
});

test('sticker layers are never counted twice and unresolved sticker variants remain incomplete',()=>{
    const s=setup();s.api.seed();
    vm.runInContext(fs.readFileSync(require.resolve('../js/pool_line_items.js'),'utf8'),s.c);
    const rows=s.api.read(),sticker=rows.find(row=>row.name==='STICKER VYNIL RITRAMA');
    const single={nama:'STICKER VYNIL RITRAMA LAMINATING DOFF',ukuran:'1 x 1',qty:1};
    assert.equal(s.api.resolveSticker(single,rows).required,false);
    assert.ok(Math.abs(s.window.PoolLineItems.calculate(single,rows).weightKg-(0.273+0.136))<1e-12);
    const composite={...single,nama:'WHITE PAPER BOARD 3 MM STICKER VYNIL LAMINATING DOFF'};
    assert.equal(s.window.PoolLineItems.calculate({...composite,poolLine:{materialId:sticker.id}},rows).weightKg,null);
    sticker.active=false;
    assert.equal(s.window.PoolLineItems.calculate(composite,rows).weightKg,null);
    sticker.active=true;
    rows.push({...sticker,id:'other-vinyl',name:'STICKER VINYL UJI'});
    assert.equal(s.api.resolveSticker(composite,rows).source,'ambiguous');
    assert.equal(s.window.PoolLineItems.calculate(composite,rows).weightKg,null);
    assert.equal(s.api.resolveSticker({...composite,nama:'WPB 3 MM STICKER VINYL RITRAMA'},rows).material.id,sticker.id);
});

test('Sticker Vynil Laminating Glossy resolves to Sticker Vynil Ritrama + Laminasi Glosy and Jasa defaults to 0',()=>{
    const s=setup();s.api.seed();
    vm.runInContext(fs.readFileSync(require.resolve('../js/pool_line_items.js'),'utf8'),s.c);
    const rows=s.api.read(),glossy=rows.find(row=>row.name==='LAMINASI GLOSY'),sticker=rows.find(row=>row.name==='STICKER VYNIL RITRAMA');
    const item={nama:'Sticker Vynil Laminating Glossy',ukuran:'1 x 2',qty:1};
    const result=s.window.PoolLineItems.calculate(item,rows);
    assert.equal(result.material.id,sticker.id);
    assert.equal(result.finishing.id,glossy.id);
    assert.ok(Math.abs(result.weightKg-2*(sticker.kgPerM2+glossy.kgPerM2))<1e-12);
    assert.equal(s.window.PoolLineItems.calculate({nama:'Jasa Pemasangan',ukuran:'',qty:'1'},rows).weightKg,0);
    assert.equal(s.window.PoolLineItems.calculate({nama:'Jasa Kirim',qty:'1',poolLine:{kind:'material'}},rows).weightKg,null);
});
