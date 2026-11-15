/* Resolve older SJ without a saved Admin SJ from the shared customer master. */
(function(root) {
    'use strict';
    const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
    let lookup=new Map(),connection=null;
    function replace(rows) {
        const latest=new Map(),time=value=>value?.toMillis?.()||(value?.seconds?value.seconds*1000:Date.parse(value||'')||0);
        rows.forEach(row=>{
            const key=normalize(row.name),old=latest.get(key);
            if(!old||time(row.updatedAt)>time(old.updatedAt))latest.set(key,row);
        });
        lookup=new Map([...latest].map(([key,row])=>[key,String(row.adminSJ||'').trim()]));
        root.renderHomeScreen?.();root.renderShipmentsScreen?.();
    }
    function resolve(shipment) {
        for(const value of [shipment.customer,shipment.clientName,shipment.destination,shipment.storeDestination]) {
            const name=lookup.get(normalize(value));if(name)return name;
        }
        return '';
    }
    function connect(db) {
        if(root.WTRACK_LOCAL_SANDBOX||connection)return;
        connection=db.collection('clients').where('adminSJ','!=','').onSnapshot(snapshot=>{
            replace(snapshot.docs.map(doc=>doc.data()));
        },error=>{console.warn('Admin SJ master belum tersedia:',error.code||error.message);connection=null;});
    }
    root.CourierAdminSJ={connect,resolve,replace};
    function readLocal() {
        if(!root.WTRACK_LOCAL_SANDBOX)return;
        try {replace(JSON.parse(root.localStorage.getItem('wtrack_local_clients')||'[]'));}
        catch { /* Saved SJ names remain visible when the local master is unreadable. */ }
    }
    root.document?.addEventListener('DOMContentLoaded',readLocal);
    root.addEventListener?.('storage',readLocal);
})(typeof window!=='undefined'?window:globalThis);
