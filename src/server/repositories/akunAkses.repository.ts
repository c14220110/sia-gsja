import pool from '@/lib/db';

export class AkunAksesRepository {
  /**
   * Mengambil daftar Role Sistem
   */
  async getRoles(): Promise<any[]> {
    const res = await pool.query(`
      SELECT r.id, r.nama_role, r.deskripsi, r.is_active,
             (SELECT COUNT(*) FROM user_role ur WHERE ur.role_id = r.id) AS jumlah_pengguna
      FROM role r
      ORDER BY r.nama_role ASC
    `);
    return res.rows;
  }

  /**
   * Mengambil semua Permission dari master
   */
  async getPermissions(): Promise<any[]> {
    const res = await pool.query(`
      SELECT id, nama_permission, deskripsi
      FROM permission
      ORDER BY id ASC
    `);
    return res.rows;
  }

  /**
   * Mengambil daftar Permission IDs yang dimiliki oleh suatu Role
   */
  async getRolePermissions(roleId: number): Promise<number[]> {
    const res = await pool.query(`SELECT permission_id FROM role_permission WHERE role_id = $1`, [roleId]);
    return res.rows.map(row => row.permission_id);
  }

  /**
   * Menyimpan matrik permission (Bulk Delete + Insert)
   */
  async updateRolePermissions(roleId: number, permissionIds: number[]): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // 1. Delete all existing permissions
      await client.query(`DELETE FROM role_permission WHERE role_id = $1`, [roleId]);
      
      // 2. Insert new permissions only if there are any
      if (permissionIds.length > 0) {
        let values: any[] = [];
        let params: string[] = [];
        let idx = 1;

        permissionIds.forEach((pid) => {
          params.push(`($${idx++}, $${idx++})`);
          values.push(roleId, pid);
        });

        const insertQuery = `INSERT INTO role_permission (role_id, permission_id) VALUES ${params.join(', ')}`;
        await client.query(insertQuery, values);
      }
      
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in updateRolePermissions:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Mengambil daftar akun pengguna beserta role
   */
  async getPenggunaList(): Promise<any[]> {
    const res = await pool.query(`
      SELECT 
        p.id, p.email, p.is_active, p.last_login_at, p.jemaat_id,
        j.nama_lengkap,
        COALESCE(
          json_agg(
            json_build_object(
              'role_id', r.id,
              'satelit_id', s.id,
              'role_name', r.nama_role,
              'satelit_name', s.nama_satelit,
              'tanggal_mulai', ur.tanggal_mulai,
              'tanggal_selesai', ur.tanggal_selesai
            )
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) AS roles
      FROM pengguna p
      LEFT JOIN jemaat j ON p.jemaat_id = j.id
      LEFT JOIN user_role ur ON p.id = ur.user_id AND ur.is_active = true
      LEFT JOIN role r ON ur.role_id = r.id
      LEFT JOIN satelit s ON ur.satelit_id = s.id
      GROUP BY p.id, j.id
      ORDER BY p.created_at DESC
    `);
    return res.rows;
  }

  /**
   * Membuat Kredensial Pengguna Baru (Bcrypt handled di route)
   * Menyimpan ke pengguna dan user_role sekaligus
   */
  async createPengguna(data: {
    email: string;
    password_hash: string;
    jemaat_id: number;
    role_id: number;
    satelit_id: number;
  }): Promise<{ success: boolean; message?: string }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert pengguna. jemaat_id is unique, so checking if user already exists
      const existUser = await client.query(`SELECT id FROM pengguna WHERE jemaat_id = $1 OR email = $2`, [data.jemaat_id, data.email]);
      let userId;

