import pool from '@/lib/db';

export interface PengurusFilterParams {
  search?: string;
  // Quick Filters
  satelit_asal_id?: string;      // homebase jemaat (j.satelit_id)
  status_global?: string;         // 'Aktif' | 'Non-Aktif' | '' — maps to p.is_active
  // Advanced Filters
  lingkup?: string;               // dk.lingkup: Pusat | Satelit | Komisi | Departemen
  satelit_penugasan_id?: string;  // lokasi jabatan (dk.satelit_id)
  jabatan_id?: string;
  periode_id?: string;
  komisi_id?: string;
  departemen_id?: string;
  limit?: number;
  offset?: number;
}

export class PengurusRepository {
  async getPengurusPagination(params: PengurusFilterParams): Promise<{
    data: any[];
    total: number;
    pengurus_baru: number;
    pengurus_demisioner: number;
  }> {
    const {
      search, satelit_asal_id, status_global,
      lingkup, satelit_penugasan_id, jabatan_id, periode_id, komisi_id, departemen_id,
      limit = 10, offset = 0,
    } = params;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Quick filter: search by name or ID
    if (search) {
      conditions.push(`(j.nama_lengkap ILIKE $${idx} OR p.id_pengurus ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    // Quick filter: satelit asal/homebase (from jemaat table, NOT jabatan)
    if (satelit_asal_id) {
      conditions.push(`j.satelit_id = $${idx++}`);
      values.push(parseInt(satelit_asal_id));
    }

    // Quick filter: status global pengurus (p.is_active)
    if (status_global === 'Aktif') {
      conditions.push(`p.is_active = true`);
    } else if (status_global === 'Non-Aktif') {
      conditions.push(`p.is_active = false`);
    }

    // Advanced filters — all via EXISTS to preserve 1-row-per-person guarantee
    const jabatanConds: string[] = [];
    if (lingkup)               { jabatanConds.push(`dk.lingkup        = $${idx++}`); values.push(lingkup); }
    if (satelit_penugasan_id)  { jabatanConds.push(`dk.satelit_id     = $${idx++}`); values.push(parseInt(satelit_penugasan_id)); }
    if (jabatan_id)            { jabatanConds.push(`dk.jabatan_id     = $${idx++}`); values.push(parseInt(jabatan_id)); }
    if (periode_id)            { jabatanConds.push(`dk.periode_id     = $${idx++}`); values.push(parseInt(periode_id)); }
    if (komisi_id)             { jabatanConds.push(`dk.komisi_id      = $${idx++}`); values.push(parseInt(komisi_id)); }
    if (departemen_id)         { jabatanConds.push(`dk.departemen_id  = $${idx++}`); values.push(parseInt(departemen_id)); }

    if (jabatanConds.length > 0) {
      conditions.push(`EXISTS (
        SELECT 1 FROM detail_kepengurusan dk
        WHERE dk.pengurus_id = p.id AND ${jabatanConds.join(' AND ')}
      )`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const baseFrom = `
      FROM pengurus p
      JOIN jemaat j ON p.jemaat_id = j.id
      LEFT JOIN satelit js ON j.satelit_id = js.id
    `;

    const dataQuery = `
      SELECT
        p.id,
        p.id_pengurus,
        p.is_active,
        j.id AS jemaat_id,
        j.nama_lengkap,
        j.foto_url,
        j.email AS email_jemaat,
        j.tanggal_lahir,
        js.nama_satelit AS nama_satelit_asal,
        js.id AS satelit_asal_id,
        -- status akun sistem
        EXISTS (
          SELECT 1 FROM pengguna pg WHERE pg.jemaat_id = j.id
        ) AS has_akun,
        (
          SELECT pg.id FROM pengguna pg WHERE pg.jemaat_id = j.id LIMIT 1
        ) AS akun_id,
        (
          SELECT pg.is_active FROM pengguna pg WHERE pg.jemaat_id = j.id LIMIT 1
        ) AS akun_is_active,
        -- semua jabatan aktif sebagai JSON array
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'nama', jab2.nama_jabatan,
              'label', CONCAT(jab2.nama_jabatan, ' · ', dk2.lingkup,
                CASE
                  WHEN s2.nama_satelit IS NOT NULL THEN CONCAT(' · ', s2.nama_satelit)
                  WHEN kom2.nama_komisi IS NOT NULL THEN CONCAT(' · ', kom2.nama_komisi)
                  WHEN dep2.nama_departemen IS NOT NULL THEN CONCAT(' · ', dep2.nama_departemen)
                  ELSE '' END
              ),
              'jabatan_id', dk2.jabatan_id,
              'lingkup', dk2.lingkup,
              'satelit_id', dk2.satelit_id,
              'komisi_id', dk2.komisi_id,
              'departemen_id', dk2.departemen_id
            ) ORDER BY dk2.id ASC
          )
          FROM detail_kepengurusan dk2
          JOIN jabatan jab2 ON dk2.jabatan_id = jab2.id
          LEFT JOIN satelit s2 ON dk2.satelit_id = s2.id
          LEFT JOIN komisi kom2 ON dk2.komisi_id = kom2.id
          LEFT JOIN departemen dep2 ON dk2.departemen_id = dep2.id
          WHERE dk2.pengurus_id = p.id AND dk2.status_jabatan = 'Aktif'
        ) AS jabatan_aktif_list,
        (
          SELECT pg.email FROM pengguna pg WHERE pg.jemaat_id = j.id LIMIT 1
        ) AS akun_email,
        p.created_at
      ${baseFrom}
      ${where}
      ORDER BY p.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const [countRes, dataRes, newRes, demisionerRes] = await Promise.all([
      pool.query(`SELECT COUNT(DISTINCT p.id) AS count ${baseFrom} ${where}`, values),
      pool.query(dataQuery, [...values, limit, offset]),
      pool.query(`SELECT COUNT(DISTINCT p.id) AS count FROM pengurus p WHERE DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', NOW())`),
      pool.query(`SELECT COUNT(*) AS count FROM detail_kepengurusan WHERE status_jabatan = 'Demisioner'`),
    ]);

