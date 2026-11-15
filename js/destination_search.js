(function (root) {
    const normalize = text => String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const searchText = text => normalize(text).replace(/\b(jakbar|jaksel|jakpus|jakut|jaktim|warehouse)\b/g, word => ({
        jakbar: 'jakarta barat', jaksel: 'jakarta selatan', jakpus: 'jakarta pusat',
        jakut: 'jakarta utara', jaktim: 'jakarta timur', warehouse: 'wh'
    })[word]);
    function search(query, candidates) {
        const terms = searchText(query).split(/\s+/).filter(Boolean);
        if (!terms.length) return [];
        const seen = new Set();
        return candidates.map(candidate => {
            const name = String(candidate.name || candidate.locationName || candidate.customer || '').trim();
            const address = String(candidate.address || candidate.fullAddress || '').trim();
            const rawLat = candidate.lat ?? candidate.latitude;
            const rawLng = candidate.lng ?? candidate.longitude;
            const lat = parseFloat(rawLat), lng = parseFloat(rawLng);
            return {name, address, lat, lng};
        }).filter(candidate => {
            if (!candidate.name || !candidate.address || !Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lng)) return false;
            const name = normalize(candidate.name);
            // WH and warehouse are interchangeable; words can be separated by other words.
            const text = searchText(`${candidate.name} ${candidate.address}`);
            const words = text.split(/\s+/);
            const matches = terms.every(term => words.some(word => word.startsWith(term === 'warehouse' ? 'wh' : term)));
            const key = `${name}|${normalize(candidate.address)}`;
            if (!matches || seen.has(key)) return false;
            seen.add(key);
            return true;
        }).sort((a, b) => {
            const score = candidate => terms.filter(term => searchText(candidate.name).split(/\s+/).some(word => word.startsWith(term))).length;
            return score(b) - score(a) || a.name.localeCompare(b.name);
        }).slice(0, 8);
    }
    function history() {
        try { const value = JSON.parse(root.localStorage.getItem('wtrack_destination_search_history') || '[]'); return Array.isArray(value) ? value : []; }
        catch (_) { return []; }
    }
    function remember(place) {
        const previous = history().filter(item => normalize(item.name) !== normalize(place.name) || normalize(item.address) !== normalize(place.address));
        try { root.localStorage.setItem('wtrack_destination_search_history', JSON.stringify([place, ...previous].slice(0, 100))); } catch (_) {}
    }
    function candidates() {
        return [...(root.getDestinationSearchCandidates?.() || []), ...history()];
    }
    function init(input, select) {
        if (input.dataset.savedDestinationSearch) return;
        input.dataset.savedDestinationSearch = 'true';
        // Saved places have their own panel above the input. Never hide or cover Google predictions.
        const list = root.document.createElement('div');
        list.className = 'list-group shadow-sm mb-2';
        list.id = 'saved-destination-suggestions';
        Object.assign(list.style, {maxHeight:'180px', overflowY:'auto', display:'none'});
        list.setAttribute('aria-label', 'Tujuan tersimpan');
        const searchRow = input.parentElement.parentElement;
        searchRow.parentElement.insertBefore(list, searchRow);
        let matches = [];
        const hide = () => {
            list.style.display = 'none';
        };
        const choose = index => { const place = matches[index]; if (!place) return; hide(); select(place); input.blur(); };
        const draw = () => {
            matches = search(input.value, candidates()).slice(0, 4);
            list.replaceChildren();
            if (matches.length) {
                const label = root.document.createElement('small');
                label.className = 'list-group-item text-muted fw-semibold';
                label.textContent = 'Tujuan tersimpan / riwayat — pilih untuk memakai lokasi tersimpan';
                list.appendChild(label);
            }
            for (const [index, place] of matches.entries()) {
                const button = root.document.createElement('button');
                button.type = 'button';
                button.className = 'list-group-item list-group-item-action text-start';
                Object.assign(button.style, {display:'flex', alignItems:'center', gap:'8px', padding:'10px 12px', minWidth:'0', width:'100%'});
                button.title = `${place.name} — ${place.address}`;
                const icon = root.document.createElement('i');
                icon.className = 'bi bi-geo-alt text-muted';
                icon.setAttribute('aria-hidden', 'true');
                icon.style.flexShrink = '0';
                const name = root.document.createElement('span');
                name.className = 'fw-semibold'; name.textContent = place.name;
                Object.assign(name.style, {whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flexShrink:'1', minWidth:'0'});
                const address = root.document.createElement('small');
                address.className = 'text-muted'; address.textContent = place.address;
                Object.assign(address.style, {whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:'1', minWidth:'0'});
                button.append(icon, name, address);
                button.addEventListener('mousedown', event => event.preventDefault());
                button.addEventListener('click', () => choose(index));
                list.appendChild(button);
            }
            list.style.display = matches.length ? 'block' : 'none';
        };
        input.addEventListener('input', draw);
        input.addEventListener('focus', draw);
        input.addEventListener('blur', event => { if (!list.contains(event.relatedTarget)) hide(); });
        list.addEventListener('focusout', event => {
            if (event.relatedTarget !== input && !list.contains(event.relatedTarget)) hide();
        });
        input.addEventListener('keydown', event => {
            if (event.key === 'Escape') hide();
        });
        input.addEventListener('change', () => {if (!input.value) hide();});
    }
    const api = {search, remember, history, candidates, init};
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.DestinationSearch = api;
})(typeof window !== 'undefined' ? window : globalThis);
