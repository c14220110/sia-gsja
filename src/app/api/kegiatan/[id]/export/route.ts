import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import fs from 'fs';
import path from 'path';

// @ts-ignore
import PizZip from 'pizzip';
// @ts-ignore
import Docxtemplater from 'docxtemplater';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Format Tanggal (e.g., 09 April 2026)
const formatTanggal = (date: Date) => {
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
};

// Format Smart Date Range (e.g., 19 - 21 April 2026 atau 28 Apr - 2 Mei 2026)
const formatTanggalRange = (start: Date, end?: Date | null) => {
  if (!start) return '';
  const d1 = start.getDate();
  const m1 = start.toLocaleDateString('id-ID', { month: 'long' });
  const m1Short = start.toLocaleDateString('id-ID', { month: 'short' });
  const y1 = start.getFullYear();

  if (!end || start.getTime() === end.getTime()) {
    return `${d1.toString().padStart(2, '0')} ${m1} ${y1}`;
  }

  const d2 = end.getDate();
  const m2 = end.toLocaleDateString('id-ID', { month: 'long' });
  const m2Short = end.toLocaleDateString('id-ID', { month: 'short' });
  const y2 = end.getFullYear();

  if (y1 !== y2) {
    return `${d1} ${m1Short} ${y1} - ${d2} ${m2Short} ${y2}`;
  } else if (m1 !== m2) {
    return `${d1} ${m1Short} - ${d2} ${m2Short} ${y2}`;
  } else {
    return `${d1} - ${d2} ${m1} ${y1}`;
  }
};

