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
        allCurrentTrips: [],
        mockDatabase: { suratJalanList: [] },
        showToast: () => {},
        confirm: () => true,
        alert: () => {}
    };

    const fn = new Function('window', 'document', 'localStorage', spkSource);
    fn(mockWindow, mockDocument, mockWindow.localStorage);
    return { mockWindow, elements };
}

test('view-spk supports 4 branches filtering and renders proper branch stats', () => {
    const { mockWindow, elements } = setupEnvironment();
    const { filterSpkBranch, renderSPKView } = mockWindow.spkManager;

    const testOrders = [
        { spkId: '1', spkNumber: 'SPK-1', productionBranch: 'DM 1', qty: 10, productionStatus: 'received' },
        { spkId: '2', spkNumber: 'SPK-2', productionBranch: 'DM 2', qty: 20, productionStatus: 'received' },
        { spkId: '3', spkNumber: 'SPK-3', productionBranch: 'DM 3', qty: 30, productionStatus: 'received' },
        { spkId: '4', spkNumber: 'SPK-4', productionBranch: 'Cikokol', qty: 40, productionStatus: 'received' }
    ];

    mockWindow.localStorage.setItem('wtrack_spk_orders', JSON.stringify(testOrders));
    renderSPKView();

    assert.equal(elements['spk-stat-total'].innerText, 4);
    assert.equal(elements['spk-stat-dm1'].innerText, 1);
    assert.equal(elements['spk-stat-dm2'].innerText, 1);
    assert.equal(elements['spk-stat-dm3'].innerText, 1);
    assert.equal(elements['spk-stat-cikokol'].innerText, 1);

    // Filter to DM 3
    filterSpkBranch('DM 3');
    const tbody = elements['spk-table-body'];
    assert.ok(tbody.innerHTML.includes('SPK-3'), 'Must show SPK-3 for DM 3');
    assert.ok(!tbody.innerHTML.includes('SPK-1'), 'Must not show SPK-1 under DM 3 filter');
});

test('convertSPKToSuratJalan converts SPK to SJ pool entry and links ID', () => {
    const { mockWindow } = setupEnvironment();
    const { convertSPKToSuratJalan, renderSPKView } = mockWindow.spkManager;

    const testOrders = [
        {
            spkId: 'SPK_LINK_01',
            spkNumber: 'SPK-2026-999',
            clientName: 'PT Pelanggan Setia',
            namaProduk: 'Banner Promo 3x1',
            ukuran: '3x1m',
            finishing: 'Mata Ayam 4 Sudut',
            qty: 50,
            productionBranch: 'DM 2',
            productionStatus: 'completed'
        }
    ];

    mockWindow.localStorage.setItem('wtrack_spk_orders', JSON.stringify(testOrders));
    renderSPKView();

    const trip = convertSPKToSuratJalan('SPK_LINK_01');
    assert.ok(trip, 'Must create a trip object');
    assert.ok(trip.tripId.startsWith('TRIP_'), 'Must have TRIP_ prefix');
    assert.equal(trip.destinations[0].locationName, 'PT Pelanggan Setia');
    assert.equal(mockWindow.allCurrentTrips.length, 1);
    assert.equal(mockWindow.allCurrentTrips[0].tripId, trip.tripId);
});
