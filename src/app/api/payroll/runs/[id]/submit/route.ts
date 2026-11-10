import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import pool from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const { id: runId } = await params;
    const body = await request.json();
    const { catatan_pembuat } = body;

    // Cek status saat ini
    const runData = await pool.query(`SELECT status, total_netto, satelit_id FROM public.payroll_run WHERE id = $1`, [runId]);
    if (runData.rows.length === 0) return NextResponse.json({ success: false, message: "Run tidak ditemukan" }, { status: 404 });
    const run = runData.rows[0];

    // RBAC: hanya bisa submit run milik unitnya sendiri
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      if (run.satelit_id !== caller.satelit_id) {
        return NextResponse.json({ success: false, message: 'Anda tidak memiliki akses ke run penggajian unit lain.' }, { status: 403 });
      }
    }

    if (run.status !== 'Draft' && run.status !== 'Ditolak') {
      return NextResponse.json({ success: false, message: `Tidak dapat mengajukan Run dengan status ${run.status}` }, { status: 400 });
    }

    // Ambil nama_lengkap pembuat dari tabel jemaat atau email pengguna
    const penggunaData = await pool.query(`
      SELECT COALESCE(j.nama_lengkap, p.email) as nama_lengkap
      FROM public.pengguna p
      LEFT JOIN public.jemaat j ON j.id = p.jemaat_id
      WHERE p.id = $1
    `, [caller.user_id]);
    const namaPelaksana = penggunaData.rows[0]?.nama_lengkap || null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update status
      await client.query(`
        UPDATE public.payroll_run
        SET 
          status = 'Menunggu Approval', 
          catatan_pembuat = $1,
          updated_at = NOW()
        WHERE id = $2
      `, [catatan_pembuat || null, runId]);

      // Insert Audit Log
      await client.query(`
        INSERT INTO public.payroll_run_audit_log (
          run_id, aksi, status_sebelum, status_sesudah, 
          user_id, nama_pelaksana, role_id, keterangan
        ) VALUES (
          $1, 'Submit Approval', $2, 'Menunggu Approval',
          $3, $4, $5, $6
        )
      `, [
        runId, runData.rows[0].status,
        caller.user_id, namaPelaksana, caller.role_id,
        catatan_pembuat ? 'Dengan catatan: ' + catatan_pembuat : 'Diajukan untuk persetujuan'
      ]);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // TODO: Trigger Email Notifikasi ke Gembala Sidang & Bendahara Pusat

    return NextResponse.json({ success: true, message: "Berhasil diajukan." });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, message: "Internal Server Error", error: error.message }, { status: 500 });
  }
}
