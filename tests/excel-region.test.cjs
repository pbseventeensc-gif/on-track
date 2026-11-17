const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');

test('full Excel report aligns Region with each destination and preserves status and photo columns', async () => {
    const cells = new Map();
    const cell = key => {if (!cells.has(key)) cells.set(key,{}); return cells.get(key);};
    const sheet = {mergeCells() {}, getCell: cell, getRow: row => ({getCell: column => cell(`${row}:${column}`)})};
    const trips = [
        {id:'trip-1', region:'Bogor', destinations:[
            {locationName:'A', region:' Bekasi ', status:'done',proofPhotoUrl:'https://example.com/proof.jpg'},
            {locationName:'B', address:'Jl. Industri, Kabupaten Karawang, Jawa Barat', region:'Jakarta Utara', status:'pending'}
        ]},
        {id:'trip-2', destinations:[{locationName:'C'}]}
    ];
    const context = vm.createContext({
        lastLoadedHistory: trips, registeredUsers: {}, getCourierVehicleType: () => 'motor',
        safeSplitPhotoUrls: value => value === '-' ? [] : [value], Blob,
        ExcelJS: {Workbook: class {addWorksheet() {return sheet;} xlsx={async writeBuffer(){return Buffer.from('test');}};}},
        window:{URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}}},
        document:{createElement(){return {click(){}};},body:{appendChild(){},removeChild(){}}}
    });
    const start = source.indexOf('async function exportFullReportsToExcel(');
    const end = source.indexOf('\nwindow.exportFullReportsToExcel =',start);
    const resolverStart = source.indexOf('function resolveDestinationRegion(');
    const resolverEnd = source.indexOf('\nwindow.resolveDestinationRegion =', resolverStart);
    vm.runInContext(source.slice(resolverStart,resolverEnd),context);
    vm.runInContext(source.slice(start,end),context);
    await context.exportFullReportsToExcel();
    assert.equal(cell('4:13').value,'Region');
    assert.equal(cell('4:3').value,'No. SJ');
    assert.equal(cell('5:13').value,'Bekasi');
    assert.equal(cell('6:13').value,'Karawang');
    assert.equal(cell('7:13').value,'Belum teridentifikasi');
    assert.equal(cell('5:11').value,'done');
    assert.equal(cell('5:12').value.hyperlink,'https://example.com/proof.jpg');
    assert.equal(sheet.columns.length,13);
    assert.equal(sheet.autoFilter.to.column,13);
});

