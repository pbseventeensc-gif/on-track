# Master Data Operator & Bulk Production Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun modul Master Data Operator Mesin (dengan alokasi mesin yang dijalankan), fitur Jadwal Masal (Bulk / Batch Scheduling) untuk memproses ratusan SPK sekaligus ke mesin & operator, serta merapikan seluruh modul produksi ke dalam satu folder terpusat (`js/production/` & `css/production/`).

**Architecture:**
- **Folder Modular (`js/production/`):**
  - `operator_master.js`: Master data operator, shift, sertifikasi/penugasan mesin, status kerja.
  - `machine_master.js`: Master mesin 4 branch (DM 1, DM 2, DM 3, Cikokol).
  - `spk_scheduler.js`: Batch scheduling engine untuk mengalokasikan ratusan SPK sekaligus ke branch, mesin, operator, shift, dan prioritas.
- **Master Operator:** Menyimpan data operator ke `wtrack_operators_v1`, memuat daftar mesin reaktif dari `MachineMaster`, mendukung CRUD, filter 4 branch, dan integrasi penugasan.
- **Bulk Scheduling:** Modal `#modal-spk-bulk-schedule` memungkinkan pemilihan banyak SPK (puluhan/ratusan via checkbox), lalu dengan 1 klik menetapkan Branch, Mesin, Operator yang bertugas, Shift, Prioritas (Normal/Urgent), dan Target Tanggal.
- **Localhost Preview:** Berjalan aktif di server lokal sandbox: `http://localhost:3000`.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5 `<dialog>` / Bootstrap 5 Modal, Node.js `node:test`.

**Spec:** Kebutuhan operasional penanganan ratusan SPK per hari tanpa assign satu per satu, pencatatan operator mesin, serta penataan kode dalam satu folder terstruktur.

## Global Constraints
- Seluruh kode modul produksi harus berada di dalam folder khusus: `js/production/` dan `css/production/`.
- Tipografi dan desain tabel wajib konsisten dengan standar Dashboard (`Inter`, font 12px/13px, header weight 500, height button 32px, border `#EAECF0`).
- Validasi data ketat: operator hanya dapat ditugaskan jika statusnya aktif; dropdown mesin membaca dari `MachineMaster`.
- Perubahan disinkronkan ke `public/` dan `app/src/main/assets/` menggunakan `node scripts/sync-web-assets.cjs`.
- Server lokal sandbox diakses melalui `http://localhost:3000`.

## Review Focus
1. Batch Scheduling: ratusan SPK yang dicentang harus ter-update serentak tanpa blocking antarmuka atau kehilangan data spesifikasi barang.
2. Relasi Operator ke Mesin: penugasan operator pada modal jadwal harus otomatis menyaring operator yang kompeten menjalankan mesin terpilih.
3. Struktur File: tidak boleh ada kode yang menumpuk panjang menjadi satu file raksasa; pisahkan modul operator, mesin, dan scheduler secara rapi di `js/production/`.
4. Multi-select Mesin Operator: operator dapat mengoperasikan lebih dari 1 mesin (misal: Rian mengoperasikan EPSON S80 dan EPSON S60X2).
5. Filter & Pencarian: tabel operator dan antrian jadwal harus responsif terhadap pencarian nama dan filter branch.

---

### Task 1: Modul Master Data Operator (`js/production/operator_master.js`)

**Files:**
- Create: `js/production/operator_master.js`
- Create: `css/production/production.css`
- Modify: `index.html` (sidebar navigasi Master Data $\rightarrow$ Operator Mesin, view container `#view-operator-master`)
- Test: `tests/operator-master.test.cjs`

**Steps:**
- [x] Buat file test `tests/operator-master.test.cjs` untuk menguji:
  - Pre-seeding data awal operator di 4 branch (DM 1, DM 2, DM 3, Cikokol).
  - Tambah operator baru (Add Operator).
  - Ubah data operator dan daftar mesin yang dijalankannya (Edit Operator).
  - Toggle status operator (Aktif / Libur / Cuti).
  - Filter operator berdasarkan branch dan pencarian nama.
  - Helper `getOperatorsForMachine(machineName, branch)` untuk menyaring operator yang memegang mesin tertentu.
- [x] Buat `js/production/operator_master.js`:
  - Storage key: `wtrack_operators_v1`.
  - Default seed operator Wellen (Budi, Hendra di DM 1; Rian, Agus, Dani, Eko di DM 2; Joko, Arif di DM 3; Fajar di Cikokol).
  - CRUD logic: `read()`, `write()`, `add()`, `edit(id)`, `save()`, `toggleStatus(id)`, `deleteOperator(id)`, `filterBranch(branch)`, `search(query)`.
  - Helper: `getOperatorsForMachine(machineName, branch)` dan `getOperatorsForBranch(branch)`.
  - Render tabel aerotrack bersih berstandar Dashboard.
  - Modal editor dialog `#operator-editor` dengan multi-checkbox mesin yang diambil dari `MachineMaster.read()`.
