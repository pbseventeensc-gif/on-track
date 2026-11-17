(function(root) {
    'use strict';
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
    const statuses = {pending: ['Menunggu persetujuan', 'warning'], approved: ['Disetujui', 'success'], rejected: ['Ditolak', 'danger']};
    let eligibleCourierUid = '';
    let courierUid = '', courierVersion = 0, files = [], sending = false, draftId = null;
    let latestFleet = [], syncedFleet = '', adminBusy = false, adminLoaded = false;
    const byId = id => root.document.getElementById(id);
    const user = () => root.firebase?.auth?.().currentUser;
    function endpoint() {
        return root.location.protocol === 'file:' ? 'https://on-track-indol.vercel.app/api/fleet-service' : '/api/fleet-service';
    }
    async function api(action, payload, scope) {
        if (root.WTRACK_LOCAL_SANDBOX) throw Error('Pengajuan servis memerlukan akun dan koneksi server.');
        const account = user();
        if (!account || account.isAnonymous) throw Error('Silakan login kembali.');
        const token = await account.getIdToken();
        const url = endpoint() + (payload ? '' : `?action=${encodeURIComponent(action)}${scope ? '&scope=' + scope : ''}`);
        const response = await root.fetch(url, {method: payload ? 'POST' : 'GET',
            headers: {Authorization: `Bearer ${token}`, ...(payload ? {'Content-Type':'application/json'} : {})},
            ...(payload ? {body: JSON.stringify({action, ...payload})} : {})});
        let result;
        try { result = await response.json(); } catch { throw Error('Server pengajuan servis belum tersedia.'); }
        if (!response.ok) throw Error(result.error || 'Pengajuan belum berhasil. Coba lagi.');
        if (user()?.uid !== account.uid) throw Error('Sesi akun berubah. Silakan buka ulang halaman.');
        return result;
    }
    function message(id, value, error = false) {
        const el = byId(id);
        if (el) { el.textContent = value; el.className = `small my-2 ${error ? 'text-danger' : 'text-muted'}`; }
    }
    function clearFiles() {
        files.forEach(item => root.URL.revokeObjectURL(item.url));
        files = []; draftId = null;
        const preview = byId('service-photo-preview');
        if (preview) preview.innerHTML = '';
    }
    async function connectCourier() {
        const version = ++courierVersion;
        const account = user();
        const entry = byId('courier-service-entry');
        if (entry) entry.hidden = eligibleCourierUid !== account?.uid;
        if (courierUid !== account?.uid) {
            eligibleCourierUid = '';
            clearFiles();
            courierRequests = [];
            byId('courier-service-form')?.reset();
            if (byId('courier-service-list')) byId('courier-service-list').innerHTML = '';
        }
        courierUid = account?.uid || '';
        if (!account || account.isAnonymous || root.WTRACK_LOCAL_SANDBOX) return;
        try {
            const access = await api('bootstrap');
            if (version !== courierVersion) return;
            eligibleCourierUid = access.canSubmit ? account.uid : '';
            if (entry) entry.hidden = !access.canSubmit;
            const select = byId('service-vehicle');
            if (select) {
                const previousVehicle = select.value;
                select.innerHTML = '<option value="">Pilih kendaraan</option>' + access.vehicles.map(v =>
                    `<option value="${escape(v.id)}">${escape(v.plate_number)}${v.assigned_person_name ? ' · ' + escape(v.assigned_person_name) : ''}</option>`).join('');
                const assigned = access.vehicles.find(v => v.assigned_person_id === account.uid ||
                    (v.assigned_person_name && v.assigned_person_name.toLowerCase() === access.requesterName.toLowerCase()));
                if (access.vehicles.some(v => v.id === previousVehicle)) select.value = previousVehicle;
                else if (assigned) select.value = assigned.id;
            }
            const testing = byId('service-testing-note');
            if (testing) testing.hidden = !access.testing;
            if (!access.canSubmit) message('courier-service-message', 'Fitur ini khusus akun driver dan personel Fleet Inventory.', true);
        } catch (error) {
            if (version === courierVersion) message('courier-service-message', error.message, true);
        }
    }
    async function openCourier() {
        root.navigateToScreen('service');
        await connectCourier();
        await refreshCourier();
    }
    function renderRequests(list, admin) {
        if (!list.length) return '<p class="text-muted small py-3">Belum ada pengajuan servis.</p>';
        return list.map(record => {
            const [label, color] = statuses[record.status] || ['Tidak diketahui', 'secondary'];
            const date = new Date(record.createdAt).toLocaleString('id-ID', {timeZone:'Asia/Jakarta'});
            return `<article class="border rounded-3 p-3 mb-3 bg-white" data-service-request="${escape(record.id)}">
                <div class="d-flex flex-wrap gap-2 justify-content-between mb-2"><strong>${escape(record.plateNumber)}</strong>
                    <span class="badge bg-${color}${color === 'warning' ? ' text-dark' : ''}">${label}</span></div>
                <div class="small text-muted">${escape(record.requesterName)} · ${escape(date)} WIB${record.testing ? ' · Akun testing' : ''}</div>
                ${record.odometer ? `<div class="small mt-1">Odometer: ${escape(record.odometer)}</div>` : ''}
                <p class="my-2" style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(record.description)}</p>
                <button type="button" class="btn btn-sm btn-outline-secondary" data-service-action="photos" data-id="${escape(record.id)}">Lihat ${record.photoIds.length} foto kerusakan</button>
                <div class="d-flex flex-wrap gap-2 mt-2" data-service-photos="${escape(record.id)}"></div>
                ${record.reviewNote ? `<div class="small mt-2 border-top pt-2" style="white-space:pre-wrap">Catatan Super Admin: ${escape(record.reviewNote)}</div>` : ''}
                ${admin && record.status === 'pending' ? `<div class="mt-3 border-top pt-3">
                    <label class="form-label small" for="service-review-${escape(record.id)}">Catatan persetujuan / alasan penolakan</label>
                    <textarea class="form-control form-control-sm mb-2" rows="2" maxlength="1000" id="service-review-${escape(record.id)}"></textarea>
                    <button type="button" class="btn btn-success btn-sm" data-service-action="approved" data-id="${escape(record.id)}">Setujui</button>
                    <button type="button" class="btn btn-outline-danger btn-sm ms-2" data-service-action="rejected" data-id="${escape(record.id)}">Tolak</button>
                    <div class="small mt-2" data-service-review-message></div>
                </div>` : ''}
            </article>`;
        }).join('');
    }
    let courierRequests = [], adminRequests = [];
    async function refreshCourier() {
        try {
            const result = await api('list');
            courierRequests = result.requests;
            byId('courier-service-list').innerHTML = renderRequests(courierRequests, false);
        } catch (error) { message('courier-service-message', error.message, true); }
    }
    function renderPreviews() {
        byId('service-photo-preview').innerHTML = files.map((item, index) => `<div class="border rounded p-1">
            <img src="${escape(item.url)}" alt="Foto kerusakan ${index + 1}" style="width:90px;height:90px;object-fit:cover">
            <button type="button" class="btn btn-sm d-block w-100 text-danger" data-service-remove="${index}">Hapus</button></div>`).join('');
    }
    function selectFiles(input) {
        if (sending) return;
        let error = '';
        for (const file of Array.from(input.files || [])) {
            if (files.length >= 6) { error = 'Maksimal 6 foto. Hapus foto untuk mengganti pilihan.'; break; }
            if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
                error = 'Pilih foto JPEG, PNG, atau WebP, maksimal 10 MB per file.'; continue;
            }
            if (files.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) continue;
            files.push({file, url: root.URL.createObjectURL(file)});
        }
        input.value = ''; renderPreviews();
        message('courier-service-message', error || `${files.length}/6 foto dipilih. Minimal 2 foto dari sudut berbeda.`, !!error);
    }
    async function compressPhoto(file) {
        const url = root.URL.createObjectURL(file);
        try {
            const image = await new Promise((resolve, reject) => {
                const img = new root.Image(); img.onload = () => resolve(img); img.onerror = () => reject(Error('Foto tidak dapat dibaca. Pilih foto lain.')); img.src = url;
            });
            const canvas = root.document.createElement('canvas');
            let scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
            for (let attempt = 0; attempt < 5; attempt++) {
                canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                const data = canvas.toDataURL('image/jpeg', Math.max(0.45, 0.8 - attempt * 0.08));
                if (data.length < 180 * 1024 * 4 / 3) return data;
                scale *= 0.75;
            }
            throw Error('Ukuran foto terlalu besar. Pilih foto lain.');
        } finally { root.URL.revokeObjectURL(url); }
    }
    async function submit(event) {
        event.preventDefault();
        if (sending) return;
        const form = byId('courier-service-form');
        if (!form.reportValidity()) return;
        if (files.length < 2 || files.length > 6) return message('courier-service-message', 'Unggah 2–6 foto kerusakan dari sudut berbeda.', true);
        const submissionUid = user()?.uid;
        sending = true;
        const fieldset = byId('service-form-fields'); fieldset.disabled = true;
        message('courier-service-message', 'Mengompres foto dan mengirim pengajuan…');
        try {
            const photos = [];
            for (const item of files) photos.push(await compressPhoto(item.file));
            if (user()?.uid !== submissionUid) throw Error('Sesi akun berubah. Silakan buka ulang halaman.');
            if (!draftId) draftId = root.crypto.randomUUID();
            await api('submit', {id: draftId, vehicleId: byId('service-vehicle').value,
                description: byId('service-description').value.trim(), odometer: byId('service-odometer').value.trim(), photos});
            clearFiles(); form.reset();
            message('courier-service-message', 'Pengajuan terkirim. Menunggu persetujuan Super Admin.');
            await refreshCourier();
        } catch (error) { message('courier-service-message', error.message, true); }
        finally { sending = false; fieldset.disabled = false; }
    }
    function fleetPayload(fleet) {
        return fleet.map(v => ({id:v.id, plate_number:v.plate_number, vehicle_category:v.vehicle_category || '',
            assigned_person_id:v.assigned_person_id || '', assigned_person_name:v.assigned_person_name || ''}));
    }
    function mountAdmin(container, fleet) {
        latestFleet = fleetPayload(fleet);
        if (!byId('fleet-service-admin')) {
            container.insertAdjacentHTML('beforeend', `<section id="fleet-service-admin" class="bg-white border rounded-3 p-3 mt-3">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2"><div>
                    <h6 class="fw-bold mb-1">Pengajuan Servis Driver <span id="service-pending-count" class="badge bg-warning text-dark">0</span></h6>
                    <p class="small text-muted mb-0">Periksa keluhan dan foto kerusakan sebelum memberi persetujuan.</p></div>
                    <button type="button" class="btn btn-sm btn-outline-primary" data-service-action="refresh-admin">Muat ulang & sinkronkan armada</button></div>
                <div id="fleet-service-admin-message" role="status" aria-live="polite"></div>
                <div id="fleet-service-admin-list" class="mt-3"></div></section>`);
        }
        if (syncedFleet !== JSON.stringify(latestFleet) || !adminLoaded) refreshAdmin();
    }
    async function refreshAdmin(forceSync = false) {
        if (adminBusy) return;
        adminBusy = true;
        try {
            message('fleet-service-admin-message', 'Memuat pengajuan…');
            const access = await api('bootstrap');
            if (!access.canReview) throw Error('Akun ini belum memiliki izin persetujuan Super Admin di server.');
            let syncWarning = '';
            const signature = JSON.stringify(latestFleet);
            let baseVersion = null;
            try { baseVersion = JSON.parse(root.localStorage.getItem('wtrack_service_fleet_version') || 'null'); } catch {}
            const remoteSignature = JSON.stringify(fleetPayload(access.vehicles));
            if (remoteSignature === signature) {
                syncedFleet = signature;
                root.localStorage.setItem('wtrack_service_fleet_version', JSON.stringify(access.registryVersion));
            } else if (forceSync || access.registryVersion === 0 || baseVersion === access.registryVersion) {
                const payload = latestFleet;
                const result = await api('syncFleet', {vehicles:payload, expectedVersion:access.registryVersion});
                syncedFleet = JSON.stringify(payload);
                root.localStorage.setItem('wtrack_service_fleet_version', JSON.stringify(result.version));
            } else {
                syncWarning = 'Daftar armada server berbeda dari perangkat ini. Periksa Fleet Inventory, lalu tekan sinkronkan armada jika data perangkat ini yang akan digunakan.';
            }
            const result = await api('list', null, 'admin');
            adminRequests = result.requests;
            byId('fleet-service-admin-list').innerHTML = renderRequests(adminRequests, true);
            byId('service-pending-count').textContent = adminRequests.filter(r => r.status === 'pending').length;
            adminLoaded = true;
            message('fleet-service-admin-message', syncWarning || 'Daftar armada tersinkron. Menampilkan maksimal 100 pengajuan terbaru.', !!syncWarning);
        } catch (error) { message('fleet-service-admin-message', error.message, true); }
        finally { adminBusy = false; }
    }
    async function requestAction(event) {
        const remove = event.target.closest('[data-service-remove]');
        if (remove && !sending) {
            const index = Number(remove.dataset.serviceRemove);
            root.URL.revokeObjectURL(files[index].url); files.splice(index, 1); renderPreviews(); return;
        }
        const button = event.target.closest('[data-service-action]');
        if (!button || button.disabled) return;
        const action = button.dataset.serviceAction, id = button.dataset.id;
        if (action === 'refresh-admin') return refreshAdmin(true);
        if (action === 'refresh-courier') return refreshCourier();
        if (action === 'open-courier') return openCourier();
        const article = button.closest('[data-service-request]');
        if (!article) return;
        button.disabled = true;
        try {
            if (action === 'photos') {
                const record = [...adminRequests, ...courierRequests].find(r => r.id === id);
                const panel = article.querySelector('[data-service-photos]');
                if (panel.childElementCount) { panel.replaceChildren(); return; }
                for (const photoId of record.photoIds) {
                    // Pass the photo ID as a query parameter; it never contains an unauthenticated public URL.
                    const photo = await fetchPhoto(photoId);
                    const image = root.document.createElement('img');
                    image.src = photo; image.alt = 'Foto kerusakan kendaraan'; image.style.cssText = 'width:160px;height:140px;object-fit:cover;cursor:zoom-in';
                    image.addEventListener('click', () => showPhoto(photo)); panel.appendChild(image);
                }
            } else if (action === 'approved' || action === 'rejected') {
                const note = byId(`service-review-${id}`).value.trim();
                const statusEl = article.querySelector('[data-service-review-message]');
                if (action === 'rejected' && note.length < 3) { statusEl.textContent = 'Isi alasan penolakan minimal 3 karakter.'; return; }
                const controls = article.querySelectorAll('button'); controls.forEach(b => b.disabled = true);
                try { await api('review', {id, status:action, note}); await refreshAdmin(); }
                finally { controls.forEach(b => b.disabled = false); }
            }
        } catch (error) {
            const el = article.querySelector('[data-service-review-message]') || article.querySelector('[data-service-photos]');
            el.textContent = error.message;
        } finally { button.disabled = false; }
    }
    async function fetchPhoto(id) {
        const account = user();
        if (!account || account.isAnonymous) throw Error('Silakan login kembali.');
        const response = await root.fetch(`${endpoint()}?action=photo&id=${encodeURIComponent(id)}`, {
            headers: {Authorization:`Bearer ${await account.getIdToken()}`}});
        const result = await response.json();
        if (!response.ok) throw Error(result.error || 'Foto belum dapat dimuat.');
        if (user()?.uid !== account.uid) throw Error('Sesi akun berubah.');
        if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(result.data)) throw Error('Foto tidak valid.');
        return result.data;
    }
    function showPhoto(src) {
        let dialog = byId('service-photo-dialog');
        if (!dialog) {
            dialog = root.document.createElement('dialog'); dialog.id = 'service-photo-dialog';
            dialog.style.cssText = 'max-width:95vw;max-height:90vh;border:0;border-radius:12px;padding:12px';
            dialog.innerHTML = '<form method="dialog"><button class="btn btn-sm btn-secondary mb-2">Tutup</button></form><img alt="Detail kerusakan" style="max-width:85vw;max-height:75vh;object-fit:contain">';
            root.document.body.appendChild(dialog);
        }
        dialog.querySelector('img').src = src; dialog.showModal();
    }
    root.addEventListener?.('online', () => { if (byId('courier-service-entry')) connectCourier(); });
    root.document?.addEventListener('click', requestAction);
    root.document?.addEventListener('DOMContentLoaded', () => {
        byId('courier-service-form')?.addEventListener('submit', submit);
        byId('service-photos')?.addEventListener('change', event => selectFiles(event.target));
    });
    root.setInterval?.(() => {
        if (root.document.hidden || !user() || user().isAnonymous) return;
        if (byId('screen-service')?.classList.contains('active') && !sending) refreshCourier();
        const panel = byId('fleet-service-admin');
        if (panel && panel.offsetParent && !panel.contains(root.document.activeElement)) refreshAdmin();
    }, 30000);
    function hasUnsavedDraft() {
        return sending || files.length > 0 || !!byId('service-description')?.value.trim() || !!byId('service-odometer')?.value.trim();
    }
    root.FleetService = {hasUnsavedDraft, connectCourier, openCourier, mountAdmin, refreshAdmin, refreshCourier, renderRequests, fleetPayload};
})(typeof window !== 'undefined' ? window : globalThis);