test('Region follows each full destination address instead of stale destination/trip regions', () => {
    const context = vm.createContext({});
    const start = source.indexOf('function resolveDestinationRegion(');
    const end = source.indexOf('\nwindow.resolveDestinationRegion =',start);
    vm.runInContext(source.slice(start,end),context);
    const examples = [
        ['GAVE Ground Floor, QX2M+F5M, Pekayon Jaya, Kec. Bekasi Sel., Kota Bks, Jawa Barat 17148, Indonesia','Bekasi'],
        ['Jl. Pemuda Siliwangi. 126 Kemang Pratama. Kel. Bojong, Kec. Rawa Lumbu, Bekasi, West Java 17116, Indonesia','Bekasi'],
        ['Mall Cipinang Indah, Lt.1, Pd. Bambu, Kec. Duren Sawit, Kota Jakarta Timur, Daerah Khusus Ibukota Jakarta 13420, Indonesia','Jakarta Timur'],
        ['Jl. Raya Hankam No.288, Jatiwarna, Kec. Pd. Melati, Kota Bks, Jawa Barat 17415, Indonesia','Bekasi'],
        ['Mal Grand Metropolitan, Jl. KH. Noer Ali No.13, Pekayon Jaya, Kec. Bekasi Sel., Kota Bks, Jawa Barat 17148, Indonesia','Bekasi'],
        ['Jl. Caman Raya No.21, Jatibening, Kec. Pd. Gede, Kota Bks, Jawa Barat 17412, Indonesia','Bekasi'],
        ['Living Plaza Jababeka, Jl. Industri Utara 1, Mekarmukti, Kec. Cikarang Utara, Kabupaten Bekasi, Jawa Barat 17530, Indonesia','Cikarang'],
        ['Jl. Esplanade Avenue No.150, Lambangjaya, Kec. Tambun Sel., Kabupaten Bekasi, Jawa Barat 17510, Indonesia','Bekasi'],
        ['Jl. Bekasi Raya, Kota Jakarta Utara','Jakarta Utara'],
        ['Jl. Bogor, Kota Jakarta Timur','Jakarta Timur'],
        ['Kec. Menteng, Kota Jakarta Pusat','Jakarta Pusat'],
        ['Kota Jakarta Selatan','Jakarta Selatan'],
        ['Kota Jakarta Barat','Jakarta Barat'],
        ['Jl. Raya, Kec. Duren Sawit, DKI Jakarta','Jakarta Timur'],
        ['South Jakarta, Indonesia','Jakarta Selatan'],
        ['Kota Tangerang Selatan, Banten','Tangerang'],
        ['Kabupaten Bogor, Jawa Barat','Bogor'],
        ['Kota Depok, Jawa Barat','Depok'],
        ['Kabupaten Karawang, Jawa Barat','Karawang'],
        ['Kota Serang, Banten','Serang'],
        ['Kota Cilegon, Banten','Cilegon'],
        ['Kota Surabaya, Jawa Timur','Surabaya'],
        ['Kabupaten Sleman, Daerah Istimewa Yogyakarta','Sleman'],
        ['Jl. Industri Utara, Jawa Barat','Belum teridentifikasi'],
        ['Jl. Mawar, Indonesia','Belum teridentifikasi']
    ];
    for (const [address, expected] of examples) {
        assert.equal(context.resolveDestinationRegion({address,region:'Jakarta Utara'}, {region:'Jakarta Utara'}),expected,address);
    }
    assert.equal(context.resolveDestinationRegion({region:' Bekasi '}),'Bekasi');
    assert.equal(context.resolveDestinationRegion({}, {region:'Jakarta Utara'}),'Belum teridentifikasi');
});

