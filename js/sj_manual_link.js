/* Manual link: pick one SJ from the Pool and one manual delivery destination. */
(function (root) {
    'use strict';
    const core = root.SJReconcileCore;
    if (!core) return;

    const STATE = {
        pool: null,
        date: '',
        query: '',
        targets: [],
        selected: '',
        busy: false
    };

    const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));

    function db() {
        try { return (typeof root.getDb === 'function' ? root.getDb() : root.getDb?.()) || null; }
        catch (_) { return null; }
    }

    function todayWib() {
        return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    }

    function wibDate(value) {
        if (!value) return '';
        let ms = value?.toMillis?.() || (value?.seconds ? value.seconds * 1000 : Date.parse(value));
        if (!Number.isFinite(ms)) return '';
        return new Date(ms + 7 * 3600000).toISOString().slice(0, 10);
    }

    function courierLabel(trip) {
        if (!trip) return '';
        return trip.courierName || trip.driver || trip.assignedTo ||
            (typeof root.getCourierDisplayName === 'function' ? root.getCourierDisplayName(trip.courierId) : '') ||
            trip.courierId || '-';
    }

    function poolTrip(tripId) {
        const wanted = String(tripId || '');
        return (Array.isArray(window.allPoolTrips) ? window.allPoolTrips : []).find(trip =>
            trip && [trip.id, trip.tripId, trip.noSJ, trip.sjNumber].filter(Boolean).some(value => String(value) === wanted)
        ) || null;
    }

    function collectTargets(date) {
        const combined = new Map();
        [window.allCurrentTrips, window.allPoolTrips].forEach(list => {
            (Array.isArray(list) ? list : []).forEach(trip => {
                if (trip && trip.id && !combined.has(trip.id)) combined.set(trip.id, trip);
            });
        });
        const rows = [];
        combined.forEach(trip => {
            if (!trip || trip.noSJ || trip.sjNumber) return;
            const tripDate = wibDate(trip.date || trip.assignedAt || trip.createdAt);
            if (date && tripDate && tripDate !== date) return;
            (trip.destinations || []).forEach((destination, index) => {
                if (!destination || destination.sjNumber || destination.noSJ) return;
                const deliveryId = destination.deliveryId || `${trip.id}_STOP_${index}`;
                const store = destination.locationName || destination.storeName || destination.customer || '';
                const address = destination.address || '';
                rows.push({
                    id: `${trip.id}::${deliveryId}`,
                    tripId: trip.id,
                    deliveryId,
                    destIndex: index,
                    store,
                    address,
                    customer: destination.customer || trip.customer || trip.clientName || '',
                    courier: courierLabel(trip),
                    status: destination.status || trip.status || '',
                    text: `${courierLabel(trip)} ${store} ${address} ${trip.id}`.toLowerCase()
                });
            });
        });
        return rows.sort((a, b) => a.courier.localeCompare(b.courier, 'id') || a.store.localeCompare(b.store, 'id'));
    }

    function selectedTarget() {
        return STATE.targets.find(row => row.id === STATE.selected) || null;
    }

    function render() {
        const body = document.getElementById('sj-manual-link-body');
        if (!body) return;
        const pool = STATE.pool;
        const applyButton = document.getElementById('sj-manual-link-apply');
        const target = selectedTarget();
        if (applyButton) {
            applyButton.disabled = !target || STATE.busy;
            applyButton.innerHTML = target ? '<i class="bi bi-link-45deg me-1"></i> Tautkan & Sinkronkan' : '<i class="bi bi-link-45deg me-1"></i> Pilih Tujuan';
        }
        if (!pool) {
            body.innerHTML = '<div class="alert alert-warning mb-0">SJ tidak ditemukan di Pool. Muat ulang halaman.</div>';
            return;
        }
        const query = STATE.query.trim().toLowerCase();
        const visible = STATE.targets.filter(row => !query || row.text.includes(query));
        const rows = visible.length ? visible.map(row => {
            const checked = row.id === STATE.selected ? 'checked' : '';
            return `<tr class="${checked ? 'table-warning' : ''}" style="cursor:pointer;" onclick="SJManualLink.selectTarget(this.dataset.row)" data-row="${esc(row.id)}">
                <td class="text-center"><input type="radio" class="form-check-input" name="sj-manual-target" ${checked} onchange="SJManualLink.selectTarget(this.dataset.row)" data-row="${esc(row.id)}"></td>
                <td style="font-size:11.5px;white-space:nowrap;">${esc(row.courier)}</td>
                <td style="font-size:11.5px;white-space:normal;"><strong>${esc(row.store || '-')}</strong><div class="text-muted" style="font-size:10.5px;">${esc((row.address || '-').slice(0, 100))}</div></td>
                <td style="font-size:11px;white-space:nowrap;">${esc(row.status || '-')}</td>
            </tr>`;
        }).join('') : '<tr><td colspan="4" class="text-center text-muted py-4">Tidak ada tujuan manual yang cocok.</td></tr>';

        body.innerHTML = `
            <div class="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3 p-3 bg-white border rounded-3">
                <div>
                    <div class="text-muted" style="font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;">Surat Jalan dari Pool</div>
                    <div class="fw-bold font-monospace" style="font-size:15px;">${esc(pool.noSJ || pool.sjNumber || pool.id)}</div>
                    <div class="text-muted" style="font-size:11.5px;">${esc(pool.customer || pool.clientName || '-')} · ${esc(pool.storeDestination || pool.destinations?.[0]?.locationName || '-')}</div>
                </div>
                <div class="text-end" style="font-size:11.5px;">
                    <span class="badge bg-success-subtle text-success border border-success-subtle">Pool</span>
                    <div class="text-muted mt-1">${(pool.items || []).length || 1} item</div>
                </div>
            </div>
            <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
                <div class="position-relative flex-grow-1" style="min-width:220px;max-width:420px;">
                    <i class="bi bi-search position-absolute top-50 translate-middle-y text-muted" style="left:10px;font-size:12px;"></i>
                    <input type="text" class="form-control form-control-sm" id="sj-manual-link-search" value="${esc(STATE.query)}" placeholder="Cari kurir, toko, alamat, atau ID trip..." style="padding-left:30px;font-size:12px;" oninput="SJManualLink.setQuery(this.value)">
                </div>
                <input type="date" id="sj-manual-link-date" class="form-control form-control-sm" style="width:145px;height:31px;font-size:12px;" value="${esc(STATE.date)}" onchange="SJManualLink.setDate(this.value)">
                <span class="text-muted" style="font-size:11.5px;">${visible.length} tujuan</span>
            </div>
            <div class="table-responsive border rounded-3" style="max-height:360px;background:#fff;">
                <table class="table table-sm align-middle mb-0" style="font-size:11.5px;">
                    <thead class="sticky-top" style="background:#F9FAFB;">
                        <tr><th style="width:34px;"></th><th>Kurir</th><th>Tujuan</th><th>Status</th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div class="text-muted mt-2" style="font-size:11px;">Pilih satu tujuan. SJ akan dipindahkan dari Pool dan nomornya muncul di dashboard pengiriman manual.</div>
        `;
    }

    async function openByTrip(tripId) {
        const pool = poolTrip(tripId);
        if (!pool) {
            alert('SJ tidak ditemukan di SJ Pool. Muat ulang halaman.');
            return;
        }
        STATE.pool = pool;
        STATE.selected = '';
        STATE.query = '';
        STATE.date = todayWib();
        STATE.targets = collectTargets(STATE.date);
        const dateInput = document.getElementById('sj-manual-link-date');
        if (dateInput) dateInput.value = STATE.date;
        const modal = document.getElementById('modal-sj-manual-link');
        if (!modal) {
            alert('Dialog Tautkan SJ belum tersedia. Muat ulang halaman.');
            return;
        }
        render();
        if (typeof bootstrap !== 'undefined') bootstrap.Modal.getOrCreateInstance(modal).show();
    }

    function setQuery(value) {
        STATE.query = value || '';
        render();
        const input = document.getElementById('sj-manual-link-search');
        if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }

    function setDate(value) {
        STATE.date = value || todayWib();
        STATE.targets = collectTargets(STATE.date);
        STATE.selected = '';
        render();
    }

    function selectTarget(rowId) {
        STATE.selected = String(rowId || '');
        render();
    }

    function applyLocal(target, pool) {
        const stored = JSON.parse(localStorage.getItem('wtrack_local_trips') || '[]');
        const manual = stored.find(trip => (trip.id || trip.tripId) === target.tripId);
        const poolTrip = stored.find(trip => (trip.id || trip.tripId) === pool.id || (trip.id || trip.tripId) === pool.tripId);
        if (!manual || !poolTrip) throw new Error('Data lokal berubah. Muat ulang.');
        const destinations = JSON.parse(JSON.stringify(manual.destinations || []));
        const index = destinations.findIndex(destination => destination.deliveryId === target.deliveryId);
        const destination = destinations[index >= 0 ? index : target.destIndex];
        if (!destination || destination.sjNumber || destination.noSJ) throw new Error('Tujuan sudah berubah.');
        const noSJ = String(poolTrip.noSJ || poolTrip.sjNumber || '').trim();
        destination.noSJ = noSJ;
        destination.sjNumber = noSJ;
        destination.sjTripId = poolTrip.id || poolTrip.tripId;
        destination.storeId = core.storeKeyOf(poolTrip);
        destination.clientId = core.normalize(poolTrip.customer || poolTrip.clientName || '');
        if (!destination.adminSJ && poolTrip.adminSJ) destination.adminSJ = poolTrip.adminSJ;
        destination.sjMatchedAt = new Date().toISOString();
        destination.sjMatchRule = 'manual-link';
        manual.destinations = destinations;
        const poolId = poolTrip.id || poolTrip.tripId;
        const next = stored.filter(trip => (trip.id || trip.tripId) !== poolId).map(trip =>
            (trip.id || trip.tripId) === target.tripId ? manual : trip
        );
        if (root.persistLocalSandboxTrips) return root.persistLocalSandboxTrips(next).then(() => ({manual, poolId}));
        localStorage.setItem('wtrack_local_trips', JSON.stringify(next));
        return Promise.resolve({manual, poolId});
    }

    async function applyOnline(target, pool) {
        const activeDb = db();
        if (!activeDb) throw new Error('Database belum terhubung.');
        const manualRef = activeDb.collection('trips').doc(target.tripId);
        const poolRef = activeDb.collection('trips').doc(pool.id || pool.tripId);
        const keyRef = activeDb.collection('sj_import_keys').doc(encodeURIComponent(String(pool.noSJ || pool.sjNumber).trim().toUpperCase()));
        const auditRef = activeDb.collection('sj_reconciliations').doc();
        let updatedManual = null;
        await activeDb.runTransaction(async tx => {
            const manualSnap = await tx.get(manualRef);
            const poolSnap = await tx.get(poolRef);
            if (!manualSnap.exists) throw new Error('Trip manual sudah tidak ada.');
            if (!poolSnap.exists) throw new Error('SJ sudah tidak ada di Pool.');
            const poolData = poolSnap.data() || {};
            if (poolData.courierId || ['completed', 'done', 'delivered'].includes(String(poolData.status || '').toLowerCase())) {
                throw new Error('SJ sudah ditugaskan atau selesai. Muat ulang Pool.');
            }
            const manual = {...manualSnap.data(), id: target.tripId};
            const destinations = JSON.parse(JSON.stringify(manual.destinations || []));
            const index = destinations.findIndex(destination => destination.deliveryId === target.deliveryId);
            const destination = destinations[index >= 0 ? index : target.destIndex];
            if (!destination) throw new Error('Tujuan manual sudah tidak ada.');
            if (destination.sjNumber || destination.noSJ) throw new Error('Tujuan sudah punya nomor SJ.');
            const noSJ = String(pool.noSJ || poolData.noSJ || poolData.sjNumber || '').trim();
            const now = new Date().toISOString();
            destination.noSJ = noSJ;
            destination.sjNumber = noSJ;
            destination.sjTripId = pool.id || pool.tripId;
            destination.storeId = core.storeKeyOf(poolData);
            destination.clientId = core.normalize(poolData.customer || poolData.clientName || '');
            if (!destination.adminSJ && poolData.adminSJ) destination.adminSJ = poolData.adminSJ;
            destination.sjMatchedAt = now;
            destination.sjMatchRule = 'manual-link';
            manual.destinations = destinations;
            tx.update(manualRef, {destinations});
            tx.delete(poolRef);
            tx.set(keyRef, {
                noSJ,
                tripId: target.tripId,
                importedAt: poolData.importedAt || '',
                reconciledAt: now
            }, {merge: true});
            tx.set(auditRef, {
                noSJ,
                manualTripId: target.tripId,
                deliveryId: target.deliveryId,
                poolTripId: pool.id || pool.tripId,
                source: 'admin-manual-link',
                matchedAt: now
            });
            updatedManual = manual;
        });
        return {manual: updatedManual, poolId: pool.id || pool.tripId};
    }

    function updateLocalArrays(manual, poolId) {
        const update = list => (Array.isArray(list) ? list.map(trip => {
            if (!trip) return trip;
            return (trip.id || trip.tripId) === manual.id ? manual : trip;
        }).filter(trip => trip && (trip.id || trip.tripId) !== poolId) : list);
        window.allPoolTrips = update(window.allPoolTrips);
        window.allCurrentTrips = update(window.allCurrentTrips);
    }

    async function apply() {
        if (STATE.busy) return;
        const target = selectedTarget();
        if (!target || !STATE.pool) {
            alert('Pilih tujuan manual terlebih dahulu.');
            return;
        }
        if (!confirm(`Tautkan ${STATE.pool.noSJ || STATE.pool.sjNumber} ke ${target.courier} — ${target.store || target.address}? SJ akan dihapus dari Pool.`)) return;
        STATE.busy = true;
        render();
        try {
            const result = window.WTRACK_LOCAL_SANDBOX
                ? await applyLocal(target, STATE.pool)
                : await applyOnline(target, STATE.pool);
            updateLocalArrays(result.manual, result.poolId);
            if (typeof root.showToast === 'function') root.showToast(`SJ ${STATE.pool.noSJ || STATE.pool.sjNumber} berhasil ditautkan ke pengiriman manual.`, 'success');
            if (typeof bootstrap !== 'undefined') bootstrap.Modal.getInstance(document.getElementById('modal-sj-manual-link'))?.hide();
            try { root.UnifiedPoolUI?.renderUnifiedPoolView?.(); } catch (_) {}
            try { root.renderRecentShipments?.(); } catch (_) {}
            try { root.updateGlobalStats?.(); } catch (_) {}
        } catch (error) {
            alert('Gagal menautkan SJ: ' + (error.message || error));
        } finally {
            STATE.busy = false;
            render();
        }
    }

    root.SJManualLink = {openByTrip, setQuery, setDate, selectTarget, apply, get state() { return {...STATE}; }};
})(window);
