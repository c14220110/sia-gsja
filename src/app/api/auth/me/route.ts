import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { UserRepository } from '@/server/repositories/user.repository';
import { getJwtSecret } from '@/server/utils/jwt';

const userRepository = new UserRepository();

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('access_token')?.value;

    if (!token) {
      return NextResponse.json(
        { message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify token
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    
    // As per previous payload, we have user_id and role_id
    // Fetch actual names from DB
    const user = await userRepository.findById(decoded.user_id);
    const roles = await userRepository.getUserRoles(decoded.user_id);
    const activeRole = roles.find(r => r.role_id === decoded.role_id && r.satelit_id === decoded.satelit_id);
    
    // Re-fetch permissions for latest accuracy (in case role_permission was updated)
    const permissions = activeRole
      ? await userRepository.getRolePermissionNames(activeRole.role_id)
      : (decoded.permissions || []);

    return NextResponse.json(
      { 
        user_id: decoded.user_id,
        role_id: decoded.role_id,
        satelit_id: decoded.satelit_id,
        is_super_admin: decoded.is_super_admin,
        role_name: activeRole?.nama_role.replace(/_/g, ' ') || decoded.role_name?.replace(/_/g, ' ') || 'Unknown Role',
        satelit_name: activeRole?.nama_satelit || 'Unknown Satelit',
        email: user?.nama_lengkap || user?.email || `User ${decoded.user_id}`,
        jemaat_id: user?.jemaat_nomor || null,
        available_roles: roles,
        permissions,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { message: 'Invalid token' },
      { status: 401 }
    );
  }
}

// POST /api/auth/me → Logout (merged from auth/logout)
export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    { message: 'Logged out successfully' },
    { status: 200 }
  );
  response.cookies.delete('access_token');
  return response;
}
