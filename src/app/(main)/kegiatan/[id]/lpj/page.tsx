'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

type Item = { id: string; jenis: 'Penerimaan'|'Pengeluaran'; coaId: number; coaLabel: string; sumber_dana: string; uraian: string; deskripsi: string; jumlah: number; satuan: string; harga: number; total: number; };
type COA = { id: number; label: string; saldo_normal: string; grup_laporan: string; };
const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
const sel = 'w-full h-10 px-3 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-100 disabled:text-slate-400';
const inp = 'w-full h-10 px-3 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500';
const lbl = 'text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wide';

export default function InputLPJPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error'; message: string }>({ status: 'idle', message: '' });
  const [kegiatan, setKegiatan] = useState<any>(null);
  const [coaList, setCoaList] = useState<COA[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [laporan, setLaporan] = useState('');
  const [existingStatus, setExistingStatus] = useState('');
  const [catatanReviewer, setCatatanReviewer] = useState<string | null>(null);
  const [reviewedByNama, setReviewedByNama] = useState<string | null>(null);
  const [raInfo, setRaInfo] = useState<any>(null);
  const [isPrefilled, setIsPrefilled] = useState(false);
  const [raItemsReference, setRaItemsReference] = useState<any[]>([]);
  const [showRiwayat, setShowRiwayat] = useState(false);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [form, setForm] = useState({ jenis: 'Pengeluaran', coaId: '', coaLabel: '', sumber_dana: 'Kas Mandiri', uraian: '', deskripsi: '', jumlah: 1, satuan: '', harga: 0 });
  const [coaSearch, setCoaSearch] = useState('');
  const [coaOpen, setCoaOpen] = useState(false);

  // Fetch semua data secara paralel (eliminasi waterfall)
  useEffect(() => {
    Promise.all([
      fetch(`/api/kegiatan/${id}`).then(r => r.json()),
      fetch(`/api/buku-besar/coa`).then(r => r.json()),
      fetch(`/api/kegiatan/${id}/lpj`).then(r => r.json()),
    ]).then(([keg, coa, lpj]) => {
      // Kegiatan info
      if (keg.success) setKegiatan(keg.data);

      // COA list
      if (coa.success) {
        setCoaList(coa.data
          .filter((c: any) => c.tipe_akun === 'Detail' && c.is_active)
          .map((c: any) => ({ id: c.id, label: `${c.kode_akun} — ${c.nama_akun}`, saldo_normal: c.saldo_normal, grup_laporan: c.grup_laporan }))
        );
      }

      // LPJ data
      if (lpj.success) {
        if (lpj.data.header) {
          setLaporan(lpj.data.header.laporan_naratif || '');
          setExistingStatus(lpj.data.header.status_lpj || '');
          setCatatanReviewer(lpj.data.header.catatan_reviewer || null);
          setReviewedByNama(lpj.data.header.reviewed_by_nama || null);
        }
        if (lpj.data.items?.length > 0) {
          setItems(lpj.data.items.map((it: any) => ({
            id: String(it.id || Date.now() + Math.random()),
            jenis: it.jenis_anggaran, coaId: it.coa_id,
            coaLabel: `${it.kode_akun} — ${it.nama_akun}`, sumber_dana: it.sumber_dana,
            uraian: it.uraian, deskripsi: it.deskripsi || '', jumlah: it.jumlah,
            satuan: it.satuan || '', harga: parseFloat(it.harga_satuan), total: it.jumlah * parseFloat(it.harga_satuan)
          })));
        }
        setRaInfo(lpj.data.ra_info || null);
        setIsPrefilled(lpj.data.is_prefilled || false);
        setRaItemsReference(lpj.data.ra_items_reference || []);
      }
    });
  }, [id]);

  // Filter COA by jenis (Penerimaan: 4, 7 | Pengeluaran: 5, 6, 8)
  const filteredCoa = useMemo(() => coaList.filter(c => {
    if (form.jenis === 'Penerimaan') {
      return c.label.startsWith('4') || c.label.startsWith('7');
    } else {
      return c.label.startsWith('5') || c.label.startsWith('6') || c.label.startsWith('8');
    }
  }), [coaList, form.jenis]);

  // Reset COA saat jenis berubah
  useEffect(() => { setForm(p => ({ ...p, coaId: '', coaLabel: '' })); setCoaSearch(''); }, [form.jenis]);

  const handleAdd = useCallback(() => {
    if (!form.coaId) { alert('Akun Perkiraan (COA) wajib dipilih!'); return; }
    if (!form.uraian.trim()) { alert('Uraian item wajib diisi!'); return; }
    if (form.jumlah <= 0 || form.harga <= 0) { alert('Jumlah dan Harga Satuan harus lebih dari 0!'); return; }
    setItems(p => [...p, { id: Date.now().toString(), jenis: form.jenis as any, coaId: parseInt(form.coaId), coaLabel: form.coaLabel, sumber_dana: form.sumber_dana, uraian: form.uraian, deskripsi: form.deskripsi, jumlah: form.jumlah, satuan: form.satuan, harga: form.harga, total: form.jumlah * form.harga }]);
    setForm(p => ({ ...p, uraian: '', deskripsi: '', jumlah: 1, satuan: '', harga: 0 }));
  }, [form]);

  // Helper: untuk RA Bertahap, salin sebagai "per 1 kali pelaksanaan" (jumlah=1)
  // Untuk RA Sekali Pakai, salin verbatim dari rencana
  const isBertahap = raInfo?.pola_penggunaan === 'Bertahap';

  // Salin satu baris RA ke LPJ items
  const handleSalinSatuItem = useCallback((r: any) => {
    const jumlah = isBertahap ? 1 : r.jumlah;
    const newItem: Item = {
      id: Date.now().toString() + Math.random(),
      jenis: r.jenis_anggaran as 'Penerimaan' | 'Pengeluaran',
      coaId: r.coa_id,
      coaLabel: `${r.kode_akun} — ${r.nama_akun}`,
      sumber_dana: r.sumber_dana || 'Kas Mandiri',
      uraian: r.uraian,
      deskripsi: r.deskripsi || '',
      jumlah,
      satuan: isBertahap ? 'Kali' : (r.satuan || ''),
      harga: parseFloat(r.harga_satuan),
      total: jumlah * parseFloat(r.harga_satuan),
    };
    setItems(p => [...p, newItem]);
  }, [isBertahap]);

  // Salin semua baris RA ke LPJ items (bulk copy)
  const [salinDone, setSalinDone] = useState(false);
  const handleSalinSemua = useCallback(() => {
    if (raItemsReference.length === 0) return;
    const newItems: Item[] = raItemsReference.map((r: any) => {
      const jumlah = isBertahap ? 1 : r.jumlah;
      return {
        id: Date.now().toString() + Math.random(),
        jenis: r.jenis_anggaran as 'Penerimaan' | 'Pengeluaran',
        coaId: r.coa_id,
        coaLabel: `${r.kode_akun} — ${r.nama_akun}`,
        sumber_dana: r.sumber_dana || 'Kas Mandiri',
        uraian: r.uraian,
        deskripsi: r.deskripsi || '',
        jumlah,
        satuan: isBertahap ? 'Kali' : (r.satuan || ''),
        harga: parseFloat(r.harga_satuan),
        total: jumlah * parseFloat(r.harga_satuan),
      };
    });
    if (items.length > 0) {
      if (!confirm(`Tabel rincian sudah ada ${items.length} item. Ganti semua dengan data dari Anggaran?`)) return;
    }
    setItems(newItems);
    setSalinDone(true);
    setTimeout(() => setSalinDone(false), 2500);
  }, [raItemsReference, items, isBertahap]);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ uraian: string; deskripsi: string; jumlah: number; satuan: string; harga: number }>({ uraian: '', deskripsi: '', jumlah: 1, satuan: '', harga: 0 });

  const handleStartEdit = (item: Item) => {
    setEditingId(item.id);
    setEditValues({ uraian: item.uraian, deskripsi: item.deskripsi, jumlah: item.jumlah, satuan: item.satuan, harga: item.harga });
  };

  const handleEditSave = (id: string) => {
    if (!editValues.uraian.trim()) { alert('Uraian tidak boleh kosong!'); return; }
    if (editValues.jumlah <= 0 || editValues.harga <= 0) { alert('Jumlah dan Harga harus lebih dari 0!'); return; }
    setItems(prev => prev.map(i => i.id === id
      ? { ...i, ...editValues, total: editValues.jumlah * editValues.harga }
      : i
    ));
    setEditingId(null);
  };

  const totalP = useMemo(() => items.filter(i => i.jenis === 'Penerimaan').reduce((a, c) => a + c.total, 0), [items]);
  const totalK = useMemo(() => items.filter(i => i.jenis === 'Pengeluaran').reduce((a, c) => a + c.total, 0), [items]);
  const sisa = totalP - totalK;

  // Head-to-head comparison: RA rencana vs LPJ realisasi, dicocokkan per COA
  const comparisonData = useMemo(() => {
    if (raItemsReference.length === 0) return [];
    // Group RA items by coa_id, sum total rencana
    const raMap: Record<number, { kode_akun: string; nama_akun: string; uraian: string; jenis: string; total_ra: number; harga_satuan_ra: number; jumlah_ra: number; satuan_ra: string }> = {};
    raItemsReference.forEach((r: any) => {
      const total = r.jumlah * parseFloat(r.harga_satuan);
      if (raMap[r.coa_id]) {
        raMap[r.coa_id].total_ra += total;
      } else {
        raMap[r.coa_id] = {
          kode_akun: r.kode_akun, nama_akun: r.nama_akun, uraian: r.uraian,
          jenis: r.jenis_anggaran,
          total_ra: total, harga_satuan_ra: parseFloat(r.harga_satuan),
          jumlah_ra: r.jumlah, satuan_ra: r.satuan || '-'
        };
      }
    });
    // Group LPJ items by coa_id, sum total realisasi
    const lpjMap: Record<number, { uraian: string; total_lpj: number; harga_satuan_lpj: number; jumlah_lpj: number }> = {};
    items.forEach(i => {
      if (lpjMap[i.coaId]) {
        lpjMap[i.coaId].total_lpj += i.total;
      } else {
        lpjMap[i.coaId] = { uraian: i.uraian, total_lpj: i.total, harga_satuan_lpj: i.harga, jumlah_lpj: i.jumlah };
      }
    });
    // Merge: all COAs from both RA and LPJ
    const allCoaIds = new Set([...Object.keys(raMap).map(Number), ...Object.keys(lpjMap).map(Number)]);
    return Array.from(allCoaIds).map(coaId => {
      const ra = raMap[coaId];
      const lpj = lpjMap[coaId];
      const total_ra = ra?.total_ra ?? 0;
      const total_lpj = lpj?.total_lpj ?? 0;
      const selisih = total_lpj - total_ra;
      return {
        coaId,
        kode_akun: ra?.kode_akun ?? items.find(i => i.coaId === coaId)?.coaLabel.split(' — ')[0] ?? '-',
        nama_akun: ra?.nama_akun ?? items.find(i => i.coaId === coaId)?.coaLabel.split(' — ')[1] ?? '-',
        uraian_ra: ra?.uraian ?? '-',
        uraian_lpj: lpj?.uraian ?? '-',
        jenis: ra?.jenis ?? (items.find(i => i.coaId === coaId)?.jenis ?? 'Pengeluaran'),
        harga_satuan_ra: ra?.harga_satuan_ra ?? 0,
        jumlah_ra: ra?.jumlah_ra ?? 0,
        satuan_ra: ra?.satuan_ra ?? '-',
        total_ra,
        harga_satuan_lpj: lpj?.harga_satuan_lpj ?? 0,
        jumlah_lpj: lpj?.jumlah_lpj ?? 0,
        total_lpj,
        selisih,
        // Penerimaan: surplus if LPJ > RA (lebih banyak masuk), deficit if less
        // Pengeluaran: surplus if LPJ < RA (lebih hemat), over if LPJ > RA
        isOver: ra?.jenis === 'Penerimaan' ? total_lpj < total_ra : total_lpj > total_ra,
        pct: total_ra > 0 ? Math.round((total_lpj / total_ra) * 100) : null
      };
    });
  }, [raItemsReference, items]);

  const handleSave = async (action: 'draft' | 'ajukan' | 'ajukan_ulang') => {
    if (items.length === 0) { setSubmitState({ status: 'error', message: 'Minimal 1 item rincian harus diisi.' }); return; }
    const msgMap: Record<string, string> = { draft: 'Menyimpan draft...', ajukan: 'Mengajukan LPJ...', ajukan_ulang: 'Mengajukan ulang LPJ...' };
    setSubmitState({ status: 'loading', message: msgMap[action] });
    try {
      const res = await fetch(`/api/kegiatan/${id}/lpj`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action, laporan_naratif: laporan,
          items: items.map(i => ({ jenis_anggaran: i.jenis, coa_id: i.coaId, sumber_dana: i.sumber_dana, uraian: i.uraian, deskripsi: i.deskripsi || null, jumlah: i.jumlah, satuan: i.satuan || null, harga_satuan: i.harga }))
        })
      });
      const json = await res.json();
      if (json.success) {
        setSubmitState({ status: 'success', message: json.message });
        if (action !== 'draft') {
          setTimeout(() => router.push('/kegiatan'), 1800);
        } else {
          setExistingStatus('Draft');
          setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 1500);
        }
      } else {
        setSubmitState({ status: 'error', message: json.message });
      }
    } catch (e: any) {
      setSubmitState({ status: 'error', message: 'Kesalahan jaringan: ' + e.message });
    }
  };

  const handleOpenRiwayat = async () => {
    setShowRiwayat(true);
    if (timeline.length === 0) {
      setTimelineLoading(true);
      try {
        const res = await fetch(`/api/kegiatan/${id}/lpj/timeline`);
        const json = await res.json();
        if (json.success) setTimeline(json.data);
      } catch {}
      setTimelineLoading(false);
    }
  };

  const isDraft = existingStatus === '' || existingStatus === 'Draft';
  const isRevisi = existingStatus === 'Revisi';
  const isLocked = existingStatus === 'Disetujui'; // Sudah disetujui → tidak boleh diedit


  return (
    <div className="w-full flex flex-col gap-6 pb-32">
      <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => setSubmitState({ status: 'idle', message: '' })} />

      {/* ── Breadcrumb ── */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-sans leading-4">
          <Link href="/kegiatan" className="text-slate-500 hover:text-indigo-600">Daftar Kegiatan</Link>
          <span className="text-slate-400 material-icons-round text-[14px]">chevron_right</span>
          <Link href={`/kegiatan/${id}`} className="text-slate-500 hover:text-indigo-600 truncate max-w-[200px]">{kegiatan?.nama_kegiatan || 'Detail Kegiatan'}</Link>
          <span className="text-slate-400 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Input LPJ</span>
        </div>

        {/* ── Page Title Row ── */}
        <div className="self-stretch inline-flex justify-between items-end gap-4 flex-wrap">
          <div className="flex flex-col gap-2">
            <div className="inline-flex gap-3 items-center flex-wrap">
              <h1 className="text-slate-900 text-3xl font-black font-sans leading-9">Input LPJ</h1>
              {existingStatus && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border flex items-center gap-1.5 w-max ${
                  existingStatus === 'Menunggu Review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  existingStatus === 'Disetujui' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  existingStatus === 'Revisi' ? 'bg-red-50 text-red-700 border-red-200' :
                  'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    existingStatus === 'Menunggu Review' ? 'bg-amber-500 animate-pulse' :
                    existingStatus === 'Disetujui' ? 'bg-emerald-500' :
                    existingStatus === 'Revisi' ? 'bg-red-500' :
                    'bg-slate-400'
                  }`}></span>
                  Status LPJ: {existingStatus}
                </span>
              )}
            </div>
            {kegiatan && (
              <p className="text-slate-500 text-base font-medium">{kegiatan.nama_kegiatan}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-slate-500 text-sm font-medium font-sans flex gap-1 items-center">
              <span className="material-icons-round text-lg text-slate-400">qr_code</span>
              Kode: <span className="text-slate-700 font-bold">{kegiatan?.kode_kegiatan}</span>
            </div>
            <button onClick={handleOpenRiwayat} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-semibold font-sans hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all shadow-sm" title="Lihat Riwayat">
              <span className="material-icons-round text-[18px]">history</span>
              Lihat Riwayat
            </button>
          </div>
        </div>
      </div>

      {/* Main Info Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-2">

        {/* RA Info Tracking (If Available) */}
        {raInfo && (
          <div className="mb-5 bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-center relative overflow-hidden">
             <div className="absolute -right-4 -bottom-4 opacity-[0.05] pointer-events-none">
                <span className="material-icons-round text-[100px] text-emerald-900">request_quote</span>
             </div>
             <div className="flex flex-col z-10 w-full md:w-auto">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-1">Rancangan Terhubung</span>
                <span className="text-sm font-bold text-slate-800">{raInfo.kode} — {raInfo.nama}</span>
                <span className="text-xs font-medium text-emerald-700 mt-0.5">Pola: {raInfo.pola === 'Sekali Pakai' ? 'Tunggal' : raInfo.pola}</span>
             </div>
             
             {raInfo.pola === 'Bertahap' && (
               <div className="flex gap-4 z-10 w-full md:w-auto justify-end">
                  <div className="flex flex-col text-right">
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Disetujui</span>
                     <span className="text-sm font-bold font-sans text-slate-800">{fmt(raInfo.total_disetujui)}</span>
                  </div>
                  <div className="w-px h-8 bg-emerald-200"></div>
                  <div className="flex flex-col text-right">
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Terpakai (LPJ Lain)</span>
                     <span className="text-sm font-bold font-sans text-red-600">{fmt(raInfo.total_terpakai_lain)}</span>
                  </div>
                  <div className="w-px h-8 bg-emerald-200"></div>
                  <div className="flex flex-col text-right">
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sisa Anggaran</span>
                     <span className="text-sm font-bold font-sans text-emerald-700">{fmt(raInfo.total_disetujui - raInfo.total_terpakai_lain)}</span>
                  </div>
               </div>
             )}
          </div>
        )}

        {/* ── Banner Terkunci (Disetujui) ── */}
        {isLocked && (
          <div className="mb-5 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <span className="material-icons-round text-emerald-600 text-[22px]">lock</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-800">LPJ Telah Disetujui — Tidak Dapat Diedit</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                LPJ ini sudah mendapatkan persetujuan dari Majelis. Dokumen dikunci untuk menjaga integritas laporan keuangan.
                Untuk mengubah, hubungi Majelis untuk membatalkan persetujuan terlebih dahulu.
              </p>
            </div>
            <a href={`/kegiatan/${id}/lpj/view`} className="shrink-0 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5">
              <span className="material-icons-round text-[16px]">visibility</span>
              Lihat LPJ
            </a>
          </div>
        )}

        {/* Catatan Revisi dari Majelis */}
        {isRevisi && catatanReviewer && (
          <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
            <span className="material-icons-round text-red-500 text-[22px] shrink-0 mt-0.5">rate_review</span>
            <div>
              <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1">Catatan Revisi dari Majelis</p>
              <p className="text-sm text-red-800 font-medium">&ldquo;{catatanReviewer}&rdquo;</p>
              {reviewedByNama && <p className="text-[11px] text-red-500 mt-1">&mdash; {reviewedByNama}</p>}
            </div>
          </div>
        )}

        {/* Laporan Naratif */}
        <div className="mb-5">
          <label className={lbl}>Laporan Naratif / Catatan Umum <span className="text-slate-400 font-normal normal-case">(opsional)</span></label>
          <textarea value={laporan} onChange={e => setLaporan(e.target.value)} rows={3} disabled={!isDraft}
            placeholder="Tulis ringkasan pelaksanaan kegiatan, kendala, dan saran..."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:bg-slate-50 disabled:text-slate-400" />
        </div>

        {raItemsReference.length > 0 && (
          <div className="mb-5 border border-blue-100 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-blue-50 px-4 py-2.5 flex items-center justify-between gap-2 border-b border-blue-100">
              <div className="flex items-center gap-2">
                <span className="material-icons-round text-blue-500 text-[18px]">menu_book</span>
                <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Referensi Rencana Anggaran (RA) — Hanya untuk Panduan</p>
              </div>
            {isDraft && (
              <div className="flex items-center gap-2">
                {isBertahap && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full border border-amber-200">
                    <span className="material-icons-round text-[11px]">repeat</span>
                    Bertahap: disalin sebagai 1× realisasi
                  </span>
                )}
                <button
                  onClick={handleSalinSemua}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                    salinDone
                      ? 'bg-emerald-500 text-white border border-emerald-400'
                      : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-600 hover:text-white hover:border-blue-600'
                  }`}
                >
                  <span className="material-icons-round text-[14px]">{salinDone ? 'check_circle' : 'auto_awesome'}</span>
                  {salinDone ? 'Tersalin!' : 'Salin Semua ke LPJ'}
                </button>
              </div>
            )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead>
                  <tr className="bg-blue-50/50 border-b border-blue-100 text-[10px] font-bold text-blue-700 uppercase tracking-widest">
                    <th className="px-4 py-2 w-[28%]">Uraian (Rencana)</th>
                    <th className="px-4 py-2 w-[20%]">Akun COA</th>
                    <th className="px-4 py-2 text-center">Jml</th>
                    <th className="px-4 py-2">Satuan</th>
                    <th className="px-4 py-2 text-right">Harga/Satuan</th>
                    <th className="px-4 py-2 text-right">Total Rencana</th>
                    {isDraft && <th className="px-4 py-2 text-center">Salin</th>}
                  </tr>
                </thead>
                <tbody>
                  {raItemsReference.map((r: any, i: number) => (
                    <tr key={i} className="border-b border-blue-50 last:border-0 hover:bg-blue-50/30 group">
                      <td className="px-4 py-2 font-medium text-slate-700">{r.uraian}</td>
                      <td className="px-4 py-2 font-sans text-slate-500">{r.kode_akun} — {r.nama_akun}</td>
                      <td className="px-4 py-2 text-center text-slate-600">{r.jumlah}</td>
                      <td className="px-4 py-2 text-slate-500">{r.satuan || '-'}</td>
                      <td className="px-4 py-2 text-right font-sans text-slate-600">{fmt(parseFloat(r.harga_satuan))}</td>
                      <td className="px-4 py-2 text-right font-bold font-sans text-blue-700">{fmt(r.jumlah * parseFloat(r.harga_satuan))}</td>
                      {isDraft && (
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleSalinSatuItem(r)}
                            title="Salin baris ini ke LPJ"
                            className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white text-[10px] font-bold"
                          >
                            <span className="material-icons-round text-[12px]">south</span> Salin
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-blue-50/50 px-4 py-2 text-[10px] text-blue-600 italic border-t border-blue-100 flex items-center gap-2">
              <span className="material-icons-round text-[12px]">info</span>
              {isBertahap
                ? <>Data di atas adalah rencana <strong>tahunan</strong> dari RA Bertahap. Tombol "Salin" akan mengisi jumlah=<strong>1 kali</strong> dengan harga/satuan sebagai referensi — sesuaikan dengan realisasi aktual event ini.</>
                : <>Data di atas adalah rencana dari RA. Gunakan tombol "Salin" atau "Salin Semua", lalu sesuaikan jumlah/harga sesuai realisasi aktual.</>
              }
            </div>
          </div>
        )}

        {/* Form Tambah Item */}
        {isDraft && (
          <div className="flex flex-col gap-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tambah Rincian Keuangan</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={lbl}>Jenis</label>
                <select value={form.jenis} onChange={e => setForm(p => ({ ...p, jenis: e.target.value }))} className={sel + ' font-semibold'}>
                  <option value="Pengeluaran">Pengeluaran</option>
                  <option value="Penerimaan">Penerimaan</option>
                </select>
              </div>
              <div className="relative">
                <label className={lbl}>Akun COA <span className="text-red-500">*</span> <span className="font-normal normal-case text-slate-400">({form.jenis === 'Penerimaan' ? 'Akun Pendapatan' : 'Akun Beban'})</span></label>
                <div 
                  className={`${sel} ${!form.coaId ? 'border-amber-300' : ''} flex items-center justify-between cursor-text relative overflow-hidden`}
                >
                  <input
                    type="text"
                    placeholder="-- Ketik untuk mencari COA --"
                    value={coaSearch}
                    onChange={(e) => {
                      setCoaSearch(e.target.value);
                      setCoaOpen(true);
                      if (form.coaId) setForm(p => ({ ...p, coaId: '', coaLabel: '' }));
                    }}
                    onFocus={() => setCoaOpen(true)}
                    onBlur={() => setTimeout(() => setCoaOpen(false), 200)}
                    className="w-full bg-transparent outline-none h-full truncate text-sm"
                  />
                  <span className="material-icons-round text-slate-400 text-lg pointer-events-none">expand_more</span>
                </div>
                {coaOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredCoa.filter(c => c.label.toLowerCase().includes(coaSearch.toLowerCase())).length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center italic">Tidak ditemukan.</div>
                    ) : (
                      filteredCoa.filter(c => c.label.toLowerCase().includes(coaSearch.toLowerCase())).map(c => (
                        <div 
                          key={c.id} 
                          onClick={() => {
                            setForm(p => ({ ...p, coaId: String(c.id), coaLabel: c.label }));
                            setCoaSearch(c.label);
                            setCoaOpen(false);
                          }}
                          className="px-4 py-2 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer text-sm font-medium border-b border-slate-50 last:border-0"
                        >
                          {c.label}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className={lbl}>Sumber Dana</label>
                <select value={form.sumber_dana} onChange={e => setForm(p => ({ ...p, sumber_dana: e.target.value }))} className={sel}>
                  <option value="Kas Mandiri">Kas Satelit/Komisi</option>
                  <option value="Kas Pusat">Kas Pusat</option>
                  <option value="Kontribusi Peserta">Kontribusi Peserta</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Uraian / Judul Item <span className="text-red-500">*</span></label>
                <input type="text" value={form.uraian} onChange={e => setForm(p => ({ ...p, uraian: e.target.value }))} placeholder="Contoh: Persembahan Kolekte, Biaya Konsumsi..." className={inp} />
              </div>
              <div>
                <label className={lbl}>Deskripsi Peruntukan</label>
                <input type="text" value={form.deskripsi} onChange={e => setForm(p => ({ ...p, deskripsi: e.target.value }))} placeholder="Detail tambahan (opsional)..." className={inp} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <label className={lbl}>Jumlah <span className="text-red-500">*</span></label>
                <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden h-10 bg-white">
                  <button type="button" onClick={() => setForm(p => ({ ...p, jumlah: Math.max(1, p.jumlah - 1) }))} className="w-10 h-full flex justify-center items-center text-slate-500 hover:bg-slate-100 border-r border-slate-300 font-bold">−</button>
                  <input type="number" min={1} step={1} value={form.jumlah} onChange={e => setForm(p => ({ ...p, jumlah: Math.round(Number(e.target.value)) || 1 }))} className="w-full h-full text-center outline-none text-sm font-semibold" />
                  <button type="button" onClick={() => setForm(p => ({ ...p, jumlah: p.jumlah + 1 }))} className="w-10 h-full flex justify-center items-center text-slate-500 hover:bg-slate-100 border-l border-slate-300 font-bold">+</button>
                </div>
              </div>
              <div>
                <label className={lbl}>Satuan</label>
                <input type="text" placeholder="Kali / Buah / Orang" value={form.satuan} onChange={e => setForm(p => ({ ...p, satuan: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Harga Satuan <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-semibold">Rp</span>
                  <input type="number" min={0} step={1} value={form.harga || ''} onChange={e => setForm(p => ({ ...p, harga: Math.round(Number(e.target.value)) || 0 }))} className={inp + ' pl-9 font-sans'} />
                </div>
              </div>
              <div>
                <label className={lbl}>Total Estimasi</label>
                <div className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-100 text-sm font-bold text-slate-700 flex items-center font-sans">{fmt(form.jumlah * form.harga)}</div>
              </div>
              <div>
                <button onClick={handleAdd} className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm flex justify-center items-center gap-2 transition-colors shadow-sm">
                  <span className="material-icons-round text-[18px]">add</span> Tambah
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rincian Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-base font-bold text-slate-800">Rincian Keuangan Kegiatan</h2>
          <span className="text-xs text-slate-400 font-medium">{items.length} item</span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-xs font-bold text-slate-500 tracking-wider">
                <th className="p-4 w-[28%]">URAIAN</th>
                <th className="p-4 w-[20%]">AKUN COA</th>
                <th className="p-4 w-[12%]">SUMBER DANA</th>
                <th className="p-4 w-[6%] text-center">JML</th>
                <th className="p-4 w-[7%] text-center">SATUAN</th>
                <th className="p-4 w-[12%] text-right">HARGA</th>
                <th className="p-4 w-[10%] text-right">TOTAL</th>
                {isDraft && <th className="p-4 w-[5%] text-center">AKSI</th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={isDraft ? 8 : 7} className="p-12 text-center text-slate-400 bg-slate-50/50">
                  <div className="flex flex-col items-center gap-2">
                    <span className="material-icons-round text-4xl text-slate-300">receipt_long</span>
                    <p>Belum ada item. Isi form di atas lalu klik "+ Tambah".</p>
                  </div>
                </td></tr>
              ) : (
                <>
                  {/* Penerimaan Group */}
                  {items.some(i => i.jenis === 'Penerimaan') && (
                    <>
                      <tr className="bg-emerald-50 text-emerald-700 text-[10px] font-bold tracking-widest uppercase border-b border-slate-100"><td colSpan={isDraft ? 8 : 7} className="px-4 py-1.5">↑ PENERIMAAN</td></tr>
                      {items.filter(i => i.jenis === 'Penerimaan').map((item, idx) => (
                        editingId === item.id ? (
                          <tr key={item.id} className="border-b border-emerald-200 bg-emerald-50/40">
                            <td className="p-3 pl-6" colSpan={2}>
                              <input type="text" value={editValues.uraian} onChange={e => setEditValues(p => ({ ...p, uraian: e.target.value }))} placeholder="Uraian" className="w-full mb-1 px-2 py-1 border border-emerald-300 rounded text-sm outline-none focus:ring-1 focus:ring-emerald-500" />
                              <input type="text" value={editValues.deskripsi} onChange={e => setEditValues(p => ({ ...p, deskripsi: e.target.value }))} placeholder="Deskripsi (opsional)" className="w-full px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-emerald-500" />
                            </td>
                            <td className="p-3">
                              <select value={item.sumber_dana} disabled className="px-2 py-1 border border-slate-200 rounded text-xs bg-slate-50 w-full">
                                <option>{item.sumber_dana}</option>
                              </select>
                            </td>
                            <td className="p-3 text-center">
                              <input type="number" min={1} step={1} value={editValues.jumlah} onChange={e => setEditValues(p => ({ ...p, jumlah: Math.round(Number(e.target.value)) || 1 }))} className="w-16 px-2 py-1 border border-emerald-300 rounded text-sm text-center outline-none focus:ring-1 focus:ring-emerald-500" />
                            </td>
                            <td className="p-3 text-center">
                              <input type="text" value={editValues.satuan} onChange={e => setEditValues(p => ({ ...p, satuan: e.target.value }))} placeholder="satuan" className="w-20 px-2 py-1 border border-slate-200 rounded text-xs outline-none" />
                            </td>
                            <td className="p-3 text-right">
                              <input type="number" min={0} step={1} value={editValues.harga || ''} onChange={e => setEditValues(p => ({ ...p, harga: Math.round(Number(e.target.value)) || 0 }))} className="w-28 px-2 py-1 border border-emerald-300 rounded text-sm text-right font-sans outline-none focus:ring-1 focus:ring-emerald-500" />
                            </td>
                            <td className="p-3 text-right font-bold font-sans text-emerald-600 text-sm">{fmt(editValues.jumlah * editValues.harga)}</td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => handleEditSave(item.id)} title="Simpan" className="w-7 h-7 rounded bg-emerald-600 text-white flex justify-center items-center hover:bg-emerald-700"><span className="material-icons-round text-[14px]">check</span></button>
                                <button onClick={() => setEditingId(null)} title="Batal" className="w-7 h-7 rounded bg-slate-200 text-slate-600 flex justify-center items-center hover:bg-slate-300"><span className="material-icons-round text-[14px]">close</span></button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-emerald-50/30 group">
                          <td className="p-4 pl-6 text-sm font-semibold text-slate-800">{idx + 1}. {item.uraian}<p className="text-xs font-normal text-slate-400">{item.deskripsi}</p></td>
                          <td className="p-4 text-xs font-sans text-slate-500">{item.coaLabel}</td>
                          <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${item.sumber_dana === 'Kas Pusat' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : item.sumber_dana === 'Kontribusi Peserta' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{item.sumber_dana}</span></td>
                          <td className="p-4 text-sm text-center font-medium">{item.jumlah}</td>
                          <td className="p-4 text-sm text-center text-slate-600">{item.satuan}</td>
                          <td className="p-4 text-sm text-right font-sans text-slate-700">{fmt(item.harga)}</td>
                          <td className="p-4 text-sm text-right font-bold font-sans text-emerald-600">{fmt(item.total)}</td>
                          {isDraft && <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleStartEdit(item)} title="Edit" className="w-7 h-7 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex justify-center items-center"><span className="material-icons-round text-[16px]">edit</span></button>
                              <button onClick={() => setItems(items.filter(i => i.id !== item.id))} title="Hapus" className="w-7 h-7 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 flex justify-center items-center"><span className="material-icons-round text-[16px]">delete</span></button>
                            </div>
                          </td>}
                        </tr>
                        )
                      ))}
                    </>
                  )}
                  {/* Pengeluaran Group */}
                  {items.some(i => i.jenis === 'Pengeluaran') && (
                    <>
                      <tr className="bg-red-50 text-red-700 text-[10px] font-bold tracking-widest uppercase border-b border-slate-100"><td colSpan={isDraft ? 8 : 7} className="px-4 py-1.5">↓ PENGELUARAN</td></tr>
                      {items.filter(i => i.jenis === 'Pengeluaran').map((item, idx) => (
                        editingId === item.id ? (
                          <tr key={item.id} className="border-b border-indigo-200 bg-indigo-50/30">
                            <td className="p-3 pl-6" colSpan={2}>
                              <input type="text" value={editValues.uraian} onChange={e => setEditValues(p => ({ ...p, uraian: e.target.value }))} placeholder="Uraian" className="w-full mb-1 px-2 py-1 border border-indigo-300 rounded text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
                              <input type="text" value={editValues.deskripsi} onChange={e => setEditValues(p => ({ ...p, deskripsi: e.target.value }))} placeholder="Deskripsi (opsional)" className="w-full px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500" />
                            </td>
                            <td className="p-3">
                              <select value={item.sumber_dana} disabled className="px-2 py-1 border border-slate-200 rounded text-xs bg-slate-50 w-full">
                                <option>{item.sumber_dana}</option>
                              </select>
                            </td>
                            <td className="p-3 text-center">
                              <input type="number" min={1} step={1} value={editValues.jumlah} onChange={e => setEditValues(p => ({ ...p, jumlah: Math.round(Number(e.target.value)) || 1 }))} className="w-16 px-2 py-1 border border-indigo-300 rounded text-sm text-center outline-none focus:ring-1 focus:ring-indigo-500" />
                            </td>
                            <td className="p-3 text-center">
                              <input type="text" value={editValues.satuan} onChange={e => setEditValues(p => ({ ...p, satuan: e.target.value }))} placeholder="satuan" className="w-20 px-2 py-1 border border-slate-200 rounded text-xs outline-none" />
                            </td>
                            <td className="p-3 text-right">
                              <input type="number" min={0} step={1} value={editValues.harga || ''} onChange={e => setEditValues(p => ({ ...p, harga: Math.round(Number(e.target.value)) || 0 }))} className="w-28 px-2 py-1 border border-indigo-300 rounded text-sm text-right font-sans outline-none focus:ring-1 focus:ring-indigo-500" />
                            </td>
                            <td className="p-3 text-right font-bold font-sans text-slate-800 text-sm">{fmt(editValues.jumlah * editValues.harga)}</td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => handleEditSave(item.id)} title="Simpan" className="w-7 h-7 rounded bg-indigo-600 text-white flex justify-center items-center hover:bg-indigo-700"><span className="material-icons-round text-[14px]">check</span></button>
                                <button onClick={() => setEditingId(null)} title="Batal" className="w-7 h-7 rounded bg-slate-200 text-slate-600 flex justify-center items-center hover:bg-slate-300"><span className="material-icons-round text-[14px]">close</span></button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 group">
                          <td className="p-4 pl-6 text-sm font-semibold text-slate-800">{idx + 1}. {item.uraian}<p className="text-xs font-normal text-slate-400">{item.deskripsi}</p></td>
                          <td className="p-4 text-xs font-sans text-slate-500">{item.coaLabel}</td>
                          <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${item.sumber_dana === 'Kas Pusat' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : item.sumber_dana === 'Kontribusi Peserta' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{item.sumber_dana}</span></td>
                          <td className="p-4 text-sm text-center font-medium">{item.jumlah}</td>
                          <td className="p-4 text-sm text-center text-slate-600">{item.satuan}</td>
                          <td className="p-4 text-sm text-right font-sans text-slate-700">{fmt(item.harga)}</td>
                          <td className="p-4 text-sm text-right font-bold font-sans text-slate-800">{fmt(item.total)}</td>
                          {isDraft && <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleStartEdit(item)} title="Edit" className="w-7 h-7 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex justify-center items-center"><span className="material-icons-round text-[16px]">edit</span></button>
                              <button onClick={() => setItems(items.filter(i => i.id !== item.id))} title="Hapus" className="w-7 h-7 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 flex justify-center items-center"><span className="material-icons-round text-[16px]">delete</span></button>
                            </div>
                          </td>}
                        </tr>
                        )
                      ))}
                    </>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        <div className="bg-slate-900 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-3 w-full md:w-auto">
            {(isDraft || isRevisi) ? (
              <>
                <button onClick={() => handleSave('draft')} className="px-5 py-2.5 rounded-lg border border-slate-700 text-white font-semibold hover:bg-slate-800 transition-colors text-sm flex items-center gap-2">
                  <span className="material-icons-round text-[18px]">save</span> Simpan Draft
                </button>
                <button onClick={() => handleSave(isRevisi ? 'ajukan_ulang' : 'ajukan')} className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors text-sm flex items-center gap-2 shadow-sm">
                  <span className="material-icons-round text-[18px]">{isRevisi ? 'replay' : 'send'}</span>
                  {isRevisi ? 'Ajukan Ulang LPJ' : 'Ajukan LPJ'}
                </button>
              </>
            ) : (
              <span className={`px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 ${
                existingStatus === 'Menunggu Review' ? 'bg-amber-500 text-white' :
                existingStatus === 'Disetujui' ? 'bg-emerald-600 text-white' :
                'bg-slate-700 text-white'
              }`}>
                <span className="material-icons-round text-[18px]">{existingStatus === 'Menunggu Review' ? 'hourglass_empty' : 'check_circle'}</span>
                LPJ {existingStatus}
              </span>
            )}
          </div>
          <div className="flex gap-5 overflow-x-auto">
            {[
              ['Total Penerimaan', fmt(totalP), 'text-emerald-400'],
              ['Total Pengeluaran', `(${fmt(totalK)})`, 'text-red-400'],
              ['Margin', totalP > 0 ? `${(((totalP - totalK) / totalP) * 100).toFixed(1)}%` : '-', 'text-white'],
              ['Sisa / Surplus', fmt(sisa), sisa >= 0 ? 'text-emerald-400' : 'text-red-400'],
            ].map(([label, value, cls], i, arr) => (
              <React.Fragment key={String(label)}>
                <div className="flex flex-col text-right shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                  <span className={`text-sm font-bold font-sans ${cls}`}>{value}</span>
                </div>
                {i < arr.length - 1 && <div className="w-px h-8 bg-slate-700 shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Riwayat Slide-Over Drawer */}
      {showRiwayat && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowRiwayat(false)} />
          <div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <span className="material-icons-round text-indigo-600 text-[20px]">history</span>
                </div>
                <div>
                  <h2 className="font-black text-slate-800 text-base">Riwayat Dokumen LPJ</h2>
                  <p className="text-xs text-slate-400">{timeline.length} aktivitas tercatat</p>
                </div>
              </div>
              <button onClick={() => setShowRiwayat(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500">
                <span className="material-icons-round text-[20px]">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {timelineLoading ? (
                <div className="flex items-center justify-center h-32 gap-2 text-slate-400">
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  Memuat riwayat...
                </div>
              ) : timeline.length === 0 ? (
                <div className="text-center text-slate-400 py-12">
                  <span className="material-icons-round text-4xl text-slate-300 block mb-2">history_toggle_off</span>
                  Belum ada riwayat tercatat.
                </div>
              ) : (
                <div className="relative pl-8">
                  <div className="absolute left-3.5 top-0 bottom-0 w-0.5 bg-slate-200" />
                  {timeline.map((entry) => {
                    const colorMap: Record<string, string> = {
                      'Dibuat': 'bg-slate-500', 'Diajukan': 'bg-amber-500',
                      'Direvisi & Diajukan Ulang': 'bg-blue-500',
                      'Revisi': 'bg-red-500', 'Disetujui': 'bg-emerald-500',
                    };
                    const iconMap: Record<string, string> = {
                      'Dibuat': 'add', 'Diajukan': 'send',
                      'Direvisi & Diajukan Ulang': 'replay',
                      'Revisi': 'rate_review', 'Disetujui': 'check_circle',
                    };
                    const color = colorMap[entry.aksi] || 'bg-slate-400';
                    const icon = iconMap[entry.aksi] || 'circle';
                    return (
                      <div key={entry.id} className="mb-5 relative">
                        <div className={`absolute -left-8 w-7 h-7 rounded-full ${color} flex items-center justify-center shadow`}>
                          <span className="material-icons-round text-white text-[13px]">{icon}</span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${color}`}>{entry.aksi}</span>
                            <span className="text-[11px] text-slate-400 ml-auto">{new Date(entry.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {entry.status_sebelum && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                              <span className="px-2 py-0.5 bg-slate-100 rounded font-medium">{entry.status_sebelum}</span>
                              <span className="material-icons-round text-[14px]">arrow_forward</span>
                              <span className="px-2 py-0.5 bg-slate-800 text-white rounded font-bold">{entry.status_sesudah}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="material-icons-round text-[14px]">person</span>
                            <span>{entry.nama_pelaksana}</span>
                            <span className="text-slate-300">•</span>
                            <span>{entry.nama_role}</span>
                          </div>
                          {entry.keterangan && (
                            <div className="mt-2 bg-amber-50 border-l-2 border-amber-400 pl-2 py-1 rounded-r">
                              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">Catatan Reviewer</p>
                              <p className="text-xs text-amber-900">&ldquo;{entry.keterangan}&rdquo;</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200">
              <button onClick={() => setShowRiwayat(false)} className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                <span className="material-icons-round text-[16px]">close</span> Tutup Riwayat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

