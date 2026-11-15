const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function engine(rows, options = {}) {
  const messages = [];
  let currentRows = rows;
  const data = new Map([['wtrack_local_trips', JSON.stringify(options.stored || [])]]);
  const window = {WTRACK_LOCAL_SANDBOX:!!options.local, getDb:()=>null, showToast:message=>messages.push(message), MaterialUsage:options.usage, WTRACK_LOCAL_AUTO_ASSIGN_COURIER:options.autoCourier, MASTER_COURIERS:options.couriers,
    getCustomerAdminSJLookup:options.adminSJLookup ? async()=>new Map(Object.entries(options.adminSJLookup)) : undefined};
  const localStorage = {getItem:key=>data.get(key)||null, setItem:(key,value)=>{
    if (options.quota) throw new Error('QuotaExceededError');
    data.set(key,value);
  }};
  const document = {getElementById:id=>options.elements?.[id] || null, querySelector:()=>null,
    querySelectorAll:()=>(options.selected || [0]).map(index=>({getAttribute:()=>String(index)}))};
  const context = vm.createContext({window, localStorage, document, alert:message=>messages.push(message),
    console:options.local ? {warn(){},error(){},log(){}} : console,
    XLSX: {read:()=>({SheetNames:['SJ'], Sheets:{SJ:{}}}), utils:{sheet_to_json:()=>currentRows}},
    FileReader: class {readAsArrayBuffer(file) {currentRows=options.rowsByFile?.[file.name] || rows; this.onload({target:{result:new ArrayBuffer(0)}});}}
  });
  vm.runInContext(fs.readFileSync('js/sj_import_engine.js','utf8'), context);
  window.SJImportEngine.testState = {window, data, messages};
  return window.SJImportEngine;
}
test('tabular delivery lists preserve customers and every SJ instead of using printed-form defaults', async()=>{
  const rows = [
    ['No SJ','Customer','Alamat','Nama Barang','Qty'],
    ['SJ-LOCAL-0001','Klien Satu','Jakarta Selatan','Brosur',3],
    ['SJ-LOCAL-0002','Klien Dua','Bogor','Poster',5]
  ];
  const parsed = await engine(rows).parseExcelFile({name:'deliveries.xlsx'});
  assert.equal(parsed.length,2);
  assert.equal(parsed[0].clientName,'Klien Satu');
  assert.equal(parsed[1].clientName,'Klien Dua');
  assert.equal(parsed[0].address,'Jakarta Selatan');
  assert.equal(parsed[1].sjNumber,'SJ-LOCAL-0002');
  assert.equal(parsed[0].qty,'3 Pcs');
});
test('import keeps the billing customer separate from the delivery store',async()=>{
 const api=engine([
  ['No SJ','Customer','Store','Alamat Kirim','Nama Barang','Qty'],
  ['SJ-STORE-0001','PT CUSTOMER PENAGIHAN','Genki Sushi Kota Kasablanka','Jalan Casablanca','Poster',2]
 ],{local:true});
 const rows=await api.parseExcelFile({name:'stores.xlsx'});
 assert.equal(rows[0].clientName,'PT CUSTOMER PENAGIHAN');
 assert.equal(rows[0].storeDestination,'Genki Sushi Kota Kasablanka');
 await api.commitImportBatch();
 const trip=JSON.parse(api.testState.data.get('wtrack_local_trips'))[0];
 assert.equal(trip.customer,'PT CUSTOMER PENAGIHAN');
 assert.equal(trip.destinations[0].locationName,'Genki Sushi Kota Kasablanka');
 assert.equal(trip.destinations[0].storeDestination,'Genki Sushi Kota Kasablanka');
 assert.equal(trip.destinations[0].address,'Jalan Casablanca');
});
test('SJ import maps the Admin SJ Excel column into trip and stop data',async()=>{
 const api=engine([
  ['No SJ','Customer','Admin SJ','Alamat','Nama Barang','Qty'],
  ['SJ-ADMIN-0001','PT CUSTOMER UJI','Admin Contoh','Jakarta Barat','Poster',1]
 ],{local:true});
 const [row]=await api.parseExcelFile({name:'admin-sj.xlsx'});
 assert.equal(row.adminSJ,'Admin Contoh');
 await api.commitImportBatch();
 const trip=JSON.parse(api.testState.data.get('wtrack_local_trips'))[0];
 assert.equal(trip.adminSJ,'Admin Contoh');
 assert.equal(trip.destinations[0].adminSJ,'Admin Contoh');
});
test('SJ import fills a missing Admin SJ from the customer database by normalized customer name',async()=>{
 const api=engine([
  ['No SJ','Nama Customer','Alamat','Nama Barang','Qty'],
  ['SJ-ADMIN-0002','PT CUSTOMER-UJI','Bekasi','Brosur',2]
 ],{adminSJLookup:{ptcustomeruji:'Admin Master'}});
 const [row]=await api.parseExcelFile({name:'customer-map.xlsx'});
 assert.equal(row.adminSJ,'Admin Master');
});
test('printed forms retain customer and items, and never invent a real customer when absent',async()=>{
  const rows = [['SURAT JALAN SJ-LOCAL-0123'], ['Kepada Yth'], ['PT KLIEN UJI'], ['STORE TUJUAN JAKARTA'], ['No','Nama Barang','Ukuran','Qty'], [1,'Poster','A3',2]];
  const parsed = await engine(rows).parseExcelFile({name:'printed.csv'});
  assert.equal(parsed[0].clientName,'PT KLIEN UJI');
  assert.equal(parsed[0].items[0].nama,'Poster');
  assert.equal(parsed[0].items[0].qty,'2');
  const incomplete = await engine([['SURAT JALAN SJ-LOCAL-0124'], ['No','Nama Barang','Ukuran','Qty'], [1,'Poster','A3',2]]).parseExcelFile({name:'incomplete.csv'});
  assert.equal(incomplete[0].clientName,'Customer / Klien');
});
test('local import preserves more than 500 records and skips a fully duplicate upload', async()=>{
  const stored=Array.from({length:500},(_,i)=>({id:'old-'+i,noSJ:'SJ-OLD-'+i}));
  const api=engine([['No SJ','Customer','Alamat','Nama Barang','Qty'],['SJ-NEW-0001','Klien','Bogor','Poster',2]],{local:true,stored});
  await api.parseExcelFile({name:'new.xlsx'});
  await api.commitImportBatch();
  let saved=JSON.parse(api.testState.data.get('wtrack_local_trips'));
  assert.equal(saved.length,501);
  assert.equal(saved[0].sourceFile,'new.xlsx');
  await api.parseExcelFile({name:'duplicate.xlsx'});
  await api.commitImportBatch();
  saved=JSON.parse(api.testState.data.get('wtrack_local_trips'));
  assert.equal(saved.length,501);
  assert.ok(api.testState.messages.some(m=>m.includes('duplikat')));
});
test('local quota failure reports failure without adding trips to memory or claiming success',async()=>{
  const captured=[];
  const api=engine([['No SJ','Customer','Alamat','Nama Barang','Qty'],['SJ-QUOTA-0001','Klien','Bogor','Poster',2]],{local:true,quota:true,usage:{capture:trips=>captured.push(trips)}});
  await api.parseExcelFile({name:'quota.xlsx'});
  await api.commitImportBatch();
  assert.equal(api.testState.data.get('wtrack_local_trips'),'[]');
  assert.equal(api.testState.window.allCurrentTrips,undefined);
  assert.equal(captured.length,0);
  assert.ok(api.testState.messages.some(m=>m.includes('browser penuh')));
  assert.ok(!api.testState.messages.some(m=>/Berhasil|berhasil/.test(m)));
});

