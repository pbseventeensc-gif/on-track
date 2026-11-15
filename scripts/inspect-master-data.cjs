// Read-only production audit. Credentials stay in the Vercel child-process environment.
const {initializeApp,cert}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
(async()=>{
    const credentials=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'{}');
    if(credentials.project_id!=='ontrack-fccb8')throw Error('Expected ontrack-fccb8 credentials');
    const db=getFirestore(initializeApp({credential:cert(credentials)}));
    const [clients,trips,materials,usage]=await Promise.all([
        db.collection('clients').get(),db.collection('trips').get(),
        db.collection('configuration').doc('material_master_v1').get(),
        db.collection('material_usage_sources').count().get()
    ]);
    const normalize=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const groups=new Map();
    clients.docs.forEach(doc=>{const row=doc.data(),key=normalize(row.name);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);});
    const tripRows=trips.docs.map(doc=>doc.data());
    const adminKeys=new Set(clients.docs.filter(doc=>doc.data().adminSJ).map(doc=>normalize(doc.data().name)));
    let activeStops=0,activeStopsWithAdmin=0;
    for(const trip of tripRows) {
        if(['completed','done','delivered'].includes(trip.status))continue;
        for(const dest of (trip.destinations?.length?trip.destinations:[{}])) {
            if(['completed','done','delivered'].includes(dest.status))continue;
            activeStops++;
            if(dest.adminSJ||trip.adminSJ||[dest.customer||trip.customer,dest.clientName||trip.clientName,dest.locationName].some(value=>adminKeys.has(normalize(value))))activeStopsWithAdmin++;
        }
    }
    console.log(JSON.stringify({customerDocuments:clients.size,uniqueCustomerKeys:groups.size,
        customersWithAdmin:clients.docs.filter(doc=>doc.data().adminSJ).length,
        duplicateCustomerKeys:[...groups.values()].filter(group=>group.length>1).length,
        conflictingCustomerKeys:[...groups.values()].filter(group=>new Set(group.map(row=>row.adminSJ).filter(Boolean)).size>1).length,
        tripDocuments:trips.size,tripsWithAdmin:tripRows.filter(trip=>trip.adminSJ||trip.destinations?.some(dest=>dest.adminSJ)).length,
        importedTrips:tripRows.filter(trip=>trip.sourceFile||String(trip.batchId||'').startsWith('BATCH_SJ_')).length,
        materialConfigurationExists:materials.exists,materialCount:materials.exists?materials.data().rows?.length:0,
        activeStops,activeStopsWithAdmin,activeStopsWithoutMatchingAdmin:activeStops-activeStopsWithAdmin,
        usageArchives:usage.data().count}));
})().catch(error=>{console.error('Master audit failed:',error.code||error.message);process.exitCode=1;});
