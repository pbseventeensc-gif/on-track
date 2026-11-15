/* Reversible dispatch operations for the isolated localhost dashboard. */
(function(root) {
    'use strict';
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const argument=value=>esc(JSON.stringify(value));
    const clone=value=>JSON.parse(JSON.stringify(value));
    const done=value=>!!value && (['completed','done','delivered'].includes(value.status)||!!value.completedTime||!!value.completedAt||!!value.proofPhotoUrl||!!value.proofPhotoSj);
    const id=()=>root.crypto?.randomUUID?.()||Date.now()+'_'+Math.random().toString(36).slice(2);
    let queue=Promise.resolve(),popover=null;
    function pendingInfo(trip,destination={}) {
        const reason=destination.pendingReason||trip.pendingReason||'';
        const note=destination.pendingNote||destination.pendingNotes||destination.note||destination.notes||trip.pendingNote||trip.pendingNotes||trip.note||trip.notes||reason;
        return {reason:String(reason),note:String(note),at:destination.pendingAt||trip.pendingAt||null};
    }
    function reference(trip,index=0) {
        const d=trip.destinations?.[index]||{};
        return {tripId:trip.id||trip.tripId,destinationIndex:index,deliveryId:d.deliveryId||'',noSJ:d.noSJ||d.sjNumber||trip.noSJ||trip.sjNumber||'',locationName:d.locationName||''};
    }
    function locate(trips,ref) {
        const trip=trips.find(row=>row.id===ref.tripId||row.tripId===ref.tripId);
        if(!trip)throw Error('Pengiriman tidak ditemukan. Muat ulang data.');
        const index=ref.deliveryId?trip.destinations?.findIndex(d=>d.deliveryId===ref.deliveryId):(ref.destinationIndex??0);
        const destination=trip.destinations?.[index];
        if(trip.destinations?.length&&!destination)throw Error('Titik pengiriman berubah. Muat ulang data.');
        if(destination&&!ref.deliveryId && ((ref.noSJ&&destination.noSJ&&ref.noSJ!==destination.noSJ)||(ref.locationName&&ref.locationName!==destination.locationName)))throw Error('Identitas titik pengiriman berubah. Muat ulang data.');
        return {trip,destination:destination||trip,index};
    }
    function detachedPool(trips,ref,now) {
        const found=locate(trips,ref),{trip,destination,index}=found;
        if(done(destination)||(trip.destinations?.length||0)<=1&&done(trip))throw Error('Pengiriman sudah selesai; bukti dan riwayatnya tidak boleh dihapus.');
        let target=trip;
        if(trip.destinations?.length>1) {
            const note=pendingInfo(trip,destination),newId='TRIP_POOL_'+id();
            target={...clone(trip),id:newId,tripId:newId,sourceTripId:trip.id,noSJ:destination.noSJ||destination.sjNumber||trip.noSJ,
                sjNumber:destination.sjNumber||destination.noSJ||trip.sjNumber,customer:destination.customer||destination.locationName||trip.customer,
                clientName:destination.customer||destination.locationName||trip.clientName,address:destination.address||trip.address,
                items:clone(destination.items||[{nama:destination.itemsSummary||'Item Pengiriman',qty:destination.qty||1}]),
                destinations:[clone(destination)],pendingReason:note.reason,pendingNote:note.note};
            trip.destinations.splice(index,1);
            trips.push(target);
        }
        target.previousCourierId=target.courierId||target.previousCourierId||'';
        target.courierId='';target.courierName='';target.assignedTo='';target.assignedAt=null;
        target.status='pool';target.deliveryStatus='pool';target.isFailed=false;target.isPendingRollover=false;target.unassignedAt=now;
        for(const d of target.destinations||[]) {d.status='pending';d.courierId='';d.assignedTo='';}
        return target;
    }
    function apply(trips,ref,action,payload={},now=new Date().toISOString()) {
        const output=clone(trips),found=locate(output,ref);
        if(action==='address') {
            const address=String(payload.address||'').trim();if(!address)throw Error('Alamat tidak boleh kosong.');
            found.destination.address=address;found.destination.addressEditedAt=now;
            if(payload.resetCoordinates) {
                for(const field of ['latitude','longitude','lat','lng']) found.destination[field]=null;
                found.destination.locationNeedsReview=true;
            }
            if((found.trip.destinations?.length||0)<=1) {
                found.trip.address=address;found.trip.addressEditedAt=now;
                if(payload.resetCoordinates)for(const field of ['latitude','longitude','lat','lng'])found.trip[field]=null;
            }
        } else if(action==='urgent') {
            if(done(found.destination))throw Error('Pengiriman sudah selesai.');
            const urgent=payload.urgent!==false;
            found.destination.priority=urgent?'urgent':'normal';found.destination.urgentAt=urgent?now:null;
            if((found.trip.destinations?.length||0)<=1) {found.trip.priority=found.destination.priority;found.trip.urgentAt=found.destination.urgentAt;}
        } else if(action==='unassign') {
            detachedPool(output,ref,now);
        } else if(action==='pickup-waiting') {
            if(found.trip.courierId && !pendingInfo(found.trip,found.destination).reason && !['pending_approval','failed','returned','klien_tutup'].includes(found.destination.status)) throw Error('Batalkan penugasan kurir terlebih dahulu.');
            const trip=detachedPool(output,ref,now);
            trip.deliveryMethod='customer_pickup';trip.pickupStatus='waiting';trip.pickupRequestedAt=now;
        } else if(action==='pickup-cancel') {
            if(found.trip.pickupStatus!=='waiting')throw Error('SJ tidak sedang menunggu pickup.');
            found.trip.deliveryMethod='courier';found.trip.pickupStatus=null;found.trip.pickupCancelledAt=now;
        } else if(action==='pickup-collected') {
            const recipient=String(payload.recipient||'').trim();
            if(found.trip.pickupStatus!=='waiting'||found.trip.courierId)throw Error('SJ tidak sedang menunggu pickup customer.');
            if(found.trip.readyStatus==='not_ready')throw Error('Barang belum siap. Tandai Siap Kirim sebelum konfirmasi pengambilan.');
            if(!recipient)throw Error('Isi nama pengambil barang.');
            Object.assign(found.trip,{status:'completed',deliveryStatus:'completed',pickupStatus:'collected',pickedUpAt:now,completedAt:now,
                pickupRecipient:recipient,pickupNote:String(payload.note||'').trim(),completionMethod:'customer_pickup'});
            for(const d of found.trip.destinations||[]) Object.assign(d,{status:'done',completedTime:now,completedAt:now,completionMethod:'customer_pickup'});
        } else throw Error('Aksi tidak dikenal.');
        return output;
    }
    function dashboardTrips(trips) {return trips.filter(trip=>trip.courierId||trip.pickupStatus==='collected');}
    function refresh(trips) {
        root.allPoolTrips=trips.filter(trip=>!trip.courierId&&!['completed','done'].includes(trip.status));
        root.mockDatabase=root.mockDatabase||{};root.mockDatabase.suratJalanList=trips;
        if(root.syncAllCurrentTrips)root.syncAllCurrentTrips(dashboardTrips(trips));else root.allCurrentTrips=dashboardTrips(trips);
        for(const draw of [()=>root.UnifiedPoolUI?.renderUnifiedPoolView(),()=>root.renderRecentShipments?.('',true),()=>root.renderMonitorUI?.(),()=>root.updateGlobalStats?.()]) {
            try {draw();}catch(error){root.console?.warn('View refresh:',error);}
        }
    }
    function mutate(ref,action,payload) {
        if(!root.WTRACK_LOCAL_SANDBOX)return Promise.reject(Error('Fitur ini belum diaktifkan di luar localhost.'));
        const operation=queue.then(async()=>{
            const trips=JSON.parse(root.localStorage.getItem('wtrack_local_trips')||'[]');
            const updated=apply(trips,ref,action,payload);
            if(root.persistLocalSandboxTrips)await root.persistLocalSandboxTrips(updated);
            else root.localStorage.setItem('wtrack_local_trips',JSON.stringify(updated));
            root.MaterialUsage?.capture(updated);refresh(updated);return updated;
        });
        queue=operation.catch(()=>{});return operation;
    }
    function icon(name) {
        const classes={edit:'bi bi-pencil',urgent:'bi bi-exclamation-triangle',pickup:'bi bi-box-seam',check:'bi bi-check2',close:'bi bi-x-lg'};
        return `<i class="${classes[name]||'bi bi-circle'}" aria-hidden="true"></i>`;
    }
    function closePopover() {popover?.remove();popover=null;}
    function position(element,rect) {
        const width=element.getBoundingClientRect().width||284,height=element.getBoundingClientRect().height||150;
        const x=Math.max(8,Math.min(rect.right-width,root.innerWidth-width-8));
        const below=rect.bottom+8,above=rect.top-height-8;
        element.style.left=x+'px';element.style.top=Math.max(8,above>=8?above:Math.min(below,root.innerHeight-height-8))+'px';
    }
    function near(anchor,title,message,action,success) {
        closePopover();const rect=anchor.getBoundingClientRect();
        const box=root.document.createElement('div');box.className='workflow-popover';box.setAttribute('role','dialog');box.setAttribute('aria-label',title);
        box.innerHTML=`<button type="button" class="workflow-close" aria-label="Tutup">${icon('close')}</button><strong>${esc(title)}</strong><p>${esc(message)}</p><div class="workflow-popover-actions"><button type="button" class="workflow-cancel">Batal</button><button type="button" class="workflow-confirm">Konfirmasi</button></div>`;
        root.document.body.appendChild(box);popover=box;position(box,rect);
        box.querySelector('.workflow-close').onclick=closePopover;box.querySelector('.workflow-cancel').onclick=closePopover;
        const confirm=box.querySelector('.workflow-confirm');
        confirm.onclick=async()=>{
            confirm.disabled=true;confirm.textContent='Menyimpan...';
            try {await action();box.innerHTML=`<div class="workflow-success">${icon('check')}<span>${esc(success)}</span></div>`;position(box,rect);root.setTimeout(()=>{if(popover===box)closePopover();},1800);}
            catch(error) {box.querySelector('p').textContent=error.message;confirm.disabled=false;confirm.textContent='Coba Lagi';position(box,rect);}
        };
        confirm.focus();
    }
    function confirmUnassign(anchor,ref) {near(anchor,'Hapus penugasan?','Tujuan ini dikembalikan ke SJ Pool. Surat jalan tetap tersimpan.',()=>mutate(ref,'unassign',{}),'Penugasan dihapus. SJ kembali ke Pool.');}
    function toggleUrgent(anchor,ref,urgent) {near(anchor,urgent?'Tandai Urgent?':'Kembalikan ke normal?','Catatan pending kurir tetap disimpan.',()=>mutate(ref,'urgent',{urgent}),urgent?'SJ ditandai Urgent.':'Prioritas kembali normal.');}
    function requestPickup(anchor,ref) {near(anchor,'Pickup by Customer?','Tandai menunggu customer mengambil barang. Belum dianggap selesai.',()=>mutate(ref,'pickup-waiting',{}),'SJ menunggu diambil customer.');}
    function cancelPickup(anchor,ref) {near(anchor,'Batalkan pickup?','SJ kembali ke antrean pengiriman kurir.',()=>mutate(ref,'pickup-cancel',{}),'Pickup dibatalkan.');}
    function dialog(title,body,onSave) {
        const element=root.document.createElement('dialog');element.className='workflow-dialog';
        element.innerHTML=`<form><header><h5>${esc(title)}</h5><button type="button" class="workflow-close" aria-label="Tutup">${icon('close')}</button></header>${body}<div class="workflow-form-error" role="status"></div><footer><button type="button" class="workflow-cancel">Batal</button><button type="submit" class="workflow-confirm">Simpan</button></footer></form>`;
        root.document.body.appendChild(element);element.addEventListener('close',()=>element.remove());
        element.querySelector('.workflow-close').onclick=()=>element.close();element.querySelector('.workflow-cancel').onclick=()=>element.close();
        element.querySelector('form').onsubmit=async event=>{
            event.preventDefault();const button=element.querySelector('[type=submit]');button.disabled=true;
            try {await onSave(element);element.close();root.showToast?.('Perubahan tersimpan.');}
            catch(error){element.querySelector('.workflow-form-error').textContent=error.message;button.disabled=false;}
        };
        element.showModal();
    }
    function editAddress(ref) {
        try {
            const found=locate(JSON.parse(root.localStorage.getItem('wtrack_local_trips')||'[]'),ref);
            dialog('Edit Alamat Kirim',`<label>Alamat Kirim<textarea name="address" rows="4" required>${esc(found.destination.address||found.trip.address||'')}</textarea></label><label class="workflow-checkbox"><input name="resetCoordinates" type="checkbox">Alamat ini menunjuk lokasi baru</label><small>Centang jika titik pengantaran berpindah agar koordinat lama tidak dipakai.</small>`,element=>mutate(ref,'address',{address:element.querySelector('[name=address]').value,resetCoordinates:element.querySelector('[name=resetCoordinates]').checked}));
        } catch(error) {root.showToast?.(error.message);}
    }
    function confirmPickup(ref) {
        dialog('Konfirmasi Sudah Diambil',`<p>Konfirmasi hanya setelah barang benar-benar diterima customer.</p><label>Nama Pengambil<input name="recipient" required autocomplete="off"></label><label>Catatan<textarea name="note" rows="2"></textarea></label>`,element=>mutate(ref,'pickup-collected',{recipient:element.querySelector('[name=recipient]').value,note:element.querySelector('[name=note]').value}));
    }
    const api={argument,escape:esc,icon,pendingInfo,reference,apply,dashboardTrips,refresh,mutate,editAddress,confirmUnassign,toggleUrgent,requestPickup,cancelPickup,confirmPickup,closePopover};
    root.DispatchWorkflow=api;
    if(root.document) {
        root.document.addEventListener('keydown',event=>{if(event.key==='Escape')closePopover();});
        root.document.addEventListener('pointerdown',event=>{if(popover&&!popover.contains(event.target))closePopover();});
        root.addEventListener?.('storage',event=>{
            if(root.WTRACK_LOCAL_SANDBOX&&(event.key===null||String(event.key).endsWith('wtrack_local_trips')))refresh(JSON.parse(root.localStorage.getItem('wtrack_local_trips')||'[]'));
        });
    }
    if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
