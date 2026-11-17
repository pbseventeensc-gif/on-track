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

test('exportRecentShipmentsToExcel includes NO Surat Jalan / NO DO column in headers and data rows with 17 total columns', async () => {
    const cells = new Map();
    const cell = key => {
        const normalized = key === 'A1' ? '1:1' : (key === 'A2' ? '2:1' : key);
        if (!cells.has(normalized)) cells.set(normalized, {});
        return cells.get(normalized);
    };
    const merged = [];
    const sheet = {
        mergeCells(range) { merged.push(range); },
        getCell: cell,
        getRow: row => ({
            getCell: column => cell(`${row}:${column}`)
        })
    };
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
        }
    ];

    const context = vm.createContext({
        allCurrentTrips: trips,
        registeredUsers: { 'kurir-1': 'Budi Santoso' },
        getCourierDisplayName: id => id === 'kurir-1' ? 'Budi Santoso' : id,
        getCourierVehicleType: () => 'mobil',
        normalizeCourierIdentity: (id, name) => ({ canonicalId: id || name }),
        isTripInActiveBranch: () => true,
        isTripInDateRange: () => true,
        parseDateBoundary: () => null,
        parseCompletionTimestamp: () => 1700000000000,
        destinationCompletionMs: () => 1700003600000,
        formatCompletionWIB: () => '14:30 WIB',
        resolveDestinationRegion: () => 'Bekasi',
        extractDestinationPhotos: () => ({ allUrls: ['https://example.com/pod.jpg'] }),
        safeSplitPhotoUrls: v => v ? [v] : [],
        Blob,
        ExcelJS: {
            Workbook: class {
                addWorksheet() { return sheet; }
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

    // Verification
    assert.ok(merged.includes('A1:Q1'), 'Row 1 Title should merge A1:Q1');
    assert.ok(merged.includes('A2:Q2'), 'Row 2 Subtitle should merge A2:Q2');
    assert.equal(cell('1:1').value, 'LAPORAN HISTORIS PENGANTARAN LOGISTIK - WTRACK LOGISTICS');

    // Header checks (Row 4)
    assert.equal(cell('4:1').value, 'No');
    assert.equal(cell('4:2').value, 'Tanggal');
    assert.equal(cell('4:3').value, 'Shipment ID');
    assert.equal(cell('4:4').value, 'NO Surat Jalan / NO DO');
    assert.equal(cell('4:5').value, 'Trip Full ID');
    assert.equal(cell('4:6').value, 'Kurir / Driver');
    assert.equal(cell('4:16').value, 'Bukti Foto PoD');
    assert.equal(cell('4:17').value, 'Region');

    // Data checks (Row 5 & 6)
    assert.equal(cell('5:1').value, 1);
    assert.equal(cell('5:4').value, 'SJ-1126-00248');
    assert.equal(cell('5:6').value, 'Budi Santoso');
    assert.equal(cell('5:10').value, 'Toko Bintang');
    assert.equal(cell('5:17').value, 'Bekasi');

    assert.equal(cell('6:1').value, 2);
    assert.equal(cell('6:4').value, 'SJ-1126-00250, SJ-1126-00251');
    assert.equal(cell('6:10').value, 'Toko Cahaya');

    // Sheet structure checks
    assert.equal(sheet.columns.length, 17, 'There should be exactly 17 column width configurations');
    assert.equal(sheet.autoFilter.to.column, 17, 'AutoFilter should cover all 17 columns');
});

