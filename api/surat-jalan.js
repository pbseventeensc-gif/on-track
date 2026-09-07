export default async function handler(req, res) {
  // Set CORS Headers agar Kasir / Sistem POS dari mana saja bisa mengirim data
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Menerima metode POST dari Kasir / Sistem POS
  if (req.method === 'POST') {
    try {
      const data = req.body;
      console.log("[DATA SURAT JALAN DITERIMA DARI KASIR]:", data);

      return res.status(200).json({
        success: true,
        message: "Data Surat Jalan berhasil diterima oleh Vercel",
        timestamp: new Date().toISOString(),
        data: data
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    // Respon jika diakses via GET browser biasa
    return res.status(200).json({
      status: "API Surat Jalan Wellen Print Aktif",
      endpoint: "/api/surat-jalan",
      method: "POST"
    });
  }
}