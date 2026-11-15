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
            destinations:(source.destinations || []).map(d => done(d) ? {...d} : {...d,status:'in_progress'})};
        return {trips:trips.map(row => row === source ? trip : row),trip,alreadyAssigned:false};
    }
    const api = {matches,claim};
    root.QRClaim = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
