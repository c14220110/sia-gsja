import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    // 1. Dapatkan Statistik (Total, Jemaat, Tamu, Pelayan)
    const statsQuery = `
      SELECT 
        COUNT(id) as total_hadir,
        SUM(CASE WHEN role_kehadiran = 'Jemaat' THEN 1 ELSE 0 END) as total_jemaat,
        SUM(CASE WHEN role_kehadiran = 'Tamu' THEN 1 ELSE 0 END) as total_tamu,
        SUM(CASE WHEN role_kehadiran NOT IN ('Jemaat', 'Tamu') THEN 1 ELSE 0 END) as total_pelayan
      FROM public.kegiatan_absensi
      WHERE kegiatan_id = $1 AND status_kehadiran = 'Hadir'
    `;
    const statsResult = await pool.query(statsQuery, [id]);

    // 2. Dapatkan 10 Log Terakhir
    const logQuery = `
      SELECT 
        ka.id, 
        ka.role_kehadiran, 
        ka.metode_absensi, 
        ka.waktu_hadir,
        ka.nama_pengunjung,
        j.nama_lengkap as nama_jemaat,
        j.id as jemaat_id
      FROM public.kegiatan_absensi ka
      LEFT JOIN public.jemaat j ON ka.jemaat_id = j.id
      WHERE ka.kegiatan_id = $1 AND ka.status_kehadiran = 'Hadir'
      ORDER BY ka.waktu_hadir DESC
      LIMIT 10
    `;
    const logResult = await pool.query(logQuery, [id]);

    // Format output
    const logs = logResult.rows.map(row => ({
      id: row.id,
      waktu_hadir: row.waktu_hadir,
      nama: row.nama_jemaat || row.nama_pengunjung || 'Tidak Diketahui',
      jenis: row.role_kehadiran,
      metode: row.metode_absensi
    }));

    return NextResponse.json({ 
      success: true, 
      data: {
        stats: statsResult.rows[0],
        recent_logs: logs
      }
    });
  } catch (error) {
    console.error('Error fetching absensi data:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    const { action_type, id_jemaat, nama_tamu, no_hp, gereja_asal } = body;

    if (!action_type) {
      return NextResponse.json({ success: false, message: 'Action type is missing' }, { status: 400 });
    }

    // Skenario 1: Internal (QR atau Manual Jemaat)
    if (action_type === 'qr_scan' || action_type === 'manual_jemaat') {
      if (!id_jemaat) return NextResponse.json({ success: false, message: 'ID Jemaat kosong' }, { status: 400 });
      
      const mode = action_type === 'qr_scan' ? 'QR Code' : 'Manual';

      // Validasi: Pastikan Jemaat ada
      const checkJemaat = await pool.query('SELECT id, nama_lengkap FROM public.jemaat WHERE id = $1', [id_jemaat]);
      if (checkJemaat.rowCount === 0) {
         return NextResponse.json({ success: false, message: 'ID Jemaat tidak ditemukan di database.', is_alert: true }, { status: 404 });
      }
      const namaAsli = checkJemaat.rows[0].nama_lengkap;

      // Cek ke tabel kegiatan_absensi
      const checkAbsensi = await pool.query('SELECT id, status_kehadiran, role_kehadiran FROM public.kegiatan_absensi WHERE kegiatan_id = $1 AND jemaat_id = $2', [id, id_jemaat]);
      
      if (checkAbsensi.rowCount && checkAbsensi.rowCount > 0) {
        const record = checkAbsensi.rows[0];
        if (record.status_kehadiran === 'Hadir') {
          return NextResponse.json({ success: false, message: 'Jemaat ini sudah melakukan absensi (Sudah Hadir)!', is_alert: true }, { status: 409 });
        } else {
          // UPDATE (Skenario Pelayan/WL dsb yang status_kehadirannya = 'Belum Hadir')
          await pool.query(
            "UPDATE public.kegiatan_absensi SET status_kehadiran = 'Hadir', metode_absensi = $1, waktu_hadir = CURRENT_TIMESTAMP WHERE id = $2",
            [mode, record.id]
          );
          return NextResponse.json({ success: true, message: `SELAMAT MELAYANI, ${namaAsli.toUpperCase()}!`, nama_lengkap: namaAsli, tipe: record.role_kehadiran });
        }
      } else {
        // INSERT Baru (Skenario Jemaat biasa)
        await pool.query(
          "INSERT INTO public.kegiatan_absensi (kegiatan_id, jemaat_id, role_kehadiran, metode_absensi, status_kehadiran) VALUES ($1, $2, 'Jemaat', $3, 'Hadir')",
          [id, id_jemaat, mode]
        );
        return NextResponse.json({ success: true, message: `SHALOM, ${namaAsli.toUpperCase()}!`, nama_lengkap: namaAsli, tipe: 'Jemaat' });
      }
    }

    // Skenario 2: Tamu / Jemaat Baru
    if (action_type === 'tamu') {
      if (!nama_tamu) return NextResponse.json({ success: false, message: 'Nama tamu tidak boleh kosong' }, { status: 400 });
      let namaPengunjung = nama_tamu;
      if (no_hp) namaPengunjung += ` (${no_hp})`;
      if (gereja_asal) namaPengunjung += ` - ${gereja_asal}`;

      await pool.query(
        "INSERT INTO public.kegiatan_absensi (kegiatan_id, jemaat_id, nama_pengunjung, role_kehadiran, metode_absensi, status_kehadiran) VALUES ($1, NULL, $2, 'Tamu', 'Manual', 'Hadir')",
        [id, namaPengunjung]
      );
      return NextResponse.json({ success: true, message: `SELAMAT DATANG TAMU KAMI, ${nama_tamu.toUpperCase()}`, nama_lengkap: nama_tamu, tipe: 'Tamu' });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak valid' }, { status: 400 });
  } catch (error) {
    console.error('Error posting absensi:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
