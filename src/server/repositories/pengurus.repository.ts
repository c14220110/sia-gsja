import pool from '@/lib/db';

export interface PengurusFilterParams {
  search?: string;
  satelit_id?: string;    // filter berdasarkan lokasi jabatan (dk.satelit_id)
  jabatan_id?: string;
  periode_id?: string;
  komisi_id?: string;
  departemen_id?: string;
  status?: string;
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
      search,
      satelit_id,
      jabatan_id,
      periode_id,
      komisi_id,
      departemen_id,
      status,
      limit = 10,
      offset = 0,
    } = params;

    const conditions: string[] = ['p.id IS NOT NULL'];
    const values: any[] = [];
    let idx = 1;

    if (search) {
      conditions.push(`(j.nama_lengkap ILIKE $${idx} OR p.id_pengurus ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }
    if (satelit_id) {
      // Filter berdasarkan lokasi jabatan, bukan satelit asal jemaat
      conditions.push(`dk.satelit_id = $${idx++}`);
      values.push(parseInt(satelit_id));
    }
    if (jabatan_id) {
      conditions.push(`dk.jabatan_id = $${idx++}`);
      values.push(parseInt(jabatan_id));
    }
    if (periode_id) {
      conditions.push(`dk.periode_id = $${idx++}`);
      values.push(parseInt(periode_id));
    }
    if (komisi_id) {
      conditions.push(`dk.komisi_id = $${idx++}`);
      values.push(parseInt(komisi_id));
    }
    if (departemen_id) {
      conditions.push(`dk.departemen_id = $${idx++}`);
      values.push(parseInt(departemen_id));
    }
    if (status) {
      conditions.push(`dk.status_jabatan = $${idx++}`);
      values.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // s  = satelit lokasi jabatan (dari detail_kepengurusan.satelit_id)
    // js = satelit asal jemaat   (dari jemaat.satelit_id)
    const fromJoin = `
      FROM pengurus p
      JOIN jemaat j ON p.jemaat_id = j.id
      JOIN detail_kepengurusan dk ON dk.pengurus_id = p.id
      JOIN jabatan jab ON dk.jabatan_id = jab.id
      JOIN periode_kepengurusan per ON dk.periode_id = per.id
      LEFT JOIN satelit s  ON dk.satelit_id = s.id
      LEFT JOIN satelit js ON j.satelit_id  = js.id
      LEFT JOIN komisi kom ON dk.komisi_id = kom.id
      LEFT JOIN departemen dep ON dk.departemen_id = dep.id
    `;

    const [countRes, dataRes, newRes, demisionerRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS count ${fromJoin} ${where}`, values),
      pool.query(`
        SELECT
          p.id,
          p.id_pengurus,
          j.nama_lengkap,
          j.foto_url,
          s.nama_satelit  AS nama_satelit_jabatan,
          js.nama_satelit AS nama_satelit_jemaat,
          dk.id           AS detail_id,
          dk.satelit_id,
          dk.lingkup,
          dk.status_jabatan,
          jab.nama_jabatan,
          per.nama_periode,
          kom.nama_komisi,
          dep.nama_departemen,
          p.created_at
        ${fromJoin}
        ${where}
        ORDER BY dk.created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, [...values, limit, offset]),
      pool.query(`
        SELECT COUNT(DISTINCT p.id) AS count 
        FROM pengurus p 
        WHERE DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', NOW())
      `),
      pool.query(`
        SELECT COUNT(*) AS count 
        FROM detail_kepengurusan 
        WHERE status_jabatan = 'Demisioner'
      `)
    ]);

    return {
      data: dataRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
      pengurus_baru: parseInt(newRes.rows[0].count, 10),
      pengurus_demisioner: parseInt(demisionerRes.rows[0].count, 10)
    };
  }

  /**
   * Buat pengurus baru (atau tambah jabatan baru ke pengurus yang sudah ada).
   * - params.satelit_id = satelit LOKASI JABATAN (bisa berbeda dengan satelit asal jemaat)
   * - Satelit asal jemaat diambil otomatis dari tabel jemaat untuk audit log
   */
  async createPengurus(params: {
    jemaat_id:          number;
    satelit_id:         number;  // lokasi jabatan
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
           periode_id, tanggal_mulai, jalur_pengangkatan, catatan, status_jabatan)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Aktif')
      `, [
        pengurus_id,
        params.jabatan_id,
        params.lingkup,
        params.satelit_id,    // lokasi jabatan (bisa beda dengan jemaat asal)
        params.komisi_id,
        params.departemen_id,
        params.periode_id,
        params.tanggal_mulai,
        params.jalur_pengangkatan,
        params.catatan || null,
      ]);

      // 5. Audit log — gunakan satelit ASAL JEMAAT
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
      SET status_jabatan = $1, updated_at = NOW() 
      WHERE pengurus_id = $2 
      AND id = (SELECT id FROM detail_kepengurusan WHERE pengurus_id = $2 ORDER BY created_at DESC LIMIT 1)
      RETURNING id
    `, [status, id]);

    return updateRes.rowCount !== null && updateRes.rowCount > 0;
  }
}
