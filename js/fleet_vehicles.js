// ==============================================================================
// WTRACK LOGISTICS - VEHICLE FLEET INVENTORY MODULE (SUPER ADMIN ONLY)
// Dedicated Company Fleet: Daihatsu Granmax & Truck Box
// (Motor vehicles are excluded per company policy as personal vehicles)
// ==============================================================================

(function() {
    'use strict';

    const STORAGE_KEY = 'wtrack_fleet_vehicles_v5';

    // 12 Company Operational Vehicles (6 Granmax, 4 Truck Box, 1 Pick Up, 1 L300)
    const DEFAULT_FLEET = [
        // ================= KATEGORI 1: GRANMAX (6 UNIT) =================
        {
            id: 'FLT-GMX-001',
            plate_number: 'B 9227 SCH',
            vehicle_category: 'granmax',
            vehicle_type: 'mobil',
            assigned_person_id: 'agung',
            assigned_person_name: 'Agung',
            assigned_role: 'driver',
            assigned_person_phone: '6281210203040',
            tax_due_date: '2026-11-18',
            kir_due_date: '2026-11-04', // H-5 (Warning H-7)
            service_due_date: '2026-11-12',
            service_details: 'Ganti Oli Mesin (10W-40), Filter Oli, Cek Kampas Rem Depan, Tune Up Busi',
            fuel_barcode_code: 'BBM-GMX-9227-PERTALITE',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-GMX-9227-PERTALITE',
            notes: 'Daihatsu Gran Max Blindvan Operasional'
        },
        {
            id: 'FLT-GMX-002',
            plate_number: 'B 9939 SCH',
            vehicle_category: 'granmax',
            vehicle_type: 'mobil',
            assigned_person_id: 'soleh',
            assigned_person_name: 'Soleh',
            assigned_role: 'driver',
            assigned_person_phone: '6281311223344',
            tax_due_date: '2026-11-03', // H-4 (Warning H-7)
            kir_due_date: '2026-12-15',
            service_due_date: '2026-11-20',
            service_details: 'Ganti Oli Mesin, Filter Udara, Cek Minyak Rem & Kopling, Spooring & Balancing',
            fuel_barcode_code: 'BBM-GMX-9939-PERTALITE',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-GMX-9939-PERTALITE',
            notes: 'Daihatsu Gran Max Blindvan Logistik'
        },
        {
            id: 'FLT-GMX-003',
            plate_number: 'B 9158 SCE',
            vehicle_category: 'granmax',
            vehicle_type: 'mobil',
            assigned_person_id: 'romi',
            assigned_person_name: 'Romi',
            assigned_role: 'driver',
            assigned_person_phone: '6281298765432',
            tax_due_date: '2026-10-25', // Overdue (Lewat Jatuh Tempo)
            kir_due_date: '2026-11-08',
            service_due_date: '2026-11-02', // H-3 (Warning H-7)
            service_details: 'Ganti Oli Mesin, Filter Oli, Kuras Radiator Coolant, Kampas Rem Belakang',
            fuel_barcode_code: 'BBM-GMX-9158-PERTALITE',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-GMX-9158-PERTALITE',
            notes: 'Daihatsu Gran Max Blindvan Distribusi'
        },
        {
            id: 'FLT-GMX-004',
            plate_number: 'B 9278 SCD',
            vehicle_category: 'granmax',
            vehicle_type: 'mobil',
            assigned_person_id: 'alan',
            assigned_person_name: 'Alan',
            assigned_role: 'driver',
            assigned_person_phone: '6281234567890',
            tax_due_date: '2027-01-14',
            kir_due_date: '2026-11-05', // H-6 (Warning H-7)
            service_due_date: '2026-11-25',
            service_details: 'Ganti Oli Mesin, Cek Fan Belt, Tune Up Busi, Rotasi Ban',
            fuel_barcode_code: 'BBM-GMX-9278-PERTALITE',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-GMX-9278-PERTALITE',
            notes: 'Daihatsu Gran Max Blindvan Pasar Minggu'
        },
        {
            id: 'FLT-GMX-005',
            plate_number: 'B 9107 SCE',
            vehicle_category: 'granmax',
            vehicle_type: 'mobil',
            assigned_person_id: 'yakub',
            assigned_person_name: 'Yakub',
            assigned_role: 'driver',
            assigned_person_phone: '6281288776655',
            tax_due_date: '2027-02-20',
            kir_due_date: '2027-01-18',
            service_due_date: '2026-11-30',
            service_details: 'Servis Berkala: Ganti Oli Mesin & Transmisi, Filter Bensin, Cek Kelistrikan',
            fuel_barcode_code: 'BBM-GMX-9107-PERTALITE',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-GMX-9107-PERTALITE',
            notes: 'Daihatsu Gran Max Box Pendingin / Delivery'
        },
        {
            id: 'FLT-GMX-006',
            plate_number: 'B 1004 BKP',
            vehicle_category: 'granmax',
            vehicle_type: 'mobil',
            assigned_person_id: 'gudang',
            assigned_person_name: 'Gudang',
            assigned_role: 'driver',
            assigned_person_phone: '', // KOSONG -> Warning Validasi No WA!
            tax_due_date: '2026-11-06', // H-7 (Warning H-7)
            kir_due_date: '2026-11-10',
            service_due_date: '2026-12-05',
            service_details: 'Ganti Oli Mesin (15W-40), Filter Oli, Cek Shock Absorber & Per Daun Bak',
            fuel_barcode_code: 'BBM-GMX-1004BKP-SOLAR',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-GMX-1004BKP-SOLAR',
            notes: 'Daihatsu Gran Max Bak Kayu Pick Up (BKP) - Operasional Gudang'
        },

        // ================= KATEGORI 2: TRUCK BOX (4 UNIT) =================
        {
            id: 'FLT-TRK-001',
            plate_number: 'B 9032 SCG',
            vehicle_category: 'truck_box',
            vehicle_type: 'mobil',
            assigned_person_id: 'iwan',
            assigned_person_name: 'Iwan',
            assigned_role: 'driver',
            assigned_person_phone: '6281399887766',
            tax_due_date: '2027-03-10',
            kir_due_date: '2026-10-27', // Overdue Uji KIR Kemenhub!
            service_due_date: '2026-11-05', // H-6 (Warning H-7)
            service_details: 'Ganti Oli Mesin (15W-40 Heavy Duty), Filter Solar Ganda, Kuras Angin Rem Tabung, Cek Gardan',
            fuel_barcode_code: 'BBM-TRK-9032-SOLAR',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-TRK-9032-SOLAR',
            notes: 'Truck Box Isuzu Elf NMR 71 L Heavy Duty'
        },
        {
            id: 'FLT-TRK-002',
            plate_number: 'B 9177 SCH',
            vehicle_category: 'truck_box',
            vehicle_type: 'mobil',
            assigned_person_id: 'husen',
            assigned_person_name: 'Husen',
            assigned_role: 'driver',
            assigned_person_phone: '6281211223388',
            tax_due_date: '2026-11-04', // H-5 (Warning H-7)
            kir_due_date: '2026-11-28',
            service_due_date: '2026-11-15',
            service_details: 'Ganti Oli Mesin, Filter Oli, Filter Solar, Grease / Gemuk As Roda, Cek Kampas Rem Tromol',
            fuel_barcode_code: 'BBM-TRK-9177-SOLAR',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-TRK-9177-SOLAR',
            notes: 'Truck Box Mitsubishi Fuso Canter 125 PS'
        },
        {
            id: 'FLT-TRK-003',
            plate_number: 'B 9842 NCC',
            vehicle_category: 'truck_box',
            vehicle_type: 'mobil',
            assigned_person_id: 'altur',
            assigned_person_name: 'Altur',
            assigned_role: 'driver',
            assigned_person_phone: '628123456701',
            tax_due_date: '2027-01-22',
            kir_due_date: '2027-02-14',
            service_due_date: '2026-11-01', // H-2 (Warning H-7)
            service_details: 'Servis Rutin Berkala: Ganti Oli Mesin, Filter Udara, Cek Kampas Rem Angin, Cek Tekanan Ban Ganda',
            fuel_barcode_code: 'BBM-TRK-9842-SOLAR',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-TRK-9842-SOLAR',
            notes: 'Truck Box Isuzu Giga FRR Long Chasis'
        },
        {
            id: 'FLT-TRK-004',
            plate_number: 'B 9084 SCH',
            vehicle_category: 'truck_box',
            vehicle_type: 'mobil',
            assigned_person_id: 'rizki',
            assigned_person_name: 'Rizki',
            assigned_role: 'driver',
            assigned_person_phone: '628123456702',
            tax_due_date: '2026-12-08',
            kir_due_date: '2026-11-02', // H-3 (Warning H-7)
            service_due_date: '2026-11-18',
            service_details: 'Ganti Oli Mesin, Filter Solar Utama & Water Separator, Cek Suspensi & Power Steering',
            fuel_barcode_code: 'BBM-TRK-9084-SOLAR',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-TRK-9084-SOLAR',
            notes: 'Truck Box Hino Dutro 130 HD Cargo'
        },

        // ================= KATEGORI 3: PICKUP & L 300 (2 UNIT) =================
        {
            id: 'FLT-PKP-001',
            plate_number: 'B 9463 SAJ',
            vehicle_category: 'pickup',
            vehicle_type: 'mobil',
            assigned_person_id: 'gudang',
            assigned_person_name: 'Gudang',
            assigned_role: 'driver',
            assigned_person_phone: '', // KOSONG -> Warning Validasi No WA!
            tax_due_date: '2026-11-20',
            kir_due_date: '2026-11-06', // H-7 (Warning H-7)
            service_due_date: '2026-12-10',
            service_details: 'Ganti Oli Mesin, Filter Udara, Cek Bak & Baut Chasis Pick Up',
            fuel_barcode_code: 'BBM-PKP-9463-PERTALITE',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-PKP-9463-PERTALITE',
            notes: 'Mobil Pick Up Bak Terbuka - Operasional Gudang'
        },
        {
            id: 'FLT-L30-001',
            plate_number: 'B 9243 PCJ',
            vehicle_category: 'l300',
            vehicle_type: 'mobil',
            assigned_person_id: 'gudang',
            assigned_person_name: 'Gudang',
            assigned_role: 'driver',
            assigned_person_phone: '', // KOSONG -> Warning Validasi No WA!
            tax_due_date: '2026-11-15',
            kir_due_date: '2026-11-03', // H-4 (Warning H-7)
            service_due_date: '2026-11-28',
            service_details: 'Ganti Oli Mesin Diesel, Filter Solar, Kuras Radiator Coolant, Cek Minyak Rem',
            fuel_barcode_code: 'BBM-L300-9243-SOLAR',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-L300-9243-SOLAR',
            notes: 'Mitsubishi L300 Box / Bak - Operasional Gudang'
        }
    ];

    // Master Personil (Driver Armada Operasional Perusahaan)
    const MASTER_PERSONIL = [
        { id: 'agung', name: 'Agung', role: 'driver', vehicleType: 'mobil' },
        { id: 'soleh', name: 'Soleh', role: 'driver', vehicleType: 'mobil' },
        { id: 'romi', name: 'Romi', role: 'driver', vehicleType: 'mobil' },
        { id: 'alan', name: 'Alan', role: 'driver', vehicleType: 'mobil' },
        { id: 'yakub', name: 'Yakub', role: 'driver', vehicleType: 'mobil' },
        { id: 'gudang', name: 'Gudang', role: 'driver', vehicleType: 'mobil' },
        { id: 'iwan', name: 'Iwan', role: 'driver', vehicleType: 'mobil' },
        { id: 'husen', name: 'Husen', role: 'driver', vehicleType: 'mobil' },
        { id: 'altur', name: 'Altur', role: 'driver', vehicleType: 'mobil' },
        { id: 'rizki', name: 'Rizki', role: 'driver', vehicleType: 'mobil' }
    ];

    // RBAC Guard helper
    function assertSuperAdmin() {
        const role = (window.currentUserRole || (typeof currentUserRole !== 'undefined' ? currentUserRole : '')).toLowerCase();
        const isSuperAdmin = (role === 'super_admin' || role === 'superadmin' || role === 'admin');
        if (!isSuperAdmin) {
            console.error('[RBAC_DENIED] Akses ditolak: Modul fleet_vehicles hanya untuk Super Admin.');
            throw new Error('403 Forbidden: Modul fleet_vehicles hanya dapat diakses oleh Super Admin.');
        }
        return true;
    }

    // Local Storage & Supabase Sync Layer
    function getStoredFleet() {
        assertSuperAdmin();
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_FLEET));
                return DEFAULT_FLEET;
            }
            return JSON.parse(raw);
        } catch (e) {
            console.warn('[FLEET_STORAGE] Fallback to default fleet:', e);
            return DEFAULT_FLEET;
        }
    }

    function saveStoredFleet(list) {
        assertSuperAdmin();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    function formatPrettyDate(dateStr) {
        if (!dateStr) return '-';
        const parts = String(dateStr).trim().split('-');
        if (parts.length !== 3) return dateStr;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const mIdx = parseInt(parts[1], 10) - 1;
        return `${parseInt(parts[2], 10)} ${months[mIdx] || parts[1]} ${parts[0]}`;
    }

    // Date Difference and Status Evaluation
    function evaluateDateDue(dateStr) {
        if (!dateStr) return { diffDays: 9999, status: 'none', label: '-', pillStyle: 'background-color: #f1f5f9; color: #64748b;' };
        const target = new Date(dateStr + 'T00:00:00');
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffMs = target.getTime() - today.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return {
                diffDays: diffDays,
                status: 'overdue',
                isOverdue: true,
                isWarningH7: false,
                badgeClass: 'bg-danger text-white',
                label: `Lewat ${Math.abs(diffDays)} Hari`,
                pillStyle: 'background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;'
            };
        } else if (diffDays <= 7) {
            return {
                diffDays: diffDays,
                status: 'warning_h7',
                isOverdue: false,
                isWarningH7: true,
                badgeClass: 'bg-warning text-dark',
                label: diffDays === 0 ? 'Hari Ini (H-0)' : `H-${diffDays} Hari`,
                pillStyle: 'background-color: #fffbeb; color: #b45309; border: 1px solid #fde68a;'
            };
        } else {
            return {
                diffDays: diffDays,
                status: 'safe',
                isOverdue: false,
                isWarningH7: false,
                badgeClass: 'bg-success-subtle text-success border border-success-subtle',
                label: `${diffDays} Hari Lagi`,
                pillStyle: 'background-color: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0;'
            };
        }
    }

    function evaluateVehicleAlerts(v) {
        const taxAlert = evaluateDateDue(v.tax_due_date);
        const kirAlert = evaluateDateDue(v.kir_due_date);
        const serviceAlert = evaluateDateDue(v.service_due_date);

        const isOverdueOverall = taxAlert.isOverdue || (kirAlert && kirAlert.isOverdue) || serviceAlert.isOverdue;
        const isH7Overall = !isOverdueOverall && (taxAlert.isWarningH7 || (kirAlert && kirAlert.isWarningH7) || serviceAlert.isWarningH7);
        const hasDueNotice = isOverdueOverall || isH7Overall;

        // WhatsApp Validation Rule: If in H-7 or Overdue BUT phone is empty
        const isMissingPhone = !v.assigned_person_phone || v.assigned_person_phone.trim() === '';
        const phoneRequiredWarning = hasDueNotice && isMissingPhone;

        return {
            taxAlert,
            kirAlert,
            serviceAlert,
            isOverdueOverall,
            isH7Overall,
            hasDueNotice,
            isMissingPhone,
            phoneRequiredWarning
        };
    }

    function cleanWhatsAppPhone(phone) {
        if (!phone) return '';
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        } else if (cleaned.startsWith('8')) {
            cleaned = '62' + cleaned;
        }
        return cleaned;
    }

    function buildWhatsAppReminderUrl(vehicle, ev) {
        const cleanPhone = cleanWhatsAppPhone(vehicle.assigned_person_phone);
        if (!cleanPhone) return '#';

        const notices = [];
        if (ev.taxAlert.isOverdue) notices.push(`• Pajak/STNK: SUDAH LEWAT JATUH TEMPO (${vehicle.tax_due_date})`);
        else if (ev.taxAlert.isWarningH7) notices.push(`• Pajak/STNK: Jatuh tempo ${ev.taxAlert.label} (${vehicle.tax_due_date})`);

        if (ev.kirAlert && ev.kirAlert.isOverdue) notices.push(`• Uji KIR Kemenhub: SUDAH LEWAT JATUH TEMPO (${vehicle.kir_due_date})`);
        else if (ev.kirAlert && ev.kirAlert.isWarningH7) notices.push(`• Uji KIR Kemenhub: Jatuh tempo ${ev.kirAlert.label} (${vehicle.kir_due_date})`);

        if (ev.serviceAlert.isOverdue) notices.push(`• Jadwal Servis: SUDAH LEWAT JADWAL (${vehicle.service_due_date})`);
        else if (ev.serviceAlert.isWarningH7) notices.push(`• Jadwal Servis: Jadwal servis ${ev.serviceAlert.label} (${vehicle.service_due_date})`);

        if (vehicle.service_details) {
            notices.push(`• Rincian Item Servis: ${vehicle.service_details}`);
        }

        const msg = `Halo ${vehicle.assigned_person_name || 'Rekan Driver'},\n\n` +
            `Pemberitahuan resmi pemeliharaan armada Wtrack Logistics:\n` +
            `Unit Kendaraan: ${vehicle.plate_number} (${(vehicle.vehicle_category || 'mobil').toUpperCase()})\n` +
            (vehicle.notes ? `Catatan: ${vehicle.notes}\n\n` : '\n') +
            `Daftar Status & Jatuh Tempo:\n` +
            (notices.length > 0 ? notices.join('\n') : '• Semua masa berlaku & jadwal servis terpantau aman.') +
            `\n\nMohon lakukan persiapan dokumen STNK/KIR dan perawatan berkala di bengkel rekanan. Terima kasih atas kerjasamanya! 🙏\n- Manajemen Operasional & Armada PT Wellen Print`;

        return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    }

    // Render Main Fleet Table & UI
    function renderFleetInventoryView() {
        const container = document.getElementById('view-fleet-inventory');
        if (!container) return;

        // UI Guard
        const role = (window.currentUserRole || (typeof currentUserRole !== 'undefined' ? currentUserRole : '')).toLowerCase();
        const isSuperAdmin = (role === 'super_admin' || role === 'superadmin' || role === 'admin');
        if (!isSuperAdmin) {
            container.innerHTML = `
                <div class="border rounded-4 p-5 bg-white text-center my-4 shadow-sm">
                    <div class="mb-3 text-danger"><i class="bi bi-shield-lock-fill" style="font-size: 3rem;"></i></div>
                    <h4 class="fw-bold text-dark">403 - Akses Dibatasi</h4>
                    <p class="text-muted">Modul Inventaris Armada hanya dapat diakses oleh user dengan wewenang <b>Super Admin</b>.</p>
                    <button class="btn btn-dark fw-bold px-4 py-2" onclick="switchTab('dashboard')">Kembali ke Dashboard</button>
                </div>
            `;
            return;
        }

        const fleet = getStoredFleet();
        const filterType = document.getElementById('fleet-filter-type')?.value || 'all';
        const filterStatus = document.getElementById('fleet-filter-status')?.value || 'all';
        const searchKeyword = (document.getElementById('fleet-search-input')?.value || '').toLowerCase().trim();

        // Calculate Overview Stats
        let totalCount = fleet.length;
        let granmaxCount = 0;
        let truckBoxCount = 0;
        let pickupCount = 0;
        let l300Count = 0;
        let warningH7Count = 0;
        let overdueCount = 0;
        let missingPhoneCount = 0;

        const evaluatedList = fleet.map(v => {
            const ev = evaluateVehicleAlerts(v);
            let cat = (v.vehicle_category || '').toLowerCase();
            if (!cat) {
                if (v.notes && v.notes.toLowerCase().includes('truck')) cat = 'truck_box';
                else if (v.notes && (v.notes.toLowerCase().includes('pick up') || v.notes.toLowerCase().includes('pickup'))) cat = 'pickup';
                else if (v.notes && v.notes.toLowerCase().includes('l300')) cat = 'l300';
                else cat = 'granmax';
            }

            if (cat === 'truck_box') truckBoxCount++;
            else if (cat === 'pickup') pickupCount++;
            else if (cat === 'l300') l300Count++;
            else granmaxCount++;

            if (ev.isOverdueOverall) overdueCount++;
            else if (ev.isH7Overall) warningH7Count++;
            if (ev.phoneRequiredWarning) missingPhoneCount++;
            return { vehicle: v, ev, category: cat };
        });

        // Update Stat Cards in DOM
        const elTotal = document.getElementById('fleet-stat-total');
        const elGranmax = document.getElementById('fleet-stat-granmax');
        const elTruckbox = document.getElementById('fleet-stat-truckbox');
        const elPickupL300 = document.getElementById('fleet-stat-pickupl300');
        const elAttention = document.getElementById('fleet-stat-attention');
        const elH7 = document.getElementById('fleet-stat-h7');
        const elOverdue = document.getElementById('fleet-stat-overdue');
        const elMissingPhone = document.getElementById('fleet-stat-missing-phone');

        if (elTotal) elTotal.innerText = totalCount;
        if (elGranmax) elGranmax.innerText = granmaxCount;
        if (elTruckbox) elTruckbox.innerText = truckBoxCount;
        if (elPickupL300) elPickupL300.innerText = pickupCount + l300Count;
        if (elAttention) elAttention.innerText = overdueCount + warningH7Count;
        if (elH7) elH7.innerText = warningH7Count;
        if (elOverdue) elOverdue.innerText = overdueCount;
        if (elMissingPhone) elMissingPhone.innerText = missingPhoneCount;

        // Filter Rows
        const filtered = evaluatedList.filter(item => {
            const v = item.vehicle;
            const ev = item.ev;
            const cat = item.category;

            if (filterType !== 'all') {
                if (filterType === 'granmax' && cat !== 'granmax') return false;
                if (filterType === 'truck_box' && cat !== 'truck_box') return false;
                if (filterType === 'pickup' && cat !== 'pickup') return false;
                if (filterType === 'l300' && cat !== 'l300') return false;
            }

            if (filterStatus === 'warning_h7' && !ev.isH7Overall) return false;
            if (filterStatus === 'overdue' && !ev.isOverdueOverall) return false;
            if (filterStatus === 'attention' && !ev.hasDueNotice) return false;
            if (filterStatus === 'missing_phone' && !ev.phoneRequiredWarning) return false;

            if (searchKeyword) {
                const searchStr = `${v.plate_number} ${v.assigned_person_name || ''} ${cat} ${v.fuel_barcode_code || ''} ${v.assigned_person_phone || ''} ${v.service_details || ''} ${v.notes || ''}`.toLowerCase();
                if (!searchStr.includes(searchKeyword)) return false;
            }

            return true;
        });

        const tbody = document.getElementById('fleet-table-body');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted"><i class="bi bi-truck fs-2 d-block mb-2 text-secondary"></i>Tidak ada kendaraan yang cocok dengan filter.</td></tr>`;
            return;
        }

        const rowsHtml = filtered.map((item, index) => {
            const v = item.vehicle;
            const ev = item.ev;
            const cat = item.category;
            const isGranmax = (cat === 'granmax');

            let catBadge = '';
            if (cat === 'granmax') {
                catBadge = `<span class="badge" style="background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 0.65rem; font-weight: 700; border-radius: 4px; padding: 2px 6px;">GRANMAX</span>`;
            } else if (cat === 'truck_box') {
                catBadge = `<span class="badge" style="background-color: #fffbeb; color: #b45309; border: 1px solid #fde68a; font-size: 0.65rem; font-weight: 700; border-radius: 4px; padding: 2px 6px;">TRUCK BOX</span>`;
            } else if (cat === 'pickup') {
                catBadge = `<span class="badge" style="background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 0.65rem; font-weight: 700; border-radius: 4px; padding: 2px 6px;">PICK UP</span>`;
            } else if (cat === 'l300') {
                catBadge = `<span class="badge" style="background-color: #faf5ff; color: #6b21a8; border: 1px solid #e9d5ff; font-size: 0.65rem; font-weight: 700; border-radius: 4px; padding: 2px 6px;">L 300</span>`;
            } else {
                catBadge = `<span class="badge" style="background-color: #f8fafc; color: #475569; border: 1px solid #e2e8f0; font-size: 0.65rem; font-weight: 700; border-radius: 4px; padding: 2px 6px;">${cat.toUpperCase()}</span>`;
            }

            // WhatsApp Column Content
            let waCellHtml = '';
            const cleanPhone = cleanWhatsAppPhone(v.assigned_person_phone);

            if (cleanPhone) {
                const waUrl = buildWhatsAppReminderUrl(v, ev);
                waCellHtml = `
                    <div class="d-flex align-items-center gap-1.5">
                        <a href="${waUrl}" target="_blank" rel="noopener noreferrer" 
                           class="btn btn-sm py-1 px-2.5 d-inline-flex align-items-center gap-1.5 fw-semibold text-decoration-none shadow-none" 
                           style="background-color: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 0.75rem;" 
                           title="Kirim Pesan WhatsApp Langsung">
                            <i class="bi bi-whatsapp text-success"></i>
                            <span>+${cleanPhone}</span>
                        </a>
                        <button class="btn btn-sm btn-outline-secondary py-1 px-1.5" style="border-radius: 6px; font-size: 0.68rem; border-color: #e2e8f0;" onclick="window.fleetModule.openQuickPhoneModal('${v.id}')" title="Edit Nomor HP">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </div>
                `;
            } else {
                waCellHtml = `
                    <button class="btn btn-sm btn-outline-danger py-1 px-2 fw-semibold d-inline-flex align-items-center gap-1" style="border-radius: 6px; font-size: 0.72rem;" onclick="window.fleetModule.openQuickPhoneModal('${v.id}')">
                        <i class="bi bi-plus-circle me-1"></i>Isi No HP
                    </button>
                `;
            }

            // WhatsApp Missing Warning Banner Row if in H-7 or Overdue
            let warningAlertRow = '';
            if (ev.phoneRequiredWarning) {
                warningAlertRow = `
                    <div class="text-danger extra-small fw-semibold mt-1 d-flex align-items-center gap-1" style="font-size: 0.68rem; line-height: 1.2;">
                        <i class="bi bi-exclamation-circle-fill"></i>
                        <span>Wajib diisi untuk notifikasi!</span>
                    </div>
                `;
            }

            // Due Date Badges
            const taxBadge = `
                <div class="d-flex flex-column align-items-start gap-1">
                    <div class="fw-semibold text-dark" style="font-size: 0.82rem;">
                        ${formatPrettyDate(v.tax_due_date)}
                    </div>
                    <span class="badge" style="${ev.taxAlert.pillStyle} font-size: 0.65rem; font-weight: 600; border-radius: 4px; padding: 2px 6px;">
                        ${ev.taxAlert.label}
                    </span>
                </div>
            `;

            const kirBadge = `
                <div class="d-flex flex-column align-items-start gap-1">
                    <div class="fw-semibold text-dark" style="font-size: 0.82rem;">
                        ${v.kir_due_date ? formatPrettyDate(v.kir_due_date) : '-'}
                    </div>
                    ${v.kir_due_date && ev.kirAlert ? `
                        <span class="badge" style="${ev.kirAlert.pillStyle} font-size: 0.65rem; font-weight: 600; border-radius: 4px; padding: 2px 6px;">
                            ${ev.kirAlert.label}
                        </span>
                    ` : `<span class="badge" style="background-color: #f8fafc; color: #94a3b8; border: 1px solid #e2e8f0; font-size: 0.65rem; font-weight: 500; border-radius: 4px; padding: 2px 6px;">- Bebas KIR -</span>`}
                </div>
            `;

            const serviceBadge = `
                <div class="d-flex flex-column align-items-start gap-1">
                    <div class="fw-semibold text-dark" style="font-size: 0.82rem;">
                        ${formatPrettyDate(v.service_due_date)}
                    </div>
                    <span class="badge" style="${ev.serviceAlert.pillStyle} font-size: 0.65rem; font-weight: 600; border-radius: 4px; padding: 2px 6px;">
                        ${ev.serviceAlert.label}
                    </span>
                    ${v.service_details ? `
                        <div class="mt-1 d-flex align-items-center gap-1 flex-wrap">
                            <span class="badge text-start text-truncate fw-normal" 
                                  style="max-width: 165px; background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; font-size: 0.68rem; padding: 2.5px 6px; border-radius: 4px;" 
                                  title="${v.service_details}">
                                🔧 ${v.service_details}
                            </span>
                            <button class="btn btn-sm btn-link p-0 text-primary fw-semibold text-decoration-none" 
                                    style="font-size: 0.68rem;" 
                                    onclick="window.fleetModule.openServiceDetailModal('${v.id}')">
                                Detail
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;

            // Row style highlight: delicate left border stripe instead of heavy background fill
            let rowStyle = '';
            if (ev.isOverdueOverall) {
                rowStyle = 'style="background-color: #fffafb; border-left: 3.5px solid #ef4444;"';
            } else if (ev.isH7Overall) {
                rowStyle = 'style="background-color: #fffdfa; border-left: 3.5px solid #f59e0b;"';
            } else {
                rowStyle = 'style="border-left: 3.5px solid transparent;"';
            }

            // Driver Initials Avatar
            const initials = (v.assigned_person_name || 'D').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

            return `
                <tr ${rowStyle}>
                    <!-- 1. NOPOL (Proporsional & Elegan) -->
                    <td class="text-nowrap py-3">
                        <div class="d-inline-flex flex-column align-items-start gap-1">
                            <div class="nopol-box font-monospace fw-bold text-white shadow-xs"
                                 style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 6px; padding: 2.5px 8px; font-size: 0.8rem; letter-spacing: 0.04em; border: 1px solid #334155; display: inline-block;">
                                ${v.plate_number}
                            </div>
                            <div class="mt-0.5">
                                ${catBadge}
                            </div>
                        </div>
                    </td>

                    <!-- 2. DRIVER -->
                    <td class="py-3">
                        <div class="d-flex align-items-center gap-2">
                            <div class="rounded-circle d-flex align-items-center justify-content-center text-dark fw-bold"
                                 style="width: 32px; height: 32px; background: #e0e7ff; color: #3730a3; font-size: 0.75rem; flex-shrink: 0; border: 1px solid #c7d2fe;">
                                ${initials}
                            </div>
                            <div class="fw-bold text-dark text-truncate" style="font-size: 0.85rem; max-width: 160px;">
                                ${v.assigned_person_name || '-'}
                            </div>
                        </div>
                    </td>

                    <!-- 3. NO HP & ALERT -->
                    <td class="py-3" style="min-width: 180px;">
                        ${waCellHtml}
                        ${warningAlertRow}
                    </td>

                    <!-- 4. PAJAK -->
                    <td class="text-nowrap py-3">
                        ${taxBadge}
                    </td>

                    <!-- 5. KIR -->
                    <td class="text-nowrap py-3">
                        ${kirBadge}
                    </td>

                    <!-- 6. Jadwal & Rincian Servis -->
                    <td class="py-3" style="min-width: 220px; max-width: 280px;">
                        ${serviceBadge}
                    </td>

                    <!-- 7. AKSI -->
                    <td class="text-nowrap py-3 text-end">
                        <div class="d-flex align-items-center justify-content-end gap-1.5">
                            <button class="btn btn-sm btn-outline-secondary py-1 px-2.5 fw-semibold" 
                                    style="border-radius: 6px; font-size: 0.72rem; border-color: #cbd5e1; color: #334155; background: #ffffff;" 
                                    onclick="window.fleetModule.openEditFleetModal('${v.id}')" title="Edit Data Kendaraan">
                                <i class="bi bi-pencil me-1 text-muted"></i>Edit
                            </button>
                            <button class="btn btn-sm btn-outline-danger py-1 px-2 fw-semibold" 
                                    style="border-radius: 6px; font-size: 0.72rem; border-color: #fecaca; color: #dc2626; background: #ffffff;" 
                                    onclick="window.fleetModule.deleteFleetVehicle('${v.id}')" title="Hapus Kendaraan">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rowsHtml;
    }

    // Modal Add / Edit
    function openAddFleetModal() {
        assertSuperAdmin();
        const form = document.getElementById('form-fleet-vehicle');
        if (form) form.reset();
        document.getElementById('fleet-modal-id').value = '';
        document.getElementById('fleet-modal-title').innerText = 'Tambah Kendaraan Armada Baru';
        document.getElementById('fleet-input-service-details').value = '';
        populatePersonilDropdown();
        const modal = new bootstrap.Modal(document.getElementById('modal-fleet-vehicle'));
        modal.show();
    }

    function openEditFleetModal(id) {
        assertSuperAdmin();
        const fleet = getStoredFleet();
        const v = fleet.find(item => item.id === id);
        if (!v) return alert('Data kendaraan tidak ditemukan.');

        populatePersonilDropdown(v.assigned_person_id);
        document.getElementById('fleet-modal-id').value = v.id;
        document.getElementById('fleet-modal-title').innerText = `Edit Kendaraan (${v.plate_number})`;
        document.getElementById('fleet-input-plate').value = v.plate_number;
        
        const catInput = document.getElementById('fleet-input-category');
        if (catInput) catInput.value = v.vehicle_category || (v.notes && v.notes.toLowerCase().includes('truck') ? 'truck_box' : 'granmax');
        
        document.getElementById('fleet-input-phone').value = v.assigned_person_phone || '';
        document.getElementById('fleet-input-tax').value = v.tax_due_date || '';
        document.getElementById('fleet-input-kir').value = v.kir_due_date || '';
        document.getElementById('fleet-input-service').value = v.service_due_date || '';
        document.getElementById('fleet-input-service-details').value = v.service_details || '';
        const barcodeInput = document.getElementById('fleet-input-barcode');
        if (barcodeInput) barcodeInput.value = v.fuel_barcode_code || '';
        document.getElementById('fleet-input-notes').value = v.notes || '';

        const modal = new bootstrap.Modal(document.getElementById('modal-fleet-vehicle'));
        modal.show();
    }

    function appendServiceTag(tagName) {
        const area = document.getElementById('fleet-input-service-details');
        if (!area) return;
        const current = area.value.trim();
        if (current.includes(tagName)) return;
        area.value = current.length > 0 ? `${current}, ${tagName}` : tagName;
    }

    function populatePersonilDropdown(selectedId = '') {
        const sel = document.getElementById('fleet-input-personil');
        if (!sel) return;
        const opts = ['<option value="">-- Pilih Driver --</option>'];
        MASTER_PERSONIL.forEach(p => {
            const isSel = p.id === selectedId ? 'selected' : '';
            opts.push(`<option value="${p.id}" data-role="${p.role}" ${isSel}>${p.name}</option>`);
        });
        sel.innerHTML = opts.join('');
    }

    function onPersonilSelectChange() {
        const sel = document.getElementById('fleet-input-personil');
        const opt = sel.options[sel.selectedIndex];
        if (!opt || !opt.value) return;
    }

    function toggleKirField() {
        // Commercial vehicles always show KIR
        const kirContainer = document.getElementById('fleet-kir-container');
        if (kirContainer) kirContainer.style.display = 'block';
    }

    function saveFleetVehicle() {
        assertSuperAdmin();
        const id = document.getElementById('fleet-modal-id').value;
        const plate = document.getElementById('fleet-input-plate').value.trim().toUpperCase();
        const category = document.getElementById('fleet-input-category')?.value || 'granmax';
        const personilSel = document.getElementById('fleet-input-personil');
        const personilId = personilSel.value;
        const personilName = personilSel.options[personilSel.selectedIndex]?.text || '';
        const phone = document.getElementById('fleet-input-phone').value.trim();
        const taxDue = document.getElementById('fleet-input-tax').value;
        const kirDue = document.getElementById('fleet-input-kir').value || null;
        const serviceDue = document.getElementById('fleet-input-service').value;
        const serviceDetails = document.getElementById('fleet-input-service-details').value.trim();
        const barcodeCode = document.getElementById('fleet-input-barcode')?.value?.trim() || '';
        const notes = document.getElementById('fleet-input-notes').value.trim() || (category === 'truck_box' ? 'Truck Box Operasional' : 'Daihatsu Gran Max Operasional');

        if (!plate || !taxDue || !serviceDue) {
            return alert('Harap isi Nopol, Jatuh Tempo Pajak, dan Tanggal Servis!');
        }

        const fleet = getStoredFleet();
        const barcodeUrl = barcodeCode ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(barcodeCode)}` : null;

        if (id) {
            // Update
            const idx = fleet.findIndex(item => item.id === id);
            if (idx !== -1) {
                fleet[idx] = {
                    ...fleet[idx],
                    plate_number: plate,
                    vehicle_category: category,
                    vehicle_type: 'mobil',
                    assigned_person_id: personilId,
                    assigned_person_name: personilName,
                    assigned_role: 'driver',
                    assigned_person_phone: phone,
                    tax_due_date: taxDue,
                    kir_due_date: kirDue,
                    service_due_date: serviceDue,
                    service_details: serviceDetails,
                    fuel_barcode_code: barcodeCode,
                    fuel_barcode_url: barcodeUrl,
                    notes: notes,
                    updated_at: new Date().toISOString()
                };
            }
        } else {
            // Create
            const newId = 'FLT-' + Date.now().toString().slice(-4);
            fleet.unshift({
                id: newId,
                plate_number: plate,
                vehicle_category: category,
                vehicle_type: 'mobil',
                assigned_person_id: personilId,
                assigned_person_name: personilName,
                assigned_role: 'driver',
                assigned_person_phone: phone,
                tax_due_date: taxDue,
                kir_due_date: kirDue,
                service_due_date: serviceDue,
                service_details: serviceDetails,
                fuel_barcode_code: barcodeCode,
                fuel_barcode_url: barcodeUrl,
                notes: notes,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }

        saveStoredFleet(fleet);
        const modalEl = document.getElementById('modal-fleet-vehicle');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        renderFleetInventoryView();
        showFleetToast(id ? 'Data armada berhasil diperbarui!' : 'Kendaraan armada baru berhasil ditambahkan!');
    }

    function deleteFleetVehicle(id) {
        assertSuperAdmin();
        const fleet = getStoredFleet();
        const v = fleet.find(item => item.id === id);
        if (!v) return;

        if (!confirm(`Apakah Anda yakin ingin menghapus armada "${v.plate_number}" (${v.assigned_person_name || 'Driver'}) dari inventaris?`)) {
            return;
        }

        const filtered = fleet.filter(item => item.id !== id);
        saveStoredFleet(filtered);
        renderFleetInventoryView();
        showFleetToast('Kendaraan armada berhasil dihapus.');
    }

    // Quick Update Phone Modal
    function openQuickPhoneModal(vehicleId) {
        assertSuperAdmin();
        const fleet = getStoredFleet();
        const v = fleet.find(item => item.id === vehicleId);
        if (!v) return;

        document.getElementById('quick-phone-vehicle-id').value = v.id;
        document.getElementById('quick-phone-plate').innerText = v.plate_number;
        document.getElementById('quick-phone-personil').innerText = v.assigned_person_name || 'Driver';
        document.getElementById('quick-phone-input').value = v.assigned_person_phone || '';

        const modal = new bootstrap.Modal(document.getElementById('modal-quick-phone'));
        modal.show();
    }

    function saveQuickPhone() {
        assertSuperAdmin();
        const id = document.getElementById('quick-phone-vehicle-id').value;
        const phone = document.getElementById('quick-phone-input').value.trim();

        const fleet = getStoredFleet();
        const v = fleet.find(item => item.id === id);
        if (v) {
            v.assigned_person_phone = phone;
            v.updated_at = new Date().toISOString();
            saveStoredFleet(fleet);
        }

        const modalEl = document.getElementById('modal-quick-phone');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        renderFleetInventoryView();
        showFleetToast('Nomor WhatsApp driver berhasil disimpan!');
    }

    // Barcode BBM Preview Modal (Deprecated per user instruction)
    function openFuelBarcodeModal(vehicleId) {
        // Fitur scan barcode dihapus sesuai instruksi
    }

    function showFleetToast(msg) {
        if (typeof showToast === 'function') {
            showToast(msg);
        } else {
            console.log('[FLEET_TOAST]', msg);
        }
    }

    // EXCEL EXPORT (Corporate Styled with Kop, Colors, and Granmax/Truck Box Grouping)
    async function exportFleetToExcel() {
        assertSuperAdmin();
        if (typeof ExcelJS === 'undefined') {
            return alert('Library ExcelJS belum termuat. Silakan periksa koneksi atau refresh browser.');
        }

        const fleet = getStoredFleet();
        if (!fleet || fleet.length === 0) {
            return alert('Tidak ada data inventaris armada untuk diekspor.');
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'PT Wellen Print - Fleet Management System';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Inventaris Armada');
        sheet.views = [{ showGridLines: true }];

        const now = new Date();
        const printDateFormatted = now.toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        // Calculate statistics
        const totalVehicles = fleet.length;
        let totalGranmax = 0;
        let totalTruckBox = 0;
        let totalPickupL300 = 0;
        let totalOverdue = 0;
        let totalH7 = 0;
        let totalMissingWa = 0;

        const enrichedList = fleet.map(v => {
            const ev = evaluateVehicleAlerts(v);
            let cat = (v.vehicle_category || '').toLowerCase();
            if (!cat) {
                if (v.notes && v.notes.toLowerCase().includes('truck')) cat = 'truck_box';
                else if (v.notes && (v.notes.toLowerCase().includes('pick up') || v.notes.toLowerCase().includes('pickup'))) cat = 'pickup';
                else if (v.notes && v.notes.toLowerCase().includes('l300')) cat = 'l300';
                else cat = 'granmax';
            }
            if (cat === 'truck_box') totalTruckBox++;
            else if (cat === 'pickup' || cat === 'l300') totalPickupL300++;
            else totalGranmax++;

            if (ev.isOverdueOverall) totalOverdue++;
            else if (ev.isH7Overall) totalH7++;
            if (ev.phoneRequiredWarning) totalMissingWa++;
            return { v, ev, cat };
        });

        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };

        // 1. KOP RESMI PERUSAHAAN (Row 1-3)
        sheet.mergeCells('A1:N1');
        const kopTitle = sheet.getCell('A1');
        kopTitle.value = "PT WELLEN PRINT  •  DIVISI LOGISTIK & DISTRIBUSI PUSAT";
        kopTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        kopTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Deep Dark Navy
        kopTitle.alignment = { vertical: 'middle', horizontal: 'center' };
        sheet.getRow(1).height = 28;

        sheet.mergeCells('A2:N2');
        const reportTitle = sheet.getCell('A2');
        reportTitle.value = "LAPORAN KONTROL INVENTARIS ARMADA OPERASIONAL PERUSAHAAN";
        reportTitle.font = { name: 'Calibri', size: 11.5, bold: true, color: { argb: 'FFFFFFFF' } };
        reportTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Corporate Blue
        reportTitle.alignment = { vertical: 'middle', horizontal: 'center' };
        sheet.getRow(2).height = 22;

        sheet.mergeCells('A3:N3');
        const kopMeta = sheet.getCell('A3');
        kopMeta.value = `Tanggal Cetak: ${printDateFormatted}  |  Hak Akses: SUPER ADMIN ONLY  |  Pengawasan Terpadu Armada Operasional`;
        kopMeta.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF334155' } };
        kopMeta.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        kopMeta.alignment = { vertical: 'middle', horizontal: 'center' };
        sheet.getRow(3).height = 18;

        // Row 4: KPI Summary Strip
        sheet.mergeCells('A4:C4');
        const kpi1 = sheet.getCell('A4');
        kpi1.value = `Total Armada: ${totalVehicles} Unit (${totalGranmax} Granmax, ${totalTruckBox} Truck Box, ${totalPickupL300} Pick Up/L300)`;
        kpi1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        kpi1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        kpi1.alignment = { vertical: 'middle', horizontal: 'center' };
        kpi1.border = thinBorder;

        sheet.mergeCells('D4:G4');
        const kpi2 = sheet.getCell('D4');
        kpi2.value = `Peringatan Jatuh Tempo: ${totalH7} Unit (H-7)  |  Lewat Jatuh Tempo: ${totalOverdue} Unit (Urgent)`;
        kpi2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: totalOverdue > 0 ? 'FFDC2626' : 'FFD97706' } };
        kpi2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: totalOverdue > 0 ? 'FFFEF2F2' : 'FFFFFBEB' } };
        kpi2.alignment = { vertical: 'middle', horizontal: 'center' };
        kpi2.border = thinBorder;

        sheet.mergeCells('H4:N4');
        const kpi3 = sheet.getCell('H4');
        kpi3.value = `Validasi WhatsApp Driver: ${totalMissingWa > 0 ? `⚠️ ${totalMissingWa} Driver Belum Isi No WA!` : '✓ Lengkap 100%'}`;
        kpi3.font = { name: 'Calibri', size: 10, bold: true, color: { argb: totalMissingWa > 0 ? 'FFDC2626' : 'FF16A34A' } };
        kpi3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: totalMissingWa > 0 ? 'FFFEF2F2' : 'FFF0FDF4' } };
        kpi3.alignment = { vertical: 'middle', horizontal: 'center' };
        kpi3.border = thinBorder;
        sheet.getRow(4).height = 20;

        // Row 5: Blank Separator
        sheet.getRow(5).height = 8;

        // Row 6: Main Column Headers
        const headerRow = sheet.getRow(6);
        headerRow.height = 28;
        const columns = [
            "No", "NOPOL", "Kategori Armada", "DRIVER", "Peran", 
            "NO HP", "PAJAK", "Status Pajak", "KIR", 
            "Status KIR", "Tanggal Servis", "Status Servis", 
            "Rincian Item Servis", "Catatan Armada"
        ];

        columns.forEach((colName, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = colName;
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top: { style: 'medium', color: { argb: 'FF0F172A' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
        });

        let rowIndex = 7;

        const renderVehicleGroup = (title, items, groupType) => {
            if (items.length === 0) return;

            const isTruck = (groupType === 'truck_box');
            const isPickupL300 = (groupType === 'pickup_l300');
            const headerFg = isTruck ? 'FF92400E' : (isPickupL300 ? 'FF065F46' : 'FF1E40AF');
            const headerBg = isTruck ? 'FFFEF3C7' : (isPickupL300 ? 'FFD1FAE5' : 'FFDBEAFE');

            sheet.mergeCells(`A${rowIndex}:N${rowIndex}`);
            const groupCell = sheet.getCell(`A${rowIndex}`);
            groupCell.value = title;
            groupCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: headerFg } };
            groupCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBg } };
            groupCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            groupCell.border = thinBorder;
            sheet.getRow(rowIndex).height = 22;
            rowIndex++;

            items.forEach((item, num) => {
                const v = item.v;
                const ev = item.ev;
                const row = sheet.getRow(rowIndex++);
                row.height = 24;

                const cleanPhone = cleanWhatsAppPhone(v.assigned_person_phone);
                const phoneDisplay = cleanPhone ? `+${cleanPhone}` : '[WA BELUM DIISI - WAJIB]';
                const catLabel = item.cat === 'truck_box' ? 'Truck Box' : (item.cat === 'pickup' ? 'Pick Up' : (item.cat === 'l300' ? 'Mitsubishi L300' : 'Granmax'));

                const rowValues = [
                    num + 1,
                    v.plate_number,
                    catLabel,
                    v.assigned_person_name || '-',
                    'DRIVER',
                    phoneDisplay,
                    v.tax_due_date,
                    ev.taxAlert.label,
                    v.kir_due_date || '-',
                    ev.kirAlert ? ev.kirAlert.label : '-',
                    v.service_due_date,
                    ev.serviceAlert.label,
                    v.service_details || 'Servis Berkala Standar',
                    v.notes || '-'
                ];

                rowValues.forEach((val, cIdx) => {
                    const cell = row.getCell(cIdx + 1);
                    cell.value = val;
                    cell.font = { name: 'Calibri', size: 9.5 };
                    cell.border = thinBorder;
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

                    // Column 1: Number Center
                    if (cIdx === 0) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }
                    // Column 2: Plate Number bold
                    if (cIdx === 1) {
                        cell.font = { name: 'Consolas', size: 10, bold: true };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }
                    // Column 6: WhatsApp alert
                    if (cIdx === 5 && !cleanPhone) {
                        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFDC2626' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
                    }
                    // Status alert colors
                    if ((cIdx === 7 && ev.taxAlert.isOverdue) || (cIdx === 9 && ev.kirAlert?.isOverdue) || (cIdx === 11 && ev.serviceAlert.isOverdue)) {
                        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFDC2626' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
                    } else if ((cIdx === 7 && ev.taxAlert.isWarningH7) || (cIdx === 9 && ev.kirAlert?.isWarningH7) || (cIdx === 11 && ev.serviceAlert.isWarningH7)) {
                        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFD97706' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
                    }
                });
            });
        };

        const granmaxList = enrichedList.filter(item => item.cat === 'granmax');
        const truckBoxList = enrichedList.filter(item => item.cat === 'truck_box');
        const pickupL300List = enrichedList.filter(item => item.cat === 'pickup' || item.cat === 'l300');

        renderVehicleGroup(`ARMADA DAIHATSU GRANMAX (${granmaxList.length} UNIT)`, granmaxList, 'granmax');
        renderVehicleGroup(`ARMADA TRUCK BOX KARGO (${truckBoxList.length} UNIT)`, truckBoxList, 'truck_box');
        renderVehicleGroup(`ARMADA OPERASIONAL PICK UP & MITSUBISHI L 300 (${pickupL300List.length} UNIT)`, pickupL300List, 'pickup_l300');

        // Column widths
        sheet.getColumn(1).width = 6;   // No
        sheet.getColumn(2).width = 16;  // No. Polisi
        sheet.getColumn(3).width = 16;  // Kategori
        sheet.getColumn(4).width = 22;  // Driver
        sheet.getColumn(5).width = 12;  // Peran
        sheet.getColumn(6).width = 24;  // No. WhatsApp
        sheet.getColumn(7).width = 14;  // Pajak
        sheet.getColumn(8).width = 18;  // Status Pajak
        sheet.getColumn(9).width = 14;  // KIR
        sheet.getColumn(10).width = 18; // Status KIR
        sheet.getColumn(11).width = 14; // Servis
        sheet.getColumn(12).width = 18; // Status Servis
        sheet.getColumn(13).width = 38; // Detail Servis
        sheet.getColumn(14).width = 30; // Catatan

        // Download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileDate = now.toISOString().split('T')[0];
        a.download = `Laporan_Armada_Wtrack_${fileDate}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showFleetToast('Laporan Excel armada berhasil di-generate!');
    }

    function openServiceDetailModal(id) {
        const fleet = getStoredFleet();
        const v = fleet.find(item => item.id === id);
        if (!v) return;

        let modalEl = document.getElementById('modal-service-detail');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'modal-service-detail';
            modalEl.className = 'modal fade';
            modalEl.tabIndex = -1;
            modalEl.innerHTML = `
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content rounded-4 border-0 shadow">
                        <div class="modal-header border-bottom pb-3">
                            <h6 class="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                                <i class="bi bi-tools text-primary"></i>
                                <span id="service-modal-title">Rincian Servis Berkala</span>
                            </h6>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-4" id="service-modal-body">
                        </div>
                        <div class="modal-footer border-top pt-2">
                            <button type="button" class="btn btn-sm btn-light fw-bold" data-bs-dismiss="modal">Tutup</button>
                            <button type="button" class="btn btn-sm btn-primary fw-bold" id="service-modal-edit-btn">Edit Rincian</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modalEl);
        }

        const titleEl = document.getElementById('service-modal-title');
        if (titleEl) titleEl.innerText = `Rincian Servis: ${v.plate_number}`;
        
        const bodyEl = document.getElementById('service-modal-body');
        const rawItems = v.service_details || 'Servis Berkala / Rutin';
        const items = rawItems.split(/[,;•\n]+/).map(s => s.trim()).filter(Boolean);

        if (bodyEl) {
            bodyEl.innerHTML = `
                <div class="d-flex align-items-center justify-content-between p-3 rounded-3 mb-3" style="background: #f8fafc; border: 1px solid #e2e8f0;">
                    <div>
                        <div class="extra-small text-muted text-uppercase fw-bold">Nomor Polisi</div>
                        <div class="font-monospace fw-bold text-dark fs-6">${v.plate_number}</div>
                    </div>
                    <div>
                        <div class="extra-small text-muted text-uppercase fw-bold">Driver</div>
                        <div class="fw-semibold text-dark">${v.assigned_person_name || '-'}</div>
                    </div>
                    <div>
                        <div class="extra-small text-muted text-uppercase fw-bold">Tanggal Servis</div>
                        <div class="fw-bold text-primary font-monospace">${formatPrettyDate(v.service_due_date)}</div>
                    </div>
                </div>
                <div class="mb-2">
                    <div class="extra-small text-muted text-uppercase fw-bold mb-2">Item Pekerjaan / Penggantian Part:</div>
                    <ul class="list-group list-group-flush rounded-3 border">
                        ${items.map(item => `
                            <li class="list-group-item d-flex align-items-center gap-2.5 py-2.5 px-3 small text-dark">
                                <i class="bi bi-check2-circle text-primary fs-6"></i>
                                <span class="fw-medium">${item}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        const editBtn = document.getElementById('service-modal-edit-btn');
        if (editBtn) {
            editBtn.onclick = () => {
                const bsModal = bootstrap.Modal.getInstance(modalEl);
                if (bsModal) bsModal.hide();
                openEditFleetModal(v.id);
            };
        }

        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    }

    // Public module exports
    window.fleetModule = {
        renderFleetInventoryView,
        openAddFleetModal,
        openEditFleetModal,
        deleteFleetVehicle,
        saveFleetVehicle,
        openQuickPhoneModal,
        saveQuickPhone,
        openFuelBarcodeModal,
        openServiceDetailModal,
        toggleKirField,
        onPersonilSelectChange,
        appendServiceTag,
        exportFleetToExcel,
        getStoredFleet
    };

    // Auto-init on load if super admin
    document.addEventListener('DOMContentLoaded', function() {
        if (document.getElementById('view-fleet-inventory')) {
            renderFleetInventoryView();
        }
    });

})();
