import pool from '@/lib/db';
import { CallerInfo } from '@/server/utils/getCallerFromRequest';

/**
 * Resolves the caller's display name, role name, and satelit name
 * for denormalized audit log snapshots.
 * 
 * Falls back to generic values if the lookup fails, so audit logging
 * never blocks the primary operation.
 */
export async function resolveCallerSnapshot(caller: CallerInfo): Promise<{
  nama_pelaksana: string;
  nama_role:      string;
  nama_satelit:   string;
}> {
  try {
    const res = await pool.query(
      `SELECT 
         COALESCE(j.nama_lengkap, p.email) AS nama_pelaksana,
         r.nama_role,
         s.nama_satelit
       FROM public.pengguna p
       LEFT JOIN public.jemaat  j ON p.jemaat_id  = j.id
       JOIN public.role    r ON r.id = $2
       JOIN public.satelit s ON s.id = $3
       WHERE p.id = $1`,
      [caller.user_id, caller.role_id, caller.satelit_id]
    );

    if (res.rows.length > 0) {
      return res.rows[0];
    }
  } catch (err) {
    console.error('[resolveCallerSnapshot] Lookup failed, using fallback:', err);
  }

  return {
    nama_pelaksana: `User#${caller.user_id}`,
    nama_role:      caller.role_name || `Role#${caller.role_id}`,
    nama_satelit:   `Satelit#${caller.satelit_id}`,
  };
}
