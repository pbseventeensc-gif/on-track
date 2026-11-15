/* Customer master: Firebase is authoritative online; sandbox storage stays isolated. */
(function(root) {
    'use strict';
    const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const arg = value => esc(JSON.stringify(String(value)));
    const keyOf = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
    let adminLookup=new Map();
    let rows=[],query='',filter='all',page=1,busy=false,message='',unsubscribe=null;
    const selected=new Set();
    let bulkTargets=[];
    let hasData=false,fromCache=false,fetchInFlight=null,watchReady=null;
    let sessionOwner=null,sessionEpoch=0,syncMessage='';
    let indexedRows=[],rowsSignature='';
    let registeredAdmins=[],adminsLoaded=false,adminRequest=null,adminSaving=false,adminRevision=0;
    const collator=new Intl.Collator('id',{numeric:true,sensitivity:'base'});
    const cacheKey=uid=>'wtrack_customer_display_v1:'+uid;
    const cacheAge=7*24*60*60*1000;
    const currentOwner=()=>root.getAuth?.()?.currentUser?.uid||'';
    function prepareSession(owner=currentOwner()) {
        if(local())return sessionEpoch;
        if(sessionOwner!==owner) {
            sessionEpoch++;unsubscribe?.();unsubscribe=null;watchReady=null;fetchInFlight=null;
            sessionOwner=owner;rows=[];indexedRows=[];rowsSignature='';adminLookup=new Map();selected.clear();hasData=false;fromCache=false;syncMessage='';
            registeredAdmins=[];adminsLoaded=false;adminRequest=null;adminRevision=0;
            root.setCustomerMasterCache?.(null);
        }
        if(!hasData&&owner) {
            try {
                const cached=JSON.parse(root.localStorage?.getItem(cacheKey(owner))||'null');
                if(cached&&Number.isFinite(cached.savedAt)&&Date.now()-cached.savedAt<cacheAge&&
                    Array.isArray(cached.rows)&&cached.rows.every(row=>row&&typeof row.id==='string'&&typeof row.name==='string')) {
                    registeredAdmins=Array.isArray(cached.admins)?cached.admins.filter(name=>typeof name==='string'):[];
                    publish(cached.rows,{cached:true});syncMessage='Data tersimpan ditampilkan. Menyinkronkan perubahan...';
                }
            } catch { /* The display cache is optional; Firebase remains authoritative. */ }
        }
        return sessionEpoch;
    }
    function cacheRows() {
        if(local()||!sessionOwner||!hasData)return;
        try {
            const fields=['id','name','adminSJ','address','region','latitude','longitude','createdAt','updatedAt'];
            const compact=rows.map(row=>Object.fromEntries(fields.filter(key=>row[key]!==undefined).map(key=>[key,row[key]])));
            root.localStorage?.setItem(cacheKey(sessionOwner),JSON.stringify({savedAt:Date.now(),rows:compact,admins:registeredAdmins}));
        } catch { /* Quota/privacy restrictions must not block loading or saving. */ }
    }
    function canRender() {
        return !root.document?.getElementById('customer-editor')?.open&&!root.document?.getElementById('customer-bulk-editor')?.open&&!root.document?.getElementById('customer-admin-manager')?.open;
    }
    const size=15;
    const local=()=>!!root.WTRACK_LOCAL_SANDBOX;
    const db=()=>{const value=root.getDb?.();if(!value)throw Error('Firebase belum terhubung.');return value;};
    function publish(values,{cached=false}={}) {
        const signature=JSON.stringify(values);
        if(hasData&&signature===rowsSignature) {
            const wasCached=fromCache;fromCache=cached;
            if(!cached&&wasCached)cacheRows();
            return;
        }
        rowsSignature=signature;
        rows=values;hasData=true;fromCache=cached;
        indexedRows=[...rows].sort((a,b)=>collator.compare(String(a.name||''),String(b.name||''))).map(row=>({row,text:`${row.name||''} ${row.adminSJ||''} ${row.address||''} ${row.region||''}`.toLowerCase()}));
        if(!root.document?.getElementById('customer-bulk-editor')?.open) {
            const ids=new Set(filteredRows().map(row=>row.id));
            for(const id of selected)if(!ids.has(id))selected.delete(id);
        }
        adminLookup=new Map([...bestByName(rows)].map(([key,row])=>[key,String(row.adminSJ||'').trim()]));
        root.setCustomerMasterCache?.(rows);
        root.renderRecentShipments?.();
        if(!cached)cacheRows();
    }
    async function fetchRows() {
        const epoch=prepareSession();
        if(fetchInFlight)return fetchInFlight;
        const pending=(async()=>{
            if(local()) {
                const values=JSON.parse(root.localStorage.getItem('wtrack_local_clients')||'[]');
                if(!Array.isArray(values))throw Error('Database customer lokal tidak valid.');
                publish(values);
            } else {
                const snap=await db().collection('clients').get({source:'server'});
                if(epoch!==sessionEpoch)throw Error('Sesi akun berubah. Muat ulang data customer.');
                publish(snap.docs.map(doc=>({...doc.data(),id:doc.id})));syncMessage='';
            }
            return rows;
        })();
        fetchInFlight=pending;
        try {return await pending;} finally {if(fetchInFlight===pending)fetchInFlight=null;}
    }
    function watchRows() {
        const epoch=prepareSession();
        if(watchReady)return watchReady;
        const first=new Promise((resolve,reject)=>{
            try {
                unsubscribe=db().collection('clients').onSnapshot({includeMetadataChanges:true},snapshot=>{
                    if(epoch!==sessionEpoch||snapshot.metadata?.hasPendingWrites)return;
                    const cached=!!snapshot.metadata?.fromCache;
                    // An empty SDK cache is not proof that Firebase has no customers.
                    if(cached&&!snapshot.docs.length)return;
                    publish(snapshot.docs.map(doc=>({...doc.data(),id:doc.id})),{cached});
                    syncMessage=cached?'Data tersimpan ditampilkan. Menyinkronkan perubahan...':'';
                    if(canRender())render();resolve(rows);
                },error=>{
                    if(epoch!==sessionEpoch)return;
                    unsubscribe=null;watchReady=null;
                    syncMessage=hasData?'Pembaruan customer gagal. Data sebelumnya tetap ditampilkan: '+error.message:'Database belum dimuat: '+error.message;
                    if(canRender())render();reject(error);
                });
            } catch(error){reject(error);}
        });
        watchReady=first;
        first.catch(()=>{if(epoch===sessionEpoch)watchReady=null;});
        return first;
    }
    function parseRows(values) {
        const result=new Map();let duplicateRows=0;
        for(const row of values) {
            const fields=new Map(Object.entries(row).map(([k,v])=>[keyOf(k),String(v??'').trim()]));
            const get=aliases=>aliases.map(key=>fields.get(keyOf(key))).find(Boolean)||'';
            const name=get(['Nama customer','Customer','Customer Name','Name','Nama']);
            if(!name)continue;
            const key=keyOf(name);if(!key)throw Error('Nama customer tidak dapat dikenali: '+name);
            if(key.length>1200)throw Error('Nama customer terlalu panjang: '+name.slice(0,60));
            if(result.has(key))duplicateRows++;
            const previous=result.get(key)||{};
            result.set(key,{...previous,name,
                adminSJ:get(['Admin SJ','Admin Surat Jalan','Admin'])||previous.adminSJ||'',
                address:get(['Alamat SJ','Alamat Kirim','Alamat','Address'])||previous.address||'',
                region:get(['Region','Wilayah','Area'])||previous.region||''});
        }
        if(!result.size)throw Error('Kolom Nama customer tidak ditemukan atau file kosong.');
        return {records:[...result.values()],duplicateRows};
    }
    function changed(existing,incoming) {
        return ['name','adminSJ','address','region'].some(field=>
            (incoming[field]!==''&&incoming[field]!==undefined) && String(existing[field]||'')!==incoming[field]);
    }
    function bestByName(existing) {
        const byName=new Map();
        const time=row=>{const value=row.updatedAt||row.createdAt;return value?.toMillis?.() || (value?.seconds?value.seconds*1000:Date.parse(value||'')||0);};
        // Prefer the record containing an Admin SJ when legacy address records are duplicated.
        for(const row of existing) {
            const key=keyOf(row.name),old=byName.get(key);
            if(!old||time(row)>time(old)||(time(row)===time(old)&&!old.adminSJ&&row.adminSJ))byName.set(key,row);
        }
        return byName;
    }
    function planImport(existing,incoming) {
        const byName=bestByName(existing);
        return incoming.map(record=>{
            const old=byName.get(keyOf(record.name));
            return {record,old,id:old?.id||'CLIENT_'+keyOf(record.name),kind:!old?'added':changed(old,record)?'updated':'skipped'};
        });
    }
    async function upsert(records) {
        const existing=await fetchRows(),plans=planImport(existing,records),counts={added:0,updated:0,skipped:0};
        if(local()) {
            const merged=new Map(existing.map(row=>[row.id,row]));
            for(const plan of plans) {
                counts[plan.kind]++;
                if(plan.kind==='skipped')continue;
                const patch=Object.fromEntries(Object.entries(plan.record).filter(([,value])=>value!==''));
                merged.set(plan.id,{...plan.old,...patch,id:plan.id,updatedAt:new Date().toISOString()});
            }
            root.localStorage.setItem('wtrack_local_clients',JSON.stringify([...merged.values()]));
            publish([...merged.values()]);return counts;
        }
        // Re-read even unchanged rows transactionally: another PC may have updated them.
        for(let start=0;start<plans.length;start+=150) {
            const group=plans.slice(start,start+150),activeDb=db();
            const part=await activeDb.runTransaction(async tx=>{
                const refs=group.map(plan=>activeDb.collection('clients').doc(plan.id));
                const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
                const total={added:0,updated:0,skipped:0};
                group.forEach((plan,index)=>{
                    const snap=snaps[index],old=snap.exists?snap.data():null;
                    const kind=!old?'added':changed(old,plan.record)?'updated':'skipped';total[kind]++;
                    if(kind==='skipped')return;
                    const patch=Object.fromEntries(Object.entries(plan.record).filter(([,value])=>value!==''));
                    tx.set(refs[index],{...patch,updatedAt:new Date().toISOString(),...(!old?{createdAt:new Date().toISOString()}: {})},{merge:true});
                });return total;
            });
            for(const key of Object.keys(counts))counts[key]+=part[key];
            message=`Menyimpan customer: ${Math.min(start+150,plans.length)} / ${plans.length}`;
            render();
        }
        await fetchRows();return counts;
    }
    async function importFile(input) {
        const file=input?.files?.[0];if(!file||busy)return;
        busy=true;message='Membaca Excel...';render();
        try {
            if(!root.XLSX)throw Error('Pustaka Excel belum siap. Muat ulang halaman.');
            const wb=root.XLSX.read(await file.arrayBuffer(),{type:'array'});
            const parsed=parseRows(root.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''}));
            const counts=await upsert(parsed.records);
            message=`${counts.added} baru · ${counts.updated} diperbarui · ${counts.skipped} tidak berubah.`+
                (parsed.duplicateRows?` ${parsed.duplicateRows} baris berulang digabung; Admin SJ terakhir digunakan.`:'');
            root.showToast?.(message);
        } catch(error) {message='Import belum selesai: '+error.message;root.alert(message);}
        finally {busy=false;if(input)input.value='';render();}
    }
    async function load(force=false) {
        if(busy){render();return;}
        prepareSession();
        if(local()) {
            try {await fetchRows();message='';} catch(error){message='Database belum dimuat: '+error.message;}
            render();return;
        }
        // Reopening a menu paints memory/disk data immediately. The existing
        // listener continues receiving changes without another full server GET.
        if(hasData&&!force) {
            render();watchRows().catch(()=>{});return;
        }
        syncMessage=hasData?'Memperbarui data customer...':'Memuat database customer...';render();
        try {
            if(force){await fetchRows();watchRows().catch(()=>{});}
            else await watchRows();
            syncMessage=fromCache?'Data tersimpan ditampilkan. Menyinkronkan perubahan...':'';
        } catch(error) {
            syncMessage=hasData?'Pembaruan customer gagal. Data sebelumnya tetap ditampilkan: '+error.message:'Database belum dimuat: '+error.message;
        } finally {if(canRender())render();}
    }
    async function getLookup() {
        const values=await fetchRows(),lookup=new Map();
        bestByName(values).forEach((row,key)=>{if(row.adminSJ)lookup.set(key,String(row.adminSJ).trim());});return lookup;
    }
    function filteredRows() {
        const q=query.toLowerCase();
        return indexedRows.filter(({row,text})=>(filter==='all'||(filter==='assigned'?!!row.adminSJ:!row.adminSJ))&&text.includes(q)).map(({row})=>row);
    }
    function selectAll(checked) {
        if(busy)return;
        selected.clear();
        if(checked)filteredRows().forEach(row=>selected.add(row.id));
        render();
    }
    function selectRow(id,checked) {
        if(busy)return;
        if(checked&&filteredRows().some(row=>row.id===id))selected.add(id);
        else selected.delete(id);
        render();
    }
    const adminName=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ');
    function knownAdminNames() {
        const names=new Map();
        [...registeredAdmins,...rows.map(row=>row.adminSJ)].forEach(value=>{
            const name=adminName(value);if(name&&!names.has(name.toLocaleLowerCase('id')))names.set(name.toLocaleLowerCase('id'),name);
        });
        return [...names.values()].sort(collator.compare);
    }
    async function loadAdminNames(force=false) {
        const epoch=prepareSession();
        if(local()) {
            const stored=JSON.parse(root.localStorage.getItem('wtrack_local_sj_admins_v1')||'[]');
            if(!Array.isArray(stored)||stored.some(value=>typeof value!=='string'))throw Error('Daftar Admin SJ lokal tidak valid.');
            registeredAdmins=stored;adminsLoaded=true;return knownAdminNames();
        }
        if(adminRequest)return adminRequest;
        if(adminsLoaded&&!force)return knownAdminNames();
        const revision=adminRevision;
        const pending=(async()=>{
            const snapshot=await db().collection('sj_admins').get({source:'server'});
            if(epoch!==sessionEpoch)throw Error('Sesi akun berubah. Buka kembali daftar Admin SJ.');
            const fetched=snapshot.docs.map(doc=>adminName(doc.data().name)).filter(Boolean);
            registeredAdmins=revision===adminRevision?fetched:[...new Map([...fetched,...registeredAdmins].map(name=>[name.toLocaleLowerCase('id'),name])).values()];
            adminsLoaded=true;cacheRows();return knownAdminNames();
        })();
        adminRequest=pending;
        try{return await pending;}finally{if(adminRequest===pending)adminRequest=null;}
    }
    async function saveAdminName(value) {
        const name=adminName(value),id=encodeURIComponent(name.toLocaleUpperCase('id'));
        if(!name||name.length>200||id.length>1400)throw Error('Isi nama Admin SJ (maksimal 200 karakter).');
        const epoch=prepareSession();let result;
        if(local()) {
            await loadAdminNames();
            const existing=registeredAdmins.find(value=>value.toLocaleLowerCase('id')===name.toLocaleLowerCase('id'));
            result={name:existing||name,added:!existing};
            const next=existing?registeredAdmins:[...registeredAdmins,name];
            root.localStorage.setItem('wtrack_local_sj_admins_v1',JSON.stringify(next));registeredAdmins=next;
        } else {
            const activeDb=db(),reference=activeDb.collection('sj_admins').doc(id);
            result=await activeDb.runTransaction(async tx=>{
                const snap=await tx.get(reference);
                if(epoch!==sessionEpoch)throw Error('Sesi akun berubah. Admin SJ belum disimpan.');
                if(snap.exists)return {name:adminName(snap.data().name)||name,added:false};
                tx.set(reference,{name,createdAt:new Date().toISOString()});return {name,added:true};
            });
            if(epoch!==sessionEpoch)throw Error('Sesi akun berubah. Muat ulang daftar Admin SJ.');
            if(!registeredAdmins.some(value=>value.toLocaleLowerCase('id')===result.name.toLocaleLowerCase('id')))registeredAdmins.push(result.name);
            cacheRows();
        }
        adminRevision++;return result;
    }
    function renderAdminManager() {
        filterAdminOptions(root.document.getElementById('customer-directory-search').value,'directory');
    }
    async function openAdminManager() {
        if(busy)return;
        const dialog=root.document.getElementById('customer-admin-manager');
        root.document.getElementById('customer-admin-new-name').value='';
        root.document.getElementById('customer-directory-label').textContent='Pilih admin';
        root.document.getElementById('customer-directory-search').value='';
        setAdminPicker(false,'directory');
        root.document.getElementById('customer-admin-manager-status').textContent='Memuat daftar admin...';
        renderAdminManager();dialog.showModal();root.document.getElementById('customer-directory-trigger').focus();
        dialog.oncancel=event=>{if(adminSaving)event.preventDefault();};
        try {await loadAdminNames(true);root.document.getElementById('customer-admin-manager-status').textContent='';renderAdminManager();}
        catch(error){root.document.getElementById('customer-admin-manager-status').textContent='Daftar belum diperbarui: '+error.message;}
    }
    async function addAdmin() {
        if(adminSaving)return;
        const input=root.document.getElementById('customer-admin-new-name'),status=root.document.getElementById('customer-admin-manager-status');
        const button=root.document.getElementById('customer-admin-add');adminSaving=true;button.disabled=true;
        try {
            const result=await saveAdminName(input.value);
            status.textContent=result.added?'Admin SJ tersimpan dan dapat dipilih pada customer.':'Nama Admin SJ sudah tersedia.';
            input.value=result.name;root.document.getElementById('customer-directory-label').textContent=result.name;
            root.document.getElementById('customer-directory-search').value='';
            renderAdminManager();setAdminPicker(false,'directory');root.document.getElementById('customer-directory-trigger').focus();
        } catch(error){status.textContent='Admin SJ belum disimpan: '+error.message;}
        finally{adminSaving=false;button.disabled=false;}
    }
    function openRowAdmin(id) {
        if(busy)return;
        const row=rows.find(row=>row.id===id);if(!row)return;
        selected.clear();selected.add(id);render();openBulk();
        if(row.adminSJ)chooseAdmin(row.adminSJ);
    }
    function openBulk() {
        if(busy||!selected.size)return;
        bulkTargets=rows.filter(row=>selected.has(row.id)).map(row=>({...row}));
        const dialog=root.document.getElementById('customer-bulk-editor');
        root.document.getElementById('customer-bulk-count').textContent=bulkTargets.length;
        root.document.getElementById('customer-bulk-admin').value='';
        root.document.getElementById('customer-bulk-error').textContent='';
        root.document.getElementById('customer-bulk-title').textContent=bulkTargets.length===1?'Admin SJ Customer':'Isi Admin SJ sekaligus';
        const targetName=root.document.getElementById('customer-bulk-target-name');
        targetName.textContent=bulkTargets.length===1?bulkTargets[0].name:'';targetName.hidden=bulkTargets.length!==1;
        root.document.getElementById('customer-admin-label').textContent='Pilih admin';
        root.document.getElementById('customer-admin-search').value='';
        setAdminPicker(false);
        filterAdminOptions('');
        dialog.oncancel=event=>{if(busy)event.preventDefault();};
        dialog.showModal();root.document.getElementById('customer-admin-trigger').focus();
        loadAdminNames(true).then(()=>{if(dialog.open)filterAdminOptions(root.document.getElementById('customer-admin-search').value);})
            .catch(()=>{}); // Existing customer admins remain usable during a connection failure.
    }
    const adminPickers={
        bulk:{value:'customer-bulk-admin',trigger:'customer-admin-trigger',label:'customer-admin-label',panel:'customer-admin-panel',search:'customer-admin-search',options:'customer-admin-options'},
        directory:{value:'customer-admin-new-name',trigger:'customer-directory-trigger',label:'customer-directory-label',panel:'customer-directory-panel',search:'customer-directory-search',options:'customer-directory-options'}
    };
    function setAdminPicker(open,scope='bulk') {
        const fields=adminPickers[scope];
        root.document.getElementById(fields.panel).hidden=!open;
        root.document.getElementById(fields.trigger).setAttribute('aria-expanded',String(open));
    }
    function toggleAdminPicker(scope='bulk') {
        if(scope==='directory'?adminSaving:busy)return;
        const fields=adminPickers[scope],open=root.document.getElementById(fields.panel).hidden;
        setAdminPicker(open,scope);
        if(open)root.document.getElementById(fields.search).focus();
    }
    function filterAdminOptions(value,scope='bulk') {
        const fields=adminPickers[scope],query=String(value||'').trim(),key=query.toLocaleLowerCase('id');
        const names=knownAdminNames();
        const matches=names.filter(name=>name.toLocaleLowerCase('id').includes(key));
        const selectedName=root.document.getElementById(fields.value).value;
        const option=(name,isNew=false)=>`<button type="button" class="customer-admin-option" role="option" aria-selected="${selectedName===name}" onclick="CustomerMaster.chooseAdmin(${arg(name)},'${scope}')" onkeydown="CustomerMaster.adminPickerKey(event,'${scope}')"><span class="customer-admin-radio" aria-hidden="true"></span><span>${esc(name)}${isNew?'<small>Gunakan sebagai admin baru</small>':''}</span></button>`;
        root.document.getElementById(fields.options).innerHTML=matches.map(name=>option(name)).join('')+
            (query&&!matches.length?option(query,true):'')+
            (!names.length&&!query?'<p class="customer-admin-empty">Ketik nama untuk menambahkan Admin SJ.</p>':'');
    }
    function chooseAdmin(value,scope='bulk') {
        if(scope==='directory'?adminSaving:busy)return;
        const fields=adminPickers[scope];
        root.document.getElementById(fields.value).value=value;
        root.document.getElementById(fields.label).textContent=value;
        filterAdminOptions(root.document.getElementById(fields.search).value,scope);
        setAdminPicker(false,scope);root.document.getElementById(fields.trigger).focus();
    }
    function adminPickerKey(event,scope='bulk') {
        const fields=adminPickers[scope];
        if(event.key==='Enter'&&event.target.id===fields.search) {
            event.preventDefault();root.document.querySelector('#'+fields.options+' [role="option"]')?.click();return;
        }
        if(event.key==='Escape') {
            event.preventDefault();event.stopPropagation();setAdminPicker(false,scope);
            root.document.getElementById(fields.trigger).focus();return;
        }
        if(!['ArrowDown','ArrowUp'].includes(event.key))return;
        event.preventDefault();
        const options=Array.from(root.document.querySelectorAll('#'+fields.options+' [role="option"]'));
        if(!options.length)return;
        const current=options.indexOf(root.document.activeElement);
        const next=current<0?(event.key==='ArrowDown'?0:options.length-1):(current+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
        options[next].focus();
    }
    async function assignAdmin(ids,value,baseline=rows) {
        const adminSJ=String(value||'').trim(),targets=[...new Set(ids)];
        if(!targets.length)throw Error('Pilih customer terlebih dahulu.');
        if(!adminSJ||adminSJ.length>200)throw Error('Isi nama Admin SJ (maksimal 200 karakter).');
        const expected=new Map(baseline.map(row=>[row.id,row]));
        if(targets.some(id=>!expected.has(id)))throw Error('Pilihan customer berubah. Pilih ulang customer.');
        const counts={updated:0,unchanged:0,done:0};
        function validate(id,current) {
            const old=expected.get(id);
            if(!current)throw Error('Customer sudah dihapus. Muat ulang dan pilih kembali.');
            if(current.name!==old.name||
                (String(current.adminSJ||'')!==String(old.adminSJ||'')&&current.adminSJ!==adminSJ)) {
                throw Error('Nama atau Admin SJ customer berubah dari perangkat lain. Muat ulang dan pilih kembali.');
            }
        }
        try {
            if(local()) {
                const fresh=JSON.parse(root.localStorage.getItem('wtrack_local_clients')||'[]');
                if(!Array.isArray(fresh))throw Error('Database customer lokal tidak valid.');
                const byId=new Map(fresh.map(row=>[row.id,row]));
                targets.forEach(id=>validate(id,byId.get(id)));
                const targetIds=new Set(targets),updatedAt=new Date().toISOString();
                const next=fresh.map(row=>{
                    if(!targetIds.has(row.id))return row;
                    if(row.adminSJ===adminSJ){counts.unchanged++;return row;}
                    counts.updated++;return {...row,adminSJ,updatedAt};
                });
                root.localStorage.setItem('wtrack_local_clients',JSON.stringify(next));
                counts.done=targets.length;targets.forEach(id=>selected.delete(id));publish(next);
            } else {
                for(let start=0;start<targets.length;start+=150) {
                    const group=targets.slice(start,start+150),activeDb=db();
                    const part=await activeDb.runTransaction(async tx=>{
                        const refs=group.map(id=>activeDb.collection('clients').doc(id));
                        const snapshots=await Promise.all(refs.map(ref=>tx.get(ref)));
                        group.forEach((id,index)=>validate(id,snapshots[index].exists?snapshots[index].data():null));
                        const result={updated:0,unchanged:0};
                        group.forEach((id,index)=>{
                            if(snapshots[index].data().adminSJ===adminSJ){result.unchanged++;return;}
                            tx.update(refs[index],{adminSJ,updatedAt:new Date().toISOString()});result.updated++;
                        });return result;
                    });
                    counts.updated+=part.updated;counts.unchanged+=part.unchanged;counts.done+=group.length;
                    group.forEach(id=>selected.delete(id));
                }
                await fetchRows();
            }
            return counts;
        } catch(error){error.bulkResult={...counts};throw error;}
    }
    async function saveBulk() {
        if(busy)return;
        const errorEl=root.document.getElementById('customer-bulk-error');
        const targets=bulkTargets.filter(row=>selected.has(row.id));
        let name=adminName(root.document.getElementById('customer-bulk-admin').value);
        busy=true;
        const button=root.document.getElementById('customer-bulk-save');button.disabled=true;
        errorEl.textContent='Menyimpan Admin SJ...';
        try {
            if(name&&!knownAdminNames().some(value=>value.toLocaleLowerCase('id')===name.toLocaleLowerCase('id')))name=(await saveAdminName(name)).name;
            const counts=await assignAdmin(targets.map(row=>row.id),name,targets);
            message=`Admin SJ tersimpan: ${counts.updated} customer diperbarui, ${counts.unchanged} tidak berubah.`;
            root.document.getElementById('customer-bulk-editor').close();root.showToast?.(message);
        } catch(error) {
            const done=error.bulkResult?.done||0;
            const remaining=bulkTargets.filter(row=>selected.has(row.id)).length;
            root.document.getElementById('customer-bulk-count').textContent=remaining;
            errorEl.textContent=`${done?`${done} customer sudah tersimpan. `:''}Belum selesai: ${error.message}`;
        } finally {busy=false;button.disabled=false;render();}
    }
    function render() {
        const view=root.document?.getElementById('customer-master-table');if(!view)return;
        const assigned=rows.filter(row=>String(row.adminSJ||'').trim()).length;
        const filtered=filteredRows();
        const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages);
        const tab=(value,label,count)=>`<button class="mm-tab ${filter===value?'is-active':''}" onclick="CustomerMaster.filter('${value}')">${label}<span>${count}</span></button>`;
        view.innerHTML=`<section class="material-master customer-master">
            <header class="mm-heading"><div><div class="mm-eyebrow">Master Data</div><h4>Database Customer <span class="customer-total">${rows.length}</span></h4><p>Customer dan penanggung jawab surat jalan.</p></div><div class="mm-heading-actions">
            <button type="button" class="mm-button" id="customer-manage-admins" onclick="CustomerMaster.openAdminManager()" ${busy?'disabled':''}><i class="bi bi-person-plus"></i> Admin</button>
            <label class="mm-button ${busy?'pe-none opacity-50':''}"><i class="bi bi-upload"></i> Import Excel<input id="client-excel-file" type="file" class="d-none" accept=".xlsx,.xls,.csv" onchange="CustomerMaster.importFile(this)" ${busy?'disabled':''}></label>
            <button class="mm-button mm-button-primary" onclick="CustomerMaster.edit('')" ${busy?'disabled':''}><i class="bi bi-plus-lg"></i> Customer</button></div></header>
            <p class="small ${message.startsWith('Import belum')||message.startsWith('Database belum')?'text-danger':'text-muted'}" role="status">${esc((busy?message:syncMessage||message)|| (local()?'Mode uji lokal':'Tersimpan di Firebase · tersedia kembali setelah refresh dan di perangkat lain'))}</p>
            <div class="mm-card"><div class="mm-toolbar"><div class="mm-tabs">${tab('all','Semua',rows.length)}${tab('assigned','Admin',assigned)}${tab('missing','Belum diatur',rows.length-assigned)}</div>
            <label class="mm-search"><i class="bi bi-search"></i><input id="customer-search" type="search" placeholder="Cari customer, admin, region..." aria-label="Cari customer" value="${esc(query)}" oninput="CustomerMaster.search(this.value)"></label></div>
            <div class="customer-bulk-toolbar"><span>${selected.size} dipilih dari ${filtered.length} hasil</span><button type="button" class="mm-button" id="customer-select-results" onclick="CustomerMaster.selectAll(true)" ${busy||!filtered.length?'disabled':''}>Pilih semua hasil (${filtered.length})</button><button type="button" class="mm-button" onclick="CustomerMaster.selectAll(false)" ${busy||!selected.size?'disabled':''}>Batal</button><button type="button" class="mm-button mm-button-primary" id="customer-bulk-open" onclick="CustomerMaster.openBulk()" ${busy||!selected.size?'disabled':''}><i class="bi bi-person-plus"></i> Admin</button><small>Semua hasil mencakup halaman lain.</small></div>
            <div class="mm-table-scroll"><table class="mm-table customer-table"><colgroup><col style="width:40px"><col style="width:26%"><col style="width:16%"><col style="width:84px"><col><col style="width:120px"><col style="width:110px"></colgroup><thead><tr><th class="customer-select-cell"><input id="customer-select-all" type="checkbox" class="form-check-input" aria-label="Pilih semua hasil pencarian" onchange="CustomerMaster.selectAll(this.checked)" ${busy||!filtered.length?'disabled':''} ${filtered.length&&filtered.every(row=>selected.has(row.id))?'checked':''}></th><th>Customer</th><th>Admin</th><th class="customer-actions-heading">Aksi</th><th>Alamat</th><th>Region</th><th>Status</th></tr></thead><tbody>
            ${filtered.slice((page-1)*size,page*size).map(row=>`<tr><td class="customer-select-cell"><input type="checkbox" class="form-check-input customer-row-select" aria-label="Pilih ${esc(row.name)}" onchange="CustomerMaster.selectRow(${arg(row.id)},this.checked)" ${selected.has(row.id)?'checked':''} ${busy?'disabled':''}></td><td><div class="mm-name">${esc(row.name)}</div></td><td>${row.adminSJ?`<span class="customer-admin"><i class="bi bi-person"></i>${esc(row.adminSJ)}</span>`:'<span class="mm-muted">—</span>'}</td><td class="customer-actions-cell"><div class="customer-row-actions"><button type="button" class="mm-icon-button customer-edit" title="Edit customer" aria-label="Edit ${esc(row.name)}" onclick="CustomerMaster.edit(${arg(row.id)})"><i class="bi bi-pencil"></i></button><button type="button" class="mm-icon-button customer-set-admin" title="Atur Admin" aria-label="Atur Admin ${esc(row.name)}" onclick="CustomerMaster.openRowAdmin(${arg(row.id)})" ${busy?'disabled':''}><i class="bi bi-person-plus"></i></button></div></td><td class="customer-address" title="${esc(row.address)}">${esc(row.address||'—')}</td><td>${esc(row.region||'—')}</td><td><span class="mm-status ${row.adminSJ?'':'is-inactive'}"><span></span>${row.adminSJ?'Terisi':'Belum diatur'}</span></td></tr>`).join('')||`<tr><td colspan="7" class="mm-empty">${!hasData?'Memuat customer...':'Belum ada customer yang sesuai.'}</td></tr>`}</tbody></table></div>
            <footer class="mm-footer"><span>Menampilkan ${filtered.length?(page-1)*size+1:0}–${Math.min(page*size,filtered.length)} dari ${filtered.length} customer</span><div class="mm-pagination"><button class="mm-icon-button" ${page===1?'disabled':''} onclick="CustomerMaster.setPage(${page-1})" aria-label="Halaman customer sebelumnya">‹</button><span>${page} / ${pages}</span><button class="mm-icon-button" ${page===pages?'disabled':''} onclick="CustomerMaster.setPage(${page+1})" aria-label="Halaman customer berikutnya">›</button></div></footer></div>
            <p class="mm-note">Excel: Nama customer, ADMIN SJ; Alamat dan Wilayah opsional. Nama sama diperbarui, data yang sama dilewati. Baris terakhir menentukan Admin SJ. Perubahan master dipakai untuk import SJ berikutnya; riwayat SJ tetap menyimpan PIC saat import.</p>
        </section>`;
        const all=root.document.getElementById('customer-select-all');
        if(all)all.indeterminate=selected.size>0&&!filtered.every(row=>selected.has(row.id));
    }
    function edit(id) {
        if(busy)return;
        const row=rows.find(row=>row.id===id)||{};
        const dialog=root.document.getElementById('customer-editor');
        for(const field of ['id','name','adminSJ','address','region'])root.document.getElementById('customer-'+field).value=row[field]||'';
        root.document.getElementById('customer-editor-error').textContent='';dialog.showModal();
        root.document.getElementById('customer-name').focus();
    }
    async function save() {
        if(busy)return;
        const val=field=>root.document.getElementById('customer-'+field).value.trim();
        const id=val('id'),record={name:val('name'),adminSJ:val('adminSJ'),address:val('address'),region:val('region')};
        const errorEl=root.document.getElementById('customer-editor-error');
        if(!keyOf(record.name)){errorEl.textContent='Isi nama customer yang valid.';return;}
        busy=true;const button=root.document.getElementById('customer-save');button.disabled=true;
        try {
            const fresh=await fetchRows();
            if(fresh.some(row=>row.id!==id&&keyOf(row.name)===keyOf(record.name)))throw Error('Nama customer sudah ada. Edit baris customer tersebut.');
            const target=id||'CLIENT_'+keyOf(record.name),updatedAt=new Date().toISOString();
            if(local()) {
                const values=fresh.filter(row=>row.id!==target);values.push({...fresh.find(row=>row.id===target),...record,id:target,updatedAt});
                root.localStorage.setItem('wtrack_local_clients',JSON.stringify(values));publish(values);
            } else await db().collection('clients').doc(target).set({...record,updatedAt},{merge:true});
            await fetchRows();root.document.getElementById('customer-editor').close();message='Customer tersimpan.';root.showToast?.(message);
        } catch(error){errorEl.textContent='Belum disimpan: '+error.message;}
        finally{busy=false;button.disabled=false;render();}
    }
    function search(value){if(busy)return;selected.clear();query=value;page=1;render();const input=root.document.getElementById('customer-search');input.focus();input.setSelectionRange(value.length,value.length);}
    root.document?.addEventListener?.('DOMContentLoaded',()=>{
        if(local())return;
        root.getAuth?.()?.onAuthStateChanged(user=>{
            prepareSession(user?.uid||'');
            if(user){render();watchRows().catch(()=>{});}
            else {message='';if(canRender())render();}
        });
    });
    root.CustomerMaster={resolveName:name=>adminLookup.get(keyOf(name))||'',load,render,parseRows,planImport,upsert,importFile,getLookup,edit,save,search,keyOf,
        selectAll,selectRow,openBulk,saveBulk,assignAdmin,closeBulk(){if(!busy)root.document.getElementById('customer-bulk-editor').close();},
        toggleAdminPicker,filterAdminOptions,chooseAdmin,adminPickerKey,
        openRowAdmin,openAdminManager,addAdmin,saveAdminName,loadAdminNames,knownAdminNames,
        closeAdminManager(){if(!adminSaving)root.document.getElementById('customer-admin-manager').close();},
        filter(value){if(busy)return;selected.clear();filter=value;page=1;render();},setPage(value){if(busy)return;page=value;render();}};
})(typeof window!=='undefined'?window:globalThis);
