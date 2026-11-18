const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(initial = null) {
    const data = new Map();
    if (initial !== null) {
        data.set('wtrack_machines_v1', JSON.stringify(initial));
    }
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
        crypto: { randomUUID: () => 'MSN_TEST_' + Date.now() }
    };
    const c = vm.createContext({
        window,
        document,
        Date,
        Intl,
        console
    });
    vm.runInContext(fs.readFileSync(require.resolve('../js/machine_master.js'), 'utf8'), c);
    return { api: window.MachineMaster, window, data, elements };
}

test('machine master seeds default Wellen machines across 4 branches when empty', () => {
    const { api } = setup();
    const machines = api.read();

    assert.ok(machines.length >= 20, `Expected at least 20 seeded machines, got ${machines.length}`);

    // Check DM 1
    const dm1 = machines.filter(m => m.branch === 'DM 1');
    assert.ok(dm1.some(m => m.name.includes('SQ IMPALA 5')));
    assert.ok(dm1.some(m => m.name.includes('SUMMA')));
    assert.ok(dm1.some(m => m.name.includes('LASER')));

    // Check DM 2
    const dm2 = machines.filter(m => m.branch === 'DM 2');
    assert.ok(dm2.some(m => m.name.includes('EPSON S80')));
    assert.ok(dm2.some(m => m.name.includes('LATEX')));
    assert.ok(dm2.some(m => m.name.includes('1024 i')));
    assert.ok(dm2.some(m => m.name.includes('512i')));

    // Check DM 3
    const dm3 = machines.filter(m => m.branch === 'DM 3');
    assert.ok(dm3.some(m => m.name.includes('EFI MATAN 5M')));
    assert.ok(dm3.some(m => m.name.includes('Roland ECO')));

    // Check Cikokol
    const ckk = machines.filter(m => m.branch.toLowerCase().includes('cikokol'));
    assert.ok(ckk.some(m => m.name.includes('Indigo A3')));
});

test('machine master supports Add, Edit, and Status Toggle', async () => {
    const viewContainer = { innerHTML: '' };
    const { api, elements, data } = setup([]);
    elements.set('view-machine-master', viewContainer);

    // Form element mocks
    const inputId = { value: '' };
    const inputCode = { value: 'MSN-TEST-01' };
    const inputName = { value: 'Epson SureColor S80670' };
    const inputBranch = { value: 'DM 2' };
    const inputCategory = { value: 'Indoor' };
    const inputWidth = { value: '1.6 Meter' };
    const inputStatus = { value: 'active' };
    const inputNotes = { value: 'High resolution' };

    elements.set('machine-editor', { showModal: () => {}, close: () => {} });
    elements.set('machine-edit-id', inputId);
    elements.set('machine-code', inputCode);
    elements.set('machine-name', inputName);
    elements.set('machine-branch', inputBranch);
    elements.set('machine-category', inputCategory);
    elements.set('machine-width', inputWidth);
    elements.set('machine-status', inputStatus);
    elements.set('machine-notes', inputNotes);

    // 1. Add new machine
    await api.save();
    let stored = JSON.parse(data.get('wtrack_machines_v1'));
    assert.equal(stored.length, 1);
    assert.equal(stored[0].name, 'Epson SureColor S80670');
    assert.equal(stored[0].branch, 'DM 2');
    assert.equal(stored[0].status, 'active');

    // 2. Edit machine
    inputId.value = stored[0].id;
    inputName.value = 'Epson SureColor S80670 - Unit A';
    inputStatus.value = 'maintenance';
    await api.save();

    stored = JSON.parse(data.get('wtrack_machines_v1'));
    assert.equal(stored.length, 1);
    assert.equal(stored[0].name, 'Epson SureColor S80670 - Unit A');
    assert.equal(stored[0].status, 'maintenance');

    // 3. Toggle Status back to active
    await api.toggleStatus(stored[0].id);
    stored = JSON.parse(data.get('wtrack_machines_v1'));
    assert.equal(stored[0].status, 'active');
});

test('machine master renders clean table with branch filtering and badge status', () => {
    const viewContainer = { innerHTML: '' };
    const { api, elements } = setup([
        { id: 'm1', code: 'MSN-DM1-01', name: 'SQ IMPALA 5', branch: 'DM 1', category: 'Flatbed', width: '2.5m', status: 'active' },
        { id: 'm2', code: 'MSN-DM2-01', name: 'EPSON S80', branch: 'DM 2', category: 'Indoor', width: '1.6m', status: 'maintenance' }
    ]);
    elements.set('view-machine-master', viewContainer);

    api.render();

    assert.match(viewContainer.innerHTML, /SQ IMPALA 5/);
    assert.match(viewContainer.innerHTML, /EPSON S80/);
    assert.match(viewContainer.innerHTML, /Aktif/);
    assert.match(viewContainer.innerHTML, /Maintenance/);

    // Filter DM 1 only
    api.filterBranch('DM 1');
    const tbodyHtml = viewContainer.innerHTML.split('<tbody>')[1].split('</tbody>')[0];
    assert.match(tbodyHtml, /SQ IMPALA 5/);
    assert.doesNotMatch(tbodyHtml, /EPSON S80/);
});
