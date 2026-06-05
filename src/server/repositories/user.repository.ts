import pool from '@/lib/db';

export interface Pengguna {
  id: number;
  email: string | null;
  password_hash: string;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  jemaat_id: number | null;
  jemaat_nomor?: string | null;
  nama_lengkap?: string | null;
  foto_url?: string | null;
  no_hp?: string | null;
  pengguna_no_hp?: string | null;
  username?: string | null;
  requires_password_change?: boolean;
}

export interface UserRoleDetail {
  role_id: number;
  nama_role: string;
  satelit_id: number;
  nama_satelit: string;
  komisi_id: number | null;      // scope untuk KETUA_KOMISI
  nama_komisi: string | null;
  departemen_id: number | null;  // scope untuk KETUA_DEPARTEMEN
  nama_departemen: string | null;
}

export class UserRepository {
  async findById(id: number): Promise<Pengguna | null> {
    const query = `
      SELECT 
        p.id, p.email, p.no_hp as pengguna_no_hp, p.username, p.password_hash, p.is_active, p.last_login_at, p.created_at, p.updated_at, p.jemaat_id, p.requires_password_change,
        j.jemaat_id as jemaat_nomor, j.nama_lengkap, j.foto_url, j.no_hp
      FROM pengguna p
      LEFT JOIN jemaat j ON p.jemaat_id = j.id
      WHERE p.id = $1;
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0] as Pengguna;
  }

  async findByIdentifier(identifier: string): Promise<Pengguna | null> {
    const query = `
      SELECT id, email, no_hp as pengguna_no_hp, username, password_hash, is_active, last_login_at, created_at, updated_at, jemaat_id, requires_password_change
      FROM pengguna
      WHERE email = $1 OR no_hp = $1 OR username = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [identifier]);
    if (result.rows.length === 0) return null;
    return result.rows[0] as Pengguna;
  }

  async getUserRoles(userId: number): Promise<UserRoleDetail[]> {
    const query = `
      SELECT 
        ur.role_id, 
        r.nama_role, 
        ur.satelit_id, 
        s.nama_satelit,
        ur.komisi_id,
        k.nama_komisi,
        ur.departemen_id,
        d.nama_departemen,
        ur.tanggal_mulai,
        ur.tanggal_selesai
      FROM user_role ur
      JOIN role r ON ur.role_id = r.id
      JOIN satelit s ON ur.satelit_id = s.id
      LEFT JOIN komisi k ON ur.komisi_id = k.id
      LEFT JOIN departemen d ON ur.departemen_id = d.id
      WHERE ur.user_id = $1 
        AND ur.is_active = true
        AND (
          ur.tanggal_selesai IS NULL 
          OR (
            ur.tanggal_mulai <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date
            AND ur.tanggal_selesai >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date
          )
        )

      UNION

      SELECT 
        (SELECT id FROM role WHERE UPPER(nama_role) = 'JEMAAT') as role_id,
        'JEMAAT' as nama_role,
        j.satelit_id,
        s.nama_satelit,
        NULL as komisi_id,
        NULL as nama_komisi,
        NULL as departemen_id,
        NULL as nama_departemen,
        NULL as tanggal_mulai,
        NULL as tanggal_selesai
      FROM pengguna p
      JOIN jemaat j ON p.jemaat_id = j.id
      LEFT JOIN satelit s ON j.satelit_id = s.id
      WHERE p.id = $1 
        AND p.jemaat_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM user_role ur2
          JOIN role r2 ON ur2.role_id = r2.id
          WHERE ur2.user_id = $1
            AND UPPER(r2.nama_role) = 'JEMAAT'
            AND ur2.is_active = true
            AND ur2.tanggal_selesai IS NULL
        )
    `;
    const result = await pool.query(query, [userId]);
    return result.rows as UserRoleDetail[];
  }

  async updateLastLogin(userId: number): Promise<void> {
    const query = `
      UPDATE pengguna 
      SET last_login_at = NOW() 
      WHERE id = $1;
    `;
    await pool.query(query, [userId]);
  }

  async getRolePermissionNames(roleId: number): Promise<string[]> {
    const query = `
      SELECT p.nama_permission
      FROM role_permission rp
      JOIN permission p ON rp.permission_id = p.id
      WHERE rp.role_id = $1
    `;
    const result = await pool.query(query, [roleId]);
    return result.rows.map(row => row.nama_permission);
  }
  async checkUsernameTaken(username: string, excludeUserId: number): Promise<boolean> {
    const query = `SELECT id FROM pengguna WHERE username = $1 AND id != $2`;
    const result = await pool.query(query, [username, excludeUserId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  async updateUsername(userId: number, username: string): Promise<void> {
    const query = `UPDATE pengguna SET username = $1, updated_at = NOW() WHERE id = $2`;
    await pool.query(query, [username, userId]);
  }

  async updatePassword(userId: number, passwordHash: string): Promise<void> {
    const query = `UPDATE pengguna SET password_hash = $1, requires_password_change = false, updated_at = NOW() WHERE id = $2`;
    await pool.query(query, [passwordHash, userId]);
  }
}

