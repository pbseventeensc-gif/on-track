const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const spkSource = fs.readFileSync(path.join(root, 'js/spk_manager.js'), 'utf8');

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
                checked: false,
                children: [],
                classList: {
                    add: () => {},
                    remove: () => {},
                    contains: () => false
                },
                setAttribute: () => {},
                getAttribute: () => null
            };
        }
        return elements[id];
    }

    const mockDocument = {
        getElementById: (id) => getOrCreateElement(id),
        querySelectorAll: (selector) => {
            if (selector.includes('spk-preview-row-checkbox:checked')) {
                return [
                    { getAttribute: () => '0', checked: true }
                ];
            }
            if (selector.includes('spk-preview-branch-select')) {
                return [];
            }
            return [];
        },
        querySelector: (sel) => null,
        addEventListener: () => {}
    };

    const mockMachines = [
        { id: 'MSN-DM1-01', name: 'SQ IMPALA 5', branch: 'DM 1', status: 'active' },
        { id: 'MSN-DM2-01', name: 'EPSON S80 - Unit 1', branch: 'DM 2', status: 'active' },
        { id: 'MSN-DM2-02', name: 'Mesin 512i lebar 3.2 - Unit 1', branch: 'DM 2', status: 'active' },
        { id: 'MSN-DM3-01', name: 'EFI MATAN 5M - Unit 1', branch: 'DM 3', status: 'active' },
        { id: 'MSN-CIK-01', name: 'HP Indigo A3', branch: 'Cikokol', status: 'active' }
    ];

    const mockWindow = {
        localStorage: {
            getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
            setItem: (k, v) => { mockStorage[k] = String(v); },
            removeItem: (k) => { delete mockStorage[k]; },
            clear: () => {}
        },
        document: mockDocument,
        MachineMaster: {
            read: () => mockMachines
        },
        showToast: () => {},
        confirm: () => true,
        alert: () => {}
    };

    const fn = new Function('window', 'document', 'localStorage', spkSource);
    fn(mockWindow, mockDocument, mockWindow.localStorage);
    return { mockWindow, elements };
}

test('SPK preview table renders 4 branches and machine options from MachineMaster', () => {
    const { mockWindow, elements } = setupEnvironment();
    const { setSPKPreviewData, renderSPKPreviewTable } = mockWindow.spkManager;

    setSPKPreviewData([
        {
            spkId: 'PREVIEW_1',
            spkNumber: 'SPK-PREV-01',
            namaBarang: 'Banner Outdoor 3.2m',
            ukuran: '3x1m',
            qty: 100,
            productionBranch: 'DM 2',
            machineName: 'Mesin 512i lebar 3.2 - Unit 1',
            finishing: 'Mata ayam'
        }
    ]);

    renderSPKPreviewTable();

    const tbody = elements['spk-import-preview-tbody'];
    assert.ok(tbody.innerHTML.includes('DM 1'), 'Must include DM 1 in branch options');
    assert.ok(tbody.innerHTML.includes('DM 2'), 'Must include DM 2 in branch options');
    assert.ok(tbody.innerHTML.includes('DM 3'), 'Must include DM 3 in branch options');
    assert.ok(tbody.innerHTML.includes('Cikokol'), 'Must include Cikokol in branch options');
    assert.ok(tbody.innerHTML.includes('Mesin 512i'), 'Must include machine dropdown option');
    assert.ok(tbody.innerHTML.includes('Split'), 'Must include Split button');
});

test('SPK preview table displays split part badges and revert buttons for split items', () => {
    const { mockWindow, elements } = setupEnvironment();
    const { setSPKPreviewData, renderSPKPreviewTable, splitSPKItem } = mockWindow.spkManager;

    const list = [
        {
            spkId: 'PREVIEW_SPLIT_1',
            spkNumber: 'SPK-SPLIT-01',
            namaBarang: 'Sticker Vinyl Ritrama',
            ukuran: '1x1m',
            qty: 1000,
            productionBranch: 'DM 2',
            machineName: 'EPSON S80 - Unit 1'
        }
    ];

    splitSPKItem(list, 0, [
        { qty: 600, branch: 'DM 2', machineName: 'EPSON S80 - Unit 1' },
        { qty: 400, branch: 'DM 2', machineName: 'EPSON S80 - Unit 2' }
    ]);

    setSPKPreviewData(list);
    renderSPKPreviewTable();

    const tbody = elements['spk-import-preview-tbody'];
    assert.ok(tbody.innerHTML.includes('Part A/2'), 'Must show Part A/2 badge');
    assert.ok(tbody.innerHTML.includes('Part B/2'), 'Must show Part B/2 badge');
    assert.ok(tbody.innerHTML.includes('revertSplit'), 'Must show revert button');
});
