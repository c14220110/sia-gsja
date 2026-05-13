import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

/**
 * GET /api/settings/organisasi?tab=satelit|departemen|konflik&satelit_id=1
 * Menyediakan data untuk halaman Bagan Organisasi.
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await getCallerFromRequest(req);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab') || 'satelit';
    const satelitId = searchParams.get('satelit_id');

    const isMultiSatelit = caller.is_super_admin || caller.permissions.includes('multi_satelit_view');

    // ── Tab 1: Bagan Per Satelit ──────────────────────────────────────────────
    if (tab === 'satelit') {
      // Ambil semua satelit (filter by caller.satelit_id if not multi_satelit)
      let satelitQuery = `SELECT id, kode_satelit, nama_satelit, kota, is_active FROM satelit WHERE is_active = true`;
      const satelitParams: any[] = [];
      if (!isMultiSatelit) {
        satelitQuery += ` AND id = $1`;
        satelitParams.push(caller.satelit_id);
      }
      satelitQuery += ` ORDER BY id ASC`;
      const satelitRes = await pool.query(satelitQuery, satelitParams);

      if (!satelitId) {
        return NextResponse.json({ success: true, satelit_list: satelitRes.rows });
      }

      let sid = parseInt(satelitId);
      if (!isMultiSatelit && sid !== caller.satelit_id) {
        // Force sid to user's own satelit to prevent viewing other satelits' BPH
        sid = caller.satelit_id;
      }

      // BPH Satelit (lingkup = 'Satelit', satelit_id = sid)
      const bphRes = await pool.query(`
        SELECT
          dk.id AS dk_id,
          jab.nama_jabatan,
          jab.lingkup_default,
          jab.is_bph_satelit,
          dk.status_jabatan,
          dk.tanggal_mulai_menjabat,
          dk.periode_id,
          per.nama_periode,
          per.tahun_akhir,
          j.id AS jemaat_id,
          j.nama_lengkap,
          j.foto_url,
          j.no_hp,
          p.id AS pengurus_id,
          p.id_pengurus,
          -- cek apakah punya akun sistem
          EXISTS(SELECT 1 FROM pengguna pg WHERE pg.jemaat_id = j.id) AS has_akun
        FROM detail_kepengurusan dk
        JOIN jabatan jab ON dk.jabatan_id = jab.id
        JOIN pengurus p ON dk.pengurus_id = p.id
        JOIN jemaat j ON p.jemaat_id = j.id
        LEFT JOIN periode_kepengurusan per ON dk.periode_id = per.id
        WHERE dk.satelit_id = $1
          AND dk.lingkup = 'Satelit'
          AND jab.is_bph_satelit = true
          AND dk.status_jabatan = 'Aktif'
        ORDER BY 
          CASE jab.nama_jabatan
            WHEN 'Gembala Satelit' THEN 1
            WHEN 'Wakil Ketua' THEN 2
            WHEN 'Sekretaris' THEN 3
            WHEN 'Bendahara' THEN 4
            WHEN 'Komisaris' THEN 5
            ELSE 99
          END ASC,
          dk.catatan ASC
      `, [sid]);

      // Komisi di satelit ini beserta BPH-nya
      const komisiRes = await pool.query(`
        SELECT
          k.id AS komisi_id,
          k.nama_komisi,
          k.is_active AS komisi_aktif,
          -- BPH Komisi sebagai JSON array
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'dk_id', dk.id,
                'jabatan', jab.nama_jabatan,
                'is_bph_komisi', jab.is_bph_komisi,
                'jemaat_id', j.id,
                'nama_lengkap', j.nama_lengkap,
                'foto_url', j.foto_url,
                'pengurus_id', p.id,
                'id_pengurus', p.id_pengurus,
                'status_jabatan', dk.status_jabatan
              ) ORDER BY jab.id ASC
            ) FILTER (WHERE dk.id IS NOT NULL AND dk.status_jabatan = 'Aktif'),
            '[]'
          ) AS bph_list
        FROM komisi k
        LEFT JOIN detail_kepengurusan dk ON dk.komisi_id = k.id
          AND dk.lingkup = 'Komisi'
          AND dk.status_jabatan = 'Aktif'
        LEFT JOIN jabatan jab ON dk.jabatan_id = jab.id
        LEFT JOIN pengurus p ON dk.pengurus_id = p.id
        LEFT JOIN jemaat j ON p.jemaat_id = j.id
        WHERE k.satelit_id = $1
        GROUP BY k.id
        ORDER BY k.nama_komisi ASC
      `, [sid]);

      // Rayon & Kelompok
      const rayonRes = await pool.query(`
        SELECT
          r.id AS rayon_id,
          r.nama_rayon,
          r.is_active,
          r.ketua_pengurus_id AS ketua_rayon_id,
          j_rayon.nama_lengkap AS ketua_rayon_nama,
          j_rayon.foto_url AS ketua_rayon_foto,
          -- Kelompok sebagai JSON array
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'kelompok_id', ks.id,
                'nama_kelompok', ks.nama_kelompok,
                'ketua_kelompok_id', ks.ketua_pengurus_id,
                'ketua_nama', j_kel.nama_lengkap,
                'ketua_foto', j_kel.foto_url,
                'is_active', ks.is_active
              ) ORDER BY ks.id ASC
            ) FILTER (WHERE ks.id IS NOT NULL),
            '[]'
          ) AS kelompok_list
        FROM rayon r
        LEFT JOIN pengurus p_rayon ON r.ketua_pengurus_id = p_rayon.id
        LEFT JOIN jemaat j_rayon ON p_rayon.jemaat_id = j_rayon.id
        LEFT JOIN kelompok_sel ks ON ks.rayon_id = r.id
        LEFT JOIN pengurus p_kel ON ks.ketua_pengurus_id = p_kel.id
        LEFT JOIN jemaat j_kel ON p_kel.jemaat_id = j_kel.id
        WHERE r.satelit_id = $1
        GROUP BY r.id, r.ketua_pengurus_id, j_rayon.nama_lengkap, j_rayon.foto_url
        ORDER BY r.id ASC
      `, [sid]);

      return NextResponse.json({
        success: true,
        satelit_list: satelitRes.rows,
        bph: bphRes.rows,
        komisi: komisiRes.rows,
        rayon: rayonRes.rows,
      });
    }

    // ── Tab 2: Departemen Pusat ───────────────────────────────────────────────
    if (tab === 'departemen') {
      const res = await pool.query(`
        SELECT
          d.id AS departemen_id,
          d.nama_departemen,
          d.is_active,
          -- Semua koordinator/perwakilan dari berbagai satelit
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'dk_id', dk.id,
                'jabatan', jab.nama_jabatan,
                'jemaat_id', j.id,
                'nama_lengkap', j.nama_lengkap,
                'foto_url', j.foto_url,
                'pengurus_id', p.id,
                'id_pengurus', p.id_pengurus,
                'satelit_id', s.id,
                'nama_satelit', s.nama_satelit,
                'status_jabatan', dk.status_jabatan
              ) ORDER BY s.id ASC, jab.id ASC
            ) FILTER (WHERE dk.id IS NOT NULL AND dk.status_jabatan = 'Aktif'),
            '[]'
          ) AS koordinator_list
        FROM departemen d
        LEFT JOIN detail_kepengurusan dk ON dk.departemen_id = d.id
          AND dk.lingkup = 'Departemen'
          AND dk.status_jabatan = 'Aktif'
        LEFT JOIN jabatan jab ON dk.jabatan_id = jab.id
        LEFT JOIN pengurus p ON dk.pengurus_id = p.id
        LEFT JOIN jemaat j ON p.jemaat_id = j.id
        LEFT JOIN satelit s ON dk.satelit_id = s.id
        WHERE d.is_active = true
        GROUP BY d.id
        ORDER BY d.nama_departemen ASC
      `);

      return NextResponse.json({ success: true, departemen: res.rows });
    }

    // ── Tab 3: Conflict Detection (Jabatan Ganda) ─────────────────────────────
    if (tab === 'konflik') {
      // Base WHERE for RBAC
      const rbacWhere = isMultiSatelit ? '' : `AND j.satelit_id = ${caller.satelit_id}`;

      // Orang yang punya ≥ 2 jabatan aktif
      const res = await pool.query(`
        SELECT
          j.id AS jemaat_id,
          j.nama_lengkap,
          j.foto_url,
          s_asal.nama_satelit AS satelit_asal,
          p.id AS pengurus_id,
          p.id_pengurus,
          COUNT(dk.id) AS jumlah_jabatan,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'jabatan', jab.nama_jabatan,
              'lingkup', dk.lingkup,
              'nama_satelit', s_jab.nama_satelit,
              'nama_komisi', kom.nama_komisi,
              'nama_departemen', dep.nama_departemen,
              'status', dk.status_jabatan
            ) ORDER BY dk.id ASC
          ) AS jabatan_list
        FROM pengurus p
        JOIN jemaat j ON p.jemaat_id = j.id
        LEFT JOIN satelit s_asal ON j.satelit_id = s_asal.id
        JOIN detail_kepengurusan dk ON dk.pengurus_id = p.id AND dk.status_jabatan = 'Aktif'
        JOIN jabatan jab ON dk.jabatan_id = jab.id
        LEFT JOIN satelit s_jab ON dk.satelit_id = s_jab.id
        LEFT JOIN komisi kom ON dk.komisi_id = kom.id
        LEFT JOIN departemen dep ON dk.departemen_id = dep.id
        WHERE 1=1 ${rbacWhere}
        GROUP BY j.id, j.nama_lengkap, j.foto_url, s_asal.nama_satelit, p.id, p.id_pengurus
        HAVING COUNT(dk.id) >= 2
        ORDER BY COUNT(dk.id) DESC, j.nama_lengkap ASC
      `);

      // Masa jabatan hampir habis (≤ 90 hari dari tanggal_selesai periode)
      const segeraHabisRes = await pool.query(`
        SELECT
          j.id AS jemaat_id,
          j.nama_lengkap,
          j.foto_url,
          jab.nama_jabatan,
          dk.lingkup,
          s_jab.nama_satelit,
          kom.nama_komisi,
          per.nama_periode,
          per.tahun_akhir,
          -- estimasi: tanggal_selesai = 31 Desember tahun_akhir
          (per.tahun_akhir || '-12-31')::date - CURRENT_DATE AS sisa_hari
        FROM detail_kepengurusan dk
        JOIN jabatan jab ON dk.jabatan_id = jab.id
        JOIN pengurus p ON dk.pengurus_id = p.id
        JOIN jemaat j ON p.jemaat_id = j.id
        LEFT JOIN satelit s_jab ON dk.satelit_id = s_jab.id
        LEFT JOIN komisi kom ON dk.komisi_id = kom.id
        LEFT JOIN periode_kepengurusan per ON dk.periode_id = per.id
        WHERE dk.status_jabatan = 'Aktif'
          AND per.tahun_akhir IS NOT NULL
          AND (per.tahun_akhir || '-12-31')::date - CURRENT_DATE <= 90
          AND (per.tahun_akhir || '-12-31')::date >= CURRENT_DATE
          ${rbacWhere}
        ORDER BY sisa_hari ASC
        LIMIT 20
      `);

      return NextResponse.json({
        success: true,
        jabatan_ganda: res.rows,
        segera_habis: segeraHabisRes.rows,
        total_konflik: res.rows.length,
      });
    }

    return NextResponse.json({ success: false, message: 'Tab tidak dikenal' }, { status: 400 });

  } catch (error: any) {
    console.error('Error GET /api/settings/organisasi:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
