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
      SELECT j.id, j.jemaat_id, j.nama_lengkap, j.jenis_kelamin, j.foto_url, j.satelit_id, s.nama_satelit
      FROM jemaat j
      JOIN satelit s ON j.satelit_id = s.id
      WHERE j.is_deleted = false AND j.nama_lengkap ILIKE $1${statusFilter}
      ORDER BY j.nama_lengkap ASC
      LIMIT 10;
    `;
    const result = await pool.query(query, [`%${searchQuery}%`]);
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
}
