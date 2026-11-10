'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';

export default function PengurusPage() {
  const { showLoader, hideLoader } = useLoader();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });

  // State popup alert peringatannya
  const [alertState, setAlertState] = useState<{ isOpen: boolean; id: number | null; newStatus: string }>({
    isOpen: false,
    id: null,
    newStatus: ''
  });

  // State Sesi Login-nya
  const [userData, setUserData] = useState<any>(null);
  
  const hasPermission = (perm: string) => {
    if (!userData) return false;
    if (userData.is_super_admin) return true;
    return userData.permissions?.includes?.(perm);
  };

  // Pilihan Data Dropdown
  const [satelitOptions,     setSatelitOptions]     = useState<any[]>([]);
  const [jabatanOptions,     setJabatanOptions]     = useState<any[]>([]);
  const [periodeOptions,     setPeriodeOptions]     = useState<any[]>([]);
  const [departemenOptions,  setDepartemenOptions]  = useState<any[]>([]);
  const [komisiOptions,      setKomisiOptions]      = useState<any[]>([]);
  const [roleOptions,        setRoleOptions]        = useState<any[]>([]);

  // State popup buatin akunnya
  const [akunModal, setAkunModal] = useState<{
    open: boolean;
    pengurusId: number | null;
    jemaatId: number | null;
    namaLengkap: string;
    emailDefault: string;
    satelitDefault: string;
    tanggalLahir: string;
    jabatanList: any[];
  }>({ open: false, pengurusId: null, jemaatId: null, namaLengkap: '', emailDefault: '', satelitDefault: '', tanggalLahir: '', jabatanList: [] });

  const [akunForm, setAkunForm] = useState({
    email: '', password: '',
    roles: [] as { role_id: number; role_name: string; satelit_id: number; satelit_name: string; komisi_id: number | null; departemen_id: number | null; lingkup: string; label: string }[],
  });
  const [akunSubmitState, setAkunSubmitState] = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [akunError, setAkunError] = useState('');

  // State popup ngatur akunnya
  const [kelolaAkunModal, setKelolaAkunModal] = useState<{
    open: boolean;
    pengurusId: number | null;
    akunId: number | null;
    namaLengkap: string;
    email: string;
    isActive: boolean;
  }>({ open: false, pengurusId: null, akunId: null, namaLengkap: '', email: '', isActive: false });
  const [kelolaAkunForm, setKelolaAkunForm] = useState({ password: '' });
  const [kelolaAkunSubmitState, setKelolaAkunSubmitState] = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [kelolaAkunError, setKelolaAkunError] = useState('');

  // Komisi saringan buat popup (walau udah jarang kepake, biarin aja biar gak ngadat)
  const filteredKomisiModal: any[] = [];

  // Role yang butuh komisi/departemen scope
  const selectedRoleName = '';
  const isKomisiRole = false;
  const isDepartemenRole = false;

  // State Halaman dan Statistiknya
  const [data,          setData]          = useState<any[]>([]);
  const [totalItems,    setTotalItems]    = useState(0);
  const [pengurusBaru,  setPengurusBaru]  = useState(0);
  const [pengurusDemisioner, setPengurusDemisioner] = useState(0);
  const [currentPage,   setCurrentPage]   = useState(1);
  const limit = 10;

  // ── Quick Filters ──────────────────────────────────
  const [filterSatelitAsal,    setFilterSatelitAsal]    = useState('');
  const [filterStatusGlobal,   setFilterStatusGlobal]   = useState('Aktif');

  // ── Advanced Filters (applied on click) ────────────
  const [filterLingkup,        setFilterLingkup]        = useState('');
  const [filterSatelitPenugasan, setFilterSatelitPenugasan] = useState('');
  const [filterJabatan,        setFilterJabatan]        = useState('');
  const [filterPeriode,        setFilterPeriode]        = useState('');
  const [filterKomisi,         setFilterKomisi]         = useState('');
  const [filterDepartemen,     setFilterDepartemen]     = useState('');

  // Data mampir sementara buat Saringan Lanjutan (biar tombol terapkan guna)
  const [tempLingkup,          setTempLingkup]          = useState('');
  const [tempSatelitPenugasan, setTempSatelitPenugasan] = useState('');
  const [tempJabatan,          setTempJabatan]          = useState('');
  const [tempPeriode,          setTempPeriode]          = useState('');
  const [tempKomisi,           setTempKomisi]           = useState('');
  const [tempDepartemen,       setTempDepartemen]       = useState('');

  // Tarik semua data dropdown dan profil pas pertama dibuka
  useEffect(() => {
    const fetchOptionsAndUser = async () => {
      showLoader();
      try {
        const [resSatelit, resJabatan, resPeriode, resDepartemen, resKomisi, resUser, resRoles] = await Promise.all([
          fetch('/api/options?type=satelit'),
          fetch('/api/options?type=jabatan'),
          fetch('/api/options?type=periode_kepengurusan'),
          fetch('/api/options?type=departemen'),
          fetch('/api/options?type=komisi'),
          fetch('/api/auth/me'),
          fetch('/api/settings/akun-akses/roles'),
        ]);
        const satelitData    = await resSatelit.json();
        const jabatanData    = await resJabatan.json();
        const periodeData    = await resPeriode.json();
        const departemenData = await resDepartemen.json();
        const komisiData     = await resKomisi.json();
        const authData       = resUser.ok ? await resUser.json() : null;
        const rolesData      = resRoles.ok ? await resRoles.json() : null;

        if (satelitData.success) setSatelitOptions(satelitData.data);
        if (jabatanData.success) setJabatanOptions(jabatanData.data);
        if (periodeData.success) setPeriodeOptions(periodeData.data);
        if (departemenData.success) setDepartemenOptions(departemenData.data);
        if (komisiData.success) setKomisiOptions(komisiData.data);
        if (rolesData?.success && Array.isArray(rolesData.data?.roles)) {
          setRoleOptions(rolesData.data.roles.filter((r: any) => r.is_active));
        }
    // Auto-lock satelit asal untuk admin satelit
        if (authData) {
          setUserData(authData);
          if (authData.role_name?.toUpperCase().includes('SATELIT')) {
            setFilterSatelitAsal(authData.satelit_id?.toString() || '');
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

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Atur balik ke halaman pertama pas filternya diputar
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterSatelitAsal, filterStatusGlobal, filterLingkup, filterSatelitPenugasan, filterJabatan, filterPeriode, filterKomisi, filterDepartemen]);

  // Tarik Datanya Yuk
  useEffect(() => {
    const fetchData = async () => {
      showLoader();
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch)          queryParams.append('search',                debouncedSearch);
        if (filterSatelitAsal)        queryParams.append('satelit_asal_id',       filterSatelitAsal);
        if (filterStatusGlobal && filterStatusGlobal !== 'Semua') queryParams.append('status_global', filterStatusGlobal);
        if (filterLingkup)            queryParams.append('lingkup',               filterLingkup);
        if (filterSatelitPenugasan)   queryParams.append('satelit_penugasan_id',  filterSatelitPenugasan);
        if (filterJabatan)            queryParams.append('jabatan_id',            filterJabatan);
        if (filterPeriode)            queryParams.append('periode_id',            filterPeriode);
        if (filterKomisi)             queryParams.append('komisi_id',             filterKomisi);
        if (filterDepartemen)         queryParams.append('departemen_id',         filterDepartemen);

        queryParams.append('limit',  limit.toString());
        queryParams.append('offset', ((currentPage - 1) * limit).toString());

        const res    = await fetch(`/api/pengurus?${queryParams.toString()}`);
        const result = await res.json();

        if (result.success) {
          setData(result.data);
          setTotalItems(result.meta.total);
          setPengurusBaru(result.meta.pengurus_baru || 0);
          setPengurusDemisioner(result.meta.pengurus_demisioner || 0);
        }
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        hideLoader();
      }
    };

    fetchData();
  }, [debouncedSearch, filterSatelitAsal, filterStatusGlobal, filterLingkup, filterSatelitPenugasan, filterJabatan, filterPeriode, filterKomisi, filterDepartemen, currentPage]);


  const handleToggleStatus = (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Aktif' ? 'Demisioner' : 'Aktif';
    setAlertState({ isOpen: true, id, newStatus });
  };

  // Handler Buatkan Akun
  const openAkunModal = (pengurus: any) => {
    setOpenMenuId(null);
    let defaultPassword = '';
    if (pengurus.tanggal_lahir) {
      const date = new Date(pengurus.tanggal_lahir);
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yyyy = date.getFullYear();
      defaultPassword = `${dd}/${mm}/${yyyy}`;
    }

    // Susun otomatis peran dari jabatan aktifnya + cocokin ke sistem
    const jabatanList: any[] = pengurus.jabatan_aktif_list ?? [];
    const autoRoles = jabatanList.map((jab: any) => {
      // Cari role sistem yang namanya mirip dengan jabatan
      const jabNama = jab.nama?.toUpperCase().replace(/\s+/g, '_');
      const matchedRole = roleOptions.find((r: any) =>
        r.nama_role.toUpperCase() === jabNama ||
        r.nama_role.toUpperCase().includes(jabNama) ||
        jabNama.includes(r.nama_role.toUpperCase())
      );
      return {
        role_id: matchedRole?.id ?? null,
        role_name: matchedRole?.nama_role ?? jab.nama,
        satelit_id: jab.satelit_id ?? pengurus.satelit_asal_id ?? null,
        satelit_name: satelitOptions.find((s: any) => s.id === (jab.satelit_id ?? pengurus.satelit_asal_id))?.nama_satelit ?? '',
        komisi_id: jab.komisi_id ?? null,
        departemen_id: jab.departemen_id ?? null,
        lingkup: jab.lingkup,
        label: jab.label,
      };
    }).filter((r: any) => r.role_id !== null);

    setAkunForm({ 
      email: pengurus.email_jemaat || '', 
      password: defaultPassword, 
      roles: autoRoles,
    });
    setAkunSubmitState('idle');
    setAkunError('');
    setAkunModal({
      open: true,
      pengurusId: pengurus.id,
      jemaatId: pengurus.jemaat_id,
      namaLengkap: pengurus.nama_lengkap,
      emailDefault: pengurus.email_jemaat || '',
      satelitDefault: pengurus.satelit_asal_id?.toString() || '',
      tanggalLahir: pengurus.tanggal_lahir || '',
      jabatanList,
    });
  };

  const handleBuatAkun = async () => {
    if (!akunForm.email || !akunForm.password) {
      setAkunError('Email dan Password diperlukan.');
      return;
    }
    if (akunForm.roles.length === 0) {
      setAkunError('Tidak ada role yang bisa di-assign. Pastikan jabatan aktif pengurus sudah terdaftar sebagai Role Sistem.');
      return;
    }
    setAkunError('');
    setAkunSubmitState('loading');
    try {
      const roles = akunForm.roles.map(r => ({
        role_id: r.role_id,
        satelit_id: r.satelit_id,
      }));
      const komisi_id = akunForm.roles.find(r => r.komisi_id)?.komisi_id ?? null;
      const departemen_id = akunForm.roles.find(r => r.departemen_id)?.departemen_id ?? null;
      const res = await fetch('/api/settings/akun-akses/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: akunForm.email,
          password: akunForm.password,
          jemaat_id: akunModal.jemaatId,
          roles,
          komisi_id,
          departemen_id,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setAkunSubmitState('success');
        setTimeout(() => {
          setAkunModal(m => ({ ...m, open: false }));
          window.location.reload();
        }, 1500);
      } else {
        setAkunError(result.message || 'Gagal membuat akun.');
        setAkunSubmitState('error');
      }
    } catch {
      setAkunError('Terjadi kesalahan koneksi.');
      setAkunSubmitState('error');
    }
  };

  // Handler Kelola Akun
  const openKelolaAkunModal = (pengurus: any) => {
    setOpenMenuId(null);
    setKelolaAkunForm({ password: '' });
    setKelolaAkunSubmitState('idle');
    setKelolaAkunError('');
    setKelolaAkunModal({
      open: true,
      pengurusId: pengurus.id,
      akunId: pengurus.akun_id,
      namaLengkap: pengurus.nama_lengkap,
      email: pengurus.email_jemaat || '',
      isActive: pengurus.akun_is_active,
    });
  };

  const handleUpdatePassword = async () => {
    if (!kelolaAkunForm.password || kelolaAkunForm.password.length < 8) {
      setKelolaAkunError('Password baru wajib diisi minimal 8 karakter.');
      return;
    }
    setKelolaAkunError('');
    setKelolaAkunSubmitState('loading');
    try {
      const res = await fetch('/api/settings/akun-akses/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: kelolaAkunModal.akunId,
          password: kelolaAkunForm.password,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setKelolaAkunSubmitState('success');
        setTimeout(() => {
          setKelolaAkunSubmitState('idle');
          setKelolaAkunForm({ password: '' });
        }, 3000);
      } else {
        setKelolaAkunError(result.message || 'Gagal mengubah password.');
        setKelolaAkunSubmitState('error');
      }
    } catch {
      setKelolaAkunError('Terjadi kesalahan koneksi.');
      setKelolaAkunSubmitState('error');
    }
  };

  const handleToggleAkunStatus = async () => {
    try {
      setKelolaAkunSubmitState('loading');
      const newStatus = !kelolaAkunModal.isActive;
      const res = await fetch('/api/settings/akun-akses/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: kelolaAkunModal.akunId,
          is_active: newStatus,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setKelolaAkunSubmitState('idle');
        setKelolaAkunModal(m => ({ ...m, isActive: newStatus }));
        setData(prev => prev.map(p => p.id === kelolaAkunModal.pengurusId ? { ...p, akun_is_active: newStatus } : p));
      } else {
        setKelolaAkunError(result.message || 'Gagal mengubah status akun.');
        setKelolaAkunSubmitState('error');
      }
    } catch {
      setKelolaAkunError('Terjadi kesalahan saat mengubah status.');
      setKelolaAkunSubmitState('error');
    }
  };

  const confirmToggleStatus = async () => {
    const { id, newStatus } = alertState;
    if (!id) return;
    setAlertState({ isOpen: false, id: null, newStatus: '' });

    try {
      setSubmitState({ status: 'loading', message: '' });
      const res = await fetch(`/api/pengurus/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status_jabatan: newStatus }),
      });
      const result = await res.json();
      if (result.success) {
        setData(prev => prev.map(p => p.id === id ? { ...p, status_jabatan: newStatus } : p));
        setSubmitState({ status: 'success', message: `Status berhasil diubah menjadi ${newStatus}` });
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal mengubah status' });
      }
    } catch (error) {
      console.error(error);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan koneksi saat mengubah status.' });
    }
  };

  const totalPages = Math.ceil(totalItems / limit) || 1;

  return (
    <div className="w-full flex flex-col gap-8 pb-10">

      {/* Header Section */}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Database Pengurus</h1>
          <div className="text-slate-500 text-base font-medium font-sans leading-6">Sistem Informasi Manajemen Data Pengurus</div>
        </div>
        {hasPermission('pengurus_manage') && (
          <Link href="/pengurus/new" className="px-5 py-2.5 bg-slate-700 rounded-lg flex justify-start items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none">
            <span className="material-icons-round text-white text-[20px]">add</span>
            <span className="text-white text-sm font-bold font-sans leading-5">Tambah Pengurus Baru</span>
          </Link>
        )}
      </div>

      {/* Statistic Cards */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Total Pelayan Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-slate-700/10 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-slate-700 text-3xl">admin_panel_settings</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-sans uppercase tracking-wide">Total Pengurus Aktif</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">{totalItems.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Pelayan Baru Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-slate-400/20 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-slate-700 text-3xl">person_add</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-sans uppercase tracking-wide leading-tight">
              Pengurus Baru Bulan Ini
            </span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">
                {pengurusBaru.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Pelayan Nonaktif Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-rose-500/10 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-rose-500 text-3xl">person_off</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-sans uppercase tracking-wide">Pengurus Demisioner</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">{pengurusDemisioner.toLocaleString()}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ─── LEVEL 1: Quick Filters ─────────────────────────── */}
      <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-3 shadow-sm">

        {/* Search Bar */}
        <div className="flex-1 min-w-[300px] relative flex items-center">
          <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
          <input
            type="text"
            placeholder="Cari nama jemaat atau ID pengurus..."
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Satelit Asal (homebase jemaat) */}
        <div className="relative min-w-[190px]">
          <select
            value={filterSatelitAsal}
            onChange={(e) => setFilterSatelitAsal(e.target.value)}
            disabled={userData?.role_name?.toUpperCase().includes('SATELIT')}
            className={`appearance-none w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm ${
              userData?.role_name?.toUpperCase().includes('SATELIT') ? 'bg-slate-200 cursor-not-allowed opacity-70' : 'bg-slate-50 cursor-pointer'
            }`}
          >
            <option value="">Semua Satelit Asal</option>
            {satelitOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.nama_satelit}</option>
            ))}
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        {/* Status Global — pill toggle */}
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-1">
          {(['Semua', 'Aktif', 'Non-Aktif'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatusGlobal(s === 'Semua' ? '' : s)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                (filterStatusGlobal === s) || (s === 'Semua' && !filterStatusGlobal)
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s === 'Aktif' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 align-middle"></span>}
              {s === 'Non-Aktif' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 mr-1 align-middle"></span>}
              {s}
            </button>
          ))}
        </div>

        {/* More Filters Toggle */}
        {(() => {
          const advCount = (filterLingkup ? 1 : 0) + (filterSatelitPenugasan ? 1 : 0) +
            (filterJabatan ? 1 : 0) + (filterPeriode ? 1 : 0) + (filterKomisi ? 1 : 0) + (filterDepartemen ? 1 : 0);
          const isActive = advCount > 0;
          return (
            <button
              onClick={() => {
                if (!showAdvancedFilters) {
                  setTempLingkup(filterLingkup);
                  setTempSatelitPenugasan(filterSatelitPenugasan);
                  setTempJabatan(filterJabatan);
                  setTempPeriode(filterPeriode);
                  setTempKomisi(filterKomisi);
                  setTempDepartemen(filterDepartemen);
                }
                setShowAdvancedFilters(!showAdvancedFilters);
              }}
              className={`px-4 py-2.5 border rounded-lg flex items-center gap-2 transition-colors group ${
                showAdvancedFilters ? 'bg-slate-100 border-slate-300' :
                isActive ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className={`material-icons-round text-[20px] ${showAdvancedFilters ? 'text-slate-800' : isActive ? 'text-violet-700' : 'text-slate-500 group-hover:text-slate-700'}`}>tune</span>
              <span className={`text-sm font-medium font-sans ${showAdvancedFilters ? 'text-slate-900' : isActive ? 'text-violet-700 font-bold' : 'text-slate-600 group-hover:text-slate-800'}`}>Filter Lanjutan</span>
              {isActive && (
                <span className="flex items-center justify-center w-5 h-5 ml-1 bg-violet-600 text-white text-[10px] font-bold rounded-full">{advCount}</span>
              )}
            </button>
          );
        })()}
      </div>

      {/* ─── LEVEL 2: Advanced Filters Collapse Panel ────────── */}
      {showAdvancedFilters && (
        <div className="w-full p-6 bg-white rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col gap-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-icons-round text-violet-600 text-[18px]">manage_search</span>
            <h3 className="text-slate-800 text-sm font-bold font-sans">Filter Lanjutan Jabatan</h3>
            <span className="text-slate-400 text-xs font-sans">— Semua filter ini menggunakan logika EXISTS (1 orang tetap 1 baris)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">

            {/* 1. Lingkup Pelayanan */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">Lingkup</label>
              <div className="relative">
                <select
                  value={tempLingkup}
                  onChange={(e) => setTempLingkup(e.target.value)}
                  className="appearance-none w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-sans text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="">Semua Lingkup</option>
                  <option value="Pusat">Pusat</option>
                  <option value="Satelit">Satelit</option>
                  <option value="Komisi">Komisi</option>
                  <option value="Departemen">Departemen</option>
                </select>
                <span className="material-icons-round absolute right-2 top-2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
              </div>
            </div>

            {/* 2. Satelit Penugasan */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">Satelit Penugasan</label>
              <div className="relative">
                <select
                  value={tempSatelitPenugasan}
                  onChange={(e) => setTempSatelitPenugasan(e.target.value)}
                  className="appearance-none w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-sans text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="">Semua</option>
                  {satelitOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.nama_satelit}</option>
                  ))}
                </select>
                <span className="material-icons-round absolute right-2 top-2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
              </div>
            </div>

            {/* 3. Jabatan */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">Jabatan</label>
              <div className="relative">
                <select
                  value={tempJabatan}
                  onChange={(e) => setTempJabatan(e.target.value)}
                  className="appearance-none w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-sans text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="">Semua Jabatan</option>
                  {jabatanOptions.map((j) => (
                    <option key={j.id} value={j.id}>{j.nama_jabatan}</option>
                  ))}
                </select>
                <span className="material-icons-round absolute right-2 top-2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
              </div>
            </div>

            {/* 4. Periode */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">Periode</label>
              <div className="relative">
                <select
                  value={tempPeriode}
                  onChange={(e) => setTempPeriode(e.target.value)}
                  className="appearance-none w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-sans text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="">Semua Periode</option>
                  {periodeOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.nama_periode}</option>
                  ))}
                </select>
                <span className="material-icons-round absolute right-2 top-2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
              </div>
            </div>

            {/* 5. Komisi */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">Komisi</label>
              <div className="relative">
                <select
                  value={tempKomisi}
                  onChange={(e) => { setTempKomisi(e.target.value); if (e.target.value) setTempDepartemen(''); }}
                  disabled={!!tempDepartemen}
                  className={`appearance-none w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-slate-700 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 ${tempDepartemen ? 'bg-slate-100 cursor-not-allowed opacity-50' : 'bg-slate-50 cursor-pointer'}`}
                >
                  <option value="">Semua</option>
                  {komisiOptions.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama_komisi}</option>
                  ))}
                </select>
                <span className="material-icons-round absolute right-2 top-2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
              </div>
            </div>

            {/* 6. Departemen */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">Departemen</label>
              <div className="relative">
                <select
                  value={tempDepartemen}
                  onChange={(e) => { setTempDepartemen(e.target.value); if (e.target.value) setTempKomisi(''); }}
                  disabled={!!tempKomisi}
                  className={`appearance-none w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-slate-700 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 ${tempKomisi ? 'bg-slate-100 cursor-not-allowed opacity-50' : 'bg-slate-50 cursor-pointer'}`}
                >
                  <option value="">Semua</option>
                  {departemenOptions.map((d) => (
                    <option key={d.id} value={d.id}>{d.nama_departemen}</option>
                  ))}
                </select>
                <span className="material-icons-round absolute right-2 top-2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => {
                setTempLingkup(''); setTempSatelitPenugasan(''); setTempJabatan('');
                setTempPeriode(''); setTempKomisi(''); setTempDepartemen('');
                setFilterLingkup(''); setFilterSatelitPenugasan(''); setFilterJabatan('');
                setFilterPeriode(''); setFilterKomisi(''); setFilterDepartemen('');
                setCurrentPage(1);
                setShowAdvancedFilters(false);
              }}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Reset Filter Lanjutan
            </button>
            <button
              onClick={() => {
                setFilterLingkup(tempLingkup);
                setFilterSatelitPenugasan(tempSatelitPenugasan);
                setFilterJabatan(tempJabatan);
                setFilterPeriode(tempPeriode);
                setFilterKomisi(tempKomisi);
                setFilterDepartemen(tempDepartemen);
                setCurrentPage(1);
                setShowAdvancedFilters(false);
              }}
              className="px-5 py-2 text-sm font-bold text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      )}


      {/* Data Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative z-0">
        <div className="w-full overflow-x-auto pb-4">
          <div className="min-w-[900px] flex flex-col">
            {/* Table Header */}
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
              <div className="w-32 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">ID Pengurus</div>
              <div className="w-64 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Profil Pengurus</div>
              <div className="flex-1 min-w-[200px] text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Jabatan Aktif</div>
              <div className="w-24 shrink-0 text-center text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Akun</div>
              <div className="w-32 shrink-0 text-center text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Status Global</div>
              <div className="w-20 shrink-0 text-right text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Aksi</div>
            </div>

            {/* Table Body */}
            <div className="min-h-64">
              {data.length === 0 ? (
                <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
                  <span className="material-icons-round text-5xl mb-2 text-slate-300">search_off</span>
                  <span className="text-sm font-sans">Tidak ada data pengurus yang ditemukan.</span>
                </div>
              ) : (
                data.map((pengurus, idx) => {
                  const isLastRows = data.length > 2 && idx >= data.length - 2;

                  return (
                    <div key={pengurus.id || idx} className={`w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors relative ${openMenuId === pengurus.id ? 'z-50' : 'z-10'}`}>

                      {/* ID */}
                      <div className="w-32 shrink-0">
                        <span className="text-slate-500 text-sm font-sans">{pengurus.id_pengurus}</span>
                      </div>

                      {/* Profil: Nama + Satelit Asal */}
                      <div className="w-64 shrink-0 flex items-center gap-3">
                        <img
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 flex-shrink-0"
                          src={pengurus.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(pengurus.nama_lengkap)}&background=random`}
                          alt="avatar"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-slate-900 text-sm font-bold font-sans truncate">{pengurus.nama_lengkap}</span>
                          <span className="text-slate-400 text-xs font-sans truncate">
                            📍 {pengurus.nama_satelit_asal || 'Belum ada satelit asal'}
                          </span>
                        </div>
                      </div>

                      {/* Jabatan Aktif — semua chip horizontal dari JSON array */}
                      <div className="flex-1 flex items-center gap-1.5 flex-wrap pr-4">
                        {(() => {
                          const list: { nama: string; label: string }[] = pengurus.jabatan_aktif_list ?? [];
                          if (list.length === 0) return <span className="text-slate-400 text-sm italic">Tidak ada jabatan aktif</span>;
                          return list.map((j, i) => (
                            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold font-sans rounded-full whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                              {j.label}
                            </span>
                          ));
                        })()}
                      </div>

                      {/* Akun Badge — sesudah jabatan */}
                      <div className="w-24 shrink-0 flex justify-center">
                        {pengurus.has_akun ? (
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold font-sans uppercase ${
                            pengurus.akun_is_active ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${pengurus.akun_is_active ? 'bg-violet-500' : 'bg-slate-400'}`}></span>
                            {pengurus.akun_is_active ? 'Aktif' : 'Non-Aktif'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold font-sans uppercase bg-amber-100 text-amber-700">
                            <span className="material-icons-round text-[11px]">lock</span>
                            Belum
                          </span>
                        )}
                      </div>

                      {/* Status Akun Badge */}
                      <div className="w-32 shrink-0 flex justify-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold font-sans uppercase ${
                          pengurus.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {pengurus.is_active ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </div>

                      {/* Aksi */}
                      <div className="w-20 shrink-0 flex justify-end gap-2 text-slate-400 relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === pengurus.id ? null : pengurus.id)}
                          className="hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded transition-colors"
                        >
                          <span className="material-icons-round text-[24px]">more_horiz</span>
                        </button>
  
                        {openMenuId === pengurus.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                            <div className={`absolute right-0 ${isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'} w-56 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-slate-200 z-50 py-1 overflow-visible`}>
                              <Link
                                href={`/pengurus/${pengurus.id}?mode=view`}
                                className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans"
                              >
                                <span className="material-icons-round text-[18px] text-slate-400">visibility</span> Lihat Detail
                              </Link>
                              {hasPermission('pengurus_manage') && (
                                <Link
                                  href={`/pengurus/${pengurus.id}?mode=edit`}
                                  className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans"
                                >
                                  <span className="material-icons-round text-[18px] text-slate-400">edit</span> Edit / Kelola Jabatan
                                </Link>
                              )}
                              {/* Buatkan Akun — hanya untuk SUPER_ADMIN dan jika belum punya akun */}
                              {userData?.is_super_admin && !pengurus.has_akun && (
                                <>
                                  <div className="mx-3 my-1 border-t border-slate-100" />
                                  <button
                                    onClick={() => openAkunModal(pengurus)}
                                    className="w-full text-left px-4 py-2 hover:bg-violet-50 transition-colors flex items-center gap-3 text-sm text-violet-700 font-sans font-semibold"
                                  >
                                    <span className="material-icons-round text-[18px] text-violet-500">manage_accounts</span>
                                    Buatkan Akun Sistem
                                  </button>
                                </>
                              )}
                              {userData?.is_super_admin && pengurus.has_akun && (
                                <>
                                  <div className="mx-3 my-1 border-t border-slate-100" />
                                  <button
                                    onClick={() => openKelolaAkunModal(pengurus)}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans font-medium"
                                  >
                                    <span className="material-icons-round text-[18px] text-slate-500">manage_accounts</span> Kelola Akun Sistem
                                  </button>
                                </>
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


        {/* Pagination Footer */}
        <div className="w-full px-6 py-4 bg-white border-t border-slate-200 flex flex-col md:flex-row justify-between items-center text-sm gap-4">
          <span className="text-slate-500 font-sans">
            Menampilkan {data.length > 0 ? ((currentPage - 1) * limit) + 1 : 0}-
            {Math.min(currentPage * limit, totalItems)} dari {totalItems} pengurus
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
      </div>

      <AlertModal
        isOpen={alertState.isOpen}
        title="Konfirmasi Perubahan Status"
        message={`Apakah Anda yakin ingin mengubah status pengurus menjadi ${alertState.newStatus}?`}
        onConfirm={confirmToggleStatus}
        onCancel={() => setAlertState({ isOpen: false, id: null, newStatus: '' })}
      />

      {/* ─── Modal Buatkan Akun Sistem ─── */}
      {akunModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-violet-600 to-violet-700">
              <div className="flex items-center gap-3">
                <span className="material-icons-round text-white text-[22px]">manage_accounts</span>
                <div>
                  <h3 className="text-white font-black text-base font-sans">Buatkan Akun Sistem</h3>
                  <p className="text-violet-200 text-xs font-sans mt-0.5">{akunModal.namaLengkap}</p>
                </div>
              </div>
              <button onClick={() => setAkunModal(m => ({ ...m, open: false }))}
                className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                <span className="material-icons-round text-white text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 flex flex-col gap-4">
              {/* Peringatan Data Kurang */}
              {(!akunModal.emailDefault || !akunModal.tanggalLahir) && (
                <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex flex-col gap-1.5 mb-2">
                  <div className="flex items-center gap-2 font-bold">
                    <span className="material-icons-round text-[18px]">warning</span> Data Jemaat Belum Lengkap!
                  </div>
                  <p>Tidak dapat membuat akun. Silakan lengkapi data profil jemaat terlebih dahulu:</p>
                  <ul className="list-disc pl-5 mt-1 font-medium">
                    {!akunModal.emailDefault && <li>Alamat Email</li>}
                    {!akunModal.tanggalLahir && <li>Tanggal Lahir (untuk password default)</li>}
                  </ul>
                  <div className="mt-2">
                    <Link href={`/jemaat/${akunModal.jemaatId}?mode=edit`} className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-bold underline">
                      Lengkapi Data Sekarang <span className="material-icons-round text-[16px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">Email Login</label>
                <input
                  type="email"
                  value={akunForm.email}
                  disabled
                  className="px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium text-sm font-sans w-full cursor-not-allowed"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">Password Default</label>
                <input
                  type="text"
                  value={akunForm.password}
                  disabled
                  placeholder="Di-generate dari Tanggal Lahir (DD/MM/YYYY)"
                  className="px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium text-sm font-sans w-full cursor-not-allowed tracking-wide"
                />
              </div>

              {/* Role & Satelit — auto-generated dari jabatan aktif */}
              <div className="flex flex-col gap-2">
                <label className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">Role & Akses Sistem (Dari Jabatan Aktif)</label>
                {akunForm.roles.length === 0 ? (
                  <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <span className="material-icons-round text-[16px]">warning</span>
                      Tidak ada role yang cocok!
                    </div>
                    <p className="text-xs">Jabatan aktif pengurus ini belum dipetakan ke Role Sistem manapun. Silakan buat role di <Link href="/settings/akun-akses" className="underline font-bold">Pengaturan &gt; Akun &amp; Akses</Link>.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {akunForm.roles.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2.5 bg-violet-50 border border-violet-200 rounded-lg">
                        <span className="material-icons-round text-violet-500 text-[16px]">verified_user</span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-violet-800 text-xs font-bold">{r.role_name.replace(/_/g, ' ')}</span>
                          <span className="text-slate-500 text-[11px]">{r.label}</span>
                        </div>
                        <span className="ml-auto text-[10px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 font-sans shrink-0">{r.satelit_name}</span>
                      </div>
                    ))}
                    <p className="text-xs text-slate-400 mt-1">💡 Role di atas otomatis di-assign berdasarkan jabatan aktif. Untuk konfigurasi lebih lanjut gunakan <Link href="/settings/akun-akses" className="text-violet-600 underline">Pengaturan Akun</Link>.</p>
                  </div>
                )}
              </div>

              {/* Error */}
              {akunError && (
                <div className="px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
                  <span className="material-icons-round text-[16px]">error_outline</span>
                  {akunError}
                </div>
              )}

              {akunSubmitState === 'success' && (
                <div className="px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm flex items-center gap-2">
                  <span className="material-icons-round text-[16px]">check_circle</span>
                  Akun berhasil dibuat!
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setAkunModal(m => ({ ...m, open: false }))}
                disabled={akunSubmitState === 'loading'}
                className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleBuatAkun}
                disabled={akunSubmitState === 'loading' || akunSubmitState === 'success' || !akunModal.emailDefault || !akunModal.tanggalLahir || akunForm.roles.length === 0}
                className="px-6 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
              >
                {akunSubmitState === 'loading' && <span className="material-icons-round animate-spin text-[16px]">sync</span>}
                {akunSubmitState === 'loading' ? 'Membuat...' : 'Buat Akun'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Kelola Akun Sistem ─── */}
      {kelolaAkunModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="material-icons-round text-slate-700 text-[22px]">manage_accounts</span>
                <div>
                  <h3 className="text-slate-800 font-black text-base font-sans">Kelola Akun Login</h3>
                  <p className="text-slate-500 text-xs font-sans mt-0.5">{kelolaAkunModal.namaLengkap}</p>
                </div>
              </div>
              <button onClick={() => setKelolaAkunModal(m => ({ ...m, open: false }))}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <span className="material-icons-round text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 flex flex-col gap-6">
              {/* Info & Toggle Status */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Email Login</span>
                    <span className="text-sm font-semibold text-slate-700">{kelolaAkunModal.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${kelolaAkunModal.isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {kelolaAkunModal.isActive ? 'Aktif' : 'Non-Aktif'}
                    </span>
                    <button
                      onClick={handleToggleAkunStatus}
                      disabled={kelolaAkunSubmitState === 'loading'}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-50 ${
                        kelolaAkunModal.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${kelolaAkunModal.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="w-full border-t border-slate-100"></div>

              {/* Reset Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">Reset Password Baru</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={kelolaAkunForm.password}
                    onChange={e => setKelolaAkunForm({ password: e.target.value })}
                    placeholder="Masukkan password baru (min. 8 karakter)"
                    className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 text-slate-900 text-sm font-sans"
                  />
                  <button
                    onClick={handleUpdatePassword}
                    disabled={kelolaAkunSubmitState === 'loading' || !kelolaAkunForm.password}
                    className="px-4 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Simpan
                  </button>
                </div>
                {kelolaAkunSubmitState === 'success' && (
                  <span className="text-emerald-600 text-xs font-semibold mt-1 flex items-center gap-1">
                    <span className="material-icons-round text-[14px]">check_circle</span> Password berhasil diubah.
                  </span>
                )}
              </div>

              {/* Error */}
              {kelolaAkunError && (
                <div className="px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
                  <span className="material-icons-round text-[16px]">error_outline</span>
                  {kelolaAkunError}
                </div>
              )}

              {/* Link ke Pengaturan Lengkap */}
              <div className="pt-2 flex justify-center">
                <Link
                  href="/settings/akun-akses"
                  className="text-violet-600 hover:text-violet-700 text-sm font-semibold flex items-center gap-1"
                >
                  Buka Pengaturan Role & Akses Lengkap <span className="material-icons-round text-[16px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <SubmitOverlay
        status={submitState.status}
        message={submitState.message}
        errors={submitState.errors}
        onClose={() => setSubmitState({ status: 'idle', message: '' })}
      />
    </div>
  );
}
