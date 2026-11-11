const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/app.js'), 'utf8');

function setup(savedName = 'Beto', failSave = false) {
    const container = {innerHTML: ''};
    const events = [];
    const context = vm.createContext({
        MASTER_COURIERS: [{canonicalId:'beto',defaultUid:'beto-uid',displayName:'Beto',accountName:'Beto',role:'kurir'}],
        registeredUsers: {}, registeredUsersObjects: {}, deletedCourierUids: new Set(),
        accountDeletionAllowed: true, checkAccountDeletionPermission() {},
        document: {getElementById(id) {return id === 'manage-couriers-container' ? container : null;}},
        prompt: () => savedName, alert: message => events.push('error'), showToast: () => events.push('success'),
        renderCourierOptions: () => events.push('options'), renderRecentShipments() {}, refreshAllMonitorData() {},
        getCourierPhoto: () => '', localStorage: {setItem() {}},
        getDb: () => ({collection: () => ({doc: id => ({async update(data) {
            if (failSave) throw new Error('Permission denied');
            events.push(`saved:${id}:${data.name}`);
        }})})})
    });
    for (const name of ['escapeCourierText','syncCourierNames','renderManageCouriersList','promptEditCourierName','buildCourierOptgroupHtml']) {
        const start = source.indexOf(`${name === 'promptEditCourierName' ? 'async ' : ''}function ${name}(`);
        const end = source.indexOf('\n}', start) + 2;
        vm.runInContext(source.slice(start, end), context);
    }
    return {context, container, events};
}

test('successful rename updates the visible list and dispatch options before success notification', async () => {
    const {context,container,events} = setup('Beto Baru');
    await context.promptEditCourierName('beto-uid','Beto');
    assert.match(container.innerHTML,/Beto Baru/);
    assert.match(context.buildCourierOptgroupHtml(),/>Beto Baru<\/option>/);
    assert.equal(context.MASTER_COURIERS[0].accountName,'Beto');
    assert.match(container.innerHTML,/data-account-name="Beto"/);
    assert.equal(events[0],'saved:beto-uid:Beto Baru');
    assert.equal(events.at(-1),'success');
});

test('live Firestore snapshot restores renamed Beto after refresh, without legacy name override', () => {
    const {context,container} = setup();
    const marker = "activeDb.collection('users').onSnapshot(snap => {";
    const start = source.indexOf(marker) + marker.length;
    const end = source.indexOf('\n    });\n}', start);
    const snapshot = [{id:'beto-uid',data:()=>({name:'Nama Tersimpan',courierId:'beto',userId:'beto-uid'})}];
    context.snapshot = snapshot;
    vm.runInContext(`(snap => {${source.slice(start,end)} })(snapshot)`, context);
    assert.equal(context.MASTER_COURIERS[0].displayName,'Nama Tersimpan');
    assert.equal(context.registeredUsers.beto,'Nama Tersimpan');
    assert.match(container.innerHTML,/Nama Tersimpan/);
});

test('failed save keeps the original name and never reports success', async () => {
    const {context,events} = setup('Beto Baru',true);
    await context.promptEditCourierName('beto-uid','Beto');
    assert.equal(context.MASTER_COURIERS[0].displayName,'Beto');
    assert.deepEqual(events,['error']);
});

test('renamed text is escaped in account rows and dispatch option markup', async () => {
    const {context,container} = setup('<img src=x onerror=alert(1)> "Baru"');
    await context.promptEditCourierName('beto-uid','Beto');
    assert.ok(!container.innerHTML.includes('<img src=x'));
    assert.match(container.innerHTML,/&lt;img/);
    assert.ok(!context.buildCourierOptgroupHtml().includes('<img src=x'));
});
