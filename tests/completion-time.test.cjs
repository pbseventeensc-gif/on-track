const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const source = fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
const helpers = source.slice(source.indexOf('function parseCompletionTimestamp('), source.indexOf('function isTripInDateRange('));
const c = vm.createContext({Date, Intl});
vm.runInContext(helpers,c);
const iso = '2026-11-13T07:20:00.000Z';
const ms = Date.parse(iso);

test('monitor completion reads Firestore, serialized timestamps and local ISO values equally', () => {
    for (const value of [iso, new Date(iso), ms, {seconds:ms/1000}, {_seconds:ms/1000},
        {toDate:()=>new Date(iso)}, {toMillis:()=>ms}]) {
        assert.equal(c.parseCompletionTimestamp(value),ms);
        assert.match(c.shipmentStatusTime({completedTime:value},{},'completed'),/^14[.:]20 WIB$/);
    }
    assert.match(c.shipmentStatusTime({completedAt:iso},{},'completed'),/^14[.:]20 WIB$/);
});

test('missing and invalid completion dates never produce current time or Invalid Date', () => {
    for (const value of [null, undefined, '', 'bad date', {}, {seconds:NaN}, Infinity]) {
        assert.equal(c.shipmentStatusTime({completedTime:value},{},'completed'),'Waktu selesai tidak tersedia');
    }
    assert.match(c.shipmentStatusTime({completedTime:'bad',completedAt:iso},{},'completed'),/^14[.:]20 WIB$/);
    assert.equal(c.shipmentStatusTime({arrivalTime:iso},{},'completed'),'Waktu selesai tidak tersedia');
});

test('each stop keeps its own completion time instead of inheriting the final stop time', () => {
    const later='2026-11-13T09:00:00Z';
    const trip={completedAt:later,destinations:[{},{}]};
    assert.equal(c.destinationCompletionMs({completedTime:iso},trip),ms);
    assert.equal(c.destinationCompletionMs({},trip),0);
    assert.equal(c.destinationCompletionMs({}, {completedAt:iso,destinations:[{}]}),ms);
});

test('arrival and Excel completion formats use WIB including the next calendar day', () => {
    assert.match(c.shipmentStatusTime({arrivalTime:iso},{},'in_progress'),/^14[.:]20 WIB$/);
    assert.equal(c.shipmentStatusTime({},{},'in_progress'),'On Delivery');
    assert.match(c.formatCompletionWIB(Date.parse('2026-11-13T18:30:00Z'),true),/14\/11\/2026.*01[.:]30 WIB$/);
});

test('monitor finish time is identical on devices configured for UTC and other timezones', () => {
    const script=helpers+'\nprocess.stdout.write(shipmentStatusTime({completedTime:'+JSON.stringify(iso)+'},{},"completed"));';
    for (const timezone of ['UTC','America/New_York','Asia/Makassar']) {
        const output=execFileSync(process.execPath,['-e',script],{env:{...process.env,TZ:timezone},encoding:'utf8'});
        assert.match(output,/^14[.:]20 WIB$/);
    }
});
