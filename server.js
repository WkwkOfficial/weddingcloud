const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const pool = require('./db');

// 1. Inisialisasi Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
app.use(express.json());

// Konfigurasi Multer untuk menahan file di RAM sementara
const upload = multer({ storage: multer.memoryStorage() });

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend Wedding (Supabase Storage) Running!' });
});

// 2. Endpoint Upload ke Supabase & PostgreSQL
app.post('/api/galleries', upload.single('file'), async (req, res) => {
  try {
    const { invitationId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'File foto wajib diupload' });
    }

    // Buat nama unik untuk file
    const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
    
    // Upload ke bucket Supabase bernama 'galleries'
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('galleries')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('Error Supabase:', uploadError);
      return res.status(500).json({ error: 'Gagal upload ke Supabase' });
    }

    // Dapatkan Public URL langsung dari Supabase
    const { data: publicUrlData } = supabase
      .storage
      .from('galleries')
      .getPublicUrl(fileName);
      
    const publicUrl = publicUrlData.publicUrl;

    // Simpan data dan URL ke tabel PostgreSQL kamu
    const query = `
      INSERT INTO invitation_galleries (invitation_id, object_key, file_name, file_size, mime_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    if (!invitationId) {
  return res.status(400).json({
    error: "invitationId wajib diisi"
  });
}

const values = [
  invitationId,
  fileName,
  file.originalname,
  file.size,
  file.mimetype
];
    const result = await pool.query(query, values);

    // Kirim respons sukses ke Thunder Client
    res.status(201).json({
      message: 'Foto berhasil mendarat di Supabase & Database!',
      publicUrl: publicUrl,
      data: result.rows[0],
    });

  } catch (error) {
    console.error('Error Server:', error);
    res.status(500).json({ error: 'Gagal memproses request' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server Backend berjalan di http://localhost:${PORT}`);
});