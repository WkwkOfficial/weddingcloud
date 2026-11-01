const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(express.json());

// Konfigurasi Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Konfigurasi Multer (Simpan file sementara di memory sebelum di-upload ke Supabase)
const upload = multer({ storage: multer.memoryStorage() });

// Endpoint Utama untuk Upload Galeri
app.post('/api/galleries', upload.single('file'), async (req, res) => {
  try {
    const { invitationId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
    }

    // Buat nama file unik berdasarkan waktu
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1000)}.${fileExt}`;
    const filePath = `gallery/${fileName}`;

    // Upload ke Supabase Storage (Bucket: galleries)
    const { data: storageData, error: storageError } = await supabase.storage
      .from('galleries')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (storageError) {
      console.error('Error Supabase:', storageError);
      return res.status(500).json({ error: 'Gagal upload ke Supabase' });
    }

    // Ambil Public URL dari file yang di-upload
    const { data: publicUrlData } = supabase.storage
      .from('galleries')
      .getPublicUrl(filePath);

    // Kirim respons sukses
    return res.status(201).json({
      message: 'Upload galeri berhasil!',
      object_key: filePath,
      public_url: publicUrlData.publicUrl,
      file_name: file.originalname,
      file_size: file.size,
      mime_type: file.mimetype,
      invitation_id: invitationId
    });

  } catch (err) {
    console.error('Server Error:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server' });
  }
});

// Jalankan server lokal jika bukan di environment production (Vercel)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server Backend berjalan di http://localhost:${PORT}`);
  });
}

// WAJIB ADA AGAR BISA DI-DEPLOY KE VERCEL
module.exports = app;