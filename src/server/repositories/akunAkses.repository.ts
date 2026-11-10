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
      WITH user_roles_combined AS (
        -- Role dari tabel user_role
        SELECT 
          ur.user_id,
          r.id AS role_id,
          s.id AS satelit_id,
          r.nama_role AS role_name,
          s.nama_satelit AS satelit_name,
          ur.tanggal_mulai,
          ur.tanggal_selesai
        FROM user_role ur
        JOIN role r ON ur.role_id = r.id
        JOIN satelit s ON ur.satelit_id = s.id
        WHERE ur.is_active = true

        UNION

        -- Fallback: role JEMAAT dari tautan jemaat_id (jika belum ada di user_role)
        SELECT 
          p.id AS user_id,
          (SELECT id FROM role WHERE UPPER(nama_role) = 'JEMAAT') AS role_id,
          j.satelit_id,
          'JEMAAT' AS role_name,
          s.nama_satelit AS satelit_name,
          NULL::timestamp AS tanggal_mulai,
          NULL::timestamp AS tanggal_selesai
        FROM pengguna p
        JOIN jemaat j ON p.jemaat_id = j.id
        LEFT JOIN satelit s ON j.satelit_id = s.id
        WHERE p.jemaat_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM user_role ur2
            JOIN role r2 ON ur2.role_id = r2.id
            WHERE ur2.user_id = p.id
              AND UPPER(r2.nama_role) = 'JEMAAT'
              AND ur2.is_active = true
          )
      )
      SELECT 
        p.id, p.email, p.no_hp, p.username, p.is_active, p.last_login_at, p.jemaat_id,
        j.nama_lengkap, j.jemaat_id AS jemaat_id_str, j.foto_url,
        COALESCE(
          json_agg(
            json_build_object(
              'role_id', urc.role_id,
              'satelit_id', urc.satelit_id,
              'role_name', urc.role_name,
              'satelit_name', urc.satelit_name,
              'tanggal_mulai', urc.tanggal_mulai,
              'tanggal_selesai', urc.tanggal_selesai
            )
          ) FILTER (WHERE urc.role_id IS NOT NULL),
          '[]'
        ) AS roles
      FROM pengguna p
      LEFT JOIN jemaat j ON p.jemaat_id = j.id
      LEFT JOIN user_roles_combined urc ON p.id = urc.user_id
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
        // Silakan klw kepengen update passnya, tp buat sekrg ini, lsg di tolak kl bneran ganda persis kembarku
      } else {
        const insUser = await client.query(`
          INSERT INTO pengguna (email, password_hash, jemaat_id, requires_password_change)
          VALUES ($1, $2, $3, false)
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
         return { success: false, message: 'Identifier (Email/No HP/Username) atau Jemaat ini sudah memiliki akun di sistem' };
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
    jemaat_id: number | null;
    roles: { role_id: number; satelit_id: number; komisi_id?: number | null; departemen_id?: number | null }[];
  }): Promise<{ success: boolean; message?: string }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const input = data.email.trim();
      let isEmail = false;
      let isPhone = false;
      let isUsername = false;

      if (input.includes('@')) {
        isEmail = true;
      } else if (/^\d+$/.test(input)) {
        isPhone = true;
      } else {
        isUsername = true;
      }

      // Cek duplikat identifier — SELALU tolak jika sudah dipakai (oleh siapapun)
      const identifierCheck = await client.query(
        `SELECT id FROM pengguna WHERE email = $1 OR no_hp = $1 OR username = $1`,
        [input]
      );
      if (identifierCheck.rowCount && identifierCheck.rowCount > 0) {
        await client.query('ROLLBACK');
        const type = isEmail ? 'Email' : isPhone ? 'No. HP' : 'Username';
        return { success: false, message: `${type} ini sudah terdaftar di sistem. Gunakan identifier lain atau edit akun yang sudah ada.` };
      }

      // Cek duplikat jemaat_id jika diberikan
      if (data.jemaat_id) {
        const jemaatCheck = await client.query(
          `SELECT id FROM pengguna WHERE jemaat_id = $1`,
          [data.jemaat_id]
        );
        if (jemaatCheck.rowCount && jemaatCheck.rowCount > 0) {
          await client.query('ROLLBACK');
          return { success: false, message: 'Jemaat ini sudah memiliki akun login di sistem.' };
        }
      }

      // Insert pengguna baru
      const insUser = await client.query(`
        INSERT INTO pengguna (email, no_hp, username, password_hash, jemaat_id, requires_password_change)
        VALUES ($1, $2, $3, $4, $5, false)
        RETURNING id
      `, [isEmail ? input : null, isPhone ? input : null, isUsername ? input : null, data.password_hash, data.jemaat_id]);
      const userId = insUser.rows[0].id;

      // Insert all roles
      for (const role of data.roles) {
        await client.query(`
          INSERT INTO user_role (user_id, role_id, satelit_id, komisi_id, departemen_id)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (user_id, role_id, satelit_id) DO UPDATE 
            SET is_active = true,
                komisi_id = EXCLUDED.komisi_id,
                departemen_id = EXCLUDED.departemen_id
        `, [userId, role.role_id, role.satelit_id, role.komisi_id ?? null, role.departemen_id ?? null]);
      }

      await client.query('COMMIT');
      return { success: true };
    } catch (error: any) {
      try { await client.query('ROLLBACK'); } catch (e) {}
      console.error('[AkunAksesRepository] createPenggunaMultiRole error:', error);
      if (error.code === '23505') {
        return { success: false, message: 'Identifier (Email/No HP/Username) atau Jemaat ini sudah memiliki akun di sistem.' };
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
    jemaat_id?: number | null; // null = hapus link, number = ganti/set link
    roles?: { role_id: number; satelit_id: number; komisi_id?: number | null; departemen_id?: number | null }[];
  }): Promise<{ success: boolean; message?: string }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update email / password jika ada
      if (data.email || data.password_hash) {
        const updates: string[] = [];
        const vals: any[] = [];
        let idx = 1;
        if (data.email) {
          const input = data.email.trim();
          if (input.includes('@')) {
            updates.push(`email = $${idx++}`);
          } else if (/^\d+$/.test(input)) {
            updates.push(`no_hp = $${idx++}`);
          } else {
            updates.push(`username = $${idx++}`);
          }
          vals.push(input);
        }
        if (data.password_hash) { updates.push(`password_hash = $${idx++}`); vals.push(data.password_hash); }
        updates.push(`updated_at = NOW()`);
        vals.push(userId);
        await client.query(`UPDATE pengguna SET ${updates.join(', ')} WHERE id = $${idx}`, vals);
      }

      // Update jemaat_id jika disertakan (null = hapus link, number = set link)
      if (data.jemaat_id !== undefined) {
        if (data.jemaat_id !== null) {
          // Cek apakah jemaat ini sudah ditautkan ke akun lain
          const existing = await client.query(
            `SELECT id FROM pengguna WHERE jemaat_id = $1 AND id != $2`,
            [data.jemaat_id, userId]
          );
          if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return { success: false, message: 'Jemaat ini sudah ditautkan ke akun pengguna lain.' };
          }
        }
        await client.query(
          `UPDATE pengguna SET jemaat_id = $1, updated_at = NOW() WHERE id = $2`,
          [data.jemaat_id, userId]
        );
      }

      // Update roles jika diberikan
      if (data.roles !== undefined) {
        // Ambil ID role JEMAAT untuk dikecualikan dari penghapusan
        const jemaatRoleRow = await client.query(`SELECT id FROM role WHERE UPPER(nama_role) = 'JEMAAT' LIMIT 1`);
        const jemaatRoleId = jemaatRoleRow.rowCount && jemaatRoleRow.rowCount > 0 ? jemaatRoleRow.rows[0].id : null;

        // Hapus semua permanent roles KECUALI JEMAAT (role JEMAAT dikelola otomatis via tautan jemaat)
        if (jemaatRoleId) {
          await client.query(
            `DELETE FROM user_role WHERE user_id = $1 AND tanggal_selesai IS NULL AND role_id != $2`,
            [userId, jemaatRoleId]
          );
        } else {
          // Fallback jika role JEMAAT tidak ditemukan
          await client.query(`DELETE FROM user_role WHERE user_id = $1 AND tanggal_selesai IS NULL`, [userId]);
        }

        // Insert roles baru (non-JEMAAT dari form)
        for (const role of data.roles) {
          await client.query(`
            INSERT INTO user_role (user_id, role_id, satelit_id, komisi_id, departemen_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id, role_id, satelit_id) DO UPDATE 
              SET is_active = true,
                  komisi_id = EXCLUDED.komisi_id,
                  departemen_id = EXCLUDED.departemen_id
          `, [userId, role.role_id, role.satelit_id, role.komisi_id ?? null, role.departemen_id ?? null]);
        }
      }

      // Sinkronisasi role JEMAAT berdasarkan tautan jemaat_id
      // Jika user ditautkan ke jemaat → pastikan ada role JEMAAT
      // Jika tautan dihapus → hapus role JEMAAT
      const currentUser = await client.query(`SELECT jemaat_id FROM pengguna WHERE id = $1`, [userId]);
      const currentJemaatId = currentUser.rows[0]?.jemaat_id;
      const jemaatRoleSync = await client.query(`SELECT id FROM role WHERE UPPER(nama_role) = 'JEMAAT' LIMIT 1`);
      const syncRoleId = jemaatRoleSync.rowCount && jemaatRoleSync.rowCount > 0 ? jemaatRoleSync.rows[0].id : null;

      if (syncRoleId) {
        if (currentJemaatId) {
          // User tertaut ke jemaat → pastikan role JEMAAT ada
          const jemaatSatelit = await client.query(`SELECT satelit_id FROM jemaat WHERE id = $1`, [currentJemaatId]);
          const satelitId = jemaatSatelit.rows[0]?.satelit_id || null;
          await client.query(`
            INSERT INTO user_role (user_id, role_id, satelit_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, role_id, satelit_id) DO UPDATE SET is_active = true
          `, [userId, syncRoleId, satelitId]);
        } else {
          // User tidak tertaut ke jemaat → hapus role JEMAAT
          await client.query(
            `DELETE FROM user_role WHERE user_id = $1 AND role_id = $2`,
            [userId, syncRoleId]
          );
        }
      }

      await client.query('COMMIT');
      return { success: true };
    } catch (error: any) {
      try { await client.query('ROLLBACK'); } catch (e) {}
      console.error('Error updatePengguna:', error);
      if (error.code === '23505') {
        return { success: false, message: 'Identifier (Email/No HP/Username) sudah digunakan oleh pengguna lain.' };
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
    email?: string | null;
    no_hp?: string | null;
    password_hash: string;
    jemaat_id: number;
    satelit_id: number;
    nama_lengkap?: string;
  }[]): Promise<{ success: boolean; createdCount: number; noIdentifierCount?: number; skippedList?: { nama: string; alasan: string }[]; message?: string }> {
    const client = await pool.connect();
    let createdCount = 0;
    let noIdentifierCount = 0;
    const skippedList: { nama: string; alasan: string }[] = [];
    try {
      await client.query('BEGIN');
      
      // Ambil ID dari Role 'JEMAAT'
      const roleRow = await client.query(`SELECT id FROM role WHERE UPPER(nama_role) = 'JEMAAT' LIMIT 1`);
      const roleJemaatId = roleRow.rowCount && roleRow.rowCount > 0 ? roleRow.rows[0].id : null;

      for (const data of dataList) {
        // 1. Cek apakah jemaat INI sudah punya akun → skip permanen
        const existByJemaat = await client.query(
          `SELECT id FROM pengguna WHERE jemaat_id = $1`,
          [data.jemaat_id]
        );
        if (existByJemaat.rowCount && existByJemaat.rowCount > 0) {
          continue; // Jemaat ini sudah punya akun, lewati
        }

        // 2. Cek apakah email/no_hp sudah dipakai user LAIN → null-kan yang konflik saja
        let emailToInsert = data.email || null;
        let noHpToInsert = data.no_hp || null;
        const konflikAlasan: string[] = [];

        if (emailToInsert) {
          const emailConflict = await client.query(
            `SELECT j.nama_lengkap FROM pengguna p JOIN jemaat j ON p.jemaat_id = j.id WHERE p.email IS NOT NULL AND p.email = $1 LIMIT 1`,
            [emailToInsert]
          );
          if (emailConflict.rowCount && emailConflict.rowCount > 0) {
            const namaKonflik = emailConflict.rows[0].nama_lengkap || 'jemaat lain';
            konflikAlasan.push(`email sudah dipakai oleh ${namaKonflik}`);
            emailToInsert = null;
          }
        }

        if (noHpToInsert) {
          const noHpConflict = await client.query(
            `SELECT j.nama_lengkap FROM pengguna p JOIN jemaat j ON p.jemaat_id = j.id WHERE p.no_hp IS NOT NULL AND p.no_hp = $1 LIMIT 1`,
            [noHpToInsert]
          );
          if (noHpConflict.rowCount && noHpConflict.rowCount > 0) {
            const namaKonflik = noHpConflict.rows[0].nama_lengkap || 'jemaat lain';
            konflikAlasan.push(`no HP sudah dipakai oleh ${namaKonflik}`);
            noHpToInsert = null;
          }
        }

        // 3. Jika setelah deduplikasi tidak ada identifier → lewati dengan keterangan
        if (!emailToInsert && !noHpToInsert) {
          noIdentifierCount++;
          const namaJemaat = data.nama_lengkap || `jemaat_id: ${data.jemaat_id}`;
          const alasan = konflikAlasan.length > 0
            ? konflikAlasan.join(', ')
            : 'tidak memiliki email/no. handphone';
          skippedList.push({ nama: namaJemaat, alasan });
          continue;
        }

        // Insert ke pengguna
        const insUser = await client.query(`
          INSERT INTO pengguna (email, no_hp, password_hash, jemaat_id, requires_password_change)
          VALUES ($1, $2, $3, $4, true)
          RETURNING id
        `, [emailToInsert, noHpToInsert, data.password_hash, data.jemaat_id]);
        
        const userId = insUser.rows[0].id;

        // Selundupin di user_role sbg jd anak JEMAAT gtu lho asalkan emg role id nya kliatan
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
      return { success: true, createdCount, noIdentifierCount, skippedList };
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