test('local folder import skips six previously imported SJ and saves the four new SJ with their items', async()=>{
  const header = ['No SJ','Customer','Alamat','Nama Barang','Qty'];
  const files = Array.from({length:10},(_,i)=>({name:`sj-${i+1}.xlsx`}));
  const rowsByFile = Object.fromEntries(files.map((file,i)=>[file.name,[header,[`SJ-MIX-${i+1}`,`Klien ${i+1}`,'Bogor',`Poster ${i+1}`,i+1]]]));
  const stored = Array.from({length:6},(_,i)=>({id:`old-${i}`,noSJ:`SJ-MIX-${i+1}`,status:'completed',proofPhotoUrl:'existing-proof'}));
  const elements = {
    'modal-sj-import-preview':{querySelector:()=>null},
    'sj-import-count-badge':{},
    'sj-import-preview-tbody':{innerHTML:''}
  };
  const api = engine([], {local:true, stored, rowsByFile, elements, selected:[6,7,8,9]});
  await api.processMultipleExcelFiles(files);
  assert.match(elements['sj-import-count-badge'].innerText,/10 SJ terbaca.*6 duplikat dilewati.*4 siap disimpan/);
  const preview = () => elements['sj-import-preview-tbody'].innerHTML;
  assert.equal((preview().match(/preview-row-checkbox/g)||[]).length,4);
  assert.ok(!preview().includes('SJ-MIX-1<'));
  assert.ok(!preview().includes('dilewati'));
  assert.ok(preview().includes('data-index="6"'));
  api.filterPreviewTable('SJ-MIX-2');
  assert.ok(!preview().includes('preview-row-checkbox'));
  api.filterPreviewTable('');
  assert.equal((preview().match(/preview-row-checkbox/g)||[]).length,4);
  await api.commitImportBatch();
  const saved = JSON.parse(api.testState.data.get('wtrack_local_trips'));
  assert.equal(saved.length,10);
  assert.deepEqual(saved.filter(t=>t.id.startsWith('old-')),stored);
  for (let i=7;i<=10;i++) {
    const trip=saved.find(t=>t.noSJ===`SJ-MIX-${i}`);
    assert.equal(trip.status,'pool');
    assert.equal(trip.customer,`Klien ${i}`);
    assert.equal(trip.items[0].nama,`Poster ${i}`);
    assert.equal(trip.sourceFile,`sj-${i}.xlsx`);
  }
  assert.ok(api.testState.messages.some(m=>/mengimpor 4.*6 SJ duplikat dilewati/.test(m)));
});