// Format Waktu (e.g., 10:00)
const formatWaktu = (timeStr: string) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  return `${h}:${m}`;
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  
  try {
    // 1. Fetch Kegiatan Basic Info
    const kRes = await pool.query(`
      SELECT 
        k.kode_kegiatan, k.nama_kegiatan, k.tanggal_mulai, k.waktu_mulai, k.waktu_selesai, k.frekuensi_kegiatan, k.lokasi_kegiatan, k.status_kegiatan, k.keterangan,
        jk.nama_jenis_kegiatan,
        s.nama_satelit, s.kode_satelit,
        jp.nama_lengkap as nama_pic_pengurus, k.pic_pengurus_id
      FROM public.kegiatan k
      LEFT JOIN public.jenis_kegiatan jk ON k.jenis_kegiatan_id = jk.id
      LEFT JOIN public.satelit s ON k.satelit_id = s.id
      LEFT JOIN public.pengurus p ON k.pic_pengurus_id = p.id
      LEFT JOIN public.jemaat jp ON p.jemaat_id = jp.id
      WHERE k.id = $1
    `, [id]);
    const kegiatan = kRes.rows[0];
    if (!kegiatan) return NextResponse.json({ success: false, message: 'Kegiatan not found' }, { status: 404 });

    // 2. Fetch Detail Ibadah
    const dRes = await pool.query(`
      SELECT tema_khotbah, nama_pengkhotbah_1, nama_pengkhotbah_2, jumlah_pengunjung_baru
      FROM public.kegiatan_detail_ibadah WHERE kegiatan_id = $1
    `, [id]);
    const detail = dRes.rows[0] || {};

    // 3. Fetch Kehadiran Stats (from Absensi)
    const statRes = await pool.query(`
      SELECT 
        COUNT(id) as total_hadir,
        SUM(CASE WHEN role_kehadiran = 'Jemaat' THEN 1 ELSE 0 END) as total_jemaat,
        SUM(CASE WHEN role_kehadiran = 'Tamu' THEN 1 ELSE 0 END) as total_tamu,
        SUM(CASE WHEN role_kehadiran NOT IN ('Jemaat', 'Tamu') THEN 1 ELSE 0 END) as total_pelayan
      FROM public.kegiatan_absensi
      WHERE kegiatan_id = $1 AND status_kehadiran = 'Hadir'
    `, [id]);
    const stats = statRes.rows[0] || {};

    // 4. Fetch Pelayan List
    const pRes = await pool.query(`
      SELECT 
        kjp.id, 
        p.id_pelayanan as id_p,
        j.nama_lengkap as nama,
        s.nama_satelit as sat_p,
        rp.nama_role as roles,
        kjp.status_konfirmasi as status
      FROM public.kegiatan_jadwal_pelayan kjp
      LEFT JOIN public.pelayan p ON kjp.pelayan_id = p.id
      LEFT JOIN public.jemaat j ON p.jemaat_id = j.id
      LEFT JOIN public.satelit s ON p.satelit_id = s.id
      LEFT JOIN public.role_pelayan rp ON kjp.role_id = rp.id
      WHERE kjp.kegiatan_id = $1 AND kjp.status_konfirmasi != 'Berhalangan'
      ORDER BY rp.nama_role ASC
    `, [id]);
    const pelayanList = pRes.rows.map((r, i) => ({ ...r, no: i + 1 }));

    // 5. Fetch Kehadiran Jemaat List
    const hRes = await pool.query(`
      SELECT 
        j.jemaat_id as id_j,
        COALESCE(j.nama_lengkap, ka.nama_pengunjung) as nama_j
      FROM public.kegiatan_absensi ka
      LEFT JOIN public.jemaat j ON ka.jemaat_id = j.id
      WHERE ka.kegiatan_id = $1 AND ka.status_kehadiran = 'Hadir' AND ka.role_kehadiran IN ('Jemaat', 'Tamu')
      ORDER BY ka.waktu_hadir ASC
    `, [id]);
    const hadirList = hRes.rows.map((r, i) => ({ ...r, no: i + 1 }));

    // ===== DATA MAPPING KE DOCX =====
    const data = {
      jenis_kegiatan_header: kegiatan.nama_jenis_kegiatan ? kegiatan.nama_jenis_kegiatan.toUpperCase() : 'KEGIATAN',
      nama_satelit: kegiatan.nama_satelit || 'Pusat',
      jenis_kegiatan: kegiatan.nama_jenis_kegiatan || 'Ibadah',
      tanggal_cetak: formatTanggal(new Date()),
      
      total_hadir: parseInt(stats.total_hadir) || 0,
      
      nama_kegiatan: kegiatan.nama_kegiatan,
      tema_khotbah: detail.tema_khotbah ? `"${detail.tema_khotbah}"` : '',
      id_kegiatan: kegiatan.kode_kegiatan,
      kode_satelit: kegiatan.kode_satelit || 'S00',
      lokasi_kegiatan: kegiatan.lokasi_kegiatan || kegiatan.nama_satelit,
      
      tgl_kegiatan: formatTanggalRange(kegiatan.tanggal_mulai, kegiatan.tanggal_selesai),
      mulai: formatWaktu(kegiatan.waktu_mulai),
      selesai: formatWaktu(kegiatan.waktu_selesai) || 'Selesai',
      frekuensi: kegiatan.frekuensi_kegiatan,
      
      status_kegiatan: kegiatan.status_kegiatan,
      satelit_kegiatan: kegiatan.nama_satelit || 'Satelit Utama',
      kode_kegiatan: kegiatan.kode_kegiatan,
      
      nama_pengkhotbah: detail.nama_pengkhotbah_1 || '-',
      pengkhotbah1: detail.nama_pengkhotbah_1 || '-',
      pengkhotbah2: detail.nama_pengkhotbah_2 || '-',
      total_pelayan: parseInt(stats.total_pelayan) || 0,
      total_jemaat: parseInt(stats.total_jemaat) || 0,
      jemaat_baru: (parseInt(stats.total_tamu) || 0) + (detail.jumlah_pengunjung_baru || 0),
      
      kolekte: 'Menunggu Input Bendahara',
      persepuluhan: 'Menunggu Input Bendahara',
      p_khusus: 'Menunggu Input Bendahara',
      
      keterangan: kegiatan.keterangan || '-',
      
      nama_pic_pengurus: kegiatan.nama_pic_pengurus || 'Belum Ada PIC',
      id_pengurus: kegiatan.pic_pengurus_id || '-',
      
      pelayan: pelayanList.length > 0 ? pelayanList : [{ no: '-', id_p: '-', nama: '-', sat_p: '-', roles: '-', status: '-' }],
      hadir: hadirList.length > 0 ? hadirList : [{ no: '-', id_j: '-', nama_j: '-' }]
    };

    // Load template dari root project
    const templatePath = path.join(process.cwd(), 'Output Form Kegiatan Ibadah Rutin.docx');
    
    if (!fs.existsSync(templatePath)) {
       return NextResponse.json({ success: false, message: 'File template docx tidak ditemukan di root server!' }, { status: 404 });
    }

    const content = fs.readFileSync(templatePath);
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    doc.render(data);

    const buf = Buffer.from(doc.getZip().generate({ type: 'uint8array' }));

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="Laporan_${kegiatan.kode_kegiatan}.docx"`
      }
    });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
