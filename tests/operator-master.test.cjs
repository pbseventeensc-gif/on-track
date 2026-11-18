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
        querySelectorAll: (sel) => {
            if (sel.includes('.operator-machine-check:checked')) {
                return [
                    { value: 'EPSON S80 - Unit 1' },
                    { value: 'EPSON S60X2 - Unit 1' }
                ];
            }
            return [];
        },
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
                { id: 'MSN-DM1-01', name: 'SQ IMPALA 5', branch: 'DM 1', category: 'Flatbed UV' },
                { id: 'MSN-DM2-01', name: 'EPSON S80 - Unit 1', branch: 'DM 2', category: 'Indoor' },
                { id: 'MSN-DM2-02', name: 'EPSON S60X2 - Unit 1', branch: 'DM 2', category: 'Indoor' },
                { id: 'MSN-DM2-03', name: 'Mesin 512i lebar 3.2 - Unit 1', branch: 'DM 2', category: 'Outdoor' },
                { id: 'MSN-DM3-01', name: 'EFI MATAN 5M - Unit 1', branch: 'DM 3', category: 'Outdoor' },
                { id: 'MSN-CIK-01', name: 'HP Indigo A3', branch: 'Cikokol', category: 'Digital Offset A3' }
            ]
        },
        showToast: () => {},
        confirm: () => true,
        alert: () => {}
    };

    // Load operator_master.js if exists
    const scriptPath = path.join(root, 'js/production/operator_master.js');
    if (fs.existsSync(scriptPath)) {
        const source = fs.readFileSync(scriptPath, 'utf8');
        const fn = new Function('window', 'document', 'localStorage', source);
        fn(mockWindow, mockDocument, mockWindow.localStorage);
    }

    return { mockWindow, elements };
}

test('operator master seeds default Wellen operators across 4 branches when empty', () => {
    const { mockWindow } = setupEnvironment();
    assert.ok(mockWindow.OperatorMaster, 'OperatorMaster must be defined');

    const list = mockWindow.OperatorMaster.read();
    assert.ok(Array.isArray(list), 'List must be an array');
    assert.ok(list.length >= 8, 'Must seed at least 8 default operators');

    const dm1 = list.filter(o => o.branch === 'DM 1');
    const dm2 = list.filter(o => o.branch === 'DM 2');
    const dm3 = list.filter(o => o.branch === 'DM 3');
    const cikokol = list.filter(o => o.branch === 'Cikokol');

    assert.ok(dm1.length > 0, 'Must have DM 1 operators');
    assert.ok(dm2.length > 0, 'Must have DM 2 operators');
    assert.ok(dm3.length > 0, 'Must have DM 3 operators');
    assert.ok(cikokol.length > 0, 'Must have Cikokol operators');

    // Check operator has machines assigned
    const rian = list.find(o => o.name.includes('Rian'));
    assert.ok(rian, 'Must have operator Rian');
    assert.ok(Array.isArray(rian.machines), 'Operator machines must be an array');
    assert.ok(rian.machines.some(m => m.includes('EPSON')), 'Rian must operate EPSON');
});

test('operator master supports Add, Edit, and Status Toggle', () => {
    const { mockWindow } = setupEnvironment();
    const { add, edit, save, toggleStatus, read, write } = mockWindow.OperatorMaster;

    write([]); // Start fresh

    // Add operator
    mockWindow.document.getElementById('opr-edit-id').value = '';
    mockWindow.document.getElementById('opr-name').value = 'Bambang Wijaya';
    mockWindow.document.getElementById('opr-branch').value = 'DM 2';
    mockWindow.document.getElementById('opr-role').value = 'Operator Cetak';
    mockWindow.document.getElementById('opr-shift').value = 'Shift 1 (Pagi)';
    mockWindow.document.getElementById('opr-status').value = 'active';

    save({ preventDefault: () => {} });

    let list = read();
    assert.equal(list.length, 1);
    assert.equal(list[0].name, 'Bambang Wijaya');
    assert.equal(list[0].branch, 'DM 2');
    assert.equal(list[0].status, 'active');

    // Toggle Status
    toggleStatus(list[0].id);
    list = read();
    assert.equal(list[0].status, 'off');

    toggleStatus(list[0].id);
    list = read();
    assert.equal(list[0].status, 'active');
});

test('getOperatorsForMachine filters active operators by machine and branch', () => {
    const { mockWindow } = setupEnvironment();
    const { getOperatorsForMachine } = mockWindow.OperatorMaster;
    assert.equal(typeof getOperatorsForMachine, 'function');

    const epsonOps = getOperatorsForMachine('EPSON S80', 'DM 2');
    assert.ok(Array.isArray(epsonOps));
    assert.ok(epsonOps.length > 0, 'Must find at least 1 operator for EPSON S80 in DM 2');
    assert.ok(epsonOps.some(o => o.name.includes('Rian')));
});

test('matchMachineToRole filters indoor machines for indoor operator and hides outdoor machines', () => {
    const { mockWindow } = setupEnvironment();
    const { matchMachineToRole, renderMachineCheckboxes } = mockWindow.OperatorMaster;
    assert.equal(typeof matchMachineToRole, 'function');

    const epsonMachine = { name: 'EPSON S80 - Unit 1', category: 'Indoor' };
    const outdoorMachine = { name: 'Mesin 512i lebar 3.2 - Unit 1', category: 'Outdoor' };

    // Indoor role: indoor machine matches, outdoor machine MUST NOT match
    assert.equal(matchMachineToRole(epsonMachine, 'Operator Indoor Printing'), true);
    assert.equal(matchMachineToRole(outdoorMachine, 'Operator Indoor Printing'), false);

    // Outdoor role: outdoor machine matches, indoor machine MUST NOT match
    assert.equal(matchMachineToRole(outdoorMachine, 'Operator Outdoor Solvent'), true);
    assert.equal(matchMachineToRole(epsonMachine, 'Operator Outdoor Solvent'), false);

    // Test renderMachineCheckboxes produces only indoor machines for indoor operator
    renderMachineCheckboxes([], 'DM 2', 'Operator Indoor Printing');
    const container = mockWindow.document.getElementById('opr-machines-container');
    assert.ok(container.innerHTML.includes('EPSON S80'), 'Must include EPSON S80');
    assert.ok(container.innerHTML.includes('EPSON S60X2'), 'Must include EPSON S60X2');
    assert.ok(!container.innerHTML.includes('512i'), 'Must NOT include outdoor 512i');

    // When role is changed to Outdoor Solvent, only outdoor machines should appear
    renderMachineCheckboxes([], 'DM 2', 'Operator Outdoor Solvent');
    assert.ok(container.innerHTML.includes('512i'), 'Must include 512i');
    assert.ok(!container.innerHTML.includes('EPSON S80'), 'Must NOT include EPSON S80');
});
