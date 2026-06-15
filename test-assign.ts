import { Pool } from 'pg';
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('1. Fetch ticket');
    const checkRes = await client.query(`
        SELECT p.id, p.status_permohonan, p.jenis_kegiatan_id, p.lokasi_pelayanan, p.jemaat_pemohon_id, p.nomor_tiket, jk.nama_jenis_kegiatan
        FROM public.permohonan_layanan_pastoral p
        LEFT JOIN public.jenis_kegiatan jk ON p.jenis_kegiatan_id = jk.id
        WHERE p.status_permohonan = 'Menunggu' LIMIT 1
      `);
    if (checkRes.rows.length === 0) throw new Error('No tickets found');
    const ticket = checkRes.rows[0];
    console.log('Ticket:', ticket);

    console.log('2. Fetch pengurus');
    const pelayanRes = await client.query(`
        SELECT p.id as pengurus_id, pel.id as pelayan_id
        FROM public.pengurus p
        JOIN public.pelayan pel ON p.jemaat_id = pel.jemaat_id
        LIMIT 1
      `);
    const { pengurus_id, pelayan_id } = pelayanRes.rows[0];
    console.log('Pengurus:', pengurus_id, 'Pelayan:', pelayan_id);

    console.log('3. generate kode kegiatan');
    const tanggal_fix = '2026-06-09';
    const waktu_fix = '13:26';

    const d = new Date(tanggal_fix);
    const yy = d.getFullYear().toString().slice(-2);
    const resMeta = await client.query(`
      SELECT kode_singkatan, LPAD(EXTRACT(WEEK FROM $1::date)::text, 2, '0') as week_num
      FROM public.jenis_kegiatan WHERE id = $2
    `, [d, ticket.jenis_kegiatan_id]);

    const singkatan = (resMeta.rows.length > 0 && resMeta.rows[0].kode_singkatan) ? resMeta.rows[0].kode_singkatan.trim().toUpperCase() : 'KG';
    const weekNum = resMeta.rows.length > 0 ? resMeta.rows[0].week_num : '01';
    const prefix = `${singkatan}${weekNum}${yy}`;
    
    console.log('4. Create Kegiatan');
    const kegiatanRes = await client.query(
      `INSERT INTO public.kegiatan (
        kode_kegiatan, nama_kegiatan, jenis_kegiatan_id, 
        tanggal_mulai, waktu_mulai, frekuensi_kegiatan, lokasi_kegiatan, status_kegiatan, 
        is_published, butuh_registrasi, pic_pengurus_id
      ) VALUES ($1, $2, $3, $4, $5, 'Sekali', $6, 'Akan Datang', false, false, $7) RETURNING id`,
      [`${prefix}001`, 'Test Kegiatan', ticket.jenis_kegiatan_id, tanggal_fix, waktu_fix, ticket.lokasi_pelayanan, pengurus_id]
    );
    const kegiatanId = kegiatanRes.rows[0].id;
    console.log('Kegiatan ID:', kegiatanId);

    console.log('5. Link Kegiatan & Pelayan');
    await client.query(
      `INSERT INTO public.kegiatan_jadwal_pelayan (kegiatan_id, pelayan_id, role_id, status_konfirmasi) 
       VALUES ($1, $2, (SELECT id FROM public.role_pelayan WHERE nama_role = 'Staf Pastoral'), 'Menunggu Konfirmasi')`,
      [kegiatanId, pelayan_id]
    );
    console.log('Linked');

  } catch(e) {
    console.error('ERROR OCCURRED:', e);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    process.exit(0);
  }
}

main();
