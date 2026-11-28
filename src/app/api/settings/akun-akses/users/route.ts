import { NextRequest, NextResponse } from 'next/server';
import { akunAksesRepository } from '@/server/repositories/akunAkses.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import {
  PROTECTED_USER_MANAGEMENT_ROLES,
  canManageAkunAksesUsers,
  isSatelitScopedUserManager,
  checkTargetUserForSatelitAdmin,
  validateSatelitAdminPayload,
} from '@/server/utils/akunSatelitGuard';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  try {
    const caller = await getCallerFromRequest(req);
    if (!caller || !canManageAkunAksesUsers(caller)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const scopedSatelit = isSatelitScopedUserManager(caller) ? caller.satelit_id : undefined;
    const rawData = await akunAksesRepository.getPenggunaList(scopedSatelit);

    const data = isSatelitScopedUserManager(caller)
      ? rawData.map((u: any) => {
          const roles = Array.isArray(u.roles) ? u.roles : [];
          const hasProtectedRole = roles.some((r: any) =>
            (PROTECTED_USER_MANAGEMENT_ROLES as readonly string[]).includes(String(r.role_name || '').toUpperCase())
          );
          const hasCrossSatelitRole = roles.some(
            (r: any) => Number(r.satelit_id) !== Number(caller.satelit_id)
          );
          const crossJemaat = u.jemaat_id && Number(u.jemaat_satelit_id) !== Number(caller.satelit_id);
          const crossPegawai = u.pegawai_id && Number(u.pegawai_satelit_id) !== Number(caller.satelit_id);
          return {
            ...u,
            is_locked_for_satelit_admin:
              hasProtectedRole || hasCrossSatelitRole || Boolean(crossJemaat) || Boolean(crossPegawai),
          };
        })
      : rawData;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error in /api/settings/akun-akses/users GET:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCallerFromRequest(req);
    if (!caller || !canManageAkunAksesUsers(caller)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { email, password, jemaat_id, pegawai_id, roles } = body;

    // `email` di sini adalah field identifier — bisa berisi email, no_hp, atau username
    const identifier = (email || '').trim();
    const roleList = Array.isArray(roles) ? roles : [];
    const hasAutoLinkedRole = Boolean(jemaat_id || pegawai_id);

    if (!identifier || !password) {
      return NextResponse.json({ success: false, message: 'Identifier Login dan Password wajib diisi.' }, { status: 400 });
    }
    if (!hasAutoLinkedRole && roleList.length === 0) {
      return NextResponse.json({ success: false, message: 'Pilih minimal 1 Role Inti, atau tautkan akun ke Data Jemaat / Data Pegawai.' }, { status: 400 });
    }

    if (isSatelitScopedUserManager(caller)) {
      const check = await validateSatelitAdminPayload(caller.satelit_id, {
        jemaat_id: jemaat_id || null,
        pegawai_id: pegawai_id || null,
        roles: roleList,
      });
      if (!check.allowed) {
        return NextResponse.json({ success: false, message: check.message }, { status: 403 });
      }
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await akunAksesRepository.createPenggunaMultiRole({
      email: identifier,
      password_hash,
      jemaat_id: jemaat_id || null,
      pegawai_id: pegawai_id || null,
      roles: roleList,
    });

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Akun login berhasil dibuat' });
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in /api/settings/akun-akses/users POST:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const caller = await getCallerFromRequest(req);
    if (!caller || !canManageAkunAksesUsers(caller)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { user_id, is_active } = body;

    if (typeof user_id !== 'number' || typeof is_active !== 'boolean') {
      return NextResponse.json({ success: false, message: 'Parameter user_id dan is_active diperlukan' }, { status: 400 });
    }

    if (isSatelitScopedUserManager(caller)) {
      const targetCheck = await checkTargetUserForSatelitAdmin(user_id, caller.satelit_id);
      if (!targetCheck.allowed) {
        return NextResponse.json({ success: false, message: targetCheck.message }, { status: 403 });
      }
    }

    const result = await akunAksesRepository.toggleUserStatus(user_id, is_active);

    if (result.success) {
      return NextResponse.json({ success: true, message: is_active ? 'Akun berhasil diaktifkan' : 'Akun berhasil dinonaktifkan' });
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in /api/settings/akun-akses/users PATCH:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const caller = await getCallerFromRequest(req);
    if (!caller || !canManageAkunAksesUsers(caller)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { user_id, email, password, roles, jemaat_id, pegawai_id } = body;

    if (!user_id) {
      return NextResponse.json({ success: false, message: 'user_id diperlukan' }, { status: 400 });
    }

    if (isSatelitScopedUserManager(caller)) {
      const targetCheck = await checkTargetUserForSatelitAdmin(Number(user_id), caller.satelit_id);
      if (!targetCheck.allowed) {
        return NextResponse.json({ success: false, message: targetCheck.message }, { status: 403 });
      }
      const payloadCheck = await validateSatelitAdminPayload(caller.satelit_id, {
        jemaat_id: typeof jemaat_id === 'number' ? jemaat_id : null,
        pegawai_id: typeof pegawai_id === 'number' ? pegawai_id : null,
        roles: Array.isArray(roles) ? roles : undefined,
      });
      if (!payloadCheck.allowed) {
        return NextResponse.json({ success: false, message: payloadCheck.message }, { status: 403 });
      }
    }

    const updateData: any = {};
    if (email) updateData.email = email;
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }
    // jemaat_id / pegawai_id: undefined = tidak diubah, null = hapus link, number = set link baru
    if (jemaat_id !== undefined) updateData.jemaat_id = jemaat_id;
    if (pegawai_id !== undefined) updateData.pegawai_id = pegawai_id;
    // Teruskan komisi_id dan departemen_id per-role-row (bukan dari level global)
    if (roles !== undefined) {
      updateData.roles = roles.map((r: any) => ({
        role_id: r.role_id,
        satelit_id: r.satelit_id,
        komisi_id: r.komisi_id ?? null,
        departemen_id: r.departemen_id ?? null,
      }));
    }

    const result = await akunAksesRepository.updatePengguna(user_id, updateData);

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Data pengguna berhasil diperbarui' });
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in /api/settings/akun-akses/users PUT:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
