const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const search = require('../js/destination_search.js');

const warehouse = {name:'WH Dry CKA Cibitung Aru PT. Astro Technologies Indonesia',address:'Sukas ejati, Cibitung, Bekasi',lat:-6.3,lng:107.1};

test('search matches skipped words, reversed words, punctuation and case', () => {
    for (const query of ['wh cka','CKA WH','wh-dry CKA','warehouse cka','cka cibitung']) {
        assert.equal(search.search(query,[warehouse])[0].name,warehouse.name,query);
    }
    assert.equal(search.search('wh jakarta',[warehouse]).length,0);
    assert.equal(search.search('  ',[warehouse]).length,0);
});

test('search reads stored client and destination shapes without combining different clients at one address', () => {
    const second={locationName:'Klien B CKA',address:warehouse.address,latitude:-6.3,longitude:107.1};
    const results=search.search('cka',[warehouse,{...warehouse},second,{name:'CKA tanpa lokasi',address:'Alamat'}]);
    assert.equal(results.length,2);
    assert.equal(results[1].name,warehouse.name);
    assert.equal(results.find(item=>item.name===second.locationName).lat,-6.3);
});

test('hospital abbreviation does not match the suffix of Farmers in a nearby address', () => {
    const candidates = [
        {name:'Chatime - Farmers Buaran Jakarta',address:'Jl. Radin Inten II, Duren Sawit, Jakarta Timur',lat:-6.2,lng:106.9},
        {name:'RS Duren Sawit - Poli VCT',address:'Pondok Bambu, Jakarta Timur',lat:-6.2,lng:106.9}
    ];
    const results = search.search('rs duren sa',candidates);
    assert.equal(results.length,1);
    assert.equal(results[0].name,'RS Duren Sawit - Poli VCT');
});

test('Jakarta region abbreviations match full addresses in both directions', () => {
    const azko = {name:'AZKO Tanjung Duren',address:'Tanjung Duren, Jakarta Barat',lat:-6.17,lng:106.78};
    assert.equal(search.search('azko tanjung duren jakbar', [azko])[0].name, azko.name);
    assert.equal(search.search('azko jaksel', [azko]).length, 0);
    assert.equal(search.search('azko jakarta barat', [{...azko, address:'Tanjung Duren, Jakbar'}]).length, 1);
});

function destinationDom() {
    const elements = [];
    function element(tag) {
        const el = {tag, style:{}, dataset:{}, children:[], listeners:{}, value:'',
            setAttribute() {},
            append(...nodes) { for (const node of nodes) this.appendChild(node); },
            appendChild(node) { this.children.push(node); node.parentElement = this; },
            insertBefore(node, before) { this.children.splice(this.children.indexOf(before), 0, node); node.parentElement = this; },
            replaceChildren() { this.children = []; },
            contains(node) { return this === node || this.children.some(child => child.contains(node)); },
            addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); },
            dispatchEvent(event) { for (const callback of this.listeners[event.type] || []) callback(event); },
            focus() { this.dispatchEvent({type:'focus'}); },
            blur() { this.dispatchEvent({type:'blur', relatedTarget:null}); }
        };
        elements.push(el);
        return el;
    }
    const section = element('section'), row = element('div'), wrapper = element('div'), input = element('input');
    input.id = 'places-search';
    section.appendChild(row); row.appendChild(wrapper); wrapper.appendChild(input);
    const document = {createElement:element, getElementById:id => elements.find(el => el.id === id)};
    return {document, input, section, row, elements};
}

test('saved results remain separate and leave Google keyboard selection untouched', () => {
    const dom = destinationDom();
    const selected = [];
    const c = vm.createContext({document:dom.document, getDestinationSearchCandidates:()=>[warehouse]});
    vm.runInContext(fs.readFileSync(require.resolve('../js/destination_search.js'),'utf8'), c);
    c.DestinationSearch.init(dom.input, place => selected.push(place));
    dom.input.value = 'wh cka';
    dom.input.dispatchEvent({type:'input'});
    const panel = dom.document.getElementById('saved-destination-suggestions');
    assert.equal(panel.style.display, 'block');
    assert.ok(dom.section.children.indexOf(panel) < dom.section.children.indexOf(dom.row));
    assert.equal(dom.elements.some(el => el.tag === 'style'), false);
    for (const key of ['ArrowDown', 'Enter']) {
        dom.input.dispatchEvent({type:'keydown', key, preventDefault:()=>assert.fail('intercepted Google key'), stopImmediatePropagation:()=>assert.fail('blocked Google listener')});
    }
    assert.equal(selected.length, 0);
    panel.children[1].dispatchEvent({type:'click'});
    assert.equal(selected[0].name, warehouse.name);
});

test('Enter and ADD cannot replace a Google selection with a saved result or geocoder lookup', async () => {
    const dom = destinationDom();
    let placeChanged, lookups = 0;
    const google = {maps:{places:{Autocomplete:class {
        addListener(name, callback) { placeChanged = callback; }
        getPlace() { return {name:'AZKO Tanjung Duren',formatted_address:'Jakarta Barat',geometry:{location:{lat:()=>-6.17,lng:()=>106.78}}}; }
    }}, Geocoder:class { constructor() { lookups++; } }}};
    const c = vm.createContext({window:{google, DestinationSearch:{init(){}, remember(){}, search:()=>[warehouse], candidates:()=>[warehouse]}},
        google, document:dom.document, tripQueue:[], mapDispatch:null, renderQueue(){},
        isInsideJabodetabekArea:()=>true, showToast(){}, Event:class {constructor(type){this.type=type;}}, console});
    const source = fs.readFileSync(require.resolve('../js/maps.js'),'utf8');
    vm.runInContext(source.slice(source.indexOf('function addSavedDestination('), source.indexOf('async function geocodeWithNominatim(')), c);
    await c.initAutocomplete();
    dom.input.value = 'azko tanjung duren jakbar';
    dom.input.dispatchEvent({type:'keydown',key:'Enter',preventDefault(){}});
    await c.addManualAddress();
    assert.equal(c.tripQueue.length, 0);
    assert.equal(lookups, 0);
    placeChanged();
    dom.input.dispatchEvent({type:'keydown',key:'Enter',preventDefault(){}});
    assert.equal(c.tripQueue.length, 1);
    assert.equal(c.tripQueue[0].name, 'AZKO Tanjung Duren');
    assert.equal(c.tripQueue[0].lat, -6.17);
    assert.equal(lookups, 0);
});

test('selecting a suggestion adds the actual saved name and coordinates to the route', () => {
    const source=fs.readFileSync(require('node:path').join(__dirname,'../js/maps.js'),'utf8');
    const input={value:'wh cka',dispatchEvent(){}};
    const c=vm.createContext({window:{DestinationSearch:{remember(){}},DeliveryIdentity:{newId:()=> 'new-delivery'}},
        tripQueue:[],document:{getElementById:()=>input},isInsideJabodetabekArea:()=>true,renderQueue(){},Event:class{}});
    const start=source.indexOf('function addSavedDestination(');
    const end=source.indexOf('async function initAutocomplete(',start);
    vm.runInContext(source.slice(start,end),c);
    c.addSavedDestination(warehouse);
    assert.equal(c.tripQueue.length,1);
    assert.equal(c.tripQueue[0].name,warehouse.name);
    assert.equal(c.tripQueue[0].address,warehouse.address);
    assert.equal(c.tripQueue[0].lat,warehouse.lat);
    assert.equal(c.tripQueue[0].deliveryId,'new-delivery');
    assert.equal(input.value,'');
});
