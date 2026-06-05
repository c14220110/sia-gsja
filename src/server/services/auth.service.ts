import { UserRepository } from '../repositories/user.repository';
import { LoginInput } from '../validations/auth.validation';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../utils/jwt';

const userRepository = new UserRepository();

export class AuthService {
  async authenticateUser(data: LoginInput) {
    const user = await userRepository.findByIdentifier(data.email); // data.email is now acting as the generic identifier

    if (!user) {
      throw new Error('Email, No Handphone, atau Username tidak terdaftar.');
    }

    if (!user.is_active) {
      throw new Error('Akun Anda tidak aktif');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Password salah.');
    }

    if (user.requires_password_change) {
      return {
        requires_password_change: true,
        user_id: user.id,
        email: user.email,
      };
    }

    const roles = await userRepository.getUserRoles(user.id);

    if (roles.length === 0) {
      throw new Error('Akun Anda tidak memiliki hak akses (role) sama sekali.');
    }

    // If more than 1 role, return a temporary token or tell the client to select a role
    if (roles.length > 1) {
      return {
        requires_role_selection: true,
        user_id: user.id,
        available_roles: roles,
      };
    }

    // If exactly 1 role, issue the final token immediately
    const singleRole = roles[0];
    const is_super_admin = singleRole.nama_role === 'SUPER_ADMIN';
    const permissions = await userRepository.getRolePermissionNames(singleRole.role_id);

    const isJemaat = singleRole.nama_role === 'JEMAAT';
    const expiresInString = isJemaat ? '180d' : '1d';
    const cookieMaxAge = isJemaat ? 60 * 60 * 24 * 180 : 60 * 60 * 24;

    const tokenPayload = {
      user_id: user.id,
      role_id: singleRole.role_id,
      role_name: singleRole.nama_role,
      satelit_id: singleRole.satelit_id,
      komisi_id: singleRole.komisi_id ?? null,
      departemen_id: singleRole.departemen_id ?? null,
      is_super_admin,
      permissions,
      jemaat_id: user.jemaat_id ?? null   // ← wajib untuk fitur pelayan di PWA
    };

    const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: expiresInString });

    // Update login timestamp
    await userRepository.updateLastLogin(user.id);

    return { 
      requires_role_selection: false,
      token, 
      user: tokenPayload,
      cookieMaxAge
    };
  }

  // Generate final token after role selection
  async generateFinalToken(userId: number, roleId: number, satelitId: number) {
    const roles = await userRepository.getUserRoles(userId);
    const selectedRole = roles.find(r => r.role_id === roleId && r.satelit_id === satelitId);

    if (!selectedRole) {
      throw new Error('Role tidak valid atau Anda tidak memiliki akses ke role tersebut');
    }

    const is_super_admin = selectedRole.nama_role === 'SUPER_ADMIN';
    const permissions = await userRepository.getRolePermissionNames(selectedRole.role_id);

    const isJemaat = selectedRole.nama_role === 'JEMAAT';
    const expiresInString = isJemaat ? '180d' : '1d';
    const cookieMaxAge = isJemaat ? 60 * 60 * 24 * 180 : 60 * 60 * 24;

    // Ambil jemaat_id dari DB karena generateFinalToken hanya punya userId
    const userRecord = await userRepository.findById(userId);

    const tokenPayload = {
      user_id: userId,
      role_id: selectedRole.role_id,
      role_name: selectedRole.nama_role,
      satelit_id: selectedRole.satelit_id,
      komisi_id: selectedRole.komisi_id ?? null,
      departemen_id: selectedRole.departemen_id ?? null,
      is_super_admin,
      permissions,
      jemaat_id: userRecord?.jemaat_id ?? null   // ← wajib untuk fitur pelayan di PWA
    };

    const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: expiresInString });
    await userRepository.updateLastLogin(userId);

    return { token, user: tokenPayload, cookieMaxAge };
  }
}

