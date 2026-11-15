/* Shared material configuration and durable SJ usage archives. */
(function(root) {
    'use strict';
    let values=[],revision=0,loaded=false,loading=null,stop=null,usage=[];
    const db=()=>{const value=root.getDb?.();if(!value)throw Error('Firebase belum terhubung.');return value;};
    const ref=()=>db().collection('configuration').doc('material_master_v1');
    const sourceId=sj=>encodeURIComponent(String(sj||'').trim().toUpperCase());
    const notify=()=>{
        root.UnifiedPoolUI?.renderUnifiedPoolView();
        const view=root.document?.getElementById('view-material-master');
        if(view?.classList.contains('active')&&!root.document.getElementById('material-editor')?.open)root.MaterialMaster?.render();
    };
    async function ready() {
        if(root.WTRACK_LOCAL_SANDBOX)return;
        if(loaded)return values;
        if(loading)return loading;
        loading=(async()=>{
            const reference=ref();
            // A single transaction seeds exactly once. Existing edited rates always win.
            const result=await db().runTransaction(async tx=>{
                const snap=await tx.get(reference);
                if(snap.exists)return snap.data();
                const initial={rows:root.MaterialMaster.merge([],root.WtrackMaterialSeed||[]).rows,revision:1,updatedAt:new Date().toISOString()};
                tx.set(reference,initial);return initial;
            });
            if(!Array.isArray(result.rows))throw Error('Database bahan Firebase tidak valid.');
            values=result.rows;revision=result.revision||0;loaded=true;
            if(!stop)stop=reference.onSnapshot(snap=>{
                if(!snap.exists||snap.metadata?.hasPendingWrites)return;
                const data=snap.data();if(!Array.isArray(data.rows))return;
                values=data.rows;revision=data.revision||0;loaded=true;notify();
            },error=>root.showToast?.('Sinkronisasi bahan gagal: '+error.message));
            notify();return values;
        })().finally(()=>{loading=null;});
        return loading;
    }
    async function write(rows) {
        if(!loaded)throw Error('Master bahan belum dimuat. Buka menu Bahan terlebih dahulu.');
        const expected=revision,reference=ref();
        const next=await db().runTransaction(async tx=>{
            const snap=await tx.get(reference),current=snap.data();
            if(!snap.exists||current.revision!==expected)throw Error('Master bahan berubah dari perangkat lain. Muat ulang dan ulangi edit.');
            const data={rows,revision:expected+1,updatedAt:new Date().toISOString()};tx.set(reference,data);return data;
        });
        values=next.rows;revision=next.revision;notify();
    }
    function usageRecord(trip) {
        const noSJ=String(trip.noSJ||trip.sjNumber||'').trim();
        return {sjKey:noSJ.toUpperCase(),noSJ,sourceTripId:trip.id||trip.tripId||'',customer:trip.customer||trip.clientName||'',
            sourceFile:trip.sourceFile||'',sourceDocumentDate:trip.sourceDocumentDate||'',
            importedAt:trip.importedAt||trip.jobReceivedAt||trip.dateFolder||trip.date||'',
            items:JSON.parse(JSON.stringify(root.PoolLineItems?.itemsOf(trip)||trip.items||[]))};
    }
    function acceptUsage(records) {
        const merged=new Map(usage.map(row=>[row.sjKey,row]));records.forEach(row=>merged.set(row.sjKey,row));usage=[...merged.values()];
    }
    async function loadUsage() {
        await ready();
        const [archive,trips]=await Promise.all([
            db().collection('material_usage_sources').get({source:'server'}),db().collection('trips').get({source:'server'})
        ]);
        usage=archive.docs.map(doc=>doc.data());
        const live=trips.docs.map(doc=>({...doc.data(),id:doc.id}));
        const before=new Map(usage.map(row=>[row.sjKey,row]));
        const merged=root.MaterialUsage.mergeSources(usage,live);
        const updates=merged.filter(row=>!before.has(row.sjKey));
        // Backfill only missing archives; never overwrite a newer line edit from another PC.
        for(let start=0;start<updates.length;start+=150) {
            const group=updates.slice(start,start+150),activeDb=db();
            await activeDb.runTransaction(async tx=>{
                const refs=group.map(row=>activeDb.collection('material_usage_sources').doc(sourceId(row.noSJ)));
                const snapshots=await Promise.all(refs.map(ref=>tx.get(ref)));
                group.forEach((row,index)=>{if(!snapshots[index].exists)tx.set(refs[index],row);});
            });
        }
        usage=merged;return usage;
    }
    root.MaterialCloud={ready,write,loadUsage,usageRecord,sourceId,acceptUsage,
        read:()=>values.map(row=>({...row,aliases:[...(row.aliases||[])]})),sources:()=>usage,isReady:()=>loaded};
    root.document?.addEventListener('DOMContentLoaded',()=>{
        if(root.WTRACK_LOCAL_SANDBOX)return;
        root.getAuth?.()?.onAuthStateChanged(user=>{if(user)ready().catch(error=>root.showToast?.('Bahan belum dimuat: '+error.message));});
    });
})(typeof window!=='undefined'?window:globalThis);
