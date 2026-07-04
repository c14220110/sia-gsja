'use client';
import React, { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { exportRealisasiToExcel } from '@/lib/exportRealisasiLPJ';

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
const MONTHS = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const now = new Date();

export default function RealisasiKegiatanPage() {
  const { showLoader, hideLoader } = useLoader();
  const [tahun, setTahun] = useState(now.getFullYear().toString());
  const [bulan, setBulan] = useState('');
  const [satelitId, setSatelitId] = useState('');
  const [komisiId, setKomisiId] = useState('');
  const [jenis, setJenis] = useState('');
  const [satelitList, setSatelitList] = useState<any[]>([]);
  const [komisiList, setKomisiList] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [h2hData, setH2hData] = useState<any>(null);
  const [h2hExpanded, setH2hExpanded] = useState<Record<number,boolean>>({});
  const [tab, setTab] = useState<'satelit'|'komisi'|'coa'|'detail'|'h2h'>('satelit');
  const [isExporting, setIsExporting] = useState(false);
  const years = Array.from({length:6},(_,i)=>now.getFullYear()-2+i);

  const handleExportExcel = async () => {
    if (!data) return;
    setIsExporting(true);
    try {
      const satName = satelitList.find((s: any) => String(s.id) === satelitId)?.nama_satelit || '';
      await exportRealisasiToExcel(data, tahun, bulan, satName);
    } catch (e) {
      console.error('[Export LPJ] Error:', e);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(()=>{
    fetch('/api/master-data?table=satelit').then(r=>r.json()).then(j=>{ if(j.success) setSatelitList(j.data.filter((s:any)=>s.is_active)); });
  },[]);

  useEffect(()=>{
    setKomisiId(''); setKomisiList([]);
    if(!satelitId) return;
    fetch(`/api/anggaran/komisi-options?satelit_id=${satelitId}`).then(r=>r.json()).then(j=>{ if(j.success) setKomisiList(j.data); });
  },[satelitId]);

  useEffect(()=>{ load(); },[tahun,bulan,satelitId,komisiId,jenis]);

  const load = async () => {
    showLoader();
    setH2hExpanded({});
    try {
      const p = new URLSearchParams({ tahun });
      if(bulan) p.set('bulan',bulan);
      if(satelitId) p.set('satelit_id',satelitId);
      if(komisiId) p.set('komisi_id',komisiId);
      if(jenis) p.set('jenis',jenis);
      const r = await fetch(`/api/laporan/realisasi-kegiatan?${p}`);
      const j = await r.json();
      if(j.success) setData(j.data);

      // H2H tidak pakai filter jenis (selalu keduanya)
      const ph = new URLSearchParams({ tahun });
      if(bulan) ph.set('bulan',bulan);
      if(satelitId) ph.set('satelit_id',satelitId);
      if(komisiId) ph.set('komisi_id',komisiId);
      const rh = await fetch(`/api/laporan/head-to-head?${ph}`);
      const jh = await rh.json();
      if(jh.success) setH2hData(jh.data);
    } finally { hideLoader(); }
  };

  const s = data?.summary;
  const pct = (a:number,b:number) => b>0 ? Math.min(100,(a/b)*100).toFixed(0) : '0';

  return (
    <div className="w-full flex justify-center items-start pb-20 animate-in fade-in slide-in-from-bottom-2">
      <div className="w-full max-w-[1200px] flex flex-col gap-6">

        {/* Header */}
        <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-bl-full opacity-50 pointer-events-none"/>
          <div className="flex justify-between items-start mb-8 relative z-10">
            <div className="flex flex-col gap-2">
              <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded text-xs font-bold uppercase tracking-wide border border-rose-200 w-fit">REALISASI REPORT</span>
              <h1 className="text-slate-900 text-3xl font-black mt-1">Realisasi Kegiatan (LPJ)</h1>
              <p className="text-slate-500 text-sm font-medium mt-1 max-w-2xl">Rekap realisasi pengeluaran &amp; penerimaan dari LPJ kegiatan yang telah diajukan, difilter per satelit, komisi, dan akun COA.</p>
            </div>
            <button
              onClick={handleExportExcel}
              disabled={!data || isExporting}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg shadow-sm transition-colors"
            >
              {isExporting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="material-icons-round text-[18px]">download</span>
              )}
              {isExporting ? 'Menyiapkan...' : 'Export Excel'}
            </button>
          </div>
          {/* Filters */}
          <div className="w-full flex flex-wrap items-end gap-4 px-6 py-5 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tahun</label>
              <select value={tahun} onChange={e=>setTahun(e.target.value)} className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 font-bold text-slate-700">
                {years.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bulan</label>
              <select value={bulan} onChange={e=>setBulan(e.target.value)} className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 font-bold text-slate-700">
                <option value="">Semua Bulan</option>
                {MONTHS.slice(1).map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 min-w-[200px]">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Satelit</label>
              <select value={satelitId} onChange={e=>setSatelitId(e.target.value)} className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 font-bold text-slate-700">
                <option value="">Semua Satelit</option>
                {satelitList.map((s:any)=><option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
              </select>
            </div>
            {satelitId && (
              <div className="flex flex-col gap-1.5 min-w-[180px]">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Komisi</label>
                <select value={komisiId} onChange={e=>setKomisiId(e.target.value)} className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 font-bold text-slate-700">
                  <option value="">Semua Komisi</option>
                  {komisiList.map((k:any)=><option key={k.id} value={k.id}>{k.nama_komisi}</option>)}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Jenis</label>
              <select value={jenis} onChange={e=>setJenis(e.target.value)} className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 font-bold text-slate-700">
                <option value="">Semua Jenis</option>
                <option value="Penerimaan">Penerimaan</option>
                <option value="Pengeluaran">Pengeluaran</option>
              </select>
            </div>
          </div>
        </div>

        {data && (<>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {label:'Total Penerimaan',val:s.total_penerimaan,color:'blue',icon:'trending_up'},
              {label:'Total Pengeluaran',val:s.total_pengeluaran,color:'rose',icon:'trending_down'},
              {label:'Selisih (Saldo)',val:s.saldo,color:s.saldo>=0?'emerald':'red',icon:'account_balance_wallet'},
              {label:'Total LPJ Kegiatan',val:null,count:s.total_lpj,color:'violet',icon:'receipt_long'},
            ].map((c,i)=>(
              <div key={i} className={`bg-white rounded-2xl p-5 relative overflow-hidden shadow-sm border border-slate-200`}>
                <div className={`absolute -right-4 -bottom-4 w-24 h-24 bg-${c.color}-50 rounded-full blur-2xl`}/>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`material-icons-round text-${c.color}-500 text-[18px]`}>{c.icon}</span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{c.label}</span>
                </div>
                {c.val!==null
                  ? <div className={`text-2xl font-black ${c.color==='red'?'text-red-600':c.color==='emerald'?'text-emerald-700':'text-slate-800'}`}>{fmt(c.val)}</div>
                  : <div className="text-2xl font-black text-slate-800">{c.count} LPJ</div>}
              </div>
            ))}
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
            {(['satelit','komisi','coa','detail','h2h'] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)} className={`px-5 py-2.5 text-sm font-bold whitespace-nowrap capitalize transition-all border-b-2 -mb-px ${
                tab===t ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
                {t==='coa'?'Per Akun COA':t==='detail'?'Detail Transaksi':t==='satelit'?'Per Satelit':t==='h2h'?'⚖️ Anggaran vs Realisasi':'Per Komisi'}
              </button>
            ))}
          </div>

          {/* Per Satelit */}
          {tab==='satelit' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-5">
                <span className="material-icons-round text-rose-500">corporate_fare</span> Realisasi per Satelit
              </h3>
              <div className="flex flex-col gap-3">
                {data.by_satelit.length===0 && <p className="text-slate-400 text-sm text-center py-8">Tidak ada data.</p>}
                {data.by_satelit.map((r:any)=>(
                  <div key={r.satelit_id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-slate-800 text-sm">{r.nama_satelit}</span>
                      <div className="flex gap-4 text-right">
                        <div className="flex flex-col"><span className="text-[10px] text-blue-500 font-bold uppercase">Penerimaan</span><span className="font-black text-blue-700 text-sm">{fmt(r.total_penerimaan)}</span></div>
                        <div className="flex flex-col"><span className="text-[10px] text-rose-500 font-bold uppercase">Pengeluaran</span><span className="font-black text-rose-700 text-sm">{fmt(r.total_pengeluaran)}</span></div>
                        <span className="text-xs bg-slate-200 text-slate-600 font-bold px-2 py-1 rounded self-center">{r.jumlah_kegiatan} keg</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                      <div className="bg-rose-500 h-1.5 rounded-full transition-all duration-500" style={{width:`${pct(r.total_pengeluaran,s.total_pengeluaran)}%`}}/>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">{pct(r.total_pengeluaran,s.total_pengeluaran)}% dari total pengeluaran</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per Komisi */}
          {tab==='komisi' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-5">
                <span className="material-icons-round text-violet-500">groups</span> Realisasi per Komisi
              </h3>
              <div className="flex flex-col gap-3">
                {data.by_komisi.length===0 && <p className="text-slate-400 text-sm text-center py-8">Tidak ada data.</p>}
                {data.by_komisi.map((r:any,i:number)=>(
                  <div key={i} className="flex items-center justify-between py-3 px-4 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 transition">
                    <div>
                      <span className="text-sm font-bold text-slate-800">{r.nama_komisi}</span>
                      <div className="flex gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400">{r.nama_satelit}</span>
                        <span className="text-[10px] text-emerald-600 font-bold">{r.jumlah_kegiatan} kegiatan</span>
                      </div>
                    </div>
                    <div className="flex gap-6 text-right">
                      {r.total_penerimaan>0 && <div className="flex flex-col"><span className="text-[10px] text-blue-500 font-bold">Penerimaan</span><span className="font-black text-blue-700">{fmt(r.total_penerimaan)}</span></div>}
                      <div className="flex flex-col"><span className="text-[10px] text-rose-500 font-bold">Pengeluaran</span><span className="font-black text-slate-800">{fmt(r.total_pengeluaran)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per COA */}
          {tab==='coa' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                <span className="material-icons-round text-indigo-500">account_tree</span>
                <h3 className="text-sm font-black text-slate-800">Realisasi per Akun COA</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Kode</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Akun</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Jenis</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total Realisasi</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Keg</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Proporsi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.by_coa.length===0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">Tidak ada data.</td></tr>}
                    {data.by_coa.map((r:any,i:number)=>{
                      const base = r.jenis_anggaran==='Penerimaan'?s.total_penerimaan:s.total_pengeluaran;
                      const p = pct(r.total_realisasi,base);
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition">
                          <td className="px-5 py-3"><span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded font-sans">{r.kode_akun}</span></td>
                          <td className="px-5 py-3 font-semibold text-slate-800">{r.nama_akun}</td>
                          <td className="px-5 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded ${r.jenis_anggaran==='Penerimaan'?'bg-blue-100 text-blue-700':'bg-rose-100 text-rose-700'}`}>{r.jenis_anggaran}</span></td>
                          <td className="px-5 py-3 text-right font-black text-slate-800">{fmt(r.total_realisasi)}</td>
                          <td className="px-5 py-3 text-center text-slate-500 font-bold">{r.jumlah_kegiatan}</td>
                          <td className="px-5 py-3 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${r.jenis_anggaran==='Penerimaan'?'bg-blue-500':'bg-rose-500'}`} style={{width:`${p}%`}}/></div>
                              <span className="text-[10px] text-slate-400 font-bold w-8">{p}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detail */}
          {tab==='detail' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-icons-round text-slate-500">table_rows</span>
                  <h3 className="text-sm font-black text-slate-800">Detail Transaksi LPJ</h3>
                </div>
                <span className="text-xs text-slate-400">Maks. 200 baris</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggal</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Kegiatan</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Satelit / Komisi</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Akun COA</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Uraian</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Jenis</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Nominal</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status LPJ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.detail.length===0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">Tidak ada data.</td></tr>}
                    {data.detail.map((r:any,i:number)=>(
                      <tr key={i} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 text-slate-500 text-xs">{new Date(r.tanggal_mulai).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</td>
                        <td className="px-4 py-3">
                          <a href={`/kegiatan/${r.kegiatan_id}/lpj/view`} className="font-bold text-slate-800 hover:text-rose-600 transition text-xs">{r.nama_kegiatan}</a>
                          <div className="text-[10px] text-slate-400">{r.kode_kegiatan}</div>
                        </td>
                        <td className="px-4 py-3 text-xs"><div className="font-bold text-slate-700">{r.nama_satelit}</div><div className="text-slate-400">{r.nama_komisi}</div></td>
                        <td className="px-4 py-3"><span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-sans">{r.kode_akun}</span><div className="text-[10px] text-slate-400 mt-0.5">{r.nama_akun}</div></td>
                        <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] truncate">{r.uraian}</td>
                        <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded ${r.jenis_anggaran==='Penerimaan'?'bg-blue-100 text-blue-700':'bg-rose-100 text-rose-700'}`}>{r.jenis_anggaran}</span></td>
                        <td className="px-4 py-3 text-right font-black text-slate-800 text-xs">{fmt(r.total)}</td>
                        <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded ${r.status_lpj==='Disetujui'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{r.status_lpj}</span></td>
                      </tr>
                    ))}
                  </tbody>
                  {data.detail.length>0 && (
                    <tfoot><tr className="bg-slate-800">
                      <td colSpan={6} className="px-4 py-3 font-black text-white text-sm">TOTAL ({data.detail.length} baris)</td>
                      <td className="px-4 py-3 text-right font-black text-white text-sm">{fmt(data.detail.reduce((a:number,r:any)=>a+r.total,0))}</td>
                      <td/>
                    </tr></tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ⚖️ Head-to-Head: Anggaran vs Realisasi */}
          {tab==='h2h' && (
            <div className="flex flex-col gap-4">

              {/* H2H Grand Summary Cards */}
              {h2hData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Plafon Pengeluaran', val: h2hData.summary.grand_plafon_pengeluaran, color: 'violet' },
                    { label: 'Total Realisasi Pengeluaran', val: h2hData.summary.grand_realisasi_pengeluaran, color: 'rose' },
                    { label: 'Sisa Plafon', val: h2hData.summary.grand_selisih, color: h2hData.summary.grand_selisih >= 0 ? 'emerald' : 'red' },
                    { label: 'Serapan Rata-rata', val: null, pct: h2hData.summary.grand_pct_serapan, color: h2hData.summary.grand_pct_serapan <= 100 ? 'amber' : 'red' },
                  ].map((c,i)=>(
                    <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{c.label}</div>
                      {c.val !== null
                        ? <div className={`text-xl font-black ${c.color==='red'?'text-red-600':c.color==='emerald'?'text-emerald-700':c.color==='rose'?'text-rose-600':'text-violet-700'}`}>{fmt(c.val)}</div>
                        : <div className={`text-2xl font-black ${c.pct! > 100 ? 'text-red-600' : 'text-amber-600'}`}>{c.pct}%</div>
                      }
                    </div>
                  ))}
                </div>
              )}

              {/* Per-RA Comparison Table */}
              {!h2hData || h2hData.list.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
                  <span className="material-icons-round text-slate-300 text-[48px] block mb-3">balance</span>
                  <p className="text-slate-400 font-medium">Tidak ada RA yang memiliki LPJ di periode ini.</p>
                  <p className="text-slate-400 text-sm mt-1">Pastikan kegiatan sudah dikaitkan ke Rancangan Anggaran dan LPJ-nya sudah diajukan.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                    <span className="material-icons-round text-violet-500">balance</span>
                    <h3 className="text-sm font-black text-slate-800">Perbandingan Anggaran vs Realisasi per RA</h3>
                    <span className="ml-auto text-xs text-slate-400">{h2hData.list.length} RA</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {h2hData.list.map((r: any) => {
                      const isOver    = r.selisih_pengeluaran < 0;
                      const pct       = r.pct_serapan;
                      const expanded  = h2hExpanded[r.ra_id] || false;
                      const barColor  = pct > 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';

                      return (
                        <div key={r.ra_id} className="px-6 py-4 hover:bg-slate-50 transition">
                          {/* Row Header */}
                          <div className="flex items-start gap-4">
                            {/* RA Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-sans">{r.kode_dokumen}</span>
                                {r.pola_penggunaan === 'Bertahap' && (
                                  <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded uppercase">Multi-Event</span>
                                )}
                                {isOver && (
                                  <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                                    <span className="material-icons-round text-[11px]">warning</span>Over Budget
                                  </span>
                                )}
                              </div>
                              <div className="font-bold text-slate-800 text-sm truncate">{r.nama_rancangan}</div>
                              <div className="text-xs text-slate-400 mt-0.5">{r.nama_satelit} · {r.nama_komisi}</div>
                            </div>

                            {/* Columns: Plafon | Realisasi | Selisih */}
                            <div className="hidden md:flex gap-6 text-right shrink-0">
                              <div className="flex flex-col w-32">
                                <span className="text-[10px] text-violet-500 font-bold uppercase">Plafon ACC</span>
                                <span className="font-black text-slate-700 text-sm">{fmt(r.plafon_pengeluaran)}</span>
                              </div>
                              <div className="flex flex-col w-32">
                                <span className="text-[10px] text-rose-500 font-bold uppercase">Realisasi</span>
                                <span className={`font-black text-sm ${isOver ? 'text-red-600' : 'text-slate-800'}`}>{fmt(r.realisasi_pengeluaran)}</span>
                              </div>
                              <div className="flex flex-col w-28">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">{isOver ? 'Kelebihan' : 'Sisa'}</span>
                                <span className={`font-black text-sm ${isOver ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(Math.abs(r.selisih_pengeluaran))}</span>
                              </div>
                            </div>

                            {/* Expand button */}
                            {r.kegiatan_list.length > 0 && (
                              <button
                                onClick={() => setH2hExpanded(prev => ({ ...prev, [r.ra_id]: !expanded }))}
                                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition"
                              >
                                <span className={`material-icons-round text-[18px] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>expand_more</span>
                              </button>
                            )}
                          </div>

                          {/* Progress bar serapan */}
                          <div className="mt-3 flex items-center gap-3">
                            <div className="flex-1 bg-slate-100 rounded-full h-2 relative overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-black w-12 text-right ${pct > 100 ? 'text-red-600' : 'text-slate-600'}`}>{pct}%</span>
                            <span className="text-xs text-slate-400 whitespace-nowrap">
                              {r.kegiatan_ber_lpj} LPJ
                              {r.pola_penggunaan === 'Bertahap' && r.total_kegiatan_ra > 0 && (
                                <> / {r.total_kegiatan_ra} kegiatan</>
                              )}
                            </span>
                          </div>

                          {/* Drill-down kegiatan accordion */}
                          {expanded && r.kegiatan_list.length > 0 && (
                            <div className="mt-3 ml-2 border-l-2 border-slate-200 pl-4 flex flex-col gap-2">
                              {r.kegiatan_list.map((k: any) => (
                                <div key={k.kegiatan_id} className="flex items-center justify-between text-xs">
                                  <div>
                                    <a href={`/kegiatan/${k.kegiatan_id}/lpj/view`} className="font-bold text-slate-700 hover:text-rose-600 transition">{k.nama_kegiatan}</a>
                                    <span className="text-slate-400 ml-2">{new Date(k.tanggal_mulai).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${k.status_lpj==='Disetujui'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{k.status_lpj}</span>
                                    <span className="text-rose-600 font-black">{fmt(k.lpj_pengeluaran)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

        </>)}


        {!data && (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
            <span className="material-icons-round text-slate-300 text-[48px] block mb-3">bar_chart</span>
            <p className="text-slate-400 font-medium">Memuat data realisasi...</p>
          </div>
        )}

      </div>
    </div>
  );
}
