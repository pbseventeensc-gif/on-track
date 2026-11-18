# Master Bahan (No SKU) & Master Mesin Produksi (Add & Edit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan kolom No. SKU pada Master Bahan (Material Master) dan membangun modul Database Mesin Produksi (Machine Master) 4 Branch (DM 1, DM 2, DM 3, Cikokol) dengan fitur Add & Edit dinamis, mengikuti sistem tipografi dan desain antarmuka Dashboard tanpa AI slop.

**Architecture:**
- **Master Bahan (SKU):** Memperluas `MaterialMaster` (`js/material_master.js`, `css/material_master.css`) dengan kolom `sku`, input form modal, pencarian SKU, serta pemetaan awal dari data `Database Materials/Database_Material_Digital_Printing.xlsx`.
- **Master Mesin (Machine Master):** Membuat modul `MachineMaster` (`js/machine_master.js`) dengan penyimpanan persisten `wtrack_machines_v1`, pre-seeded dengan mesin riil Wellen (DM1, DM2 Indoor/Outdoor, DM3, Cikokol), modal editor Add & Edit mesin, dan integrasi view di dashboard.
- **Konsistensi UI:** Mengikuti standar token tipografi Dashboard (Inter, header 500, font-size 11px/12px/13px, border `#EAECF0`, tombol `32px`).

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5 `<dialog>` & modal, Bootstrap 5 utilitas, SheetJS (`xlsx`), Node.js `node:test`.

**Spec:** Diskusi arsitektur SPK, pembagian 4 Branch & mesin Wellen, dan penambahan kolom No. SKU pada database bahan.

## Global Constraints
- Jangan menggunakan generic placeholder atau styling sembarangan (No AI slop).
- Tipografi wajib konsisten dengan standar Dashboard (`Inter`, table header weight `500 !important`, font 11px-13px, height button 32px, border `#EAECF0`).
- Semua perubahan di `js/` dan `css/` harus disinkronkan ke `public/` dan `app/src/main/assets/` menggunakan `node scripts/sync-web-assets.cjs`.
- Dapat diuji dan dijalankan secara penuh di localhost (`npm run local`).

## Review Focus
1. Master bahan harus menerima SKU kosong tanpa merusak pencarian, kalkulasi berat, atau import Excel.
2. Tambah dan Edit mesin harus memvalidasi nama mesin dan branch, serta menyimpan status aktif/maintenance secara persisten.
3. Mesin awal Wellen (DM1: 5 mesin, DM2: 6 indoor + 2 outdoor types, DM3: 3 mesin, Cikokol: Indigo A3) harus ter-seed otomatis saat pertama kali dibuka.
4. Tampilan tabel harus responsif di desktop maupun tablet tanpa overflow yang merusak layout.
5. Unit test wajib memverifikasi CRUD mesin dan kolom SKU bahan secara independen.

---

### Task 1: Tambah Kolom No. SKU pada Master Bahan (`MaterialMaster`)

**Files:**
- Modify: `js/material_master.js`
- Modify: `css/material_master.css`
- Modify: `js/material_seed.js`
- Test: `tests/material-sku.test.cjs`

**Steps:**
- [x] Buat file test `tests/material-sku.test.cjs` untuk menguji:
  - Field `sku` tersimpan saat Add dan Edit bahan.
  - Nilai SKU kosong tetap valid (`—` di tabel).
  - Pencarian bisa menemukan bahan berdasarkan SKU.
- [x] Di `js/material_master.js`:
  - Tambahkan kolom `<col style="width:130px">` dan `<th>No. SKU</th>` pada `render()`.
  - Tampilkan `${esc(row.sku || '—')}` pada baris tabel dengan font monospace.
  - Tambahkan input `No. SKU` pada modal dialog `#material-editor`.
  - Update fungsi `edit()`, `add()`, dan `save()` untuk membaca dan menyimpan `sku`.
  - Update `search()` agar pencocokan juga mencakup `row.sku`.
- [x] Di `css/material_master.css`:
  - Tambahkan styling kelas `.mm-sku` (font monospace, warna teks rapi).
- [x] Jalankan `node --test tests/material-sku.test.cjs tests/material-master.test.cjs` untuk memastikan semua test lulus.

---

### Task 2: Modul Database Mesin Produksi (`MachineMaster`) dengan Fitur Add & Edit

**Files:**
- Create: `js/machine_master.js`
- Create: `css/machine_master.css`
- Modify: `index.html` (tambahkan section view dan navigasi menu Master Mesin)
- Test: `tests/machine-master.test.cjs`

**Steps:**
- [x] Buat test `tests/machine-master.test.cjs` untuk menguji:
  - Pre-seeding data awal mesin 4 branch (DM 1, DM 2 Indoor/Outdoor, DM 3, Cikokol).
  - Fitur Tambah Mesin baru (Add Machine).
  - Fitur Ubah Data Mesin (Edit Machine).
  - Toggle status mesin (Aktif / Maintenance).
- [x] Buat `js/machine_master.js`:
  - Storage key: `wtrack_machines_v1`.
  - Seed default data:
    - DM 1: SQ IMPALA 5, SUMMA, YH 13, LASER, DOCAN.
    - DM 2 Indoor: EPSON S60X2 (3 unit), EPSON S80 (4 unit), LATEX (1 unit), UV PULMEN (1 unit), JWEI 3.2 (1 unit), JWEI 1.6 (2 unit).
    - DM 2 Outdoor: 1024 i lebar 3.2 (3 unit), 512i lebar 3.2 (5 unit).
    - DM 3: EFI MATAN 5M (2 unit), Seaming, Roland ECO (1 unit - Proof).
    - Cikokol: HP Indigo A3.
  - Fungsi CRUD: `add()`, `edit(id)`, `save()`, `toggleStatus(id)`, `filterBranch(branch)`.
  - Render tabel aerotrack dengan tipografi konsisten Dashboard (header 500, font 12px, badge status, aksi edit & toggle).
  - Modal editor dialog `#machine-editor` untuk input nama, branch, sub-kategori, kapasitas lebar, dan status.
- [x] Buat `css/machine_master.css` untuk styling tabel dan badge mesin.
- [x] Daftarkan script dan link menu di `index.html` pada grup Master Data.
- [x] Jalankan test `node --test tests/machine-master.test.cjs`.

---

### Task 3: Sinkronisasi Aset & Verifikasi Localhost

**Files:**
- Modify: `scripts/sync-web-assets.cjs`
- Output Sync: `public/`, `app/src/main/assets/`

**Steps:**
- [x] Jalankan `node scripts/sync-web-assets.cjs` untuk menyalin file `js/` dan `css/` ke `public/` dan `app/src/main/assets/`.
- [x] Jalankan seluruh test suite: `npm test`.
- [x] Verifikasi di environment local server (`npm run local`) bahwa halaman dapat dibuka di browser tanpa error console.
