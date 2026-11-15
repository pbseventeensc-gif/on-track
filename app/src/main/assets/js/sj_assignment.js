/* Assign existing SJ documents atomically, keeping their IDs and delivery details. */
(function(root) {
    'use strict';
    const completed = row => ['done','completed','delivered'].includes(row?.status) || !!row?.completedTime || !!row?.completedAt;
    function assignTrip(source, courier, options = {}, now = new Date().toISOString()) {
        if (!courier?.id) throw Error('Pilih kurir terlebih dahulu.');
        if (source.courierId || source.assignedTo) throw Error('SJ sudah ditugaskan. Muat ulang atau batalkan penugasan sebelumnya.');
        if (completed(source) || source.destinations?.some(completed)) throw Error('SJ memiliki titik selesai; riwayat tidak boleh ditugaskan ulang.');
        if (source.pickupStatus || source.deliveryMethod === 'customer_pickup') throw Error('SJ memakai Pickup by Customer.');
        if (source.readyStatus === 'not_ready') throw Error('Barang belum siap kirim.');
        const destinations = source.destinations?.length ? source.destinations : [{
            stopIndex:1, locationName:source.storeDestination || source.customer || source.clientName || '',
            address:source.address || '', noSJ:source.noSJ || source.sjNumber || '', items:source.items || []
        }];
        return {...source, courierId:courier.id, courierName:courier.name, assignedTo:courier.name,
            assignedAt:now, acceptedTime:now, assignmentSource:'admin_region',
            status:'in_progress', deliveryStatus:'in_progress', isFailed:false, isPendingRollover:false,
            ...(courier.vehicleType ? {vehicleType:courier.vehicleType} : {}),
            ...(options.vehiclePlate ? {vehiclePlate:options.vehiclePlate} : {}),
            ...(source.failedAttempts?.length ? {pendingReason:'',pendingNote:'',pendingAt:null,pendingProofPhotoUrl:'',failedReason:null} : {}),
            destinations:destinations.map(d => ({...d,status:'in_progress',
                ...(d.failedAttempts?.length ? {pendingReason:'',pendingNote:'',pendingAt:null,pendingProofPhotoUrl:''} : {})}))};
    }
    async function assign(db, ids, courier, options = {}) {
        const unique = [...new Set(ids)];
        if (!unique.length) throw Error('Tidak ada SJ yang dipilih.');
        if (unique.length > 400) throw Error('Maksimal 400 SJ sekali penugasan. Pilih sebagian SJ terlebih dahulu.');
        if (!db) throw Error('Firebase belum terhubung. Penugasan belum disimpan.');
        const now = new Date().toISOString();
        return db.runTransaction(async tx => {
            const refs = unique.map(id => db.collection('trips').doc(id));
            const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
            const assigned = snapshots.map((snap, index) => {
                if (!snap.exists) throw Error('SJ sudah tidak tersedia. Muat ulang data.');
                const source = {...snap.data(),id:unique[index]};
                if (options.region && source.region !== options.region) throw Error('Region SJ berubah. Muat ulang data.');
                return assignTrip(source,courier,options,now);
            });
            assigned.forEach((trip,index) => tx.update(refs[index],trip));
            return assigned;
        });
    }
    async function setReady(db, ids, isReady) {
        if (!db) throw Error('Firebase belum terhubung.');
        const unique = [...new Set(ids)];
        if (!unique.length || unique.length > 400) throw Error('Pilih 1 sampai 400 SJ.');
        return db.runTransaction(async tx => {
            const refs = unique.map(id => db.collection('trips').doc(id));
            const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
            const updates = snapshots.map((snap,index) => {
                if (!snap.exists) throw Error('SJ tidak tersedia. Muat ulang.');
                const trip = {...snap.data(),id:unique[index]};
                if (trip.courierId || completed(trip)) throw Error('SJ sudah ditugaskan atau selesai. Muat ulang.');
                return {...trip,readyStatus:isReady ? 'ready' : 'not_ready'};
            });
            updates.forEach((trip,index) => tx.update(refs[index],{readyStatus:trip.readyStatus}));
            return updates;
        });
    }
    const api = {assignTrip,assign,setReady};
    root.SJAssignment = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
