// src/app/api/dashboard/bsc/route.ts
// Pola C — Direct API (sesuai AGENTS.md konvensi modul laporan/realisasi-kegiatan)
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import {
  getKpi1,
  getKpi2,
  getKpi3,
  getKpi4,
  getKpi5,
  getKpi6,
  getKpi7,
  getKpi8,
  getKpi9,
  getKpi10,
  getKpi11,
  getKpi12,
  RawKpi,
} from '@/server/utils/bscQueries';

export const dynamic = 'force-dynamic';

// Final result — dikirim ke frontend
interface KpiResult extends RawKpi {
  status: 'hijau' | 'kuning' | 'merah' | 'abu';
}

// ─── Helper: Status Warna ────────────────────────────────────────────────────
function buildStatus(
  nilai: number | null,
  type: string,
): 'hijau' | 'kuning' | 'merah' | 'abu' {
  if (nilai === null) return 'abu';
  switch (type) {
    case 'gte80':  return nilai >= 80 ? 'hijau' : nilai >= 50 ? 'kuning' : 'merah';
    case 'gte90':  return nilai >= 90 ? 'hijau' : nilai >= 70 ? 'kuning' : 'merah';
    case 'gte95':  return nilai >= 95 ? 'hijau' : nilai >= 80 ? 'kuning' : 'merah';
    case 'gte85':  return nilai >= 85 ? 'hijau' : nilai >= 65 ? 'kuning' : 'merah';
    case 'gte10':  return nilai >= 10 ? 'hijau' : nilai >= 1  ? 'kuning' : 'merah';
    case 'gte4_5': return nilai >= 4.5 ? 'hijau' : nilai >= 4.0 ? 'kuning' : 'merah';
    case 'lt45':   return nilai <= 45 ? 'hijau' : nilai <= 60 ? 'kuning' : 'merah';
    case 'lt72':   return nilai <= 72 ? 'hijau' : nilai <= 96 ? 'kuning' : 'merah';
    case 'eff':    return nilai >= 90 && nilai <= 100 ? 'hijau' : nilai >= 80 ? 'kuning' : 'merah';
    case 'eq100':  return nilai >= 100 ? 'hijau' : nilai >= 80 ? 'kuning' : 'merah';
    default:       return 'abu';
  }
}

function tag(r: RawKpi, type: string): KpiResult {
  return { ...r, status: buildStatus(r.nilai, type) };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  // Akses: hanya Super Admin (is_super_admin=true) atau role MAJELIS
  if (!caller.is_super_admin && caller.role_name !== 'MAJELIS') {
    return NextResponse.json(
      { success: false, message: 'Akses ditolak. Dashboard BSC khusus Super Admin dan Majelis.' },
      { status: 403 },
    );
  }

  // ─── Parameter ────────────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);

  const now     = new Date();
  const y       = now.getFullYear();
  const m       = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();

  const dari   = searchParams.get('dari')   || `${y}-${m}-01`;
  const sampai = searchParams.get('sampai') || `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

  // RBAC satelit — AGENTS.md §3: non-super-admin wajib dipaksa ke satelitnya sendiri
  let satelitId: number | null = null;
  const rawSatelit = searchParams.get('satelit_id');
  if (rawSatelit !== null && rawSatelit !== undefined && rawSatelit.trim() !== '') {
    const parsed = parseInt(rawSatelit, 10);
    satelitId = isNaN(parsed) ? null : parsed;
  } else if (!caller.is_super_admin) {
    satelitId = caller.satelit_id ?? null;
  }

  try {
    // Execute all 12 KPI calculations in parallel
    const [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12] = await Promise.all([
      getKpi1(dari, sampai, satelitId),
      getKpi2(dari, sampai, satelitId),
      getKpi3(dari, sampai, satelitId),
      getKpi4(dari, sampai, satelitId),
      getKpi5(dari, sampai, satelitId),
      getKpi6(dari, sampai, satelitId),
      getKpi7(dari, sampai, satelitId),
      getKpi8(dari, sampai, satelitId),
      getKpi9(dari, sampai, satelitId),
      getKpi10(dari, sampai, satelitId),
      getKpi11(dari, sampai, satelitId),
      getKpi12(dari, sampai, satelitId),
    ]);

    // Optional satellite comparison (Super Admin and no satelit_id filter)
    let satelitComparison: any[] = [];
    if (caller.is_super_admin && satelitId === null) {
      const satRes = await pool.query(
        `SELECT id, nama_satelit FROM satelit WHERE is_active = true ORDER BY id ASC`
      );
      const satList = satRes.rows;

      satelitComparison = await Promise.all(
        satList.map(async (sat: any) => {
          const [k1, k3, k8, k9] = await Promise.all([
            getKpi1(dari, sampai, sat.id),
            getKpi3(dari, sampai, sat.id),
            getKpi8(dari, sampai, sat.id),
            getKpi9(dari, sampai, sat.id),
          ]);
          return {
            satelit_id: sat.id,
            nama_satelit: sat.nama_satelit,
            kpi1: k1.nilai,
            kpi3: k3.nilai,
            kpi8: k8.nilai,
            kpi9: k9.nilai,
          };
        })
      );
    }

    return NextResponse.json({
      success: true,
      meta: {
        dari,
        sampai,
        satelit_id: satelitId,
        generated_at: new Date().toISOString(),
      },
      data: {
        kpi1:  tag(r1,  'gte80'),
        kpi2:  tag(r2,  'gte4_5'),
        kpi3:  tag(r3,  'gte10'),
        kpi4:  tag(r4,  'gte90'),
        kpi5:  tag(r5,  'lt45'),
        kpi6:  tag(r6,  'eff'),
        kpi7:  tag(r7,  'eq100'),
        kpi8:  tag(r8,  'gte95'),
        kpi9:  tag(r9,  'gte90'),
        kpi10: tag(r10, 'gte85'),
        kpi11: tag(r11, 'gte95'),
        kpi12: tag(r12, 'lt72'),
      },
      satelit_comparison: satelitComparison.length > 0 ? satelitComparison : undefined,
    });

  } catch (error: any) {
    console.error('[API GET /api/dashboard/bsc] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan saat memuat data dashboard.', error: error.message },
      { status: 500 },
    );
  }
}
