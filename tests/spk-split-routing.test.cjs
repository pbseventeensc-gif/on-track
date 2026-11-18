const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Setup Node mock environment
const root = path.resolve(__dirname, '..');
const spkSource = fs.readFileSync(path.join(root, 'js/spk_manager.js'), 'utf8');

function setupEnvironment() {
    const mockStorage = {};
    const mockDocument = {
        getElementById: () => null,
        querySelectorAll: () => [],
        querySelector: () => null,
        addEventListener: () => {}
    };
    const mockWindow = {
        localStorage: {
            getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
            setItem: (k, v) => { mockStorage[k] = String(v); },
            removeItem: (k) => { delete mockStorage[k]; },
            clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
        },
        document: mockDocument,
        showToast: () => {},
        confirm: () => true,
        alert: () => {}
    };

    const fn = new Function('window', 'document', 'localStorage', spkSource);
    fn(mockWindow, mockDocument, mockWindow.localStorage);
    return mockWindow;
}

test('splitSPKItem splits an SPK into multiple machine allocations and validates total qty', () => {
    const env = setupEnvironment();
    const { splitSPKItem } = env.spkManager;
    assert.equal(typeof splitSPKItem, 'function', 'splitSPKItem must be exported');

    const sampleList = [
        {
            spkId: 'SPK_TEST_001',
            spkNumber: 'SPK-2026-001',
            clientName: 'Wellen DM Client',
            namaBarang: 'Banner Outdoor Flexi',
            ukuran: '3x1m',
            qty: 1000,
            productionBranch: 'DM 2',
            machineName: 'Mesin 512i lebar 3.2',
            productionStatus: 'received'
        }
    ];

    // Invalid split: quantities do not match total
    assert.throws(() => {
        splitSPKItem(sampleList, 0, [
            { qty: 400, branch: 'DM 2', machineName: 'Mesin 512i lebar 3.2 - Unit 1' },
            { qty: 500, branch: 'DM 2', machineName: 'Mesin 512i lebar 3.2 - Unit 2' }
        ]);
    }, /kuantitas/i, 'Must throw error if sum of parts does not equal original qty');

    // Valid split: 600 + 400 = 1000
    const result = splitSPKItem(sampleList, 0, [
        { qty: 600, branch: 'DM 2', machineName: 'Mesin 512i lebar 3.2 - Unit 1', machineId: 'MSN-DM2-OUT-04' },
        { qty: 400, branch: 'DM 2', machineName: 'Mesin 1024 i lebar 3.2 - Unit 1', machineId: 'MSN-DM2-OUT-01' }
    ]);

    assert.equal(result.length, 2, 'Result should have 2 sub-items');
    assert.equal(result[0].spkNumber, 'SPK-2026-001/A');
    assert.equal(result[0].qty, 600);
    assert.equal(result[0].isSplit, true);
    assert.equal(result[0].splitPart, 'A');
    assert.equal(result[0].splitTotalParts, 2);
    assert.equal(result[0].parentSpkId, 'SPK_TEST_001');
    assert.equal(result[0].machineName, 'Mesin 512i lebar 3.2 - Unit 1');

    assert.equal(result[1].spkNumber, 'SPK-2026-001/B');
    assert.equal(result[1].qty, 400);
    assert.equal(result[1].splitPart, 'B');
    assert.equal(result[1].parentSpkId, 'SPK_TEST_001');
    assert.equal(result[1].machineName, 'Mesin 1024 i lebar 3.2 - Unit 1');
});

test('revertSplitSPKItem reunites split sub-items back into the original single SPK', () => {
    const env = setupEnvironment();
    const { splitSPKItem, revertSplitSPKItem } = env.spkManager;
    assert.equal(typeof revertSplitSPKItem, 'function', 'revertSplitSPKItem must be exported');

    let list = [
        {
            spkId: 'SPK_TEST_002',
            spkNumber: 'SPK-2026-002',
            clientName: 'PT Maju Bersama',
            namaBarang: 'Sticker Vinyl Ritrama',
            ukuran: '1x1m',
            qty: 500,
            productionBranch: 'DM 2',
            machineName: 'EPSON S80 - Unit 1',
            productionStatus: 'received'
        }
    ];

    list = splitSPKItem(list, 0, [
        { qty: 250, branch: 'DM 2', machineName: 'EPSON S80 - Unit 1' },
        { qty: 250, branch: 'DM 2', machineName: 'EPSON S80 - Unit 2' }
    ]);

    assert.equal(list.length, 2);

    const reverted = revertSplitSPKItem(list, 'SPK_TEST_002');
    assert.equal(reverted.length, 1, 'Reverted list should have 1 item');
    assert.equal(reverted[0].spkId, 'SPK_TEST_002');
    assert.equal(reverted[0].spkNumber, 'SPK-2026-002');
    assert.equal(reverted[0].qty, 500);
    assert.equal(reverted[0].isSplit, false);
});

test('getSPKAggregateStatus and generateSPKQRCodePayload evaluate correctly', () => {
    const env = setupEnvironment();
    const { getSPKAggregateStatus, generateSPKQRCodePayload } = env.spkManager;
    assert.equal(typeof getSPKAggregateStatus, 'function', 'getSPKAggregateStatus must be exported');
    assert.equal(typeof generateSPKQRCodePayload, 'function', 'generateSPKQRCodePayload must be exported');

    const splitOrders = [
        {
            spkId: 'SPK_003_A',
            parentSpkId: 'SPK_003',
            spkNumber: 'SPK-2026-003/A',
            splitPart: 'A',
            machineId: 'MSN-DM2-IN-01',
            productionStatus: 'completed'
        },
        {
            spkId: 'SPK_003_B',
            parentSpkId: 'SPK_003',
            spkNumber: 'SPK-2026-003/B',
            splitPart: 'B',
            machineId: 'MSN-DM2-IN-02',
            productionStatus: 'printing'
        }
    ];

    // Status is partial because part B is still printing
    const status1 = getSPKAggregateStatus('SPK_003', splitOrders);
    assert.equal(status1.status, 'partial');
    assert.equal(status1.completedParts, 1);
    assert.equal(status1.totalParts, 2);

    // Update part B to completed
    splitOrders[1].productionStatus = 'completed';
    const status2 = getSPKAggregateStatus('SPK_003', splitOrders);
    assert.equal(status2.status, 'completed');
    assert.equal(status2.completedParts, 2);

    // QR Code payload test
    const qrPayload = generateSPKQRCodePayload(splitOrders[0]);
    assert.equal(qrPayload, 'WTRACK:SPK:SPK-2026-003/A:A:MSN-DM2-IN-01');
});
