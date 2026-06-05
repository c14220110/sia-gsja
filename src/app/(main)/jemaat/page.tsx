'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';

const toTitleCase = (str: string) => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function MembersPage() {
  const { showLoader, hideLoader } = useLoader();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const router = useRouter();

  // Alert Modal State
  const [alertState, setAlertState] = useState<{ isOpen: boolean; id: number | null; newStatus: string }>({
    isOpen: false,
    id: null,
    newStatus: ''
  });

  // Authentication State
  const [userData, setUserData] = useState<any>(null);

  // Options State
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [komisiOptions, setKomisiOptions] = useState<any[]>([]);
  
  // Pagination & Stats State
  const [data, setData] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [newThisMonth, setNewThisMonth] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;
  
  // Basic Filters
  const [filterSatelit, setFilterSatelit] = useState('');
  const [filterKomisi, setFilterKomisi] = useState('');
  
  // Advanced Filters
  const [filterStatusJemaat, setFilterStatusJemaat] = useState('Aktif');
  const [filterGender, setFilterGender] = useState('');
  const [filterUmur, setFilterUmur] = useState('');
  const [filterFoto, setFilterFoto] = useState('');

  // Fetch Options and User Data on Mount
  useEffect(() => {
    const fetchOptionsAndUser = async () => {
      showLoader();
      try {
        const [resSatelit, resKomisi, resUser] = await Promise.all([
          fetch('/api/options?type=satelit'),
          fetch('/api/options?type=komisi'),
          fetch('/api/auth/me')
        ]);
        const satelitData = await resSatelit.json();
        const komisiData = await resKomisi.json();
        const authData = resUser.ok ? await resUser.json() : null;

        if (satelitData.success) setSatelitOptions(satelitData.data);
        if (komisiData.success) setKomisiOptions(komisiData.data);
        if (authData) {
          setUserData(authData);
          if (authData.role_name?.toUpperCase().includes('SATELIT')) {
            setFilterSatelit(authData.satelit_id?.toString() || '');
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

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterSatelit, filterKomisi, filterStatusJemaat, filterGender, filterUmur, filterFoto]);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      showLoader();
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch) queryParams.append('search', debouncedSearch);
        if (filterSatelit) queryParams.append('satelit_id', filterSatelit);
        if (filterKomisi) queryParams.append('komisi_id', filterKomisi);
        if (filterStatusJemaat && filterStatusJemaat !== 'Semua') queryParams.append('status_jemaat', filterStatusJemaat);
        if (filterGender) queryParams.append('jenis_kelamin', filterGender);
        if (filterUmur) queryParams.append('rentang_umur', filterUmur);
        if (filterFoto) queryParams.append('has_foto', filterFoto);
        
        queryParams.append('limit', limit.toString());
        queryParams.append('offset', ((currentPage - 1) * limit).toString());

        const res = await fetch(`/api/members?${queryParams.toString()}`);
        const result = await res.json();
        
        if (result.success) {
          setData(result.data);
          setTotalItems(result.meta.total);
          setNewThisMonth(result.meta.jemaat_baru || 0);
        }
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        hideLoader();
      }
    };

    fetchData();
  }, [debouncedSearch, filterSatelit, filterKomisi, filterStatusJemaat, filterGender, filterUmur, filterFoto, currentPage]);

  const handleToggleStatus = (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Aktif' ? 'Tidak Aktif' : 'Aktif';
    setAlertState({ isOpen: true, id, newStatus });
  };

  const confirmToggleStatus = async () => {
    const { id, newStatus } = alertState;
    if (!id) return;
    setAlertState({ isOpen: false, id: null, newStatus: '' });
    
    try {
      setSubmitState({ status: 'loading', message: '' });
      const res = await fetch(`/api/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_jemaat: newStatus })
      });
      const result = await res.json();
      if (result.success) {
        setData(prev => prev.map(j => j.id === id ? { ...j, status_jemaat: newStatus } : j));
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
            <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Database Jemaat</h1>
            <div className="text-slate-500 text-base font-medium font-sans leading-6">Sistem Informasi Manajemen Data Jemaat</div>
          </div>
          {hasPermission('jemaat_create') && (
            <Link href="/jemaat/new" className="px-5 py-2.5 bg-slate-700 rounded-lg flex justify-start items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none">
              <span className="material-icons-round text-white text-[20px]">add</span>
              <span className="text-white text-sm font-bold font-sans leading-5">Tambah Jemaat Baru</span>
            </Link>
          )}
        </div>

      {/* Statistic Cards */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Total Jemaat Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-slate-700/10 rounded-xl flex justify-center items-center">
             <span className="material-icons-round text-slate-700 text-3xl">groups</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-sans uppercase tracking-wide">Total Jemaat</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">{totalItems.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Jemaat Baru Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-slate-400/20 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-slate-700 text-3xl">person_add</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-sans uppercase tracking-wide leading-tight">
              Jemaat Baru Bulan Ini
            </span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">
                {newThisMonth.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Kehadiran Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-emerald-600 text-3xl">how_to_reg</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-sans uppercase tracking-wide">Keaktifan Kehadiran</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">-</span>
            </div>
          </div>
        </div>

      </div>

      {/* Filter Options */}
      <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-sm">
        
        {/* Search Bar */}
        <div className="flex-1 min-w-[300px] relative flex items-center">
          <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
          <input 
            type="text" 
            placeholder="Cari jemaat berdasarkan nama atau ID..."
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Satelit Dropdown */}
        <div className="relative min-w-[200px]">
          <select 
            value={filterSatelit}
            onChange={(e) => setFilterSatelit(e.target.value)}
            disabled={userData?.role_name?.toUpperCase().includes('SATELIT')}
            className={`appearance-none w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm ${
              userData?.role_name?.toUpperCase().includes('SATELIT') ? 'bg-slate-200 cursor-not-allowed opacity-70' : 'bg-slate-50 cursor-pointer'
            }`}
          >
            {!userData?.role_name?.toUpperCase().includes('SATELIT') && <option value="">Semua Satelit</option>}
            {satelitOptions.map((satelit) => (
              <option key={satelit.id} value={satelit.id}>{satelit.nama_satelit}</option>
            ))}
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        {/* Komisi Dropdown */}
        <div className="relative min-w-[200px]">
          <select 
            value={filterKomisi}
            onChange={(e) => setFilterKomisi(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
          >
            <option value="">Semua Komisi</option>
            <option value="none">Tanpa komisi</option>
            {/* Filter komisi list dynamically based on selected satelit if needed, or simply map all of them */}
            {komisiOptions
              .filter(k => filterSatelit ? k.satelit_id.toString() === filterSatelit : true)
              .map((komisi) => (
                <option key={komisi.id} value={komisi.id}>{komisi.nama_komisi}</option>
              ))
            }
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
        <div className="w-full p-6 bg-white rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* 1. Status Jemaat */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-sans">Status Jemaat</label>
            <div className="relative">
              <select 
                value={filterStatusJemaat}
                onChange={(e) => setFilterStatusJemaat(e.target.value)}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
              >
                <option value="Semua">Semua</option>
                <option value="Aktif">Aktif</option>
                <option value="Tidak Aktif">Tidak Aktif</option>
                <option value="Keluar">Keluar</option>
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          {/* 2. Jenis Kelamin */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-sans">Jenis Kelamin</label>
            <div className="relative">
              <select 
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
              >
                <option value="">Semua</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          {/* 3. Rentang Umur */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-sans">Rentang Umur</label>
            <div className="relative">
              <select 
                value={filterUmur}
                onChange={(e) => setFilterUmur(e.target.value)}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
              >
                <option value="">Semua</option>
                <option value="anak">Anak (&lt;12)</option>
                <option value="remaja">Remaja (12-17)</option>
                <option value="pemuda">Pemuda (18-35)</option>
                <option value="dewasa">Dewasa (36-55)</option>
                <option value="lansia">Lansia (&gt;55)</option>
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          {/* 4. Status Foto */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-sans">Status Foto</label>
            <div className="relative">
              <select 
                value={filterFoto}
                onChange={(e) => setFilterFoto(e.target.value)}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
              >
                <option value="">Semua</option>
                <option value="true">Sudah Ada Foto</option>
                <option value="false">Belum Ada Foto</option>
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

        </div>
      )}

      {/* Data Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative z-0">
        <div className="w-full overflow-x-auto pb-4">
          <div className="min-w-[1050px] flex flex-col">
            {/* Table Header */}
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
              <div className="w-32 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">ID Jemaat</div>
              <div className="w-80 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Nama Lengkap</div>
              <div className="flex-1 min-w-[200px] text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Satelit/Cabang</div>
              <div className="w-48 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Komisi</div>
              <div className="w-32 shrink-0 text-center text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Status</div>
              <div className="w-20 shrink-0 text-right text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Aksi</div>
            </div>

        {/* Table Body */}
        <div className="min-h-64">
          {data.length === 0 ? (
            <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
              <span className="material-icons-round text-5xl mb-2 text-slate-300">search_off</span>
              <span className="text-sm font-sans">Tidak ada data jemaat yang ditemukan.</span>
            </div>
          ) : (
            data.map((jemaat, idx) => {
              const isLastRows = data.length > 2 && idx >= data.length - 2;
              return (
            <div 
              key={jemaat.id || idx} 
              onClick={() => router.push(`/jemaat/${jemaat.id}?mode=view`)}
              className={`w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors relative cursor-pointer ${openMenuId === jemaat.id ? 'z-50' : 'z-10'}`}
            >
              <div className="w-32 shrink-0 text-slate-500 text-sm font-sans">{jemaat.jemaat_id}</div>
              <div className="w-80 shrink-0 flex items-center gap-3">
                <div 
                  className="relative group cursor-pointer shrink-0"
                  title="Lihat foto"
                  onClick={(e) => {
                    e.stopPropagation(); // Mencegah pindah halaman saat klik foto
                    setPreviewPhotoUrl(jemaat.foto_url || `https://ui-avatars.com/api/?name=${jemaat.nama_lengkap}&background=random`);
                  }}
                >
                  <img className="w-11 h-11 rounded-full object-cover border border-slate-200" src={jemaat.foto_url || `https://ui-avatars.com/api/?name=${jemaat.nama_lengkap}&background=random`} alt="avatar" />
                  <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex justify-center items-center">
                    <span className="material-icons-round text-white text-[20px]">zoom_in</span>
                  </div>
                </div>
                <span className="text-slate-900 text-sm font-semibold font-sans w-full truncate pr-2">{toTitleCase(jemaat.nama_lengkap)}</span>
              </div>
              <div className="flex-1 min-w-[200px] text-slate-600 text-sm font-sans truncate pr-2">{jemaat.nama_satelit || '-'}</div>
              <div className="w-48 shrink-0 flex flex-wrap gap-1 items-center py-1">
                {jemaat.komisi ? 
                  jemaat.komisi.split(', ').map((k: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 text-[10px] font-bold font-sans uppercase whitespace-nowrap">
                      {k}
                    </span>
                  ))
                : (
                  <span className="text-slate-400 font-bold ml-1">-</span>
                )}
              </div>
              <div className="w-32 shrink-0 flex justify-center">
                <span className={`px-3 py-1 rounded-full text-xs font-bold font-sans uppercase ${jemaat.status_jemaat === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : jemaat.status_jemaat === 'Keluar' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                  {jemaat.status_jemaat}
                </span>
              </div>
              <div className="w-20 shrink-0 flex justify-end gap-2 text-slate-400 relative">
                 <button 
                  onClick={(e) => {
                    e.stopPropagation(); // Mencegah pindah halaman saat klik menu titik tiga
                    setOpenMenuId(openMenuId === jemaat.id ? null : jemaat.id);
                  }}
                  className="hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded transition-colors"
                 >
                   <span className="material-icons-round text-[24px]">more_horiz</span>
                 </button>

                 {openMenuId === jemaat.id && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                     <div className={`absolute right-0 ${isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'} w-48 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-slate-200 z-50 py-1 overflow-visible`}>
                       <Link 
                         href={`/jemaat/${jemaat.id}?mode=view`}
                         className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans"
                       >
                         <span className="material-icons-round text-[18px] text-slate-400">visibility</span> Lihat Detail
                       </Link>
                       {hasPermission('jemaat_edit') && (
                         <>
                           <Link 
                             href={`/jemaat/${jemaat.id}?mode=edit`}
                             className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans"
                           >
                             <span className="material-icons-round text-[18px] text-slate-400">edit</span> Edit Data
                           </Link>
                           <div className="w-full h-px bg-slate-100 my-1"></div>
                           {jemaat.status_jemaat === 'Aktif' ? (
                             <button onClick={() => { setOpenMenuId(null); handleToggleStatus(jemaat.id, jemaat.status_jemaat); }} className="w-full text-left px-4 py-2 hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-3 text-sm text-amber-600 font-sans">
                               <span className="material-icons-round text-[18px] text-amber-400">person_off</span> Nonaktifkan
                             </button>
                           ) : (
                             <button onClick={() => { setOpenMenuId(null); handleToggleStatus(jemaat.id, jemaat.status_jemaat); }} className="w-full text-left px-4 py-2 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center gap-3 text-sm text-emerald-600 font-sans">
                               <span className="material-icons-round text-[18px] text-emerald-400">person_add</span> Aktifkan
                             </button>
                           )}
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
            {Math.min(currentPage * limit, totalItems)} dari {totalItems} jemaat
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
        message={`Apakah Anda yakin ingin mengubah status jemaat menjadi ${alertState.newStatus}?`}
        onConfirm={confirmToggleStatus}
        onCancel={() => setAlertState({ isOpen: false, id: null, newStatus: '' })}
      />

      <SubmitOverlay 
        status={submitState.status} 
        message={submitState.message} 
        errors={submitState.errors} 
        onClose={() => setSubmitState({ status: 'idle', message: '' })} 
      />

      {/* Photo Preview Modal */}
      {previewPhotoUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div className="relative max-w-2xl w-full p-4 flex flex-col items-center">
            <button 
              className="absolute top-0 right-0 m-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex justify-center items-center text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setPreviewPhotoUrl(null); }}
            >
              <span className="material-icons-round">close</span>
            </button>
            <img 
              src={previewPhotoUrl} 
              alt="Preview Jemaat" 
              className="max-h-[85vh] w-auto object-contain rounded-xl shadow-2xl border border-white/20 bg-white" 
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image itself
            />
          </div>
        </div>
      )}
    </div>
  );
}
