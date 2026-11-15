/* SJ Pool: persistent line selections and measured material weights. */
(function (root) {
    'use strict';
    const materialKey = 'wtrack_pool_materials_v1';
    const expanded = new Set();
    let saveQueue = Promise.resolve();
    const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const arg = value => html(JSON.stringify(String(value)));
    const displayName = value => {
        const text = String(value || 'Item').trim().toLocaleLowerCase('id-ID');
        return text.replace(/\p{L}[\p{L}\p{N}]*/gu, word => {
            if (/^(pt|cv|ud|pd|tb|rt|rw|dki|bsd|pik|pvc|mdf|wpb|hpl|acp|uv|[ab]\d+)$/i.test(word)) return word.toUpperCase();
            if (/^(cm|mm|m|kg|gsm|pcs|m2)$/.test(word)) return word;
            return word.charAt(0).toLocaleUpperCase('id-ID') + word.slice(1);
        });
    };
    const number = value => {
        const text = String(value ?? '').trim().replace(',', '.');
        if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
        const result = Number(text);
        return Number.isFinite(result) && result > 0 ? result : null;
    };
    const fmt = value => new Intl.NumberFormat('id-ID', {maximumFractionDigits:4}).format(value);
    const fmtWeight = value => {
        const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
        return new Intl.NumberFormat('id-ID', {minimumFractionDigits:2, maximumFractionDigits:2}).format(rounded);
    };
    const sjOf = trip => String(trip.noSJ || trip.sjNumber || '').trim();
    const itemsOf = trip => Array.isArray(trip.items) && trip.items.length ? trip.items : (trip.destinations?.[0]?.items || []);
    const materials = () => {
        if(!root.WTRACK_LOCAL_SANDBOX) return root.MaterialMaster?.read() || [];
        try { const value = JSON.parse(root.localStorage.getItem(materialKey) || '[]'); return Array.isArray(value) ? value : []; }
        catch { return []; }
    };
    function itemQuantity(item) {
        const raw = String(item.qty ?? '').trim();
        const match = raw.match(/^(\d+(?:[.,]\d+)?)(?:\s*(?:pcs?|lembar|buah|unit))?$/i);
        return match ? number(match[1]) : null;
    }
    function sourceDimensions(size) {
        const match = String(size || '').trim().match(/^(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?$/i);
        if (!match) return null;
        const scale = unit => ({m:1,cm:0.01,mm:0.001})[unit.toLowerCase()];
        const length = number(match[1]), width = number(match[3]);
        return length && width ? {lengthM:length * scale(match[2] || match[4] || 'm'),widthM:width * scale(match[4] || match[2] || 'm')} : null;
    }
    const isServiceItem = item => {
        const kind = item?.poolLine?.kind;
        if (kind === 'service') return true;
        if (kind === 'material') return false;
        return /\bjasa\b/i.test(String(item?.nama || item?.name || ''));
    };
    function calculate(item, database) {
        const plan = item.poolLine || {};
        if (isServiceItem(item)) return {areaM2:null, weightKg:0, reason:'Jasa / tanpa berat'};
        const size = sourceDimensions(item.ukuran), qty = itemQuantity(item);
        const areaM2 = size && qty ? size.lengthM * size.widthM * qty : null;
        const match = root.MaterialMaster ? root.MaterialMaster.resolve(item,database) : null;
        const material = match ? match.material : database.find(entry => entry.id === plan.materialId && entry.active !== false);
        const rate = material && number(material.kgPerM2);
        const finishingMatch = root.MaterialMaster?.resolveFinishing ? root.MaterialMaster.resolveFinishing(item,database) :
            {material:database.find(entry=>entry.id===plan.finishingMaterialId && entry.type==='finishing' && entry.active!==false),required:!!plan.finishingMaterialId};
        const finishing = finishingMatch.material;
        const finishingRate = finishingMatch.required ? number(finishing?.kgPerM2) : 0;
        const stickerMatch=root.MaterialMaster?.resolveSticker ? root.MaterialMaster.resolveSticker(item,database) : {material:null,required:false,present:false};
        const sticker=stickerMatch.material,stickerRate=stickerMatch.required?number(sticker?.kgPerM2):0;
        const duplicatedLayer=stickerMatch.required && sticker && material?.id===sticker.id;
        const weightKg = areaM2 && rate && finishingRate !== null && stickerRate!==null && !duplicatedLayer ? areaM2 * (rate + stickerRate + finishingRate) : null;
        return {areaM2, weightKg, material, matchSource:match?.source,finishing,finishingSource:finishingMatch.source,
            sticker,stickerSource:stickerMatch.source,hasStickerLayer:stickerMatch.present,
            reason:!areaM2 ? 'Size / qty tidak valid' : (!rate ? (match?.source==='ambiguous'?'Pilih varian bahan':'Pilih KG/M2') :
                duplicatedLayer?'Pilih bahan papan sebagai bahan utama':stickerMatch.required&&!stickerRate?'Pilih tipe Sticker Vynil':(finishingMatch.required && !finishingRate ? 'Pilih laminasi yang aktif / sesuai' : ''))};
    }
    function summary(trip, database) {
        const selected = itemsOf(trip).filter(item => item.poolLine?.selected !== false);
        let weightKg = 0, missing = 0;
        for (const item of selected) {
            const result = calculate(item, database);
            if (result.weightKg === null) missing++;
            else weightKg += result.weightKg;
        }
        return {selected:selected.length, total:itemsOf(trip).length, weightKg, missing};
    }
    function renderWeight(trip) {
        const result = summary(trip, materials());
        if (!result.selected) return '<span class="text-muted">Belum dipilih</span>';
        return `<span style="font-weight: 400 !important;">${result.missing === result.selected ? '—' : fmtWeight(result.weightKg) + ' kg'}</span>${result.missing ? `<small class="d-block text-muted">${result.missing} line belum dihitung</small>` : ''}`;
    }
    function rerender() {
        const checked = new Set(Array.from(root.document.querySelectorAll('.pool-checkbox:checked'), cb => cb.value));
        root.UnifiedPoolUI.renderUnifiedPoolView();
        root.document.querySelectorAll('.pool-checkbox').forEach(cb => { cb.checked = checked.has(cb.value); });
        root.UnifiedPoolUI.updateSelectionCount();
    }
    function toggle(sj) {
        if (expanded.has(sj)) {
            expanded.delete(sj);
        } else {
            expanded.clear();
            expanded.add(sj);
        }
        rerender();
    }
    function enqueue(action) {
        const operation = saveQueue.then(action);
        saveQueue = operation.catch(error => {
            root.alert('Perubahan belum tersimpan: ' + error.message);
            rerender();
        });
        return saveQueue;
    }
    async function updateLine(sj, index, field, value) {
        return enqueue(async () => {
            const allowed = ['selected','materialId','stickerMaterialId','finishingMaterialId','kind'];
            if (!allowed.includes(field)) throw new Error('Kolom line tidak dikenal.');
            if(!root.WTRACK_LOCAL_SANDBOX) {
                const source=(root.allPoolTrips||[]).find(entry=>sjOf(entry)===sj);
                if(!source)throw Error('SJ tidak ditemukan. Muat ulang pool.');
                const activeDb=root.getDb(),reference=activeDb.collection('trips').doc(source.tripId||source.id);
                const updated=await activeDb.runTransaction(async tx=>{
                    const snap=await tx.get(reference);if(!snap.exists)throw Error('SJ sudah dihapus.');
                    const trip={...snap.data(),id:snap.id};
                    if(trip.courierId||['completed','done','delivered'].includes(trip.status))throw Error('SJ sudah ditugaskan atau selesai. Muat ulang pool.');
                    const items=JSON.parse(JSON.stringify(itemsOf(trip)));
                    if(!Number.isInteger(index)||!items[index])throw Error('Line tidak ditemukan.');
                    items[index]={...items[index],poolLine:{...items[index].poolLine,[field]:value}};
                    const patch={items};
                    if(trip.destinations?.length===1)patch.destinations=[{...trip.destinations[0],items}];
                    tx.update(reference,patch);
                    const next={...trip,...patch};
                    if(next.sourceFile||String(next.batchId||'').startsWith('BATCH_SJ_')) {
                        const archive=root.MaterialCloud.usageRecord(next);
                        tx.set(activeDb.collection('material_usage_sources').doc(root.MaterialCloud.sourceId(sj)),archive);
                    }
                    return next;
                });
                root.MaterialCloud.acceptUsage([root.MaterialCloud.usageRecord(updated)]);
                for(const key of ['allPoolTrips','allCurrentTrips'])if(Array.isArray(root[key]))root[key]=root[key].map(trip=>(trip.tripId||trip.id)===(updated.tripId||updated.id)?{...trip,...updated}:trip);
                rerender();return;
            }
            const trips = JSON.parse(root.localStorage.getItem('wtrack_local_trips') || '[]');
            const trip = trips.find(entry => sjOf(entry) === sj && !entry.courierId && !['completed','done','delivered'].includes(entry.status));
            if (!trip) throw new Error('SJ sudah ditugaskan atau tidak ditemukan. Muat ulang pool.');
            const items = itemsOf(trip);
            if (!Number.isInteger(index) || !items[index]) throw new Error('Line tidak ditemukan.');
            const plan = {...items[index].poolLine, [field]:value};
            items[index] = {...items[index], poolLine:plan};
            trip.items = items;
            // The note must also survive assignment and appear in backups / destination data.
            if (trip.destinations?.length === 1) trip.destinations[0].items = items;
            if (root.persistLocalSandboxTrips) await root.persistLocalSandboxTrips(trips);
            else root.localStorage.setItem('wtrack_local_trips', JSON.stringify(trips));
            root.MaterialUsage?.capture([trip]);
            for (const key of ['allPoolTrips','allCurrentTrips']) {
                if (Array.isArray(root[key])) root[key] = root[key].map(old => old.id === trip.id ? trip : old);
            }
            if (root.mockDatabase?.suratJalanList) root.mockDatabase.suratJalanList = root.mockDatabase.suratJalanList.map(old => old.id === trip.id ? trip : old);
            rerender();
        });
    }
    function saveMaterial(sj) {
        if (!root.WTRACK_LOCAL_SANDBOX) return;
        return enqueue(async () => {
            const suffix = encodeURIComponent(sj);
            const name = root.document.getElementById('pool-material-name-' + suffix).value.trim();
            const kgPerM2 = number(root.document.getElementById('pool-material-rate-' + suffix).value);
            if (!name || !kgPerM2) throw new Error('Isi nama material dan berat positif dalam kg/m².');
            const database = materials();
            const existing = database.find(entry => entry.name.toLowerCase() === name.toLowerCase());
            if (existing) existing.kgPerM2 = kgPerM2;
            else database.push({id:root.crypto?.randomUUID?.() || ('MAT_' + Date.now() + '_' + Math.random().toString(36).slice(2)),name,kgPerM2});
            root.localStorage.setItem(materialKey, JSON.stringify(database));
            rerender();
            root.showToast?.('Berat material tersimpan. Material dengan nama sama akan diperbarui.');
        });
    }
    function formatItemDescriptionHtml(name) {
        const full = displayName(name);
        const idx = full.indexOf('_');
        if (idx !== -1) {
            const p1 = full.slice(0, idx).trim();
            const p2 = full.slice(idx).trim();
            return `<span class="item-main d-block">${html(p1)}</span><span class="item-sub text-muted d-block" style="font-size:10.5px;font-weight:400;color:#667085;line-height:1.2;">${html(p2)}</span>`;
        }
        return `<span>${html(full)}</span>`;
    }
    function renderDetail(trip) {
        const sj = sjOf(trip);
        if (!expanded.has(sj)) return '';
        const items = itemsOf(trip), database = materials(), totals = summary(trip,database);
        const suffix = html(encodeURIComponent(sj));
        const rows = items.map((item,index) => {
            const plan = item.poolLine || {};
            const serviceItem = isServiceItem(item);
            const result = calculate(item,database);
            const field = (key, control) => `onchange="PoolLineItems.updateLine(${arg(sj)},${index},${arg(key)},${control})"`;
            return `<tr>
                <td data-label="No" class="text-center text-muted" style="font-size:11.5px;">${html(item.no || index+1)}</td>
                <td data-label="Item Description" class="pool-line-name" style="white-space:normal;max-width:240px;line-height:1.25;"><div class="pool-line-title" style="white-space:normal;line-height:1.25;" title="${html(displayName(item.nama || item.name))}">${formatItemDescriptionHtml(item.nama || item.name)}</div></td>
                <td data-label="Size" class="text-muted" style="font-size:11.5px;">${html((item.ukuran || '—').replace(/\s*x\s*/gi, ' × '))}</td><td data-label="Qty" class="text-center" style="font-size:11.5px;">${html(item.qty ?? '—')}</td>
                <td data-label="Jenis"><div class="pool-line-control"><select class="form-select form-select-sm pool-compact-select" style="width:100%;min-width:0" aria-label="Jenis line ${index+1}" ${field('kind','this.value')}><option value="material" ${!serviceItem ? 'selected' : ''}>Material</option><option value="service" ${serviceItem ? 'selected' : ''}>Jasa</option></select></div></td>
                <td data-label="M2" class="pool-line-number text-muted" style="font-size:11.5px;">${result.areaM2 === null ? '—' : fmt(result.areaM2)}</td>
                <td data-label="KG/M2"><div class="pool-line-controls"><div class="pool-line-control"><select class="form-select form-select-sm pool-compact-select" style="width:100%;min-width:0" aria-label="Material line ${index+1}" ${field('materialId','this.value')} title="${result.matchSource==='auto' ? `${html(displayName(result.material.name))} · ${fmt(result.material.kgPerM2)} kg/m²` : 'Pilih bahan'}"><option value="">${result.matchSource==='auto' ? `${html(displayName(result.material.name))} · ${fmt(result.material.kgPerM2)} kg/m²` : 'Pilih bahan / varian'}</option>${database.filter(material=>material.active!==false && material.type!=='finishing').map(material => `<option value="${html(material.id)}" ${material.id === plan.materialId ? 'selected' : ''}>${html(displayName(material.name))} · ${fmt(material.kgPerM2)} kg/m²</option>`).join('')}</select></div>
                ${root.MaterialMaster && result.hasStickerLayer ? `<div class="pool-line-control"><select class="form-select form-select-sm pool-compact-select" style="width:100%;min-width:0" aria-label="Sticker line ${index+1}" ${field('stickerMaterialId','this.value')} title="Sticker"><option value="auto" ${plan.stickerMaterialId===undefined||plan.stickerMaterialId==='auto'?'selected':''}>${result.stickerSource==='auto'?`+ ${html(displayName(result.sticker.name))} · ${fmt(result.sticker.kgPerM2)} kg/m²`:'Pilih Sticker Vynil'}</option><option value="" ${plan.stickerMaterialId===''?'selected':''}>Tanpa tambahan stiker</option>${database.filter(entry=>entry.active!==false&&entry.type!=='finishing'&&/\b(?:VYNIL|VINYL)\b/i.test(entry.name)).map(entry=>`<option value="${html(entry.id)}" ${entry.id===plan.stickerMaterialId?'selected':''}>+ ${html(displayName(entry.name))} · ${fmt(entry.kgPerM2)} kg/m²</option>`).join('')}</select></div>`:''}
                ${root.MaterialMaster ? `<div class="pool-line-control"><select class="form-select form-select-sm pool-compact-select" style="width:100%;min-width:0" aria-label="Tambahan line ${index+1}" ${field('finishingMaterialId','this.value')} title="Finishing"><option value="auto" ${plan.finishingMaterialId===undefined||plan.finishingMaterialId==='auto'?'selected':''}>${result.finishingSource==='auto' ? `+ ${html(displayName(result.finishing.name))} · ${fmt(result.finishing.kgPerM2)} kg/m²` : 'Sesuai nama barang'}</option><option value="" ${plan.finishingMaterialId===''?'selected':''}>Tanpa tambahan laminasi</option>${database.filter(material=>material.active!==false && material.type==='finishing').map(material=>`<option value="${html(material.id)}" ${material.id===plan.finishingMaterialId?'selected':''}>+ ${html(displayName(material.name))} · ${fmt(material.kgPerM2)} kg/m²</option>`).join('')}</select></div>` : ''}
                ${result.weightKg===null && !serviceItem && result.reason ? `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle flex-shrink-0" style="font-size:10px;padding:2px 5px;" title="${html(result.reason)}">${html(result.reason)}</span>` : ''}</div></td>
                <td data-label="Total Berat KG" class="pool-line-number fw-semibold" style="font-size:12px;">${result.weightKg===null?'—':fmtWeight(result.weightKg)}</td>
            </tr>`;
        }).join('');
        return `<tr><td colspan="11" class="p-2.5 pool-line-detail" style="background:#F8F9FA;white-space:normal">
            <div class="d-flex justify-content-between align-items-center gap-2 mb-2 px-1">
                <div class="d-flex align-items-center gap-2">
                    <span class="d-inline-block bg-primary rounded-pill me-1" style="width:3px;height:13px;vertical-align:middle;"></span>
                    <span class="fw-semibold text-dark" style="font-size:12.5px;">Item · <span class="font-monospace text-primary">${html(sj)}</span></span>
                    <span class="badge bg-white text-dark border" style="font-size:10.5px;font-weight:500;border-color:#D0D5DD !important;">${totals.selected} / ${totals.total} line dipilih</span>
                </div>
                <button type="button" class="btn btn-link btn-sm p-0 text-muted text-decoration-none" onclick="PoolLineItems.toggle(${arg(sj)})" style="font-size:13px;" title="Tutup detail" aria-label="Tutup detail"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="pool-lines-wrap">
                <table class="table align-middle mb-0 pool-lines-table">
                    <colgroup>
                        <col style="width:36px">
                        <col style="width:28%">
                        <col style="width:90px">
                        <col style="width:45px">
                        <col style="width:115px">
                        <col style="width:55px">
                        <col style="width:35%">
                        <col style="width:85px">
                    </colgroup>
                    <thead>
                        <tr>
                            <th class="text-center" style="width:38px;">No</th>
                            <th>Item Description</th>
                            <th>Size</th>
                            <th class="text-center">Qty</th>
                            <th>Jenis</th>
                            <th>M2</th>
                            <th>KG/M2</th>
                            <th class="pool-line-number">Berat (KG)</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="8" class="text-muted text-center py-3">Tidak ada line yang ditampilkan.</td></tr>'}</tbody>
                    <tfoot>
                        <tr>
                            <td colspan="7" class="text-end fw-semibold text-dark" style="font-size:12px;padding:10px 12px !important;">Total Berat (KG) · Line Dipilih${totals.missing?`<small class="d-block text-muted fw-normal" style="font-size:10.5px;">${totals.missing} line belum dihitung</small>`:''}</td>
                            <td class="pool-line-number fw-bold text-dark" style="font-size:13px;padding:10px 12px !important;">${totals.selected && totals.missing!==totals.selected?fmtWeight(totals.weightKg):'—'}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </td></tr>`;
    }
    const api = {toggle,updateLine,saveMaterial,renderDetail,renderWeight,calculate,summary,itemsOf,formatName:displayName,
        isServiceItem,isExpanded:sj => expanded.has(sj), argument:arg};
    root.PoolLineItems = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
