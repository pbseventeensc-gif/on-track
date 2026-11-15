/* Material master: shared Firebase online and isolated local sandbox. */
(function(root) {
    'use strict';
    const key = 'wtrack_pool_materials_v1';
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const arg = value => esc(JSON.stringify(String(value)));
    const correctKnownName = value => {
        const name=String(value || '').trim();
        if(/^FLEXY FRONTLITE 380 HALEAD MV$/i.test(name)) return 'FLEXY FRONTLITE 380 HALEAD MV TYPE 380';
        if(/^FLEXY FRONTLITE 380 HALEAD MV\s*\(2\)$/i.test(name)) return 'FLEXY FRONTLITE 380 HALEAD MV TYPE 383';
        return name;
    };
    const normalize = value => String(value || '').normalize('NFKC').toUpperCase()
        .replace(/\b(?:TYPE|TIPE)\s*(\d+)/g,'TYPE $1')
        .replace(/\b(?:ACRILYC|ACRILIC|AKRILIK)\b/g,'ACRYLIC').replace(/\bVYNIL\b/g,'VINYL')
        .replace(/\bGLOSY\b/g,'GLOSSY').replace(/\bSTIKER\b/g,'STICKER')
        .replace(/(\d)\s*MM\b/g,'$1 MM').replace(/[^A-Z0-9]+/g,' ').trim()
        .replace(/\bWHITE PAPER BOARD\b/g,'WPB')
        .replace(/\bSTICKER RITRAMA(?: ULTRA CLEAR WHITE INK)?\b/g,'STICKER VINYL RITRAMA');
    const canonicalName = value => normalize(String(value).replace(/\s*\(\d+\)\s*$/, ''));
    const positive = value => {
        const raw=String(value ?? '').trim().replace(',','.');
        const n=/^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : NaN;
        return Number.isFinite(n) && n>0 ? n : null;
    };
    const fmt = value => new Intl.NumberFormat('id-ID',{maximumFractionDigits:6}).format(value);
    let query = '';
    let statusFilter = 'all';
    let page = 1;
    const pageSize = 10;
    const icon = name => {
        const paths={edit:'<path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/>',power:'<path d="M12 2v10"/><path d="M5.6 5.6a9 9 0 1 0 12.8 0"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',plus:'<path d="M12 5v14M5 12h14"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',left:'<path d="m14 6-6 6 6 6"/>',right:'<path d="m10 6 6 6-6 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>'};
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||''}</svg>`;
    };
    const displayName = value => String(value).toLowerCase().replace(/\b[a-z][a-z0-9]*/g,word=>
        /^(pvc|mdf|wpb|hpl|mc|mv|uv|pet|[ab]\d+)$/.test(word)?word.toUpperCase():
        /^(mm|cm|kg|gsm|m2)$/.test(word)?word:word[0].toUpperCase()+word.slice(1));
    function read() {
        if(!root.WTRACK_LOCAL_SANDBOX) return root.MaterialCloud?.read() || [];
        const rows=JSON.parse(root.localStorage.getItem(key)||'[]');
        if(!Array.isArray(rows)) throw Error('Data master bahan tidak valid.');
        return rows;
    }
    function write(rows) {
        if(!root.WTRACK_LOCAL_SANDBOX) return root.MaterialCloud.write(rows);
        root.localStorage.setItem(key,JSON.stringify(rows));
    }
    function seed() {
        if(!root.WTRACK_LOCAL_SANDBOX) return;
        if(root.localStorage.getItem('wtrack_material_seed_v1')) {
            const rows=read(),corrected=rows.map(row=>({...row,name:correctKnownName(row.name)}));
            if(rows.some((row,index)=>row.name!==corrected[index].name)) write(corrected);
            return;
        }
        const result=merge(read(),root.WtrackMaterialSeed || []);
        write(result.rows);
        root.localStorage.setItem('wtrack_material_seed_v1','true');
    }
    function resolve(item, database) {
        const manual=item.poolLine?.materialId;
        const active=database.filter(row=>row.active!==false && row.type!=='finishing');
        if(manual) return {material:active.find(row=>row.id===manual)||null,source:'manual',candidates:[]};
        const text=' '+normalize(item.nama || item.name)+' ';
        if(/\bWPB\b/.test(text)) {
            const thickness=text.match(/\bWPB\s+(\d+)\s+MM\b/);
            const boards=active.filter(row=>/^WPB\b/.test(normalize(row.name)));
            const candidates=thickness?boards.filter(row=>normalize(row.name)==='WPB '+thickness[1]+' MM'):boards;
            return {material:candidates.length===1?candidates[0]:null,source:candidates.length===1?'auto':candidates.length>1?'ambiguous':'missing',candidates};
        }
        const typedVariants=active.filter(row=>/\s+TYPE\s+\d+$/i.test(row.name) &&
            text.includes(' '+normalize(row.name.replace(/\s+TYPE\s+\d+$/i,''))+' '));
        if(typedVariants.length>1 && !/\bTYPE \d+\b/.test(text)) return {material:null,source:'ambiguous',candidates:typedVariants};
        const matches=active.filter(row=>[row.name,...(row.aliases||[])].some(alias=> {
            const normalized=normalize(alias);
            return normalized && text.includes(' '+normalized+' ');
        }));
        if(!matches.length) {
            if(/\bSTICKER VINYL\b/.test(text) && !/\bA3\b/.test(text)) {
                const ritrama=active.filter(row=>normalize(row.name)==='STICKER VINYL RITRAMA');
                if(ritrama.length===1) return {material:ritrama[0],source:'auto',candidates:[]};
            }
            return {material:null,source:'missing',candidates:[]};
        }
        let candidates=matches.filter(row=>!matches.some(other=>other!==row &&
            (' '+normalize(other.name)+' ').includes(' '+normalize(row.name)+' ') && normalize(other.name)!==normalize(row.name)));
        if(candidates.length===1) {
            // Other legacy numbered variants still need an explicit choice.
            const sameFamily=active.filter(row=>canonicalName(row.name)===canonicalName(candidates[0].name));
            if(sameFamily.length>1 && !/\(\d+\)/.test(item.nama||item.name||'')) candidates=sameFamily;
        }
        return {material:candidates.length===1?candidates[0]:null,source:candidates.length===1?'auto':'ambiguous',candidates};
    }
    function resolveFinishing(item, database) {
        const manual=item.poolLine?.finishingMaterialId;
        const active=database.filter(row=>row.active!==false && row.type==='finishing');
        if(manual!==undefined && manual!=='auto') {
            if(!manual) return {material:null,source:'manual',required:false};
            return {material:active.find(row=>row.id===manual)||null,source:'manual',required:true};
        }
        const text=normalize((item.nama || item.name || '')+' '+(item.finishing || ''));
        if(/\b(?:NON|NO|TANPA)\s*(?:LAMINATING|LAMINASI|LAMINATION|LAMINATE|LAM)\b/.test(text)) return {material:null,source:'none',required:false};
        const doft=/\b(?:LAMINATING|LAMINASI|LAMINATION|LAMINATE|LAM)\s+(?:DOFF|DOFT)\b/.test(text);
        const glossy=/\b(?:LAMINATING|LAMINASI|LAMINATION|LAMINATE|LAM)\s+(?:GLOSSY|GLOSS|GLOS)\b/.test(text);
        if(!doft&&!glossy) return {material:null,source:'none',required:false};
        if(doft&&glossy) return {material:null,source:'ambiguous',required:true};
        const matches=active.filter(row=>[row.name,...(row.aliases||[])].some(name=>
            doft ? /\b(?:DOFT|DOFF)\b/.test(normalize(name)) : /\b(?:GLOSSY|GLOSS|GLOS)\b/.test(normalize(name))));
        return {material:matches.length===1?matches[0]:null,source:matches.length===1?'auto':matches.length>1?'ambiguous':'missing',required:true};
    }
    function resolveSticker(item, database) {
        const text=normalize(item.nama || item.name),manual=item.poolLine?.stickerMaterialId;
        const present=/\bWPB\b/.test(text) && /\bSTICKER VINYL\b/.test(text);
        const active=database.filter(row=>row.active!==false && row.type!=='finishing' && /^STICKER VINYL\b/.test(normalize(row.name)));
        if(manual!==undefined && manual!=='auto') return {material:manual?active.find(row=>row.id===manual)||null:null,source:'manual',required:!!manual,present:present||!!manual};
        if(!present) return {material:null,source:'none',required:false,present:false};
        const exact=active.filter(row=>(' '+text+' ').includes(' '+normalize(row.name)+' '));
        const candidates=exact.length?exact:active;
        return {material:candidates.length===1?candidates[0]:null,source:candidates.length===1?'auto':candidates.length>1?'ambiguous':'missing',required:true,present:true};
    }
    function merge(database, incoming) {
        const result=database.map(row=>({...row,name:correctKnownName(row.name)}));
        let added=0,updated=0;
        for(const original of incoming) {
            const entry={...original,name:correctKnownName(original.name)};
            const old=result.find(row=>normalize(row.name)===normalize(entry.name));
            if(old) {Object.assign(old,entry,{id:old.id,aliases:old.aliases||[],active:old.active!==false});updated++;}
            else {result.push({...entry});added++;}
        }
        return {rows:result,added,updated};
    }
    function parseWorkbook(workbook, XLSX) {
        const result=[],seen=new Set();
        for(const sheet of workbook.SheetNames) {
            const rows=XLSX.utils.sheet_to_json(workbook.Sheets[sheet],{header:1,defval:''});
            const headerIndex=rows.findIndex(row=>row.some(v=>/^material$/i.test(String(v).trim())) && row.some(v=>/kg/i.test(String(v))));
            if(headerIndex<0) continue;
            const header=rows[headerIndex].map(String);
            const nameIndex=header.findIndex(v=>/^material$/i.test(v.trim()));
            const rateIndex=header.findIndex(v=>/kg/i.test(v));
            const sampleIndex=header.findIndex(v=>/10\s*x\s*10/i.test(v));
            for(const row of rows.slice(headerIndex+1)) {
                const name=correctKnownName(row[nameIndex]);
                if(!name) continue;
                const rate=positive(row[rateIndex]);
                const sample=sampleIndex>=0?positive(row[sampleIndex]):null;
                if(!rate) throw Error('Berat KG/M2 tidak valid: '+name);
                if(sample && Math.abs(sample*0.1-rate)>1e-6) throw Error('Konversi sampel 10 × 10 cm tidak sesuai: '+name);
                if(seen.has(normalize(name))) throw Error('Nama material duplikat: '+name);
                seen.add(normalize(name));
                result.push({id:'MAT_'+normalize(name).replace(/ /g,'_'),name,kgPerM2:Math.round(rate*1e6)/1e6,
                    sampleGram:sample,type:/^LAMINASI\b/i.test(name)?'finishing':'material',active:true,aliases:[]});
            }
        }
        if(!result.length) throw Error('Kolom Material dan KG tidak ditemukan atau tabel kosong.');
        return result;
    }
    function refreshPool() { root.UnifiedPoolUI?.renderUnifiedPoolView(); }
    async function open() {
        if(!root.WTRACK_LOCAL_SANDBOX) { try { await root.MaterialCloud.ready(); } catch(error) {root.alert('Bahan belum dimuat: '+error.message);return;} }
        root.switchTab('material-master',root.document.getElementById('nav-material-master'));
        render();
    }
    function render() {
        const view=root.document.getElementById('view-material-master');
        if(!view) return;
        const database=read(), activeCount=database.filter(row=>row.active!==false).length;
        const filtered=database.filter(row=>normalize(row.name+' '+(row.aliases||[]).join(' ')).includes(normalize(query)) &&
            (statusFilter==='all' || (statusFilter==='active' ? row.active!==false : row.active===false)));
        const pages=Math.max(1,Math.ceil(filtered.length/pageSize));page=Math.min(page,pages);
        const visible=filtered.slice((page-1)*pageSize,page*pageSize);
        const tab=(value,label,count)=>`<button type="button" class="mm-tab ${statusFilter===value?'is-active':''}" onclick="MaterialMaster.filter('${value}')" aria-pressed="${statusFilter===value}">${label}<span>${count}</span></button>`;
        view.innerHTML=`<section class="material-master">
            <header class="mm-heading"><div><div class="mm-eyebrow">Master Data</div><h4>Bahan</h4><p>Kelola bahan dan berat per meter persegi untuk surat jalan.</p></div><div class="mm-heading-actions">
            <label class="mm-button">${icon('upload')}Import Excel<input type="file" class="d-none" accept=".xlsx,.xls" onchange="MaterialMaster.importFile(this)"></label>
            <button type="button" class="mm-button mm-button-primary" onclick="MaterialMaster.add()">${icon('plus')}Bahan</button></div></header>
            <div class="mm-card"><div class="mm-toolbar"><div class="mm-tabs" aria-label="Filter status bahan">${tab('all','Semua',database.length)}${tab('active','Aktif',activeCount)}${tab('inactive','Nonaktif',database.length-activeCount)}</div>
            <label class="mm-search">${icon('search')}<input id="material-search" aria-label="Cari bahan atau alias" placeholder="Cari bahan atau alias..." value="${esc(query)}" oninput="MaterialMaster.search(this.value)"></label></div>
            <div class="mm-table-scroll"><table class="mm-table"><colgroup><col><col style="width:120px"><col style="width:120px"><col style="width:140px"><col style="width:120px"><col style="width:100px"></colgroup><thead><tr><th>Nama Bahan</th><th class="mm-number">Sampel (g)</th><th class="mm-number">KG/M2</th><th>Jenis</th><th>Status</th><th class="mm-actions-heading">Aksi</th></tr></thead><tbody>${visible.map(row=>`<tr><td><div class="mm-name" title="${esc(row.name)}">${esc(displayName(row.name))}</div>${row.aliases?.length?`<div class="mm-alias" title="${esc(row.aliases.join(', '))}">${esc(row.aliases.join(', '))}</div>`:''}</td><td class="mm-number mm-muted">${row.sampleGram?fmt(row.sampleGram):'—'}</td><td class="mm-number mm-rate">${fmt(row.kgPerM2)}</td><td><span class="mm-kind">${row.type==='finishing'?'Laminasi':'Bahan Utama'}</span></td><td><span class="mm-status ${row.active===false?'is-inactive':''}"><span></span>${row.active===false?'Nonaktif':'Aktif'}</span></td><td><div class="mm-row-actions"><button type="button" class="mm-icon-button" title="Edit bahan" aria-label="Edit ${esc(row.name)}" onclick="MaterialMaster.edit(${arg(row.id)})">${icon('edit')}</button><button type="button" class="mm-icon-button ${row.active===false?'mm-enable':'mm-disable'}" title="${row.active===false?'Aktifkan':'Nonaktifkan'} bahan" aria-label="${row.active===false?'Aktifkan':'Nonaktifkan'} ${esc(row.name)}" onclick="MaterialMaster.toggleActive(${arg(row.id)})">${icon('power')}</button></div></td></tr>`).join('')||'<tr><td colspan="6" class="mm-empty">Tidak ada bahan yang sesuai.<small>Coba kata pencarian atau filter status lain.</small></td></tr>'}</tbody></table></div>
            <footer class="mm-footer"><span>Menampilkan ${filtered.length?(page-1)*pageSize+1:0}–${Math.min(page*pageSize,filtered.length)} dari ${filtered.length} bahan</span><div class="mm-pagination"><button type="button" class="mm-icon-button" aria-label="Halaman sebelumnya" ${page===1?'disabled':''} onclick="MaterialMaster.setPage(${page-1})">${icon('left')}</button><span>${page} / ${pages}</span><button type="button" class="mm-icon-button" aria-label="Halaman berikutnya" ${page===pages?'disabled':''} onclick="MaterialMaster.setPage(${page+1})">${icon('right')}</button></div></footer></div>
            <p class="mm-note">Satuan berat: KG/M2 · Sampel: 10 × 10 cm · ${root.WTRACK_LOCAL_SANDBOX?'Data tersimpan di browser lokal':'Data tersimpan di Firebase'}</p>
            <dialog id="material-editor" class="mm-editor" aria-labelledby="material-form-title" onclick="if(event.target===this)this.close()"><div class="mm-editor-heading"><h5 id="material-form-title">Bahan</h5><button type="button" class="mm-icon-button" aria-label="Tutup form bahan" onclick="document.getElementById('material-editor').close()">${icon('close')}</button></div><form onsubmit="event.preventDefault();MaterialMaster.save()"><input type="hidden" id="material-edit-id">
            <label class="form-label small w-100">Nama bahan<input id="material-name" class="form-control" autocomplete="off"></label>
            <label class="form-label small w-100">Berat KG/M2<input id="material-rate" class="form-control" inputmode="decimal" placeholder="Contoh 0,152"></label>
            <label class="form-label small w-100">Jenis<select id="material-type" class="form-select"><option value="material">Bahan utama</option><option value="finishing">Laminasi / tambahan</option></select></label>
            <label class="form-label small w-100">Alias nama di SJ<textarea id="material-aliases" class="form-control" placeholder="Satu alias per baris"></textarea></label>
            <small class="d-block text-muted mb-3">Alias harus merujuk bahan dan ketebalan yang sama. Nama yang belum jelas tetap dipilih manual pada SJ.</small>
            <div class="mm-editor-footer"><button type="button" class="mm-button" onclick="document.getElementById('material-editor').close()">Batal</button><button type="submit" class="mm-button mm-button-primary">Simpan</button></div></form></dialog>
        </section>`;
    }
    function search(value) {
        query=value;page=1;render();
        const input=root.document.getElementById('material-search');input.focus();input.setSelectionRange(value.length,value.length);
    }
    function filter(value) {statusFilter=value;page=1;render();}
    function setPage(value) {page=Math.max(1,value);render();}
    function add() {
        const form=root.document.querySelector('#material-editor form');form.reset();
        root.document.getElementById('material-edit-id').value='';
        root.document.getElementById('material-form-title').textContent='Bahan';
        root.document.getElementById('material-editor').showModal();
        root.document.getElementById('material-name').focus();
    }
    function edit(id) {
        const row=read().find(entry=>entry.id===id);if(!row) return;
        const set=(key,value)=>{root.document.getElementById(key).value=value;};
        set('material-edit-id',row.id);set('material-name',row.name);set('material-rate',row.kgPerM2);
        set('material-type',row.type||'material');set('material-aliases',(row.aliases||[]).join('\n'));
        root.document.getElementById('material-form-title').textContent='Edit Bahan';
        root.document.getElementById('material-editor').showModal();
        root.document.getElementById('material-name').focus();
    }
    async function save() {
        try {
            const value=id=>root.document.getElementById(id).value.trim();
            const id=value('material-edit-id'),name=correctKnownName(value('material-name')),kgPerM2=positive(value('material-rate'));
            if(!name||!kgPerM2) throw Error('Isi nama bahan dan KG/M2 yang positif.');
            const database=read(),old=database.find(row=>row.id===id);
            if(id&&!old) throw Error('Bahan tidak ditemukan. Muat ulang master.');
            if(database.some(row=>row.id!==id&&normalize(row.name)===normalize(name))) throw Error('Nama bahan sudah ada. Gunakan Edit.');
            const updated={...old,id:old?.id||root.crypto.randomUUID(),name,kgPerM2,type:value('material-type'),active:old?.active!==false,
                aliases:value('material-aliases').split('\n').map(v=>v.trim()).filter(Boolean),updatedAt:new Date().toISOString()};
            if(old) {database[database.indexOf(old)]=updated;if(kgPerM2!==old.kgPerM2) {delete updated.sampleGram;updated.source='Edit manual';}}
            else database.push(updated);
            await write(database);render();refreshPool();root.showToast?.('Master bahan tersimpan.');
        } catch(error) {root.alert('Bahan belum disimpan: '+error.message);}
    }
    async function toggleActive(id) {
        try {const database=read(),row=database.find(entry=>entry.id===id);if(!row)return;row.active=row.active===false;await write(database);render();refreshPool();}
        catch(error) {root.alert('Status belum disimpan: '+error.message);}
    }
    async function importFile(input) {
        try {
            const file=input.files?.[0];if(!file)return;
            const wb=root.XLSX.read(await file.arrayBuffer(),{type:'array'});
            const incoming=parseWorkbook(wb,root.XLSX).map(row=>({...row,source:file.name}));
            const result=merge(read(),incoming);await write(result.rows);render();refreshPool();
            root.showToast?.(`${result.added} bahan baru, ${result.updated} bahan diperbarui.`);
        } catch(error) {root.alert('Import master belum disimpan: '+error.message);}
        finally {input.value='';}
    }
    function init() {
        try {seed();} catch(error) {root.alert('Master bahan belum dimuat: '+error.message);}
        const anchor=root.document.getElementById('nav-settings');
        if(anchor&&!root.document.getElementById('nav-material-master')) {
            let group=root.document.querySelector('[data-group="master-data"]');
            if(!group) {
                group=root.document.createElement('div');group.className='sidebar-accordion-group open';group.dataset.group='master-data';
                group.innerHTML='<div class="sidebar-group-header" onclick="toggleSidebarGroup(\'master-data\')"><div class="d-flex align-items-center"><i class="bi bi-database group-icon"></i><span class="group-title">Master Data</span></div><i class="bi bi-chevron-down chevron-icon"></i></div><div class="sidebar-sub-items"></div>';
                anchor.parentElement.insertBefore(group,anchor);
            }
            const links=group.querySelector('.sidebar-sub-items');
            links.insertAdjacentHTML('beforeend','<a href="javascript:void(0)" class="sub-nav-item" id="nav-material-master" onclick="MaterialMaster.open()"><i class="bi bi-layers sub-icon"></i><span>Bahan</span></a>');
            if(!root.document.getElementById('nav-customers')) links.insertAdjacentHTML('beforeend','<a href="javascript:void(0)" class="sub-nav-item" id="nav-customers" onclick="switchTab(\'customers\', this)"><i class="bi bi-person-vcard sub-icon"></i><span>Database Customer</span></a>');
        }
        if(!root.document.getElementById('view-material-master')) {
            const view=root.document.createElement('div');view.id='view-material-master';view.className='view-section';
            const poolEl = root.document.getElementById('view-pool');
            if (poolEl && poolEl.parentElement) poolEl.parentElement.appendChild(view);
        }
        refreshPool();
    }
    const api={read,seed,resolve,resolveFinishing,resolveSticker,merge,parseWorkbook,open,render,search,filter,setPage,add,edit,save,toggleActive,importFile,normalize};
    root.MaterialMaster=api;
    root.document?.addEventListener('DOMContentLoaded',init);
    if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
