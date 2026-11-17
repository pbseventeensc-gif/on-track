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
        return destination;
    }
    const api = {numbers, label, append};
    root.SJLinks = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
