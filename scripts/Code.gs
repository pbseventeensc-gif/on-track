/**
 * WTrack - Google Apps Script Backend for Google Drive 5TB Storage
 * 
 * Fitur:
 * 1. Menerima upload foto baru langsung dari HP Kurir (Android) & Web Admin via base64.
 * 2. Menerima migrasi foto lama via imageUrl (Google mengunduh langsung antar-server secara cepat).
 * 3. Otomatis membuat struktur folder rapi:
 *    KurirTrack_Uploads / [YYYY-MM] / [DD-MM-YYYY] / [nama_file].jpg
 * 4. Otomatis set izin "Anyone with link can view" agar foto langsung tampil di Dashboard Web & Aplikasi Android.
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Tidak ada data yang dikirim (postData kosong)");
    }

    var data = JSON.parse(e.postData.contents);

    // 1. Dapatkan atau buat Folder Utama: "KurirTrack_Uploads"
    var rootFolderName = "KurirTrack_Uploads";
    var rootFolder;
    var rootFolders = DriveApp.getFoldersByName(rootFolderName);
    if (rootFolders.hasNext()) {
      rootFolder = rootFolders.next();
    } else {
      rootFolder = DriveApp.createFolder(rootFolderName);
      rootFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    // 2. Tentukan Tanggal & Bulan Folder Pengiriman
    var folderDate = data.folderDate;
    var monthFolder = data.monthFolder;

    if (!folderDate) {
      var now = new Date();
      monthFolder = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM");
      folderDate = Utilities.formatDate(now, "Asia/Jakarta", "dd-MM-yyyy");
    } else if (!monthFolder) {
      var parts = folderDate.split('-');
      if (parts.length === 3) {
        monthFolder = parts[2] + "-" + parts[1];
      } else {
        monthFolder = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM");
      }
    }

    // Buat/ambil Subfolder Bulan (contoh: "2026-10")
    var monthFld;
    var mItr = rootFolder.getFoldersByName(monthFolder);
    if (mItr.hasNext()) {
      monthFld = mItr.next();
    } else {
      monthFld = rootFolder.createFolder(monthFolder);
      monthFld.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    // Buat/ambil Subfolder Tanggal (contoh: "17-10-2026")
    var targetFolder;
    var dItr = monthFld.getFoldersByName(folderDate);
    if (dItr.hasNext()) {
      targetFolder = dItr.next();
    } else {
      targetFolder = monthFld.createFolder(folderDate);
      targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    // 3. Konversi data menjadi Blob File
    var filename = data.filename || ("photo_" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd_HHmmss") + ".jpg");
    var contentType = data.contentType || "image/jpeg";
    var blob;

    if (data.imageUrl) {
      // Transfer langsung antar server (Cloudinary -> Google Drive)
      var response = UrlFetchApp.fetch(data.imageUrl, { muteHttpExceptions: true });
      var code = response.getResponseCode();
      if (code >= 200 && code < 300) {
        blob = response.getBlob();
        blob.setName(filename);
      } else {
        throw new Error("Gagal mengambil gambar dari sumber URL (HTTP " + code + ")");
      }
    } else if (data.base64Data) {
      // Upload langsung dari HP kurir / Web Admin
      var decoded = Utilities.base64Decode(data.base64Data);
      blob = Utilities.newBlob(decoded, contentType, filename);
    } else {
      throw new Error("Wajib menyertakan 'imageUrl' atau 'base64Data'");
    }

    // 4. Simpan file ke target folder
    var file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId = file.getId();
    // URL langsung CDN Google tanpa batasan tampilan
    var directUrl = "https://lh3.googleusercontent.com/d/" + fileId;
    var ucUrl = "https://drive.google.com/uc?export=view&id=" + fileId;

    var result = {
      status: "success",
      fileId: fileId,
      url: directUrl,
      ucUrl: ucUrl,
      viewUrl: file.getUrl(),
      path: rootFolderName + "/" + monthFolder + "/" + folderDate + "/" + filename
    };

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    service: "WTrack Google Drive 5TB Integration",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
