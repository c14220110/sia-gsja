'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
const fmtDate = (d: string) => d ? new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d)) : '-';
const fmtTime = (t: string) => t ? t.substring(0, 5) : '-';

export default function ViewLPJPage() {
  const { id } = useParams<{ id: string }>();
  const [kegiatan, setKegiatan] = useState<any>(null);
  const [lpj, setLpj] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [raInfo, setRaInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/kegiatan/${id}`).then(r => r.json()),
      fetch(`/api/kegiatan/${id}/lpj`).then(r => r.json()),
    ]).then(([kRes, lpjRes]) => {
      if (kRes.success) setKegiatan(kRes.data);
      if (lpjRes.success) {
        setLpj(lpjRes.data.header);
        setRaInfo(lpjRes.data.ra_info || null);
        if (lpjRes.data.items?.length > 0) {
          setItems(lpjRes.data.items.map((it: any) => ({
            id: it.id,
            jenis: it.jenis_anggaran,
            coaLabel: `${it.kode_akun} — ${it.nama_akun}`,
            sumber_dana: it.sumber_dana,
            uraian: it.uraian,
            deskripsi: it.deskripsi || '',
            jumlah: it.jumlah,
            satuan: it.satuan || '',
            harga: parseFloat(it.harga_satuan),
            total: it.jumlah * parseFloat(it.harga_satuan),
          })));
        }
      }
      setLoading(false);
    });
  }, [id]);

  const totalP = useMemo(() => items.filter(i => i.jenis === 'Penerimaan').reduce((a, c) => a + c.total, 0), [items]);
  const totalK = useMemo(() => items.filter(i => i.jenis === 'Pengeluaran').reduce((a, c) => a + c.total, 0), [items]);
  const sisa = totalP - totalK;

  const statusColor = (s: string) => {
    if (s === 'Disetujui') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s === 'Menunggu Review') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  if (loading) return (
    <div className="w-full flex items-center justify-center py-32">
      <span className="material-icons-round animate-spin text-4xl text-slate-300">refresh</span>
    </div>
  );

  if (!lpj) return (
    <div className="w-full flex flex-col items-center justify-center py-32 gap-4">
      <span className="material-icons-round text-6xl text-slate-200">assignment_late</span>
      <p className="text-slate-500 font-medium">LPJ belum tersedia untuk kegiatan ini.</p>
      <Link href="/kegiatan" className="px-5 py-2.5 bg-slate-700 text-white rounded-lg text-sm font-bold hover:bg-slate-800">← Kembali ke Daftar</Link>
    </div>
  );

  return (
    <div className="w-full flex flex-col gap-6 pb-16">

      {/* Breadcrumb & Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/kegiatan" className="hover:text-indigo-600">Daftar Kegiatan</Link>
          <span className="material-icons-round text-[16px]">chevron_right</span>
          <Link href={`/kegiatan/${id}`} className="hover:text-indigo-600 truncate max-w-[180px]">{kegiatan?.nama_kegiatan || 'Detail'}</Link>
          <span className="material-icons-round text-[16px]">chevron_right</span>
          <span className="font-semibold text-slate-700">Laporan LPJ</span>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Link href={`/kegiatan/${id}/lpj`} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
            <span className="material-icons-round text-[16px]">edit</span> Edit LPJ
          </Link>
          <button onClick={() => window.print()} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-bold hover:bg-slate-800 flex items-center gap-1.5 transition-colors shadow-sm">
            <span className="material-icons-round text-[16px]">print</span> Cetak / PDF
          </button>
        </div>
      </div>

      {/* ─── PRINT DOCUMENT ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-none print:rounded-none">

        {/* Header Dokumen */}
        <div className="p-8 border-b border-slate-100">
          <div className="flex items-start justify-between gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Laporan Pertanggungjawaban Kegiatan</span>
              <h1 className="text-2xl font-black text-slate-900 font-['Inter'] leading-tight">{kegiatan?.nama_kegiatan}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="font-mono text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded border">{kegiatan?.kode_kegiatan}</span>
                {lpj?.status_lpj && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColor(lpj.status_lpj)}`}>{lpj.status_lpj}</span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-slate-400">Tanggal Cetak</p>
              <p className="text-sm font-semibold text-slate-700">{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</p>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-6 border-b border-slate-100 bg-slate-50/50">
          {[
            { label: 'Tanggal Pelaksanaan', value: fmtDate(kegiatan?.tanggal_mulai) },
            { label: 'Waktu', value: `${fmtTime(kegiatan?.waktu_mulai)} – ${fmtTime(kegiatan?.waktu_selesai)} WIB` },
            { label: 'Lokasi', value: kegiatan?.lokasi_kegiatan || '-' },
            { label: 'Pelaksana', value: kegiatan?.nama_komisi || kegiatan?.nama_departemen || kegiatan?.nama_satelit || 'Pusat' },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
              <span className="text-sm font-semibold text-slate-800">{value}</span>
            </div>
          ))}
        </div>

        {/* RA Info */}
        {raInfo && (
          <div className="px-8 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center gap-3">
            <span className="material-icons-round text-emerald-600 text-[18px]">request_quote</span>
            <div className="flex-1">
              <span className="text-xs font-bold text-emerald-800">Rancangan Anggaran: </span>
              <span className="text-xs text-emerald-700">{raInfo.kode} — {raInfo.nama}</span>
              <span className="text-xs text-emerald-500 ml-2">· Pola: {raInfo.pola}</span>
            </div>
            {raInfo.pola === 'Bertahap' && (
              <span className="text-xs font-mono font-bold text-emerald-700">Total Disetujui: {fmt(raInfo.total_disetujui)}</span>
            )}
          </div>
        )}

        {/* Laporan Naratif */}
        {lpj?.laporan_naratif && (
          <div className="px-8 py-5 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Laporan Naratif</p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{lpj.laporan_naratif}</p>
          </div>
        )}

        {/* Rincian Keuangan */}
        <div className="px-8 pt-6 pb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Rincian Keuangan</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-8 py-3 w-[30%]">Uraian</th>
                <th className="px-4 py-3 w-[22%]">Akun COA</th>
                <th className="px-4 py-3 w-[12%]">Sumber Dana</th>
                <th className="px-4 py-3 text-center">Jml</th>
                <th className="px-4 py-3">Satuan</th>
                <th className="px-4 py-3 text-right">Harga/Sat</th>
                <th className="px-8 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} className="px-8 py-12 text-center text-slate-400 italic">Tidak ada rincian keuangan.</td></tr>
              ) : (
                <>
                  {['Penerimaan', 'Pengeluaran'].map(jenis => {
                    const rows = items.filter(i => i.jenis === jenis);
                    if (!rows.length) return null;
                    return (
                      <React.Fragment key={jenis}>
                        <tr>
                          <td colSpan={7} className={`px-8 py-2 text-[10px] font-bold tracking-widest uppercase ${jenis === 'Penerimaan' ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-white'}`}>
                            {jenis === 'Penerimaan' ? '↑ PENERIMAAN' : '↓ PENGELUARAN'}
                          </td>
                        </tr>
                        {rows.map((item, idx) => (
                          <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="px-8 py-3 text-sm font-semibold text-slate-800">
                              {idx + 1}. {item.uraian}
                              {item.deskripsi && <p className="text-xs font-normal text-slate-400">{item.deskripsi}</p>}
                            </td>
                            <td className="px-4 py-3 text-xs font-mono text-slate-500">{item.coaLabel}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{item.sumber_dana}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-center">{item.jumlah}</td>
                            <td className="px-4 py-3 text-sm text-slate-500">{item.satuan}</td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-slate-600">{fmt(item.harga)}</td>
                            <td className={`px-8 py-3 text-sm text-right font-bold font-mono ${jenis === 'Penerimaan' ? 'text-emerald-600' : 'text-slate-800'}`}>{fmt(item.total)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        <div className="bg-slate-900 px-8 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-slate-400 text-xs print:hidden">LPJ · {kegiatan?.kode_kegiatan}</div>
          <div className="flex gap-6 flex-wrap justify-end">
            {[
              ['Total Penerimaan', fmt(totalP), 'text-emerald-400'],
              ['Total Pengeluaran', `(${fmt(totalK)})`, 'text-red-400'],
              ['Margin', totalP > 0 ? `${(((totalP - totalK) / totalP) * 100).toFixed(1)}%` : '-', 'text-white'],
              ['Sisa / Surplus', fmt(sisa), sisa >= 0 ? 'text-emerald-400' : 'text-red-400'],
            ].map(([label, value, cls]) => (
              <div key={String(label)} className="flex flex-col text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                <span className={`text-sm font-bold font-mono ${cls}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tanda Tangan (print only) */}
        <div className="px-8 py-8 hidden print:grid grid-cols-3 gap-8 border-t border-slate-200">
          {['Dibuat Oleh', 'Mengetahui', 'Menyetujui'].map(label => (
            <div key={label} className="flex flex-col gap-16">
              <span className="text-xs text-slate-500">{label},</span>
              <div className="border-b border-slate-400 w-full" />
              <span className="text-xs text-slate-500">(.................................)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:shadow-none, .print\\:shadow-none * { visibility: visible; }
          .print\\:shadow-none { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
          .print\\:grid { display: grid !important; }
          @page { margin: 20mm; }
        }
      `}</style>
    </div>
  );
}
