import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createTables() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 2. TABEL MASTER JENIS KEGIATAN
    console.log('Creating jenis_kegiatan table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.jenis_kegiatan (
        id serial primary key,
        nama_jenis_kegiatan varchar(150) not null unique,
        keterangan text null
      );
    `);

    // Insert jenis kegiatan
    await client.query(`
      INSERT INTO "public"."jenis_kegiatan" ("id", "nama_jenis_kegiatan", "keterangan") 
      VALUES 
        ('1', 'Kebaktian Umum (Ibadah Raya)', 'Ibadah reguler mingguan jemaat umum di Pusat dan Satelit'), 
        ('2', 'Kebaktian Sekolah Minggu', 'Ibadah mingguan khusus anak-anak Sekolah Minggu'), 
        ('3', 'Kebaktian Kaum Muda', 'Ibadah reguler untuk kaum muda/youth'), 
        ('4', 'Kebaktian Kaum Wanita', 'Ibadah reguler bulanan kaum wanita'), 
        ('5', 'Kebaktian Kaum Pria', 'Ibadah reguler bulanan kaum pria'), 
        ('6', 'Kebaktian Senior (Lansia)', 'Ibadah reguler bulanan lansia'), 
        ('7', 'Komsel', 'Kumpulan sel atau KKA (Keluarga Kerajaan Allah) mingguan'), 
        ('8', 'Doa Malam', 'Ibadah doa malam mingguan'), 
        ('9', 'KKR', 'Kebaktian Kebangunan Rohani'), 
        ('10', 'Camp / Retreat', 'Kegiatan retreat tahunan/bulanan berbayar'), 
        ('11', 'Ibadah Padang (Outing)', 'Kegiatan ibadah di luar ruangan / outing'), 
        ('12', 'Besuk Orang Sakit', 'Layanan kunjungan untuk jemaat yang sakit'), 
        ('13', 'Kunjungan Penjara', 'Layanan kunjungan ke lembaga pemasyarakatan'), 
        ('14', 'Layanan Kedukaan', 'Kebaktian penghiburan atau kematian'), 
        ('15', 'Pernikahan', 'Pemberkatan nikah jemaat'), 
        ('16', 'Penyerahan Anak', 'Layanan penyerahan anak ke gereja'), 
        ('17', 'Baptisan Air', 'Layanan baptisan resmi jemaat'), 
        ('18', 'Ibadah Perayaan Khusus', 'Special event seperti Ibadah Natal, Paskah, HUT Gereja'), 
        ('19', 'Seminar / Pelatihan', 'Kegiatan edukasi, training, atau seminar'), 
        ('20', 'Pemilihan Umum (Pemilu)', 'Kegiatan voting untuk Majelis, Gembala Sidang, Pengurus'), 
        ('21', 'Pemeriksaan Kesehatan', 'Layanan kesehatan seperti pemeriksaan darah oleh Departemen Sosial'), 
        ('22', 'Webinar', 'Seminar atau pelatihan yang diselenggarakan secara online')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 3. TABEL MASTER KEGIATAN
    console.log('Creating kegiatan table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.kegiatan (
        id serial primary key,
        kode_kegiatan varchar(50) not null unique,
        nama_kegiatan varchar(200) not null,
        jenis_kegiatan_id integer not null references public.jenis_kegiatan(id),
        satelit_id integer null references public.satelit(id),
        departemen_id integer null references public.departemen(id),
        frekuensi_kegiatan varchar(50) not null,
        tanggal_mulai date not null,
        tanggal_selesai date null,
        waktu_mulai time not null,
        waktu_selesai time null,
        lokasi_kegiatan text null,
        pic_pengurus_id integer null references public.pengurus(id),
        berbayar boolean null default false,
        status_kegiatan varchar(50) default 'Draft',
        created_at timestamp without time zone null default CURRENT_TIMESTAMP
      );
    `);

    // 4A. DETAIL IBADAH
    console.log('Creating kegiatan_detail_ibadah table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.kegiatan_detail_ibadah (
        kegiatan_id integer primary key references public.kegiatan(id) on delete CASCADE,
        tema_khotbah varchar(200) null,
        nama_pengkhotbah_1 varchar(150) null,
        nama_pengkhotbah_2 varchar(150) null,
        jumlah_pengunjung_baru integer default 0
      );
    `);

    // 4B. DETAIL LAYANAN PERSONAL
    console.log('Creating kegiatan_detail_layanan_personal table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.kegiatan_detail_layanan_personal (
        kegiatan_id integer primary key references public.kegiatan(id) on delete CASCADE,
        jemaat_target_1_id integer null references public.jemaat(id),
        jemaat_target_2_id integer null references public.jemaat(id),
        keterangan_layanan text null
      );
    `);

    // 4C. DETAIL EKSTERNAL
    console.log('Creating kegiatan_detail_eksternal table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.kegiatan_detail_eksternal (
        kegiatan_id integer primary key references public.kegiatan(id) on delete CASCADE,
        biaya_pendaftaran_rp numeric(15,2) default 0,
        akomodasi text null
      );
    `);

    // 5. TABEL ABSENSI
    console.log('Creating kegiatan_absensi table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.kegiatan_absensi (
        id serial primary key,
        kegiatan_id integer not null references public.kegiatan(id) on delete CASCADE,
        jemaat_id integer null references public.jemaat(id),
        nama_pengunjung varchar(150) null,
        role_kehadiran varchar(50) not null,
        metode_absensi varchar(50) default 'Manual',
        status_kehadiran varchar(30) default 'Hadir',
        waktu_hadir timestamp without time zone null default CURRENT_TIMESTAMP
      );
    `);

    // 6. TABEL LPJ
    console.log('Creating kegiatan_lpj table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.kegiatan_lpj (
        kegiatan_id integer primary key references public.kegiatan(id) on delete CASCADE,
        laporan_naratif text not null,
        file_dokumen_lpj text null,
        diajukan_oleh_id integer null references public.pengguna(id),
        waktu_submit timestamp without time zone null default CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');
    console.log('Migration successful!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

createTables();
