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
            {locationName:'B', region:'  ', status:'pending'}
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
    vm.runInContext(source.slice(start,end),context);
    await context.exportFullReportsToExcel();
    assert.equal(cell('4:12').value,'Region');
    assert.equal(cell('5:12').value,'Bekasi');
    assert.equal(cell('6:12').value,'Bogor');
    assert.equal(cell('7:12').value,'-');
    assert.equal(cell('5:10').value,'done');
    assert.equal(cell('5:11').value.hyperlink,'https://example.com/proof.jpg');
    assert.equal(sheet.columns.length,12);
    assert.equal(sheet.autoFilter.to.column,12);
});
