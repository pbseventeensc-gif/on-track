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
                classList: {
                    add: () => {},
                    remove: () => {},
                    contains: () => false
                }
            };
        }
        return elements[id];
    }

    const mockDocument = {
        getElementById: (id) => getOrCreateElement(id),
        querySelectorAll: () => [],
        querySelector: () => null,
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
        MachineMaster: {
            read: () => [
                { id: 'MSN-DM2-01', name: 'EPSON S80 - Unit 1', branch: 'DM 2' },
                { id: 'MSN-DM2-02', name: 'Mesin 512i lebar 3.2 - Unit 1', branch: 'DM 2' }
            ]
        },
        OperatorMaster: {
            getOperatorsForMachine: () => [
                { id: 'OPR-DM2-01', name: 'Rian Hidayat', branch: 'DM 2' }
            ]
        },
        showToast: () => {},
        confirm: () => true,
        alert: () => {}
    };

    const scriptPath = path.join(root, 'js/production/spk_scheduler.js');
    if (fs.existsSync(scriptPath)) {
        const source = fs.readFileSync(scriptPath, 'utf8');
        const fn = new Function('window', 'document', 'localStorage', source);
        fn(mockWindow, mockDocument, mockWindow.localStorage);
    }

    return { mockWindow, elements };
}

test('scheduleBatchSPK schedules multiple SPK at once to machine, operator, and shift', () => {
    const { mockWindow } = setupEnvironment();
    assert.ok(mockWindow.SPKScheduler, 'SPKScheduler must be defined');
    const { scheduleBatchSPK } = mockWindow.SPKScheduler;

    // Simulate 100 incoming SPK rows
    const spkList = [];
    for (let i = 1; i <= 100; i++) {
        spkList.push({
            spkId: `SPK_BATCH_${i}`,
            spkNumber: `SPK-2026-${i}`,
            qty: 10,
            productionStatus: 'received'
        });
    }

    const selectedIds = ['SPK_BATCH_1', 'SPK_BATCH_2', 'SPK_BATCH_50', 'SPK_BATCH_99'];
    const options = {
        branch: 'DM 2',
        machineName: 'EPSON S80 - Unit 1',
        machineId: 'MSN-DM2-01',
        operatorId: 'OPR-DM2-01',
        operatorName: 'Rian Hidayat',
        shift: 'Shift 1 (Pagi)',
        priority: 'urgent',
        scheduledDate: '2026-11-18',
        notes: 'Kejar deadline toko jam 12'
    };

    const updated = scheduleBatchSPK(spkList, selectedIds, options);

    // Verify selected items were updated
    const item1 = updated.find(s => s.spkId === 'SPK_BATCH_1');
    const item50 = updated.find(s => s.spkId === 'SPK_BATCH_50');
    const item3 = updated.find(s => s.spkId === 'SPK_BATCH_3'); // unselected

    assert.equal(item1.productionBranch, 'DM 2');
    assert.equal(item1.machineName, 'EPSON S80 - Unit 1');
    assert.equal(item1.assignedOperator, 'Rian Hidayat');
    assert.equal(item1.productionShift, 'Shift 1 (Pagi)');
    assert.equal(item1.priority, 'urgent');
    assert.equal(item1.scheduledDate, '2026-11-18');
    assert.equal(item1.productionStatus, 'scheduled');

    assert.equal(item50.assignedOperator, 'Rian Hidayat');
    assert.equal(item50.productionStatus, 'scheduled');

    // Item 3 remains untouched
    assert.equal(item3.productionStatus, 'received');
    assert.equal(item3.assignedOperator, undefined);
});

test('calculateMachineWorkload computes total pieces and orders per machine', () => {
    const { mockWindow } = setupEnvironment();
    const { calculateMachineWorkload } = mockWindow.SPKScheduler;

    const list = [
        { machineName: 'EPSON S80 - Unit 1', qty: 100, productionStatus: 'scheduled' },
        { machineName: 'EPSON S80 - Unit 1', qty: 150, productionStatus: 'printing' },
        { machineName: 'Mesin 512i lebar 3.2 - Unit 1', qty: 50, productionStatus: 'scheduled' }
    ];

    const workloadEpson = calculateMachineWorkload(list, 'EPSON S80 - Unit 1');
    assert.equal(workloadEpson.totalJobs, 2);
    assert.equal(workloadEpson.totalQty, 250);

    const workload512 = calculateMachineWorkload(list, 'Mesin 512i lebar 3.2 - Unit 1');
    assert.equal(workload512.totalJobs, 1);
    assert.equal(workload512.totalQty, 50);
});
