/* Claim a pooled SJ only after a courier scans its exact identity. */
(function(root) {
    'use strict';
    const clean = value => String(value || '').trim().replace(/^#/, '').toUpperCase();
    const done = row => ['done','completed','delivered'].includes(row?.status) || !!row?.completedTime || !!row?.completedAt;
    function matches(trip, parsed) {
        if (parsed.tripId) return [trip.id,trip.tripId].some(value => clean(value) === clean(parsed.tripId));
        if (parsed.sjNumber) return [trip.noSJ,trip.sjNumber].some(value => clean(value) === clean(parsed.sjNumber));
        if (parsed.shortCode) return [trip.shortCode,trip.uniqueCode].some(value => clean(value) === clean(parsed.shortCode));
        return false;
    }
    function claim(trips, parsed, courier, owns, now = new Date().toISOString()) {
        const uid = courier?.uid || courier?.id;
        if (!uid) throw Error('Login sebagai kurir terlebih dahulu.');
        const candidates = trips.filter(trip => matches(trip, parsed));
        if (!candidates.length) throw Error('SJ tidak ditemukan di Pool. Import dan simpan SJ terlebih dahulu.');
        if (candidates.length !== 1) throw Error('Identitas SJ ganda. Periksa data dengan admin.');
        const source = candidates[0];
        if (done(source) || source.destinations?.length && source.destinations.every(done)) throw Error('SJ sudah selesai diantar.');
        if (source.pickupStatus || source.deliveryMethod === 'customer_pickup') throw Error('SJ ini memakai Pickup by Customer.');
        if (source.readyStatus === 'not_ready') throw Error('Barang belum siap kirim. Hubungi admin.');
        if (source.courierId || source.assignedTo) {
            const sameCourier = owns ? owns(source) : source.courierId === uid;
            if (!sameCourier) throw Error('SJ sudah ditugaskan ke kurir lain. Hubungi admin.');
            return {trips,trip:source,alreadyAssigned:true};
        }
        const trip = {...source,status:'in_progress',deliveryStatus:'in_progress',courierId:uid,
            courierName:courier.name || courier.displayName || 'Kurir',
            assignedTo:courier.name || courier.displayName || 'Kurir',assignedAt:now,acceptedTime:now,
            assignmentSource:'qr_scan',isFailed:false,isPendingRollover:false,failedReason:null,
            ...(source.failedAttempts?.length ? {pendingReason:'',pendingNote:'',pendingAt:null,pendingProofPhotoUrl:''} : {}),
            destinations:(source.destinations || []).map(d => done(d) ? {...d} : {...d,status:'in_progress',
                ...(d.failedAttempts?.length ? {pendingReason:'',pendingNote:'',pendingAt:null,pendingProofPhotoUrl:''} : {})})};
        return {trips:trips.map(row => row === source ? trip : row),trip,alreadyAssigned:false};
    }
    async function claimOnline(db, parsed, courier, owns) {
        if (!db) throw Error('Server tidak terhubung. SJ belum diambil.');
        const collection = db.collection('trips');
        const candidates = new Map();
        if (parsed.tripId) {
            const snap = await collection.doc(parsed.tripId).get({source:'server'});
            if (snap.exists) candidates.set(snap.id, snap);
        } else {
            const lookups = parsed.sjNumber ? [['noSJ',parsed.sjNumber],['sjNumber',parsed.sjNumber]] :
                parsed.shortCode ? [['shortCode',parsed.shortCode],['uniqueCode',parsed.shortCode]] : [];
            for (const [field,value] of lookups) {
                const snap = await collection.where(field,'==',value).limit(2).get({source:'server'});
                snap.docs.forEach(doc => candidates.set(doc.id,doc));
            }
            // Legacy QR codes may contain a document ID directly.
            if (!candidates.size && !parsed.sjNumber && !parsed.shortCode && parsed.raw && !parsed.raw.includes('/')) {
                const snap = await collection.doc(parsed.raw).get({source:'server'});
                if (snap.exists) candidates.set(snap.id,snap);
            }
        }
        if (!candidates.size) throw Error('SJ tidak ditemukan di Pool. Import dan simpan SJ terlebih dahulu.');
        if (candidates.size !== 1) throw Error('Identitas SJ ganda. Periksa data dengan admin.');
        const id = [...candidates.keys()][0];
        return db.runTransaction(async tx => {
            const ref = collection.doc(id), snap = await tx.get(ref);
            if (!snap.exists) throw Error('SJ sudah tidak tersedia. Muat ulang.');
            const trip = {...snap.data(),id};
            const identity = parsed.tripId || parsed.sjNumber || parsed.shortCode ? parsed : {tripId:id};
            const result = claim([trip],identity,courier,owns);
            if (!result.alreadyAssigned) tx.update(ref,result.trip);
            return result;
        });
    }
    const api = {matches,claim,claimOnline};
    root.QRClaim = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
