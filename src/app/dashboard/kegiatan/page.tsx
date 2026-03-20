'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import Link from 'next/link';
import { AlertModal } from '@/components/ui/AlertModal';

export default function KegiatanPage() {
  const { showLoader, hideLoader } = useLoader();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Authentication State
  const [userData, setUserData] = useState<any>(null);

  // Options State
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [departemenOptions, setDepartemenOptions] = useState<any[]>([]);
  
  // Pagination & Stats State
  const [data, setData] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [bulanIni, setBulanIni] = useState(0);
  const [mingguIni, setMingguIni] = useState(0);
  const [menungguLpj, setMenungguLpj] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;
  
  // Filters
  const [filterSatelit, setFilterSatelit] = useState('');
  const [filterDepartemen, setFilterDepartemen] = useState('');
  const [filterTanggal, setFilterTanggal] = useState('Bulan Ini');
  const [filterJenis, setFilterJenis] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Fetch Options and User Data on Mount
  useEffect(() => {
    const fetchOptionsAndUser = async () => {
      showLoader();
      try {
        const [resSatelit, resDept, resUser] = await Promise.all([
          fetch('/api/options?type=satelit'),
          fetch('/api/options?type=departemen'), // Assuming this exists or falls back safely
          fetch('/api/auth/me')
        ]);
        const satelitData = await resSatelit.json();
        
        // Handle if departemen options API doesn't exist yet but we don't want to crash
        let deptData = { success: false, data: [] };
        if (resDept.ok) {
           const text = await resDept.text();
           try { deptData = JSON.parse(text); } catch(e){}
        }

        const authData = resUser.ok ? await resUser.json() : null;

        if (satelitData.success) setSatelitOptions(satelitData.data);
        if (deptData.success) setDepartemenOptions(deptData.data);
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
  }, [debouncedSearch, filterSatelit, filterDepartemen, filterTanggal, filterJenis, filterStatus]);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      showLoader();
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch) queryParams.append('search', debouncedSearch);
        if (filterSatelit) queryParams.append('satelit_id', filterSatelit);
        if (filterDepartemen) queryParams.append('departemen_id', filterDepartemen);
        if (filterStatus) queryParams.append('status', filterStatus);
        
        // Tanggal filter logic usually goes here...
        
        queryParams.append('limit', limit.toString());
        queryParams.append('offset', ((currentPage - 1) * limit).toString());

        const res = await fetch(`/api/kegiatan?${queryParams.toString()}`);
        const result = await res.json();
        
        if (result.success) {
          setData(result.data);
          setTotalItems(result.meta.total);
          setBulanIni(result.meta.bulan_ini || 0);
          setMingguIni(result.meta.minggu_ini || 0);
          setMenungguLpj(result.meta.menunggu_lpj || 0);
        }
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        hideLoader();
      }
    };

    fetchData();
  }, [debouncedSearch, filterSatelit, filterDepartemen, filterTanggal, filterJenis, filterStatus, currentPage]);

  const totalPages = Math.ceil(totalItems / limit) || 1;

  // Render Status Badge
  const renderStatusBadge = (status: string) => {
    let colorClass = "bg-slate-100 text-slate-700 border-slate-200"; // Draft
    if (status === 'Ongoing' || status === 'Registrasi') colorClass = "bg-blue-50 text-blue-700 border-blue-200";
    else if (status === 'Selesai') colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    else if (status === 'Menunggu LPJ') colorClass = "bg-amber-50 text-amber-700 border-amber-200";

    return (
      <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${colorClass} whitespace-nowrap`}>
        {status}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    // timeString from DB often comes like "08:00:00"
    return timeString.substring(0, 5);
  };

  return (
    <div className="w-full flex flex-col gap-8 pb-10">
      
      {/* Header Section */}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
            <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">Daftar Kegiatan</h1>
            <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6">Sistem Informasi Manajemen Jadwal & Kegiatan Gereja</div>
          </div>
          {/* TODO: Add proper permission check for kegiatan_create */}
          {(hasPermission('jemaat_create') || true) && (
            <Link href="/dashboard/kegiatan/new" className="px-5 py-2.5 bg-slate-700 rounded-lg flex justify-start items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none">
              <span className="material-icons-round text-white text-[20px]">add</span>
              <span className="text-white text-sm font-bold font-['Inter'] leading-5">Tambah Kegiatan Baru</span>
            </Link>
          )}
        </div>

      {/* Statistic Cards */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Card 1 */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-indigo-50 rounded-xl flex justify-center items-center">
             <span className="material-icons-round text-indigo-600 text-3xl">calendar_month</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-['Public_Sans'] uppercase tracking-wide">TOTAL KEGIATAN (BULAN INI)</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-['Public_Sans'] leading-9">{bulanIni}</span>
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-emerald-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-emerald-600 text-3xl">event_upcoming</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-['Public_Sans'] uppercase tracking-wide leading-tight">
              KEGIATAN MENDATANG (7 HARI KEDEPAN)
            </span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-['Public_Sans'] leading-9">
                {mingguIni}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-amber-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-amber-600 text-3xl">assignment_late</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-['Public_Sans'] uppercase tracking-wide">MENUNGGU LPJ (LAPORAN)</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-amber-600 text-3xl font-bold font-['Public_Sans'] leading-9">{menungguLpj}</span>
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
            placeholder="Cari berdasarkan ID Kegiatan, Nama, atau Tema..."
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
            disabled={userData?.role_name?.toUpperCase().includes('SATELIT')}
            className={`appearance-none w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm ${
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

        {/* Departemen Dropdown */}
        <div className="relative min-w-[200px]">
          <select 
            value={filterDepartemen}
            onChange={(e) => setFilterDepartemen(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer"
          >
            <option value="">Semua Departemen/Komisi</option>
            {departemenOptions.length > 0 ? (
                departemenOptions.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.nama_departemen}</option>
                ))
            ) : (
                <option value="none">Data belum sinkron</option>
            )}
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        {/* Tanggal Dropdown */}
        <div className="relative min-w-[150px]">
          <select 
            value={filterTanggal}
            onChange={(e) => setFilterTanggal(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer"
          >
            <option value="Hari Ini">Hari Ini</option>
            <option value="Minggu Ini">Minggu Ini</option>
            <option value="Bulan Ini">Bulan Ini</option>
            <option value="Custom">Custom Date</option>
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">calendar_today</span>
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

      {/* Advanced Filter Collapse Layer */}
      {showAdvancedFilters && (
        <div className="w-full p-6 bg-white rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-['Public_Sans']">Jenis Kegiatan</label>
            <div className="relative">
              <select 
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer"
              >
                <option value="">Semua Jenis</option>
                <option value="1">Kebaktian Umum (Ibadah Raya)</option>
                <option value="7">Komsel</option>
                <option value="10">Camp / Retreat</option>
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-['Public_Sans']">Status Kegiatan</label>
            <div className="relative">
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer"
              >
                <option value="">Semua Status</option>
                <option value="Draft">Draft</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Menunggu LPJ">Menunggu LPJ</option>
                <option value="Selesai">Selesai</option>
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative z-0">
        <div className="w-full overflow-x-auto pb-4 min-h-64">
          <div className="min-w-[1050px] flex flex-col">
            {/* Table Header */}
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
              <div className="w-32 shrink-0 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">ID KEGIATAN</div>
              <div className="w-64 shrink-0 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">NAMA & JENIS KEGIATAN</div>
              <div className="flex-1 min-w-[200px] text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">JADWAL & LOKASI</div>
              <div className="w-48 shrink-0 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">PENYELENGGARA</div>
              <div className="w-32 shrink-0 text-center text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">STATUS</div>
              <div className="w-20 shrink-0 text-right text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">AKSI</div>
            </div>

            {/* Table Body */}
            <div>
              {data.length === 0 ? (
                <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
                  <span className="material-icons-round text-5xl mb-2 text-slate-300">event_busy</span>
                  <span className="text-sm font-['Public_Sans']">Tidak ada data kegiatan yang ditemukan.</span>
                </div>
              ) : (
                data.map((kegiatan, idx) => {
                  const isLastRows = data.length > 2 && idx >= data.length - 2;
                  
                  // Hitung status if menuggu LPJ (jika selesai tp belum ada LPJ)
                  // For UI mockup display logic:
                  let displayStatus = kegiatan.status_kegiatan;
                  if (displayStatus === 'Selesai' && true /* condition if waiting LPJ, but normally backend returns this */) {
                    // We assume backend handles the precise text or we can modify it
                  }

                  return (
                <div key={kegiatan.id || idx} className={`w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors relative ${openMenuId === kegiatan.id ? 'z-50' : 'z-10'}`}>
                  {/* Kolom 1: ID */}
                  <div className="w-32 shrink-0 text-slate-500 text-sm font-bold font-['Liberation_Mono'] tracking-wide">{kegiatan.kode_kegiatan}</div>
                  
                  {/* Kolom 2: Nama & Jenis */}
                  <div className="w-64 shrink-0 flex flex-col justify-center pr-4">
                     <span className="text-slate-900 font-bold text-sm truncate">{kegiatan.nama_kegiatan}</span>
                     <span className="text-slate-500 text-xs font-medium truncate mt-0.5">{kegiatan.nama_jenis_kegiatan || 'Praise & Worship'}</span>
                  </div>

                  {/* Kolom 3: Jadwal & Lokasi */}
                  <div className="flex-1 min-w-[200px] flex flex-col justify-center pr-4">
                     <div className="text-slate-700 text-sm font-semibold truncate flex items-center gap-1">
                        <span className="material-icons-round text-[14px] text-slate-400">schedule</span>
                        {formatDate(kegiatan.tanggal_mulai)} • {formatTime(kegiatan.waktu_mulai)}
                     </div>
                     <span className="text-slate-500 text-xs mt-0.5 truncate">{kegiatan.lokasi_kegiatan || 'Belum diatur'}</span>
                  </div>

                  {/* Kolom 4: Penyelenggara */}
                  <div className="w-48 shrink-0 flex flex-col justify-center pr-4">
                     <span className="text-slate-700 text-sm font-medium truncate">{kegiatan.nama_satelit || 'Gereja Pusat'}</span>
                     <span className="text-slate-500 text-xs truncate mt-0.5">{kegiatan.nama_departemen || 'Umum'}</span>
                  </div>

                  {/* Kolom 5: Status */}
                  <div className="w-32 shrink-0 flex justify-center">
                    {renderStatusBadge(kegiatan.status_kegiatan)}
                  </div>

                  {/* Kolom 6: Aksi */}
                  <div className="w-20 shrink-0 flex justify-end items-center gap-2">
                    <button 
                      onClick={() => setOpenMenuId(openMenuId === kegiatan.id ? null : kegiatan.id)}
                      className="w-8 h-8 rounded-full flex justify-center items-center hover:bg-slate-200 text-slate-500 transition-colors"
                    >
                      <span className="material-icons-round text-[20px]">more_vert</span>
                    </button>

                    {/* Dropdown Menu */}
                    {openMenuId === kegiatan.id && (
                      <div className={`absolute right-10 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 animate-in fade-in zoom-in-95 duration-150 ${isLastRows ? 'bottom-8' : 'top-10'}`}>
                        <div className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-3 text-sm text-slate-700 transition-colors">
                          <span className="material-icons-round text-[18px] text-slate-400">visibility</span> Lihat Detail
                        </div>
                        {kegiatan.status_kegiatan !== 'Selesai' && (
                          <div className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-3 text-sm text-slate-700 transition-colors">
                            <span className="material-icons-round text-[18px] text-slate-400">edit_square</span> Edit Kegiatan
                          </div>
                        )}
                        <div className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-3 text-sm text-slate-700 transition-colors border-t border-slate-100 mt-1 pt-2">
                          <span className="material-icons-round text-[18px] text-emerald-500">how_to_reg</span> Input Absensi
                        </div>
                        <div className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-3 text-sm text-slate-700 transition-colors">
                          <span className="material-icons-round text-[18px] text-amber-500">description</span> Input LPJ
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            }))}
            </div>

          </div>
        </div>

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="w-full px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center rounded-b-xl">
            <div className="text-slate-500 text-sm font-['Public_Sans']">
              Menampilkan {((currentPage - 1) * limit) + 1} - {Math.min(currentPage * limit, totalItems)} dari {totalItems} acara
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg border border-slate-200 flex justify-center items-center hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent bg-white text-slate-600 shadow-sm"
              >
                <span className="material-icons-round text-lg">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-8 h-8 rounded-lg text-sm font-bold flex justify-center items-center shadow-sm ${
                    currentPage === i + 1 
                    ? 'bg-slate-700 text-white border-transparent' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-lg border border-slate-200 flex justify-center items-center hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent bg-white text-slate-600 shadow-sm"
              >
                <span className="material-icons-round text-lg">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
