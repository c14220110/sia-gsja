import pool from '@/lib/db';

export interface PengurusFilterParams {
  search?: string;
  satelit_id?: string;
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
      conditions.push(`p.satelit_id = $${idx++}`);
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

    const fromJoin = `
      FROM pengurus p
      JOIN jemaat j ON p.jemaat_id = j.id
      JOIN satelit s ON p.satelit_id = s.id
      JOIN detail_kepengurusan dk ON dk.pengurus_id = p.id
      JOIN jabatan jab ON dk.jabatan_id = jab.id
      JOIN periode_kepengurusan per ON dk.periode_id = per.id
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
          s.nama_satelit,
          dk.id as detail_id,
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

  async createPengurus(params: {
    jemaat_id: number;
    satelit_id: number;
    jabatan_id: number;
    lingkup: string;
    komisi_id: number | null;
    departemen_id: number | null;
    periode_id: number;
    jalur_pengangkatan: string;
    catatan?: string;
    user_id: number;
    user_role_id: number;
  }): Promise<{ success: boolean; pengurus_id?: number; message?: string }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const satelitRes = await client.query(`SELECT kode_satelit FROM satelit WHERE id = $1`, [params.satelit_id]);
      if (satelitRes.rowCount === 0) throw new Error('Satelit tidak ditemukan');
      
      const kodeStr = String(satelitRes.rows[0].kode_satelit).padStart(2, '0').substring(0, 2);
      const prefix = `PE${kodeStr}`;
      
      const lastIdRes = await client.query(`
        SELECT id_pengurus FROM pengurus
        WHERE id_pengurus LIKE $1
        ORDER BY id_pengurus DESC
        LIMIT 1
      `, [`${prefix}%`]);

      let urut = 0;
      if (lastIdRes.rowCount && lastIdRes.rowCount > 0) {
        const lastId = lastIdRes.rows[0].id_pengurus;
        const lastUrutNum = parseInt(lastId.substring(prefix.length), 10);
        if (!isNaN(lastUrutNum)) urut = lastUrutNum + 1;
      }
      const id_pengurus = `${prefix}${String(urut).padStart(3, '0')}`;

      // Cek apakah jemaat sudah menjadi pengurus satelit ini
      let pengurus_id;
      const existRes = await client.query(`SELECT id FROM pengurus WHERE jemaat_id = $1 AND satelit_id = $2`, [params.jemaat_id, params.satelit_id]);
      
      if (existRes.rowCount && existRes.rowCount > 0) {
        pengurus_id = existRes.rows[0].id;
      } else {
        const insertPengurusRes = await client.query(`
          INSERT INTO pengurus (id_pengurus, jemaat_id, satelit_id)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [id_pengurus, params.jemaat_id, params.satelit_id]);
        pengurus_id = insertPengurusRes.rows[0].id;
      }

      await client.query(`
        INSERT INTO detail_kepengurusan (pengurus_id, jabatan_id, lingkup, komisi_id, departemen_id, periode_id, jalur_pengangkatan, catatan, status_jabatan)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Aktif')
      `, [pengurus_id, params.jabatan_id, params.lingkup, params.komisi_id, params.departemen_id, params.periode_id, params.jalur_pengangkatan, params.catatan || null]);

      await client.query(`
        INSERT INTO pengurus_audit_log (pengurus_id, aksi, user_id, role_id, satelit_id, keterangan)
        VALUES ($1, 'CREATE', $2, $3, $4, $5)
      `, [
        pengurus_id,
        params.user_id,
        params.user_role_id,
        params.satelit_id,
        `Registrasi Jabatan Baru disematkan kepada pengurus ID ${id_pengurus}`
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
    // Note: status updates usually apply to detail_kepengurusan. We should really pass detail_id.
    // However, if the UI only passes pengurus 'id', we update the latest detail_kepengurusan.
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
