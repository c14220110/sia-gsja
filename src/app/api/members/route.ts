import { NextRequest, NextResponse } from 'next/server';
import { JemaatRepository, JemaatFilterParams } from '@/server/repositories/jemaat.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';

const jemaatRepository = new JemaatRepository();

export async function GET(request: NextRequest) {
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

    // Cek hak akses (RBAC)
    const caller = getCallerFromRequest(request);

    if (!caller || (!caller.is_super_admin && !caller.permissions.includes('jemaat_view'))) {
      return NextResponse.json({
        success: false,
        message: 'Akses Ditolak: Anda tidak memiliki izin untuk melihat data jemaat (jemaat_view) atau token Anda kadaluarsa/tidak valid.',
      }, { status: 403 });
    }

    // Kalau kagak dapet view muti_satelit -> yah kepaksa harus disaring satelit sendiri
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
       params.satelit_id = caller.satelit_id?.toString();
    }

    const result = await jemaatRepository.getJemaatPagination(params);

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
    console.error('GET /api/members error:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan pada server saat mengambil data jemaat.',
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Satpam pengecekan: Dia punya kunci buat nyiptain data jemaat gak?
    const caller = getCallerFromRequest(request);

    if (!caller || (!caller.is_super_admin && !caller.permissions.includes('jemaat_create'))) {
      return NextResponse.json({
        success: false,
        message: 'Akses Ditolak: Anda tidak memiliki izin untuk mendaftarkan jemaat baru (jemaat_create).',
      }, { status: 403 });
    }

    const body = await request.json();

    // Validasi: nama_lengkap wajib diisi
    if (!body.nama_lengkap || typeof body.nama_lengkap !== 'string' || body.nama_lengkap.trim() === '') {
      return NextResponse.json({
        success: false,
        message: 'Nama lengkap wajib diisi',
      }, { status: 400 });
    }

    // Penting: Wajib bin harus ngisi satelit_id (Tabelnya nangis kalo kosong)
    if (!body.satelit_id && body.satelit_id !== 0) {
      return NextResponse.json({
        success: false,
        message: 'Satelit wajib dipilih',
      }, { status: 400 });
    }

    const newId = await jemaatRepository.createJemaat(body);

    // Catat riwayat audit untuk aksi pembuatan
    if (caller) {
      await auditLogRepository.insertAuditLog({
        jemaat_id:  newId,
        aksi:       'CREATE',
        user_id:    caller.user_id,
        role_id:    caller.role_id,
        satelit_id: caller.satelit_id,
        keterangan: 'Data jemaat baru ditambahkan',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Berhasil menambahkan data jemaat',
      data: { id: newId }
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/members error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Gagal menambahkan data jemaat',
    }, { status: 500 });
  }
}
