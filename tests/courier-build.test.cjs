const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {COURIER_ASSETS, buildCourier} = require('../scripts/courier-build.cjs');

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wtrack-courier-build-'));
    fs.writeFileSync(path.join(root, 'kurir.html'), '<html data-build="old"><body>courier</body></html>');
    fs.mkdirSync(path.join(root, 'js'));
    for (const asset of COURIER_ASSETS) {
        if (asset === 'kurir.html') continue;
        fs.writeFileSync(path.join(root, asset), 'courier asset ' + asset);
    }
    return root;
}

test('courier build is stable and ignores admin-only JavaScript changes', () => {
    const root = fixture();
    const initial = buildCourier(root);
    fs.writeFileSync(path.join(root, 'js', 'app.js'), 'admin dashboard changed');
    assert.equal(buildCourier(root), initial);
    fs.writeFileSync(path.join(root, 'js', 'courier_updates.js'), 'courier update changed');
    assert.notEqual(buildCourier(root), initial);
});

test('courier build changes when the courier page or a listed courier asset changes', () => {
    const root = fixture();
    const initial = buildCourier(root);
    fs.writeFileSync(path.join(root, 'js', 'maps_destination.js'), 'destination changed');
    const afterMaps = buildCourier(root);
    assert.notEqual(afterMaps, initial);
    fs.writeFileSync(path.join(root, 'kurir.html'), '<html data-build="old"><body>courier v2</body></html>');
    assert.notEqual(buildCourier(root), afterMaps);
});

test('courier build ignores its own data-build stamp', () => {
    const root = fixture();
    const initial = buildCourier(root);
    fs.writeFileSync(path.join(root, 'kurir.html'), '<html data-build="new-stamp"><body>courier</body></html>');
    assert.equal(buildCourier(root), initial);
});
