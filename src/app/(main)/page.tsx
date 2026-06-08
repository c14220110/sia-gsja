'use client';
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useSplash } from '@/components/ui/SplashContext';
import { useRouter } from 'next/navigation';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
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

// ── TOP-LEVEL BSC HELPER COMPONENTS ──────────────────────────────────────────
// NOTE: These MUST be defined at file scope, NOT inside DashboardHome.
// Placing them inside a component causes React to remount them on every
// parent state change, which kills the useEffect fetch mid-flight and
// causes sparklines to silently disappear.

// ── Sparkline (SVG custom – avoids Recharts ResponsiveContainer 0px bug) ────
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

  // Require at least 1 real data point; fill nulls with 0 for rendering
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
// Reads the last 2 data points from the trend endpoint to compute MoM delta.
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

  // Determine if the change is "good" based on higherIsBetter
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

  // Compact layout for empty / no-data cards — MUST use self-start in the parent grid
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
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${statusColors.badge}`}>
            <span className="material-icons-round text-[18px] leading-none">{icon}</span>
          </div>
          <p className="text-slate-800 font-extrabold text-[12px] leading-tight tracking-wide">{label}</p>
        </div>
        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${statusColors.badge}`}>
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
// All 4 KPIs are now percentages sharing a single left Y-axis [0–100].
// KPI-3 changed from jiwa (growth count) to % (retention rate) in v2.
function SatelitComparisonChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;

  // Cap all percentage values at 100 to avoid display bugs from bad data
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
// Converts each KPI's value/target into a 0–100% "achievement" then averages
// per perspektif. Weighted overall: Jemaat 35%, Keuangan 25%, Proses 25%, Pembelajaran 15%.
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

// KPIs where LOWER value = better performance
const LOWER_IS_BETTER = new Set(['kpi12']);

function kpiAchievement(kpi: any, key: string): number | null {
  if (!kpi || !kpi.data_tersedia || kpi.nilai === null || kpi.target === null) return null;
  if (LOWER_IS_BETTER.has(key)) {
    return Math.min(100, (kpi.target / Math.max(kpi.nilai, 0.01)) * 100);
  }
  // KPI-2 is on 5-point scale: convert to % (target 4.5 → 90%)
  if (key === 'kpi2') {
    return Math.min(100, (kpi.nilai / 5) * 100);
  }
  return Math.min(100, (kpi.nilai / kpi.target) * 100);
}

