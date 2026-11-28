import pool from '@/lib/db';
import { CallerInfo } from '@/server/utils/getCallerFromRequest';

/**
 * Role tingkat pusat / istimewa / admin sendiri yang TIDAK BOLEH dimodifikasi,
 * di-reset password, dinonaktifkan, atau di-assign oleh ADMIN_SATELIT.
 */
export const PROTECTED_USER_MANAGEMENT_ROLES = [
  'SUPER_ADMIN',
  'MAJELIS',
  'GEMBALA_SIDANG',
  'BENDAHARA_PUSAT',
  'SEKRETARIS_PUSAT',
  'HRD',
  'VOLUNTEER_BENDAHARA',
  'VOLUNTEER_SEKRETARIS',
  'ADMIN_SATELIT',
] as const;

/**
 * Allowlist role operasional tingkat satelit yang boleh di-assign oleh ADMIN_SATELIT.
 * Fail-closed: role baru tingkat pusat yang dibuat di masa depan otomatis ditolak.
 */
export const ALLOWED_SATELIT_ADMIN_ASSIGN_ROLES = [
  'JEMAAT',
  'PEGAWAI',
  'KETUA_SATELIT',
  'WAKIL_KETUA_SATELIT',
  'BENDAHARA_SATELIT',
  'SEKRETARIS_SATELIT',
  'KETUA_KOMISI',
  'KETUA_DEPARTEMEN',
  'PIC_KEGIATAN',
  'BENDAHARA_PANITIA',
] as const;

export function canManageAkunAksesUsers(caller: CallerInfo | null): boolean {
  if (!caller) return false;
  return Boolean(caller.is_super_admin || caller.permissions?.includes('akun_satelit_manage'));
}

export function isSatelitScopedUserManager(caller: CallerInfo | null): boolean {
  if (!caller) return false;
  return !caller.is_super_admin && Boolean(caller.permissions?.includes('akun_satelit_manage'));
}

/**
 * Mengecek apakah user target dikunci dari modifikasi oleh ADMIN_SATELIT:
 * - Memegang role pusat / istimewa / sesama ADMIN_SATELIT
 * - Memiliki role aktif / tautan jemaat / tautan pegawai di satelit lain
 * - Tidak memiliki keterkaitan sama sekali dengan satelit caller
 */
export async function checkTargetUserForSatelitAdmin(
  targetUserId: number,
  callerSatelitId: number
): Promise<{ allowed: boolean; message?: string }> {
  const userRes = await pool.query(
    `SELECT p.id, p.jemaat_id, j.satelit_id AS jemaat_satelit_id,
            pg.id AS pegawai_id, pg.satelit_id AS pegawai_satelit_id
     FROM pengguna p
     LEFT JOIN jemaat j ON p.jemaat_id = j.id
     LEFT JOIN pegawai pg ON pg.user_id = p.id
     WHERE p.id = $1
     LIMIT 1`,
    [targetUserId]
  );

  if (!userRes.rowCount || userRes.rowCount === 0) {
    return { allowed: false, message: 'Akun pengguna tidak ditemukan.' };
  }

  const target = userRes.rows[0];
  const rolesRes = await pool.query(
    `SELECT ur.satelit_id, UPPER(r.nama_role) AS nama_role
     FROM user_role ur
     JOIN role r ON ur.role_id = r.id
     WHERE ur.user_id = $1 AND ur.is_active = true`,
    [targetUserId]
  );

  const hasProtectedRole = rolesRes.rows.some((r: any) =>
    (PROTECTED_USER_MANAGEMENT_ROLES as readonly string[]).includes(r.nama_role)
  );
  if (hasProtectedRole) {
    return {
      allowed: false,
      message: 'Akses Ditolak: Admin Satelit tidak dapat mengubah atau menonaktifkan akun dengan role pusat / ADMIN_SATELIT.',
    };
  }

  const hasCrossSatelitRole = rolesRes.rows.some(
    (r: any) => Number(r.satelit_id) !== Number(callerSatelitId)
  );
  if (hasCrossSatelitRole) {
    return {
      allowed: false,
      message: 'Akses Ditolak: Akun ini memiliki role di satelit lain.',
    };
  }

  if (target.jemaat_id && Number(target.jemaat_satelit_id) !== Number(callerSatelitId)) {
    return {
      allowed: false,
      message: 'Akses Ditolak: Akun ini tertaut ke jemaat dari satelit lain.',
    };
  }

  if (target.pegawai_id && Number(target.pegawai_satelit_id) !== Number(callerSatelitId)) {
    return {
      allowed: false,
      message: 'Akses Ditolak: Akun ini tertaut ke pegawai dari satelit lain.',
    };
  }

  const belongsToCallerSatelit =
    rolesRes.rows.some((r: any) => Number(r.satelit_id) === Number(callerSatelitId)) ||
    (target.jemaat_id && Number(target.jemaat_satelit_id) === Number(callerSatelitId)) ||
    (target.pegawai_id && Number(target.pegawai_satelit_id) === Number(callerSatelitId));

  if (!belongsToCallerSatelit) {
    return {
      allowed: false,
      message: 'Akses Ditolak: Akun ini tidak berada di dalam satelit Anda.',
    };
  }

  return { allowed: true };
}

