# Unified SJ & SPK Import, Multi-Branch Production, and QR Dispatch Implementation Plan (Localhost First)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun modul terpadu pada webapp Wtrack (dapat dijalankan dan diuji langsung di localhost) untuk Import Excel Surat Jalan (SJ) dan SPK Produksi, pengelompokan otomatis Folder Harian & Region Jabodetabek, One-Click Admin Region Dispatch, Workstation Cabang (Cikokol & Pasar Minggu), cetak Surat Jalan ber-QR Code + Kode Unik 6-Karakter, serta simulator Web Scanner di localhost.

**Architecture:** Modul dibangun secara modular dengan memisahkan logika ke dalam file JavaScript terfokus (`js/sj_import_engine.js`, `js/branch_workstation.js`, `js/spk_manager.js`, `js/qr_print_dispatch.js`) yang dihubungkan ke dashboard utama `index.html` dan `js/app.js`. Seluruh data menggunakan Firestore collections (`trips`, `import_batches`, `spk_orders`) dengan dukungan fallback memori lokal yang responsif di localhost/demo mode. Perubahan file secara konsisten disinkronkan ke direktori `public/`.

**Tech Stack:** Vanilla JavaScript (ES6+), Bootstrap 5.3, SheetJS (`xlsx.full.min.js`), ExcelJS, QRCode.js / SVG QR Generator, Firebase Firestore/RTDB, HTML5 Canvas & Print CSS.

**Spec:** `/Users/dombamalam/.gemini/antigravity/brain/721a149d-2ade-4932-b3ce-32a44f6a87ef/PRD_Wtrack_Unified_SJ_SPK_QR.md`

## Global Constraints

- Kompatibilitas penuh dengan sistem Wtrack yang sudah ada: tidak boleh merusak struktur data `trips`, `clients`, `users`, tracking GPS, KPI Kurir, Inventaris Armada, atau Arsip PoD.
- Bekerja secara otomatis di localhost (`window.location.hostname === 'localhost'` / `127.0.0.1`) dalam mode demo maupun koneksi Firestore langsung.
- Setiap Surat Jalan wajib memiliki nomor SJ, Region Jabodetabek teridentifikasi, QR Code payload, dan Kode Unik 6-Karakter anti-ambigu (contoh: `WK-4829`).
- Dual-mode dispatch harus didukung: penugasan massal oleh Admin per Region dan klaim mandiri via QR Code.
- Kode dan antarmuka harus tersinkronisasi antara root (`index.html`, `js/`) dan `public/` (`public/index.html`, `public/js/`).

## Review Focus

- File Excel dengan format header kolom yang bervariasi (e.g., "Customer" vs "Nama Toko", "Alamat SJ" vs "Alamat Pengiriman") harus ter-mapping otomatis tanpa error.
- Alamat tanpa keterangan kota eksplisit harus tetap dapat diklasifikasikan ke region Jabodetabek yang tepat berdasarkan pencocokan master client atau kata kunci kecamatan/kelurahan.
- Penugasan 1 Region oleh Admin ke Driver Mobil harus otomatis memvalidasi armada plat mobil operasional dan menggabungkan titik rute secara berurutan.
- Transisi status di Workstation Cabang Cikokol/Pasar Minggu harus langsung memicu pembaruan status badge di Pusat secara real-time.
- Lembar cetak Surat Jalan harus rapi, proporsional saat di-print (A4/A5/Stiker thermal), dengan QR Code yang tajam dan kode unik yang mudah dibaca.

---

### Task 1: Auto-Region Engine & Parser Import Excel SJ (`js/sj_import_engine.js`)

**Files:**
- Create: `js/sj_import_engine.js`
- Modify: `index.html:20-25` (Include `qrcode.min.js` and `js/sj_import_engine.js`)
- Modify: `public/index.html` (Mirroring)

**Interfaces:**
- Consumes: SheetJS `XLSX.read`, `window.db`, master clients cache `allClients`
- Produces: `window.sjImportEngine.parseExcelFile(file)`, `window.sjImportEngine.detectRegion(address, clientName)`, `window.sjImportEngine.generateUniqueCode()`, `window.sjImportEngine.saveImportBatch(batchData, tripsList)`

