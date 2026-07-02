// src/app/api/dashboard/bsc/route.ts
// Pola C — Direct API konvensi modul laporan/realisasi-kegiatan)
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

// ─── Helper: Status Warna — SEKARANG BACA DARI DATABASE ──────────────────────
// Menerima threshold dari tabel bsc_kpi, bukan hardcode switch-case lagi
function buildStatusFromConfig(
  nilai: number | null,
  thresholdHijau: number,
  thresholdKuning: number,
  higherIsBetter: boolean,
): 'hijau' | 'kuning' | 'merah' | 'abu' {
  if (nilai === null) return 'abu';

  if (higherIsBetter) {
    // Semakin tinggi semakin bagus (KPI 1-11)
    if (nilai >= thresholdHijau) return 'hijau';
    if (nilai >= thresholdKuning) return 'kuning';
    return 'merah';
  } else {
    // Semakin rendah semakin bagus (KPI 12: durasi respons pastoral)
    if (nilai <= thresholdHijau) return 'hijau';
    if (nilai <= thresholdKuning) return 'kuning';
    return 'merah';
  }
}

// Khusus KPI 6 (Efisiensi Anggaran), logikanya range 90-100% = hijau
// Ini tetap pakai threshold dari DB tapi logika "range" ditangani secara khusus
function buildStatusEfisiensi(
  nilai: number | null,
  thresholdHijau: number,
  thresholdKuning: number,
): 'hijau' | 'kuning' | 'merah' | 'abu' {
  if (nilai === null) return 'abu';
  // Efisiensi ideal = 90–100% (tidak boleh terlalu rendah, juga tidak terlalu tinggi)
  if (nilai >= thresholdHijau && nilai <= 100) return 'hijau';
  if (nilai >= thresholdKuning) return 'kuning';
  return 'merah';
}

function tagWithConfig(r: RawKpi, kpiConfig: any): KpiResult {
  // Override target dari database
  const result: RawKpi = {
    ...r,
    target: parseFloat(kpiConfig.target),
  };

  let status: 'hijau' | 'kuning' | 'merah' | 'abu';
  if (kpiConfig.kode === 'kpi6') {
    status = buildStatusEfisiensi(
      r.nilai,
      parseFloat(kpiConfig.threshold_hijau),
      parseFloat(kpiConfig.threshold_kuning),
    );
  } else {
    status = buildStatusFromConfig(
      r.nilai,
      parseFloat(kpiConfig.threshold_hijau),
      parseFloat(kpiConfig.threshold_kuning),
      kpiConfig.higher_is_better,
    );
  }

  return { ...result, status };
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

  // Default: 30 hari rolling ke belakang dari hari ini.
  // Ini buat nangkal kosong di awal bulan biar layarnya selalu ada senyum isinya.
  const now     = new Date();
  const defaultSampai = now.toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const defaultDari = thirtyDaysAgo.toISOString().split('T')[0];

  const dari   = searchParams.get('dari')   || defaultDari;
  const sampai = searchParams.get('sampai') || defaultSampai;

  // RBAC satelit — non-super-admin wajib dipaksa ke satelitnya sendiri
  let satelitId: number | null = null;
  const rawSatelit = searchParams.get('satelit_id');
  if (rawSatelit !== null && rawSatelit !== undefined && rawSatelit.trim() !== '') {
    const parsed = parseInt(rawSatelit, 10);
    satelitId = isNaN(parsed) ? null : parsed;
  } else if (!caller.is_super_admin) {
    satelitId = caller.satelit_id ?? null;
  }

  try {
    // ─── BACA KONFIGURASI BSC DARI DATABASE ──────────────────────────────
    const [perspektifRes, kpiRes] = await Promise.all([
      pool.query(`SELECT id, kode, nama, nama_singkat, icon, warna, bobot, urutan
                  FROM bsc_perspektif ORDER BY urutan ASC`),
      pool.query(`SELECT k.id, k.perspektif_id, k.kode, k.nama, k.icon, k.bobot, k.target,
                         k.satuan, k.higher_is_better, k.threshold_hijau, k.threshold_kuning,
                         k.rekomendasi, k.urutan,
                         p.kode AS perspektif_kode
                  FROM bsc_kpi k
                  JOIN bsc_perspektif p ON p.id = k.perspektif_id
                  ORDER BY p.urutan ASC, k.urutan ASC`),
    ]);

    // Buat map KPI config: kode -> config row
    const kpiConfigMap: Record<string, any> = {};
    for (const row of kpiRes.rows) {
      kpiConfigMap[row.kode] = row;
    }

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

    // Tag setiap KPI dengan config dari database (bukan hardcode)
    const rawResults: Record<string, RawKpi> = {
      kpi1: r1, kpi2: r2, kpi3: r3, kpi4: r4, kpi5: r5, kpi6: r6,
      kpi7: r7, kpi8: r8, kpi9: r9, kpi10: r10, kpi11: r11, kpi12: r12,
    };

    const taggedData: Record<string, KpiResult> = {};
    for (const [kode, rawKpi] of Object.entries(rawResults)) {
      const cfg = kpiConfigMap[kode];
      if (cfg) {
        taggedData[kode] = tagWithConfig(rawKpi, cfg);
      } else {
        // Fallback: kalau config belum ada di DB, pakai nilai mentah dengan status abu
        taggedData[kode] = { ...rawKpi, status: 'abu' };
      }
    }

    // Tambahan komparasi antarsatelit (Hanya berlaku untuk Super Admin yang gak main filter satelit)
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
      // ─── KIRIM KONFIGURASI BSC KE FRONTEND ────────────────────────────
      bsc_config: {
        perspektif: perspektifRes.rows.map((p: any) => ({
          ...p,
          bobot: parseFloat(p.bobot),
        })),
        kpi: kpiRes.rows.map((k: any) => ({
          ...k,
          bobot: parseFloat(k.bobot),
          target: parseFloat(k.target),
          threshold_hijau: parseFloat(k.threshold_hijau),
          threshold_kuning: parseFloat(k.threshold_kuning),
        })),
      },
      data: taggedData,
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
