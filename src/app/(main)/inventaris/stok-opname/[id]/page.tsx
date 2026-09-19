'use client';

import { useState, useEffect, use, useRef, useMemo } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';
import { exportStokOpnameToExcel } from '@/lib/exportInventaris';
import BarcodeScannerModal from '@/components/ui/BarcodeScannerModal';

export default function StokOpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  const [userData, setUserData] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });
  const [isExporting, setIsExporting] = useState(false);
  const [verifyAlertOpen, setVerifyAlertOpen] = useState(false);

  // Inline edit state
  const [editingDetailId, setEditingDetailId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ jumlah_fisik: '', kondisi_fisik: '', keterangan: '' });

  // Barcode scanner
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [highlightedDetailId, setHighlightedDetailId] = useState<number | null>(null);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  // ── Search & Filter state ─────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'belum' | 'sudah' | 'selisih'>('all');
  const [filterKategori, setFilterKategori] = useState('');

  // ── Toast notification state ──────────────────────────────────────────────
  const [scanToast, setScanToast] = useState<{ msg: string; type: 'success' | 'error' | 'warn' } | null>(null);

  const showScanToast = (msg: string, type: 'success' | 'error' | 'warn' = 'success') => {
    setScanToast({ msg, type });
    setTimeout(() => setScanToast(null), 3000);
  };

  const handleScanResult = async (scanned: string) => {
    if (!data?.detail) return;
    const code = scanned.trim();
    const found = data.detail.find((item: any) =>
      item.kode_barang === code || item.kode_barang?.toLowerCase() === code.toLowerCase()
    );
    if (!found) {
      showScanToast('Kode tidak ditemukan dalam sesi ini', 'error');
      setHighlightedDetailId(-1);
      setTimeout(() => setHighlightedDetailId(null), 2000);
      return;
    }

    // Reset filter so the found item is visible
    setSearchQuery('');
    setFilterStatus('all');
    setFilterKategori('');
    setHighlightedDetailId(found.id);
    setTimeout(() => {
      rowRefs.current[found.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    setTimeout(() => setHighlightedDetailId(null), 3000);

    if (found.tipe_barang === 'satuan') {
      // AUTO-CONFIRM: langsung simpan sebagai Ditemukan (jumlah_fisik = 1)
      try {
        await handleAction('update_detail', {
          detail_id: found.id,
          jumlah_fisik: 1,
        });
        showScanToast(`✓ ${found.nama_barang}: DITEMUKAN`, 'success');
      } catch {
        showScanToast('Gagal menyimpan', 'error');
      }
    } else {
      // MASSAL: buka form input qty seperti biasa
      setEditingDetailId(found.id);
      setEditForm({ jumlah_fisik: found.jumlah_fisik?.toString() ?? '', kondisi_fisik: found.kondisi_fisik ?? '', keterangan: found.keterangan ?? '' });
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      showLoader();
      try {
        const [resUser, resData] = await Promise.all([
          fetch('/api/auth/me'),
          fetch(`/api/inventaris/stok-opname/${id}`)
        ]);
        const authData = resUser.ok ? await resUser.json() : null;
        const sessionData = await resData.json();
        if (authData) setUserData(authData);
        if (sessionData.success) setData(sessionData.data);
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        hideLoader();
      }
    };
    fetchAll();
  }, [id]);

  const hasPermission = (perm: string) => {
    if (!userData) return false;
    if (userData.is_super_admin) return true;
    return userData.permissions?.includes?.(perm);
  };
  const canEdit = hasPermission('inventaris_stok_opname');

  const refreshData = async () => {
    const res = await fetch(`/api/inventaris/stok-opname/${id}`);
    const result = await res.json();
    if (result.success) setData(result.data);
  };

  const handleAction = async (action: string, extra: Record<string, any> = {}) => {
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res = await fetch(`/api/inventaris/stok-opname/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra })
      });
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: result.message });
        await refreshData();
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal' });
      }
    } catch {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan jaringan' });
    }
  };

  const handleSaveDetail = async (detailId: number) => {
    if (editForm.jumlah_fisik === '') {
      setSubmitState({ status: 'error', message: 'Jumlah fisik wajib diisi' });
      return;
    }
    await handleAction('update_detail', {
      detail_id: detailId,
      jumlah_fisik: parseInt(editForm.jumlah_fisik, 10),
      kondisi_fisik: editForm.kondisi_fisik || undefined,
      keterangan: editForm.keterangan || undefined,
    });
    setEditingDetailId(null);
  };

  const handleExportExcel = async () => {
    if (!data) return;
    setIsExporting(true);
    try {
      await exportStokOpnameToExcel(data);
    } catch (error) {
      console.error('Export failed', error);
    } finally {
      setIsExporting(false);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const totalItems = data?.detail?.length || 0;
  const itemsChecked = data?.detail?.filter((d: any) => d.jumlah_fisik !== null).length || 0;
  const itemsWithSelisih = data?.detail?.filter((d: any) => {
    if (d.jumlah_fisik === null) return false;
    return d.jumlah_fisik !== d.jumlah_tercatat;
  }).length || 0;
  const progress = totalItems > 0 ? Math.round((itemsChecked / totalItems) * 100) : 0;

  // Unique kategori list for filter dropdown
  const kategoris = useMemo(() => {
    if (!data?.detail) return [] as string[];
    const set = new Set<string>(data.detail.map((d: any) => d.nama_kategori).filter(Boolean));
    return Array.from(set).sort();
  }, [data?.detail]);

  // Filtered + searched detail
  const filteredDetail = useMemo(() => {
    if (!data?.detail) return [];
    const q = searchQuery.toLowerCase().trim();
    return data.detail.filter((item: any) => {
      // Search by nama or kode
      const matchSearch = !q ||
        item.nama_barang?.toLowerCase().includes(q) ||
        item.kode_barang?.toLowerCase().includes(q);

      // Status filter
      const hasData = item.jumlah_fisik !== null;
      const selisih = hasData ? (item.jumlah_fisik - item.jumlah_tercatat) : null;
      const matchStatus =
        filterStatus === 'all' ||
        (filterStatus === 'belum' && !hasData) ||
        (filterStatus === 'sudah' && hasData) ||
        (filterStatus === 'selisih' && selisih !== null && selisih !== 0);

      // Kategori filter
      const matchKategori = !filterKategori || item.nama_kategori === filterKategori;

      return matchSearch && matchStatus && matchKategori;
    });
  }, [data?.detail, searchQuery, filterStatus, filterKategori]);

  const kondisiOptions = ['Baik', 'Rusak Ringan', 'Rusak Berat', 'Tidak Ditemukan'];

  const kondisiBadge = (kondisi: string) => {
    const map: Record<string, string> = {
      'Baik': 'bg-green-100 text-green-700 border-green-200',
      'Rusak Ringan': 'bg-amber-100 text-amber-700 border-amber-200',
      'Rusak Berat': 'bg-red-100 text-red-700 border-red-200',
      'Tidak Ditemukan': 'bg-slate-100 text-slate-500 border-slate-200',
    };
    return map[kondisi] || 'bg-slate-100 text-slate-500 border-slate-200';
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      'Draft': 'bg-slate-100 text-slate-600',
      'Berjalan': 'bg-blue-100 text-blue-700',
      'Selesai': 'bg-green-100 text-green-700',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  };

  if (!data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-slate-400">
          <span className="material-icons-round text-4xl">assignment</span>
          <p className="mt-2">Memuat data...</p>
        </div>
      </div>
    );
  }

  const STATUS_FILTERS = [
    { key: 'all', label: 'Semua', count: totalItems },
    { key: 'belum', label: 'Belum Dicek', count: totalItems - itemsChecked },
    { key: 'sudah', label: 'Sudah Dicek', count: itemsChecked },
    { key: 'selisih', label: 'Ada Selisih', count: itemsWithSelisih },
  ] as const;

  return (
    <div className="w-full flex flex-col gap-6 pb-10">
      {submitState.status === 'loading' && <SubmitOverlay status="loading" message="Menyimpan..." />}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
            <Link href="/inventaris/stok-opname" className="hover:text-slate-600 transition-colors">Stok Opname</Link>
            <span className="material-icons-round text-[14px]">chevron_right</span>
            <span className="text-slate-600">{data.judul}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 font-sans">{data.judul}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(data.status)}`}>
              {data.status}
            </span>
            <span className="text-sm text-slate-500">{data.nama_satelit}</span>
            {data.periode && <span className="text-sm text-slate-500">• {data.periode}</span>}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-emerald-50 hover:border-emerald-300 transition-colors disabled:opacity-60"
          >
            {isExporting
              ? <span className="material-icons-round text-emerald-600 text-[18px] animate-spin">sync</span>
              : <span className="material-icons-round text-emerald-600 text-[18px]">table_view</span>
            }
            {isExporting ? 'Mengekspor...' : 'Export Excel'}
          </button>

          {canEdit && (
            <>
              {data.status === 'Draft' && (
                <button
                  onClick={() => handleAction('start')}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors"
                >
                  <span className="material-icons-round text-[18px]">play_arrow</span>
                  Mulai Opname
                </button>
              )}
              {data.status === 'Berjalan' && (
                <button
                  onClick={() => setVerifyAlertOpen(true)}
                  disabled={itemsChecked < totalItems}
                  title={itemsChecked < totalItems ? `Masih ada ${totalItems - itemsChecked} item belum dicek` : ''}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-icons-round text-[18px]">verified</span>
                  Selesaikan & Verifikasi
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Total Barang</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{totalItems}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Sudah Dicek</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{itemsChecked}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs text-amber-500 font-medium uppercase tracking-wide">Belum Dicek</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{totalItems - itemsChecked}</p>
        </div>
        <div className={`rounded-xl border p-4 ${itemsWithSelisih > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs font-medium uppercase tracking-wide ${itemsWithSelisih > 0 ? 'text-red-400' : 'text-slate-400'}`}>Ada Selisih</p>
          <p className={`text-2xl font-bold mt-1 ${itemsWithSelisih > 0 ? 'text-red-600' : 'text-slate-400'}`}>{itemsWithSelisih}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Progress</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm font-bold text-slate-700">{progress}%</span>
          </div>
        </div>
      </div>

      {/* ── Status messages ───────────────────────────────────────────────── */}
      {submitState.status === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <span className="material-icons-round text-[18px]">check_circle</span>
          {submitState.message}
        </div>
      )}
      {submitState.status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
          <span className="material-icons-round text-[18px]">error</span>
          {submitState.message}
        </div>
      )}

      {/* ── Info banners ──────────────────────────────────────────────────── */}
      {data.status === 'Berjalan' && (() => {
        const hasSatuan = data.detail?.some((d: any) => d.tipe_barang === 'satuan');
        const hasMassal = data.detail?.some((d: any) => d.tipe_barang === 'massal');
        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
              <span className="material-icons-round text-[18px] flex-shrink-0">info</span>
              <span>Sesi ini <strong>dapat dilanjutkan kapan saja</strong>. Progress tersimpan otomatis — tutup halaman dan kembali lagi besok, data tetap aman.</span>
            </div>
            {(hasSatuan || hasMassal) && (
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                <span className="material-icons-round text-[16px] text-slate-400 flex-shrink-0">qr_code_scanner</span>
                <span className="font-semibold text-slate-700">Mode Scan:</span>
                {hasSatuan && (
                  <span className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 text-indigo-700">
                    <span className="font-bold">🏷️ Aset Satuan</span>
                    — scan otomatis konfirmasi <strong>DITEMUKAN</strong>
                  </span>
                )}
                {hasMassal && (
                  <span className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-slate-600">
                    <span className="font-bold">📦 Stok Massal</span>
                    — scan buka form input jumlah fisik
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })()}
      {data.status === 'Selesai' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600">
          <span className="material-icons-round text-[18px] flex-shrink-0">lock</span>
          <span>Sesi ini sudah <strong>diverifikasi dan dikunci</strong>. Data tidak dapat diubah. Buat sesi baru jika perlu opname ulang.</span>
        </div>
      )}

      {/* ── Scan Toast Notification (fixed top-right) ──────────────────────── */}
      {scanToast && (
        <div className={`fixed top-6 right-6 z-[300] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold animate-in slide-in-from-top-2 fade-in duration-200 ${
          scanToast.type === 'success' ? 'bg-green-600 text-white'
          : scanToast.type === 'error' ? 'bg-red-600 text-white'
          : 'bg-amber-500 text-white'
        }`}>
          <span className="material-icons-round text-[18px]">
            {scanToast.type === 'success' ? 'check_circle' : scanToast.type === 'error' ? 'error' : 'warning'}
          </span>
          {scanToast.msg}
        </div>
      )}

      {/* ── Daftar Barang Table ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

        {/* Table header + search/filter toolbar */}
        <div className="px-4 py-3 border-b border-slate-100">
          {/* Top row: title + scan button */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold text-slate-700">
              Daftar Barang
              <span className="ml-2 text-xs font-normal text-slate-400">
                {filteredDetail.length === totalItems
                  ? `${totalItems} item`
                  : `${filteredDetail.length} dari ${totalItems} item`}
              </span>
            </h2>
            {canEdit && data.status === 'Berjalan' && (
              <button
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs font-bold hover:bg-amber-100 transition-colors"
              >
                <span className="material-icons-round text-[16px]">photo_camera</span>
                Scan Barcode
              </button>
            )}
          </div>

          {/* Search + filter row */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-slate-400 text-[18px]">search</span>
              <input
                type="text"
                placeholder="Cari nama atau kode barang..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-9 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-300 bg-slate-50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-icons-round text-[16px]">close</span>
                </button>
              )}
            </div>

            {/* Kategori dropdown */}
            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-700 min-w-[160px]"
            >
              <option value="">Semua Kategori</option>
              {kategoris.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          {/* Status filter chips */}
          <div className="flex gap-2 mt-2 flex-wrap">
            {STATUS_FILTERS.map(({ key, label, count }) => {
              const isActive = filterStatus === key;
              const chipColor = {
                all: isActive ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                belum: isActive ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-600 border-amber-200 hover:border-amber-400',
                sudah: isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-200 hover:border-blue-400',
                selisih: isActive ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-200 hover:border-red-400',
              }[key];

              return (
                <button
                  key={key}
                  onClick={() => setFilterStatus(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${chipColor}`}
                >
                  {label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Clear all filters */}
            {(searchQuery || filterStatus !== 'all' || filterKategori) && (
              <button
                onClick={() => { setSearchQuery(''); setFilterStatus('all'); setFilterKategori(''); }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                <span className="material-icons-round text-[14px]">filter_alt_off</span>
                Reset filter
              </button>
            )}
          </div>
        </div>

        {/* Not found feedback */}
        {highlightedDetailId === -1 && (
          <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <span className="material-icons-round text-red-500 text-[16px]">search_off</span>
            <span className="text-xs text-red-600 font-medium">Kode barang tidak ditemukan dalam sesi ini.</span>
          </div>
        )}

        {/* Empty state after filter */}
        {filteredDetail.length === 0 && totalItems > 0 && (
          <div className="py-12 text-center text-slate-400">
            <span className="material-icons-round text-3xl mb-2 block">search_off</span>
            <p className="text-sm font-medium text-slate-500">Tidak ada barang yang sesuai filter</p>
            <button
              onClick={() => { setSearchQuery(''); setFilterStatus('all'); setFilterKategori(''); }}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Reset filter
            </button>
          </div>
        )}

        {/* Table */}
        {filteredDetail.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kode & Nama</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Kategori</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Jml Sistem</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Jml Fisik</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Selisih</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kondisi</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDetail.map((item: any) => {
                  const isEditing = editingDetailId === item.id;
                  const hasData = item.jumlah_fisik !== null;
                  const selisih = hasData ? (item.jumlah_fisik - item.jumlah_tercatat) : null;
                  const isHighlighted = highlightedDetailId === item.id;
                  const isSatuan = item.tipe_barang === 'satuan';

                  return (
                    <tr
                      key={item.id}
                      ref={(el) => { rowRefs.current[item.id] = el; }}
                      className={`transition-colors duration-300 ${
                        isHighlighted
                          ? 'bg-amber-100 ring-2 ring-amber-400 ring-inset'
                          : hasData ? 'hover:bg-slate-50' : 'bg-amber-50/30 hover:bg-amber-50/60'
                      }`}
                    >
                      {/* Kode + Nama (merged, always visible) */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="font-medium text-slate-800 text-sm">{item.nama_barang}</p>
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold leading-none ${
                            isSatuan
                              ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                              : 'bg-slate-50 text-slate-500 border border-slate-200'
                          }`}>
                            {isSatuan ? '🏷️ SATUAN' : '📦 MASSAL'}
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-slate-400">{item.kode_barang}</p>
                        {/* Kategori on mobile */}
                        <p className="text-[11px] text-slate-400 mt-0.5 md:hidden">{item.nama_kategori}</p>
                      </td>

                      {/* Kategori — desktop only */}
                      <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{item.nama_kategori}</td>

                      {/* Jumlah sistem — hidden for satuan (always 1, not meaningful) */}
                      <td className="px-4 py-3 text-center text-slate-700 font-medium">
                        {isSatuan ? <span className="text-slate-300 text-xs">—</span> : item.jumlah_tercatat}
                      </td>

                      {isEditing ? (
                        <>
                          {/* Jumlah fisik input */}
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min="0"
                              value={editForm.jumlah_fisik}
                              onChange={(e) => setEditForm(prev => ({ ...prev, jumlah_fisik: e.target.value }))}
                              className="w-20 px-2 py-1.5 border border-blue-300 rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              autoFocus
                            />
                          </td>
                          {/* Selisih (preview live) */}
                          <td className="px-4 py-2 text-center">
                            {editForm.jumlah_fisik !== '' ? (() => {
                              const diff = parseInt(editForm.jumlah_fisik) - item.jumlah_tercatat;
                              return (
                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${diff === 0 ? 'bg-green-50 text-green-600' : diff < 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                  {diff > 0 ? '+' : ''}{diff}
                                </span>
                              );
                            })() : <span className="text-slate-300 text-xs">–</span>}
                          </td>
                          {/* Kondisi select + keterangan */}
                          <td className="px-4 py-2" colSpan={1}>
                            <div className="flex flex-col gap-1.5">
                              <select
                                value={editForm.kondisi_fisik}
                                onChange={(e) => setEditForm(prev => ({ ...prev, kondisi_fisik: e.target.value }))}
                                className="px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                              >
                                <option value="">Pilih kondisi</option>
                                {kondisiOptions.map(k => <option key={k} value={k}>{k}</option>)}
                              </select>
                              <input
                                type="text"
                                placeholder="Keterangan (opsional)"
                                value={editForm.keterangan}
                                onChange={(e) => setEditForm(prev => ({ ...prev, keterangan: e.target.value }))}
                                className="px-2 py-1.5 border border-blue-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 w-36"
                              />
                            </div>
                          </td>
                          {/* Save/cancel */}
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleSaveDetail(item.id)}
                                className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                title="Simpan"
                              >
                                <span className="material-icons-round text-[16px]">check</span>
                              </button>
                              <button
                                onClick={() => setEditingDetailId(null)}
                                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100"
                                title="Batal"
                              >
                                <span className="material-icons-round text-[16px]">close</span>
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Jumlah fisik view — satuan: chip, massal: number */}
                          <td className="px-4 py-3 text-center">
                            {isSatuan ? (
                              hasData ? (
                                item.jumlah_fisik === 1
                                  ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">
                                      <span className="material-icons-round text-[12px]">check_circle</span>
                                      Ditemukan
                                    </span>
                                  : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                                      <span className="material-icons-round text-[12px]">cancel</span>
                                      Tidak Ditemukan
                                    </span>
                              ) : (
                                <span className="text-slate-300 text-xs">Belum dicek</span>
                              )
                            ) : (
                              hasData
                                ? <span className="font-bold text-slate-800">{item.jumlah_fisik}</span>
                                : <span className="text-slate-300 text-xs">–</span>
                            )}
                          </td>
                          {/* Selisih badge — satuan: Sesuai/Hilang, massal: angka */}
                          <td className="px-4 py-3 text-center">
                            {selisih !== null ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                selisih === 0
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : selisih < 0
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {isSatuan
                                  ? (selisih === 0 ? 'Sesuai' : 'Hilang')
                                  : (selisih === 0 ? 'Sesuai' : selisih > 0 ? `+${selisih}` : `${selisih}`)
                                }
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">–</span>
                            )}
                          </td>
                          {/* Kondisi + keterangan */}
                          <td className="px-4 py-3">
                            {item.kondisi_fisik ? (
                              <div className="flex flex-col gap-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border w-fit ${kondisiBadge(item.kondisi_fisik)}`}>
                                  {item.kondisi_fisik}
                                </span>
                                {item.keterangan && (
                                  <span className="text-[11px] text-slate-400 italic">{item.keterangan}</span>
                                )}
                              </div>
                            ) : hasData ? (
                              <span className="text-[11px] text-slate-400 italic">Tidak dicatat</span>
                            ) : (
                              <span className="text-slate-300 text-xs">–</span>
                            )}
                          </td>
                          {/* Action buttons */}
                          <td className="px-4 py-3">
                            {canEdit && data.status === 'Berjalan' && (
                              isSatuan ? (
                                // Satuan: Ditemukan ✓ / Tidak Ditemukan ✗ / Edit catatan
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleAction('update_detail', { detail_id: item.id, jumlah_fisik: 1 })}
                                    title="Tandai Ditemukan"
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      hasData && item.jumlah_fisik === 1
                                        ? 'bg-green-100 text-green-700 border border-green-300'
                                        : 'bg-white border border-slate-200 text-slate-400 hover:border-green-300 hover:text-green-600'
                                    }`}
                                  >
                                    <span className="material-icons-round text-[14px]">check_circle</span>
                                  </button>
                                  <button
                                    onClick={() => handleAction('update_detail', { detail_id: item.id, jumlah_fisik: 0 })}
                                    title="Tandai Tidak Ditemukan"
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      hasData && item.jumlah_fisik === 0
                                        ? 'bg-red-100 text-red-700 border border-red-300'
                                        : 'bg-white border border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-600'
                                    }`}
                                  >
                                    <span className="material-icons-round text-[14px]">cancel</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingDetailId(item.id);
                                      setEditForm({
                                        jumlah_fisik: item.jumlah_fisik !== null ? String(item.jumlah_fisik) : '1',
                                        kondisi_fisik: item.kondisi_fisik || '',
                                        keterangan: item.keterangan || '',
                                      });
                                      setSubmitState({ status: 'idle', message: '' });
                                    }}
                                    title="Tambah catatan kondisi"
                                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-colors"
                                  >
                                    <span className="material-icons-round text-[14px]">edit_note</span>
                                  </button>
                                </div>
                              ) : (
                                // Massal: existing edit button
                                <button
                                  onClick={() => {
                                    setEditingDetailId(item.id);
                                    setEditForm({
                                      jumlah_fisik: item.jumlah_fisik !== null ? String(item.jumlah_fisik) : '',
                                      kondisi_fisik: item.kondisi_fisik || '',
                                      keterangan: item.keterangan || '',
                                    });
                                    setSubmitState({ status: 'idle', message: '' });
                                  }}
                                  className={`inline-flex items-center gap-1 text-xs font-medium border rounded-lg px-2.5 py-1 transition-colors ${
                                    hasData
                                      ? 'text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800'
                                      : 'text-blue-600 border-blue-200 hover:border-blue-400 hover:text-blue-800'
                                  }`}
                                >
                                  <span className="material-icons-round text-[13px]">{hasData ? 'edit' : 'add'}</span>
                                  {hasData ? 'Edit' : 'Input'}
                                </button>
                              )
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer count */}
        {filteredDetail.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>
              Menampilkan <strong className="text-slate-600">{filteredDetail.length}</strong> dari <strong className="text-slate-600">{totalItems}</strong> barang
            </span>
            {filterStatus === 'belum' && filteredDetail.length > 0 && (
              <span className="text-amber-600 font-medium flex items-center gap-1">
                <span className="material-icons-round text-[13px]">warning</span>
                {filteredDetail.length} item perlu dicek
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Footer meta ───────────────────────────────────────────────────── */}
      <div className="text-xs text-slate-400 flex flex-wrap gap-4">
        {data.created_by_name && <span>Dibuat oleh: <strong>{data.created_by_name}</strong></span>}
        {data.verified_by_name && <span>Diverifikasi oleh: <strong>{data.verified_by_name}</strong></span>}
        {data.tanggal && (
          <span>Tanggal: <strong>{new Date(data.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
        )}
      </div>

      {/* ── AlertModal — Konfirmasi Verifikasi ────────────────────────────── */}
      {(() => {
        const kondisiAkanUpdate = (data.detail || []).filter((d: any) => d.kondisi_fisik && d.kondisi_fisik !== '').length;
        const selisihMinus = (data.detail || []).filter((d: any) => { const s = d.jumlah_fisik !== null ? d.jumlah_fisik - d.jumlah_tercatat : null; return s !== null && s < 0; }).length;
        const selisihPlus  = (data.detail || []).filter((d: any) => { const s = d.jumlah_fisik !== null ? d.jumlah_fisik - d.jumlah_tercatat : null; return s !== null && s > 0; }).length;
        return (
          <AlertModal
            isOpen={verifyAlertOpen}
            title="Selesaikan & Verifikasi Stok Opname?"
            message={
              <div className="flex flex-col gap-3 text-sm text-slate-700">
                <p>Tindakan ini akan melakukan hal berikut:</p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2">
                    <span className="material-icons-round text-green-500 text-[16px]">check_circle</span>
                    Sesi ditandai sebagai <strong>Selesai</strong>
                  </li>
                  {kondisiAkanUpdate > 0 && (
                    <li className="flex items-center gap-2">
                      <span className="material-icons-round text-blue-500 text-[16px]">update</span>
                      <strong>{kondisiAkanUpdate} kondisi barang</strong> akan diperbarui di database
                    </li>
                  )}
                  {selisihMinus > 0 && (
                    <li className="flex items-center gap-2">
                      <span className="material-icons-round text-red-500 text-[16px]">trending_down</span>
                      <strong>{selisihMinus} barang</strong> memiliki jumlah fisik lebih sedikit dari sistem
                    </li>
                  )}
                  {selisihPlus > 0 && (
                    <li className="flex items-center gap-2">
                      <span className="material-icons-round text-emerald-500 text-[16px]">trending_up</span>
                      <strong>{selisihPlus} barang</strong> memiliki jumlah fisik lebih banyak dari sistem
                    </li>
                  )}
                </ul>
                <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠️ Tindakan ini <strong>tidak dapat dibatalkan</strong> setelah dikonfirmasi.
                </p>
              </div>
            }
            confirmText="Ya, Verifikasi & Selesaikan"
            cancelText="Batal"
            onConfirm={() => { setVerifyAlertOpen(false); handleAction('verify'); }}
            onCancel={() => setVerifyAlertOpen(false)}
          />
        );
      })()}

      {/* ── Barcode Scanner ───────────────────────────────────────────────── */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(scanned) => {
          setIsScannerOpen(false);
          handleScanResult(scanned);
        }}
        title="Scan Barcode Stok Opname"
        hint="Scan barcode pada barang untuk langsung membuka baris editnya di sesi ini."
      />
    </div>
  );
}
