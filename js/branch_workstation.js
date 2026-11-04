/**
 * WTRACK LOGISTICS - WORKSTATION CABANG CIKOKOL
 * Pengelolaan status produksi dan transit cabang Cikokol ke Pusat
 * Terintegrasi langsung dengan Dashboard Pusat dan perhitungan SLA/Deadline.
 */

(function(window) {
    'use strict';

    let currentWorkstationFilter = 'all'; // 'all' | 'received' | 'printing' | 'packing' | 'shipped'

    // Format Countdown SLA / Deadline
    function calculateDeadlineBadge(deadlineStr) {
        if (!deadlineStr) return '<span class="badge bg-light text-muted border extra-small">Tanpa Deadline</span>';

        const now = new Date();
        let deadlineDate = null;

        if (deadlineStr.includes('T') || deadlineStr.includes('-')) {
            deadlineDate = new Date(deadlineStr);
        } else if (deadlineStr.includes(':')) {
            // Format jam saja (e.g. 14:00)
            const parts = deadlineStr.split(':');
            deadlineDate = new Date();
            deadlineDate.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
        }

        if (!deadlineDate || isNaN(deadlineDate.getTime())) {
            return `<span class="badge bg-light text-dark border extra-small">Target: ${deadlineStr}</span>`;
        }

        const diffMs = deadlineDate.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffMs < 0) {
            return `<span class="badge bg-danger text-white extra-small fw-bold animate-pulse"><i class="bi bi-alarm-fill me-1"></i>OVERDUE (${Math.abs(Math.round(diffHours))} Jam Lalu)</span>`;
        } else if (diffHours <= 2) {
            return `<span class="badge bg-warning text-dark extra-small fw-bold"><i class="bi bi-hourglass-bottom me-1"></i>Sisa ${Math.round(diffHours * 60)} Menit</span>`;
        } else {
            return `<span class="badge bg-success-subtle text-success border border-success-subtle extra-small fw-semibold"><i class="bi bi-clock me-1"></i>Sisa ${diffHours.toFixed(1)} Jam</span>`;
        }
    }

    // Ambil daftar pekerjaan untuk Cabang Cikokol
    function getCikokolJobs() {
        if (!window.allCurrentTrips) return [];
        return window.allCurrentTrips.filter(t => {
            const b = (t.originBranch || t.branchId || '').toLowerCase();
            return b === 'cikokol';
        });
    }

    // Render Tampilan Utama Workstation Cikokol
    function renderWorkstationView() {
        const viewContainer = document.getElementById('view-branch-workstation');
        if (!viewContainer) return;

        // Inisialisasi struktur layout jika belum ada
        if (!document.getElementById('cikokol-workstation-table-body')) {
            viewContainer.innerHTML = `
                <!-- HEADER WORKSTATION CIKOKOL -->
                <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <h4 class="fw-bold mb-0 text-dark">Workstation Cabang Cikokol</h4>
                            <span class="badge bg-warning text-dark border border-warning/40 px-2.5 py-1 rounded-pill extra-small fw-bold">Hub Produksi & Transit</span>
                        </div>
                        <p class="text-muted small mb-0 mt-1">
                            Kelola pekerjaan cetak cabang Cikokol, pantau deadline pengerjaan real-time, dan kirim barang ke Pusat.
                        </p>
                    </div>
                    <div class="d-flex align-items-center flex-wrap gap-2">
                        <button class="btn btn-light border btn-sm px-2.5 py-2" style="border-radius:10px;" onclick="renderWorkstationView()" title="Refresh Data">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                </div>

                <!-- STATISTIK BADGES TAHAPAN -->
                <div class="row g-3 mb-4">
                    <div class="col-6 col-lg-3">
                        <div class="card border-0 shadow-sm p-3 bg-white h-100" style="border-radius: 14px;">
                            <div class="text-muted extra-small fw-bold text-uppercase">Total Tugas Cikokol</div>
                            <h3 class="fw-bold text-dark mt-1 mb-0" id="cikokol-stat-total">0</h3>
                        </div>
                    </div>
                    <div class="col-6 col-lg-3">
                        <div class="card border-0 shadow-sm p-3 bg-white h-100" style="border-radius: 14px;">
                            <div class="text-muted extra-small fw-bold text-uppercase">Proses Cetak</div>
                            <h3 class="fw-bold text-primary mt-1 mb-0" id="cikokol-stat-printing">0</h3>
                        </div>
                    </div>
                    <div class="col-6 col-lg-3">
                        <div class="card border-0 shadow-sm p-3 bg-white h-100" style="border-radius: 14px;">
                            <div class="text-muted extra-small fw-bold text-uppercase">Packing Siap Kirim</div>
                            <h3 class="fw-bold text-warning mt-1 mb-0" id="cikokol-stat-packing">0</h3>
                        </div>
                    </div>
                    <div class="col-6 col-lg-3">
                        <div class="card border-0 shadow-sm p-3 bg-white h-100" style="border-radius: 14px;">
                            <div class="text-muted extra-small fw-bold text-uppercase">Sedang Menuju Pusat</div>
                            <h3 class="fw-bold text-success mt-1 mb-0" id="cikokol-stat-shipped">0</h3>
                        </div>
                    </div>
                </div>

                <!-- TABEL WORKSTATION CIKOKOL -->
                <div class="card border-0 shadow-sm" style="border-radius: 16px;">
                    <div class="card-header bg-white border-bottom p-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                        <span class="fw-bold text-dark small"><i class="bi bi-clock-history me-1 text-primary"></i>Daftar Antrian Cetak & Pengiriman ke Pusat</span>
                        <span class="badge bg-light text-muted border extra-small">Live Sync Real-time</span>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light extra-small text-uppercase">
                                    <tr>
                                        <th style="width: 40px;" class="text-center">No</th>
                                        <th>Surat Jalan / SPK</th>
                                        <th>Klien & Tujuan</th>
                                        <th>Item Barang & Qty</th>
                                        <th>Deadline & SLA</th>
                                        <th>Status Tahapan</th>
                                        <th class="text-end">Aksi Update Tahapan</th>
                                    </tr>
                                </thead>
                                <tbody id="cikokol-workstation-table-body" class="small">
                                    <tr><td colspan="7" class="text-center py-4 text-muted">Memuat antrian cabang Cikokol...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }

        const container = document.getElementById('cikokol-workstation-table-body');
        if (!container) return;

        const jobs = getCikokolJobs();

        // Update Stat Badges
        const total = jobs.length;
        const printing = jobs.filter(j => j.branchWorkflowStatus === 'printing').length;
        const packing = jobs.filter(j => j.branchWorkflowStatus === 'packing').length;
        const shipped = jobs.filter(j => j.branchWorkflowStatus === 'shipped_to_pusat').length;
        const arrived = jobs.filter(j => j.branchWorkflowStatus === 'arrived_at_pusat' || j.branchWorkflowStatus === 'ready').length;

        const statTotalEl = document.getElementById('cikokol-stat-total');
        const statPrintEl = document.getElementById('cikokol-stat-printing');
        const statPackEl = document.getElementById('cikokol-stat-packing');
        const statShippedEl = document.getElementById('cikokol-stat-shipped');

        if (statTotalEl) statTotalEl.innerText = total;
        if (statPrintEl) statPrintEl.innerText = printing;
        if (statPackEl) statPackEl.innerText = packing;
        if (statShippedEl) statShippedEl.innerText = shipped;

        if (jobs.length === 0) {
            container.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted extra-small">
                <i class="bi bi-building fs-3 d-block mb-2 text-secondary"></i>
                Belum ada Surat Jalan yang dialokasikan untuk dicetak di Cabang Cikokol.<br>
                Saat mengimpor file Excel di menu <b>SJ Pool</b>, pilih opsi <b>"Print di Cikokol"</b>.
            </td></tr>`;
            return;
        }

        container.innerHTML = jobs.map((t, idx) => {
            const firstDest = (t.destinations && t.destinations[0]) ? t.destinations[0] : {};
            const clientName = firstDest.locationName || t.clientName || 'Klien';
            const address = firstDest.address || t.address || '-';
            const items = firstDest.itemsSummary || 'Barang Cetakan';
            const qty = firstDest.qty || '1 Koli';

            const wfStatus = t.branchWorkflowStatus || 'received';
            let statusBadge = '<span class="badge bg-secondary text-white extra-small">📥 Diterima</span>';
            if (wfStatus === 'printing') statusBadge = '<span class="badge bg-primary text-white extra-small"><i class="bi bi-printer-fill me-1"></i>Proses Print</span>';
            else if (wfStatus === 'printed') statusBadge = '<span class="badge bg-info text-dark extra-small"><i class="bi bi-check-circle me-1"></i>Selesai Print</span>';
            else if (wfStatus === 'packing') statusBadge = '<span class="badge bg-warning text-dark extra-small"><i class="bi bi-box-seam me-1"></i>Sudah Packing</span>';
            else if (wfStatus === 'shipped_to_pusat') statusBadge = '<span class="badge bg-success text-white extra-small"><i class="bi bi-truck me-1"></i>Terkirim ke Pusat</span>';
            else if (wfStatus === 'arrived_at_pusat' || wfStatus === 'ready') statusBadge = '<span class="badge bg-dark text-white extra-small">✅ Tiba di Pusat</span>';

            const deadlineBadge = calculateDeadlineBadge(t.deadlineAt);

            // Aksi tombol tahapan
            let actionButtons = '';
            if (wfStatus === 'received') {
                actionButtons = `<button class="btn btn-xs btn-primary fw-bold px-2 py-1" onclick="window.branchWorkstation.updateJobStatus('${t.id}', 'printing')"><i class="bi bi-play-fill me-1"></i>Mulai Print</button>`;
            } else if (wfStatus === 'printing') {
                actionButtons = `<button class="btn btn-xs btn-info fw-bold px-2 py-1 text-dark" onclick="window.branchWorkstation.updateJobStatus('${t.id}', 'printed')"><i class="bi bi-check-lg me-1"></i>Selesai Print</button>`;
            } else if (wfStatus === 'printed') {
                actionButtons = `<button class="btn btn-xs btn-warning fw-bold px-2 py-1 text-dark" onclick="window.branchWorkstation.updateJobStatus('${t.id}', 'packing')"><i class="bi bi-box me-1"></i>Sudah Packing</button>`;
            } else if (wfStatus === 'packing') {
                actionButtons = `<button class="btn btn-xs btn-success fw-bold px-2 py-1" onclick="window.branchWorkstation.openShipToPusatModal('${t.id}')"><i class="bi bi-send-fill me-1"></i>Kirim ke Pusat</button>`;
            } else if (wfStatus === 'shipped_to_pusat') {
                actionButtons = `<button class="btn btn-xs btn-outline-dark fw-bold px-2 py-1" onclick="window.branchWorkstation.confirmArrivedAtPusat('${t.id}')"><i class="bi bi-building-check me-1"></i>Konfirmasi Tiba di Pusat</button>`;
            } else {
                actionButtons = `<span class="text-success extra-small fw-bold"><i class="bi bi-check2-all me-1"></i>Siap Diantar Kurir</span>`;
            }

            return `
                <tr>
                    <td class="text-center fw-bold text-muted extra-small">${idx + 1}</td>
                    <td>
                        <div class="fw-bold font-monospace text-primary">${t.sjNumber || t.id.slice(-8)}</div>
                        <span class="badge bg-dark font-monospace extra-small">${t.shortCode || 'WK-0000'}</span>
                    </td>
                    <td>
                        <div class="fw-bold text-dark text-truncate" style="max-width: 220px;">${clientName}</div>
                        <small class="text-muted extra-small d-block text-truncate" style="max-width: 240px;">${address}</small>
                    </td>
                    <td>
                        <div class="extra-small text-dark fw-semibold">${items}</div>
                        <small class="text-muted extra-small">${qty}</small>
                    </td>
                    <td>
                        ${deadlineBadge}
                    </td>
                    <td>
                        ${statusBadge}
                        ${t.shuttleDriverName ? `<div class="extra-small text-muted mt-0.5"><i class="bi bi-truck me-1"></i>${t.shuttleDriverName}</div>` : ''}
                    </td>
                    <td>
                        <div class="d-flex align-items-center gap-1">
                            ${actionButtons}
                            <button class="btn btn-xs btn-outline-secondary p-1" onclick="window.qrPrintDispatch.printSingleSJ('${t.id}')" title="Cetak Surat Jalan & QR"><i class="bi bi-printer"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Update Status Tahapan Pekerjaan
    async function updateJobStatus(tripId, newStatus, extraData = {}) {
        try {
            const activeDb = (typeof window.getDb === 'function') ? window.getDb() : null;
            const trip = (window.allCurrentTrips || []).find(t => t.id === tripId || t.tripId === tripId);
            if (!trip) return;

            const updateMap = {
                branchWorkflowStatus: newStatus,
                branchUpdatedAt: (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore.Timestamp.now() : new Date().toISOString(),
                ...extraData
            };

            if (newStatus === 'arrived_at_pusat') {
                updateMap.arrivedAtPusatTime = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore.Timestamp.now() : new Date().toISOString();
            }

            if (activeDb) {
                try {
                    await activeDb.collection('trips').doc(trip.id).update(updateMap);
                } catch (fsErr) {
                    console.warn("Firestore update ditolak/offline, update lokal diterapkan:", fsErr);
                }
            }

            // Update memori lokal
            trip.branchWorkflowStatus = newStatus;
            Object.assign(trip, extraData);

            if (typeof window.showToast === 'function') {
                window.showToast(`✅ Status pekerjaan Cikokol diperbarui ke: ${newStatus.replace(/_/g, ' ').toUpperCase()}`);
            }

            renderWorkstationView();
            if (typeof window.renderRecentShipments === 'function') window.renderRecentShipments();
            if (typeof window.loadPoolTrips === 'function') window.loadPoolTrips();

        } catch (e) {
            console.error("Gagal update status cabang Cikokol:", e);
            alert("Gagal memperbarui status: " + e.message);
        }
    }

    // Modal Kirim ke Pusat
    function openShipToPusatModal(tripId) {
        const trip = (window.allCurrentTrips || []).find(t => t.id === tripId || t.tripId === tripId);
        if (!trip) return;

        const modalEl = document.getElementById('modal-cikokol-ship-to-pusat');
        if (!modalEl) {
            // Fallback prompt jika modal belum ada
            const driver = prompt("Masukkan Nama Driver Shuttle / Plat Mobil yang membawa ke Pusat:", "Agung (Granmax B 9227 SCH)");
            if (driver) {
                updateJobStatus(tripId, 'shipped_to_pusat', { shuttleDriverName: driver });
            }
            return;
        }

        const tripIdInput = document.getElementById('cikokol-ship-trip-id');
        const sjLabel = document.getElementById('cikokol-ship-sj-label');
        if (tripIdInput) tripIdInput.value = tripId;
        if (sjLabel) sjLabel.innerText = trip.sjNumber || trip.id;

        if (typeof bootstrap !== 'undefined') {
            const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
            bsModal.show();
        }
    }

    function confirmShipToPusat() {
        const tripId = document.getElementById('cikokol-ship-trip-id')?.value;
        const driverSelect = document.getElementById('cikokol-ship-driver-select');
        const driverName = driverSelect ? driverSelect.value : 'Driver Shuttle Cikokol';

        if (!tripId) return;

        updateJobStatus(tripId, 'shipped_to_pusat', { shuttleDriverName: driverName });

        const modalEl = document.getElementById('modal-cikokol-ship-to-pusat');
        if (modalEl && typeof bootstrap !== 'undefined') {
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
        }
    }

    function confirmArrivedAtPusat(tripId) {
        if (!confirm("Konfirmasi bahwa fisik barang dari Cikokol ini sudah TIBA DI PUSAT dan siap diserah-terimakan ke kurir?")) return;
        updateJobStatus(tripId, 'arrived_at_pusat', { readyForCourier: true });
    }

    // Export API
    const workstationAPI = {
        renderWorkstationView,
        renderBranchWorkstation: renderWorkstationView,
        updateJobStatus,
        openShipToPusatModal,
        confirmShipToPusat,
        confirmArrivedAtPusat
    };

    window.branchWorkstation = workstationAPI;
    window.BranchWorkstation = workstationAPI;

})(typeof window !== 'undefined' ? window : global);