/**
 * Memvalidasi payload POST/PUT dari ADMIN_SATELIT agar jemaat, pegawai, satelit,
 * dan daftar role tidak keluar dari kewenangan satelit sendiri.
 */
export async function validateSatelitAdminPayload(
  callerSatelitId: number,
  payload: {
    jemaat_id?: number | null;
    pegawai_id?: number | null;
    roles?: { role_id: number; satelit_id: number }[];
  }
): Promise<{ allowed: boolean; message?: string }> {
  if (payload.jemaat_id) {
    const jRes = await pool.query(
      `SELECT satelit_id FROM jemaat WHERE id = $1 AND is_deleted = false LIMIT 1`,
      [payload.jemaat_id]
    );
    if (!jRes.rowCount || Number(jRes.rows[0].satelit_id) !== Number(callerSatelitId)) {
      return {
        allowed: false,
        message: 'Akses Ditolak: Jemaat yang dipilih berasal dari satelit lain atau tidak ditemukan.',
      };
    }
  }

  if (payload.pegawai_id) {
    const pgRes = await pool.query(
      `SELECT satelit_id FROM pegawai WHERE id = $1 LIMIT 1`,
      [payload.pegawai_id]
    );
    if (!pgRes.rowCount || Number(pgRes.rows[0].satelit_id) !== Number(callerSatelitId)) {
      return {
        allowed: false,
        message: 'Akses Ditolak: Pegawai yang dipilih berasal dari satelit lain atau tidak ditemukan.',
      };
    }
  }

  const roleList = Array.isArray(payload.roles) ? payload.roles : [];
  if (roleList.length > 0) {
    const crossSatelit = roleList.some(
      (r) => Number(r.satelit_id) !== Number(callerSatelitId)
    );
    if (crossSatelit) {
      return {
        allowed: false,
        message: 'Akses Ditolak: Admin Satelit hanya dapat menetapkan role pada satelitnya sendiri.',
      };
    }

    const roleIds = Array.from(new Set(roleList.map((r) => Number(r.role_id))));
    const roleRes = await pool.query(
      `SELECT id, UPPER(nama_role) AS nama_role, is_active FROM role WHERE id = ANY($1::int[])`,
      [roleIds]
    );
    if (roleRes.rows.length !== roleIds.length) {
      return { allowed: false, message: 'Akses Ditolak: Terdapat Role ID yang tidak valid.' };
    }

    const forbiddenRole = roleRes.rows.find(
      (r: any) => !r.is_active || !(ALLOWED_SATELIT_ADMIN_ASSIGN_ROLES as readonly string[]).includes(r.nama_role)
    );
    if (forbiddenRole) {
      return {
        allowed: false,
        message: `Akses Ditolak: Role ${forbiddenRole.nama_role} tidak dapat diberikan oleh Admin Satelit.`,
      };
    }
  }

  return { allowed: true };
}
