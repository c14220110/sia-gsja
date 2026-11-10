import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import pool from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const { id: runId } = await params;

    // Ambil Run Header bareng RA, Satelit, dan kreatornya sekalian ngekor
    const runData = await pool.query(`
      SELECT 
        r.*, 
        s.nama_satelit, 
        at.kode_dokumen as kode_ra, at.nama_rancangan as nama_ra, at.total_disetujui,
        COALESCE(j.nama_lengkap, p.email) as nama_pembuat
      FROM public.payroll_run r
      JOIN public.satelit s ON s.id = r.satelit_id
      LEFT JOIN public.anggaran_tahunan at ON at.id = r.anggaran_tahunan_id
      LEFT JOIN public.pengguna p ON p.id = r.created_by
      LEFT JOIN public.jemaat j ON j.id = p.jemaat_id
      WHERE r.id = $1
    `, [runId]);

    if (runData.rows.length === 0) return NextResponse.json({ success: false, message: "Run tidak ditemukan" }, { status: 404 });
    const run = runData.rows[0];

    // RBAC: hanya bisa lihat run milik unitnya sendiri
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      if (run.satelit_id !== caller.satelit_id) {
        return NextResponse.json({ success: false, message: 'Anda tidak memiliki akses ke run penggajian unit lain.' }, { status: 403 });
      }
    }

    // Cek sisa plafon RA saat ini (tidak termasuk draft ini)
    const plafonData = await pool.query(`
      SELECT 
        total_disetujui - COALESCE((
          SELECT SUM(total_netto) 
          FROM public.payroll_run 
          WHERE anggaran_tahunan_id = at.id 
            AND id != $1
            AND status IN ('Menunggu Approval', 'Disetujui', 'Dibayar')
        ), 0) as sisa_plafon
      FROM public.anggaran_tahunan at
      WHERE at.id = $2
    `, [runId, run.anggaran_tahunan_id]);
    const sisaPlafon = plafonData.rows.length > 0 ? Number(plafonData.rows[0].sisa_plafon) : 0;

    // Hitung total Beban Gereja (BPJS Employer)
    const bebanGerejaData = await pool.query(`
      SELECT SUM(prk.nominal) as total_beban_gereja
      FROM public.payroll_run_komponen prk
      JOIN public.payroll_run_detail prd ON prd.id = prk.run_detail_id
      WHERE prd.run_id = $1 AND prk.is_employer_portion = true
    `, [runId]);
    const totalBebanGereja = bebanGerejaData.rows.length > 0 ? Number(bebanGerejaData.rows[0].total_beban_gereja) : 0;

    return NextResponse.json({ 
      success: true, 
      data: {
         ...run,
         sisa_plafon: sisaPlafon,
         total_beban_gereja: totalBebanGereja,
         estimasi_penggunaan: Number(run.total_netto)
      } 
    });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, message: "Internal Server Error", error: error.message }, { status: 500 });
  }
}
