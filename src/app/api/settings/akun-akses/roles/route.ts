import { NextRequest, NextResponse } from 'next/server';
import { akunAksesRepository } from '@/server/repositories/akunAkses.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(req: NextRequest) {
  try {
    const caller = await getCallerFromRequest(req);
    if (!caller || !caller.is_super_admin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const roleId = searchParams.get('role_id');

    if (roleId) {
      // Get role permissions for a specific role
      const permissions = await akunAksesRepository.getRolePermissions(parseInt(roleId, 10));
      return NextResponse.json({ success: true, data: permissions });
    } else {
      // Get all roles and permissions definitions
      const [roles, permissions] = await Promise.all([
        akunAksesRepository.getRoles(),
        akunAksesRepository.getPermissions(),
      ]);
      return NextResponse.json({ success: true, data: { roles, permissions } });
    }
  } catch (error: any) {
    console.error('Error in /api/settings/akun-akses/roles GET:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const caller = await getCallerFromRequest(req);
    if (!caller || !caller.is_super_admin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { role_id, permission_ids } = body;

    if (!role_id || !Array.isArray(permission_ids)) {
      return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
    }

    await akunAksesRepository.updateRolePermissions(role_id, permission_ids);
    
    return NextResponse.json({ success: true, message: 'Hak akses berhasil diperbarui' });
  } catch (error: any) {
    console.error('Error in /api/settings/akun-akses/roles PUT:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
