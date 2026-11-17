const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup() {
    const events = new Map();
    const state = {fetches:0,reloads:0,build:'new',dirty:false,modal:false,fail:false,screen:'screen-home'};
    const session = new Map();
    const window = {
        location:{protocol:'https:',reload(){state.reloads++;}},navigator:{onLine:true},
        FleetService:{hasUnsavedDraft:()=>state.dirty},
        document:{hidden:false,currentScript:{dataset:{build:'old'}},activeElement:null,
            querySelector:selector=>selector==='.app-screen.active' ? (state.screen?{id:state.screen}:null) : (state.modal ? {} : null), addEventListener:(name,fn)=>events.set(name,fn)},
        sessionStorage:{getItem:key=>session.get(key)||null,setItem:(key,value)=>session.set(key,String(value))},
        addEventListener:(name,fn)=>events.set(name,fn),setInterval(fn){events.set('interval',fn);},
        async fetch(url,options) {
            assert.equal(url,'/assets/app-version.json');assert.equal(options.cache,'no-store');
            state.fetches++;
            if(state.fail)throw Error('offline');
            return {ok:true,json:async()=>({courier:state.build})};
        }
    };
    vm.runInNewContext(fs.readFileSync('js/courier_updates.js','utf8'),{window});
    return {window,state,events,session};
}

test('opening or restoring the courier page checks immediately and reloads a newer web build', async()=>{
    const {state,events}=setup();
    await events.get('pageshow')();
    assert.equal(state.fetches,1);assert.equal(state.reloads,1);
});

test('resuming an already current app does not reload or disturb its session', async()=>{
    const {state,events}=setup();state.build='old';
    await events.get('visibilitychange')();
    assert.equal(state.fetches,1);assert.equal(state.reloads,0);
});

test('a service draft or open photo modal postpones updates until the form is safe', async()=>{
    const {state,events}=setup();
    state.dirty=true;await events.get('pageshow')();assert.equal(state.fetches,0);
    state.dirty=false;state.modal=true;await events.get('visibilitychange')();assert.equal(state.fetches,0);
    state.modal=false;await events.get('interval')();assert.equal(state.reloads,1);
});

test('offline and hidden apps wait; reconnecting checks for updates', async()=>{
    const {window,state,events}=setup();
    window.navigator.onLine=false;await events.get('pageshow')();assert.equal(state.fetches,0);
    window.navigator.onLine=true;window.document.hidden=true;
    await events.get('online')();assert.equal(state.fetches,0);
    window.document.hidden=false;await events.get('online')();assert.equal(state.reloads,1);
});

test('a failed version check preserves the current app and can retry on reopening', async()=>{
    const {state,events}=setup();state.fail=true;
    await events.get('pageshow')();assert.equal(state.reloads,0);
    state.fail=false;await events.get('pageshow')();assert.equal(state.reloads,1);
});

test('starting a draft while the version request is pending prevents an unsafe reload', async()=>{
    const {window,state,events}=setup();
    let resolve;
    window.fetch=()=>new Promise(done=>{resolve=done;});
    const pending=events.get('pageshow')();state.dirty=true;
    resolve({ok:true,json:async()=>({courier:'new'})});
    await pending;assert.equal(state.reloads,0);
});

test('never reloads the WebView while the courier is on an active task screen', async()=>{
    const {state,events}=setup();
    state.screen='screen-shipments';
    await events.get('pageshow')();
    assert.equal(state.reloads,0);
    assert.equal(state.fetches,0);
});

test('a stale build stamp cannot cause an endless reload loop', async()=>{
    const {state,events,session}=setup();
    session.set('wtrack_courier_update_attempt_v1','new');
    await events.get('pageshow')();
    assert.equal(state.reloads,0);
    assert.equal(state.fetches,1);
});
