// ==============================================================================
// WTRACK LOGISTICS - VEHICLE FLEET INVENTORY MODULE (SUPER ADMIN ONLY)
// Dedicated Company Fleet: Granmax & Truk box
// (Motor vehicles are excluded per company policy as personal vehicles)
// ==============================================================================

(function() {
    'use strict';

    const STORAGE_KEY = 'wtrack_fleet_vehicles_v6';
    const CENTRAL_PHONE_KEY = 'wtrack_fleet_central_phone';
    const DEFAULT_CENTRAL_PHONE = '6281210203040';

    // 12 Company Operational Vehicles (6 Granmax, 4 Truk Box, 1 Pick Up, 1 L300)
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
            notes: 'Granmax Operasional'
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
            notes: 'Granmax Logistik'
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
            notes: 'Granmax Distribusi'
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
            notes: 'Granmax Operasional'
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
            service_details: 'Servis Berkala: Ganti Oli Mesin & Transmisi, Filter Bensin, Cek Gas Pendingin Box',
            fuel_barcode_code: 'BBM-GMX-9107-PERTALITE',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-GMX-9107-PERTALITE',
            notes: 'Granmax Box Pendingin'
        },
        {
            id: 'FLT-GMX-006',
            plate_number: 'B 1004 BKP',
            vehicle_category: 'granmax',
            vehicle_type: 'mobil',
            assigned_person_id: 'gudang',
            assigned_person_name: 'Gudang',
            assigned_role: 'driver',
            assigned_person_phone: '',
            tax_due_date: '2026-11-06', // H-7 (Warning H-7)
            kir_due_date: '2026-11-10',
            service_due_date: '2026-12-05',
            service_details: 'Ganti Oli Mesin (15W-40), Filter Oli, Cek Shock Absorber & Per Daun Bak',
            fuel_barcode_code: 'BBM-GMX-1004BKP-SOLAR',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-GMX-1004BKP-SOLAR',
            notes: 'Pick Up Bak Gudang'
        },

        // ================= KATEGORI 2: TRUK BOX (4 UNIT) =================
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
            kir_due_date: '2026-10-27', // Overdue Uji KIR!
            service_due_date: '2026-11-05', // H-6 (Warning H-7)
            service_details: 'Ganti Oli Mesin (15W-40 Heavy Duty), Filter Solar Ganda, Kuras Angin Rem Tabung, Cek Gardan',
            fuel_barcode_code: 'BBM-TRK-9032-SOLAR',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-TRK-9032-SOLAR',
            notes: 'Truk box Heavy Duty'
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
            service_details: 'Ganti Oli Mesin, Filter Oli, Filter Solar, Gemuk As Roda, Cek Kampas Rem Tromol',
            fuel_barcode_code: 'BBM-TRK-9177-SOLAR',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-TRK-9177-SOLAR',
            notes: 'Truk box Logistik'
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
            service_details: 'Servis Rutin Berkala: Ganti Oli Mesin, Filter Udara, Cek Kampas Rem Angin, Cek Ban Ganda',
            fuel_barcode_code: 'BBM-TRK-9842-SOLAR',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-TRK-9842-SOLAR',
            notes: 'Truk box Long Chasis'
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
            notes: 'Truk box Kargo'
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
            assigned_person_phone: '',
            tax_due_date: '2026-11-20',
            kir_due_date: '2026-11-06', // H-7 (Warning H-7)
            service_due_date: '2026-12-10',
            service_details: 'Ganti Oli Mesin, Filter Udara, Cek Bak & Baut Chasis Pick Up',
            fuel_barcode_code: 'BBM-PKP-9463-PERTALITE',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-PKP-9463-PERTALITE',
            notes: 'Pick Up Operasional'
        },
        {
            id: 'FLT-L30-001',
            plate_number: 'B 9243 PCJ',
            vehicle_category: 'l300',
            vehicle_type: 'mobil',
            assigned_person_id: 'gudang',
            assigned_person_name: 'Gudang',
            assigned_role: 'driver',
            assigned_person_phone: '',
            tax_due_date: '2026-11-15',
            kir_due_date: '2026-11-03', // H-4 (Warning H-7)
            service_due_date: '2026-11-28',
            service_details: 'Ganti Oli Mesin Diesel, Filter Solar, Kuras Radiator Coolant, Cek Minyak Rem',
            fuel_barcode_code: 'BBM-L300-9243-SOLAR',
            fuel_barcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BBM-L300-9243-SOLAR',
            notes: 'L 300 Operasional'
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

    function generateInitialServiceHistory(v) {
        const id = v.id || '';
        const plate = (v.plate_number || '').toUpperCase();

        if (id === 'FLT-GMX-001' || plate.includes('9227')) {
            return [
                {
                    id: 'SRV-GMX-001-1',
                    date: '2026-08-10',
                    odometer: '42.500 km',
                    workshop: 'Bengkel Rekanan',
                    replaced_items: 'Oli Mesin 10W-40 (3.5L), Filter Oli, Tune Up Busi (4 pcs), Kampas Rem Belakang',
                    notes: 'Servis rutin berkala 40.000 KM, rem dibersihkan dan disetel ulang'
                },
                {
                    id: 'SRV-GMX-001-2',
                    date: '2026-05-15',
                    odometer: '37.800 km',
                    workshop: 'Bengkel Sentosa',
                    replaced_items: 'Oli Mesin 10W-40, Filter Udara, Minyak Rem Dot 3',
                    notes: 'Ganti oli rutin dan pengecekan suspensi depan'
                }
            ];
        }
        if (id === 'FLT-GMX-002' || plate.includes('9939')) {
            return [
                {
                    id: 'SRV-GMX-002-1',
                    date: '2026-08-20',
                    odometer: '39.200 km',
                    workshop: 'Bengkel Rekanan',
                    replaced_items: 'Oli Mesin 10W-40, Filter Oli, Filter Udara, Spooring & Balancing',
                    notes: 'Setir sempat lari ke kiri sedikit, sudah balancing kembali normal'
                },
                {
                    id: 'SRV-GMX-002-2',
                    date: '2026-05-02',
                    odometer: '33.500 km',
                    workshop: 'Bengkel Sahabat',
                    replaced_items: 'Oli Mesin, Filter Oli, Minyak Kopling Dot 3',
                    notes: 'Pengecekan rutin dan ganti oli berkala'
                }
            ];
        }
        if (id === 'FLT-GMX-003' || plate.includes('9158')) {
            return [
                {
                    id: 'SRV-GMX-003-1',
                    date: '2026-07-25',
                    odometer: '51.400 km',
                    workshop: 'Bengkel Jaya Mandiri',
                    replaced_items: 'Aki Kering 45A, Ganti Oli Mesin 10W-40, Bohlam Headlamp H4',
                    notes: 'Aki lama sudah soak / drop voltase, diganti aki baru bergaransi'
                },
                {
                    id: 'SRV-GMX-003-2',
                    date: '2026-04-10',
                    odometer: '46.000 km',
                    workshop: 'Bengkel Rekanan',
                    replaced_items: 'Oli Mesin, Filter Oli, Kuras Radiator Coolant',
                    notes: 'Sistem pendingin mesin dibersihkan'
                }
            ];
        }
        if (id === 'FLT-GMX-004' || plate.includes('9278')) {
            return [
                {
                    id: 'SRV-GMX-004-1',
                    date: '2026-08-25',
                    odometer: '44.100 km',
                    workshop: 'Bengkel Berkah Abadi',
                    replaced_items: 'Oli Mesin 10W-40, Filter Oli, Fan Belt Alternator, Rotasi Ban',
                    notes: 'Fan belt lama ada retak halus, diganti baru agar aman jalan luar kota'
                }
            ];
        }
        if (id === 'FLT-GMX-005' || plate.includes('9107')) {
            return [
                {
                    id: 'SRV-GMX-005-1',
                    date: '2026-08-30',
                    odometer: '36.700 km',
                    workshop: 'Bengkel Rekanan',
                    replaced_items: 'Oli Mesin 10W-40, Oli Transmisi Manual GL-4, Filter Bensin, Cek Gas Pendingin Box',
                    notes: 'Servis transmisi dan filter bensin'
                }
            ];
        }
        if (id === 'FLT-GMX-006' || plate.includes('1004')) {
            return [
                {
                    id: 'SRV-GMX-006-1',
                    date: '2026-09-02',
                    odometer: '58.200 km',
                    workshop: 'Bengkel Surya',
                    replaced_items: 'Oli Mesin Diesel 15W-40, Filter Oli, Karet Bushing Per Daun Bak Belakang, Baut Klem U-Bolt',
                    notes: 'Bushing per belakang aus karena muatan material cetak berat, diganti 1 set'
                }
            ];
        }
        if (id === 'FLT-TRK-001' || plate.includes('9032')) {
            return [
                {
                    id: 'SRV-TRK-001-1',
                    date: '2026-08-05',
                    odometer: '84.500 km',
                    workshop: 'Bengkel Rekanan Resmi',
                    replaced_items: 'Oli Mesin Diesel 15W-40 (12 Liter), Filter Solar Utama, Filter Solar Ganda, Filter Oli, Gemuk As Roda',
                    notes: 'Perawatan rutin truk box berat 80.000 km, rem angin dalam kondisi aman'
                },
                {
                    id: 'SRV-TRK-001-2',
                    date: '2026-04-20',
                    odometer: '77.200 km',
                    workshop: 'Bengkel Diesel Sumber Rejeki',
                    replaced_items: 'Kampas Rem Tromol Roda Belakang, Kuras Minyak Rem Tabung Angin, Oli Gardan SAE 90',
                    notes: 'Pengereman kembali responsif dan pakem'
                }
            ];
        }
        if (id === 'FLT-TRK-002' || plate.includes('9177')) {
            return [
                {
                    id: 'SRV-TRK-002-1',
                    date: '2026-08-14',
                    odometer: '79.100 km',
                    workshop: 'Bengkel Rekanan',
                    replaced_items: 'Oli Mesin Diesel 15W-40, Filter Oli, Filter Solar, Gemuk Gardan',
                    notes: 'Servis berkala truk box, tekanan kompresi silinder bagus'
                }
            ];
        }
        if (id === 'FLT-TRK-003' || plate.includes('9842')) {
            return [
                {
                    id: 'SRV-TRK-003-1',
                    date: '2026-07-30',
                    odometer: '92.400 km',
                    workshop: 'Bengkel Rekanan Resmi',
                    replaced_items: 'Oli Mesin Diesel Heavy Duty (14L), Filter Udara Double Element, Kampas Rem Angin Roda Depan, Filter Solar Atas & Bawah',
                    notes: 'Pembersihan tabung kompresor rem'
                }
            ];
        }
        if (id === 'FLT-TRK-004' || plate.includes('9084')) {
            return [
                {
                    id: 'SRV-TRK-004-1',
                    date: '2026-08-18',
                    odometer: '71.300 km',
                    workshop: 'Bengkel Cikokol',
                    replaced_items: 'Oli Mesin 15W-40, Filter Oli, Filter Solar Utama, Kuras Tabung Power Steering & Minyak ATF',
                    notes: 'Power steering diperiksa, kemudi lancar dan ringan'
                }
            ];
        }
        if (id === 'FLT-PKP-001' || plate.includes('9463')) {
            return [
                {
                    id: 'SRV-PKP-001-1',
                    date: '2026-09-08',
                    odometer: '29.800 km',
                    workshop: 'Bengkel Motor Jaya',
                    replaced_items: 'Oli Mesin 10W-40, Filter Oli, Filter Udara, Busi Standar (4 pcs)',
                    notes: 'Servis berkala pick up operasional'
                }
            ];
        }
        if (id === 'FLT-L30-001' || plate.includes('9243')) {
            return [
                {
                    id: 'SRV-L30-001-1',
                    date: '2026-08-28',
                    odometer: '64.000 km',
                    workshop: 'Bengkel Diesel Mitra Kawan',
                    replaced_items: 'Oli Mesin Diesel, Filter Solar, Kuras Radiator Coolant, Cek Timing Belt',
                    notes: 'Kondisi timing belt masih bagus, radiator bersih'
                }
            ];
        }

        return [
            {
                id: 'SRV-' + Date.now(),
                date: '2026-08-15',
                odometer: '40.000 km',
                workshop: 'Bengkel Rekanan',
                replaced_items: 'Oli Mesin, Filter Oli, Cek Kampas Rem, Tune Up Ringan',
                notes: 'Servis berkala sebelumnya'
            }
        ];
    }

    // Local Storage & Supabase Sync Layer
    function getStoredFleet() {
        assertSuperAdmin();
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            let fleet = raw ? JSON.parse(raw) : null;
            if (!fleet || !Array.isArray(fleet) || fleet.length === 0) {
                fleet = DEFAULT_FLEET;
            }

            // Ensure each vehicle has service_history array initialized
            let updated = false;
            fleet.forEach(v => {
                if (!Array.isArray(v.service_history)) {
                    v.service_history = generateInitialServiceHistory(v);
                    updated = true;
                }
            });

            if (updated || !raw) {
                saveStoredFleet(fleet);
            }
            return fleet;
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

    function getCentralPhone() {
        try {
            const stored = localStorage.getItem(CENTRAL_PHONE_KEY);
            if (stored && stored.trim()) return stored.trim();
        } catch (e) {}
        return DEFAULT_CENTRAL_PHONE;
    }

    function formatPhoneDisplay(p) {
        const raw = String(p || '').replace(/\D/g, '');
        if (raw.startsWith('62')) {
            const body = raw.slice(2);
            if (body.length >= 8) {
                return `+62 ${body.slice(0, 3)}-${body.slice(3, 7)}-${body.slice(7)}`;
            }
            return `+62 ${body}`;
        }
        return raw || '-';
    }

    function saveCentralPhone(newPhone) {
        const cleaned = cleanWhatsAppPhone(newPhone);
        if (!cleaned || cleaned.length < 9) {
            alert('Nomor WhatsApp tidak valid. Masukkan nomor yang benar (contoh: 081210203040).');
            return false;
        }
        localStorage.setItem(CENTRAL_PHONE_KEY, cleaned);
        showFleetToast('Nomor WhatsApp Alert berhasil diperbarui!');
        renderFleetInventoryView();
        return true;
    }

    function openEditCentralPhoneModal() {
        const current = getCentralPhone();
        const input = prompt('Ubah Nomor WhatsApp Alert Operasional:\n(Contoh: 081210203040 atau 6281210203040)', current);
        if (input !== null && input.trim()) {
            saveCentralPhone(input.trim());
        }
    }

    function sendCentralAlertWhatsApp() {
        const centralPhone = getCentralPhone();
        const fleet = getStoredFleet();
        
        const needAttention = [];
        fleet.forEach(v => {
            const ev = evaluateVehicleAlerts(v);
            const issues = [];
            if (ev.isOverdueOverall) {
                if (ev.taxAlert.isOverdue) issues.push(`Pajak LEWAT (${formatPrettyDate(v.tax_due_date)})`);
                if (ev.kirAlert && ev.kirAlert.isOverdue) issues.push(`KIR LEWAT (${formatPrettyDate(v.kir_due_date)})`);
                if (ev.serviceAlert.isOverdue) issues.push(`Servis LEWAT (${formatPrettyDate(v.service_due_date)})`);
            } else if (ev.isH7Overall) {
                if (ev.taxAlert.isH7) issues.push(`Pajak H-${ev.taxAlert.daysLeft} (${formatPrettyDate(v.tax_due_date)})`);
                if (ev.kirAlert && ev.kirAlert.isH7) issues.push(`KIR H-${ev.kirAlert.daysLeft} (${formatPrettyDate(v.kir_due_date)})`);
                if (ev.serviceAlert.isH7) issues.push(`Servis H-${ev.serviceAlert.daysLeft} (${formatPrettyDate(v.service_due_date)})`);
            }
            if (issues.length > 0) {
                needAttention.push({
                    plate: v.plate_number,
                    driver: v.assigned_person_name || 'Driver',
                    issues: issues.join(', ')
                });
            }
        });

        const todayFormatted = new Date().toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        let msg = `*REKAP ALERT & NOTIFIKASI ARMADA WTRACK*\nTanggal: ${todayFormatted}\n\n`;
        if (needAttention.length === 0) {
            msg += `✅ Seluruh armada operasional (${fleet.length} unit) terpantau aman dan belum ada jatuh tempo H-7 atau overdue.`;
        } else {
            msg += `⚠️ Ditemukan *${needAttention.length} armada* perlu perhatian:\n\n`;
            needAttention.forEach((item, idx) => {
                msg += `${idx + 1}. *${item.plate}* (${item.driver})\n   • ${item.issues}\n\n`;
            });
            msg += `Mohon segera ditindaklanjuti untuk perpanjangan atau jadwal servis bengkel. Terima kasih.`;
        }

        const waUrl = `https://wa.me/${centralPhone}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
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

        // Update Central WhatsApp Alert Display in Toolbar
        const elCentralPhone = document.getElementById('fleet-central-phone-display');
        if (elCentralPhone) {
            elCentralPhone.innerText = formatPhoneDisplay(getCentralPhone());
        }

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

            if (searchKeyword) {
                const searchStr = `${v.plate_number} ${v.assigned_person_name || ''} ${cat} ${v.fuel_barcode_code || ''} ${v.assigned_person_phone || ''} ${v.service_details || ''} ${v.notes || ''}`.toLowerCase();
                if (!searchStr.includes(searchKeyword)) return false;
            }

            return true;
        });

        const tbody = document.getElementById('fleet-table-body');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted"><i class="bi bi-truck fs-2 d-block mb-2 text-secondary"></i>Tidak ada kendaraan yang cocok dengan filter.</td></tr>`;
            return;
        }

        const rowsHtml = filtered.map((item, index) => {
            const v = item.vehicle;
            const ev = item.ev;
            const cat = item.category;

            let catBadge = '';
            if (cat === 'granmax') {
                catBadge = `<span class="badge" style="background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 0.65rem; font-weight: 700; border-radius: 4px; padding: 2px 6px;">GRANMAX</span>`;
            } else if (cat === 'truck_box') {
                catBadge = `<span class="badge" style="background-color: #fffbeb; color: #b45309; border: 1px solid #fde68a; font-size: 0.65rem; font-weight: 700; border-radius: 4px; padding: 2px 6px;">TRUK BOX</span>`;
            } else if (cat === 'pickup') {
                catBadge = `<span class="badge" style="background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 0.65rem; font-weight: 700; border-radius: 4px; padding: 2px 6px;">PICK UP</span>`;
            } else if (cat === 'l300') {
                catBadge = `<span class="badge" style="background-color: #faf5ff; color: #6b21a8; border: 1px solid #e9d5ff; font-size: 0.65rem; font-weight: 700; border-radius: 4px; padding: 2px 6px;">L 300</span>`;
            } else {
                catBadge = `<span class="badge" style="background-color: #f8fafc; color: #475569; border: 1px solid #e2e8f0; font-size: 0.65rem; font-weight: 700; border-radius: 4px; padding: 2px 6px;">${cat.toUpperCase()}</span>`;
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

            const historyList = Array.isArray(v.service_history) ? v.service_history : [];
            const historyCount = historyList.length;
            const lastService = historyCount > 0 ? historyList[0] : null;

            const serviceBadge = `
                <div class="d-flex flex-column align-items-start gap-1">
                    <div class="d-flex align-items-center gap-1.5 flex-wrap">
                        <span class="fw-semibold text-dark" style="font-size: 0.82rem;">
                            ${formatPrettyDate(v.service_due_date)}
                        </span>
                        <span class="badge" style="${ev.serviceAlert.pillStyle} font-size: 0.65rem; font-weight: 600; border-radius: 4px; padding: 2px 6px;">
                            ${ev.serviceAlert.label}
                        </span>
                    </div>

                    ${v.service_details ? `
                        <div class="mt-0.5">
                            <span class="badge text-start text-truncate fw-normal d-inline-block" 
                                  style="max-width: 220px; background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; font-size: 0.68rem; padding: 2.5px 6px; border-radius: 4px;" 
                                  title="Rencana servis berikutnya: ${v.service_details}">
                                🔧 ${v.service_details}
                            </span>
                        </div>
                    ` : ''}

                    <div class="mt-1 d-flex flex-column align-items-start gap-0.5">
                        <button class="btn btn-xs btn-outline-secondary d-inline-flex align-items-center gap-1.5 py-0.5 px-2 rounded-2 fw-semibold" 
                                style="font-size: 0.7rem; border-color: #cbd5e1; background: #ffffff; color: #334155;" 
                                onclick="window.fleetModule.openServiceHistoryModal('${v.id}')">
                            <i class="bi bi-clock-history text-secondary"></i>
                            <span>Riwayat Servis</span>
                            <span class="badge bg-light text-secondary border rounded-pill px-1.5 py-0.2" style="font-size: 0.62rem;">${historyCount}</span>
                        </button>
                        ${lastService ? `
                            <div class="extra-small text-muted mt-0.5" style="font-size: 0.66rem;" title="Servis Terakhir (${formatPrettyDate(lastService.date)}): ${lastService.replaced_items}">
                                <i class="bi bi-check2 text-secondary me-0.5"></i> Terakhir: <b>${formatPrettyDate(lastService.date)}</b>
                            </div>
                        ` : ''}
                    </div>
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

            // Driver Initials Avatar & Photo
            const initials = (v.assigned_person_name || 'D').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
            const driverPhotoUrl = (typeof window.getCourierPhoto === 'function') ? window.getCourierPhoto(v.assigned_person_id, v.assigned_person_name) : null;

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
                            ${driverPhotoUrl 
                                ? `<img src="${driverPhotoUrl}" class="rounded-circle shadow-xs" style="width: 32px; height: 32px; object-fit: cover; border: 1.5px solid #c7d2fe; flex-shrink: 0;" alt="${v.assigned_person_name}">`
                                : `<div class="rounded-circle d-flex align-items-center justify-content-center text-dark fw-bold" style="width: 32px; height: 32px; background: #e0e7ff; color: #3730a3; font-size: 0.75rem; flex-shrink: 0; border: 1px solid #c7d2fe;">${initials}</div>`
                            }
                            <div class="fw-bold text-dark text-truncate" style="font-size: 0.85rem; max-width: 160px;">
                                ${v.assigned_person_name || '-'}
                            </div>
                        </div>
                    </td>

                    <!-- 3. PAJAK -->
                    <td class="text-nowrap py-3">
                        ${taxBadge}
                    </td>

                    <!-- 4. KIR -->
                    <td class="text-nowrap py-3">
                        ${kirBadge}
                    </td>

                    <!-- 5. JADWAL & SERVIS -->
                    <td class="py-3" style="min-width: 220px; max-width: 280px;">
                        ${serviceBadge}
                    </td>

                    <!-- 6. AKSI -->
                    <td class="text-nowrap py-3 text-end">
                        <div class="d-flex align-items-center justify-content-end gap-1.5">
                            <button class="btn btn-sm btn-outline-secondary py-1 px-2.5 fw-semibold" 
                                    style="border-radius: 6px; font-size: 0.72rem; border-color: #cbd5e1; color: #334155; background: #ffffff;" 
                                    onclick="window.fleetModule.openEditFleetModal('${v.id}')" title="Edit Data Kendaraan">
                                <i class="bi bi-pencil me-1 text-muted"></i>Edit
                            </button>
                            <button class="btn btn-sm py-1 px-2 fw-semibold" 
                                    style="border-radius: 6px; font-size: 0.72rem; border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; background: rgba(239, 68, 68, 0.08); transition: all 0.2s;" 
                                    onmouseover="this.style.background='rgba(239, 68, 68, 0.18)'; this.style.color='#dc2626';"
                                    onmouseout="this.style.background='rgba(239, 68, 68, 0.08)'; this.style.color='#ef4444';"
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
        const notes = document.getElementById('fleet-input-notes').value.trim() || (category === 'truck_box' ? 'Truk box Operasional' : 'Granmax Operasional');

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
                const catLabel = item.cat === 'truck_box' ? 'Truk box' : (item.cat === 'pickup' ? 'Pick Up' : (item.cat === 'l300' ? 'L 300' : 'Granmax'));

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

        renderVehicleGroup(`ARMADA GRANMAX (${granmaxList.length} UNIT)`, granmaxList, 'granmax');
        renderVehicleGroup(`ARMADA TRUK BOX (${truckBoxList.length} UNIT)`, truckBoxList, 'truck_box');
        renderVehicleGroup(`ARMADA OPERASIONAL PICK UP & L 300 (${pickupL300List.length} UNIT)`, pickupL300List, 'pickup_l300');

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

    // ==============================================================================
    // DRIBBLE-INSPIRED MODERN STEPPER MODAL: RIWAYAT & LOG SERVIS ARMADA
    // Sample Reference: https://dribbble.com/shots/27178378-Add-Property-Stepper-Form
    // ==============================================================================
    let currentServiceVehicleId = null;
    let currentServiceStep = 1;

    function openServiceHistoryModal(id, initialStep = 1, prefillUpcoming = false) {
        const fleet = getStoredFleet();
        const v = fleet.find(item => item.id === id);
        if (!v) return;

        currentServiceVehicleId = v.id;

        let modalEl = document.getElementById('modal-service-history');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'modal-service-history';
            modalEl.className = 'modal fade';
            modalEl.tabIndex = -1;
            modalEl.style.zIndex = '2150';
            modalEl.innerHTML = `
                <div class="modal-dialog modal-dialog-centered modal-xl" style="max-width: 980px;">
                    <div class="modal-content border-0 shadow-lg" style="overflow: hidden; border-radius: 20px;">
                        <!-- Header (Dribbble Stepper Header) -->
                        <div class="modal-header border-bottom py-3 px-4 d-flex align-items-center justify-content-between" style="background: #fafbfc; border-color: #e2e8f0;">
                            <div class="d-flex align-items-center gap-3">
                                <button type="button" class="btn btn-sm btn-white border rounded-circle d-flex align-items-center justify-content-center p-0 shadow-xs" 
                                        style="width: 36px; height: 36px; background: #ffffff; border-color: #e2e8f0;" data-bs-dismiss="modal" title="Kembali / Tutup">
                                    <i class="bi bi-arrow-left text-dark"></i>
                                </button>
                                <div>
                                    <div class="d-flex align-items-center gap-2">
                                        <h6 class="modal-title fw-bold text-dark mb-0 fs-6">Manajemen & Riwayat Servis Armada</h6>
                                        <span class="badge border font-monospace px-2 py-0.5 rounded-2" id="hist-modal-plate" style="background: rgba(37, 99, 235, 0.08); color: #1d4ed8; border-color: rgba(37, 99, 235, 0.2); font-size: 0.75rem;">-</span>
                                    </div>
                                    <div class="extra-small text-muted mt-0.5" id="hist-modal-subtitle">Pencatatan log servis berkala, riwayat penggantian suku cadang, dan jadwal armada operasional.</div>
                                </div>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>

                        <!-- Body (Two-Column Layout: Left Stepper Navigation + Right Main Content) -->
                        <div class="modal-body p-0 bg-white">
                            <div class="d-flex" style="height: 600px; max-height: calc(85vh - 70px);">
                                <!-- Left Column: Stepper Progress & Info Navigation (Dribbble Style) -->
                                <div class="p-4 border-end d-flex flex-column justify-content-between" style="width: 295px; flex-shrink: 0; background: #fafbfc; height: 100%; border-color: #e2e8f0;">
                                    <div>
                                        <div class="mb-3.5">
                                            <div class="extra-small text-uppercase fw-bold text-muted" style="letter-spacing: 0.05em; font-size: 0.7rem;">Alur & Navigasi Servis</div>
                                            <div class="small fw-semibold text-dark mt-0.5" id="stepper-progress-label">Langkah 1 dari 3: Riwayat Servis</div>
                                            <div class="progress mt-1.5" style="height: 5px; background: #e2e8f0; border-radius: 99px;">
                                                <div class="progress-bar" id="stepper-progress-bar" style="width: 33%; background: #2563eb; border-radius: 99px; transition: width 0.3s ease;"></div>
                                            </div>
                                        </div>

                                        <!-- Stepper Nav Items -->
                                        <div class="d-flex flex-column gap-2" id="stepper-nav-items">
                                            <!-- Step 1 Nav -->
                                            <div class="stepper-nav-item p-2.5 rounded-3 border d-flex align-items-start gap-2.5" id="step-nav-1" onclick="window.fleetModule.setServiceModalStep(1)" style="cursor: pointer; transition: all 0.2s; background: #ffffff; border-color: #e2e8f0;">
                                                <div class="step-num-badge rounded-2 d-flex align-items-center justify-content-center fw-bold" style="width: 26px; height: 26px; font-size: 0.78rem; flex-shrink: 0; background: #2563eb; color: #ffffff;" id="step-num-1">1</div>
                                                <div>
                                                    <div class="fw-bold text-dark extra-small mb-0.5">Riwayat Servis Selesai</div>
                                                    <div class="text-muted" style="font-size: 0.72rem;" id="step-sub-1">Log & suku cadang diganti</div>
                                                </div>
                                            </div>

                                            <!-- Step 2 Nav -->
                                            <div class="stepper-nav-item p-2.5 rounded-3 border d-flex align-items-start gap-2.5" id="step-nav-2" onclick="window.fleetModule.setServiceModalStep(2)" style="cursor: pointer; transition: all 0.2s; background: #ffffff; border-color: #e2e8f0;">
                                                <div class="step-num-badge rounded-2 d-flex align-items-center justify-content-center fw-bold" style="width: 26px; height: 26px; font-size: 0.78rem; flex-shrink: 0; background: #f1f5f9; color: #64748b;" id="step-num-2">2</div>
                                                <div>
                                                    <div class="fw-bold text-dark extra-small mb-0.5">Jadwal Servis Rutin</div>
                                                    <div class="text-muted" style="font-size: 0.72rem;" id="step-sub-2">Jatuh tempo & rencana item</div>
                                                </div>
                                            </div>

                                            <!-- Step 3 Nav -->
                                            <div class="stepper-nav-item p-2.5 rounded-3 border d-flex align-items-start gap-2.5" id="step-nav-3" onclick="window.fleetModule.setServiceModalStep(3)" style="cursor: pointer; transition: all 0.2s; background: #ffffff; border-color: #e2e8f0;">
                                                <div class="step-num-badge rounded-2 d-flex align-items-center justify-content-center fw-bold" style="width: 26px; height: 26px; font-size: 0.78rem; flex-shrink: 0; background: #f1f5f9; color: #64748b;" id="step-num-3">3</div>
                                                <div>
                                                    <div class="fw-bold text-dark extra-small mb-0.5">Catat Servis Baru</div>
                                                    <div class="text-muted" style="font-size: 0.72rem;">Formulir log & input part</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Bottom Info Card (Persis Kotak Need Assistance Dribbble dengan Soft Style) -->
                                    <div class="p-3 rounded-3 mt-3 border shadow-xs" style="background: rgba(240, 249, 255, 0.6); border-color: #bae6fd;">
                                        <div class="d-flex align-items-center gap-1.5 mb-2">
                                            <i class="bi bi-info-circle text-primary" style="font-size: 0.85rem;"></i>
                                            <span class="fw-bold text-primary extra-small text-uppercase" style="letter-spacing: 0.04em;">Info Kendaraan</span>
                                        </div>
                                        <div class="extra-small text-muted d-flex flex-column gap-1" id="hist-sidebar-meta">
                                            <!-- Injected dynamically -->
                                        </div>
                                    </div>
                                </div>

                                <!-- Right Column: Main Content Panels (Step 1, Step 2, Step 3) -->
                                <div class="p-4 d-flex flex-column justify-content-between flex-grow-1" style="min-width: 0; height: 100%;">
                                    <div id="hist-panels-wrapper" style="overflow-y: auto; flex-grow: 1; padding-right: 6px;">
                                        <!-- Step 1 Panel: Riwayat Servis Selesai -->
                                        <div id="step-panel-1" class="step-panel">
                                            <div class="mb-3.5 pb-2.5 border-bottom d-flex align-items-center justify-content-between">
                                                <div>
                                                    <h6 class="fw-bold text-dark mb-1">Daftar Riwayat Servis Selesai</h6>
                                                    <p class="text-muted extra-small m-0">Semua catatan servis berkala dan riwayat penggantian suku cadang kendaraan ini.</p>
                                                </div>
                                                <button type="button" class="btn btn-sm fw-semibold px-3 py-1.5 rounded-2 d-inline-flex align-items-center gap-1" 
                                                        style="background: rgba(37, 99, 235, 0.08); color: #1d4ed8; border: 1px solid rgba(37, 99, 235, 0.2); font-size: 0.75rem;"
                                                        onclick="window.fleetModule.setServiceModalStep(3)">
                                                    <i class="bi bi-plus-lg"></i> Tambah Log
                                                </button>
                                            </div>
                                            <div id="step-panel-1-list">
                                                <!-- Injected dynamically -->
                                            </div>
                                        </div>

                                        <!-- Step 2 Panel: Jadwal Servis Rutin Mendatang -->
                                        <div id="step-panel-2" class="step-panel" style="display: none;">
                                            <div class="mb-3.5 pb-2.5 border-bottom">
                                                <h6 class="fw-bold text-dark mb-1">Jadwal Servis Rutin Mendatang</h6>
                                                <p class="text-muted extra-small m-0">Estimasi jadwal pemeliharaan berkala berikutnya berdasarkan standar operasional armada.</p>
                                            </div>
                                            <div id="step-panel-2-content">
                                                <!-- Injected dynamically -->
                                            </div>
                                        </div>

                                        <!-- Step 3 Panel: Formulir Catat Servis Baru (Form Stepper Dribbble) -->
                                        <div id="step-panel-3" class="step-panel" style="display: none;">
                                            <div class="mb-3.5 pb-2.5 border-bottom">
                                                <h6 class="fw-bold text-dark mb-1">Formulir Log Servis Baru</h6>
                                                <p class="text-muted extra-small m-0">Masukkan data pengerjaan servis, kilometer kendaraan, dan suku cadang yang diganti.</p>
                                            </div>
                                            <form id="form-stepper-service-record" onsubmit="event.preventDefault(); window.fleetModule.saveServiceRecord();">
                                                <input type="hidden" id="add-srv-vehicle-id">

                                                <!-- Row 1: Tanggal & Kilometer -->
                                                <div class="row g-3 mb-3">
                                                    <div class="col-md-6">
                                                        <label class="form-label extra-small fw-bold text-muted text-uppercase mb-1">Tanggal Pengerjaan Servis *</label>
                                                        <input type="date" id="add-srv-date" class="form-control form-control-sm rounded-3 py-2" style="background: #fafbfc; border-color: #cbd5e1;" required>
                                                    </div>
                                                    <div class="col-md-6">
                                                        <label class="form-label extra-small fw-bold text-muted text-uppercase mb-1">Kilometer Odometer</label>
                                                        <input type="text" id="add-srv-km" class="form-control form-control-sm rounded-3 py-2" style="background: #fafbfc; border-color: #cbd5e1;" placeholder="Contoh: 45.000 km">
                                                    </div>
                                                </div>

                                                <!-- Row 2: Tempat Bengkel -->
                                                <div class="mb-3">
                                                    <label class="form-label extra-small fw-bold text-muted text-uppercase mb-1">Tempat Servis / Bengkel</label>
                                                    <input type="text" id="add-srv-workshop" class="form-control form-control-sm rounded-3 py-2" style="background: #fafbfc; border-color: #cbd5e1;" placeholder="Contoh: Bengkel Rekanan">
                                                </div>

                                                <!-- Row 3: Sparepart / Part yang Diganti -->
                                                <div class="mb-3">
                                                    <div class="d-flex justify-content-between align-items-center mb-1">
                                                        <label class="form-label extra-small fw-bold text-muted text-uppercase mb-0">Part / Sparepart yang Diganti *</label>
                                                        <span class="extra-small text-muted">Klik chip untuk tambah cepat</span>
                                                    </div>
                                                    <textarea id="add-srv-items" class="form-control form-control-sm rounded-3 py-2 mb-2.5" rows="3" style="background: #fafbfc; border-color: #cbd5e1;" placeholder="Tuliskan suku cadang atau part apa saja yang diganti..." required></textarea>
                                                    
                                                    <!-- Quick Chips with Soft Pastel Colors -->
                                                    <div class="d-flex flex-wrap gap-1.5" id="add-srv-quick-chips">
                                                        <button type="button" class="btn btn-xs py-1 px-2.5 rounded-2 extra-small" style="background: rgba(59, 130, 246, 0.08); color: #1d4ed8; border: 1px solid rgba(59, 130, 246, 0.2);" onclick="window.fleetModule.appendServiceHistoryTag('Oli Mesin')">+ Oli Mesin</button>
                                                        <button type="button" class="btn btn-xs py-1 px-2.5 rounded-2 extra-small" style="background: rgba(59, 130, 246, 0.08); color: #1d4ed8; border: 1px solid rgba(59, 130, 246, 0.2);" onclick="window.fleetModule.appendServiceHistoryTag('Filter Oli')">+ Filter Oli</button>
                                                        <button type="button" class="btn btn-xs py-1 px-2.5 rounded-2 extra-small" style="background: rgba(16, 185, 129, 0.08); color: #047857; border: 1px solid rgba(16, 185, 129, 0.2);" onclick="window.fleetModule.appendServiceHistoryTag('Filter Udara')">+ Filter Udara</button>
                                                        <button type="button" class="btn btn-xs py-1 px-2.5 rounded-2 extra-small" style="background: rgba(245, 158, 11, 0.08); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.2);" onclick="window.fleetModule.appendServiceHistoryTag('Filter Solar')">+ Filter Solar</button>
                                                        <button type="button" class="btn btn-xs py-1 px-2.5 rounded-2 extra-small" style="background: rgba(244, 63, 94, 0.08); color: #be123c; border: 1px solid rgba(244, 63, 94, 0.2);" onclick="window.fleetModule.appendServiceHistoryTag('Kampas Rem Depan')">+ Kampas Rem Depan</button>
                                                        <button type="button" class="btn btn-xs py-1 px-2.5 rounded-2 extra-small" style="background: rgba(244, 63, 94, 0.08); color: #be123c; border: 1px solid rgba(244, 63, 94, 0.2);" onclick="window.fleetModule.appendServiceHistoryTag('Kampas Rem Belakang')">+ Kampas Rem Belakang</button>
                                                        <button type="button" class="btn btn-xs py-1 px-2.5 rounded-2 extra-small" style="background: rgba(168, 85, 247, 0.08); color: #7e22ce; border: 1px solid rgba(168, 85, 247, 0.2);" onclick="window.fleetModule.appendServiceHistoryTag('Tune Up Busi')">+ Tune Up Busi</button>
                                                        <button type="button" class="btn btn-xs py-1 px-2.5 rounded-2 extra-small" style="background: rgba(234, 88, 12, 0.08); color: #c2410c; border: 1px solid rgba(234, 88, 12, 0.2);" onclick="window.fleetModule.appendServiceHistoryTag('Aki')">+ Aki</button>
                                                        <button type="button" class="btn btn-xs py-1 px-2.5 rounded-2 extra-small" style="background: rgba(6, 182, 212, 0.08); color: #0e7490; border: 1px solid rgba(6, 182, 212, 0.2);" onclick="window.fleetModule.appendServiceHistoryTag('Radiator Coolant')">+ Radiator Coolant</button>
                                                        <button type="button" class="btn btn-xs py-1 px-2.5 rounded-2 extra-small" style="background: rgba(100, 116, 139, 0.08); color: #334155; border: 1px solid rgba(100, 116, 139, 0.2);" onclick="window.fleetModule.appendServiceHistoryTag('Minyak Rem')">+ Minyak Rem</button>
                                                        <button type="button" class="btn btn-xs py-1 px-2.5 rounded-2 extra-small" style="background: rgba(139, 92, 246, 0.08); color: #6d28d9; border: 1px solid rgba(139, 92, 246, 0.2);" onclick="window.fleetModule.appendServiceHistoryTag('Rotasi Ban')">+ Rotasi Ban</button>
                                                        <button type="button" class="btn btn-xs py-1 px-2.5 rounded-2 extra-small" style="background: rgba(217, 119, 6, 0.08); color: #b45309; border: 1px solid rgba(217, 119, 6, 0.2);" onclick="window.fleetModule.appendServiceHistoryTag('Gemuk As Roda')">+ Gemuk As Roda</button>
                                                    </div>
                                                </div>

                                                <!-- Row 4: Catatan Tambahan -->
                                                <div class="mb-3">
                                                    <label class="form-label extra-small fw-bold text-muted text-uppercase mb-1">Catatan Tambahan / Kondisi Kendaraan</label>
                                                    <input type="text" id="add-srv-notes" class="form-control form-control-sm rounded-3 py-2" style="background: #fafbfc; border-color: #cbd5e1;" placeholder="Contoh: Kondisi mesin prima, tekanan ban telah disesuaikan">
                                                </div>

                                                <!-- Row 5: Auto Update Next Due Date -->
                                                <div class="p-3 rounded-3 border mb-2" style="background: #f8fafc; border-color: #e2e8f0;">
                                                    <div class="form-check form-switch mb-2">
                                                        <input class="form-check-input" type="checkbox" id="add-srv-update-next" checked onchange="document.getElementById('add-srv-next-panel').style.display = this.checked ? 'block' : 'none';">
                                                        <label class="form-check-label extra-small fw-bold text-dark" for="add-srv-update-next">
                                                            Perbarui Jadwal Servis Rutin Berikutnya Otomatis (+3 Bulan)
                                                        </label>
                                                    </div>
                                                    <div id="add-srv-next-panel">
                                                        <div class="row g-2">
                                                            <div class="col-md-6">
                                                                <label class="extra-small text-muted fw-bold mb-1 d-block">Tanggal Servis Baru:</label>
                                                                <input type="date" id="add-srv-next-date" class="form-control form-control-sm rounded-2" style="background: #ffffff; border-color: #cbd5e1;">
                                                            </div>
                                                            <div class="col-md-6">
                                                                <label class="extra-small text-muted fw-bold mb-1 d-block">Rencana Servis Berikutnya:</label>
                                                                <input type="text" id="add-srv-next-plan" class="form-control form-control-sm rounded-2" style="background: #ffffff; border-color: #cbd5e1;" value="Ganti Oli Mesin, Filter Oli, Servis Berkala">
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </form>
                                        </div>
                                    </div>

                                    <!-- Bottom Action Bar (Dribbble Stepper Action Bar with Soft Accents) -->
                                    <div class="d-flex align-items-center justify-content-between pt-3 mt-3 border-top bg-white" style="border-color: #e2e8f0;">
                                        <button type="button" class="btn btn-sm btn-link text-decoration-none fw-semibold p-0" style="color: #64748b;" id="hist-btn-left-action" onclick="window.fleetModule.handleServiceModalLeftAction()">
                                            Tutup
                                        </button>
                                        <button type="button" class="btn btn-sm fw-semibold px-4 py-2 rounded-3 shadow-xs d-inline-flex align-items-center gap-1.5" 
                                                style="background: #2563eb; color: #ffffff; border: none; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.2);"
                                                id="hist-btn-right-action" onclick="window.fleetModule.handleServiceModalRightAction()">
                                            <span id="hist-btn-right-label">+ Catat Servis Baru</span>
                                            <i class="bi bi-arrow-right"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modalEl);
        }

        // Header Meta Info
        const plateEl = document.getElementById('hist-modal-plate');
        if (plateEl) plateEl.innerText = v.plate_number;

        const cleanCat = v.vehicle_category === 'truck_box' ? 'Truk box' : (v.vehicle_category === 'pickup' ? 'Pick Up' : (v.vehicle_category === 'l300' ? 'L 300' : 'Granmax'));
        const subtitleEl = document.getElementById('hist-modal-subtitle');
        if (subtitleEl) subtitleEl.innerText = `Driver: ${v.assigned_person_name || '-'} • ${v.notes || cleanCat}`;

        const ev = evaluateVehicleAlerts(v);
        const history = Array.isArray(v.service_history) ? v.service_history : [];
        const rawPlan = v.service_details || 'Servis Berkala Rutin';
        const planItems = rawPlan.split(/[,;\n•]+/).map(s => s.trim()).filter(Boolean);

        // Sidebar Meta Card Info
        const metaEl = document.getElementById('hist-sidebar-meta');
        if (metaEl) {
            metaEl.innerHTML = `
                <div class="d-flex justify-content-between align-items-center py-1 border-bottom" style="border-color: #e2e8f0 !important;">
                    <span class="text-muted">Plat Nomor:</span>
                    <span class="fw-bold font-monospace px-1.5 py-0.5 rounded" style="background: rgba(37, 99, 235, 0.08); color: #1d4ed8;">${v.plate_number}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center py-1 border-bottom" style="border-color: #e2e8f0 !important;">
                    <span class="text-muted">Driver:</span>
                    <span class="fw-semibold text-dark">${v.assigned_person_name || '-'}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center py-1 border-bottom" style="border-color: #e2e8f0 !important;">
                    <span class="text-muted">Kategori:</span>
                    <span class="text-dark">${cleanCat}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center py-1 border-bottom" style="border-color: #e2e8f0 !important;">
                    <span class="text-muted">Pajak STNK:</span>
                    <span class="text-dark">${formatPrettyDate(v.tax_due_date)}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center pt-1">
                    <span class="text-muted">Uji KIR:</span>
                    <span class="text-dark">${v.kir_due_date ? formatPrettyDate(v.kir_due_date) : '<span class="text-muted">Bebas KIR</span>'}</span>
                </div>
            `;
        }

        // Stepper Nav Subtitles
        const sub1 = document.getElementById('step-sub-1');
        if (sub1) sub1.innerText = `${history.length} Catatan Pengerjaan`;

        const sub2 = document.getElementById('step-sub-2');
        if (sub2) sub2.innerText = `${ev.serviceAlert.label} (${formatPrettyDate(v.service_due_date)})`;

        // Render Step 1: Riwayat List
        const list1 = document.getElementById('step-panel-1-list');
        if (list1) {
            if (history.length === 0) {
                list1.innerHTML = `
                    <div class="text-center py-5 rounded-3 border p-4" style="background: #fafbfc; border-color: #e2e8f0;">
                        <div class="mb-2" style="color: #94a3b8;"><i class="bi bi-tools fs-2"></i></div>
                        <h6 class="fw-bold text-dark mb-1">Belum Ada Riwayat Servis Tercatat</h6>
                        <p class="text-muted extra-small mb-3">Catat servis pertama untuk memantau penggantian suku cadang kendaraan ini.</p>
                        <button class="btn btn-sm fw-semibold px-3 py-1.5 rounded-2" style="background: #2563eb; color: #ffffff; border: none;" onclick="window.fleetModule.setServiceModalStep(3)">
                            <i class="bi bi-plus-lg me-1"></i> Catat Servis Pertama
                        </button>
                    </div>
                `;
            } else {
                list1.innerHTML = history.map((rec, idx) => {
                    const recItems = (rec.replaced_items || '').split(/[,;\n•]+/).map(s => s.trim()).filter(Boolean);
                    const isLatest = idx === 0;

                    return `
                        <div class="border rounded-3 p-3.5 mb-3 shadow-xs" style="background: #fafbfc; border-color: #e2e8f0;">
                            <div class="d-flex flex-wrap align-items-center justify-content-between pb-2 mb-2.5 border-bottom gap-2" style="border-color: #e2e8f0 !important;">
                                <div class="d-flex flex-wrap align-items-center gap-2">
                                    <span class="font-monospace fw-bold text-dark fs-6">${formatPrettyDate(rec.date)}</span>
                                    ${isLatest ? `<span class="badge px-2 py-0.5 extra-small fw-semibold" style="background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.25);">Terbaru</span>` : ''}
                                    ${rec.odometer ? `
                                        <span class="badge px-2 py-0.5 extra-small fw-normal" style="background: rgba(14, 165, 233, 0.08); color: #0284c7; border: 1px solid rgba(14, 165, 233, 0.2);">
                                            <i class="bi bi-speedometer2 me-1"></i>${rec.odometer}
                                        </span>
                                    ` : ''}
                                    ${rec.workshop ? `
                                        <span class="badge px-2 py-0.5 extra-small fw-normal" style="background: rgba(99, 102, 241, 0.08); color: #4f46e5; border: 1px solid rgba(99, 102, 241, 0.2);">
                                            <i class="bi bi-geo-alt me-1"></i>${rec.workshop}
                                        </span>
                                    ` : ''}
                                </div>
                            </div>

                            <div class="mb-2.5">
                                <div class="extra-small text-muted mb-1.5 fw-medium">Sparepart & Part yang Diganti:</div>
                                <div class="d-flex flex-wrap gap-1.5">
                                    ${recItems.length > 0 ? recItems.map(item => `
                                        <span class="badge px-2.5 py-1 extra-small fw-normal d-inline-flex align-items-center gap-1.5" style="background: #ffffff; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px;">
                                            <i class="bi bi-check2 text-primary fw-bold" style="font-size: 0.82rem;"></i>
                                            <span>${item}</span>
                                        </span>
                                    `).join('') : '<span class="text-muted extra-small">Servis berkala umum</span>'}
                                </div>
                            </div>

                            <div class="d-flex flex-wrap justify-content-between align-items-center pt-2 border-top gap-2" style="border-color: #e2e8f0 !important;">
                                <div class="extra-small text-muted">
                                    ${rec.notes ? `<span class="text-secondary">${rec.notes}</span>` : '<span class="text-muted fst-italic">Tidak ada catatan tambahan</span>'}
                                </div>
                                <button type="button" 
                                        class="btn btn-sm p-0 d-inline-flex align-items-center justify-content-center ms-auto"
                                        style="width: 28px; height: 28px; border-radius: 8px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; transition: all 0.2s;"
                                        onmouseover="this.style.background='rgba(239, 68, 68, 0.18)'; this.style.color='#dc2626';"
                                        onmouseout="this.style.background='rgba(239, 68, 68, 0.08)'; this.style.color='#ef4444';"
                                        title="Hapus Catatan Servis"
                                        onclick="window.fleetModule.deleteServiceRecord('${v.id}', '${rec.id}')">
                                    <i class="bi bi-trash" style="font-size: 0.82rem;"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Render Step 2: Jadwal Rutin Content
        const content2 = document.getElementById('step-panel-2-content');
        if (content2) {
            content2.innerHTML = `
                <div class="card border rounded-3 p-4 shadow-xs mb-3" style="background: linear-gradient(135deg, rgba(239, 246, 255, 0.6) 0%, rgba(245, 243, 255, 0.5) 100%); border-color: #dbeafe;">
                    <div class="d-flex flex-wrap justify-content-between align-items-center pb-3 mb-3 border-bottom gap-2" style="border-color: rgba(219, 234, 254, 0.8) !important;">
                        <div>
                            <div class="extra-small fw-semibold text-uppercase" style="letter-spacing: 0.04em; color: #1e40af;">Jadwal Servis Rutin Berikutnya</div>
                            <div class="d-flex align-items-center gap-2 mt-1">
                                <span class="font-monospace fw-bold text-dark fs-4">${formatPrettyDate(v.service_due_date)}</span>
                                <span class="badge px-2.5 py-1 extra-small fw-semibold" style="background: rgba(245, 158, 11, 0.12); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.25);">
                                    ${ev.serviceAlert.label}
                                </span>
                            </div>
                        </div>
                        <button class="btn btn-sm fw-semibold px-3 py-2 rounded-2 d-inline-flex align-items-center gap-1.5"
                                style="background: #ffffff; border: 1px solid #93c5fd; color: #1d4ed8; box-shadow: 0 1px 3px rgba(37,99,235,0.08);"
                                onmouseover="this.style.background='#eff6ff'"
                                onmouseout="this.style.background='#ffffff'"
                                onclick="window.fleetModule.setServiceModalStep(3, true)">
                            <i class="bi bi-check-lg"></i>
                            <span>Tandai Selesai & Buka Formulir</span>
                        </button>
                    </div>

                    <div class="mb-3">
                        <div class="extra-small text-muted mb-2 fw-medium">Rencana Item Servis Mendatang:</div>
                        <div class="d-flex flex-wrap gap-1.5">
                            ${planItems.map(item => `
                                <span class="badge px-2.5 py-1.5 extra-small fw-normal d-inline-flex align-items-center gap-1.5" style="background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px;">
                                    <i class="bi bi-wrench text-primary" style="font-size: 0.75rem;"></i> ${item}
                                </span>
                            `).join('')}
                        </div>
                    </div>

                    <div class="p-3 rounded-3 extra-small" style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); color: #065f46;">
                        <i class="bi bi-shield-check text-success me-1"></i>
                        <span>Pemeliharaan rutin dilakukan secara berkala setiap 3-4 bulan atau 10.000 KM demi menjaga kondisi operasional dan efisiensi armada.</span>
                    </div>
                </div>
            `;
        }

        // Initialize Form Values in Step 3
        const idInput = document.getElementById('add-srv-vehicle-id');
        if (idInput) idInput.value = v.id;
        
        const now = new Date();
        const dateInput = document.getElementById('add-srv-date');
        if (dateInput) dateInput.value = now.toISOString().split('T')[0];
        
        const kmInput = document.getElementById('add-srv-km');
        if (kmInput) kmInput.value = '';
        
        const wsInput = document.getElementById('add-srv-workshop');
        if (wsInput) wsInput.value = '';
        
        const notesInput = document.getElementById('add-srv-notes');
        if (notesInput) notesInput.value = '';
        
        const itemsInput = document.getElementById('add-srv-items');
        if (itemsInput) itemsInput.value = (prefillUpcoming && v.service_details) ? v.service_details : '';

        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
        const nextDateInput = document.getElementById('add-srv-next-date');
        if (nextDateInput) nextDateInput.value = nextMonth.toISOString().split('T')[0];

        // Activate requested step
        setServiceModalStep(initialStep, prefillUpcoming);

        const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
        bsModal.show();
    }

    function setServiceModalStep(step, prefillUpcoming = false) {
        currentServiceStep = step;

        // Progress bar and labels
        const labelEl = document.getElementById('stepper-progress-label');
        const barEl = document.getElementById('stepper-progress-bar');
        if (step === 1) {
            if (labelEl) labelEl.innerText = 'Langkah 1 dari 3: Riwayat Servis Selesai';
            if (barEl) barEl.style.width = '33%';
        } else if (step === 2) {
            if (labelEl) labelEl.innerText = 'Langkah 2 dari 3: Jadwal Rutin';
            if (barEl) barEl.style.width = '66%';
        } else {
            if (labelEl) labelEl.innerText = 'Langkah 3 dari 3: Formulir Servis Baru';
            if (barEl) barEl.style.width = '100%';
        }

        // Nav Items Highlighting
        [1, 2, 3].forEach(s => {
            const navEl = document.getElementById(`step-nav-${s}`);
            const badgeEl = document.getElementById(`step-num-${s}`);
            const panelEl = document.getElementById(`step-panel-${s}`);

            if (s === step) {
                if (navEl) {
                    navEl.style.background = 'rgba(37, 99, 235, 0.06)';
                    navEl.style.borderColor = 'rgba(37, 99, 235, 0.35)';
                    navEl.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.08)';
                }
                if (badgeEl) {
                    badgeEl.style.background = '#2563eb';
                    badgeEl.style.color = '#ffffff';
                }
                if (panelEl) panelEl.style.display = 'block';
            } else {
                if (navEl) {
                    navEl.style.background = '#ffffff';
                    navEl.style.borderColor = '#e2e8f0';
                    navEl.style.boxShadow = 'none';
                }
                if (badgeEl) {
                    badgeEl.style.background = '#f1f5f9';
                    badgeEl.style.color = '#64748b';
                }
                if (panelEl) panelEl.style.display = 'none';
            }
        });

        // Prefill upcoming items if requested
        if (prefillUpcoming && currentServiceVehicleId) {
            const fleet = getStoredFleet();
            const v = fleet.find(item => item.id === currentServiceVehicleId);
            if (v && v.service_details) {
                const itemsArea = document.getElementById('add-srv-items');
                if (itemsArea) itemsArea.value = v.service_details;
            }
        }

        // Update Bottom Action Bar Buttons
        const leftBtn = document.getElementById('hist-btn-left-action');
        const rightLabel = document.getElementById('hist-btn-right-label');

        if (step === 1) {
            if (leftBtn) {
                leftBtn.innerText = 'Tutup';
                leftBtn.setAttribute('data-bs-dismiss', 'modal');
            }
            if (rightLabel) rightLabel.innerText = '+ Catat Servis Baru';
        } else if (step === 2) {
            if (leftBtn) {
                leftBtn.innerText = '← Lihat Riwayat';
                leftBtn.removeAttribute('data-bs-dismiss');
            }
            if (rightLabel) rightLabel.innerText = 'Buka Formulir Servis';
        } else {
            if (leftBtn) {
                leftBtn.innerText = '← Kembali ke Riwayat';
                leftBtn.removeAttribute('data-bs-dismiss');
            }
            if (rightLabel) rightLabel.innerText = 'Simpan Riwayat Servis';
        }
    }

    function handleServiceModalLeftAction() {
        if (currentServiceStep === 1) {
            const modalEl = document.getElementById('modal-service-history');
            if (modalEl) {
                const bsModal = bootstrap.Modal.getInstance(modalEl);
                if (bsModal) bsModal.hide();
            }
        } else {
            setServiceModalStep(1);
        }
    }

    function handleServiceModalRightAction() {
        if (currentServiceStep === 1) {
            setServiceModalStep(3, false);
        } else if (currentServiceStep === 2) {
            setServiceModalStep(3, true);
        } else {
            saveServiceRecord();
        }
    }

    function openAddServiceRecordModal(vehicleId, isFromUpcoming = false) {
        openServiceHistoryModal(vehicleId, 3, isFromUpcoming);
    }

    function appendServiceHistoryTag(tagName) {
        const textarea = document.getElementById('add-srv-items');
        if (!textarea) return;
        const current = textarea.value.trim();
        if (!current) {
            textarea.value = tagName;
        } else {
            const items = current.split(/[,;]+/).map(s => s.trim());
            if (!items.includes(tagName)) {
                textarea.value = current + ', ' + tagName;
            }
        }
        textarea.focus();
    }

    function saveServiceRecord() {
        assertSuperAdmin();
        const vId = document.getElementById('add-srv-vehicle-id').value;
        const date = document.getElementById('add-srv-date').value;
        const km = document.getElementById('add-srv-km').value.trim();
        const workshop = document.getElementById('add-srv-workshop').value.trim();
        const items = document.getElementById('add-srv-items').value.trim();
        const notes = document.getElementById('add-srv-notes').value.trim();
        const updateNext = document.getElementById('add-srv-update-next').checked;
        const nextDate = document.getElementById('add-srv-next-date').value;
        const nextPlan = document.getElementById('add-srv-next-plan').value.trim();

        if (!date || !items) {
            return alert('Harap isi Tanggal Pengerjaan Servis dan Item Part yang Diganti!');
        }

        const fleet = getStoredFleet();
        const v = fleet.find(item => item.id === vId);
        if (!v) return;

        if (!Array.isArray(v.service_history)) {
            v.service_history = [];
        }

        const newRecord = {
            id: 'SRV-' + Date.now(),
            date: date,
            odometer: km || '',
            workshop: workshop || '',
            replaced_items: items,
            notes: notes || '',
            created_at: Date.now()
        };

        // Add to top of history (latest first)
        v.service_history.unshift(newRecord);

        // Auto update next schedule if selected
        if (updateNext && nextDate) {
            v.service_due_date = nextDate;
            if (nextPlan) v.service_details = nextPlan;
        }

        saveStoredFleet(fleet);

        showFleetToast(`Riwayat servis ${v.plate_number} berhasil disimpan!`);
        renderFleetInventoryView();
        openServiceHistoryModal(v.id, 1);
    }

    function deleteServiceRecord(vehicleId, recordId) {
        assertSuperAdmin();
        if (!confirm('Apakah Anda yakin ingin menghapus catatan riwayat servis ini?')) return;

        const fleet = getStoredFleet();
        const v = fleet.find(item => item.id === vehicleId);
        if (!v || !Array.isArray(v.service_history)) return;

        v.service_history = v.service_history.filter(r => String(r.id).trim() !== String(recordId).trim());
        saveStoredFleet(fleet);

        showFleetToast('Catatan riwayat servis telah dihapus.');
        renderFleetInventoryView();
        openServiceHistoryModal(v.id, 1);
    }

    function openServiceDetailModal(id) {
        openServiceHistoryModal(id);
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
        openServiceHistoryModal,
        openAddServiceRecordModal,
        saveServiceRecord,
        deleteServiceRecord,
        appendServiceHistoryTag,
        toggleKirField,
        onPersonilSelectChange,
        appendServiceTag,
        exportFleetToExcel,
        getStoredFleet,
        openEditCentralPhoneModal,
        sendCentralAlertWhatsApp,
        getCentralPhone,
        saveCentralPhone,
        setServiceModalStep,
        handleServiceModalLeftAction,
        handleServiceModalRightAction
    };

    // Auto-init on load if super admin
    document.addEventListener('DOMContentLoaded', function() {
        if (document.getElementById('view-fleet-inventory')) {
            renderFleetInventoryView();
        }
    });

})();
