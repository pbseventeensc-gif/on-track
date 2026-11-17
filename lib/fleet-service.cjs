const {createHash} = require('node:crypto');
const REQUESTS = 'fleet_service_requests';
const PHOTOS = 'fleet_service_photos';
const CONFIG = 'fleet_service_config';
const MAX_PHOTO_BYTES = 180 * 1024;
class ServiceError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new ServiceError(status, message); };
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const isId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(value);
const roles = value => ['super_admin', 'superadmin'].includes(String(value || '').toLowerCase());
function validatePhotos(photos) {
    if (!Array.isArray(photos) || photos.length < 2 || photos.length > 6) fail(400, 'Unggah 2–6 foto kerusakan yang berbeda.');
    const seen = new Set();
    return photos.map(photo => {
        const match = typeof photo === 'string' && /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo);
        if (!match || match[2].length > MAX_PHOTO_BYTES * 4 / 3 + 4) fail(400, 'Format atau ukuran foto tidak valid. Maksimal 180 KB setelah kompresi.');
        const bytes = Buffer.from(match[2], 'base64');
        const valid = match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 :
            match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
                bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
        if (!valid || bytes.length < 16 || bytes.length > MAX_PHOTO_BYTES) fail(400, 'File harus berupa foto JPEG, PNG, atau WebP yang valid.');
        const hash = createHash('sha256').update(bytes).digest('hex');
        if (seen.has(hash)) fail(400, 'Foto duplikat. Gunakan sudut kerusakan yang berbeda.');
        seen.add(hash);
        return {data: photo, mime: `image/${match[1]}`};
    });
}
function cleanVehicles(list) {
    if (!Array.isArray(list) || list.length > 200) fail(400, 'Daftar armada tidak valid.');
    const ids = new Set(), plates = new Set();
    return list.map(v => {
        const id = text(v?.id, 80), plate = text(v?.plate_number, 30).toUpperCase();
        if (!id || !/^[A-Za-z0-9_-]+$/.test(id) || !plate || ids.has(id) || plates.has(plate)) fail(400, 'ID atau nomor polisi armada tidak valid / duplikat.');
        ids.add(id); plates.add(plate);
        return {id, plate_number: plate, vehicle_category: text(v.vehicle_category, 30),
            assigned_person_id: text(v.assigned_person_id, 128), assigned_person_name: text(v.assigned_person_name, 120)};
    });
}
function eligible(caller, vehicles, config) {
    const account = config.accounts.find(a => a.uid === caller.uid);
    if (caller.uid === config.testingUid || account?.driver || String(caller.role || '').toLowerCase().startsWith('driver')) return true;
    return vehicles.some(v => v.assigned_person_id === caller.uid || (account &&
        (v.assigned_person_id === account.id || v.assigned_person_name.toLowerCase() === account.name.toLowerCase())));
}
function createFleetServiceHandler({auth, db, adminUids = [], config, now = Date.now}) {
    return async function handler(req, res) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({error: 'Metode tidak diizinkan.'});
        try {
            const bearer = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
            if (!bearer) fail(401, 'Silakan login kembali.');
            let caller;
            try { caller = await auth.verifyIdToken(bearer[1], true); }
            catch { fail(401, 'Sesi login tidak valid atau sudah dicabut.'); }
            if (!caller.uid || caller.firebase?.sign_in_provider === 'anonymous') fail(401, 'Login dengan akun driver Anda.');
            if ((await db.collection('account_deletions').doc(caller.uid).get()).exists) fail(403, 'Akun sudah dinonaktifkan.');
            // Editable browser state and users/{uid}.role never confer approval permission.
            const canReview = adminUids.includes(caller.uid) || roles(caller.role);
            const fleetDoc = await db.collection(CONFIG).doc('registry').get();
            const vehicles = fleetDoc.exists ? fleetDoc.data().vehicles : config.vehicles;
            const canSubmit = eligible(caller, vehicles, config);
            const action = req.method === 'GET' ? (req.query?.action || 'bootstrap') : req.body?.action;
            if (action === 'bootstrap' && req.method === 'GET') return res.status(200).json({canSubmit, canReview,
                vehicles: canSubmit || canReview ? vehicles : [], registryVersion: fleetDoc.exists ? (fleetDoc.data().version || 0) : 0, testing: caller.uid === config.testingUid,
                requesterName: config.accounts.find(a => a.uid === caller.uid)?.name || caller.name || caller.email || caller.uid});
            if (action === 'syncFleet' && req.method === 'POST') {
                if (!canReview) fail(403, 'Hanya Super Admin yang boleh menyinkronkan armada.');
                const list = cleanVehicles(req.body.vehicles);
                const ref = db.collection(CONFIG).doc('registry');
                const version = await db.runTransaction(async tx => {
                    const doc = await tx.get(ref);
                    const currentVersion = doc.exists ? (doc.data().version || 0) : 0;
                    if (req.body.expectedVersion !== currentVersion) fail(409, 'Daftar armada berubah di perangkat lain. Muat ulang sebelum menyinkronkan.');
                    tx.set(ref, {vehicles: list, version: currentVersion + 1, updatedBy: caller.uid, updatedAt: now()});
                    return currentVersion + 1;
                });
                return res.status(200).json({synced: true, version});
            }
            if (action === 'list' && req.method === 'GET') {
                // Previous requests remain readable even after a driver changes assignments.
                const query = canReview && req.query?.scope === 'admin' ? db.collection(REQUESTS) :
                    db.collection(REQUESTS).where('requesterUid', '==', caller.uid);
                const snapshot = await query.orderBy('createdAt', 'desc').limit(100).get();
                return res.status(200).json({requests: snapshot.docs.map(doc => ({...doc.data(), id: doc.id}))});
            }
            if (action === 'photo' && req.method === 'GET') {
                const id = req.query?.id;
                if (!isId(id)) fail(400, 'ID foto tidak valid.');
                const doc = await db.collection(PHOTOS).doc(id).get();
                if (!doc.exists) fail(404, 'Foto tidak ditemukan.');
                const photo = doc.data();
                if (!canReview && photo.requesterUid !== caller.uid) fail(403, 'Anda tidak memiliki akses ke foto ini.');
                return res.status(200).json({data: photo.data});
            }
            if (action === 'submit' && req.method === 'POST') {
                if (!canSubmit) fail(403, 'Pengajuan khusus akun driver atau personel Fleet Inventory.');
                const body = req.body;
                if (!isId(body.id)) fail(400, 'ID pengajuan tidak valid.');
                const vehicle = vehicles.find(v => v.id === body.vehicleId);
                const description = text(body.description, 2000), odometer = text(body.odometer, 40);
                if (!vehicle || description.length < 10) fail(400, 'Pilih armada dan jelaskan kerusakan minimal 10 karakter.');
                if (odometer && !/^[0-9.,\s]+(?:km)?$/i.test(odometer)) fail(400, 'Kilometer kendaraan tidak valid.');
                const photos = validatePhotos(body.photos);
                const requestRef = db.collection(REQUESTS).doc(body.id);
                const record = await db.runTransaction(async tx => {
                    const existing = await tx.get(requestRef);
                    if (existing.exists) {
                        if (existing.data().requesterUid !== caller.uid) fail(409, 'ID pengajuan sudah digunakan.');
                        return existing.data();
                    }
                    const stamp = now();
                    const photoIds = photos.map((photo, index) => `${body.id}_${index}`);
                    const data = {requesterUid: caller.uid,
                        requesterName: config.accounts.find(a => a.uid === caller.uid)?.name || caller.name || caller.email || caller.uid,
                        vehicleId: vehicle.id, plateNumber: vehicle.plate_number, description, odometer,
                        status: 'pending', photoIds, testing: caller.uid === config.testingUid,
                        createdAt: stamp, updatedAt: stamp};
                    photos.forEach((photo, index) => tx.set(db.collection(PHOTOS).doc(photoIds[index]),
                        {...photo, requestId: body.id, requesterUid: caller.uid, createdAt: stamp}));
                    tx.set(requestRef, data);
                    return data;
                });
                return res.status(200).json({request: {...record, id: body.id}});
            }
            if (action === 'review' && req.method === 'POST') {
                if (!canReview) fail(403, 'Hanya Super Admin yang boleh menyetujui pengajuan.');
                const {id, status} = req.body, note = text(req.body.note, 1000);
                if (!isId(id) || !['approved', 'rejected'].includes(status)) fail(400, 'Keputusan tidak valid.');
                if (status === 'rejected' && note.length < 3) fail(400, 'Isi alasan penolakan.');
                const ref = db.collection(REQUESTS).doc(id);
                await db.runTransaction(async tx => {
                    const doc = await tx.get(ref);
                    if (!doc.exists) fail(404, 'Pengajuan tidak ditemukan.');
                    if (doc.data().status !== 'pending') fail(409, 'Pengajuan sudah diproses. Muat ulang daftar.');
                    tx.update(ref, {status, reviewNote: note, reviewedBy: caller.uid, reviewedAt: now(), updatedAt: now()});
                });
                return res.status(200).json({reviewed: true});
            }
            fail(400, 'Tindakan tidak dikenal.');
        } catch (error) {
            if (error.status) return res.status(error.status).json({error: error.message});
            console.error('Fleet service unavailable', {code: error.code || 'unknown'});
            return res.status(503).json({error: 'Layanan pengajuan servis belum tersedia. Coba lagi; data form tetap tersimpan di layar.'});
        }
    };
}
module.exports = {createFleetServiceHandler, validatePhotos, cleanVehicles, eligible, REQUESTS, PHOTOS, CONFIG};