- [ ] **Step 1: Buat engine klasifikasi 11 Region Jabodetabek & generator kode unik 6-karakter**
  Implementasikan fungsi pemetaan kecamatan/kelurahan ke 11 Region standar Wtrack (`Jakarta Pusat`, `Jakarta Barat`, `Jakarta Selatan`, `Jakarta Timur`, `Jakarta Utara`, `Tangerang`, `Bekasi`, `Cikarang`, `Depok`, `Bogor`, `Karawang/Serang`) serta generator kode unik `WK-XXXX` menggunakan karakter alfanumerik anti-ambigu.

- [ ] **Step 2: Buat parser Excel fleksibel dengan auto-mapping kolom**
  Baca lembar Excel via SheetJS, normalisasi nama header kolom (No SJ, Tanggal, Customer, Alamat, Item, Qty, PIC, Cabang Print), dan hasilkan array objek SJ terstruktur.

- [ ] **Step 3: Tambahkan Modal Preview Import Interaktif di `index.html`**
  Tampilkan tabel review sebelum data disimpan: ringkasan region terdeteksi, toggle per-baris/bulk untuk menentukan lokasi print (`Print di Pusat` vs `Print di Cikokol`), serta dropdown pre-assign kurir per region opsional.

- [ ] **Step 4: Simpan batch import ke koleksi `import_batches` dan `trips`**
  Simpan metadata folder tanggal harian dan daftar SJ dengan atribut lengkap (`status: "pool"`, `originBranch`, `branchWorkflowStatus: "received"`, `shortCode`, `qrPayload`).

- [ ] **Step 5: Uji di localhost dengan file Excel uji dan verifikasi di console/UI**
  Jalankan fungsi import dengan contoh data di console browser localhost dan pastikan parsing dan deteksi region berjalan tepat.

---

### Task 2: Folder Harian & One-Click Admin Region Dispatch di SJ Pool (`#view-pool`)

**Files:**
- Modify: `index.html` (Update tampilan `#view-pool`)
- Modify: `js/app.js` (Perluas fungsi `loadPoolTrips`, `renderPoolTable`, dan `filterPoolByRegion`)
- Modify: `public/index.html` dan `public/js/app.js` (Mirroring)

**Interfaces:**
- Consumes: `allCurrentTrips`, `MASTER_COURIERS`, `COMPANY_FLEET_VEHICLES`
- Produces: `window.assignEntireRegionToCourier(regionName, courierId, vehiclePlate, autoOptimizeRoute)`

- [ ] **Step 1: Perbarui layout UI `#view-pool` dengan Folder Harian dan Kartu Region**
  Ubah tampilan atas menu SJ Pool menjadi navigasi hierarkis: daftar Folder Tanggal Harian di sebelah kiri, dan tombol filter Region dalam bentuk Badge/Pills interaktif dengan jumlah antrian SJ per region.

- [ ] **Step 2: Tambahkan Bar Penugasan Langsung per Region (One-Click Region Dispatch Bar)**
  Saat Admin mengklik salah satu Region (misal *Jakarta Barat* atau *Bekasi*), tampilkan bar penugasan yang memuat dropdown Kurir/Driver (lengkap dengan plat mobil jika memilih Driver) dan tombol `🚀 Tugaskan Seluruh Region Ini ke [Nama Kurir]`.

- [ ] **Step 3: Implementasikan fungsi `assignEntireRegionToCourier`**
  Ubah seluruh SJ di region tersebut menjadi status `in_progress`, hubungkan ke `courierId`, catat plat mobil jika driver, susun nomor urut titik `stopIndex` secara terurut, dan perbarui data ke Firestore / memori lokal.

- [ ] **Step 4: Tambahkan opsi Split Region (Penugasan Sebagian SJ via Checklist)**
  Sediakan kemampuan mencentang sebagian SJ di dalam region untuk kurir motor dan sebagian untuk driver mobil.

- [ ] **Step 5: Verifikasi di localhost**
  Pilih salah satu region yang memiliki data demo, lakukan penugasan ke Driver Mobil, dan pastikan tugas langsung masuk ke daftar recent shipments serta KPI.

---

### Task 3: Workstation Cabang Cikokol & Pasar Minggu (`js/branch_workstation.js`)

**Files:**
- Create: `js/branch_workstation.js`
- Modify: `index.html` (Tambahkan navigasi `#nav-branch-workstation` dan kontainer `#view-branch-workstation`)
- Modify: `public/index.html` & `public/js/` (Mirroring)

**Interfaces:**
- Consumes: `allCurrentTrips`, `currentUserBranchId`, `currentUserRole`
- Produces: `window.branchWorkstation.renderView()`, `window.branchWorkstation.updateJobStatus(tripId, newStatus, extraData)`, `window.branchWorkstation.createTransitManifest(tripIds, driverName)`

