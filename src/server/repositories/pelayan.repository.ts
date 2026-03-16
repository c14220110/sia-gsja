import pool from '@/lib/db';

export interface PelayanFilterParams {
  search?:       string;
  satelit_id?:   string;
  role_id?:      string;
  status?:       string;
  date_from?:    string;
  date_to?:      string;
  limit?:        number;
  offset?:       number;
}

export class PelayanRepository {

  async getPelayanPagination(params: PelayanFilterParams): Promise<{
    data: any[];
    total: number;
    pelayan_baru: number;
    pelayan_nonaktif: number;
  }> {
    const {
      search,
      satelit_id,
      role_id,
      status,
      date_from,
      date_to,
      limit  = 10,
      offset = 0,
    } = params;

    const conditions: string[] = ['p.id IS NOT NULL'];
    const values: any[]        = [];
    let   idx                  = 1;

    if (search) {
      conditions.push(`(j.nama_lengkap ILIKE $${idx} OR p.id_pelayanan ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }
    if (satelit_id) {
      conditions.push(`p.satelit_id = $${idx++}`);
      values.push(parseInt(satelit_id));
    }
    if (role_id) {
      let roleConditions = `pr2.pelayan_id = p.id AND pr2.role_id = $${idx++}`;
      values.push(parseInt(role_id));
      
      if (date_from) {
        roleConditions += ` AND pr2.tanggal_mulai >= $${idx++}::date`;
        values.push(date_from);
      }
      if (date_to) {
        roleConditions += ` AND pr2.tanggal_mulai <= $${idx++}::date`;
        values.push(date_to);
      }
      
      conditions.push(`EXISTS (
        SELECT 1 FROM pelayan_role pr2 WHERE ${roleConditions}
      )`);
    } else {
      if (date_from) {
        conditions.push(`p.tanggal_mulai >= $${idx++}::date`);
        values.push(date_from);
      }
      if (date_to) {
        conditions.push(`p.tanggal_mulai <= $${idx++}::date`);
        values.push(date_to);
      }
    }

    if (status) {
      conditions.push(`p.status_pelayan = $${idx++}`);
      values.push(status);
    }

    const where = conditions.join(' AND ');

    // Pisahkan klausa FROM dan WHERE agar bisa diselipkan JOIN
    const fromJoin = `
      FROM pelayan p
      JOIN jemaat  j  ON p.jemaat_id  = j.id
      JOIN satelit s  ON p.satelit_id = s.id
    `;
    const whereStr = `WHERE ${where}`;

    const [countRes, dataRes, newRes, roleRes] = await Promise.all([
      pool.query(`SELECT COUNT(DISTINCT p.id) AS count ${fromJoin} ${whereStr}`, values),
      pool.query(`
        SELECT
          p.id,
          p.id_pelayanan,
          p.jemaat_id,
          j.jemaat_id         AS jemaat_nomor,
          j.nama_lengkap,
          j.foto_url,
          p.satelit_id,
          s.nama_satelit,
          p.tanggal_mulai,
          p.status_pelayan,
          p.catatan,
          COALESCE(
            STRING_AGG(rp.nama_role, ' • ' ORDER BY rp.nama_role),
            ''
          )                   AS roles,
          COUNT(pr.role_id)   AS jumlah_role
        ${fromJoin}
        LEFT JOIN pelayan_role pr ON pr.pelayan_id = p.id
        LEFT JOIN role_pelayan rp ON rp.id = pr.role_id
        ${whereStr}
        GROUP BY p.id, j.jemaat_id, j.nama_lengkap, j.foto_url, s.nama_satelit
        ORDER BY p.created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, [...values, limit, offset]),
      // Pelayan baru bulan ini
      pool.query(`
        SELECT COUNT(*) AS count FROM pelayan p
        WHERE DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', NOW())
      `),
      // Total pelayan nonaktif
      pool.query(`SELECT COUNT(*) AS count FROM pelayan WHERE status_pelayan != 'Aktif'`),
    ]);

