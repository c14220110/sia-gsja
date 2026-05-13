// Migration script: Add review columns for RA workflow
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting migration...');

    // 1. anggaran_tahunan: tambah kolom reviewer + RA baru
    await client.query(`
      ALTER TABLE public.anggaran_tahunan 
        ADD COLUMN IF NOT EXISTS reviewed_by integer,
        ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
        ADD COLUMN IF NOT EXISTS kategori_ra character varying DEFAULT 'Kegiatan',
        ADD COLUMN IF NOT EXISTS pola_penggunaan character varying DEFAULT 'Sekali Pakai';
    `);
    console.log('✅ anggaran_tahunan: kolom reviewed_by, reviewed_at, kategori_ra, pola_penggunaan ditambah');

    // FK untuk reviewed_by
    try {
      await client.query(`
        ALTER TABLE public.anggaran_tahunan
          ADD CONSTRAINT fk_anggaran_reviewed_by 
          FOREIGN KEY (reviewed_by) REFERENCES public.pengguna(id);
      `);
      console.log('✅ FK fk_anggaran_reviewed_by ditambah');
    } catch (e) {
      if (e.code === '42710') console.log('ℹ️  FK fk_anggaran_reviewed_by sudah ada, skip');
      else throw e;
    }

    // 2. anggaran_tahunan_detail: rename status_peruntukkan → status_item
    try {
      await client.query(`
        ALTER TABLE public.anggaran_tahunan_detail 
          RENAME COLUMN status_peruntukkan TO status_item;
      `);
      console.log('✅ Rename status_peruntukkan → status_item');
    } catch (e) {
      if (e.code === '42703') console.log('ℹ️  status_peruntukkan sudah di-rename atau tidak ada, skip');
      else throw e;
    }

    // 3. tambah updated_at
    await client.query(`
      ALTER TABLE public.anggaran_tahunan_detail 
        ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
    `);
    console.log('✅ anggaran_tahunan_detail: kolom updated_at ditambah');

    console.log('\n🎉 Migration selesai!');
  } catch (error) {
    console.error('❌ Migration gagal:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
