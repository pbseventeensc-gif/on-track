(function () {
    const selected = new Map();
    let visible = new Map();
    let pending = [];
    const keyOf = row => JSON.stringify([row.tripId, row.deliveryId || row.destinationIndex]);

    function sync(rows) {
        visible = new Map(rows.map(row => [keyOf(row), row]));
        for (const key of selected.keys()) {
            if (!visible.has(key)) selected.delete(key);
        }
        update();
    }

    function update() {
        const all = document.getElementById('recent-select-all');
        if (all) {
            all.checked = visible.size > 0 && selected.size === visible.size;
            all.indeterminate = selected.size > 0 && selected.size < visible.size;
            all.disabled = visible.size === 0;
        }
        const button = document.getElementById('recent-switch-selected');
        if (button) {
            button.disabled = selected.size === 0;
            button.textContent = `Switch (${selected.size})`;
        }
        document.querySelectorAll('#recent-shipments-table .shipment-select').forEach(input => {
            input.checked = selected.has(input.dataset.key);
        });
    }

    function toggle(key, checked) {
        if (checked && visible.has(key)) selected.set(key, visible.get(key));
        else selected.delete(key);
        update();
    }

    function selectAll(checked) {
        selected.clear();
        if (checked) visible.forEach((row, key) => selected.set(key, row));
        update();
    }

    function open() {
        if (!selected.size) return;
        pending = Array.from(selected.values()).map(row => ({
            ...row, sourceCourierId: row.courierId || '', snapshot: row.destinationSnapshot
        }));
        const modal = document.getElementById('switchCourierModal');
        document.getElementById('switch-modal-mode').value = 'selected_stops';
        document.getElementById('switch-modal-reason').value = '';
        document.getElementById('switch-modal-shipment-id').innerText = `${pending.length} pengantaran terpilih`;
        document.getElementById('switch-modal-destination-name').innerText = 'Hanya baris yang dicentang akan dialihkan';
        const carrier = document.getElementById('switch-modal-current-carrier');
        carrier.innerText = [...new Set(pending.map(row => row.carrier))].join(', ');
        carrier.className = 'badge bg-light text-dark border text-wrap';
        document.getElementById('switch-scope-container').style.display = 'none';
        document.getElementById('switch-courier-step-num').innerText = '1';
        document.getElementById('switch-target-preview').classList.add('d-none');
        const target = document.getElementById('switch-modal-target-courier');
        target.innerHTML = buildCourierOptgroupHtml('-- Pilih Kurir / Driver Pengganti --', 'defaultUid');
        target.value = '';
        (bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal)).show();
    }

    async function transfer(db, rows, targetUid, vehicleType, reason) {
        const groups = new Map();
        rows.forEach(row => {
            if (!groups.has(row.tripId)) groups.set(row.tripId, []);
            groups.get(row.tripId).push(row);
        });
        if (!groups.size) throw new Error('Pilih pengantaran terlebih dahulu.');
        if (groups.size > 200) throw new Error('Maksimal 200 surat jalan dalam satu switch.');
        const plans = [...groups].map(([id, entries]) => ({
            ref: db.collection('trips').doc(id), entries,
            newRef: db.collection('trips').doc()
        }));
        return db.runTransaction(async transaction => {
            // Read every source before writing so the move is atomic across trips.
            const snapshots = await Promise.all(plans.map(plan => transaction.get(plan.ref)));
            let moved = 0;
            plans.forEach((plan, i) => {
                const snap = snapshots[i];
                if (!snap.exists) throw new Error('Data pengiriman sudah dihapus. Refresh dan pilih ulang.');
                const trip = snap.data();
                if (typeof isTripInActiveBranch === 'function' && !isTripInActiveBranch(trip)) {
                    throw new Error('Cabang pengiriman berubah. Refresh dan pilih ulang.');
                }
                const indexes = new Set();
                plan.entries.forEach(row => {
                    const index = row.deliveryId
                        ? (trip.destinations || []).findIndex(d => d.deliveryId === row.deliveryId)
                        : row.destinationIndex;
                    if (trip.courierId !== row.sourceCourierId || index < 0 ||
                        JSON.stringify(trip.destinations?.[index]) !== row.snapshot) {
                        throw new Error('Data penugasan berubah. Tutup dialog, refresh dan pilih ulang.');
                    }
                    indexes.add(index);
                });
                const source = normalizeCourierIdentity(trip.courierId || '', '');
                const target = normalizeCourierIdentity(targetUid, '');
                if (trip.courierId === targetUid || (source.canonicalId && source.canonicalId === target.canonicalId)) return;
                const timestamp = firebase.firestore.Timestamp.now();
                const assignment = {
                    courierId: targetUid, vehicleType,
                    status: !trip.status || trip.status === 'pool' ? 'in_progress' : trip.status,
                    previousCourierId: trip.courierId || '', switchedAt: timestamp,
                    switchedReason: reason || 'Switch penugasan terpilih oleh admin', acceptedTime: timestamp
                };
                if (indexes.size === trip.destinations.length) {
                    transaction.update(plan.ref, assignment);
                } else {
                    const chosen = trip.destinations.filter((d, index) => indexes.has(index));
                    const remaining = trip.destinations.filter((d, index) => !indexes.has(index));
                    transaction.update(plan.ref, {destinations: remaining});
                    // Copy full destination records, including SJ, identity, items and proof.
                    const newTrip = {...trip, ...assignment, tripId: plan.newRef.id,
                        switchedFromTripId: plan.ref.id, destinations: chosen};
                    if ('id' in newTrip) newTrip.id = plan.newRef.id;
                    transaction.set(plan.newRef, newTrip);
                }
                moved += indexes.size;
            });
            return moved;
        });
    }

    async function confirm(db, targetUid, vehicleType, reason) {
        const moved = await transfer(db, pending, targetUid, vehicleType, reason);
        selected.clear();
        pending = [];
        update();
        return moved;
    }

    window.BulkAssignment = {sync, update, toggle, selectAll, open, confirm, transfer, keyOf,
        isSelected: row => selected.has(keyOf(row))};
})();
