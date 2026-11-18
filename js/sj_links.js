/* Several Surat Jalan may belong to one physical delivery stop. */
(function (root) {
    'use strict';
    const clean = value => String(value || '').replace(/^#/, '').trim();
    function numbers(row) {
        const values = [row?.noSJ, row?.sjNumber, ...(row?.sjLinks || []).map(link => link.noSJ)];
        return [...new Map(values.map(clean).filter(value => value && value !== '-').map(value => [value.toUpperCase(), value])).values()];
    }
    function label(row, fallback) {
        return (numbers(row).length ? numbers(row) : numbers(fallback)).join(', ');
    }
    function append(destination, link) {
        const noSJ = clean(link.noSJ);
        if (!noSJ) throw new Error('Nomor SJ kosong.');
        if (numbers(destination).some(value => value.toUpperCase() === noSJ.toUpperCase())) throw new Error('SJ sudah tertaut ke tujuan ini.');
        const links = (destination.sjLinks || []).map(row => ({...row}));
        const primary = clean(destination.noSJ || destination.sjNumber);
        if (primary && !links.some(row => clean(row.noSJ).toUpperCase() === primary.toUpperCase())) {
            const previous = {noSJ: primary};
            for (const key of ['sjTripId', 'sjMatchedAt', 'sjMatchRule', 'storeId', 'clientId', 'adminSJ']) {
                if (destination[key] != null) previous[key] = destination[key];
            }
            links.unshift(previous);
        }
        links.push({...link, noSJ});
        destination.sjLinks = links;
        if (!primary) {
            destination.noSJ = noSJ;
            destination.sjNumber = noSJ;
            for (const key of ['sjTripId', 'sjMatchedAt', 'sjMatchRule']) {
                if (link[key] != null) destination[key] = link[key];
            }
        }
        if (!destination.adminSJ && link.adminSJ) destination.adminSJ = link.adminSJ;
        if (!destination.customer && link.source?.customer) destination.customer = link.source.customer;
        return destination;
    }
    function remove(destination, removeNumbers) {
        const removeSet = new Set(removeNumbers.map(value => clean(value).toUpperCase()));
        const removed = numbers(destination).filter(value => removeSet.has(value.toUpperCase()));
        if (!removed.length) return removed;
        const entries = (destination.sjLinks || []).map(link => ({...link}));
        for (const value of numbers(destination)) {
            if (!entries.some(link => clean(link.noSJ).toUpperCase() === value.toUpperCase())) {
                const legacy = {noSJ: value};
                for (const key of ['sjTripId', 'sjMatchedAt', 'sjMatchRule', 'storeId', 'clientId', 'adminSJ']) {
                    if (destination[key] != null) legacy[key] = destination[key];
                }
                entries.unshift(legacy);
            }
        }
        const remaining = entries.filter(link => !removeSet.has(clean(link.noSJ).toUpperCase()));
        const primary = remaining.find(link => clean(link.noSJ).toUpperCase() === clean(destination.noSJ || destination.sjNumber).toUpperCase()) || remaining[0];
        for (const key of ['noSJ', 'sjNumber', 'sjTripId', 'sjMatchedAt', 'sjMatchRule', 'sjLinks', 'sjIdentityStatus']) delete destination[key];
        if (primary) {
            destination.sjLinks = remaining;
            destination.noSJ = clean(primary.noSJ);
            destination.sjNumber = clean(primary.noSJ);
            for (const key of ['sjTripId', 'sjMatchedAt', 'sjMatchRule']) if (primary[key] != null) destination[key] = primary[key];
            if (remaining.some(link => link.identityStatus === 'needs-review')) destination.sjIdentityStatus = 'needs-review';
        }
        return removed;
    }
    const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    function sourceOf(pool) {
        const d = pool?.destinations?.[0] || {};
        return {customer: pool.customer || pool.clientName || d.customer || d.clientName || '',
            store: pool.storeDestination || d.storeDestination || d.locationName || pool.storeName || '',
            address: pool.address || d.address || ''};
    }
    function storeKey(value) {
        return normalize(String(value || '').split(',')[0].replace(/\bUP\s*:.*$/i, '').replace(/^\s*(?:STORE|TOKO)\s+/i, ''))
            .replace(/\bgyu kaku\b/g, 'gyukaku')
            .replace(/\blw\b/g, 'living world').replace(/\blp\b/g, 'living plaza');
    }
    function streetOf(address) {
        const match = String(address || '').match(/\b(?:jl\.?|jalan)\s+([^,]+)/i);
        if (!match) return null;
        const line = normalize(match[1]);
        const road = line.split(/\b(?:no|nomor|kav|km|blok|rt|rw|kec|kel)\b/)[0].trim();
        const number = line.match(/\b(?:no|nomor)\s*(\d+[a-z]?)/)?.[1] || '';
        return road ? {road, number} : null;
    }
    function matches(pool, target) {
        const source = sourceOf(pool);
        const sourceStore = storeKey(source.store), targetStore = storeKey(target.store || target.locationName);
        const sourceCustomer = normalize(source.customer), targetCustomer = normalize(target.customer || target.clientName);
        if (!sourceStore || sourceStore !== targetStore) return false;
        if (sourceCustomer && targetCustomer && sourceCustomer !== targetCustomer) return false;
        const from = streetOf(source.address), to = streetOf(target.address);
        if (from && to && (from.road !== to.road || (from.number && to.number && from.number !== to.number))) return false;
        if (sourceStore === storeKey(source.customer) && !(from && to)) return false;
        return true;
    }
    function autoPairs(pools, targets) {
        const result = [];
        for (const pool of pools) {
            const candidates = targets.filter(target => matches(pool, target));
            if (candidates.length === 1) result.push({pool, target: candidates[0]});
        }
        return result;
    }
    const api = {numbers, label, append, remove, sourceOf, matches, autoPairs};
    root.SJLinks = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
