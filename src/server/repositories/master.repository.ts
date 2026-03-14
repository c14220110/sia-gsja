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

  async searchJemaat(searchQuery: string): Promise<any[]> {
    const query = `
      SELECT id, jemaat_id, nama_lengkap, jenis_kelamin
      FROM jemaat
      WHERE is_deleted = false AND nama_lengkap ILIKE $1
      ORDER BY nama_lengkap ASC
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
}
