const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(trips=[],clients=[],extras={}) {
    const window={allCurrentTrips:trips,getCustomerMasterRows:()=>clients,
        allPoolTrips:[{id:'pool',courierId:'x'}],
        localStorage:{getItem:()=>null},document:{addEventListener(){},getElementById:()=>null},...extras};
    vm.runInNewContext(fs.readFileSync('js/volume_comparison.js','utf8'),{window});
    return window.VolumeComparison;
}
test('empty snapshot never adds demo, pool, or local assignments',()=>{
    assert.equal(setup().collectTripData().length,0);
});
test('counts each assignment once and uses completion status per stop',()=>{
    const trip={id:'a',courierId:'c',date:{seconds:1794220200},status:'completed',destinations:[
        {deliveryId:'one',status:'done',address:'Jl. Satu'},
        {deliveryId:'two',status:'pending',address:'Jl. Satu',proofPhotoUrl:'photo'},
    ]};
    const api=setup([trip,trip,{...trip,id:'b'},{...trip,id:'pool',status:'pool'},{id:'unassigned'}]);
    const rows=api.collectTripData();
    assert.equal(rows.length,2);
    assert.equal(rows.reduce((n,r)=>n+r.deliveredDestinations,0),1);
    assert.equal(rows.reduce((n,r)=>n+r.sjCount,0),0);
    assert.equal(rows[0].date,'2026-11-09');
});
test('address matches clients without guessing an ambiguous address',()=>{
    const api=setup([{id:'a',courierId:'c',date:'2026-11-09',destinations:[
        {address:' JL. Satu No. 1 ',status:'done'},
        {address:'Jl Dua',locationName:'Unknown'},
        {address:'Jl Dua',locationName:'B'},
    ]}],[{name:'A',address:'Jl Satu No 1',region:'Bekasi'},
        {name:'B',address:'Jl Dua'},{name:'C',address:'Jl Dua'}]);
    const rows=api.collectTripData();
    assert.equal(rows[0].customer,'A');assert.equal(rows[0].region,'Bekasi');
    assert.equal(rows[1].customer,'Jl Dua');assert.equal(rows[2].customer,'B');
});
test('WIB dates, date filters, and chart/breakdown totals agree',()=>{
    const api=setup([{id:'a',courierId:'c',date:'2026-11-08T18:00:00Z',destinations:[{status:'done'},{status:'pending'}]},
        {id:'old',courierId:'c',date:'2026-11-02',status:'completed'}]);
    const rows=api.collectTripData();
    const buckets=api.computeDailyBuckets(rows,'destinations','all','all','all','2026-11-09','2026-11-15');
    const breakdown=api.computeBreakdownData(rows,'customer','all','all','all','2026-11-09','2026-11-15','');
    assert.equal(buckets[0].total,2);assert.equal(buckets[0].delivered,1);
    assert.equal(breakdown.grandTotal,2);
    assert.equal(buckets.reduce((n,b)=>n+b.total,0),breakdown.grandTotal);
});
test('same address represents separate stops; SJ requires real numbers and is unique',()=>{
    const api=setup([{id:'a',courierId:'c',date:'2026-11-09',destinations:[
        {address:'same',noSJ:'SJ-1',status:'done'},{address:'same',noSJ:'SJ-1',status:'pending'},
    ]}]);
    const rows=api.collectTripData();
    assert.equal(rows.length,2);
    const buckets=api.computeDailyBuckets(rows,'sj','all','all','all','','');
    assert.equal(buckets[0].total,1);assert.equal(buckets[0].delivered,0);
});
test('drilldown selects exact stops by day/completion and mapped client, preserving chart filters',()=>{
    const api=setup([{id:'a',courierId:'c',date:'2026-11-09',destinations:[
        {address:'Jl Satu',status:'done'},{address:'Jl Dua',status:'pending'}]},
        {id:'b',courierId:'other',date:'2026-11-09',destinations:[{address:'Jl Satu',status:'done'}]},
        {id:'old',courierId:'c',date:'2026-11-02',destinations:[{address:'Jl Satu',status:'done'}]}
    ],[{address:'Jl Satu',name:'PT Nama di Master'}]);
    api.setDateRange('2026-11-09','2026-11-15');api.setCourier('c');
    api.filterByDay(0);
    assert.deepEqual([...api.getShipmentSelection().keys()],['a:0','a:1']);
    api.filterByDay(0,{target:{classList:{contains:()=>true}}});
    assert.deepEqual([...api.getShipmentSelection().keys()],['a:0']);
    api.filterByRow('PT Nama di Master');
    assert.deepEqual([...api.getShipmentSelection().keys()],['a:0']);
    api.clearShipmentSelection();assert.equal(api.getShipmentSelection(),null);
});
test('cards count only the clicked stops, including distance and completion-only selection',()=>{
    const api=setup([{id:'a',courierId:'c',date:'2026-11-09',destinations:[
        {status:'done',km:3},{status:'failed',km:7}]},
        {id:'other',courierId:'c',date:'2026-11-10',destinations:[{status:'done',km:99}]}],[],{
        calculateAccurateTripKM:trip=>trip.destinations.reduce((n,d)=>n+d.km,0)
    });
    assert.equal(api.getSelectionSummary(),null);
    api.setDateRange('2026-11-09','2026-11-15');api.filterByDay(0);
    let summary=api.getSelectionSummary();
    assert.equal(summary.total,2);assert.equal(summary.completed,1);assert.equal(summary.returned,1);
    assert.equal(summary.rate,50);assert.equal(summary.distance,10);
    api.filterByDay(0,{target:{classList:{contains:()=>true}}});
    summary=api.getSelectionSummary();
    assert.equal(summary.total,1);assert.equal(summary.completed,1);assert.equal(summary.rate,100);
    assert.equal(summary.distance,3);assert.equal(summary.returned,0);
    api.clearShipmentSelection();assert.equal(api.getSelectionSummary(),null);
});
test('breakdown header badges update with the visible search results',()=>{
    const container={innerHTML:''};
    const api=setup([{id:'a',courierId:'c',date:'2026-11-09',destinations:[
        {status:'done',address:'A',noSJ:'SJ-1',region:'Bekasi'},
        {status:'pending',address:'B',noSJ:'SJ-2',region:'Bogor'}]}],[],{
        document:{addEventListener(){},getElementById:id=>id==='dashboard-volume-comparison-container'?container:null}
    });
    api.setDateRange('2026-11-09','2026-11-15');
    assert.match(container.innerHTML,/data-count="destinations"[^>]*>2<\/span>/);
    assert.match(container.innerHTML,/data-count="regions"[^>]*>2<\/span>/);
    api.setSearch('Bekasi');
    assert.match(container.innerHTML,/data-count="destinations"[^>]*>1<\/span>/);
    assert.match(container.innerHTML,/data-count="completed"[^>]*>1<\/span>/);
});
test('daily chart buckets include dates and render date labels below each bar',()=>{
    const container={innerHTML:''};
    const api=setup([{id:'a',courierId:'c',date:'2026-11-09',destinations:[{status:'done'}]}],[],{
        document:{addEventListener(){},getElementById:id=>id==='dashboard-volume-comparison-container'?container:null}
    });
    api.setDateRange('2026-11-09','2026-11-15');
    const rows=api.collectTripData();
    const buckets=api.computeDailyBuckets(rows,'destinations','all','all','all','2026-11-09','2026-11-15');
    assert.equal(buckets[0].day,'Senin');
    assert.equal(buckets[0].date,'2026-11-09');
    assert.equal(buckets[0].dateFormatted,'09 Nov');
    assert.equal(buckets[6].day,'Minggu');
    assert.equal(buckets[6].date,'2026-11-15');
    assert.equal(buckets[6].dateFormatted,'15 Nov');
    assert.match(container.innerHTML,/09 Nov/);
    assert.match(container.innerHTML,/15 Nov/);
});
test('filters volume comparison by vehicle type (mobil vs motor)',()=>{
    const container={innerHTML:''};
    const api=setup([
        {id:'trip-motor',courierId:'ahmad',vehicleType:'motor',date:'2026-11-09',destinations:[{status:'done',address:'A'}]},
        {id:'trip-mobil',courierId:'soleh',vehicleType:'mobil',date:'2026-11-09',destinations:[{status:'done',address:'B'}]}
    ],[],{
        document:{addEventListener(){},getElementById:id=>id==='dashboard-volume-comparison-container'?container:null}
    });
    api.setDateRange('2026-11-09','2026-11-15');
    const rows=api.collectTripData();
    assert.equal(rows.length,2);

    // Motor filter
    const motorBuckets=api.computeDailyBuckets(rows,'destinations','all','all','all','2026-11-09','2026-11-15','motor');
    assert.equal(motorBuckets[0].total,1);
    const motorBreakdown=api.computeBreakdownData(rows,'customer','all','all','all','2026-11-09','2026-11-15','','motor');
    assert.equal(motorBreakdown.grandTotal,1);

    // Mobil filter
    const mobilBuckets=api.computeDailyBuckets(rows,'destinations','all','all','all','2026-11-09','2026-11-15','mobil');
    assert.equal(mobilBuckets[0].total,1);
    const mobilBreakdown=api.computeBreakdownData(rows,'customer','all','all','all','2026-11-09','2026-11-15','','mobil');
    assert.equal(mobilBreakdown.grandTotal,1);

    // Filter via UI method
    api.setVehicle('mobil');
    assert.match(container.innerHTML,/id="vol-vehicle-select"/);
    assert.match(container.innerHTML,/value="mobil" selected/);
    assert.match(container.innerHTML,/Armada Mobil/);

    api.setVehicle('motor');
    assert.match(container.innerHTML,/value="motor" selected/);
    assert.match(container.innerHTML,/Armada Motor/);
});
test('drilldown day label formats concise Indonesian day name and date without wrapping',()=>{
    const api=setup([
        {id:'trip-sat',courierId:'c',date:'2026-11-14',destinations:[{status:'done',km:5},{status:'pending',km:5}]}
    ]);
    api.setDateRange('2026-11-09','2026-11-15');
    api.filterByDay(5); // Sabtu
    const summary=api.getSelectionSummary();
    assert.equal(summary.total,2);
    assert.equal(summary.completed,1);
    // Must be formatted cleanly as day and single date, NOT raw full week ISO range
    assert.match(summary.label,/Sabtu, 14 Nov 2026/);
    assert.doesNotMatch(summary.label,/2026-11-09 – 2026-11-15/);

    // Completed only
    api.filterByDay(5,{target:{classList:{contains:()=>true}}});
    const completedSummary=api.getSelectionSummary();
    assert.match(completedSummary.label,/Sabtu, 14 Nov 2026 • Selesai/);
});
test('supports DD/MM/YYYY dates and aligns shipments by assignment date',()=>{
    const tripToday={id:'trip-today',courierId:'c',date:'15/11/2026',destinations:Array.from({length:27},(_,i)=>({
        deliveryId:`stop-${i}`,
        status: i<26 ? 'done' : 'pending',
        address:`Jl. Test ${i}`
    }))};
    const tripYesterday={id:'trip-yesterday',courierId:'c',date:'2026-11-14',destinations:Array.from({length:24},(_,i)=>({
        deliveryId:`spill-${i}`,
        status: i<23 ? 'done' : 'pending',
        completedTime: Date.now(),
        address:`Jl. Spill ${i}`
    }))};

    const api=setup([tripToday,tripYesterday],[]);
    const rows=api.collectTripData();
    assert.equal(rows.length,51);
    const sundayRows=rows.filter(r=>r.day==='Minggu');
    assert.equal(sundayRows.length,27);
    assert.equal(sundayRows.reduce((sum,r)=>sum+r.deliveredDestinations,0),26);
    const saturdayRows=rows.filter(r=>r.day==='Sabtu');
    assert.equal(saturdayRows.length,24);
    assert.equal(saturdayRows.reduce((sum,r)=>sum+r.deliveredDestinations,0),23);
});

