'use client';
import React, { useState, useEffect, useMemo, use } from 'react';
import Link from 'next/link';

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

export default function ViewAnggaranPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/anggaran/tahunan/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setData(json.data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [id]);

  const items = data?.items || [];
  const totalP = useMemo(() => items.filter((i:any) => i.jenis_anggaran === 'Penerimaan').reduce((a:number,c:any) => a + Number(c.total), 0), [items]);
  const totalK = useMemo(() => items.filter((i:any) => i.jenis_anggaran === 'Pengeluaran').reduce((a:number,c:any) => a + Number(c.total), 0), [items]);
  const margin = totalP > 0 ? ((totalP - totalK) / totalP) * 100 : 0;
  
  const grouped = useMemo(() => {
    const g: { [k: string]: { name: string; pen: any[]; kel: any[] } } = {};
    items.forEach((i: any) => {
      const kId = i.kegiatan_id || 'umum';
      if (!g[kId]) g[kId] = { name: i.nama_kegiatan || 'Anggaran Umum', pen: [], kel: [] };
      if (i.jenis_anggaran === 'Penerimaan') g[kId].pen.push(i);
      else g[kId].kel.push(i);
    });
    return g;
  }, [items]);

  if (isLoading) {
    return <div className="p-10 text-center text-slate-500 flex flex-col items-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>Memuat Detail Anggaran...</div>;
  }

  if (!data) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-20">
        <span className="material-icons-round text-6xl text-slate-300 mb-4">search_off</span>
        <h1 className="text-2xl font-black text-slate-800 mb-2">Dokumen Tidak Ditemukan</h1>
        <p className="text-slate-500 mb-6">Anggaran tahunan yang Anda cari tidak tersedia atau telah dihapus.</p>
        <Link href="/anggaran/tahunan" className="px-6 py-2.5 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition-colors">Kembali ke Daftar</Link>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 pb-32">
      {/* Header Area */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-['Inter'] leading-4">
          <span className="text-slate-500">Anggaran & Proposal</span>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <Link href="/anggaran/tahunan" className="text-slate-500 hover:text-blue-600">Daftar Anggaran Tahunan</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Detail Anggaran</span>
        </div>
        
        <div className="self-stretch inline-flex justify-between items-end">
          <div className="inline-flex gap-4 items-center">
            <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">Detail Anggaran</h1>
            <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200 flex items-center gap-1 mt-1 text-xs font-bold uppercase tracking-wide">
               {data.status}
            </div>
          </div>
          <div className="text-slate-500 text-sm font-medium font-['Inter'] flex gap-1 items-center">
            <span className="material-icons-round text-lg text-slate-400">qr_code</span> ID: <span className="text-slate-700 font-bold">{data.kode_dokumen}</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-5 mt-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Satelit</div>
            <div className="text-sm font-bold text-slate-800">{data.nama_satelit}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Komisi</div>
            <div className="text-sm font-bold text-slate-800">{data.nama_komisi || 'Umum (Non-Komisi)'}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tahun Anggaran</div>
            <div className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded w-max">{data.tahun}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Dibuat Oleh</div>
            <div className="text-sm font-bold text-slate-800">{data.pembuat || 'Sistem'}</div>
          </div>
        </div>
      </div>

      {/* Rincian Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-base font-bold text-slate-800">Rincian Anggaran</h2>
          <button className="w-8 h-8 rounded border border-slate-300 flex justify-center items-center text-slate-500 hover:bg-slate-100"><span className="material-icons-round text-[18px]">print</span></button>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-xs font-bold text-slate-500 tracking-wider">
                <th className="p-4 w-[30%]">URAIAN</th><th className="p-4 w-[18%]">AKUN</th><th className="p-4 w-[12%]">SUMBER DANA</th>
                <th className="p-4 w-[6%] text-center">JML</th><th className="p-4 w-[8%] text-center">SATUAN</th>
                <th className="p-4 w-[12%] text-right">HARGA</th><th className="p-4 w-[14%] text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-slate-400">Tidak ada rincian data</td></tr>
              ) : Object.entries(grouped).map(([kid, g], gi) => (
                <React.Fragment key={kid}>
                  <tr className="bg-slate-800 text-white"><td colSpan={7} className="px-4 py-2 text-xs font-bold tracking-widest uppercase">{g.name}</td></tr>
                  {g.pen.length > 0 && <><tr><td colSpan={7} className="px-4 py-1.5 bg-emerald-50 border-b border-emerald-100 text-[10px] font-bold text-emerald-700">↑ PENERIMAAN</td></tr>
                  {g.pen.map((item, idx) => <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 pl-8 text-sm font-semibold text-slate-800">{gi + 1}.{idx + 1}. {item.uraian}<p className="text-xs font-normal text-slate-400">{item.deskripsi}</p></td>
                    <td className="p-4 text-xs font-mono text-slate-500">{item.kode_akun} — {item.nama_akun}</td>
                    <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${item.sumber_dana === 'Plafon Pusat' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{item.sumber_dana}</span></td>
                    <td className="p-4 text-sm text-center font-medium">{item.jumlah}</td><td className="p-4 text-sm text-center text-slate-600">{item.satuan}</td>
                    <td className="p-4 text-sm text-right font-mono text-slate-700">{fmt(Number(item.harga_satuan))}</td>
                    <td className="p-4 text-sm text-right font-bold font-mono text-emerald-600">{fmt(Number(item.total))}</td>
                  </tr>)}</>}
                  {g.kel.length > 0 && <><tr><td colSpan={7} className="px-4 py-1.5 bg-red-50 border-b border-red-100 border-t border-t-slate-200 text-[10px] font-bold text-red-700">↓ PENGELUARAN</td></tr>
                  {g.kel.map((item, idx) => <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 pl-8 text-sm font-semibold text-slate-800">{gi + 1}.{g.pen.length + idx + 1}. {item.uraian}<p className="text-xs font-normal text-slate-400">{item.deskripsi}</p></td>
                    <td className="p-4 text-xs font-mono text-slate-500">{item.kode_akun} — {item.nama_akun}</td>
                    <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${item.sumber_dana === 'Plafon Pusat' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{item.sumber_dana}</span></td>
                    <td className="p-4 text-sm text-center font-medium">{item.jumlah}</td><td className="p-4 text-sm text-center text-slate-600">{item.satuan}</td>
                    <td className="p-4 text-sm text-right font-mono text-slate-700">{fmt(Number(item.harga_satuan))}</td>
                    <td className="p-4 text-sm text-right font-bold font-mono text-slate-800">{fmt(Number(item.total))}</td>
                  </tr>)}</>}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-900 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-3 w-full md:w-auto">
            {['Draft', 'Ditolak'].includes(data.status) && (
              <Link href={`/anggaran/tahunan/edit/${id}`} className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors text-sm flex items-center gap-2 shadow-sm">
                <span className="material-icons-round text-[18px]">edit</span> Edit Anggaran
              </Link>
            )}
            {/* TODO: Add Review button for Gembala / Bendahara here */}
          </div>
          <div className="flex gap-5 overflow-x-auto">
            {[['Total Penerimaan', fmt(totalP), 'text-emerald-400'], ['Total Pengeluaran', `(${fmt(totalK)})`, 'text-red-400'], ['Margin', `${margin.toFixed(1)}%`, 'text-white'], ['Total Estimasi', fmt(totalP - totalK), totalP - totalK >= 0 ? 'text-emerald-400' : 'text-red-400']].map(([label, value, cls], i, arr) => (
              <React.Fragment key={label}>
                <div className="flex flex-col text-right shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                  <span className={`text-sm font-bold font-mono ${cls}`}>{value}</span>
                </div>
                {i < arr.length - 1 && <div className="w-px h-8 bg-slate-700 shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
