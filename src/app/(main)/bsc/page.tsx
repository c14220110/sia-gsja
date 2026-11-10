'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';


function KpiSparkline({ kpiKey, color, satelitId }: { kpiKey: string; color: string; satelitId: string }) {
  const [data, setData] = useState<{ bulan: string; nilai: number | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setData([]);
    const fetchTrend = async () => {
      try {
        const q = new URLSearchParams({ kpi: kpiKey, bulan: '6' });
        if (satelitId) q.set('satelit_id', satelitId);
        const res = await fetch(`/api/dashboard/bsc/trend?${q}`);
        if (res.ok && active) {
          const j = await res.json();
          if (j.success) setData(j.data);
        }
      } catch (e) {
        console.error(`Error loading trend for ${kpiKey}`, e);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchTrend();
    return () => { active = false; };
  }, [kpiKey, satelitId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-8 w-full px-1">
        <div className="h-1.5 w-full bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  // Wajib ada minimal 1 data beneran; sisanya yang kosong diisi 0 biar grafiknya jalan
  const hasAnyData = data.some(d => d.nilai !== null);
  if (!hasAnyData) return null;

  const values = data.map(d => d.nilai ?? 0);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const svgW = 240;
  const svgH = 32;
  const padX = 4;
  const padY = 4;

  const points = values.map((val, idx) => ({
    x: padX + (idx / (values.length - 1)) * (svgW - padX * 2),
    y: svgH - padY - ((val - minVal) / range) * (svgH - padY * 2),
  }));

  const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;

  return (
    <div className="h-8 w-full overflow-visible opacity-90 hover:opacity-100 transition-opacity duration-300">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`spark-grad-${kpiKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path
          d={`${pathD} L ${points[points.length - 1].x},${svgH} L ${points[0].x},${svgH} Z`}
          fill={`url(#spark-grad-${kpiKey})`}
        />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="3.5"
          fill={color}
          stroke="#ffffff"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

// ── Radial Gauge (fixed SVG size, no ResponsiveContainer instability) ────────
function RadialGauge({ value, color }: { value: number; color: string }) {
  const SIZE = 130;
  const gaugeData = [{ name: 'v', value: Math.min(value, 100), fill: color }];
  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <RadialBarChart
        width={SIZE}
        height={SIZE}
        cx={SIZE / 2}
        cy={SIZE / 2}
        innerRadius="72%"
        outerRadius="100%"
        barSize={12}
        data={gaugeData}
        startAngle={90}
        endAngle={90 - (360 * Math.min(value, 100)) / 100}
      >
        <RadialBar background={{ fill: '#f1f5f9' }} dataKey="value" cornerRadius={6} />
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[16px] font-black tracking-tight leading-none" style={{ color }}>
          {Math.round(value)}%
        </span>
        <span className="text-[8px] text-slate-400 font-extrabold tracking-widest uppercase mt-0.5">PENCAPAIAN</span>
      </div>
    </div>
  );
}

// ── KPI Month-over-Month Comparison ─────────────────────────────────────────
// Ngambil 2 data terakhir dari tren buat ngitung selisih bulan ini vs bulan lalu.
function KpiMomBadge({ kpiKey, satelitId, higherIsBetter }: { kpiKey: string; satelitId: string; higherIsBetter: boolean }) {
  const [mom, setMom] = useState<{ delta: number; label: string } | null>(null);

  useEffect(() => {
    let active = true;
    const fetchMom = async () => {
      try {
        const q = new URLSearchParams({ kpi: kpiKey, bulan: '2' });
        if (satelitId) q.set('satelit_id', satelitId);
        const res = await fetch(`/api/dashboard/bsc/trend?${q}`);
        if (res.ok && active) {
          const j = await res.json();
          if (j.success && j.data.length >= 2) {
            const pts = (j.data as { bulan: string; nilai: number | null }[]).filter(d => d.nilai !== null);
            if (pts.length >= 2) {
              const prev = pts[pts.length - 2].nilai as number;
              const curr = pts[pts.length - 1].nilai as number;
              const delta = parseFloat((curr - prev).toFixed(1));
              setMom({ delta, label: pts[pts.length - 1].bulan });
            }
          }
        }
      } catch { /* silent */ }
    };
    fetchMom();
    return () => { active = false; };
  }, [kpiKey, satelitId]);

  if (!mom) return null;

  // Cek apakah perubahannya bagus atau jelek berpatokan sama aturan higherIsBetter
  const improved = higherIsBetter ? mom.delta > 0 : mom.delta < 0;
  const neutral  = mom.delta === 0;
  const sign     = mom.delta > 0 ? '+' : '';
  const arrow    = neutral ? '→' : improved ? '↑' : '↓';
  const cls      = neutral
    ? 'text-slate-400'
    : improved
      ? 'text-emerald-500'
      : 'text-rose-500';

  return (
    <span className={`text-[9px] font-bold ${cls} flex items-center gap-0.5`}>
      <span>{arrow}</span>
      <span>vs bln lalu: {sign}{mom.delta}</span>
    </span>
  );
}

// ── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ kpi, label, icon, targetLabel, higherIsBetter = true, kpiKey, satelitId }: {
  kpi: any; label: string; icon: string; targetLabel: string; higherIsBetter?: boolean; kpiKey: string; satelitId: string;
}) {
  if (!kpi) return null;

  const statusColors = {
    hijau: { border: 'border-emerald-500', bg: 'bg-emerald-50/40 hover:bg-emerald-50 transition-colors', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200', spark: '#10b981' },
    kuning: { border: 'border-amber-400', bg: 'bg-amber-50/40 hover:bg-amber-50 transition-colors', text: 'text-amber-600', badge: 'bg-amber-50 text-amber-700 border border-amber-200', spark: '#f59e0b' },
    merah: { border: 'border-rose-500', bg: 'bg-rose-50/40 hover:bg-rose-50 transition-colors', text: 'text-rose-600', badge: 'bg-rose-50 text-rose-700 border border-rose-200', spark: '#f43f5e' },
    abu: { border: 'border-slate-300', bg: 'bg-slate-50/50', text: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border border-slate-200', spark: '#94a3b8' },
  }[kpi.status as 'hijau' | 'kuning' | 'merah' | 'abu'] ?? { border: 'border-slate-300', bg: 'bg-slate-50/50', text: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border border-slate-200', spark: '#94a3b8' };

  const statusLabelText = { hijau: 'Tercapai', kuning: 'Waspada', merah: 'Tindakan', abu: 'Belum Ada' }[kpi.status as string] ?? '-';
  const isPercentage = ['kpi1', 'kpi4', 'kpi5', 'kpi6', 'kpi7', 'kpi8', 'kpi9', 'kpi10', 'kpi11'].includes(kpiKey);
  // Mutually exclusive visualisation modes:
  // sparklineOnly → show trend sparkline, hide gauge (KPI butuh konteks historis)
  // gaugeOnly     → show radial gauge, hide sparkline (KPI butuh posisi vs target)
  const sparklineOnly = ['kpi1', 'kpi3', 'kpi9', 'kpi12'].includes(kpiKey);
  const gaugeOnly     = ['kpi4', 'kpi5', 'kpi6', 'kpi8', 'kpi10', 'kpi11'].includes(kpiKey);
  const showGauge     = isPercentage && !sparklineOnly && kpi.nilai !== null;
  const showSparkline = kpi.nilai !== null;
  const pct = kpi.nilai !== null
    ? Math.min(100, higherIsBetter
        ? (kpi.nilai / kpi.target) * 100
        : (kpi.target / Math.max(kpi.nilai, 0.1)) * 100)
    : 0;

  // Tata letak rapet buat kartu yang gak ada datanya — WAJIB pake self-start di wadah induknya
  if (!kpi.data_tersedia) {
    return (
      <div className={`relative rounded-xl border-l-4 ${statusColors.border} bg-white p-2.5 flex items-center gap-2.5 border border-slate-200 shadow-sm self-start h-fit w-full`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${statusColors.badge}`}>
          <span className="material-icons-round text-[18px] leading-none">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-800 font-extrabold text-[11px] leading-tight truncate">{label}</p>
          <p className="text-[9px] text-slate-400 font-medium truncate mt-0.5">{kpi.pesan || 'Belum ada data cukup'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-2xl border-l-4 ${statusColors.border} bg-white p-4 flex flex-col justify-between min-h-[168px] shadow-sm border border-slate-200 hover:shadow-md transition-all duration-300`}>
      {/* Row 1: Icon and Title */}
      <div className="flex items-start justify-between gap-2 mb-2 w-full">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${statusColors.badge}`}>
            <span className="material-icons-round text-[18px] leading-none">{icon}</span>
          </div>
          <p className="text-slate-800 font-extrabold text-[12px] leading-tight tracking-wide break-words mt-1">{label}</p>
        </div>
        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 mt-1 ${statusColors.badge}`}>
          {statusLabelText}
        </span>
      </div>

      {/* Row 2: Value & Radial Gauge (only when gaugeOnly or isPercentage-but-not-sparklineOnly) */}
      <div className="flex items-center justify-between mb-2 gap-3">
        <div className="flex flex-col">
          <span className={`text-2xl font-black tracking-tight ${statusColors.text}`}>
            {kpi.nilai !== null ? kpi.nilai.toLocaleString('id-ID') : '—'}
            <span className="text-[10px] font-bold ml-0.5 text-slate-500">{kpi.unit}</span>
          </span>
          {/* Numerator / denominator + month-over-month comparison */}
          <div className="flex items-center gap-2 mt-0.5">
            {kpi.numerator !== undefined && kpi.denominator !== undefined && (
              <span className="text-[9px] text-slate-400 font-bold">{kpi.numerator} / {kpi.denominator}</span>
            )}
            <KpiMomBadge kpiKey={kpiKey} satelitId={satelitId} higherIsBetter={higherIsBetter} />
          </div>
        </div>
        {showGauge && (
          <RadialGauge value={pct} color={statusColors.spark} />
        )}
      </div>

      {/* Row 3: Sparkline (only for sparkline-mode KPIs) */}
      {showSparkline && (
        <div className="w-full h-8 mb-2">
          <KpiSparkline kpiKey={kpiKey} color={statusColors.spark} satelitId={satelitId} />
        </div>
      )}

      {/* Row 4: Target label + pencapaian % (only shown when no gauge already shows pct) */}
      <div className="border-t border-slate-100 pt-1.5 flex items-center justify-between text-[9px] text-slate-400 font-bold tracking-wide">
        <span>{targetLabel}</span>
        {!showGauge && kpi.nilai !== null && (
          <span className={statusColors.text}>Pencapaian: {Math.round(pct)}%</span>
        )}
      </div>
    </div>
  );
}

// ── Satelit Comparison Bar Chart ────────────────────────────────────────────
// Semua 4 KPI sekarang formatnya persen, kumpul di satu sumbu Y yang sama [0–100].
// KPI-3 berubah, tadinya jiwa (jumlah murni), sekarang jadi persen (retensi) di v2.
function SatelitComparisonChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;

  // Mentokin maksimal persentase di 100 biar tampilannya gak ancur kalau datanya ngawur
  const chartData = data.map(row => ({
    ...row,
    kpi1: row.kpi1 != null ? Math.min(row.kpi1, 100) : null,
    kpi3: row.kpi3 != null ? Math.min(row.kpi3, 100) : null,
    kpi8: row.kpi8 != null ? Math.min(row.kpi8, 100) : null,
    kpi9: row.kpi9 != null ? Math.min(row.kpi9, 100) : null,
  }));

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm">
          <span className="material-icons-round text-indigo-600 text-xl">bar_chart</span>
        </div>
        <div>
          <h3 className="font-extrabold text-slate-800 text-base tracking-tight">Perbandingan Kinerja Antar Satelit</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Analisis Komparatif Indikator Utama</p>
        </div>
      </div>

      {/* Legend manual — semua KPI menggunakan satu sumbu kiri [0–100%] */}
      <div className="flex flex-wrap gap-3 mb-3">
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#3b82f6' }} />
          Presensi Jemaat (%)
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#10b981' }} />
          Retensi Kehadiran (%)
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#8b5cf6' }} />
          Presensi Bernama (%)
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#f59e0b' }} />
          Kehadiran Pelayan (%)
        </span>
      </div>

      <div className="flex-1 min-h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
            {/* Single left axis: 0–100 — semua KPI sekarang persentase */}
            <YAxis
              yAxisId="pct"
              orientation="left"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              stroke="#64748b"
              fontSize={9}
              fontWeight="bold"
              tickLine={false}
              axisLine={false}
            />
            <XAxis
              dataKey="nama_satelit"
              stroke="#64748b"
              fontSize={10}
              fontWeight="bold"
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              labelStyle={{ color: '#1e293b', fontWeight: 'bold' }}
              itemStyle={{ fontSize: '11px', color: '#475569' }}
              formatter={(value: any) => [`${value}%`]}
            />
            {/* Semua bar menggunakan sumbu kiri pct */}
            <Bar yAxisId="pct" name="Presensi Jemaat (%)" dataKey="kpi1" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar yAxisId="pct" name="Retensi Kehadiran (%)" dataKey="kpi3" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar yAxisId="pct" name="Presensi Bernama (%)" dataKey="kpi8" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar yAxisId="pct" name="Kehadiran Pelayan (%)" dataKey="kpi9" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── BSC Perspektif Score Computation ────────────────────────────────────────
// SEKARANG: Bobot dibaca dari database via bscConfig, bukan hardcode.
// BSC_PERSPEKTIF_DEF hanya dipakai sebagai fallback jika config belum dimuat.
const BSC_PERSPEKTIF_DEF = {
  jemaat: {
    label: 'Jemaat & Pemangku Kepentingan', shortLabel: 'Jemaat',
    icon: 'groups', color: 'indigo', weight: 0.35,
    kpis: ['kpi1', 'kpi2', 'kpi3', 'kpi4'],
  },
  keuangan: {
    label: 'Pengelolaan Keuangan', shortLabel: 'Keuangan',
    icon: 'account_balance', color: 'emerald', weight: 0.25,
    kpis: ['kpi5', 'kpi6'],
  },
  proses: {
    label: 'Proses Bisnis Internal', shortLabel: 'Proses Internal',
    icon: 'settings', color: 'amber', weight: 0.25,
    kpis: ['kpi7', 'kpi8'],
  },
  pembelajaran: {
    label: 'Pembelajaran & Pertumbuhan', shortLabel: 'Pertumbuhan',
    icon: 'school', color: 'violet', weight: 0.15,
    kpis: ['kpi9', 'kpi10', 'kpi11', 'kpi12'],
  },
} as const;

type PerspektifKey = keyof typeof BSC_PERSPEKTIF_DEF;

function kpiAchievement(kpi: any, key: string, kpiConfigMap?: Record<string, any>): number | null {
  if (!kpi || !kpi.data_tersedia || kpi.nilai === null || kpi.target === null) return null;
  
  // Cek higher_is_better dari config database, fallback ke logika lama
  const cfg = kpiConfigMap?.[key];
  const higherIsBetter = cfg ? cfg.higher_is_better : !['kpi12'].includes(key);

  if (!higherIsBetter) {
    return Math.min(100, (kpi.target / Math.max(kpi.nilai, 0.01)) * 100);
  }
  // KPI-2 pake skala 5: kita konversi ke persen (target 4.5 = 90%)
  if (key === 'kpi2') {
    return Math.min(100, (kpi.nilai / 5) * 100);
  }
  return Math.min(100, (kpi.nilai / kpi.target) * 100);
}

function computePerspektifScores(d: any, bscConfig?: { perspektif: any[]; kpi: any[] } | null) {
  if (!d) return { scores: {} as Record<string, number | null>, overall: null as number | null };

  // Buat KPI config map untuk kpiAchievement
  const kpiConfigMap: Record<string, any> = {};
  if (bscConfig?.kpi) {
    for (const k of bscConfig.kpi) {
      kpiConfigMap[k.kode] = k;
    }
  }

  // Jika bscConfig tersedia, pakai bobot dari database
  if (bscConfig?.perspektif && bscConfig?.kpi) {
    const scores: Record<string, number | null> = {};
    let weightedSum = 0;
    let weightSum = 0;

    for (const pDef of bscConfig.perspektif) {
      const pKpis = bscConfig.kpi.filter((k: any) => k.perspektif_kode === pDef.kode);
      const achievements = pKpis
        .map((k: any) => kpiAchievement(d[k.kode], k.kode, kpiConfigMap))
        .filter((v: any): v is number => v !== null);

      if (achievements.length === 0) {
        scores[pDef.kode] = null;
      } else {
        const avg = achievements.reduce((a: number, b: number) => a + b, 0) / achievements.length;
        scores[pDef.kode] = Math.round(avg * 10) / 10;
        const weight = parseFloat(pDef.bobot) / 100; // bobot di DB = persen (35), konversi ke desimal (0.35)
        weightedSum += avg * weight;
        weightSum += weight;
      }
    }
    const overall = weightSum > 0 ? Math.round((weightedSum / weightSum) * 10) / 10 : null;
    return { scores, overall };
  }

  // Fallback: pakai BSC_PERSPEKTIF_DEF hardcode (jaga-jaga kalau config belum dimuat)
  const scores: Record<string, number | null> = {};
  let weightedSum = 0;
  let weightSum = 0;
  for (const [pKey, pDef] of Object.entries(BSC_PERSPEKTIF_DEF)) {
    const achievements = pDef.kpis
      .map(k => kpiAchievement(d[k], k, kpiConfigMap))
      .filter((v): v is number => v !== null);
    if (achievements.length === 0) {
      scores[pKey] = null;
    } else {
      const avg = achievements.reduce((a, b) => a + b, 0) / achievements.length;
      scores[pKey] = Math.round(avg * 10) / 10;
      weightedSum += avg * pDef.weight;
      weightSum += pDef.weight;
    }
  }
  const overall = weightSum > 0 ? Math.round((weightedSum / weightSum) * 10) / 10 : null;
  return { scores: scores as Record<PerspektifKey, number | null>, overall };
}

// ── BSC Overview: Perspektif Summary Card ───────────────────────────────────
// Biar matching sama tampilan stat card lainnya: putih, siku melengkung, ada bayangannya
function PerspektifSummaryCard({ pKey, d, score }: {
  pKey: PerspektifKey; d: any; score: number | null;
}) {
  const def = BSC_PERSPEKTIF_DEF[pKey];
  const kpiLabels: Record<string, string> = {
    kpi1: 'Presensi Jemaat', kpi2: 'Kepuasan (CSAT)', kpi3: 'Retensi Kehadiran',
    kpi4: 'Respons Pastoral', kpi5: 'Kecukupan Dana', kpi6: 'Efisiensi Anggaran',
    kpi7: 'Tindak Lanjut CSAT', kpi8: 'Presensi Digital', kpi9: 'Kehadiran Pelayan',
    kpi10: 'Konfirmasi Jadwal', kpi11: 'Disiplin Waktu', kpi12: 'Respons Pastoral (Jam)',
  };
  const colorMap: Record<string, { bg: string; text: string; iconBg: string; bar: string; barBg: string }> = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', iconBg: 'bg-indigo-100', bar: 'bg-indigo-500', barBg: 'bg-indigo-100' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', iconBg: 'bg-emerald-100', bar: 'bg-emerald-500', barBg: 'bg-emerald-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', iconBg: 'bg-amber-100', bar: 'bg-amber-500', barBg: 'bg-amber-100' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600', iconBg: 'bg-violet-100', bar: 'bg-violet-500', barBg: 'bg-violet-100' },
  };
  const c = colorMap[def.color] || colorMap.indigo;

  const statusIcon = (s: string) => ({
    hijau: { cls: 'text-emerald-500', ico: 'check_circle' },
    kuning: { cls: 'text-amber-500', ico: 'warning' },
    merah: { cls: 'text-rose-500', ico: 'error' },
    abu: { cls: 'text-slate-300', ico: 'remove_circle_outline' },
  }[s] ?? { cls: 'text-slate-300', ico: 'remove_circle_outline' });

  return (
    <div className="p-5 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${c.iconBg} rounded-xl flex justify-center items-center`}>
            <span className={`material-icons-round ${c.text} text-xl`}>{def.icon}</span>
          </div>
          <div>
            <p className="text-slate-800 text-sm font-bold leading-tight">{def.shortLabel}</p>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{def.label}</p>
          </div>
        </div>
        {score !== null && (
          <span className={`text-xl font-black ${c.text}`}>{score}%</span>
        )}
      </div>

      {/* Progress bar keseluruhan */}
      {score !== null && (
        <div className={`w-full h-2 ${c.barBg} rounded-full overflow-hidden`}>
          <div
            className={`h-full ${c.bar} rounded-full transition-all duration-700`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
      )}

      {/* KPI rows */}
      <div className="flex flex-col gap-2 mt-1">
        {def.kpis.map(k => {
          const kpi = d?.[k];
          if (!kpi) return null;
          const ach = kpiAchievement(kpi, k);
          const st = statusIcon(kpi.status);
          return (
            <div key={k} className="flex items-center gap-2">
              <span className={`material-icons-round text-[14px] ${st.cls}`}>{st.ico}</span>
              <span className="text-slate-600 text-xs font-medium flex-1 truncate">{kpiLabels[k] || k}</span>
              <span className="text-slate-800 text-xs font-bold w-14 text-right">
                {kpi.data_tersedia && kpi.nilai !== null
                  ? `${kpi.nilai}${kpi.unit === '%' ? '%' : kpi.unit ? ` ${kpi.unit}` : ''}`
                  : '—'}
              </span>
              {ach !== null && (
                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      kpi.status === 'hijau' ? 'bg-emerald-500'
                        : kpi.status === 'kuning' ? 'bg-amber-400'
                          : kpi.status === 'merah' ? 'bg-rose-500' : 'bg-slate-300'
                    }`}
                    style={{ width: `${Math.min(ach, 100)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Hero Carousel (Banner) ──────────────────────────────────────────────────
function HeroCarousel() {
  const [slideCount, setSlideCount] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const banners = [
    "/assets/carousel/foto1.png",
    "/assets/carousel/foto2.png",
    "/assets/carousel/foto3.png"
  ];

  const currentIndex = ((slideCount % banners.length) + banners.length) % banners.length;

  useEffect(() => {
    const timer = setInterval(() => {
      setSlideCount((prev) => prev + 1);
    }, 10000); // 10 seconds auto slide
    return () => clearInterval(timer);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe) {
      setSlideCount((prev) => prev + 1);
    }
    if (isRightSwipe) {
      setSlideCount((prev) => prev - 1);
    }
  };

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSlideCount((prev) => prev - 1);
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSlideCount((prev) => prev + 1);
  };

  return (
    <div 
      className="w-full relative overflow-hidden rounded-b-3xl aspect-[16/9] bg-slate-800 group [transform:translateZ(0)]"
      style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Infinite Images Slider */}
      <div className="absolute inset-0 w-full h-full">
        {[slideCount - 1, slideCount, slideCount + 1].map((virtualIndex) => {
          const realIndex = ((virtualIndex % banners.length) + banners.length) % banners.length;
          const offset = virtualIndex - slideCount;
          return (
            <div
              key={virtualIndex}
              className="absolute top-0 left-0 w-full h-full transition-transform duration-500 ease-out"
              style={{ transform: `translateX(${offset * 100}%)` }}
            >
              <img
                src={banners[realIndex]}
                alt={`Banner ${realIndex + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows */}
      <div className="absolute inset-y-0 left-0 flex items-center px-3 z-10 pointer-events-none">
        <button 
          onClick={handlePrev} 
          className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white pointer-events-auto hover:bg-black/40 transition-colors shadow-sm"
        >
          <span className="material-icons-round text-2xl -ml-0.5">chevron_left</span>
        </button>
      </div>
      <div className="absolute inset-y-0 right-0 flex items-center px-3 z-10 pointer-events-none">
        <button 
          onClick={handleNext} 
          className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white pointer-events-auto hover:bg-black/40 transition-colors shadow-sm"
        >
          <span className="material-icons-round text-2xl ml-0.5">chevron_right</span>
        </button>
      </div>
      
      {/* White Dots Indicator */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2.5 z-10">
        {banners.map((_, i) => (
          <div
            key={i}
            className={`h-[9px] w-[9px] rounded-full transition-all duration-300 shadow-sm ${i === currentIndex ? 'bg-white' : 'bg-transparent border-[1.5px] border-white/70'}`}
          />
        ))}
      </div>
    </div>
  );
}


// ─── NEW BSC UI COMPONENTS ──────────────────────────────────────────────────

function MiniBadge({ status }: { status: "hijau" | "kuning" | "merah" | "abu" }) {
  const cfg = {
    hijau:  { label: "TERCAPAI", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    kuning: { label: "WASPADA",  cls: "bg-amber-100 text-amber-700 border-amber-200" },
    merah:  { label: "TINDAKAN", cls: "bg-rose-100 text-rose-700 border-rose-200" },
    abu:    { label: "BELUM ADA",cls: "bg-slate-100 text-slate-500 border-slate-200" },
  }[status] || { label: "BELUM ADA", cls: "bg-slate-100 text-slate-500 border-slate-200" };
  return (
    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${cfg.cls} tracking-wider`}>
      {cfg.label}
    </span>
  );
}

function MiniKpiCard({ id, title, kpi, kpiKey, icon, causal, sid, higherIsBetter = true }: any) {
  if (!kpi) return <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-32 animate-pulse" />;
  const status = kpi.status as "hijau" | "kuning" | "merah" | "abu";
  
  const c = {
    hijau: { bg: 'bg-emerald-50', text: 'text-emerald-600', val: 'text-emerald-700', bar: 'bg-emerald-500', spark: '#10b981' },
    kuning: { bg: 'bg-amber-50', text: 'text-amber-500', val: 'text-amber-600', bar: 'bg-amber-400', spark: '#f59e0b' },
    merah: { bg: 'bg-rose-50', text: 'text-rose-500', val: 'text-rose-600', bar: 'bg-rose-500', spark: '#f43f5e' },
    abu: { bg: 'bg-slate-50', text: 'text-slate-400', val: 'text-slate-500', bar: 'bg-slate-300', spark: '#94a3b8' },
  }[status] || { bg: 'bg-slate-50', text: 'text-slate-400', val: 'text-slate-500', bar: 'bg-slate-300', spark: '#94a3b8' };

  const pct = kpi.nilai !== null
    ? Math.min(100, higherIsBetter ? (kpi.nilai / kpi.target) * 100 : (kpi.target / Math.max(kpi.nilai, 0.1)) * 100)
    : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col justify-between h-full hover:shadow-md transition-shadow group">
      <div>
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${c.bg}`}>
              <span className={`material-icons-round text-[16px] ${c.text}`}>{icon}</span>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 tracking-wider">{id}</div>
              <div className="text-xs font-bold text-slate-700 leading-tight">{title}</div>
            </div>
          </div>
          <MiniBadge status={status} />
        </div>
        
        <div className="flex items-end justify-between mt-2">
          <div>
            <span className={`text-xl font-black ${c.val}`}>
              {kpi.nilai !== null ? kpi.nilai.toLocaleString('id-ID') : '—'}
            </span>
            <span className="text-[10px] font-bold text-slate-400 ml-0.5">{kpi.unit}</span>
          </div>
          <div className="w-16 h-6 opacity-70 group-hover:opacity-100 transition-opacity">
            {kpi.nilai !== null && <KpiSparkline kpiKey={kpiKey} color={c.spark} satelitId={sid} />}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
          <div className={`h-full rounded-full ${c.bar} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
          <span>Target: {kpi.target !== null ? (higherIsBetter ? '>' : '<') + kpi.target + (kpi.unit === '%'?'%':'') : '-'}</span>
          <span className={c.val}>{Math.round(pct)}% tercapai</span>
        </div>
        {causal && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-50">
            <span className="material-icons-round text-[10px] text-indigo-400">arrow_forward</span>
            <span className="text-[9px] font-medium text-indigo-500 italic">{causal}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function LayerHeader({ color, icon, label, sub, score, achieved, total }: any) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 rounded-t-xl border-b ${color}`}>
      <div className="flex items-center gap-2">
        <span className="material-icons-round text-lg">{icon}</span>
        <div>
          <div className="text-xs font-black text-slate-800">{label}</div>
          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{sub}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i < achieved ? "bg-emerald-400" : "bg-slate-200"}`} />
          ))}
        </div>
        <span className="text-sm font-black text-slate-800">{score}%</span>
      </div>
    </div>
  );
}

function CausalConnector({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1 shadow-sm">
        <span className="material-icons-round text-[12px] text-indigo-400">arrow_upward</span>
        <span className="text-[10px] text-indigo-600 font-bold">{label}</span>
        <span className="material-icons-round text-[12px] text-indigo-400">arrow_upward</span>
      </div>
    </div>
  );
}


export default function BscDashboardPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [loadingBsc, setLoadingBsc] = useState(true);
  const [bscData, setBscData] = useState<any>(null);
  const [bscConfig, setBscConfig] = useState<{ perspektif: any[]; kpi: any[] } | null>(null);
  const [satelitComparisonData, setSatelitComparisonData] = useState<any[]>([]);
  const [satelitList, setSatelitList] = useState<any[]>([]);
  
  const [bscTab, setBscTab] = useState<'overview' | 'detail'>('overview');
  const [selectedPerspektif, setSelectedPerspektif] = useState<string>('jemaat');
  const [showConfigModal, setShowConfigModal] = useState(false);
  
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [bscMonthFilter, setBscMonthFilter] = useState(
    `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`
  );
  
  const expandMonth = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      dari: `${y}-${String(m).padStart(2, '0')}-01`,
      sampai: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  };
  
  const [bscFilter, setBscFilter] = useState({
    ...expandMonth(`${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`),
    satelit_id: '',
  });

  const fetchBsc = async (f = bscFilter) => {
    setLoadingBsc(true);
    try {
      const q = new URLSearchParams({ dari: f.dari, sampai: f.sampai });
      if (f.satelit_id) q.set('satelit_id', f.satelit_id);
      
      const resBsc = await fetch(`/api/dashboard/bsc?${q}`);
      
      if (resBsc.ok) {
        const j = await resBsc.json();
        if (j.success) {
          setBscData(j.data);
          setSatelitComparisonData(j.satelit_comparison ?? null);
          if (j.bsc_config) setBscConfig(j.bsc_config);
        }
      }
    } catch(e) { 
      console.error(e); 
    } finally { 
      setLoadingBsc(false); 
    }
  };

  useEffect(() => {
    const init = async () => {
        const resAuth = await fetch('/api/auth/me');
        if (resAuth.ok) {
            const uData = await resAuth.json();
            setUserData(uData);
            
            // Allow only super_admin or majelis
            if (!(uData?.is_super_admin || uData?.role_name === 'MAJELIS')) {
                router.replace('/');
                return;
            }
            
            const resSatelit = await fetch('/api/settings/organisasi?tab=satelit');
            if (resSatelit.ok) {
                const j = await resSatelit.json();
                if (j.success) setSatelitList(j.satelit_list ?? []);
            }
            
            fetchBsc();
        }
    };
    init();
  }, []);

  // Ubah blok JSX buat nyopot kondisi bungkusannya
  const isExecRole = true;
  const showBscDashboard = true;

    const d = bscData;

    // Hitung pencapaian KPI untuk Summary Bar
    const kpisList = d ? Object.values(d) as any[] : [];
    const totalKpiCount = bscConfig?.kpi?.length ?? 12;
    const hijauCount = kpisList.filter(k => k.status === 'hijau').length;
    const kuningCount = kpisList.filter(k => k.status === 'kuning').length;
    const merahCount = kpisList.filter(k => k.status === 'merah').length;
    const sid = bscFilter.satelit_id;

    // ── KONFIGURASI KPI DARI DATABASE (bukan hardcode) ─────────────────────
    // Buat map: kode KPI → config dari API
    const kpiConfigMap: Record<string, any> = {};
    if (bscConfig?.kpi) {
      for (const k of bscConfig.kpi) {
        kpiConfigMap[k.kode] = k;
      }
    }

    // kpiMapping sekarang dibangun dari database config
    const kpiMapping: Record<string, { label: string; rec: string }> = {};
    if (bscConfig?.kpi) {
      for (const k of bscConfig.kpi) {
        kpiMapping[k.kode] = { label: k.nama, rec: k.rekomendasi || '' };
      }
    }

    // Filter KPI bermasalah untuk Hero Section (maksimal 3)
    const troubledKpis = Object.entries(d || {})
      .filter(([key, kpi]: [string, any]) => {
        return kpi && kpi.data_tersedia && (kpi.status === 'merah' || kpi.status === 'kuning') && kpiMapping[key];
      })
      .map(([key, kpi]: [string, any]) => {
        const weight = kpi.status === 'merah' ? 2 : 1;
        return {
          key,
          kpi,
          weight,
          label: kpiMapping[key].label,
          rec: kpiMapping[key].rec,
        };
      })
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3);


    const { scores: pScores, overall: overallScore } = computePerspektifScores(d, bscConfig);

    // Perspektif detail config for Detail tab
    const perspektifDetailConfig: Record<string, { header: { warna: string; icon: string; title: string; subtitle: string }; cards: React.ReactNode[] }> = {
      jemaat: {
        header: { warna: 'bg-blue-100 text-blue-600 border border-blue-200', icon: 'groups', title: 'Jemaat & Pemangku Kepentingan', subtitle: 'Customer Perspective' },
        cards: [
          <KpiCard key="k1" kpi={d?.kpi1} label="Rasio Presensi Jemaat" icon="how_to_reg" targetLabel="Target: > 80%" kpiKey="kpi1" satelitId={sid} />,
          <KpiCard key="k2" kpi={d?.kpi2} label="Skor Kepuasan Rata-rata" icon="star" targetLabel="Target: > 4.5 dari 5.0" kpiKey="kpi2" satelitId={sid} />,
          <KpiCard key="k3" kpi={d?.kpi3} label="Tingkat Retensi Kehadiran" icon="loyalty" targetLabel="Target: ≥ 85%" kpiKey="kpi3" satelitId={sid} />,
          <KpiCard key="k4" kpi={d?.kpi4} label="Tingkat Ketepatan Respons Pastoral" icon="support_agent" targetLabel="Target: > 90%" kpiKey="kpi4" satelitId={sid} />,
        ],
      },
      keuangan: {
        header: { warna: 'bg-emerald-100 text-emerald-600 border border-emerald-200', icon: 'account_balance', title: 'Pengelolaan Keuangan', subtitle: 'Financial Perspective' },
        cards: [
          <KpiCard key="k5" kpi={d?.kpi5} label="Tingkat Kecukupan Pendanaan" icon="account_balance_wallet" targetLabel="Target: ≥ 100%" higherIsBetter={true} kpiKey="kpi5" satelitId={sid} />,
          <KpiCard key="k6" kpi={d?.kpi6} label="Efisiensi Anggaran" icon="request_quote" targetLabel="Target: 90%–100%" kpiKey="kpi6" satelitId={sid} />,
        ],
      },
      proses: {
        header: { warna: 'bg-violet-100 text-violet-600 border border-violet-200', icon: 'settings_suggest', title: 'Proses Bisnis Internal', subtitle: 'Internal Process Perspective' },
        cards: [
          <KpiCard key="k7" kpi={d?.kpi7} label="Rasio Penyelesaian Tindak Lanjut" icon="task_alt" targetLabel="Target: 100%" kpiKey="kpi7" satelitId={sid} />,
          <KpiCard key="k8" kpi={d?.kpi8} label="Kelengkapan Data Presensi Bernama" icon="fact_check" targetLabel="Target: > 95%" kpiKey="kpi8" satelitId={sid} />,
        ],
      },
      pembelajaran: {
        header: { warna: 'bg-orange-100 text-orange-600 border border-orange-200', icon: 'school', title: 'Pembelajaran & Pertumbuhan', subtitle: 'Learning & Growth Perspective' },
        cards: [
          <KpiCard key="k9" kpi={d?.kpi9} label="Rasio Kehadiran Pelayan" icon="volunteer_activism" targetLabel="Target: > 90%" kpiKey="kpi9" satelitId={sid} />,
          <KpiCard key="k10" kpi={d?.kpi10} label="Ketepatan Waktu Konfirmasi Jadwal" icon="schedule_send" targetLabel="Target: > 85%" kpiKey="kpi10" satelitId={sid} />,
          <KpiCard key="k11" kpi={d?.kpi11} label="Kedisiplinan Waktu Kedatangan Pelayan" icon="alarm_on" targetLabel="Target: > 95%" kpiKey="kpi11" satelitId={sid} />,
          <KpiCard key="k12" kpi={d?.kpi12} label="Tingkat Respons Pelayanan Pastoral" icon="timer" targetLabel="Target: < 72 jam" higherIsBetter={false} kpiKey="kpi12" satelitId={sid} />,
        ],
      },
    };

    const detailConf = d ? perspektifDetailConfig[selectedPerspektif] : null;

    return (
      <div className="w-full flex flex-col gap-5 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
        
        {/* Top header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-1">
          <div className="flex flex-col gap-1">
            <h1 className="text-slate-900 text-2xl font-black font-sans leading-tight">Balanced Scorecard</h1>
            <p className="text-slate-400 text-sm font-medium">Analisis Kinerja Strategis Organisasi — GSJA Eben Haezer</p>
          </div>
          <button 
            onClick={() => router.push("/")}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all outline-none"
          >
            <span className="material-icons-round text-[18px]">arrow_back</span>
            Kembali ke Akses Cepat
          </button>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <span className="material-icons-round text-indigo-600 text-xl">analytics</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Skor BSC</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-800">{overallScore ?? '-'}</span>
                <span className="text-xs text-slate-400 font-bold">/ 100</span>
              </div>
              {overallScore !== null && (
                <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${overallScore >= 85 ? 'bg-emerald-500' : overallScore >= 70 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${Math.min(overallScore, 100)}%` }} />
                </div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <span className="material-icons-round text-emerald-600 text-xl">check_circle</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Tercapai</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-emerald-600">{hijauCount}</span>
                <span className="text-xs text-slate-400 font-bold">/ {totalKpiCount}</span>
              </div>
              <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(hijauCount/totalKpiCount)*100}%` }} />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <span className="material-icons-round text-amber-600 text-xl">warning</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Waspada</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-amber-600">{kuningCount}</span>
                <span className="text-xs text-slate-400 font-bold">/ {totalKpiCount}</span>
              </div>
              <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(kuningCount/totalKpiCount)*100}%` }} />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
              <span className="material-icons-round text-rose-600 text-xl">error</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Tindakan</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-rose-600">{merahCount}</span>
                <span className="text-xs text-slate-400 font-bold">/ {totalKpiCount}</span>
              </div>
              <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(merahCount/totalKpiCount)*100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Periode</label>
            <input
              type="month"
              value={bscMonthFilter}
              onChange={e => {
                const ym = e.target.value;
                setBscMonthFilter(ym);
                const expanded = expandMonth(ym);
                setBscFilter(prev => ({ ...prev, ...expanded }));
              }}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:border-indigo-400 font-medium"
            />
          </div>
          {userData?.is_super_admin && satelitList.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Satelit</label>
              <div className="relative">
                <select value={bscFilter.satelit_id} onChange={e => setBscFilter(p => ({ ...p, satelit_id: e.target.value }))} className="appearance-none text-xs border border-slate-200 rounded-lg pl-2 pr-6 py-1.5 text-slate-600 focus:outline-none focus:border-indigo-400 font-medium cursor-pointer">
                  <option value="">Semua Satelit</option>
                  {satelitList.map((s: any) => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                </select>
                <span className="material-icons-round absolute right-1.5 top-1.5 text-slate-400 pointer-events-none text-[16px]">expand_more</span>
              </div>
            </div>
          )}
          <button onClick={() => fetchBsc(bscFilter)} disabled={loadingBsc} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors shadow-sm">
            <span className={`material-icons-round text-[14px] ${loadingBsc ? 'animate-spin' : ''}`}>{loadingBsc ? 'autorenew' : 'refresh'}</span>
            Muat Data
          </button>
          {userData?.is_super_admin && (
            <button onClick={() => setShowConfigModal(true)} className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold px-4 py-1.5 rounded-lg transition-colors shadow-sm ml-auto">
              <span className="material-icons-round text-[14px]">settings</span>
              Konfigurasi BSC
            </button>
          )}
        </div>

        {/* Tab Bar */}
        <div className="flex gap-2">
          <button onClick={() => setBscTab('overview')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${bscTab === 'overview' ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
            <span className="material-icons-round text-[16px]">dashboard</span> Overview
          </button>
          <button onClick={() => setBscTab('detail')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${bscTab === 'detail' ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
            <span className="material-icons-round text-[16px]">view_list</span> Detail Perspektif
          </button>
        </div>

        {/* Skeleton */}
        {loadingBsc && !d && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <span className="material-icons-round text-5xl text-slate-200 animate-spin">autorenew</span>
            <p className="font-bold text-slate-400">Memuat data BSC...</p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ── TAB 1: OVERVIEW ──────────────────────────────────────  */}
        {/* ══════════════════════════════════════════════════════════ */}
        {bscTab === 'overview' && d && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            {/* Insight Banner */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4 flex gap-3 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <span className="material-icons-round text-white text-[16px]">insights</span>
              </div>
              <div>
                <div className="text-sm font-black text-indigo-900 mb-1">Cerita Data Bulan Ini</div>
                <p className="text-xs font-medium text-indigo-800 leading-relaxed">
                  <strong>{hijauCount} dari 12 KPI tercapai.</strong> Skor keseluruhan mencapai <strong>{overallScore}%</strong>.
                  {merahCount > 0 ? ` Perhatikan ${merahCount} KPI yang memerlukan tindakan segera.` : ` Performa bulan ini sangat baik tanpa KPI kritis.`}
                </p>
              </div>
            </div>

            {/* LAYER 1: PUNCAK BSC */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <LayerHeader color="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100" icon={<span className="text-emerald-600 material-icons-round">star</span>} label="Tujuan Akhir (Puncak BSC)" sub="Ultimate Goal" score={pScores.jemaat} achieved={1} total={1} />
              <div className="p-5">
                <div className="flex flex-col md:flex-row gap-6 items-center">
                  <div className="flex-1 w-full">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                        <span className="material-icons-round text-emerald-600 text-xl">favorite</span>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 mb-0.5">KPI-3</div>
                        <div className="text-sm font-black text-slate-800">Tingkat Retensi Kehadiran Jemaat</div>
                        <div className="text-[10px] font-medium text-slate-400 italic mt-0.5">Muara dari seluruh performa operasional gereja</div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                      <div>
                        <span className={`text-5xl font-black ${d.kpi3?.status==='hijau'?'text-emerald-600':d.kpi3?.status==='kuning'?'text-amber-500':'text-rose-500'}`}>{d.kpi3?.nilai ?? '-'}</span>
                        <span className="text-xl text-slate-400 font-bold ml-1">%</span>
                      </div>
                      <div className="flex flex-col gap-1.5 items-start">
                        <MiniBadge status={d.kpi3?.status || 'abu'} />
                        <div className="text-xs font-bold text-slate-400">Target: ≥ 85%</div>
                        <KpiMomBadge kpiKey="kpi3" satelitId={sid} higherIsBetter={true} />
                      </div>
                    </div>
                    <div className="mt-4 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${d.kpi3?.status==='hijau'?'bg-emerald-500':d.kpi3?.status==='kuning'?'bg-amber-400':'bg-rose-500'}`} style={{ width: `${Math.min(d.kpi3?.nilai ?? 0, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1.5">
                      <span>0%</span><span className="text-emerald-600">{d.kpi3?.nilai ?? 0}% / Target 85%</span><span>100%</span>
                    </div>
                    <button 
                      onClick={() => router.push('/jemaat/analisis-kehadiran')}
                      className="mt-4 w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span className="material-icons-round text-[14px]">radar</span>
                      Lihat Analisis Retensi Jemaat
                    </button>
                  </div>
                  <div className="flex-1 w-full flex flex-col h-32 border-l border-slate-100 pl-6">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tren Terakhir</div>
                    <div className="flex-1 w-full bg-slate-50/50 rounded-lg flex items-end">
                       <KpiSparkline kpiKey="kpi3" color={d.kpi3?.status==='hijau'?'#10b981':d.kpi3?.status==='kuning'?'#f59e0b':'#f43f5e'} satelitId={sid} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <CausalConnector label="Retensi didorong oleh → Kepuasan & Kehadiran Jemaat" />

            {/* LAYER 2: JEMAAT */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <LayerHeader color="bg-indigo-50 border-indigo-100" icon={<span className="text-indigo-600 material-icons-round">groups</span>} label="Perspektif Jemaat" sub="Customer Perspective" score={pScores.jemaat} achieved={d.kpi1?.status==='hijau'?1:0 + (d.kpi2?.status==='hijau'?1:0) + (d.kpi4?.status==='hijau'?1:0)} total={3} />
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <MiniKpiCard id="KPI-1" title="Rasio Presensi Jemaat" kpi={d.kpi1} kpiKey="kpi1" icon="how_to_reg" causal="Mendukung Retensi" sid={sid} />
                <MiniKpiCard id="KPI-4" title="Ketepatan Respons Pastoral" kpi={d.kpi4} kpiKey="kpi4" icon="support_agent" causal="Menjaga Kepuasan & Retensi" sid={sid} />
                <MiniKpiCard id="KPI-2" title="Skor Kepuasan (CSAT)" kpi={d.kpi2} kpiKey="kpi2" icon="star" causal="Mendukung Retensi" sid={sid} />
              </div>
            </div>

            <CausalConnector label="Kepuasan didukung oleh → Proses Internal & Keuangan yang sehat" />

            {/* LAYER 3: PROSES & KEUANGAN */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <LayerHeader color="bg-amber-50 border-amber-100" icon={<span className="text-amber-600 material-icons-round">settings</span>} label="Proses Bisnis Internal" sub="Internal Process" score={pScores.proses} achieved={d.kpi7?.status==='hijau'?1:0 + (d.kpi8?.status==='hijau'?1:0)} total={2} />
                <div className="p-4 grid grid-cols-1 gap-4 flex-1">
                  <MiniKpiCard id="KPI-8" title="Akurasi Data Presensi" kpi={d.kpi8} kpiKey="kpi8" icon="storage" causal="Validasi Angka Presensi & Retensi" sid={sid} />
                  <MiniKpiCard id="KPI-7" title="Penyelesaian Keluhan Jemaat" kpi={d.kpi7} kpiKey="kpi7" icon="task_alt" causal="Meningkatkan Kepuasan Jemaat" sid={sid} />
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <LayerHeader color="bg-emerald-50 border-emerald-100" icon={<span className="text-emerald-600 material-icons-round">account_balance</span>} label="Keuangan" sub="Financial Perspective" score={pScores.keuangan} achieved={d.kpi5?.status==='hijau'?1:0 + (d.kpi6?.status==='hijau'?1:0)} total={2} />
                <div className="p-4 grid grid-cols-1 gap-4 flex-1">
                  <MiniKpiCard id="KPI-5" title="Kecukupan Pendanaan" kpi={d.kpi5} kpiKey="kpi5" icon="account_balance_wallet" causal="Memungkinkan Efisiensi Anggaran" sid={sid} higherIsBetter={true} />
                  <MiniKpiCard id="KPI-6" title="Efisiensi Anggaran Kegiatan" kpi={d.kpi6} kpiKey="kpi6" icon="request_quote" causal="Mendukung Kualitas Kegiatan" sid={sid} />
                </div>
              </div>
            </div>

            <CausalConnector label="Proses lancar didukung oleh → Kesiapan & Disiplin Tim Pelayan" />

            {/* LAYER 4: PEMBELAJARAN */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <LayerHeader color="bg-violet-50 border-violet-100" icon={<span className="text-violet-600 material-icons-round">school</span>} label="Pembelajaran & Pertumbuhan" sub="Learning & Growth · Fondasi Operasional" score={pScores.pembelajaran} achieved={d.kpi9?.status==='hijau'?1:0 + (d.kpi10?.status==='hijau'?1:0) + (d.kpi11?.status==='hijau'?1:0) + (d.kpi12?.status==='hijau'?1:0)} total={4} />
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MiniKpiCard id="KPI-10" title="Konfirmasi Jadwal" kpi={d.kpi10} kpiKey="kpi10" icon="schedule_send" causal="Meningkatkan Kehadiran Pelayan" sid={sid} />
                <MiniKpiCard id="KPI-9" title="Kehadiran Pelayan" kpi={d.kpi9} kpiKey="kpi9" icon="volunteer_activism" causal="Memastikan Operasional Lancar" sid={sid} />
                <MiniKpiCard id="KPI-11" title="Disiplin Waktu Pelayan" kpi={d.kpi11} kpiKey="kpi11" icon="alarm_on" causal="Memastikan Operasional Lancar" sid={sid} />
                <MiniKpiCard id="KPI-12" title="Respons Pastoral" kpi={d.kpi12} kpiKey="kpi12" icon="timer" causal="Mendorong Ketepatan SLA" sid={sid} higherIsBetter={false} />
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ── TAB 2: DETAIL PERSPEKTIF ─────────────────────────────  */}
        {/* ══════════════════════════════════════════════════════════ */}
        {bscTab === 'detail' && d && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Perspektif Selector Tabs */}
            <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm flex overflow-hidden">
              {(bscConfig?.perspektif || []).map((pDef: any) => (
                <button
                  key={pDef.kode}
                  onClick={() => setSelectedPerspektif(pDef.kode)}
                  className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-4 px-2 transition-all border-b-2 ${
                    selectedPerspektif === pDef.kode
                      ? 'bg-slate-50 border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-icons-round text-[18px]">{pDef.icon}</span>
                    <span className="font-bold text-sm">{pDef.nama_singkat}</span>
                  </div>
                  {(pScores as Record<string, number | null>)[pDef.kode] !== null && (pScores as Record<string, number | null>)[pDef.kode] !== undefined && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${selectedPerspektif === pDef.kode ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                      {(pScores as Record<string, number | null>)[pDef.kode]}%
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Perspektif Header & Content */}
            {detailConf && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-4 pb-5 mb-5 border-b border-slate-100">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${detailConf.header.warna}`}>
                    <span className="material-icons-round text-2xl">{detailConf.header.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-xl leading-tight">{detailConf.header.title}</h3>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">{detailConf.header.subtitle}</p>
                  </div>
                  {(pScores as Record<string, number | null>)[selectedPerspektif] !== null && (
                    <div className="ml-auto text-right">
                      <span className="text-3xl font-black text-slate-800">{(pScores as Record<string, number | null>)[selectedPerspektif]}%</span>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Skor Perspektif</p>
                    </div>
                  )}
                </div>

                {/* KPI Cards Grid for Detail Tab */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {detailConf.cards}
                </div>
              </div>
            )}

            {/* Perbandingan Antar Satelit & Radar Chart */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mt-2 pb-8">
              <div className="xl:col-span-3">
                {userData?.is_super_admin && bscFilter.satelit_id === '' && satelitComparisonData && (
                  <SatelitComparisonChart data={satelitComparisonData} />
                )}
              </div>
              <div className="xl:col-span-2">
                <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm p-6 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm">
                      <span className="material-icons-round text-indigo-600 text-xl">radar</span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-base tracking-tight">Radar Kesehatan Organisasi</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Pencapaian vs Target (%)</p>
                    </div>
                  </div>
                  <div className="flex-1 min-h-[280px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={[
                        { subject: "Presensi", A: kpiAchievement(d?.kpi1, 'kpi1') ?? 0 },
                        { subject: "Kepuasan", A: kpiAchievement(d?.kpi2, 'kpi2') ?? 0 },
                        { subject: "Retensi",  A: kpiAchievement(d?.kpi3, 'kpi3') ?? 0 },
                        { subject: "SLA Past.",A: kpiAchievement(d?.kpi4, 'kpi4') ?? 0 },
                        { subject: "Dana",     A: kpiAchievement(d?.kpi5, 'kpi5') ?? 0 },
                        { subject: "Efisiensi",A: kpiAchievement(d?.kpi6, 'kpi6') ?? 0 },
                        { subject: "Keluhan",  A: kpiAchievement(d?.kpi7, 'kpi7') ?? 0 },
                        { subject: "Akurasi",  A: kpiAchievement(d?.kpi8, 'kpi8') ?? 0 },
                        { subject: "Pelayan",  A: kpiAchievement(d?.kpi9, 'kpi9') ?? 0 },
                        { subject: "Jadwal",   A: kpiAchievement(d?.kpi10, 'kpi10') ?? 0 },
                        { subject: "Disiplin", A: kpiAchievement(d?.kpi11, 'kpi11') ?? 0 },
                        { subject: "Respons",  A: kpiAchievement(d?.kpi12, 'kpi12') ?? 0 },
                      ]} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: "#64748b", fontWeight: "bold" }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} tickCount={5} />
                        <Radar name="Pencapaian" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          labelStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                          itemStyle={{ fontSize: '11px', color: '#475569' }}
                          formatter={(v: any) => [`${Math.round(Number(v) || 0)}%`, "Pencapaian"]} 
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── BSC Configuration Modal ────────────────────────────── */}
        {showConfigModal && bscConfig && (
          <BscConfigModal
            config={bscConfig}
            onClose={() => setShowConfigModal(false)}
            onSaved={() => { setShowConfigModal(false); fetchBsc(bscFilter); }}
          />
        )}

      </div>
    );
  }

// ── BSC Configuration Modal Component ─────────────────────────────────────
function BscConfigModal({ config, onClose, onSaved }: { config: { perspektif: any[]; kpi: any[] }; onClose: () => void; onSaved: () => void }) {
  const [perspektif, setPerspektif] = useState(config.perspektif.map(p => ({ ...p, bobot: p.bobot.toString() })));
  const [kpi, setKpi] = useState(config.kpi.map(k => ({
    ...k,
    bobot: k.bobot.toString(),
    target: k.target.toString(),
    threshold_hijau: k.threshold_hijau.toString(),
    threshold_kuning: k.threshold_kuning.toString(),
  })));
  const [saving, setSaving] = useState(false);
  const [submitState, setSubmitState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });
  const [activeTab, setActiveTab] = useState<'perspektif' | 'kpi'>('perspektif');

  const totalBobotPerspektif = perspektif.reduce((sum, p) => sum + (parseFloat(p.bobot as any) || 0), 0);
  const bobotValid = Math.abs(totalBobotPerspektif - 100) < 0.01;

  const getKpiBobotByPerspektif = (perspektifId: number) => {
    return kpi.filter(k => k.perspektif_id === perspektifId).reduce((sum, k) => sum + (parseFloat(k.bobot as any) || 0), 0);
  };

  const handleSave = async () => {
    setSaving(true);
    setSubmitState({ status: 'loading', message: 'Menyimpan konfigurasi BSC...' });
    try {
      const res = await fetch('/api/settings/bsc', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perspektif, kpi }),
      });
      const j = await res.json();
      if (j.success) {
        setSubmitState({ status: 'success', message: 'Konfigurasi BSC berhasil disimpan!' });
      } else {
        setSubmitState({ status: 'error', message: j.message || 'Gagal menyimpan konfigurasi.' });
      }
    } catch (e: any) {
      setSubmitState({ status: 'error', message: e.message || 'Terjadi kesalahan jaringan.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <span className="material-icons-round text-indigo-600 text-xl">tune</span>
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">Konfigurasi BSC</h2>
                <p className="text-xs text-slate-400 font-medium">Atur bobot, target, dan threshold KPI</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
              <span className="material-icons-round text-slate-400">close</span>
            </button>
          </div>

          {/* Tab */}
          <div className="flex border-b border-slate-200">
            <button onClick={() => setActiveTab('perspektif')} className={`flex-1 py-3 text-sm font-bold text-center transition-all border-b-2 ${activeTab === 'perspektif' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-400'}`}>Bobot Perspektif</button>
            <button onClick={() => setActiveTab('kpi')} className={`flex-1 py-3 text-sm font-bold text-center transition-all border-b-2 ${activeTab === 'kpi' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-400'}`}>Target & Bobot KPI</button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'perspektif' && (
              <div className="flex flex-col gap-4">
                <div className={`text-xs font-bold px-3 py-2 rounded-lg ${bobotValid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  Total Bobot: {totalBobotPerspektif.toFixed(1)}% {bobotValid ? '✓' : '(Harus = 100%)'}
                </div>
                {perspektif.map((p, idx) => (
                  <div key={p.id} className="flex items-center gap-4 bg-slate-50 rounded-xl p-4">
                    <span className="material-icons-round text-slate-500">{p.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-700">{p.nama}</div>
                      <div className="text-xs text-slate-400">{p.nama_singkat}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" step="0.1" min="0" max="100"
                        value={p.bobot}
                        onChange={e => {
                          const next = [...perspektif];
                          next[idx] = { ...next[idx], bobot: e.target.value };
                          setPerspektif(next);
                        }}
                        className="w-20 text-right border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none focus:border-indigo-400"
                      />
                      <span className="text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'kpi' && (
              <div className="flex flex-col gap-6">
                {perspektif.map(p => {
                  const pKpis = kpi.filter(k => k.perspektif_id === p.id);
                  const totalBobot = getKpiBobotByPerspektif(p.id);
                  const bobotOk = Math.abs(totalBobot - 100) < 0.01;
                  return (
                    <div key={p.id} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="material-icons-round text-slate-500 text-lg">{p.icon}</span>
                          <span className="font-bold text-sm text-slate-700">{p.nama_singkat}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bobotOk ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          Σ Bobot: {totalBobot.toFixed(1)}% {bobotOk ? '✓' : '≠ 100%'}
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {pKpis.map(k => {
                          const kIdx = kpi.findIndex(x => x.id === k.id);
                          return (
                            <div key={k.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                              <div className="flex-1 min-w-[140px]">
                                <div className="text-xs font-bold text-slate-700">{k.nama}</div>
                                <div className="text-[10px] text-slate-400">{k.kode.toUpperCase()}</div>
                              </div>
                              <div className="flex items-center gap-1">
                                <label className="text-[10px] font-bold text-slate-400 w-12">Bobot</label>
                                <input type="number" step="0.1" min="0" max="100" value={k.bobot}
                                  onChange={e => { const next = [...kpi]; next[kIdx] = { ...next[kIdx], bobot: e.target.value }; setKpi(next); }}
                                  className="w-16 text-right border border-slate-200 rounded px-1.5 py-1 text-xs font-bold focus:outline-none focus:border-indigo-400"
                                />
                                <span className="text-[10px] text-slate-400">%</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <label className="text-[10px] font-bold text-slate-400 w-12">Target</label>
                                <input type="number" step="0.1" min="0" value={k.target}
                                  onChange={e => { const next = [...kpi]; next[kIdx] = { ...next[kIdx], target: e.target.value }; setKpi(next); }}
                                  className="w-16 text-right border border-slate-200 rounded px-1.5 py-1 text-xs font-bold focus:outline-none focus:border-indigo-400"
                                />
                                <span className="text-[10px] text-slate-400">{k.satuan}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <label className="text-[10px] font-bold text-emerald-500 w-12">Hijau≥</label>
                                <input type="number" step="0.1" value={k.threshold_hijau}
                                  onChange={e => { const next = [...kpi]; next[kIdx] = { ...next[kIdx], threshold_hijau: e.target.value }; setKpi(next); }}
                                  className="w-16 text-right border border-slate-200 rounded px-1.5 py-1 text-xs font-bold focus:outline-none focus:border-emerald-400"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <label className="text-[10px] font-bold text-amber-500 w-12">Kuning≥</label>
                                <input type="number" step="0.1" value={k.threshold_kuning}
                                  onChange={e => { const next = [...kpi]; next[kIdx] = { ...next[kIdx], threshold_kuning: e.target.value }; setKpi(next); }}
                                  className="w-16 text-right border border-slate-200 rounded px-1.5 py-1 text-xs font-bold focus:outline-none focus:border-amber-400"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <div className="flex gap-3 ml-auto">
              <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Batal</button>
              <button onClick={handleSave} disabled={saving || !bobotValid} className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2">
                {saving && <span className="material-icons-round text-[14px] animate-spin">autorenew</span>}
                {saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lottie overlay — loading/success/error */}
      <SubmitOverlay
        status={submitState.status}
        message={submitState.message}
        onClose={() => {
          if (submitState.status === 'success') {
            onSaved();
          } else {
            setSubmitState({ status: 'idle', message: '' });
          }
        }}
      />
    </>
  );
}
