/* Admin reconciliation: link Manual Dispatch destinations to imported SJ Pool. */
(function (root) {
    'use strict';
    const core = root.SJReconcileCore;
    if (!core) return;

    const STATE = {
        date: '',
        rows: [],
        pool: [],
        aliases: new Map(),
        selection: new Map(),
        excluded: new Set(),
        busy: false,
        loaded: false
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
            trip.courierId || '';
    }

    function collectManualRows(date) {
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
            const destinations = Array.isArray(trip.destinations) ? trip.destinations : [];
            destinations.forEach((destination, index) => {
                if (!destination) return;
                if (destination.sjNumber || destination.noSJ) return;
                const deliveryId = destination.deliveryId || `${trip.id}_STOP_${index}`;
                const storeName = destination.locationName || destination.storeName || '';
                const address = destination.address || '';
                rows.push({
                    id: `${trip.id}::${deliveryId}`,
                    tripId: trip.id,
                    deliveryId,
                    destIndex: index,
                    storeName,
                    address,
                    customer: destination.customer || trip.customer || trip.clientName || '',
                    status: destination.status || '',
                    courier: courierLabel(trip),
                    date: tripDate,
                    baseKey: core.aliasKeyOf({storeName, address})
                });
            });
        });
        return rows;
    }

    function collectPoolRows() {
        return (Array.isArray(window.allPoolTrips) ? window.allPoolTrips : [])
            .filter(trip => trip && (trip.noSJ || trip.sjNumber) && !trip.courierId &&
                !['completed', 'done', 'delivered'].includes(String(trip.status || '').toLowerCase()))
            .map(trip => ({
                id: trip.id,
                noSJ: trip.noSJ || trip.sjNumber,
                key: core.storeKeyOf(trip),
                customer: trip.customer || trip.clientName || '',
                store: trip.storeDestination || trip.destinations?.[0]?.storeDestination || trip.destinations?.[0]?.locationName || '',
                address: trip.address || trip.destinations?.[0]?.address || '',
                trip
            }));
    }

    async function loadAliases() {
        const aliases = new Map();
        if (window.WTRACK_LOCAL_SANDBOX) {
            try {
                const stored = JSON.parse(localStorage.getItem('wtrack_sj_delivery_aliases_v1') || '{}');
                Object.entries(stored).forEach(([key, value]) => aliases.set(key, value));
            } catch (_) {}
            return aliases;
        }
        const activeDb = db();
        if (!activeDb) return aliases;
        try {
            const snapshot = await activeDb.collection('delivery_point_aliases').get();
            snapshot.forEach(doc => {
                const data = doc.data() || {};
                if (data.aliasKey && data.storeKey) aliases.set(String(data.aliasKey), String(data.storeKey));
            });
        } catch (error) {
            console.warn('Alias toko belum dapat dimuat:', error);
        }
        return aliases;
    }

    async function saveAlias(aliasKey, storeKey, noSJ) {
        if (!aliasKey || !storeKey) throw new Error('Kunci alias tidak valid.');
        if (window.WTRACK_LOCAL_SANDBOX) {
            let stored = {};
            try { stored = JSON.parse(localStorage.getItem('wtrack_sj_delivery_aliases_v1') || '{}'); } catch (_) {}
            stored[aliasKey] = storeKey;
            localStorage.setItem('wtrack_sj_delivery_aliases_v1', JSON.stringify(stored));
        } else {
            const activeDb = db();
            if (!activeDb) throw new Error('Database belum terhubung.');
            await activeDb.collection('delivery_point_aliases').doc(encodeURIComponent(aliasKey)).set({
                aliasKey,
                storeKey,
                noSJExample: noSJ || '',
                updatedAt: new Date().toISOString()
            }, {merge: true});
        }
        STATE.aliases.set(aliasKey, storeKey);
    }

    function normalizeSJ(value) {
        return String(value == null ? '' : value).replace(/^#/, '').trim().toUpperCase();
    }

    async function refresh(showLoading = true) {
        const body = document.getElementById('sj-reconcile-body');
        const applyButton = document.getElementById('sj-reconcile-apply');
        if (applyButton) applyButton.disabled = true;
        if (showLoading && body) body.innerHTML = '<div class="text-center text-muted py-5"><span class="spinner-border spinner-border-sm me-2"></span>Mencocokkan SJ Pool dengan pengiriman manual…</div>';
        try {
            if (!STATE.date) STATE.date = todayWib();
            const dateInput = document.getElementById('sj-reconcile-date');
            if (dateInput && !dateInput.value) dateInput.value = STATE.date;
            if (!Array.isArray(window.allPoolTrips) || !window.allPoolTrips.length) {
                if (typeof root.loadPoolTrips === 'function') await root.loadPoolTrips();
            }
            STATE.aliases = await loadAliases();
            STATE.rows = collectManualRows(STATE.date);
            STATE.pool = collectPoolRows();
            // Drop stale selections that are no longer candidates.
            const validRows = new Set(STATE.rows.map(row => row.id));
            for (const key of [...STATE.selection.keys()]) if (!validRows.has(key)) STATE.selection.delete(key);
            STATE.loaded = true;
            render();
        } catch (error) {
            console.error('SJ reconcile preview error:', error);
            if (body) body.innerHTML = `<div class="alert alert-danger mb-0">Gagal memuat data: ${esc(error.message || error)}</div>`;
        }
    }

    function preview() {
        const result = core.buildPreview(STATE.rows, STATE.pool, STATE.aliases, STATE.selection);
        result.rows.forEach(row => {
            if (STATE.excluded.has(row.id)) row.selectedPoolId = '';
            if (row.selectedPoolId && STATE.selection.get(row.id) !== row.selectedPoolId) {
                // Keep automatic unique matches selectable without forcing them
                // into the persisted selection map.
            }
        });
        return result;
    }

    function statusBadge(row) {
        if (row.selectedPoolId) return '<span class="badge bg-success-subtle text-success border border-success-subtle" style="font-size:10.5px;">Cocok</span>';
        if (row.status === 'ambiguous') return '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle" style="font-size:10.5px;">Ambigu</span>';
        return '<span class="badge bg-secondary-subtle text-secondary border" style="font-size:10.5px;">Tidak cocok</span>';
    }

    function render() {
        const body = document.getElementById('sj-reconcile-body');
        if (!body) return;
        const result = preview();
        const counts = result.counts;
        const applyButton = document.getElementById('sj-reconcile-apply');
        const selectedRows = result.rows.filter(row => row.selectedPoolId && !STATE.excluded.has(row.id));
        if (applyButton) {
            applyButton.disabled = selectedRows.length === 0 || STATE.busy;
            applyButton.innerHTML = `<i class="bi bi-link-45deg me-1"></i> Terapkan ${selectedRows.length} SJ`;
        }
        const countBadge = document.getElementById('sj-reconcile-count');
        if (countBadge) countBadge.textContent = `${counts.matched} cocok`;

        const summary = `
            <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                <span class="badge bg-white text-dark border" style="font-size:11.5px;">${counts.manual} tujuan manual</span>
                <span class="badge bg-white text-dark border" style="font-size:11.5px;">${counts.pool} SJ di Pool</span>
                <span class="badge bg-success-subtle text-success border border-success-subtle" style="font-size:11.5px;">${counts.matched} cocok</span>
                <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle" style="font-size:11.5px;">${counts.ambiguous} ambigu</span>
                <span class="badge bg-secondary-subtle text-secondary border" style="font-size:11.5px;">${counts.unmatched} tidak cocok</span>
            </div>
            <div class="alert alert-light border py-2 mb-3" style="font-size:11.5px;">
                Hanya pasangan <strong>1 tujuan manual = 1 SJ</strong> yang dapat diterapkan. Nama toko dinormalisasi; jika format berbeda, gunakan tombol <strong>Hubungkan</strong> untuk membuat alias toko. SJ yang tidak cocok tetap di Pool.
            </div>`;

        if (!counts.manual) {
            body.innerHTML = summary + '<div class="text-center text-muted py-5"><i class="bi bi-inbox fs-2 d-block mb-2"></i>Tidak ada tujuan manual tanpa nomor SJ pada tanggal ini.</div>';
            return;
        }

        const rowsHtml = result.rows.map(row => {
            const candidates = row.candidates || [];
            const selected = row.selectedPoolId ? result.byPoolId.get(row.selectedPoolId) : null;
            const checked = row.selectedPoolId && !STATE.excluded.has(row.id) ? 'checked' : '';
            const candidateOptions = candidates.map(pool => `<option value="${esc(pool.id)}" ${row.selectedPoolId === String(pool.id) ? 'selected' : ''}>${esc(pool.noSJ)}${pool.store ? ` — ${esc(pool.store.slice(0, 48))}` : ''}</option>`).join('');
            const sjCell = selected
                ? `<div class="font-monospace fw-semibold" style="font-size:11.5px;">${esc(selected.noSJ)}</div>`
                : (candidates.length
                    ? `<select class="form-select form-select-sm" style="font-size:11px;min-width:150px;" onchange="SJReconcile.selectCandidate(this.dataset.row,this.value)" data-row="${esc(row.id)}"><option value="">Pilih SJ (${candidates.length})</option>${candidateOptions}</select>`
                    : `<button type="button" class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size:11px;" data-row="${esc(row.id)}" onclick="SJReconcile.linkManual(this.dataset.row)">Hubungkan</button>`);
            return `<tr>
                <td class="text-center"><input type="checkbox" class="form-check-input" data-row="${esc(row.id)}" ${checked} ${row.selectedPoolId ? '' : 'disabled'} onchange="SJReconcile.toggleRow(this.dataset.row,this.checked)"></td>
                <td style="min-width:180px;white-space:normal;font-size:11.5px;"><strong>${esc(row.storeName || '-')}</strong><div class="text-muted" style="font-size:10.5px;">${esc((row.address || '-').slice(0, 110))}</div></td>
                <td style="font-size:11px;white-space:nowrap;">${esc(row.courier || '-')}</td>
                <td>${sjCell}</td>
                <td class="text-end">${statusBadge(row)}</td>
            </tr>`;
        }).join('');

        body.innerHTML = summary + `
            <div class="table-responsive border rounded-3" style="max-height:430px;background:#fff;">
                <table class="table table-sm align-middle mb-0" style="font-size:11.5px;">
                    <thead class="sticky-top" style="background:#F9FAFB;">
                        <tr>
                            <th style="width:36px;" class="text-center"><input type="checkbox" class="form-check-input" id="sj-reconcile-check-all" onchange="SJReconcile.toggleAll(this.checked)"></th>
                            <th>Tujuan Manual</th>
                            <th>Kurir</th>
                            <th>No. SJ</th>
                            <th class="text-end">Status</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>`;
        const checkAll = document.getElementById('sj-reconcile-check-all');
        if (checkAll) {
            const selectable = result.rows.filter(row => row.selectedPoolId);
            checkAll.checked = selectable.length > 0 && selectable.every(row => !STATE.excluded.has(row.id));
            checkAll.indeterminate = selectable.some(row => !STATE.excluded.has(row.id)) && !checkAll.checked;
        }
    }

    function toggleRow(rowId, checked) {
        if (checked) STATE.excluded.delete(rowId);
        else STATE.excluded.add(rowId);
        render();
    }

    function toggleAll(checked) {
        const result = preview();
        result.rows.forEach(row => {
            if (!row.selectedPoolId) return;
            if (checked) STATE.excluded.delete(row.id);
            else STATE.excluded.add(row.id);
        });
        render();
    }

    function selectCandidate(rowId, poolId) {
        if (poolId) STATE.selection.set(rowId, String(poolId));
        else STATE.selection.delete(rowId);
        render();
    }

    async function linkManual(rowId) {
        const row = STATE.rows.find(item => item.id === rowId);
        if (!row) return;
        const noSJ = prompt('Masukkan No. SJ dari SJ Pool yang cocok dengan tujuan manual ini:', '');
        if (noSJ === null) return;
        const wanted = normalizeSJ(noSJ);
        const pool = STATE.pool.find(item => normalizeSJ(item.noSJ) === wanted);
        if (!pool) {
            alert('No. SJ tidak ditemukan di SJ Pool saat ini.');
            return;
        }
        if (!pool.key) {
            alert('SJ ini belum punya nama toko/alamat yang dapat dijadikan alias.');
            return;
        }
        try {
            await saveAlias(row.baseKey, pool.key, pool.noSJ);
            STATE.selection.set(row.id, String(pool.id));
            STATE.excluded.delete(row.id);
            await refresh(false);
        } catch (error) {
            alert('Alias belum tersimpan: ' + (error.message || error));
        }
    }

    function applyLocal(row, pool) {
        const stored = JSON.parse(localStorage.getItem('wtrack_local_trips') || '[]');
        const manual = stored.find(trip => (trip.id || trip.tripId) === row.tripId);
        const poolTrip = stored.find(trip => (trip.id || trip.tripId) === pool.id);
        if (!manual || !poolTrip) throw new Error('Data lokal berubah. Muat ulang.');
        const destinations = JSON.parse(JSON.stringify(manual.destinations || []));
        const index = destinations.findIndex(destination => destination.deliveryId === row.deliveryId);
        const destination = destinations[index >= 0 ? index : row.destIndex];
        if (!destination || destination.sjNumber || destination.noSJ) throw new Error('Tujuan sudah berubah.');
        destination.noSJ = pool.noSJ;
        destination.sjNumber = pool.noSJ;
        destination.sjTripId = pool.id;
        destination.storeId = pool.key;
        destination.clientId = core.normalize(pool.customer);
        destination.sjMatchedAt = new Date().toISOString();
        destination.sjMatchRule = 'storeKey';
        manual.destinations = destinations;
        const next = stored.filter(trip => (trip.id || trip.tripId) !== pool.id).map(trip =>
            (trip.id || trip.tripId) === row.tripId ? manual : trip
        );
        if (root.persistLocalSandboxTrips) return root.persistLocalSandboxTrips(next).then(() => ({manual, pool}));
        localStorage.setItem('wtrack_local_trips', JSON.stringify(next));
        return Promise.resolve({manual, pool});
    }

    async function applyOnline(row, pool) {
        const activeDb = db();
        if (!activeDb) throw new Error('Database belum terhubung.');
        const manualRef = activeDb.collection('trips').doc(row.tripId);
        const poolRef = activeDb.collection('trips').doc(pool.id);
        const keyRef = activeDb.collection('sj_import_keys').doc(encodeURIComponent(normalizeSJ(pool.noSJ)));
        const auditRef = activeDb.collection('sj_reconciliations').doc();
        let updatedManual = null;
        await activeDb.runTransaction(async tx => {
            const manualSnap = await tx.get(manualRef);
            const poolSnap = await tx.get(poolRef);
            if (!manualSnap.exists) throw new Error('Trip manual sudah tidak ada.');
            if (!poolSnap.exists) throw new Error('SJ sudah tidak ada di Pool.');
            const manual = {...manualSnap.data(), id: row.tripId};
            const poolData = poolSnap.data() || {};
            if (poolData.courierId || ['completed', 'done', 'delivered'].includes(String(poolData.status || '').toLowerCase())) {
                throw new Error('SJ sudah ditugaskan atau selesai. Muat ulang preview.');
            }
            const destinations = JSON.parse(JSON.stringify(manual.destinations || []));
            const index = destinations.findIndex(destination => destination.deliveryId === row.deliveryId);
            const destination = destinations[index >= 0 ? index : row.destIndex];
            if (!destination) throw new Error('Tujuan manual sudah tidak ada.');
            if (destination.sjNumber || destination.noSJ) throw new Error('Tujuan sudah punya nomor SJ.');
            const noSJ = String(pool.noSJ || poolData.noSJ || '').trim();
            const now = new Date().toISOString();
            destination.noSJ = noSJ;
            destination.sjNumber = noSJ;
            destination.sjTripId = pool.id;
            destination.storeId = pool.key;
            destination.clientId = core.normalize(pool.customer || poolData.customer || poolData.clientName || '');
            destination.sjMatchedAt = now;
            destination.sjMatchRule = 'storeKey';
            manual.destinations = destinations;
            tx.update(manualRef, {destinations});
            tx.delete(poolRef);
            tx.set(keyRef, {
                noSJ,
                tripId: row.tripId,
                importedAt: poolData.importedAt || '',
                reconciledAt: now
            }, {merge: true});
            tx.set(auditRef, {
                noSJ,
                manualTripId: row.tripId,
                deliveryId: row.deliveryId,
                poolTripId: pool.id,
                matchKey: row.matchKey || row.baseKey || '',
                source: 'admin-reconcile',
                matchedAt: now
            });
            updatedManual = manual;
        });
        return {manual: updatedManual, pool};
    }

    function updateLocalArrays(manual, poolId) {
        const apply = list => (Array.isArray(list) ? list.map(trip => {
            if (!trip) return trip;
            return (trip.id || trip.tripId) === manual.id ? manual : trip;
        }).filter(trip => trip && (trip.id || trip.tripId) !== poolId) : list);
        window.allPoolTrips = apply(window.allPoolTrips);
        window.allCurrentTrips = apply(window.allCurrentTrips);
    }

    async function applySelected() {
        if (STATE.busy) return;
        const result = preview();
        const rows = result.rows.filter(row => row.selectedPoolId && !STATE.excluded.has(row.id));
        const poolIds = rows.map(row => row.selectedPoolId);
        if (rows.length === 0) return;
        if (new Set(poolIds).size !== poolIds.length) {
            alert('Ada satu SJ yang dipilih untuk lebih dari satu tujuan manual. Perbaiki pilihan terlebih dahulu.');
            return;
        }
        if (!confirm(`Terapkan ${rows.length} pasangan SJ ke pengiriman manual? SJ terkait akan dihapus dari SJ Pool.`)) return;
        STATE.busy = true;
        const applyButton = document.getElementById('sj-reconcile-apply');
        if (applyButton) { applyButton.disabled = true; applyButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Menyimpan…'; }
        const errors = [];
        let applied = 0;
        for (const [index, row] of rows.entries()) {
            const pool = result.byPoolId.get(row.selectedPoolId);
            if (!pool) continue;
            try {
                const resultApply = window.WTRACK_LOCAL_SANDBOX
                    ? await applyLocal(row, pool)
                    : await applyOnline(row, pool);
                updateLocalArrays(resultApply.manual, pool.id);
                applied++;
                if (applyButton) applyButton.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${index + 1}/${rows.length}…`;
            } catch (error) {
                errors.push(`${pool.noSJ}: ${error.message || error}`);
            }
        }
        STATE.busy = false;
        STATE.selection.clear();
        STATE.excluded.clear();
        if (typeof root.showToast === 'function') {
            root.showToast(applied
                ? `${applied} SJ berhasil disinkronkan. ${rows.length - applied ? `${rows.length - applied} gagal.` : ''}`
                : 'Tidak ada SJ yang berhasil disinkronkan.', applied ? 'success' : 'error');
        }
        if (errors.length) alert('Sebagian SJ gagal:\n' + errors.slice(0, 10).join('\n'));
        try { root.UnifiedPoolUI?.renderUnifiedPoolView?.(); } catch (_) {}
        try { root.renderRecentShipments?.(); } catch (_) {}
        try { root.updateGlobalStats?.(); } catch (_) {}
        await refresh(false);
    }

    function setDate(value) {
        STATE.date = value || todayWib();
        STATE.selection.clear();
        STATE.excluded.clear();
        refresh();
    }

    function open() {
        const modal = document.getElementById('modal-sj-reconcile');
        if (!modal) { alert('Dialog Sinkronkan SJ belum tersedia. Muat ulang halaman.'); return; }
        const dateInput = document.getElementById('sj-reconcile-date');
        if (!dateInput.value) dateInput.value = todayWib();
        STATE.date = dateInput.value;
        STATE.selection.clear();
        STATE.excluded.clear();
        if (typeof bootstrap !== 'undefined') bootstrap.Modal.getOrCreateInstance(modal).show();
        refresh();
    }

    function close() {
        const modal = document.getElementById('modal-sj-reconcile');
        if (modal && typeof bootstrap !== 'undefined') bootstrap.Modal.getInstance(modal)?.hide();
    }

    root.SJReconcile = {
        open, close, refresh, setDate, toggleRow, toggleAll, selectCandidate, linkManual,
        applySelected,
        get state() { return {date: STATE.date, rows: STATE.rows.length, pool: STATE.pool.length, loaded: STATE.loaded}; }
    };
})(window);
