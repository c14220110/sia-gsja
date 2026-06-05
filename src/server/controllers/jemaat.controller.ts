import { NextResponse } from 'next/server';
import { JemaatFilterParams } from '@/server/repositories/jemaat.repository';
import { getJemaatPaginationService, createJemaatService } from '@/server/services/jemaat.service';
import jwt from 'jsonwebtoken';
import { UserRepository } from '@/server/repositories/user.repository';
import { getJwtSecret } from '@/server/utils/jwt';
import { createJemaatSchema } from '@/server/validations/jemaat.validation';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

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
      has_foto: searchParams.get('has_foto') || undefined,
      hide_dummy: searchParams.get('hide_dummy') === 'true',
      limit: searchParams.has('limit') ? parseInt(searchParams.get('limit')!) : 10,
      offset: searchParams.has('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    // RBAC Security Check: MUTLAK WAJIB PUNYA JWT DAN PERMISSION
    const caller = await getCallerFromRequest(request);

    if (!caller || (!caller.is_super_admin && !caller.permissions.includes('jemaat_view'))) {
      return NextResponse.json({
        success: false,
        message: 'Akses Ditolak: Anda tidak memiliki izin untuk melihat data jemaat (jemaat_view) atau token Anda kadaluarsa/tidak valid.',
      }, { status: 403 });
    }

    // Jika tidak punya multi_satelit_view → filter by satelit_id sendiri
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
       params.satelit_id = caller.satelit_id?.toString();
    }
    
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
    const caller = await getCallerFromRequest(request);
    
    // RBAC Check for Create Jemaat
    if (!caller || (!caller.is_super_admin && !caller.permissions.includes('jemaat_create'))) {
      return NextResponse.json({
        success: false,
        message: 'Akses Ditolak: Anda tidak memiliki izin untuk mendaftarkan jemaat baru (jemaat_create).',
      }, { status: 403 });
    }

    const body = await request.json();

    // Validate input with Zod
    const parsed = createJemaatSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      return NextResponse.json({
        success: false,
        message: 'Data tidak valid',
        errors,
      }, { status: 400 });
    }

    const newId = await createJemaatService(parsed.data);
    
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
