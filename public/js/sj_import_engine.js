/**
 * WTRACK LOGISTICS - SURAT JALAN (SJ) IMPORT & AUTO-REGION ENGINE
 * Mendukung pembacaan Excel harian, auto-klasifikasi Region Jabodetabek,
 * pemilihan lokasi print (Pusat vs Cikokol), dan penugasan per Region.
 */

(function(window) {
    'use strict';

    const JABODETABEK_REGIONS = [
        "Jakarta Pusat",
        "Jakarta Barat",
        "Jakarta Selatan",
        "Jakarta Timur",
        "Jakarta Utara",
        "Tangerang",
        "Bekasi",
        "Cikarang",
        "Depok",
        "Bogor",
        "Karawang",
        "Serang"
    ];

    // Kamus kata kunci wilayah Jabodetabek & sekitarnya
    const REGION_KEYWORDS = {
        "Jakarta Pusat": ["pusat", "kemayoran", "cempaka putih", "senen", "menteng", "gambir", "tanah abang", "sentiong", "salemba", "johar baru", "sawah besar", "gondangdia", "thamrin", "sudirman", "petojo", "cideng", "kwitang", "mangga dua", "harmoni", "monas", "roxy"],
        "Jakarta Selatan": ["selatan", "kebayoran", "cilandak", "pasar minggu", "pasarminggu", "pancoran", "mampang", "tebet", "setiabudi", "jagakarsa", "pesanggrahan", "lebak bulus", "fatmawati", "blok m", "ampera", "kemang", "gandaria", "cipete", "pejaten", "ragunan", "kalibata", "kuningan", "buncit", "radio dalam", "pondok indah"],
        "Jakarta Barat": ["barat", "cengkareng", "grogol", "petamburan", "taman sari", "tambora", "kebon jeruk", "kalideres", "palmerah", "kembangan", "puri", "meruya", "joglo", "duri kepa", "jelambar", "tomang", "slipi", "kemanggisan", "glodok", "kapuk", "kedoya", "tanjung duren"],
        "Jakarta Timur": ["timur", "matraman", "pulo gadung", "pulogadung", "jatinegara", "duren sawit", "kramat jati", "makasar", "pasar rebo", "ciracas", "cipayung", "cakung", "rawamangun", "pondok kopi", "klender", "halim", "condet", "kampung melayu", "cililitan", "cawang", "pisangan", "buaran"],
        "Jakarta Utara": ["utara", "koja", "kelapa gading", "tanjung priok", "priok", "pademangan", "penjaringan", "cilincing", "pluit", "ancol", "sunter", "marunda", "muara baru", "kamal muara", "pantai indah kapuk", "pik"],
        "Tangerang": ["tangerang", "tangsel", "ciputat", "pamulang", "bsd", "serpong", "bintaro", "karawaci", "cikokol", "ciledug", "karang tengah", "cipondoh", "batuceper", "benda", "larangan", "pinang", "tigaraksa", "curug", "cikupa", "balaraja", "cisauk", "pagedangan", "kelapa dua", "gading serpong", "alamsutera", "alam sutera", "pasar kemis", "sepantan"],
        "Bekasi": ["bekasi", "tambun", "cibitung", "galaxy", "jatiasih", "pondok gede", "medan satria", "bantar gebang", "rawalumbu", "mustika jaya", "jakasampurna", "pekayon", "kranji", "harapan indah", "jatiwaringin", "narogong"],
        "Cikarang": ["cikarang", "jababeka", "lippo cikarang", "ejip", "mm2100", "hyundai", "deltamas", "giic"],
        "Depok": ["depok", "margonda", "cinere", "beji", "pancoran mas", "sukmajaya", "cimanggis", "sawangan", "limo", "bojongsari", "cilodong", "tapos", "citayam", "kelapa dua depok"],
        "Bogor": ["bogor", "cibinong", "sentul", "ciawi", "cileungsi", "gunung putri", "parung", "dramaga", "citeureup", "tajur", "bogor kota", "bojonggede"],
        "Karawang": ["karawang", "kiic", "suryacipta", "klari", "cikampek", "telukjambe", "rondas"],
        "Serang": ["serang", "cilegon", "pandeglang", "lebak", "banten", "ciruas", "kragilan", "anyer", "merak"]
    };

    // Tambahkan kata kunci spesifik Bogor & wilayah lain (termasuk Pusat Perbelanjaan / Mall Retail)
    REGION_KEYWORDS["Bogor"].push("baranangsiang", "pajajaran", "tajur", "sentul", "ciawi", "gadog", "gunung putri", "citeureup", "dramaga", "bojonggede", "cibinong", "botani square", "cibinong city mall");
    REGION_KEYWORDS["Jakarta Utara"].push("kelapa gading", "boulevard kelapa gading", "boulevard barat", "boulevard timur", "mall of indonesia", "moi", "pik avenue", "pluit village");
    REGION_KEYWORDS["Bekasi"].push("cikarang barat", "cikarang timur", "cikarang selatan", "cikarang pusat", "cikarang utara", "summarecon mall bekasi", "smb", "grand metropolitan");
    REGION_KEYWORDS["Depok"].push("margo city", "margocity", "depok town square", "detos", "pesona square", "d'mall", "dmall");
    REGION_KEYWORDS["Tangerang"].push("supermal karawaci", "summarecon mall serpong", "sms", "living world", "tangcity", "aeon bsd", "bintaro xchange");
    REGION_KEYWORDS["Jakarta Selatan"].push("pondok indah mall", "pim", "kota kasablanka", "kokas", "pacific place", "senayan city", "plaza senayan", "gandaria city");
    REGION_KEYWORDS["Jakarta Barat"].push("central park", "neo soho", "taman anggrek", "puri indah mall", "lippo mall puri");

    // Generator Kode Unik Cukup Angka Saja (6 Digit Angka, misal: 849201)
    function generateUniqueCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Deteksi Region berdasarkan Master Database & Pencocokan Alamat
    function detectRegion(address, clientName = '') {
        const addrLower = (address || '').toLowerCase();
        const clientLower = (clientName || '').toLowerCase();
        const combined = `${clientLower} ${addrLower}`;

        // 1. Cek dari master clients yang sudah terdaftar di window.allClients atau cachedAllClients
        const clientMasterList = (window.allClients && window.allClients.length > 0) ? window.allClients : (window.cachedAllClients || []);
        if (clientMasterList && clientMasterList.length > 0 && clientName) {
            const found = clientMasterList.find(c => {
                const cName = (c.name || '').toLowerCase();
                return cName && (cName === clientLower || cName.includes(clientLower) || clientLower.includes(cName));
            });
            if (found && found.region && found.region !== 'Auto-detected' && found.region !== 'General') {
                return found.region;
            }
        }

        // 2. Kumpulkan semua keyword dan urutkan berdasarkan prioritas:
        //    Keyword yang lebih panjang atau spesifik (>= 4 karakter & bukan kata generic mata angin) didahulukan!
        const genericWords = new Set(["pusat", "barat", "selatan", "timur", "utara", "kota", "kabupaten", "daerah"]);
        const prioritizedKeywords = [];

        for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) {
            for (const kw of keywords) {
                const kwClean = kw.toLowerCase().trim();
                const isGeneric = genericWords.has(kwClean);
                prioritizedKeywords.push({
                    region,
                    keyword: kwClean,
                    score: (isGeneric ? 0 : 100) + kwClean.length
                });
            }
        }

        // Urutkan score tertinggi ke terendah
        prioritizedKeywords.sort((a, b) => b.score - a.score);

        // Cocokkan terhadap alamat
        for (const item of prioritizedKeywords) {
            const regex = new RegExp(`\\b${item.keyword}\\b`, 'i');
            if (regex.test(combined)) {
                return item.region;
            }
        }

        // 3. Fallback default
        if (combined.includes('jakarta')) return 'Jakarta Pusat';
        return 'Jakarta Pusat';
    }

    // Normalisasi Header Kolom Excel Lengkap (Mendukung Dokumen Fisik Surat Jalan & Format PoD)
    function normalizeHeaderKey(key) {
        const cleaned = String(key || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

        // 1. No Surat Jalan / No Faktur
        if (cleaned.includes('no sj') || cleaned.includes('nomor sj') || cleaned.includes('surat jalan') || cleaned.includes('no invoice') || cleaned.includes('nosj') || cleaned.includes('no faktur') || cleaned.includes('faktur')) return 'sjNumber';

        // 2. Tanggal
        if (cleaned.includes('tanggal') || cleaned.includes('tgl') || cleaned.includes('date')) return 'dateStr';

        // 3. NAMA BARANG / ITEM / PRODUK (HARUS LEBIH DULU daripada customer agar 'nama barang' tidak pernah masuk ke customer!)
        if (cleaned.includes('nama barang') || cleaned.includes('uraian barang') || cleaned.includes('nama produk') || cleaned.includes('nama item') || cleaned.includes('deskripsi barang') || cleaned.includes('deskripsi') || cleaned.includes('uraian') || cleaned.includes('barang') || cleaned.includes('item') || cleaned.includes('produk') || cleaned.includes('pekerjaan')) return 'itemsSummary';

        // 4. CUSTOMER / KLIEN (Hanya dicocokkan jika ada kata customer, klien, client, toko, pemesan, penerima, kepada, pemberi kerja, atau 'nama customer')
        if (cleaned.includes('customer') || cleaned.includes('klien') || cleaned.includes('client') || cleaned.includes('nama customer') || cleaned.includes('nama klien') || cleaned.includes('nama toko') || cleaned.includes('penerima') || cleaned.includes('kepada') || cleaned.includes('toko') || cleaned.includes('perusahaan') || cleaned.includes('pemesan') || cleaned.includes('pemberi kerja') || cleaned === 'nama' || cleaned === 'cust') return 'clientName';

        // 5. Ukuran & Dimensi
        if (cleaned.includes('ukuran') || cleaned.includes('size') || cleaned.includes('dimensi') || cleaned.includes('panjang') || cleaned.includes('lebar')) return 'ukuran';

        // 6. Qty / Jumlah / Koli
        if (cleaned.includes('qty') || cleaned.includes('quantity') || cleaned.includes('jumlah') || cleaned.includes('banyaknya') || cleaned.includes('koli') || cleaned.includes('pcs') || cleaned.includes('vol')) return 'qty';

        // 7. Satuan
        if (cleaned.includes('satuan') || cleaned.includes('unit') || cleaned.includes('uom')) return 'satuan';

        // 8. Finishing
        if (cleaned.includes('finishing') || cleaned.includes('finisihing') || cleaned.includes('proses')) return 'finishing';

        // 9. Mesin
        if (cleaned.includes('mesin') || cleaned.includes('machine')) return 'machine';

        // 10. Alamat Pengiriman
        if (cleaned.includes('alamat') || cleaned.includes('address') || cleaned.includes('tujuan') || cleaned.includes('lokasi') || cleaned.includes('alamat kirim')) return 'address';

        // 11. Region / Wilayah
        if (cleaned.includes('region') || cleaned.includes('wilayah') || cleaned.includes('area') || cleaned.includes('kota')) return 'region';

        // 12. PIC / No Telp
        if (cleaned.includes('pic') || cleaned.includes('kontak') || cleaned.includes('up') || cleaned.includes('telp') || cleaned.includes('telepon') || cleaned.includes('hp') || cleaned.includes('phone')) return 'picPhone';

        // 13. Lokasi Cabang Cetak
        if (cleaned.includes('cabang') || cleaned.includes('print di') || cleaned.includes('print') || cleaned.includes('cetak') || cleaned.includes('branch')) return 'originBranch';

        // 14. Deadline
        if (cleaned.includes('deadline') || cleaned.includes('dateline') || cleaned.includes('target') || cleaned.includes('tempo')) return 'deadline';

        // 15. SPK / PO
        if (cleaned.includes('spk') || cleaned.includes('no spk') || cleaned.includes('po') || cleaned.includes('no po') || cleaned.includes('order')) return 'spkNumber';

        // 16. Catatan
        if (cleaned.includes('catatan') || cleaned.includes('keterangan') || cleaned.includes('note')) return 'catatan';

        return cleaned;
    }

    let parsedPreviewList = [];
    let currentImportFileName = '';

    // Baca dan parse file Excel (Mendukung format standar SJ dan Format SPK Wellen Print Gambar 1)
    async function parseExcelFile(file) {
        if (!file) throw new Error("File tidak ditemukan.");
        if (typeof XLSX === 'undefined') throw new Error("Pustaka SheetJS (XLSX) belum dimuat.");

        currentImportFileName = file.name || 'Import_Surat_Jalan.xlsx';

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];

                    // 1. Baca sebagai 2D Array untuk mendeteksi header dinamis dan teks pemberi kerja di atas tabel
                    const rows2D = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                    if (!rows2D || rows2D.length === 0) {
                        return reject(new Error("File Excel kosong atau tidak dapat dibaca!"));
                    }

                    // Cari teks "Nama Pemberi Kerja" di 12 baris pertama (jika format Wellen SPK)
                    let detectedClientName = '';
                    let headerRowIndex = -1;

                    for (let r = 0; r < Math.min(rows2D.length, 12); r++) {
                        const rowStr = rows2D[r].map(c => String(c || '').trim()).join(' ');
                        const matchClient = rowStr.match(/nama pemberi kerja\s*[:\-]?\s*([a-zA-Z0-9\s_\-\.]+)/i);
                        if (matchClient && matchClient[1]) {
                            detectedClientName = matchClient[1].trim();
                        }

                        // Cek apakah baris ini adalah header kolom (mengandung Mesin, Nama Barang, Ukuran, Qty, Customer, dll)
                        const lowerCells = rows2D[r].map(c => String(c || '').toLowerCase().trim());
                        const hasMesin = lowerCells.some(c => c.includes('mesin') || c === 'n' || c === 'no');
                        const hasBarang = lowerCells.some(c => c.includes('nama barang') || c.includes('barang') || c.includes('produk') || c.includes('item'));
                        const hasQty = lowerCells.some(c => c.includes('qty') || c.includes('jumlah'));
                        const hasSJ = lowerCells.some(c => c.includes('surat jalan') || c.includes('no sj') || c.includes('customer') || c.includes('klien'));

                        if ((hasBarang && (hasMesin || hasQty)) || hasSJ) {
                            headerRowIndex = r;
                            break;
                        }
                    }

                    // Jika tidak ditemukan baris header spesifik, gunakan baris 0
                    if (headerRowIndex === -1) headerRowIndex = 0;

                    const headerCells = rows2D[headerRowIndex].map(c => String(c || '').trim());
                    const colMap = {};
                    headerCells.forEach((h, colIdx) => {
                        const norm = normalizeHeaderKey(h);
                        colMap[norm] = colIdx;
                    });

                    const normalizedRows = [];
                    const todayDate = new Date();
                    const defaultDateFolder = todayDate.toISOString().slice(0, 10);

                    // Cek apakah format file adalah template Wellen Gb 1 (kolom 1 Mesin, kolom 2 Barang)
                    const isWellenGb1 = (colMap['machine'] !== undefined && colMap['itemsSummary'] !== undefined) ||
                                        (headerCells[1] && headerCells[1].toLowerCase().includes('mesin'));

                    // Loop baris data setelah header
                    for (let r = headerRowIndex + 1; r < rows2D.length; r++) {
                        const rowData = rows2D[r];
                        if (!rowData || rowData.every(c => String(c || '').trim() === '')) continue;

                        const getVal = (normKey, fallbackColIdx = -1) => {
                            if (colMap[normKey] !== undefined && rowData[colMap[normKey]] !== undefined) {
                                return String(rowData[colMap[normKey]] || '').trim();
                            }
                            if (fallbackColIdx >= 0 && rowData[fallbackColIdx] !== undefined) {
                                return String(rowData[fallbackColIdx] || '').trim();
                            }
                            return '';
                        };

                        let mesinVal = getVal('machine');
                        let barangVal = getVal('itemsSummary');
                        let ukuranVal = getVal('ukuran');
                        let qtyVal = getVal('qty');
                        let finishingVal = getVal('finishing');

                        // Fallback indeks HANYA berlaku jika format tabel SPK Wellen Gb 1 (N, Mesin, Nama Barang, Ukuran, Qty, Finishing)
                        if (isWellenGb1) {
                            if (!mesinVal && rowData[1]) mesinVal = String(rowData[1]).trim();
                            if (!barangVal && rowData[2]) barangVal = String(rowData[2]).trim();
                            if (!ukuranVal && rowData[3]) ukuranVal = String(rowData[3]).trim();
                            if (!qtyVal && rowData[4]) qtyVal = String(rowData[4]).trim();
                            if (!finishingVal && rowData[5]) finishingVal = String(rowData[5]).trim();
                        }

                        if (!barangVal && !mesinVal && !rowData[0]) continue;

                        // 1. Ambil Customer / Klien (TIDAK AKAN TERTUKAR dengan nama barang)
                        let client = getVal('clientName');
                        if (!client && isWellenGb1) {
                            client = detectedClientName || 'WELLEN DM';
                        }
                        if (!client) {
                            client = 'Customer / Klien';
                        }

                        // 2. Gabungkan Nama Barang, Ukuran, dan Qty (Tanpa Finishing untuk Surat Jalan)
                        const qtyFormatted = qtyVal ? (qtyVal.toLowerCase().includes('pcs') || qtyVal.toLowerCase().includes('lembar') || qtyVal.toLowerCase().includes('set') ? qtyVal : `${qtyVal} Pcs`) : '1 Pcs';
                        
                        const descParts = [];
                        if (barangVal) descParts.push(barangVal);
                        if (ukuranVal && ukuranVal !== '-') descParts.push(`Uk: ${ukuranVal}`);
                        descParts.push(`Qty: ${qtyFormatted}`);
                        const fullDescription = descParts.join(' | ');

                        const address = getVal('address') || `Alamat Kirim ${client}`;
                        const reg = getVal('region') || detectRegion(address, client);
                        const shortCode = generateUniqueCode();
                        const sjNumber = getVal('sjNumber') || `SJ/${todayDate.getFullYear()}/${String(todayDate.getMonth()+1).padStart(2,'0')}/${String(normalizedRows.length + 1).padStart(4, '0')}`;

                        // Default lokasi print: Cikokol jika Tangerang / mesin tertentu, selebihnya Pusat
                        const isCikokol = reg === 'Tangerang' || (mesinVal && (mesinVal.toUpperCase().includes('SWISSQ') || mesinVal.toUpperCase().includes('OUTDOOR')));

                        normalizedRows.push({
                            rowIndex: normalizedRows.length + 1,
                            sjNumber: sjNumber,
                            shortCode: shortCode,
                            clientName: client,
                            customer: client,
                            address: address,
                            region: reg,
                            namaBarang: barangVal || 'Barang Cetakan',
                            ukuran: ukuranVal || '-',
                            qty: qtyFormatted,
                            finishing: finishingVal || '-',
                            itemsSummary: fullDescription,
                            picPhone: getVal('picPhone') || '0812-9876-5432',
                            originBranch: isCikokol ? 'cikokol' : 'pusat',
                            deadline: getVal('deadline') || '17:00 WIB',
                            spkNumber: getVal('spkNumber') || `SPK-${mesinVal || 'WL'}-${normalizedRows.length + 1}`,
                            dateFolder: defaultDateFolder,
                            machine: mesinVal || 'Digital Print'
                        });
                    }

                    if (normalizedRows.length === 0) {
                        return reject(new Error("Tidak ada baris barang/pekerjaan yang valid dalam file!"));
                    }

                    parsedPreviewList = normalizedRows;
                    resolve(normalizedRows);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Ekstraksi word/document.xml dari file Word (.docx / PKZIP)
     * Menggunakan native Central Directory parser + browser standard DecompressionStream.
     * 100% Client-Side dan Offline di localhost tanpa ketergantungan library luar.
     */
    async function extractDocxXml(arrayBuffer) {
        const uint8 = new Uint8Array(arrayBuffer);
        const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);

        // Helper dekompresi deflate raw dengan DecompressionStream
        async function decompressDeflate(compressedData) {
            if (typeof DecompressionStream !== 'undefined') {
                const ds = new DecompressionStream('deflate-raw');
                const writer = ds.writable.getWriter();
                writer.write(compressedData);
                writer.close();
                const reader = ds.readable.getReader();
                const chunks = [];
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                }
                const totalLen = chunks.reduce((a, c) => a + c.length, 0);
                const merged = new Uint8Array(totalLen);
                let p = 0;
                for (const c of chunks) {
                    merged.set(c, p);
                    p += c.length;
                }
                return new TextDecoder('utf-8').decode(merged);
            }
            throw new Error("Browser Anda belum mendukung DecompressionStream untuk membaca file Word (.docx).");
        }

        // 1. Cari End of Central Directory (EOCD signature: 0x06054b50)
        let eocdOffset = -1;
        for (let i = uint8.length - 22; i >= Math.max(0, uint8.length - 65557); i--) {
            if (view.getUint32(i, true) === 0x06054b50) {
                eocdOffset = i;
                break;
            }
        }

        if (eocdOffset !== -1) {
            const cdStart = view.getUint32(eocdOffset + 16, true);
            const cdSize = view.getUint32(eocdOffset + 12, true);
            let offset = cdStart;
            const cdEnd = cdStart + cdSize;

            while (offset + 46 <= cdEnd) {
                if (view.getUint32(offset, true) !== 0x02014b50) break;

                const method = view.getUint16(offset + 10, true);
                const compSize = view.getUint32(offset + 20, true);
                const nameLen = view.getUint16(offset + 28, true);
                const extraLen = view.getUint16(offset + 30, true);
                const commentLen = view.getUint16(offset + 32, true);
                const localOffset = view.getUint32(offset + 42, true);

                const nameBytes = uint8.subarray(offset + 46, offset + 46 + nameLen);
                const filename = new TextDecoder('utf-8').decode(nameBytes);

                if (filename === 'word/document.xml') {
                    const localNameLen = view.getUint16(localOffset + 26, true);
                    const localExtraLen = view.getUint16(localOffset + 28, true);
                    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
                    const compressedData = uint8.subarray(dataStart, dataStart + compSize);

                    if (method === 0) {
                        return new TextDecoder('utf-8').decode(compressedData);
                    } else if (method === 8) {
                        return await decompressDeflate(compressedData);
                    } else {
                        throw new Error('Kompresi DOCX tidak didukung (method ' + method + ')');
                    }
                }
                offset += 46 + nameLen + extraLen + commentLen;
            }
        }

        // 2. Fallback scan Local File Headers (0x04034b50)
        let localOffset = 0;
        while (localOffset + 30 <= uint8.length) {
            const sig = view.getUint32(localOffset, true);
            if (sig !== 0x04034b50) break;

            const method = view.getUint16(localOffset + 8, true);
            const compSize = view.getUint32(localOffset + 18, true);
            const nameLen = view.getUint16(localOffset + 26, true);
            const extraLen = view.getUint16(localOffset + 28, true);

            const nameBytes = uint8.subarray(localOffset + 30, localOffset + 30 + nameLen);
            const filename = new TextDecoder('utf-8').decode(nameBytes);
            const dataStart = localOffset + 30 + nameLen + extraLen;

            if (filename === 'word/document.xml') {
                const compressedData = uint8.subarray(dataStart, dataStart + compSize);
                if (method === 0) {
                    return new TextDecoder('utf-8').decode(compressedData);
                } else if (method === 8) {
                    return await decompressDeflate(compressedData);
                }
            }
            if (compSize === 0) break;
            localOffset = dataStart + compSize;
        }

        throw new Error("Struktur file Word (.docx) tidak valid atau file rusak.");
    }

    /**
     * Parse File Surat Jalan Microsoft Word (.docx)
     * Mengidentifikasi struktur Surat Jalan Wellen Print:
     * - Header: No SJ (misal: SJ-1126-00248), Customer (PT ASPIRASI HIDUP INDONESIA TBK), Alamat Tujuan (AZKO MARGO CITY MALL DEPOK)
     * - Tabel: Kolom No, Nama Barang, Ukuran, Qty, dan baris TOTAL
     * - Footer: Tgl, Nama File, Inv (WPP 1126-300252), PO, Dibuat Oleh (DEWI)
     */
    async function parseWordFile(file) {
        if (!file) throw new Error("File Word tidak ditemukan.");
        currentImportFileName = file.name || 'Surat_Jalan.docx';

        const arrayBuffer = await file.arrayBuffer();
        const normalizedRows = [];
        const todayDate = new Date();
        const defaultDateFolder = todayDate.toISOString().slice(0, 10);

        function isReservedHeaderWord(str) {
            const s = (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
            if (!s || (s.length < 2 && s !== 'n')) return true;
            if (/^(?:no\s*\.?|nomor|n|no\s*urut)$/i.test(s)) return true;
            if (/^(?:nama barang|barang|item|produk|deskripsi|uraian|nama item)$/i.test(s)) return true;
            if (/^(?:ukuran|dimensi|size)$/i.test(s)) return true;
            if (/^(?:qty|jumlah|banyak|koli|pcs|satuan|total|total qty|grand total)$/i.test(s)) return true;
            if (/^(?:surat jalan|sj|delivery order|do)$/i.test(s)) return true;
            if (/^(?:tgl\s*\.?|tanggal|inv\s*\.?|invoice|po\s*\.?|no\s*po)\s*[:\-]?$/i.test(s)) return true;
            if (/^(?:dibuat oleh|dikirim oleh|diterima oleh|pemberi kerja|mengetahui)\b/i.test(s)) return true;
            if (/^(?:telp\s*\.?|fax\s*\.?|phone|telepon)\b/i.test(s) || /^\d{3,4}\s*-\s*\d+$/.test(s) || s === '-') return true;
            if (/^kepada\s*(?:yth)?\s*[,:\-]*$/i.test(s)) return true;
            if (s.includes('pasar minggu') || s.includes('duren tiga') || s.includes('021-') || s.includes('021 -')) return true;
            if (s.includes('crystal reports') || s.includes('crystal decisions') || s.startsWith('tahoma;') || s.includes('powered by')) return true;
            return false;
        }

        function cleanRtfText(str) {
            if (!str) return "";
            let s = str.replace(/\\u(-?\d+)\??/g, (m, code) => {
                const c = parseInt(code, 10);
                return String.fromCharCode(c < 0 ? c + 65536 : c);
            });
            s = s.replace(/\\'([0-9a-fA-F]{2})/g, (m, hex) => {
                return String.fromCharCode(parseInt(hex, 16));
            });
            s = s.replace(/\\(?:par|line|cell|row)\b/gi, "\n");
            s = s.replace(/\\[a-zA-Z*]+-?\d*\s?/g, " ");
            s = s.replace(/\\[~_\-]/g, " ");
            s = s.replace(/[{}]/g, "");
            return s.replace(/[ \t]+/g, " ").trim();
        }

        function isItemsTable(tbl) {
            if (!tbl || tbl.length < 2) return false;
            let hasHeader = false;
            for (let r = 0; r < Math.min(tbl.length, 4); r++) {
                const rowStr = tbl[r].map(c => (c || '').toLowerCase().trim()).join(' ');
                const hasBarang = rowStr.includes('nama barang') || rowStr.includes('barang') || rowStr.includes('produk') || rowStr.includes('item') || rowStr.includes('deskripsi');
                const hasQtyOrUk = rowStr.includes('qty') || rowStr.includes('jumlah') || rowStr.includes('ukuran') || rowStr.includes('dimensi') || rowStr.includes('pcs');
                if (hasBarang && hasQtyOrUk) {
                    hasHeader = true;
                    break;
                }
            }
            const fullText = tbl.map(r => r.join(' ')).join(' ').toLowerCase();
            const isHeaderTable = fullText.includes('kepada yth') || fullText.includes('jalan raya pasar minggu') || fullText.includes('duren tiga');
            return hasHeader && !isHeaderTable;
        }

        function extractItemsFromTable(tbl) {
            const items = [];
            let detectedTotal = 0;
            if (!tbl || tbl.length < 2) return { items, detectedTotal };

            let headerIdx = -1;
            let colMap = { no: -1, barang: -1, ukuran: -1, qty: -1 };

            for (let r = 0; r < Math.min(tbl.length, 5); r++) {
                const lower = tbl[r].map(c => (c || '').toLowerCase().trim());
                const hasBarang = lower.some(c => c.includes('nama barang') || c.includes('barang') || c.includes('produk') || c.includes('item') || c.includes('deskripsi'));
                const hasQty = lower.some(c => c.includes('qty') || c.includes('jumlah') || c.includes('banyak') || c.includes('koli') || c.includes('pcs'));
                if (hasBarang || hasQty) {
                    headerIdx = r;
                    lower.forEach((c, idx) => {
                        if (c === 'no' || c === 'no.' || c.includes('nomor')) colMap.no = idx;
                        else if (c.includes('nama barang') || c.includes('barang') || c.includes('produk') || c.includes('item') || c.includes('deskripsi')) colMap.barang = idx;
                        else if (c.includes('ukuran') || c.includes('dimensi') || c.includes('size')) colMap.ukuran = idx;
                        else if (c.includes('qty') || c.includes('jumlah') || c.includes('banyak') || c.includes('koli') || c.includes('pcs')) colMap.qty = idx;
                    });
                    break;
                }
            }

            if (colMap.barang === -1) colMap.barang = 1;
            if (colMap.ukuran === -1) colMap.ukuran = 2;
            if (colMap.qty === -1) colMap.qty = tbl[0] && tbl[0].length >= 4 ? 3 : tbl[0].length - 1;

            const startRow = headerIdx >= 0 ? headerIdx + 1 : 0;
            for (let r = startRow; r < tbl.length; r++) {
                const row = tbl[r];
                if (!row || row.every(c => !c || !c.trim())) continue;

                const rowStr = row.join(' ').toLowerCase();
                if (rowStr.includes('total') || rowStr.includes('jumlah')) {
                    for (const c of row) {
                        const n = parseInt((c || '').replace(/[^0-9]/g, ''), 10);
                        if (!isNaN(n) && n > 0) detectedTotal = n;
                    }
                    continue;
                }

                const barang = (row[colMap.barang] || '').trim();
                const ukuran = (row[colMap.ukuran] || '-').trim();
                const qtyRaw = (row[colMap.qty] || '1').trim();

                if (isReservedHeaderWord(barang)) continue;
                if (!barang && !ukuran && (!qtyRaw || qtyRaw === '1')) continue;

                const qtyNum = parseInt(qtyRaw.replace(/[^0-9]/g, ''), 10) || 1;
                const qtyFormatted = qtyRaw.toLowerCase().includes('pcs') || qtyRaw.toLowerCase().includes('lembar') || qtyRaw.toLowerCase().includes('set') ? qtyRaw : `${qtyNum} Pcs`;

                items.push({
                    no: colMap.no >= 0 ? (row[colMap.no] || '').trim() : String(items.length + 1),
                    nama: barang || 'Item Cetakan',
                    ukuran: ukuran || '-',
                    qty: qtyFormatted,
                    qtyNum: qtyNum
                });
            }

            if (!detectedTotal) {
                detectedTotal = items.reduce((sum, it) => sum + (it.qtyNum || 1), 0);
            }

            return { items, detectedTotal };
        }

        function extractCustomerAndAddress(lines) {
            let clientName = '';
            let addressLines = [];

            // 1. Cari baris No. Surat Jalan (misal: "SJ - 1126 - 00248" atau "SJ-1126-00222")
            let sjIdx = -1;
            for (let i = 0; i < lines.length; i++) {
                if (/\b(?:SJ\s*[-_/\s]*\d{3,}[-_/\s]*\d+)\b/i.test(lines[i])) {
                    sjIdx = i;
                    break;
                }
            }

            if (sjIdx !== -1) {
                let cur = sjIdx + 1;
                while (cur < lines.length && (!lines[cur] || isReservedHeaderWord(lines[cur]))) {
                    cur++;
                }
                if (cur < lines.length && !isReservedHeaderWord(lines[cur])) {
                    clientName = lines[cur];
                    for (let j = cur + 1; j < Math.min(cur + 8, lines.length); j++) {
                        const al = lines[j];
                        if (isReservedHeaderWord(al)) break;
                        if (/^(?:nama barang|no\b|ukuran|qty|total|tgl)/i.test(al)) break;
                        addressLines.push(al);
                    }
                }
            }

            // 2. Jika belum ketemu dari SJ, cari dari pola "Kepada Yth"
            if (!clientName) {
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (/kepada\s*(?:yth)?/i.test(line)) {
                        const inline = line.replace(/^.*?kepada\s*(?:yth)?\s*[:\-,]?\s*/i, '').trim();
                        let startIdx = i + 1;
                        if (inline.length > 2 && !isReservedHeaderWord(inline)) {
                            clientName = inline;
                        } else {
                            while (startIdx < lines.length && (!lines[startIdx] || isReservedHeaderWord(lines[startIdx]))) {
                                startIdx++;
                            }
                            if (startIdx < lines.length && !isReservedHeaderWord(lines[startIdx])) {
                                clientName = lines[startIdx];
                                startIdx++;
                            }
                        }
                        for (let j = startIdx; j < Math.min(startIdx + 8, lines.length); j++) {
                            const al = lines[j];
                            if (isReservedHeaderWord(al)) break;
                            if (/^(?:nama barang|no\b|ukuran|qty|total|tgl)/i.test(al)) break;
                            addressLines.push(al);
                        }
                        break;
                    }
                }
            }

            // 3. Fallback: baris dengan nama PT/CV/PAK/IBU/BAPAK/(...)
            if (!clientName) {
                for (let i = 0; i < lines.length; i++) {
                    const l = lines[i];
                    if (isReservedHeaderWord(l)) continue;
                    if (/\b(?:PT|CV|UD|TBK)\b/i.test(l) || /^(?:PAK|IBU|BAPAK)\b/i.test(l) || /\([^)]+\)/.test(l)) {
                        clientName = l;
                        for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
                            const al = lines[j];
                            if (isReservedHeaderWord(al)) break;
                            if (/^(?:nama barang|no\b|ukuran|qty|total|tgl)/i.test(al)) break;
                            addressLines.push(al);
                        }
                        break;
                    }
                }
            }

            const address = addressLines.join(', ').replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim();
            return { clientName, address };
        }

        // 0. Deteksi apakah file berformat RTF (Rich Text Format - format ekspor Crystal Reports / .doc)
        const headerBytes = new Uint8Array(arrayBuffer.slice(0, 500));
        let headerSnippet = '';
        try {
            headerSnippet = new TextDecoder('utf-8').decode(headerBytes);
        } catch(e) {
            headerSnippet = '';
        }
        const isRtf = headerSnippet.includes('{\\rtf') || headerSnippet.startsWith('{\\rtf');

        if (isRtf) {
            try {
                let fullRtf = '';
                try {
                    fullRtf = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer));
                } catch(e) {
                    fullRtf = new TextDecoder('windows-1252').decode(new Uint8Array(arrayBuffer));
                }

                let docTitle = "";
                const titleM = fullRtf.match(/\\title\s+([^}]+)/i);
                if (titleM) docTitle = titleM[1].trim();

                let cleanText = fullRtf.replace(/\{\\\*(?:fonttbl|colortbl|stylesheet|info|generator|latentstyles)[^}]*\}/gi, "");
                cleanText = cleanText.replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|generator|latentstyles)[^}]*\}/gi, "");
                cleanText = cleanText.replace(/\{\\pict[\s\S]*?\}/gi, "");
                cleanText = cleanRtfText(cleanText);

                const lines = cleanText.split("\n")
                    .map(l => l.replace(/\s+/g, " ").trim())
                    .filter(l => l && !l.startsWith("shapeType") && !l.startsWith("txflTextFlow"));

                let sjNumber = "";
                let clientName = "";
                let address = "";
                let invNumber = "";
                let poNumber = "";
                let picName = "";
                let dateStr = "";
                let totalQty = 0;
                const items = [];
                const itemMap = new Map();

                const wppM = cleanText.match(/\b(WPP\s*[-_0-9]+)\b/i);
                if (wppM) invNumber = wppM[1].replace(/\s+/g, ' ');

                const smartCustomer = extractCustomerAndAddress(lines);
                if (smartCustomer.clientName) clientName = smartCustomer.clientName;
                if (smartCustomer.address) address = smartCustomer.address;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];

                    if (!sjNumber) {
                        const sjM = line.match(/\b(SJ\s*[-_/\s]*\d{3,}[-_/\s]*\d+)\b/i) || line.match(/\b(SJ[-_/\s0-9A-Za-z]+)\b/i);
                        if (sjM && sjM[1].length >= 5) {
                            sjNumber = sjM[1].replace(/\s+/g, '');
                            if (!sjNumber.startsWith('SJ-') && sjNumber.startsWith('SJ')) {
                                sjNumber = sjNumber.replace(/^SJ/, 'SJ-');
                            }
                        }
                    }

                    if (!clientName && /\b(?:PT|CV|UD|TBK)\b/i.test(line) && !isReservedHeaderWord(line)) {
                        clientName = line;
                        if (lines[i + 1] && !isReservedHeaderWord(lines[i + 1])) {
                            address = lines[i + 1];
                        }
                    }

                    if (!clientName && /kepada\s*(?:yth)?/i.test(line)) {
                        const inline = line.replace(/^.*?kepada\s*(?:yth)?\s*[:\-]?\s*/i, '').trim();
                        if (inline && !isReservedHeaderWord(inline)) {
                            clientName = inline;
                            if (lines[i + 1] && !isReservedHeaderWord(lines[i + 1])) address = lines[i + 1];
                        }
                    }

                    if (line.toLowerCase() === 'total' || line.toLowerCase().startsWith('total')) {
                        const numM = (lines[i + 1] || '').match(/(\d+)/);
                        if (numM) totalQty = parseInt(numM[1], 10);
                    }

                    if (line.toLowerCase() === 'dibuat oleh') {
                        if (lines[i + 2] && !lines[i + 2].includes('(') && lines[i + 2].length < 30) {
                            picName = lines[i + 2];
                        }
                    }

                    if (line.toLowerCase() === 'tgl') {
                        if (lines[i + 1] && /\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/.test(lines[i + 1])) {
                            dateStr = lines[i + 1];
                        }
                    }

                    // Deteksi item: Baris nomor (1..99) diawali nama barang, diikuti ukuran, lalu qty (~1~)
                    const numMatch = line.match(/^(\d{1,3})$/);
                    if (numMatch && i > 0 && i + 2 < lines.length) {
                        const noVal = parseInt(numMatch[1], 10);
                        const namaBarangCandidate = lines[i - 1];
                        const ukuranCandidate = lines[i + 1];
                        const qtyCandidate = lines[i + 2];

                        const isUkuran = /[\d.,]+\s*[xX*]\s*[\d.,]+/.test(ukuranCandidate) || ukuranCandidate === "-";
                        const qtyMatch = qtyCandidate.match(/~?\s*(\d+)\s*~?/);

                        if (isUkuran && qtyMatch && !isReservedHeaderWord(namaBarangCandidate)) {
                            const qtyVal = parseInt(qtyMatch[1], 10);
                            const itemKey = `${noVal}_${namaBarangCandidate}`;
                            if (!itemMap.has(itemKey)) {
                                itemMap.set(itemKey, true);
                                items.push({
                                    no: String(noVal),
                                    nama: namaBarangCandidate,
                                    ukuran: ukuranCandidate.replace(/\s+/g, " "),
                                    qty: `${qtyVal} Pcs`,
                                    qtyNum: qtyVal
                                });
                            }
                        }
                    }
                }

                if (!totalQty && items.length > 0) {
                    totalQty = items.reduce((acc, it) => acc + (it.qtyNum || 1), 0);
                }

                const finalClient = clientName || 'Customer / Klien';
                const finalAddress = address || (docTitle ? docTitle.split('_')[0].trim() : `Alamat Kirim ${finalClient}`);
                const reg = detectRegion(finalAddress, finalClient);
                const shortCode = generateUniqueCode();
                const finalSjNumber = sjNumber || `SJ/${todayDate.getFullYear()}/0001`;
                const isCikokol = reg === 'Tangerang';

                const formattedQty = `${totalQty || (items.length || 1)} Pcs`;
                const mainBarang = items.length === 1 ? items[0].nama : `${items.length} Items Cetakan (Total ${formattedQty})`;
                const mainUkuran = items.length === 1 ? items[0].ukuran : (items.length > 0 ? 'Multi Ukuran' : '-');

                const itemsSummary = items.length > 0 ? 
                    items.map(it => `${it.no ? it.no + '. ' : ''}${it.nama} (Uk: ${it.ukuran} | Qty: ${it.qty})`).join(' | ') :
                    mainBarang;

                normalizedRows.push({
                    rowIndex: 1,
                    sjNumber: finalSjNumber,
                    shortCode: shortCode,
                    clientName: finalClient,
                    customer: finalClient,
                    address: finalAddress,
                    region: reg,
                    namaBarang: mainBarang,
                    ukuran: mainUkuran,
                    qty: formattedQty,
                    finishing: '-',
                    itemsSummary: itemsSummary,
                    picPhone: picName || '0812-9876-5432',
                    originBranch: isCikokol ? 'cikokol' : 'pusat',
                    deadline: '17:00 WIB',
                    spkNumber: invNumber || `SPK-${shortCode}`,
                    dateFolder: defaultDateFolder,
                    machine: 'Digital Print',
                    items: items,
                    sourceFile: file.name,
                    sourceType: 'word_rtf'
                });

                return normalizedRows;
            } catch (rtfErr) {
                console.warn("Gagal parsing RTF:", rtfErr);
            }
        }

        // 1. Coba ekstraksi raw XML menggunakan engine native (.docx)
        let xmlText = '';
        try {
            xmlText = await extractDocxXml(arrayBuffer);
        } catch (extractErr) {
            console.warn("Ekstraksi XML native gagal, memeriksa alternatif:", extractErr);
        }

        if (xmlText) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

            const getXmlNodeText = (node) => {
                if (!node) return '';
                const tElements = node.getElementsByTagNameNS ? 
                    (node.getElementsByTagNameNS('*', 't') || node.getElementsByTagName('w:t')) : 
                    node.getElementsByTagName('w:t');
                let result = '';
                for (let i = 0; i < tElements.length; i++) {
                    result += tElements[i].textContent || '';
                }
                return result.replace(/[\s\r\t]+/g, ' ').trim();
            };

            const bodyNode = xmlDoc.getElementsByTagName('w:body')[0] || 
                             xmlDoc.getElementsByTagNameNS('*', 'body')[0] || 
                             xmlDoc.documentElement;

            const childNodes = Array.from(bodyNode.children || []);
            const docElements = [];

            childNodes.forEach(child => {
                const nodeName = (child.nodeName || '').toLowerCase();
                if (nodeName.endsWith('p')) {
                    const txt = getXmlNodeText(child);
                    if (txt) docElements.push({ type: 'p', text: txt });
                } else if (nodeName.endsWith('tbl')) {
                    const trElements = Array.from(child.children || []).filter(c => (c.nodeName || '').toLowerCase().endsWith('tr'));
                    const tableRows = [];
                    trElements.forEach(tr => {
                        const tcElements = Array.from(tr.children || []).filter(c => (c.nodeName || '').toLowerCase().endsWith('tc'));
                        const cellLines = tcElements.map(tc => {
                            const pInCell = Array.from(tc.children || []).filter(c => (c.nodeName || '').toLowerCase().endsWith('p'));
                            if (pInCell.length > 1) {
                                return pInCell.map(p => getXmlNodeText(p)).filter(Boolean).join('\n');
                            }
                            return getXmlNodeText(tc);
                        });
                        if (cellLines.some(c => c)) {
                            tableRows.push(cellLines);
                        }
                    });
                    if (tableRows.length > 0) {
                        docElements.push({ type: 'tbl', rows: tableRows });
                    }
                }
            });

            const allItemTables = docElements.filter(el => el.type === 'tbl' && isItemsTable(el.rows));

            if (allItemTables.length <= 1) {
                const allLines = [];
                let itemsTable = allItemTables[0] ? allItemTables[0].rows : null;

                docElements.forEach(el => {
                    if (el.type === 'p') {
                        allLines.push(el.text);
                    } else if (el.type === 'tbl') {
                        if (!itemsTable && isItemsTable(el.rows)) {
                            itemsTable = el.rows;
                        } else if (el.rows !== itemsTable) {
                            el.rows.forEach(r => r.forEach(c => c.split('\n').forEach(l => {
                                const cl = l.trim();
                                if (cl) allLines.push(cl);
                            })));
                        }
                    }
                });

                let sjNumber = '';
                let invNumber = '';
                let poNumber = '';
                let dateStr = '';
                let picName = '';

                for (let i = 0; i < allLines.length; i++) {
                    const l = allLines[i];
                    if (!sjNumber) {
                        const sjM = l.match(/\b(SJ[-_/\s]*\d{3,}[-_/\s]*\d+)\b/i) || l.match(/\b(SJ[-_/\s0-9A-Za-z]+)\b/i);
                        if (sjM && sjM[1].length >= 5) sjNumber = sjM[1].replace(/\s+/g, '-');
                    }
                    const tglM = l.match(/tgl\s*[:\-]\s*(.+)/i);
                    if (tglM) dateStr = tglM[1].trim();
                    const invM = l.match(/inv\s*[:\-]\s*(.+)/i);
                    if (invM) invNumber = invM[1].trim();
                    const poM = l.match(/po\s*[:\-]\s*(.+)/i);
                    if (poM) poNumber = poM[1].trim();
                    const picM = l.match(/dibuat\s*oleh\s*\(?\s*([A-Za-z0-9\s]+?)\s*\)?$/i);
                    if (picM) picName = picM[1].trim();
                }

                const custAddr = extractCustomerAndAddress(allLines);
                const tableRes = extractItemsFromTable(itemsTable);
                const items = tableRes.items;
                const detectedTotal = tableRes.detectedTotal;

                const finalClient = custAddr.clientName || 'Customer / Klien';
                const finalAddress = custAddr.address || `Alamat Kirim ${finalClient}`;
                const reg = detectRegion(finalAddress, finalClient);
                const shortCode = generateUniqueCode();
                const finalSjNumber = sjNumber || `SJ/${todayDate.getFullYear()}/0001`;
                const isCikokol = reg === 'Tangerang';

                const formattedQty = `${detectedTotal || (items.length || 1)} Pcs`;
                const mainBarang = items.length === 1 ? items[0].nama : `${items.length} Items Cetakan (Total ${formattedQty})`;
                const mainUkuran = items.length === 1 ? items[0].ukuran : (items.length > 0 ? 'Multi Ukuran' : '-');

                const itemsSummary = items.length > 0 ? 
                    items.map(it => `${it.no ? it.no + '. ' : ''}${it.nama} (Uk: ${it.ukuran} | Qty: ${it.qty})`).join(' | ') :
                    mainBarang;

                normalizedRows.push({
                    rowIndex: 1,
                    sjNumber: finalSjNumber,
                    shortCode: shortCode,
                    clientName: finalClient,
                    customer: finalClient,
                    address: finalAddress,
                    region: reg,
                    namaBarang: mainBarang,
                    ukuran: mainUkuran,
                    qty: formattedQty,
                    finishing: '-',
                    itemsSummary: itemsSummary,
                    picPhone: picName || '0812-9876-5432',
                    originBranch: isCikokol ? 'cikokol' : 'pusat',
                    deadline: '17:00 WIB',
                    spkNumber: invNumber || `SPK-${shortCode}`,
                    dateFolder: defaultDateFolder,
                    machine: 'Digital Print',
                    items: items,
                    sourceFile: file.name,
                    sourceType: 'word_docx'
                });

                return normalizedRows;
            } else {
                // Multi SJ dalam 1 file .docx
                let currentLines = [];
                let currentItemTable = null;

                docElements.forEach(elem => {
                    if (elem.type === 'tbl' && isItemsTable(elem.rows)) {
                        if (currentItemTable) {
                            // Selesaikan section sebelumnya
                            buildSectionRow(currentLines, currentItemTable);
                            currentLines = [];
                        }
                        currentItemTable = elem.rows;
                    } else if (elem.type === 'p') {
                        currentLines.push(elem.text);
                    } else if (elem.type === 'tbl') {
                        elem.rows.forEach(r => r.forEach(c => c.split('\n').forEach(l => {
                            const cl = l.trim();
                            if (cl) currentLines.push(cl);
                        })));
                    }
                });

                if (currentItemTable) {
                    buildSectionRow(currentLines, currentItemTable);
                }

                function buildSectionRow(lines, tbl) {
                    let sjNumber = '';
                    let invNumber = '';
                    let picName = '';

                    for (const l of lines) {
                        if (!sjNumber) {
                            const sjM = l.match(/\b(SJ[-_/\s]*\d{3,}[-_/\s]*\d+)\b/i) || l.match(/\b(SJ[-_/\s0-9A-Za-z]+)\b/i);
                            if (sjM && sjM[1].length >= 5) sjNumber = sjM[1].replace(/\s+/g, '-');
                        }
                        const invM = l.match(/inv\s*[:\-]\s*(.+)/i);
                        if (invM) invNumber = invM[1].trim();
                        const picM = l.match(/dibuat\s*oleh\s*\(?\s*([A-Za-z0-9\s]+?)\s*\)?$/i);
                        if (picM) picName = picM[1].trim();
                    }

                    const custAddr = extractCustomerAndAddress(lines);
                    const tableRes = extractItemsFromTable(tbl);
                    const items = tableRes.items;
                    const detectedTotal = tableRes.detectedTotal;

                    const finalClient = custAddr.clientName || 'Customer / Klien';
                    const finalAddress = custAddr.address || `Alamat Kirim ${finalClient}`;
                    const reg = detectRegion(finalAddress, finalClient);
                    const shortCode = generateUniqueCode();
                    const finalSjNumber = sjNumber || `SJ/${todayDate.getFullYear()}/${String(normalizedRows.length + 1).padStart(4, '0')}`;
                    const isCikokol = reg === 'Tangerang';

                    const formattedQty = `${detectedTotal || (items.length || 1)} Pcs`;
                    const mainBarang = items.length === 1 ? items[0].nama : `${items.length} Items Cetakan (Total ${formattedQty})`;
                    const mainUkuran = items.length === 1 ? items[0].ukuran : (items.length > 0 ? 'Multi Ukuran' : '-');

                    normalizedRows.push({
                        rowIndex: normalizedRows.length + 1,
                        sjNumber: finalSjNumber,
                        shortCode: shortCode,
                        clientName: finalClient,
                        customer: finalClient,
                        address: finalAddress,
                        region: reg,
                        namaBarang: mainBarang,
                        ukuran: mainUkuran,
                        qty: formattedQty,
                        finishing: '-',
                        itemsSummary: items.length > 0 ? items.map(it => `${it.no ? it.no + '. ' : ''}${it.nama} (Uk: ${it.ukuran} | Qty: ${it.qty})`).join(' | ') : mainBarang,
                        picPhone: picName || '0812-9876-5432',
                        originBranch: isCikokol ? 'cikokol' : 'pusat',
                        deadline: '17:00 WIB',
                        spkNumber: invNumber || `SPK-${shortCode}`,
                        dateFolder: defaultDateFolder,
                        machine: 'Digital Print',
                        items: items,
                        sourceFile: file.name,
                        sourceType: 'word_docx'
                    });
                }

                if (normalizedRows.length > 0) return normalizedRows;
            }
        }

        // 3. Fallback jika file Word adalah format HTML yang dinamai .doc / .docx
        if (normalizedRows.length === 0) {
            try {
                const sampleSnippet = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer.slice(0, 10000)));
                if (sampleSnippet.includes('<table') || sampleSnippet.includes('<html') || sampleSnippet.includes('<body') || sampleSnippet.trim().startsWith('<')) {
                    const fullHtml = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer));
                    const htmlDoc = new DOMParser().parseFromString(fullHtml, 'text/html');
                    const allLines = Array.from(htmlDoc.querySelectorAll('p, div, h1, h2, h3, h4, span, b, strong, td, th'))
                                         .map(el => (el.textContent || '').trim()).filter(Boolean);

                    let sjNumber = '';
                    let invNumber = '';
                    let picName = '';

                    for (let i = 0; i < allLines.length; i++) {
                        const l = allLines[i];
                        if (!sjNumber) {
                            const sjM = l.match(/\b(SJ[-_/\s]*\d{3,}[-_/\s]*\d+)\b/i) || l.match(/\b(SJ[-_/\s0-9A-Za-z]+)\b/i);
                            if (sjM && sjM[1].length >= 5) sjNumber = sjM[1].replace(/\s+/g, '-');
                        }
                        const invM = l.match(/inv\s*[:\-]\s*(.+)/i);
                        if (invM) invNumber = invM[1].trim();
                        const picM = l.match(/dibuat\s*oleh\s*\(?\s*([A-Za-z0-9\s]+?)\s*\)?$/i);
                        if (picM) picName = picM[1].trim();
                    }

                    const custAddr = extractCustomerAndAddress(allLines);
                    const htmlTables = Array.from(htmlDoc.querySelectorAll('table'));
                    const tableRows = [];
                    if (htmlTables.length > 0) {
                        const tbl = htmlTables[0];
                        Array.from(tbl.querySelectorAll('tr')).forEach(tr => {
                            tableRows.push(Array.from(tr.querySelectorAll('td, th')).map(c => (c.textContent || '').trim()));
                        });
                    }

                    const tableRes = extractItemsFromTable(tableRows);
                    const items = tableRes.items;
                    const detectedTotal = tableRes.detectedTotal;

                    const finalClient = custAddr.clientName || 'Customer / Klien';
                    const finalAddress = custAddr.address || `Alamat Kirim ${finalClient}`;
                    const reg = detectRegion(finalAddress, finalClient);
                    const shortCode = generateUniqueCode();
                    const finalSj = sjNumber || `SJ/${todayDate.getFullYear()}/0001`;
                    const isCikokol = reg === 'Tangerang';

                    normalizedRows.push({
                        rowIndex: 1,
                        sjNumber: finalSj,
                        shortCode: shortCode,
                        clientName: finalClient,
                        customer: finalClient,
                        address: finalAddress,
                        region: reg,
                        namaBarang: items.length === 1 ? items[0].nama : `${items.length} Items Cetakan (Total ${detectedTotal} Pcs)`,
                        ukuran: items.length === 1 ? items[0].ukuran : (items.length > 0 ? 'Multi Ukuran' : '-'),
                        qty: `${detectedTotal || 1} Pcs`,
                        finishing: '-',
                        itemsSummary: items.length > 0 ? items.map(it => `${it.no ? it.no + '. ' : ''}${it.nama} (Uk: ${it.ukuran} | Qty: ${it.qty})`).join(' | ') : 'Barang Cetakan',
                        picPhone: picName || '0812-9876-5432',
                        originBranch: isCikokol ? 'cikokol' : 'pusat',
                        deadline: '17:00 WIB',
                        spkNumber: invNumber || `SPK-${shortCode}`,
                        dateFolder: defaultDateFolder,
                        machine: 'Digital Print',
                        items: items,
                        sourceFile: file.name,
                        sourceType: 'word_html'
                    });

                    return normalizedRows;
                }
            } catch (htmlErr) {
                console.warn("HTML word parsing error:", htmlErr);
            }
        }

        // 4. Fallback Binary OLE2 (.doc format lama Word 97-2003)
        if (normalizedRows.length === 0) {
            try {
                const uint8 = new Uint8Array(arrayBuffer);
                const rawStrings = [];
                let curUtf16 = '';
                for (let i = 0; i < uint8.length - 1; i += 2) {
                    const code = uint8[i] | (uint8[i + 1] << 8);
                    if (code === 10 || code === 13) {
                        if (curUtf16.trim().length >= 3) rawStrings.push(curUtf16.trim());
                        curUtf16 = '';
                    } else if (code >= 32 && code <= 126) {
                        curUtf16 += String.fromCharCode(code);
                    } else {
                        if (curUtf16.trim().length >= 3) rawStrings.push(curUtf16.trim());
                        curUtf16 = '';
                    }
                }
                if (curUtf16.trim().length >= 3) rawStrings.push(curUtf16.trim());

                let curAscii = '';
                for (let i = 0; i < uint8.length; i++) {
                    const c = uint8[i];
                    if (c === 10 || c === 13) {
                        if (curAscii.trim().length >= 3) rawStrings.push(curAscii.trim());
                        curAscii = '';
                    } else if (c >= 32 && c <= 126) {
                        curAscii += String.fromCharCode(c);
                    } else {
                        if (curAscii.trim().length >= 3) rawStrings.push(curAscii.trim());
                        curAscii = '';
                    }
                }
                if (curAscii.trim().length >= 3) rawStrings.push(curAscii.trim());

                if (rawStrings.length > 0) {
                    let sjNumber = '';
                    let invNumber = '';
                    let picName = '';
                    let totalQty = '';

                    for (let i = 0; i < rawStrings.length; i++) {
                        const s = rawStrings[i];
                        if (!sjNumber) {
                            const sjM = s.match(/\b(SJ[-_/\s]*\d{3,}[-_/\s]*\d+)\b/i) || s.match(/\b(SJ[-_/\s0-9A-Za-z]+)\b/i);
                            if (sjM && sjM[1].length >= 5) sjNumber = sjM[1].replace(/\s+/g, '-');
                        }
                        if (s.toLowerCase().includes('total')) {
                            const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
                            if (!isNaN(n) && n > 0) totalQty = `${n} Pcs`;
                        }
                        const invM = s.match(/inv\s*[:\-]\s*(.+)/i);
                        if (invM) invNumber = invM[1].trim();
                        const picM = s.match(/dibuat\s*oleh\s*\(?\s*([A-Za-z0-9\s]+?)\s*\)?$/i);
                        if (picM) picName = picM[1].trim();
                    }

                    const custAddr = extractCustomerAndAddress(rawStrings);
                    if (sjNumber || custAddr.clientName) {
                        const finalClient = custAddr.clientName || 'Customer Word .DOC';
                        const finalAddress = custAddr.address || `Alamat Kirim ${finalClient}`;
                        const reg = detectRegion(finalAddress, finalClient);
                        const shortCode = generateUniqueCode();
                        const isCikokol = reg === 'Tangerang';

                        normalizedRows.push({
                            rowIndex: 1,
                            sjNumber: sjNumber || `SJ/${todayDate.getFullYear()}/0001`,
                            shortCode: shortCode,
                            clientName: finalClient,
                            customer: finalClient,
                            address: finalAddress,
                            region: reg,
                            namaBarang: 'Dokumen Surat Jalan Cetakan',
                            ukuran: '-',
                            qty: totalQty || '1 Pcs',
                            finishing: '-',
                            itemsSummary: `Dokumen Surat Jalan: ${sjNumber || '-'} | Alamat: ${finalAddress}`,
                            picPhone: picName || '0812-9876-5432',
                            originBranch: isCikokol ? 'cikokol' : 'pusat',
                            deadline: '17:00 WIB',
                            spkNumber: invNumber || `SPK-${shortCode}`,
                            dateFolder: defaultDateFolder,
                            machine: 'Digital Print',
                            sourceFile: file.name,
                            sourceType: 'word_binary_doc'
                        });

                        return normalizedRows;
                    }
                }
            } catch (oleErr) {
                console.warn("OLE2 binary doc parsing error:", oleErr);
            }
        }

        // 5. Fallback Mammoth jika XML parsing belum menghasilkan baris
        if (normalizedRows.length === 0 && typeof mammoth !== 'undefined' && mammoth.convertToHtml) {
            try {
                const res = await mammoth.convertToHtml({ arrayBuffer });
                if (res && res.value) {
                    const htmlDoc = new DOMParser().parseFromString(res.value, 'text/html');
                    const text = htmlDoc.body.textContent || '';
                    const sjM = text.match(/\b(SJ[-_/\s0-9A-Za-z]+)\b/i);
                    const sjNumber = sjM ? sjM[1] : `SJ/${todayDate.getFullYear()}/0001`;
                    const shortCode = generateUniqueCode();

                    normalizedRows.push({
                        rowIndex: 1,
                        sjNumber: sjNumber,
                        shortCode: shortCode,
                        clientName: 'Customer Word',
                        customer: 'Customer Word',
                        address: 'Alamat Tujuan Jabodetabek',
                        region: 'Jakarta Pusat',
                        namaBarang: 'Dokumen Surat Jalan Word',
                        ukuran: '-',
                        qty: '1 Pcs',
                        finishing: '-',
                        itemsSummary: 'Dokumen Cetakan Word',
                        picPhone: '0812-9876-5432',
                        originBranch: 'pusat',
                        deadline: '17:00 WIB',
                        spkNumber: `SPK-${shortCode}`,
                        dateFolder: defaultDateFolder,
                        machine: 'Digital Print',
                        sourceFile: file.name,
                        sourceType: 'word_mammoth'
                    });

                    return normalizedRows;
                }
            } catch (mErr) {
                console.warn("Mammoth fallback error:", mErr);
            }
        }

        if (normalizedRows.length === 0) {
            throw new Error(`File Word "${file.name}" tidak dapat diparse atau tidak berisi data Surat Jalan yang valid!`);
        }

        return normalizedRows;
    }

    let currentPreviewRows = [];

    // Filter baris preview secara real-time
    function filterPreviewTable(query) {
        const q = (query || '').toLowerCase().trim();
        const tbody = document.getElementById('sj-import-preview-tbody');
        if (!tbody) return;

        const filtered = q ? currentPreviewRows.filter(r => 
            (r.sjNumber || '').toLowerCase().includes(q) ||
            (r.clientName || '').toLowerCase().includes(q) ||
            (r.customer || '').toLowerCase().includes(q) ||
            (r.address || '').toLowerCase().includes(q) ||
            (r.region || '').toLowerCase().includes(q)
        ) : currentPreviewRows;

        renderPreviewRows(filtered);
    }

    function renderPreviewRows(rowsToRender) {
        const tbody = document.getElementById('sj-import-preview-tbody');
        if (!tbody) return;

        if (rowsToRender.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-5 text-muted" style="font-size: 0.85rem;">Tidak ada Surat Jalan yang sesuai dengan filter pencarian.</td></tr>`;
            return;
        }

        tbody.innerHTML = rowsToRender.map((r, i) => {
            const dataIdx = r.originalIndex !== undefined ? r.originalIndex : i;
            return `
                <tr>
                    <td class="text-center" style="width: 38px;">
                        <input type="checkbox" class="form-check-input preview-row-checkbox" data-index="${dataIdx}" checked>
                    </td>
                    <td style="width: 140px;">
                        <a class="aerotrack-id-link font-monospace">${r.sjNumber}</a>
                    </td>
                    <td style="width: 90px;">
                        <span class="aerotrack-badge font-monospace">${r.shortCode}</span>
                    </td>
                    <td style="min-width: 180px;">
                        <span class="fw-semibold text-dark text-truncate d-inline-block" style="max-width: 200px;" title="${r.clientName}">${r.clientName}</span>
                    </td>
                    <td style="min-width: 220px;">
                        <span class="text-muted text-truncate d-inline-block" style="max-width: 240px;" title="${r.address}">${r.address || '-'}</span>
                    </td>
                    <td style="width: 130px;">
                        <select class="aerotrack-select preview-region-select py-0 px-2" data-index="${dataIdx}" style="width: 125px; font-size: 0.78rem; height: 32px;">
                            ${JABODETABEK_REGIONS.map(reg => `<option value="${reg}" ${reg === r.region ? 'selected' : ''}>${reg}</option>`).join('')}
                        </select>
                    </td>
                    <td style="width: 140px;">
                        <select class="aerotrack-select preview-branch-select py-0 px-2" data-index="${dataIdx}" style="width: 135px; font-size: 0.78rem; height: 32px;">
                            <option value="pusat" ${r.originBranch === 'pusat' ? 'selected' : ''}>Pusat</option>
                            <option value="cikokol" ${r.originBranch === 'cikokol' ? 'selected' : ''}>Cikokol</option>
                        </select>
                    </td>
                    <td style="min-width: 200px;">
                        <span class="text-dark text-truncate d-inline-block" style="max-width: 220px; font-size: 0.8rem;" title="${r.namaBarang || r.itemsSummary || '-'}">
                            ${r.namaBarang || r.itemsSummary || '-'}
                        </span>
                    </td>
                    <td style="width: 110px;">
                        <span class="text-muted font-monospace" style="font-size: 0.78rem;">${r.ukuran || '-'}</span>
                    </td>
                    <td class="text-end" style="width: 80px;">
                        <span class="aerotrack-num">${r.qty || '1 Pcs'}</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Render Preview Modal (AeroTrack ERP UI Style)
    function openImportPreviewModal(rows) {
        const modalEl = document.getElementById('modal-sj-import-preview');
        if (!modalEl) {
            console.error("Modal preview import tidak ditemukan di DOM!");
            return;
        }

        const countBadge = document.getElementById('sj-import-count-badge');
        const regionBreakdownEl = document.getElementById('sj-import-region-breakdown');

        if (countBadge) countBadge.innerText = `${rows.length} Surat Jalan`;

        currentPreviewRows = rows.map((r, i) => ({ ...r, originalIndex: i }));

        // Hitung rekapitulasi Region
        const regCounts = {};
        rows.forEach(r => {
            regCounts[r.region] = (regCounts[r.region] || 0) + 1;
        });

        if (regionBreakdownEl) {
            regionBreakdownEl.innerHTML = `
                <span class="text-muted extra-small me-1"><i class="bi bi-geo-alt me-1"></i>Distribusi Wilayah:</span>
                ${Object.entries(regCounts).map(([reg, count]) => `
                    <span class="aerotrack-badge badge-primary me-1">
                        <b>${reg}:</b> ${count}
                    </span>
                `).join('')}
            `;
        }

        renderPreviewRows(currentPreviewRows);

        if (typeof bootstrap !== 'undefined') {
            const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
            bsModal.show();
        }
    }

    // Set Lokasi Print Massal di Preview
    function setBulkPrintBranch(targetBranch) {
        const checkboxes = document.querySelectorAll('.preview-row-checkbox:checked');
        if (checkboxes.length === 0) {
            alert("Pilih minimal satu Surat Jalan terlebih dahulu!");
            return;
        }
        checkboxes.forEach(cb => {
            const idx = parseInt(cb.getAttribute('data-index'), 10);
            const branchSelect = document.querySelector(`.preview-branch-select[data-index="${idx}"]`);
            if (branchSelect) branchSelect.value = targetBranch;
            if (parsedPreviewList[idx]) parsedPreviewList[idx].originBranch = targetBranch;
        });
        if (typeof window.showToast === 'function') {
            window.showToast(`${checkboxes.length} Surat Jalan diatur Print di ${targetBranch === 'cikokol' ? 'Cikokol' : 'Pusat'}.`);
        }
    }

    // Toggle Checkbox All di Preview
    function toggleAllPreview(checked) {
        document.querySelectorAll('.preview-row-checkbox').forEach(cb => cb.checked = checked);
    }

    // Simpan Data Batch Hasil Import ke Firestore / Memory
    async function commitImportBatch(alsoPrint = false) {
        const commitBtn = document.getElementById('btn-commit-import-sj');
        const printBtn = document.getElementById('btn-commit-import-and-print');
        if (commitBtn) commitBtn.disabled = true;
        if (printBtn) printBtn.disabled = true;

        const checkboxes = document.querySelectorAll('.preview-row-checkbox:checked');
        if (checkboxes.length === 0) {
            alert("Tidak ada Surat Jalan yang dicentang untuk di-import!");
            if (commitBtn) commitBtn.disabled = false;
            if (printBtn) printBtn.disabled = false;
            return;
        }

        const activeDb = (typeof window.getDb === 'function') ? window.getDb() : null;
        const todayDate = new Date();
        const dateFolder = todayDate.toISOString().slice(0, 10);
        const batchId = `BATCH_SJ_${dateFolder.replace(/-/g, '')}_${Date.now().toString().slice(-4)}`;

        const tripsToSave = [];
        const savedTripIds = [];

        checkboxes.forEach(cb => {
            const idx = parseInt(cb.getAttribute('data-index'), 10);
            const item = parsedPreviewList[idx];
            if (!item) return;

            // Baca update terakhir dari input tabel preview
            const regSel = document.querySelector(`.preview-region-select[data-index="${idx}"]`);
            const branchSel = document.querySelector(`.preview-branch-select[data-index="${idx}"]`);
            const finalRegion = regSel ? regSel.value : item.region;
            const finalBranch = branchSel ? branchSel.value : item.originBranch;

            const tripId = `TRIP_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            savedTripIds.push(tripId);

            const qrPayload = `WTRACK|SJ|${tripId}|${item.sjNumber}|${item.shortCode}`;

            const tripDoc = {
                id: tripId,
                tripId: tripId,
                noSJ: item.sjNumber,
                sjNumber: item.sjNumber,
                uniqueCode: item.shortCode,
                shortCode: item.shortCode,
                customer: item.clientName,
                clientName: item.clientName,
                address: item.address || '',
                qrPayload: qrPayload,
                batchId: batchId,
                dateFolder: dateFolder,
                date: dateFolder,
                status: 'pool', // Tetap di pool sampai di-assign admin atau di-scan kurir
                region: finalRegion,
                originBranch: finalBranch,
                branchId: finalBranch,
                printLocation: finalBranch,
                branchWorkflowStatus: (finalBranch === 'cikokol') ? 'received' : 'ready',
                jobReceivedAt: new Date().toISOString(),
                deadlineAt: item.deadline || '',
                courierId: '',
                vehicleType: 'motor',
                items: (item.items && item.items.length > 0) ? item.items : [{ nama: item.itemsSummary || 'Item Cetakan', qty: item.qty || '1 Koli' }],
                destinations: [{
                    stopIndex: 1,
                    sjNumber: item.sjNumber,
                    noSJ: item.sjNumber,
                    shortCode: item.shortCode,
                    uniqueCode: item.shortCode,
                    locationName: item.clientName,
                    customer: item.clientName,
                    address: item.address,
                    itemsSummary: item.itemsSummary || 'Item Cetakan',
                    items: item.items || [],
                    qty: item.qty || '1 Koli',
                    latitude: -6.2088,
                    longitude: 106.8456,
                    status: 'pending',
                    proofPhotoUrl: ''
                }]
            };

            tripsToSave.push(tripDoc);
        });

        try {
            let savedToCloud = false;

            // Coba simpan ke Firestore jika database aktif
            if (activeDb) {
                try {
                    const batch = activeDb.batch();
                    tripsToSave.forEach(t => {
                        const ref = activeDb.collection('trips').doc(t.id);
                        batch.set(ref, t);
                    });
                    await batch.commit();
                    savedToCloud = true;
                } catch (cloudErr) {
                    console.warn("Firestore Cloud write ditolak (izin/offline), beralih ke penyimpanan lokal:", cloudErr);
                }
            }

            // Simpan selalu ke LocalStorage agar persist antar refresh di browser
            try {
                const rawStored = localStorage.getItem('wtrack_local_trips');
                let storedTrips = rawStored ? JSON.parse(rawStored) : [];
                tripsToSave.forEach(t => {
                    if (!storedTrips.some(existing => existing.id === t.id)) {
                        storedTrips.unshift(t);
                    }
                });
                localStorage.setItem('wtrack_local_trips', JSON.stringify(storedTrips.slice(0, 500)));
            } catch (storageErr) {
                console.warn("Gagal menyimpan ke LocalStorage:", storageErr);
            }

            // Gabungkan ke window.allCurrentTrips
            if (!window.allCurrentTrips) window.allCurrentTrips = [];
            tripsToSave.forEach(t => {
                if (!window.allCurrentTrips.some(existing => existing.id === t.id)) {
                    window.allCurrentTrips.unshift(t);
                }
            });

            // Gabungkan ke allPoolTrips
            if (!window.allPoolTrips) window.allPoolTrips = [];
            tripsToSave.forEach(t => {
                if (!window.allPoolTrips.some(existing => existing.id === t.id)) {
                    window.allPoolTrips.unshift(t);
                }
            });

            // Gabungkan ke window.mockDatabase.suratJalanList
            if (!window.mockDatabase) window.mockDatabase = {};
            if (!window.mockDatabase.suratJalanList) window.mockDatabase.suratJalanList = [];
            tripsToSave.forEach(t => {
                if (!window.mockDatabase.suratJalanList.some(existing => existing.id === t.id)) {
                    window.mockDatabase.suratJalanList.unshift(t);
                }
            });

            if (typeof window.showToast === 'function') {
                window.showToast(`Berhasil mengimpor ${tripsToSave.length} Surat Jalan ke SJ Pool!`);
            }

            // Kosongkan data preview import setelah berhasil disimpan ke pool
            parsedPreviewList = [];
            currentPreviewRows = [];

            // Reset input file dan tampilan tabel import
            try {
                const excelInput = document.getElementById('sj-excel-native-input');
                if (excelInput) excelInput.value = '';
                const folderInput = document.getElementById('sj-folder-native-input');
                if (folderInput) folderInput.value = '';
                const searchInput = document.getElementById('preview-search-sj');
                if (searchInput) searchInput.value = '';
                const countBadge = document.getElementById('sj-import-count-badge');
                if (countBadge) countBadge.innerText = '0 Surat Jalan';
                const regionBreakdown = document.getElementById('sj-import-region-breakdown');
                if (regionBreakdown) regionBreakdown.innerHTML = '';
                const tbody = document.getElementById('sj-import-preview-tbody');
                if (tbody) {
                    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-5 text-muted" style="font-size: 0.85rem;">Belum ada file dipilih. Silakan pilih file Excel (.xlsx / .xls) atau Word (.docx / .doc) di atas.</td></tr>`;
                }
                const poolUploadInput = document.getElementById('pool-file-upload-input');
                if (poolUploadInput) poolUploadInput.value = '';
            } catch (clearErr) {
                console.warn("Error clearing import modal:", clearErr);
            }

            // Tutup modal preview
            const modalEl = document.getElementById('modal-sj-import-preview');
            if (modalEl && typeof bootstrap !== 'undefined') {
                const bsModal = bootstrap.Modal.getInstance(modalEl);
                if (bsModal) bsModal.hide();
            }

            // Otomatis arahkan user ke SJ Pool & Hub untuk melihat hasilnya langsung
            try {
                if (typeof window.switchTab === 'function') {
                    window.switchTab('pool');
                }
                if (typeof window.renderUnifiedPoolView === 'function') {
                    window.renderUnifiedPoolView();
                }
                if (typeof window.loadPoolTrips === 'function') {
                    window.loadPoolTrips().catch(err => console.warn("loadPoolTrips sync:", err));
                }
                if (typeof window.renderRecentShipments === 'function') window.renderRecentShipments();
                if (typeof window.updateGlobalStats === 'function') window.updateGlobalStats();
            } catch (viewErr) {
                console.warn("View refresh warning:", viewErr);
            }

            // Jika tombol simpan & buka SJ ditekan (Pusat = Preview, Cikokol = Cetak)
            if (alsoPrint && typeof window.qrPrintDispatch !== 'undefined' && window.qrPrintDispatch.printBatchSJ) {
                const hasCikokol = tripsToSave.some(t => t.originBranch === 'cikokol' || t.printLocation === 'cikokol');
                setTimeout(() => {
                    window.qrPrintDispatch.printBatchSJ(savedTripIds, hasCikokol ? 'cikokol' : 'pusat');
                }, 400);
            }

        } catch (e) {
            console.error("Gagal memproses import batch SJ:", e);
            if (tripsToSave && tripsToSave.length > 0) {
                if (typeof window.showToast === 'function') {
                    window.showToast(`✅ ${tripsToSave.length} Surat Jalan berhasil disimpan secara lokal.`);
                }
            } else {
                alert("Terjadi kesalahan saat memproses import: " + e.message);
            }
        } finally {
            if (commitBtn) commitBtn.disabled = false;
            if (printBtn) printBtn.disabled = false;
        }
    }

    // Trigger Upload File Dialog
    function triggerExcelFileInput() {
        const fileInput = document.getElementById('sj-excel-native-input') || document.getElementById('sj-excel-file-input');
        if (fileInput) fileInput.click();
    }

    // Proses Banyak File Excel & Word (Mendukung Multi-file & Folder Upload hingga 100+ File)
    async function processMultipleExcelFiles(fileList) {
        const rawFiles = Array.from(fileList || []);
        const files = rawFiles.filter(f => {
            const name = (f.name || '').toLowerCase().trim();
            if (name.startsWith('~$') || name.startsWith('.')) return false;
            return name.endsWith('.xlsx') || 
                   name.endsWith('.xls') || 
                   name.endsWith('.csv') || 
                   name.endsWith('.docx') || 
                   name.endsWith('.doc') || 
                   name.endsWith('.docm') ||
                   name.endsWith('.dotx') ||
                   name.endsWith('.dot') ||
                   name.endsWith('.rtf');
        });

        if (files.length === 0) {
            alert("Tidak ada file Excel (.xlsx / .xls), .csv, atau Word (.docx / .doc) yang valid ditemukan di dalam folder / pilihan!");
            return;
        }

        if (typeof window.showToast === 'function') {
            window.showToast(`Membaca ${files.length} file Surat Jalan...`, "info");
        }

        const allRows = [];
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            try {
                const name = (f.name || '').toLowerCase().trim();
                let rows = [];
                if (name.endsWith('.docx') || name.endsWith('.doc') || name.endsWith('.docm') || name.endsWith('.rtf') || name.endsWith('.dotx') || name.endsWith('.dot')) {
                    rows = await parseWordFile(f);
                } else {
                    rows = await parseExcelFile(f);
                }
                if (Array.isArray(rows) && rows.length > 0) {
                    rows.forEach(r => {
                        r.sourceFile = f.name;
                        r.rowIndex = allRows.length + 1;
                        allRows.push(r);
                    });
                    successCount++;
                }
            } catch (err) {
                console.warn(`Gagal membaca file "${f.name}":`, err);
                failCount++;
            }
        }

        if (allRows.length === 0) {
            alert("Tidak ada data Surat Jalan yang dapat dibaca dari file-file tersebut!");
            return;
        }

        parsedPreviewList = allRows;
        openImportPreviewModal(allRows);

        if (typeof window.showToast === 'function') {
            window.showToast(`✅ Berhasil memuat total ${allRows.length} Surat Jalan dari ${successCount} file!`, "success");
        }
    }

    // Listener change pada input file biasa (bisa 1 atau banyak file)
    function handleExcelFileSelected(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        processMultipleExcelFiles(files).finally(() => {
            event.target.value = '';
        });
    }

    // Listener change pada input folder (webkitdirectory)
    function handleExcelFolderSelected(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        processMultipleExcelFiles(files).finally(() => {
            event.target.value = '';
        });
    }

    // Fungsi Generator Uji Coba Langsung Format Wellen Print (Gambar 1 dari User)
    function generateWellenSampleData() {
        const todayDate = new Date();
        const defaultDateFolder = todayDate.toISOString().slice(0, 10);
        return [
            {
                rowIndex: 1,
                sjNumber: `SJ/${todayDate.getFullYear()}/${String(todayDate.getMonth()+1).padStart(2,'0')}/0101`,
                shortCode: generateUniqueCode(),
                clientName: 'WELLEN DM',
                customer: 'WELLEN DM',
                address: 'Jl. Palmerah Barat No. 29, Palmerah, Jakarta Barat',
                region: 'Jakarta Barat',
                namaBarang: 'SATIN SILKY _ FLAG BANNER _',
                itemsSummary: 'SATIN SILKY _ FLAG BANNER _ | Uk: 7.00 x 0.90 | Qty: 2 Pcs',
                qty: '2 Pcs',
                picPhone: '0812-9876-1111',
                originBranch: 'pusat',
                deadline: '17:00 WIB',
                spkNumber: 'SPK-SUBLIME-001',
                dateFolder: defaultDateFolder,
                machine: 'SUBLIME',
                ukuran: '7.00 x 0.90',
                finishing: 'ORBRAS KELILING'
            },
            {
                rowIndex: 2,
                sjNumber: `SJ/${todayDate.getFullYear()}/${String(todayDate.getMonth()+1).padStart(2,'0')}/0102`,
                shortCode: generateUniqueCode(),
                clientName: 'WELLEN DM',
                customer: 'WELLEN DM',
                address: 'Ruko Tangcity Mall Blok A-08, Cikokol, Tangerang',
                region: 'Tangerang',
                namaBarang: 'MIKA BENING 0.3 MM ( CETAK DEPAN ) - POSM - DST1040',
                itemsSummary: 'MIKA BENING 0.3 MM ( CETAK DEPAN ) - POSM - DST1040 | Uk: 0.13 x 0.20 | Qty: 2 Pcs',
                qty: '2 Pcs',
                picPhone: '0813-8877-2222',
                originBranch: 'cikokol', // Ditugaskan ke Cikokol
                deadline: '15:30 WIB',
                spkNumber: 'SPK-SWISSQ-002',
                dateFolder: defaultDateFolder,
                machine: 'SWISSQ',
                ukuran: '0.13 x 0.20',
                finishing: 'POTONG BENTUK + REL TEKUK'
            },
            {
                rowIndex: 3,
                sjNumber: `SJ/${todayDate.getFullYear()}/${String(todayDate.getMonth()+1).padStart(2,'0')}/0103`,
                shortCode: generateUniqueCode(),
                clientName: 'WELLEN DM',
                customer: 'WELLEN DM',
                address: 'Gedung Menara Batavia, Jl. KH Mas Mansyur, Jakarta Pusat',
                region: 'Jakarta Pusat',
                namaBarang: 'X BANNER ALB LAM DOFF _ BENDERA _',
                itemsSummary: 'X BANNER ALB LAM DOFF _ BENDERA _ | Uk: 1.00 x 1.00 | Qty: 2 Pcs',
                qty: '2 Pcs',
                picPhone: '0812-3344-5566',
                originBranch: 'pusat',
                deadline: '16:00 WIB',
                spkNumber: 'SPK-INDOOR-003',
                dateFolder: defaultDateFolder,
                machine: 'INDOOR',
                ukuran: '1.00 x 1.00',
                finishing: 'FINISHING X BANNER'
            },
            {
                rowIndex: 4,
                sjNumber: `SJ/${todayDate.getFullYear()}/${String(todayDate.getMonth()+1).padStart(2,'0')}/0104`,
                shortCode: generateUniqueCode(),
                clientName: 'WELLEN DM',
                customer: 'WELLEN DM',
                address: 'Gedung Cyber 2 Lt. 15, Jl. HR Rasuna Said, Kuningan, Jakarta Selatan',
                region: 'Jakarta Selatan',
                namaBarang: 'KARTU NAMA FANCY POTONG BENTUK 1 MUKA _ WELLEN _',
                itemsSummary: 'KARTU NAMA FANCY POTONG BENTUK 1 MUKA _ WELLEN _ | Uk: 1.00 x 1.00 | Qty: 1 Pcs',
                qty: '1 Pcs',
                picPhone: '0815-7788-9900',
                originBranch: 'pusat',
                deadline: '18:00 WIB',
                spkNumber: 'SPK-A3-004',
                dateFolder: defaultDateFolder,
                machine: 'A3',
                ukuran: '1.00 x 1.00',
                finishing: 'POTONG PAS GARIS/KRIS'
            },
            {
                rowIndex: 5,
                sjNumber: `SJ/${todayDate.getFullYear()}/${String(todayDate.getMonth()+1).padStart(2,'0')}/0105`,
                shortCode: generateUniqueCode(),
                clientName: 'WELLEN DM',
                customer: 'WELLEN DM',
                address: 'Kawasan Industri Jatake Blok C-10, Tangerang',
                region: 'Tangerang',
                namaBarang: 'FF CHINA 280 GR _ HARI KEMERDEKAAN _',
                itemsSummary: 'FF CHINA 280 GR _ HARI KEMERDEKAAN _ | Uk: 1.00 x 3.00 | Qty: 1 Pcs',
                qty: '1 Pcs',
                picPhone: '0811-2233-4455',
                originBranch: 'cikokol', // Ditugaskan ke Cikokol
                deadline: '14:00 WIB',
                spkNumber: 'SPK-OUTDOOR-005',
                dateFolder: defaultDateFolder,
                machine: 'OUTDOOR',
                ukuran: '1.00 x 3.00',
                finishing: 'SELONGSONG SPASI _ MA POJOK-POJOK'
            }
        ];
    }

    // Handler Test Import Format Wellen (Bisa untuk SJ atau SPK)
    function testWellenSampleImport(mode = 'sj') {
        const samples = generateWellenSampleData();
        if (mode === 'sj') {
            parsedPreviewList = samples;
            openImportPreviewModal(samples);
            if (typeof window.showToast === 'function') {
                window.showToast("🧪 Contoh format Wellen Print (Gambar 1) berhasil dimuat ke Preview Surat Jalan!", "success");
            }
        } else {
            // Render ke modal preview SPK via spkManager
            if (window.spkManager && typeof window.spkManager.setSPKPreviewData === 'function') {
                window.spkManager.setSPKPreviewData(samples);
            }
            openSPKImportModal();
            if (typeof window.showToast === 'function') {
                window.showToast("🧪 Contoh format SPK Wellen Print (Gambar 1) berhasil dimuat ke Antrian SPK!", "success");
            }
        }
    }

    // Fungsi Generator Uji Coba Langsung Format Surat Jalan Word Wellen Print (Gambar 2 User: SJ-1126-00248)
    function generateWellenWordSampleData() {
        const todayDate = new Date();
        const defaultDateFolder = todayDate.toISOString().slice(0, 10);
        const shortCode = generateUniqueCode();

        const items = [
            { no: '1', nama: 'STICKER RITRAMA VYNIL LAMINATING DOFF STICKER VOUCHER STANDING POSTER', ukuran: '0.15 x 0.04', qty: '1 Pcs', qtyNum: 1 },
            { no: '2', nama: 'STICKER RITRAMA VYNIL LAMINATING DOFF STICKER VOUCHER PONY', ukuran: '0.19 x 0.18', qty: '1 Pcs', qtyNum: 1 },
            { no: '3', nama: 'STICKER RITRAMA VYNIL LAMINATING DOFF STICKER VOUCHER ATTRACTOR', ukuran: '0.24 x 0.07', qty: '1 Pcs', qtyNum: 1 },
            { no: '4', nama: 'FF KOREA 440 GR L BANNER PWP_1 SET', ukuran: '0.34 x 0.60', qty: '2 Pcs', qtyNum: 2 },
            { no: '5', nama: 'IMPRABOARD 5 MM 1 SISI FLOOR PALET', ukuran: '1.80 x 0.30', qty: '1 Pcs', qtyNum: 1 },
            { no: '6', nama: 'IMPRABOARD 5 MM 1 SISI FLOOR PALET VER DEPAN', ukuran: '0.90 x 0.22', qty: '1 Pcs', qtyNum: 1 },
            { no: '7', nama: 'WHITE PAPER BOARD 5 MM 1 SISI CALLOUT TAS - LIPAT_2 FILE@1 PCS', ukuran: '0.25 x 0.30', qty: '2 Pcs', qtyNum: 2 },
            { no: '8', nama: 'IMPRABOARD 5 MM 1 SISI POLAROID KOPER', ukuran: '0.40 x 0.35', qty: '1 Pcs', qtyNum: 1 },
            { no: '9', nama: 'WHITE PAPER BOARD 5 MM 1 SISI FOTO TRAVEL', ukuran: '0.12 x 0.25', qty: '1 Pcs', qtyNum: 1 },
            { no: '10', nama: 'IMPRABOARD 5 MM 1 SISI POLAROID FANS', ukuran: '0.40 x 0.54', qty: '1 Pcs', qtyNum: 1 },
            { no: '11', nama: 'WHITE PAPER BOARD 5 MM 1 SISI FOTO FANS', ukuran: '0.18 x 0.32', qty: '1 Pcs', qtyNum: 1 },
            { no: '12', nama: 'WHITE PAPER BOARD 5 MM 1 SISI CAKUPAN AREA', ukuran: '0.30 x 0.30', qty: '1 Pcs', qtyNum: 1 },
            { no: '13', nama: 'IMPRABOARD 5 MM 1 SISI POLAROID CAMPING', ukuran: '0.55 x 0.48', qty: '1 Pcs', qtyNum: 1 }
        ];

        const totalQty = 16;
        const address = 'AZKO MARGO CITY MALL DEPOK';
        const clientName = 'PT ASPIRASI HIDUP INDONESIA TBK';
        const region = detectRegion(address, clientName);

        const itemsSummary = items.map(it => `${it.no}. ${it.nama} (Uk: ${it.ukuran} | Qty: ${it.qty})`).join(' | ');

        return [{
            rowIndex: 1,
            sjNumber: 'SJ-1126-00248',
            shortCode: shortCode,
            clientName: clientName,
            customer: clientName,
            address: address,
            region: region, // Depok
            namaBarang: `13 Items Cetakan (Total ${totalQty} Pcs)`,
            ukuran: 'Multi Ukuran',
            qty: `${totalQty} Pcs`,
            finishing: '-',
            itemsSummary: itemsSummary,
            picPhone: 'DEWI',
            originBranch: 'pusat',
            deadline: '17:00 WIB',
            spkNumber: 'WPP 1126-300252',
            dateFolder: defaultDateFolder,
            machine: 'Digital Print',
            items: items,
            sourceFile: 'SJ-1126-00248_AZKO_MARGO_CITY_DEPOK.docx',
            sourceType: 'word_docx'
        }];
    }

    // Handler Uji Coba Format Word Surat Jalan
    function testWellenWordSampleImport() {
        const samples = generateWellenWordSampleData();
        parsedPreviewList = samples;
        openImportPreviewModal(samples);
        if (typeof window.showToast === 'function') {
            window.showToast("📄 Contoh Surat Jalan Word Wellen Print (SJ-1126-00248) berhasil dimuat ke Preview!", "success");
        }
    }

    // Buka Modal Import SJ
    function openSJImportModal() {
        const modalEl = document.getElementById('modal-sj-import-preview');
        if (modalEl && typeof bootstrap !== 'undefined') {
            const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
            bsModal.show();
        }
    }

    // Buka Modal Import SPK
    function openSPKImportModal() {
        const modalEl = document.getElementById('modal-spk-import-preview');
        if (modalEl && typeof bootstrap !== 'undefined') {
            const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
            bsModal.show();
        }
    }

    // Commit SPK dari Preview ke Antrian SPK dan Sinkronkan ke SPK Manager
    function commitSPKImportPreview() {
        if (window.spkManager && typeof window.spkManager.commitSPKImportPreview === 'function') {
            return window.spkManager.commitSPKImportPreview();
        }
        const samples = generateWellenSampleData();
        const branchSelects = document.querySelectorAll('.spk-preview-branch-select');
        branchSelects.forEach((sel, idx) => {
            if (samples[idx]) samples[idx].originBranch = sel.value;
        });

        samples.forEach(s => {
            const spkItem = {
                spkId: s.spkNumber,
                id: s.spkNumber,
                spkNumber: s.spkNumber,
                clientName: s.clientName,
                customer: s.clientName,
                alamatKlien: s.address,
                address: s.address,
                jobTitle: s.itemsSummary.split('|')[0].trim(),
                namaProduk: s.itemsSummary.split('|')[0].trim(),
                specs: `Uk: ${s.ukuran} | Fin: ${s.finishing}`,
                qty: s.qty,
                machineName: s.machine,
                productionBranch: s.originBranch,
                branch: s.originBranch,
                productionStatus: (s.originBranch === 'cikokol') ? 'printing' : 'received',
                jobReceivedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + " WIB",
                deadlineAt: s.deadline,
                linkedSjId: ""
            };
            if (window.spkOrdersList) {
                window.spkOrdersList.unshift(spkItem);
            }
        });

        const modalEl = document.getElementById('modal-spk-import-preview');
        if (modalEl && typeof bootstrap !== 'undefined') {
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
        }

        if (typeof window.showToast === 'function') {
            window.showToast(`✅ Berhasil menambahkan ${samples.length} pekerjaan SPK ke antrian produksi!`);
        }

        // Beralih ke view SPK agar user langsung melihat hasilnya
        if (typeof window.switchTab === 'function') {
            window.switchTab('spk');
        }
    }

    // Data Contoh Realistis dari Hasil Foto Uploadan / Arsip PoD Surat Jalan Wellen Print
    function generatePoDSampleData() {
        const todayDate = new Date();
        const dateFolder = todayDate.toISOString().slice(0, 10);
        return [
            {
                rowIndex: 1,
                sjNumber: `SJ/${todayDate.getFullYear()}/${String(todayDate.getMonth()+1).padStart(2,'0')}/0201`,
                shortCode: generateUniqueCode(),
                clientName: 'PT MAYORA INDAH TBK',
                customer: 'PT MAYORA INDAH TBK',
                address: 'Jl. Tomang Raya No. 21-23, Tomang, Grogol Petamburan, Jakarta Barat',
                region: 'Jakarta Barat',
                namaBarang: 'Brosur Torabika Creamy Latte A4 Art Paper 150gr',
                itemsSummary: 'Brosur Torabika Creamy Latte A4 Art Paper 150gr | Uk: 21 x 29.7 cm | Qty: 5000 Lembar',
                qty: '5000 Lembar',
                picPhone: '0812-1122-3344 (Bpk. Anton)',
                originBranch: 'pusat',
                deadline: '16:00 WIB',
                spkNumber: 'SPK-MYR-2026-001',
                dateFolder: dateFolder,
                machine: 'A3 Digital',
                ukuran: '21 x 29.7 cm',
                finishing: 'Laminasi Doff + Lipat 3'
            },
            {
                rowIndex: 2,
                sjNumber: `SJ/${todayDate.getFullYear()}/${String(todayDate.getMonth()+1).padStart(2,'0')}/0202`,
                shortCode: generateUniqueCode(),
                clientName: 'PT PARAGON TECHNOLOGY (WARDAH)',
                customer: 'PT PARAGON TECHNOLOGY (WARDAH)',
                address: 'Kawasan Industri Jatake Blok C-10, Tangerang',
                region: 'Tangerang',
                namaBarang: 'Floor Display Standee Acrylic Wardah Exclusive Matte',
                itemsSummary: 'Floor Display Standee Acrylic Wardah Exclusive Matte | Uk: 60 x 160 cm | Qty: 15 Set',
                qty: '15 Set',
                picPhone: '0813-9988-7766 (Ibu Rina)',
                originBranch: 'cikokol', // Dicetak & dikirim dari Cabang Cikokol
                deadline: '14:30 WIB',
                spkNumber: 'SPK-WRD-2026-002',
                dateFolder: dateFolder,
                machine: 'SWISSQ',
                ukuran: '60 x 160 cm',
                finishing: 'Cutting Die Cut + Rel Tekuk'
            },
            {
                rowIndex: 3,
                sjNumber: `SJ/${todayDate.getFullYear()}/${String(todayDate.getMonth()+1).padStart(2,'0')}/0203`,
                shortCode: generateUniqueCode(),
                clientName: 'SHOPEE INDONESIA',
                customer: 'SHOPEE INDONESIA',
                address: 'Pacific Century Place Lt. 26, SCBD Kav. 52-53, Jl. Jend. Sudirman, Jakarta Selatan',
                region: 'Jakarta Selatan',
                namaBarang: 'Backdrop Event 11.11 Promo Big Sale Flexi Korea 440gr',
                itemsSummary: 'Backdrop Event 11.11 Promo Big Sale Flexi Korea 440gr | Uk: 6.00 x 3.00 m | Qty: 2 Pcs',
                qty: '2 Pcs',
                picPhone: '0818-4455-6677 (Tim Event Shopee)',
                originBranch: 'pusat',
                deadline: '17:00 WIB',
                spkNumber: 'SPK-SHP-2026-003',
                dateFolder: dateFolder,
                machine: 'OUTDOOR',
                ukuran: '6.00 x 3.00 m',
                finishing: 'Selongsong + Mata Ayam'
            },
            {
                rowIndex: 4,
                sjNumber: `SJ/${todayDate.getFullYear()}/${String(todayDate.getMonth()+1).padStart(2,'0')}/0204`,
                shortCode: generateUniqueCode(),
                clientName: 'WELLEN DM (INTERNAL CIKOKOL)',
                customer: 'WELLEN DM (INTERNAL CIKOKOL)',
                address: 'Ruko Tangcity Mall Blok A-08, Jl. Jend. Sudirman, Cikokol, Tangerang',
                region: 'Tangerang',
                namaBarang: 'Satin Silky Flag Banner Event Wellen & X-Banner Albatros',
                itemsSummary: 'Satin Silky Flag Banner Event Wellen & X-Banner Albatros | Uk: 7.00 x 0.90 m | Qty: 4 Set',
                qty: '4 Set',
                picPhone: '0811-2233-4455 (Admin Cikokol)',
                originBranch: 'cikokol', // Dicetak di Cikokol
                deadline: '13:00 WIB',
                spkNumber: 'SPK-WDM-2026-004',
                dateFolder: dateFolder,
                machine: 'SUBLIME',
                ukuran: '7.00 x 0.90 m',
                finishing: 'Obras Keliling + Selongsong Tiang'
            },
            {
                rowIndex: 5,
                sjNumber: `SJ/${todayDate.getFullYear()}/${String(todayDate.getMonth()+1).padStart(2,'0')}/0205`,
                shortCode: generateUniqueCode(),
                clientName: 'PT BANK CENTRAL ASIA TBK (BCA)',
                customer: 'PT BANK CENTRAL ASIA TBK (BCA)',
                address: 'Menara BCA Lt. 32, Grand Indonesia, Jl. MH Thamrin No. 1, Jakarta Pusat',
                region: 'Jakarta Pusat',
                namaBarang: 'Tent Card Akrilik Meja Promosi Tabungan Tahapan',
                itemsSummary: 'Tent Card Akrilik Meja Promosi Tabungan Tahapan | Uk: 10 x 15 cm | Qty: 150 Pcs',
                qty: '150 Pcs',
                picPhone: '0812-7788-9911 (Bpk. Denny BCA)',
                originBranch: 'pusat',
                deadline: '18:00 WIB',
                spkNumber: 'SPK-BCA-2026-005',
                dateFolder: dateFolder,
                machine: 'INDOOR',
                ukuran: '10 x 15 cm',
                finishing: 'Cetak Mirror + Tempel Akrilik'
            }
        ];
    }

    // Unduh Template Excel Resmi Surat Jalan Wellen (.xlsx)
    function downloadSJExcelTemplate() {
        if (typeof XLSX === 'undefined') {
            return alert("Pustaka SheetJS belum siap di halaman!");
        }

        const templateData = [
            {
                "No Surat Jalan": "SJ/2026/11/0001",
                "Tanggal": new Date().toISOString().split('T')[0],
                "No SPK / PO": "SPK-WL-001",
                "Customer / Klien": "PT MAYORA INDAH TBK",
                "Alamat Pengiriman Lengkap": "Jl. Tomang Raya No. 21-23, Tomang, Grogol Petamburan, Jakarta Barat",
                "PIC & Telepon": "Bpk. Anton (0812-1122-3344)",
                "Wilayah": "Jakarta Barat",
                "Nama Barang / Pekerjaan": "Brosur Torabika Creamy Latte A4 Art Paper 150gr",
                "Ukuran": "21 x 29.7 cm",
                "Qty": 5000,
                "Satuan": "Lembar",
                "Finishing": "Laminasi Doff 2 Sisi + Lipat 3",
                "Mesin Cetak": "A3 Digital",
                "Lokasi Cetak (Pusat / Cikokol)": "Pusat",
                "Catatan / Koli": "10 Box (Packing Rapih)"
            },
            {
                "No Surat Jalan": "SJ/2026/11/0002",
                "Tanggal": new Date().toISOString().split('T')[0],
                "No SPK / PO": "SPK-WL-002",
                "Customer / Klien": "PT PARAGON TECHNOLOGY (WARDAH)",
                "Alamat Pengiriman Lengkap": "Kawasan Industri Jatake Blok C-10, Tangerang",
                "PIC & Telepon": "Ibu Rina (0813-9988-7766)",
                "Wilayah": "Tangerang",
                "Nama Barang / Pekerjaan": "Floor Display Standee Acrylic Wardah Exclusive Matte",
                "Ukuran": "60 x 160 cm",
                "Qty": 15,
                "Satuan": "Set",
                "Finishing": "Cutting Die Cut + Rel Tekuk",
                "Mesin Cetak": "SwissQ",
                "Lokasi Cetak (Pusat / Cikokol)": "Cikokol",
                "Catatan / Koli": "3 Koli Besar"
            },
            {
                "No Surat Jalan": "SJ/2026/11/0003",
                "Tanggal": new Date().toISOString().split('T')[0],
                "No SPK / PO": "SPK-WL-003",
                "Customer / Klien": "SHOPEE INDONESIA",
                "Alamat Pengiriman Lengkap": "Pacific Century Place Lt. 26, SCBD, Jl. Jend. Sudirman, Jakarta Selatan",
                "PIC & Telepon": "Tim Event (0818-4455-6677)",
                "Wilayah": "Jakarta Selatan",
                "Nama Barang / Pekerjaan": "Backdrop Event 11.11 Promo Big Sale Flexi Korea 440gr",
                "Ukuran": "6.00 x 3.00 m",
                "Qty": 2,
                "Satuan": "Pcs",
                "Finishing": "Selongsong Atas Bawah + Mata Ayam",
                "Mesin Cetak": "Outdoor",
                "Lokasi Cetak (Pusat / Cikokol)": "Pusat",
                "Catatan / Koli": "Gulungan Tabung"
            },
            {
                "No Surat Jalan": "SJ/2026/11/0004",
                "Tanggal": new Date().toISOString().split('T')[0],
                "No SPK / PO": "SPK-WL-004",
                "Customer / Klien": "WELLEN DM",
                "Alamat Pengiriman Lengkap": "Ruko Tangcity Mall Blok A-08, Cikokol, Tangerang",
                "PIC & Telepon": "Admin Cikokol (0811-2233-4455)",
                "Wilayah": "Tangerang",
                "Nama Barang / Pekerjaan": "Satin Silky Flag Banner Event Wellen",
                "Ukuran": "7.00 x 0.90 m",
                "Qty": 2,
                "Satuan": "Set",
                "Finishing": "Obras Keliling + Selongsong Tiang",
                "Mesin Cetak": "Sublime",
                "Lokasi Cetak (Pusat / Cikokol)": "Cikokol",
                "Catatan / Koli": "1 Koli"
            },
            {
                "No Surat Jalan": "SJ/2026/11/0005",
                "Tanggal": new Date().toISOString().split('T')[0],
                "No SPK / PO": "SPK-WL-005",
                "Customer / Klien": "PT BANK CENTRAL ASIA TBK",
                "Alamat Pengiriman Lengkap": "Menara BCA Lt. 32, Grand Indonesia, Jl. MH Thamrin No. 1, Jakarta Pusat",
                "PIC & Telepon": "Bpk. Denny (0812-7788-9911)",
                "Wilayah": "Jakarta Pusat",
                "Nama Barang / Pekerjaan": "Tent Card Akrilik Meja Promosi Tabungan Tahapan",
                "Ukuran": "10 x 15 cm",
                "Qty": 150,
                "Satuan": "Pcs",
                "Finishing": "Cetak Mirror + Tempel Akrilik Bening 2mm",
                "Mesin Cetak": "Indoor",
                "Lokasi Cetak (Pusat / Cikokol)": "Pusat",
                "Catatan / Koli": "2 Dus"
            }
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateData);

        // Atur lebar kolom agar cantik dan mudah dibaca
        ws['!cols'] = [
            { wch: 18 }, // No SJ
            { wch: 12 }, // Tanggal
            { wch: 15 }, // No SPK / PO
            { wch: 30 }, // Customer
            { wch: 45 }, // Alamat
            { wch: 25 }, // PIC
            { wch: 16 }, // Wilayah
            { wch: 35 }, // Nama Barang
            { wch: 15 }, // Ukuran
            { wch: 8 },  // Qty
            { wch: 10 }, // Satuan
            { wch: 25 }, // Finishing
            { wch: 15 }, // Mesin Cetak
            { wch: 20 }, // Lokasi Cetak
            { wch: 20 }  // Catatan
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Template_Surat_Jalan");
        XLSX.writeFile(wb, "Template_Import_Surat_Jalan_Wellen_Print.xlsx");

        if (typeof window.showToast === 'function') {
            window.showToast("📥 Template Excel Surat Jalan Wellen Print berhasil diunduh!", "success");
        }
    }

    // Muat Contoh PoD Surat Jalan ke Layar Preview
    function loadPoDSampleToPreview() {
        const podData = generatePoDSampleData();
        parsedPreviewList = podData;
        openImportPreviewModal(podData);
        if (typeof window.showToast === 'function') {
            window.showToast("📄 Contoh Format Fisik Surat Jalan (PoD Wellen) berhasil dimuat!", "success");
        }
    }

    // Pasang helper ke window global
    window.openSJImportModal = openSJImportModal;
    window.openSPKImportModal = openSPKImportModal;
    window.testWellenSampleImport = testWellenSampleImport;
    window.testWellenWordSampleImport = testWellenWordSampleImport;
    window.generateWellenWordSampleData = generateWellenWordSampleData;
    window.parseWordFile = parseWordFile;
    window.commitSPKImportPreview = commitSPKImportPreview;
    window.downloadSJExcelTemplate = downloadSJExcelTemplate;
    window.loadPoDSampleToPreview = loadPoDSampleToPreview;

    // Export API ke global window
    const engineAPI = {
        JABODETABEK_REGIONS,
        detectRegion,
        detectRegionFromAddress: detectRegion,
        generateUniqueCode,
        parseExcelFile,
        parseWordFile,
        openImportPreviewModal,
        filterPreviewTable,
        openSJImportModal,
        openSPKImportModal,
        testWellenSampleImport,
        testWellenWordSampleImport,
        generateWellenSampleData,
        generateWellenWordSampleData,
        generatePoDSampleData,
        downloadSJExcelTemplate,
        loadPoDSampleToPreview,
        commitSPKImportPreview,
        setBulkPrintBranch,
        toggleAllPreview,
        commitImportBatch,
        triggerExcelFileInput,
        handleExcelFileSelected,
        handleExcelFolderSelected,
        processMultipleExcelFiles,
        handleFileUpload: handleExcelFileSelected
    };

    window.sjImportEngine = engineAPI;
    window.SJImportEngine = engineAPI;

})(typeof window !== 'undefined' ? window : global);
