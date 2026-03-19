import pool from '@/lib/db';

export interface Pengguna {
  id: number;
  email: string;
  password_hash: string;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  jemaat_id: number | null;
  jemaat_nomor?: string | null;
  nama_lengkap?: string | null;
}

export interface UserRoleDetail {
  role_id: number;
  nama_role: string;
  satelit_id: number;
  nama_satelit: string;
}

export class UserRepository {
  async findById(id: number): Promise<Pengguna | null> {
    const query = `
      SELECT 
        p.id, p.email, p.password_hash, p.is_active, p.last_login_at, p.created_at, p.updated_at, p.jemaat_id,
        j.jemaat_id as jemaat_nomor, j.nama_lengkap
      FROM pengguna p
      LEFT JOIN jemaat j ON p.jemaat_id = j.id
      WHERE p.id = $1;
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0] as Pengguna;
  }

  async findByEmail(email: string): Promise<Pengguna | null> {
    const query = `
      SELECT id, email, password_hash, is_active, last_login_at, created_at, updated_at, jemaat_id
      FROM pengguna
      WHERE email = $1;
    `;
    const result = await pool.query(query, [email]);
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
        ur.tanggal_mulai,
        ur.tanggal_selesai
      FROM user_role ur
      JOIN role r ON ur.role_id = r.id
      JOIN satelit s ON ur.satelit_id = s.id
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
}

