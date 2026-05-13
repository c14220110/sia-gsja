const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.stqsbfmhdemyxtyltivs:rDLmkVZkz1UPnU9l@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  console.log('Connected to DB');

  try {
    // 1. Rename table anggaran_tahunan to rancangan_anggaran
    await client.query(`ALTER TABLE public.anggaran_tahunan RENAME TO rancangan_anggaran`);
    console.log('Renamed table anggaran_tahunan to rancangan_anggaran');

    // Rename primary key constraint
    await client.query(`ALTER TABLE public.rancangan_anggaran RENAME CONSTRAINT anggaran_tahunan_pkey TO rancangan_anggaran_pkey`);
    console.log('Renamed primary key constraint');
  } catch (err) {
    console.log('Note: Table might already be renamed or constraint missing. Error:', err.message);
  }

  try {
    // 2. Add new columns to rancangan_anggaran
    await client.query(`ALTER TABLE public.rancangan_anggaran ADD COLUMN kode_ra VARCHAR UNIQUE`);
    await client.query(`ALTER TABLE public.rancangan_anggaran ADD COLUMN tipe_ra VARCHAR`);
    await client.query(`ALTER TABLE public.rancangan_anggaran ADD COLUMN nama_rancangan VARCHAR`);
    await client.query(`ALTER TABLE public.rancangan_anggaran ADD COLUMN estimasi_waktu VARCHAR`);
    console.log('Added new columns: kode_ra, tipe_ra, nama_rancangan, estimasi_waktu');
  } catch (err) {
    console.log('Note: Columns might already exist. Error:', err.message);
  }

  try {
    // 3. Rename table anggaran_tahunan_detail to rancangan_anggaran_detail
    await client.query(`ALTER TABLE public.anggaran_tahunan_detail RENAME TO rancangan_anggaran_detail`);
    await client.query(`ALTER TABLE public.rancangan_anggaran_detail RENAME CONSTRAINT anggaran_tahunan_detail_pkey TO rancangan_anggaran_detail_pkey`);
    console.log('Renamed table anggaran_tahunan_detail to rancangan_anggaran_detail');
  } catch (err) {
    console.log('Note: Detail table might already be renamed. Error:', err.message);
  }

  try {
    // 4. Rename foreign key column in detail table
    await client.query(`ALTER TABLE public.rancangan_anggaran_detail RENAME COLUMN anggaran_tahunan_id TO rancangan_anggaran_id`);
    console.log('Renamed column anggaran_tahunan_id to rancangan_anggaran_id');
  } catch(err) {
    console.log('Note: Column might already be renamed. Error:', err.message);
  }

  try {
    // 5. Update foreign key constraints
    await client.query(`ALTER TABLE public.rancangan_anggaran_detail RENAME CONSTRAINT fk_detail_anggaran TO fk_detail_rancangan_anggaran`);
  } catch (err) {
    console.log('Note: Constraint might already be renamed. Error:', err.message);
  }

  try {
    // 6. Fix missing UUIDs or backfill kode_ra if null
    await client.query(`
      UPDATE public.rancangan_anggaran 
      SET kode_ra = 'RA-' || tahun || '-' || LPAD(floor(random()*1000)::text, 3, '0') 
      WHERE kode_ra IS NULL;
    `);
    
    await client.query(`
      UPDATE public.rancangan_anggaran 
      SET tipe_ra = 'Kegiatan Rutin', nama_rancangan = 'Rancangan Anggaran ' || tahun, estimasi_waktu = 'Sepanjang Tahun' 
      WHERE nama_rancangan IS NULL;
    `);
    console.log('Backfilled existing rows with default values.');
  } catch (err) {
    console.log('Note: Failed to backfill rows. Error:', err.message);
  }

  console.log('Migration completed successfully.');
  await client.end();
}

main().catch(console.error);
