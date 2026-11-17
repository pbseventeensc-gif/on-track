/* Pure matching helpers for SJ Pool ↔ Manual Dispatch reconciliation. */
(function (root) {
    'use strict';

    function text(value) {
        return String(value == null ? '' : value).normalize('NFKC').trim();
    }

    function normalize(value) {
        return text(value)
            .toLocaleLowerCase('id-ID')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Normalize a store label for exact matching. "STORE GYU KAKU SUNTER MALL,
    // UP : KARYAWAN" and "Gyu-Kaku Sunter Mall" must resolve to one key.
    function storeCore(value) {
        let result = text(value).split(',')[0];
        result = result.replace(/\bUP\s*:.*$/i, '');
        result = result.replace(/^\s*(?:STORE|TOKO)\s+/i, '');
        return normalize(result);
    }

    function storeKeyOf(trip) {
        const destination = (trip && Array.isArray(trip.destinations) && trip.destinations[0]) || {};
        const candidates = [
            trip && trip.storeDestination,
            destination.storeDestination,
            destination.locationName,
            trip && trip.storeName,
            trip && trip.customer,
            destination.customer,
            trip && trip.address,
            destination.address
        ];
        for (const candidate of candidates) {
            const key = storeCore(candidate);
            if (key) return key;
        }
        return '';
    }

    function aliasKeyOf(row) {
        return storeCore(row && (row.storeName || row.locationName)) ||
            normalize(row && row.address) || '';
    }

    function manualRowKey(row) {
        return String(row && (row.deliveryId || row.id) || '');
    }

    /**
     * @param {Array} manualRows  {id, storeName, address, customer, deliveryId,...}
     * @param {Array} poolRows    {id, noSJ, key, customer, store, address,...}
     * @param {Map|Object} aliases raw manual store key -> canonical pool store key
     * @param {Map|Object} selection row id -> pool id
     */
    function buildPreview(manualRows, poolRows, aliases = new Map(), selection = new Map()) {
        const alias = aliases instanceof Map ? aliases : new Map(Object.entries(aliases || {}));
        const selected = selection instanceof Map ? selection : new Map(Object.entries(selection || {}));
        const byKey = new Map();
        const byPoolId = new Map();
        (poolRows || []).forEach(pool => {
            const id = String(pool.id || '');
            if (!id) return;
            pool._key = String(pool.key || '');
            byPoolId.set(id, pool);
            if (!pool._key) return;
            if (!byKey.has(pool._key)) byKey.set(pool._key, []);
            byKey.get(pool._key).push(pool);
        });

        const used = new Set();
        const rows = (manualRows || []).map(row => {
            const baseKey = String(row.baseKey || aliasKeyOf(row));
            const matchKey = String(alias.get(baseKey) || baseKey || '');
            const keyCandidates = (byKey.get(matchKey) || []).slice();
            const chosen = selected.get(manualRowKey(row));
            let candidates = keyCandidates;
            let selectedPoolId = chosen && byPoolId.has(String(chosen)) ? String(chosen) : '';
            if (selectedPoolId && !candidates.some(candidate => String(candidate.id) === selectedPoolId)) {
                selectedPoolId = '';
            }
            if (!selectedPoolId && candidates.length === 1 && !used.has(String(candidates[0].id))) {
                selectedPoolId = String(candidates[0].id);
            }
            let status = 'unmatched';
            if (selectedPoolId) {
                status = 'matched';
                used.add(selectedPoolId);
            } else if (candidates.length > 1) {
                status = 'ambiguous';
            }
            return {
                ...row,
                baseKey,
                matchKey,
                candidates,
                selectedPoolId,
                status
            };
        });

        const counts = {
            manual: rows.length,
            pool: (poolRows || []).length,
            matched: rows.filter(row => row.status === 'matched').length,
            ambiguous: rows.filter(row => row.status === 'ambiguous').length,
            unmatched: rows.filter(row => row.status === 'unmatched').length
        };
        return {rows, counts, byPoolId};
    }

    const api = {text, normalize, storeCore, storeKeyOf, aliasKeyOf, manualRowKey, buildPreview};
    root.SJReconcileCore = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
