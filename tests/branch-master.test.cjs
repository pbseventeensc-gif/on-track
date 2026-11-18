const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function setupEnvironment() {
    const mockStorage = {};
    const elements = {};

    function getOrCreateElement(id) {
        if (!elements[id]) {
            elements[id] = {
                id,
                innerHTML: '',
                innerText: '',
                value: '',
                style: {},
                children: [],
                classList: {
                    add: () => {},
                    remove: () => {},
                    contains: () => false
                },
                focus: () => {},
                setSelectionRange: () => {},
                close: () => {},
                showModal: () => {}
            };
        }
        return elements[id];
    }

    const mockDocument = {
        getElementById: (id) => getOrCreateElement(id),
        querySelectorAll: () => [],
        querySelector: () => null,
        createElement: (tag) => getOrCreateElement(`created-${tag}-${Math.random()}`),
        addEventListener: () => {}
    };

    const mockWindow = {
        localStorage: {
            getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
            setItem: (k, v) => { mockStorage[k] = String(v); },
            removeItem: (k) => { delete mockStorage[k]; },
            clear: () => {}
        },
        document: mockDocument,
        showToast: () => {},
        confirm: () => true,
        alert: () => {}
    };

    // Load branch_master.js
    const scriptPath = path.join(root, 'js/production/branch_master.js');
    if (fs.existsSync(scriptPath)) {
        const source = fs.readFileSync(scriptPath, 'utf8');
        const fn = new Function('window', 'document', 'localStorage', source);
        fn(mockWindow, mockDocument, mockWindow.localStorage);
    }

    return { mockWindow, elements };
}

test('branch master seeds default Wellen branches when empty', () => {
    const { mockWindow } = setupEnvironment();
    assert.ok(mockWindow.BranchMaster, 'BranchMaster must be defined');

    const list = mockWindow.BranchMaster.read();
    assert.ok(Array.isArray(list), 'List must be an array');
    assert.equal(list.length, 4, 'Must seed exactly 4 default branches');

    const codes = mockWindow.BranchMaster.getAllCodes();
    assert.deepEqual(codes, ['DM 1', 'DM 2', 'DM 3', 'Cikokol']);

    const dm1 = mockWindow.BranchMaster.getBranch('DM 1');
    assert.ok(dm1, 'Must find DM 1');
    assert.equal(dm1.name, 'Daan Mogot 1');
    assert.equal(dm1.status, 'active');

    const dm2 = mockWindow.BranchMaster.getBranch('DM 2');
    assert.ok(dm2, 'Must find DM 2');
    assert.ok(dm2.name.includes('Pusat'));
});

test('branch master supports Add, Edit, and Status Toggle', () => {
    const { mockWindow } = setupEnvironment();
    const { add, edit, save, toggleStatus, read, write, getAllCodes } = mockWindow.BranchMaster;

    // Start with 4 default branches
    let list = read();
    assert.equal(list.length, 4);

    // Add a new branch: Serpong
    mockWindow.document.getElementById('br-edit-id').value = '';
    mockWindow.document.getElementById('br-code').value = 'Serpong';
    mockWindow.document.getElementById('br-name').value = 'Cabang BSD Serpong';
    mockWindow.document.getElementById('br-address').value = 'Ruko BSD Sektor 7';
    mockWindow.document.getElementById('br-phone').value = '021-7788-999';
    mockWindow.document.getElementById('br-focus').value = 'Digital Offset';
    mockWindow.document.getElementById('br-manager').value = 'Andi';
    mockWindow.document.getElementById('br-status').value = 'active';

    save({ preventDefault: () => {} });

    list = read();
    assert.equal(list.length, 5);
    const serpong = list.find(b => b.code === 'Serpong');
    assert.ok(serpong);
    assert.equal(serpong.name, 'Cabang BSD Serpong');

    const activeCodes = getAllCodes();
    assert.ok(activeCodes.includes('Serpong'));

    // Toggle Status
    toggleStatus(serpong.id);
    list = read();
    const serpongAfter = list.find(b => b.code === 'Serpong');
    assert.equal(serpongAfter.status, 'inactive');

    // getAllCodes only returns active by default
    const codesAfterToggle = getAllCodes();
    assert.ok(!codesAfterToggle.includes('Serpong'));

    // Edit branch
    mockWindow.document.getElementById('br-edit-id').value = serpong.id;
    mockWindow.document.getElementById('br-code').value = 'Serpong';
    mockWindow.document.getElementById('br-name').value = 'Cabang BSD Serpong Updated';
    mockWindow.document.getElementById('br-address').value = 'Ruko BSD Sektor 7 Baru';
    mockWindow.document.getElementById('br-status').value = 'active';

    save({ preventDefault: () => {} });

    list = read();
    const serpongUpdated = list.find(b => b.code === 'Serpong');
    assert.equal(serpongUpdated.name, 'Cabang BSD Serpong Updated');
    assert.equal(serpongUpdated.status, 'active');
});
