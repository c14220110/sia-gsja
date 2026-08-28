'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';
import QRCodeModal from '@/components/ui/QRCodeModal';
import { exportInventarisToExcel, DEFAULT_EXPORT_COLUMNS } from '@/lib/exportInventaris';

/** Converts stored R2 public URL to our authenticated proxy URL */
function fotoUrlToProxy(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const key = new URL(url).pathname.slice(1);
    if (!key.startsWith('inventaris/')) return null;
    return `/api/inventaris/image?key=${encodeURIComponent(key)}`;
  } catch { return null; }
}

export default function InventarisPage() {
  const { showLoader, hideLoader } = useLoader();


  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });

  // QR Code modal
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrItem, setQrItem] = useState<{ nama: string; kode_barang: string; nama_kategori: string } | null>(null);

  // Photo lightbox
  const [photoModalUrl, setPhotoModalUrl] = useState<string | null>(null);
  const router = useRouter();

  const [alertState, setAlertState] = useState<{ isOpen: boolean; id: number | null; }>({
    isOpen: false,
    id: null
  });

  const [userData, setUserData] = useState<any>(null);

  const [kategoriOptions, setKategoriOptions] = useState<any[]>([]);
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  
  const [data, setData] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;
  
  const [filterKategori, setFilterKategori] = useState('');
  const [filterSatelit, setFilterSatelit] = useState('');
  const [filterKondisi, setFilterKondisi] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAktivaTetap, setFilterAktivaTetap] = useState('');
  const [stats, setStats] = useState<{ total: number; kondisi_baik: number; perlu_perhatian: number; total_nilai: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [exportModal, setExportModal] = useState<{
    open: boolean;
    satelit: string; kategori: string; kondisi: string; status: string; aktivaTetap: string;
    columns: string[]; fileName: string;
    previewCount: number | null; previewLoading: boolean; isExporting: boolean;
  }>({
    open: false, satelit: '', kategori: '', kondisi: '', status: '', aktivaTetap: '',
    columns: [...DEFAULT_EXPORT_COLUMNS],
    fileName: `Inventaris_GSJA_${new Date().toISOString().split('T')[0]}`,
    previewCount: null, previewLoading: false, isExporting: false,
  });

  const openExportModal = () => {
    // Pre-fill with current page filters
    setExportModal(prev => ({
      ...prev,
      open: true,
      satelit: filterSatelit,
      kategori: filterKategori,
      kondisi: filterKondisi === 'Semua' ? '' : filterKondisi,
      status: filterStatus === 'Semua' ? '' : filterStatus,
      aktivaTetap: filterAktivaTetap,
      previewCount: null, previewLoading: false, isExporting: false,
    }));
  };

  const fetchExportPreview = async (modal: typeof exportModal) => {
    setExportModal(prev => ({ ...prev, previewLoading: true }));
    try {
      const q = new URLSearchParams({ limit: '1', offset: '0' });
      if (modal.satelit) q.append('lokasi_satelit_id', modal.satelit);
      if (modal.kategori) q.append('kategori_id', modal.kategori);
      if (modal.kondisi) q.append('kondisi', modal.kondisi);
      if (modal.status) q.append('status', modal.status);
      if (modal.aktivaTetap) q.append('is_aktiva_tetap', modal.aktivaTetap);
      const res = await fetch(`/api/inventaris?${q.toString()}`);
      const result = await res.json();
      setExportModal(prev => ({ ...prev, previewCount: result.success ? result.meta.total : null, previewLoading: false }));
    } catch {
      setExportModal(prev => ({ ...prev, previewCount: null, previewLoading: false }));
    }
  };

  const doExport = async () => {
    setExportModal(prev => ({ ...prev, isExporting: true }));
    try {
      const q = new URLSearchParams({ export: 'true' });
      if (exportModal.satelit) q.append('lokasi_satelit_id', exportModal.satelit);
      if (exportModal.kategori) q.append('kategori_id', exportModal.kategori);
      if (exportModal.kondisi) q.append('kondisi', exportModal.kondisi);
      if (exportModal.status) q.append('status', exportModal.status);
      if (exportModal.aktivaTetap) q.append('is_aktiva_tetap', exportModal.aktivaTetap);

      const res = await fetch(`/api/inventaris?${q.toString()}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.message);

      const parts: string[] = [];
      if (exportModal.satelit) parts.push(satelitOptions.find((s: any) => s.id.toString() === exportModal.satelit)?.nama_satelit || 'Satelit');
      if (exportModal.kategori) parts.push(kategoriOptions.find((k: any) => k.id.toString() === exportModal.kategori)?.nama || 'Kategori');
      if (exportModal.kondisi) parts.push(`Kondisi: ${exportModal.kondisi}`);
      if (exportModal.status) parts.push(`Status: ${exportModal.status}`);
      if (exportModal.aktivaTetap === 'true') parts.push('Aktiva Tetap');
      else if (exportModal.aktivaTetap === 'false') parts.push('Non-Aktiva');
      const filterLabel = parts.length > 0 ? parts.join(' · ') : 'Semua Data';

      await exportInventarisToExcel(result.data, filterLabel, {
        columns: exportModal.columns,
        fileName: exportModal.fileName,
      });
      setExportModal(prev => ({ ...prev, open: false, isExporting: false }));
    } catch (error) {
      console.error('Export failed', error);
      setExportModal(prev => ({ ...prev, isExporting: false }));
    }
  };

  const toggleExportColumn = (key: string) => {
    setExportModal(prev => ({
      ...prev,
      columns: prev.columns.includes(key)
        ? prev.columns.filter(c => c !== key)
        : [...prev.columns, key],
    }));
  };

  useEffect(() => {
    const fetchOptionsAndUser = async () => {
      showLoader();
      try {
        const [resKategori, resSatelit, resUser] = await Promise.all([
          fetch('/api/inventaris/master?type=kategori'),
          fetch('/api/options?type=satelit'),
          fetch('/api/auth/me')
        ]);
        const kategoriData = await resKategori.json();
        const satelitData = await resSatelit.json();
        const authData = resUser.ok ? await resUser.json() : null;

        if (kategoriData.success) setKategoriOptions(kategoriData.data);
        if (satelitData.success) setSatelitOptions(satelitData.data);
        if (authData) {
          setUserData(authData);
          // Satellite lock: HANYA untuk non-super-admin yang punya satelit_id
          if (!authData.is_super_admin && authData.satelit_id) {
            setFilterSatelit(authData.satelit_id.toString());
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial data', error);
      } finally {
        hideLoader();
      }
    };
    fetchOptionsAndUser();
  }, []);

  const hasPermission = (perm: string) => {
    if (!userData) return false;
    if (userData.is_super_admin) return true;
    return userData.permissions?.includes?.(perm);
  };

  // debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset ke halaman 1 saat filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterKategori, filterSatelit, filterKondisi, filterStatus, filterAktivaTetap]);

  // Fetch data utama
  useEffect(() => {
    const fetchData = async () => {
      showLoader();
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch) queryParams.append('search', debouncedSearch);
        if (filterKategori) queryParams.append('kategori_id', filterKategori);
        if (filterSatelit) queryParams.append('lokasi_satelit_id', filterSatelit);
        if (filterKondisi && filterKondisi !== 'Semua') queryParams.append('kondisi', filterKondisi);
        if (filterStatus && filterStatus !== 'Semua') queryParams.append('status', filterStatus);
        if (filterAktivaTetap) queryParams.append('is_aktiva_tetap', filterAktivaTetap);
        
        queryParams.append('limit', limit.toString());
        queryParams.append('offset', ((currentPage - 1) * limit).toString());

        const res = await fetch(`/api/inventaris?${queryParams.toString()}`);
        const result = await res.json();
        
        if (result.success) {
          setData(result.data);
          setTotalItems(result.meta.total);
        }
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        hideLoader();
      }
    };

    fetchData();
  }, [debouncedSearch, filterKategori, filterSatelit, filterKondisi, filterStatus, filterAktivaTetap, currentPage]);

  // Fetch stats untuk KPI cards (hanya saat satelit/kategori berubah)
  useEffect(() => {
    if (!userData) return;
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const q = new URLSearchParams();
        if (filterSatelit) q.append('lokasi_satelit_id', filterSatelit);
        if (filterKategori) q.append('kategori_id', filterKategori);
        const res = await fetch(`/api/inventaris/stats?${q.toString()}`);
        const result = await res.json();
        if (result.success) setStats(result.data);
      } catch { /* silent fail — cards show skeleton */ }
      setStatsLoading(false);
    };
    fetchStats();
  }, [userData, filterSatelit, filterKategori]);

  const confirmDelete = async () => {
    const { id } = alertState;
    if (!id) return;
    setAlertState({ isOpen: false, id: null });
    
    try {
      setSubmitState({ status: 'loading', message: '' });
      const res = await fetch(`/api/inventaris/${id}`, {
        method: 'DELETE'
      });
      const result = await res.json();
      if (result.success) {
        setData(prev => prev.filter(j => j.id !== id));
        setSubmitState({ status: 'success', message: 'Data berhasil dihapus' });
        setTotalItems(prev => prev - 1);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal menghapus data' });
      }
    } catch (error) {
      console.error(error);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan koneksi saat menghapus.' });
    }
  };

  const totalPages = Math.ceil(totalItems / limit) || 1;

  return (
    <div className="w-full flex flex-col gap-8 pb-10">
      
      {/* Header Section */}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
            <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Inventaris Barang</h1>
            <div className="text-slate-500 text-base font-medium font-sans leading-6">Sistem Manajemen Aset & Perlengkapan</div>
          </div>
          <div className="flex items-center gap-3">
            {hasPermission('inventaris_view') && (
              <button
                onClick={openExportModal}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg flex justify-start items-center gap-2 hover:bg-emerald-50 hover:border-emerald-300 transition-colors shadow-sm"
              >
                <span className="material-icons-round text-emerald-600 text-[20px]">table_view</span>
                <span className="text-slate-700 text-sm font-bold font-sans leading-5">Export Excel</span>
              </button>
            )}
            {hasPermission('inventaris_manage') && (
              <Link href="/inventaris/tambah" className="px-5 py-2.5 bg-slate-700 rounded-lg flex justify-start items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none">
                <span className="material-icons-round text-white text-[20px]">add</span>
                <span className="text-white text-sm font-bold font-sans leading-5">Tambah Barang</span>
              </Link>
            )}
          </div>
        </div>


      {/* ── KPI Dashboard Cards ─────────────────────────────────────────── */}
      {hasPermission('inventaris_view') && (() => {
        const fmt = (n: number) => {
          if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
          if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} Jt`;
          return `Rp ${n.toLocaleString('id-ID')}`;
        };
        const pctBaik = stats && stats.total > 0
          ? Math.round((stats.kondisi_baik / stats.total) * 100)
          : null;
        const cards = [
          {
            label: 'Total Barang',
            value: statsLoading ? '—' : (stats?.total.toLocaleString('id-ID') ?? '—'),
            sub: filterSatelit
              ? (satelitOptions.find((s: any) => s.id.toString() === filterSatelit)?.nama_satelit || 'Satelit Terpilih')
              : 'Semua Satelit',
            icon: 'inventory_2',
            iconBg: 'bg-slate-100', iconColor: 'text-slate-600',
            accent: 'border-l-slate-400',
          },
          {
            label: 'Kondisi Baik',
            value: statsLoading ? '—' : (stats?.kondisi_baik.toLocaleString('id-ID') ?? '—'),
            sub: pctBaik !== null ? `${pctBaik}% dari total` : '',
            icon: 'check_circle',
            iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600',
            accent: 'border-l-emerald-400',
          },
          {
            label: 'Perlu Perhatian',
            value: statsLoading ? '—' : (stats?.perlu_perhatian.toLocaleString('id-ID') ?? '—'),
            sub: 'Rusak Ringan & Rusak Berat',
            icon: 'warning',
            iconBg: 'bg-amber-100', iconColor: 'text-amber-600',
            accent: 'border-l-amber-400',
          },
          {
            label: 'Total Nilai Aset',
            value: statsLoading ? '—' : (stats ? fmt(stats.total_nilai) : '—'),
            sub: 'Akumulasi nilai perolehan',
            icon: 'payments',
            iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600',
            accent: 'border-l-indigo-400',
          },
        ];
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map((c) => (
              <div key={c.label} className={`bg-white rounded-xl border border-slate-200 border-l-4 ${c.accent} shadow-sm px-4 py-4 flex items-center gap-3`}>
                <div className={`w-10 h-10 rounded-lg ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <span className={`material-icons-round ${c.iconColor} text-[22px]`}>{c.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide leading-none mb-1">{c.label}</p>
                  <p className={`text-2xl font-black text-slate-800 leading-none ${statsLoading ? 'animate-pulse text-slate-300' : ''}`}>{c.value}</p>
                  {c.sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{c.sub}</p>}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Category Icon Chip Bar ───────────────────────────────────────── */}
      {(() => {
        const VISUAL: Record<string, { icon: string; color: string; bg: string; activeBg: string; activeText: string }> = {
          '01': { icon: 'landscape',          color: 'text-stone-600',  bg: 'bg-stone-50  border-stone-200',  activeBg: 'bg-stone-600',  activeText: 'text-white' },
          '02': { icon: 'local_parking',      color: 'text-zinc-600',   bg: 'bg-zinc-50   border-zinc-200',   activeBg: 'bg-zinc-600',   activeText: 'text-white' },
          '03': { icon: 'church',             color: 'text-slate-600',  bg: 'bg-slate-50  border-slate-200',  activeBg: 'bg-slate-700',  activeText: 'text-white' },
          '04': { icon: 'directions_car',     color: 'text-sky-700',    bg: 'bg-sky-50    border-sky-200',    activeBg: 'bg-sky-600',    activeText: 'text-white' },
          '05': { icon: 'speaker',            color: 'text-blue-700',   bg: 'bg-blue-50   border-blue-200',   activeBg: 'bg-blue-600',   activeText: 'text-white' },
          '06': { icon: 'music_note',         color: 'text-pink-700',   bg: 'bg-pink-50   border-pink-200',   activeBg: 'bg-pink-600',   activeText: 'text-white' },
          '07': { icon: 'volunteer_activism', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', activeBg: 'bg-purple-600', activeText: 'text-white' },
          '08': { icon: 'bolt',              color: 'text-amber-700',  bg: 'bg-amber-50  border-amber-200',  activeBg: 'bg-amber-500',  activeText: 'text-white' },
          '09': { icon: 'computer',           color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', activeBg: 'bg-indigo-600', activeText: 'text-white' },
          '10': { icon: 'business_center',    color: 'text-teal-700',   bg: 'bg-teal-50   border-teal-200',   activeBg: 'bg-teal-600',   activeText: 'text-white' },
          '11': { icon: 'chair',             color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', activeBg: 'bg-orange-600', activeText: 'text-white' },
          '12': { icon: 'kitchen',           color: 'text-green-700',  bg: 'bg-green-50  border-green-200',  activeBg: 'bg-green-600',  activeText: 'text-white' },
        };
        const isAllActive = !filterKategori;
        return (
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Semua chip */}
            <button
              onClick={() => { setFilterKategori(''); setCurrentPage(1); }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-bold transition-all duration-150 ${
                isAllActive
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-md scale-105'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700'
              }`}
            >
              <span className="material-icons-round text-[14px]">grid_view</span>
              <span>Semua</span>
            </button>
            {/* 12 kategori chips */}
            {kategoriOptions.map((kat: any) => {
              const v = VISUAL[kat.kode] ?? VISUAL['01'];
              const isActive = filterKategori === kat.id.toString();
              return (
                <button
                  key={kat.id}
                  onClick={() => { setFilterKategori(isActive ? '' : kat.id.toString()); setCurrentPage(1); }}
                  title={kat.nama}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-bold transition-all duration-150 ${
                    isActive
                      ? `${v.activeBg} border-transparent ${v.activeText} shadow-md scale-105`
                      : `bg-white border-slate-200 ${v.color} hover:border-current`
                  }`}
                >
                  <span className="material-icons-round text-[14px]">{v.icon}</span>
                  <span className="max-w-[80px] truncate">{kat.nama.replace('Peralatan ', '').replace('Meubel & Furnitur ', 'Meubel ').replace(' & Rumah Tangga', '')}</span>
                </button>
              );
            })}
          </div>
        );
      })()}

      <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-sm">

        
        {/* Search Bar */}
        <div className="flex-1 min-w-[300px] relative flex items-center">
          <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
          <input 
            type="text" 
            placeholder="Cari berdasarkan nama, kode, merk, no seri..."
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Kategori Dropdown */}
        <div className="relative min-w-[200px]">
          <select 
            value={filterKategori}
            onChange={(e) => { setFilterKategori(e.target.value); setCurrentPage(1); }}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
          >
            <option value="">Semua Kategori</option>
            {kategoriOptions.map((kat) => (
              <option key={kat.id} value={kat.id}>{kat.nama}</option>
            ))}
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        {/* Satelit Dropdown */}
        <div className="relative min-w-[200px]">
          {(!userData?.is_super_admin && userData?.satelit_id) && (
            <span className="material-icons-round absolute left-3 top-2.5 text-slate-400 text-[16px] pointer-events-none z-10">lock</span>
          )}
          <select 
            value={filterSatelit}
            onChange={(e) => { setFilterSatelit(e.target.value); setCurrentPage(1); }}
            disabled={!!(! userData?.is_super_admin && userData?.satelit_id)}
            className={`appearance-none w-full pr-10 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm ${
              (!userData?.is_super_admin && userData?.satelit_id) ? 'bg-slate-100 cursor-not-allowed opacity-80 pl-9' : 'bg-slate-50 cursor-pointer pl-4'
            }`}
          >
            {!(!userData?.is_super_admin && userData?.satelit_id) && <option value="">Semua Satelit (Lokasi)</option>}
            {satelitOptions.map((satelit: any) => (
              <option key={satelit.id} value={satelit.id}>{satelit.nama_satelit}</option>
            ))}
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        {/* More Filters Toggle */}
        <button 
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={`px-4 py-2.5 border rounded-lg flex items-center gap-2 transition-colors group ${showAdvancedFilters ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
        >
          <span className={`material-icons-round text-[20px] transition-colors ${showAdvancedFilters ? 'text-slate-800' : 'text-slate-500 group-hover:text-slate-700'}`}>tune</span>
          <span className={`text-sm font-medium font-sans transition-colors ${showAdvancedFilters ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-800'}`}>More Filters</span>
        </button>
      </div>

      {/* Advanced Filter Collapse Layer (Hidden by default) */}
      {showAdvancedFilters && (
        <div className="w-full p-6 bg-white rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-sans">Kondisi</label>
            <div className="relative">
              <select 
                value={filterKondisi}
                onChange={(e) => { setFilterKondisi(e.target.value); setCurrentPage(1); }}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
              >
                <option value="Semua">Semua</option>
                <option value="Baik">Baik</option>
                <option value="Rusak Ringan">Rusak Ringan</option>
                <option value="Rusak Berat">Rusak Berat</option>
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-sans">Status</label>
            <div className="relative">
              <select 
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
              >
                <option value="Semua">Semua</option>
                <option value="Aktif">Aktif</option>
                <option value="Dipinjam">Dipinjam</option>
                <option value="Dimutasi">Dimutasi</option>
                <option value="Disposed">Disposed</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-sans">Aktiva Tetap</label>
            <div className="relative">
              <select 
                value={filterAktivaTetap}
                onChange={(e) => { setFilterAktivaTetap(e.target.value); setCurrentPage(1); }}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
              >
                <option value="">Semua</option>
                <option value="true">Ya</option>
                <option value="false">Tidak</option>
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

        </div>
      )}

      {/* Data Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="w-full overflow-x-auto overflow-y-visible">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-12"></th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Kode & Nama</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-36">Kategori</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Lokasi</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-16">Jml</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-28">Kondisi</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Status</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-14">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <span className="material-icons-round text-5xl text-slate-200 block mb-2">search_off</span>
                    <span className="text-sm text-slate-400 font-sans">Tidak ada data barang yang ditemukan.</span>
                  </td>
                </tr>
              ) : (
                data.map((item, idx) => {
                  return (
                    <tr
                      key={item.id || idx}
                      onClick={() => router.push(`/inventaris/${item.id}`)}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer relative ${openMenuId === item.id ? 'z-50' : ''}`}
                    >
                      {/* Thumbnail — klik untuk perbesar */}
                      <td className="px-4 py-3">
                        {fotoUrlToProxy(item.foto_url) ? (
                          <div className="relative w-10 h-10 flex-shrink-0">
                            <img
                              src={fotoUrlToProxy(item.foto_url)!}
                              alt={item.nama}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 bg-slate-50 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); setPhotoModalUrl(fotoUrlToProxy(item.foto_url)); }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                                if (fb) fb.style.display = 'flex';
                              }}
                            />
                            <div style={{ display: 'none' }} className="absolute inset-0 w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 items-center justify-center">
                              <span className="material-icons-round text-slate-300 text-[18px]">inventory_2</span>
                            </div>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                            <span className="material-icons-round text-slate-300 text-[18px]">inventory_2</span>
                          </div>
                        )}
                      </td>
                      {/* Kode + Nama (stacked) */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 text-sm truncate max-w-[220px]">{item.nama}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="text-xs text-slate-400 font-mono">{item.kode_barang}</div>
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold leading-none ${
                            item.tipe_barang === 'satuan'
                              ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                              : 'bg-slate-50 text-slate-500 border border-slate-200'
                          }`}>
                            {item.tipe_barang === 'satuan' ? 'SATUAN' : 'MASSAL'}
                          </span>
                        </div>
                      </td>
                      {/* Kategori */}
                      <td className="px-4 py-3 text-slate-600 text-sm truncate max-w-[140px]">{item.nama_kategori || '-'}</td>
                      {/* Lokasi */}
                      <td className="px-4 py-3 text-slate-600 text-sm truncate max-w-[180px]">
                        {item.lokasi_nama_satelit ? (
                          <span>
                            {item.lokasi_nama_satelit}
                            {item.lokasi_nama_sublokasi && (
                              <span className="text-slate-400"> · {item.lokasi_nama_sublokasi}</span>
                            )}
                          </span>
                        ) : '-'}
                      </td>
                      {/* Jumlah */}
                      <td className="px-4 py-3 text-center text-slate-700 font-medium text-sm">{item.jumlah}</td>
                      {/* Kondisi */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold font-sans ${
                          item.kondisi === 'Baik' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : item.kondisi === 'Rusak Ringan' ? 'bg-amber-50 text-amber-600 border border-amber-200'
                          : 'bg-rose-50 text-rose-600 border border-rose-200'
                        }`}>
                          {item.kondisi}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold font-sans ${
                          item.status === 'Aktif' ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : item.status === 'Dipinjam' ? 'bg-purple-50 text-purple-600 border border-purple-200'
                          : item.status === 'Dimutasi' ? 'bg-amber-50 text-amber-600 border border-amber-200'
                          : item.status === 'Disposed' ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : 'bg-slate-50 text-slate-500 border border-slate-200'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      {/* Aksi */}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openMenuId !== item.id) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right + rect.width / 2 });
                            }
                            setOpenMenuId(openMenuId === item.id ? null : item.id);
                          }}
                          className="hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded transition-colors text-slate-400"
                        >
                          <span className="material-icons-round text-[22px]">more_horiz</span>
                        </button>
                        {openMenuId === item.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }} />
                            <div
                              className="fixed w-48 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-slate-200 z-50 py-1 overflow-visible"
                              style={{ top: menuPosition.top, right: menuPosition.right }}
                            >
                              <Link href={`/inventaris/${item.id}`} onClick={(e) => e.stopPropagation()} className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans">
                                <span className="material-icons-round text-[18px] text-slate-400">visibility</span> Lihat Detail
                              </Link>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQrItem({ nama: item.nama, kode_barang: item.kode_barang, nama_kategori: item.nama_kategori });
                                  setIsQrModalOpen(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-3 text-sm text-indigo-600 font-sans"
                              >
                                <span className="material-icons-round text-[18px] text-indigo-400">qr_code_2</span> QR Code
                              </button>
                              {hasPermission('inventaris_manage') && (
                                <>
                                  <Link href={`/inventaris/${item.id}/edit`} onClick={(e) => e.stopPropagation()} className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans">
                                    <span className="material-icons-round text-[18px] text-slate-400">edit</span> Edit Data
                                  </Link>
                                  <div className="h-px bg-slate-100 my-1" />
                                  <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setAlertState({ isOpen: true, id: item.id }); }} className="w-full text-left px-4 py-2 hover:bg-rose-50 hover:text-rose-700 transition-colors flex items-center gap-3 text-sm text-rose-600 font-sans">
                                    <span className="material-icons-round text-[18px] text-rose-400">delete</span> Hapus
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    {/* Pagination Footer */}
    <div className="w-full px-6 py-4 bg-white border-t border-slate-200 flex flex-col md:flex-row justify-between items-center text-sm gap-4">
          <span className="text-slate-500 font-sans">
            Menampilkan {data.length > 0 ? ((currentPage - 1) * limit) + 1 : 0}-
            {Math.min(currentPage * limit, totalItems)} dari {totalItems} barang
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-9 h-9 rounded-lg border border-slate-200 flex justify-center items-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
            >
               <span className="material-icons-round text-[18px]">chevron_left</span>
            </button>
            <span className="px-4 text-slate-700 font-bold">Halaman {currentPage} dari {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalItems === 0}
              className="w-9 h-9 rounded-lg border border-slate-200 flex justify-center items-center text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
            >
               <span className="material-icons-round text-[18px]">chevron_right</span>
            </button>
        </div>
      </div>

      <AlertModal
        isOpen={alertState.isOpen}
        title="Konfirmasi Hapus"
        message="Apakah Anda yakin ingin menghapus data inventaris ini?"
        onConfirm={confirmDelete}
        onCancel={() => setAlertState({ isOpen: false, id: null })}
      />

      <SubmitOverlay 
        status={submitState.status} 
        message={submitState.message} 
        errors={submitState.errors} 
        onClose={() => setSubmitState({ status: 'idle', message: '' })} 
      />

      {/* Photo lightbox modal — persis jemaat */}
      {photoModalUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPhotoModalUrl(null)}
        >
          <div className="relative max-w-2xl w-full p-4 flex flex-col items-center">
            <button
              className="absolute top-0 right-0 m-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex justify-center items-center text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setPhotoModalUrl(null); }}
            >
              <span className="material-icons-round">close</span>
            </button>
            <img
              src={photoModalUrl}
              alt="Preview Foto Barang"
              className="max-h-[85vh] w-auto object-contain rounded-xl shadow-2xl border border-white/20 bg-white"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrItem && (
        <QRCodeModal
          isOpen={isQrModalOpen}
          onClose={() => { setIsQrModalOpen(false); setQrItem(null); }}
          title={qrItem.nama}
          qrValue={qrItem.kode_barang}
          subtitle={qrItem.nama_kategori}
        />
      )}

      {/* ═══ Export Excel Modal ════════════════════════════════════════════════ */}
      {exportModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setExportModal(p => ({ ...p, open: false }))}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="material-icons-round text-emerald-600 text-[20px]">table_view</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Export Data Inventaris</h3>
                  <p className="text-xs text-slate-400">Atur filter dan pilih kolom sebelum mengunduh</p>
                </div>
              </div>
              <button onClick={() => setExportModal(p => ({ ...p, open: false }))} className="text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-icons-round">close</span>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-5">

              {/* Section 1: Filter */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-icons-round text-slate-400 text-[16px]">filter_list</span>
                  <h4 className="text-sm font-bold text-slate-700">Filter Data</h4>
                  <span className="text-xs text-slate-400">(kosong = semua data)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Satelit / Lokasi</label>
                    <div className="relative">
                      <select value={exportModal.satelit} onChange={e => setExportModal(p => ({ ...p, satelit: e.target.value, previewCount: null }))}
                        className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                        <option value="">Semua Satelit</option>
                        {satelitOptions.map((s: any) => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                      </select>
                      <span className="material-icons-round absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[14px] pointer-events-none">expand_more</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori</label>
                    <div className="relative">
                      <select value={exportModal.kategori} onChange={e => setExportModal(p => ({ ...p, kategori: e.target.value, previewCount: null }))}
                        className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                        <option value="">Semua Kategori</option>
                        {kategoriOptions.map((k: any) => <option key={k.id} value={k.id}>{k.nama}</option>)}
                      </select>
                      <span className="material-icons-round absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[14px] pointer-events-none">expand_more</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Kondisi</label>
                    <div className="relative">
                      <select value={exportModal.kondisi} onChange={e => setExportModal(p => ({ ...p, kondisi: e.target.value, previewCount: null }))}
                        className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                        <option value="">Semua Kondisi</option>
                        <option value="Baik">Baik</option>
                        <option value="Rusak Ringan">Rusak Ringan</option>
                        <option value="Rusak Berat">Rusak Berat</option>
                      </select>
                      <span className="material-icons-round absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[14px] pointer-events-none">expand_more</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                    <div className="relative">
                      <select value={exportModal.status} onChange={e => setExportModal(p => ({ ...p, status: e.target.value, previewCount: null }))}
                        className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                        <option value="">Semua Status</option>
                        <option value="Aktif">Aktif</option>
                        <option value="Dipinjam">Dipinjam</option>
                        <option value="Dimutasi">Dimutasi</option>
                        <option value="Disposed">Disposed</option>
                        <option value="Nonaktif">Nonaktif</option>
                      </select>
                      <span className="material-icons-round absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[14px] pointer-events-none">expand_more</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-2">Jenis Aset</label>
                    <div className="flex flex-wrap gap-4">
                      {[{ v: '', l: 'Semua' }, { v: 'true', l: 'Aktiva Tetap (nilai ≥ Rp 3 juta)' }, { v: 'false', l: 'Non-Aktiva Tetap' }].map(opt => (
                        <label key={opt.v} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="exportAktivaTetap" value={opt.v} checked={exportModal.aktivaTetap === opt.v}
                            onChange={e => setExportModal(p => ({ ...p, aktivaTetap: e.target.value, previewCount: null }))} className="accent-emerald-600" />
                          <span className="text-sm text-slate-700">{opt.l}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100" />

              {/* Section 2: Kolom */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-icons-round text-slate-400 text-[16px]">view_column</span>
                    <h4 className="text-sm font-bold text-slate-700">Kolom yang Disertakan</h4>
                    <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">{exportModal.columns.length} kolom</span>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <button onClick={() => setExportModal(p => ({ ...p, columns: [...DEFAULT_EXPORT_COLUMNS] }))} className="text-emerald-600 hover:text-emerald-800 font-semibold">Reset</button>
                    <button onClick={() => setExportModal(p => ({ ...p, columns: ['kode','nama','kategori','tipe','merk_seri','jumlah','kondisi','status','lokasi','pemilik','nilai','tahun'] }))} className="text-slate-500 hover:text-slate-700 font-semibold">Semua</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {([
                    { key: 'kode',      label: 'Kode Barang' },
                    { key: 'nama',      label: 'Nama Barang' },
                    { key: 'kategori',  label: 'Kategori' },
                    { key: 'tipe',      label: 'Tipe Barang' },
                    { key: 'merk_seri', label: 'Merk / No. Seri' },
                    { key: 'jumlah',    label: 'Jumlah' },
                    { key: 'kondisi',   label: 'Kondisi' },
                    { key: 'status',    label: 'Status' },
                    { key: 'lokasi',    label: 'Lokasi' },
                    { key: 'pemilik',   label: 'Pemilik' },
                    { key: 'nilai',     label: 'Nilai Perolehan' },
                    { key: 'tahun',     label: 'Tahun Perolehan' },
                  ] as const).map(col => (
                    <label key={col.key} className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${exportModal.columns.includes(col.key) ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                      <input type="checkbox" checked={exportModal.columns.includes(col.key)} onChange={() => toggleExportColumn(col.key)} className="accent-emerald-600 flex-shrink-0" />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100" />

              {/* Section 3: Nama file */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nama File</label>
                <div className="flex items-center gap-2">
                  <input type="text" value={exportModal.fileName} onChange={e => setExportModal(p => ({ ...p, fileName: e.target.value }))}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 text-slate-800 font-mono"
                    placeholder="Inventaris_GSJA_2026-08-28" />
                  <span className="text-sm text-slate-400 font-mono whitespace-nowrap">.xlsx</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex items-center justify-between gap-4 flex-shrink-0">
              <div className="flex items-center gap-2 min-h-[28px]">
                {exportModal.previewCount !== null ? (
                  <span className="flex items-center gap-1.5 text-sm text-slate-700">
                    <span className="material-icons-round text-emerald-600 text-[16px]">inventory_2</span>
                    <strong>{exportModal.previewCount.toLocaleString('id-ID')}</strong> barang
                  </span>
                ) : (
                  <button onClick={() => fetchExportPreview(exportModal)} disabled={exportModal.previewLoading}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-600 disabled:opacity-60 transition-colors">
                    {exportModal.previewLoading
                      ? <span className="material-icons-round text-[14px] animate-spin">sync</span>
                      : <span className="material-icons-round text-[14px]">preview</span>}
                    {exportModal.previewLoading ? 'Menghitung...' : 'Cek jumlah data'}
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setExportModal(p => ({ ...p, open: false }))}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors">
                  Batal
                </button>
                <button onClick={doExport} disabled={exportModal.isExporting || exportModal.columns.length === 0}
                  className="px-5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2 transition-colors">
                  {exportModal.isExporting
                    ? <><span className="material-icons-round text-[16px] animate-spin">sync</span>Mengekspor...</>
                    : <><span className="material-icons-round text-[16px]">download</span>Export Excel</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