- [x] Buat `css/production/production.css` untuk styling badge operator, shift pill, dan styling modal.
- [x] Daftarkan menu "Operator Mesin" di sidebar `index.html` pada grup Master Data dan pasang script `<script src="/js/production/operator_master.js"></script>`.
- [x] Jalankan test `node --test tests/operator-master.test.cjs` dan pastikan lulus.

---

### Task 2: Modul Bulk / Batch Production Scheduling (`js/production/spk_scheduler.js`)

**Files:**
- Create: `js/production/spk_scheduler.js`
- Modify: `index.html` (modal `#modal-spk-bulk-schedule` dan tombol di toolbar SPK)
- Modify: `js/spk_manager.js` (integrasi trigger batch scheduling)
- Test: `tests/spk-bulk-scheduler.test.cjs`

**Steps:**
- [x] Buat file test `tests/spk-bulk-scheduler.test.cjs` untuk menguji:
  - `scheduleBatchSPK(spkList, targetIds, scheduleOptions)`:
    - Menjadwalkan banyak SPK sekaligus ke Branch, Mesin, Operator, Shift, dan Prioritas tertentu.
    - Menetapkan status `scheduled` dan target waktu mulai.
    - Menolak jika daftar target SPK kosong atau mesin tidak dipilih.
  - Perhitungan kapasitas beban mesin: `calculateMachineWorkload(spkList, machineName)`.
- [x] Buat `js/production/spk_scheduler.js`:
  - Logika core `scheduleBatchSPK(list, targetIds, options)`.
  - UI Handler:
    - `openBulkScheduleModal(source)`: membuka dialog untuk SPK yang terpilih di preview atau antrian utama.
    - `onScheduleBranchChange(branch)`: memicu update dropdown mesin dan operator yang relevan.
    - `onScheduleMachineChange(machineName)`: otomatis menyaring dropdown operator ke operator yang bersertifikasi memegang mesin tersebut.
    - `applyBulkSchedule()`: menerapkan jadwal ke seluruh SPK terpilih secara instan.
- [x] Di `index.html`:
  - Tambahkan tombol **`⚡ Jadwalkan Masal`** di toolbar modal import preview SPK dan toolbar antrian SPK (`view-spk`).
  - Tambahkan modal dialog `#modal-spk-bulk-schedule`:
    - Ringkasan: jumlah SPK terpilih (`X SPK Terpilih`).
    - Input: Cabang Tujuan, Mesin Tujuan (dari `MachineMaster`), Operator Bertugas (dari `OperatorMaster`), Shift (Pagi/Siang/Malam), Prioritas (Normal/Urgent/Rush), Target Tanggal.
- [x] Jalankan test `node --test tests/spk-bulk-scheduler.test.cjs`.

---

### Task 3: Restrukturisasi File ke Folder Terpusat (`js/production/`)

**Files:**
- Move / Sync: `js/machine_master.js` $\rightarrow$ `js/production/machine_master.js`
- Modify: `index.html` (sesuaikan path script)
- Modify: `scripts/sync-web-assets.cjs` (pastikan folder `js/production/` dan `css/production/` tersinkron)

**Steps:**
- [x] Salin/pindahkan `js/machine_master.js` ke `js/production/machine_master.js` (dan simpan shim di `js/machine_master.js` agar kompatibel).
- [x] Pastikan seluruh file master dan alur produksi Wellen berada di:
  - `js/production/operator_master.js`
  - `js/production/machine_master.js`
  - `js/production/spk_scheduler.js`
  - `css/production/production.css`
- [x] Jalankan `node scripts/sync-web-assets.cjs`.
- [x] Jalankan seluruh test suite `node --test tests/*.test.cjs`.

---

### Task 4: Sinkronisasi Aset & Verifikasi di Localhost

**Files:**
- Output: `public/`, `app/src/main/assets/`

**Steps:**
- [x] Jalankan `node scripts/sync-web-assets.cjs`.
- [x] Verifikasi seluruh test lulus: `npm test`.
- [x] Akses server lokal di browser pada URL `http://localhost:3000`:
  - Buka menu **Master Data $\rightarrow$ Operator Mesin**: periksa tampilan operator, daftar mesin yang dioperasikan, filter branch, dan tambah/edit.
  - Buka **Import SPK**: centang beberapa SPK, klik tombol **Jadwalkan Masal**, pilih branch/mesin/operator, dan terapkan.
  - Pastikan seluruh SPK yang dipilih langsung terjadwal bersamaan tanpa error console.
