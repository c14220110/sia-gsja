'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

export default function ReviewLPJPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error'; message: string }>({ status: 'idle', message: '' });
  const [kegiatan, setKegiatan] = useState<any>(null);
  const [lpjHeader, setLpjHeader] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [catatan, setCatatan] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/kegiatan/${id}`).then(r => r.json()),
      fetch(`/api/kegiatan/${id}/lpj`).then(r => r.json()),
    ]).then(([keg, lpj]) => {
      if (keg.success) setKegiatan(keg.data);
      if (lpj.success) {
        setLpjHeader(lpj.data.header);
        setItems(lpj.data.items || []);
      }
      setLoading(false);
    });
  }, [id]);

  const penItems = useMemo(() => items.filter(i => i.jenis_anggaran === 'Penerimaan'), [items]);
  const kelItems = useMemo(() => items.filter(i => i.jenis_anggaran === 'Pengeluaran'), [items]);
  const totalP = useMemo(() => penItems.reduce((a, i) => a + i.jumlah * parseFloat(i.harga_satuan), 0), [penItems]);
  const totalK = useMemo(() => kelItems.reduce((a, i) => a + i.jumlah * parseFloat(i.harga_satuan), 0), [kelItems]);
  const sisa = totalP - totalK;

  const handleReview = async (action: 'setujui' | 'minta_revisi') => {
    if (action === 'minta_revisi' && !catatan.trim()) {
      setSubmitState({ status: 'error', message: 'Catatan revisi wajib diisi saat meminta revisi.' });
      return;
    }
    setSubmitState({ status: 'loading', message: action === 'setujui' ? 'Menyetujui LPJ...' : 'Mengirim permintaan revisi...' });
    try {
      const res = await fetch(`/api/kegiatan/${id}/lpj/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, catatan_reviewer: catatan }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitState({ status: 'success', message: json.message });
        setTimeout(() => router.push(`/kegiatan/${id}`), 1800);
      } else {
        setSubmitState({ status: 'error', message: json.message });
      }
    } catch (e: any) {
      setSubmitState({ status: 'error', message: 'Kesalahan jaringan: ' + e.message });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        Memuat data LPJ...
      </div>
    );
  }

  if (!lpjHeader) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
        <span className="material-icons-round text-5xl">assignment_late</span>
        <p className="font-semibold">LPJ belum diajukan oleh panitia.</p>
        <Link href={`/kegiatan/${id}`} className="text-sm text-indigo-600 hover:underline">← Kembali ke Detail Kegiatan</Link>
      </div>
    );
  }

  if (lpjHeader.status_lpj !== 'Menunggu Review') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
        <span className="material-icons-round text-5xl">info</span>
        <p className="font-semibold">Status LPJ saat ini: <strong className="text-slate-700">{lpjHeader.status_lpj}</strong></p>
        <p className="text-sm">Hanya LPJ berstatus "Menunggu Review" yang bisa direview.</p>
        <Link href={`/kegiatan/${id}`} className="text-sm text-indigo-600 hover:underline">← Kembali ke Detail Kegiatan</Link>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 pb-32">
      <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => setSubmitState({ status: 'idle', message: '' })} />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/kegiatan" className="hover:text-indigo-600">Daftar Kegiatan</Link>
        <span className="material-icons-round text-[16px]">chevron_right</span>
        <Link href={`/kegiatan/${id}`} className="hover:text-indigo-600">{kegiatan?.nama_kegiatan || `Kegiatan #${id}`}</Link>
        <span className="material-icons-round text-[16px]">chevron_right</span>
        <span className="font-semibold text-slate-700">Review LPJ</span>
      </div>

      {/* Header Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <span className="material-icons-round text-amber-500 text-2xl">fact_check</span>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black text-slate-800 font-['Inter']">Review LPJ</h1>
            <p className="text-xs text-slate-400 mt-0.5">{kegiatan?.nama_kegiatan} · {kegiatan?.kode_kegiatan}</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            ⏳ Menunggu Review
          </span>
        </div>

        {/* Laporan Naratif */}
        {lpjHeader.laporan_naratif && (
          <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Laporan Naratif / Catatan Umum</p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{lpjHeader.laporan_naratif}</p>
          </div>
        )}

        {/* Rincian Items */}
        <div className="rounded-xl border border-slate-200 overflow-hidden mb-6">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Rincian Keuangan LPJ</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="p-3 text-left w-[8%]">No</th>
                  <th className="p-3 text-left w-[20%]">COA</th>
                  <th className="p-3 text-left w-[25%]">Uraian</th>
                  <th className="p-3 text-center w-[8%]">Jumlah</th>
                  <th className="p-3 text-left w-[8%]">Satuan</th>
                  <th className="p-3 text-right w-[15%]">Harga Satuan</th>
                  <th className="p-3 text-right w-[16%]">Total</th>
                </tr>
              </thead>
              <tbody>
                {penItems.length > 0 && (
                  <tr><td colSpan={7} className="px-4 py-1.5 bg-emerald-50 border-b border-emerald-100 text-[10px] font-bold text-emerald-700">↑ PENERIMAAN</td></tr>
                )}
                {penItems.map((it, idx) => (
                  <tr key={it.id} className="border-b border-slate-100 hover:bg-emerald-50/30">
                    <td className="p-3 pl-5 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="p-3"><span className="text-[10px] text-slate-500 font-mono">{it.kode_akun}</span><br /><span className="text-xs text-slate-700">{it.nama_akun}</span></td>
                    <td className="p-3 text-xs text-slate-700">{it.uraian}{it.deskripsi && <span className="block text-[10px] text-slate-400 mt-0.5">{it.deskripsi}</span>}</td>
                    <td className="p-3 text-center text-xs">{it.jumlah}</td>
                    <td className="p-3 text-xs text-slate-500">{it.satuan || '-'}</td>
                    <td className="p-3 text-right font-mono text-xs">{fmt(parseFloat(it.harga_satuan))}</td>
                    <td className="p-3 text-right font-mono text-xs font-bold text-emerald-700">{fmt(it.jumlah * parseFloat(it.harga_satuan))}</td>
                  </tr>
                ))}
                {kelItems.length > 0 && (
                  <tr><td colSpan={7} className="px-4 py-1.5 bg-red-50 border-b border-red-100 border-t border-t-slate-200 text-[10px] font-bold text-red-700">↓ PENGELUARAN</td></tr>
                )}
                {kelItems.map((it, idx) => (
                  <tr key={it.id} className="border-b border-slate-100 hover:bg-red-50/30">
                    <td className="p-3 pl-5 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="p-3"><span className="text-[10px] text-slate-500 font-mono">{it.kode_akun}</span><br /><span className="text-xs text-slate-700">{it.nama_akun}</span></td>
                    <td className="p-3 text-xs text-slate-700">{it.uraian}{it.deskripsi && <span className="block text-[10px] text-slate-400 mt-0.5">{it.deskripsi}</span>}</td>
                    <td className="p-3 text-center text-xs">{it.jumlah}</td>
                    <td className="p-3 text-xs text-slate-500">{it.satuan || '-'}</td>
                    <td className="p-3 text-right font-mono text-xs">{fmt(parseFloat(it.harga_satuan))}</td>
                    <td className="p-3 text-right font-mono text-xs font-bold text-red-600">{fmt(it.jumlah * parseFloat(it.harga_satuan))}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400 text-sm">Tidak ada item rincian.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Summary Row */}
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-wrap gap-4 justify-end">
            {[
              ['Total Penerimaan', fmt(totalP), 'text-emerald-700'],
              ['Total Pengeluaran', `(${fmt(totalK)})`, 'text-red-600'],
              ['Sisa / Surplus', fmt(sisa), sisa >= 0 ? 'text-emerald-700 font-black' : 'text-red-600 font-black'],
            ].map(([label, value, cls]) => (
              <div key={String(label)} className="flex flex-col text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                <span className={`text-sm font-bold font-mono ${cls}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Panel Keputusan Reviewer */}
        <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 rounded-xl p-5">
          <p className="text-sm font-black text-slate-700 mb-1 flex items-center gap-2">
            <span className="material-icons-round text-indigo-500 text-[18px]">gavel</span>
            Keputusan Reviewer
          </p>
          <p className="text-xs text-slate-400 mb-4">Catatan wajib diisi jika meminta revisi. Opsional jika menyetujui.</p>
          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wide">Catatan untuk Panitia</label>
            <textarea
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
              rows={4}
              placeholder="Tulis catatan, temuan, atau alasan keputusan di sini..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => handleReview('minta_revisi')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-700 font-bold text-sm transition-colors"
            >
              <span className="material-icons-round text-[18px]">rate_review</span>
              Minta Revisi
            </button>
            <button
              onClick={() => handleReview('setujui')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors shadow-sm"
            >
              <span className="material-icons-round text-[18px]">check_circle</span>
              Setujui LPJ
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            ⚠️ Menyetujui LPJ akan secara otomatis mengubah status kegiatan menjadi <strong>Selesai</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
