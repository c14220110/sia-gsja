import pool from '@/lib/db';

export const timPelayanRepository = {

  async getAll(satelit_id?: string): Promise<any[]> {
    const where = satelit_id ? `WHERE tp.satelit_id = ${parseInt(satelit_id)}` : '';
    const res = await pool.query(`
      SELECT
        tp.id,
        tp.nama_tim,
        tp.deskripsi,
        tp.satelit_id,
        s.nama_satelit,
        tp.is_active,
        tp.created_at,
        tp.updated_at,
        COUNT(tpa.id) AS jumlah_anggota
      FROM public.tim_pelayan tp
      LEFT JOIN public.satelit s ON s.id = tp.satelit_id
      LEFT JOIN public.tim_pelayan_anggota tpa ON tpa.tim_id = tp.id
      ${where}
      GROUP BY tp.id, s.nama_satelit
      ORDER BY tp.created_at DESC
    `);
    return res.rows;
  },

  async getById(id: number): Promise<any | null> {
    const res = await pool.query(`
      SELECT
        tp.id,
        tp.nama_tim,
        tp.deskripsi,
        tp.satelit_id,
        s.nama_satelit,
        tp.is_active,
        tp.created_at,
        tp.updated_at
      FROM public.tim_pelayan tp
      LEFT JOIN public.satelit s ON s.id = tp.satelit_id
      WHERE tp.id = $1
    `, [id]);
    return res.rows[0] || null;
  },

  async getAnggota(tim_id: number): Promise<any[]> {
    const res = await pool.query(`
      SELECT
        tpa.id,
        tpa.tim_id,
        tpa.pelayan_id,
        tpa.role_pelayan_id,
        p.id_pelayanan,
        j.nama_lengkap,
        j.foto_url,
        rp.nama_role,
        s.nama_satelit
      FROM public.tim_pelayan_anggota tpa
      JOIN public.pelayan p ON p.id = tpa.pelayan_id
      JOIN public.jemaat j ON j.id = p.jemaat_id
      JOIN public.role_pelayan rp ON rp.id = tpa.role_pelayan_id
      JOIN public.satelit s ON s.id = p.satelit_id
      WHERE tpa.tim_id = $1
      ORDER BY rp.nama_role ASC, j.nama_lengkap ASC
    `, [tim_id]);
    return res.rows;
  },

  async create(data: { nama_tim: string; deskripsi?: string; satelit_id: number }): Promise<any> {
    const res = await pool.query(`
      INSERT INTO public.tim_pelayan (nama_tim, deskripsi, satelit_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [data.nama_tim, data.deskripsi || null, data.satelit_id]);
    return res.rows[0];
  },

  async update(id: number, data: { nama_tim: string; deskripsi?: string; is_active?: boolean }): Promise<any> {
    const res = await pool.query(`
      UPDATE public.tim_pelayan
      SET nama_tim = $1, deskripsi = $2, is_active = COALESCE($3, is_active), updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [data.nama_tim, data.deskripsi || null, data.is_active, id]);
    return res.rows[0];
  },

  async delete(id: number): Promise<boolean> {
    const res = await pool.query(`DELETE FROM public.tim_pelayan WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  },

  async addAnggota(tim_id: number, pelayan_id: number, role_pelayan_id: number): Promise<any> {
    const res = await pool.query(`
      INSERT INTO public.tim_pelayan_anggota (tim_id, pelayan_id, role_pelayan_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (tim_id, pelayan_id) DO UPDATE SET role_pelayan_id = $3
      RETURNING *
    `, [tim_id, pelayan_id, role_pelayan_id]);
    return res.rows[0];
  },

  async removeAnggota(anggota_id: number): Promise<boolean> {
    const res = await pool.query(`DELETE FROM public.tim_pelayan_anggota WHERE id = $1`, [anggota_id]);
    return (res.rowCount ?? 0) > 0;
  },

  async syncAnggota(tim_id: number, anggota: { pelayan_id: number; role_pelayan_id: number }[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM public.tim_pelayan_anggota WHERE tim_id = $1`, [tim_id]);
      for (const a of anggota) {
        await client.query(`
          INSERT INTO public.tim_pelayan_anggota (tim_id, pelayan_id, role_pelayan_id)
          VALUES ($1, $2, $3)
        `, [tim_id, a.pelayan_id, a.role_pelayan_id]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};