    return {
      data:             dataRes.rows,
      total:            parseInt(countRes.rows[0].count, 10),
      pelayan_baru:     parseInt(newRes.rows[0].count, 10),
      pelayan_nonaktif: parseInt(roleRes.rows[0].count, 10),
    };
  }

  async updatePelayanStatus(id: string, status: string): Promise<boolean> {
    const res = await pool.query(
      `UPDATE pelayan SET status_pelayan = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
      [status, id]
    );
    return res.rowCount !== null && res.rowCount > 0;
  }

  async createPelayan(params: {
    jemaat_id:     number;
    satelit_id:    number;
    tanggal_mulai: string;
    catatan?:      string;
    roles:         { role_id: number; tanggal_mulai: string }[];
    user_id:       number;
    user_role_id:  number;
  }): Promise<{ success: boolean; pelayan_id?: number; message?: string }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get kode_satelit
      const satelitRes = await client.query(`SELECT kode_satelit FROM satelit WHERE id = $1`, [params.satelit_id]);
      if (satelitRes.rowCount === 0) {
        throw new Error('Satelit tidak ditemukan');
      }
      const kode_satelit = satelitRes.rows[0].kode_satelit; // length up to 10? We need to extract digits or use it if it's 2 digits.
      // Usually kode_satelit is something like '01' based on prompt: "2 digit dari kode_satelit di tabel satelit".
      // We will assume kode_satelit is correct length or we substring it.
      const kodeStr = String(kode_satelit).padStart(2, '0').substring(0, 2);

      // 2. Generate ID Pelayan: P[kode_satelit][3 digit urut]
      const prefix = `P${kodeStr}`;
      const lastIdRes = await client.query(`
        SELECT id_pelayanan FROM pelayan
        WHERE id_pelayanan LIKE $1
        ORDER BY id_pelayanan DESC
        LIMIT 1
      `, [`${prefix}%`]);

      let urut = 0; // "start dari 000" means first is 000
      if (lastIdRes.rowCount && lastIdRes.rowCount > 0) {
        const lastId = lastIdRes.rows[0].id_pelayanan;
        const lastUrutStr = lastId.substring(prefix.length);
        const lastUrutNum = parseInt(lastUrutStr, 10);
        if (!isNaN(lastUrutNum)) {
          urut = lastUrutNum + 1;
        }
      }
      const id_pelayanan = `${prefix}${String(urut).padStart(3, '0')}`;

      // 3. Insert into pelayan
      const insertPelayanRes = await client.query(`
        INSERT INTO pelayan (id_pelayanan, jemaat_id, satelit_id, tanggal_mulai, catatan)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [id_pelayanan, params.jemaat_id, params.satelit_id, params.tanggal_mulai, params.catatan || null]);
      
      const pelayan_id = insertPelayanRes.rows[0].id;

      // 4. Insert roles
      for (const role of params.roles) {
        await client.query(`
          INSERT INTO pelayan_role (pelayan_id, role_id, tanggal_mulai)
          VALUES ($1, $2, $3)
        `, [pelayan_id, role.role_id, role.tanggal_mulai]);
      }

      // 5. Insert audit log
      await client.query(`
        INSERT INTO pelayan_audit_log (pelayan_id, aksi, user_id, role_id, satelit_id, keterangan)
        VALUES ($1, 'CREATE', $2, $3, $4, $5)
      `, [
        pelayan_id,
        params.user_id,
        params.user_role_id,
        params.satelit_id,
        `Pelayan baru terdaftar dengan ID ${id_pelayanan}`
      ]);

      await client.query('COMMIT');
      return { success: true, pelayan_id };

    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Error creating pelayan:', error.message);
      if (error.code === '23505') { // unique violation
        return { success: false, message: 'Jemaat ini mungkin sudah terdaftar sebagai pelayan (id_pelayanan duplikat) atau rolenya duplikat.' };
      }
      return { success: false, message: error.message };
    } finally {
      client.release();
    }
  }
}

export const pelayanRepository = new PelayanRepository();