function computePerspektifScores(d: any) {
  if (!d) return { scores: {} as Record<PerspektifKey, number | null>, overall: null as number | null };
  const scores: Record<string, number | null> = {};
  let weightedSum = 0;
  let weightSum = 0;
  for (const [pKey, pDef] of Object.entries(BSC_PERSPEKTIF_DEF)) {
    const achievements = pDef.kpis
      .map(k => kpiAchievement(d[k], k))
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
// Matches the existing stat card pattern: bg-white rounded-xl shadow-sm border
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

export default function DashboardHome() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [pendingRoster, setPendingRoster] = useState<any[]>([]); // Jadwal pelayanan yang belum dikonfirmasi
  const [isPelayan, setIsPelayan] = useState(false);             // Apakah jemaat ini terdaftar pelayan?
  const [showLayananSheet, setShowLayananSheet] = useState(false); // Bottom sheet
  const [isFullscreenQR, setIsFullscreenQR] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [scanFeedback, setScanFeedback] = useState<{ isVisible: boolean, type: 'success' | 'error', message: string }>({ isVisible: false, type: 'success', message: '' });
  const [activeSurveys, setActiveSurveys] = useState<any[]>([]);
  const [surveyHistory, setSurveyHistory] = useState<any[]>([]);
  const [showBscDashboard, setShowBscDashboard] = useState(false);
  const [hasEventToday, setHasEventToday] = useState(false);

  // Hydrate states synchronously before paint to prevent blink/flash during client-side navigation
  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;
  useIsomorphicLayoutEffect(() => {
    if (typeof window !== 'undefined') {
      const cachedUser = localStorage.getItem('gsja_user_data');
      if (cachedUser) {
         setUserData(JSON.parse(cachedUser));
         const cachedEvent = localStorage.getItem('gsja_upcoming_events');
         if (cachedEvent) setUpcomingEvents(JSON.parse(cachedEvent));
         const cachedSurveys = localStorage.getItem('gsja_active_surveys');
         if (cachedSurveys) setActiveSurveys(JSON.parse(cachedSurveys));
         const cachedRoster = localStorage.getItem('gsja_pending_roster');
         if (cachedRoster) setPendingRoster(JSON.parse(cachedRoster));
         setIsInitialLoading(false);
      }
    }
  }, []);

  // Pull-To-Refresh states
  const [pullDist, setPullDist] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    const mainNode = document.querySelector('main');
    if (mainNode && mainNode.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current > 0) {
      const dist = e.touches[0].clientY - touchStartY.current;
      if (dist > 0) {
        setPullDist(Math.min(dist * 0.45, 80));
      } else {
        setPullDist(0);
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDist >= 60 && !isRefreshing) {
      setIsRefreshing(true);
      setPullDist(60);
      // Trigger refresh
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      setPullDist(0);
      touchStartY.current = 0;
    }
  };
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<number, { skor?: number, jawaban_teks?: string }>>({});
  const { showLoader, hideLoader } = useLoader();
  const { signalAppReady } = useSplash();

  const [isOnline, setIsOnline] = useState(true);

  // ── BSC Executive Dashboard ───────────────────────────────────────────────
  const [bscData, setBscData]       = useState<any>(null);
  const [satelitComparisonData, setSatelitComparisonData] = useState<any[] | null>(null);
  const [loadingBsc, setLoadingBsc] = useState(false);
  const [satelitList, setSatelitList] = useState<{ id: number; nama_satelit: string }[]>([]);
  const [bscTab, setBscTab] = useState<'overview' | 'detail'>('overview');
  const [selectedPerspektif, setSelectedPerspektif] = useState<'jemaat' | 'keuangan' | 'proses' | 'pembelajaran'>('jemaat');
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // ── Scanner Trigger Listener ──────────────────────────────────────────────
  useEffect(() => {
    const handleOpenScanner = () => setIsFullscreenQR(true);
    window.addEventListener('openScanner', handleOpenScanner);
    
    // Check if redirected with ?action=scan
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'scan') {
      setIsFullscreenQR(true);
      router.replace(window.location.pathname);
    }
    
    return () => window.removeEventListener('openScanner', handleOpenScanner);
  }, [router]);

  useEffect(() => {
    let loaderTimer: NodeJS.Timeout | null = null;
    const initData = async () => {
       const hasCache = !!localStorage.getItem('gsja_user_data');
       // Hanya munculkan loader JIKA belum ada cache sama sekali (data belum tersedia di layar)
       if (!hasCache) {
          loaderTimer = setTimeout(() => showLoader(), 350);
       }
       try {
         // Coba ambil data terbaru saat online
         const resAuth = await fetch('/api/auth/me');
         if (resAuth.ok) {
           const uData = await resAuth.json();
           setUserData(uData);
           localStorage.setItem('gsja_user_data', JSON.stringify(uData)); // Simpan Cache

           // ── BSC fetch untuk Super Admin & Majelis ──────────────────────
           const isExec = uData?.is_super_admin || uData?.role_name === 'MAJELIS';
           if (isExec) {
             setLoadingBsc(true);
             try {
               const [resBsc, resSatelit] = await Promise.all([
                 fetch(`/api/dashboard/bsc?dari=${bscFilter.dari}&sampai=${bscFilter.sampai}`),
                 fetch('/api/settings/organisasi?tab=satelit'),
               ]);
               if (resBsc.ok) {
                 const j = await resBsc.json();
                 if (j.success) {
                   setBscData(j.data);
                   setSatelitComparisonData(j.satelit_comparison ?? null);
                 }
               }
               if (resSatelit.ok) {
                 const j = await resSatelit.json();
                 if (j.success) setSatelitList(j.satelit_list ?? []);
               }
             } catch (e) { console.error('BSC fetch error', e); }
             finally { setLoadingBsc(false); }
           }

           if (uData?.role_name?.toLowerCase() === 'jemaat') {
              // mode=publik: bypass RBAC satelit, tampilkan semua kegiatan yang is_published
              // Exclude 'Ibadah Rutin' agar hanya tampil kegiatan spesial/event
              const q = new URLSearchParams({
                limit: '20',
                status: 'Akan Datang',
                tanggal: 'Semua',
                mode: 'publik',
              });
              
              // Fetch events, user's tickets, active surveys, and survey history in parallel
              const [resEv, resTiket, resSurvei, resRiwayat, resToday] = await Promise.all([
                 fetch(`/api/kegiatan?${q.toString()}`),
                 fetch('/api/kegiatan/registrasi/saya'),
                 fetch('/api/survei/saya'),
                 fetch('/api/survei/saya/riwayat'),
                 fetch(`/api/kegiatan?${new URLSearchParams({ limit: '1', tanggal: 'Hari Ini', mode: 'publik' }).toString()}`)
              ]);

              if (resEv.ok && resTiket.ok) {
                 const reqData = await resEv.json();
                 const tiketData = await resTiket.json();
                 
                 const myTickets = tiketData.success ? tiketData.data : [];

                 if (reqData.success && reqData.data.length === 0) {
                    // Tidak ada kegiatan dari API — clear cache lama supaya tidak stale
                    setUpcomingEvents([]);
                    localStorage.setItem('gsja_upcoming_events', JSON.stringify([]));
                 } else if (reqData.success && reqData.data.length > 0) {
                    // Filter: exclude kategori 'Ibadah Rutin' — tampilkan event, perayaan, edukasi, dll
                    const nonRutinEvents = reqData.data
                      .filter((e: any) => (e.kategori || '') !== 'Ibadah Rutin')
                      .slice(0, 6);

                    const mappedEvents = nonRutinEvents.map((evt: any) => {
                       const tiket = myTickets.find((t: any) => t.kegiatan_id === evt.id);
                       if (tiket) {
                          let badgeStyle = "bg-amber-100/90 text-amber-700 border-amber-200/50";
                          let badgeText = "MENUNGGU BAYAR";
                          if (tiket.is_checked_in) {
                             badgeStyle = "bg-indigo-100/90 text-indigo-700 border-indigo-200/50";
                             badgeText = "HADIR";
                          } else if (tiket.status_pembayaran === 'Paid') {
                             badgeStyle = "bg-emerald-100/90 text-emerald-700 border-emerald-200/50";
                             badgeText = "LUNAS";
                          } else if (tiket.url_bukti_bayar) {
                             badgeStyle = "bg-blue-100/90 text-blue-700 border-blue-200/50";
                             badgeText = "MENUNGGU VERIF";
                          }
                          return { ...evt, _myTicketBadge: { text: badgeText, style: badgeStyle } };
                       }
                       return evt;
                    });

                    setUpcomingEvents(mappedEvents);
                    localStorage.setItem('gsja_upcoming_events', JSON.stringify(mappedEvents));
                 }
              }

              if (resSurvei.ok) {
                 const surveiData = await resSurvei.json();
                 if (surveiData.success) {
                    setActiveSurveys(surveiData.data);
                    localStorage.setItem('gsja_active_surveys', JSON.stringify(surveiData.data));
                 }
              }

              if (resRiwayat.ok) {
                 const riwayatData = await resRiwayat.json();
                 if (riwayatData.success) {
                    setSurveyHistory(riwayatData.data);
                 }
              }

              if (resToday.ok) {
                 const todayData = await resToday.json();
                 if (todayData.success && todayData.data && todayData.data.length > 0) {
                    setHasEventToday(true);
                 }
              }

             // Cek jadwal pelayanan yang belum dikonfirmasi (untuk banner & badge)
             const resRoster = await fetch('/api/pelayan/jadwal-saya');
             if (resRoster.ok) {
               const rosterData = await resRoster.json();
               if (rosterData.success) {
                 setIsPelayan(rosterData.is_pelayan);
                  if (rosterData.total > 0) {
                    setPendingRoster(rosterData.pending);
                    localStorage.setItem('gsja_pending_roster', JSON.stringify(rosterData.pending));
                  } else {
                    setPendingRoster([]);
                    localStorage.removeItem('gsja_pending_roster');
                  }
               }
             }
           }
         }
       } catch (err) {
          console.error('Mode Offline terdeteksi:', err);
          
          // JIKA OFFLINE (Fetch Gagal), BONGKAR CACHE DARI LOCAL STORAGE
          const cachedUser = localStorage.getItem('gsja_user_data');
          if (cachedUser) {
             setUserData(JSON.parse(cachedUser));
          }
          
          const cachedEvent = localStorage.getItem('gsja_upcoming_events');
          if (cachedEvent) {
             setUpcomingEvents(JSON.parse(cachedEvent));
          }

          const cachedSurveys = localStorage.getItem('gsja_active_surveys');
          if (cachedSurveys) {
             setActiveSurveys(JSON.parse(cachedSurveys));
          }
       } finally {
          if (loaderTimer) clearTimeout(loaderTimer);
          hideLoader();
          setIsInitialLoading(false);
          signalAppReady(); // ← Dismiss splash screen setelah semua API selesai
       }
    };
    initData();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(dateString));
  };

  const handleScan = async (detectedCodes: any[]) => {
    if (!detectedCodes || detectedCodes.length === 0) return;
    const rawValue = detectedCodes[0].rawValue;
    if (!rawValue) return;

    // Hindari scan berkali-kali jika loader/feedback sedang aktif
    if (scanFeedback.isVisible) return; 

    try {
      showLoader();
      const decodedStr = atob(rawValue);
      const payload = JSON.parse(decodedStr);

      if (!payload.k || !payload.exp) throw new Error('Format QR tidak valid');
      
      if (Date.now() > payload.exp) {
         setScanFeedback({ isVisible: true, type: 'error', message: 'QR Code Kadaluarsa! Mohon Usher memperbarui layar.' });
         hideLoader();
         setTimeout(() => setScanFeedback(prev => ({ ...prev, isVisible: false })), 4000);
         return;
      }

      // Hit API Absensi
      const res = await fetch(`/api/kegiatan/${payload.k}/absensi`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            action_type: 'qr_scan',
            id_jemaat: userData.jemaat_id
         })
      });

      const result = await res.json();
      
      if (res.ok && result.success) {
         setScanFeedback({ isVisible: true, type: 'success', message: result.message || 'Presensi Berhasil Dicatat!' });
         setTimeout(() => {
            setScanFeedback(prev => ({ ...prev, isVisible: false }));
            setIsFullscreenQR(false); // Otomatis tutup scanner setelah sukses 2 detik
         }, 3000);
      } else {
         setScanFeedback({ isVisible: true, type: 'error', message: result.message || 'Gagal memproses absensi.' });
         setTimeout(() => setScanFeedback(prev => ({ ...prev, isVisible: false })), 4000);
      }
    } catch (err) {
      setScanFeedback({ isVisible: true, type: 'error', message: 'QR Code Rusak Ditolak: Bukan milik Acara GSJA.' });
      setTimeout(() => setScanFeedback(prev => ({ ...prev, isVisible: false })), 4000);
    } finally {
      hideLoader();
    }
  };

  // Klik tombol "Jadwal Pelayanan" — routing cerdas
  const handleJadwalPelayananClick = () => {
    // DEBUG: cek nilai isPelayan saat tombol diklik
    console.log('[JadwalSaya-UI] isPelayan saat diklik =', isPelayan);
    if (isPelayan) {
      router.push('/pelayan/jadwal');
    } else {
      setShowLayananSheet(true);
    }
  };

  // --- TAMPILAN JEMAAT (PWA SUPER APP) ---
  if (userData?.role_name?.toLowerCase() === 'jemaat') {
    const jemaatName = userData.email?.split('@')[0] || 'Jemaat';
    const qrPayload = JSON.stringify({ type: 'JEMAAT', id: userData.jemaat_id });

    return (
      <div className="w-full h-full flex flex-col bg-slate-50 overflow-y-auto">
        
        {/* ── BOTTOM SHEET: Jadwal Pelayanan ── */}
        {showLayananSheet && (
          <div className="fixed inset-0 z-[9998] flex flex-col justify-end" onClick={() => setShowLayananSheet(false)}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />

            {/* Sheet Panel */}
            <div
              className="relative bg-white rounded-t-3xl px-6 pt-3 pb-10 animate-in slide-in-from-bottom-4 duration-300"
              onClick={e => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="w-10 h-1.5 rounded-full bg-slate-200 mx-auto mb-6" />

              {isPelayan ? (
                /* ── Pelayan terdaftar: tampilkan jadwal ── */
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                    <span className="material-icons-round text-emerald-600 text-4xl">assignment_ind</span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 text-center mb-1">Jadwal Pelayanan Anda</h2>
                  {pendingRoster.length > 0 ? (
                    <div className="w-full mt-4 flex flex-col gap-3">
                      {pendingRoster.map((r: any) => (
                        <div key={r.roster_id} className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-3">
                          <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-amber-600 text-[18px]">event</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate">{r.nama_kegiatan}</p>
                            <p className="text-xs text-amber-700 font-medium">{r.nama_peran}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{r.tanggal_mulai?.substring(0,10)} · {r.waktu_mulai?.substring(0,5)} WIB</p>
                          </div>
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full h-fit mt-1 whitespace-nowrap">Menunggu Konfirmasi</span>
                        </div>
                      ))}
                      <p className="text-xs text-slate-400 text-center mt-1">Fitur konfirmasi via HP segera hadir 🚀</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center mt-2">Tidak ada jadwal yang perlu dikonfirmasi saat ini. Tetap semangat melayani! 🙌</p>
                  )}
                </div>
              ) : (
                /* ── Bukan pelayan: tampilkan ajakan melayani ── */
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-blue-50 rounded-3xl flex items-center justify-center mb-5 shadow-inner">
                    <span className="material-icons-round text-indigo-500 text-5xl">volunteer_activism</span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 mb-2">Panggilan Untuk Melayani! 🙌</h2>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-[300px]">
                    Shalom! Saat ini Anda belum terdaftar dalam tim pelayanan GSJA.
                  </p>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-[300px] mt-2">
                    Tuhan memanggil kita untuk tidak hanya menjadi jemaat, tetapi juga melayani ladang-Nya.
                    Mari temukan potensi Anda dan bergabunglah bersama tim pelayan kami!
                  </p>
                  <a
                    href={`https://wa.me/6287808786143?text=${encodeURIComponent('Shalom, saya ingin bertanya cara bergabung menjadi pelayan di GSJA 🙏')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 w-full flex items-center justify-center gap-2.5 py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-emerald-500/30"
                  >
                    <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Hubungi Kami via WhatsApp
                  </a>
                  <button
                    onClick={() => setShowLayananSheet(false)}
                    className="mt-3 text-xs text-slate-400 font-medium py-2"
                  >
                    Tutup
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fullscreen Camera Scanner Context */}
        {isFullscreenQR && typeof window !== 'undefined' && createPortal(
          <div className="fixed inset-0 bg-slate-900 z-[9999] flex flex-col items-center justify-center animate-in zoom-in-95 duration-200 w-screen" style={{ height: '100dvh' }}>
             
             {/* Header Scanner */}
             <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-slate-900/80 to-transparent">
               <button onClick={() => setIsFullscreenQR(false)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white backdrop-blur-sm border border-white/20">
                 <span className="material-icons-round">close</span>
               </button>
               <h2 className="text-white font-bold text-lg tracking-wider">Scan Kehadiran</h2>
               <div className="w-10"></div>
             </div>

             {/* Feedback Overlay */}
             {scanFeedback.isVisible && (
                <div className="absolute top-24 left-6 right-6 z-20 animate-in slide-in-from-top-4">
                  <div className={`p-4 rounded-2xl flex items-center gap-3 shadow-2xl border ${scanFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                    <span className="material-icons-round text-3xl">{scanFeedback.type === 'success' ? 'check_circle' : 'error'}</span>
                    <span className="font-bold text-sm leading-tight">{scanFeedback.message}</span>
                  </div>
                </div>
             )}

             {/* Scanner Area */}
             <div className="w-full flex-1 flex items-center justify-center relative overflow-hidden bg-black">
                <Scanner 
                  onScan={handleScan}
                  formats={['qr_code']}
                  styles={{ container: { width: '100%', height: '100%' } }}
                  components={{ finder: true }}
                />
             </div>
             
             {/* Footer Scanner */}
             <div className="absolute bottom-0 left-0 right-0 p-8 pb-12 text-center bg-gradient-to-t from-slate-900/90 to-transparent pointer-events-none">
                <p className="text-white/80 font-medium text-sm">Arahkan layar ke QR Code Acara yang ditampilkan oleh Usher di pintu.</p>
             </div>
          </div>,
          document.body
        )}

        {/* PULL TO REFRESH BACKGROUND (Top Bar Melebar) */}
        <div 
          className="absolute top-0 left-0 right-0 bg-white flex items-end justify-center z-0 overflow-hidden"
          style={{ 
            height: Math.max(0, pullDist), 
            transition: pullDist === 0 ? 'height 0.3s ease-out' : 'none'
          }}
        >
           <div 
             className={`mb-4 text-blue-500 ${isRefreshing ? 'animate-spin' : ''}`}
             style={{ 
                opacity: Math.min(pullDist / 50, 1),
                transform: isRefreshing ? 'scale(1)' : `rotate(${pullDist * 4}deg) scale(${Math.min(pullDist / 50, 1)})`
             }}
           >
              <span className="material-icons-round text-3xl">refresh</span>
           </div>
        </div>

        {/* MOVING WRAPPER */}
        <div 
          className="w-full flex flex-col relative z-10 pb-10"
          style={{ 
            transform: `translateY(${pullDist}px)`,
            transition: pullDist === 0 ? 'transform 0.3s ease-out' : 'none'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
        {/* 1. HEADER PAGE */}
        <div className="w-full px-6 pt-4 pb-3 bg-white flex justify-between items-center z-10 relative">
           <div className="flex flex-col gap-0.5">
              <h1 className={`font-black text-slate-900 tracking-tight ${jemaatName.length > 12 ? 'text-lg' : 'text-xl'}`}>Shalom, {jemaatName}! 👋</h1>
              <div className="flex items-center gap-1 text-slate-500">
                 <span className="material-icons-round text-[12px]">location_on</span>
                 <span className="text-[11px] font-medium">{userData.satelit_name || 'Satelit GSJA'}</span>
              </div>
           </div>
           
           <Link href={`/profil`} className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center shadow-inner border border-blue-100 overflow-hidden shrink-0">
             {userData?.foto_url ? (
               <img src={userData.foto_url} alt="profil" className="w-full h-full object-cover" />
             ) : (
               <span className="material-icons-round text-blue-500 text-2xl">person</span>
             )}
           </Link>
        </div>

        {/* 2. HERO BANNER (CAROUSEL) - EDGE TO EDGE */}
        <HeroCarousel />

        {/* PITA PERINGATAN OFFLINE (Biar elegan dinonaktifkan / warning fitur jika tdk ada sinyal) */}
        {!isOnline && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 shadow-sm">
             <span className="material-icons-round text-amber-500 mt-0.5">signal_wifi_off</span>
             <p className="text-xs text-amber-700 font-medium leading-relaxed">
               <strong className="block mb-0.5">Anda sedang Offline.</strong>
               Menampilkan data terakhir (cached). Fitur pemindai dan pembaruan akan dinonaktifkan, namun fitur ganti role, lihat riwayat, dan lihat/scan kartu QR Anda (tombol tengah bawah) dijamin 100% tetap bisa berjalan!
             </p>
          </div>
        )}

        <div className="w-full px-6 flex flex-col gap-5 pb-12 mt-4">
           
           {/* ── NOTIFICATION CARDS (stacked tight) ── */}
           {(pendingRoster.length > 0 || activeSurveys.length > 0) && (
             <>
             <style>{`
              @keyframes notif-wiggle {
                0%, 100% { transform: rotate(0deg); }
                15% { transform: rotate(-12deg); }
                30% { transform: rotate(10deg); }
                45% { transform: rotate(-8deg); }
                60% { transform: rotate(5deg); }
                75% { transform: rotate(-3deg); }
                90% { transform: rotate(0deg); }
              }
            `}</style>
            <div className="flex flex-col gap-2 animate-in slide-in-from-top-3 fade-in">
               {/* Konfirmasi Jadwal */}
               {pendingRoster.length > 0 && (
                 <div className="w-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl px-3 py-2.5 shadow-sm">
                   <div className="flex items-center gap-2">
                     <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                       <span className="material-icons-round text-amber-600 text-[18px]">assignment_late</span>
                     </div>
                     <div className="flex-1 min-w-0">
                       <p className="text-[13px] font-black text-amber-900 leading-tight">
                         Konfirmasi Jadwal{pendingRoster.length > 1 ? ` (${pendingRoster.length})` : ''}
                       </p>
                       <p className="text-[11px] text-amber-700 truncate">
                         {pendingRoster[0].nama_peran} · {pendingRoster[0].nama_kegiatan}
                       </p>
                     </div>
                     <button
                       onClick={() => router.push('/pelayan/jadwal')}
                       className="w-7 h-7 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center justify-center shrink-0 transition-colors"
                       title="Konfirmasi"
                       style={{ animation: 'notif-wiggle 2s ease-in-out infinite' }}
                     >
                       <span className="material-icons-round text-[16px]">how_to_reg</span>
                     </button>
                     <button
                       onClick={() => { setPendingRoster([]); localStorage.removeItem('gsja_pending_roster'); }}
                       className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-amber-100 text-amber-400 hover:text-amber-600 shrink-0 transition-colors -mr-0.5"
                       title="Tutup"
                     >
                       <span className="material-icons-round text-[14px]">close</span>
                     </button>
                   </div>
                 </div>
               )}

               {/* Survei Menunggu */}
               {activeSurveys.length > 0 && (
                 <div className="w-full bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl px-3 py-2.5 shadow-sm">
                   <div className="flex items-center gap-2">
                     <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                       <span className="material-icons-round text-indigo-600 text-[18px]">quiz</span>
                     </div>
                     <div className="flex-1 min-w-0">
                       <p className="text-[13px] font-black text-indigo-900 leading-tight">
                         Survei Menunggu{activeSurveys.length > 1 ? ` (${activeSurveys.length})` : ''}
                       </p>
                       <p className="text-[11px] text-indigo-600 truncate">
                         {activeSurveys.length === 1
                           ? activeSurveys[0].judul
                           : `${activeSurveys.length} survei belum diisi`}
                       </p>
                     </div>
                     <button
                       onClick={() => router.push('/survei-saya')}
                       className="w-7 h-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center shrink-0 transition-colors"
                       title="Isi Survei"
                       style={{ animation: 'notif-wiggle 2s ease-in-out 0.5s infinite' }}
                     >
                       <span className="material-icons-round text-[16px]">edit_note</span>
                     </button>
                     <button
                       onClick={() => setActiveSurveys([])}
                       className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 shrink-0 transition-colors -mr-0.5"
                       title="Tutup"
                     >
                       <span className="material-icons-round text-[14px]">close</span>
                     </button>
                   </div>
                 </div>
               )}
             </div>
             </>
           )}

           {/* QR SCANNER CARD (Temporarily Hidden)
            <div 
              onClick={() => setIsFullscreenQR(true)}
              className="w-full bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 rounded-3xl shadow-lg shadow-blue-500/30 relative overflow-hidden cursor-pointer group transition-all active:scale-95 p-4 flex items-center gap-4"
            >
               <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
               <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-sky-300/20 rounded-full blur-2xl pointer-events-none"></div>
               
               <div className="w-14 h-14 bg-white/20 backdrop-blur-md border border-white/40 rounded-2xl shadow-inner z-10 flex items-center justify-center group-hover:bg-white/30 transition-colors pointer-events-none shrink-0 p-1">
                  <div className="w-full h-full text-white pointer-events-none mix-blend-plus-lighter opacity-90 group-hover:scale-110 transition-transform">
                    <DotLottieReact src="/assets/qr-code-scan.lottie" loop autoplay />
                  </div>
               </div>
               <div className="flex flex-col z-10">
                  <h2 className="text-white font-black text-lg tracking-tight leading-tight">Pindai Kehadiran</h2>
                  <p className="text-blue-100 text-[11px] font-medium opacity-90 mt-0.5">
                     Ketuk untuk scan QR kehadiran
                  </p>
               </div>
               <span className="material-icons-round text-white/50 z-10 ml-auto group-hover:text-white transition-colors">chevron_right</span>
            </div>
           */}

            {/* 3. QUICK ACTIONS — Grid */}
            <div className="w-full flex flex-col gap-2.5">
               <h3 className="text-slate-800 font-black text-lg tracking-tight px-1">Menu</h3>
               <div className="grid grid-cols-3 gap-y-4 gap-x-2 w-full">
                  <Link href="/layanan-pastoral" className="flex flex-col items-center gap-1.5 group cursor-pointer">
                     <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full shadow-[0_4px_12px_rgba(59,130,246,0.3)] flex items-center justify-center text-white active:scale-105 transition-all duration-200">
                        <span className="material-icons-round text-2xl">support_agent</span>
                     </div>
                     <span className="text-[11px] font-medium text-slate-700 text-center leading-tight">Layanan<br/>Pastoral</span>
                  </Link>
                  
                  <div onClick={handleJadwalPelayananClick} className="flex flex-col items-center gap-1.5 group cursor-pointer">
                      <div className="relative w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full shadow-[0_4px_12px_rgba(59,130,246,0.3)] flex items-center justify-center text-white active:scale-105 transition-all duration-200">
                         {pendingRoster.length > 0 && (
                           <span className="absolute -top-1 -right-0.5 z-10 min-w-[16px] h-[16px] bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-sm border-[1.5px] border-white">{pendingRoster.length}</span>
                         )}
                         <span className="material-icons-round text-2xl">event_available</span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-700 text-center leading-tight">Jadwal<br/>Pelayanan</span>
                   </div>

                  <Link href="/riwayat-kehadiran" className="flex flex-col items-center gap-1.5 group cursor-pointer">
                     <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full shadow-[0_4px_12px_rgba(59,130,246,0.3)] flex items-center justify-center text-white active:scale-105 transition-all duration-200">
                        <span className="material-icons-round text-2xl">fact_check</span>
                     </div>
                     <span className="text-[11px] font-medium text-slate-700 text-center leading-tight">Riwayat<br/>Kehadiran</span>
                  </Link>

                  <Link href="/tiket" className="flex flex-col items-center gap-1.5 group cursor-pointer">
                     <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full shadow-[0_4px_12px_rgba(59,130,246,0.3)] flex items-center justify-center text-white active:scale-105 transition-all duration-200">
                        <span className="material-icons-round text-2xl">confirmation_number</span>
                     </div>
                     <span className="text-[11px] font-medium text-slate-700 text-center leading-tight">Tiket<br/>Saya</span>
                  </Link>

                  <Link href="/survei-saya" className="flex flex-col items-center gap-1.5 group cursor-pointer">
                     <div className="relative w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full shadow-[0_4px_12px_rgba(59,130,246,0.3)] flex items-center justify-center text-white active:scale-105 transition-all duration-200">
                        {activeSurveys.length > 0 && (
                          <span className="absolute -top-1 -right-0.5 z-10 min-w-[16px] h-[16px] bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-sm border-[1.5px] border-white">{activeSurveys.length}</span>
                        )}
                        <span className="material-icons-round text-2xl">assignment</span>
                     </div>
                     <span className="text-[11px] font-medium text-slate-700 text-center leading-tight">Survei<br/>Saya</span>
                  </Link>
                  
                  <Link href="/alkitab" className="flex flex-col items-center gap-1.5 group cursor-pointer">
                     <div className="relative w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full shadow-[0_4px_12px_rgba(59,130,246,0.3)] flex items-center justify-center text-white active:scale-105 transition-all duration-200">
                        <span className="absolute -top-1.5 -right-2 z-10 bg-red-600 text-white text-[8px] font-bold rounded-full px-1.5 py-0.5 shadow-sm border-[1.5px] border-white">New</span>
                        <span className="material-icons-round text-2xl">menu_book</span>
                     </div>
                     <span className="text-[11px] font-medium text-slate-700 text-center leading-tight">Alkitab</span>
                  </Link>
                </div>
            </div>



           {/* 5. DYNAMIC WIDGET (Upcoming Events Carousel) */}
           <div className="w-full flex flex-col gap-3">
              <h3 className="text-slate-800 font-black text-lg tracking-tight px-1 flex items-center justify-between">
                 Kegiatan Mendatang
                 <Link href="/jadwal" className="text-blue-500 font-bold text-xs flex items-center">Lihat Semua <span className="material-icons-round text-[14px]">chevron_right</span></Link>
              </h3>
              
               {upcomingEvents.length > 0 ? (
                 <div className="relative w-[calc(100%+3rem)] -ml-6">
                    {/* Visual cue shadow/fade di kanan untuk menandakan bisa di-scroll */}
                    <div className="absolute top-0 bottom-0 right-0 w-12 bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none"></div>
                    <div className="w-full px-6 pb-4 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 items-stretch">
                       {upcomingEvents.map((evt) => (
                         <Link key={evt.id} href={`/jadwal/${evt.id}`} className="snap-center shrink-0 w-[280px] bg-white rounded-3xl flex flex-col shadow-sm border border-slate-100 relative overflow-hidden group">
                            {evt.url_banner ? (
                              <div className="w-full h-32 bg-slate-100 relative overflow-hidden shrink-0 border-b border-slate-100">
                                <img src={evt.url_banner} alt="Poster" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                {evt._myTicketBadge ? (
                                   <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-1 rounded shadow-sm backdrop-blur border ${evt._myTicketBadge.style}`}>{evt._myTicketBadge.text}</span>
                                ) : evt.butuh_registrasi && (
                                   <span className="absolute top-3 right-3 bg-white/90 backdrop-blur text-blue-600 text-[10px] font-bold px-2 py-1 rounded shadow-sm">Butuh Registrasi</span>
                                )}
                              </div>
                            ) : (() => {
                               // Smart thumbnail fallback berdasarkan jenis kegiatan
                               const kn = (evt.nama_jenis_kegiatan || '').toLowerCase();
                               const kat = (evt.kategori || '').toLowerCase();
                               let bg = 'from-indigo-500 to-blue-600', icon = 'church';
                               if (kn.includes('kkr') || kn.includes('kebangunan')) { bg = 'from-orange-500 to-red-500'; icon = 'local_fire_department'; }
                               else if (kn.includes('camp') || kn.includes('retreat')) { bg = 'from-green-500 to-emerald-600'; icon = 'forest'; }
                               else if (kn.includes('seminar') || kn.includes('pelatihan') || kn.includes('webinar')) { bg = 'from-purple-500 to-violet-600'; icon = 'school'; }
                               else if (kn.includes('pernikahan')) { bg = 'from-pink-500 to-rose-600'; icon = 'favorite'; }
                               else if (kn.includes('baptisan')) { bg = 'from-sky-400 to-blue-500'; icon = 'water_drop'; }
                               else if (kn.includes('penyerahan anak')) { bg = 'from-yellow-400 to-amber-500'; icon = 'child_care'; }
                               else if (kn.includes('kesehatan') || kn.includes('medis')) { bg = 'from-teal-400 to-cyan-600'; icon = 'medical_services'; }
                               else if (kn.includes('ibadah padang') || kn.includes('outing')) { bg = 'from-lime-500 to-green-600'; icon = 'nature_people'; }
                               else if (kn.includes('perayaan') || kn.includes('natal') || kn.includes('paskah') || kn.includes('khusus')) { bg = 'from-amber-400 to-orange-500'; icon = 'celebration'; }
                               else if (kn.includes('besuk') || kn.includes('kunjungan') || kat.includes('sosial')) { bg = 'from-rose-400 to-pink-600'; icon = 'volunteer_activism'; }
                               else if (kat.includes('sakramen') || kn.includes('pemberkatan')) { bg = 'from-violet-500 to-purple-700'; icon = 'auto_awesome'; }
                               return (
                                 <div className={`w-full h-28 bg-gradient-to-br ${bg} relative overflow-hidden shrink-0 flex flex-col items-center justify-center gap-1.5`}>
                                   <div className="absolute inset-0 bg-black/10 pointer-events-none" />
                                   <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shadow-lg z-10">
                                     <span className="material-icons-round text-white text-3xl">{icon}</span>
                                   </div>
                                   <span className="text-white/90 text-[10px] font-bold uppercase tracking-widest z-10 px-3 text-center leading-tight line-clamp-1">
                                     {evt.nama_jenis_kegiatan}
                                   </span>
                                   {(evt._myTicketBadge || evt.butuh_registrasi) && (
                                     <span className={`absolute top-2.5 right-2.5 text-[9px] font-bold px-2 py-0.5 rounded shadow-sm backdrop-blur border ${evt._myTicketBadge ? evt._myTicketBadge.style : 'bg-white/90 text-blue-600 border-white/50'}`}>
                                       {evt._myTicketBadge ? evt._myTicketBadge.text : 'REGISTRASI'}
                                     </span>
                                   )}
                                 </div>
                               );
                             })()}
                            
                            <div className="p-5 flex flex-col flex-1">
                              {!evt.url_banner && (
                                 <div className="mb-2">
                                   {evt._myTicketBadge ? (
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border ${evt._myTicketBadge.style}`}>{evt._myTicketBadge.text}</span>
                                   ) : evt.butuh_registrasi && (
                                      <span className="bg-blue-50 text-blue-600 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border border-blue-100">REGISTRASI</span>
                                   )}
                                 </div>
                              )}
                              <h4 className="text-slate-900 font-black text-[15px] leading-snug mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">{evt.nama_kegiatan}</h4>
                              
                              <div className="flex flex-col gap-1.5 mb-4">
                                 <div className="flex items-center gap-2 text-slate-500 text-[11px] font-medium">
                                    <span className="material-icons-round text-[14px] text-slate-400">calendar_today</span>
                                    <span className="truncate">{formatDate(evt.tanggal_mulai)}</span>
                                 </div>
                                 <div className="flex items-center gap-2 text-slate-500 text-[11px] font-medium">
                                    <span className="material-icons-round text-[14px] text-slate-400">place</span>
                                    <span className="truncate">{evt.lokasi_kegiatan || 'Gedung GSJA'}</span>
                                 </div>
                              </div>
    
                              <div className="mt-auto pt-3 border-t border-slate-100/60 flex items-center justify-between pointer-events-none">
                                 <span className="text-[11px] font-bold text-slate-400">{evt.waktu_mulai.slice(0,5)} WIB</span>
                                 <span className="material-icons-round text-slate-300 text-[18px] group-hover:text-blue-500 transition-colors">arrow_forward</span>
                              </div>
                            </div>
                         </Link>
                       ))}
                       <div className="w-2 shrink-0"></div> {/* Trailing spacer */}
                    </div>
                 </div>
              ) : (
                 <div className="w-full bg-slate-100/50 rounded-3xl p-6 flex flex-col items-center justify-center text-center border border-slate-200 border-dashed">
                    <span className="material-icons-round text-4xl text-slate-300 mb-2">event_available</span>
                    <span className="text-sm font-bold text-slate-500">Belum Ada Acara Mendatang</span>
                 </div>
              )}
           </div>

         </div>

         </div>
        
         {/* Modal Isi Survei */}
         {isSurveyModalOpen && selectedSurvey && (
            <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex flex-col justify-end" onClick={() => setIsSurveyModalOpen(false)}>
               <div className="w-full bg-white rounded-t-3xl p-6 pb-32 flex flex-col animate-in slide-in-from-bottom max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
                  
                  <div className="flex justify-between items-start gap-4 mb-2">
                     <h3 className="text-2xl font-black text-slate-800 tracking-tight">{selectedSurvey.judul}</h3>
                     <button onClick={() => setIsSurveyModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <span className="material-icons-round">close</span>
                     </button>
                  </div>
                  <p className="text-sm text-slate-500 mb-6">
                     {selectedSurvey.deskripsi || 'Silakan isi survei singkat ini untuk membantu kami meningkatkan kualitas pelayanan.'}
                  </p>

                  <div className="flex flex-col gap-6">
                     {selectedSurvey.pertanyaan.map((q: any, idx: number) => (
                        <div key={q.id} className="flex flex-col gap-3">
                           <label className="text-sm font-bold text-slate-700 leading-snug flex gap-2">
                              <span className="text-blue-500 font-extrabold">{idx + 1}.</span>
                              {q.teks_pertanyaan}
                              {q.is_required && <span className="text-rose-500">*</span>}
                           </label>

                           {q.tipe_jawaban === 'skala' ? (
                              <div className="flex items-center justify-between px-2 py-1">
                                 {[1, 2, 3, 4, 5].map((val) => {
                                    const currentSkor = surveyAnswers[q.id]?.skor || 5;
                                    const isActive = val <= currentSkor;
                                    return (
                                       <button
                                          key={val}
                                          type="button"
                                          onClick={() => {
                                             setSurveyAnswers(prev => ({
                                                ...prev,
                                                [q.id]: { ...prev[q.id], skor: val }
                                             }));
                                          }}
                                          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
                                       >
                                          <span className={`material-icons-round text-3xl ${isActive ? 'text-amber-400' : 'text-slate-200'}`}>star</span>
                                          <span className="text-[10px] font-bold text-slate-400">{val}</span>
                                       </button>
                                    );
                                 })}
                              </div>
                           ) : (
                              <textarea
                                 rows={3}
                                 className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm resize-none"
                                 placeholder="Tuliskan masukan Anda di sini..."
                                 value={surveyAnswers[q.id]?.jawaban_teks || ''}
                                 onChange={(e) => {
                                    setSurveyAnswers(prev => ({
                                       ...prev,
                                       [q.id]: { ...prev[q.id], jawaban_teks: e.target.value }
                                    }));
                                 }}
                              />
                           )}
                        </div>
                     ))}

                     <button
                        onClick={async () => {
                           for (const q of selectedSurvey.pertanyaan) {
                              if (q.is_required) {
                                 if (q.tipe_jawaban === 'teks' && !surveyAnswers[q.id]?.jawaban_teks?.trim()) {
                                    alert(`Pertanyaan "${q.teks_pertanyaan}" wajib diisi!`);
                                    return;
                                 }
                              }
                           }

                           showLoader();
                           setIsSurveyModalOpen(false);

                           try {
                              const res = await fetch(`/api/survei/${selectedSurvey.id}/respons`, {
                                 method: 'POST',
                                 headers: { 'Content-Type': 'application/json' },
                                 body: JSON.stringify({
                                    jawaban: selectedSurvey.pertanyaan.map((q: any) => ({
                                       pertanyaan_id: q.id,
                                       skor: q.tipe_jawaban === 'skala' ? (surveyAnswers[q.id]?.skor || 5) : null,
                                       jawaban_teks: q.tipe_jawaban === 'teks' ? (surveyAnswers[q.id]?.jawaban_teks || null) : null
                                    }))
                                 })
                              });

                              const result = await res.json();
                              if (res.ok && result.success) {
                                 setScanFeedback({ isVisible: true, type: 'success', message: 'Terima kasih! Jawaban survei berhasil dikirim.' });
                                 setTimeout(() => setScanFeedback(prev => ({ ...prev, isVisible: false })), 3000);
                                 setActiveSurveys(prev => prev.filter(s => s.id !== selectedSurvey.id));
                              } else {
                                 throw new Error(result.message || 'Gagal mengirim respons');
                              }
                           } catch (err: any) {
                              setScanFeedback({ isVisible: true, type: 'error', message: err.message || 'Terjadi kesalahan sistem' });
                              setTimeout(() => setScanFeedback(prev => ({ ...prev, isVisible: false })), 4000);
                           } finally {
                              hideLoader();
                           }
                        }}
                        className="w-full mt-4 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white font-bold rounded-xl shadow-lg shadow-blue-500/30"
                     >
                        Kirim Jawaban
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
    );
  }

  // ── Helper warna status BSC ────────────────────────────────────────────────
  const statusColor = (s: string) => ({
    hijau: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', icon: 'check_circle', dot: 'bg-emerald-500' },
    kuning: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400', icon: 'warning', dot: 'bg-amber-400' },
    merah: { bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-600', badge: 'bg-rose-100 text-rose-700', bar: 'bg-rose-500', icon: 'error', dot: 'bg-rose-500' },
    abu: { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-400', badge: 'bg-slate-100 text-slate-500', bar: 'bg-slate-300', icon: 'help_outline', dot: 'bg-slate-300' },
  }[s] ?? { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-400', badge: 'bg-slate-100 text-slate-500', bar: 'bg-slate-300', icon: 'help_outline', dot: 'bg-slate-300' });

  const statusLabel = (s: string) => ({ hijau: 'Tercapai', kuning: 'Waspada', merah: 'Perlu Tindakan', abu: 'Belum Ada Data' }[s] ?? '-');

  const fetchBsc = async (f = bscFilter) => {
    setLoadingBsc(true);
    try {
      const q = new URLSearchParams({ dari: f.dari, sampai: f.sampai });
      if (f.satelit_id) q.set('satelit_id', f.satelit_id);
      const res = await fetch(`/api/dashboard/bsc?${q}`);
      if (res.ok) {
        const j = await res.json();
        if (j.success) {
          setBscData(j.data);
          setSatelitComparisonData(j.satelit_comparison ?? null);
        }
      }
    } catch(e) { console.error(e); }
    finally { setLoadingBsc(false); }
  };

  const isExecRole = userData?.is_super_admin || userData?.role_name === 'MAJELIS';

  // ── (KpiSparkline, RadialGauge, KpiCard, SatelitComparisonChart are defined at file-level above) ──



  if (isExecRole && showBscDashboard) {
    const d = bscData;

    // Hitung pencapaian KPI untuk Summary Bar
    const kpisList = d ? Object.values(d) as any[] : [];
    const hijauCount = kpisList.filter(k => k.status === 'hijau').length;
    const kuningCount = kpisList.filter(k => k.status === 'kuning').length;
    const merahCount = kpisList.filter(k => k.status === 'merah').length;
    const sid = bscFilter.satelit_id;

    // Aksi rekomendasi strategis per KPI
    const kpiMapping: Record<string, { label: string; rec: string }> = {
      kpi1: { label: "Rasio Presensi Jemaat", rec: "Sosialisasikan kembali pentingnya pencatatan presensi mandiri lewat QR Code di setiap ibadah." },
      kpi2: { label: "Skor Kepuasan Rata-rata", rec: "Lakukan evaluasi berkala terhadap umpan balik jemaat mengenai ibadah dan fasilitas." },
      kpi3: { label: "Tingkat Retensi Kehadiran Jemaat", rec: "Evaluasi jemaat yang tidak hadir ≥ 1 bulan, aktifkan kunjungan pastoral proaktif, dan perkuat program kelompok kecil." },
      kpi4: { label: "Tingkat Ketepatan Respons Pastoral", rec: "Evaluasi beban kerja tim pastoral dan optimalkan alur penugasan kunjungan jemaat." },
      kpi5: { label: "Tingkat Kecukupan Pendanaan", rec: "Pastikan proyeksi pendapatan (subsidi & kontribusi) disusun secara matang agar seluruh kegiatan terdanai penuh tanpa mengalami defisit (≥ 100%)." },
      kpi6: { label: "Efisiensi Anggaran", rec: "Berikan bimbingan teknis penyusunan proposal kegiatan agar estimasi biaya lebih presisi." },
      kpi7: { label: "Rasio Penyelesaian Tindak Lanjut", rec: "Adakan koordinasi rutin untuk segera menyelesaikan dan menindaklanjuti keluhan dari jemaat." },
      kpi8: { label: "Kelengkapan Data Presensi Bernama", rec: "Tugaskan pelayan pintu (usher) ekstra untuk membantu jemaat melakukan QR scan saat masuk." },
      kpi9: { label: "Rasio Kehadiran Pelayan", rec: "Kirimkan pengingat jadwal otomatis lebih awal dan lakukan pembinaan komitmen pelayan." },
      kpi10: { label: "Ketepatan Waktu Konfirmasi Jadwal", rec: "Sederhanakan proses konfirmasi jadwal pelayan melalui aplikasi seluler atau WhatsApp bot." },
      kpi11: { label: "Kedisiplinan Waktu Kedatangan Pelayan", rec: "Berikan apresiasi kepada pelayan yang disiplin dan adakan briefing sebelum ibadah dimulai." },
      kpi12: { label: "Tingkat Respons Pelayanan Pastoral", rec: "Gunakan sistem notifikasi instan agar permohonan kunjungan pastoral segera ditindaklanjuti." },
    };

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


    const { scores: pScores, overall: overallScore } = computePerspektifScores(d);

    // Perspektif detail config for Detail tab
    const perspektifDetailConfig: Record<PerspektifKey, { header: { warna: string; icon: string; title: string; subtitle: string }; cards: React.ReactNode[] }> = {
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
          <KpiCard key="k8" kpi={d?.kpi8} label="Kelengkapan Data Presensi Bernama" icon="database" targetLabel="Target: > 95%" kpiKey="kpi8" satelitId={sid} />,
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
            onClick={() => setShowBscDashboard(false)}
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
                <span className="text-xs text-slate-400 font-bold">/ 12</span>
              </div>
              <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(hijauCount/12)*100}%` }} />
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
                <span className="text-xs text-slate-400 font-bold">/ 12</span>
              </div>
              <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(kuningCount/12)*100}%` }} />
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
                <span className="text-xs text-slate-400 font-bold">/ 12</span>
              </div>
              <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(merahCount/12)*100}%` }} />
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
              {(Object.entries(BSC_PERSPEKTIF_DEF) as [PerspektifKey, typeof BSC_PERSPEKTIF_DEF[PerspektifKey]][]).map(([pKey, pDef]) => (
                <button
                  key={pKey}
                  onClick={() => setSelectedPerspektif(pKey)}
                  className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-4 px-2 transition-all border-b-2 ${
                    selectedPerspektif === pKey
                      ? 'bg-slate-50 border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-icons-round text-[18px]">{pDef.icon}</span>
                    <span className="font-bold text-sm">{pDef.shortLabel}</span>
                  </div>
                  {pScores[pKey] !== null && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${selectedPerspektif === pKey ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                      {pScores[pKey]}%
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
                  {pScores[selectedPerspektif] !== null && (
                    <div className="ml-auto text-right">
                      <span className="text-3xl font-black text-slate-800">{pScores[selectedPerspektif]}%</span>
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

      </div>
    );
  }

  if (isInitialLoading) {
    return <div className="w-full h-full min-h-screen bg-slate-50" />;
  }

  // ── TAMPILAN ADMIN STANDAR (Sekretaris, Bendahara, dll) ───────────────────
  return (
    <div className="w-full flex flex-col gap-6 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 p-6 text-white shadow-lg">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10">
          <p className="text-indigo-200 text-sm font-medium mb-1">Selamat datang kembali,</p>
          <h1 className="text-2xl font-black tracking-tight mb-1">{userData?.nama_lengkap || userData?.email || 'Pengguna'}</h1>
          <span className="inline-block text-xs font-bold bg-white/20 backdrop-blur border border-white/30 px-3 py-1 rounded-full">
            {userData?.role_name?.replace(/_/g, ' ')}
            {userData?.nama_satelit ? ` — ${userData.nama_satelit}` : ''}
          </span>
        </div>
      </div>

      {/* Shortcut Modul */}
      <div>
        <h2 className="text-base font-black text-slate-700 mb-3 flex items-center gap-2">
          <span className="material-icons-round text-indigo-500 text-xl">apps</span>
          Akses Cepat
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {isExecRole && (
            <button 
              onClick={() => setShowBscDashboard(true)}
              className="group flex flex-col items-center gap-3 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all outline-none"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                <span className="material-icons-round text-white text-2xl">insert_chart</span>
              </div>
              <p className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors text-center">Dashboard BSC</p>
            </button>
          )}
          {[
            { perm: 'kegiatan_view',        href: '/kegiatan',         icon: 'event',          label: 'Kegiatan',       color: 'from-blue-500 to-indigo-600' },
            { perm: 'jemaat_view',           href: '/jemaat',           icon: 'groups',         label: 'Jemaat',         color: 'from-teal-500 to-emerald-600' },
            { perm: 'pelayan_view',          href: '/pelayan',          icon: 'volunteer_activism', label: 'Pelayan',    color: 'from-violet-500 to-purple-600' },
            { perm: 'pengurus_view',         href: '/pengurus',         icon: 'manage_accounts',label: 'Pengurus',       color: 'from-orange-500 to-amber-600' },
            { perm: 'anggaran_view',         href: '/anggaran/rancangan', icon: 'request_quote',label: 'Anggaran',       color: 'from-emerald-500 to-green-600' },
            { perm: 'buku_besar_view',       href: '/buku-besar',       icon: 'menu_book',      label: 'Buku Besar',     color: 'from-cyan-500 to-sky-600' },
            { perm: 'pegawai_view',          href: '/pegawai',          icon: 'badge',          label: 'Pegawai',        color: 'from-rose-500 to-pink-600' },
            { perm: 'kegiatan_pastoral_view',href: '/kegiatan/pastoral',icon: 'support_agent', label: 'Pastoral',       color: 'from-amber-500 to-yellow-500' },
          ].filter(item => {
            const perms: string[] = userData?.permissions || [];
            return userData?.is_super_admin || perms.includes(item.perm);
          }).map(item => (
            <a key={item.href} href={item.href}
              className="group flex flex-col items-center gap-3 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-sm`}>
                <span className="material-icons-round text-white text-2xl">{item.icon}</span>
              </div>
              <p className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors text-center">{item.label}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

