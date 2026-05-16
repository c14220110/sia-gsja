const { Pool } = require('pg');
const pool = new Pool({ connectionString: "postgresql://postgres.stqsbfmhdemyxtyltivs:rDLmkVZkz1UPnU9l@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres" });

async function seed() {
  try {
    console.log('Inserting LPJ header for ID 81...');
    await pool.query(`
      INSERT INTO "public"."kegiatan_lpj" 
      ("kegiatan_id", "laporan_naratif", "file_dokumen_lpj", "diajukan_oleh_id", "waktu_submit", "total_subsidi_gereja", "total_kontribusi_peserta", "total_pengeluaran", "sisa_dana", "status_lpj") 
      VALUES (81, 'Aman si acaranya', null, null, '2026-05-13 09:32:15.591381', '0', '0', '400000', '3100000', 'Menunggu Review')
      ON CONFLICT (kegiatan_id) DO UPDATE SET 
        laporan_naratif = EXCLUDED.laporan_naratif,
        status_lpj = EXCLUDED.status_lpj;
    `);
    
    console.log('Inserting LPJ details for ID 81...');
    // Delete existing details first to avoid duplicates since we don't have PKs on details in the user's insert
    await pool.query('DELETE FROM "public"."kegiatan_lpj_detail" WHERE kegiatan_id = 81');
    await pool.query(`
      INSERT INTO "public"."kegiatan_lpj_detail" 
      ("kegiatan_id", "jenis_anggaran", "coa_id", "sumber_dana", "uraian", "deskripsi", "jumlah", "satuan", "harga_satuan", "created_at") 
      VALUES 
      (81, 'Pengeluaran', 145, 'Kas Mandiri', 'Makan 52x', null, '1', 'Kali', '400000', '2026-05-13 09:32:15.591381'), 
      (81, 'Penerimaan', 76, 'Kas Mandiri', 'Kolekte', null, '1', 'Sesi', '3500000', '2026-05-13 09:32:15.591381');
    `);
    
    console.log('Seed successful for ID 81!');
  } catch (e) {
    console.error('Seed failed:', e);
  } finally {
    await pool.end();
  }
}
seed();