- [ ] **Step 1: Buat kontainer dan layout Workstation Cabang di `index.html`**
  Rancang UI elegan yang memuat kartu KPI Cabang (Total Kerjaan, Antri Print, Sedang Packing, Terkirim ke Pusat, Mendekati Deadline), filter cabang (`Cikokol` & `Pasar Minggu`), dan tabel antrian kerja.

- [ ] **Step 2: Implementasikan pelacak Jam Masuk, SLA, dan Countdown Timer**
  Hitung selisih waktu antara waktu kerjaan masuk dengan jam deadline. Tampilkan badge sisa waktu berwarna hijau (> 3 jam), kuning (1-3 jam), atau merah berkedip (< 1 jam / lewat deadline).

- [ ] **Step 3: Buat tombol tahapan update status 1-klik**
  Fasilitasi update cepat: `Diterima Cabang` -> `Mulai Print` -> `Selesai Print` -> `Sudah Packing` -> `Terkirim ke Pusat` (memilih driver shuttle transit).

- [ ] **Step 4: Hubungkan ke Dashboard & SJ Pool Pusat secara real-time**
  Tampilkan status produksi cabang secara transparan di tabel Pusat (misal: badge `[🏭 Cikokol: Sudah Packing]`), sehingga Admin Pusat mengetahui kapan barang siap didistribusikan ke kurir pengantar.

- [ ] **Step 5: Uji transisi status di localhost dan pastikan perubahan langsung terlihat**
  Ganti filter cabang ke Cikokol, ubah status salah satu pekerjaan ke 'Sudah Packing', lalu ganti kembali ke Pusat dan verifikasi badge statusnya terupdate seketika.

---

### Task 4: Manajemen & Import SPK Produksi Lintas Cabang (`js/spk_manager.js`)

**Files:**
- Create: `js/spk_manager.js`
- Modify: `index.html` (Tambahkan navigasi `#nav-spk` dan kontainer `#view-spk`)
- Modify: `public/index.html` & `public/js/` (Mirroring)

**Interfaces:**
- Consumes: SheetJS `XLSX.read`, daftar mesin `/assets/mesin/`, `window.db`
- Produces: `window.spkManager.importSPKFromExcel(file)`, `window.spkManager.renderSPKView()`, `window.spkManager.convertSPKToSuratJalan(spkId)`

- [ ] **Step 1: Buat kontainer dan navigasi menu SPK di `index.html`**
  Tambahkan menu **Manajemen SPK** di bawah kategori *Operations* pada sidebar Wtrack. Sediakan filter cabang produksi (`Pusat`, `Cikokol`, `Pasar Minggu`), filter status, dan tombol *Import Excel SPK*.

- [ ] **Step 2: Implementasikan parser Excel SPK dengan pembagian cabang produksi**
  Ekstrak nomor SPK, nama klien, judul pesanan, spesifikasi bahan/mesin, qty, tanggal masuk, deadline, dan cabang pengerjaan.

- [ ] **Step 3: Implementasikan antarmuka kartu antrian mesin cetak & update progres**
  Tampilkan pekerjaan SPK yang terhubung ke mesin cetak terkait (SwissQPrint, HP Indigo, HP Latex, Roland, Mesin Finishing/Cutting) dengan status progres pengerjaan.

- [ ] **Step 4: Tambahkan fitur konversi 1-klik SPK -> Surat Jalan**
  Buat tombol `Buat Surat Jalan dari SPK Ini` untuk pesanan yang sudah selesai produksi, sehingga otomatis masuk ke antrian *SJ Pool* tanpa input ulang.

- [ ] **Step 5: Verifikasi fungsionalitas SPK di localhost**
  Uji alur import SPK, ubah status pengerjaannya, dan konversikan menjadi Surat Jalan di localhost.

---

### Task 5: Auto-Print Surat Jalan ber-QR Code & Kode Unik 6-Karakter (`js/qr_print_dispatch.js`)

**Files:**
- Create: `js/qr_print_dispatch.js`
- Modify: `index.html` (Sertakan stylesheet khusus print `@media print` dan modal cetak)
- Modify: `public/index.html` & `public/js/` (Mirroring)

**Interfaces:**
- Consumes: Data Surat Jalan dari `allCurrentTrips` atau batch import
- Produces: `window.qrPrintDispatch.printSingleSJ(tripId)`, `window.qrPrintDispatch.printBatchSJ(tripIds, paperSize)`, `window.qrPrintDispatch.printStickersOnly(tripIds)`

