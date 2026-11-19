/* Web updates are applied when returning to the courier page, outside an active form. */
(function(root) {
    'use strict';
    if(root.WTRACK_LOCAL_SANDBOX||root.location.protocol==='file:')return;
    const document=root.document;
    const build=document.currentScript?.dataset.build;
    if(!build)return;

    const ATTEMPT_KEY='wtrack_courier_update_attempt_v1';
    let checking=false;
    let pendingVersion='';

    function activeScreen() {
        try { return document.querySelector('.app-screen.active')?.id || ''; } catch { return ''; }
    }

    // Reloading the WebView during an active delivery looks like the app closed.
    // Only update on home/login; other screens get a banner after the next check.
    function onSafeScreen() {
        const screen=activeScreen();
        return !screen || screen==='screen-home' || screen==='screen-login';
    }

    function canReload() {
        if(document.hidden)return false;
        if(root.__wtrackAuthRestoring)return false;
        if(root.FleetService?.hasUnsavedDraft())return false;
        if(document.querySelector('.modal.show, dialog[open]'))return false;
        if(!onSafeScreen())return false;
        const focused=document.activeElement;
        if(focused?.matches('input,textarea')&&focused.value)return false;
        return !document.querySelector('button[disabled][data-proof-busy]');
    }

    function removeBanner() {
        try { document.getElementById('courier-update-banner')?.remove(); } catch (_) {}
    }

    function showUpdateOverlay() {
        try {
            removeBanner();
            if(document.getElementById('courier-update-overlay'))return;
            const overlay=document.createElement('div');
            overlay.id='courier-update-overlay';
            overlay.setAttribute('role','status');
            overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:32px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;';
            overlay.innerHTML='<div><div style="width:42px;height:42px;margin:0 auto 18px;border:4px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:wtrack-spin 0.8s linear infinite;"></div><div style="font-size:16px;font-weight:700;">Memperbarui aplikasi…</div><div style="font-size:12.5px;opacity:.7;margin-top:6px;">Tugas dan sesi login Anda tetap aman.</div></div><style>@keyframes wtrack-spin{to{transform:rotate(360deg)}}</style>';
            document.body.appendChild(overlay);
        } catch (_) {}
    }

    function applyUpdate(version, manual=false) {
        try {
            const attempted=root.sessionStorage?.getItem(ATTEMPT_KEY);
            if(attempted===version&&!manual) { showUpdateBanner(version, true); return; }
            root.sessionStorage?.setItem(ATTEMPT_KEY,version);
        } catch (_) {}
        showUpdateOverlay();
        if(typeof setTimeout!=='function') { root.location.reload(); return; }
        setTimeout(()=>root.location.reload(),350);
    }

    function showUpdateBanner(version, deferred=false) {
        if(!version)return;
        try {
            if(document.getElementById('courier-update-banner'))return;
            const bar=document.createElement('div');
            bar.id='courier-update-banner';
            bar.setAttribute('role','status');
            bar.style.cssText='position:fixed;left:12px;right:12px;top:12px;z-index:2147483646;background:#fff7ed;color:#7c2d12;border:1px solid #fdba74;border-radius:12px;padding:10px 12px;display:flex;align-items:center;gap:10px;justify-content:space-between;box-shadow:0 8px 24px rgba(15,23,42,.16);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;';
            const text=document.createElement('span');
            text.style.cssText='font-size:12px;font-weight:600;line-height:1.35;';
            text.textContent=deferred?'Pembaruan tertunda. Tutup lalu buka kembali aplikasi.':'Versi baru aplikasi tersedia.';
            const button=document.createElement('button');
            button.type='button';
            button.textContent='Muat ulang';
            button.style.cssText='flex:none;background:#ea580c;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:700;';
            button.addEventListener('click',()=>{
                if(!canReload()) {
                    const ok=typeof root.confirm!=='function' || root.confirm('Muat ulang aplikasi sekarang? Pastikan tidak ada form yang belum dikirim.');
                    if(!ok)return;
                }
                applyUpdate(version,true);
            });
            bar.append(text,button);
            document.body.appendChild(bar);
        } catch (_) {}
    }

    async function check(manual=false) {
        if(checking||!root.navigator.onLine)return;
        if(!manual&&!canReload())return;
        checking=true;
        try {
            const response=await root.fetch('/assets/app-version.json',{cache:'no-store'});
            if(!response.ok)return;
            const version=await response.json();
            if(!version.courier||version.courier===build) {
                pendingVersion='';
                removeBanner();
                return;
            }
            pendingVersion=version.courier;
            if(!canReload()) {
                if(manual)showUpdateBanner(version.courier);
                return;
            }
            applyUpdate(version.courier,manual);
        } catch { /* Keep the currently usable page during a connection failure. */ }
        finally {checking=false;}
    }

    document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
    root.addEventListener('pageshow',()=>check());
    root.addEventListener('online',()=>check());
    root.setInterval(check,60000);

    root.CourierUpdates={check,build,get pendingVersion(){return pendingVersion;},canReload};
})(window);
