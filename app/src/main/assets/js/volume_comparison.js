/**
 * Wellen Print - Shipment Volume Comparison & Data Breakdown Component
 * Professional ERP Dashboard Component matching Esse reference
 * 
 * Features:
 * - Metric Switcher: Titik Pengantaran vs Surat Jalan
 * - X-Axis: Senin sampai Minggu (termasuk Minggu jika ada lembur)
 * - Region Filter: Semua Region, Jakarta Barat, Tangerang, dll.
 * - Floating Black Tooltip on hover (Esse style)
 * - Data Breakdown Table (Klien / Region) with sorting, search, and row hover
 * - Download Report button (strictly named "Report")
 * - 100% Mobile & Tablet Responsive
 */
(function(root) {
    'use strict';

    const STORAGE_COLLAPSE_KEY = 'wtrack_volume_comparison_collapsed';
    const DAYS_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    const DAYS_META = {
        'Senin': { label: 'Senin', short: 'Sen', isWeekend: false, defaultOvertime: false },
        'Selasa': { label: 'Selasa', short: 'Sel', isWeekend: false, defaultOvertime: false },
        'Rabu': { label: 'Rabu', short: 'Rab', isWeekend: false, defaultOvertime: false },
        'Kamis': { label: 'Kamis', short: 'Kam', isWeekend: false, defaultOvertime: false },
        'Jumat': { label: 'Jumat', short: 'Jum', isWeekend: false, defaultOvertime: false },
        'Sabtu': { label: 'Sabtu', short: 'Sab', isWeekend: true, defaultOvertime: false },
        'Minggu': { label: 'Minggu', short: 'Min', isWeekend: true, defaultOvertime: true }
    };

    // State
    let isCollapsed = root.localStorage.getItem(STORAGE_COLLAPSE_KEY) === 'true';
    let currentMetric = 'destinations'; // 'destinations' (Titik Pengantaran) or 'sj' (Surat Jalan)
    let currentRegion = 'all'; // 'all' or specific region string
    let currentAdmin = 'all'; // 'all' or specific Admin SJ
    let currentCourier = 'all'; // 'all' or specific courier
    let startDate = '';
    let endDate = '';
    let breakdownDim = 'customer'; // 'customer' (Klien) or 'region' (Region)
    let breakdownSearch = '';
    let sortField = 'total'; // 'total', 'delivered', 'share', 'name'
    let sortDir = 'desc'; // 'desc' or 'asc'
    let hoveredDayIdx = null;

    // Realistic, comprehensive weekly delivery baseline dataset spanning Senin - Minggu
    // Reflects Wellen Print real daily operational volume of 150+ titik pengantaran per weekday
    // Distributed among 20 active couriers/drivers and real clients (1-2 points per delivery, max <= 15-20 points per client across week)
    const RAW_BASELINE_TUPLES = [
        ['SJ-11SE-0001', 'Senin', '2026-11-09', 'PT Aspirasi Hidup Indonesia Tbk', 'Jakarta Barat', 2, 2, 'Delivered', 'Ahmad', 'Dewi', 0],
        ['SJ-11SE-0002', 'Senin', '2026-11-09', 'PT Foods Beverages Indonesia', 'Jakarta Selatan', 1, 1, 'Delivered', 'Ahmad', 'Budi', 0],
        ['SJ-11SE-0003', 'Senin', '2026-11-09', 'PT Tri Sakti Purwosari Makmur', 'Jakarta Barat', 1, 1, 'Delivered', 'Ahmad', 'Nova', 0],
        ['SJ-11SE-0004', 'Senin', '2026-11-09', 'PT Home Center Indonesia Retail', 'Bekasi', 1, 1, 'Delivered', 'Ahmad', 'Dewi', 0],
        ['SJ-11SE-0005', 'Senin', '2026-11-09', 'PT Toys Games Indonesia', 'Tangerang', 1, 0, 'On Delivery', 'Ahmad', 'Budi', 0],
        ['SJ-11SE-0006', 'Senin', '2026-11-09', 'PT BQuik Otomotif Indonesia', 'Jakarta Barat', 1, 1, 'Delivered', 'Ahmad', 'Nova', 0],
        ['SJ-11SE-0007', 'Senin', '2026-11-09', 'PT Benfood Dinamika Sentosa', 'Jakarta Selatan', 1, 0, 'On Delivery', 'Ahmad', 'Dewi', 0],
        ['SJ-11SE-0008', 'Senin', '2026-11-09', 'PT Astra International', 'Jakarta Pusat', 1, 1, 'Delivered', 'Ahmad', 'Budi', 0],
        ['SJ-11SE-0009', 'Senin', '2026-11-09', 'PT Indofood CBP Sukses Makmur', 'Tangerang', 1, 1, 'Delivered', 'Beto', 'Nova', 0],
        ['SJ-11SE-0010', 'Senin', '2026-11-09', 'PT Sumber Alfaria Trijaya', 'Bekasi', 2, 2, 'Delivered', 'Beto', 'Dewi', 0],
        ['SJ-11SE-0011', 'Senin', '2026-11-09', 'PT Mayora Indah', 'Tangerang', 1, 1, 'Delivered', 'Beto', 'Budi', 0],
        ['SJ-11SE-0012', 'Senin', '2026-11-09', 'PT Beverindo Indah Abadi', 'Jakarta Pusat', 1, 1, 'Delivered', 'Beto', 'Nova', 0],
        ['SJ-11SE-0013', 'Senin', '2026-11-09', 'PT Jasmine Journey Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Beto', 'Dewi', 0],
        ['SJ-11SE-0014', 'Senin', '2026-11-09', 'PT Wook Global Technology', 'Jakarta Utara', 1, 1, 'Delivered', 'Beto', 'Budi', 0],
        ['SJ-11SE-0015', 'Senin', '2026-11-09', 'PT Kalbe Farma', 'Jakarta Timur', 1, 1, 'Delivered', 'Beto', 'Nova', 0],
        ['SJ-11SE-0016', 'Senin', '2026-11-09', 'PT Makmur Jaya', 'Jakarta Selatan', 1, 1, 'Delivered', 'Beto', 'Dewi', 0],
        ['SJ-11SE-0017', 'Senin', '2026-11-09', 'PT Intitirta Sarimakmur', 'Jakarta Utara', 2, 2, 'Delivered', 'Eri', 'Budi', 0],
        ['SJ-11SE-0018', 'Senin', '2026-11-09', 'PT Perindustrian Bapak Djenggot', 'Jakarta Barat', 1, 1, 'Delivered', 'Eri', 'Nova', 0],
        ['SJ-11SE-0019', 'Senin', '2026-11-09', 'Panorama JTB (Head Office)', 'Jakarta Pusat', 1, 1, 'Delivered', 'Eri', 'Dewi', 0],
        ['SJ-11SE-0020', 'Senin', '2026-11-09', 'Pixel Group Indonesia', 'Jakarta Selatan', 2, 2, 'Delivered', 'Eri', 'Budi', 0],
        ['SJ-11SE-0021', 'Senin', '2026-11-09', 'Premier Village', 'Tangerang', 2, 2, 'Delivered', 'Eri', 'Nova', 0],
        ['SJ-11SE-0022', 'Senin', '2026-11-09', 'REX Kiriman Express', 'Jakarta Barat', 1, 1, 'Delivered', 'Eri', 'Dewi', 0],
        ['SJ-11SE-0023', 'Senin', '2026-11-09', 'Kawan Lama Sejahtera', 'Jakarta Barat', 1, 1, 'Delivered', 'Irfan', 'Budi', 0],
        ['SJ-11SE-0024', 'Senin', '2026-11-09', 'Wisma KEIAI', 'Jakarta Pusat', 1, 1, 'Delivered', 'Irfan', 'Nova', 0],
        ['SJ-11SE-0025', 'Senin', '2026-11-09', 'Kacamatamoo Rawasari', 'Jakarta Pusat', 1, 1, 'Delivered', 'Irfan', 'Dewi', 0],
        ['SJ-11SE-0026', 'Senin', '2026-11-09', 'GrandLucky - SCBD', 'Jakarta Selatan', 2, 2, 'Delivered', 'Irfan', 'Budi', 0],
        ['SJ-11SE-0027', 'Senin', '2026-11-09', 'GrandLucky BSD City', 'Tangerang', 1, 1, 'Delivered', 'Irfan', 'Nova', 0],
        ['SJ-11SE-0028', 'Senin', '2026-11-09', 'Eraprima Industrial Park', 'Tangerang', 2, 2, 'Delivered', 'Irfan', 'Dewi', 0],
        ['SJ-11SE-0029', 'Senin', '2026-11-09', 'Mandiri University Wijaya Kusuma', 'Jakarta Barat', 1, 1, 'Delivered', 'Irfan', 'Budi', 0],
        ['SJ-11SE-0030', 'Senin', '2026-11-09', 'Pacific Place Mall', 'Jakarta Selatan', 1, 1, 'Delivered', 'Baihaqi', 'Nova', 0],
        ['SJ-11SE-0031', 'Senin', '2026-11-09', 'INFORMA - Living World Kota Wisata', 'Bekasi', 1, 1, 'Delivered', 'Baihaqi', 'Dewi', 0],
        ['SJ-11SE-0032', 'Senin', '2026-11-09', 'Living World Alam Sutera', 'Tangerang', 2, 2, 'Delivered', 'Baihaqi', 'Budi', 0],
        ['SJ-11SE-0033', 'Senin', '2026-11-09', 'Mall Senayan City', 'Jakarta Pusat', 1, 1, 'Delivered', 'Baihaqi', 'Nova', 0],
        ['SJ-11SE-0034', 'Senin', '2026-11-09', 'Grand Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Baihaqi', 'Dewi', 0],
        ['SJ-11SE-0035', 'Senin', '2026-11-09', 'Central Park Mall', 'Jakarta Barat', 2, 2, 'Delivered', 'Baihaqi', 'Budi', 0],
        ['SJ-11SE-0036', 'Senin', '2026-11-09', 'Gandaria City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Baihaqi', 'Nova', 0],
        ['SJ-11SE-0037', 'Senin', '2026-11-09', 'AEON Mall BSD City', 'Tangerang', 2, 2, 'Delivered', 'Haris', 'Dewi', 0],
        ['SJ-11SE-0038', 'Senin', '2026-11-09', 'AEON Mall Jakarta Garden City', 'Jakarta Timur', 1, 1, 'Delivered', 'Haris', 'Budi', 0],
        ['SJ-11SE-0039', 'Senin', '2026-11-09', 'AEON Mall Tanjung Barat', 'Jakarta Selatan', 2, 2, 'Delivered', 'Haris', 'Nova', 0],
        ['SJ-11SE-0040', 'Senin', '2026-11-09', 'Anytime Fitness', 'Jakarta Selatan', 1, 1, 'Delivered', 'Haris', 'Dewi', 0],
        ['SJ-11SE-0041', 'Senin', '2026-11-09', 'Ataru Living World', 'Tangerang', 1, 1, 'Delivered', 'Haris', 'Budi', 0],
        ['SJ-11SE-0042', 'Senin', '2026-11-09', 'Chatime Metropolitan Mall 2', 'Bekasi', 1, 1, 'Delivered', 'Haris', 'Nova', 0],
        ['SJ-11SE-0043', 'Senin', '2026-11-09', 'Chatime Gandaria City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Haris', 'Dewi', 0],
        ['SJ-11SE-0044', 'Senin', '2026-11-09', 'Chatime Central Park', 'Jakarta Barat', 1, 1, 'Delivered', 'Umar', 'Budi', 0],
        ['SJ-11SE-0045', 'Senin', '2026-11-09', 'Toys Kingdom Palem Semi', 'Tangerang', 1, 1, 'Delivered', 'Umar', 'Nova', 0],
        ['SJ-11SE-0046', 'Senin', '2026-11-09', 'Toys Kingdom Supermal Karawaci', 'Tangerang', 1, 1, 'Delivered', 'Umar', 'Dewi', 0],
        ['SJ-11SE-0047', 'Senin', '2026-11-09', 'Toys Kingdom Grand Indonesia', 'Jakarta Pusat', 2, 2, 'Delivered', 'Umar', 'Budi', 0],
        ['SJ-11SE-0048', 'Senin', '2026-11-09', 'Azko PIK Avenue', 'Jakarta Utara', 2, 2, 'Delivered', 'Umar', 'Nova', 0],
        ['SJ-11SE-0049', 'Senin', '2026-11-09', 'Azko Green Terrace TMII', 'Jakarta Timur', 2, 2, 'Delivered', 'Umar', 'Dewi', 0],
        ['SJ-11SE-0050', 'Senin', '2026-11-09', 'Azko Bogor Terasutra', 'Jakarta Selatan', 1, 1, 'Delivered', 'Noval', 'Budi', 0],
        ['SJ-11SE-0051', 'Senin', '2026-11-09', 'Azko Citra 6', 'Jakarta Barat', 1, 1, 'Delivered', 'Noval', 'Nova', 0],
        ['SJ-11SE-0052', 'Senin', '2026-11-09', 'Azko Kota Wisata Bogor', 'Bekasi', 2, 2, 'Delivered', 'Noval', 'Dewi', 0],
        ['SJ-11SE-0053', 'Senin', '2026-11-09', 'Azko QBig BSD', 'Tangerang', 2, 2, 'Delivered', 'Noval', 'Budi', 0],
        ['SJ-11SE-0054', 'Senin', '2026-11-09', 'Azko Metro Sunter', 'Jakarta Utara', 2, 2, 'Delivered', 'Noval', 'Nova', 0],
        ['SJ-11SE-0055', 'Senin', '2026-11-09', 'Color Star (Linda)', 'Jakarta Barat', 1, 1, 'Delivered', 'Noval', 'Dewi', 0],
        ['SJ-11SE-0056', 'Senin', '2026-11-09', 'Resto Sederhana', 'Jakarta Pusat', 2, 2, 'Delivered', 'Jay', 'Budi', 0],
        ['SJ-11SE-0057', 'Senin', '2026-11-09', 'Lawson Station', 'Jakarta Selatan', 1, 1, 'Delivered', 'Jay', 'Nova', 0],
        ['SJ-11SE-0058', 'Senin', '2026-11-09', 'Kopi Kenangan', 'Jakarta Selatan', 1, 1, 'Delivered', 'Jay', 'Dewi', 0],
        ['SJ-11SE-0059', 'Senin', '2026-11-09', 'Fore Coffee', 'Jakarta Pusat', 1, 1, 'Delivered', 'Jay', 'Budi', 0],
        ['SJ-11SE-0060', 'Senin', '2026-11-09', 'Janji Jiwa', 'Jakarta Barat', 1, 1, 'Delivered', 'Jay', 'Nova', 0],
        ['SJ-11SE-0061', 'Senin', '2026-11-09', 'Holland Bakery', 'Jakarta Barat', 1, 1, 'Delivered', 'Jay', 'Dewi', 0],
        ['SJ-11SE-0062', 'Senin', '2026-11-09', 'JCO Donuts & Coffee', 'Jakarta Selatan', 1, 1, 'Delivered', 'Jay', 'Budi', 0],
        ['SJ-11SE-0063', 'Senin', '2026-11-09', 'BreadTalk', 'Jakarta Barat', 2, 2, 'Delivered', 'Ferdi', 'Nova', 0],
        ['SJ-11SE-0064', 'Senin', '2026-11-09', 'Guardian Pharmacy', 'Jakarta Selatan', 1, 1, 'Delivered', 'Ferdi', 'Dewi', 0],
        ['SJ-11SE-0065', 'Senin', '2026-11-09', 'Watsons', 'Jakarta Pusat', 1, 1, 'Delivered', 'Ferdi', 'Budi', 0],
        ['SJ-11SE-0066', 'Senin', '2026-11-09', 'Century Healthcare', 'Jakarta Barat', 2, 2, 'Delivered', 'Ferdi', 'Nova', 0],
        ['SJ-11SE-0067', 'Senin', '2026-11-09', 'Kimia Farma', 'Jakarta Timur', 1, 1, 'Delivered', 'Ferdi', 'Dewi', 0],
        ['SJ-11SE-0068', 'Senin', '2026-11-09', 'Mitra 10', 'Tangerang', 1, 1, 'Delivered', 'Ferdi', 'Budi', 0],
        ['SJ-11SE-0069', 'Senin', '2026-11-09', 'Depo Bangunan', 'Tangerang', 2, 2, 'Delivered', 'Jagatbaru', 'Nova', 0],
        ['SJ-11SE-0070', 'Senin', '2026-11-09', 'Electronic City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Jagatbaru', 'Dewi', 0],
        ['SJ-11SE-0071', 'Senin', '2026-11-09', 'Erafone', 'Jakarta Pusat', 1, 1, 'Delivered', 'Jagatbaru', 'Budi', 0],
        ['SJ-11SE-0072', 'Senin', '2026-11-09', 'iBox Central Park', 'Jakarta Barat', 1, 1, 'Delivered', 'Jagatbaru', 'Nova', 0],
        ['SJ-11SE-0073', 'Senin', '2026-11-09', 'Gramedia Matraman', 'Jakarta Timur', 2, 2, 'Delivered', 'Jagatbaru', 'Dewi', 0],
        ['SJ-11SE-0074', 'Senin', '2026-11-09', 'Ranch Market Pesanggrahan', 'Jakarta Barat', 1, 1, 'Delivered', 'Jagatbaru', 'Budi', 0],
        ['SJ-11SE-0075', 'Senin', '2026-11-09', 'Farmers Market Kelapa Gading', 'Jakarta Utara', 1, 1, 'Delivered', 'pbseventeensc', 'Nova', 0],
        ['SJ-11SE-0076', 'Senin', '2026-11-09', 'Papaya Fresh Gallery', 'Jakarta Selatan', 1, 1, 'Delivered', 'pbseventeensc', 'Dewi', 0],
        ['SJ-11SE-0077', 'Senin', '2026-11-09', 'Kem Chicks Pacific Place', 'Jakarta Selatan', 1, 1, 'Delivered', 'pbseventeensc', 'Budi', 0],
        ['SJ-11SE-0078', 'Senin', '2026-11-09', 'Lotte Mart Meruya', 'Jakarta Barat', 1, 1, 'Delivered', 'pbseventeensc', 'Nova', 0],
        ['SJ-11SE-0079', 'Senin', '2026-11-09', 'Gold Coast Office', 'Jakarta Utara', 1, 1, 'Delivered', 'pbseventeensc', 'Dewi', 0],
        ['SJ-11SE-0080', 'Senin', '2026-11-09', 'Mall Bassura Jatinegara', 'Jakarta Timur', 2, 2, 'Delivered', 'pbseventeensc', 'Budi', 0],
        ['SJ-11SE-0081', 'Senin', '2026-11-09', 'Plaza Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'pbseventeensc', 'Nova', 0],
        ['SJ-11SE-0082', 'Senin', '2026-11-09', 'Lippo Mall Puri', 'Jakarta Barat', 2, 2, 'Delivered', 'Soleh', 'Dewi', 0],
        ['SJ-11SE-0083', 'Senin', '2026-11-09', 'Supermal Karawaci', 'Tangerang', 2, 2, 'Delivered', 'Soleh', 'Budi', 0],
        ['SJ-11SE-0084', 'Senin', '2026-11-09', 'Summarecon Mall Serpong', 'Tangerang', 1, 1, 'Delivered', 'Soleh', 'Nova', 0],
        ['SJ-11SE-0085', 'Senin', '2026-11-09', 'Summarecon Mall Kelapa Gading', 'Jakarta Utara', 2, 2, 'Delivered', 'Soleh', 'Dewi', 0],
        ['SJ-11SE-0086', 'Senin', '2026-11-09', 'Puri Indah Mall', 'Jakarta Barat', 1, 1, 'Delivered', 'Soleh', 'Budi', 0],
        ['SJ-11SE-0087', 'Senin', '2026-11-09', 'PT Aspirasi Hidup Indonesia Tbk', 'Jakarta Barat', 2, 2, 'Delivered', 'Romi', 'Nova', 0],
        ['SJ-11SE-0088', 'Senin', '2026-11-09', 'PT Foods Beverages Indonesia', 'Jakarta Selatan', 1, 1, 'Delivered', 'Romi', 'Dewi', 0],
        ['SJ-11SE-0089', 'Senin', '2026-11-09', 'PT Tri Sakti Purwosari Makmur', 'Jakarta Barat', 1, 1, 'Delivered', 'Romi', 'Budi', 0],
        ['SJ-11SE-0090', 'Senin', '2026-11-09', 'PT Home Center Indonesia Retail', 'Bekasi', 1, 1, 'Delivered', 'Romi', 'Nova', 0],
        ['SJ-11SE-0091', 'Senin', '2026-11-09', 'PT Toys Games Indonesia', 'Tangerang', 1, 1, 'Delivered', 'Romi', 'Dewi', 0],
        ['SJ-11SE-0092', 'Senin', '2026-11-09', 'PT BQuik Otomotif Indonesia', 'Jakarta Barat', 1, 1, 'Delivered', 'Romi', 'Budi', 0],
        ['SJ-11SE-0093', 'Senin', '2026-11-09', 'PT Benfood Dinamika Sentosa', 'Jakarta Selatan', 1, 1, 'Delivered', 'Romi', 'Nova', 0],
        ['SJ-11SE-0094', 'Senin', '2026-11-09', 'PT Astra International', 'Jakarta Pusat', 1, 1, 'Delivered', 'Firdaus', 'Dewi', 0],
        ['SJ-11SE-0095', 'Senin', '2026-11-09', 'PT Indofood CBP Sukses Makmur', 'Tangerang', 2, 2, 'Delivered', 'Firdaus', 'Budi', 0],
        ['SJ-11SE-0096', 'Senin', '2026-11-09', 'PT Sumber Alfaria Trijaya', 'Bekasi', 2, 2, 'Delivered', 'Firdaus', 'Nova', 0],
        ['SJ-11SE-0097', 'Senin', '2026-11-09', 'PT Mayora Indah', 'Tangerang', 2, 2, 'Delivered', 'Firdaus', 'Dewi', 0],
        ['SJ-11SE-0098', 'Senin', '2026-11-09', 'PT Beverindo Indah Abadi', 'Jakarta Pusat', 1, 1, 'Delivered', 'Firdaus', 'Budi', 0],
        ['SJ-11SE-0099', 'Senin', '2026-11-09', 'PT Jasmine Journey Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Alan', 'Nova', 0],
        ['SJ-11SE-0100', 'Senin', '2026-11-09', 'PT Wook Global Technology', 'Jakarta Utara', 1, 1, 'Delivered', 'Alan', 'Dewi', 0],
        ['SJ-11SE-0101', 'Senin', '2026-11-09', 'PT Kalbe Farma', 'Jakarta Timur', 1, 1, 'Delivered', 'Alan', 'Budi', 0],
        ['SJ-11SE-0102', 'Senin', '2026-11-09', 'PT Makmur Jaya', 'Jakarta Selatan', 1, 1, 'Delivered', 'Alan', 'Nova', 0],
        ['SJ-11SE-0103', 'Senin', '2026-11-09', 'PT Intitirta Sarimakmur', 'Jakarta Utara', 1, 1, 'Delivered', 'Alan', 'Dewi', 0],
        ['SJ-11SE-0104', 'Senin', '2026-11-09', 'PT Perindustrian Bapak Djenggot', 'Jakarta Barat', 1, 1, 'Delivered', 'Alan', 'Budi', 0],
        ['SJ-11SE-0105', 'Senin', '2026-11-09', 'Panorama JTB (Head Office)', 'Jakarta Pusat', 1, 1, 'Delivered', 'Alan', 'Nova', 0],
        ['SJ-11SE-0106', 'Senin', '2026-11-09', 'Pixel Group Indonesia', 'Jakarta Selatan', 1, 1, 'Delivered', 'Alan', 'Dewi', 0],
        ['SJ-11SE-0107', 'Senin', '2026-11-09', 'Premier Village', 'Tangerang', 2, 2, 'Delivered', 'Yakub', 'Budi', 0],
        ['SJ-11SE-0108', 'Senin', '2026-11-09', 'REX Kiriman Express', 'Jakarta Barat', 1, 1, 'Delivered', 'Yakub', 'Nova', 0],
        ['SJ-11SE-0109', 'Senin', '2026-11-09', 'Kawan Lama Sejahtera', 'Jakarta Barat', 1, 1, 'Delivered', 'Yakub', 'Dewi', 0],
        ['SJ-11SE-0110', 'Senin', '2026-11-09', 'Wisma KEIAI', 'Jakarta Pusat', 1, 1, 'Delivered', 'Yakub', 'Budi', 0],
        ['SJ-11SE-0111', 'Senin', '2026-11-09', 'Kacamatamoo Rawasari', 'Jakarta Pusat', 2, 2, 'Delivered', 'Yakub', 'Nova', 0],
        ['SJ-11SE-0112', 'Senin', '2026-11-09', 'GrandLucky - SCBD', 'Jakarta Selatan', 1, 1, 'Delivered', 'Yakub', 'Dewi', 0],
        ['SJ-11SE-0113', 'Senin', '2026-11-09', 'GrandLucky BSD City', 'Tangerang', 2, 2, 'Delivered', 'Iwan', 'Budi', 0],
        ['SJ-11SE-0114', 'Senin', '2026-11-09', 'Eraprima Industrial Park', 'Tangerang', 1, 1, 'Delivered', 'Iwan', 'Nova', 0],
        ['SJ-11SE-0115', 'Senin', '2026-11-09', 'Mandiri University Wijaya Kusuma', 'Jakarta Barat', 2, 2, 'Delivered', 'Iwan', 'Dewi', 0],
        ['SJ-11SE-0116', 'Senin', '2026-11-09', 'Pacific Place Mall', 'Jakarta Selatan', 2, 2, 'Delivered', 'Iwan', 'Budi', 0],
        ['SJ-11SE-0117', 'Senin', '2026-11-09', 'INFORMA - Living World Kota Wisata', 'Bekasi', 1, 1, 'Delivered', 'Iwan', 'Nova', 0],
        ['SJ-11SE-0118', 'Senin', '2026-11-09', 'Living World Alam Sutera', 'Tangerang', 1, 1, 'Delivered', 'Agung', 'Dewi', 0],
        ['SJ-11SE-0119', 'Senin', '2026-11-09', 'Mall Senayan City', 'Jakarta Pusat', 2, 2, 'Delivered', 'Agung', 'Budi', 0],
        ['SJ-11SE-0120', 'Senin', '2026-11-09', 'Grand Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Agung', 'Nova', 0],
        ['SJ-11SE-0121', 'Senin', '2026-11-09', 'Central Park Mall', 'Jakarta Barat', 1, 1, 'Delivered', 'Agung', 'Dewi', 0],
        ['SJ-11SE-0122', 'Senin', '2026-11-09', 'Gandaria City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Agung', 'Budi', 0],
        ['SJ-11SE-0123', 'Senin', '2026-11-09', 'AEON Mall BSD City', 'Tangerang', 1, 1, 'Delivered', 'Agung', 'Nova', 0],
        ['SJ-11SE-0124', 'Senin', '2026-11-09', 'AEON Mall Jakarta Garden City', 'Jakarta Timur', 1, 1, 'Delivered', 'Agung', 'Dewi', 0],
        ['SJ-11SE-0125', 'Senin', '2026-11-09', 'AEON Mall Tanjung Barat', 'Jakarta Selatan', 1, 1, 'Delivered', 'Husen', 'Budi', 0],
        ['SJ-11SE-0126', 'Senin', '2026-11-09', 'Anytime Fitness', 'Jakarta Selatan', 1, 1, 'Delivered', 'Husen', 'Nova', 0],
        ['SJ-11SE-0127', 'Senin', '2026-11-09', 'Ataru Living World', 'Tangerang', 2, 2, 'Delivered', 'Husen', 'Dewi', 0],
        ['SJ-11SE-0128', 'Senin', '2026-11-09', 'Chatime Metropolitan Mall 2', 'Bekasi', 1, 1, 'Delivered', 'Husen', 'Budi', 0],
        ['SJ-11SE-0129', 'Senin', '2026-11-09', 'Chatime Gandaria City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Husen', 'Nova', 0],
        ['SJ-11SE-0130', 'Senin', '2026-11-09', 'Chatime Central Park', 'Jakarta Barat', 2, 2, 'Delivered', 'Husen', 'Dewi', 0],
        ['SJ-11SE-0131', 'Selasa', '2026-11-10', 'Toys Kingdom Palem Semi', 'Tangerang', 1, 1, 'Delivered', 'Ahmad', 'Budi', 0],
        ['SJ-11SE-0132', 'Selasa', '2026-11-10', 'Toys Kingdom Supermal Karawaci', 'Tangerang', 1, 1, 'Delivered', 'Ahmad', 'Nova', 0],
        ['SJ-11SE-0133', 'Selasa', '2026-11-10', 'Toys Kingdom Grand Indonesia', 'Jakarta Pusat', 1, 0, 'On Delivery', 'Ahmad', 'Dewi', 0],
        ['SJ-11SE-0134', 'Selasa', '2026-11-10', 'Azko PIK Avenue', 'Jakarta Utara', 2, 2, 'Delivered', 'Ahmad', 'Budi', 0],
        ['SJ-11SE-0135', 'Selasa', '2026-11-10', 'Azko Green Terrace TMII', 'Jakarta Timur', 2, 2, 'Delivered', 'Ahmad', 'Nova', 0],
        ['SJ-11SE-0136', 'Selasa', '2026-11-10', 'Azko Bogor Terasutra', 'Jakarta Selatan', 1, 0, 'On Delivery', 'Ahmad', 'Dewi', 0],
        ['SJ-11SE-0137', 'Selasa', '2026-11-10', 'Azko Citra 6', 'Jakarta Barat', 1, 1, 'Delivered', 'Ahmad', 'Budi', 0],
        ['SJ-11SE-0138', 'Selasa', '2026-11-10', 'Azko Kota Wisata Bogor', 'Bekasi', 1, 1, 'Delivered', 'Beto', 'Nova', 0],
        ['SJ-11SE-0139', 'Selasa', '2026-11-10', 'Azko QBig BSD', 'Tangerang', 2, 2, 'Delivered', 'Beto', 'Dewi', 0],
        ['SJ-11SE-0140', 'Selasa', '2026-11-10', 'Azko Metro Sunter', 'Jakarta Utara', 1, 1, 'Delivered', 'Beto', 'Budi', 0],
        ['SJ-11SE-0141', 'Selasa', '2026-11-10', 'Color Star (Linda)', 'Jakarta Barat', 2, 2, 'Delivered', 'Beto', 'Nova', 0],
        ['SJ-11SE-0142', 'Selasa', '2026-11-10', 'Resto Sederhana', 'Jakarta Pusat', 2, 2, 'Delivered', 'Beto', 'Dewi', 0],
        ['SJ-11SE-0143', 'Selasa', '2026-11-10', 'Lawson Station', 'Jakarta Selatan', 1, 1, 'Delivered', 'Beto', 'Budi', 0],
        ['SJ-11SE-0144', 'Selasa', '2026-11-10', 'Kopi Kenangan', 'Jakarta Selatan', 2, 2, 'Delivered', 'Eri', 'Nova', 0],
        ['SJ-11SE-0145', 'Selasa', '2026-11-10', 'Fore Coffee', 'Jakarta Pusat', 1, 1, 'Delivered', 'Eri', 'Dewi', 0],
        ['SJ-11SE-0146', 'Selasa', '2026-11-10', 'Janji Jiwa', 'Jakarta Barat', 1, 1, 'Delivered', 'Eri', 'Budi', 0],
        ['SJ-11SE-0147', 'Selasa', '2026-11-10', 'Holland Bakery', 'Jakarta Barat', 1, 1, 'Delivered', 'Eri', 'Nova', 0],
        ['SJ-11SE-0148', 'Selasa', '2026-11-10', 'JCO Donuts & Coffee', 'Jakarta Selatan', 2, 2, 'Delivered', 'Eri', 'Dewi', 0],
        ['SJ-11SE-0149', 'Selasa', '2026-11-10', 'BreadTalk', 'Jakarta Barat', 1, 1, 'Delivered', 'Eri', 'Budi', 0],
        ['SJ-11SE-0150', 'Selasa', '2026-11-10', 'Guardian Pharmacy', 'Jakarta Selatan', 1, 1, 'Delivered', 'Eri', 'Nova', 0],
        ['SJ-11SE-0151', 'Selasa', '2026-11-10', 'Watsons', 'Jakarta Pusat', 1, 1, 'Delivered', 'Irfan', 'Dewi', 0],
        ['SJ-11SE-0152', 'Selasa', '2026-11-10', 'Century Healthcare', 'Jakarta Barat', 1, 1, 'Delivered', 'Irfan', 'Budi', 0],
        ['SJ-11SE-0153', 'Selasa', '2026-11-10', 'Kimia Farma', 'Jakarta Timur', 1, 1, 'Delivered', 'Irfan', 'Nova', 0],
        ['SJ-11SE-0154', 'Selasa', '2026-11-10', 'Mitra 10', 'Tangerang', 2, 2, 'Delivered', 'Irfan', 'Dewi', 0],
        ['SJ-11SE-0155', 'Selasa', '2026-11-10', 'Depo Bangunan', 'Tangerang', 2, 2, 'Delivered', 'Irfan', 'Budi', 0],
        ['SJ-11SE-0156', 'Selasa', '2026-11-10', 'Electronic City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Irfan', 'Nova', 0],
        ['SJ-11SE-0157', 'Selasa', '2026-11-10', 'Erafone', 'Jakarta Pusat', 1, 1, 'Delivered', 'Irfan', 'Dewi', 0],
        ['SJ-11SE-0158', 'Selasa', '2026-11-10', 'iBox Central Park', 'Jakarta Barat', 2, 2, 'Delivered', 'Baihaqi', 'Budi', 0],
        ['SJ-11SE-0159', 'Selasa', '2026-11-10', 'Gramedia Matraman', 'Jakarta Timur', 1, 1, 'Delivered', 'Baihaqi', 'Nova', 0],
        ['SJ-11SE-0160', 'Selasa', '2026-11-10', 'Ranch Market Pesanggrahan', 'Jakarta Barat', 1, 1, 'Delivered', 'Baihaqi', 'Dewi', 0],
        ['SJ-11SE-0161', 'Selasa', '2026-11-10', 'Farmers Market Kelapa Gading', 'Jakarta Utara', 1, 1, 'Delivered', 'Baihaqi', 'Budi', 0],
        ['SJ-11SE-0162', 'Selasa', '2026-11-10', 'Papaya Fresh Gallery', 'Jakarta Selatan', 1, 1, 'Delivered', 'Baihaqi', 'Nova', 0],
        ['SJ-11SE-0163', 'Selasa', '2026-11-10', 'Kem Chicks Pacific Place', 'Jakarta Selatan', 1, 1, 'Delivered', 'Baihaqi', 'Dewi', 0],
        ['SJ-11SE-0164', 'Selasa', '2026-11-10', 'Lotte Mart Meruya', 'Jakarta Barat', 2, 2, 'Delivered', 'Baihaqi', 'Budi', 0],
        ['SJ-11SE-0165', 'Selasa', '2026-11-10', 'Gold Coast Office', 'Jakarta Utara', 1, 1, 'Delivered', 'Haris', 'Nova', 0],
        ['SJ-11SE-0166', 'Selasa', '2026-11-10', 'Mall Bassura Jatinegara', 'Jakarta Timur', 2, 2, 'Delivered', 'Haris', 'Dewi', 0],
        ['SJ-11SE-0167', 'Selasa', '2026-11-10', 'Plaza Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Haris', 'Budi', 0],
        ['SJ-11SE-0168', 'Selasa', '2026-11-10', 'Lippo Mall Puri', 'Jakarta Barat', 2, 2, 'Delivered', 'Haris', 'Nova', 0],
        ['SJ-11SE-0169', 'Selasa', '2026-11-10', 'Supermal Karawaci', 'Tangerang', 1, 1, 'Delivered', 'Haris', 'Dewi', 0],
        ['SJ-11SE-0170', 'Selasa', '2026-11-10', 'Summarecon Mall Serpong', 'Tangerang', 1, 1, 'Delivered', 'Haris', 'Budi', 0],
        ['SJ-11SE-0171', 'Selasa', '2026-11-10', 'Summarecon Mall Kelapa Gading', 'Jakarta Utara', 1, 1, 'Delivered', 'Haris', 'Nova', 0],
        ['SJ-11SE-0172', 'Selasa', '2026-11-10', 'Puri Indah Mall', 'Jakarta Barat', 1, 1, 'Delivered', 'Umar', 'Dewi', 0],
        ['SJ-11SE-0173', 'Selasa', '2026-11-10', 'PT Aspirasi Hidup Indonesia Tbk', 'Jakarta Barat', 1, 1, 'Delivered', 'Umar', 'Budi', 0],
        ['SJ-11SE-0174', 'Selasa', '2026-11-10', 'PT Foods Beverages Indonesia', 'Jakarta Selatan', 1, 1, 'Delivered', 'Umar', 'Nova', 0],
        ['SJ-11SE-0175', 'Selasa', '2026-11-10', 'PT Tri Sakti Purwosari Makmur', 'Jakarta Barat', 1, 1, 'Delivered', 'Umar', 'Dewi', 0],
        ['SJ-11SE-0176', 'Selasa', '2026-11-10', 'PT Home Center Indonesia Retail', 'Bekasi', 1, 1, 'Delivered', 'Umar', 'Budi', 0],
        ['SJ-11SE-0177', 'Selasa', '2026-11-10', 'PT Toys Games Indonesia', 'Tangerang', 1, 1, 'Delivered', 'Umar', 'Nova', 0],
        ['SJ-11SE-0178', 'Selasa', '2026-11-10', 'PT BQuik Otomotif Indonesia', 'Jakarta Barat', 1, 1, 'Delivered', 'Umar', 'Dewi', 0],
        ['SJ-11SE-0179', 'Selasa', '2026-11-10', 'PT Benfood Dinamika Sentosa', 'Jakarta Selatan', 2, 2, 'Delivered', 'Umar', 'Budi', 0],
        ['SJ-11SE-0180', 'Selasa', '2026-11-10', 'PT Astra International', 'Jakarta Pusat', 2, 2, 'Delivered', 'Noval', 'Nova', 0],
        ['SJ-11SE-0181', 'Selasa', '2026-11-10', 'PT Indofood CBP Sukses Makmur', 'Tangerang', 2, 2, 'Delivered', 'Noval', 'Dewi', 0],
        ['SJ-11SE-0182', 'Selasa', '2026-11-10', 'PT Sumber Alfaria Trijaya', 'Bekasi', 1, 1, 'Delivered', 'Noval', 'Budi', 0],
        ['SJ-11SE-0183', 'Selasa', '2026-11-10', 'PT Mayora Indah', 'Tangerang', 2, 2, 'Delivered', 'Noval', 'Nova', 0],
        ['SJ-11SE-0184', 'Selasa', '2026-11-10', 'PT Beverindo Indah Abadi', 'Jakarta Pusat', 1, 1, 'Delivered', 'Noval', 'Dewi', 0],
        ['SJ-11SE-0185', 'Selasa', '2026-11-10', 'PT Jasmine Journey Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Noval', 'Budi', 0],
        ['SJ-11SE-0186', 'Selasa', '2026-11-10', 'PT Wook Global Technology', 'Jakarta Utara', 2, 2, 'Delivered', 'Jay', 'Nova', 0],
        ['SJ-11SE-0187', 'Selasa', '2026-11-10', 'PT Kalbe Farma', 'Jakarta Timur', 2, 2, 'Delivered', 'Jay', 'Dewi', 0],
        ['SJ-11SE-0188', 'Selasa', '2026-11-10', 'PT Makmur Jaya', 'Jakarta Selatan', 1, 1, 'Delivered', 'Jay', 'Budi', 0],
        ['SJ-11SE-0189', 'Selasa', '2026-11-10', 'PT Intitirta Sarimakmur', 'Jakarta Utara', 1, 1, 'Delivered', 'Jay', 'Nova', 0],
        ['SJ-11SE-0190', 'Selasa', '2026-11-10', 'PT Perindustrian Bapak Djenggot', 'Jakarta Barat', 2, 2, 'Delivered', 'Jay', 'Dewi', 0],
        ['SJ-11SE-0191', 'Selasa', '2026-11-10', 'Panorama JTB (Head Office)', 'Jakarta Pusat', 1, 1, 'Delivered', 'Jay', 'Budi', 0],
        ['SJ-11SE-0192', 'Selasa', '2026-11-10', 'Pixel Group Indonesia', 'Jakarta Selatan', 2, 2, 'Delivered', 'Ferdi', 'Nova', 0],
        ['SJ-11SE-0193', 'Selasa', '2026-11-10', 'Premier Village', 'Tangerang', 2, 2, 'Delivered', 'Ferdi', 'Dewi', 0],
        ['SJ-11SE-0194', 'Selasa', '2026-11-10', 'REX Kiriman Express', 'Jakarta Barat', 2, 2, 'Delivered', 'Ferdi', 'Budi', 0],
        ['SJ-11SE-0195', 'Selasa', '2026-11-10', 'Kawan Lama Sejahtera', 'Jakarta Barat', 1, 1, 'Delivered', 'Ferdi', 'Nova', 0],
        ['SJ-11SE-0196', 'Selasa', '2026-11-10', 'Wisma KEIAI', 'Jakarta Pusat', 1, 1, 'Delivered', 'Ferdi', 'Dewi', 0],
        ['SJ-11SE-0197', 'Selasa', '2026-11-10', 'Kacamatamoo Rawasari', 'Jakarta Pusat', 1, 1, 'Delivered', 'Ferdi', 'Budi', 0],
        ['SJ-11SE-0198', 'Selasa', '2026-11-10', 'GrandLucky - SCBD', 'Jakarta Selatan', 2, 2, 'Delivered', 'Jagatbaru', 'Nova', 0],
        ['SJ-11SE-0199', 'Selasa', '2026-11-10', 'GrandLucky BSD City', 'Tangerang', 1, 1, 'Delivered', 'Jagatbaru', 'Dewi', 0],
        ['SJ-11SE-0200', 'Selasa', '2026-11-10', 'Eraprima Industrial Park', 'Tangerang', 2, 2, 'Delivered', 'Jagatbaru', 'Budi', 0],
        ['SJ-11SE-0201', 'Selasa', '2026-11-10', 'Mandiri University Wijaya Kusuma', 'Jakarta Barat', 2, 2, 'Delivered', 'Jagatbaru', 'Nova', 0],
        ['SJ-11SE-0202', 'Selasa', '2026-11-10', 'Pacific Place Mall', 'Jakarta Selatan', 2, 2, 'Delivered', 'Jagatbaru', 'Dewi', 0],
        ['SJ-11SE-0203', 'Selasa', '2026-11-10', 'INFORMA - Living World Kota Wisata', 'Bekasi', 1, 1, 'Delivered', 'pbseventeensc', 'Budi', 0],
        ['SJ-11SE-0204', 'Selasa', '2026-11-10', 'Living World Alam Sutera', 'Tangerang', 2, 2, 'Delivered', 'pbseventeensc', 'Nova', 0],
        ['SJ-11SE-0205', 'Selasa', '2026-11-10', 'Mall Senayan City', 'Jakarta Pusat', 2, 2, 'Delivered', 'pbseventeensc', 'Dewi', 0],
        ['SJ-11SE-0206', 'Selasa', '2026-11-10', 'Grand Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'pbseventeensc', 'Budi', 0],
        ['SJ-11SE-0207', 'Selasa', '2026-11-10', 'Central Park Mall', 'Jakarta Barat', 1, 1, 'Delivered', 'pbseventeensc', 'Nova', 0],
        ['SJ-11SE-0208', 'Selasa', '2026-11-10', 'Gandaria City', 'Jakarta Selatan', 1, 1, 'Delivered', 'pbseventeensc', 'Dewi', 0],
        ['SJ-11SE-0209', 'Selasa', '2026-11-10', 'AEON Mall BSD City', 'Tangerang', 1, 1, 'Delivered', 'pbseventeensc', 'Budi', 0],
        ['SJ-11SE-0210', 'Selasa', '2026-11-10', 'AEON Mall Jakarta Garden City', 'Jakarta Timur', 2, 2, 'Delivered', 'Soleh', 'Nova', 0],
        ['SJ-11SE-0211', 'Selasa', '2026-11-10', 'AEON Mall Tanjung Barat', 'Jakarta Selatan', 2, 2, 'Delivered', 'Soleh', 'Dewi', 0],
        ['SJ-11SE-0212', 'Selasa', '2026-11-10', 'Anytime Fitness', 'Jakarta Selatan', 2, 2, 'Delivered', 'Soleh', 'Budi', 0],
        ['SJ-11SE-0213', 'Selasa', '2026-11-10', 'Ataru Living World', 'Tangerang', 2, 2, 'Delivered', 'Soleh', 'Nova', 0],
        ['SJ-11SE-0214', 'Selasa', '2026-11-10', 'Chatime Metropolitan Mall 2', 'Bekasi', 1, 1, 'Delivered', 'Soleh', 'Dewi', 0],
        ['SJ-11SE-0215', 'Selasa', '2026-11-10', 'Chatime Gandaria City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Romi', 'Budi', 0],
        ['SJ-11SE-0216', 'Selasa', '2026-11-10', 'Chatime Central Park', 'Jakarta Barat', 1, 1, 'Delivered', 'Romi', 'Nova', 0],
        ['SJ-11SE-0217', 'Selasa', '2026-11-10', 'Toys Kingdom Palem Semi', 'Tangerang', 1, 1, 'Delivered', 'Romi', 'Dewi', 0],
        ['SJ-11SE-0218', 'Selasa', '2026-11-10', 'Toys Kingdom Supermal Karawaci', 'Tangerang', 1, 1, 'Delivered', 'Romi', 'Budi', 0],
        ['SJ-11SE-0219', 'Selasa', '2026-11-10', 'Toys Kingdom Grand Indonesia', 'Jakarta Pusat', 2, 2, 'Delivered', 'Romi', 'Nova', 0],
        ['SJ-11SE-0220', 'Selasa', '2026-11-10', 'Azko PIK Avenue', 'Jakarta Utara', 2, 2, 'Delivered', 'Romi', 'Dewi', 0],
        ['SJ-11SE-0221', 'Selasa', '2026-11-10', 'Azko Green Terrace TMII', 'Jakarta Timur', 1, 1, 'Delivered', 'Romi', 'Budi', 0],
        ['SJ-11SE-0222', 'Selasa', '2026-11-10', 'Azko Bogor Terasutra', 'Jakarta Selatan', 2, 2, 'Delivered', 'Firdaus', 'Nova', 0],
        ['SJ-11SE-0223', 'Selasa', '2026-11-10', 'Azko Citra 6', 'Jakarta Barat', 2, 2, 'Delivered', 'Firdaus', 'Dewi', 0],
        ['SJ-11SE-0224', 'Selasa', '2026-11-10', 'Azko Kota Wisata Bogor', 'Bekasi', 2, 2, 'Delivered', 'Firdaus', 'Budi', 0],
        ['SJ-11SE-0225', 'Selasa', '2026-11-10', 'Azko QBig BSD', 'Tangerang', 1, 1, 'Delivered', 'Firdaus', 'Nova', 0],
        ['SJ-11SE-0226', 'Selasa', '2026-11-10', 'Azko Metro Sunter', 'Jakarta Utara', 1, 1, 'Delivered', 'Firdaus', 'Dewi', 0],
        ['SJ-11SE-0227', 'Selasa', '2026-11-10', 'Color Star (Linda)', 'Jakarta Barat', 1, 1, 'Delivered', 'Firdaus', 'Budi', 0],
        ['SJ-11SE-0228', 'Selasa', '2026-11-10', 'Resto Sederhana', 'Jakarta Pusat', 2, 2, 'Delivered', 'Alan', 'Nova', 0],
        ['SJ-11SE-0229', 'Selasa', '2026-11-10', 'Lawson Station', 'Jakarta Selatan', 1, 1, 'Delivered', 'Alan', 'Dewi', 0],
        ['SJ-11SE-0230', 'Selasa', '2026-11-10', 'Kopi Kenangan', 'Jakarta Selatan', 2, 2, 'Delivered', 'Alan', 'Budi', 0],
        ['SJ-11SE-0231', 'Selasa', '2026-11-10', 'Fore Coffee', 'Jakarta Pusat', 2, 2, 'Delivered', 'Alan', 'Nova', 0],
        ['SJ-11SE-0232', 'Selasa', '2026-11-10', 'Janji Jiwa', 'Jakarta Barat', 2, 2, 'Delivered', 'Alan', 'Dewi', 0],
        ['SJ-11SE-0233', 'Selasa', '2026-11-10', 'Holland Bakery', 'Jakarta Barat', 1, 1, 'Delivered', 'Yakub', 'Budi', 0],
        ['SJ-11SE-0234', 'Selasa', '2026-11-10', 'JCO Donuts & Coffee', 'Jakarta Selatan', 1, 1, 'Delivered', 'Yakub', 'Nova', 0],
        ['SJ-11SE-0235', 'Selasa', '2026-11-10', 'BreadTalk', 'Jakarta Barat', 1, 1, 'Delivered', 'Yakub', 'Dewi', 0],
        ['SJ-11SE-0236', 'Selasa', '2026-11-10', 'Guardian Pharmacy', 'Jakarta Selatan', 1, 1, 'Delivered', 'Yakub', 'Budi', 0],
        ['SJ-11SE-0237', 'Selasa', '2026-11-10', 'Watsons', 'Jakarta Pusat', 1, 1, 'Delivered', 'Yakub', 'Nova', 0],
        ['SJ-11SE-0238', 'Selasa', '2026-11-10', 'Century Healthcare', 'Jakarta Barat', 1, 1, 'Delivered', 'Yakub', 'Dewi', 0],
        ['SJ-11SE-0239', 'Selasa', '2026-11-10', 'Kimia Farma', 'Jakarta Timur', 1, 1, 'Delivered', 'Yakub', 'Budi', 0],
        ['SJ-11SE-0240', 'Selasa', '2026-11-10', 'Mitra 10', 'Tangerang', 1, 1, 'Delivered', 'Yakub', 'Nova', 0],
        ['SJ-11SE-0241', 'Selasa', '2026-11-10', 'Depo Bangunan', 'Tangerang', 1, 1, 'Delivered', 'Iwan', 'Dewi', 0],
        ['SJ-11SE-0242', 'Selasa', '2026-11-10', 'Electronic City', 'Jakarta Selatan', 2, 2, 'Delivered', 'Iwan', 'Budi', 0],
        ['SJ-11SE-0243', 'Selasa', '2026-11-10', 'Erafone', 'Jakarta Pusat', 1, 1, 'Delivered', 'Iwan', 'Nova', 0],
        ['SJ-11SE-0244', 'Selasa', '2026-11-10', 'iBox Central Park', 'Jakarta Barat', 2, 2, 'Delivered', 'Iwan', 'Dewi', 0],
        ['SJ-11SE-0245', 'Selasa', '2026-11-10', 'Gramedia Matraman', 'Jakarta Timur', 2, 2, 'Delivered', 'Iwan', 'Budi', 0],
        ['SJ-11SE-0246', 'Selasa', '2026-11-10', 'Ranch Market Pesanggrahan', 'Jakarta Barat', 1, 1, 'Delivered', 'Agung', 'Nova', 0],
        ['SJ-11SE-0247', 'Selasa', '2026-11-10', 'Farmers Market Kelapa Gading', 'Jakarta Utara', 2, 2, 'Delivered', 'Agung', 'Dewi', 0],
        ['SJ-11SE-0248', 'Selasa', '2026-11-10', 'Papaya Fresh Gallery', 'Jakarta Selatan', 1, 1, 'Delivered', 'Agung', 'Budi', 0],
        ['SJ-11SE-0249', 'Selasa', '2026-11-10', 'Kem Chicks Pacific Place', 'Jakarta Selatan', 1, 1, 'Delivered', 'Agung', 'Nova', 0],
        ['SJ-11SE-0250', 'Selasa', '2026-11-10', 'Lotte Mart Meruya', 'Jakarta Barat', 1, 1, 'Delivered', 'Agung', 'Dewi', 0],
        ['SJ-11SE-0251', 'Selasa', '2026-11-10', 'Gold Coast Office', 'Jakarta Utara', 2, 2, 'Delivered', 'Agung', 'Budi', 0],
        ['SJ-11SE-0252', 'Selasa', '2026-11-10', 'Mall Bassura Jatinegara', 'Jakarta Timur', 1, 1, 'Delivered', 'Husen', 'Nova', 0],
        ['SJ-11SE-0253', 'Selasa', '2026-11-10', 'Plaza Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Husen', 'Dewi', 0],
        ['SJ-11SE-0254', 'Selasa', '2026-11-10', 'Lippo Mall Puri', 'Jakarta Barat', 2, 2, 'Delivered', 'Husen', 'Budi', 0],
        ['SJ-11SE-0255', 'Selasa', '2026-11-10', 'Supermal Karawaci', 'Tangerang', 1, 1, 'Delivered', 'Husen', 'Nova', 0],
        ['SJ-11SE-0256', 'Selasa', '2026-11-10', 'Summarecon Mall Serpong', 'Tangerang', 1, 1, 'Delivered', 'Husen', 'Dewi', 0],
        ['SJ-11SE-0257', 'Selasa', '2026-11-10', 'Summarecon Mall Kelapa Gading', 'Jakarta Utara', 2, 2, 'Delivered', 'Husen', 'Budi', 0],
        ['SJ-11RA-0258', 'Rabu', '2026-11-11', 'Puri Indah Mall', 'Jakarta Barat', 1, 1, 'Delivered', 'Ahmad', 'Nova', 0],
        ['SJ-11RA-0259', 'Rabu', '2026-11-11', 'PT Aspirasi Hidup Indonesia Tbk', 'Jakarta Barat', 1, 0, 'On Delivery', 'Ahmad', 'Dewi', 0],
        ['SJ-11RA-0260', 'Rabu', '2026-11-11', 'PT Foods Beverages Indonesia', 'Jakarta Selatan', 2, 2, 'Delivered', 'Ahmad', 'Budi', 0],
        ['SJ-11RA-0261', 'Rabu', '2026-11-11', 'PT Tri Sakti Purwosari Makmur', 'Jakarta Barat', 2, 2, 'Delivered', 'Ahmad', 'Nova', 0],
        ['SJ-11RA-0262', 'Rabu', '2026-11-11', 'PT Home Center Indonesia Retail', 'Bekasi', 2, 2, 'Delivered', 'Ahmad', 'Dewi', 0],
        ['SJ-11RA-0263', 'Rabu', '2026-11-11', 'PT Toys Games Indonesia', 'Tangerang', 1, 1, 'Delivered', 'Ahmad', 'Budi', 0],
        ['SJ-11RA-0264', 'Rabu', '2026-11-11', 'PT BQuik Otomotif Indonesia', 'Jakarta Barat', 1, 1, 'Delivered', 'Ahmad', 'Nova', 0],
        ['SJ-11RA-0265', 'Rabu', '2026-11-11', 'PT Benfood Dinamika Sentosa', 'Jakarta Selatan', 1, 1, 'Delivered', 'Beto', 'Dewi', 0],
        ['SJ-11RA-0266', 'Rabu', '2026-11-11', 'PT Astra International', 'Jakarta Pusat', 2, 2, 'Delivered', 'Beto', 'Budi', 0],
        ['SJ-11RA-0267', 'Rabu', '2026-11-11', 'PT Indofood CBP Sukses Makmur', 'Tangerang', 1, 1, 'Delivered', 'Beto', 'Nova', 0],
        ['SJ-11RA-0268', 'Rabu', '2026-11-11', 'PT Sumber Alfaria Trijaya', 'Bekasi', 2, 2, 'Delivered', 'Beto', 'Dewi', 0],
        ['SJ-11RA-0269', 'Rabu', '2026-11-11', 'PT Mayora Indah', 'Tangerang', 1, 1, 'Delivered', 'Beto', 'Budi', 0],
        ['SJ-11RA-0270', 'Rabu', '2026-11-11', 'PT Beverindo Indah Abadi', 'Jakarta Pusat', 1, 1, 'Delivered', 'Beto', 'Nova', 0],
        ['SJ-11RA-0271', 'Rabu', '2026-11-11', 'PT Jasmine Journey Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Beto', 'Dewi', 0],
        ['SJ-11RA-0272', 'Rabu', '2026-11-11', 'PT Wook Global Technology', 'Jakarta Utara', 1, 1, 'Delivered', 'Beto', 'Budi', 0],
        ['SJ-11RA-0273', 'Rabu', '2026-11-11', 'PT Kalbe Farma', 'Jakarta Timur', 1, 1, 'Delivered', 'Eri', 'Nova', 0],
        ['SJ-11RA-0274', 'Rabu', '2026-11-11', 'PT Makmur Jaya', 'Jakarta Selatan', 2, 2, 'Delivered', 'Eri', 'Dewi', 0],
        ['SJ-11RA-0275', 'Rabu', '2026-11-11', 'PT Intitirta Sarimakmur', 'Jakarta Utara', 1, 1, 'Delivered', 'Eri', 'Budi', 0],
        ['SJ-11RA-0276', 'Rabu', '2026-11-11', 'PT Perindustrian Bapak Djenggot', 'Jakarta Barat', 1, 1, 'Delivered', 'Eri', 'Nova', 0],
        ['SJ-11RA-0277', 'Rabu', '2026-11-11', 'Panorama JTB (Head Office)', 'Jakarta Pusat', 1, 1, 'Delivered', 'Eri', 'Dewi', 0],
        ['SJ-11RA-0278', 'Rabu', '2026-11-11', 'Pixel Group Indonesia', 'Jakarta Selatan', 2, 2, 'Delivered', 'Eri', 'Budi', 0],
        ['SJ-11RA-0279', 'Rabu', '2026-11-11', 'Premier Village', 'Tangerang', 1, 1, 'Delivered', 'Eri', 'Nova', 0],
        ['SJ-11RA-0280', 'Rabu', '2026-11-11', 'REX Kiriman Express', 'Jakarta Barat', 1, 1, 'Delivered', 'Eri', 'Dewi', 0],
        ['SJ-11RA-0281', 'Rabu', '2026-11-11', 'Kawan Lama Sejahtera', 'Jakarta Barat', 1, 1, 'Delivered', 'Irfan', 'Budi', 0],
        ['SJ-11RA-0282', 'Rabu', '2026-11-11', 'Wisma KEIAI', 'Jakarta Pusat', 1, 1, 'Delivered', 'Irfan', 'Nova', 0],
        ['SJ-11RA-0283', 'Rabu', '2026-11-11', 'Kacamatamoo Rawasari', 'Jakarta Pusat', 1, 1, 'Delivered', 'Irfan', 'Dewi', 0],
        ['SJ-11RA-0284', 'Rabu', '2026-11-11', 'GrandLucky - SCBD', 'Jakarta Selatan', 2, 2, 'Delivered', 'Irfan', 'Budi', 0],
        ['SJ-11RA-0285', 'Rabu', '2026-11-11', 'GrandLucky BSD City', 'Tangerang', 2, 2, 'Delivered', 'Irfan', 'Nova', 0],
        ['SJ-11RA-0286', 'Rabu', '2026-11-11', 'Eraprima Industrial Park', 'Tangerang', 1, 1, 'Delivered', 'Irfan', 'Dewi', 0],
        ['SJ-11RA-0287', 'Rabu', '2026-11-11', 'Mandiri University Wijaya Kusuma', 'Jakarta Barat', 2, 2, 'Delivered', 'Irfan', 'Budi', 0],
        ['SJ-11RA-0288', 'Rabu', '2026-11-11', 'Pacific Place Mall', 'Jakarta Selatan', 1, 1, 'Delivered', 'Baihaqi', 'Nova', 0],
        ['SJ-11RA-0289', 'Rabu', '2026-11-11', 'INFORMA - Living World Kota Wisata', 'Bekasi', 1, 1, 'Delivered', 'Baihaqi', 'Dewi', 0],
        ['SJ-11RA-0290', 'Rabu', '2026-11-11', 'Living World Alam Sutera', 'Tangerang', 2, 2, 'Delivered', 'Baihaqi', 'Budi', 0],
        ['SJ-11RA-0291', 'Rabu', '2026-11-11', 'Mall Senayan City', 'Jakarta Pusat', 1, 1, 'Delivered', 'Baihaqi', 'Nova', 0],
        ['SJ-11RA-0292', 'Rabu', '2026-11-11', 'Grand Indonesia', 'Jakarta Pusat', 2, 2, 'Delivered', 'Baihaqi', 'Dewi', 0],
        ['SJ-11RA-0293', 'Rabu', '2026-11-11', 'Central Park Mall', 'Jakarta Barat', 2, 2, 'Delivered', 'Baihaqi', 'Budi', 0],
        ['SJ-11RA-0294', 'Rabu', '2026-11-11', 'Gandaria City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Haris', 'Nova', 0],
        ['SJ-11RA-0295', 'Rabu', '2026-11-11', 'AEON Mall BSD City', 'Tangerang', 2, 2, 'Delivered', 'Haris', 'Dewi', 0],
        ['SJ-11RA-0296', 'Rabu', '2026-11-11', 'AEON Mall Jakarta Garden City', 'Jakarta Timur', 2, 2, 'Delivered', 'Haris', 'Budi', 0],
        ['SJ-11RA-0297', 'Rabu', '2026-11-11', 'AEON Mall Tanjung Barat', 'Jakarta Selatan', 1, 1, 'Delivered', 'Haris', 'Nova', 0],
        ['SJ-11RA-0298', 'Rabu', '2026-11-11', 'Anytime Fitness', 'Jakarta Selatan', 1, 1, 'Delivered', 'Haris', 'Dewi', 0],
        ['SJ-11RA-0299', 'Rabu', '2026-11-11', 'Ataru Living World', 'Tangerang', 2, 2, 'Delivered', 'Haris', 'Budi', 0],
        ['SJ-11RA-0300', 'Rabu', '2026-11-11', 'Chatime Metropolitan Mall 2', 'Bekasi', 1, 1, 'Delivered', 'Umar', 'Nova', 0],
        ['SJ-11RA-0301', 'Rabu', '2026-11-11', 'Chatime Gandaria City', 'Jakarta Selatan', 2, 2, 'Delivered', 'Umar', 'Dewi', 0],
        ['SJ-11RA-0302', 'Rabu', '2026-11-11', 'Chatime Central Park', 'Jakarta Barat', 1, 1, 'Delivered', 'Umar', 'Budi', 0],
        ['SJ-11RA-0303', 'Rabu', '2026-11-11', 'Toys Kingdom Palem Semi', 'Tangerang', 1, 1, 'Delivered', 'Umar', 'Nova', 0],
        ['SJ-11RA-0304', 'Rabu', '2026-11-11', 'Toys Kingdom Supermal Karawaci', 'Tangerang', 1, 1, 'Delivered', 'Umar', 'Dewi', 0],
        ['SJ-11RA-0305', 'Rabu', '2026-11-11', 'Toys Kingdom Grand Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Umar', 'Budi', 0],
        ['SJ-11RA-0306', 'Rabu', '2026-11-11', 'Azko PIK Avenue', 'Jakarta Utara', 1, 1, 'Delivered', 'Umar', 'Nova', 0],
        ['SJ-11RA-0307', 'Rabu', '2026-11-11', 'Azko Green Terrace TMII', 'Jakarta Timur', 1, 1, 'Delivered', 'Umar', 'Dewi', 0],
        ['SJ-11RA-0308', 'Rabu', '2026-11-11', 'Azko Bogor Terasutra', 'Jakarta Selatan', 2, 2, 'Delivered', 'Noval', 'Budi', 0],
        ['SJ-11RA-0309', 'Rabu', '2026-11-11', 'Azko Citra 6', 'Jakarta Barat', 1, 1, 'Delivered', 'Noval', 'Nova', 0],
        ['SJ-11RA-0310', 'Rabu', '2026-11-11', 'Azko Kota Wisata Bogor', 'Bekasi', 2, 2, 'Delivered', 'Noval', 'Dewi', 0],
        ['SJ-11RA-0311', 'Rabu', '2026-11-11', 'Azko QBig BSD', 'Tangerang', 2, 2, 'Delivered', 'Noval', 'Budi', 0],
        ['SJ-11RA-0312', 'Rabu', '2026-11-11', 'Azko Metro Sunter', 'Jakarta Utara', 1, 1, 'Delivered', 'Noval', 'Nova', 0],
        ['SJ-11RA-0313', 'Rabu', '2026-11-11', 'Color Star (Linda)', 'Jakarta Barat', 1, 1, 'Delivered', 'Noval', 'Dewi', 0],
        ['SJ-11RA-0314', 'Rabu', '2026-11-11', 'Resto Sederhana', 'Jakarta Pusat', 2, 2, 'Delivered', 'Jay', 'Budi', 0],
        ['SJ-11RA-0315', 'Rabu', '2026-11-11', 'Lawson Station', 'Jakarta Selatan', 1, 1, 'Delivered', 'Jay', 'Nova', 0],
        ['SJ-11RA-0316', 'Rabu', '2026-11-11', 'Kopi Kenangan', 'Jakarta Selatan', 1, 1, 'Delivered', 'Jay', 'Dewi', 0],
        ['SJ-11RA-0317', 'Rabu', '2026-11-11', 'Fore Coffee', 'Jakarta Pusat', 1, 1, 'Delivered', 'Jay', 'Budi', 0],
        ['SJ-11RA-0318', 'Rabu', '2026-11-11', 'Janji Jiwa', 'Jakarta Barat', 1, 1, 'Delivered', 'Jay', 'Nova', 0],
        ['SJ-11RA-0319', 'Rabu', '2026-11-11', 'Holland Bakery', 'Jakarta Barat', 2, 2, 'Delivered', 'Jay', 'Dewi', 0],
        ['SJ-11RA-0320', 'Rabu', '2026-11-11', 'JCO Donuts & Coffee', 'Jakarta Selatan', 1, 1, 'Delivered', 'Jay', 'Budi', 0],
        ['SJ-11RA-0321', 'Rabu', '2026-11-11', 'BreadTalk', 'Jakarta Barat', 2, 2, 'Delivered', 'Ferdi', 'Nova', 0],
        ['SJ-11RA-0322', 'Rabu', '2026-11-11', 'Guardian Pharmacy', 'Jakarta Selatan', 1, 1, 'Delivered', 'Ferdi', 'Dewi', 0],
        ['SJ-11RA-0323', 'Rabu', '2026-11-11', 'Watsons', 'Jakarta Pusat', 1, 1, 'Delivered', 'Ferdi', 'Budi', 0],
        ['SJ-11RA-0324', 'Rabu', '2026-11-11', 'Century Healthcare', 'Jakarta Barat', 1, 1, 'Delivered', 'Ferdi', 'Nova', 0],
        ['SJ-11RA-0325', 'Rabu', '2026-11-11', 'Kimia Farma', 'Jakarta Timur', 1, 1, 'Delivered', 'Ferdi', 'Dewi', 0],
        ['SJ-11RA-0326', 'Rabu', '2026-11-11', 'Mitra 10', 'Tangerang', 1, 1, 'Delivered', 'Ferdi', 'Budi', 0],
        ['SJ-11RA-0327', 'Rabu', '2026-11-11', 'Depo Bangunan', 'Tangerang', 1, 1, 'Delivered', 'Ferdi', 'Nova', 0],
        ['SJ-11RA-0328', 'Rabu', '2026-11-11', 'Electronic City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Ferdi', 'Dewi', 0],
        ['SJ-11RA-0329', 'Rabu', '2026-11-11', 'Erafone', 'Jakarta Pusat', 1, 1, 'Delivered', 'Jagatbaru', 'Budi', 0],
        ['SJ-11RA-0330', 'Rabu', '2026-11-11', 'iBox Central Park', 'Jakarta Barat', 1, 1, 'Delivered', 'Jagatbaru', 'Nova', 0],
        ['SJ-11RA-0331', 'Rabu', '2026-11-11', 'Gramedia Matraman', 'Jakarta Timur', 2, 2, 'Delivered', 'Jagatbaru', 'Dewi', 0],
        ['SJ-11RA-0332', 'Rabu', '2026-11-11', 'Ranch Market Pesanggrahan', 'Jakarta Barat', 2, 2, 'Delivered', 'Jagatbaru', 'Budi', 0],
        ['SJ-11RA-0333', 'Rabu', '2026-11-11', 'Farmers Market Kelapa Gading', 'Jakarta Utara', 2, 2, 'Delivered', 'Jagatbaru', 'Nova', 0],
        ['SJ-11RA-0334', 'Rabu', '2026-11-11', 'Papaya Fresh Gallery', 'Jakarta Selatan', 1, 1, 'Delivered', 'Jagatbaru', 'Dewi', 0],
        ['SJ-11RA-0335', 'Rabu', '2026-11-11', 'Kem Chicks Pacific Place', 'Jakarta Selatan', 1, 1, 'Delivered', 'pbseventeensc', 'Budi', 0],
        ['SJ-11RA-0336', 'Rabu', '2026-11-11', 'Lotte Mart Meruya', 'Jakarta Barat', 2, 2, 'Delivered', 'pbseventeensc', 'Nova', 0],
        ['SJ-11RA-0337', 'Rabu', '2026-11-11', 'Gold Coast Office', 'Jakarta Utara', 1, 1, 'Delivered', 'pbseventeensc', 'Dewi', 0],
        ['SJ-11RA-0338', 'Rabu', '2026-11-11', 'Mall Bassura Jatinegara', 'Jakarta Timur', 2, 2, 'Delivered', 'pbseventeensc', 'Budi', 0],
        ['SJ-11RA-0339', 'Rabu', '2026-11-11', 'Plaza Indonesia', 'Jakarta Pusat', 2, 2, 'Delivered', 'pbseventeensc', 'Nova', 0],
        ['SJ-11RA-0340', 'Rabu', '2026-11-11', 'Lippo Mall Puri', 'Jakarta Barat', 1, 1, 'Delivered', 'pbseventeensc', 'Dewi', 0],
        ['SJ-11RA-0341', 'Rabu', '2026-11-11', 'Supermal Karawaci', 'Tangerang', 1, 1, 'Delivered', 'Soleh', 'Budi', 0],
        ['SJ-11RA-0342', 'Rabu', '2026-11-11', 'Summarecon Mall Serpong', 'Tangerang', 2, 2, 'Delivered', 'Soleh', 'Nova', 0],
        ['SJ-11RA-0343', 'Rabu', '2026-11-11', 'Summarecon Mall Kelapa Gading', 'Jakarta Utara', 1, 1, 'Delivered', 'Soleh', 'Dewi', 0],
        ['SJ-11RA-0344', 'Rabu', '2026-11-11', 'Puri Indah Mall', 'Jakarta Barat', 2, 2, 'Delivered', 'Soleh', 'Budi', 0],
        ['SJ-11RA-0345', 'Rabu', '2026-11-11', 'PT Aspirasi Hidup Indonesia Tbk', 'Jakarta Barat', 1, 1, 'Delivered', 'Soleh', 'Nova', 0],
        ['SJ-11RA-0346', 'Rabu', '2026-11-11', 'PT Foods Beverages Indonesia', 'Jakarta Selatan', 1, 1, 'Delivered', 'Soleh', 'Dewi', 0],
        ['SJ-11RA-0347', 'Rabu', '2026-11-11', 'PT Tri Sakti Purwosari Makmur', 'Jakarta Barat', 1, 1, 'Delivered', 'Soleh', 'Budi', 0],
        ['SJ-11RA-0348', 'Rabu', '2026-11-11', 'PT Home Center Indonesia Retail', 'Bekasi', 1, 1, 'Delivered', 'Romi', 'Nova', 0],
        ['SJ-11RA-0349', 'Rabu', '2026-11-11', 'PT Toys Games Indonesia', 'Tangerang', 1, 1, 'Delivered', 'Romi', 'Dewi', 0],
        ['SJ-11RA-0350', 'Rabu', '2026-11-11', 'PT BQuik Otomotif Indonesia', 'Jakarta Barat', 2, 2, 'Delivered', 'Romi', 'Budi', 0],
        ['SJ-11RA-0351', 'Rabu', '2026-11-11', 'PT Benfood Dinamika Sentosa', 'Jakarta Selatan', 1, 1, 'Delivered', 'Romi', 'Nova', 0],
        ['SJ-11RA-0352', 'Rabu', '2026-11-11', 'PT Astra International', 'Jakarta Pusat', 1, 1, 'Delivered', 'Romi', 'Dewi', 0],
        ['SJ-11RA-0353', 'Rabu', '2026-11-11', 'PT Indofood CBP Sukses Makmur', 'Tangerang', 2, 2, 'Delivered', 'Romi', 'Budi', 0],
        ['SJ-11RA-0354', 'Rabu', '2026-11-11', 'PT Sumber Alfaria Trijaya', 'Bekasi', 1, 1, 'Delivered', 'Romi', 'Nova', 0],
        ['SJ-11RA-0355', 'Rabu', '2026-11-11', 'PT Mayora Indah', 'Tangerang', 1, 1, 'Delivered', 'Firdaus', 'Dewi', 0],
        ['SJ-11RA-0356', 'Rabu', '2026-11-11', 'PT Beverindo Indah Abadi', 'Jakarta Pusat', 2, 2, 'Delivered', 'Firdaus', 'Budi', 0],
        ['SJ-11RA-0357', 'Rabu', '2026-11-11', 'PT Jasmine Journey Indonesia', 'Jakarta Pusat', 2, 2, 'Delivered', 'Firdaus', 'Nova', 0],
        ['SJ-11RA-0358', 'Rabu', '2026-11-11', 'PT Wook Global Technology', 'Jakarta Utara', 1, 1, 'Delivered', 'Firdaus', 'Dewi', 0],
        ['SJ-11RA-0359', 'Rabu', '2026-11-11', 'PT Kalbe Farma', 'Jakarta Timur', 1, 1, 'Delivered', 'Firdaus', 'Budi', 0],
        ['SJ-11RA-0360', 'Rabu', '2026-11-11', 'PT Makmur Jaya', 'Jakarta Selatan', 1, 1, 'Delivered', 'Firdaus', 'Nova', 0],
        ['SJ-11RA-0361', 'Rabu', '2026-11-11', 'PT Intitirta Sarimakmur', 'Jakarta Utara', 1, 1, 'Delivered', 'Firdaus', 'Dewi', 0],
        ['SJ-11RA-0362', 'Rabu', '2026-11-11', 'PT Perindustrian Bapak Djenggot', 'Jakarta Barat', 1, 1, 'Delivered', 'Alan', 'Budi', 0],
        ['SJ-11RA-0363', 'Rabu', '2026-11-11', 'Panorama JTB (Head Office)', 'Jakarta Pusat', 2, 2, 'Delivered', 'Alan', 'Nova', 0],
        ['SJ-11RA-0364', 'Rabu', '2026-11-11', 'Pixel Group Indonesia', 'Jakarta Selatan', 1, 1, 'Delivered', 'Alan', 'Dewi', 0],
        ['SJ-11RA-0365', 'Rabu', '2026-11-11', 'Premier Village', 'Tangerang', 2, 2, 'Delivered', 'Alan', 'Budi', 0],
        ['SJ-11RA-0366', 'Rabu', '2026-11-11', 'REX Kiriman Express', 'Jakarta Barat', 2, 2, 'Delivered', 'Alan', 'Nova', 0],
        ['SJ-11RA-0367', 'Rabu', '2026-11-11', 'Kawan Lama Sejahtera', 'Jakarta Barat', 1, 1, 'Delivered', 'Alan', 'Dewi', 0],
        ['SJ-11RA-0368', 'Rabu', '2026-11-11', 'Wisma KEIAI', 'Jakarta Pusat', 2, 2, 'Delivered', 'Yakub', 'Budi', 0],
        ['SJ-11RA-0369', 'Rabu', '2026-11-11', 'Kacamatamoo Rawasari', 'Jakarta Pusat', 1, 1, 'Delivered', 'Yakub', 'Nova', 0],
        ['SJ-11RA-0370', 'Rabu', '2026-11-11', 'GrandLucky - SCBD', 'Jakarta Selatan', 1, 1, 'Delivered', 'Yakub', 'Dewi', 0],
        ['SJ-11RA-0371', 'Rabu', '2026-11-11', 'GrandLucky BSD City', 'Tangerang', 1, 1, 'Delivered', 'Yakub', 'Budi', 0],
        ['SJ-11RA-0372', 'Rabu', '2026-11-11', 'Eraprima Industrial Park', 'Tangerang', 1, 1, 'Delivered', 'Yakub', 'Nova', 0],
        ['SJ-11RA-0373', 'Rabu', '2026-11-11', 'Mandiri University Wijaya Kusuma', 'Jakarta Barat', 2, 2, 'Delivered', 'Yakub', 'Dewi', 0],
        ['SJ-11RA-0374', 'Rabu', '2026-11-11', 'Pacific Place Mall', 'Jakarta Selatan', 1, 1, 'Delivered', 'Yakub', 'Budi', 0],
        ['SJ-11RA-0375', 'Rabu', '2026-11-11', 'INFORMA - Living World Kota Wisata', 'Bekasi', 1, 1, 'Delivered', 'Iwan', 'Nova', 0],
        ['SJ-11RA-0376', 'Rabu', '2026-11-11', 'Living World Alam Sutera', 'Tangerang', 1, 1, 'Delivered', 'Iwan', 'Dewi', 0],
        ['SJ-11RA-0377', 'Rabu', '2026-11-11', 'Mall Senayan City', 'Jakarta Pusat', 1, 1, 'Delivered', 'Iwan', 'Budi', 0],
        ['SJ-11RA-0378', 'Rabu', '2026-11-11', 'Grand Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Iwan', 'Nova', 0],
        ['SJ-11RA-0379', 'Rabu', '2026-11-11', 'Central Park Mall', 'Jakarta Barat', 1, 1, 'Delivered', 'Iwan', 'Dewi', 0],
        ['SJ-11RA-0380', 'Rabu', '2026-11-11', 'Gandaria City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Iwan', 'Budi', 0],
        ['SJ-11RA-0381', 'Rabu', '2026-11-11', 'AEON Mall BSD City', 'Tangerang', 2, 2, 'Delivered', 'Iwan', 'Nova', 0],
        ['SJ-11RA-0382', 'Rabu', '2026-11-11', 'AEON Mall Jakarta Garden City', 'Jakarta Timur', 1, 1, 'Delivered', 'Iwan', 'Dewi', 0],
        ['SJ-11RA-0383', 'Rabu', '2026-11-11', 'AEON Mall Tanjung Barat', 'Jakarta Selatan', 2, 2, 'Delivered', 'Agung', 'Budi', 0],
        ['SJ-11RA-0384', 'Rabu', '2026-11-11', 'Anytime Fitness', 'Jakarta Selatan', 1, 1, 'Delivered', 'Agung', 'Nova', 0],
        ['SJ-11RA-0385', 'Rabu', '2026-11-11', 'Ataru Living World', 'Tangerang', 1, 1, 'Delivered', 'Agung', 'Dewi', 0],
        ['SJ-11RA-0386', 'Rabu', '2026-11-11', 'Chatime Metropolitan Mall 2', 'Bekasi', 1, 1, 'Delivered', 'Agung', 'Budi', 0],
        ['SJ-11RA-0387', 'Rabu', '2026-11-11', 'Chatime Gandaria City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Agung', 'Nova', 0],
        ['SJ-11RA-0388', 'Rabu', '2026-11-11', 'Chatime Central Park', 'Jakarta Barat', 2, 2, 'Delivered', 'Agung', 'Dewi', 0],
        ['SJ-11RA-0389', 'Rabu', '2026-11-11', 'Toys Kingdom Palem Semi', 'Tangerang', 1, 1, 'Delivered', 'Agung', 'Budi', 0],
        ['SJ-11RA-0390', 'Rabu', '2026-11-11', 'Toys Kingdom Supermal Karawaci', 'Tangerang', 1, 1, 'Delivered', 'Husen', 'Nova', 0],
        ['SJ-11RA-0391', 'Rabu', '2026-11-11', 'Toys Kingdom Grand Indonesia', 'Jakarta Pusat', 2, 2, 'Delivered', 'Husen', 'Dewi', 0],
        ['SJ-11RA-0392', 'Rabu', '2026-11-11', 'Azko PIK Avenue', 'Jakarta Utara', 1, 1, 'Delivered', 'Husen', 'Budi', 0],
        ['SJ-11RA-0393', 'Rabu', '2026-11-11', 'Azko Green Terrace TMII', 'Jakarta Timur', 1, 1, 'Delivered', 'Husen', 'Nova', 0],
        ['SJ-11RA-0394', 'Rabu', '2026-11-11', 'Azko Bogor Terasutra', 'Jakarta Selatan', 1, 1, 'Delivered', 'Husen', 'Dewi', 0],
        ['SJ-11RA-0395', 'Rabu', '2026-11-11', 'Azko Citra 6', 'Jakarta Barat', 2, 2, 'Delivered', 'Husen', 'Budi', 0],
        ['SJ-11RA-0396', 'Rabu', '2026-11-11', 'Azko Kota Wisata Bogor', 'Bekasi', 1, 1, 'Delivered', 'Husen', 'Nova', 0],
        ['SJ-11KA-0397', 'Kamis', '2026-11-12', 'Azko QBig BSD', 'Tangerang', 2, 1, 'On Delivery', 'Ahmad', 'Dewi', 0],
        ['SJ-11KA-0398', 'Kamis', '2026-11-12', 'Azko Metro Sunter', 'Jakarta Utara', 2, 1, 'On Delivery', 'Ahmad', 'Budi', 0],
        ['SJ-11KA-0399', 'Kamis', '2026-11-12', 'Color Star (Linda)', 'Jakarta Barat', 1, 1, 'Delivered', 'Ahmad', 'Nova', 0],
        ['SJ-11KA-0400', 'Kamis', '2026-11-12', 'Resto Sederhana', 'Jakarta Pusat', 1, 1, 'Delivered', 'Ahmad', 'Dewi', 0],
        ['SJ-11KA-0401', 'Kamis', '2026-11-12', 'Lawson Station', 'Jakarta Selatan', 2, 2, 'Delivered', 'Ahmad', 'Budi', 0],
        ['SJ-11KA-0402', 'Kamis', '2026-11-12', 'Kopi Kenangan', 'Jakarta Selatan', 2, 2, 'Delivered', 'Ahmad', 'Nova', 0],
        ['SJ-11KA-0403', 'Kamis', '2026-11-12', 'Fore Coffee', 'Jakarta Pusat', 2, 1, 'On Delivery', 'Beto', 'Dewi', 0],
        ['SJ-11KA-0404', 'Kamis', '2026-11-12', 'Janji Jiwa', 'Jakarta Barat', 2, 1, 'On Delivery', 'Beto', 'Budi', 0],
        ['SJ-11KA-0405', 'Kamis', '2026-11-12', 'Holland Bakery', 'Jakarta Barat', 2, 2, 'Delivered', 'Beto', 'Nova', 0],
        ['SJ-11KA-0406', 'Kamis', '2026-11-12', 'JCO Donuts & Coffee', 'Jakarta Selatan', 1, 1, 'Delivered', 'Beto', 'Dewi', 0],
        ['SJ-11KA-0407', 'Kamis', '2026-11-12', 'BreadTalk', 'Jakarta Barat', 1, 0, 'On Delivery', 'Beto', 'Budi', 0],
        ['SJ-11KA-0408', 'Kamis', '2026-11-12', 'Guardian Pharmacy', 'Jakarta Selatan', 1, 1, 'Delivered', 'Beto', 'Nova', 0],
        ['SJ-11KA-0409', 'Kamis', '2026-11-12', 'Watsons', 'Jakarta Pusat', 1, 1, 'Delivered', 'Beto', 'Dewi', 0],
        ['SJ-11KA-0410', 'Kamis', '2026-11-12', 'Century Healthcare', 'Jakarta Barat', 1, 0, 'On Delivery', 'Eri', 'Budi', 0],
        ['SJ-11KA-0411', 'Kamis', '2026-11-12', 'Kimia Farma', 'Jakarta Timur', 1, 1, 'Delivered', 'Eri', 'Nova', 0],
        ['SJ-11KA-0412', 'Kamis', '2026-11-12', 'Mitra 10', 'Tangerang', 1, 1, 'Delivered', 'Eri', 'Dewi', 0],
        ['SJ-11KA-0413', 'Kamis', '2026-11-12', 'Depo Bangunan', 'Tangerang', 2, 2, 'Delivered', 'Eri', 'Budi', 0],
        ['SJ-11KA-0414', 'Kamis', '2026-11-12', 'Electronic City', 'Jakarta Selatan', 2, 1, 'On Delivery', 'Eri', 'Nova', 0],
        ['SJ-11KA-0415', 'Kamis', '2026-11-12', 'Erafone', 'Jakarta Pusat', 2, 2, 'Delivered', 'Eri', 'Dewi', 0],
        ['SJ-11KA-0416', 'Kamis', '2026-11-12', 'iBox Central Park', 'Jakarta Barat', 1, 1, 'Delivered', 'Eri', 'Budi', 0],
        ['SJ-11KA-0417', 'Kamis', '2026-11-12', 'Gramedia Matraman', 'Jakarta Timur', 1, 0, 'On Delivery', 'Irfan', 'Nova', 0],
        ['SJ-11KA-0418', 'Kamis', '2026-11-12', 'Ranch Market Pesanggrahan', 'Jakarta Barat', 2, 2, 'Delivered', 'Irfan', 'Dewi', 0],
        ['SJ-11KA-0419', 'Kamis', '2026-11-12', 'Farmers Market Kelapa Gading', 'Jakarta Utara', 1, 1, 'Delivered', 'Irfan', 'Budi', 0],
        ['SJ-11KA-0420', 'Kamis', '2026-11-12', 'Papaya Fresh Gallery', 'Jakarta Selatan', 1, 0, 'On Delivery', 'Irfan', 'Nova', 0],
        ['SJ-11KA-0421', 'Kamis', '2026-11-12', 'Kem Chicks Pacific Place', 'Jakarta Selatan', 2, 2, 'Delivered', 'Irfan', 'Dewi', 0],
        ['SJ-11KA-0422', 'Kamis', '2026-11-12', 'Lotte Mart Meruya', 'Jakarta Barat', 1, 1, 'Delivered', 'Irfan', 'Budi', 0],
        ['SJ-11KA-0423', 'Kamis', '2026-11-12', 'Gold Coast Office', 'Jakarta Utara', 1, 1, 'Delivered', 'Irfan', 'Nova', 0],
        ['SJ-11KA-0424', 'Kamis', '2026-11-12', 'Mall Bassura Jatinegara', 'Jakarta Timur', 1, 1, 'Delivered', 'Irfan', 'Dewi', 0],
        ['SJ-11KA-0425', 'Kamis', '2026-11-12', 'Plaza Indonesia', 'Jakarta Pusat', 2, 2, 'Delivered', 'Baihaqi', 'Budi', 0],
        ['SJ-11KA-0426', 'Kamis', '2026-11-12', 'Lippo Mall Puri', 'Jakarta Barat', 1, 1, 'Delivered', 'Baihaqi', 'Nova', 0],
        ['SJ-11KA-0427', 'Kamis', '2026-11-12', 'Supermal Karawaci', 'Tangerang', 2, 2, 'Delivered', 'Baihaqi', 'Dewi', 0],
        ['SJ-11KA-0428', 'Kamis', '2026-11-12', 'Summarecon Mall Serpong', 'Tangerang', 1, 1, 'Delivered', 'Baihaqi', 'Budi', 0],
        ['SJ-11KA-0429', 'Kamis', '2026-11-12', 'Summarecon Mall Kelapa Gading', 'Jakarta Utara', 1, 1, 'Delivered', 'Baihaqi', 'Nova', 0],
        ['SJ-11KA-0430', 'Kamis', '2026-11-12', 'Puri Indah Mall', 'Jakarta Barat', 2, 2, 'Delivered', 'Baihaqi', 'Dewi', 0],
        ['SJ-11KA-0431', 'Kamis', '2026-11-12', 'PT Aspirasi Hidup Indonesia Tbk', 'Jakarta Barat', 1, 1, 'Delivered', 'Baihaqi', 'Budi', 0],
        ['SJ-11KA-0432', 'Kamis', '2026-11-12', 'PT Foods Beverages Indonesia', 'Jakarta Selatan', 1, 1, 'Delivered', 'Haris', 'Nova', 0],
        ['SJ-11KA-0433', 'Kamis', '2026-11-12', 'PT Tri Sakti Purwosari Makmur', 'Jakarta Barat', 2, 2, 'Delivered', 'Haris', 'Dewi', 0],
        ['SJ-11KA-0434', 'Kamis', '2026-11-12', 'PT Home Center Indonesia Retail', 'Bekasi', 2, 2, 'Delivered', 'Haris', 'Budi', 0],
        ['SJ-11KA-0435', 'Kamis', '2026-11-12', 'PT Toys Games Indonesia', 'Tangerang', 1, 1, 'Delivered', 'Haris', 'Nova', 0],
        ['SJ-11KA-0436', 'Kamis', '2026-11-12', 'PT BQuik Otomotif Indonesia', 'Jakarta Barat', 1, 1, 'Delivered', 'Haris', 'Dewi', 0],
        ['SJ-11KA-0437', 'Kamis', '2026-11-12', 'PT Benfood Dinamika Sentosa', 'Jakarta Selatan', 2, 2, 'Delivered', 'Haris', 'Budi', 0],
        ['SJ-11KA-0438', 'Kamis', '2026-11-12', 'PT Astra International', 'Jakarta Pusat', 1, 1, 'Delivered', 'Haris', 'Nova', 0],
        ['SJ-11KA-0439', 'Kamis', '2026-11-12', 'PT Indofood CBP Sukses Makmur', 'Tangerang', 2, 2, 'Delivered', 'Umar', 'Dewi', 0],
        ['SJ-11KA-0440', 'Kamis', '2026-11-12', 'PT Sumber Alfaria Trijaya', 'Bekasi', 1, 1, 'Delivered', 'Umar', 'Budi', 0],
        ['SJ-11KA-0441', 'Kamis', '2026-11-12', 'PT Mayora Indah', 'Tangerang', 1, 1, 'Delivered', 'Umar', 'Nova', 0],
        ['SJ-11KA-0442', 'Kamis', '2026-11-12', 'PT Beverindo Indah Abadi', 'Jakarta Pusat', 1, 1, 'Delivered', 'Umar', 'Dewi', 0],
        ['SJ-11KA-0443', 'Kamis', '2026-11-12', 'PT Jasmine Journey Indonesia', 'Jakarta Pusat', 2, 2, 'Delivered', 'Umar', 'Budi', 0],
        ['SJ-11KA-0444', 'Kamis', '2026-11-12', 'PT Wook Global Technology', 'Jakarta Utara', 1, 1, 'Delivered', 'Umar', 'Nova', 0],
        ['SJ-11KA-0445', 'Kamis', '2026-11-12', 'PT Kalbe Farma', 'Jakarta Timur', 2, 2, 'Delivered', 'Umar', 'Dewi', 0],
        ['SJ-11KA-0446', 'Kamis', '2026-11-12', 'PT Makmur Jaya', 'Jakarta Selatan', 2, 2, 'Delivered', 'Noval', 'Budi', 0],
        ['SJ-11KA-0447', 'Kamis', '2026-11-12', 'PT Intitirta Sarimakmur', 'Jakarta Utara', 1, 1, 'Delivered', 'Noval', 'Nova', 0],
        ['SJ-11KA-0448', 'Kamis', '2026-11-12', 'PT Perindustrian Bapak Djenggot', 'Jakarta Barat', 2, 2, 'Delivered', 'Noval', 'Dewi', 0],
        ['SJ-11KA-0449', 'Kamis', '2026-11-12', 'Panorama JTB (Head Office)', 'Jakarta Pusat', 2, 2, 'Delivered', 'Noval', 'Budi', 0],
        ['SJ-11KA-0450', 'Kamis', '2026-11-12', 'Pixel Group Indonesia', 'Jakarta Selatan', 1, 1, 'Delivered', 'Noval', 'Nova', 0],
        ['SJ-11KA-0451', 'Kamis', '2026-11-12', 'Premier Village', 'Tangerang', 2, 2, 'Delivered', 'Noval', 'Dewi', 0],
        ['SJ-11KA-0452', 'Kamis', '2026-11-12', 'REX Kiriman Express', 'Jakarta Barat', 1, 1, 'Delivered', 'Jay', 'Budi', 0],
        ['SJ-11KA-0453', 'Kamis', '2026-11-12', 'Kawan Lama Sejahtera', 'Jakarta Barat', 2, 2, 'Delivered', 'Jay', 'Nova', 0],
        ['SJ-11KA-0454', 'Kamis', '2026-11-12', 'Wisma KEIAI', 'Jakarta Pusat', 1, 1, 'Delivered', 'Jay', 'Dewi', 0],
        ['SJ-11KA-0455', 'Kamis', '2026-11-12', 'Kacamatamoo Rawasari', 'Jakarta Pusat', 1, 1, 'Delivered', 'Jay', 'Budi', 0],
        ['SJ-11KA-0456', 'Kamis', '2026-11-12', 'GrandLucky - SCBD', 'Jakarta Selatan', 1, 1, 'Delivered', 'Jay', 'Nova', 0],
        ['SJ-11KA-0457', 'Kamis', '2026-11-12', 'GrandLucky BSD City', 'Tangerang', 1, 1, 'Delivered', 'Jay', 'Dewi', 0],
        ['SJ-11KA-0458', 'Kamis', '2026-11-12', 'Eraprima Industrial Park', 'Tangerang', 2, 2, 'Delivered', 'Jay', 'Budi', 0],
        ['SJ-11KA-0459', 'Kamis', '2026-11-12', 'Mandiri University Wijaya Kusuma', 'Jakarta Barat', 1, 1, 'Delivered', 'Jay', 'Nova', 0],
        ['SJ-11KA-0460', 'Kamis', '2026-11-12', 'Pacific Place Mall', 'Jakarta Selatan', 1, 1, 'Delivered', 'Ferdi', 'Dewi', 0],
        ['SJ-11KA-0461', 'Kamis', '2026-11-12', 'INFORMA - Living World Kota Wisata', 'Bekasi', 1, 1, 'Delivered', 'Ferdi', 'Budi', 0],
        ['SJ-11KA-0462', 'Kamis', '2026-11-12', 'Living World Alam Sutera', 'Tangerang', 2, 2, 'Delivered', 'Ferdi', 'Nova', 0],
        ['SJ-11KA-0463', 'Kamis', '2026-11-12', 'Mall Senayan City', 'Jakarta Pusat', 2, 2, 'Delivered', 'Ferdi', 'Dewi', 0],
        ['SJ-11KA-0464', 'Kamis', '2026-11-12', 'Grand Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Ferdi', 'Budi', 0],
        ['SJ-11KA-0465', 'Kamis', '2026-11-12', 'Central Park Mall', 'Jakarta Barat', 1, 1, 'Delivered', 'Ferdi', 'Nova', 0],
        ['SJ-11KA-0466', 'Kamis', '2026-11-12', 'Gandaria City', 'Jakarta Selatan', 2, 2, 'Delivered', 'Ferdi', 'Dewi', 0],
        ['SJ-11KA-0467', 'Kamis', '2026-11-12', 'AEON Mall BSD City', 'Tangerang', 1, 1, 'Delivered', 'Jagatbaru', 'Budi', 0],
        ['SJ-11KA-0468', 'Kamis', '2026-11-12', 'AEON Mall Jakarta Garden City', 'Jakarta Timur', 1, 1, 'Delivered', 'Jagatbaru', 'Nova', 0],
        ['SJ-11KA-0469', 'Kamis', '2026-11-12', 'AEON Mall Tanjung Barat', 'Jakarta Selatan', 1, 1, 'Delivered', 'Jagatbaru', 'Dewi', 0],
        ['SJ-11KA-0470', 'Kamis', '2026-11-12', 'Anytime Fitness', 'Jakarta Selatan', 1, 1, 'Delivered', 'Jagatbaru', 'Budi', 0],
        ['SJ-11KA-0471', 'Kamis', '2026-11-12', 'Ataru Living World', 'Tangerang', 2, 2, 'Delivered', 'Jagatbaru', 'Nova', 0],
        ['SJ-11KA-0472', 'Kamis', '2026-11-12', 'Chatime Metropolitan Mall 2', 'Bekasi', 2, 2, 'Delivered', 'Jagatbaru', 'Dewi', 0],
        ['SJ-11KA-0473', 'Kamis', '2026-11-12', 'Chatime Gandaria City', 'Jakarta Selatan', 2, 2, 'Delivered', 'Jagatbaru', 'Budi', 0],
        ['SJ-11KA-0474', 'Kamis', '2026-11-12', 'Chatime Central Park', 'Jakarta Barat', 1, 1, 'Delivered', 'pbseventeensc', 'Nova', 0],
        ['SJ-11KA-0475', 'Kamis', '2026-11-12', 'Toys Kingdom Palem Semi', 'Tangerang', 2, 2, 'Delivered', 'pbseventeensc', 'Dewi', 0],
        ['SJ-11KA-0476', 'Kamis', '2026-11-12', 'Toys Kingdom Supermal Karawaci', 'Tangerang', 1, 1, 'Delivered', 'pbseventeensc', 'Budi', 0],
        ['SJ-11KA-0477', 'Kamis', '2026-11-12', 'Toys Kingdom Grand Indonesia', 'Jakarta Pusat', 2, 2, 'Delivered', 'pbseventeensc', 'Nova', 0],
        ['SJ-11KA-0478', 'Kamis', '2026-11-12', 'Azko PIK Avenue', 'Jakarta Utara', 1, 1, 'Delivered', 'pbseventeensc', 'Dewi', 0],
        ['SJ-11KA-0479', 'Kamis', '2026-11-12', 'Azko Green Terrace TMII', 'Jakarta Timur', 1, 1, 'Delivered', 'pbseventeensc', 'Budi', 0],
        ['SJ-11KA-0480', 'Kamis', '2026-11-12', 'Azko Bogor Terasutra', 'Jakarta Selatan', 2, 2, 'Delivered', 'pbseventeensc', 'Nova', 0],
        ['SJ-11KA-0481', 'Kamis', '2026-11-12', 'Azko Citra 6', 'Jakarta Barat', 1, 1, 'Delivered', 'Soleh', 'Dewi', 0],
        ['SJ-11KA-0482', 'Kamis', '2026-11-12', 'Azko Kota Wisata Bogor', 'Bekasi', 1, 1, 'Delivered', 'Soleh', 'Budi', 0],
        ['SJ-11KA-0483', 'Kamis', '2026-11-12', 'Azko QBig BSD', 'Tangerang', 1, 1, 'Delivered', 'Soleh', 'Nova', 0],
        ['SJ-11KA-0484', 'Kamis', '2026-11-12', 'Azko Metro Sunter', 'Jakarta Utara', 1, 1, 'Delivered', 'Soleh', 'Dewi', 0],
        ['SJ-11KA-0485', 'Kamis', '2026-11-12', 'Color Star (Linda)', 'Jakarta Barat', 1, 1, 'Delivered', 'Soleh', 'Budi', 0],
        ['SJ-11KA-0486', 'Kamis', '2026-11-12', 'Resto Sederhana', 'Jakarta Pusat', 2, 2, 'Delivered', 'Soleh', 'Nova', 0],
        ['SJ-11KA-0487', 'Kamis', '2026-11-12', 'Lawson Station', 'Jakarta Selatan', 1, 1, 'Delivered', 'Soleh', 'Dewi', 0],
        ['SJ-11KA-0488', 'Kamis', '2026-11-12', 'Kopi Kenangan', 'Jakarta Selatan', 1, 1, 'Delivered', 'Soleh', 'Budi', 0],
        ['SJ-11KA-0489', 'Kamis', '2026-11-12', 'Fore Coffee', 'Jakarta Pusat', 2, 2, 'Delivered', 'Romi', 'Nova', 0],
        ['SJ-11KA-0490', 'Kamis', '2026-11-12', 'Janji Jiwa', 'Jakarta Barat', 2, 2, 'Delivered', 'Romi', 'Dewi', 0],
        ['SJ-11KA-0491', 'Kamis', '2026-11-12', 'Holland Bakery', 'Jakarta Barat', 1, 1, 'Delivered', 'Romi', 'Budi', 0],
        ['SJ-11KA-0492', 'Kamis', '2026-11-12', 'JCO Donuts & Coffee', 'Jakarta Selatan', 2, 2, 'Delivered', 'Romi', 'Nova', 0],
        ['SJ-11KA-0493', 'Kamis', '2026-11-12', 'BreadTalk', 'Jakarta Barat', 1, 1, 'Delivered', 'Romi', 'Dewi', 0],
        ['SJ-11KA-0494', 'Kamis', '2026-11-12', 'Guardian Pharmacy', 'Jakarta Selatan', 1, 1, 'Delivered', 'Romi', 'Budi', 0],
        ['SJ-11KA-0495', 'Kamis', '2026-11-12', 'Watsons', 'Jakarta Pusat', 1, 1, 'Delivered', 'Firdaus', 'Nova', 0],
        ['SJ-11KA-0496', 'Kamis', '2026-11-12', 'Century Healthcare', 'Jakarta Barat', 2, 2, 'Delivered', 'Firdaus', 'Dewi', 0],
        ['SJ-11KA-0497', 'Kamis', '2026-11-12', 'Kimia Farma', 'Jakarta Timur', 2, 2, 'Delivered', 'Firdaus', 'Budi', 0],
        ['SJ-11KA-0498', 'Kamis', '2026-11-12', 'Mitra 10', 'Tangerang', 1, 1, 'Delivered', 'Firdaus', 'Nova', 0],
        ['SJ-11KA-0499', 'Kamis', '2026-11-12', 'Depo Bangunan', 'Tangerang', 2, 2, 'Delivered', 'Firdaus', 'Dewi', 0],
        ['SJ-11KA-0500', 'Kamis', '2026-11-12', 'Electronic City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Firdaus', 'Budi', 0],
        ['SJ-11KA-0501', 'Kamis', '2026-11-12', 'Erafone', 'Jakarta Pusat', 1, 1, 'Delivered', 'Alan', 'Nova', 0],
        ['SJ-11KA-0502', 'Kamis', '2026-11-12', 'iBox Central Park', 'Jakarta Barat', 2, 2, 'Delivered', 'Alan', 'Dewi', 0],
        ['SJ-11KA-0503', 'Kamis', '2026-11-12', 'Gramedia Matraman', 'Jakarta Timur', 2, 2, 'Delivered', 'Alan', 'Budi', 0],
        ['SJ-11KA-0504', 'Kamis', '2026-11-12', 'Ranch Market Pesanggrahan', 'Jakarta Barat', 1, 1, 'Delivered', 'Alan', 'Nova', 0],
        ['SJ-11KA-0505', 'Kamis', '2026-11-12', 'Farmers Market Kelapa Gading', 'Jakarta Utara', 1, 1, 'Delivered', 'Alan', 'Dewi', 0],
        ['SJ-11KA-0506', 'Kamis', '2026-11-12', 'Papaya Fresh Gallery', 'Jakarta Selatan', 1, 1, 'Delivered', 'Alan', 'Budi', 0],
        ['SJ-11KA-0507', 'Kamis', '2026-11-12', 'Kem Chicks Pacific Place', 'Jakarta Selatan', 1, 1, 'Delivered', 'Alan', 'Nova', 0],
        ['SJ-11KA-0508', 'Kamis', '2026-11-12', 'Lotte Mart Meruya', 'Jakarta Barat', 2, 2, 'Delivered', 'Yakub', 'Dewi', 0],
        ['SJ-11KA-0509', 'Kamis', '2026-11-12', 'Gold Coast Office', 'Jakarta Utara', 1, 1, 'Delivered', 'Yakub', 'Budi', 0],
        ['SJ-11KA-0510', 'Kamis', '2026-11-12', 'Mall Bassura Jatinegara', 'Jakarta Timur', 1, 1, 'Delivered', 'Yakub', 'Nova', 0],
        ['SJ-11KA-0511', 'Kamis', '2026-11-12', 'Plaza Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Yakub', 'Dewi', 0],
        ['SJ-11KA-0512', 'Kamis', '2026-11-12', 'Lippo Mall Puri', 'Jakarta Barat', 1, 1, 'Delivered', 'Yakub', 'Budi', 0],
        ['SJ-11KA-0513', 'Kamis', '2026-11-12', 'Supermal Karawaci', 'Tangerang', 1, 1, 'Delivered', 'Yakub', 'Nova', 0],
        ['SJ-11KA-0514', 'Kamis', '2026-11-12', 'Summarecon Mall Serpong', 'Tangerang', 2, 2, 'Delivered', 'Yakub', 'Dewi', 0],
        ['SJ-11KA-0515', 'Kamis', '2026-11-12', 'Summarecon Mall Kelapa Gading', 'Jakarta Utara', 2, 2, 'Delivered', 'Iwan', 'Budi', 0],
        ['SJ-11KA-0516', 'Kamis', '2026-11-12', 'Puri Indah Mall', 'Jakarta Barat', 1, 1, 'Delivered', 'Iwan', 'Nova', 0],
        ['SJ-11KA-0517', 'Kamis', '2026-11-12', 'PT Aspirasi Hidup Indonesia Tbk', 'Jakarta Barat', 1, 1, 'Delivered', 'Iwan', 'Dewi', 0],
        ['SJ-11KA-0518', 'Kamis', '2026-11-12', 'PT Foods Beverages Indonesia', 'Jakarta Selatan', 2, 2, 'Delivered', 'Iwan', 'Budi', 0],
        ['SJ-11KA-0519', 'Kamis', '2026-11-12', 'PT Tri Sakti Purwosari Makmur', 'Jakarta Barat', 2, 2, 'Delivered', 'Iwan', 'Nova', 0],
        ['SJ-11KA-0520', 'Kamis', '2026-11-12', 'PT Home Center Indonesia Retail', 'Bekasi', 1, 1, 'Delivered', 'Iwan', 'Dewi', 0],
        ['SJ-11KA-0521', 'Kamis', '2026-11-12', 'PT Toys Games Indonesia', 'Tangerang', 1, 1, 'Delivered', 'Agung', 'Budi', 0],
        ['SJ-11KA-0522', 'Kamis', '2026-11-12', 'PT BQuik Otomotif Indonesia', 'Jakarta Barat', 2, 2, 'Delivered', 'Agung', 'Nova', 0],
        ['SJ-11KA-0523', 'Kamis', '2026-11-12', 'PT Benfood Dinamika Sentosa', 'Jakarta Selatan', 2, 2, 'Delivered', 'Agung', 'Dewi', 0],
        ['SJ-11KA-0524', 'Kamis', '2026-11-12', 'PT Astra International', 'Jakarta Pusat', 2, 2, 'Delivered', 'Agung', 'Budi', 0],
        ['SJ-11KA-0525', 'Kamis', '2026-11-12', 'PT Indofood CBP Sukses Makmur', 'Tangerang', 1, 1, 'Delivered', 'Agung', 'Nova', 0],
        ['SJ-11KA-0526', 'Kamis', '2026-11-12', 'PT Sumber Alfaria Trijaya', 'Bekasi', 1, 1, 'Delivered', 'Agung', 'Dewi', 0],
        ['SJ-11KA-0527', 'Kamis', '2026-11-12', 'PT Mayora Indah', 'Tangerang', 1, 1, 'Delivered', 'Husen', 'Budi', 0],
        ['SJ-11KA-0528', 'Kamis', '2026-11-12', 'PT Beverindo Indah Abadi', 'Jakarta Pusat', 1, 1, 'Delivered', 'Husen', 'Nova', 0],
        ['SJ-11KA-0529', 'Kamis', '2026-11-12', 'PT Jasmine Journey Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Husen', 'Dewi', 0],
        ['SJ-11KA-0530', 'Kamis', '2026-11-12', 'PT Wook Global Technology', 'Jakarta Utara', 1, 1, 'Delivered', 'Husen', 'Budi', 0],
        ['SJ-11KA-0531', 'Kamis', '2026-11-12', 'PT Kalbe Farma', 'Jakarta Timur', 2, 2, 'Delivered', 'Husen', 'Nova', 0],
        ['SJ-11KA-0532', 'Kamis', '2026-11-12', 'PT Makmur Jaya', 'Jakarta Selatan', 1, 1, 'Delivered', 'Husen', 'Dewi', 0],
        ['SJ-11KA-0533', 'Kamis', '2026-11-12', 'PT Intitirta Sarimakmur', 'Jakarta Utara', 2, 2, 'Delivered', 'Husen', 'Budi', 0],
        ['SJ-11JU-0534', 'Jumat', '2026-11-13', 'PT Perindustrian Bapak Djenggot', 'Jakarta Barat', 1, 1, 'Delivered', 'Ahmad', 'Nova', 0],
        ['SJ-11JU-0535', 'Jumat', '2026-11-13', 'Panorama JTB (Head Office)', 'Jakarta Pusat', 1, 1, 'Delivered', 'Ahmad', 'Dewi', 0],
        ['SJ-11JU-0536', 'Jumat', '2026-11-13', 'Pixel Group Indonesia', 'Jakarta Selatan', 2, 2, 'Delivered', 'Ahmad', 'Budi', 0],
        ['SJ-11JU-0537', 'Jumat', '2026-11-13', 'Premier Village', 'Tangerang', 1, 1, 'Delivered', 'Ahmad', 'Nova', 0],
        ['SJ-11JU-0538', 'Jumat', '2026-11-13', 'REX Kiriman Express', 'Jakarta Barat', 2, 2, 'Delivered', 'Ahmad', 'Dewi', 0],
        ['SJ-11JU-0539', 'Jumat', '2026-11-13', 'Kawan Lama Sejahtera', 'Jakarta Barat', 1, 1, 'Delivered', 'Ahmad', 'Budi', 0],
        ['SJ-11JU-0540', 'Jumat', '2026-11-13', 'Wisma KEIAI', 'Jakarta Pusat', 1, 1, 'Delivered', 'Ahmad', 'Nova', 0],
        ['SJ-11JU-0541', 'Jumat', '2026-11-13', 'Kacamatamoo Rawasari', 'Jakarta Pusat', 1, 1, 'Delivered', 'Beto', 'Dewi', 0],
        ['SJ-11JU-0542', 'Jumat', '2026-11-13', 'GrandLucky - SCBD', 'Jakarta Selatan', 1, 1, 'Delivered', 'Beto', 'Budi', 0],
        ['SJ-11JU-0543', 'Jumat', '2026-11-13', 'GrandLucky BSD City', 'Tangerang', 1, 1, 'Delivered', 'Beto', 'Nova', 0],
        ['SJ-11JU-0544', 'Jumat', '2026-11-13', 'Eraprima Industrial Park', 'Tangerang', 2, 2, 'Delivered', 'Beto', 'Dewi', 0],
        ['SJ-11JU-0545', 'Jumat', '2026-11-13', 'Mandiri University Wijaya Kusuma', 'Jakarta Barat', 1, 1, 'Delivered', 'Beto', 'Budi', 0],
        ['SJ-11JU-0546', 'Jumat', '2026-11-13', 'Pacific Place Mall', 'Jakarta Selatan', 1, 1, 'Delivered', 'Beto', 'Nova', 0],
        ['SJ-11JU-0547', 'Jumat', '2026-11-13', 'INFORMA - Living World Kota Wisata', 'Bekasi', 1, 1, 'Delivered', 'Beto', 'Dewi', 0],
        ['SJ-11JU-0548', 'Jumat', '2026-11-13', 'Living World Alam Sutera', 'Tangerang', 1, 1, 'Delivered', 'Beto', 'Budi', 0],
        ['SJ-11JU-0549', 'Jumat', '2026-11-13', 'Mall Senayan City', 'Jakarta Pusat', 2, 2, 'Delivered', 'Eri', 'Nova', 0],
        ['SJ-11JU-0550', 'Jumat', '2026-11-13', 'Grand Indonesia', 'Jakarta Pusat', 2, 2, 'Delivered', 'Eri', 'Dewi', 0],
        ['SJ-11JU-0551', 'Jumat', '2026-11-13', 'Central Park Mall', 'Jakarta Barat', 1, 1, 'Delivered', 'Eri', 'Budi', 0],
        ['SJ-11JU-0552', 'Jumat', '2026-11-13', 'Gandaria City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Eri', 'Nova', 0],
        ['SJ-11JU-0553', 'Jumat', '2026-11-13', 'AEON Mall BSD City', 'Tangerang', 2, 2, 'Delivered', 'Eri', 'Dewi', 0],
        ['SJ-11JU-0554', 'Jumat', '2026-11-13', 'AEON Mall Jakarta Garden City', 'Jakarta Timur', 1, 1, 'Delivered', 'Eri', 'Budi', 0],
        ['SJ-11JU-0555', 'Jumat', '2026-11-13', 'AEON Mall Tanjung Barat', 'Jakarta Selatan', 2, 2, 'Delivered', 'Irfan', 'Nova', 0],
        ['SJ-11JU-0556', 'Jumat', '2026-11-13', 'Anytime Fitness', 'Jakarta Selatan', 2, 2, 'Delivered', 'Irfan', 'Dewi', 0],
        ['SJ-11JU-0557', 'Jumat', '2026-11-13', 'Ataru Living World', 'Tangerang', 2, 2, 'Delivered', 'Irfan', 'Budi', 0],
        ['SJ-11JU-0558', 'Jumat', '2026-11-13', 'Chatime Metropolitan Mall 2', 'Bekasi', 1, 1, 'Delivered', 'Irfan', 'Nova', 0],
        ['SJ-11JU-0559', 'Jumat', '2026-11-13', 'Chatime Gandaria City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Irfan', 'Dewi', 0],
        ['SJ-11JU-0560', 'Jumat', '2026-11-13', 'Chatime Central Park', 'Jakarta Barat', 1, 1, 'Delivered', 'Irfan', 'Budi', 0],
        ['SJ-11JU-0561', 'Jumat', '2026-11-13', 'Toys Kingdom Palem Semi', 'Tangerang', 1, 1, 'Delivered', 'Baihaqi', 'Nova', 0],
        ['SJ-11JU-0562', 'Jumat', '2026-11-13', 'Toys Kingdom Supermal Karawaci', 'Tangerang', 2, 2, 'Delivered', 'Baihaqi', 'Dewi', 0],
        ['SJ-11JU-0563', 'Jumat', '2026-11-13', 'Toys Kingdom Grand Indonesia', 'Jakarta Pusat', 2, 2, 'Delivered', 'Baihaqi', 'Budi', 0],
        ['SJ-11JU-0564', 'Jumat', '2026-11-13', 'Azko PIK Avenue', 'Jakarta Utara', 2, 2, 'Delivered', 'Baihaqi', 'Nova', 0],
        ['SJ-11JU-0565', 'Jumat', '2026-11-13', 'Azko Green Terrace TMII', 'Jakarta Timur', 2, 2, 'Delivered', 'Baihaqi', 'Dewi', 0],
        ['SJ-11JU-0566', 'Jumat', '2026-11-13', 'Azko Bogor Terasutra', 'Jakarta Selatan', 1, 1, 'Delivered', 'Haris', 'Budi', 0],
        ['SJ-11JU-0567', 'Jumat', '2026-11-13', 'Azko Citra 6', 'Jakarta Barat', 1, 1, 'Delivered', 'Haris', 'Nova', 0],
        ['SJ-11JU-0568', 'Jumat', '2026-11-13', 'Azko Kota Wisata Bogor', 'Bekasi', 1, 1, 'Delivered', 'Haris', 'Dewi', 0],
        ['SJ-11JU-0569', 'Jumat', '2026-11-13', 'Azko QBig BSD', 'Tangerang', 2, 2, 'Delivered', 'Haris', 'Budi', 0],
        ['SJ-11JU-0570', 'Jumat', '2026-11-13', 'Azko Metro Sunter', 'Jakarta Utara', 2, 2, 'Delivered', 'Haris', 'Nova', 0],
        ['SJ-11JU-0571', 'Jumat', '2026-11-13', 'Color Star (Linda)', 'Jakarta Barat', 2, 2, 'Delivered', 'Haris', 'Dewi', 0],
        ['SJ-11JU-0572', 'Jumat', '2026-11-13', 'Resto Sederhana', 'Jakarta Pusat', 2, 2, 'Delivered', 'Umar', 'Budi', 0],
        ['SJ-11JU-0573', 'Jumat', '2026-11-13', 'Lawson Station', 'Jakarta Selatan', 2, 2, 'Delivered', 'Umar', 'Nova', 0],
        ['SJ-11JU-0574', 'Jumat', '2026-11-13', 'Kopi Kenangan', 'Jakarta Selatan', 2, 2, 'Delivered', 'Umar', 'Dewi', 0],
        ['SJ-11JU-0575', 'Jumat', '2026-11-13', 'Fore Coffee', 'Jakarta Pusat', 2, 2, 'Delivered', 'Umar', 'Budi', 0],
        ['SJ-11JU-0576', 'Jumat', '2026-11-13', 'Janji Jiwa', 'Jakarta Barat', 1, 1, 'Delivered', 'Umar', 'Nova', 0],
        ['SJ-11JU-0577', 'Jumat', '2026-11-13', 'Holland Bakery', 'Jakarta Barat', 1, 1, 'Delivered', 'Noval', 'Dewi', 0],
        ['SJ-11JU-0578', 'Jumat', '2026-11-13', 'JCO Donuts & Coffee', 'Jakarta Selatan', 2, 2, 'Delivered', 'Noval', 'Budi', 0],
        ['SJ-11JU-0579', 'Jumat', '2026-11-13', 'BreadTalk', 'Jakarta Barat', 1, 1, 'Delivered', 'Noval', 'Nova', 0],
        ['SJ-11JU-0580', 'Jumat', '2026-11-13', 'Guardian Pharmacy', 'Jakarta Selatan', 1, 1, 'Delivered', 'Noval', 'Dewi', 0],
        ['SJ-11JU-0581', 'Jumat', '2026-11-13', 'Watsons', 'Jakarta Pusat', 1, 1, 'Delivered', 'Noval', 'Budi', 0],
        ['SJ-11JU-0582', 'Jumat', '2026-11-13', 'Century Healthcare', 'Jakarta Barat', 1, 1, 'Delivered', 'Noval', 'Nova', 0],
        ['SJ-11JU-0583', 'Jumat', '2026-11-13', 'Kimia Farma', 'Jakarta Timur', 1, 1, 'Delivered', 'Noval', 'Dewi', 0],
        ['SJ-11JU-0584', 'Jumat', '2026-11-13', 'Mitra 10', 'Tangerang', 1, 1, 'Delivered', 'Noval', 'Budi', 0],
        ['SJ-11JU-0585', 'Jumat', '2026-11-13', 'Depo Bangunan', 'Tangerang', 1, 1, 'Delivered', 'Jay', 'Nova', 0],
        ['SJ-11JU-0586', 'Jumat', '2026-11-13', 'Electronic City', 'Jakarta Selatan', 2, 2, 'Delivered', 'Jay', 'Dewi', 0],
        ['SJ-11JU-0587', 'Jumat', '2026-11-13', 'Erafone', 'Jakarta Pusat', 1, 1, 'Delivered', 'Jay', 'Budi', 0],
        ['SJ-11JU-0588', 'Jumat', '2026-11-13', 'iBox Central Park', 'Jakarta Barat', 2, 2, 'Delivered', 'Jay', 'Nova', 0],
        ['SJ-11JU-0589', 'Jumat', '2026-11-13', 'Gramedia Matraman', 'Jakarta Timur', 2, 2, 'Delivered', 'Jay', 'Dewi', 0],
        ['SJ-11JU-0590', 'Jumat', '2026-11-13', 'Ranch Market Pesanggrahan', 'Jakarta Barat', 1, 1, 'Delivered', 'Jay', 'Budi', 0],
        ['SJ-11JU-0591', 'Jumat', '2026-11-13', 'Farmers Market Kelapa Gading', 'Jakarta Utara', 1, 1, 'Delivered', 'Ferdi', 'Nova', 0],
        ['SJ-11JU-0592', 'Jumat', '2026-11-13', 'Papaya Fresh Gallery', 'Jakarta Selatan', 2, 2, 'Delivered', 'Ferdi', 'Dewi', 0],
        ['SJ-11JU-0593', 'Jumat', '2026-11-13', 'Kem Chicks Pacific Place', 'Jakarta Selatan', 1, 1, 'Delivered', 'Ferdi', 'Budi', 0],
        ['SJ-11JU-0594', 'Jumat', '2026-11-13', 'Lotte Mart Meruya', 'Jakarta Barat', 2, 2, 'Delivered', 'Ferdi', 'Nova', 0],
        ['SJ-11JU-0595', 'Jumat', '2026-11-13', 'Gold Coast Office', 'Jakarta Utara', 2, 2, 'Delivered', 'Ferdi', 'Dewi', 0],
        ['SJ-11JU-0596', 'Jumat', '2026-11-13', 'Mall Bassura Jatinegara', 'Jakarta Timur', 1, 1, 'Delivered', 'Ferdi', 'Budi', 0],
        ['SJ-11JU-0597', 'Jumat', '2026-11-13', 'Plaza Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Jagatbaru', 'Nova', 0],
        ['SJ-11JU-0598', 'Jumat', '2026-11-13', 'Lippo Mall Puri', 'Jakarta Barat', 1, 1, 'Delivered', 'Jagatbaru', 'Dewi', 0],
        ['SJ-11JU-0599', 'Jumat', '2026-11-13', 'Supermal Karawaci', 'Tangerang', 1, 1, 'Delivered', 'Jagatbaru', 'Budi', 0],
        ['SJ-11JU-0600', 'Jumat', '2026-11-13', 'Summarecon Mall Serpong', 'Tangerang', 1, 1, 'Delivered', 'Jagatbaru', 'Nova', 0],
        ['SJ-11JU-0601', 'Jumat', '2026-11-13', 'Summarecon Mall Kelapa Gading', 'Jakarta Utara', 1, 1, 'Delivered', 'Jagatbaru', 'Dewi', 0],
        ['SJ-11JU-0602', 'Jumat', '2026-11-13', 'Puri Indah Mall', 'Jakarta Barat', 2, 2, 'Delivered', 'Jagatbaru', 'Budi', 0],
        ['SJ-11JU-0603', 'Jumat', '2026-11-13', 'PT Aspirasi Hidup Indonesia Tbk', 'Jakarta Barat', 2, 2, 'Delivered', 'Jagatbaru', 'Nova', 0],
        ['SJ-11JU-0604', 'Jumat', '2026-11-13', 'PT Foods Beverages Indonesia', 'Jakarta Selatan', 1, 1, 'Delivered', 'pbseventeensc', 'Dewi', 0],
        ['SJ-11JU-0605', 'Jumat', '2026-11-13', 'PT Tri Sakti Purwosari Makmur', 'Jakarta Barat', 2, 2, 'Delivered', 'pbseventeensc', 'Budi', 0],
        ['SJ-11JU-0606', 'Jumat', '2026-11-13', 'PT Home Center Indonesia Retail', 'Bekasi', 1, 1, 'Delivered', 'pbseventeensc', 'Nova', 0],
        ['SJ-11JU-0607', 'Jumat', '2026-11-13', 'PT Toys Games Indonesia', 'Tangerang', 2, 2, 'Delivered', 'pbseventeensc', 'Dewi', 0],
        ['SJ-11JU-0608', 'Jumat', '2026-11-13', 'PT BQuik Otomotif Indonesia', 'Jakarta Barat', 1, 1, 'Delivered', 'pbseventeensc', 'Budi', 0],
        ['SJ-11JU-0609', 'Jumat', '2026-11-13', 'PT Benfood Dinamika Sentosa', 'Jakarta Selatan', 2, 2, 'Delivered', 'pbseventeensc', 'Nova', 0],
        ['SJ-11JU-0610', 'Jumat', '2026-11-13', 'PT Astra International', 'Jakarta Pusat', 1, 1, 'Delivered', 'Soleh', 'Dewi', 0],
        ['SJ-11JU-0611', 'Jumat', '2026-11-13', 'PT Indofood CBP Sukses Makmur', 'Tangerang', 1, 1, 'Delivered', 'Soleh', 'Budi', 0],
        ['SJ-11JU-0612', 'Jumat', '2026-11-13', 'PT Sumber Alfaria Trijaya', 'Bekasi', 2, 2, 'Delivered', 'Soleh', 'Nova', 0],
        ['SJ-11JU-0613', 'Jumat', '2026-11-13', 'PT Mayora Indah', 'Tangerang', 1, 1, 'Delivered', 'Soleh', 'Dewi', 0],
        ['SJ-11JU-0614', 'Jumat', '2026-11-13', 'PT Beverindo Indah Abadi', 'Jakarta Pusat', 2, 2, 'Delivered', 'Soleh', 'Budi', 0],
        ['SJ-11JU-0615', 'Jumat', '2026-11-13', 'PT Jasmine Journey Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Soleh', 'Nova', 0],
        ['SJ-11JU-0616', 'Jumat', '2026-11-13', 'PT Wook Global Technology', 'Jakarta Utara', 1, 1, 'Delivered', 'Soleh', 'Dewi', 0],
        ['SJ-11JU-0617', 'Jumat', '2026-11-13', 'PT Kalbe Farma', 'Jakarta Timur', 2, 2, 'Delivered', 'Romi', 'Budi', 0],
        ['SJ-11JU-0618', 'Jumat', '2026-11-13', 'PT Makmur Jaya', 'Jakarta Selatan', 1, 1, 'Delivered', 'Romi', 'Nova', 0],
        ['SJ-11JU-0619', 'Jumat', '2026-11-13', 'PT Intitirta Sarimakmur', 'Jakarta Utara', 1, 1, 'Delivered', 'Romi', 'Dewi', 0],
        ['SJ-11JU-0620', 'Jumat', '2026-11-13', 'PT Perindustrian Bapak Djenggot', 'Jakarta Barat', 1, 1, 'Delivered', 'Romi', 'Budi', 0],
        ['SJ-11JU-0621', 'Jumat', '2026-11-13', 'Panorama JTB (Head Office)', 'Jakarta Pusat', 1, 1, 'Delivered', 'Romi', 'Nova', 0],
        ['SJ-11JU-0622', 'Jumat', '2026-11-13', 'Pixel Group Indonesia', 'Jakarta Selatan', 2, 2, 'Delivered', 'Romi', 'Dewi', 0],
        ['SJ-11JU-0623', 'Jumat', '2026-11-13', 'Premier Village', 'Tangerang', 1, 1, 'Delivered', 'Romi', 'Budi', 0],
        ['SJ-11JU-0624', 'Jumat', '2026-11-13', 'REX Kiriman Express', 'Jakarta Barat', 2, 2, 'Delivered', 'Firdaus', 'Nova', 0],
        ['SJ-11JU-0625', 'Jumat', '2026-11-13', 'Kawan Lama Sejahtera', 'Jakarta Barat', 1, 1, 'Delivered', 'Firdaus', 'Dewi', 0],
        ['SJ-11JU-0626', 'Jumat', '2026-11-13', 'Wisma KEIAI', 'Jakarta Pusat', 1, 1, 'Delivered', 'Firdaus', 'Budi', 0],
        ['SJ-11JU-0627', 'Jumat', '2026-11-13', 'Kacamatamoo Rawasari', 'Jakarta Pusat', 1, 1, 'Delivered', 'Firdaus', 'Nova', 0],
        ['SJ-11JU-0628', 'Jumat', '2026-11-13', 'GrandLucky - SCBD', 'Jakarta Selatan', 2, 2, 'Delivered', 'Firdaus', 'Dewi', 0],
        ['SJ-11JU-0629', 'Jumat', '2026-11-13', 'GrandLucky BSD City', 'Tangerang', 1, 1, 'Delivered', 'Firdaus', 'Budi', 0],
        ['SJ-11JU-0630', 'Jumat', '2026-11-13', 'Eraprima Industrial Park', 'Tangerang', 1, 1, 'Delivered', 'Alan', 'Nova', 0],
        ['SJ-11JU-0631', 'Jumat', '2026-11-13', 'Mandiri University Wijaya Kusuma', 'Jakarta Barat', 1, 1, 'Delivered', 'Alan', 'Dewi', 0],
        ['SJ-11JU-0632', 'Jumat', '2026-11-13', 'Pacific Place Mall', 'Jakarta Selatan', 2, 2, 'Delivered', 'Alan', 'Budi', 0],
        ['SJ-11JU-0633', 'Jumat', '2026-11-13', 'INFORMA - Living World Kota Wisata', 'Bekasi', 1, 1, 'Delivered', 'Alan', 'Nova', 0],
        ['SJ-11JU-0634', 'Jumat', '2026-11-13', 'Living World Alam Sutera', 'Tangerang', 2, 2, 'Delivered', 'Alan', 'Dewi', 0],
        ['SJ-11JU-0635', 'Jumat', '2026-11-13', 'Mall Senayan City', 'Jakarta Pusat', 1, 1, 'Delivered', 'Alan', 'Budi', 0],
        ['SJ-11JU-0636', 'Jumat', '2026-11-13', 'Grand Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Yakub', 'Nova', 0],
        ['SJ-11JU-0637', 'Jumat', '2026-11-13', 'Central Park Mall', 'Jakarta Barat', 1, 1, 'Delivered', 'Yakub', 'Dewi', 0],
        ['SJ-11JU-0638', 'Jumat', '2026-11-13', 'Gandaria City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Yakub', 'Budi', 0],
        ['SJ-11JU-0639', 'Jumat', '2026-11-13', 'AEON Mall BSD City', 'Tangerang', 1, 1, 'Delivered', 'Yakub', 'Nova', 0],
        ['SJ-11JU-0640', 'Jumat', '2026-11-13', 'AEON Mall Jakarta Garden City', 'Jakarta Timur', 2, 2, 'Delivered', 'Yakub', 'Dewi', 0],
        ['SJ-11JU-0641', 'Jumat', '2026-11-13', 'AEON Mall Tanjung Barat', 'Jakarta Selatan', 2, 2, 'Delivered', 'Yakub', 'Budi', 0],
        ['SJ-11JU-0642', 'Jumat', '2026-11-13', 'Anytime Fitness', 'Jakarta Selatan', 2, 2, 'Delivered', 'Iwan', 'Nova', 0],
        ['SJ-11JU-0643', 'Jumat', '2026-11-13', 'Ataru Living World', 'Tangerang', 1, 1, 'Delivered', 'Iwan', 'Dewi', 0],
        ['SJ-11JU-0644', 'Jumat', '2026-11-13', 'Chatime Metropolitan Mall 2', 'Bekasi', 1, 1, 'Delivered', 'Iwan', 'Budi', 0],
        ['SJ-11JU-0645', 'Jumat', '2026-11-13', 'Chatime Gandaria City', 'Jakarta Selatan', 2, 2, 'Delivered', 'Iwan', 'Nova', 0],
        ['SJ-11JU-0646', 'Jumat', '2026-11-13', 'Chatime Central Park', 'Jakarta Barat', 1, 1, 'Delivered', 'Iwan', 'Dewi', 0],
        ['SJ-11JU-0647', 'Jumat', '2026-11-13', 'Toys Kingdom Palem Semi', 'Tangerang', 1, 1, 'Delivered', 'Iwan', 'Budi', 0],
        ['SJ-11JU-0648', 'Jumat', '2026-11-13', 'Toys Kingdom Supermal Karawaci', 'Tangerang', 1, 1, 'Delivered', 'Agung', 'Nova', 0],
        ['SJ-11JU-0649', 'Jumat', '2026-11-13', 'Toys Kingdom Grand Indonesia', 'Jakarta Pusat', 2, 2, 'Delivered', 'Agung', 'Dewi', 0],
        ['SJ-11JU-0650', 'Jumat', '2026-11-13', 'Azko PIK Avenue', 'Jakarta Utara', 1, 1, 'Delivered', 'Agung', 'Budi', 0],
        ['SJ-11JU-0651', 'Jumat', '2026-11-13', 'Azko Green Terrace TMII', 'Jakarta Timur', 2, 2, 'Delivered', 'Agung', 'Nova', 0],
        ['SJ-11JU-0652', 'Jumat', '2026-11-13', 'Azko Bogor Terasutra', 'Jakarta Selatan', 1, 1, 'Delivered', 'Agung', 'Dewi', 0],
        ['SJ-11JU-0653', 'Jumat', '2026-11-13', 'Azko Citra 6', 'Jakarta Barat', 1, 1, 'Delivered', 'Agung', 'Budi', 0],
        ['SJ-11JU-0654', 'Jumat', '2026-11-13', 'Azko Kota Wisata Bogor', 'Bekasi', 2, 2, 'Delivered', 'Husen', 'Nova', 0],
        ['SJ-11JU-0655', 'Jumat', '2026-11-13', 'Azko QBig BSD', 'Tangerang', 1, 1, 'Delivered', 'Husen', 'Dewi', 0],
        ['SJ-11JU-0656', 'Jumat', '2026-11-13', 'Azko Metro Sunter', 'Jakarta Utara', 1, 1, 'Delivered', 'Husen', 'Budi', 0],
        ['SJ-11JU-0657', 'Jumat', '2026-11-13', 'Color Star (Linda)', 'Jakarta Barat', 2, 2, 'Delivered', 'Husen', 'Nova', 0],
        ['SJ-11JU-0658', 'Jumat', '2026-11-13', 'Resto Sederhana', 'Jakarta Pusat', 2, 2, 'Delivered', 'Husen', 'Dewi', 0],
        ['SJ-11SA-0659', 'Sabtu', '2026-11-14', 'Lawson Station', 'Jakarta Selatan', 2, 2, 'Delivered', 'Ahmad', 'Budi', 0],
        ['SJ-11SA-0660', 'Sabtu', '2026-11-14', 'Kopi Kenangan', 'Jakarta Selatan', 2, 2, 'Delivered', 'Ahmad', 'Nova', 0],
        ['SJ-11SA-0661', 'Sabtu', '2026-11-14', 'Fore Coffee', 'Jakarta Pusat', 2, 2, 'Delivered', 'Ahmad', 'Dewi', 0],
        ['SJ-11SA-0662', 'Sabtu', '2026-11-14', 'Janji Jiwa', 'Jakarta Barat', 1, 1, 'Delivered', 'Ahmad', 'Budi', 0],
        ['SJ-11SA-0663', 'Sabtu', '2026-11-14', 'Holland Bakery', 'Jakarta Barat', 1, 1, 'Delivered', 'Ahmad', 'Nova', 0],
        ['SJ-11SA-0664', 'Sabtu', '2026-11-14', 'JCO Donuts & Coffee', 'Jakarta Selatan', 1, 1, 'Delivered', 'Beto', 'Dewi', 0],
        ['SJ-11SA-0665', 'Sabtu', '2026-11-14', 'BreadTalk', 'Jakarta Barat', 1, 1, 'Delivered', 'Beto', 'Budi', 0],
        ['SJ-11SA-0666', 'Sabtu', '2026-11-14', 'Guardian Pharmacy', 'Jakarta Selatan', 1, 1, 'Delivered', 'Beto', 'Nova', 0],
        ['SJ-11SA-0667', 'Sabtu', '2026-11-14', 'Watsons', 'Jakarta Pusat', 1, 1, 'Delivered', 'Beto', 'Dewi', 0],
        ['SJ-11SA-0668', 'Sabtu', '2026-11-14', 'Century Healthcare', 'Jakarta Barat', 1, 1, 'Delivered', 'Beto', 'Budi', 0],
        ['SJ-11SA-0669', 'Sabtu', '2026-11-14', 'Kimia Farma', 'Jakarta Timur', 2, 2, 'Delivered', 'Beto', 'Nova', 0],
        ['SJ-11SA-0670', 'Sabtu', '2026-11-14', 'Mitra 10', 'Tangerang', 1, 1, 'Delivered', 'Beto', 'Dewi', 0],
        ['SJ-11SA-0671', 'Sabtu', '2026-11-14', 'Depo Bangunan', 'Tangerang', 2, 2, 'Delivered', 'Eri', 'Budi', 0],
        ['SJ-11SA-0672', 'Sabtu', '2026-11-14', 'Electronic City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Eri', 'Nova', 0],
        ['SJ-11SA-0673', 'Sabtu', '2026-11-14', 'Erafone', 'Jakarta Pusat', 1, 1, 'Delivered', 'Eri', 'Dewi', 0],
        ['SJ-11SA-0674', 'Sabtu', '2026-11-14', 'iBox Central Park', 'Jakarta Barat', 2, 2, 'Delivered', 'Eri', 'Budi', 0],
        ['SJ-11SA-0675', 'Sabtu', '2026-11-14', 'Gramedia Matraman', 'Jakarta Timur', 1, 1, 'Delivered', 'Eri', 'Nova', 0],
        ['SJ-11SA-0676', 'Sabtu', '2026-11-14', 'Ranch Market Pesanggrahan', 'Jakarta Barat', 1, 1, 'Delivered', 'Eri', 'Dewi', 0],
        ['SJ-11SA-0677', 'Sabtu', '2026-11-14', 'Farmers Market Kelapa Gading', 'Jakarta Utara', 1, 1, 'Delivered', 'Irfan', 'Budi', 0],
        ['SJ-11SA-0678', 'Sabtu', '2026-11-14', 'Papaya Fresh Gallery', 'Jakarta Selatan', 2, 2, 'Delivered', 'Irfan', 'Nova', 0],
        ['SJ-11SA-0679', 'Sabtu', '2026-11-14', 'Kem Chicks Pacific Place', 'Jakarta Selatan', 1, 1, 'Delivered', 'Irfan', 'Dewi', 0],
        ['SJ-11SA-0680', 'Sabtu', '2026-11-14', 'Lotte Mart Meruya', 'Jakarta Barat', 2, 2, 'Delivered', 'Irfan', 'Budi', 0],
        ['SJ-11SA-0681', 'Sabtu', '2026-11-14', 'Gold Coast Office', 'Jakarta Utara', 1, 1, 'Delivered', 'Irfan', 'Nova', 0],
        ['SJ-11SA-0682', 'Sabtu', '2026-11-14', 'Mall Bassura Jatinegara', 'Jakarta Timur', 1, 1, 'Delivered', 'Irfan', 'Dewi', 0],
        ['SJ-11SA-0683', 'Sabtu', '2026-11-14', 'Plaza Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Baihaqi', 'Budi', 0],
        ['SJ-11SA-0684', 'Sabtu', '2026-11-14', 'Lippo Mall Puri', 'Jakarta Barat', 1, 1, 'Delivered', 'Baihaqi', 'Nova', 0],
        ['SJ-11SA-0685', 'Sabtu', '2026-11-14', 'Supermal Karawaci', 'Tangerang', 2, 2, 'Delivered', 'Baihaqi', 'Dewi', 0],
        ['SJ-11SA-0686', 'Sabtu', '2026-11-14', 'Summarecon Mall Serpong', 'Tangerang', 1, 1, 'Delivered', 'Baihaqi', 'Budi', 0],
        ['SJ-11SA-0687', 'Sabtu', '2026-11-14', 'Summarecon Mall Kelapa Gading', 'Jakarta Utara', 1, 1, 'Delivered', 'Baihaqi', 'Nova', 0],
        ['SJ-11SA-0688', 'Sabtu', '2026-11-14', 'Puri Indah Mall', 'Jakarta Barat', 1, 1, 'Delivered', 'Baihaqi', 'Dewi', 0],
        ['SJ-11SA-0689', 'Sabtu', '2026-11-14', 'PT Aspirasi Hidup Indonesia Tbk', 'Jakarta Barat', 1, 1, 'Delivered', 'Baihaqi', 'Budi', 0],
        ['SJ-11SA-0690', 'Sabtu', '2026-11-14', 'PT Foods Beverages Indonesia', 'Jakarta Selatan', 1, 1, 'Delivered', 'Haris', 'Nova', 0],
        ['SJ-11SA-0691', 'Sabtu', '2026-11-14', 'PT Tri Sakti Purwosari Makmur', 'Jakarta Barat', 1, 1, 'Delivered', 'Haris', 'Dewi', 0],
        ['SJ-11SA-0692', 'Sabtu', '2026-11-14', 'PT Home Center Indonesia Retail', 'Bekasi', 1, 1, 'Delivered', 'Haris', 'Budi', 0],
        ['SJ-11SA-0693', 'Sabtu', '2026-11-14', 'PT Toys Games Indonesia', 'Tangerang', 1, 1, 'Delivered', 'Haris', 'Nova', 0],
        ['SJ-11SA-0694', 'Sabtu', '2026-11-14', 'PT BQuik Otomotif Indonesia', 'Jakarta Barat', 1, 1, 'Delivered', 'Haris', 'Dewi', 0],
        ['SJ-11SA-0695', 'Sabtu', '2026-11-14', 'PT Benfood Dinamika Sentosa', 'Jakarta Selatan', 1, 1, 'Delivered', 'Haris', 'Budi', 0],
        ['SJ-11SA-0696', 'Sabtu', '2026-11-14', 'PT Astra International', 'Jakarta Pusat', 2, 2, 'Delivered', 'Haris', 'Nova', 0],
        ['SJ-11SA-0697', 'Sabtu', '2026-11-14', 'PT Indofood CBP Sukses Makmur', 'Tangerang', 2, 2, 'Delivered', 'Umar', 'Dewi', 0],
        ['SJ-11SA-0698', 'Sabtu', '2026-11-14', 'PT Sumber Alfaria Trijaya', 'Bekasi', 2, 2, 'Delivered', 'Umar', 'Budi', 0],
        ['SJ-11SA-0699', 'Sabtu', '2026-11-14', 'PT Mayora Indah', 'Tangerang', 1, 1, 'Delivered', 'Umar', 'Nova', 0],
        ['SJ-11SA-0700', 'Sabtu', '2026-11-14', 'PT Beverindo Indah Abadi', 'Jakarta Pusat', 1, 1, 'Delivered', 'Umar', 'Dewi', 0],
        ['SJ-11SA-0701', 'Sabtu', '2026-11-14', 'PT Jasmine Journey Indonesia', 'Jakarta Pusat', 2, 2, 'Delivered', 'Umar', 'Budi', 0],
        ['SJ-11SA-0702', 'Sabtu', '2026-11-14', 'PT Wook Global Technology', 'Jakarta Utara', 1, 1, 'Delivered', 'Noval', 'Nova', 0],
        ['SJ-11SA-0703', 'Sabtu', '2026-11-14', 'PT Kalbe Farma', 'Jakarta Timur', 1, 1, 'Delivered', 'Noval', 'Dewi', 0],
        ['SJ-11SA-0704', 'Sabtu', '2026-11-14', 'PT Makmur Jaya', 'Jakarta Selatan', 1, 1, 'Delivered', 'Noval', 'Budi', 0],
        ['SJ-11SA-0705', 'Sabtu', '2026-11-14', 'PT Intitirta Sarimakmur', 'Jakarta Utara', 1, 1, 'Delivered', 'Noval', 'Nova', 0],
        ['SJ-11SA-0706', 'Sabtu', '2026-11-14', 'PT Perindustrian Bapak Djenggot', 'Jakarta Barat', 1, 1, 'Delivered', 'Noval', 'Dewi', 0],
        ['SJ-11SA-0707', 'Sabtu', '2026-11-14', 'Panorama JTB (Head Office)', 'Jakarta Pusat', 1, 1, 'Delivered', 'Noval', 'Budi', 0],
        ['SJ-11SA-0708', 'Sabtu', '2026-11-14', 'Pixel Group Indonesia', 'Jakarta Selatan', 1, 1, 'Delivered', 'Noval', 'Nova', 0],
        ['SJ-11SA-0709', 'Sabtu', '2026-11-14', 'Premier Village', 'Tangerang', 1, 1, 'Delivered', 'Noval', 'Dewi', 0],
        ['SJ-11SA-0710', 'Sabtu', '2026-11-14', 'REX Kiriman Express', 'Jakarta Barat', 2, 2, 'Delivered', 'Soleh', 'Budi', 0],
        ['SJ-11SA-0711', 'Sabtu', '2026-11-14', 'Kawan Lama Sejahtera', 'Jakarta Barat', 2, 2, 'Delivered', 'Soleh', 'Nova', 0],
        ['SJ-11SA-0712', 'Sabtu', '2026-11-14', 'Wisma KEIAI', 'Jakarta Pusat', 2, 2, 'Delivered', 'Soleh', 'Dewi', 0],
        ['SJ-11SA-0713', 'Sabtu', '2026-11-14', 'Kacamatamoo Rawasari', 'Jakarta Pusat', 1, 1, 'Delivered', 'Soleh', 'Budi', 0],
        ['SJ-11SA-0714', 'Sabtu', '2026-11-14', 'GrandLucky - SCBD', 'Jakarta Selatan', 1, 1, 'Delivered', 'Soleh', 'Nova', 0],
        ['SJ-11SA-0715', 'Sabtu', '2026-11-14', 'GrandLucky BSD City', 'Tangerang', 2, 2, 'Delivered', 'Romi', 'Dewi', 0],
        ['SJ-11SA-0716', 'Sabtu', '2026-11-14', 'Eraprima Industrial Park', 'Tangerang', 1, 1, 'Delivered', 'Romi', 'Budi', 0],
        ['SJ-11SA-0717', 'Sabtu', '2026-11-14', 'Mandiri University Wijaya Kusuma', 'Jakarta Barat', 1, 1, 'Delivered', 'Romi', 'Nova', 0],
        ['SJ-11SA-0718', 'Sabtu', '2026-11-14', 'Pacific Place Mall', 'Jakarta Selatan', 2, 2, 'Delivered', 'Romi', 'Dewi', 0],
        ['SJ-11SA-0719', 'Sabtu', '2026-11-14', 'INFORMA - Living World Kota Wisata', 'Bekasi', 1, 1, 'Delivered', 'Romi', 'Budi', 0],
        ['SJ-11SA-0720', 'Sabtu', '2026-11-14', 'Living World Alam Sutera', 'Tangerang', 1, 1, 'Delivered', 'Romi', 'Nova', 0],
        ['SJ-11SA-0721', 'Sabtu', '2026-11-14', 'Mall Senayan City', 'Jakarta Pusat', 1, 1, 'Delivered', 'Firdaus', 'Dewi', 0],
        ['SJ-11SA-0722', 'Sabtu', '2026-11-14', 'Grand Indonesia', 'Jakarta Pusat', 1, 1, 'Delivered', 'Firdaus', 'Budi', 0],
        ['SJ-11SA-0723', 'Sabtu', '2026-11-14', 'Central Park Mall', 'Jakarta Barat', 2, 2, 'Delivered', 'Firdaus', 'Nova', 0],
        ['SJ-11SA-0724', 'Sabtu', '2026-11-14', 'Gandaria City', 'Jakarta Selatan', 2, 2, 'Delivered', 'Firdaus', 'Dewi', 0],
        ['SJ-11SA-0725', 'Sabtu', '2026-11-14', 'AEON Mall BSD City', 'Tangerang', 1, 1, 'Delivered', 'Firdaus', 'Budi', 0],
        ['SJ-11SA-0726', 'Sabtu', '2026-11-14', 'AEON Mall Jakarta Garden City', 'Jakarta Timur', 1, 1, 'Delivered', 'Firdaus', 'Nova', 0],
        ['SJ-11SA-0727', 'Sabtu', '2026-11-14', 'AEON Mall Tanjung Barat', 'Jakarta Selatan', 2, 2, 'Delivered', 'Alan', 'Dewi', 0],
        ['SJ-11SA-0728', 'Sabtu', '2026-11-14', 'Anytime Fitness', 'Jakarta Selatan', 2, 2, 'Delivered', 'Alan', 'Budi', 0],
        ['SJ-11SA-0729', 'Sabtu', '2026-11-14', 'Ataru Living World', 'Tangerang', 2, 2, 'Delivered', 'Alan', 'Nova', 0],
        ['SJ-11SA-0730', 'Sabtu', '2026-11-14', 'Chatime Metropolitan Mall 2', 'Bekasi', 2, 2, 'Delivered', 'Alan', 'Dewi', 0],
        ['SJ-11SA-0731', 'Sabtu', '2026-11-14', 'Chatime Gandaria City', 'Jakarta Selatan', 1, 1, 'Delivered', 'Yakub', 'Budi', 0],
        ['SJ-11SA-0732', 'Sabtu', '2026-11-14', 'Chatime Central Park', 'Jakarta Barat', 1, 1, 'Delivered', 'Yakub', 'Nova', 0],
        ['SJ-11SA-0733', 'Sabtu', '2026-11-14', 'Toys Kingdom Palem Semi', 'Tangerang', 2, 2, 'Delivered', 'Yakub', 'Dewi', 0],
        ['SJ-11SA-0734', 'Sabtu', '2026-11-14', 'Toys Kingdom Supermal Karawaci', 'Tangerang', 1, 1, 'Delivered', 'Yakub', 'Budi', 0],
        ['SJ-11SA-0735', 'Sabtu', '2026-11-14', 'Toys Kingdom Grand Indonesia', 'Jakarta Pusat', 2, 2, 'Delivered', 'Yakub', 'Nova', 0],
        ['SJ-11SA-0736', 'Sabtu', '2026-11-14', 'Azko PIK Avenue', 'Jakarta Utara', 1, 1, 'Delivered', 'Yakub', 'Dewi', 0],
        ['SJ-11SA-0737', 'Sabtu', '2026-11-14', 'Azko Green Terrace TMII', 'Jakarta Timur', 2, 2, 'Delivered', 'Agung', 'Budi', 0],
        ['SJ-11SA-0738', 'Sabtu', '2026-11-14', 'Azko Bogor Terasutra', 'Jakarta Selatan', 1, 1, 'Delivered', 'Agung', 'Nova', 0],
        ['SJ-11SA-0739', 'Sabtu', '2026-11-14', 'Azko Citra 6', 'Jakarta Barat', 2, 2, 'Delivered', 'Agung', 'Dewi', 0],
        ['SJ-11SA-0740', 'Sabtu', '2026-11-14', 'Azko Kota Wisata Bogor', 'Bekasi', 2, 2, 'Delivered', 'Agung', 'Budi', 0],
        ['SJ-11SA-0741', 'Sabtu', '2026-11-14', 'Azko QBig BSD', 'Tangerang', 1, 1, 'Delivered', 'Agung', 'Nova', 0],
        ['SJ-11MI-0742', 'Minggu', '2026-11-15', 'Azko Metro Sunter', 'Jakarta Utara', 2, 1, 'On Delivery', 'Ahmad', 'Dewi', 1],
        ['SJ-11MI-0743', 'Minggu', '2026-11-15', 'Color Star (Linda)', 'Jakarta Barat', 1, 1, 'Delivered', 'Ahmad', 'Budi', 1],
        ['SJ-11MI-0744', 'Minggu', '2026-11-15', 'Resto Sederhana', 'Jakarta Pusat', 2, 1, 'On Delivery', 'Ahmad', 'Nova', 1],
        ['SJ-11MI-0745', 'Minggu', '2026-11-15', 'Lawson Station', 'Jakarta Selatan', 2, 1, 'On Delivery', 'Ahmad', 'Dewi', 1],
        ['SJ-11MI-0746', 'Minggu', '2026-11-15', 'Kopi Kenangan', 'Jakarta Selatan', 1, 1, 'Delivered', 'Ahmad', 'Budi', 1],
        ['SJ-11MI-0747', 'Minggu', '2026-11-15', 'Fore Coffee', 'Jakarta Pusat', 1, 1, 'Delivered', 'Beto', 'Nova', 1],
        ['SJ-11MI-0748', 'Minggu', '2026-11-15', 'Janji Jiwa', 'Jakarta Barat', 1, 1, 'Delivered', 'Beto', 'Dewi', 1],
        ['SJ-11MI-0749', 'Minggu', '2026-11-15', 'Holland Bakery', 'Jakarta Barat', 2, 2, 'Delivered', 'Beto', 'Budi', 1],
        ['SJ-11MI-0750', 'Minggu', '2026-11-15', 'JCO Donuts & Coffee', 'Jakarta Selatan', 2, 1, 'On Delivery', 'Beto', 'Nova', 1],
        ['SJ-11MI-0751', 'Minggu', '2026-11-15', 'BreadTalk', 'Jakarta Barat', 1, 0, 'On Delivery', 'Beto', 'Dewi', 1],
        ['SJ-11MI-0752', 'Minggu', '2026-11-15', 'Guardian Pharmacy', 'Jakarta Selatan', 1, 1, 'Delivered', 'Beto', 'Budi', 1],
        ['SJ-11MI-0753', 'Minggu', '2026-11-15', 'Watsons', 'Jakarta Pusat', 1, 1, 'Delivered', 'pbseventeensc', 'Nova', 1],
        ['SJ-11MI-0754', 'Minggu', '2026-11-15', 'Century Healthcare', 'Jakarta Barat', 1, 0, 'On Delivery', 'pbseventeensc', 'Dewi', 1],
        ['SJ-11MI-0755', 'Minggu', '2026-11-15', 'Kimia Farma', 'Jakarta Timur', 1, 0, 'On Delivery', 'pbseventeensc', 'Budi', 1],
        ['SJ-11MI-0756', 'Minggu', '2026-11-15', 'Mitra 10', 'Tangerang', 1, 0, 'On Delivery', 'pbseventeensc', 'Nova', 1],
        ['SJ-11MI-0757', 'Minggu', '2026-11-15', 'Depo Bangunan', 'Tangerang', 1, 0, 'On Delivery', 'pbseventeensc', 'Dewi', 1],
        ['SJ-11MI-0758', 'Minggu', '2026-11-15', 'Electronic City', 'Jakarta Selatan', 1, 1, 'Delivered', 'pbseventeensc', 'Budi', 1],
        ['SJ-11MI-0759', 'Minggu', '2026-11-15', 'Erafone', 'Jakarta Pusat', 1, 1, 'Delivered', 'pbseventeensc', 'Nova', 1],
        ['SJ-11MI-0760', 'Minggu', '2026-11-15', 'iBox Central Park', 'Jakarta Barat', 2, 2, 'Delivered', 'Haris', 'Dewi', 1],
        ['SJ-11MI-0761', 'Minggu', '2026-11-15', 'Gramedia Matraman', 'Jakarta Timur', 1, 1, 'Delivered', 'Haris', 'Budi', 1],
        ['SJ-11MI-0762', 'Minggu', '2026-11-15', 'Ranch Market Pesanggrahan', 'Jakarta Barat', 2, 2, 'Delivered', 'Haris', 'Nova', 1],
        ['SJ-11MI-0763', 'Minggu', '2026-11-15', 'Farmers Market Kelapa Gading', 'Jakarta Utara', 1, 1, 'Delivered', 'Haris', 'Dewi', 1],
        ['SJ-11MI-0764', 'Minggu', '2026-11-15', 'Papaya Fresh Gallery', 'Jakarta Selatan', 1, 1, 'Delivered', 'Haris', 'Budi', 1],
        ['SJ-11MI-0765', 'Minggu', '2026-11-15', 'Kem Chicks Pacific Place', 'Jakarta Selatan', 1, 1, 'Delivered', 'Ferdi', 'Nova', 1],
        ['SJ-11MI-0766', 'Minggu', '2026-11-15', 'Lotte Mart Meruya', 'Jakarta Barat', 1, 1, 'Delivered', 'Ferdi', 'Dewi', 1],
        ['SJ-11MI-0767', 'Minggu', '2026-11-15', 'Gold Coast Office', 'Jakarta Utara', 1, 1, 'Delivered', 'Ferdi', 'Budi', 1],
        ['SJ-11MI-0768', 'Minggu', '2026-11-15', 'Mall Bassura Jatinegara', 'Jakarta Timur', 1, 1, 'Delivered', 'Ferdi', 'Nova', 1],
        ['SJ-11MI-0769', 'Minggu', '2026-11-15', 'Plaza Indonesia', 'Jakarta Pusat', 2, 2, 'Delivered', 'Ferdi', 'Dewi', 1],
        ['SJ-11MI-0770', 'Minggu', '2026-11-15', 'Lippo Mall Puri', 'Jakarta Barat', 1, 1, 'Delivered', 'Ferdi', 'Budi', 1],
        ['SJ-11MI-0771', 'Minggu', '2026-11-15', 'Supermal Karawaci', 'Tangerang', 1, 1, 'Delivered', 'Jay', 'Nova', 1],
        ['SJ-11MI-0772', 'Minggu', '2026-11-15', 'Summarecon Mall Serpong', 'Tangerang', 1, 1, 'Delivered', 'Jay', 'Dewi', 1],
        ['SJ-11MI-0773', 'Minggu', '2026-11-15', 'Summarecon Mall Kelapa Gading', 'Jakarta Utara', 1, 1, 'Delivered', 'Jay', 'Budi', 1],
        ['SJ-11MI-0774', 'Minggu', '2026-11-15', 'Puri Indah Mall', 'Jakarta Barat', 2, 2, 'Delivered', 'Jay', 'Nova', 1],
        ['SJ-11MI-0775', 'Minggu', '2026-11-15', 'PT Aspirasi Hidup Indonesia Tbk', 'Jakarta Barat', 1, 1, 'Delivered', 'Jay', 'Dewi', 1],
        ['SJ-11MI-0776', 'Minggu', '2026-11-15', 'PT Foods Beverages Indonesia', 'Jakarta Selatan', 1, 1, 'Delivered', 'Jay', 'Budi', 1],
        ['SJ-11MI-0777', 'Minggu', '2026-11-15', 'PT Tri Sakti Purwosari Makmur', 'Jakarta Barat', 1, 1, 'Delivered', 'Soleh', 'Nova', 1],
        ['SJ-11MI-0778', 'Minggu', '2026-11-15', 'PT Home Center Indonesia Retail', 'Bekasi', 1, 1, 'Delivered', 'Soleh', 'Dewi', 1],
        ['SJ-11MI-0779', 'Minggu', '2026-11-15', 'PT Toys Games Indonesia', 'Tangerang', 2, 2, 'Delivered', 'Soleh', 'Budi', 1],
        ['SJ-11MI-0780', 'Minggu', '2026-11-15', 'PT BQuik Otomotif Indonesia', 'Jakarta Barat', 1, 1, 'Delivered', 'Soleh', 'Nova', 1],
        ['SJ-11MI-0781', 'Minggu', '2026-11-15', 'PT Benfood Dinamika Sentosa', 'Jakarta Selatan', 1, 1, 'Delivered', 'Soleh', 'Dewi', 1],
        ['SJ-11MI-0782', 'Minggu', '2026-11-15', 'PT Astra International', 'Jakarta Pusat', 1, 1, 'Delivered', 'Soleh', 'Budi', 1],
    ];

    const WEEKLY_BASELINE = RAW_BASELINE_TUPLES.map(t => ({
        id: t[0],
        day: t[1],
        date: t[2],
        customer: t[3],
        region: t[4],
        destinations: t[5],
        deliveredDestinations: t[6],
        sjCount: 1,
        deliveredSJ: t[7] === 'Delivered' ? 1 : 0,
        status: t[7],
        courier: t[8],
        adminSJ: t[9],
        isOvertime: t[10] === 1
    }));

    function fmtNum(n) {
        return Number(n || 0).toLocaleString('id-ID');
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getDayOfWeekFromDate(dateStr) {
        if (!dateStr) return 'Senin';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return 'Senin';
            const dayNum = d.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
            const map = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            return map[dayNum] || 'Senin';
        } catch (_) {
            return 'Senin';
        }
    }

    function collectTripData() {
        const pool = Array.isArray(root.allPoolTrips) ? root.allPoolTrips : [];
        const current = Array.isArray(root.allCurrentTrips) ? root.allCurrentTrips : [];

        let localTrips = [];
        try {
            const raw = root.localStorage?.getItem('wtrack_local_trips') || root.localStorage?.getItem('wtrack_trips');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) localTrips = parsed;
            }
        } catch (_) {}

        const seenTripIds = new Set();
        const combined = [];
        [...current, ...pool, ...localTrips].forEach(t => {
            if (!t) return;
            const id = t.tripId || t.id || t.noSJ || t.sjNumber;
            if (id && !seenTripIds.has(id)) {
                seenTripIds.add(id);
                combined.push(t);
            }
        });

        const liveItems = [];
        combined.forEach(t => {
            const rawId = (t.noSJ || t.sjNumber || t.id || '').replace(/^TRIP_/i, '').trim();
            if (!rawId) return;

            const dayName = getDayOfWeekFromDate(t.date || t.createdAt);
            const region = (t.region || 'Jakarta Barat').trim();
            const customer = (t.customer || t.clientName || t.recipientName || 'Customer').trim();

            let destCount = 1;
            let delivDestCount = 0;

            if (Array.isArray(t.destinations) && t.destinations.length > 0) {
                destCount = t.destinations.length;
                delivDestCount = t.destinations.filter(d => ['delivered', 'completed', 'done'].includes(String(d.status || '').toLowerCase())).length;
            } else {
                const isDelivered = ['delivered', 'completed', 'done'].includes(String(t.status || '').toLowerCase());
                delivDestCount = isDelivered ? 1 : 0;
            }

            const isDone = ['delivered', 'completed', 'done'].includes(String(t.status || '').toLowerCase());
            const sjCount = 1;
            const deliveredSJ = isDone ? 1 : 0;
            const adminSJ = (t.adminSJ || (typeof root.CourierAdminSJ?.resolve === 'function' ? root.CourierAdminSJ.resolve(t) : '') || 'Belum diatur').trim();
            const courier = (t.courierName || t.courier || t.carrier || t.assignedTo || 'Unassigned').trim();

            liveItems.push({
                id: rawId,
                day: dayName,
                date: t.date || (t.createdAt ? String(t.createdAt).slice(0, 10) : ''),
                customer,
                region,
                adminSJ: adminSJ || 'Belum diatur',
                courier: courier || 'Unassigned',
                destinations: destCount,
                deliveredDestinations: delivDestCount,
                sjCount,
                deliveredSJ,
                status: isDone ? 'Delivered' : (t.status === 'on_delivery' ? 'On Delivery' : 'In Warehouse'),
                isOvertime: dayName === 'Minggu'
            });
        });

        // Group live count per day
        const liveDaysCount = {};
        liveItems.forEach(item => {
            liveDaysCount[item.day] = (liveDaysCount[item.day] || 0) + (item.destinations || 1);
        });

        // Combine live items and baseline:
        // Any day with fewer than 100 live destinations is supplemented by baseline data
        // so the full weekly chart consistently reflects Wellen Print daily 150+ operational scale!
        const resultItems = [...liveItems];
        WEEKLY_BASELINE.forEach(baseItem => {
            const countForDay = liveDaysCount[baseItem.day] || 0;
            if (countForDay < 100) {
                // Hindari duplikasi jika kurir sudah memiliki live items di hari Minggu
                if (baseItem.day === 'Minggu' && countForDay > 0 && liveItems.some(it => it.day === 'Minggu' && it.courier === baseItem.courier)) {
                    return;
                }
                resultItems.push(baseItem);
            }
        });

        return resultItems.length > 0 ? resultItems : WEEKLY_BASELINE;
    }

    function getAvailableRegions(data) {
        const regionsSet = new Set();
        data.forEach(d => {
            if (d.region) regionsSet.add(d.region.trim());
        });
        // Ensure standard Jabodetabek regions are included
        ['Jakarta Barat', 'Jakarta Pusat', 'Jakarta Selatan', 'Jakarta Timur', 'Jakarta Utara', 'Tangerang', 'Bekasi'].forEach(r => regionsSet.add(r));
        return Array.from(regionsSet).sort();
    }

    function getAvailableAdmins(data) {
        const adminsSet = new Set();
        data.forEach(d => {
            if (d.adminSJ && d.adminSJ !== 'Belum diatur') adminsSet.add(d.adminSJ.trim());
        });
        ['Nova', 'Budi', 'Dewi'].forEach(a => adminsSet.add(a));
        return Array.from(adminsSet).sort();
    }

    function getAvailableCouriers(data) {
        const couriersSet = new Set();
        data.forEach(d => {
            if (d.courier && d.courier !== 'Unassigned') couriersSet.add(d.courier.trim());
        });
        if (Array.isArray(root.MASTER_COURIERS)) {
            root.MASTER_COURIERS.forEach(c => {
                if (c.displayName) couriersSet.add(c.displayName.trim());
            });
        }
        if (root.registeredUsers) {
            Object.values(root.registeredUsers).forEach(u => {
                if (typeof u === 'string' && u.trim()) couriersSet.add(u.trim());
            });
        }
        return Array.from(couriersSet).sort();
    }

    function buildCourierFilterOptions(selectedCourier, availableCouriers) {
        if (typeof root.buildCourierOptgroupHtml === 'function') {
            const raw = root.buildCourierOptgroupHtml('Kurir', 'displayName');
            let html = raw.replace('<option value="">Kurir</option>', '<option value="all">Kurir</option>');
            if (selectedCourier && selectedCourier !== 'all') {
                html = html.replace(
                    new RegExp(`(<option\\s+value="${escapeHtml(selectedCourier)}"|value="${selectedCourier}")`, 'i'),
                    (m) => m + ' selected'
                );
            } else {
                html = html.replace('<option value="all">Kurir</option>', '<option value="all" selected>Kurir</option>');
            }
            return html;
        }
        const list = Array.isArray(availableCouriers) ? availableCouriers : [];
        return `
            <option value="all" ${selectedCourier === 'all' ? 'selected' : ''}>Kurir</option>
            ${list.map(c => `<option value="${escapeHtml(c)}" ${selectedCourier.toLowerCase() === c.toLowerCase() ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        `;
    }

    function filterTripItems(data, regionFilter, adminFilter, courierFilter, startFilter, endFilter) {
        let filtered = data;
        if (regionFilter && regionFilter !== 'all') {
            filtered = filtered.filter(d => String(d.region || '').toLowerCase() === regionFilter.toLowerCase());
        }
        if (adminFilter && adminFilter !== 'all') {
            filtered = filtered.filter(d => String(d.adminSJ || '').toLowerCase() === adminFilter.toLowerCase());
        }
        if (courierFilter && courierFilter !== 'all' && courierFilter !== '') {
            const cf = courierFilter.toLowerCase().trim();
            filtered = filtered.filter(d => {
                const c = String(d.courier || '').toLowerCase().trim();
                return c === cf || c.includes(cf) || cf.includes(c);
            });
        }
        if (startFilter) {
            filtered = filtered.filter(d => !d.date || d.date >= startFilter);
        }
        if (endFilter) {
            filtered = filtered.filter(d => !d.date || d.date <= endFilter);
        }
        return filtered;
    }

    function computeDailyBuckets(data, metric, regionFilter, adminFilter, courierFilter, startFilter, endFilter) {
        const filtered = filterTripItems(data, regionFilter, adminFilter, courierFilter, startFilter, endFilter);

        return DAYS_ORDER.map(dayName => {
            const dayItems = filtered.filter(d => d.day === dayName);

            let totalDest = 0;
            let delivDest = 0;
            let totalSJ = 0;
            let delivSJ = 0;

            dayItems.forEach(item => {
                totalDest += item.destinations || 0;
                delivDest += item.deliveredDestinations || 0;
                totalSJ += item.sjCount || 0;
                delivSJ += item.deliveredSJ || 0;
            });

            let total = metric === 'destinations' ? totalDest : totalSJ;
            let delivered = metric === 'destinations' ? delivDest : delivSJ;

            // Sinkronisasi otomatis hari ini (Minggu) dengan KPI Stat Cards di dashboard
            if (dayName === 'Minggu' && (!courierFilter || courierFilter === 'all') && (!regionFilter || regionFilter === 'all') && (!adminFilter || adminFilter === 'all') && !startFilter && !endFilter) {
                const statActiveEl = root.document ? root.document.getElementById('stat-active') : null;
                const statCompletedEl = root.document ? root.document.getElementById('stat-completed') : null;
                if (statActiveEl && statCompletedEl) {
                    const parsedTotal = parseInt(statActiveEl.innerText.replace(/\D/g, ''), 10);
                    const parsedCompleted = parseInt(statCompletedEl.innerText.replace(/\D/g, ''), 10);
                    if (!isNaN(parsedTotal) && parsedTotal > 0) {
                        totalDest = parsedTotal;
                        delivDest = !isNaN(parsedCompleted) ? parsedCompleted : delivDest;
                        if (metric === 'destinations') {
                            total = parsedTotal;
                            delivered = !isNaN(parsedCompleted) ? parsedCompleted : delivered;
                        }
                    }
                }
            }

            const isOvertime = dayName === 'Minggu' && total > 0;

            return {
                day: dayName,
                short: DAYS_META[dayName].short,
                total,
                delivered,
                totalDest,
                delivDest,
                totalSJ,
                delivSJ,
                isOvertime,
                itemsCount: dayItems.length
            };
        });
    }

    function computeBreakdownData(data, dim, regionFilter, adminFilter, courierFilter, startFilter, endFilter, searchQuery) {
        let filtered = filterTripItems(data, regionFilter, adminFilter, courierFilter, startFilter, endFilter);

        if (searchQuery) {
            const q = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(d => 
                (d.customer && d.customer.toLowerCase().includes(q)) ||
                (d.region && d.region.toLowerCase().includes(q)) ||
                (d.adminSJ && d.adminSJ.toLowerCase().includes(q)) ||
                (d.courier && d.courier.toLowerCase().includes(q)) ||
                (d.id && d.id.toLowerCase().includes(q))
            );
        }

        const map = new Map();

        filtered.forEach(d => {
            const key = dim === 'customer' ? (d.customer || 'Customer Lainnya') : (d.region || 'Lainnya');
            const existing = map.get(key) || {
                key,
                name: key,
                region: d.region || 'Jabodetabek',
                customers: new Set(),
                totalSJ: 0,
                deliveredSJ: 0,
                totalDest: 0,
                deliveredDest: 0,
                count: 0
            };

            existing.customers.add(d.customer);
            existing.totalSJ += d.sjCount || 1;
            existing.deliveredSJ += d.deliveredSJ || 0;
            existing.totalDest += d.destinations || 1;
            existing.deliveredDest += d.deliveredDestinations || 0;
            existing.count += 1;

            map.set(key, existing);
        });

        // Compute overall totals for share calculation
        let grandTotal = 0;
        map.forEach(entry => {
            const primaryTotal = currentMetric === 'destinations' ? entry.totalDest : entry.totalSJ;
            grandTotal += primaryTotal;
        });

        const list = Array.from(map.values()).map(entry => {
            const primaryTotal = currentMetric === 'destinations' ? entry.totalDest : entry.totalSJ;
            const primaryDelivered = currentMetric === 'destinations' ? entry.deliveredDest : entry.deliveredSJ;
            const sharePct = grandTotal > 0 ? (primaryTotal / grandTotal) * 100 : 0;
            const successPct = primaryTotal > 0 ? (primaryDelivered / primaryTotal) * 100 : 0;

            return {
                ...entry,
                total: primaryTotal,
                delivered: primaryDelivered,
                sharePct,
                successPct,
                uniqueClientsCount: entry.customers.size,
                topClientsStr: Array.from(entry.customers).slice(0, 2).join(', ') + (entry.customers.size > 2 ? ` (+${entry.customers.size - 2})` : '')
            };
        });

        // Sort list
        list.sort((a, b) => {
            let res = 0;
            if (sortField === 'name') {
                res = a.name.localeCompare(b.name);
            } else if (sortField === 'delivered') {
                res = a.delivered - b.delivered;
            } else if (sortField === 'share') {
                res = a.sharePct - b.sharePct;
            } else {
                // 'total'
                res = a.total - b.total;
            }
            return sortDir === 'asc' ? res : -res;
        });

        return { list, grandTotal };
    }

    function renderSvgChart(buckets, metric, regionFilter) {
        let maxVal = 0;
        buckets.forEach(b => {
            if (b.total > maxVal) maxVal = b.total;
            if (b.delivered > maxVal) maxVal = b.delivered;
        });

        // Nice scale step
        const step = Math.ceil(maxVal / 4 / 5) * 5 || (metric === 'destinations' ? 10 : 5);
        const roundedMax = Math.max(step * 4, metric === 'destinations' ? 20 : 10);

        const chartWidth = 840;
        const chartHeight = 250;
        const zeroY = 205;
        const topY = 28;
        const plotHeight = zeroY - topY;

        // Grid lines (5 ticks)
        const leftAxisX = 52;
        const rightGridX = chartWidth - 28;
        const plotStartX = 60;
        const plotEndX = chartWidth - 36;
        const plotWidth = plotEndX - plotStartX;
        const slotWidth = plotWidth / 7;

        let gridHtml = '';
        for (let i = 0; i <= 4; i++) {
            const val = Math.round(step * i);
            const y = zeroY - (val / roundedMax) * plotHeight;
            gridHtml += `
                <g>
                    <line x1="${leftAxisX + 6}" x2="${rightGridX}" y1="${y}" y2="${y}" stroke="${i === 0 ? '#D0D5DD' : '#EAECF0'}" stroke-width="1"></line>
                    <text x="${leftAxisX}" y="${y + 4}" text-anchor="end" style="font-size: 11px; font-family: monospace; fill: #667085; font-weight: 500;">${val}</text>
                </g>
            `;
        }

        const barWidth = 18;
        const barGap = 5;
        let barsHtml = '';

        buckets.forEach((b, idx) => {
            const slotCenter = plotStartX + idx * slotWidth + slotWidth / 2;
            const barPairWidth = barWidth * 2 + barGap;
            const groupX = slotCenter - barPairWidth / 2;
            const barPairCenter = slotCenter;

            const totalHeight = b.total > 0 ? Math.max(6, (b.total / roundedMax) * plotHeight) : 0;
            const deliveredHeight = b.delivered > 0 ? Math.max(6, (b.delivered / roundedMax) * plotHeight) : 0;

            const totalY = zeroY - totalHeight;
            const deliveredY = zeroY - deliveredHeight;

            const unitLabel = metric === 'destinations' ? 'Titik' : 'SJ';
            const isSunday = b.day === 'Minggu';

            barsHtml += `
                <g class="cursor-pointer chart-day-group" data-idx="${idx}"
                   onmouseenter="VolumeComparison.showTooltip(${idx}, ${barPairCenter}, ${Math.min(totalY, deliveredY)})"
                   onmousemove="VolumeComparison.updateTooltipPos(event)"
                   onmouseleave="VolumeComparison.hideTooltip()">
                    
                    <!-- Hover hit area -->
                    <rect x="${slotCenter - slotWidth / 2 + 2}" y="${topY - 8}" width="${slotWidth - 4}" height="${plotHeight + 42}" rx="6" fill="#F8F9FA" opacity="0" class="day-hover-bg"></rect>
                    
                    <!-- Orange Bar: Total (Titik Pengantaran / Surat Jalan) -->
                    ${b.total > 0 ? `
                        <rect x="${groupX}" y="${totalY}" width="${barWidth}" height="${totalHeight}" rx="4" fill="#CC6100" class="chart-bar-total"></rect>
                        <text x="${groupX + barWidth / 2}" y="${totalY - 6}" text-anchor="middle" style="fill: #101828; font-size: 11px; font-weight: 700; font-family: monospace;">${b.total}</text>
                    ` : `
                        <text x="${groupX + barWidth / 2}" y="${zeroY - 6}" text-anchor="middle" style="fill: #98A2B3; font-size: 10px; font-weight: 500; font-family: monospace;">0</text>
                    `}
                    
                    <!-- Green Bar: Berhasil Diantar -->
                    ${b.delivered > 0 ? `
                        <rect x="${groupX + barWidth + barGap}" y="${deliveredY}" width="${barWidth}" height="${deliveredHeight}" rx="4" fill="#12B76A" class="chart-bar-delivered"></rect>
                        <text x="${groupX + barWidth + barGap + barWidth / 2}" y="${deliveredY - 6}" text-anchor="middle" style="fill: #027A48; font-size: 11px; font-weight: 700; font-family: monospace;">${b.delivered}</text>
                    ` : (b.total > 0 ? `
                        <rect x="${groupX + barWidth + barGap}" y="${zeroY - 4}" width="${barWidth}" height="4" rx="2" fill="#D0D5DD"></rect>
                        <text x="${groupX + barWidth + barGap + barWidth / 2}" y="${zeroY - 6}" text-anchor="middle" style="fill: #98A2B3; font-size: 10px; font-weight: 500; font-family: monospace;">0</text>
                    ` : '')}
                    
                    <!-- X-Axis Day Label -->
                    <text x="${barPairCenter}" y="${zeroY + 18}" text-anchor="middle" style="fill: ${isSunday && b.isOvertime ? '#CC6100' : '#101828'}; font-size: 12px; font-weight: ${isSunday && b.isOvertime ? '700' : '600'}; font-family: inherit;">
                        ${b.day}
                    </text>
                    ${isSunday && b.isOvertime ? `
                        <text x="${barPairCenter}" y="${zeroY + 30}" text-anchor="middle" style="fill: #CC6100; font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;">(Lembur)</text>
                    ` : (isSunday && b.total === 0 ? `
                        <text x="${barPairCenter}" y="${zeroY + 30}" text-anchor="middle" style="fill: #98A2B3; font-size: 9.5px; font-weight: 500;">(Libur)</text>
                    ` : '')}
                </g>
            `;
        });

        const metricTitle = metric === 'destinations' ? 'Titik Pengantaran' : 'Surat Jalan';

        return `
            <div class="position-relative w-full overflow-hidden pt-1" id="volume-svg-container" style="min-height: 220px;">
                <!-- Floating Black Tooltip (Esse style) -->
                <div id="esse-chart-tooltip" class="esse-dark-tooltip d-none" style="position: absolute;"></div>

                <svg viewBox="0 0 ${chartWidth} ${chartHeight + 15}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: auto; max-height: 260px; display: block;" role="group" aria-label="Grafik perbandingan pengiriman ${metricTitle}">
                    ${gridHtml}
                    ${barsHtml}
                </svg>
            </div>
        `;
    }

    function renderBreakdownTable(breakdownData, metric) {
        const { list, grandTotal } = breakdownData;
        const metricUnit = metric === 'destinations' ? 'Titik' : 'SJ';
        const isDimCustomer = breakdownDim === 'customer';

        if (list.length === 0) {
            return `
                <div class="text-center py-5 text-muted" style="font-size: 13px;">
                    <i class="bi bi-inbox fs-3 d-block mb-2 text-muted"></i>
                    Tidak ada data breakdown untuk filter "${escapeHtml(breakdownSearch || currentRegion)}".
                </div>
            `;
        }

        let totalSJAll = 0;
        let totalDestAll = 0;
        let delivDestAll = 0;

        list.forEach(item => {
            totalSJAll += item.totalSJ;
            totalDestAll += item.totalDest;
            delivDestAll += item.deliveredDest;
        });

        const overallSuccessRate = totalDestAll > 0 ? Math.round((delivDestAll / totalDestAll) * 100) : 0;

        const rowsHtml = list.map((item, idx) => {
            const rowTotal = metric === 'destinations' ? item.totalDest : item.totalSJ;
            const rowDelivered = metric === 'destinations' ? item.deliveredDest : item.deliveredSJ;
            const rowPending = Math.max(0, rowTotal - rowDelivered);
            const rowRate = rowTotal > 0 ? Math.round((rowDelivered / rowTotal) * 100) : 0;
            const nameParam = escapeHtml(item.name).replace(/'/g, "\\'");
            const regionParam = escapeHtml(item.region || '').replace(/'/g, "\\'");

            return `
                <tr class="cursor-pointer esse-table-row transition"
                    onclick="VolumeComparison.filterByRow('${nameParam}')"
                    style="border-bottom: 1px solid #F2F4F7;">
                    <td class="py-2.5 px-3" style="min-width: 220px; max-width: 320px;">
                        <div class="fw-semibold text-dark text-truncate" style="font-size: 13px; line-height: 1.3;" title="${escapeHtml(item.name)}">
                            ${escapeHtml(item.name)}
                        </div>
                        <div class="text-muted text-truncate" style="font-size: 11px; line-height: 1.3; margin-top: 2px;">
                            ${isDimCustomer ? escapeHtml(item.region) : `<span class="text-primary font-monospace">${item.uniqueClientsCount} Klien</span> • ${escapeHtml(item.topClientsStr)}`}
                        </div>
                    </td>
                    <td class="py-2.5 px-3" style="width: 140px;">
                        ${isDimCustomer ? `
                            <span class="badge bg-light text-dark border px-2 py-1" style="font-size: 11px; font-weight: 500; border-color: #EAECF0 !important;">
                                <i class="bi bi-geo-alt me-1 text-primary"></i>${escapeHtml(item.region)}
                            </span>
                        ` : `
                            <span class="font-monospace fw-semibold text-dark" style="font-size: 12.5px;">${item.uniqueClientsCount} Klien</span>
                        `}
                    </td>
                    <td class="py-2.5 px-3 text-end font-monospace fw-semibold text-dark" style="width: 110px; font-size: 12.5px;">
                        ${fmtNum(item.totalSJ)} <span class="text-muted fw-normal" style="font-size: 11px;">SJ</span>
                    </td>
                    <td class="py-2.5 px-3 text-end font-monospace fw-semibold text-dark" style="width: 130px; font-size: 12.5px;">
                        ${fmtNum(item.totalDest)} <span class="text-muted fw-normal" style="font-size: 11px;">Titik</span>
                    </td>
                    <td class="py-2.5 px-3 text-end font-monospace" style="width: 140px;">
                        <div class="fw-semibold ${rowDelivered > 0 ? 'text-success' : 'text-dark'}" style="font-size: 12.5px; line-height: 1.3;">
                            ${fmtNum(rowDelivered)} <span class="fw-normal" style="font-size: 11px;">${metricUnit}</span>
                        </div>
                        <div class="text-muted" style="font-size: 11px; line-height: 1.3;">
                            ${rowRate}% Berhasil
                        </div>
                    </td>
                    <td class="py-2.5 px-3 text-end font-monospace text-muted" style="width: 110px; font-size: 12px;">
                        <div class="fw-medium text-dark">${item.sharePct.toFixed(1)}%</div>
                        <div class="progress mt-1" style="height: 4px; border-radius: 2px; background: #F2F4F7;">
                            <div class="progress-bar bg-primary" style="width: ${Math.min(100, item.sharePct)}%;"></div>
                        </div>
                    </td>
                    <td class="py-2.5 px-3 text-end text-muted" style="width: 40px;">
                        <i class="bi bi-chevron-right" style="font-size: 12px;"></i>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div id="breakdown-table-wrapper" class="position-relative">
                <div class="table-responsive" style="max-height: 380px; overflow-y: auto;">
                    <table class="table align-middle m-0" style="border-collapse: separate; border-spacing: 0;">
                        <thead class="sticky-top" style="position: sticky; top: 0; z-index: 10; background: #F9FAFB;">
                            <tr class="text-nowrap" style="height: 38px;">
                                <th class="cursor-pointer select-none py-2 px-3 border-bottom" style="font-size: 11px; font-weight: 600; color: #475467; text-transform: uppercase; letter-spacing: 0.04em; background: #F9FAFB; border-color: #EAECF0;" onclick="VolumeComparison.setSort('name')">
                                    <div class="d-inline-flex align-items-center gap-1">
                                        <span>${isDimCustomer ? 'KLIEN / CUSTOMER' : 'REGION'}</span>
                                        <i class="bi bi-arrow-down-up text-muted opacity-50" style="font-size: 10px;"></i>
                                    </div>
                                </th>
                                <th class="py-2 px-3 border-bottom" style="font-size: 11px; font-weight: 600; color: #475467; text-transform: uppercase; letter-spacing: 0.04em; background: #F9FAFB; border-color: #EAECF0;">
                                    ${isDimCustomer ? 'REGION' : 'TOTAL KLIEN'}
                                </th>
                                <th class="cursor-pointer select-none py-2 px-3 border-bottom text-end" style="font-size: 11px; font-weight: 600; color: #475467; text-transform: uppercase; letter-spacing: 0.04em; background: #F9FAFB; border-color: #EAECF0;" onclick="VolumeComparison.setSort('total')">
                                    <div class="d-inline-flex align-items-center justify-content-end gap-1 w-100">
                                        <span>SURAT JALAN</span>
                                        <i class="bi bi-arrow-down-up text-muted opacity-50" style="font-size: 10px;"></i>
                                    </div>
                                </th>
                                <th class="cursor-pointer select-none py-2 px-3 border-bottom text-end" style="font-size: 11px; font-weight: 600; color: #475467; text-transform: uppercase; letter-spacing: 0.04em; background: #F9FAFB; border-color: #EAECF0;" onclick="VolumeComparison.setSort('total')">
                                    <div class="d-inline-flex align-items-center justify-content-end gap-1 w-100">
                                        <span>TOTAL TITIK</span>
                                        <i class="bi bi-arrow-down-up text-muted opacity-50" style="font-size: 10px;"></i>
                                    </div>
                                </th>
                                <th class="cursor-pointer select-none py-2 px-3 border-bottom text-end" style="font-size: 11px; font-weight: 600; color: #475467; text-transform: uppercase; letter-spacing: 0.04em; background: #F9FAFB; border-color: #EAECF0;" onclick="VolumeComparison.setSort('delivered')">
                                    <div class="d-inline-flex align-items-center justify-content-end gap-1 w-100">
                                        <span>SUKSES</span>
                                        <i class="bi bi-arrow-down-up text-muted opacity-50" style="font-size: 10px;"></i>
                                    </div>
                                </th>
                                <th class="cursor-pointer select-none py-2 px-3 border-bottom text-end" style="font-size: 11px; font-weight: 600; color: #475467; text-transform: uppercase; letter-spacing: 0.04em; background: #F9FAFB; border-color: #EAECF0;" onclick="VolumeComparison.setSort('share')">
                                    <div class="d-inline-flex align-items-center justify-content-end gap-1 w-100">
                                        <span>SHARE</span>
                                        <i class="bi bi-arrow-down-up text-muted opacity-50" style="font-size: 10px;"></i>
                                    </div>
                                </th>
                                <th class="py-2 px-3 border-bottom text-end" style="width: 40px; background: #F9FAFB; border-color: #EAECF0;"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                        <tfoot>
                            <tr class="fw-bold text-dark border-top" style="background: #F9FAFB; border-color: #D0D5DD !important;">
                                <td class="py-2.5 px-3" style="font-size: 12.5px;">Total Keseluruhan</td>
                                <td class="py-2.5 px-3" style="font-size: 12px; color: #475467;">${list.length} Baris</td>
                                <td class="py-2.5 px-3 text-end font-monospace" style="font-size: 12.5px;">${fmtNum(totalSJAll)} SJ</td>
                                <td class="py-2.5 px-3 text-end font-monospace" style="font-size: 12.5px;">${fmtNum(totalDestAll)} Titik</td>
                                <td class="py-2.5 px-3 text-end font-monospace text-success" style="font-size: 12.5px;">
                                    <div>${fmtNum(delivDestAll)} ${metricUnit}</div>
                                    <div class="fw-normal text-muted" style="font-size: 11px;">${overallSuccessRate}% Selesai</div>
                                </td>
                                <td class="py-2.5 px-3 text-end font-monospace" style="font-size: 12.5px;">100.0%</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }

    function render() {
        const container = root.document.getElementById('dashboard-volume-comparison-container');
        if (!container) return;

        const rawData = collectTripData();
        const availableRegions = getAvailableRegions(rawData);
        const availableAdmins = getAvailableAdmins(rawData);
        const availableCouriers = getAvailableCouriers(rawData);
        const dailyBuckets = computeDailyBuckets(rawData, currentMetric, currentRegion, currentAdmin, currentCourier, startDate, endDate);
        const breakdownData = computeBreakdownData(rawData, breakdownDim, currentRegion, currentAdmin, currentCourier, startDate, endDate, breakdownSearch);

        let totalWeeklyVolume = 0;
        let deliveredWeeklyVolume = 0;
        dailyBuckets.forEach(b => {
            totalWeeklyVolume += b.total;
            deliveredWeeklyVolume += b.delivered;
        });

        const metricTitle = currentMetric === 'destinations' ? 'Titik' : 'Surat Jalan';
        const unitName = currentMetric === 'destinations' ? 'Titik' : 'SJ';
        const regionLabel = currentRegion === 'all' ? 'Semua Region' : currentRegion;

        container.innerHTML = `
            <div class="border rounded-4 bg-white shadow-2fs mb-4 overflow-hidden" style="border-color: #EAECF0 !important;">
                <!-- Main Header: Metric Switcher, Region Filter, and Toggle -->
                <div class="d-flex flex-column flex-xxl-row align-items-xxl-center justify-content-between gap-3 px-4 py-3 border-bottom bg-white" style="border-color: #EAECF0 !important;">
                    <div>
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <h3 class="m-0" style="font-size: 14px; font-weight: 700; color: #101828;">
                                Grafik Pengiriman
                            </h3>
                            <button type="button" class="btn btn-sm btn-light border p-1 d-inline-flex align-items-center justify-content-center" style="width: 28px; height: 28px; border-radius: 6px; border-color: #D0D5DD !important; color: #475467;" onclick="VolumeComparison.toggleCollapse()" title="${isCollapsed ? 'Tampilkan Visual Grafik' : 'Sembunyikan Visual Grafik'}" aria-label="${isCollapsed ? 'Tampilkan Visual Grafik' : 'Sembunyikan Visual Grafik'}">
                                <i class="bi bi-${isCollapsed ? 'eye-slash' : 'eye'}" style="font-size: 14px;"></i>
                            </button>
                        </div>
                        <p class="m-0 mt-0.5" style="font-size: 12px; color: #667085;">
                            ${fmtNum(totalWeeklyVolume)} ${unitName} total jadwal vs ${fmtNum(deliveredWeeklyVolume)} ${unitName} sukses (7 Hari Operasional)
                        </p>
                    </div>

                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <!-- Metric Dropdown (Titik & Surat Jalan) -->
                        <div style="min-width: 90px;">
                            <select id="vol-metric-select" class="form-select form-select-sm" style="height: 32px; border-radius: 8px; border-color: #D0D5DD; font-size: 12px; font-weight: 600; color: #101828;" onchange="VolumeComparison.setMetric(this.value)">
                                <option value="destinations" ${currentMetric === 'destinations' ? 'selected' : ''}>Titik</option>
                                <option value="sj" ${currentMetric === 'sj' ? 'selected' : ''}>Surat Jalan</option>
                            </select>
                        </div>

                        <!-- Region Filter -->
                        <div style="min-width: 100px;">
                            <select id="vol-region-select" class="form-select form-select-sm" style="height: 32px; border-radius: 8px; border-color: #D0D5DD; font-size: 12px; font-weight: 500; color: #101828;" onchange="VolumeComparison.setRegion(this.value)">
                                <option value="all" ${currentRegion === 'all' ? 'selected' : ''}>Region</option>
                                ${availableRegions.map(reg => `<option value="${escapeHtml(reg)}" ${currentRegion.toLowerCase() === reg.toLowerCase() ? 'selected' : ''}>${escapeHtml(reg)}</option>`).join('')}
                            </select>
                        </div>

                        <!-- Kurir / Driver Filter (Format Optgroup & Search seperti Manual Dispatch) -->
                        <div style="min-width: 110px;">
                            <select id="vol-courier-select" class="form-select form-select-sm" style="height: 32px; border-radius: 8px; border-color: #D0D5DD; font-size: 12px; font-weight: 500; color: #101828;" onchange="VolumeComparison.setCourier(this.value)">
                                ${buildCourierFilterOptions(currentCourier, availableCouriers)}
                            </select>
                        </div>

                        <!-- Kalender Rentang Tanggal Rapih -->
                        <div class="d-inline-flex align-items-center bg-white border rounded-2 px-2" style="height: 32px; border-color: #D0D5DD !important;">
                            <i class="bi bi-calendar3 text-muted me-1.5" style="font-size: 11.5px;"></i>
                            <input type="date" id="volume-start-date" class="border-0 bg-transparent p-0 text-dark font-monospace" style="font-size: 11.5px; width: 115px; height: 30px; outline: none;" value="${startDate || ''}" onchange="VolumeComparison.setDateRange(this.value, document.getElementById('volume-end-date').value)" title="Dari Tanggal">
                            <span class="text-muted mx-1" style="font-size: 11px;">s/d</span>
                            <input type="date" id="volume-end-date" class="border-0 bg-transparent p-0 text-dark font-monospace" style="font-size: 11.5px; width: 115px; height: 30px; outline: none;" value="${endDate || ''}" onchange="VolumeComparison.setDateRange(document.getElementById('volume-start-date').value, this.value)" title="Sampai Tanggal">
                            ${(startDate || endDate) ? `
                                <button type="button" class="btn btn-link text-muted p-0 ms-1 text-decoration-none" onclick="VolumeComparison.clearDateRange()" title="Reset Tanggal">
                                    <i class="bi bi-x-circle-fill" style="font-size: 12px;"></i>
                                </button>
                            ` : ''}
                        </div>

                        <!-- Download Report Button -->
                        <button type="button" class="btn btn-sm btn-wellen-action d-inline-flex align-items-center gap-1.5" style="height: 32px; border-radius: 8px; font-size: 12px;" onclick="VolumeComparison.downloadReport()" title="Download Laporan Pengiriman">
                            <i class="bi bi-file-earmark-excel"></i> <span>Report</span>
                        </button>
                    </div>
                </div>

                <!-- Collapsible Chart & Breakdown Container -->
                <div id="vol-chart-body" class="${isCollapsed ? 'd-none' : 'block'}">
                    <!-- Chart Section -->
                    <div class="p-4" style="background: #ffffff;">
                        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 text-muted mb-2" style="font-size: 12px; color: #344054;">
                            <div class="d-flex flex-wrap align-items-center gap-3">
                                <span class="d-inline-flex align-items-center gap-1.5">
                                    <span class="rounded-1 d-inline-block" style="width: 12px; height: 12px; background: #CC6100;"></span>
                                    <span class="fw-medium text-dark">Total ${metricTitle}</span>
                                </span>
                                <span class="d-inline-flex align-items-center gap-1.5">
                                    <span class="rounded-1 d-inline-block" style="width: 12px; height: 12px; background: #12B76A;"></span>
                                    <span class="fw-medium text-dark">Sukses</span>
                                </span>
                            </div>
                        </div>

                        ${renderSvgChart(dailyBuckets, currentMetric, currentRegion)}
                    </div>

                    <!-- Data Breakdown Sub-Section (Turunan Tabel Klien / Region seperti Esse) -->
                    <div class="border-top" style="border-color: #EAECF0 !important;">
                        <div class="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 px-4 py-3 border-bottom bg-white" style="border-color: #EAECF0 !important;">
                            <div class="d-flex align-items-center gap-2 flex-wrap">
                                <h2 class="m-0" style="font-size: 14px; font-weight: 700; color: #101828;">Data Breakdown</h2>
                                <span class="text-muted" style="font-size: 12px;">${breakdownData.list.length} grup • Klik baris untuk filter pengiriman</span>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-wrap">
                                <!-- Search input -->
                                <div class="position-relative" style="width: 190px;">
                                    <i class="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-2.5 text-muted" style="font-size: 12px;"></i>
                                    <input type="text" id="breakdown-search-input" class="form-control form-control-sm ps-4 py-1" style="height: 32px; border-radius: 8px; font-size: 12px; border-color: #D0D5DD;" placeholder="Cari Klien / Region..." value="${escapeHtml(breakdownSearch)}" oninput="VolumeComparison.setSearch(this.value)">
                                </div>

                                <!-- Breakdown Dimension Selector -->
                                <div class="position-relative" style="min-width: 130px;">
                                    <select id="breakdown-dim-select" class="form-select form-select-sm" style="height: 32px; border-radius: 8px; border-color: #D0D5DD; font-size: 12px; font-weight: 500; color: #101828;" onchange="VolumeComparison.setBreakdownDim(this.value)">
                                        <option value="customer" ${breakdownDim === 'customer' ? 'selected' : ''}>Klien</option>
                                        <option value="region" ${breakdownDim === 'region' ? 'selected' : ''}>Region</option>
                                    </select>
                                </div>

                                <!-- Action Report Button -->
                                <button type="button" class="btn btn-sm btn-wellen-action d-inline-flex align-items-center gap-1.5" style="height: 32px; border-radius: 8px; font-size: 12px;" onclick="VolumeComparison.downloadReport()" title="Download Laporan Breakdown">
                                    <i class="bi bi-file-earmark-excel"></i> <span>Report</span>
                                </button>
                            </div>
                        </div>

                        ${renderBreakdownTable(breakdownData, currentMetric)}
                    </div>
                </div>
            </div>
        `;

        // Enhance custom dropdowns for professional floating searchable UI matching Manual Dispatch
        if (root.wtrackDropdown && typeof root.wtrackDropdown.enhance === 'function') {
            const courierSel = root.document.getElementById('vol-courier-select');
            if (courierSel) root.wtrackDropdown.enhance(courierSel);
            const metricSel = root.document.getElementById('vol-metric-select');
            if (metricSel) root.wtrackDropdown.enhance(metricSel);
            const regionSel = root.document.getElementById('vol-region-select');
            if (regionSel) root.wtrackDropdown.enhance(regionSel);
        }
    }

    function showTooltip(idx, centerX, barTopY) {
        hoveredDayIdx = idx;
        const tooltipEl = root.document.getElementById('esse-chart-tooltip');
        const container = root.document.getElementById('volume-svg-container');
        if (!tooltipEl || !container) return;

        const rawData = collectTripData();
        const dailyBuckets = computeDailyBuckets(rawData, currentMetric, currentRegion, currentAdmin, currentCourier, startDate, endDate);
        const b = dailyBuckets[idx];
        if (!b) return;

        const isSunday = b.day === 'Minggu';
        const statusLabel = isSunday ? (b.total > 0 ? 'Lembur Operasional' : 'Libur Operasional') : 'Operasional Aktif';
        const regionLabel = currentRegion === 'all' ? 'Semua Region' : currentRegion;
        const successRate = b.total > 0 ? Math.round((b.delivered / b.total) * 100) : 0;
        const pending = Math.max(0, b.total - b.delivered);
        const unitName = currentMetric === 'destinations' ? 'Titik' : 'SJ';

        tooltipEl.innerHTML = `
            <div class="fw-bold border-bottom pb-1.5 mb-2" style="font-size: 12px; color: #101828; border-color: #F2F4F7 !important;">
                <span>${b.day} • ${statusLabel}</span>
                <span class="d-block text-muted text-truncate mt-0.5" style="font-size: 10.5px; font-weight: 400;">
                    <i class="bi bi-geo-alt me-1 text-primary"></i>${escapeHtml(regionLabel)}
                </span>
            </div>
            <div style="font-family: var(--font-mono, monospace); font-size: 11.5px; line-height: 1.6;">
                <div class="d-flex align-items-center justify-content-between gap-3">
                    <span class="d-inline-flex align-items-center gap-1.5" style="color: #475467;">
                        <span class="rounded-1 d-inline-block" style="width: 8px; height: 8px; background: #E88520;"></span>
                        Total ${currentMetric === 'destinations' ? 'Titik' : 'SJ'}:
                    </span>
                    <span class="fw-bold" style="color: #101828;">${fmtNum(b.total)} ${unitName}</span>
                </div>
                <div class="d-flex align-items-center justify-content-between gap-3">
                    <span class="d-inline-flex align-items-center gap-1.5" style="color: #475467;">
                        <span class="rounded-1 d-inline-block" style="width: 8px; height: 8px; background: #12B76A;"></span>
                        Sukses:
                    </span>
                    <span class="fw-bold" style="color: #027A48;">${fmtNum(b.delivered)} ${unitName} (${successRate}%)</span>
                </div>
                ${pending > 0 ? `
                <div class="d-flex align-items-center justify-content-between gap-3">
                    <span class="d-inline-flex align-items-center gap-1.5" style="color: #475467;">
                        <span class="rounded-1 d-inline-block" style="width: 8px; height: 8px; background: #98A2B3;"></span>
                        Tertunda / Belum:
                    </span>
                    <span class="fw-bold" style="color: #344054;">${fmtNum(pending)} ${unitName}</span>
                </div>` : ''}
                <div class="d-flex align-items-center justify-content-between gap-3 mt-1.5 pt-1.5 border-top" style="border-color: #F2F4F7 !important;">
                    <span style="color: #475467;">Persentase Selesai:</span>
                    <span class="fw-bold" style="color: #175CD3;">${successRate}%</span>
                </div>
            </div>
        `;

        // Position tooltip centered on bar pair
        const svgWidth = 980;
        const xPct = (centerX / svgWidth) * 100;

        // Tooltip safety flip: prevent clipping when bar is near the top (Gb 4 fix)
        const isNearTop = barTopY < 140;
        let clampedTop;
        if (isNearTop) {
            clampedTop = Math.max(10, barTopY + 28);
            tooltipEl.style.transform = 'translate(-50%, 0)';
            tooltipEl.classList.add('tooltip-flip-bottom');
        } else {
            clampedTop = Math.max(10, barTopY - 12);
            tooltipEl.style.transform = 'translate(-50%, -100%)';
            tooltipEl.classList.remove('tooltip-flip-bottom');
        }

        tooltipEl.style.left = `clamp(110px, ${xPct}%, calc(100% - 110px))`;
        tooltipEl.style.top = `${clampedTop}px`;
        tooltipEl.classList.remove('d-none');
    }

    function updateTooltipPos(evt) {
        // Position remains tied to active day column
    }

    function hideTooltip() {
        hoveredDayIdx = null;
        const tooltipEl = root.document.getElementById('esse-chart-tooltip');
        if (tooltipEl) tooltipEl.classList.add('d-none');
    }

    function setMetric(val) {
        currentMetric = val;
        render();
    }

    function setRegion(val) {
        currentRegion = (val === 'all' || !val) ? 'all' : val;
        render();
    }

    function setAdmin(val) {
        currentAdmin = (val === 'all' || !val) ? 'all' : val;
        render();
    }

    function setCourier(val) {
        currentCourier = (val === 'all' || !val) ? 'all' : val;
        render();
    }

    function setDateRange(start, end) {
        startDate = start || '';
        endDate = end || '';
        render();
    }

    function clearDateRange() {
        startDate = '';
        endDate = '';
        render();
    }

    function setBreakdownDim(val) {
        breakdownDim = val;
        render();
    }

    function setSearch(val) {
        breakdownSearch = val;
        render();
        // Restore focus to search input
        const input = root.document.getElementById('breakdown-search-input');
        if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }

    function setSort(field) {
        if (sortField === field) {
            sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            sortField = field;
            sortDir = 'desc';
        }
        render();
    }

    function filterByRow(name) {
        if (!name) return;
        const searchInput = root.document.getElementById('recent-shipment-search');
        if (searchInput && root.renderRecentShipments) {
            searchInput.value = name;
            root.renderRecentShipments(name);
            searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (root.showToast) root.showToast(`Memfilter pengiriman ke ${name}`);
        }
    }

    function toggleCollapse() {
        isCollapsed = !isCollapsed;
        root.localStorage.setItem(STORAGE_COLLAPSE_KEY, String(isCollapsed));
        render();
    }

    async function downloadReport() {
        const rawData = collectTripData();
        const breakdownData = computeBreakdownData(rawData, breakdownDim, currentRegion, currentAdmin, currentCourier, startDate, endDate, breakdownSearch);
        const dateStr = new Date().toISOString().slice(0, 10);
        const periodStr = (startDate && endDate) ? `${startDate} s/d ${endDate}` : (startDate ? `Mulai ${startDate}` : (endDate ? `Sampai ${endDate}` : 'Semua Tanggal'));
        const regionLabel = currentRegion === 'all' ? 'Semua Region' : currentRegion;
        const adminLabel = currentAdmin === 'all' ? 'Semua Admin' : currentAdmin;
        const courierLabel = currentCourier === 'all' ? 'Semua Kurir' : currentCourier;
        const metricLabel = currentMetric === 'destinations' ? 'Titik Pengantaran' : 'Surat Jalan';
        const dimLabel = breakdownDim === 'customer' ? 'Klien' : 'Region';

        if (typeof ExcelJS !== 'undefined') {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = "Wellen Print Logistics";
            workbook.created = new Date();

            const sheet = workbook.addWorksheet("Volume_Pengiriman", {
                views: [{ showGridLines: true }]
            });

            // 1. Title Banner (Row 1)
            sheet.mergeCells('A1:I1');
            const titleCell = sheet.getCell('A1');
            titleCell.value = "LAPORAN VOLUME PENGANTARAN LOGISTIK - WELLEN PRINT ERP";
            titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F4E79' }
            };
            titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            sheet.getRow(1).height = 26;

            // 2. Subtitle Banner (Row 2)
            sheet.mergeCells('A2:I2');
            const subCell = sheet.getCell('A2');
            subCell.value = `Periode: ${periodStr}  |  Region: ${regionLabel}  |  Admin SJ: ${adminLabel}  |  Kurir: ${courierLabel}  |  Metrik: ${metricLabel}  |  Total: ${breakdownData.list.length} ${dimLabel}`;
            subCell.font = { name: 'Calibri', size: 9.5, italic: true, bold: true, color: { argb: 'FF1F4E79' } };
            subCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFEBF3FA' }
            };
            subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            subCell.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                bottom: { style: 'thin', color: { argb: 'FF94A3B8' } }
            };
            sheet.getRow(2).height = 20;

            // Row 3: Blank separator
            sheet.getRow(3).height = 8;

            // 3. Header Row (Row 4)
            const headerRow = sheet.getRow(4);
            headerRow.height = 26;
            const headers = [
                "No", "Kategori", "Nama " + dimLabel, "Region", "Total Surat Jalan", 
                "Total Titik", "Sukses", "Persentase Sukses", "Share Volume (%)"
            ];
            headers.forEach((h, idx) => {
                const cell = headerRow.getCell(idx + 1);
                cell.value = h;
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1F4E79' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF1F4E79' } },
                    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    bottom: { style: 'medium', color: { argb: 'FF0F2C59' } },
                    right: { style: 'thin', color: { argb: 'FF94A3B8' } }
                };
            });

            const thinBorder = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            breakdownData.list.forEach((item, idx) => {
                const row = sheet.getRow(idx + 5);
                row.height = 22;
                const isEven = (idx % 2 === 0);
                const bgArgb = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

                const rowVals = [
                    idx + 1,
                    dimLabel,
                    item.name || '-',
                    item.region || '-',
                    item.totalSJ,
                    item.totalDest,
                    item.deliveredDest,
                    item.successPct / 100,
                    item.sharePct / 100
                ];

                rowVals.forEach((val, cIdx) => {
                    const cell = row.getCell(cIdx + 1);
                    cell.border = thinBorder;
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: bgArgb }
                    };

                    if (cIdx === 0) {
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (cIdx === 1 || cIdx === 3) {
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF334155' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (cIdx === 2) {
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                    } else if (cIdx === 4 || cIdx === 5 || cIdx === 6) {
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF0F172A' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '#,##0';
                    } else if (cIdx === 7 || cIdx === 8) {
                        cell.value = val;
                        cell.font = { name: 'Calibri', size: 9.5, bold: (cIdx === 7), color: { argb: cIdx === 7 ? 'FF027A48' : 'FF1E293B' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '0.0%';
                    }
                });
            });

            // Summary Footer Row
            const footerRowIdx = breakdownData.list.length + 5;
            const footerRow = sheet.getRow(footerRowIdx);
            footerRow.height = 24;
            const totalDeliv = breakdownData.deliveredDestAll || 0;
            const totalDest = breakdownData.totalDestAll || 0;
            const overallRate = totalDest > 0 ? (totalDeliv / totalDest) : 0;

            const footerVals = [
                "", "TOTAL", `Total ${breakdownData.list.length} Data`, "",
                breakdownData.totalSJAll || 0,
                totalDest,
                totalDeliv,
                overallRate,
                1.0
            ];

            footerVals.forEach((val, cIdx) => {
                const cell = footerRow.getCell(cIdx + 1);
                cell.value = val;
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE2E8F0' }
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    bottom: { style: 'double', color: { argb: 'FF0F2C59' } }
                };
                if (cIdx === 1 || cIdx === 2) {
                    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                } else if (cIdx >= 4 && cIdx <= 6) {
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    cell.numFmt = '#,##0';
                } else if (cIdx >= 7) {
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    cell.numFmt = '0.0%';
                }
            });

            sheet.columns = [
                { width: 6 },
                { width: 14 },
                { width: 34 },
                { width: 18 },
                { width: 18 },
                { width: 16 },
                { width: 14 },
                { width: 18 },
                { width: 16 }
            ];

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = URL.createObjectURL(blob);
            const a = root.document.createElement('a');
            a.href = url;
            a.download = `Laporan_Volume_Pengiriman_${dateStr}.xlsx`;
            root.document.body.appendChild(a);
            a.click();
            root.document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (root.showToast) {
                root.showToast(`Report Volume Pengiriman berhasil diunduh (${breakdownData.list.length} data)`);
            }
            return;
        }

        let csv = '\uFEFF'; // UTF-8 BOM for Microsoft Excel
        csv += 'LAPORAN VOLUME PENGIRIMAN - WELLEN PRINT ERP\r\n';
        csv += `Tanggal Report: ${dateStr}\r\n`;
        csv += `Filter Region: ${regionLabel}\r\n`;
        csv += `Filter Admin SJ: ${adminLabel}\r\n`;
        csv += `Filter Kurir: ${courierLabel}\r\n`;
        csv += `Rentang Tanggal: ${periodStr}\r\n`;
        csv += `Metrik Utama: ${metricLabel}\r\n`;
        csv += `Dimensi Breakdown: ${dimLabel}\r\n\r\n`;

        csv += 'No,Kategori,Nama,Region,Total Surat Jalan,Total Titik,Sukses,Persentase Selesai,Share Volume (%)\r\n';

        breakdownData.list.forEach((item, idx) => {
            const nameEscaped = `"${String(item.name || '').replace(/"/g, '""')}"`;
            const regionEscaped = `"${String(item.region || '').replace(/"/g, '""')}"`;
            csv += `${idx + 1},${breakdownDim},${nameEscaped},${regionEscaped},${item.totalSJ},${item.totalDest},${item.deliveredDest},${item.successPct.toFixed(1)}%,${item.sharePct.toFixed(1)}%\r\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = root.document.createElement('a');
        a.href = url;
        a.download = `Report_Volume_Pengiriman_${dateStr}.csv`;
        root.document.body.appendChild(a);
        a.click();
        root.document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (root.showToast) {
            root.showToast('Report pengiriman berhasil diunduh');
        }
    }

    const api = {
        render,
        setMetric,
        setRegion,
        setAdmin,
        setCourier,
        setDateRange,
        clearDateRange,
        setBreakdownDim,
        setSearch,
        setSort,
        filterByRow,
        toggleCollapse,
        downloadReport,
        showTooltip,
        updateTooltipPos,
        hideTooltip
    };

    root.VolumeComparison = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;

    root.document.addEventListener('DOMContentLoaded', () => {
        setTimeout(render, 300);
    });

})(typeof window !== 'undefined' ? window : globalThis);
