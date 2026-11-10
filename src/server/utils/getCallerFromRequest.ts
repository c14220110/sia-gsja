import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/server/utils/jwt';

export interface CallerInfo {
  user_id: number;
  role_id: number;
  satelit_id: number;
  jemaat_id?: number | null;
  role_name?: string;
  is_super_admin: boolean;
  permissions: string[];
}

/**
 * Extracts and verifies the caller's identity from the JWT cookie in a request.
 * Returns null if the token is missing or invalid.
 */
export function getCallerFromRequest(request: Request): CallerInfo | null {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/access_token=([^;]+)/);
    const token = match ? match[1] : null;

    if (!token) return null;

    const decoded = jwt.verify(token, getJwtSecret()) as any;

    return {
      user_id:       decoded.user_id,
      role_id:       decoded.role_id,
      satelit_id:    decoded.satelit_id,
      jemaat_id:     decoded.jemaat_id,
      role_name:     decoded.role_name,
      is_super_admin: !!decoded.is_super_admin,
      permissions:   decoded.permissions || [],
    };
  } catch {
    return null;
  }
}
