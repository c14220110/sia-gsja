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
    total_role: number;
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
      conditions.push(`EXISTS (
        SELECT 1 FROM pelayan_role pr2 WHERE pr2.pelayan_id = p.id AND pr2.role_id = $${idx++}
      )`);
      values.push(parseInt(role_id));
    }
    if (status) {
      conditions.push(`p.status_pelayan = $${idx++}`);
      values.push(status);
    }
    if (date_from) {
      conditions.push(`p.tanggal_mulai >= $${idx++}::date`);
      values.push(date_from);
    }
    if (date_to) {
      conditions.push(`p.tanggal_mulai <= $${idx++}::date`);
      values.push(date_to);
    }

    const where = conditions.join(' AND ');

    const baseFrom = `
      FROM pelayan p
      JOIN jemaat  j  ON p.jemaat_id  = j.id
      JOIN satelit s  ON p.satelit_id = s.id
      WHERE ${where}
    `;

    const [countRes, dataRes, newRes, roleRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS count ${baseFrom}`, values),
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
        ${baseFrom}
        LEFT JOIN pelayan_role pr ON pr.pelayan_id = p.id
        LEFT JOIN role_pelayan rp ON rp.id = pr.role_id
        GROUP BY p.id, j.jemaat_id, j.nama_lengkap, j.foto_url, s.nama_satelit
        ORDER BY p.created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, [...values, limit, offset]),
      // Pelayan baru bulan ini
      pool.query(`
        SELECT COUNT(*) AS count FROM pelayan p
        WHERE DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', NOW())
      `),
      // Total role pelayanan aktif
      pool.query(`SELECT COUNT(*) AS count FROM role_pelayan`),
    ]);

    return {
      data:         dataRes.rows,
      total:        parseInt(countRes.rows[0].count, 10),
      pelayan_baru: parseInt(newRes.rows[0].count, 10),
      total_role:   parseInt(roleRes.rows[0].count, 10),
    };
  }

  async updatePelayanStatus(id: string, status: string): Promise<boolean> {
    const res = await pool.query(
      `UPDATE pelayan SET status_pelayan = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
      [status, id]
    );
    return res.rowCount !== null && res.rowCount > 0;
  }
}

export const pelayanRepository = new PelayanRepository();
