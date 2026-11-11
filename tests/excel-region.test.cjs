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
    assert.equal(cell('4:12').value,'Region');
    assert.equal(cell('5:12').value,'Bekasi');
    assert.equal(cell('6:12').value,'Karawang');
    assert.equal(cell('7:12').value,'Belum teridentifikasi');
    assert.equal(cell('5:10').value,'done');
    assert.equal(cell('5:11').value.hyperlink,'https://example.com/proof.jpg');
    assert.equal(sheet.columns.length,12);
    assert.equal(sheet.autoFilter.to.column,12);
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
