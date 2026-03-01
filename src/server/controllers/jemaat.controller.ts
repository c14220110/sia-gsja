import { NextResponse } from 'next/server';
import { JemaatFilterParams } from '@/server/repositories/jemaat.repository';
import { getJemaatPaginationService, createJemaatService } from '@/server/services/jemaat.service';
import jwt from 'jsonwebtoken';
import { UserRepository } from '@/server/repositories/user.repository';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const userRepository = new UserRepository();

export async function getJemaatController(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const params: JemaatFilterParams = {
      search: searchParams.get('search') || undefined,
      satelit_id: searchParams.get('satelit_id') || undefined,
      komisi_id: searchParams.get('komisi_id') || undefined,
      status_jemaat: searchParams.get('status_jemaat') || undefined,
      status_baptis: searchParams.get('status_baptis') || undefined,
      jenis_kelamin: searchParams.get('jenis_kelamin') || undefined,
      rentang_umur: searchParams.get('rentang_umur') || undefined,
      limit: searchParams.has('limit') ? parseInt(searchParams.get('limit')!) : 10,
      offset: searchParams.has('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    // RBAC Security Check
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/access_token=([^;]+)/);
    const token = match ? match[1] : null;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const roles = await userRepository.getUserRoles(decoded.user_id);
        const activeRole = roles.find(r => r.role_id === decoded.role_id && r.satelit_id === decoded.satelit_id);
        
        if (activeRole && activeRole.nama_role === 'GEMBALA_SATELIT') {
          // Forcefully restrict the search to their own satelit regardless of frontend param
          params.satelit_id = decoded.satelit_id.toString();
        }
      } catch (err) {
        console.warn('Invalid token on jemaat controller validation', err);
      }
    }

    // Important: In a real app we might validate 'params' here against a Zod schema.
    
    const result = await getJemaatPaginationService(params);
    
    return NextResponse.json({
      success: true,
      message: 'Berhasil mengambil data jemaat',
      data: result.data,
      meta: {
        total: result.total,
        jemaat_baru: result.jemaat_baru,
        limit: params.limit,
        offset: params.offset,
      }
    });
  } catch (error: any) {
    console.error('getJemaatController error:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan pada server saat mengambil data jemaat.',
      error: error.message
    }, { status: 500 });
  }
}

export async function createJemaatController(request: Request) {
  try {
    const body = await request.json();
    const newId = await createJemaatService(body);
    
    return NextResponse.json({
      success: true,
      message: 'Berhasil menambahkan data jemaat',
      data: { id: newId }
    }, { status: 201 });
  } catch (error: any) {
    console.error('createJemaatController error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Gagal menambahkan data jemaat',
    }, { status: 500 });
  }
}
