const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(initial = []) {
    const data = new Map([['wtrack_pool_materials_v1', JSON.stringify(initial)]]);
    const elements = new Map();
    const document = {
        getElementById: id => elements.get(id) || null,
        querySelector: sel => elements.get(sel) || null,
        querySelectorAll: () => [],
        addEventListener: () => {}
    };
    const window = {
        WTRACK_LOCAL_SANDBOX: true,
        localStorage: {
            getItem: k => data.get(k) || null,
            setItem: (k, v) => data.set(k, v)
        },
        document,
        crypto: { randomUUID: () => 'MAT_TEST_' + Date.now() }
    };
    const c = vm.createContext({
        window,
        document,
        Date,
        Intl,
        console
    });
    vm.runInContext(fs.readFileSync(require.resolve('../js/material_seed.js'), 'utf8'), c);
    vm.runInContext(fs.readFileSync(require.resolve('../js/material_master.js'), 'utf8'), c);
    return { api: window.MaterialMaster, window, data, elements };
}

test('material table renders No. SKU column header and shows SKU or dash', () => {
    const viewContainer = { innerHTML: '' };
    const { api, elements } = setup([
        { id: 'mat-1', name: 'Flexi China 280', kgPerM2: 0.28, sku: 'SKU-FFC-280', active: true },
        { id: 'mat-2', name: 'Art Carton 310', kgPerM2: 0.31, sku: '', active: true }
    ]);
    elements.set('view-material-master', viewContainer);

    api.render();

    assert.match(viewContainer.innerHTML, /<th>No\.\s*SKU<\/th>/i);
    assert.match(viewContainer.innerHTML, /SKU-FFC-280/);
    assert.match(viewContainer.innerHTML, /—/);
});

test('material editor dialog includes No. SKU input and persists sku on save', async () => {
    const viewContainer = { innerHTML: '' };
    const inputName = { value: 'Sticker Vinyl Ritrama' };
    const inputRate = { value: '0.18' };
    const inputType = { value: 'material' };
    const inputAliases = { value: '' };
    const inputSku = { value: 'SKU-RITRAMA-01' };
    const inputId = { value: '' };
    const editorDialog = {
        showModal: () => {},
        close: () => {}
    };

    const { api, elements, data } = setup([]);
    elements.set('view-material-master', viewContainer);
    elements.set('material-editor', editorDialog);
    elements.set('material-edit-id', inputId);
    elements.set('material-name', inputName);
    elements.set('material-rate', inputRate);
    elements.set('material-type', inputType);
    elements.set('material-aliases', inputAliases);
    elements.set('material-sku', inputSku);

    // Save new material with SKU
    await api.save();

    const stored = JSON.parse(data.get('wtrack_pool_materials_v1'));
    assert.equal(stored.length, 1);
    assert.equal(stored[0].name, 'Sticker Vinyl Ritrama');
    assert.equal(stored[0].sku, 'SKU-RITRAMA-01');

    // Save with empty SKU is also allowed
    inputName.value = 'Backlite Korea 510';
    inputRate.value = '0.51';
    inputSku.value = '   ';
    inputId.value = '';
    await api.save();

    const stored2 = JSON.parse(data.get('wtrack_pool_materials_v1'));
    assert.equal(stored2.length, 2);
    const backlite = stored2.find(m => m.name.toLowerCase().includes('backlite'));
    assert.equal(backlite.sku, '');
});
