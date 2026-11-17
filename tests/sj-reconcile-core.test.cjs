const {test} = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/sj_reconcile_core.js');

const manual = (id, store, extra = {}) => ({
    id, deliveryId: id, storeName: store, address: extra.address || `Alamat ${store}`, customer: extra.customer || '', ...extra
});
const pool = (id, noSJ, store, extra = {}) => ({
    id, noSJ, key: core.storeKeyOf({storeDestination: store, destinations: [{storeDestination: store}]}),
    customer: extra.customer || '', store, address: extra.address || ''
});

test('store labels normalize prefixes, punctuation and UP notes', () => {
    assert.equal(core.storeCore('STORE AZKO GRAND CAKUNG, UP : KARYAWAN'), 'azko grand cakung');
    assert.equal(core.storeCore('Azko Grand Cakung'), 'azko grand cakung');
    assert.equal(core.storeCore('STORE GYU KAKU SUNTER MALL, Sunter Mall. 1st Floor'), 'gyu kaku sunter mall');
    assert.equal(core.storeKeyOf({storeDestination: 'STORE TOYS KINGDOM LIPPO MALL KEMANG'}), 'toys kingdom lippo mall kemang');
});

test('unique store matches become a 1:1 match', () => {
    const preview = core.buildPreview(
        [manual('m1', 'AZKO Grand Cakung')],
        [pool('p1', 'SJ-1', 'STORE AZKO GRAND CAKUNG', {customer: 'PT A'})]
    );
    assert.equal(preview.rows[0].status, 'matched');
    assert.equal(preview.rows[0].selectedPoolId, 'p1');
    assert.equal(preview.counts.matched, 1);
});

test('multiple SJ at one store are ambiguous and never auto-applied', () => {
    const preview = core.buildPreview(
        [manual('m1', 'STORE GYUKAKU SUNTER MALL')],
        [pool('p1', 'SJ-1', 'STORE GYUKAKU SUNTER MALL'), pool('p2', 'SJ-2', 'STORE GYUKAKU SUNTER MALL')]
    );
    assert.equal(preview.rows[0].status, 'ambiguous');
    assert.equal(preview.rows[0].selectedPoolId, '');
    assert.equal(preview.counts.ambiguous, 1);
});

test('aliases resolve a manual abbreviation to the canonical store key', () => {
    const aliases = new Map([['gyu kaku mkg', 'gyukaku mall kelapa gading 3']]);
    const preview = core.buildPreview(
        [manual('m1', 'Gyu-Kaku MKG')],
        [pool('p1', 'SJ-1', 'STORE GYUKAKU MALL KELAPA GADING 3')],
        aliases
    );
    assert.equal(preview.rows[0].matchKey, 'gyukaku mall kelapa gading 3');
    assert.equal(preview.rows[0].status, 'matched');
    assert.equal(preview.rows[0].selectedPoolId, 'p1');
});

test('one pool SJ cannot be auto-assigned to two manual rows', () => {
    const preview = core.buildPreview(
        [manual('m1', 'AZKO Grand Cakung'), manual('m2', 'AZKO Grand Cakung')],
        [pool('p1', 'SJ-1', 'STORE AZKO GRAND CAKUNG')]
    );
    assert.equal(preview.rows[0].status, 'matched');
    assert.equal(preview.rows[1].status, 'unmatched');
});

test('manual rows without a store or address stay unmatched', () => {
    const preview = core.buildPreview(
        [manual('m1', '', {address: ''})],
        [pool('p1', 'SJ-1', 'STORE AZKO GRAND CAKUNG')]
    );
    assert.equal(preview.rows[0].status, 'unmatched');
    assert.equal(preview.rows[0].selectedPoolId, '');
});
