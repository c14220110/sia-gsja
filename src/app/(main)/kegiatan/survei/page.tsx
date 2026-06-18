'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertModal } from '@/components/ui/AlertModal';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import KeluhanTimeline from '@/components/survei/KeluhanTimeline';


export default function SurveiListPage() {
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  const [activeMainTab, setActiveMainTab] = useState<'survei' | 'keluhan'>('survei');

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Data State
  const [data, setData] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalSurvei, setTotalSurvei] = useState(0);
  const [totalResponden, setTotalResponden] = useState(0);
  const [rataRataSkor, setRataRataSkor] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTipe, setFilterTipe] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });

  // Keluhan tab state
  const [keluhanData, setKeluhanData] = useState<any[]>([]);
  const [keluhanTotal, setKeluhanTotal] = useState(0);
  const [keluhanMeta, setKeluhanMeta] = useState({ total_belum: 0, total_sedang: 0, total_selesai: 0 });
  const [keluhanPage, setKeluhanPage] = useState(1);
  const [keluhanFilterStatus, setKeluhanFilterStatus] = useState('');
  const [keluhanSearch, setKeluhanSearch] = useState('');
  const [debouncedKeluhanSearch, setDebouncedKeluhanSearch] = useState('');
  const keluhanLimit = 15;

  // Tindak Lanjut Modal
  const [tlModalOpen, setTlModalOpen] = useState(false);
  const [selectedTl, setSelectedTl] = useState<any>(null);
  const [tlStatus, setTlStatus] = useState('');
  const [tlCatatan, setTlCatatan] = useState('');

  // Keluhan Timeline
  const [showKeluhanTimeline, setShowKeluhanTimeline] = useState(false);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // User data for permission
  const [userData, setUserData] = useState<any>(null);
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const json = await res.json();
          setUserData(json);
        }
      } catch {}
    };
    fetchUser();
  }, []);

  const hasPermission = (perm: string) => userData?.is_super_admin || userData?.permissions?.includes?.(perm);

  // Redirect jemaat
  useEffect(() => {
    if (userData?.role_name?.toLowerCase() === 'jemaat') router.replace('/jadwal');
  }, [userData, router]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Debounce keluhan search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeluhanSearch(keluhanSearch), 500);
    return () => clearTimeout(timer);
  }, [keluhanSearch]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterStatus, filterTipe]);

  useEffect(() => {
    setKeluhanPage(1);
  }, [debouncedKeluhanSearch, keluhanFilterStatus]);

  // Fetch Data (survei list)
  useEffect(() => {
    if (activeMainTab !== 'survei') return;
    const fetchData = async () => {
      showLoader();
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch) queryParams.append('search', debouncedSearch);
        if (filterStatus) queryParams.append('status', filterStatus);
        if (filterTipe) queryParams.append('tipe_survei', filterTipe);
        queryParams.append('limit', limit.toString());
        queryParams.append('offset', ((currentPage - 1) * limit).toString());

        const res = await fetch(`/api/survei?${queryParams.toString()}`);
        if (res.ok) {
          const result = await res.json();
          if (result.success) {
            setData(result.data);
            setTotalItems(result.meta.total);
            setTotalSurvei(result.meta.total_survei || 0);
            setTotalResponden(result.meta.total_responden || 0);
            setRataRataSkor(result.meta.rata_rata_skor || 0);
          } else {
            setSubmitState({ status: 'error', message: result.message || 'Gagal memuat data' });
          }
        } else {
          const errResult = await res.json().catch(() => ({}));
          setSubmitState({ status: 'error', message: errResult.message || `API Error: ${res.status}` });
        }
      } catch (error) {
        console.error('Failed to fetch survei data', error);
      } finally {
        hideLoader();
      }
    };

    fetchData();
  }, [debouncedSearch, filterStatus, filterTipe, currentPage, refreshTrigger, activeMainTab]);

  // Fetch Keluhan data
  useEffect(() => {
    if (activeMainTab !== 'keluhan') return;
    const fetchKeluhan = async () => {
      showLoader();
      try {
        const queryParams = new URLSearchParams();
        if (keluhanFilterStatus) queryParams.append('status', keluhanFilterStatus);
        if (debouncedKeluhanSearch) queryParams.append('search', debouncedKeluhanSearch);
        queryParams.append('limit', keluhanLimit.toString());
        queryParams.append('offset', ((keluhanPage - 1) * keluhanLimit).toString());

        const res = await fetch(`/api/survei/keluhan?${queryParams.toString()}`);
        if (res.ok) {
          const result = await res.json();
          if (result.success) {
            setKeluhanData(result.data);
            setKeluhanTotal(result.meta.total);
            setKeluhanMeta(result.meta);
          }
        }
      } catch (error) {
        console.error('Failed to fetch keluhan', error);
      } finally {
        hideLoader();
      }
    };

    fetchKeluhan();
  }, [activeMainTab, keluhanFilterStatus, debouncedKeluhanSearch, keluhanPage, refreshTrigger]);

  // Also fetch keluhan count for badge on tab (lightweight, no pagination)
  const [keluhanBelumCount, setKeluhanBelumCount] = useState(0);
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/survei/keluhan?status=Belum%20Ditangani&limit=1&offset=0');
        if (res.ok) {
          const result = await res.json();
          if (result.success) setKeluhanBelumCount(result.meta.total_belum);
        }
      } catch {}
    };
    fetchCount();
  }, [refreshTrigger]);

  const totalPages = Math.ceil(totalItems / limit) || 1;
  const keluhanTotalPages = Math.ceil(keluhanTotal / keluhanLimit) || 1;

  // Delete handler (respects status)
  const handleDelete = async (id: number, surveiStatus: string) => {
    const isTerjadwal = surveiStatus === 'terjadwal';
    const confirmMsg = isTerjadwal 
      ? 'Yakin ingin menghapus survei terjadwal ini secara permanen?' 
      : 'Yakin ingin menonaktifkan survei ini?';
      
    setConfirmModal({
      isOpen: true,
      title: isTerjadwal ? 'Hapus Survei' : 'Nonaktifkan Survei',
      message: confirmMsg,
      confirmText: 'Ya, Lanjutkan',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setSubmitState({ status: 'loading', message: isTerjadwal ? 'Menghapus survei...' : 'Menonaktifkan survei...' });
        try {
          const res = await fetch(`/api/survei/${id}`, { method: 'DELETE' });
          const result = await res.json();
          if (result.success) {
            setSubmitState({ status: 'success', message: result.message });
            setRefreshTrigger(prev => prev + 1);
            setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 2000);
          } else {
            setSubmitState({ status: 'error', message: result.message || 'Gagal menghapus survei' });
          }
        } catch (error) {
          setSubmitState({ status: 'error', message: 'Terjadi kesalahan sistem' });
        }
        setOpenMenuId(null);
      }
    });
  };

  // Publish handler (terjadwal → aktif + send push)
  const handlePublish = async (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Publish Survei',
      message: 'Publish survei ini dan kirim notifikasi ke seluruh jemaat?',
      confirmText: 'Ya, Publish',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setSubmitState({ status: 'loading', message: 'Mempublish survei & mengirim notifikasi...' });
        try {
          const res = await fetch(`/api/survei/${id}/publish`, { method: 'POST' });
          const result = await res.json();
          if (result.success) {
            setSubmitState({ status: 'success', message: result.message });
            setRefreshTrigger(prev => prev + 1);
            setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 3000);
          } else {
            setSubmitState({ status: 'error', message: result.message || 'Gagal mempublish survei' });
          }
        } catch (error) {
          setSubmitState({ status: 'error', message: 'Terjadi kesalahan sistem' });
        }
        setOpenMenuId(null);
      }
    });
  };

  // Close handler (aktif → selesai)
  const handleClose = async (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Selesaikan Survei',
      message: 'Selesaikan survei ini? Jemaat tidak akan bisa mengisi lagi.',
      confirmText: 'Ya, Selesaikan',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setSubmitState({ status: 'loading', message: 'Menutup survei...' });
        try {
          const res = await fetch(`/api/survei/${id}`, { 
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'close' }),
          });
          const result = await res.json();
          if (result.success) {
            setSubmitState({ status: 'success', message: result.message });
            setRefreshTrigger(prev => prev + 1);
            setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 2000);
          } else {
            setSubmitState({ status: 'error', message: result.message || 'Gagal menutup survei' });
          }
        } catch (error) {
          setSubmitState({ status: 'error', message: 'Terjadi kesalahan sistem' });
        }
        setOpenMenuId(null);
      }
    });
  };

  // Push notification handler
  const handlePush = async (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Kirim Notifikasi',
      message: 'Kirim notifikasi push ke jemaat yang belum mengisi survei ini?',
      confirmText: 'Kirim Notifikasi',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setSubmitState({ status: 'loading', message: 'Mengirim notifikasi...' });
        try {
          const res = await fetch(`/api/survei/${id}/push`, { method: 'POST' });
          const result = await res.json();
          if (result.success) {
            setSubmitState({ status: 'success', message: result.message });
            setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 3000);
          } else {
            setSubmitState({ status: 'error', message: result.message || 'Gagal mengirim notifikasi' });
          }
        } catch (error) {
          setSubmitState({ status: 'error', message: 'Terjadi kesalahan sistem' });
        }
        setOpenMenuId(null);
      }
    });
  };

  // Handle tindak lanjut update (from keluhan tab)
  const handleUpdateTL = async () => {
    if (!selectedTl) return;
    setSubmitState({ status: 'loading', message: 'Menyimpan tindak lanjut...' });
    setTlModalOpen(false);
    try {
      const res = await fetch(`/api/survei/keluhan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respons_id: selectedTl.respons_id, status: tlStatus, catatan_tindakan: tlCatatan })
      });
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: 'Tindak lanjut berhasil diperbarui!' });
        setRefreshTrigger(prev => prev + 1);
        setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 2000);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal memperbarui' });
      }
    } catch (error) {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan sistem' });
    }
  };

  // Render Tipe Badge
  const renderTipeBadge = (tipe: string) => {
    if (tipe === 'otomatis') {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap flex items-center gap-1">
          <span className="material-icons-round text-[10px]">bolt</span>Otomatis
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border bg-purple-50 text-purple-700 border-purple-200 whitespace-nowrap flex items-center gap-1">
        <span className="material-icons-round text-[10px]">pan_tool</span>Manual
      </span>
    );
  };

  // Get effective status (computed override for auto-close)
  const getEffectiveStatus = (survei: any) => {
    if (survei.status === 'nonaktif') return 'nonaktif';
    if (survei.status === 'selesai') return 'selesai';
    // Auto-close: aktif but period ended
    if (survei.status === 'aktif' && new Date() > new Date(survei.periode_selesai)) return 'selesai';
    return survei.status; // 'terjadwal' or 'aktif'
  };

  // Render Status Badge
  const renderStatusBadge = (survei: any) => {
    const effectiveStatus = getEffectiveStatus(survei);
    const now = new Date();
    const mulai = new Date(survei.periode_mulai);
    const isOverdue = survei.status === 'terjadwal' && now >= mulai;
    
    switch (effectiveStatus) {
      case 'nonaktif':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full border bg-slate-100 text-slate-600 border-slate-300 whitespace-nowrap flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-400"></span>
            Nonaktif
          </span>
        );
      case 'terjadwal':
        return (
          <span className={`px-2.5 py-1 text-xs font-bold rounded-full border whitespace-nowrap flex items-center gap-1.5 ${
            isOverdue 
              ? 'bg-red-50 text-red-700 border-red-300' 
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {isOverdue ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            )}
            {isOverdue ? 'Terlambat!' : 'Terjadwal'}
          </span>
        );
      case 'aktif':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Aktif
          </span>
        );
      case 'selesai':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full border bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
            Selesai
          </span>
        );
      default:
        return null;
    }
  };

  // Render Keluhan Status Badge
  const renderKeluhanBadge = (status: string) => {
    let colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
    if (status === 'Belum Ditangani') colorClass = 'bg-rose-50 text-rose-700 border-rose-200';
    else if (status === 'Sedang Ditangani') colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
    else if (status === 'Selesai') colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${colorClass} whitespace-nowrap`}>{status}</span>;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    let safeString = dateString;
    if (typeof safeString === 'string' && !safeString.endsWith('Z') && !safeString.includes('+')) {
      safeString = safeString.replace(' ', 'T') + 'Z';
    }
    const date = new Date(safeString);
    return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    let safeString = dateString;
    if (typeof safeString === 'string' && !safeString.endsWith('Z') && !safeString.includes('+')) {
      safeString = safeString.replace(' ', 'T') + 'Z';
    }
    const date = new Date(safeString);
    return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date) + ' WIB';
  };

  // Render star rating with half-star support
  const renderStarRating = (skor: number) => {
    const rounded = Math.round(skor * 10) / 10;
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center">
          {[1, 2, 3, 4, 5].map(star => {
            if (skor >= star) {
              return <span key={star} className="material-icons-round text-[16px] text-amber-400">star</span>;
            } else if (skor >= star - 0.5) {
              return <span key={star} className="material-icons-round text-[16px] text-amber-400">star_half</span>;
            } else {
              return <span key={star} className="material-icons-round text-[16px] text-slate-200">star</span>;
            }
          })}
        </div>
        <span className="text-slate-700 text-sm font-bold font-sans">{rounded > 0 ? rounded.toFixed(1) : '-'}</span>
      </div>
    );
  };

  if (userData?.role_name?.toLowerCase() === 'jemaat') return null;

  return (
    <div className="w-full flex flex-col gap-8 pb-10 relative min-h-screen bg-[#F8FAFC]">
      
      {/* Modals & Overlays */}
      <AlertModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
      
      {/* Submit Overlay */}
      {(submitState.status !== 'idle') && <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => setSubmitState({ status: 'idle', message: '' })} />}

      {/* Header Section */}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Survei Kepuasan</h1>
          <div className="text-slate-500 text-base font-medium font-sans leading-6">Kelola survei kepuasan jemaat terhadap kegiatan gereja</div>
        </div>
        {hasPermission('survei_manage') && (
          <div className="flex items-center gap-3">
            <Link
              href="/kegiatan/notifikasi"
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg flex justify-center items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <span className="material-icons-round text-[18px]">campaign</span>
              <span className="text-sm font-bold font-sans">Broadcast Notifikasi</span>
            </Link>
            <Link
              href="/kegiatan/survei/buat"
              className="px-5 py-2.5 bg-slate-700 text-white rounded-lg flex justify-center items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm"
            >
              <span className="material-icons-round text-[18px]">add</span>
              <span className="text-sm font-bold font-sans">Buat Survei Baru</span>
            </Link>
          </div>
        )}
      </div>

      {/* Statistic Cards */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Total Survei Aktif */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-indigo-50 rounded-xl flex justify-center items-center">
             <span className="material-icons-round text-indigo-600 text-3xl">poll</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">TOTAL SURVEI</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">{totalSurvei}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Responden */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-blue-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-blue-600 text-3xl">groups</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">TOTAL RESPONDEN</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">{totalResponden}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Rata-rata Skor */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-amber-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-amber-600 text-3xl">stars</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">RATA-RATA SKOR KEPUASAN</span>
            <div className="flex items-end gap-2 mt-1">
              <span className={`text-3xl font-bold font-sans leading-9 ${rataRataSkor >= 4 ? 'text-emerald-600' : rataRataSkor >= 3 ? 'text-amber-600' : 'text-rose-600'}`}>{rataRataSkor > 0 ? rataRataSkor.toFixed(1) : '-'}</span>
              <span className="text-slate-400 text-sm font-medium mb-1">/ 5.0</span>
            </div>
          </div>
        </div>

      </div>

      {/* Main Tab Navigation */}
      <div className="w-full bg-white rounded-t-xl shadow-sm border border-b-0 border-slate-200 flex">
        <button
          onClick={() => setActiveMainTab('survei')}
          className={`flex-1 py-4 flex justify-center items-center gap-2 text-sm font-bold transition-colors border-b-2 ${
            activeMainTab === 'survei' 
              ? 'text-blue-600 border-blue-600 bg-blue-50/50' 
              : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span className="material-icons-round text-[18px]">poll</span>
          Daftar Survei
        </button>
        <button
          onClick={() => setActiveMainTab('keluhan')}
          className={`flex-1 py-4 flex justify-center items-center gap-2 text-sm font-bold transition-colors border-b-2 ${
            activeMainTab === 'keluhan' 
              ? 'text-rose-600 border-rose-600 bg-rose-50/50' 
              : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span className="material-icons-round text-[18px]">flag</span>
          Keluhan Survei
          {keluhanBelumCount > 0 && (
            <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-black rounded-full">{keluhanBelumCount}</span>
          )}
        </button>
      </div>

      {/* ===================== TAB: DAFTAR SURVEI ===================== */}
      {activeMainTab === 'survei' && (
        <>
          {/* Filter Options */}
          <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-sm -mt-8">
            
            {/* Search Bar */}
            <div className="flex-1 min-w-[200px] relative flex items-center">
              <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
              <input 
                type="text" 
                placeholder="Cari judul survei..."
                className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status Dropdown */}
            <div className="relative min-w-[150px]">
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
              >
                <option value="">Semua Status</option>
                <option value="terjadwal">Terjadwal</option>
                <option value="aktif">Aktif</option>
                <option value="selesai">Selesai</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>

            {/* Tipe Survei Dropdown */}
            <div className="relative min-w-[150px]">
              <select 
                value={filterTipe}
                onChange={(e) => setFilterTipe(e.target.value)}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
              >
                <option value="">Semua Tipe</option>
                <option value="otomatis">⚡ Otomatis</option>
                <option value="manual">✋ Manual</option>
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>

          </div>

          {/* Data Table */}
          <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative z-0 -mt-4">
            <div className="w-full overflow-x-auto pb-32 min-h-[480px]">
              <div className="min-w-[1000px] flex flex-col">
                {/* Table Header */}
                <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
                  <div className="flex-1 min-w-[250px] text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">JUDUL SURVEI</div>
                  <div className="w-[140px] shrink-0 text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">STATUS</div>
                  <div className="w-[180px] shrink-0 text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">PERIODE</div>
                  <div className="w-[120px] shrink-0 text-center text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">RESPONDEN</div>
                  <div className="w-[160px] shrink-0 text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">RATA-RATA SKOR</div>
                  <div className="w-12 shrink-0 text-center text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">AKSI</div>
                </div>

                {/* Table Body */}
                <div>
                  {data.length === 0 ? (
                    <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
                      <span className="material-icons-round text-5xl mb-2 text-slate-300">poll</span>
                      <span className="text-sm font-sans">Belum ada survei yang dibuat.</span>
                    </div>
                  ) : (
                    data.map((survei, idx) => {
                      const isLastRows = data.length > 5 && idx >= data.length - 2;
                      
                      return (
                    <div key={survei.id} className={`w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-blue-50/40 hover:shadow-[inset_4px_0_0_0_#3b82f6] transition-all relative ${openMenuId === survei.id ? 'z-50' : 'z-10'}`}>
                      
                      {/* Kolom 1: Judul Survei */}
                      <div className="flex-1 min-w-[250px] flex flex-col items-start justify-center pr-4 gap-0.5">
                         <div className="flex items-center gap-2">
                           <Link href={`/kegiatan/survei/${survei.id}`} className="text-slate-900 font-bold text-sm hover:text-blue-600 transition-colors">{survei.judul}</Link>
                           {renderTipeBadge(survei.tipe_survei || 'manual')}
                         </div>
                         {survei.nama_kegiatan ? (
                           <span className="text-blue-500 text-[11px] font-medium flex items-center gap-1">
                             <span className="material-icons-round text-[12px]">event</span>
                             {survei.nama_kegiatan}
                           </span>
                         ) : (
                           <span className="text-slate-400 text-[11px] font-medium italic">Survei Mandiri</span>
                         )}
                         <span className="text-slate-400 text-[11px] font-medium">{survei.nama_satelit}</span>
                      </div>
                      
                      {/* Kolom 2: Status */}
                      <div className="w-[140px] shrink-0 flex items-center justify-start pr-4">
                         {renderStatusBadge(survei)}
                      </div>
                      
                      {/* Kolom 3: Periode */}
                      <div className="w-[180px] shrink-0 flex flex-col justify-center pr-4">
                         <span className="text-slate-700 text-sm font-medium">{formatDate(survei.periode_mulai)}</span>
                         <span className="text-slate-400 text-[11px] font-medium">s/d {formatDate(survei.periode_selesai)}</span>
                      </div>

                      {/* Kolom 4: Responden */}
                      <div className="w-[120px] shrink-0 flex justify-center items-center">
                         <span className="text-slate-700 text-sm font-bold font-sans">{survei.total_responden || 0}</span>
                      </div>

                      {/* Kolom 5: Rata-rata Skor */}
                      <div className="w-[160px] shrink-0 flex items-center">
                         {renderStarRating(survei.rata_rata_skor || 0)}
                      </div>

                      {/* Kolom 6: Aksi */}
                      <div className="w-12 shrink-0 flex justify-center items-center">
                        <div className="relative">
                          <button 
                            onClick={() => setOpenMenuId(openMenuId === survei.id ? null : survei.id)}
                            className="w-8 h-8 rounded-full flex justify-center items-center hover:bg-slate-200 text-slate-500 transition-colors"
                          >
                            <span className="material-icons-round text-[20px]">more_vert</span>
                          </button>

                          {openMenuId === survei.id && (() => {
                            const eStatus = getEffectiveStatus(survei);
                            return (
                            <div className={`absolute right-0 ${isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'} w-56 bg-white rounded-lg shadow-xl border border-slate-100 py-2 z-50`}>
                              {/* Lihat Hasil — always visible */}
                              <Link href={`/kegiatan/survei/${survei.id}`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2">
                                 <span className="material-icons-round text-[18px] text-slate-400">visibility</span>Lihat Hasil
                              </Link>

                              {/* Terjadwal: Publish + Hapus */}
                              {hasPermission('survei_manage') && eStatus === 'terjadwal' && (
                                <>
                                  <div className="w-full h-px bg-slate-100 my-1" />
                                  <button 
                                    onClick={() => handlePublish(survei.id)}
                                    className="w-full text-left px-4 py-2 hover:bg-emerald-50 text-emerald-700 text-sm flex items-center gap-2 font-medium"
                                  >
                                     <span className="material-icons-round text-[18px] text-emerald-500">send</span>Kirim & Publish
                                  </button>
                                  <div className="w-full h-px bg-slate-100 my-1" />
                                  <button 
                                    onClick={() => handleDelete(survei.id, survei.status)}
                                    className="w-full text-left px-4 py-2 hover:bg-rose-50 text-rose-600 text-sm flex items-center gap-2 font-medium"
                                  >
                                     <span className="material-icons-round text-[18px]">delete_forever</span>Hapus Permanen
                                  </button>
                                </>
                              )}

                              {/* Aktif: Kirim Notifikasi Ulang, Selesaikan, Nonaktifkan */}
                              {hasPermission('survei_manage') && eStatus === 'aktif' && (
                                <>
                                  <div className="w-full h-px bg-slate-100 my-1" />
                                  <button 
                                    onClick={() => handlePush(survei.id)}
                                    className="w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-700 text-sm flex items-center gap-2 font-medium"
                                  >
                                     <span className="material-icons-round text-[18px] text-blue-500">notifications_active</span>Kirim Notifikasi Ulang
                                  </button>
                                  <div className="w-full h-px bg-slate-100 my-1" />
                                  <button 
                                    onClick={() => handleClose(survei.id)}
                                    className="w-full text-left px-4 py-2 hover:bg-amber-50 text-amber-700 text-sm flex items-center gap-2 font-medium"
                                  >
                                     <span className="material-icons-round text-[18px] text-amber-500">check_circle</span>Selesaikan Survei
                                  </button>
                                  <div className="w-full h-px bg-slate-100 my-1" />
                                  <button 
                                    onClick={() => handleDelete(survei.id, survei.status)}
                                    className="w-full text-left px-4 py-2 hover:bg-rose-50 text-rose-600 text-sm flex items-center gap-2 font-medium"
                                  >
                                     <span className="material-icons-round text-[18px]">block</span>Nonaktifkan
                                  </button>
                                </>
                              )}

                              {/* Selesai: read-only, no actions */}
                              {eStatus === 'selesai' && (
                                <>
                                  <div className="w-full h-px bg-slate-100 my-1" />
                                  <div className="px-4 py-2 text-slate-400 text-xs italic flex items-center gap-2">
                                    <span className="material-icons-round text-[14px]">lock</span>Survei selesai — tidak bisa diubah
                                  </div>
                                </>
                              )}
                            </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                }))}</div>

              </div>
            </div>

            {/* Pagination Footer */}
            {totalItems > 0 && (
              <div className="w-full px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center rounded-b-xl">
                <div className="text-slate-500 text-sm font-sans">
                  Menampilkan {((currentPage - 1) * limit) + 1} - {Math.min(currentPage * limit, totalItems)} dari {totalItems} survei
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex justify-center items-center text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-icons-round text-[18px]">chevron_left</span>
                  </button>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex justify-center items-center text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-icons-round text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </>
      )}

      {/* ===================== TAB: KELUHAN SURVEI ===================== */}
      {activeMainTab === 'keluhan' && (
        <>
          {/* Keluhan Summary Cards */}
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 -mt-4">
            <div className="p-5 bg-white rounded-xl shadow-sm border border-rose-100 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-rose-50 rounded-xl flex justify-center items-center">
                <span className="material-icons-round text-rose-600 text-2xl">error_outline</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wide">BELUM DITANGANI</span>
                <span className="text-rose-600 text-2xl font-bold font-sans">{keluhanMeta.total_belum}</span>
              </div>
            </div>
            <div className="p-5 bg-white rounded-xl shadow-sm border border-amber-100 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex justify-center items-center">
                <span className="material-icons-round text-amber-600 text-2xl">autorenew</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wide">SEDANG DITANGANI</span>
                <span className="text-amber-600 text-2xl font-bold font-sans">{keluhanMeta.total_sedang}</span>
              </div>
            </div>
            <div className="p-5 bg-white rounded-xl shadow-sm border border-emerald-100 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex justify-center items-center">
                <span className="material-icons-round text-emerald-600 text-2xl">check_circle</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wide">SELESAI</span>
                <span className="text-emerald-600 text-2xl font-bold font-sans">{keluhanMeta.total_selesai}</span>
              </div>
            </div>
          </div>

          {/* Keluhan Filter */}
          <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-sm -mt-4">
            <div className="flex-1 min-w-[200px] relative flex items-center">
              <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
              <input 
                type="text" 
                placeholder="Cari survei atau pertanyaan..."
                className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm"
                value={keluhanSearch}
                onChange={(e) => setKeluhanSearch(e.target.value)}
              />
            </div>
            <div className="relative min-w-[180px]">
              <select 
                value={keluhanFilterStatus}
                onChange={(e) => setKeluhanFilterStatus(e.target.value)}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
              >
                <option value="">Semua Status</option>
                <option value="Belum Ditangani">🔴 Belum Ditangani</option>
                <option value="Sedang Ditangani">🟡 Sedang Ditangani</option>
                <option value="Selesai">🟢 Selesai</option>
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>
            {keluhanData.length > 0 && (
              <button
                onClick={() => setShowKeluhanTimeline(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors"
              >
                <span className="material-icons-round text-[16px]">history</span>
                Lihat Riwayat
              </button>
            )}
            <div className="ml-auto text-xs font-medium text-slate-400 whitespace-nowrap hidden lg:block">
              {keluhanTotal} keluhan
            </div>
          </div>

          {/* Keluhan Table */}
          <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative z-0 -mt-4">
            <div className="w-full overflow-x-auto min-h-[400px]">
              <div className="min-w-[1100px] flex flex-col">
                {/* Table Header */}
                <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
                  <div className="flex-1 min-w-[280px] text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">KELUHAN</div>
                  <div className="w-[200px] shrink-0 text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">ASAL SURVEI</div>
                  <div className="w-[100px] shrink-0 text-center text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">SKOR</div>
                  <div className="w-[140px] shrink-0 text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">STATUS</div>
                  <div className="w-[160px] shrink-0 text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">WAKTU</div>
                  <div className="w-[100px] shrink-0 text-center text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">AKSI</div>
                </div>

                {/* Table Body */}
                <div>
                  {keluhanData.length === 0 ? (
                    <div className="w-full py-16 flex flex-col items-center justify-center text-slate-500">
                      <span className="material-icons-round text-5xl mb-2 text-slate-300">sentiment_satisfied</span>
                      <span className="text-sm font-sans font-medium">Tidak ada keluhan yang ditemukan. 🎉</span>
                      <span className="text-xs text-slate-400 mt-1">Semua respons survei dalam kondisi baik.</span>
                    </div>
                  ) : (
                    keluhanData.map((tl) => (
                      <div key={tl.tindak_lanjut_id} className={`w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-rose-50/30 transition-all ${
                        tl.status === 'Belum Ditangani' ? 'hover:shadow-[inset_4px_0_0_0_#e11d48]' : tl.status === 'Sedang Ditangani' ? 'hover:shadow-[inset_4px_0_0_0_#d97706]' : 'hover:shadow-[inset_4px_0_0_0_#059669]'
                      }`}>
                        
                        {/* Kolom 1: Keluhan Detail */}
                        <div className="flex-1 min-w-[280px] flex items-start gap-3 pr-4">
                          <div className={`w-9 h-9 rounded-xl flex justify-center items-center shrink-0 mt-0.5 ${
                            tl.status === 'Selesai' ? 'bg-emerald-50 text-emerald-600' : tl.status === 'Sedang Ditangani' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                          }`}>
                            <span className="material-icons-round text-lg">{tl.status === 'Selesai' ? 'check_circle' : tl.status === 'Sedang Ditangani' ? 'autorenew' : 'error_outline'}</span>
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-slate-900 font-bold text-sm truncate">{tl.nama_jemaat || 'Anonim'}</span>
                            <span className="text-slate-500 text-xs font-medium truncate">{tl.teks_pertanyaan}</span>
                            {tl.jawaban_teks && (
                              <span className="text-slate-400 text-[11px] italic truncate">&ldquo;{tl.jawaban_teks}&rdquo;</span>
                            )}
                          </div>
                        </div>

                        {/* Kolom 2: Asal Survei */}
                        <div className="w-[200px] shrink-0 flex flex-col gap-0.5 pr-4">
                          <Link href={`/kegiatan/survei/${tl.survei_id}`} className="text-slate-800 font-semibold text-xs hover:text-blue-600 transition-colors truncate">
                            {tl.survei_judul}
                          </Link>
                          <div className="flex items-center gap-1.5">
                            {renderTipeBadge(tl.tipe_survei || 'manual')}
                          </div>
                          <span className="text-slate-400 text-[10px]">{tl.nama_satelit}</span>
                        </div>

                        {/* Kolom 3: Skor */}
                        <div className="w-[100px] shrink-0 flex justify-center items-center">
                          <div className="flex items-center gap-1">
                            <span className="material-icons-round text-[16px] text-amber-400">star</span>
                            <span className="text-rose-600 text-sm font-bold">{tl.skor}/5</span>
                          </div>
                        </div>

                        {/* Kolom 4: Status */}
                        <div className="w-[140px] shrink-0 flex items-center">
                          {renderKeluhanBadge(tl.status)}
                        </div>

                        {/* Kolom 5: Waktu */}
                        <div className="w-[160px] shrink-0 flex flex-col gap-0.5">
                          <span className="text-slate-600 text-xs font-medium">{formatDateTime(tl.respons_created_at)}</span>
                          {tl.ditangani_oleh_nama && (
                            <span className="text-slate-400 text-[10px] flex items-center gap-1">
                              <span className="material-icons-round text-[10px]">person</span>
                              {tl.ditangani_oleh_nama}
                            </span>
                          )}
                        </div>

                        {/* Kolom 6: Aksi */}
                        <div className="w-[100px] shrink-0 flex justify-center items-center">
                          {hasPermission('survei_manage') && tl.status !== 'Selesai' ? (
                            <button
                              onClick={() => {
                                setSelectedTl(tl);
                                setTlStatus(tl.status === 'Belum Ditangani' ? 'Sedang Ditangani' : 'Selesai');
                                setTlCatatan(tl.catatan_tindakan || '');
                                setTlModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-colors"
                            >
                              Tindak Lanjut
                            </button>
                          ) : tl.status === 'Selesai' ? (
                            <span className="text-emerald-500 text-[11px] font-bold flex items-center gap-1">
                              <span className="material-icons-round text-[14px]">check</span>Tuntas
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Keluhan Pagination */}
            {keluhanTotal > 0 && (
              <div className="w-full px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center rounded-b-xl">
                <div className="text-slate-500 text-sm font-sans">
                  Menampilkan {((keluhanPage - 1) * keluhanLimit) + 1} - {Math.min(keluhanPage * keluhanLimit, keluhanTotal)} dari {keluhanTotal} keluhan
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setKeluhanPage(prev => Math.max(1, prev - 1))}
                    disabled={keluhanPage === 1}
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex justify-center items-center text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-icons-round text-[18px]">chevron_left</span>
                  </button>
                  <button 
                    onClick={() => setKeluhanPage(prev => Math.min(keluhanTotalPages, prev + 1))}
                    disabled={keluhanPage === keluhanTotalPages}
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex justify-center items-center text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-icons-round text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tindak Lanjut Modal */}
      {tlModalOpen && selectedTl && (
        <div className="fixed inset-0 z-[100] flex justify-center items-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setTlModalOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex justify-center items-center text-blue-600">
                  <span className="material-icons-round">rate_review</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Tindak Lanjut Keluhan</h3>
                  <p className="text-xs text-slate-500 font-medium">Skor {selectedTl.skor}/5 — {selectedTl.nama_jemaat || 'Anonim'}</p>
                </div>
              </div>
              <button onClick={() => setTlModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4">
              {/* Context: Pertanyaan + jawaban */}
              <div className="bg-rose-50/50 rounded-xl p-4 border border-rose-100">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Keluhan</span>
                <p className="text-sm text-slate-700 font-medium mt-1">{selectedTl.teks_pertanyaan}</p>
                {selectedTl.jawaban_teks && (
                  <p className="text-xs text-slate-500 mt-1.5 italic">&ldquo;{selectedTl.jawaban_teks}&rdquo;</p>
                )}
                <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                  <span>Survei: <strong className="text-slate-600">{selectedTl.survei_judul}</strong></span>
                  <span>•</span>
                  <span>{selectedTl.nama_satelit}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
                <select
                  value={tlStatus}
                  onChange={(e) => setTlStatus(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                >
                  <option value="Belum Ditangani">Belum Ditangani</option>
                  <option value="Sedang Ditangani">Sedang Ditangani</option>
                  <option value="Selesai">Selesai</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Catatan Tindakan</label>
                <textarea
                  value={tlCatatan}
                  onChange={(e) => setTlCatatan(e.target.value)}
                  rows={4}
                  placeholder="Jelaskan tindakan yang telah dilakukan..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 text-sm resize-none"
                />
              </div>
              <button
                onClick={handleUpdateTL}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors"
              >
                Simpan Tindak Lanjut
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keluhan Timeline Slide-in Panel */}
      <KeluhanTimeline
        surveiId=""
        isOpen={showKeluhanTimeline}
        onClose={() => setShowKeluhanTimeline(false)}
        tindakLanjutData={keluhanData}
        onUpdated={() => setRefreshTrigger(prev => prev + 1)}
      />

    </div>
  );
}