test('exportRecentShipmentsToExcel removes unneeded columns (12 cols) and creates Pivot sheet', async () => {
    const sheets = new Map();
    function createMockSheet(name) {
        const cells = new Map();
        const cell = key => {
            const normalized = key === 'A1' ? '1:1' : (key === 'A2' ? '2:1' : key);
            if (!cells.has(normalized)) cells.set(normalized, {});
            return cells.get(normalized);
        };
        const merged = [];
        return {
            name,
            merged,
            cell,
            mergeCells(range) { merged.push(range); },
            getCell: cell,
            getRow: row => ({
                getCell: column => cell(`${row}:${column}`)
            })
        };
    }
    const trips = [
        {
            id: 'TRIP_1001_A',
            courierId: 'kurir-1',
            date: { seconds: 1700000000 },
            destinations: [
                {
                    locationName: 'Toko Bintang',
                    address: 'Jl. Ahmad Yani No. 10, Bekasi',
                    status: 'completed',
                    sjNumber: 'SJ-1126-00248',
                    proofPhotoUrl: 'https://example.com/pod.jpg'
                },
                {
                    locationName: 'Toko Cahaya',
                    address: 'Jl. Sudirman, Bekasi',
                    status: 'completed',
                    sjLinks: [{ noSJ: 'SJ-1126-00250' }, { noSJ: 'SJ-1126-00251' }],
                    proofPhotoUrl: 'https://example.com/pod2.jpg'
                }
            ]
        },
        {
            id: 'TRIP_1002_B',
            courierId: 'kurir-2',
            date: { seconds: 1700000000 },
            destinations: [
                {
                    locationName: 'Toko Makmur',
                    address: 'Jl. Gatot Subroto, Jakarta',
                    status: 'klien_tutup',
                    pendingReason: 'Tutup hari libur',
                    sjNumber: 'SJ-1126-00300'
                },
                {
                    locationName: 'Toko Sejahtera',
                    address: 'Jl. Thamrin, Jakarta',
                    status: 'in_progress',
                    sjNumber: 'SJ-1126-00301'
                }
            ]
        }
    ];

    const context = vm.createContext({
        allCurrentTrips: trips,
        registeredUsers: { 'kurir-1': 'Budi Santoso', 'kurir-2': 'Ahmad Dahlan' },
        getCourierDisplayName: id => id === 'kurir-1' ? 'Budi Santoso' : (id === 'kurir-2' ? 'Ahmad Dahlan' : id),
        getCourierVehicleType: () => 'mobil',
        normalizeCourierIdentity: (id, name) => ({ canonicalId: id || name }),
        isTripInActiveBranch: () => true,
        isTripInDateRange: () => true,
        parseDateBoundary: () => null,
        parseCompletionTimestamp: () => 1700000000000,
        destinationCompletionMs: () => 1700003600000,
        formatCompletionWIB: () => '14:30 WIB',
        resolveDestinationRegion: () => 'Bekasi',
        extractDestinationPhotos: (d) => ({ allUrls: d.proofPhotoUrl ? [d.proofPhotoUrl] : [] }),
        safeSplitPhotoUrls: v => v ? [v] : [],
        Blob,
        ExcelJS: {
            Workbook: class {
                addWorksheet(name) {
                    const s = createMockSheet(name);
                    sheets.set(name, s);
                    return s;
                }
                xlsx = { async writeBuffer() { return Buffer.from('test'); } };
            }
        },
        window: {
            SJLinks: require('../js/sj_links.js'),
            URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} }
        },
        document: {
            getElementById: (id) => {
                if (id === 'recent-date-filter') return { value: 'all' };
                if (id === 'recent-status-filter') return { value: 'all' };
                if (id === 'recent-carrier-filter') return { value: 'all' };
                return null;
            },
            createElement: () => ({ click() {} }),
            body: { appendChild() {}, removeChild() {} }
        },
        alert: () => {}
    });

    const start = source.indexOf('async function exportRecentShipmentsToExcel(');
    const end = source.indexOf('\nwindow.exportRecentShipmentsToExcel =', start);
    vm.runInContext(source.slice(start, end), context);

    await context.exportRecentShipmentsToExcel();

    // Verify both sheets exist
    assert.ok(sheets.has('Recent_Shipments'), 'Recent_Shipments sheet must be present');
    assert.ok(sheets.has('Pivot_Kurir'), 'Pivot_Kurir sheet must be present');

    const s1 = sheets.get('Recent_Shipments');
    const s2 = sheets.get('Pivot_Kurir');

    // === Sheet 1 Verifications ===
    assert.ok(s1.merged.includes('A1:L1'), 'Sheet 1 Row 1 Title should merge A1:L1 (12 columns)');
    assert.ok(s1.merged.includes('A2:L2'), 'Sheet 1 Row 2 Subtitle should merge A2:L2');
    assert.equal(s1.cell('1:1').value, 'LAPORAN HISTORIS PENGANTARAN LOGISTIK - WTRACK LOGISTICS');

    // Headers (Row 4) - Verify 12 columns
    assert.equal(s1.cell('4:1').value, 'No');
    assert.equal(s1.cell('4:2').value, 'Tanggal');
    assert.equal(s1.cell('4:3').value, 'NO Surat Jalan / NO DO');
    assert.equal(s1.cell('4:4').value, 'Kurir / Driver');
    assert.equal(s1.cell('4:5').value, 'Tipe Armada');
    assert.equal(s1.cell('4:6').value, 'Tujuan / Toko');
    assert.equal(s1.cell('4:7').value, 'Alamat Lengkap');
    assert.equal(s1.cell('4:8').value, 'Status');
    assert.equal(s1.cell('4:9').value, 'Jam Selesai');
    assert.equal(s1.cell('4:10').value, 'Alasan Pending / Catatan');
    assert.equal(s1.cell('4:11').value, 'Bukti Foto PoD');
    assert.equal(s1.cell('4:12').value, 'Region');

    // Verify removed columns do NOT appear in headers
    for (let c = 1; c <= 12; c++) {
        const val = s1.cell(`4:${c}`).value;
        assert.notEqual(val, 'Plat Mobil');
        assert.notEqual(val, 'Jam Sampai');
        assert.notEqual(val, 'Stop #');
        assert.notEqual(val, 'Shipment ID');
        assert.notEqual(val, 'Trip Full ID');
    }

    // Data checks (Row 5 & 6)
    assert.equal(s1.cell('5:1').value, 1);
    assert.equal(s1.cell('5:3').value, 'SJ-1126-00248');
    assert.equal(s1.cell('5:4').value, 'Budi Santoso');
    assert.equal(s1.cell('5:6').value, 'Toko Bintang');
    assert.equal(s1.cell('5:8').value, 'completed');
    assert.equal(s1.cell('5:12').value, 'Bekasi');

    assert.equal(s1.cell('6:1').value, 2);
    assert.equal(s1.cell('6:3').value, 'SJ-1126-00250, SJ-1126-00251');
    assert.equal(s1.cell('6:4').value, 'Budi Santoso');

    assert.equal(s1.columns.length, 12, 'Sheet 1 should have exactly 12 columns');
    assert.equal(s1.autoFilter.to.column, 12, 'Sheet 1 autoFilter should cover 12 columns');

    // === Sheet 2 (Pivot) Verifications ===
    assert.ok(s2.merged.includes('A1:F1'), 'Sheet 2 Row 1 Title should merge A1:F1 (6 columns)');
    assert.ok(s2.merged.includes('A2:F2'), 'Sheet 2 Row 2 Subtitle should merge A2:F2');
    assert.equal(s2.cell('1:1').value, 'RINGKASAN PIVOT PENGANTARAN KURIR - WTRACK LOGISTICS');

    // Pivot Headers (Row 4)
    assert.equal(s2.cell('4:1').value, 'No');
    assert.equal(s2.cell('4:2').value, 'Nama Kurir');
    assert.equal(s2.cell('4:3').value, 'Total Pengantaran');
    assert.equal(s2.cell('4:4').value, 'Sukses');
    assert.equal(s2.cell('4:5').value, 'Gagal');
    assert.equal(s2.cell('4:6').value, 'Pending');

    // Pivot Data Rows (Row 5 & 6)
    // Both couriers have 2 shipments each, sorted alphabetically or by total
    const row5Name = s2.cell('5:2').value;
    const row6Name = s2.cell('6:2').value;
    const courierNames = [row5Name, row6Name].sort();
    assert.deepEqual(courierNames, ['Ahmad Dahlan', 'Budi Santoso']);

    // Check stats for Budi Santoso (2 total, 2 sukses, 0 gagal, 0 pending)
    const budiRow = row5Name === 'Budi Santoso' ? 5 : 6;
    assert.equal(s2.cell(`${budiRow}:3`).value, 2);
    assert.equal(s2.cell(`${budiRow}:4`).value, 2);
    assert.equal(s2.cell(`${budiRow}:5`).value, 0);
    assert.equal(s2.cell(`${budiRow}:6`).value, 0);

    // Check stats for Ahmad Dahlan (2 total, 0 sukses, 1 gagal (klien_tutup), 1 pending (in_progress))
    const ahmadRow = row5Name === 'Ahmad Dahlan' ? 5 : 6;
    assert.equal(s2.cell(`${ahmadRow}:3`).value, 2);
    assert.equal(s2.cell(`${ahmadRow}:4`).value, 0);
    assert.equal(s2.cell(`${ahmadRow}:5`).value, 1);
    assert.equal(s2.cell(`${ahmadRow}:6`).value, 1);

    // Total Row (Row 7)
    assert.equal(s2.cell('7:1').value, 'TOTAL KESELURUHAN');
    assert.equal(s2.cell('7:3').value, 4, 'Total keseluruhan pengantaran');
    assert.equal(s2.cell('7:4').value, 2, 'Total sukses');
    assert.equal(s2.cell('7:5').value, 1, 'Total gagal');
    assert.equal(s2.cell('7:6').value, 1, 'Total pending');

    assert.equal(s2.columns.length, 6, 'Sheet 2 should have exactly 6 columns');
    assert.equal(s2.autoFilter.to.column, 6, 'Sheet 2 autoFilter should cover 6 columns');
});

