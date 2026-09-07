export default async function handler(req, res) {
  // Hanya menerima metode POST
  if (req.method === 'POST') {
    try {
      const data = req.body;
      console.log("[DATA SURAT JALAN DITERIMA]:", data);

      // Data dari kasir (nomor SJ, kode_scan, klien) siap disimpan ke database
      return res.status(200).json({
        success: true,
        message: "Data berhasil diterima oleh Vercel",
        data: data
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    // Respon jika diakses via GET browser biasa
    return res.status(200).json({ status: "API Surat Jalan Aktif" });
  }
}