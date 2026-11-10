import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  // RBAC: Check permission 'jemaat_analisis_view' instead of hardcoded roles
  if (!caller.is_super_admin && !caller.permissions?.includes('jemaat_analisis_view')) {
    return NextResponse.json(
      { success: false, message: 'Akses ditolak. Anda tidak memiliki izin untuk melihat halaman ini.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawSatelit = searchParams.get('satelit_id');
  const rawJenisKegiatan = searchParams.get('jenis_kegiatan_id');
  const periodeHari = parseInt(searchParams.get('periode') || '30', 10);

  let satelitId: number | null = null;
  if (rawSatelit !== null && rawSatelit.trim() !== '') {
    const parsed = parseInt(rawSatelit, 10);
    satelitId = isNaN(parsed) ? null : parsed;
  } else if (!caller.is_super_admin && caller.role_name !== 'MAJELIS') {
    satelitId = caller.satelit_id ?? null;
  }

  let jenisKegiatanId: number | null = null;
  if (rawJenisKegiatan !== null && rawJenisKegiatan.trim() !== '') {
    const parsed = parseInt(rawJenisKegiatan, 10);
    jenisKegiatanId = isNaN(parsed) ? null : parsed;
  }

  try {
    const params: any[] = [periodeHari];
    let satelitFilter = '';
    let jkTotalFilter = '';
    let jkHadirFilter = '';

    if (satelitId !== null) {
      params.push(satelitId);
      satelitFilter = `AND j.satelit_id = $${params.length}`;
    }

    if (jenisKegiatanId !== null) {
      params.push(jenisKegiatanId);
      jkTotalFilter = `AND k.jenis_kegiatan_id = $${params.length}`;
      jkHadirFilter = `AND k.jenis_kegiatan_id = $${params.length}`;
    }

    const query = `
      WITH total_kegiatan AS (
        SELECT COUNT(DISTINCT k.id) as total_sesi
        FROM public.kegiatan k
        JOIN public.jenis_kegiatan jk ON jk.id = k.jenis_kegiatan_id
        WHERE jk.kategori = 'Ibadah Rutin'
          AND k.tanggal_mulai >= CURRENT_DATE - INTERVAL '1 day' * $1
          ${satelitId !== null ? `AND k.satelit_id = $2` : ''}
          ${jkTotalFilter}
      ),
      kehadiran AS (
        SELECT 
          ka.jemaat_id, 
          COUNT(DISTINCT k.id) as jumlah_hadir,
          MAX(k.tanggal_mulai) as terakhir_hadir
        FROM public.kegiatan_absensi ka
        JOIN public.kegiatan k ON k.id = ka.kegiatan_id
        JOIN public.jenis_kegiatan jk ON jk.id = k.jenis_kegiatan_id
        WHERE ka.role_kehadiran = 'Jemaat'
          AND ka.status_kehadiran = 'Hadir'
          AND jk.kategori = 'Ibadah Rutin'
          AND k.tanggal_mulai >= CURRENT_DATE - INTERVAL '1 day' * $1
          ${jkHadirFilter}
        GROUP BY ka.jemaat_id
      )
      SELECT 
        j.id,
        j.jemaat_id as no_induk,
        j.nama_lengkap,
        j.no_hp,
        s.nama_satelit,
        j.tanggal_bergabung,
        COALESCE(kh.jumlah_hadir, 0)::integer as jumlah_hadir,
        kh.terakhir_hadir,
        (SELECT total_sesi FROM total_kegiatan) as total_sesi
      FROM public.jemaat j
      JOIN public.satelit s ON s.id = j.satelit_id
      LEFT JOIN kehadiran kh ON kh.jemaat_id = j.id
      WHERE j.status_jemaat = 'Aktif'
        AND j.is_deleted = false
        ${satelitFilter}
      ORDER BY COALESCE(kh.jumlah_hadir, 0) ASC, j.nama_lengkap ASC;
    `;

    const result = await pool.query(query, params);

    const now = new Date();
    const data = result.rows.map(row => {
      let status_kehadiran = '';
      let daysSinceJoin = 999;
      const totalSesi = parseInt(row.total_sesi) || 1; // Prevent div by 0
      
      if (row.tanggal_bergabung) {
        const joinDate = new Date(row.tanggal_bergabung);
        daysSinceJoin = (now.getTime() - joinDate.getTime()) / (1000 * 3600 * 24);
      }

      // Proportional threshold logic
      // Setia: >= 50%
      // Mulai Jarang: > 0% to < 50%
      // Menghilang: 0% (and past new member period)
      const attendanceRatio = row.jumlah_hadir / totalSesi;

      if (row.jumlah_hadir === 0 && daysSinceJoin <= periodeHari) {
        status_kehadiran = 'Data Baru';
      } else if (row.jumlah_hadir === 0 && daysSinceJoin > periodeHari) {
        status_kehadiran = 'Menghilang';
      } else if (attendanceRatio >= 0.50) {
        status_kehadiran = 'Setia';
      } else {
        status_kehadiran = 'Mulai Jarang';
      }

      return { ...row, status_kehadiran, total_sesi: totalSesi };
    });

    // Generate summary
    const summary = {
      total: data.length,
      setia: data.filter(d => d.status_kehadiran === 'Setia').length,
      jarang: data.filter(d => d.status_kehadiran === 'Mulai Jarang').length,
      menghilang: data.filter(d => d.status_kehadiran === 'Menghilang').length,
      baru: data.filter(d => d.status_kehadiran === 'Data Baru').length,
    };

    return NextResponse.json({ success: true, data, summary });
  } catch (error: any) {
    console.error('[API GET /api/jemaat/analisis-kehadiran] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan saat memuat data', error: error.message },
      { status: 500 }
    );
  }
}
