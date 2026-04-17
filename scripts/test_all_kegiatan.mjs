// test_all_kegiatan.mjs — POST semua 24 jenis kegiatan ke API

const BASE = 'http://localhost:3000/api/kegiatan';
const today = '2026-04-20';
const STATUS = 'Akan Datang'; // valid enum: 'Draft' | 'Akan Datang'

const testData = [
  // IBADAH RUTIN (11 entries: id 1,2,3,4,5,6,7,8,24,25,28)
  { nama_kegiatan: 'Kebaktian Umum Minggu Pagi — Satelit Pusat', jenis_kegiatan_id: '1', frekuensi_kegiatan: 'Mingguan', tanggal_mulai: today, waktu_mulai: '08:00', waktu_selesai: '10:00', lokasi_kegiatan: 'Gedung GSJA Pusat, Surabaya', tema_khotbah: 'Hidup Dalam Terang Kristus (Yoh 8:12)', nama_pengkhotbah_1: 'Pdt. Samuel Hatane, S.Th.', nama_pengkhotbah_2: 'Pdp. Maria Wulandari' },
  { nama_kegiatan: 'Kebaktian Sekolah Minggu — Satelit Pusat', jenis_kegiatan_id: '2', frekuensi_kegiatan: 'Mingguan', tanggal_mulai: today, waktu_mulai: '08:00', waktu_selesai: '10:00', lokasi_kegiatan: 'Ruang Sekolah Minggu Lantai 2', tema_khotbah: 'Yesus Menyayangi Anak-anak Kecil', nama_pengkhotbah_1: 'Kak Susi Permata' },
  { nama_kegiatan: 'Kebaktian Kaum Muda Jumat Malam', jenis_kegiatan_id: '3', frekuensi_kegiatan: 'Mingguan', tanggal_mulai: '2026-04-18', waktu_mulai: '18:00', waktu_selesai: '20:30', lokasi_kegiatan: 'Aula Kaum Muda GSJA', tema_khotbah: 'Generasi Pemenang — Elia dan Pemuda Zaman Ini', nama_pengkhotbah_1: 'Ev. Jonathan Siahaan', nama_pengkhotbah_2: 'Sdr. Timothy Rajagukguk' },
  { nama_kegiatan: 'Kebaktian Kaum Wanita Bulan April 2026', jenis_kegiatan_id: '4', frekuensi_kegiatan: 'Bulanan', tanggal_mulai: '2026-04-22', waktu_mulai: '09:00', waktu_selesai: '11:30', lokasi_kegiatan: 'Ruang Doa Wanita GSJA', tema_khotbah: 'Wanita yang Takut akan Tuhan (Amsal 31)', nama_pengkhotbah_1: 'Ibu Pdp. Ruth Anastasia' },
  { nama_kegiatan: 'Kebaktian Kaum Pria Bulan April 2026', jenis_kegiatan_id: '5', frekuensi_kegiatan: 'Bulanan', tanggal_mulai: '2026-04-25', waktu_mulai: '07:00', waktu_selesai: '09:00', lokasi_kegiatan: 'Gedung GSJA Pusat, Lantai 1', tema_khotbah: 'Pria Pejuang: Nehemia Membangun Tembok', nama_pengkhotbah_1: 'Pdt. Daniel Prasetyo, M.Div.' },
  { nama_kegiatan: 'Kebaktian Senior & Lansia April 2026', jenis_kegiatan_id: '6', frekuensi_kegiatan: 'Bulanan', tanggal_mulai: '2026-04-23', waktu_mulai: '09:30', waktu_selesai: '11:00', lokasi_kegiatan: 'Ruang Multimedia GSJA', tema_khotbah: 'Usia Lanjut adalah Mahkota Kemuliaan (Ams 16:31)', nama_pengkhotbah_1: 'Pdt. Emeritus Yohanes Susilo' },
  { nama_kegiatan: 'Komsel Kelompok Gideon — Minggu ke-3 April', jenis_kegiatan_id: '7', frekuensi_kegiatan: 'Mingguan', tanggal_mulai: '2026-04-15', waktu_mulai: '19:00', waktu_selesai: '21:00', lokasi_kegiatan: 'Rumah Bpk. Budi Santoso, Jl. Mawar No. 45', is_published: false, tema_khotbah: 'Hidup dalam Anugerah yang Melimpah', nama_pengkhotbah_1: 'Sdr. Hendra Kurniawan', nama_pengkhotbah_2: 'Sdri. Ratna Dewi' },
  { nama_kegiatan: 'Doa Malam Kebangunan Rabu', jenis_kegiatan_id: '8', frekuensi_kegiatan: 'Mingguan', tanggal_mulai: '2026-04-16', waktu_mulai: '19:30', waktu_selesai: '21:30', lokasi_kegiatan: 'Ruang Doa GSJA Pusat', tema_khotbah: 'Kuasa Doa Orang Benar yang Sungguh-sungguh (Yak 5:16)', nama_pengkhotbah_1: 'Pdt. Yusuf Tanamal' },
  { nama_kegiatan: 'Doa Pagi Jumat — Kebangunan Roh', jenis_kegiatan_id: '24', frekuensi_kegiatan: 'Mingguan', tanggal_mulai: '2026-04-18', waktu_mulai: '05:00', waktu_selesai: '06:30', lokasi_kegiatan: 'Gedung GSJA Pusat / Live Streaming YouTube', tema_khotbah: 'Pagi Hari Membawa Anugerah Baru (Rat 3:22-23)', nama_pengkhotbah_1: 'Pdp. Anton Wibowo' },
  { nama_kegiatan: 'Ibadah AGBF Chapter Surabaya — April 2026', jenis_kegiatan_id: '25', frekuensi_kegiatan: 'Bulanan', tanggal_mulai: '2026-04-22', waktu_mulai: '07:00', waktu_selesai: '09:30', lokasi_kegiatan: 'Hotel Wyndham Surabaya, Ballroom Lantai 2', keterangan: 'Sarapan bersama tersedia. Dress code smart casual.', tema_khotbah: 'Bisnis yang Memberkati: Prinsip Kejujuran dalam Perdagangan', nama_pengkhotbah_1: 'Pdt. dr. Paul Gunawan, M.Th.', nama_pengkhotbah_2: 'Bpk. Drs. Santoso Halim' },
  { nama_kegiatan: 'Pencurahan Roh Kudus (PRK) 2026 — 10 Hari', jenis_kegiatan_id: '28', frekuensi_kegiatan: 'Tahunan', tanggal_mulai: '2026-05-20', tanggal_selesai: '2026-05-29', waktu_mulai: '18:30', waktu_selesai: '21:30', lokasi_kegiatan: 'Gedung GSJA Pusat — Lantai Utama', keterangan: '10 hari ibadah menantikan Pencurahan Roh Kudus. Terbuka untuk seluruh jemaat.', tema_khotbah: 'Tunggulah Pencurahan Roh Kudus (Kis 1:4-5)', nama_pengkhotbah_1: 'Pdt. Samuel Hatane, S.Th.', nama_pengkhotbah_2: 'Pdt. Timotius Arifin, M.Div.' },

  // EVENT & PERAYAAN (4 entries: id 9,10,11,18)
  { nama_kegiatan: 'KKR Kebangunan Kota Surabaya 2026', jenis_kegiatan_id: '9', frekuensi_kegiatan: 'Tahunan', tanggal_mulai: '2026-05-10', tanggal_selesai: '2026-05-12', waktu_mulai: '18:00', waktu_selesai: '22:00', lokasi_kegiatan: 'Balai Pemuda Surabaya, Jl. Pemuda No. 15', keterangan: '3 malam kebangunan rohani bersama seluruh GSJA se-Surabaya.', tema_khotbah: 'Api Baru di Kota Ini — Kebangunan Rohani', nama_pengkhotbah_1: 'Pdt. Ir. Niko Njotorahardjo', nama_pengkhotbah_2: 'Pdt. Timotius Arifin, M.Div.', akomodasi: 'Parkir tersedia di Balai Pemuda. Tidak ada akomodasi khusus.' },
  { nama_kegiatan: 'Camp Youth GSJA 2026 — Growth & Calling', jenis_kegiatan_id: '10', frekuensi_kegiatan: 'Tahunan', tanggal_mulai: '2026-06-13', tanggal_selesai: '2026-06-15', waktu_mulai: '08:00', waktu_selesai: '21:00', lokasi_kegiatan: 'Villa Puncak Sejahtera, Batu — Malang', berbayar: true, butuh_registrasi: true, harga_tiket_rp: '450000', kuota_peserta: '120', keterangan: 'Camp tahunan kaum muda. Pendaftaran s.d. 31 Mei 2026.', akomodasi: 'Penginapan 2 malam (kamar 4-6 orang), 6x makan, 2x snack, kaos, sertifikat, modul renungan.' },
  { nama_kegiatan: 'Ibadah Padang Outing Dept. Pria 2026', jenis_kegiatan_id: '11', frekuensi_kegiatan: 'Tahunan', tanggal_mulai: '2026-05-23', waktu_mulai: '07:00', waktu_selesai: '17:00', lokasi_kegiatan: 'Taman Agrowisata Puspo Jagad, Tretes', berbayar: true, butuh_registrasi: true, harga_tiket_rp: '150000', kuota_peserta: '80', akomodasi: 'Sarapan pagi bersama, makan siang BBQ, transportasi shuttle bus PP dari gereja.' },
  { nama_kegiatan: 'Ibadah Perayaan Natal 2026', jenis_kegiatan_id: '18', frekuensi_kegiatan: 'Tahunan', tanggal_mulai: '2026-12-25', waktu_mulai: '17:00', waktu_selesai: '20:00', lokasi_kegiatan: 'Gedung GSJA Pusat — Lantai Utama', keterangan: 'Ibadah Natal bersama seluruh jemaat dan tamu undangan.', tema_khotbah: 'Imanuel — Allah Beserta Kita (Yes 7:14)', nama_pengkhotbah_1: 'Pdt. Samuel Hatane, S.Th.', akomodasi: 'Resepsi makan malam bersama setelah ibadah.' },

  // SOSIAL & DIAKONIA (4 entries: id 12,13,14,21)
  { nama_kegiatan: 'Kunjungan Besuk — Ibu Margaretha Susanto', jenis_kegiatan_id: '12', frekuensi_kegiatan: 'Tidak Berulang', tanggal_mulai: '2026-04-17', waktu_mulai: '14:00', waktu_selesai: '15:30', lokasi_kegiatan: 'RS Mitra Keluarga Surabaya — Kamar 305', is_published: false, keterangan_layanan: 'Ibu Margaretha Susanto (65 thn) — sakit diabetes komplikasi ginjal. Siapkan buah dan doa penyembuhan.' },
  { nama_kegiatan: 'Kunjungan Pelayanan LP Porong — April 2026', jenis_kegiatan_id: '13', frekuensi_kegiatan: 'Bulanan', tanggal_mulai: '2026-04-24', waktu_mulai: '09:00', waktu_selesai: '12:00', lokasi_kegiatan: 'Lembaga Pemasyarakatan Kelas II Porong, Sidoarjo', is_published: false, keterangan: 'Koordinasi telah dilakukan dengan pihak Kalapas.', keterangan_layanan: 'Kunjungan rutin bulanan LP Porong. Tim 5 orang (Dept. Sosial). Materi: ibadah singkat + konseling personal.' },
  { nama_kegiatan: 'Ibadah Penghiburan Alm. Bpk. Hendra Surya', jenis_kegiatan_id: '14', frekuensi_kegiatan: 'Tidak Berulang', tanggal_mulai: '2026-04-19', waktu_mulai: '19:00', waktu_selesai: '21:00', lokasi_kegiatan: 'Rumah Duka, Jl. Kertajaya No. 112, Surabaya', is_published: false, keterangan: 'Almarhum meninggal 18 April 2026 pukul 03:15 WIB.', keterangan_layanan: 'Keluarga: Ibu Susi Surya (istri), Sdr. Kevin Surya (putra). Siapkan lagu penghiburan dan firman penguat.' },
  { nama_kegiatan: 'Pemeriksaan Kesehatan Gratis — Dept. Sosial April', jenis_kegiatan_id: '21', frekuensi_kegiatan: 'Bulanan', tanggal_mulai: '2026-04-27', waktu_mulai: '08:00', waktu_selesai: '12:00', lokasi_kegiatan: 'Halaman Gereja GSJA Pusat', keterangan: 'Pemeriksaan gula darah, tensi, kolesterol. Kontribusi sukarela Rp10.000/tes.' },

  // SAKRAMEN & LAYANAN (3 entries: id 15,16,17)
  { nama_kegiatan: 'Pemberkatan Nikah — Ricky Pratama & Christine Wibowo', jenis_kegiatan_id: '15', frekuensi_kegiatan: 'Tidak Berulang', tanggal_mulai: '2026-05-02', waktu_mulai: '10:00', waktu_selesai: '12:00', lokasi_kegiatan: 'Gedung GSJA Pusat — Ruang Utama', is_published: false, butuh_registrasi: true, keterangan: 'Resepsi dilanjutkan di lantai 2. Undangan terbatas.', nama_pendeta_pelayan: 'Pdt. Samuel Hatane, S.Th.', keterangan_sakramen: 'Pasangan telah mengikuti 3 sesi konseling pranikah. Pendamping: Bp. Yohanes Kurniawan.', keterangan_layanan: 'Mempelai Pria: Ricky Anugrah Pratama. Mempelai Wanita: Christine Anastasia Wibowo.' },
  { nama_kegiatan: 'Ibadah Penyerahan Anak — Mei 2026', jenis_kegiatan_id: '16', frekuensi_kegiatan: 'Bulanan', tanggal_mulai: '2026-05-04', waktu_mulai: '08:00', waktu_selesai: '09:00', lokasi_kegiatan: 'Dalam Ibadah Umum — Gedung GSJA Pusat', butuh_registrasi: true, keterangan: 'Orang tua mendaftarkan anak via PWA s.d. 30 April 2026.', nama_pendeta_pelayan: 'Pdt. Samuel Hatane, S.Th.', keterangan_sakramen: 'Peserta dikonfirmasi setelah pendaftaran ditutup.' },
  { nama_kegiatan: 'Ibadah Baptisan Air — Batch 2 / 2026', jenis_kegiatan_id: '17', frekuensi_kegiatan: 'Tidak Berulang', tanggal_mulai: '2026-05-31', waktu_mulai: '07:00', waktu_selesai: '09:30', lokasi_kegiatan: 'Kolam Baptis GSJA Pusat', butuh_registrasi: true, keterangan: 'Pendaftaran s.d. 15 Mei 2026. Wajib ikut kelas pra-baptis 3 sesi.', nama_pendeta_pelayan: 'Pdt. Samuel Hatane, S.Th.', keterangan_sakramen: 'Target 15 peserta. Sertifikat baptis diserahkan hari H.' },

  // EDUKASI & PELATIHAN (2 entries: id 19,22)
  { nama_kegiatan: 'Seminar Keuangan Keluarga Kristen 2026', jenis_kegiatan_id: '19', frekuensi_kegiatan: 'Tidak Berulang', tanggal_mulai: '2026-05-17', waktu_mulai: '09:00', waktu_selesai: '16:00', lokasi_kegiatan: 'Gedung GSJA Pusat, Lantai 3 — Ruang Seminar', berbayar: true, butuh_registrasi: true, harga_tiket_rp: '75000', kuota_peserta: '150', keterangan: 'Seminar pengelolaan keuangan keluarga Kristiani.', tema_khotbah: 'Mengelola Keuangan dalam Perspektif Alkitabiah', nama_pengkhotbah_1: 'Bpk. Ferdy Halim, CFP.', nama_pengkhotbah_2: 'Pdp. Kevin Manurung', akomodasi: 'Makan siang, 2x coffee break, modul seminar, sertifikat kehadiran.' },
  { nama_kegiatan: 'Webinar Pertumbuhan Rohani Online — April Week 4', jenis_kegiatan_id: '22', frekuensi_kegiatan: 'Mingguan', tanggal_mulai: '2026-04-26', waktu_mulai: '10:00', waktu_selesai: '12:00', lokasi_kegiatan: 'Online via Zoom (link dikirim ke peserta terdaftar)', butuh_registrasi: true, kuota_peserta: '500', tema_khotbah: 'Bertumbuh dalam Doa dan Firman di Era Digital', nama_pengkhotbah_1: 'Ev. Jessica Tanoto, S.Th.', akomodasi: 'Link Zoom dikirim via email setelah registrasi. Rekaman tersedia 7 hari.' },
];

async function post(data, i) {
  const payload = { tipe_penyelenggara: 'Satelit', status_kegiatan: STATUS, is_published: true, butuh_registrasi: false, berbayar: false, harga_tiket_rp: '0', ...data };
  try {
    const res = await fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await res.json();
    const icon = json.success ? '✅' : '❌';
    const id = json.data?.id ? `[ID:${json.data.id}]` : '';
    const err = json.success ? '' : ` → ${json.message}`;
    console.log(`${icon} [${String(i+1).padStart(2,'0')}/${testData.length}] JK-${data.jenis_kegiatan_id.padStart(2,' ')} | ${data.nama_kegiatan.slice(0,52).padEnd(52)} ${id}${err}`);
  } catch (e) {
    console.log(`💥 [${String(i+1).padStart(2,'0')}] NETWORK ERROR: ${e.message}`);
  }
}

async function main() {
  console.log('\n🚀  GSJA Kegiatan API — Full Batch Test (24 jenis kegiatan)');
  console.log('─'.repeat(80));
  for (let i = 0; i < testData.length; i++) {
    await post(testData[i], i);
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('─'.repeat(80));
  console.log(`✨  Done — ${testData.length} requests sent.\n`);
}

main();