test('fully duplicate local preview shows an empty state and does not save anything',async()=>{
  const elements={'modal-sj-import-preview':{querySelector:()=>null},'sj-import-preview-tbody':{innerHTML:''},'sj-import-count-badge':{}};
  const stored=[{id:'old',noSJ:'SJ-EXIST-1',status:'completed'}];
  const api=engine([['No SJ','Customer','Alamat','Nama Barang','Qty'],['SJ-EXIST-1','Klien','Bogor','Poster',1]],{local:true,stored,elements,selected:[]});
  await api.processMultipleExcelFiles([{name:'old.xlsx'}]);
  assert.match(elements['sj-import-preview-tbody'].innerHTML,/Tidak ada SJ baru/);
  assert.ok(!elements['sj-import-preview-tbody'].innerHTML.includes('preview-row-checkbox'));
  await api.commitImportBatch();
  assert.deepEqual(JSON.parse(api.testState.data.get('wtrack_local_trips')),stored);
  assert.ok(api.testState.messages.some(m=>m.includes('Tidak ada SJ baru yang disimpan')));
});

test('local import keeps one copy of a new SJ repeated in the same upload and accepts other SJ',async()=>{
  const rows=[['No SJ','Customer','Alamat','Nama Barang','Qty'],
    ['SJ-REPEAT-1','Klien A','Bogor','Poster A',1],
    [' sj-repeat-1 ','Klien A','Bogor','Poster duplikat',1],
    ['SJ-REPEAT-2','Klien B','Bekasi','Poster B',2]];
  const api=engine(rows,{local:true,selected:[0,1,2]});
  await api.parseExcelFile({name:'repeated.xlsx'});
  await api.commitImportBatch();
  const saved=JSON.parse(api.testState.data.get('wtrack_local_trips'));
  assert.equal(saved.length,2);
  assert.equal(saved.find(t=>t.noSJ==='SJ-REPEAT-1').items[0].nama,'Poster A');
  assert.ok(api.testState.messages.some(m=>/1 SJ duplikat dilewati/.test(m)));
});

