const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(local = true) {
    const panel = {hidden: true, innerHTML: ''};
    const c = vm.createContext({URL, window: {WTRACK_LOCAL_SANDBOX: local},
        document: {addEventListener() {}, querySelectorAll: selector => selector === '[data-courier-route-panel]' ? [panel] : []},
        isShipmentHistory: shipment => !!shipment.history
    });
    vm.runInContext(fs.readFileSync('js/maps_destination.js', 'utf8'), c);
    const html = fs.readFileSync('kurir.html', 'utf8');
    const navStart = html.indexOf('    function getGoogleMapsNavUrl(');
    vm.runInContext(html.slice(navStart, html.indexOf('    function parseWtrackBarcode(', navStart)), c);
    const labelStart = html.indexOf('    function getCompactCourierLabel(');
    vm.runInContext(html.slice(labelStart, html.indexOf('    function renderShipmentCardHtml(', labelStart)), c);
    vm.runInContext(fs.readFileSync('js/courier_route.js', 'utf8'), c);
    return {api: c.window.CourierRoute, panel};
}
const stop = (id, extra = {}) => ({id, rootTripId: 'trip', deliveryId: id, destinationIndex: Number(id),
    noSJ: `SJ-${id}`, destination: `Toko ${id}`, address: `Jl. Tujuan ${id}`, status: 'in-transit', ...extra});

test('Google Maps follows selection order with current location as origin and the last point as destination', () => {
    const {api} = setup();
    const points = [stop('3'), stop('1'), stop('2')];
    const url = new URL(api.buildUrl(points));
    assert.equal(url.origin, 'https://www.google.com');
    assert.equal(url.pathname, '/maps/dir/');
    assert.equal(url.searchParams.get('api'), '1');
    assert.equal(url.searchParams.has('origin'), false);
    assert.equal(url.searchParams.get('waypoints'), 'Jl. Tujuan 3|Jl. Tujuan 1');
    assert.equal(url.searchParams.get('destination'), 'Jl. Tujuan 2');
    assert.equal(url.searchParams.get('dir_action'), 'navigate');
});

test('rundown can be reordered and both the list and Maps URL follow that order', () => {
    const {api, panel} = setup();
    const points = [stop('1'), stop('2'), stop('3')];
    api.sync(points);
    points.forEach(point => api.toggle(api.keyOf(point), true));
    api.move(api.keyOf(points[2]), -1);
    assert.ok(panel.innerHTML.indexOf('Toko 3') < panel.innerHTML.indexOf('Toko 2'));
    const href = /href="([^"]+)"/.exec(panel.innerHTML)[1].replaceAll('&amp;', '&');
    const url = new URL(href);
    assert.equal(url.searchParams.get('waypoints'), 'Jl. Tujuan 1|Jl. Tujuan 3');
    assert.equal(url.searchParams.get('destination'), 'Jl. Tujuan 2');
    api.clear();
    assert.ok(!panel.innerHTML.includes('href='));
});

test('many selected stops become ordered mobile-compatible routes without dropping any point', () => {
    const {api} = setup();
    const batches = api.buildBatches(Array.from({length: 9}, (_, index) => stop(String(index + 1))));
    assert.equal(batches.length, 3);
    assert.deepEqual(Array.from(batches, batch => [batch.start, batch.end]), [[1, 4], [5, 8], [9, 9]]);
    const visited = batches.flatMap(batch => {
        const params = new URL(batch.url).searchParams;
        assert.ok(!params.has('origin'));
        return [...(params.get('waypoints')?.split('|') || []), params.get('destination')];
    });
    assert.deepEqual(Array.from(visited), Array.from({length: 9}, (_, index) => `Jl. Tujuan ${index + 1}`));
});

test('exact pins and store addresses are retained, without using billing customers as destinations', () => {
    const {api} = setup();
    const url = new URL(api.buildUrl([
        stop('1', {latitude: -6.17, longitude: 106.78, address: 'Other address'}),
        stop('2', {customer: 'PT BILLING ONLY', storeDestination: 'Gold Coast Office, Jl. Pantai Indah Kapuk', latitude: -6.2088, longitude: 106.8456})
    ]));
    assert.equal(url.searchParams.get('waypoints'), '-6.17,106.78');
    assert.equal(url.searchParams.get('destination'), 'Gold Coast Office');
    assert.ok(!url.href.includes('BILLING'));
});

test('completed, old, missing-address and transferred stops leave the selection', () => {
    const {api, panel} = setup();
    const points = [stop('1'), stop('2'), stop('3')];
    api.sync(points);
    points.forEach(point => api.toggle(api.keyOf(point), true));
    api.sync([stop('1', {status: 'delivered'}), stop('2', {history: true})]);
    assert.ok(!panel.innerHTML.includes('href='));
    assert.equal(api.checkbox(stop('4', {address: '', destination: 'Customer'})), '');
    api.sync(points);
    api.toggle(api.keyOf(points[0]), true);
    api.sync([stop('1', {address: 'Changed address'}), ...points.slice(1)]);
    assert.ok(!panel.innerHTML.includes('href='));
});

test('same-address clients remain separate selections; address punctuation cannot add phantom stops', () => {
    const {api} = setup();
    const a = stop('1', {address: 'Gedung A | Pintu 2 & #3'});
    const b = stop('2', {address: a.address});
    assert.notEqual(api.keyOf(a), api.keyOf(b));
    const params = new URL(api.buildUrl([a, b])).searchParams;
    assert.equal(params.get('waypoints'), 'Gedung A ,  Pintu 2 & #3');
    assert.equal(params.get('destination'), params.get('waypoints'));
});

test('long links split earlier, while an unusably long individual address is rejected', () => {
    const {api} = setup();
    const points = [stop('1', {address: 'A'.repeat(900)}), stop('2', {address: 'B'.repeat(900)}), stop('3', {address: 'C'.repeat(900)})];
    const batches = api.buildBatches(points);
    assert.equal(batches.length, 2);
    assert.ok(batches.every(batch => batch.url.length <= 2048));
    assert.throws(() => api.buildBatches([stop('1', {address: 'A'.repeat(2100)})]), /terlalu panjang/);
});

test('route planner activates only in the local sandbox', () => {
    const {api, panel} = setup(false);
    assert.equal(api, undefined);
    assert.equal(panel.hidden, true);
});
