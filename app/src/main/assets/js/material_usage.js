/* Production material usage reporting from imported SJ items. */
(function(root) {
    'use strict';
    const key='wtrack_material_usage_sources_v1';
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const fmt=value=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:4}).format(value);
    const label=value=>root.PoolLineItems?.formatName(value)||String(value||'');
    function dayKey(value) {
        if(!value) return '';
        if(typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const date=new Date(value+'T00:00:00Z');
            return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:'';
        }
        let date;
        if(value.seconds!==undefined||value._seconds!==undefined) date=new Date(Number(value.seconds??value._seconds)*1000);
        else if(typeof value.toDate==='function') date=value.toDate();
        else date=new Date(value);
        if(!Number.isFinite(date.getTime())) return '';
        const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
        const part=name=>parts.find(p=>p.type===name).value;
        return `${part('year')}-${part('month')}-${part('day')}`;
    }
    const today=()=>dayKey(new Date());
    let from=today().slice(0,7)+'-01',to=today(),basis='document',materialId='',query='',mode='summary',page=1,captureError='';
    const pageSize=15;
    function readSources() {
        const rows=JSON.parse(root.localStorage.getItem(key)||'[]');
        if(!Array.isArray(rows)) throw Error('Arsip Usage tidak valid.');
        return rows;
    }
    function mergeSources(existing,trips) {
        const map=new Map(existing.map(row=>[row.sjKey||String(row.noSJ||'').trim().toUpperCase(),row]));
        const incomingSeen=new Set();
        for(const trip of trips) {
            if(!trip.sourceFile && !String(trip.batchId||'').startsWith('BATCH_SJ_')) continue;
            const noSJ=String(trip.noSJ||trip.sjNumber||'').trim(),sjKey=noSJ.toUpperCase();
            if(!sjKey||incomingSeen.has(sjKey)) continue;incomingSeen.add(sjKey);
            const previous=map.get(sjKey);
            const items=root.PoolLineItems.itemsOf(trip);
            map.set(sjKey,{sjKey,noSJ,sourceTripId:trip.id||trip.tripId||'',customer:trip.customer||trip.clientName||'',sourceFile:trip.sourceFile||'',
                sourceDocumentDate:trip.sourceDocumentDate||previous?.sourceDocumentDate||'',
                importedAt:previous?.importedAt||trip.importedAt||trip.jobReceivedAt||trip.dateFolder||trip.date||'',
                items:JSON.parse(JSON.stringify(items))});
        }
        return [...map.values()];
    }
    function capture(trips) {
        if(!root.WTRACK_LOCAL_SANDBOX) return false;
        try {
            const before=readSources(),rows=mergeSources(before,trips);
            if(JSON.stringify(rows)!==JSON.stringify(before)) root.localStorage.setItem(key,JSON.stringify(rows));
            captureError='';return true;
        } catch(error) {
            captureError=error.message;
            root.showToast?.('Arsip Usage belum tersimpan: '+error.message);
            return false;
        }
    }
    function buildReport(sources,database,options={}) {
        const rows=[],issues=[],seen=new Set(),sjSet=new Set();let fallbackDates=0,services=0,undated=0;
        // Nonactive master rows remain available when reporting historical production.
        const historical=database.map(row=>({...row,active:true}));
        for(const source of sources) {
            const sjKey=source.sjKey||String(source.noSJ||'').trim().toUpperCase();
            if(!sjKey||seen.has(sjKey)) continue;seen.add(sjKey);
            const documentDate=dayKey(source.sourceDocumentDate),importDate=dayKey(source.importedAt);
            const date=options.basis==='import'?importDate:(documentDate||importDate);
            if(!date) {undated++;continue;}
            if(options.from&&date<options.from || options.to&&date>options.to) continue;
            if(options.basis!=='import'&&!documentDate) fallbackDates++;
            sjSet.add(sjKey);
            for(const [index,item] of (source.items||[]).entries()) {
                if(root.PoolLineItems?.isServiceItem ? root.PoolLineItems.isServiceItem(item) : item.poolLine?.kind==='service') {services++;continue;}
                const result=root.PoolLineItems.calculate(item,historical);
                const info={sjKey,noSJ:source.noSJ,date,dateFallback:options.basis!=='import'&&!documentDate,line:index+1,itemName:item.nama||item.name||'',customer:source.customer||'',sourceFile:source.sourceFile||''};
                if(result.areaM2===null) {issues.push({...info,areaM2:null,reason:'Size / Qty tidak dapat dihitung'});continue;}
                const components=[{material:result.material,layer:'Bahan Utama'},{material:result.sticker,layer:'Stiker Pelapis'},{material:result.finishing,layer:'Laminasi'}].filter(entry=>entry.material);
                if(new Set(components.map(entry=>entry.material.id)).size!==components.length) {issues.push({...info,areaM2:result.areaM2,reason:'Bahan utama dan pelapis sama; periksa pilihan'});continue;}
                if(result.weightKg===null) issues.push({...info,areaM2:result.areaM2,reason:result.reason||'Bahan belum terpetakan'});
                for(const {material,layer} of components) {
                    const rate=Number(material.kgPerM2);
                    if(!Number.isFinite(rate)||rate<=0) continue;
                    rows.push({...info,materialId:material.id,materialName:material.name,layer,areaM2:result.areaM2,kgPerM2:rate,weightKg:result.areaM2*rate});
                }
            }
        }
        const search=String(options.query||'').toLowerCase();
        const filtered=rows.filter(row=>(!options.materialId||row.materialId===options.materialId)&&(!search||`${row.materialName} ${row.noSJ} ${row.itemName} ${row.customer}`.toLowerCase().includes(search)));
        const groups=new Map();
        for(const row of filtered) {
            if(!groups.has(row.materialId)) groups.set(row.materialId,{materialId:row.materialId,name:row.materialName,areaM2:0,weightKg:0,sjKeys:new Set(),lines:0});
            const group=groups.get(row.materialId);group.areaM2+=row.areaM2;group.weightKg+=row.weightKg;group.sjKeys.add(row.sjKey);group.lines++;
        }
        const summary=[...groups.values()].map(group=>({...group,sjCount:group.sjKeys.size,sjKeys:undefined})).sort((a,b)=>a.name.localeCompare(b.name));
        return {rows:filtered,summary,issues:issues.filter(row=>!search||`${row.noSJ} ${row.itemName} ${row.customer}`.toLowerCase().includes(search)),
            sjCount:options.materialId?new Set(filtered.map(row=>row.sjKey)).size:sjSet.size,
            areaM2:filtered.reduce((sum,row)=>sum+row.areaM2,0),weightKg:filtered.reduce((sum,row)=>sum+row.weightKg,0),fallbackDates,services,undated};
    }
    function current() {
        const live=root.WTRACK_LOCAL_SANDBOX?JSON.parse(root.localStorage.getItem('wtrack_local_trips')||'[]'):[];
        capture(live);
        let sources=[];
        try {sources=root.WTRACK_LOCAL_SANDBOX?readSources():root.MaterialCloud.sources();} catch(error) {captureError=error.message;}
        return buildReport(mergeSources(sources,live),root.MaterialMaster.read(),{from,to,basis,materialId,query});
    }
    async function open() {
        if(!root.WTRACK_LOCAL_SANDBOX) {try{await root.MaterialCloud.loadUsage();captureError='';}catch(error){root.alert('Usage belum dimuat: '+error.message);return;}}
        root.switchTab('material-usage',root.document.getElementById('nav-material-usage'));render();
    }
    function render() {
        const view=root.document.getElementById('view-material-usage');if(!view)return;
        const report=current(),data=mode==='summary'?report.summary:report.rows;
        const pages=Math.max(1,Math.ceil(data.length/pageSize));page=Math.min(page,pages);
        const visible=data.slice((page-1)*pageSize,page*pageSize);
        const database=root.MaterialMaster.read();
        view.innerHTML=`<section class="material-master material-usage"><header class="mm-heading"><div><div class="mm-eyebrow">Production Reporting</div><h4>Usage Bahan</h4><p>Pemakaian bahan dari seluruh item Delivery Order yang diimpor.</p></div><button type="button" class="mm-button btn-wellen-action" onclick="MaterialUsage.exportExcel()">Export</button></header>
            <div class="usage-filters"><label>Dari<input type="date" id="usage-from" value="${esc(from)}" onchange="MaterialUsage.setFilter('from',this.value)"></label><label>Sampai<input type="date" id="usage-to" value="${esc(to)}" onchange="MaterialUsage.setFilter('to',this.value)"></label>
            <label>Dasar tanggal<select id="usage-basis" onchange="MaterialUsage.setFilter('basis',this.value)"><option value="document" ${basis==='document'?'selected':''}>Tanggal SJ</option><option value="import" ${basis==='import'?'selected':''}>Tanggal Import</option></select></label>
            <label>Bahan<select id="usage-material" onchange="MaterialUsage.setFilter('materialId',this.value)"><option value="">Semua Bahan</option>${database.map(row=>`<option value="${esc(row.id)}" ${materialId===row.id?'selected':''}>${esc(label(row.name))}</option>`).join('')}</select></label>
            <button type="button" class="mm-button" onclick="MaterialUsage.period('month')">Bulan Ini</button><button type="button" class="mm-button" onclick="MaterialUsage.period('all')">Semua Tanggal</button></div>
            ${captureError?`<div class="alert alert-warning small">Arsip Usage belum tersimpan: ${esc(captureError)}. Data yang masih ada di SJ tetap ditampilkan.</div>`:''}
            <div class="usage-metrics"><div><span>Delivery Order</span><b>${report.sjCount}</b></div><div><span>Jenis Bahan</span><b>${report.summary.length}</b></div><div><span>Pemakaian Bahan · M2</span><b>${fmt(report.areaM2)}</b></div><div><span>Total Berat · KG</span><b>${fmt(report.weightKg)}</b></div></div>
            ${report.issues.length?`<div class="usage-notice">${report.issues.length} line belum lengkap. Rekap menampilkan komponen bahan yang sudah terpetakan; periksa daftar di bawah.</div>`:''}
            ${report.fallbackDates?`<div class="usage-notice">${report.fallbackDates} SJ belum memiliki tanggal dokumen; sementara memakai tanggal import.</div>`:''}
            ${report.undated?`<div class="usage-notice">${report.undated} SJ tidak memiliki tanggal yang bisa dibaca dan belum masuk rentang laporan.</div>`:''}
            <div class="mm-card"><div class="mm-toolbar"><div class="mm-tabs"><button type="button" class="mm-tab ${mode==='summary'?'is-active':''}" onclick="MaterialUsage.setMode('summary')">Rekap Bahan</button><button type="button" class="mm-tab ${mode==='detail'?'is-active':''}" onclick="MaterialUsage.setMode('detail')">Detail per SJ</button></div>
            <label class="mm-search"><input id="usage-search" aria-label="Cari bahan, SJ, item" value="${esc(query)}" placeholder="Cari bahan, SJ, item..." oninput="MaterialUsage.setSearch(this.value)"></label></div>
            <div class="usage-table-wrap"><table class="mm-table usage-table"><thead><tr>${mode==='summary'?'<th>Nama Bahan</th><th>Jumlah SJ</th><th>Line</th><th class="mm-number">M2</th><th class="mm-number">Total Berat KG</th>':'<th>Tanggal / SJ</th><th>Item</th><th>Bahan / Lapis</th><th class="mm-number">M2</th><th class="mm-number">Berat KG</th>'}</tr></thead><tbody>${visible.map(row=>mode==='summary'?`<tr><td>${esc(label(row.name))}</td><td>${row.sjCount}</td><td>${row.lines}</td><td class="mm-number">${fmt(row.areaM2)}</td><td class="mm-number mm-rate">${fmt(row.weightKg)}</td></tr>`:`<tr><td>${esc(row.date)}<small>${esc(row.noSJ)} · Line ${row.line}</small></td><td>${esc(label(row.itemName))}</td><td>${esc(label(row.materialName))}<small>${esc(row.layer)}</small></td><td class="mm-number">${fmt(row.areaM2)}</td><td class="mm-number mm-rate">${fmt(row.weightKg)}</td></tr>`).join('')||'<tr><td colspan="5" class="mm-empty">Belum ada pemakaian bahan pada rentang ini.<small>Import SJ dan cocokkan bahannya pada SJ Pool.</small></td></tr>'}</tbody><tfoot><tr><td colspan="3">Total</td><td class="mm-number">${fmt(report.areaM2)}</td><td class="mm-number mm-rate">${fmt(report.weightKg)}</td></tr></tfoot></table></div>
            <footer class="mm-footer"><span>Menampilkan ${data.length?(page-1)*pageSize+1:0}–${Math.min(page*pageSize,data.length)} dari ${data.length} data</span><div class="mm-pagination"><button class="mm-button" ${page===1?'disabled':''} onclick="MaterialUsage.setPage(${page-1})">‹</button><span>${page} / ${pages}</span><button class="mm-button" ${page===pages?'disabled':''} onclick="MaterialUsage.setPage(${page+1})">›</button></div></footer></div>
            ${report.issues.length?`<details class="usage-issues"><summary>Line yang perlu dicocokkan (${report.issues.length})</summary><table class="usage-table"><thead><tr><th>Tanggal / SJ</th><th>Item</th><th>M2</th><th>Keterangan</th></tr></thead><tbody>${report.issues.map(row=>`<tr><td>${esc(row.date)}<small>${esc(row.noSJ)} · Line ${row.line}</small></td><td>${esc(label(row.itemName))}</td><td>${row.areaM2===null?'—':fmt(row.areaM2)}</td><td>${esc(row.reason)}</td></tr>`).join('')}</tbody></table></details>`:''}
            <p class="mm-note">M2 setiap lapis bahan dihitung terpisah. Pilihan line kirim parsial tidak mengurangi pemakaian produksi. Berat estimasi memakai master bahan saat ini. ${report.services} line jasa tidak dihitung sebagai bahan.</p></section>`;
    }
    function setFilter(name,value) {
        const nextFrom=name==='from'?value:from,nextTo=name==='to'?value:to;
        if(nextFrom&&nextTo&&nextFrom>nextTo) {root.alert('Tanggal Dari tidak boleh melewati Sampai.');render();return;}
        if(name==='from')from=value;if(name==='to')to=value;if(name==='basis')basis=value;if(name==='materialId')materialId=value;page=1;render();
    }
    function period(value) {from=value==='all'?'':today().slice(0,7)+'-01';to=value==='all'?'':today();page=1;render();}
    function setMode(value) {mode=value;page=1;render();}
    function setPage(value) {page=Math.max(1,value);render();}
    function setSearch(value) {query=value;page=1;render();const input=root.document.getElementById('usage-search');input.focus();input.setSelectionRange(value.length,value.length);}
    function exportExcel() {
        const report=current(),XLSX=root.XLSX;
        if(!XLSX) return root.alert('Pustaka Excel belum tersedia.');
        const workbook=XLSX.utils.book_new();
        const add=(name,rows)=>XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(rows),name);
        add('Rekap Bahan',report.summary.map(row=>({'Bahan':row.name,'Jumlah SJ':row.sjCount,'Line':row.lines,'M2':row.areaM2,'Berat KG':row.weightKg})));
        add('Detail SJ',report.rows.map(row=>({'Tanggal':row.date,'No SJ':row.noSJ,'Line':row.line,'Item':row.itemName,'Bahan':row.materialName,'Lapis':row.layer,'M2':row.areaM2,'KG/M2':row.kgPerM2,'Berat KG':row.weightKg,'File':row.sourceFile})));
        if(report.issues.length)add('Belum Cocok',report.issues.map(row=>({'Tanggal':row.date,'No SJ':row.noSJ,'Line':row.line,'Item':row.itemName,'M2':row.areaM2,'Keterangan':row.reason})));
        XLSX.writeFile(workbook,`Usage_Bahan_${from||'awal'}_${to||'akhir'}.xlsx`);
    }
    function init() {
        const analyticsList=root.document.querySelector('[data-group="analytics-report"] .sidebar-sub-items');
        const anchor=analyticsList||root.document.getElementById('nav-settings');
        if(anchor&&!root.document.getElementById('nav-material-usage')) {
            const nav=root.document.createElement('a');nav.id='nav-material-usage';nav.className=analyticsList?'sub-nav-item':'nav-link-custom mt-2';nav.href='javascript:void(0)';nav.setAttribute('onclick','MaterialUsage.open()');nav.innerHTML=`<i class="bi bi-bar-chart-line${analyticsList?' sub-icon':''}"></i><span>Usage</span>`;
            if(analyticsList) analyticsList.appendChild(nav); else anchor.parentElement.insertBefore(nav,anchor);
        }
        if(!root.document.getElementById('view-material-usage')) {
            const pool=root.document.getElementById('view-pool');
            if(pool&&pool.parentElement){const view=root.document.createElement('div');view.id='view-material-usage';view.className='view-section';pool.parentElement.appendChild(view);}
        }
        if(root.WTRACK_LOCAL_SANDBOX)capture(JSON.parse(root.localStorage.getItem('wtrack_local_trips')||'[]'));
    }
    const api={capture,mergeSources,buildReport,dayKey,open,render,setFilter,period,setMode,setPage,setSearch,exportExcel};
    root.MaterialUsage=api;root.document?.addEventListener('DOMContentLoaded',init);
    if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
