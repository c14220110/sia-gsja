import pool from '@/lib/db';

export class MasterRepository {
  async getAllSatelit(): Promise<any[]> {
    const query = `
      SELECT id, nama_satelit
      FROM satelit
      WHERE is_active = true
      ORDER BY id ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async getAllKomisi(): Promise<any[]> {
    const query = `
      SELECT id, nama_komisi, satelit_id
      FROM komisi
      WHERE is_active = true
      ORDER BY nama_komisi ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async getKomisiBySatelit(satelitId: number): Promise<any[]> {
    const query = `
      SELECT id, nama_komisi, satelit_id
      FROM komisi
      WHERE is_active = true AND satelit_id = $1
      ORDER BY nama_komisi ASC;
    `;
    const result = await pool.query(query, [satelitId]);
    return result.rows;
  }

  async searchJemaat(searchQuery: string, onlyActive?: boolean): Promise<any[]> {
    const statusFilter = onlyActive ? " AND j.status_jemaat = 'Aktif'" : "";
    const query = `
      SELECT j.id, j.jemaat_id, j.nama_lengkap, j.jenis_kelamin, j.foto_url, j.satelit_id, s.nama_satelit, j.tanggal_lahir, j.status_pernikahan, j.no_hp, j.email, j.alamat, j.kota, j.kode_pos
      FROM jemaat j
      JOIN satelit s ON j.satelit_id = s.id
      WHERE j.is_deleted = false AND j.nama_lengkap ILIKE $1${statusFilter}
      ORDER BY j.nama_lengkap ASC
      LIMIT 10;
    `;
    const result = await pool.query(query, [`%${searchQuery}%`]);
    return result.rows;
  }

  async searchPelayan(searchQuery: string, roleId?: string, kegiatanId?: string): Promise<any[]> {
    const searchPattern = searchQuery ? `%${searchQuery}%` : '%';
    const params: any[] = [searchPattern];
    let paramIdx = 1;

    let roleJoin = '';
    if (roleId) {
      paramIdx++;
      roleJoin = `JOIN public.pelayan_role pr ON p.id = pr.pelayan_id AND pr.role_id = $${paramIdx} AND pr.status_role = 'Aktif'`;
      params.push(parseInt(roleId, 10));
    }

    // Metrics: only computed when kegiatanId is provided (saves query cost in bypass mode without context)
    let metricsSelect = `0::int AS jumlah_bulan_ini, NULL::text AS nama_kegiatan_bentrok`;
    if (kegiatanId) {
      paramIdx++;
      const kidIdx = paramIdx;
      params.push(parseInt(kegiatanId, 10));
      metricsSelect = `
        (
          SELECT COUNT(*)::int
          FROM public.kegiatan_jadwal_pelayan kjp2
          JOIN public.kegiatan k2 ON kjp2.kegiatan_id = k2.id
          WHERE kjp2.pelayan_id = p.id
            AND date_trunc('month', k2.tanggal_mulai) = date_trunc('month', CURRENT_DATE)
        ) AS jumlah_bulan_ini,
        (
          SELECT k3.nama_kegiatan
          FROM public.kegiatan_jadwal_pelayan kjp3
          JOIN public.kegiatan k3 ON kjp3.kegiatan_id = k3.id
          WHERE kjp3.pelayan_id = p.id
            AND kjp3.kegiatan_id != $${kidIdx}
            AND k3.tanggal_mulai = (SELECT tanggal_mulai FROM public.kegiatan WHERE id = $${kidIdx})
          LIMIT 1
        ) AS nama_kegiatan_bentrok
      `;
    }

    const query = `
      SELECT DISTINCT p.id, j.nama_lengkap, j.foto_url,
        ${metricsSelect}
      FROM pelayan p
      JOIN jemaat j ON p.jemaat_id = j.id
      ${roleJoin}
      WHERE p.status_pelayan = 'Aktif' AND j.nama_lengkap ILIKE $1
      ORDER BY j.nama_lengkap ASC
      LIMIT 30;
    `;
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getAllDepartemen(): Promise<any[]> {
    const query = `
      SELECT id, nama_departemen
      FROM departemen
      WHERE is_active = true
      ORDER BY nama_departemen ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async getAllPekerjaan(): Promise<any[]> {
    const query = `
      SELECT id, nama_pekerjaan
      FROM pekerjaan_master
      WHERE is_active = true
      ORDER BY id ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async getAllRolePelayan(): Promise<any[]> {
    const query = `
      SELECT id, nama_role
      FROM role_pelayan
      WHERE is_active = true
      ORDER BY nama_role ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async getAllPeriodeKepengurusan(): Promise<any[]> {
    const query = `
      SELECT id, nama_periode, tahun_mulai, tahun_akhir
      FROM periode_kepengurusan
      WHERE is_active = true
      ORDER BY tahun_mulai DESC;
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async getAllJabatan(): Promise<any[]> {
    const query = `
      SELECT id, nama_jabatan
      FROM jabatan
      WHERE is_active = true
      ORDER BY id ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async getAllPengurus(): Promise<any[]> {
    const query = `
      SELECT p.id, j.nama_lengkap 
      FROM pengurus p 
      JOIN jemaat j ON p.jemaat_id = j.id
      WHERE p.is_active = true AND j.is_deleted = false
      ORDER BY j.nama_lengkap ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async getAllJenisKegiatan(): Promise<any[]> {
    const query = `
      SELECT 
        id, nama_jenis_kegiatan, kategori, 
        default_is_published, default_butuh_registrasi, butuh_permohonan
      FROM jenis_kegiatan
      ORDER BY id ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async getAllJabatanPegawai(): Promise<any[]> {
    const query = `
      SELECT id, nama_jabatan
      FROM jabatan_pegawai_master
      WHERE is_active = true
      ORDER BY id ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async getAllBank(): Promise<any[]> {
    const query = `
      SELECT id, nama_bank, kode_bank
      FROM bank_master
      WHERE is_active = true
      ORDER BY id ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async getApprovedAnggaranOptions(): Promise<any[]> {
    const query = `
      SELECT 
        at.id, 
        at.kode_dokumen, 
        at.nama_rancangan, 
        at.pola_penggunaan,
        at.total_anggaran,
        at.total_disetujui,
        at.status,
        at.tahun,
        at.kategori_ra,
        at.jenis_kegiatan_id,
        at.satelit_id,
        at.komisi_id,
        s.nama_satelit,
        k.nama_komisi,
        CASE 
          WHEN at.pola_penggunaan = 'Sekali Pakai' THEN
            CASE WHEN EXISTS (
              SELECT 1 FROM public.kegiatan kg 
              WHERE kg.anggaran_tahunan_id = at.id 
              AND kg.status_kegiatan NOT IN ('Draft', 'Dibatalkan')
            ) THEN false ELSE true END
          ELSE true
        END AS is_available,
        (SELECT COUNT(*) FROM public.kegiatan kg 
         WHERE kg.anggaran_tahunan_id = at.id 
         AND kg.status_kegiatan NOT IN ('Draft', 'Dibatalkan'))::int AS jumlah_kegiatan_aktif
      FROM public.anggaran_tahunan at
      LEFT JOIN public.satelit s ON at.satelit_id = s.id
      LEFT JOIN public.komisi k ON at.komisi_id = k.id
      WHERE at.status IN ('Disetujui Penuh', 'Disetujui Sebagian')
        AND at.kategori_ra = 'Kegiatan'
      ORDER BY at.pola_penggunaan ASC, at.tahun DESC, at.kode_dokumen ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
  }

}
