// src/app/api/settings/bsc/route.ts
// GET: Ambil konfigurasi BSC (perspektif + KPI) — Super Admin only
// PUT: Update bobot perspektif, bobot KPI, target, threshold — Super Admin only
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export const dynamic = 'force-dynamic';

// ─── GET: Ambil seluruh konfigurasi BSC ────────────────────────────────────
export async function GET(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin) {
    return NextResponse.json({ success: false, message: 'Hanya Super Admin yang bisa mengakses konfigurasi BSC.' }, { status: 403 });
  }

  try {
    const perspektifRes = await pool.query(
      `SELECT id, kode, nama, nama_singkat, icon, warna, bobot, urutan
       FROM bsc_perspektif ORDER BY urutan ASC`
    );

    const kpiRes = await pool.query(
      `SELECT k.id, k.perspektif_id, k.kode, k.nama, k.icon, k.bobot, k.target, k.satuan,
              k.higher_is_better, k.threshold_hijau, k.threshold_kuning, k.rekomendasi, k.urutan,
              p.kode AS perspektif_kode
       FROM bsc_kpi k
       JOIN bsc_perspektif p ON p.id = k.perspektif_id
       ORDER BY p.urutan ASC, k.urutan ASC`
    );

    return NextResponse.json({
      success: true,
      perspektif: perspektifRes.rows,
      kpi: kpiRes.rows,
    });
  } catch (error: any) {
    console.error('[API GET /api/settings/bsc] Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// ─── PUT: Update konfigurasi BSC ───────────────────────────────────────────
export async function PUT(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin) {
    return NextResponse.json({ success: false, message: 'Hanya Super Admin yang bisa mengubah konfigurasi BSC.' }, { status: 403 });
  }

  const body = await request.json();
  const { perspektif, kpi } = body;

  // ─── Validasi: Total bobot perspektif harus = 100 ───────────────────────
  if (perspektif && Array.isArray(perspektif)) {
    const totalBobotPerspektif = perspektif.reduce((sum: number, p: any) => sum + (parseFloat(p.bobot) || 0), 0);
    if (Math.abs(totalBobotPerspektif - 100) > 0.01) {
      return NextResponse.json({
        success: false,
        message: `Total bobot perspektif harus = 100%. Saat ini: ${totalBobotPerspektif.toFixed(2)}%.`,
      }, { status: 400 });
    }
  }

  // ─── Validasi: Total bobot KPI per perspektif harus = 100 ───────────────
  if (kpi && Array.isArray(kpi)) {
    // Ambil data perspektif dari DB untuk grouping
    const perspektifRes = await pool.query(`SELECT id, kode, nama_singkat FROM bsc_perspektif`);
    const perspektifMap = Object.fromEntries(perspektifRes.rows.map((r: any) => [r.id, r]));

    const kpiByPerspektif: Record<number, { bobot: number; kode: string }[]> = {};
    for (const k of kpi) {
      const pid = k.perspektif_id;
      if (!kpiByPerspektif[pid]) kpiByPerspektif[pid] = [];
      kpiByPerspektif[pid].push({ bobot: parseFloat(k.bobot) || 0, kode: k.kode });
    }

    for (const [pid, kpis] of Object.entries(kpiByPerspektif)) {
      const totalBobot = kpis.reduce((sum, k) => sum + k.bobot, 0);
      if (Math.abs(totalBobot - 100) > 0.01) {
        const pInfo = perspektifMap[parseInt(pid)];
        return NextResponse.json({
          success: false,
          message: `Total bobot KPI di perspektif "${pInfo?.nama_singkat || pid}" harus = 100%. Saat ini: ${totalBobot.toFixed(2)}%.`,
        }, { status: 400 });
      }
    }

    // Validasi: target > 0
    for (const k of kpi) {
      if ((parseFloat(k.target) || 0) <= 0) {
        return NextResponse.json({
          success: false,
          message: `Target KPI "${k.kode}" harus lebih besar dari 0.`,
        }, { status: 400 });
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update perspektif
    if (perspektif && Array.isArray(perspektif)) {
      for (const p of perspektif) {
        await client.query(
          `UPDATE bsc_perspektif SET bobot = $1, updated_at = NOW() WHERE id = $2`,
          [p.bobot, p.id]
        );
      }
    }

    // Update KPI
    if (kpi && Array.isArray(kpi)) {
      for (const k of kpi) {
        await client.query(
          `UPDATE bsc_kpi SET
             bobot = $1, target = $2, threshold_hijau = $3, threshold_kuning = $4,
             rekomendasi = $5, updated_at = NOW()
           WHERE id = $6`,
          [k.bobot, k.target, k.threshold_hijau, k.threshold_kuning, k.rekomendasi || null, k.id]
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: 'Konfigurasi BSC berhasil disimpan.' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[API PUT /api/settings/bsc] Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
