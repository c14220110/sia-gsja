import { NextRequest, NextResponse } from 'next/server';
import { PengurusRepository } from '@/server/repositories/pengurus.repository';
// import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import pool from '@/lib/db';

const pengurusRepository = new PengurusRepository();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller || (!caller.is_super_admin && !caller.permissions.includes('pengurus_manage'))) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin untuk mengubah status pengurus (pengurus_manage).' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, message: 'ID required' }, { status: 400 });

    const body = await request.json();
    const { status_jabatan } = body;

    if (!status_jabatan) {
      return NextResponse.json({ success: false, message: 'Status must be provided' }, { status: 400 });
    }

    const updated = await pengurusRepository.updatePengurusStatus(id, status_jabatan);
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Pengurus tidak ditemukan atau gagal diupdate' }, { status: 404 });
    }

    if (caller) {
      const isDeactivation = status_jabatan !== 'Aktif';
      try {
        await pool.query(`
          INSERT INTO pengurus_audit_log (pengurus_id, aksi, user_id, role_id, satelit_id, keterangan)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          parseInt(id),
          isDeactivation ? 'DEACTIVATE' : 'UPDATE',
          caller.user_id,
          caller.role_id,
          caller.satelit_id,
          `Status kepengurusan diubah menjadi "${status_jabatan}"`
        ]);
      } catch (err) {
        console.error('[AuditLog] pengurus PATCH:', err);
      }
    }

    return NextResponse.json({ success: true, message: 'Status berhasil diperbarui' });
  } catch (error) {
    console.error('[PengurusRoute] PATCH error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, message: 'Invalid ID' }, { status: 400 });
    }

    // Fetch data pengurus + profil jemaat
    const pengurusRes = await pool.query(`
      SELECT
        p.id, p.id_pengurus, p.created_at,
        j.id              AS jemaat_id,
        j.jemaat_id       AS jemaat_nomor,
        j.nama_lengkap, j.foto_url, j.nik, j.tempat_lahir, j.tanggal_lahir,
        j.jenis_kelamin, j.status_pernikahan, j.alamat, j.no_hp, j.email,
        j.tanggal_baptis, j.status_baptis,
        js.nama_satelit   AS nama_satelit_jemaat
      FROM pengurus p
      JOIN jemaat j       ON p.jemaat_id = j.id
      LEFT JOIN satelit js ON j.satelit_id = js.id
      WHERE p.id = $1
    `, [id]);

    if (pengurusRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Pengurus tidak ditemukan' }, { status: 404 });
    }

    // Fetch riwayat jabatan
    const jabatanRes = await pool.query(`
      SELECT
        dk.id, dk.status_jabatan, dk.lingkup,
        dk.tanggal_mulai_menjabat AS tanggal_mulai,
        dk.tanggal_akhir_menjabat,
        dk.jalur_pengangkatan, dk.catatan,
        jab.nama_jabatan,
        per.nama_periode, per.tahun_mulai, per.tahun_akhir,
        s.nama_satelit,
        kom.nama_komisi,
        dep.nama_departemen
      FROM detail_kepengurusan dk
      JOIN jabatan jab ON dk.jabatan_id = jab.id
      JOIN periode_kepengurusan per ON dk.periode_id = per.id
      LEFT JOIN satelit s ON dk.satelit_id = s.id
      LEFT JOIN komisi kom ON dk.komisi_id = kom.id
      LEFT JOIN departemen dep ON dk.departemen_id = dep.id
      WHERE dk.pengurus_id = $1
      ORDER BY dk.id DESC
    `, [id]);

    // Fetch audit log
    const auditRes = await pool.query(`
      SELECT
        al.id, al.aksi, al.keterangan, al.created_at,
        u.email AS user_email,
        r.nama_role
      FROM pengurus_audit_log al
      LEFT JOIN pengguna u ON al.user_id = u.id
      LEFT JOIN role r ON al.role_id = r.id
      WHERE al.pengurus_id = $1
      ORDER BY al.created_at DESC
      LIMIT 30
    `, [id]);

    return NextResponse.json({
      success: true,
      data: {
        ...pengurusRes.rows[0],
        jabatan: jabatanRes.rows,
        audit_log: auditRes.rows,
      }
    });
  } catch (error: any) {
    console.error('GET Pengurus Details error:', error.message);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