test('local save rechecks SJ imported after preview without blocking remaining new SJ',async()=>{
  const rows=[['No SJ','Customer','Alamat','Nama Barang','Qty'],
    ['SJ-RACE-1','Klien A','Bogor','Poster A',1],['SJ-RACE-2','Klien B','Bekasi','Poster B',2]];
  const api=engine(rows,{local:true,selected:[0,1]});
  await api.parseExcelFile({name:'race.xlsx'});
  const other={id:'other-tab',noSJ:' sj-race-1 ',status:'in_progress'};
  api.testState.data.set('wtrack_local_trips',JSON.stringify([other]));
  await api.commitImportBatch();
  const saved=JSON.parse(api.testState.data.get('wtrack_local_trips'));
  assert.equal(saved.length,2);
  assert.deepEqual(saved.find(t=>t.id==='other-tab'),other);
  assert.equal(saved.find(t=>t.noSJ==='SJ-RACE-2').status,'pool');
});
test('printed forms flag incorrect TOTAL without changing source quantities',async()=>{
  const rows=[['SURAT JALAN SJ-1126-01287'],['Kepada Yth'],['PT KLIEN UJI'],['No','Nama Barang','Ukuran','Qty'],
    [1,'Poster','A3',3],[2,'Brosur','A4',2],[3,'Stiker','A5',1],[4,'Papan','A3',2],[5,'Logo','A3',1],[6,'Cover','A3',1],[7,'Header','A3',1],['TOTAL','','',10]];
  const [parsed]=await engine(rows).parseExcelFile({name:'sample.xls'});
  assert.equal(parsed.items.length,7);
  assert.equal(parsed.items[0].qty,'3');
  assert.equal(parsed.sourceQuantityTotal,10);
  assert.equal(parsed.itemQuantityTotal,11);
  assert.match(parsed.quantityWarning,/TOTAL dokumen 10.*Qty barang 11/);
  assert.equal(parsed.qty,'10 Pcs');
  rows[rows.length - 1][3]=11;
  const [correct]=await engine(rows).parseExcelFile({name:'corrected.xls'});
  assert.equal(correct.quantityWarning,'');
});

test('SJ import preserves the document date and item size for Usage, independently from import date',async()=>{
  const printed=[['SURAT JALAN SJ-DATE-1001'],['Kepada Yth'],['PT KLIEN UJI'],['No','Nama Barang','Ukuran','Qty'],
    [1,'ART PAPER','1.35 x 0.55',28],['TOTAL','','',28],['Tgl',':','11 Nov 2026 22:58:01']];
  const captured=[];
  const api=engine(printed,{local:true,usage:{capture:trips=>captured.push(trips)}});
  const parsed=await api.parseExcelFile({name:'dated.xlsx'});
  assert.equal(parsed[0].sourceDocumentDate,'2026-11-11');
  await api.commitImportBatch();
  const stored=JSON.parse(api.testState.data.get('wtrack_local_trips'))[0];
  assert.equal(stored.sourceDocumentDate,'2026-11-11');
  assert.ok(stored.importedAt);
  assert.equal(stored.items[0].ukuran,'1.35 x 0.55');
  assert.equal(captured.length,1);
  const tabular=engine([['No SJ','Customer','Alamat','Nama Barang','Ukuran','Qty','Tanggal'],['SJ-DATE-2','Klien','Bogor','ART PAPER','1.35 x 0.55',28,'12/11/2026']],{local:true});
  await tabular.parseExcelFile({name:'table.xlsx'});await tabular.commitImportBatch();
  const row=JSON.parse(tabular.testState.data.get('wtrack_local_trips'))[0];
  assert.equal(row.sourceDocumentDate,'2026-11-12');
  assert.equal(row.items[0].nama,'ART PAPER');
  assert.equal(row.items[0].ukuran,'1.35 x 0.55');
});


test('local imports stay unassigned in Pool even when a stale tab retains the old auto-assign flag',async()=>{
 const existing={id:'existing',noSJ:'SJ-OLD',courierId:'other-courier',status:'completed'};
 const api=engine([['No SJ','Customer','Alamat','Nama Barang','Qty'],['SJ-AUTO-0001','Klien','Jakarta Barat','Poster',2]],{local:true,stored:[existing],autoCourier:'pbseventeensc',couriers:[{canonicalId:'pbseventeensc',defaultUid:'pb-uid',displayName:'pbseventeensc'}]});
 await api.parseExcelFile({name:'new.xlsx'});await api.commitImportBatch();
 const saved=JSON.parse(api.testState.data.get('wtrack_local_trips'));
 assert.equal(saved[0].courierId,'');assert.equal(saved[0].status,'pool');assert.equal(saved[0].destinations[0].status,'pending');assert.equal(saved[0].items[0].nama,'Poster');assert.deepEqual(saved[1],existing);assert.equal(api.testState.window.allPoolTrips.length,1);
 assert.ok(!api.testState.messages.some(m=>m.includes('otomatis ditugaskan')));
});
