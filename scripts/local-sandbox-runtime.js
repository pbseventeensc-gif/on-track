/* Only loaded by local-sandbox.cjs; never included in the deployed dashboard. */
(() => {
  'use strict';
  const shared = document.currentScript?.dataset.shared === 'true';
  const sessionToken = document.currentScript?.dataset.sessionToken || '';
  let sharedVersion = null;
  let sharedTrips = [];
  if (!shared && !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) throw new Error('Local sandbox requires loopback.');
  // A separate namespace prevents production/demo caches from entering this preview.
  const browserStorage = window.localStorage;
  const prefix = 'wtrack_sandbox_v1:';
  const masterDataKeys = new Map([
    ['wtrack_local_clients', 'wtrack_master_v1:clients'],
    ['wtrack_local_sj_admins_v1', 'wtrack_master_v1:sj_admins'],
    ['wtrack_pool_materials_v1', 'wtrack_master_v1:materials'],
    ['wtrack_material_seed_v1', 'wtrack_master_v1:material_seed']
  ]);
  const storageKey = key => masterDataKeys.get(key) || prefix + key;
  for (const [key, masterKey] of masterDataKeys) {
    const legacyValue = browserStorage.getItem(prefix + key);
    if (browserStorage.getItem(masterKey) === null && legacyValue !== null) {
      browserStorage.setItem(masterKey, legacyValue);
    }
  }
  const keys = () => Object.keys(browserStorage).filter(key => key.startsWith(prefix));
  Object.defineProperty(window, 'localStorage', {value: {
    getItem: key => shared && key === 'wtrack_local_trips' ? JSON.stringify(sharedTrips) : browserStorage.getItem(storageKey(key)),
    setItem: (key, value) => {
      if (shared && key === 'wtrack_local_trips') {
        if (sharedVersion !== null) window.persistLocalSandboxTrips(JSON.parse(value)).catch(error => alert(error.message));
        return;
      }
      browserStorage.setItem(storageKey(key), String(value));
    },
    removeItem: key => browserStorage.removeItem(storageKey(key)),
    clear: () => keys().forEach(key => browserStorage.removeItem(key)),
    key: index => keys()[index]?.slice(prefix.length) || null,
    get length() { return keys().length; }
  }});
  // SDKs are removed by the local server. Lock this global to prevent initialization.
  Object.defineProperty(window, 'firebase', {value: undefined, writable: false, configurable: false});
  window.WTRACK_LOCAL_SANDBOX = true;
  window.WTRACK_LOCAL_LAN = shared;
  const applySharedState = state => {
    if (sharedVersion !== null && state.version < sharedVersion) return;
    sharedVersion = state.version;
    sharedTrips = state.trips;
    window.refreshLocalCourier?.();
    if (window.syncAllCurrentTrips && window.UnifiedPoolUI) {
      window.allPoolTrips = sharedTrips.filter(t => !t.courierId && t.status !== 'completed');
      window.syncAllCurrentTrips(sharedTrips.filter(t => t.courierId || t.pickupStatus === 'collected'));
      window.UnifiedPoolUI.renderUnifiedPoolView();
      window.renderRecentShipments();
      window.updateGlobalStats();
    }
  };
  const stateRequest = async (method, payload) => {
    let response;
    try {
      response = await fetch('/local-sandbox/state' + (method === 'GET' && sharedVersion !== null ? '?version=' + sharedVersion : ''), {
        method, headers:{'X-WTrack-Local-Token':sessionToken, ...(method === 'POST' ? {'Content-Type':'application/json'} : {})},
        ...(payload ? {body:JSON.stringify(payload)} : {}), signal:AbortSignal.timeout(15000)
      });
    } catch { throw new Error('Server uji LAN tidak terhubung. Tindakan belum dikonfirmasi tersimpan; periksa koneksi dan muat ulang.'); }
    if (response.status === 204) return null;
    const state = await response.json();
    if (!response.ok) {
      if (response.status === 409) applySharedState(state);
      throw new Error(state.error || 'Gagal menyimpan data ke server uji LAN.');
    }
    return state;
  };
  window.persistLocalSandboxTrips = async trips => {
    if (!shared) { localStorage.setItem('wtrack_local_trips', JSON.stringify(trips)); return; }
    if (sharedVersion === null) throw new Error('Server uji LAN belum siap. Muat ulang halaman.');
    const state = await stateRequest('POST', {version:sharedVersion, trips});
    applySharedState(state);
  };
  document.addEventListener('DOMContentLoaded', async () => {
    if (shared) {
      try {
        applySharedState(await stateRequest('GET'));
      } catch (error) {
        const message = document.createElement('div'); message.textContent = error.message;
        message.style.cssText = 'position:fixed;inset:0;z-index:999999;padding:40px;background:#fef3c7;color:#78350f';
        document.body.append(message); return;
      }
      let polling = false;
      setInterval(async () => {
        if (polling) return;
        polling = true;
        try {
          const state = await stateRequest('GET');
          if (state) applySharedState(state);
          document.querySelector('#local-connection-status')?.remove();
        } catch (error) {
          if (!document.querySelector('#local-connection-status')) {
            const status = document.createElement('div'); status.id = 'local-connection-status';
            status.textContent = error.message; status.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:#fee2e2;color:#991b1b;padding:10px';
            document.body.append(status);
          }
        } finally { polling = false; }
      }, 1500);
    }
    window.isDemoMode = true;
    if (['/kurir.html', '/kurir'].includes(location.pathname)) {
      // Run after the courier page's own initialization, using its real renderer
      // and account filter against the same namespaced browser storage.
      setTimeout(() => {
        window.completeCourierLogin(window.resolveCourierProfile('pbseventeensc@gmail.com'), false);
        const refresh = () => {
          masterShipments = [];
          window.syncLocalImportedTrips();
          window.renderHomeScreen();
          window.renderShipmentsScreen();
        };
        window.refreshLocalCourier = refresh;
        window.recoverCourierTasks = () => { refresh(); window.showToast('Tugas lokal dimuat ulang; Firebase tetap diblokir.'); };
        const banner = document.createElement('div');
        banner.id = 'local-sandbox-banner';
        banner.style.cssText = 'position:sticky;top:0;z-index:99999;padding:10px;background:#fef3c7;color:#78350f;font:13px sans-serif;display:flex;gap:8px;align-items:center';
        const label = document.createElement('span');
        label.textContent = shared ? 'KURIR UJI LAN: pbseventeensc — Sinkron otomatis. Firebase diblokir.' : 'KURIR LOKAL: pbseventeensc — Data dari browser ini. Firebase diblokir.';
        const reload = document.createElement('button');
        reload.textContent = 'Muat ulang tugas'; reload.onclick = refresh;
        const dashboard = document.createElement('a');
        dashboard.href = '/'; dashboard.textContent = 'Dashboard';
        banner.append(label, reload, dashboard);
        document.body.prepend(banner);
        window.addEventListener('storage', event => {
          if (event.key === prefix + 'wtrack_local_trips' || event.key === null) refresh();
        });
        window.addEventListener('focus', refresh);
        refresh();
        window.navigateToScreen('shipments');
      }, 0);
      return;
    }
    // Use the existing account mapping supplied by the project, without logging in.
    const owner = window.MASTER_COURIERS.find(c => c.canonicalId === 'pbseventeensc');
    window.registeredUsers[owner.defaultUid] = owner.displayName;
    window.registeredUsers.pbseventeensc = owner.displayName;
    window.registeredUsersObjects[owner.defaultUid] = {name:owner.displayName, role:'courier', vehicleType:'motor'};
    const stored = JSON.parse(localStorage.getItem('wtrack_local_trips') || '[]');
    const active = stored.filter(t => t.courierId || t.pickupStatus === 'collected');
    window.syncAllCurrentTrips(active);
    window.renderCourierOptions();
    window.loginAsLocalDemoAdmin();
    // Persist the complete assignment before changing the UI. Quota failures leave
    // the previous data untouched, and every item/destination survives a refresh.
    window.UnifiedPoolUI.assignSelectedToCourier = async () => {
      const courierId = document.getElementById('pool-bulk-courier')?.value;
      const courier = window.MASTER_COURIERS.find(c => c.defaultUid === courierId);
      const checked = new Set(Array.from(document.querySelectorAll('.pool-checkbox:checked'), cb => cb.value));
      if (!courier || !checked.size) return alert('Pilih kurir dan minimal satu Surat Jalan terlebih dahulu.');
      const matches = t => [t.id, t.tripId, t.noSJ, t.sjNumber].some(id => checked.has(id));
      let list;
      try {
        list = JSON.parse(localStorage.getItem('wtrack_local_trips') || '[]');
        if (!list.some(matches)) return alert('Surat Jalan terpilih tidak ditemukan di penyimpanan lokal.');
        if (list.some(t => matches(t) && t.pickupStatus === 'waiting')) throw new Error('SJ menunggu Pickup by Customer; batalkan pickup sebelum menugaskan kurir.');
        list = list.map(t => !matches(t) ? t : {...t, courierId, courierName:courier.displayName,
          assignedTo:courier.displayName, assignedAt:new Date().toISOString(), status:'in_progress', deliveryStatus:'in_progress',
          isPendingRollover:false, isFailed:false, failedReason:null,
          destinations:(t.destinations || []).map(d => ({...d, status:'in_progress'}))});
        await window.persistLocalSandboxTrips(list);
      } catch (error) { return alert(error.message || 'Penugasan belum disimpan. Periksa penyimpanan / koneksi lokal.'); }
      window.allPoolTrips = (window.allPoolTrips || []).filter(t => !matches(t));
      window.syncAllCurrentTrips(list.filter(t => t.courierId || t.pickupStatus === 'collected'));
      window.UnifiedPoolUI.renderUnifiedPoolView();
      window.renderRecentShipments();
      window.updateGlobalStats();
      window.showToast(`Penugasan lokal ke ${courier.displayName} tersimpan. Tidak dikirim ke Firebase.`);
    };
    const banner = document.createElement('div');
    banner.id = 'local-sandbox-banner';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;padding:10px 16px;background:#fef3c7;color:#78350f;font:13px sans-serif;border-top:2px solid #d97706;display:flex;align-items:center;gap:12px;justify-content:space-between';
    const label = document.createElement('span');
    label.textContent = shared ? 'MODE UJI LAN — Data SJ bersama di memori server, hilang saat server berhenti. Master Data tersimpan terpisah di browser ini. Firebase diblokir.' : 'MODE UJI LOKAL — Data SJ dan Master Data tersimpan terpisah di browser ini. Master Data tidak ikut terhapus saat data uji dibersihkan. Firebase & API diblokir; belum disinkronkan ke perangkat lain.';
    const backup = document.createElement('button');
    backup.textContent = 'Unduh backup JSON';
    backup.onclick = () => {
      const payload = {mode:'local-only', exportedAt:new Date().toISOString(), trips:JSON.parse(localStorage.getItem('wtrack_local_trips') || '[]'),
        clients:JSON.parse(localStorage.getItem('wtrack_local_clients') || '[]'),
        materials:JSON.parse(localStorage.getItem('wtrack_pool_materials_v1') || '[]'),
        usageSources:JSON.parse(localStorage.getItem('wtrack_material_usage_sources_v1') || '[]')};
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'}));
      const link = document.createElement('a');
      link.href = url; link.download = 'wtrack-backup-lokal.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const reset = document.createElement('button');
    reset.textContent = 'Hapus data uji';
    reset.onclick = async () => {
      if (confirm(shared ? 'Hapus semua data uji LAN untuk seluruh perangkat?' : 'Hapus semua data uji lokal di browser ini?')) {
        try { if (shared) await window.persistLocalSandboxTrips([]); localStorage.clear(); location.reload(); }
        catch (error) { alert(error.message); }
      }
    };
    const courierLink = document.createElement('a');
    courierLink.href = '/kurir.html'; courierLink.target = '_blank'; courierLink.rel = 'noopener';
    courierLink.textContent = 'Buka kurir lokal';
    banner.append(label, courierLink, backup, reset);
    document.body.append(banner);
    document.body.style.paddingBottom = '65px';
    window.switchTab('pool', document.getElementById('nav-pool'));
  });
})();