- [ ] **Step 1: Integrasikan generator QR Code SVG/Canvas murni di browser**
  Gunakan pustaka QR Code ringan tanpa ketergantungan eksternal agar pencetakan QR Code berjalan instan dan offline di localhost.

- [ ] **Step 2: Rancang layout cetakan resmi Surat Jalan Wellen Print (A4 / A5)**
  Susun template dokumen siap cetak: Kop surat resmi Wellen Print (`/assets/wellen_logo.svg`), Nomor SJ, Tanggal, Nama Klien & Alamat, Badge Region, Tabel Item Barang, Kolom Tanda Tangan, serta Kotak QR Code + Kode Unik 6-Karakter (`WK-XXXX`) di pojok kanan atas.

- [ ] **Step 3: Rancang opsi cetak label stiker thermal QR Code**
  Sediakan mode alternatif cetak stiker khusus kode QR + kode unik untuk ditempelkan pada fisik barang atau kertas cetakan lama.

- [ ] **Step 4: Tambahkan tombol cetak massal per Region dan cetak per tanggal**
  Admin dapat mengklik `🖨️ Cetak Semua SJ Region Jakarta Selatan` untuk membuka jendela print browser yang langsung memuat seluruh lembar SJ secara berurutan.

- [ ] **Step 5: Verifikasi hasil cetak di print preview browser localhost**
  Buka print preview browser (`Ctrl+P` / `Cmd+P`) dan pastikan tata letak halaman presisi, page break antar-SJ rapi, dan QR Code tajam.

---

### Task 6: Simulator Web Scanner & Pengujian Klaim Rute di Localhost

**Files:**
- Create: `js/web_qr_scanner_sim.js`
- Modify: `index.html` (Tambahkan modal simulator scanner dan tombol scan di header/sidebar)
- Modify: `public/index.html` & `public/js/` (Mirroring)

**Interfaces:**
- Consumes: Kamera webcam via HTML5 getUserMedia atau simulasi input barcode/kode unik
- Produces: `window.testClaimSJByQR(qrPayloadOrCode, courierUid)`

- [ ] **Step 1: Buat antarmuka simulator scanner di webapp**
  Sediakan modal interaktif "Tes Scan QR Kurir (Localhost Demo)" yang dapat menerima input via kamera webcam atau pengetikan langsung Kode Unik 6-Karakter.

- [ ] **Step 2: Implementasikan logika klaim tugas persis seperti yang akan dijalankan APK KurirKita**
  Saat kode di-scan/dimasukkan:
  - Cek apakah SJ ada di database.
  - Periksa apakah SJ sedang dalam perjalanan transit cabang (Smart Scan Guard).
  - Hubungkan SJ ke kurir yang sedang aktif dan pindahkan status dari `pool` ke `in_progress`.

- [ ] **Step 3: Uji verifikasi serah terima vs penugasan Admin**
  Pastikan bahwa jika Admin sudah menugaskan SJ tersebut ke kurir tertentu, hasil scan memberikan status konfirmasi verifikasi rute tanpa membuat duplikasi.

- [ ] **Step 4: Uji end-to-end seluruh alur di localhost**
  Jalankan siklus lengkap di browser localhost: Import Excel -> Pemilihan Region -> Assign Admin & Scan QR Simulator -> Cek di Monitor Tracking & KPI.

---

### Task 7: Finalisasi, Mirroring ke `public/`, dan Dokumentasi Panduan Pengujian

**Files:**
- Modify: `public/index.html`, `public/js/app.js`, dan file JS baru di `public/js/`
- Verify: Integritas kode dan tidak ada console error saat dibuka di browser

- [ ] **Step 1: Sinkronkan seluruh berkas baru dan modifikasi ke direktori `public/`**
  Salin file-file terupdate ke `public/` agar deployment statis (Netlify/Vercel) dan pengujian localhost memiliki konten yang 100% identik.

- [ ] **Step 2: Pastikan login demo localhost berjalan otomatis tanpa hambatan**
  Pastikan fungsi `loginAsLocalDemoAdmin()` langsung membuka dashboard lengkap dengan seluruh tab baru yang aktif.

- [ ] **Step 3: Buat file panduan pengujian langkah-demi-langkah untuk pengguna di localhost**
  Dokumentasikan cara mencoba import Excel, cara membagi region ke kurir, cara melihat workstation Cikokol, dan cara mencoba cetak/scan QR.