test('renders 3rd red bar for failed shipments and tooltip shows Gagal instead of Tertunda/Belum',()=>{
    const container={innerHTML:''};
    const tooltipEl={innerHTML:'',classList:{add(){},remove(){}},style:{}};
    const api=setup([
        {id:'trip-rabu',courierId:'c',date:'2026-11-11',destinations:[
            {status:'done',address:'Alamat 1'},
            {status:'done',address:'Alamat 2'},
            {status:'pending',address:'Alamat 3'} // 1 failed/pending
        ]}
    ],[],{
        document:{
            addEventListener(){},
            getElementById:id=>id==='dashboard-volume-comparison-container'?container:
                (id==='esse-chart-tooltip'?tooltipEl:(id==='volume-svg-container'?{}:null))
        }
    });
    api.setDateRange('2026-11-09','2026-11-15');
    const rows=api.collectTripData();
    const buckets=api.computeDailyBuckets(rows,'destinations','all','all','all','2026-11-09','2026-11-15');
    const rabu=buckets.find(b=>b.day==='Rabu');
    assert.equal(rabu.total,3);
    assert.equal(rabu.delivered,2);
    assert.equal(rabu.failed,1);

    // SVG must render the 3rd red bar with class chart-bar-failed
    assert.match(container.innerHTML,/class="[^"]*chart-bar-failed[^"]*"/);
    assert.match(container.innerHTML,/#(?:EF4444|D92D20|F04438)/i);

    // Tooltip must show Gagal instead of Tertunda / Belum
    api.showTooltip(2, 200, 100); // idx 2 = Rabu
    assert.match(tooltipEl.innerHTML,/Gagal:/);
    assert.doesNotMatch(tooltipEl.innerHTML,/Tertunda \/ Belum/);
});

test('clicking the 3rd failed bar filters selection and stat cards dynamically to failed shipments only',()=>{
    const statActive={innerText:''};
    const statCompleted={innerText:''};
    const statDelayed={innerText:''};
    const filterBanner={innerHTML:'',hidden:true};
    const elements={
        'stat-active': statActive,
        'stat-completed': statCompleted,
        'stat-delayed': statDelayed,
        'recent-volume-filter': filterBanner
    };

    const api=setup([
        {id:'trip-rabu',courierId:'c',courierName:'Noval',date:'2026-11-11',destinations:[
            {deliveryId:'s1',status:'done',address:'Jl. Sukses 1',km:2},
            {deliveryId:'s2',status:'done',address:'Jl. Sukses 2',km:3},
            {deliveryId:'s3',status:'pending',address:'Jl. Gagal 1',pendingReason:'Klien Tutup',km:4}
        ]}
    ],[],{
        calculateAccurateTripKM:trip=>trip.destinations.reduce((n,d)=>n+(d.km||0),0),
        document:{
            addEventListener(){},
            getElementById:id=>elements[id]||null
        }
    });

    api.setDateRange('2026-11-09','2026-11-15');
    // Click failed bar (idx 2 = Rabu)
    api.filterByDay(2, {target: {classList: {contains: cls => cls === 'chart-bar-failed'}}});

    const summary=api.getSelectionSummary();
    assert.ok(summary);
    assert.equal(summary.total, 1);
    assert.equal(summary.completed, 0);
    assert.equal(summary.returned, 1);
    assert.match(summary.label, /Rabu, 11 Nov 2026 • Gagal Kirim/);

    const selection=api.getShipmentSelection();
    assert.equal(selection.size, 1);
    assert.ok(selection.has('trip-rabu:2'));
    assert.equal(selection.get('trip-rabu:2').courier, 'Noval');

    api.applyStatCards();
    assert.equal(statActive.innerText, 1);
    assert.equal(statDelayed.innerText, 1);
});

