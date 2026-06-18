import pool from '@/lib/db';

export interface PelayanFilterParams {
  search?:       string;
  satelit_id?:   string;
  role_id?:      string;
  status?:       string;
  date_from?:    string;
  date_to?:      string;
  target_month?: string;
  limit?:        number;
  offset?:       number;
  pending_only?: boolean | string;
}

export interface UpdatePelayanParams {
  tanggal_mulai?: string;
  status_pelayan?: string;
  catatan?: string | null;
  roles: {
    role_id: number;
    tanggal_mulai: string | null;
    tanggal_selesai: string | null;
    status_role: string;
  }[];
  user_id: number;
  user_role_id: number;
  jemaat_id: number;
  satelit_id: number;
}

export class PelayanRepository {

  async getPelayanPagination(params: PelayanFilterParams): Promise<{
    data: any[];
    total: number;
    pelayan_baru: number;
    pelayan_nonaktif: number;
    menunggu_konfirmasi: number;
  }> {
    const {
      search,
      satelit_id,
      role_id,
      status,
      date_from,
      date_to,
      target_month,
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
        const fromVal = date_from.length === 7 ? `${date_from}-01` : date_from;
        roleConditions += ` AND pr2.tanggal_mulai >= $${idx++}::date`;
        values.push(fromVal);
      }
      if (date_to) {
        if (date_to.length === 7) {
          roleConditions += ` AND pr2.tanggal_mulai < ($${idx++}::date + INTERVAL '1 month')`;
          values.push(`${date_to}-01`);
        } else {
          roleConditions += ` AND pr2.tanggal_mulai <= $${idx++}::date`;
          values.push(date_to);
        }
      }
      
      conditions.push(`EXISTS (
        SELECT 1 FROM pelayan_role pr2 WHERE ${roleConditions}
      )`);
    } else {
      if (date_from) {
        const fromVal = date_from.length === 7 ? `${date_from}-01` : date_from;
        conditions.push(`p.tanggal_mulai >= $${idx++}::date`);
        values.push(fromVal);
      }
      if (date_to) {
        if (date_to.length === 7) {
          conditions.push(`p.tanggal_mulai < ($${idx++}::date + INTERVAL '1 month')`);
          values.push(`${date_to}-01`);
        } else {
          conditions.push(`p.tanggal_mulai <= $${idx++}::date`);
          values.push(date_to);
        }
      }
    }

    if (status) {
      conditions.push(`p.status_pelayan = $${idx++}`);
      values.push(status);
    }

    const targetMonthVal = target_month ? (target_month.length === 7 ? `${target_month}-01` : target_month) : null;

    if (params.pending_only === 'true' || params.pending_only === true) {
      conditions.push(`EXISTS (
        SELECT 1 FROM kegiatan_jadwal_pelayan kjp2
        JOIN kegiatan k2 ON kjp2.kegiatan_id = k2.id
        WHERE kjp2.pelayan_id = p.id
          AND kjp2.status_konfirmasi = 'Menunggu Konfirmasi'
          AND DATE_TRUNC('month', k2.tanggal_mulai) = DATE_TRUNC('month', COALESCE($${idx++}::date, CURRENT_DATE))
      )`);
      values.push(targetMonthVal);
    }

    const where = conditions.join(' AND ');

    // Pecah posisi klausa FROM sama WHERE biar kita punya celah buat nyelipin JOIN sesuka hati
    const fromJoin = `
      FROM pelayan p
      JOIN jemaat  j  ON p.jemaat_id  = j.id
      JOIN satelit s  ON p.satelit_id = s.id
    `;
    const whereStr = `WHERE ${where}`;

