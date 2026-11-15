// Explicit, repeatable release migration. Dry-run by default; --apply writes masters only.
const {initializeApp,cert}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
(async()=>{
    const apply=process.argv.includes('--apply'),source=process.argv.find(arg=>arg.startsWith('--source='))?.slice(9);
    if(!source)throw Error('Supply --source=/absolute/path/to/customer-rows.json');
    const credentials=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'{}');
    if(credentials.project_id!=='ontrack-fccb8')throw Error('Expected ontrack-fccb8 credentials');
    const db=getFirestore(initializeApp({credential:cert(credentials)}));
    const browserAdapter={collection:name=>{const col=db.collection(name);return {doc:id=>col.doc(id),get:()=>col.get(),onSnapshot:()=>()=>{}};},runTransaction:callback=>db.runTransaction(async tx=>await callback(tx))};
    const window={getDb:()=>browserAdapter,document:{getElementById:()=>null,addEventListener(){}},WTRACK_LOCAL_SANDBOX:false};
    const context=vm.createContext({window,Date,Intl});
    for(const file of ['customer_master','material_seed','material_master'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file+'.js'),'utf8'),context);
    const incoming=JSON.parse(fs.readFileSync(source,'utf8'));
    const parsed=window.CustomerMaster.parseRows(incoming.map(([name,admin])=>({'Nama customer':name,'ADMIN SJ':admin})));
    const [customers,configuration]=await Promise.all([db.collection('clients').get(),db.collection('configuration').doc('material_master_v1').get()]);
    const existing=customers.docs.map(doc=>({...doc.data(),id:doc.id}));
    const plans=window.CustomerMaster.planImport(existing,parsed.records);
    console.log(JSON.stringify({mode:apply?'apply':'dry-run',sourceRows:incoming.length,uniqueCustomers:parsed.records.length,
        added:plans.filter(p=>p.kind==='added').length,updated:plans.filter(p=>p.kind==='updated').length,skipped:plans.filter(p=>p.kind==='skipped').length,
        materials:configuration.exists?'preserve-existing':'seed-61',historicalTrips:'unchanged'}));
    if(apply) {
        const directory=path.join(__dirname,'../.artifacts/admin-sj-release-2026-11-14');fs.mkdirSync(directory,{recursive:true});
        fs.writeFileSync(path.join(directory,'masters-before-'+Date.now()+'.json'),JSON.stringify({customers:existing,materials:configuration.exists?configuration.data():null}));
        const counts=await window.CustomerMaster.upsert(parsed.records);
        const materialRef=db.collection('configuration').doc('material_master_v1');
        const materialResult=await db.runTransaction(async tx=>{
            const snap=await tx.get(materialRef);if(snap.exists)return 'preserved';
            const rows=window.MaterialMaster.merge([],window.WtrackMaterialSeed).rows;
            if(rows.length!==61)throw Error('Expected 61 measured materials');
            tx.set(materialRef,{rows,revision:1,updatedAt:new Date().toISOString()});return 'seeded-61';
        });
        console.log(JSON.stringify({customerImport:counts,materials:materialResult}));
    }
    await db.terminate();
})().catch(error=>{console.error('Master synchronization failed:',error.code||error.message||String(error));process.exitCode=1;});
