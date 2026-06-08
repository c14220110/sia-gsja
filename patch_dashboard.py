import re

with open('src/app/(main)/page.tsx', 'r') as f:
    content = f.read()

# 1. Insert new helper components before DashboardHome
helpers = """
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
"""

if "// ─── NEW BSC UI COMPONENTS ──────────────────────────────────────────────────" not in content:
    content = content.replace("export default function DashboardHome() {", helpers + "\nexport default function DashboardHome() {")

# 2. Extract the isExecRole block
exec_start_str = "if (isExecRole) {"
exec_end_str = "if (isInitialLoading) {"

exec_start_idx = content.find(exec_start_str)
exec_end_idx = content.find(exec_end_str)

if exec_start_idx == -1 or exec_end_idx == -1:
    print("Could not find isExecRole block bounds")
    exit(1)

# Inside isExecRole, we have the processing logic, then return ( ... )
# We will replace the return (...) completely.
is_exec_block = content[exec_start_idx:exec_end_idx]
return_start_idx = is_exec_block.find("return (")

if return_start_idx == -1:
    print("Could not find return statement inside isExecRole")
    exit(1)

new_return = """return (
      <div className="w-full flex flex-col gap-5 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
        
        {/* Top header */}
        <div className="flex flex-col gap-1 mb-1">
          <h1 className="text-slate-900 text-2xl font-black font-sans leading-tight">Balanced Scorecard</h1>
          <p className="text-slate-400 text-sm font-medium">Analisis Kinerja Strategis Organisasi — GSJA Eben Haezer</p>
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
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dari</label>
            <input type="date" value={bscFilter.dari} onChange={e => setBscFilter(p => ({ ...p, dari: e.target.value }))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:border-indigo-400 font-medium" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sampai</label>
            <input type="date" value={bscFilter.sampai} onChange={e => setBscFilter(p => ({ ...p, sampai: e.target.value }))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:border-indigo-400 font-medium" />
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
                  <MiniKpiCard id="KPI-8" title="Akurasi Data Presensi" kpi={d.kpi8} kpiKey="kpi8" icon="database" causal="Validasi Angka Presensi & Retensi" sid={sid} />
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

            {/* Perbandingan Antar Satelit (Radar/Bar Chart Area) */}
            {userData?.is_super_admin && bscFilter.satelit_id === '' && satelitComparisonData && (
              <SatelitComparisonChart data={satelitComparisonData} />
            )}
          </div>
        )}

      </div>
    );"""

# Replace the isExecRole render block
new_is_exec_block = is_exec_block[:return_start_idx] + new_return

content = content[:exec_start_idx] + new_is_exec_block + content[exec_end_idx:]

with open('src/app/(main)/page.tsx', 'w') as f:
    f.write(content)

print("Dashboard successfully patched!")