    const [countRes, dataRes, newRes, roleRes, waitRes] = await Promise.all([
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
          COUNT(pr.role_id)   AS jumlah_role,
          (
            SELECT COUNT(*) 
            FROM kegiatan_jadwal_pelayan kjp 
            JOIN kegiatan k ON kjp.kegiatan_id = k.id 
            WHERE kjp.pelayan_id = p.id 
              AND DATE_TRUNC('month', k.tanggal_mulai) = DATE_TRUNC('month', COALESCE($${idx + 2}::date, CURRENT_DATE))
          ) AS jadwal_bulan_ini
        ${fromJoin}
        LEFT JOIN pelayan_role pr ON pr.pelayan_id = p.id
        LEFT JOIN role_pelayan rp ON rp.id = pr.role_id
        ${whereStr}
        GROUP BY p.id, j.jemaat_id, j.nama_lengkap, j.foto_url, s.nama_satelit
        ORDER BY p.created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, [...values, limit, offset, targetMonthVal]),
      // Pelayan-pelayan anyar yang baru join bulan ini
      pool.query(`
        SELECT COUNT(*) AS count FROM pelayan p
        WHERE DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', NOW())
      `),
      // Total seluruh pelayan yang lagi pada vakum alias nonaktif
      pool.query(`SELECT COUNT(*) AS count FROM pelayan WHERE status_pelayan != 'Aktif'`),
      // Masih pada nunggu konfirmasi (Bisa global se-gereja / atau sesuai filter satelitnya)
      pool.query(`
        SELECT COUNT(DISTINCT kjp.id) AS count
        FROM kegiatan_jadwal_pelayan kjp
        JOIN pelayan p ON kjp.pelayan_id = p.id
        WHERE kjp.status_konfirmasi = 'Menunggu Konfirmasi'
        ${satelit_id ? 'AND p.satelit_id = ' + parseInt(satelit_id) : ''}
      `)
    ]);

    return {
      data:             dataRes.rows,
      total:            parseInt(countRes.rows[0].count, 10),
      pelayan_baru:     parseInt(newRes.rows[0].count, 10),
      pelayan_nonaktif: parseInt(roleRes.rows[0].count, 10),
      menunggu_konfirmasi: parseInt(waitRes.rows[0].count, 10),
    };
  }

  async getRiwayatPelayanan(id: number) {
    const riwayatQuery = `
      SELECT 
        k.nama_kegiatan,
        k.tanggal_mulai,
        k.waktu_mulai,
        rp.nama_role,
        kjp.status_konfirmasi
      FROM kegiatan_jadwal_pelayan kjp
      JOIN kegiatan k ON kjp.kegiatan_id = k.id
      JOIN role_pelayan rp ON kjp.role_id = rp.id
      WHERE kjp.pelayan_id = $1
      ORDER BY k.tanggal_mulai DESC, k.waktu_mulai DESC
    `;
    const res = await pool.query(riwayatQuery, [id]);
    
    let totalJadwal = res.rows.length;
    let totalHadir = 0;
    let totalBatal = 0;
    
    res.rows.forEach(r => {
      if (r.status_konfirmasi === 'Hadir' || r.status_konfirmasi === 'Bersedia') totalHadir++;
      if (r.status_konfirmasi === 'Berhalangan' || r.status_konfirmasi === 'Tidak Hadir') totalBatal++;
    });

    // Kita hitung angka komitmen kesetiaannya cuma dari jadwal yang udah lewat atau udah resmi dikonfirmasi hadir aja
    const pastOrConfirmed = res.rows.filter(r => 
      ['Hadir', 'Bersedia', 'Berhalangan', 'Tidak Hadir'].includes(r.status_konfirmasi)
    ).length;
    
    const komitmen = pastOrConfirmed > 0 ? Math.round((totalHadir / pastOrConfirmed) * 100) : 0;

    return {
      statistik: {
        total_jadwal: totalJadwal,
        total_hadir: totalHadir,
        total_batal: totalBatal,
        komitmen: komitmen
      },
      riwayat: res.rows
    };
  }

  async getRosterAdmin(month: number, year: number, satelit_id?: string) {
    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    const whereClause = satelit_id ? `AND p.satelit_id = ${parseInt(satelit_id)}` : '';
    
    const query = `
      SELECT 
        kjp.id AS roster_id,
        k.tanggal_mulai,
        k.nama_kegiatan,
        k.waktu_mulai,
        k.lokasi_kegiatan,
        rp.nama_role,
        p.id AS pelayan_id,
        j.nama_lengkap,
        j.foto_url,
        kjp.status_konfirmasi
      FROM kegiatan_jadwal_pelayan kjp
      JOIN kegiatan k ON kjp.kegiatan_id = k.id
      JOIN pelayan p ON kjp.pelayan_id = p.id
      JOIN jemaat j ON p.jemaat_id = j.id
      JOIN role_pelayan rp ON kjp.role_id = rp.id
      WHERE DATE_TRUNC('month', k.tanggal_mulai) = DATE_TRUNC('month', $1::date)
        ${whereClause}
      ORDER BY k.tanggal_mulai ASC, k.waktu_mulai ASC
    `;
    const res = await pool.query(query, [startOfMonth]);
    return res.rows;
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

      // 0. Cek duplikasi: jemaat sudah punya row pelayan di satelit yang sama?
      const dupCheck = await client.query(
        `SELECT id, id_pelayanan FROM pelayan WHERE jemaat_id = $1 AND satelit_id = $2 LIMIT 1`,
        [params.jemaat_id, params.satelit_id]
      );
      if (dupCheck.rowCount && dupCheck.rowCount > 0) {
        throw new Error(
          `Jemaat ini sudah terdaftar sebagai pelayan di satelit yang sama (ID: ${dupCheck.rows[0].id_pelayanan}). ` +
          `Untuk menambah role baru, gunakan menu Edit Detail Pelayan.`
        );
      }

      // 1. Get kode_satelit
      const satelitRes = await client.query(`SELECT kode_satelit FROM satelit WHERE id = $1`, [params.satelit_id]);
      if (satelitRes.rowCount === 0) {
        throw new Error('Satelit tidak ditemukan');
      }
      const kodeStr = String(satelitRes.rows[0].kode_satelit).padStart(2, '0').substring(0, 2);

      // 2. Generate ID Pelayan: P[kode_satelit][3 digit urut]
      const prefix = `P${kodeStr}`;
      const lastIdRes = await client.query(`
        SELECT id_pelayanan FROM pelayan
        WHERE id_pelayanan LIKE $1
        ORDER BY id_pelayanan DESC
        LIMIT 1
      `, [`${prefix}%`]);

      let urut = 0;
      if (lastIdRes.rowCount && lastIdRes.rowCount > 0) {
        const lastUrutNum = parseInt(lastIdRes.rows[0].id_pelayanan.substring(prefix.length), 10);
        if (!isNaN(lastUrutNum)) urut = lastUrutNum + 1;
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
      if (error.code === '23505') { // aduh, nabrak aturan unik nih (datanya udah pernah ada)
        return { success: false, message: 'Jemaat ini mungkin sudah terdaftar sebagai pelayan (id_pelayanan duplikat) atau rolenya duplikat.' };
      }
      return { success: false, message: error.message };
    } finally {
      client.release();
    }
  }

  async getPelayanById(id: number) {
    const query = `
      SELECT 
        p.id,
        p.id_pelayanan,
        p.jemaat_id,
        p.satelit_id,
        p.tanggal_mulai,
        p.status_pelayan,
        p.catatan,
        p.created_at,
        p.updated_at,
        j.nama_lengkap,
        j.foto_url,
        j.jemaat_id as jemaat_nomor,
        s.nama_satelit
      FROM pelayan p
      JOIN jemaat j ON p.jemaat_id = j.id
      JOIN satelit s ON p.satelit_id = s.id
      WHERE p.id = $1
    `;
    const res = await pool.query(query, [id]);
    if (res.rowCount === 0) return null;
    const pelayan = res.rows[0];

    const rolesQuery = `
      SELECT 
        pr.id,
        pr.role_id,
        r.nama_role,
        pr.tanggal_mulai,
        pr.tanggal_selesai,
        pr.status_role
      FROM pelayan_role pr
      JOIN role_pelayan r ON pr.role_id = r.id
      WHERE pr.pelayan_id = $1
    `;
    const rolesRes = await pool.query(rolesQuery, [id]);
    pelayan.roles = rolesRes.rows;

    return pelayan;
  }

  async updatePelayan(id: number, params: UpdatePelayanParams): Promise<{ success: boolean; message?: string }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updates = [];
      const values = [];
      let idx = 1;

      if (params.tanggal_mulai !== undefined) {
        updates.push(`tanggal_mulai = $${idx++}`);
        values.push(params.tanggal_mulai);
      }
      if (params.status_pelayan !== undefined) {
        updates.push(`status_pelayan = $${idx++}`);
        values.push(params.status_pelayan);
      }
      if (params.catatan !== undefined) {
        updates.push(`catatan = $${idx++}`);
        values.push(params.catatan);
      }

      if (updates.length > 0) {
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);
        const updateQuery = `
          UPDATE pelayan
          SET ${updates.join(', ')}
          WHERE id = $${idx}
        `;
        await client.query(updateQuery, values);
      }

      const existingRolesRes = await client.query(`SELECT role_id FROM pelayan_role WHERE pelayan_id = $1`, [id]);
      const existingRoles = existingRolesRes.rows.map(r => r.role_id);
      
      const newRoleIds = params.roles.map(r => r.role_id);
      
      for (const existingRole of existingRoles) {
        if (!newRoleIds.includes(existingRole)) {
           await client.query(`DELETE FROM pelayan_role WHERE pelayan_id = $1 AND role_id = $2`, [id, existingRole]);
        }
      }

      for (const role of params.roles) {
        if (existingRoles.includes(role.role_id)) {
           await client.query(`
             UPDATE pelayan_role 
             SET tanggal_mulai = $1, tanggal_selesai = $2, status_role = $3
             WHERE pelayan_id = $4 AND role_id = $5
           `, [role.tanggal_mulai, role.tanggal_selesai || null, role.status_role, id, role.role_id]);
        } else {
           await client.query(`
             INSERT INTO pelayan_role (pelayan_id, role_id, tanggal_mulai, tanggal_selesai, status_role)
             VALUES ($1, $2, $3, $4, $5)
           `, [id, role.role_id, role.tanggal_mulai, role.tanggal_selesai || null, role.status_role]);
        }
      }

      const aksiUpdate = params.status_pelayan === 'Tidak Aktif' ? 'DEACTIVATE' : 'UPDATE';
      await client.query(`
        INSERT INTO pelayan_audit_log (pelayan_id, aksi, user_id, role_id, satelit_id, keterangan)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        id, 
        aksiUpdate,
        params.user_id, 
        params.user_role_id, 
        params.satelit_id, 
        params.status_pelayan === 'Tidak Aktif' ? 'Pelayan dinonaktifkan' : 'Mengupdate data pelayan'
      ]);

      await client.query('COMMIT');
      return { success: true };
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Error updating pelayan:', error.message);
      return { success: false, message: error.message };
    } finally {
      client.release();
    }
  }
}

export const pelayanRepository = new PelayanRepository();
