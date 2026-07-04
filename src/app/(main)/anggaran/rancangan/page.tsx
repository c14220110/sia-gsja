'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertModal } from '@/components/ui/AlertModal';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import AnggaranTimeline from '@/components/anggaran/AnggaranTimeline';

type AnggaranItem = {
  id: string;
  kode_dokumen: string;
  tahun: number;
  satelit: string;
  komisi: string | null;
  total_anggaran: number;
  total_disetujui: number | null;
  estimasi_awal: number | null;        // Penerimaan - Pengeluaran (sebelum review)
  estimasi_disetujui: number | null;   // Penerimaan ACC - Pengeluaran ACC setelah review
  updated_at: string;
  status: string;
  tipe_ra?: string;
  kategori_ra?: string;
  pola_penggunaan?: string;
  nama_rancangan?: string;
  estimasi_waktu?: string;
};

export default function RancanganAnggaranPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTahun, setFilterTahun] = useState('');
  const [filterSatelit, setFilterSatelit] = useState('');
  const [filterKomisi, setFilterKomisi] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [data, setData] = useState<AnggaranItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorizedToCreate, setIsAuthorizedToCreate] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  // State penghapusan
  const [deleteTarget, setDeleteTarget] = useState<AnggaranItem | null>(null);
  const [deleteState, setDeleteState] = useState<{status:'idle'|'loading'|'success'|'error';message:string}>({status:'idle',message:''});

  // State pembatalan
  const [batalTarget, setBatalTarget] = useState<AnggaranItem | null>(null);
  const [batalState, setBatalState] = useState<{status:'idle'|'loading'|'success'|'error';message:string}>({status:'idle',message:''});
  const [alasanBatal, setAlasanBatal] = useState('');

  // State linimasa perjalanan
  const [timelineId, setTimelineId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [resAnggaran, resAuth] = await Promise.all([
          fetch('/api/anggaran/tahunan'),
          fetch('/api/auth/me')
        ]);
        
        const json = await resAnggaran.json();
        if (json.success) setData(json.data);

        if (resAuth.ok) {
          const authData = await resAuth.json();
          if (authData?.role_id) setUserData(authData);
          // Cek izin: anggaran_create khusus buat tombol tambah
          if (authData?.is_super_admin || authData?.permissions?.includes('anggaran_create')) {
            setIsAuthorizedToCreate(true);
          }
        }
      } catch (err) {
        console.error('Gagal memuat data', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Racik pilihan dinamis dari data yang dapet
  const tahunOptions = Array.from(new Set(data.map(d => String(d.tahun)))).sort().reverse();
  const satelitOptions = Array.from(new Set(data.map(d => d.satelit))).sort();
  const komisiOptions = Array.from(new Set(data.filter(d => d.komisi && (!filterSatelit || d.satelit === filterSatelit)).map(d => d.komisi as string))).sort();
  const statusOptions = ['Draft', 'Menunggu Review', 'Sedang Direviu', 'Revisi', 'Disetujui Sebagian', 'Disetujui Penuh', 'Ditolak', 'Dibatalkan'];

  // Saring datanya
  const filteredData = data.filter(item => {
    const matchSearch = item.kode_dokumen.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nama_rancangan || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.komisi || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.satelit.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchTahun = filterTahun === '' || String(item.tahun) === filterTahun;
    const matchSatelit = filterSatelit === '' || item.satelit === filterSatelit;
    const matchKomisi = filterKomisi === '' ? true : (filterKomisi === 'Umum' ? !item.komisi : item.komisi === filterKomisi);
    const matchStatus = filterStatus === '' || item.status === filterStatus;
    
    return matchSearch && matchTahun && matchSatelit && matchKomisi && matchStatus;
  });

  const getStatusBadge = (status: string) => {
    const baseClass = "inline-flex whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold font-sans uppercase";
    switch (status) {
      case 'Draft':
        return <span className={`${baseClass} bg-slate-100 text-slate-600`}>DRAFT</span>;
      case 'Menunggu Review':
        return <span className={`${baseClass} bg-amber-100 text-amber-700`}>MENUNGGU REVIEW</span>;
      case 'Sedang Direviu':
        return <span className={`${baseClass} bg-blue-100 text-blue-700`}>SEDANG DIREVIU</span>;
      case 'Disetujui Sebagian':
        return <span className={`${baseClass} bg-orange-100 text-orange-700`}>DISETUJUI SEBAGIAN</span>;
      case 'Disetujui Penuh':
        return <span className={`${baseClass} bg-green-100 text-green-700`}>DISETUJUI PENUH</span>;
      case 'Ditolak':
        return <span className={`${baseClass} bg-red-100 text-red-700`}>DITOLAK</span>;
      case 'Dibatalkan':
        return <span className={`${baseClass} bg-zinc-100 text-zinc-600`}>DIBATALKAN</span>;
      default:
        return <span className={`${baseClass} bg-slate-100 text-slate-600`}>{status.toUpperCase()}</span>;
    }
  };

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(angka);
  };

  // Hard-delete a Draft RA
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteState({ status: 'loading', message: 'Menghapus rancangan...' });
    try {
      const res = await fetch(`/api/anggaran/tahunan/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setData(prev => prev.filter(d => d.id !== deleteTarget.id));
        setDeleteState({ status: 'success', message: json.message });
      } else {
        setDeleteState({ status: 'error', message: json.message || 'Gagal menghapus.' });
      }
    } catch (e: any) {
      setDeleteState({ status: 'error', message: 'Kesalahan jaringan: ' + e.message });
    } finally {
      setDeleteTarget(null);
    }
  };

  // Batalkan RA
  const handleBatalkan = async () => {
    if (!batalTarget || !alasanBatal.trim()) return;
    setBatalState({ status: 'loading', message: 'Membatalkan rancangan anggaran...' });
    setBatalTarget(null);
    try {
      const res = await fetch(`/api/anggaran/tahunan/${batalTarget.id}/batalkan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alasan: alasanBatal }),
      });
      const json = await res.json();
      if (json.success) {
        setData(prev => prev.map(d => d.id === batalTarget.id ? { ...d, status: 'Dibatalkan' } : d));
        setBatalState({ status: 'success', message: json.message });
      } else {
        setBatalState({ status: 'error', message: json.message || 'Gagal membatalkan.' });
      }
    } catch (e: any) {
      setBatalState({ status: 'error', message: 'Kesalahan jaringan: ' + e.message });
    } finally {
      setAlasanBatal('');
    }
  };

  // Pembantu role buat njaga tampilan UI
  // Draft → hanya bisa Hapus Permanen (hard delete), tidak perlu Batalkan
  // Batalkan RA → untuk status SETELAH diajukan (Menunggu Review dst)
  const ALLOWED_STATUS_PEMBUAT  = ['Menunggu Review']; // Draft dikecualikan — gunakan Hapus Permanen
  const ALLOWED_STATUS_APPROVER = ['Menunggu Review', 'Disetujui Penuh', 'Disetujui Sebagian'];
  const isApprover = userData?.is_super_admin || userData?.permissions?.includes('anggaran_review');
  const isPembuat  = userData?.permissions?.includes('anggaran_create');
  const canBatalkanItem = (item: AnggaranItem) => {
    if (item.status === 'Dibatalkan') return false;
    if (item.status === 'Draft') return false; // Draft → hapus permanen saja
    if (isApprover) return ALLOWED_STATUS_APPROVER.includes(item.status);
    return ALLOWED_STATUS_PEMBUAT.includes(item.status) && isPembuat;
  };

  return (
    <div className="w-full flex flex-col gap-6 relative overflow-hidden">
      {/* ⚠️ AlertModal konfirmasi hapus (Lottie Warning) */}
      <AlertModal
        isOpen={!!deleteTarget}
        title="Hapus Rancangan Anggaran?"
        message={
          <>
            Anda akan menghapus <strong>&quot;{deleteTarget?.nama_rancangan || deleteTarget?.kode_dokumen}&quot;</strong> secara permanen.
            <br/><br/>
            Data rincian item di dalamnya juga akan ikut terhapus. Tindakan ini <strong className="text-red-600">tidak dapat dibatalkan</strong>.
          </>
        }
        confirmText="Ya, Hapus Permanen"
        cancelText="Batal"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      {/* ✅❌ SubmitOverlay feedback delete */}
      <SubmitOverlay status={deleteState.status} message={deleteState.message} onClose={() => setDeleteState({ status: 'idle', message: '' })} />
      {/* ✅❌ SubmitOverlay feedback batalkan */}
      <SubmitOverlay status={batalState.status} message={batalState.message} onClose={() => setBatalState({ status: 'idle', message: '' })} />

      {/* Modal Batalkan RA */}
      {batalTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <span className="material-icons-round text-red-500 text-[22px]">cancel</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800">Batalkan Rancangan Anggaran?</h3>
                <p className="text-xs text-slate-500 mt-0.5">Status <strong>{batalTarget.kode_dokumen}</strong> akan berubah menjadi <strong>Dibatalkan</strong>.</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <span className="material-icons-round text-[14px] text-amber-500 mr-1 align-middle">warning</span>
              Jika RA ini terhubung ke kegiatan, plafonnya otomatis menjadi <strong>Rp 0</strong>.
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Alasan Pembatalan <span className="text-red-500">*</span></label>
              <textarea
                value={alasanBatal}
                onChange={e => setAlasanBatal(e.target.value)}
                placeholder="Contoh: RA digantikan dengan versi revisi yang lebih baru..."
                className="w-full p-3 rounded-lg border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-red-300 focus:outline-none resize-none bg-white"
                rows={3}
                autoFocus
              />
              {!alasanBatal.trim() && <p className="text-[11px] text-red-500 mt-1">Alasan wajib diisi.</p>}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setBatalTarget(null); setAlasanBatal(''); }} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Batal</button>
              <button onClick={handleBatalkan} disabled={!alasanBatal.trim()} className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold text-white transition-colors">Ya, Batalkan RA</button>
            </div>
          </div>
        </div>
      )}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Daftar Rancangan Anggaran</h1>
          <div className="text-slate-500 text-base font-medium font-sans leading-6">Kelola pengajuan rancangan anggaran tiap komisi dan satelit</div>
        </div>
        <div className="flex items-center gap-3">
          {/* Badge: RA pending review */}
          {(() => {
            const pendingCount = data.filter(d => d.status === 'Menunggu Review').length;
            return pendingCount > 0 && isApprover ? (
              <button
                onClick={() => setFilterStatus('Menunggu Review')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-bold hover:bg-amber-100 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                {pendingCount} Menunggu Review
              </button>
            ) : null;
          })()}
          {isAuthorizedToCreate && (
            <Link href="/anggaran/rancangan/new" className="px-5 py-2.5 bg-slate-700 rounded-lg flex justify-start items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none">
              <span className="material-icons-round text-white text-[20px]">add</span>
              <span className="text-white text-sm font-bold font-sans leading-5">Buat Rancangan Baru</span>
            </Link>
          )}
        </div>
      </div>

      {/* Filter Options */}
      <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-sm">
        
        {/* Search Bar */}
        <div className="flex-1 min-w-[300px] relative flex items-center">
          <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
          <input 
            type="text" 
            placeholder="Cari ID Dokumen atau Komisi..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm"
          />
        </div>

        {/* Tahun Dropdown */}
        <div className="relative min-w-[140px]">
          <select 
            value={filterTahun} onChange={e => setFilterTahun(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
          >
            <option value="">Semua Tahun</option>
            {tahunOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        {/* Satelit Dropdown - Hanya tampil untuk admin/pusat */}
        {isApprover && (
          <div className="relative min-w-[150px]">
            <select 
              value={filterSatelit} onChange={e => { setFilterSatelit(e.target.value); setFilterKomisi(''); }}
              className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
            >
              <option value="">Semua Satelit</option>
              {satelitOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
          </div>
        )}

        {/* Komisi Dropdown */}
        <div className="relative min-w-[150px]">
          <select 
            value={filterKomisi} onChange={e => setFilterKomisi(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
          >
            <option value="">Semua Komisi</option>
            <option value="Umum">- Umum (Satelit) -</option>
            {komisiOptions.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        {/* Status Dropdown */}
        <div className="relative min-w-[150px]">
          <select 
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
          >
            <option value="">Semua Status</option>
            {statusOptions.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">flag</span>
        </div>

        <div className="ml-auto text-xs font-medium text-slate-400 whitespace-nowrap hidden lg:block">
          {filteredData.length} dokumen
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm relative z-0 flex flex-col min-h-[400px]">
        <div className="w-full overflow-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[1000px] relative">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-sm">
              <tr>
                <th className="p-4 font-bold text-slate-500 text-xs font-sans uppercase tracking-wider whitespace-nowrap">ID DOKUMEN</th>
                <th className="p-4 font-bold text-slate-500 text-xs font-sans uppercase tracking-wider whitespace-nowrap">NAMA RANCANGAN</th>
                <th className="p-4 font-bold text-slate-500 text-xs font-sans uppercase tracking-wider whitespace-nowrap">KATEGORI RA</th>
                <th className="p-4 font-bold text-slate-500 text-xs font-sans uppercase tracking-wider whitespace-nowrap">TAHUN</th>
                <th className="p-4 font-bold text-slate-500 text-xs font-sans uppercase tracking-wider whitespace-nowrap">SATELIT</th>
                <th className="p-4 font-bold text-slate-500 text-xs font-sans uppercase tracking-wider whitespace-nowrap">KOMISI</th>
                <th className="p-4 font-bold text-slate-500 text-xs font-sans uppercase tracking-wider whitespace-nowrap text-right">TOTAL ANGGARAN</th>
                <th className="p-4 font-bold text-slate-500 text-xs font-sans uppercase tracking-wider whitespace-nowrap">TANGGAL UPDATE</th>
                <th className="p-4 font-bold text-slate-500 text-xs font-sans uppercase tracking-wider whitespace-nowrap">STATUS</th>
                <th className="p-4 font-bold text-slate-500 text-xs font-sans uppercase tracking-wider text-center w-24 whitespace-nowrap">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-400 text-sm">Memuat data anggaran...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-icons-round text-5xl text-slate-200">request_quote</span>
                      <p className="text-slate-500 font-semibold">Belum ada data rancangan anggaran</p>
                      {isAuthorizedToCreate && (
                        <>
                          <p className="text-slate-400 text-sm">Klik tombol "+ Buat Rancangan Baru" untuk membuat rancangan pertama Anda.</p>
                          <Link href="/anggaran/rancangan/new" className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                            <span className="material-icons-round text-[16px]">add</span> Buat Rancangan Baru
                          </Link>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-sm font-medium text-slate-800">
                      <span className="px-2 py-1 bg-slate-100 rounded font-sans text-xs">{item.kode_dokumen}</span>
                    </td>
                    <td className="p-4 text-sm text-slate-800 font-bold">{item.nama_rancangan || 'Rancangan Anggaran ' + item.tahun}</td>
                    <td className="p-4 text-sm text-slate-600">
                      <span className="px-2.5 py-1 bg-fuchsia-50 text-fuchsia-700 rounded-full font-semibold text-xs">{item.kategori_ra || '-'}</span>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full font-semibold text-xs">{item.tahun}</span>
                    </td>
                    <td className="p-4 text-sm text-slate-700 font-medium">{item.satelit}</td>
                    <td className="p-4 text-sm text-slate-600">{item.komisi || <span className="text-slate-400 italic">Anggaran Umum Satelit</span>}</td>
                    <td className="p-4 text-sm text-right">
                      {/* Tampilkan estimasi (Penerimaan - Pengeluaran) bukan gross total */}
                      <span className={`font-bold font-sans block ${
                        item.status === 'Disetujui Sebagian' ? 'text-slate-400 line-through text-xs' : 'text-slate-800'
                      }`}>
                        {formatRupiah(item.estimasi_awal ?? item.total_anggaran)}
                      </span>
                      {item.status === 'Disetujui Sebagian' && item.estimasi_disetujui != null && (
                        <span className="font-bold font-sans text-sm text-blue-700 block">
                          {formatRupiah(item.estimasi_disetujui)}
                          <span className="text-[9px] font-normal text-blue-400 ml-1">disetujui</span>
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-slate-500">{new Date(item.updated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="p-4 text-sm">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center items-center">
                        <div className="relative">
                          <button 
                            onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                            className="w-8 h-8 rounded-full flex justify-center items-center hover:bg-slate-200 text-slate-500 transition-colors"
                          >
                            <span className="material-icons-round text-[20px]">more_vert</span>
                          </button>

                          {openMenuId === item.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-100 py-2 z-50">
                              <Link href={`/anggaran/rancangan/view/${item.id}`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2">
                                <span className="material-icons-round text-[18px] text-slate-400">visibility</span>Lihat Detail
                              </Link>
                              {/* Lihat Riwayat — for non-draft RAs */}
                              {item.status !== 'Draft' && (
                                <button onClick={() => { setOpenMenuId(null); setTimelineId(item.id); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2">
                                  <span className="material-icons-round text-[18px] text-slate-400">history</span>Lihat Riwayat
                                </button>
                              )}
                              {/* Edit — hanya Draft/Revisi untuk pembuat */}
                              {['Draft', 'Revisi'].includes(item.status) && isPembuat && (
                                <Link href={`/anggaran/rancangan/edit/${item.id}`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2">
                                  <span className="material-icons-round text-[18px] text-slate-400">edit</span>{item.status === 'Revisi' ? 'Edit & Perbaiki' : 'Edit Rancangan'}
                                </Link>
                              )}
                              {/* Mulai Review — hanya Menunggu Review untuk reviewer */}
                              {item.status === 'Menunggu Review' && isApprover && (
                                <Link href={`/anggaran/rancangan/review/${item.id}`} className="w-full text-left px-4 py-2 hover:bg-emerald-50 text-emerald-700 text-sm flex items-center gap-2">
                                  <span className="material-icons-round text-[18px] text-emerald-500">rate_review</span>Mulai Review
                                </Link>
                              )}
                              {/* Hapus — hanya Draft untuk pembuat */}
                              {item.status === 'Draft' && isPembuat && (<>
                                <div className="w-full h-px bg-slate-100 my-1"></div>
                                <button onClick={() => { setOpenMenuId(null); setDeleteTarget(item); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2">
                                  <span className="material-icons-round text-[18px] text-red-400">delete</span>Hapus Permanen
                                </button>
                              </>)}
                              {/* Batalkan — berdasarkan role + status */}
                              {canBatalkanItem(item) && (<>
                                <div className="w-full h-px bg-slate-100 my-1"></div>
                                <button onClick={() => { setOpenMenuId(null); setAlasanBatal(''); setBatalTarget(item); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2">
                                  <span className="material-icons-round text-[18px] text-red-400">cancel</span>Batalkan RA
                                </button>
                              </>)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timeline Slide-in Panel */}
      <AnggaranTimeline
        anggaranId={timelineId || ''}
        isOpen={!!timelineId}
        onClose={() => setTimelineId(null)}
      />
    </div>
  );
}
