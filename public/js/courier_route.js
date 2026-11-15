(function () {
    'use strict';
    if (!window.WTRACK_LOCAL_SANDBOX) return;
    const selected = new Map();
    let available = new Map();
    const keyOf = shipment => JSON.stringify([shipment.rootTripId || shipment.id, shipment.deliveryId || shipment.id]);
    const escape = value => String(value ?? '').replace(/[&<>"']/g,
        char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
    const fingerprint = shipment => JSON.stringify([shipment.noSJ, shipment.destination, shipment.address,
        shipment.latitude, shipment.longitude, shipment.locationNeedsReview]);

    function destination(shipment) {
        const single = getGoogleMapsNavUrl(shipment);
        if (single) {
            const dest = new URL(single).searchParams.get('destination')?.replace(/\|/g, ', ') || '';
            if (dest) return dest;
        }
        const label = typeof getCompactCourierLabel === 'function' ? getCompactCourierLabel(shipment) : (shipment.destination || shipment.address || '');
        if (label && !/^(?:-|customer\s*\/\s*klien|customer|tujuan(?: pengantaran)?|alamat lokasi)$/i.test(String(label).trim())) {
            return String(label).trim();
        }
        return '';
    }

    function eligible(shipment) {
        return shipment && !['delivered', 'completed', 'done'].includes(shipment.status) &&
            !isShipmentHistory(shipment) && !!destination(shipment);
    }

    function buildUrl(shipments) {
        if (!shipments.length || shipments.length > 4) throw new Error('Pilih 1–4 titik untuk satu rute.');
        const points = shipments.map(destination);
        if (points.some(point => !point)) throw new Error('Lengkapi alamat atau pin tujuan terlebih dahulu.');
        const url = new URL('https://www.google.com/maps/dir/');
        url.searchParams.set('api', '1');
        // Omit origin: Maps uses the courier's current location.
        url.searchParams.set('destination', points[points.length - 1]);
        if (points.length > 1) url.searchParams.set('waypoints', points.slice(0, -1).join('|'));
        url.searchParams.set('dir_action', 'navigate');
        return url.href;
    }

    function buildBatches(shipments) {
        const batches = [];
        let current = [], start = 1;
        const flush = () => {
            if (!current.length) return;
            batches.push({start, end: start + current.length - 1, url: buildUrl(current)});
            start += current.length;
            current = [];
        };
        shipments.forEach(shipment => {
            if (current.length === 4 || (current.length && buildUrl([...current, shipment]).length > 2048)) flush();
            if (buildUrl([shipment]).length > 2048) throw new Error('Alamat tujuan terlalu panjang. Gunakan pin lokasi yang tepat.');
            current.push(shipment);
        });
        flush();
        return batches;
    }

    function sync(shipments) {
        available = new Map(shipments.filter(eligible).map(shipment => [keyOf(shipment), shipment]));
        for (const [key, previous] of selected) {
            const latest = available.get(key);
            if (!latest || fingerprint(previous) !== fingerprint(latest)) selected.delete(key);
            else selected.set(key, latest);
        }
        update();
    }

    function toggle(key, checked) {
        if (checked && available.has(key)) selected.set(key, available.get(key));
        else selected.delete(key);
        update();
    }

    function move(key, direction) {
        const entries = [...selected];
        const index = entries.findIndex(([id]) => id === key);
        const next = index + direction;
        if (index < 0 || next < 0 || next >= entries.length || ![-1, 1].includes(direction)) return;
        [entries[index], entries[next]] = [entries[next], entries[index]];
        selected.clear();
        entries.forEach(([id, shipment]) => selected.set(id, shipment));
        update();
    }

    function clear() {
        selected.clear();
        update();
    }

    function checkbox(shipment) {
        if (!eligible(shipment)) return '';
        const key = keyOf(shipment);
        return `<input type="checkbox" class="courier-route-check" data-route-key="${escape(key)}" aria-label="Pilih ${escape(getCompactCourierLabel(shipment))} untuk rute" title="Pilih untuk rute Maps" ${selected.has(key) ? 'checked' : ''} onclick="event.stopPropagation()" onchange="CourierRoute.toggle(this.dataset.routeKey,this.checked)">`;
    }

    function update() {
        document.querySelectorAll('.courier-route-check').forEach(input => {
            input.checked = selected.has(input.dataset.routeKey);
        });
        const rows = [...selected.values()];
        let routes = '', error = '';
        try {
            const batches = buildBatches(rows);
            routes = batches.map(batch => `<a class="courier-route-link" href="${escape(batch.url)}" target="_blank" rel="noopener" aria-label="Navigasi titik ${batch.start} sampai ${batch.end}">${batches.length > 1 ? `Navigasi ${batch.start}–${batch.end}` : `Navigasi (${rows.length})`}</a>`).join('');
        } catch (failure) { error = failure.message; }
        const list = [...selected].map(([key, shipment], index) => `<li>
            <span class="courier-route-name">${escape(getCompactCourierLabel(shipment))}</span>
            <button type="button" data-key="${escape(key)}" onclick="CourierRoute.move(this.dataset.key,-1)" ${index === 0 ? 'disabled' : ''} aria-label="Naikkan titik ${index + 1}">↑</button>
            <button type="button" data-key="${escape(key)}" onclick="CourierRoute.move(this.dataset.key,1)" ${index === rows.length - 1 ? 'disabled' : ''} aria-label="Turunkan titik ${index + 1}">↓</button>
            <button type="button" data-key="${escape(key)}" onclick="CourierRoute.toggle(this.dataset.key,false)" aria-label="Hapus titik ${index + 1} dari rute">×</button>
        </li>`).join('');
        document.querySelectorAll('[data-courier-route-panel]').forEach(panel => {
            panel.hidden = false;
            panel.innerHTML = `<div class="courier-route-heading"><strong>Rute pengantaran${rows.length ? ` · ${rows.length} titik` : ''}</strong>
                ${rows.length ? '<button type="button" onclick="CourierRoute.clear()">Reset</button>' : ''}</div>
                ${rows.length ? `<ol>${list}</ol>` : '<small>Centang titik pada kartu sesuai urutan kunjungan.</small>'}
                <div class="courier-route-actions">${routes}</div>
                ${rows.length > 4 ? '<small>Selesaikan rute pertama, lalu buka rute berikutnya dari lokasi Anda saat itu.</small>' : ''}
                ${error ? `<small class="text-danger">${escape(error)}</small>` : ''}`;
        });
    }

    window.CourierRoute = {sync, toggle, move, clear, checkbox, buildUrl, buildBatches, keyOf};
    document.addEventListener('DOMContentLoaded', () => sync(getValidCourierShipments()));
})();
