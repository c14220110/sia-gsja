'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import Link from 'next/link';

export default function MembersPage() {
  const { showLoader, hideLoader } = useLoader();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

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
  const [filterStatusJemaat, setFilterStatusJemaat] = useState('');
  const [filterStatusBaptis, setFilterStatusBaptis] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterUmur, setFilterUmur] = useState('');

  // Fetch Options and User Data on Mount
  useEffect(() => {
    const fetchOptionsAndUser = async () => {
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
          if (authData.role_name === 'GEMBALA SATELIT') {
            setFilterSatelit(authData.satelit_id?.toString() || '');
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial data', error);
      }
    };
    fetchOptionsAndUser();
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterSatelit, filterKomisi, filterStatusJemaat, filterStatusBaptis, filterGender, filterUmur]);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      showLoader();
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch) queryParams.append('search', debouncedSearch);
        if (filterSatelit) queryParams.append('satelit_id', filterSatelit);
        if (filterKomisi) queryParams.append('komisi_id', filterKomisi);
        if (filterStatusJemaat) queryParams.append('status_jemaat', filterStatusJemaat);
        if (filterStatusBaptis) queryParams.append('status_baptis', filterStatusBaptis);
        if (filterGender) queryParams.append('jenis_kelamin', filterGender);
        if (filterUmur) queryParams.append('rentang_umur', filterUmur);
        
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
  }, [debouncedSearch, filterSatelit, filterKomisi, filterStatusJemaat, filterStatusBaptis, filterGender, filterUmur, currentPage]);

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Aktif' ? 'Tidak Aktif' : 'Aktif';
    if (!confirm(`Apakah Anda yakin ingin mengubah status jemaat menjadi ${newStatus}?`)) return;
    
    try {
      showLoader();
      const res = await fetch(`/api/members/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_jemaat: newStatus })
      });
      const result = await res.json();
      if (result.success) {
        setData(prev => prev.map(j => j.id === id ? { ...j, status_jemaat: newStatus } : j));
      } else {
        alert('Gagal mengubah status: ' + result.message);
      }
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan koneksi saat mengubah status.');
    } finally {
      hideLoader();
    }
  };

  const totalPages = Math.ceil(totalItems / limit) || 1;

  return (
    <div className="w-full flex flex-col gap-8 pb-10">
      
      {/* Header Section */}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
            <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">Database Jemaat</h1>
            <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6">Sistem Informasi Manajemen Data Jemaat</div>
          </div>
          <Link href="/dashboard/members/new" className="px-5 py-2.5 bg-slate-700 rounded-lg flex justify-start items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none">
            <span className="material-icons-round text-white text-[20px]">add</span>
            <span className="text-white text-sm font-bold font-['Inter'] leading-5">Tambah Jemaat Baru</span>
          </Link>
        </div>

      {/* Statistic Cards */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Total Jemaat Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-slate-700/10 rounded-xl flex justify-center items-center">
             <span className="material-icons-round text-slate-700 text-3xl">groups</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-['Public_Sans'] uppercase tracking-wide">Total Jemaat</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-['Public_Sans'] leading-9">{totalItems.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Jemaat Baru Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-slate-400/20 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-slate-700 text-3xl">person_add</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-['Public_Sans'] uppercase tracking-wide leading-tight">
              Jemaat Baru Bulan Ini
            </span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-['Public_Sans'] leading-9">
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
            <span className="text-slate-500 text-sm font-medium font-['Public_Sans'] uppercase tracking-wide">Keaktifan Kehadiran</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-['Public_Sans'] leading-9">-</span>
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
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Satelit Dropdown */}
        <div className="relative min-w-[200px]">
          <select 
            value={filterSatelit}
            onChange={(e) => setFilterSatelit(e.target.value)}
            disabled={userData?.role_name === 'GEMBALA SATELIT'}
            className={`appearance-none w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm ${
              userData?.role_name === 'GEMBALA SATELIT' ? 'bg-slate-200 cursor-not-allowed opacity-70' : 'bg-slate-50 cursor-pointer'
            }`}
          >
            {userData?.role_name !== 'GEMBALA SATELIT' && <option value="">Semua Satelit</option>}
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
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer"
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
          <span className={`text-sm font-medium font-['Public_Sans'] transition-colors ${showAdvancedFilters ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-800'}`}>More Filters</span>
        </button>
      </div>

      {/* Advanced Filter Collapse Layer (Hidden by default) */}
      {showAdvancedFilters && (
        <div className="w-full p-6 bg-white rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* 1. Status Jemaat */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-['Public_Sans']">Status Jemaat</label>
            <div className="relative">
              <select 
                value={filterStatusJemaat}
                onChange={(e) => setFilterStatusJemaat(e.target.value)}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer"
              >
                <option value="">Semua</option>
                <option value="Aktif">Aktif</option>
                <option value="Tidak Aktif">Tidak Aktif</option>
                <option value="Keluar">Keluar</option>
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          {/* 2. Status Baptis */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-['Public_Sans']">Status Baptis</label>
            <div className="relative">
              <select 
                value={filterStatusBaptis}
                onChange={(e) => setFilterStatusBaptis(e.target.value)}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer"
              >
                <option value="">Semua</option>
                <option value="true">Sudah Baptis</option>
                <option value="false">Belum Baptis</option>
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          {/* 3. Jenis Kelamin */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-['Public_Sans']">Jenis Kelamin</label>
            <div className="relative">
              <select 
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer"
              >
                <option value="">Semua</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          {/* 4. Rentang Umur */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-['Public_Sans']">Rentang Umur</label>
            <div className="relative">
              <select 
                value={filterUmur}
                onChange={(e) => setFilterUmur(e.target.value)}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer"
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

        </div>
      )}

      {/* Data Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        {/* Table Header */}
        <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
          <div className="w-32 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">ID Jemaat</div>
          <div className="w-64 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Nama Lengkap</div>
          <div className="flex-1 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Satelit/Cabang</div>
          <div className="w-48 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Komisi/Pelayanan</div>
          <div className="w-32 text-center text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Status</div>
          <div className="w-20 text-right text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Aksi</div>
        </div>

        {/* Table Body */}
        {data.length === 0 ? (
          <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
            <span className="material-icons-round text-5xl mb-2 text-slate-300">search_off</span>
            <span className="text-sm font-['Public_Sans']">Tidak ada data jemaat yang ditemukan.</span>
          </div>
        ) : (
          data.map((jemaat, idx) => (
            <div key={jemaat.id || idx} className="w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <div className="w-32 text-slate-500 text-sm font-['Liberation_Mono']">{jemaat.jemaat_id}</div>
              <div className="w-64 flex items-center gap-3">
                <img className="w-9 h-9 rounded-full object-cover border border-slate-200" src={jemaat.foto_url || `https://ui-avatars.com/api/?name=${jemaat.nama_lengkap}&background=random`} alt="avatar" />
                <span className="text-slate-900 text-sm font-semibold font-['Public_Sans'] w-full truncate pr-2">{jemaat.nama_lengkap}</span>
              </div>
              <div className="flex-1 text-slate-600 text-sm font-['Public_Sans'] truncate pr-2">{jemaat.nama_satelit || '-'}</div>
              <div className="w-48 flex flex-wrap gap-1 items-center py-1">
                {jemaat.komisi ? 
                  jemaat.komisi.split(', ').map((k: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 text-[10px] font-bold font-['Public_Sans'] uppercase whitespace-nowrap">
                      {k}
                    </span>
                  ))
                : (
                  <span className="text-slate-400 text-xs italic font-['Public_Sans']">Tanpa Komisi</span>
                )}
              </div>
              <div className="w-32 flex justify-center">
                <span className={`px-3 py-1 rounded-full text-xs font-bold font-['Public_Sans'] uppercase ${jemaat.status_jemaat === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : jemaat.status_jemaat === 'Keluar' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                  {jemaat.status_jemaat}
                </span>
              </div>
              <div className="w-20 flex justify-end gap-2 text-slate-400 relative">
                 <button 
                  onClick={() => setOpenMenuId(openMenuId === jemaat.id ? null : jemaat.id)}
                  className="hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded transition-colors"
                 >
                   <span className="material-icons-round text-[24px]">more_horiz</span>
                 </button>

                 {openMenuId === jemaat.id && (
                   <>
                     <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)}></div>
                     <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-slate-200 z-20 py-1 overflow-hidden">
                       <Link 
                         href={`/dashboard/members/${jemaat.id}?mode=view`}
                         className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-['Public_Sans']"
                       >
                         <span className="material-icons-round text-[18px] text-slate-400">visibility</span> Lihat Detail
                       </Link>
                       <Link 
                         href={`/dashboard/members/${jemaat.id}?mode=edit`}
                         className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-['Public_Sans']"
                       >
                         <span className="material-icons-round text-[18px] text-slate-400">edit</span> Edit Data
                       </Link>
                       <div className="w-full h-px bg-slate-100 my-1"></div>
                       {jemaat.status_jemaat === 'Aktif' ? (
                         <button onClick={() => { setOpenMenuId(null); handleToggleStatus(jemaat.id, jemaat.status_jemaat); }} className="w-full text-left px-4 py-2 hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-3 text-sm text-amber-600 font-['Public_Sans']">
                           <span className="material-icons-round text-[18px] text-amber-400">person_off</span> Nonaktifkan
                         </button>
                       ) : (
                         <button onClick={() => { setOpenMenuId(null); handleToggleStatus(jemaat.id, jemaat.status_jemaat); }} className="w-full text-left px-4 py-2 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center gap-3 text-sm text-emerald-600 font-['Public_Sans']">
                           <span className="material-icons-round text-[18px] text-emerald-400">person_add</span> Aktifkan
                         </button>
                       )}
                     </div>
                   </>
                 )}
              </div>
            </div>
          ))
        )}

        {/* Pagination Footer */}
        <div className="w-full px-6 py-4 bg-white flex justify-between items-center text-sm">
          <span className="text-slate-500 font-['Public_Sans']">
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

    </div>
  );
}
