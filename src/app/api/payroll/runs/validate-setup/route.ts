import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const checkPlafon = searchParams.get('check_plafon');
    const raId = searchParams.get('ra_id');

    if (checkPlafon && raId) {
      // Calculate plafon
      const sisaPlafonData = await pool.query(`
        SELECT 
          total_disetujui - COALESCE((
            SELECT SUM(total_netto) 
            FROM public.payroll_run 
            WHERE anggaran_tahunan_id = at.id 
              AND status IN ('Menunggu Approval', 'Disetujui', 'Dibayar')
          ), 0) as sisa_plafon
        FROM public.anggaran_tahunan at
        WHERE at.id = $1
      `, [raId]);

      if (sisaPlafonData.rows.length === 0) {
        return NextResponse.json({ success: false, message: "RA tidak ditemukan" }, { status: 404 });
      }

      return NextResponse.json({ 
        success: true, 
        data: { sisa_plafon: Number(sisaPlafonData.rows[0].sisa_plafon) } 
      });
    }

    return NextResponse.json({ success: false, message: "Invalid parameters" }, { status: 400 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, message: "Internal Server Error", error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { run_id, bulan, tahun, satelit_id, anggaran_tahunan_id } = body;

    if (!bulan || !tahun || !satelit_id || !anggaran_tahunan_id) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    // RBAC: non-admin hanya bisa buat run untuk unitnya sendiri
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      if (parseInt(satelit_id) !== caller.satelit_id) {
        return NextResponse.json(
          { success: false, message: 'Anda tidak memiliki akses untuk membuat run penggajian unit lain.' },
          { status: 403 }
        );
      }
    }

    // 1. Cek Duplikasi
    let queryStr = `SELECT id, status FROM public.payroll_run WHERE bulan = $1 AND tahun = $2 AND satelit_id = $3`;
    let params: any[] = [bulan, tahun, satelit_id];
    if (run_id) {
      queryStr += ` AND id != $4`;
      params.push(run_id);
    }
    const existingRun = await pool.query(queryStr, params);

    if (existingRun.rows.length > 0) {
      const status = existingRun.rows[0].status;
      if (status !== 'Ditolak') {
        return NextResponse.json({ 
          success: false, 
          message: `Run penggajian untuk periode ini di unit tersebut sudah ada (Status: ${status}).` 
        });
      }
    }

    // 2. Jika valid, buat/update Draft Run dan return run_id
    let finalRunId = run_id;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      if (run_id) {
        // Update run existing
        await client.query(`
          UPDATE public.payroll_run
          SET bulan = $1, tahun = $2, satelit_id = $3, anggaran_tahunan_id = $4, status = 'Draft', updated_at = NOW()
          WHERE id = $5
        `, [bulan, tahun, satelit_id, anggaran_tahunan_id, run_id]);
        // Reset details & komponen karena periode/unit/kompensasi mungkin berubah
        await client.query(`DELETE FROM public.payroll_run_komponen WHERE run_detail_id IN (SELECT id FROM public.payroll_run_detail WHERE run_id = $1)`, [run_id]);
        await client.query(`DELETE FROM public.payroll_run_detail WHERE run_id = $1`, [run_id]);
      } else if (existingRun.rows.length > 0 && existingRun.rows[0].status === 'Ditolak') {
        // Update run yang ditolak menjadi draft lagi (reset)
        const updateRun = await client.query(`
          UPDATE public.payroll_run
          SET anggaran_tahunan_id = $1, status = 'Draft', updated_at = NOW()
          WHERE id = $2
          RETURNING id
        `, [anggaran_tahunan_id, existingRun.rows[0].id]);
        finalRunId = updateRun.rows[0].id;
        await client.query(`DELETE FROM public.payroll_run_komponen WHERE run_detail_id IN (SELECT id FROM public.payroll_run_detail WHERE run_id = $1)`, [finalRunId]);
        await client.query(`DELETE FROM public.payroll_run_detail WHERE run_id = $1`, [finalRunId]);
      } else {
        // Insert baru
        const newRun = await client.query(`
          INSERT INTO public.payroll_run (bulan, tahun, satelit_id, anggaran_tahunan_id, status, created_by)
          VALUES ($1, $2, $3, $4, 'Draft', $5)
          RETURNING id
        `, [bulan, tahun, satelit_id, anggaran_tahunan_id, caller.user_id]);
        finalRunId = newRun.rows[0].id;
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ 
      success: true, 
      data: { run_id: finalRunId } 
    });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, message: "Internal Server Error", error: error.message }, { status: 500 });
  }
}
