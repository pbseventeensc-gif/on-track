/**
 * WTRACK WEB QR SCANNER & MANUAL UNIQUE CODE SIMULATOR
 * Memungkinkan kurir/driver atau admin melakukan simulasi scan QR Code
 * atau ketik manual kode unik 6-digit (misal: "WK-7B8A9C") untuk klaim/update status tugas di localhost.
 */

window.WebQRScannerSim = (function () {
  let isScanning = false;
  let videoStream = null;
  let activeCallback = null;

  function initScannerUI() {
    if (document.getElementById('modal-web-qr-scanner')) return;

    const modalHtml = `
      <div id="modal-web-qr-scanner" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm hidden">
        <div class="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden mx-4 animate-scale-up">
          <div class="px-6 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <i data-lucide="qr-code" class="w-5 h-5"></i>
              </span>
              <div>
                <h3 class="font-bold text-foreground text-base">Simulator Pemindai QR & Kode Unik</h3>
                <p class="text-xs text-muted-foreground">Scan via kamera web atau ketik 6-digit Kode Unik SJ</p>
              </div>
            </div>
            <button onclick="WebQRScannerSim.closeModal()" class="text-muted-foreground hover:text-foreground text-sm font-semibold p-1">✕</button>
          </div>

          <div class="p-6 space-y-5">
            <!-- Pilihan Tab: Scan Kamera vs Input Manual -->
            <div class="flex border-b border-border">
              <button id="tab-scanner-cam" onclick="WebQRScannerSim.switchMode('cam')" class="flex-1 py-2 text-xs font-semibold border-b-2 border-emerald-500 text-emerald-500">
                <i data-lucide="camera" class="w-3.5 h-3.5 inline mr-1"></i> Kamera Web
              </button>
              <button id="tab-scanner-manual" onclick="WebQRScannerSim.switchMode('manual')" class="flex-1 py-2 text-xs font-semibold border-b-2 border-transparent text-muted-foreground hover:text-foreground">
                <i data-lucide="keyboard" class="w-3.5 h-3.5 inline mr-1"></i> Ketik Kode Unik (WK-XXXX)
              </button>
            </div>

            <!-- Panel Mode Kamera -->
            <div id="scanner-cam-panel" class="space-y-3">
              <div class="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border border-border">
                <video id="web-qr-video" class="w-full h-full object-cover hidden" playsinline></video>
                <div id="web-qr-placeholder" class="text-center p-4">
                  <i data-lucide="scan" class="w-12 h-12 mx-auto text-emerald-500/60 mb-2 animate-pulse"></i>
                  <p class="text-xs text-muted-foreground">Kamera aktif memindai QR Code Surat Jalan</p>
                  <button onclick="WebQRScannerSim.startCamera()" class="mt-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg">
                    Aktifkan Kamera
                  </button>
                </div>
                <!-- Scanning Frame Overlay -->
                <div class="absolute inset-8 border-2 border-dashed border-emerald-400/70 rounded-lg pointer-events-none flex items-center justify-center">
                  <div class="w-full h-0.5 bg-emerald-400 shadow-[0_0_8px_#10b981] animate-bounce"></div>
                </div>
              </div>
              <p class="text-[11px] text-muted-foreground text-center">Arahkan kamera ke QR Code Surat Jalan Wellen Print</p>
            </div>

            <!-- Panel Input Manual -->
            <div id="scanner-manual-panel" class="space-y-4 hidden">
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-foreground">Ketik Kode Unik Surat Jalan / No. SJ</label>
                <div class="relative">
                  <input type="text" id="scanner-manual-code-input" placeholder="Contoh: WK-A1B2C3 atau SJ-20261103-001" 
                         class="w-full pl-3 pr-10 py-2.5 bg-background border border-border rounded-xl text-sm font-mono tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                         onkeyup="if(event.key === 'Enter') WebQRScannerSim.submitManualCode()">
                  <button onclick="WebQRScannerSim.submitManualCode()" class="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium">
                    Cek
                  </button>
                </div>
                <p class="text-[11px] text-muted-foreground">Digunakan jika QR Code kotor, sobek, atau kamera tidak dapat membaca.</p>
              </div>

              <!-- Quick List Demo SJ for Localhost Testing -->
              <div class="p-3 bg-muted/40 rounded-xl border border-border">
                <p class="text-[11px] font-semibold text-muted-foreground mb-2">SURAT JALAN AKTIF DI POOL (KLIK UNTUK SIMULASI CEPAT):</p>
                <div id="scanner-quick-sj-list" class="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-xs">
                  <!-- Injected via JS -->
                </div>
              </div>
            </div>

            <!-- Status Result Box -->
            <div id="scanner-result-box" class="hidden p-3.5 rounded-xl border"></div>
          </div>

          <div class="px-6 py-3 bg-muted/30 border-t border-border flex justify-end">
            <button onclick="WebQRScannerSim.closeModal()" class="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold rounded-xl">
              Tutup
            </button>
          </div>
        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div.firstElementChild);
    if (window.lucide) lucide.createIcons();
  }

  function openModal(callback) {
    initScannerUI();
    activeCallback = callback;
    const modal = document.getElementById('modal-web-qr-scanner');
    modal.classList.remove('hidden');
    switchMode('manual'); // default manual/quick pick di localhost agar tanpa perlu izin camera device
    renderQuickSjList();
    if (window.lucide) lucide.createIcons();
  }

  function closeModal() {
    stopCamera();
    const modal = document.getElementById('modal-web-qr-scanner');
    if (modal) modal.classList.add('hidden');
  }

  function switchMode(mode) {
    const camTab = document.getElementById('tab-scanner-cam');
    const manualTab = document.getElementById('tab-scanner-manual');
    const camPanel = document.getElementById('scanner-cam-panel');
    const manualPanel = document.getElementById('scanner-manual-panel');

    if (mode === 'cam') {
      camTab.className = "flex-1 py-2 text-xs font-semibold border-b-2 border-emerald-500 text-emerald-500";
      manualTab.className = "flex-1 py-2 text-xs font-semibold border-b-2 border-transparent text-muted-foreground hover:text-foreground";
      camPanel.classList.remove('hidden');
      manualPanel.classList.add('hidden');
    } else {
      stopCamera();
      manualTab.className = "flex-1 py-2 text-xs font-semibold border-b-2 border-emerald-500 text-emerald-500";
      camTab.className = "flex-1 py-2 text-xs font-semibold border-b-2 border-transparent text-muted-foreground hover:text-foreground";
      manualPanel.classList.remove('hidden');
      camPanel.classList.add('hidden');
      renderQuickSjList();
    }
    if (window.lucide) lucide.createIcons();
  }

  function renderQuickSjList() {
    const container = document.getElementById('scanner-quick-sj-list');
    if (!container) return;

    const list = window.mockDatabase ? window.mockDatabase.suratJalanList : [];
    if (!list || list.length === 0) {
      container.innerHTML = `<p class="text-xs text-muted-foreground italic">Belum ada Surat Jalan di pool. Silakan import Excel terlebih dahulu.</p>`;
      return;
    }

    container.innerHTML = list.slice(0, 8).map(sj => `
      <div onclick="WebQRScannerSim.pickQuickCode('${sj.uniqueCode || sj.id}')" 
           class="p-2 bg-background hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-border rounded-lg cursor-pointer flex items-center justify-between transition-colors">
        <div>
          <span class="font-bold text-foreground">${sj.noSJ || sj.id}</span>
          <span class="text-muted-foreground ml-1 font-mono text-[10px] text-emerald-600 font-semibold">[${sj.uniqueCode || 'NO-CODE'}]</span>
          <div class="text-[10px] text-muted-foreground truncate max-w-[240px]">${sj.customer || 'Klien'} - ${sj.address || '-'}</div>
        </div>
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${sj.status === 'in_progress' ? 'bg-amber-500/10 text-amber-500' : sj.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-secondary text-muted-foreground'}">
          ${sj.status || 'pool'}
        </span>
      </div>
    `).join('');
  }

  function pickQuickCode(code) {
    const input = document.getElementById('scanner-manual-code-input');
    if (input) input.value = code;
    submitManualCode();
  }

  function submitManualCode() {
    const input = document.getElementById('scanner-manual-code-input');
    if (!input || !input.value.trim()) {
      showResult(false, 'Masukkan Kode Unik atau No. SJ terlebih dahulu.');
      return;
    }

    const val = input.value.trim().toUpperCase();
    resolveScannedCode(val);
  }

  function resolveScannedCode(code) {
    const list = window.mockDatabase ? window.mockDatabase.suratJalanList : [];
    const sj = list.find(s => 
      (s.uniqueCode && s.uniqueCode.toUpperCase() === code) || 
      (s.noSJ && s.noSJ.toUpperCase() === code) ||
      (s.id && s.id.toUpperCase() === code)
    );

    if (!sj) {
      showResult(false, `Surat Jalan dengan kode/nomor "${code}" tidak ditemukan dalam database.`);
      return;
    }

    showResult(true, `
      <div class="space-y-1">
        <p class="font-bold text-emerald-700 dark:text-emerald-300">✓ Ditemukan: ${sj.noSJ || sj.id}</p>
        <p class="text-xs text-foreground">Klien: <b>${sj.customer || '-'}</b> (${sj.region || 'Jabodetabek'})</p>
        <p class="text-xs text-muted-foreground">Status Sekarang: <span class="uppercase font-semibold">${sj.status || 'pool'}</span></p>
        <div class="pt-2 flex gap-2">
          <button onclick="WebQRScannerSim.claimDelivery('${sj.id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold">
            🚀 Ambil Pengiriman Ini
          </button>
          <button onclick="WebQRScannerSim.completeDelivery('${sj.id}')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold">
            ✓ Selesaikan Tugas (Terkirim)
          </button>
        </div>
      </div>
    `);

    if (typeof activeCallback === 'function') {
      activeCallback(sj);
    }
  }

  function claimDelivery(sjId) {
    const sj = (window.mockDatabase?.suratJalanList || []).find(s => s.id === sjId);
    if (!sj) return;

    sj.status = 'in_progress';
    sj.assignedTo = sj.assignedTo || 'Kurir Driver';
    sj.assignedAt = new Date().toISOString();

    if (window.showToast) {
      window.showToast(`SJ ${sj.noSJ || sj.id} berhasil diambil untuk pengiriman!`, 'success');
    }
    closeModal();
    if (window.renderUnifiedPoolView) window.renderUnifiedPoolView();
    if (window.updateDashboardStats) window.updateDashboardStats();
  }

  function completeDelivery(sjId) {
    const sj = (window.mockDatabase?.suratJalanList || []).find(s => s.id === sjId);
    if (!sj) return;

    sj.status = 'completed';
    sj.completedAt = new Date().toISOString();

    if (window.showToast) {
      window.showToast(`SJ ${sj.noSJ || sj.id} telah diselesaikan (Terkirim)!`, 'success');
    }
    closeModal();
    if (window.renderUnifiedPoolView) window.renderUnifiedPoolView();
    if (window.updateDashboardStats) window.updateDashboardStats();
  }

  function showResult(success, htmlContent) {
    const box = document.getElementById('scanner-result-box');
    if (!box) return;
    box.classList.remove('hidden');
    if (success) {
      box.className = "p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs";
    } else {
      box.className = "p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs";
    }
    box.innerHTML = htmlContent;
  }

  async function startCamera() {
    try {
      const video = document.getElementById('web-qr-video');
      const placeholder = document.getElementById('web-qr-placeholder');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      videoStream = stream;
      video.srcObject = stream;
      video.classList.remove('hidden');
      if (placeholder) placeholder.classList.add('hidden');
      await video.play();
      isScanning = true;
    } catch (err) {
      console.warn("Kamera tidak dapat diakses atau diblokir:", err);
      if (window.showToast) {
        window.showToast("Kamera tidak dapat diakses. Silakan gunakan tab 'Ketik Kode Unik'.", "warning");
      }
    }
  }

  function stopCamera() {
    if (videoStream) {
      videoStream.getTracks().forEach(t => t.stop());
      videoStream = null;
    }
    isScanning = false;
    const video = document.getElementById('web-qr-video');
    const placeholder = document.getElementById('web-qr-placeholder');
    if (video) video.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
  }

  return {
    openModal,
    closeModal,
    switchMode,
    pickQuickCode,
    submitManualCode,
    claimDelivery,
    completeDelivery,
    startCamera,
    stopCamera
  };
})();