      if (existUser.rowCount && existUser.rowCount > 0) {
        const existWithSameEmail = await client.query(`SELECT id FROM pengguna WHERE email = $1`, [data.email]);
        if(existWithSameEmail.rowCount && existWithSameEmail.rowCount > 0 && existWithSameEmail.rows[0].id !== existUser.rows[0].id) {
          throw new Error('Email sudah terdaftar untuk pengguna lain.');
        }
        
        userId = existUser.rows[0].id;
        // Optionally update password if needed, but for now we throw error if completely duplicate
      } else {
        const insUser = await client.query(`
          INSERT INTO pengguna (email, password_hash, jemaat_id)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [data.email, data.password_hash, data.jemaat_id]);
        userId = insUser.rows[0].id;
      }

      // 2. Insert role to user
      await client.query(`
        INSERT INTO user_role (user_id, role_id, satelit_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, role_id, satelit_id) DO UPDATE SET is_active = true
      `, [userId, data.role_id, data.satelit_id]);

      await client.query('COMMIT');
      return { success: true };
    } catch (error: any) {
      try { await client.query('ROLLBACK'); } catch (e) {}
      console.error('Error createPengguna:', error);
      if (error.code === '23505') {
         return { success: false, message: 'Email atau Jemaat ini sudah memiliki akun di sistem' };
      }
      return { success: false, message: error.message };
    } finally {
      client.release();
    }
  }

  /**
   * Membuat Pengguna Baru dengan Multi-Role Assignment
   */
  async createPenggunaMultiRole(data: {
    email: string;
    password_hash: string;
    jemaat_id: number;
    roles: { role_id: number; satelit_id: number }[];
    komisi_id?: number | null;
    departemen_id?: number | null;
  }): Promise<{ success: boolean; message?: string }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existUser = await client.query(`SELECT id FROM pengguna WHERE jemaat_id = $1 OR email = $2`, [data.jemaat_id, data.email]);
      let userId;

      if (existUser.rowCount && existUser.rowCount > 0) {
        userId = existUser.rows[0].id;
      } else {
        const insUser = await client.query(`
          INSERT INTO pengguna (email, password_hash, jemaat_id)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [data.email, data.password_hash, data.jemaat_id]);
        userId = insUser.rows[0].id;
      }

      // Insert all roles with optional scope
      for (const role of data.roles) {
        await client.query(`
          INSERT INTO user_role (user_id, role_id, satelit_id, komisi_id, departemen_id)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (user_id, role_id, satelit_id) DO UPDATE 
            SET is_active = true,
                komisi_id = EXCLUDED.komisi_id,
                departemen_id = EXCLUDED.departemen_id
        `, [userId, role.role_id, role.satelit_id, data.komisi_id ?? null, data.departemen_id ?? null]);
      }

