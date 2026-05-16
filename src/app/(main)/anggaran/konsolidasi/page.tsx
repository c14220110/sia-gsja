'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { exportToExcel, exportToPDF } from '@/lib/exportAnggaran';

export default function KonsolidasiAnggaranPage() {
  const { showLoader, hideLoader } = useLoader();
  const [satelitList, setSatelitList] = useState<any[]>([]);
  
  const [selectedTahun, setSelectedTahun] = useState<string>(new Date().getFullYear().toString());
  const [selectedSatelit, setSelectedSatelit] = useState<string>('');
  const [selectedKomisi, setSelectedKomisi] = useState<string>('');
  const [komisiList, setKomisiList] = useState<any[]>([]);
  
  const [data, setData] = useState<any>(null);
  const [selectedRA, setSelectedRA] = useState<any>(null); // For slide-in panel
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Generate Year Options
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 10}, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    const fetchSatelit = async () => {
      try {
        const res = await fetch('/api/master-data?table=satelit');
        if (res.ok) {
          const json = await res.json();
          if (json.success) setSatelitList(json.data.filter((s:any) => s.is_active));
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSatelit();
  }, []);

  const fetchKonsolidasi = async () => {
    showLoader();
    try {
      const url = new URL('/api/anggaran/konsolidasi', window.location.origin);
      url.searchParams.append('tahun', selectedTahun);
      if (selectedSatelit) url.searchParams.append('satelit_id', selectedSatelit);
      if (selectedKomisi) url.searchParams.append('komisi_id', selectedKomisi);
      
      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        if (json.success) setData(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      hideLoader();
    }
  };

  useEffect(() => {
    fetchKonsolidasi();
  }, [selectedTahun, selectedSatelit, selectedKomisi]);

  // Fetch komisi list when satelit changes
  useEffect(() => {
    setSelectedKomisi('');
    setKomisiList([]);
    if (!selectedSatelit) return;
    fetch(`/api/anggaran/komisi-options?satelit_id=${selectedSatelit}`)
      .then(r => r.json())
      .then(j => { if (j.success) setKomisiList(j.data); })
      .catch(() => {});
  }, [selectedSatelit]);

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const satelitLabel = selectedSatelit
    ? satelitList.find((s: any) => String(s.id) === selectedSatelit)?.label || ''
    : '';

  const handleExportExcel = async () => {
    if (!data || !data.list || data.list.length === 0) return;
    setShowExportMenu(false);
    showLoader();
    try {
      await exportToExcel(data, selectedTahun, satelitLabel);
    } catch (e) {
      console.error('Export Excel error:', e);
      alert('Gagal export Excel. Pastikan library sudah terinstall.');
    } finally {
      hideLoader();
    }
  };

  const handleExportPDF = async () => {
    if (!data || !data.list || data.list.length === 0) return;
    setShowExportMenu(false);
    showLoader();
    try {
      await exportToPDF(data, selectedTahun, satelitLabel);
    } catch (e) {
      console.error('Export PDF error:', e);
      alert('Gagal export PDF. Pastikan library sudah terinstall.');
    } finally {
      hideLoader();
    }
  };

  return (
    <div className="w-full flex justify-center items-start pb-20 relative animate-in fade-in slide-in-from-bottom-2">
      <div className="w-full max-w-[1200px] flex flex-col gap-6">

        {/* Header Title Card */}
        <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-bl-full opacity-50 pointer-events-none"></div>
          
          <div className="flex justify-between items-start z-50 w-full mb-8 relative">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                 <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold uppercase tracking-wide border border-emerald-200">
                   MASTER REPORT
                 </span>
              </div>
              <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mt-1">
                Rekapitulasi Anggaran
              </h1>
              <p className="text-slate-500 text-sm font-medium mt-1 max-w-2xl">
                 Konsolidasi Rancangan Anggaran (RA) yang telah disetujui (Penuh/Sebagian) di tahun berjalan.
                 Digunakan untuk memantau kesehatan finansial dan efisiensi pengeluaran satelit.
              </p>
            </div>
            
            <div className="relative z-20" ref={exportRef}>
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={!data || data.list.length === 0}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition flex items-center gap-2 text-sm shadow-sm disabled:opacity-50"
              >
                <span className="material-icons-round text-[18px]">download</span> Export 
                <span className="material-icons-round text-[16px] -ml-1">expand_more</span>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-slate-200 z-[100] py-1">
                  <button onClick={handleExportExcel} className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition flex items-center gap-3">
                    <span className="material-icons-round text-[20px] text-emerald-600">table_view</span>
                    <div className="flex flex-col">
                      <span>Export Excel (.xlsx)</span>
                      <span className="text-[10px] font-normal text-slate-400">Lengkap dengan rincian item</span>
                    </div>
                  </button>
                  <div className="border-t border-slate-100"></div>
                  <button onClick={handleExportPDF} className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition flex items-center gap-3">
                    <span className="material-icons-round text-[20px] text-rose-500">picture_as_pdf</span>
                    <div className="flex flex-col">
                      <span>Export PDF</span>
                      <span className="text-[10px] font-normal text-slate-400">Siap cetak, format landscape</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Filter Bar */}
          <div className="w-full flex items-end gap-4 px-6 py-5 bg-slate-50 border border-slate-100 rounded-xl z-10 shadow-sm">
             <div className="flex flex-col gap-1.5 flex-1 max-w-[200px]">
               <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tahun Anggaran</label>
               <select 
                 value={selectedTahun} 
                 onChange={e => setSelectedTahun(e.target.value)}
                 className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-700"
               >
                 {years.map(y => <option key={y} value={y}>{y}</option>)}
               </select>
             </div>
             
             <div className="flex flex-col gap-1.5 flex-1 max-w-[300px]">
               <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Filter Satelit</label>
               <select 
                 value={selectedSatelit} 
                 onChange={e => setSelectedSatelit(e.target.value)}
                 className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-700"
               >
                 <option value="">Semua Satelit (Konsolidasi Total)</option>
                 {satelitList.map(s => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
               </select>
             </div>

             {selectedSatelit && (
              <div className="flex flex-col gap-1.5 flex-1 max-w-[250px]">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Filter Komisi</label>
                <select 
                  value={selectedKomisi} 
                  onChange={e => setSelectedKomisi(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-700"
                >
                  <option value="">Semua (Umum + Komisi)</option>
                  <option value="null">Anggaran Umum Satelit</option>
                  {komisiList.map((k: any) => <option key={k.id} value={k.id}>{k.nama_komisi}</option>)}
                </select>
              </div>
             )}
          </div>
        </div>

        {/* Dashboard Content */}
        {data && (
          <div className="flex flex-col gap-6">
             
             {/* Master Summary Card: Penerimaan vs Pengeluaran */}
             <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="bg-white rounded-2xl p-6 relative overflow-hidden shadow-sm border border-slate-200">
                  <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-50 rounded-full blur-2xl"></div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-icons-round text-blue-500 text-[18px]">trending_up</span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Proyeksi Penerimaan</span>
                  </div>
                  <h2 className="text-3xl font-black text-slate-800">{formatRupiah(data.summary.total_penerimaan)}</h2>
               </div>

               <div className="bg-white rounded-2xl p-6 relative overflow-hidden shadow-sm border border-slate-200">
                  <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-amber-50 rounded-full blur-2xl"></div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-icons-round text-amber-500 text-[18px]">trending_down</span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Pengeluaran (Disetujui)</span>
                  </div>
                  <h2 className="text-3xl font-black text-slate-800">{formatRupiah(data.summary.total_pengeluaran)}</h2>
                  <div className="mt-2 flex flex-col gap-1">
                    {data.summary.total_penerimaan > 0 && (
                      <span className={`text-[11px] font-black px-2 py-0.5 rounded w-fit ${
                        (data.summary.total_pengeluaran / data.summary.total_penerimaan) * 100 <= 85 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : (data.summary.total_pengeluaran / data.summary.total_penerimaan) * 100 <= 100 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-rose-100 text-rose-700'
                      }`}>
                        {((data.summary.total_pengeluaran / data.summary.total_penerimaan) * 100).toFixed(0)}% dari Penerimaan
                      </span>
                    )}
                    {data.summary.total_pengeluaran !== data.summary.total_pengajuan && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        Pengajuan awal: {formatRupiah(data.summary.total_pengajuan)}
                      </span>
                    )}
                  </div>
               </div>

               <div className={`bg-white rounded-2xl p-6 relative overflow-hidden shadow-sm border ${data.summary.saldo_proyeksi >= 0 ? 'border-emerald-200 bg-emerald-50/30' : 'border-rose-200 bg-rose-50/30'}`}>
                  <div className={`absolute -right-6 -bottom-6 w-32 h-32 rounded-full blur-2xl ${data.summary.saldo_proyeksi >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}></div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`material-icons-round text-[18px] ${data.summary.saldo_proyeksi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {data.summary.saldo_proyeksi >= 0 ? 'account_balance_wallet' : 'warning'}
                    </span>
                    <span className={`text-xs font-bold uppercase tracking-widest ${data.summary.saldo_proyeksi >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      Proyeksi Saldo ({data.summary.saldo_proyeksi >= 0 ? 'Surplus' : 'Defisit'})
                    </span>
                  </div>
                  <h2 className={`text-3xl font-black ${data.summary.saldo_proyeksi >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatRupiah(Math.abs(data.summary.saldo_proyeksi))}
                  </h2>
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Breakdown Kas Gereja vs Swadaya */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                   <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-4">
                     <span className="material-icons-round text-violet-500">account_balance</span> Proporsi Sumber Dana (Pengeluaran)
                   </h3>
                   <div className="flex flex-col gap-3">
                     <div>
                       <div className="flex justify-between text-xs font-bold mb-1">
                         <span className="text-slate-600">Plafon Pusat (Kas Gereja)</span>
                         <span className="text-slate-800">{formatRupiah(data.summary.sumber_dana.plafon_pusat)}</span>
                       </div>
                       <div className="w-full bg-slate-100 rounded-full h-2">
                         <div 
                           className="bg-violet-500 h-2 rounded-full transition-all duration-500" 
                           style={{ width: `${data.summary.total_pengeluaran > 0 ? (data.summary.sumber_dana.plafon_pusat / data.summary.total_pengeluaran) * 100 : 0}%` }}
                         ></div>
                       </div>
                     </div>
                     <div>
                       <div className="flex justify-between text-xs font-bold mb-1">
                         <span className="text-slate-600">Kas Satelit/Komisi</span>
                         <span className="text-slate-800">{formatRupiah(data.summary.sumber_dana.kas_mandiri)}</span>
                       </div>
                       <div className="w-full bg-slate-100 rounded-full h-2">
                         <div 
                           className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                           style={{ width: `${data.summary.total_pengeluaran > 0 ? (data.summary.sumber_dana.kas_mandiri / data.summary.total_pengeluaran) * 100 : 0}%` }}
                         ></div>
                       </div>
                     </div>
                   </div>
                </div>

                {/* Kategori Breakdown — NOW USES ITEM-LEVEL total_pengeluaran */}
                <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                   <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-4">
                     <span className="material-icons-round text-emerald-500">pie_chart</span> Breakdown Kategori Pengeluaran
                   </h3>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     {Object.keys(data.summary.kategori).map(kat => (
                       <div key={kat} className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex flex-col">
                         <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{kat}</span>
                         <span className="text-lg font-black text-slate-800 mt-1">{formatRupiah(data.summary.kategori[kat].total_pengeluaran)}</span>
                         {data.summary.kategori[kat].total_penerimaan > 0 && (
                           <span className="text-[10px] text-blue-600 font-bold bg-blue-50 w-fit px-2 py-0.5 rounded mt-1">
                             Penerimaan: {formatRupiah(data.summary.kategori[kat].total_penerimaan)}
                           </span>
                         )}
                         <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 w-fit px-2 py-0.5 rounded mt-2">{data.summary.kategori[kat].total_ra} RA</span>
                       </div>
                     ))}
                   </div>
                </div>
             </div>

             {/* Breakdown per Komisi / Unit */}
              {data.summary.komisi && Object.keys(data.summary.komisi).length > 1 && (() => {
                // Group by satelit when multi-satelit
                const isMultiSatelit = !selectedSatelit;
                const entries = Object.entries(data.summary.komisi).sort(([,a]: any, [,b]: any) => b.total_pengeluaran - a.total_pengeluaran);
                const bySatelit: Record<string, [string, any][]> = {};
                entries.forEach(([name, val]: [string, any]) => {
                  const satKey = val.satelit_names ? val.satelit_names.join(', ') : 'Semua Satelit';
                  if (!bySatelit[satKey]) bySatelit[satKey] = [];
                  bySatelit[satKey].push([name, val]);
                });
                return (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                     <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-4">
                       <span className="material-icons-round text-indigo-500">groups</span> Breakdown per Komisi / Unit
                       {isMultiSatelit && <span className="text-[10px] font-normal text-slate-400 ml-1">(gabungan semua satelit)</span>}
                     </h3>
                     <div className="flex flex-col gap-2">
                       {entries.map(([name, val]: [string, any]) => (
                         <div key={name} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 transition">
                           <div className="flex flex-col">
                             <span className="text-xs font-bold text-slate-700">{name}</span>
                             <div className="flex items-center gap-2 mt-0.5">
                               <span className="text-[10px] text-emerald-600 font-bold">{val.total_ra} RA</span>
                               {isMultiSatelit && val.satelit_names && val.satelit_names.length > 0 && (
                                 <span className="text-[10px] text-slate-400">· {val.satelit_names.join(', ')}</span>
                               )}
                             </div>
                           </div>
                           <div className="flex flex-col text-right">
                             <span className="text-sm font-black text-slate-800">{formatRupiah(val.total_pengeluaran)}</span>
                             {val.total_penerimaan > 0 && (
                               <span className="text-[10px] text-blue-600 font-bold">+ {formatRupiah(val.total_penerimaan)} penerimaan</span>
                             )}
                           </div>
                         </div>
                       ))}
                     </div>
                  </div>
                );
              })()}

             {/* Data Table — NOW SHOWS PENERIMAAN & PENGELUARAN COLUMNS */}
             <div className="w-full flex flex-col gap-4">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <span className="material-icons-round text-slate-500">table_rows</span> Rincian Dokumen RA (Klik baris untuk melihat detail)
                </h3>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                   <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm whitespace-nowrap">
                       <thead className="bg-slate-50 border-b border-slate-200">
                         <tr>
                           <th className="px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Kode RA</th>
                           <th className="px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Nama Rancangan</th>
                           <th className="px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Kategori</th>
                           <th className="px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider text-right">Penerimaan</th>
                           <th className="px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider text-right">Pengeluaran</th>
                           <th className="px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Status</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {data.list.length === 0 ? (
                           <tr>
                             <td colSpan={6} className="px-5 py-10 text-center text-slate-400 font-medium">Tidak ada RA yang disetujui untuk filter ini.</td>
                           </tr>
                         ) : (
                           data.list.map((r: any) => (
                             <tr 
                               key={r.id} 
                               className="hover:bg-slate-50 cursor-pointer transition-colors"
                               onClick={() => setSelectedRA(r)}
                             >
                               <td className="px-5 py-4">
                                 <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{r.kode_dokumen}</span>
                               </td>
                               <td className="px-5 py-4">
                                 <p className="font-bold text-slate-800">{r.nama_rancangan}</p>
                                 <p className="text-xs text-slate-500 mt-0.5">{r.nama_komisi || r.nama_departemen || 'Umum Satelit'}</p>
                               </td>
                               <td className="px-5 py-4">
                                 <p className="font-bold text-slate-700">{r.kategori_ra}</p>
                                 {r.kategori_ra === 'Kegiatan' && (
                                   <p className="text-xs text-slate-500 mt-0.5">{r.pola_penggunaan === 'Sekali Pakai' ? 'Tunggal' : r.pola_penggunaan}</p>
                                 )}
                               </td>
                               <td className="px-5 py-4 text-right">
                                 {(r.ra_penerimaan || 0) > 0 ? (
                                   <span className="font-bold text-blue-700">{formatRupiah(r.ra_penerimaan)}</span>
                                 ) : (
                                   <span className="text-slate-300 text-xs">—</span>
                                 )}
                               </td>
                               <td className="px-5 py-4 text-right">
                                 {(r.ra_pengeluaran || 0) > 0 ? (
                                   <span className="font-black text-slate-800">{formatRupiah(r.ra_pengeluaran)}</span>
                                 ) : (
                                   <span className="text-slate-300 text-xs">—</span>
                                 )}
                               </td>
                               <td className="px-5 py-4">
                                 <span className={`px-2 py-1 rounded text-xs font-bold ${r.status === 'Disetujui Penuh' || r.status === 'Selesai' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                   {r.status}
                                 </span>
                               </td>
                             </tr>
                           ))
                         )}
                        </tbody>
                        {data.list.length > 0 && (
                          <tfoot>
                            <tr className="bg-slate-800">
                              <td colSpan={3} className="px-5 py-3 font-black text-white text-sm">TOTAL</td>
                              <td className="px-5 py-3 text-right font-black text-blue-300 text-sm">
                                {formatRupiah(data.summary.total_penerimaan)}
                              </td>
                              <td className="px-5 py-3 text-right font-black text-white text-sm">
                                {formatRupiah(data.summary.total_pengeluaran)}
                              </td>
                              <td className="px-5 py-3">
                                <span className="text-emerald-300 text-xs font-bold">
                                  {data.summary.total_penerimaan > 0 ? `${((data.summary.total_pengeluaran / data.summary.total_penerimaan) * 100).toFixed(0)}%` : '-'}
                                </span>
                              </td>
                            </tr>
                          </tfoot>
                        )}
                     </table>
                   </div>
                </div>
             </div>

          </div>
        )}

        {/* Slide-in Panel (Drill-down RA Details) */}
        {selectedRA && (
          <div className="fixed inset-0 z-50 flex justify-end">
             {/* Backdrop */}
             <div 
               className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
               onClick={() => setSelectedRA(null)}
             ></div>
             
             {/* Panel */}
             <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded mb-1">{selectedRA.kode_dokumen}</span>
                    <h2 className="text-lg font-black text-slate-800 leading-tight">{selectedRA.nama_rancangan}</h2>
                  </div>
                  <button 
                    onClick={() => setSelectedRA(null)}
                    className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300 transition"
                  >
                    <span className="material-icons-round text-[20px]">close</span>
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 bg-white">
                   {/* Summary Grid — now shows Penerimaan and Pengeluaran separately */}
                   <div className="grid grid-cols-3 gap-4 mb-6">
                     <div className="flex flex-col">
                       <span className="text-[10px] font-bold text-slate-400 uppercase">Kategori & Pola</span>
                       <span className="text-sm font-bold text-slate-700">{selectedRA.kategori_ra} - {selectedRA.pola_penggunaan === 'Sekali Pakai' ? 'Tunggal' : selectedRA.pola_penggunaan}</span>
                     </div>
                     <div className="flex flex-col text-right">
                       <span className="text-[10px] font-bold text-blue-400 uppercase">Penerimaan</span>
                       <span className="text-base font-black text-blue-600">{formatRupiah(selectedRA.ra_penerimaan || 0)}</span>
                     </div>
                     <div className="flex flex-col text-right">
                       <span className="text-[10px] font-bold text-slate-400 uppercase">Pengeluaran</span>
                       <span className="text-lg font-black text-emerald-600">{formatRupiah(selectedRA.ra_pengeluaran || 0)}</span>
                     </div>
                   </div>

                   {/* Link to full RA document */}
                   <a 
                     href={`/anggaran/rancangan/view/${selectedRA.id}`} 
                     className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition mb-5 px-3 py-2 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-100"
                   >
                     <span className="material-icons-round text-[16px]">open_in_new</span>
                     Buka Dokumen RA Lengkap →
                   </a>

                   <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 pb-2 border-b border-slate-100">Rincian Item Anggaran</h3>
                   
                   <div className="flex flex-col gap-3">
                     {selectedRA.items && selectedRA.items.length > 0 ? (
                       selectedRA.items.map((item: any) => (
                         <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition">
                           <div className="flex justify-between items-start mb-2">
                             <div className="flex items-center gap-2">
                               <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${item.jenis_anggaran === 'Penerimaan' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                                 {item.jenis_anggaran}
                               </span>
                               <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-600 uppercase tracking-wider">
                                 {item.sumber_dana || 'KAS GEREJA'}
                               </span>
                             </div>
                             <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                item.status_item === 'ACC' ? 'text-emerald-700 bg-emerald-100'
                                : item.status_item === 'ACC_DIPOTONG' ? 'text-blue-700 bg-blue-100'
                                : item.status_item === 'Disetujui' ? 'text-emerald-700 bg-emerald-100'
                                : item.status_item === 'Ditolak' ? 'text-rose-700 bg-rose-100'
                                : 'text-slate-700 bg-slate-200'
                              }`}>
                                {item.status_item === 'ACC' ? 'Disetujui'
                                  : item.status_item === 'ACC_DIPOTONG' ? 'Disetujui (Dipotong)'
                                  : item.status_item}
                             </span>
                           </div>
                           
                           <h4 className="font-bold text-slate-800 text-sm">{item.uraian}</h4>
                           {item.deskripsi && <p className="text-xs text-slate-500 mt-0.5">{item.deskripsi}</p>}
                           
                           <div className="flex justify-between items-end mt-4 pt-3 border-t border-slate-200/60">
                             <div className="flex flex-col">
                               <span className="text-[10px] text-slate-500 font-medium">Vol: {item.jumlah} {item.satuan} &times; {formatRupiah(parseFloat(item.harga_satuan))}</span>
                                {parseFloat(item.total) !== parseFloat(item.nominal_disetujui) && (
                                  <span className="text-xs font-medium text-slate-400 line-through">
                                    Pengajuan: {formatRupiah(parseFloat(item.total))}
                                  </span>
                                )}
                             </div>
                             <div className="flex flex-col text-right">
                               <span className="text-[10px] font-bold text-slate-400 uppercase">Disetujui</span>
                               <span className="text-base font-black text-slate-800">{formatRupiah(parseFloat(item.nominal_disetujui))}</span>
                             </div>
                           </div>
                         </div>
                       ))
                     ) : (
                       <div className="p-4 text-center text-slate-400 text-sm font-medium border border-dashed border-slate-200 rounded-xl">
                         Detail item tidak ditemukan.
                       </div>
                     )}
                   </div>
                </div>

                {/* Scroll indicator at bottom */}
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-center">
                  <span className="text-[10px] text-slate-400 font-medium">Scroll untuk melihat semua item</span>
                </div>

             </div>
          </div>
        )}

      </div>
    </div>
  );
}
