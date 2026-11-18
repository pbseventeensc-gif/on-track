/* Manual link: pick one SJ from the Pool and one manual delivery destination. */
(function (root) {
    'use strict';
    const core = root.SJReconcileCore;
    const links = root.SJLinks;
    if (!core || !links) return;

    const STATE = {
        mode: 'single',
        pool: null,
        poolTrips: [],
        date: '',
        query: '',
        courier: '',
        targets: [],
        selected: '',
        activePoolId: '',
        pairs: new Map(),
        autoPaired: new Set(),
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
                if (!destination) return;
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
                    existingSJ: links.label(destination),
                    text: `${courierLabel(trip)} ${store} ${address} ${trip.id}`.toLowerCase()
                });
            });
        });
        return rows.sort((a, b) => a.courier.localeCompare(b.courier, 'id') || a.store.localeCompare(b.store, 'id'));
    }

    function selectedTarget() {
        return STATE.targets.find(row => row.id === STATE.selected) || null;
    }

    function poolIdOf(pool) {
        return String(pool?.id || pool?.tripId || '');
    }

    function poolLabel(pool) {
        return `${pool.noSJ || pool.sjNumber || pool.id || '-'} — ${pool.customer || pool.clientName || '-'} / ${pool.storeDestination || pool.destinations?.[0]?.locationName || '-'}`;
    }

    function renderBulk() {
        const body = document.getElementById('sj-manual-link-body');
        if (!body) return;
        const applyButton = document.getElementById('sj-manual-link-apply');
        if (!STATE.activePoolId || !STATE.poolTrips.some(pool => poolIdOf(pool) === STATE.activePoolId)) {
            STATE.activePoolId = STATE.poolTrips.map(poolIdOf).find(id => !STATE.pairs.has(id)) || '';
        }
        const poolById = new Map(STATE.poolTrips.map(pool => [poolIdOf(pool), pool]));
        const targetByPool = new Map();
        STATE.pairs.forEach((targetId, poolId) => targetByPool.set(poolId, targetId));
        if (applyButton) {
            applyButton.disabled = STATE.pairs.size === 0 || STATE.busy;
            applyButton.innerHTML = STATE.pairs.size
                ? `<i class="bi bi-link-45deg me-1"></i> Tautkan ${STATE.pairs.size} SJ`
                : '<i class="bi bi-link-45deg me-1"></i> Pilih Tujuan';
        }
        const cards = STATE.poolTrips.map(pool => {
            const id = poolIdOf(pool);
            const active = id === STATE.activePoolId;
            const targetId = targetByPool.get(id);
            const target = targetId ? STATE.targets.find(row => row.id === targetId) : null;
            return `<button type="button" class="sj-link-card ${active ? 'is-active' : target ? 'is-linked' : ''}" data-pool="${esc(id)}" onclick="SJManualLink.setActiveSJ(this.dataset.pool)" style="max-width:270px;">
                <span class="sj-link-number">${esc(pool.noSJ || pool.sjNumber || id)}</span>
                <span class="sj-link-sub">${esc(pool.customer || pool.clientName || '')} · ${esc(pool.storeDestination || pool.destinations?.[0]?.locationName || '')}<br>${target ? `Tujuan: ${esc(target.courier)} · ${esc((target.store || target.address || '').slice(0, 30))}` : `${esc(pool.customer || pool.clientName || '')} · ${esc((pool.storeDestination || pool.destinations?.[0]?.locationName || '').slice(0, 30))}`}</span>
            </button>`;
        }).join('');

        const activePool = poolById.get(STATE.activePoolId);
        const couriers = [...new Set(STATE.targets.map(row => row.courier).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
        const query = STATE.query.trim().toLowerCase();
        const visible = STATE.targets.filter(row => (!STATE.courier || row.courier === STATE.courier) && (!query || row.text.includes(query)));
        const rows = visible.length ? visible.map(row => {
            const assignedPools = [...STATE.pairs.entries()].filter(([, targetId]) => targetId === row.id).map(([poolId]) => poolById.get(poolId)).filter(Boolean);
            const assignedPool = assignedPools.length > 0;
            const cell = `${row.existingSJ ? `<div class="text-muted sj-link-number mb-1">${esc(row.existingSJ)}</div>` : ''}` + assignedPools.map(pool =>
                `<span class="sj-link-tag is-linked sj-link-number">${esc(pool.noSJ || pool.sjNumber)}
                 <button type="button" class="btn btn-link btn-sm sj-link-muted p-0 ms-1" data-pool="${esc(poolIdOf(pool))}" onclick="event.stopPropagation();SJManualLink.unassignPool(this.dataset.pool)" title="Lepas pilihan SJ ini"><i class="bi bi-x-lg" style="font-size:10px;"></i></button></span>`
            ).join(' ') + `<button type="button" class="btn btn-sm sj-link-secondary py-0 px-2" style="font-size:12px;" data-row="${esc(row.id)}" onclick="event.stopPropagation();SJManualLink.assignActive(this.dataset.row)">${row.existingSJ || assignedPool ? 'Tambah SJ' : 'Pasang'}</button>`;
            return `<tr class="sj-link-row ${assignedPool ? 'is-linked' : ''}" style="cursor:pointer;" data-row="${esc(row.id)}" onclick="SJManualLink.assignActive(this.dataset.row)">
                <td style="min-width:130px;">${cell}</td>
                <td style="font-size:12px;white-space:nowrap;">${esc(row.courier)}</td>
                <td style="font-size:12px;white-space:normal;"><strong>${esc(row.store || '-')}</strong><div class="text-muted" style="font-size:12px;">${esc((row.address || '-').slice(0, 95))}</div></td>
                <td style="font-size:12px;white-space:nowrap;">${esc(row.status || '-')}</td>
            </tr>`;
        }).join('') : '<tr><td colspan="4" class="text-center text-muted py-4">Tidak ada tujuan manual yang cocok.</td></tr>';

        body.innerHTML = `
            <div class="sj-link-panel mb-3">
                <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2">
                    <div class="sj-link-label">Surat jalan terpilih</div>
                    <span class="sj-link-count">${STATE.poolTrips.length} SJ · ${STATE.pairs.size} ditautkan</span>
                </div>
                <div class="d-flex flex-wrap gap-1">${cards}</div>
                <div class="sj-link-banner mt-2">
                    ${activePool ? `Pilih tujuan untuk <strong class="sj-link-number">${esc(activePool.noSJ || activePool.sjNumber)}</strong>` : 'Semua SJ sudah dipasangkan. Periksa tujuan sebelum menyimpan.'}
                </div>
            </div>
            <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
                <select class="form-select sj-link-courier" id="sj-manual-link-courier" aria-label="Filter kurir" style="width:220px;height:36px;font-size:12.5px;border-radius:8px;" onchange="SJManualLink.setCourier(this.value)">
                    <option value="">Semua Kurir</option>
                    ${couriers.map(name => `<option value="${esc(name)}" ${STATE.courier === name ? 'selected' : ''}>${esc(name)}</option>`).join('')}
                </select>
                <button type="button" class="btn btn-sm sj-link-secondary" style="height:31px;font-size:12px;border-radius:7px;" onclick="SJManualLink.autoPair()" ${STATE.courier ? '' : 'disabled'} title="Cocokkan toko dan PT; tujuan ambigu harus dipilih manual">
                    Cocokkan tujuan SJ
                </button>
                <div class="position-relative flex-grow-1" style="min-width:220px;max-width:420px;">
                    <i class="bi bi-search position-absolute top-50 translate-middle-y text-muted" style="left:10px;font-size:12px;"></i>
                    <input type="text" class="form-control form-control-sm" id="sj-manual-link-search" value="${esc(STATE.query)}" placeholder="Cari kurir atau tujuan" aria-label="Cari kurir atau tujuan" style="padding-left:30px;font-size:12px;" oninput="SJManualLink.setQuery(this.value)">
                </div>
                <input type="date" id="sj-manual-link-date" aria-label="Tanggal pengiriman" class="form-control form-control-sm" style="width:145px;height:31px;font-size:12px;" value="${esc(STATE.date)}" onchange="SJManualLink.setDate(this.value)">
                <span class="text-muted" style="font-size:12px;">${visible.length} tujuan</span>
            </div>
            <div class="table-responsive border rounded-3" style="max-height:360px;background:#fff;">
                <table class="table table-sm align-middle mb-0" style="font-size:12px;">
                    <thead class="sticky-top" style="background:#F9FAFB;">
                        <tr><th>No. SJ terpasang</th><th>Kurir</th><th>Tujuan</th><th>Status</th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div class="text-muted mt-2" style="font-size:12px;">Satu tujuan dapat menerima beberapa SJ. Klik × untuk melepas pilihan.</div>
        `;
        root.wtrackDropdown?.enhance?.(document.getElementById('sj-manual-link-courier'));
    }

    function render() {
        if (STATE.mode === 'bulk') return renderBulk();
        const body = document.getElementById('sj-manual-link-body');
        if (!body) return;
        const pool = STATE.pool;
        const applyButton = document.getElementById('sj-manual-link-apply');
        const target = selectedTarget();
        if (applyButton) {
            applyButton.disabled = !target || STATE.busy;
            applyButton.innerHTML = STATE.busy
                ? '<span class="spinner-border spinner-border-sm me-1" role="status" aria-label="Menyimpan"></span>Menyimpan…'
                : target ? '<i class="bi bi-link-45deg me-1"></i> Tautkan SJ' : '<i class="bi bi-link-45deg me-1"></i> Pilih Tujuan';
        }
        if (!pool) {
            body.innerHTML = '<div class="sj-link-banner">SJ tidak ditemukan di Pool. Muat ulang halaman.</div>';
            return;
        }
        const query = STATE.query.trim().toLowerCase();
        const visible = STATE.targets.filter(row => !query || row.text.includes(query));
        const rows = visible.length ? visible.map(row => {
            const checked = row.id === STATE.selected ? 'checked' : '';
            return `<tr class="sj-link-row ${checked ? 'is-linked' : ''}" style="cursor:pointer;" onclick="SJManualLink.selectTarget(this.dataset.row)" data-row="${esc(row.id)}">
                <td class="text-center"><input type="radio" class="form-check-input" name="sj-manual-target" ${checked} onchange="SJManualLink.selectTarget(this.dataset.row)" data-row="${esc(row.id)}"></td>
                <td style="font-size:12px;white-space:nowrap;">${esc(row.courier)}</td>
                <td style="font-size:12px;white-space:normal;"><strong>${esc(row.store || '-')}</strong><div class="text-muted" style="font-size:12px;">${esc((row.address || '-').slice(0, 100))}</div>${row.existingSJ ? `<div class="text-muted sj-link-number">SJ: ${esc(row.existingSJ)}</div>` : ''}</td>
                <td style="font-size:12px;white-space:nowrap;">${esc(row.status || '-')}</td>
            </tr>`;
        }).join('') : '<tr><td colspan="4" class="text-center text-muted py-4">Tidak ada tujuan manual yang cocok.</td></tr>';

        body.innerHTML = `
            <div class="sj-link-panel d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3">
                <div>
                    <div class="sj-link-label">Surat jalan terpilih</div>
                    <div class="fw-bold sj-link-number" style="font-size:15px;">${esc(pool.noSJ || pool.sjNumber || pool.id)}</div>
                    <div class="text-muted" style="font-size:12px;">${esc(pool.customer || pool.clientName || '-')} · ${esc(pool.storeDestination || pool.destinations?.[0]?.locationName || '-')}</div>
                </div>
                <div class="text-end" style="font-size:12px;">
                    <span class="sj-link-tag is-linked">Pool</span>
                    <div class="text-muted mt-1">${(pool.items || []).length || 1} item</div>
                </div>
            </div>
            <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
                <div class="position-relative flex-grow-1" style="min-width:220px;max-width:420px;">
                    <i class="bi bi-search position-absolute top-50 translate-middle-y text-muted" style="left:10px;font-size:12px;"></i>
                    <input type="text" class="form-control form-control-sm" id="sj-manual-link-search" value="${esc(STATE.query)}" placeholder="Cari kurir atau tujuan" aria-label="Cari kurir atau tujuan" style="padding-left:30px;font-size:12px;" oninput="SJManualLink.setQuery(this.value)">
                </div>
                <input type="date" id="sj-manual-link-date" aria-label="Tanggal pengiriman" class="form-control form-control-sm" style="width:145px;height:31px;font-size:12px;" value="${esc(STATE.date)}" onchange="SJManualLink.setDate(this.value)">
                <span class="text-muted" style="font-size:12px;">${visible.length} tujuan</span>
            </div>
            <div class="table-responsive border rounded-3" style="max-height:360px;background:#fff;">
                <table class="table table-sm align-middle mb-0" style="font-size:12px;">
                    <thead class="sticky-top" style="background:#F9FAFB;">
                        <tr><th style="width:34px;"></th><th>Kurir</th><th>Tujuan</th><th>Status</th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div class="text-muted mt-2" style="font-size:12px;">SJ akan ditambahkan ke tujuan yang dipilih.</div>
        `;
    }

    async function openByTrip(tripId) {
        const pool = poolTrip(tripId);
        if (!pool) {
            alert('SJ tidak ditemukan di SJ Pool. Muat ulang halaman.');
            return;
        }
        STATE.mode = 'single';
        STATE.pool = pool;
        STATE.poolTrips = [pool];
        STATE.selected = '';
        STATE.pairs.clear();
        STATE.autoPaired.clear();
        STATE.query = '';
        STATE.courier = '';
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

    async function openBulkFromSelection() {
        const selected = root.UnifiedPoolUI?.getSelectedTrips?.() || [];
        if (!selected.length) {
            alert('Centang SJ di SJ Pool terlebih dahulu.');
            return;
        }
        const ids = new Set(selected.map(trip => String(trip.noSJ || trip.sjNumber || trip.id || '').trim()));
        const poolTrips = (Array.isArray(window.allPoolTrips) ? window.allPoolTrips : [])
            .filter(trip => trip && (trip.noSJ || trip.sjNumber) && ids.has(String(trip.noSJ || trip.sjNumber || '').trim()));
        if (!poolTrips.length) {
            alert('SJ terpilih tidak lagi ada di Pool. Muat ulang halaman.');
            return;
        }
        const modal = document.getElementById('modal-sj-manual-link');
        if (!modal) {
            alert('Dialog Tautkan SJ belum tersedia. Muat ulang halaman.');
            return;
        }
        STATE.mode = 'bulk';
        STATE.pool = null;
        STATE.poolTrips = poolTrips;
        STATE.selected = '';
        STATE.activePoolId = poolIdOf(poolTrips[0]);
        STATE.pairs.clear();
        STATE.autoPaired.clear();
        STATE.query = '';
        STATE.date = todayWib();
        STATE.targets = collectTargets(STATE.date);
        const dateInput = document.getElementById('sj-manual-link-date');
        if (dateInput) dateInput.value = STATE.date;
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
        if (STATE.mode === 'bulk') {
            const valid = new Set(STATE.targets.map(row => row.id));
            for (const [poolId, targetId] of STATE.pairs) if (!valid.has(targetId)) STATE.pairs.delete(poolId);
            if (!STATE.poolTrips.some(pool => poolIdOf(pool) === STATE.activePoolId)) STATE.activePoolId = STATE.poolTrips.map(poolIdOf).find(id => !STATE.pairs.has(id)) || '';
        }
        render();
    }

    function selectTarget(rowId) {
        STATE.selected = String(rowId || '');
        render();
    }

    function applyLocal(target, pool, automatic = false) {
        const stored = JSON.parse(localStorage.getItem('wtrack_local_trips') || '[]');
        const manual = stored.find(trip => (trip.id || trip.tripId) === target.tripId);
        const poolTrip = stored.find(trip => (trip.id || trip.tripId) === pool.id || (trip.id || trip.tripId) === pool.tripId);
        if (!manual || !poolTrip) throw new Error('Data lokal berubah. Muat ulang.');
        const destinations = JSON.parse(JSON.stringify(manual.destinations || []));
        const index = destinations.findIndex(destination => destination.deliveryId === target.deliveryId);
        const fallback = destinations[target.destIndex];
        const destination = index >= 0 ? destinations[index] : (!fallback?.deliveryId && target.deliveryId === `${target.tripId}_STOP_${target.destIndex}` ? fallback : null);
        if (!destination) throw new Error('Tujuan sudah berubah.');
        if (automatic && !links.matches(poolTrip, {store: destination.locationName, customer: destination.customer, address: destination.address})) throw new Error('Tujuan SJ tidak lagi cocok. Muat ulang.');
        const noSJ = String(poolTrip.noSJ || poolTrip.sjNumber || '').trim();
        links.append(destination, {
            noSJ, sjTripId: poolTrip.id || poolTrip.tripId,
            storeId: core.storeKeyOf(poolTrip), clientId: core.normalize(poolTrip.customer || poolTrip.clientName || ''),
            source: links.sourceOf(poolTrip), adminSJ: poolTrip.adminSJ || '', sjMatchedAt: new Date().toISOString(), sjMatchRule: automatic ? 'automatic-store-match' : 'manual-link'
        });
        manual.destinations = destinations;
        const poolId = poolTrip.id || poolTrip.tripId;
        const next = stored.filter(trip => (trip.id || trip.tripId) !== poolId).map(trip =>
            (trip.id || trip.tripId) === target.tripId ? manual : trip
        );
        if (root.persistLocalSandboxTrips) return root.persistLocalSandboxTrips(next).then(() => ({manual, poolId}));
        localStorage.setItem('wtrack_local_trips', JSON.stringify(next));
        return Promise.resolve({manual, poolId});
    }

    async function applyOnline(target, pool, automatic = false) {
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
            const keySnap = await tx.get(keyRef);
            if (!manualSnap.exists) throw new Error('Trip manual sudah tidak ada.');
            if (!poolSnap.exists) throw new Error('SJ sudah tidak ada di Pool.');
            const poolData = poolSnap.data() || {};
            if (poolData.courierId || ['completed', 'done', 'delivered'].includes(String(poolData.status || '').toLowerCase())) {
                throw new Error('SJ sudah ditugaskan atau selesai. Muat ulang Pool.');
            }
            const manual = {...manualSnap.data(), id: target.tripId};
            const destinations = JSON.parse(JSON.stringify(manual.destinations || []));
            const index = destinations.findIndex(destination => destination.deliveryId === target.deliveryId);
            const fallback = destinations[target.destIndex];
            const destination = index >= 0 ? destinations[index] : (!fallback?.deliveryId && target.deliveryId === `${target.tripId}_STOP_${target.destIndex}` ? fallback : null);
            if (!destination) throw new Error('Tujuan manual sudah tidak ada.');
            const noSJ = String(poolData.noSJ || poolData.sjNumber || '').trim();
            if (noSJ !== String(pool.noSJ || pool.sjNumber || '').trim()) throw new Error('Nomor SJ berubah. Muat ulang Pool.');
            if ((destination.locationName || destination.storeName || destination.customer || '') !== target.store || (destination.address || '') !== target.address) throw new Error('Identitas tujuan berubah. Buka ulang dialog tautan SJ.');
            if (JSON.stringify(links.sourceOf(poolData)) !== JSON.stringify(links.sourceOf(pool))) throw new Error('Identitas SJ berubah. Muat ulang Pool.');
            const previousTripId = keySnap.exists ? keySnap.data()?.tripId : '';
            if (previousTripId && previousTripId !== (pool.id || pool.tripId)) throw new Error('SJ sudah tertaut ke trip lain. Muat ulang Pool.');
            if (automatic && !links.matches(poolData, {store: destination.locationName, customer: destination.customer, address: destination.address})) throw new Error('Tujuan SJ tidak lagi cocok. Muat ulang.');
            const now = new Date().toISOString();
            links.append(destination, {
                noSJ, sjTripId: pool.id || pool.tripId,
                storeId: core.storeKeyOf(poolData), clientId: core.normalize(poolData.customer || poolData.clientName || ''),
                source: links.sourceOf(poolData), adminSJ: poolData.adminSJ || '', sjMatchedAt: now, sjMatchRule: automatic ? 'automatic-store-match' : 'manual-link'
            });
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
                source: automatic ? 'admin-auto-link' : 'admin-manual-link',
                sourceIdentity: links.sourceOf(poolData),
                targetIdentity: {store: destination.locationName || '', customer: destination.customer || '', address: destination.address || ''},
                identityMatched: links.matches(poolData, {store: destination.locationName, customer: destination.customer}),
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

    function setCourier(value) {
        STATE.courier = value || '';
        render();
    }

    function autoPair() {
        if (!STATE.courier) {
            alert('Pilih kurir terlebih dahulu.');
            return;
        }
        const targets = STATE.targets.filter(row => row.courier === STATE.courier);
        const pools = STATE.poolTrips.filter(pool => !STATE.pairs.has(poolIdOf(pool)));
        const matched = links.autoPairs(pools, targets);
        for (const {pool, target} of matched) {
            STATE.pairs.set(poolIdOf(pool), target.id);
            STATE.autoPaired.add(poolIdOf(pool));
        }
        STATE.activePoolId = STATE.poolTrips.map(poolIdOf).find(id => !STATE.pairs.has(id)) || '';
        render();
        const unresolved = pools.length - matched.length;
        if (unresolved) alert(`${matched.length} SJ cocok. ${unresolved} SJ belum cocok atau memiliki beberapa tujuan. Pilih tujuan manual setelah memeriksa toko, PT, dan alamat.`);
    }

    function setActiveSJ(poolId) {
        if (!poolId) return;
        STATE.pairs.delete(String(poolId));
        STATE.autoPaired.delete(String(poolId));
        STATE.activePoolId = String(poolId);
        render();
    }

    function assignActive(targetId) {
        if (!targetId) return;
        if (!STATE.activePoolId) {
            alert('Pilih SJ di bagian atas terlebih dahulu.');
            return;
        }
        const target = STATE.targets.find(row => row.id === targetId);
        if (!target) return;
        STATE.pairs.set(String(STATE.activePoolId), String(targetId));
        STATE.autoPaired.delete(String(STATE.activePoolId));
        STATE.activePoolId = STATE.poolTrips.map(poolIdOf).find(id => !STATE.pairs.has(id)) || '';
        render();
    }

    function unassignPool(poolId) {
        if (!poolId) return;
        STATE.pairs.delete(String(poolId));
        STATE.autoPaired.delete(String(poolId));
        STATE.activePoolId = String(poolId);
        render();
    }

    async function applyBulk() {
        if (STATE.busy) return;
        const pairs = [...STATE.pairs.entries()].map(([poolId, targetId]) => ({
            target: STATE.targets.find(row => row.id === targetId),
            pool: STATE.poolTrips.find(pool => poolIdOf(pool) === poolId),
            automatic: STATE.autoPaired.has(poolId)
        })).filter(pair => pair.target && pair.pool);
        if (!pairs.length) return;
        if (new Set(pairs.map(pair => poolIdOf(pair.pool))).size !== pairs.length) {
            alert('Ada SJ yang dipakai lebih dari satu tujuan. Perbaiki pilihan.');
            return;
        }
        const mismatches = pairs.filter(({pool, target}) => !links.matches(pool, target));
        const details = mismatches.map(({pool, target}) => `${pool.noSJ || pool.sjNumber}: ${links.sourceOf(pool).customer} / ${links.sourceOf(pool).store} → ${target.store} (${target.address})`).join('\n');
        if (!confirm(`Tautkan ${pairs.length} SJ ke pengiriman manual?${mismatches.length ? `\n\n${mismatches.length} pasangan berbeda identitas atau belum dapat diverifikasi:\n${details}\n\nPastikan tujuan tersebut benar sebelum melanjutkan.` : ''}\nSJ terkait akan dihapus dari Pool.`)) return;
        STATE.busy = true;
        const applyButton = document.getElementById('sj-manual-link-apply');
        if (applyButton) { applyButton.disabled = true; applyButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Menyimpan…'; }
        const errors = [];
        let applied = 0;
        for (const [index, pair] of pairs.entries()) {
            try {
                const result = window.WTRACK_LOCAL_SANDBOX
                    ? await applyLocal(pair.target, pair.pool, pair.automatic)
                    : await applyOnline(pair.target, pair.pool, pair.automatic);
                updateLocalArrays(result.manual, result.poolId);
                applied++;
                if (applyButton) applyButton.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${index + 1}/${pairs.length}…`;
            } catch (error) {
                errors.push(`${pair.pool.noSJ || pair.pool.sjNumber || pair.pool.id}: ${error.message || error}`);
            }
        }
        STATE.busy = false;
        if (typeof root.showToast === 'function') {
            root.showToast(applied
                ? `${applied} SJ ditautkan ke pengiriman manual. ${pairs.length - applied ? `${pairs.length - applied} gagal.` : ''}`
                : 'Tidak ada SJ yang berhasil ditautkan.', applied ? 'success' : 'error');
        }
        if (errors.length) alert('Sebagian SJ gagal:\n' + errors.slice(0, 10).join('\n'));
        try { bootstrap.Modal.getInstance(document.getElementById('modal-sj-manual-link'))?.hide(); } catch (_) {}
        try { root.UnifiedPoolUI?.renderUnifiedPoolView?.(); } catch (_) {}
        try { root.renderRecentShipments?.(); } catch (_) {}
        try { root.updateGlobalStats?.(); } catch (_) {}
        STATE.pairs.clear();
        STATE.autoPaired.clear();
    }

    async function apply() {
        if (STATE.mode === 'bulk') return applyBulk();
        if (STATE.busy) return;
        const target = selectedTarget();
        if (!target || !STATE.pool) {
            alert('Pilih tujuan manual terlebih dahulu.');
            return;
        }
        const source = links.sourceOf(STATE.pool);
        if (!confirm(`Tautkan ${STATE.pool.noSJ || STATE.pool.sjNumber}?\nAsal SJ: ${source.customer} / ${source.store}\nAlamat SJ: ${source.address}\nTujuan: ${target.courier} — ${target.store}\nAlamat tujuan: ${target.address}\n${links.matches(STATE.pool, target) ? '' : 'Identitas berbeda atau belum dapat diverifikasi. Pastikan tujuan benar.\n'}SJ akan dihapus dari Pool.`)) return;
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

    root.SJManualLink = {openByTrip, openBulkFromSelection, setQuery, setDate, selectTarget, setActiveSJ, assignActive, unassignPool, setCourier, autoPair, apply, get state() { return {...STATE}; }};
})(window);