      await client.query('COMMIT');
      return { success: true };
    } catch (error: any) {
      try { await client.query('ROLLBACK'); } catch (e) {}
      console.error('Error createPenggunaMultiRole:', error);
      if (error.code === '23505') {
        return { success: false, message: 'Email atau Jemaat ini sudah memiliki akun di sistem' };
      }
      return { success: false, message: error.message };
    } finally {
      client.release();
    }
  }

  /**
   * Toggle status aktif/nonaktif pengguna
   */
  async toggleUserStatus(userId: number, isActive: boolean): Promise<{ success: boolean; message?: string }> {
    try {
      await pool.query(`UPDATE pengguna SET is_active = $1 WHERE id = $2`, [isActive, userId]);
      return { success: true };
    } catch (error: any) {
      console.error('Error toggleUserStatus:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Update data pengguna (email, password opsional, dan roles)
   */
  async updatePengguna(userId: number, data: {
    email?: string;
    password_hash?: string;
    roles?: { role_id: number; satelit_id: number }[];
  }): Promise<{ success: boolean; message?: string }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update email / password jika ada
      if (data.email || data.password_hash) {
        const updates: string[] = [];
        const vals: any[] = [];
        let idx = 1;
        if (data.email) { updates.push(`email = $${idx++}`); vals.push(data.email); }
        if (data.password_hash) { updates.push(`password_hash = $${idx++}`); vals.push(data.password_hash); }
        updates.push(`updated_at = NOW()`);
        vals.push(userId);
        await client.query(`UPDATE pengguna SET ${updates.join(', ')} WHERE id = $${idx}`, vals);
      }

      // Update roles jika diberikan
      if (data.roles !== undefined) {
        // Hapus semua permanent roles (bukan panitia sementara)
        await client.query(`DELETE FROM user_role WHERE user_id = $1 AND tanggal_selesai IS NULL`, [userId]);
        // Insert roles baru
        for (const role of data.roles) {
          await client.query(`
            INSERT INTO user_role (user_id, role_id, satelit_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, role_id, satelit_id) DO UPDATE SET is_active = true
          `, [userId, role.role_id, role.satelit_id]);
        }
      }

      await client.query('COMMIT');
      return { success: true };
    } catch (error: any) {
      try { await client.query('ROLLBACK'); } catch (e) {}
      console.error('Error updatePengguna:', error);
      if (error.code === '23505') {
        return { success: false, message: 'Email sudah digunakan oleh pengguna lain.' };
      }
      return { success: false, message: error.message };
    } finally {
      client.release();
    }
  }

  /**
   * Tambah Akses Sementara (Temporary Access)
   */
  async addTemporaryAccess(data: {
    user_id: number;
    role_id: number;
    satelit_id: number;
    tanggal_mulai: string;
    tanggal_selesai: string;
  }): Promise<{ success: boolean; message?: string }> {
    try {
      await pool.query(`
        INSERT INTO user_role (user_id, role_id, satelit_id, tanggal_mulai, tanggal_selesai)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, role_id, satelit_id) 
        DO UPDATE SET tanggal_mulai = $4, tanggal_selesai = $5, is_active = true
      `, [data.user_id, data.role_id, data.satelit_id, data.tanggal_mulai, data.tanggal_selesai]);
      
      return { success: true };
    } catch (error: any) {
      console.error('Error addTemporaryAccess:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Bulk Generate Akun Jemaat (Akun Massal)
   */
  async bulkCreatePengguna(dataList: {
    email: string;
    password_hash: string;
    jemaat_id: number;
    satelit_id: number;
  }[]): Promise<{ success: boolean; createdCount: number; message?: string }> {
    const client = await pool.connect();
    let createdCount = 0;
    try {
      await client.query('BEGIN');
      
      // Ambil ID dari Role 'JEMAAT'
      const roleRow = await client.query(`SELECT id FROM role WHERE UPPER(nama_role) = 'JEMAAT' LIMIT 1`);
      const roleJemaatId = roleRow.rowCount && roleRow.rowCount > 0 ? roleRow.rows[0].id : null;

      for (const data of dataList) {
        // Cek apakah email/jemaat sudah ada
        const existUser = await client.query(`SELECT id FROM pengguna WHERE jemaat_id = $1 OR email = $2`, [data.jemaat_id, data.email]);
        if (existUser.rowCount && existUser.rowCount > 0) {
          continue; // Skip jika sudah ada
        }

        // Insert ke pengguna
        const insUser = await client.query(`
          INSERT INTO pengguna (email, password_hash, jemaat_id, requires_password_change)
          VALUES ($1, $2, $3, true)
          RETURNING id
        `, [data.email, data.password_hash, data.jemaat_id]);
        
        const userId = insUser.rows[0].id;

        // Insert ke user_role sebagai JEMAAT jika role id ditemukan
        if (roleJemaatId) {
          await client.query(`
            INSERT INTO user_role (user_id, role_id, satelit_id)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
          `, [userId, roleJemaatId, data.satelit_id]);
        }
        
        createdCount++;
      }

      await client.query('COMMIT');
      return { success: true, createdCount };
    } catch (error: any) {
      try { await client.query('ROLLBACK'); } catch (e) {}
      console.error('Error bulkCreatePengguna:', error);
      return { success: false, createdCount: 0, message: error.message };
    } finally {
      client.release();
    }
  }
}

export const akunAksesRepository = new AkunAksesRepository();