    return {
      data: dataRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
      pengurus_baru: parseInt(newRes.rows[0].count, 10),
      pengurus_demisioner: parseInt(demisionerRes.rows[0].count, 10),
    };
  }

  /**
   * Buat pengurus baru (atau tambah jabatan baru ke pengurus yang sudah ada).
   * - params.satelit_id = satelit LOKASI JABATAN (bisa berbeda dengan satelit asal jemaat)
   * - Satelit asal jemaat diambil otomatis dari tabel jemaat untuk audit log
   */
  async createPengurus(params: {
    jemaat_id:          number;
    satelit_id:         number;
    jabatan_id:         number;
    lingkup:            string;
    komisi_id:          number | null;
    departemen_id:      number | null;
    periode_id:         number;
    tanggal_mulai:      string;
    jalur_pengangkatan: string;
    catatan?:           string;
    user_id:            number;
    user_role_id:       number;
  }): Promise<{ success: boolean; pengurus_id?: number; message?: string }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Ambil satelit asal jemaat (untuk audit log)
      const jemaatRes = await client.query(
        `SELECT satelit_id FROM jemaat WHERE id = $1`,
        [params.jemaat_id]
      );
      if (jemaatRes.rowCount === 0) throw new Error('Jemaat tidak ditemukan');
      const jemaat_satelit_id: number = jemaatRes.rows[0].satelit_id;

      // 2. Generate ID pengurus berdasarkan satelit lokasi jabatan
      const satelitRes = await client.query(
        `SELECT kode_satelit FROM satelit WHERE id = $1`,
        [params.satelit_id]
      );
      if (satelitRes.rowCount === 0) throw new Error('Satelit lokasi tidak ditemukan');

      const kodeStr   = String(satelitRes.rows[0].kode_satelit).padStart(2, '0').substring(0, 2);
      const prefix    = `PE${kodeStr}`;

      const lastIdRes = await client.query(
        `SELECT id_pengurus FROM pengurus WHERE id_pengurus LIKE $1 ORDER BY id_pengurus DESC LIMIT 1`,
        [`${prefix}%`]
      );

      let urut = 0;
      if (lastIdRes.rowCount && lastIdRes.rowCount > 0) {
        const lastUrutNum = parseInt(lastIdRes.rows[0].id_pengurus.substring(prefix.length), 10);
        if (!isNaN(lastUrutNum)) urut = lastUrutNum + 1;
      }
      const id_pengurus = `${prefix}${String(urut).padStart(3, '0')}`;

      // 3. Cek apakah jemaat sudah punya row di tabel pengurus
      let pengurus_id: number;
      const existRes = await client.query(
        `SELECT id FROM pengurus WHERE jemaat_id = $1`,
        [params.jemaat_id]
      );

      if (existRes.rowCount && existRes.rowCount > 0) {
        pengurus_id = existRes.rows[0].id;
      } else {
        const insertRes = await client.query(
          `INSERT INTO pengurus (id_pengurus, jemaat_id) VALUES ($1, $2) RETURNING id`,
          [id_pengurus, params.jemaat_id]
        );
        pengurus_id = insertRes.rows[0].id;
      }

      // 4. Tambah detail jabatan — satelit_id di sini adalah LOKASI JABATAN
      await client.query(`
        INSERT INTO detail_kepengurusan
          (pengurus_id, jabatan_id, lingkup, satelit_id, komisi_id, departemen_id,
           periode_id, tanggal_mulai_menjabat, jalur_pengangkatan, catatan, status_jabatan)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Aktif')
      `, [
        pengurus_id,
        params.jabatan_id,
        params.lingkup,
        params.satelit_id,
        params.komisi_id,
        params.departemen_id,
        params.periode_id,
        params.tanggal_mulai,
        params.jalur_pengangkatan,
        params.catatan || null,
      ]);

      // 5. Audit log
      await client.query(`
        INSERT INTO pengurus_audit_log (pengurus_id, aksi, user_id, role_id, satelit_id, keterangan)
        VALUES ($1, 'CREATE', $2, $3, $4, $5)
      `, [
        pengurus_id,
        params.user_id,
        params.user_role_id,
        jemaat_satelit_id,
        `Registrasi Jabatan Baru disematkan kepada pengurus ID ${id_pengurus}`,
      ]);

      await client.query('COMMIT');
      return { success: true, pengurus_id };

    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Error creating pengurus:', error.message);
      return { success: false, message: error.message };
    } finally {
      client.release();
    }
  }

  async updatePengurusStatus(id: string, status: string): Promise<boolean> {
    const updateRes = await pool.query(`
      UPDATE detail_kepengurusan 
      SET status_jabatan = $1 
      WHERE pengurus_id = $2 
      AND id = (SELECT id FROM detail_kepengurusan WHERE pengurus_id = $2 ORDER BY id DESC LIMIT 1)
      RETURNING id
    `, [status, id]);

    return updateRes.rowCount !== null && updateRes.rowCount > 0;
  }
}
