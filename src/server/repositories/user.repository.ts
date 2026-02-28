import pool from '@/lib/db';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserWithRoles extends User {
  location_id: number;
  roles: string[];
}

export class UserRepository {
  /**
   * Cari user berdasarkan email
   * @param email Email user
   * @returns User
   */
  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, email, password_hash, is_active, last_login_at, created_at, updated_at
      FROM users
      WHERE email = $1;
    `;
    const result = await pool.query(query, [email]);
    if (result.rows.length === 0) return null;
    return result.rows[0] as User;
  }

  /**
   * Karena instruksi adalah 'minimalis' untuk joins di repository saat login,
   * kita tetap bisa memanggil role tapi kita batasi implementasinya agar tidak over-engineer.
   * Contoh ini mengambil location_id dan role names untuk token payload.
   */
  async getUserRolesAndLocation(userId: number): Promise<{ location_id: number; roles: string[] } | null> {
    const query = `
      SELECT ur.location_id, r.name as role_name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1
    `;
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    // Return the first location_id found, and an array of roles.
    // In a real multi-location setup, a user might have different roles in different locations.
    return {
      location_id: result.rows[0].location_id,
      roles: result.rows.map(row => row.role_name),
    };
  }

  async updateLastLogin(userId: number): Promise<void> {
    const query = `
      UPDATE users 
      SET last_login_at = NOW() 
      WHERE id = $1;
    `;
    await pool.query(query, [userId]);
  }
}
