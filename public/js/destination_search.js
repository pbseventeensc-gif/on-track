(function (root) {
    const normalize = text => String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    function search(query, candidates) {
        const terms = normalize(query).split(/\s+/).filter(Boolean);
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
            const text = normalize(`${candidate.name} ${candidate.address}`).replace(/\bwarehouse\b/g, 'warehouse wh');
            const matches = terms.every(term => text.includes(term === 'warehouse' ? 'wh' : term));
            const key = `${name}|${normalize(candidate.address)}`;
            if (!matches || seen.has(key)) return false;
            seen.add(key);
            return true;
        }).sort((a, b) => {
            const score = candidate => terms.filter(term => normalize(candidate.name).includes(term)).length;
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
        const list = root.document.createElement('div');
        list.className = 'list-group shadow-sm';
        Object.assign(list.style, {position:'absolute', top:'100%', left:'0', right:'0', zIndex:'1055', maxHeight:'280px', overflowY:'auto', display:'none'});
        list.setAttribute('aria-label', 'Tujuan tersimpan');
        input.parentElement.appendChild(list);
        let matches = [], active = -1;
        const hide = () => {list.style.display = 'none'; active = -1;};
        const choose = index => { const place = matches[index]; if (!place) return; hide(); select(place); };
        const draw = () => {
            matches = search(input.value, candidates());
            list.replaceChildren();
            active = -1;
            for (const [index, place] of matches.entries()) {
                const button = root.document.createElement('button');
                button.type = 'button';
                button.className = 'list-group-item list-group-item-action text-start';
                const name = root.document.createElement('div');
                name.className = 'fw-semibold'; name.textContent = place.name;
                const address = root.document.createElement('small');
                address.className = 'text-muted d-block'; address.textContent = place.address;
                button.append(name, address);
                button.addEventListener('mousedown', event => event.preventDefault());
                button.addEventListener('click', () => choose(index));
                list.appendChild(button);
            }
            list.style.display = matches.length ? 'block' : 'none';
        };
        input.addEventListener('input', draw);
        input.addEventListener('focus', draw);
        input.addEventListener('blur', hide);
        input.addEventListener('keydown', event => {
            if (list.style.display === 'none') return;
            if (event.key === 'Escape') {hide(); return;}
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault(); event.stopImmediatePropagation();
                active = (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
                [...list.children].forEach((child, index) => child.classList.toggle('active', index === active));
            } else if (event.key === 'Enter' && (active >= 0 || matches.length === 1)) {
                event.preventDefault(); event.stopImmediatePropagation(); choose(active >= 0 ? active : 0);
            }
        }, true);
        input.addEventListener('change', () => {if (!input.value) hide();});
    }
    const api = {search, remember, history, candidates, init};
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.DestinationSearch = api;
})(typeof window !== 'undefined' ? window : globalThis);
