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
