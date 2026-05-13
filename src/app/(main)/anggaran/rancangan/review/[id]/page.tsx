'use client';
import React, { useState, useEffect, useMemo, use } from 'react';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

type ItemDecision = {
  detail_id: string;
  status: 'ACC' | 'Ditolak' | 'Revisi' | '';
  catatan: string;
  nominal_disetujui?: number | null; // null = use full amount
};

// Role 2 = MAJELIS (12 anggota), Role 3 = Gembala Sidang, Role 5 = Bendahara Pusat
const REVIEWER_ROLES = [1, 2, 3, 5];

export default function ReviewAnggaranPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [catatanUmum, setCatatanUmum] = useState('');
  const [decisions, setDecisions] = useState<ItemDecision[]>([]);
  const [submitState, setSubmitState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/anggaran/tahunan/${id}`).then(r => r.json()).catch(() => ({ success: false })),
      fetch('/api/auth/me').then(r => r.json()).catch(() => ({}))
    ]).then(([resData, resUser]) => {
      if (resData.success) {
        setData(resData.data);
        // Initialize decisions for each item
        const items = resData.data?.items || [];
        setDecisions(items.map((item: any) => ({
          detail_id: item.id,
          // Items not yet reviewed have status_item 'Menunggu Review' — treat as undecided (empty)
          status: ['ACC', 'ACC_DIPOTONG', 'Ditolak', 'Revisi'].includes(item.status_item)
            ? (item.status_item === 'ACC_DIPOTONG' ? 'ACC' : item.status_item) // ACC_DIPOTONG → ACC in UI
            : '',
          catatan: item.catatan_reviewer || '',
          // Preserve nominal_disetujui from DB for already-reviewed items
          nominal_disetujui: item.nominal_disetujui != null
            ? parseFloat(item.nominal_disetujui)
            : (parseFloat(item.total) || 0),
        })));
      }
      if (resUser?.role_id) setUserData(resUser);
      setIsLoading(false);
    });
  }, [id]);

  const items = data?.items || [];
  const penItems = useMemo(() => items.filter((i: any) => i.jenis_anggaran === 'Penerimaan'), [items]);
  const kelItems = useMemo(() => items.filter((i: any) => i.jenis_anggaran === 'Pengeluaran'), [items]);
  const totalP = useMemo(() => penItems.reduce((a: number, c: any) => a + Number(c.total), 0), [penItems]);
  const totalK = useMemo(() => kelItems.reduce((a: number, c: any) => a + Number(c.total), 0), [kelItems]);

  // Summary stats — 'undecided' = belum ada keputusan (status kosong atau masih 'Menunggu Review' dari DB)
  const DECIDED_STATUSES = ['ACC', 'Ditolak', 'Revisi'];
  const accCount     = decisions.filter(d => d.status === 'ACC').length;
  const tolakCount   = decisions.filter(d => d.status === 'Ditolak').length;
  const revisiCount  = decisions.filter(d => d.status === 'Revisi').length;
  const undecidedCount = decisions.filter(d => !DECIDED_STATUSES.includes(d.status)).length;

  // Cek apakah ada item ACC yang nominalnya dipotong (nominal < total asli)
  // Kondisi ini menentukan apakah aksi harus "Setujui Sebagian" meski semua item = ACC
  const hasCut = decisions.some(d => {
    if (d.status !== 'ACC') return false;
    const item = items.find((i: any) => i.id === d.detail_id);
    const original = parseFloat(item?.total) || 0;
    const nominal = d.nominal_disetujui ?? original;
    return nominal < original;
  });

  const isReviewer = userData ? REVIEWER_ROLES.includes(userData.role_id) : false;
  const isReviewable = data?.status === 'Menunggu Review';

  const updateDecision = (detailId: string, field: keyof ItemDecision, value: any) => {
    setDecisions(prev => prev.map(d => d.detail_id === detailId ? { ...d, [field]: value } : d));
  };

  const bulkSetAll = (status: 'ACC' | 'Ditolak' | 'Revisi') => {
    setDecisions(prev => prev.map(d => {
      const item = items.find((i: any) => i.id === d.detail_id);
      return {
        ...d,
        status,
        nominal_disetujui: status === 'ACC' ? (parseFloat(item?.total) || 0) : null,
      };
    }));
  };

  const handleSubmitReview = async (action: string) => {
    setConfirmAction(null);
    setSubmitState({ status: 'loading', message: 'Menyimpan keputusan review...' });
    // Validate 1: semua item harus sudah diputuskan
    const stillUndecided = decisions.filter(d => !DECIDED_STATUSES.includes(d.status));
    if (stillUndecided.length > 0) {
      setSubmitState({ status: 'error', message: `${stillUndecided.length} item belum mendapat keputusan. Selesaikan semua item sebelum submit.` });
      return;
    }
    // Validate 2: catatan wajib diisi untuk item yang dipotong nominalnya
    const cutWithoutCatatan = decisions.filter(d => {
      if (d.status !== 'ACC') return false;
      const item = items.find((i: any) => i.id === d.detail_id);
      const original = parseFloat(item?.total) || 0;
      const nominal = d.nominal_disetujui ?? original;
      return nominal < original && !d.catatan;
    });
    if (cutWithoutCatatan.length > 0) {
      setSubmitState({ status: 'error', message: `${cutWithoutCatatan.length} item dipotong nominalnya tanpa catatan. Wajib diisi alasan pemotongan.` });
      return;
    }

    try {
      const res = await fetch(`/api/anggaran/tahunan/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          catatan_reviewer: catatanUmum,
          item_decisions: decisions.filter(d => d.status).map(d => ({
            ...d,
            nominal_disetujui: d.nominal_disetujui ?? null,
          })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitState({ status: 'success', message: json.message });
        setTimeout(() => { window.location.href = '/anggaran/rancangan'; }, 2000);
      } else {
        setSubmitState({ status: 'error', message: json.message || 'Gagal menyimpan review.' });
      }
    } catch {
      setSubmitState({ status: 'error', message: 'Gagal terhubung ke server.' });
    }
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'ACC': return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      case 'ACC_DIPOTONG': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'Ditolak': return 'bg-red-100 text-red-700 border-red-300';
      case 'Revisi': return 'bg-amber-100 text-amber-700 border-amber-300';
      default: return 'bg-slate-100 text-slate-500 border-slate-300';
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center text-slate-500 flex flex-col items-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>Memuat data review...</div>;
  }

  if (!data || !isReviewer) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-20">
        <span className="material-icons-round text-6xl text-red-200 mb-4">gpp_bad</span>
        <h1 className="text-2xl font-black text-slate-800 mb-2">{!data ? 'Dokumen Tidak Ditemukan' : 'Akses Ditolak'}</h1>
        <p className="text-slate-500 mb-6">{!data ? 'RA yang Anda cari tidak tersedia.' : 'Hanya Majelis / Super Admin yang dapat melakukan review.'}</p>
        <Link href="/anggaran/rancangan" className="px-6 py-2.5 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition-colors">Kembali ke Daftar</Link>
      </div>
    );
  }

  if (!isReviewable) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-20">
        <span className="material-icons-round text-6xl text-amber-200 mb-4">info</span>
        <h1 className="text-2xl font-black text-slate-800 mb-2">Tidak Bisa Direview</h1>
        <p className="text-slate-500 mb-6">Status RA saat ini: <strong>{data.status}</strong>. Hanya RA berstatus &quot;Menunggu Review&quot; yang dapat direview.</p>
        <Link href={`/anggaran/rancangan/view/${id}`} className="px-6 py-2.5 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition-colors">Lihat Detail</Link>
      </div>
    );
  }

  const renderItemRow = (item: any, idx: number, type: 'pen' | 'kel') => {
    const dec = decisions.find(d => d.detail_id === item.id);
    const currentStatus = dec?.status || '';
    const originalTotal = parseFloat(item.total) || 0;
    const nominalValue = dec?.nominal_disetujui ?? originalTotal;
    const isCut = currentStatus === 'ACC' && nominalValue < originalTotal;
    const cutAmount = originalTotal - nominalValue;

    return (
      <tr key={item.id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${currentStatus === 'ACC' ? 'bg-emerald-50/30' : currentStatus === 'Ditolak' ? 'bg-red-50/30' : currentStatus === 'Revisi' ? 'bg-amber-50/30' : ''}`}>
        <td className="p-4 pl-6 text-sm font-semibold text-slate-800 align-top">
          {idx + 1}. {item.uraian}
          <p className="text-xs font-normal text-slate-400 mt-0.5">{item.deskripsi}</p>
        </td>
        <td className="p-4 text-xs font-mono text-slate-500 align-top">{item.kode_akun} — {item.nama_akun}</td>
        <td className="p-4 align-top">
          <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap ${item.sumber_dana === 'Plafon Pusat' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{item.sumber_dana}</span>
        </td>
        <td className="p-4 text-sm text-center font-medium align-top">{item.jumlah}</td>
        <td className="p-4 text-sm text-center text-slate-600 align-top">{item.satuan}</td>
        <td className={`p-4 text-sm text-right font-bold font-mono align-top ${type === 'pen' ? 'text-emerald-600' : 'text-slate-800'}`}>{fmt(originalTotal)}</td>

        {/* Keputusan */}
        <td className="p-3 align-top">
          <select
            value={currentStatus}
            onChange={e => {
              updateDecision(item.id, 'status', e.target.value);
              // Reset nominal when changing away from ACC
              if (e.target.value !== 'ACC') updateDecision(item.id, 'nominal_disetujui', null);
              else updateDecision(item.id, 'nominal_disetujui', originalTotal);
            }}
            className={`w-full px-2.5 py-2 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${getItemStatusBadge(currentStatus)}`}
          >
            <option value="">— Pilih —</option>
            <option value="ACC">✓ ACC</option>
            <option value="Ditolak">✗ Tolak</option>
            <option value="Revisi">↻ Revisi</option>
          </select>

          {/* Nominal Disetujui — hanya muncul saat ACC */}
          {currentStatus === 'ACC' && (
            <div className="mt-2">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nominal Disetujui</label>
              <input
                type="number"
                min={0}
                max={originalTotal}
                step={1000}
                value={nominalValue}
                onChange={e => {
                  const val = Math.min(parseFloat(e.target.value) || 0, originalTotal);
                  updateDecision(item.id, 'nominal_disetujui', val);
                  // Require catatan if cutting
                  if (val < originalTotal && !dec?.catatan) {
                    updateDecision(item.id, 'catatan', '');
                  }
                }}
                className={`w-full px-2 py-1.5 rounded border text-xs font-mono text-right focus:outline-none focus:ring-2 ${
                  isCut ? 'border-blue-300 bg-blue-50 text-blue-700 focus:ring-blue-200' : 'border-slate-200 bg-white focus:ring-emerald-200'
                }`}
              />
              {isCut && (
                <p className="text-[9px] text-blue-600 font-bold mt-0.5 text-right">
                  Dipotong: {fmt(cutAmount)}
                </p>
              )}
            </div>
          )}
        </td>

        {/* Catatan */}
        <td className="p-3 align-top">
          <input
            type="text"
            placeholder={isCut ? "Wajib: alasan pemotongan..." : "Catatan..."}
            value={dec?.catatan || ''}
            onChange={e => updateDecision(item.id, 'catatan', e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border text-xs text-slate-700 focus:ring-2 focus:ring-indigo-300 focus:outline-none bg-white ${
              isCut && !dec?.catatan ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200'
            }`}
          />
          {isCut && !dec?.catatan && (
            <p className="text-[9px] text-blue-500 mt-0.5">Wajib diisi jika memotong nominal</p>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-32">
      <SubmitOverlay status={submitState.status} message={submitState.message} />

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className={`material-icons-round text-3xl ${confirmAction === 'setujui_penuh' ? 'text-emerald-500' : confirmAction === 'setujui_sebagian' ? 'text-blue-500' : confirmAction === 'minta_revisi' ? 'text-amber-500' : 'text-red-500'}`}>
                {confirmAction === 'setujui_penuh' ? 'check_circle' : confirmAction === 'setujui_sebagian' ? 'published_with_changes' : confirmAction === 'minta_revisi' ? 'rate_review' : 'cancel'}
              </span>
              <h3 className="text-lg font-black text-slate-800">
                {confirmAction === 'setujui_penuh' && 'Setujui Penuh?'}
                {confirmAction === 'setujui_sebagian' && 'Setujui Sebagian?'}
                {confirmAction === 'minta_revisi' && 'Minta Revisi?'}
                {confirmAction === 'tolak' && 'Tolak Seluruhnya?'}
              </h3>
            </div>
            <p className="text-sm text-slate-600">
              {confirmAction === 'setujui_penuh' && `Semua ${items.length} item akan di-ACC otomatis. Plafon anggaran akan terbentuk penuh. Aksi ini FINAL dan tidak dapat dibatalkan.`}
              {confirmAction === 'setujui_sebagian' && `${accCount} item di-ACC, ${tolakCount} item ditolak permanen. Plafon terbentuk hanya untuk item ACC. Aksi ini FINAL.`}
              {confirmAction === 'minta_revisi' && 'Dokumen akan dikembalikan ke pembuat untuk diperbaiki. Pembuat bisa mengedit lalu submit ulang.'}
              {confirmAction === 'tolak' && 'Seluruh rancangan anggaran akan ditolak. Aksi ini FINAL dan tidak dapat dibatalkan.'}
            </p>
            <div className="flex gap-3 justify-end mt-2">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Batal</button>
              <button onClick={() => handleSubmitReview(confirmAction)} className={`px-5 py-2 rounded-lg text-sm font-bold text-white ${confirmAction === 'tolak' ? 'bg-red-600 hover:bg-red-700' : confirmAction === 'minta_revisi' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="w-full flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs font-medium font-['Inter']">
          <span className="text-slate-500">Anggaran & Plotting</span>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <Link href="/anggaran/rancangan" className="text-slate-500 hover:text-blue-600">Rancangan Anggaran</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Review RA</span>
        </div>
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-2">
            <div className="inline-flex gap-4 items-center">
              <h1 className="text-slate-900 text-3xl font-black font-['Inter']">Review Rancangan Anggaran</h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-amber-50 text-amber-700 flex items-center gap-1.5 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>Menunggu Review
              </span>
            </div>
            {data.nama_rancangan && <p className="text-slate-500 text-base font-medium">{data.nama_rancangan}</p>}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-1">
            <span className="material-icons-round text-lg text-slate-400">qr_code</span>
            ID: <span className="font-bold text-slate-700">{data.kode_dokumen}</span>
          </div>
        </div>
      </div>

      {/* Info Card (read-only) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {[
            ['Kategori RA', data.kategori_ra || '-'],
            ['Pola Penggunaan', data.pola_penggunaan || '-'],
            ['Satelit', data.nama_satelit],
            ['Komisi', data.nama_komisi || 'Umum'],
            ['Tahun', data.tahun],
            ['Estimasi', data.estimasi_waktu || '-'],
            ['Dibuat Oleh', data.pembuat || 'Sistem'],
            ['Total', fmt(Number(data.total_anggaran))],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</div>
              <div className="text-xs font-bold text-slate-700">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Decision Summary Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
        <div className="text-sm font-bold text-slate-700 mr-2">Ringkasan Keputusan:</div>
        <div className="flex gap-3 flex-wrap">
          <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
            <span className="material-icons-round text-[14px]">check_circle</span>ACC: {accCount}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold border border-red-200 flex items-center gap-1.5">
            <span className="material-icons-round text-[14px]">cancel</span>Tolak: {tolakCount}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 flex items-center gap-1.5">
            <span className="material-icons-round text-[14px]">rate_review</span>Revisi: {revisiCount}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-500 text-xs font-bold border border-slate-200 flex items-center gap-1.5">
            <span className="material-icons-round text-[14px]">help_outline</span>Belum: {undecidedCount}
          </span>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => bulkSetAll('ACC')} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors">ACC Semua</button>
          <button onClick={() => bulkSetAll('Ditolak')} className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors">Tolak Semua</button>
          <button onClick={() => bulkSetAll('Revisi')} className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors">Revisi Semua</button>
        </div>
      </div>

      {/* Review Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 tracking-wider">
                <th className="p-4 w-[20%]">URAIAN</th>
                <th className="p-4 w-[13%]">AKUN</th>
                <th className="p-4 w-[11%]">SUMBER</th>
                <th className="p-4 w-[5%] text-center">JML</th>
                <th className="p-4 w-[6%] text-center">SATUAN</th>
                <th className="p-4 w-[11%] text-right">TOTAL</th>
                <th className="p-4 w-[12%] text-center bg-indigo-50 text-indigo-600 border-l border-indigo-100">KEPUTUSAN</th>
                <th className="p-4 w-[22%] bg-indigo-50 text-indigo-600">CATATAN REVIEWER</th>
              </tr>
            </thead>
            <tbody>
              {penItems.length > 0 && <>
                <tr><td colSpan={8} className="px-4 py-1.5 bg-emerald-50 border-b border-emerald-100 text-[10px] font-bold text-emerald-700">↑ PENERIMAAN ({penItems.length} item)</td></tr>
                {penItems.map((item: any, idx: number) => renderItemRow(item, idx, 'pen'))}
              </>}
              {kelItems.length > 0 && <>
                <tr><td colSpan={8} className="px-4 py-1.5 bg-red-50 border-b border-red-100 border-t border-t-slate-200 text-[10px] font-bold text-red-700">↓ PENGELUARAN ({kelItems.length} item)</td></tr>
                {kelItems.map((item: any, idx: number) => renderItemRow(item, idx, 'kel'))}
              </>}
            </tbody>
          </table>
        </div>

        {/* Catatan Umum */}
        <div className="p-5 border-t border-slate-200 bg-slate-50">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">Catatan Umum Reviewer (Opsional)</label>
          <textarea
            value={catatanUmum}
            onChange={e => setCatatanUmum(e.target.value)}
            placeholder="Tulis catatan umum untuk pembuat rancangan anggaran ini..."
            className="w-full p-3 rounded-lg border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-300 focus:outline-none resize-none bg-white"
            rows={3}
          />
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-900 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-3 w-full md:w-auto flex-wrap">
            {undecidedCount > 0 ? (
              <div className="px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 text-sm font-semibold flex items-center gap-2">
                <span className="material-icons-round text-[18px] text-amber-500">info</span>
                Selesaikan keputusan untuk {undecidedCount} item tersisa.
              </div>
            ) : revisiCount > 0 ? (
              <button
                onClick={() => setConfirmAction('minta_revisi')}
                className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"
              >
                <span className="material-icons-round text-[18px]">rate_review</span>Minta Revisi
              </button>
            ) : accCount === items.length && !hasCut ? (
              // Semua item ACC, tidak ada yang dipotong → Setujui Penuh
              <button
                onClick={() => setConfirmAction('setujui_penuh')}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"
              >
                <span className="material-icons-round text-[18px]">check_circle</span>Setujui Penuh
              </button>
            ) : tolakCount === items.length ? (
              // Semua item Ditolak
              <button
                onClick={() => setConfirmAction('tolak')}
                className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"
              >
                <span className="material-icons-round text-[18px]">cancel</span>Tolak Seluruhnya
              </button>
            ) : (
              // Mix (ada cut / ada tolak / semua cut) → Setujui Sebagian
              <button
                onClick={() => setConfirmAction('setujui_sebagian')}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"
              >
                <span className="material-icons-round text-[18px]">published_with_changes</span>
                Setujui Sebagian ({accCount} ACC{hasCut ? ', ada dipotong' : ''})
              </button>
            )}
          </div>
          <div className="flex gap-5 overflow-x-auto">
            {[['Penerimaan', fmt(totalP), 'text-emerald-400'], ['Pengeluaran', `(${fmt(totalK)})`, 'text-red-400'], ['Total RA', fmt(totalP - totalK), totalP - totalK >= 0 ? 'text-emerald-400' : 'text-red-400']].map(([label, value, cls], i, arr) => (
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
