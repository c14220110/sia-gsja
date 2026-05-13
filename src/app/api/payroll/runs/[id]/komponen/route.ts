import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

/**
 * PATCH /api/payroll/runs/[id]/komponen
 *
 * Menyimpan penyesuaian (adjustment) manual pada satu atau lebih komponen gaji
 * dalam sebuah payroll_run_detail. Hanya bisa dilakukan jika status run = 'Draft'.
 *
 * Body:
 * {
 *   run_detail_id: number,           // ID payroll_run_detail (baris pegawai)
 *   overrides: [                      // Array komponen yang ingin di-override
 *     { komponen_id: number, nominal: number }
 *   ]
 * }
 *
 * Logic:
 * 1. Cek caller (JWT) → 401 jika tidak ada
 * 2. Cek run ada & status = 'Draft' → 400/404 jika tidak
 * 3. Cek run_detail_id milik run ini → 400 jika tidak
 * 4. BEGIN transaction
 * 5. UPDATE payroll_run_komponen SET nominal, calculation_snapshot (source: 'manual_adj')
 *    WHERE run_detail_id = $1 AND komponen_id = $2
 * 6. Recalculate total_penerimaan, total_potongan, total_netto di payroll_run_detail
 * 7. Recalculate total_bruto, total_potongan, total_netto di payroll_run (aggregate semua detail)
 * 8. COMMIT
 * 9. Return data terbaru
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: runIdStr } = await params;
  const runId = parseInt(runIdStr);
  if (isNaN(runId)) {
    return NextResponse.json({ success: false, message: 'Run ID tidak valid.' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Request body tidak valid (JSON).' }, { status: 400 });
  }

  const { run_detail_id, overrides } = body;

  // Validasi input
  if (!run_detail_id || !Array.isArray(overrides) || overrides.length === 0) {
    return NextResponse.json(
      { success: false, message: 'run_detail_id dan overrides (array) wajib diisi.' },
      { status: 400 }
    );
  }

  // Validasi setiap override item
  for (const ov of overrides) {
    if (!ov.komponen_id || ov.nominal === undefined || ov.nominal === null) {
      return NextResponse.json(
        { success: false, message: 'Setiap override harus memiliki komponen_id dan nominal.' },
        { status: 400 }
      );
    }
    if (typeof ov.nominal !== 'number' || ov.nominal < 0) {
      return NextResponse.json(
        { success: false, message: 'Nominal harus berupa angka non-negatif.' },
        { status: 400 }
      );
    }
  }

  const client = await pool.connect();
  try {
    // Cek run ada dan status-nya
    const runCheck = await client.query(
      `SELECT id, status, satelit_id, created_by FROM public.payroll_run WHERE id = $1`,
      [runId]
    );
    if (runCheck.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Payroll run tidak ditemukan.' }, { status: 404 });
    }
    const run = runCheck.rows[0];

    if (run.status !== 'Draft') {
      return NextResponse.json(
        { success: false, message: `Penyesuaian hanya bisa dilakukan pada run berstatus Draft. Status saat ini: ${run.status}` },
        { status: 400 }
      );
    }

    // RBAC: user hanya bisa edit run milik unitnya kecuali super admin
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      if (run.satelit_id !== caller.satelit_id) {
        return NextResponse.json(
          { success: false, message: 'Anda tidak memiliki akses ke run penggajian unit lain.' },
          { status: 403 }
        );
      }
    }

    // Cek run_detail_id benar-benar milik run ini
    const detailCheck = await client.query(
      `SELECT id FROM public.payroll_run_detail WHERE id = $1 AND run_id = $2`,
      [run_detail_id, runId]
    );
    if (detailCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'run_detail_id tidak ditemukan dalam run ini.' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // UPDATE setiap komponen yang di-override
    const snapshotManual = JSON.stringify({
      source: 'manual_adj',
      adjusted_by: caller.user_id,
      adjusted_at: new Date().toISOString(),
    });

    for (const ov of overrides) {
      await client.query(
        `UPDATE public.payroll_run_komponen
         SET nominal = $1,
             calculation_snapshot = $2
         WHERE run_detail_id = $3
           AND komponen_id = $4`,
        [ov.nominal, snapshotManual, run_detail_id, ov.komponen_id]
      );
    }

    // Recalculate total di payroll_run_detail
    // Sum komponen yang bukan is_employer_portion untuk penerimaan dan potongan
    const recalcDetail = await client.query(
      `SELECT
         COALESCE(SUM(nominal) FILTER (WHERE tipe = 'Penerimaan' AND is_employer_portion = false), 0) AS total_penerimaan,
         COALESCE(SUM(nominal) FILTER (WHERE tipe = 'Potongan'   AND is_employer_portion = false), 0) AS total_potongan
       FROM public.payroll_run_komponen
       WHERE run_detail_id = $1`,
      [run_detail_id]
    );

    const newTotalPenerimaan = Number(recalcDetail.rows[0].total_penerimaan);
    const newTotalPotongan = Number(recalcDetail.rows[0].total_potongan);
    const newTotalNetto = newTotalPenerimaan - newTotalPotongan;

    await client.query(
      `UPDATE public.payroll_run_detail
       SET total_penerimaan = $1,
           total_potongan   = $2,
           total_netto      = $3
       WHERE id = $4`,
      [newTotalPenerimaan, newTotalPotongan, newTotalNetto, run_detail_id]
    );

    // Recalculate aggregate di payroll_run (sum semua detail dalam run ini)
    const recalcRun = await client.query(
      `SELECT
         COALESCE(SUM(total_penerimaan), 0) AS total_bruto,
         COALESCE(SUM(total_potongan),   0) AS total_potongan,
         COALESCE(SUM(total_netto),      0) AS total_netto,
         COUNT(*)                            AS jumlah_pegawai
       FROM public.payroll_run_detail
       WHERE run_id = $1`,
      [runId]
    );

    await client.query(
      `UPDATE public.payroll_run
       SET total_bruto    = $1,
           total_potongan = $2,
           total_netto    = $3,
           jumlah_pegawai = $4,
           updated_at     = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [
        Number(recalcRun.rows[0].total_bruto),
        Number(recalcRun.rows[0].total_potongan),
        Number(recalcRun.rows[0].total_netto),
        Number(recalcRun.rows[0].jumlah_pegawai),
        runId,
      ]
    );

    await client.query('COMMIT');

    // Return data komponen terbaru untuk baris ini
    const updatedKomponen = await client.query(
      `SELECT prk.*, pkm.nama_komponen
       FROM public.payroll_run_komponen prk
       JOIN public.payroll_komponen_master pkm ON pkm.id = prk.komponen_id
       WHERE prk.run_detail_id = $1
       ORDER BY prk.tipe ASC, pkm.urutan ASC, pkm.id ASC`,
      [run_detail_id]
    );

    const updatedDetail = await client.query(
      `SELECT total_penerimaan, total_potongan, total_netto
       FROM public.payroll_run_detail WHERE id = $1`,
      [run_detail_id]
    );

    return NextResponse.json({
      success: true,
      message: 'Penyesuaian berhasil disimpan.',
      data: {
        run_detail_id,
        total_penerimaan: updatedDetail.rows[0].total_penerimaan,
        total_potongan:   updatedDetail.rows[0].total_potongan,
        total_netto:      updatedDetail.rows[0].total_netto,
        komponen:         updatedKomponen.rows,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('PATCH payroll/runs/[id]/komponen error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal Server Error', error: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
