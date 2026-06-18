'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PenggajianPage() {
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    total_payroll_amount: 0,
    total_payroll_count: 0,
    menunggu_approval_amount: 0,
    menunggu_approval_count: 0,
    sudah_dibayar_amount: 0,
    sudah_dibayar_count: 0
  });
  const [loading, setLoading] = useState(true);

  // Saringan
  const [filterBulan, setFilterBulan] = useState('');
  const [filterTahun, setFilterTahun] = useState('');
  const [filterSatelit, setFilterSatelit] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Ambilin Opsinya
  useEffect(() => {
    fetch('/api/options?type=satelit')
      .then(res => res.json())
      .then(res => {
        if (res.success) setSatelitOptions(res.data);
      })
      .catch(console.error);
  }, []);

  const fetchRuns = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterBulan) params.append('bulan', filterBulan);
    if (filterTahun) params.append('tahun', filterTahun);
    if (filterSatelit) params.append('satelit_id', filterSatelit);
    if (filterStatus) params.append('status', filterStatus);

    fetch(`/api/payroll/runs?${params.toString()}`)
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setData(res.data);
          setSummary(res.summary);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBulan, filterTahun, filterSatelit, filterStatus]);

  const handleAjukanApproval = async (runId: number) => {
    if (!confirm('Ajukan run penggajian ini untuk approval? Pastikan semua data sudah diperiksa.')) return;
    setSubmittingId(runId);
    setOpenMenuId(null);
    try {
      const res = await fetch(`/api/payroll/runs/${runId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catatan_pembuat: '' }),
      });
      const result = await res.json();
      if (result.success) {
        setActionMsg({ type: 'success', text: 'Run penggajian berhasil diajukan untuk approval.' });
        fetchRuns();
      } else {
        setActionMsg({ type: 'error', text: result.message || 'Gagal mengajukan approval.' });
      }
    } catch {
      setActionMsg({ type: 'error', text: 'Terjadi kesalahan koneksi.' });
    } finally {
      setSubmittingId(null);
      setTimeout(() => setActionMsg(null), 4000);
    }
  };

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
  };

  const getBulanName = (bulanIdx: number) => {
    const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return namaBulan[bulanIdx - 1] || '-';
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Draft': return <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold leading-tight">Draft</span>;
      case 'Menunggu Approval': return <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold leading-tight flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>Menunggu Approval</span>;
      case 'Disetujui': return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold leading-tight">Disetujui</span>;
      case 'Ditolak': return <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold leading-tight">Ditolak</span>;
      case 'Dibayar': return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold leading-tight">Dibayar</span>;
      default: return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold leading-tight">{status}</span>;
    }
  };

  return (
    <div className="w-full flex flex-col gap-8 pb-10">

      {/* Action feedback */}
      {actionMsg && (
        <div className={`px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-sans animate-in fade-in ${actionMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-700'}`}>
          <span className="material-icons-round text-[16px]">{actionMsg.type === 'success' ? 'check_circle' : 'error_outline'}</span>
          {actionMsg.text}
        </div>
      )}
      
      {/* Header Section */}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Daftar Run Penggajian</h1>
          <div className="text-slate-500 text-base font-medium font-sans leading-6">Kelola dan pantau proses penggajian seluruh unit</div>
        </div>
        <Link href="/pegawai/penggajian/new" className="px-5 py-2.5 bg-slate-700 rounded-lg flex justify-start items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none">
          <span className="material-icons-round text-white text-[20px]">add</span>
          <span className="text-white text-sm font-bold font-sans leading-5">Buat Payroll Baru</span>
        </Link>
      </div>

      {/* Statistic Cards */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total Payroll Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-indigo-600/10 rounded-xl flex justify-center items-center shrink-0">
             <span className="material-icons-round text-indigo-700 text-3xl">account_balance_wallet</span>
          </div>
          <div className="flex flex-col truncate">
            <span className="text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Total Netto Bulan Ini</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-2xl font-bold font-sans truncate">{formatRupiah(summary.total_payroll_amount)}</span>
            </div>
            <span className="text-slate-400 text-xs mt-1 font-medium">{summary.total_payroll_count} Run</span>
          </div>
        </div>

        {/* Menunggu Approval Card */}
        <div className={`p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow relative overflow-hidden ${summary.menunggu_approval_count > 0 ? 'border-t-4 border-t-amber-400' : ''}`}>
          <div className="w-14 h-14 bg-amber-500/10 rounded-xl flex justify-center items-center shrink-0">
             <span className="material-icons-round text-amber-600 text-3xl">pending_actions</span>
          </div>
          <div className="flex flex-col truncate">
            <span className="text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Menunggu Approval</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-2xl font-bold font-sans">{summary.menunggu_approval_count} Run</span>
              {summary.menunggu_approval_count > 0 && <span className="text-[10px] font-bold text-amber-600 mb-1 ml-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">Action Req</span>}
            </div>
            <span className="text-slate-400 text-xs mt-1 font-medium truncate">{formatRupiah(summary.menunggu_approval_amount)}</span>
          </div>
        </div>

        {/* Sudah Dibayar Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-xl flex justify-center items-center shrink-0">
             <span className="material-icons-round text-emerald-600 text-3xl">check_circle</span>
          </div>
          <div className="flex flex-col truncate">
            <span className="text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Sudah Dibayar</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-2xl font-bold font-sans truncate">{formatRupiah(summary.sudah_dibayar_amount)}</span>
            </div>
            <span className="text-slate-400 text-xs mt-1 font-medium">{summary.sudah_dibayar_count} Run</span>
          </div>
        </div>

      </div>

      {/* Filter Options */}
      <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-sm">
        
        {/* Search Bar - Disabled contextually for Runs if needed, but keeping for design consistency */}
        <div className="flex-1 min-w-[250px] relative flex items-center">
          <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
          <input 
            type="text" 
            placeholder="Cari run penggajian..."
            disabled
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-not-allowed opacity-70 text-slate-700 font-sans text-sm"
          />
        </div>

        {/* Filter Bulan */}
        <div className="relative min-w-[150px]">
          <select 
            value={filterBulan}
            onChange={(e) => setFilterBulan(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
          >
            <option value="">Semua Bulan</option>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(b => (
              <option key={b} value={b}>{getBulanName(b)}</option>
            ))}
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        {/* Filter Tahun */}
        <div className="relative min-w-[150px]">
          <select 
            value={filterTahun}
            onChange={(e) => setFilterTahun(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
          >
            <option value="">Semua Tahun</option>
            {[2026, 2025, 2024].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        {/* Filter Unit */}
        <div className="relative min-w-[180px]">
          <select 
            value={filterSatelit}
            onChange={(e) => setFilterSatelit(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
          >
            <option value="">Semua Unit</option>
            {satelitOptions.map((s: any) => (
              <option key={s.id} value={s.id}>{s.nama_satelit}</option>
            ))}
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        {/* Filter Status */}
        <div className="relative min-w-[180px]">
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="Draft">Draft</option>
            <option value="Menunggu Approval">Menunggu Approval</option>
            <option value="Disetujui">Disetujui</option>
            <option value="Ditolak">Ditolak</option>
            <option value="Dibayar">Dibayar</option>
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

      </div>

      {/* Data Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative z-0">
        <div className="w-full overflow-x-auto pb-4">
          <div className="min-w-[1150px] flex flex-col">
            {/* Table Header BP Compliant */}
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
              <div className="w-32 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Periode</div>
              <div className="w-32 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Unit / Satelit</div>
              <div className="w-40 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Terhubung RA</div>
              <div className="w-24 shrink-0 text-right text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Pegawai</div>
              <div className="flex-1 min-w-[140px] text-right text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Total Bruto</div>
              <div className="flex-1 min-w-[140px] text-right text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Total Potongan</div>
              <div className="flex-1 min-w-[140px] text-right text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Total Netto</div>
              <div className="w-32 shrink-0 text-center text-slate-500 text-xs font-bold font-sans uppercase tracking-wider px-2">Status</div>
              <div className="w-20 shrink-0 text-right text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Aksi</div>
            </div>

            {/* Table Body */}
            <div className="min-h-64">
              {loading ? (
                <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
                  <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin mb-4"></div>
                  <span className="text-sm font-sans">Memuat data...</span>
                </div>
              ) : data.length === 0 ? (
                <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
                  <span className="material-icons-round text-5xl mb-2 text-slate-300">payments</span>
                  <span className="text-sm font-sans text-center max-w-[300px]">Belum ada data payroll run. Cek filter atau buat baru.</span>
                </div>
              ) : (
                data.map((item, idx) => {
                  const isLastRows = data.length > 2 && idx >= data.length - 2;
                  return (
                    <div key={item.id} className={`w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors relative ${openMenuId === item.id ? 'z-50' : 'z-10'}`}>
                      
                      <div className="w-32 shrink-0 text-slate-900 text-sm font-bold font-sans pr-2">
                         {getBulanName(item.bulan)} {item.tahun}
                      </div>
                      
                      <div className="w-32 shrink-0 flex flex-col pr-2">
                        <span className="text-slate-600 text-sm font-medium font-sans truncate">{item.unit || '-'}</span>
                      </div>
                      
                      <div className="w-40 shrink-0 pr-2">
                        {item.kode_ra ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-sans font-bold text-slate-600 truncate max-w-full" title="Sisa Plafon Anggaran: Cukup">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="truncate">{item.kode_ra}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic font-sans">Belum di-link</span>
                        )}
                      </div>
                      
                      <div className="w-24 shrink-0 text-slate-600 text-sm font-medium font-sans text-right pr-4">
                         {item.jumlah_pegawai}
                      </div>
                      
                      <div className="flex-1 min-w-[140px] text-right text-slate-700 text-sm font-bold font-sans pr-2 tracking-tight">
                         {formatRupiah(parseFloat(item.total_bruto))}
                      </div>

                      <div className="flex-1 min-w-[140px] text-right text-slate-500 text-sm font-bold font-sans pr-2 tracking-tight">
                         {formatRupiah(parseFloat(item.total_potongan))}
                      </div>

                      <div className="flex-1 min-w-[140px] text-right text-emerald-600 text-sm font-bold font-sans pr-4 tracking-tight">
                         {formatRupiah(parseFloat(item.total_netto))}
                      </div>
                      
                      <div className="w-32 shrink-0 flex justify-center px-2">
                         {getStatusBadge(item.status)}
                      </div>
                      
                      <div className="w-20 shrink-0 flex justify-end gap-2 text-slate-400 relative">
                         <button 
                          onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                          className="hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded transition-colors"
                         >
                           <span className="material-icons-round text-[24px]">more_horiz</span>
                         </button>

                         {openMenuId === item.id && (
                           <>
                             <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                             <div className={`absolute right-0 ${isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'} w-48 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-slate-200 z-50 py-1 overflow-visible`}>
                               <Link 
                                 href={`/pegawai/penggajian/${item.id}`}
                                 className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans"
                               >
                                 <span className="material-icons-round text-[18px] text-slate-400">visibility</span> Lihat Detail
                               </Link>
                               
                               {item.status === 'Draft' && (
                                 <Link 
                                   href={`/pegawai/penggajian/${item.id}/edit`}
                                   className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans"
                                 >
                                   <span className="material-icons-round text-[18px] text-slate-400">edit</span> Edit Setup
                                 </Link>
                               )}

                               <div className="w-full h-px bg-slate-100 my-1"></div>
                                                              {item.status === 'Draft' && (
                                  <button
                                    onClick={() => handleAjukanApproval(item.id)}
                                    disabled={!item.kode_ra || submittingId === item.id}
                                    title={!item.kode_ra ? 'Pilih RA terlebih dahulu sebelum mengajukan approval' : ''}
                                    className={`w-full text-left px-4 py-2 transition-colors flex items-center gap-3 text-sm font-sans font-bold ${!item.kode_ra || submittingId === item.id ? 'text-slate-400 cursor-not-allowed bg-slate-50/50' : 'hover:bg-blue-50 hover:text-blue-700 text-blue-600'}`}
                                  >
                                    {submittingId === item.id ? (
                                      <span className="material-icons-round text-[18px] text-slate-400 animate-spin">sync</span>
                                    ) : (
                                      <span className={`material-icons-round text-[18px] ${!item.kode_ra ? 'text-slate-300' : 'text-blue-500'}`}>send</span>
                                    )}
                                    {submittingId === item.id ? 'Mengajukan...' : 'Ajukan Approval'}
                                  </button>
                                )}

                               {item.status === 'Menunggu Approval' && (
                                 <button className="w-full text-left px-4 py-2 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-3 text-sm text-blue-600 font-sans font-bold">
                                   <span className="material-icons-round text-[18px] text-blue-500">task_alt</span> Approve
                                 </button>
                               )}

                               {item.status === 'Disetujui' && (
                                 <button className="w-full text-left px-4 py-2 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center gap-3 text-sm text-emerald-600 font-sans font-bold">
                                   <span className="material-icons-round text-[18px] text-emerald-500">payments</span> Bayar
                                 </button>
                               )}
                             </div>
                           </>
                         )}
                        </div>
                      </div>
                    );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
