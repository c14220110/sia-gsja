'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';

export default function PegawaiPage() {
  const { showLoader, hideLoader } = useLoader();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });

  // State popup alert peringatannya
  const [alertState, setAlertState] = useState<{ 
    isOpen: boolean; 
    id: number | null; 
    type: 'approve' | 'status'; 
    newValue: string 
  }>({
    isOpen: false,
    id: null,
    type: 'status',
    newValue: ''
  });

  // State Sesi Login-nya
  const [userData, setUserData] = useState<any>(null);

  // Pilihan Data Dropdown
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  
  // State Halaman dan Statistiknya
  const [data, setData] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [pendingApproval, setPendingApproval] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;
  
  // Saringan Standar
  const [filterSatelit, setFilterSatelit] = useState('');
  
  // Saringan Lanjutan tingkat dewa
  const [filterStatusPegawai, setFilterStatusPegawai] = useState('Aktif');
  const [filterTipePekerja, setFilterTipePekerja] = useState('');

  // Tarik semua data dropdown dan profil pas pertama dibuka
  useEffect(() => {
    const fetchOptionsAndUser = async () => {
      showLoader();
      try {
        const [resSatelit, resUser] = await Promise.all([
          fetch('/api/options?type=satelit'),
          fetch('/api/auth/me')
        ]);
        const satelitData = await resSatelit.json();
        const authData = resUser.ok ? await resUser.json() : null;

        if (satelitData.success) setSatelitOptions(satelitData.data);
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

  // Atur balik ke halaman pertama pas filternya diputar
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterSatelit, filterStatusPegawai, filterTipePekerja]);

  // Tarik Datanya Yuk
  const fetchData = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (debouncedSearch) queryParams.append('search', debouncedSearch);
      if (filterSatelit) queryParams.append('satelit_id', filterSatelit);
      if (filterStatusPegawai && filterStatusPegawai !== 'Semua') queryParams.append('status_pegawai', filterStatusPegawai);
      if (filterTipePekerja) queryParams.append('tipe_pekerja', filterTipePekerja);
      
      queryParams.append('limit', limit.toString());
      queryParams.append('offset', ((currentPage - 1) * limit).toString());

      const res = await fetch(`/api/pegawai?${queryParams.toString()}`);
      const result = await res.json();
      
      if (result.success) {
        setData(result.data);
        setTotalItems(result.meta.total);
        setPendingApproval(result.meta.pending_approval || 0);
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    }
  };

  useEffect(() => {
    showLoader();
    fetchData().finally(() => hideLoader());
  }, [debouncedSearch, filterSatelit, filterStatusPegawai, filterTipePekerja, currentPage]);

  const confirmAction = async () => {
    const { id, type, newValue } = alertState;
    if (!id) return;
    setAlertState({ isOpen: false, id: null, type: 'status', newValue: '' });
    
    try {
      setSubmitState({ status: 'loading', message: '' });
      let body: any = {};
      
      if (type === 'approve') {
        body = { 
          status_approval: 'Disetujui', 
          di_acc_oleh: userData?.id,
          tanggal_acc: new Date().toISOString()
        };
      } else {
        body = { status_pegawai: newValue };
      }

      const res = await fetch(`/api/pegawai/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: `Berhasil memproses tindakan ${type === 'approve' ? 'Approval' : newValue}` });
        fetchData(); // reload data to sync
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal mengubah data' });
      }
    } catch (error) {
      console.error(error);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan koneksi.' });
    }
  };

  const totalPages = Math.ceil(totalItems / limit) || 1;

  const renderStatusBadge = (status: string) => {
    switch(status) {
      case 'Aktif': return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold font-sans uppercase leading-tight">Aktif</span>;
      case 'Pending': return <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold font-sans uppercase leading-tight flex items-center gap-1 w-fit"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>Pending</span>;
      case 'Resign': return <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold font-sans uppercase leading-tight">Resign</span>;
      case 'PHK': return <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold font-sans uppercase leading-tight">PHK</span>;
      default: return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold font-sans uppercase leading-tight">{status}</span>;
    }
  };

  const alertMessage = alertState.type === 'approve' 
    ? "Dengan me-review dan melakukan approval, data ini akan tercatat resmi di master pegawai. Anda yakin untuk approve?" 
    : `Apakah Anda yakin ingin mengubah status pegawai ini menjadi ${alertState.newValue}?`;

  return (
    <div className="w-full flex flex-col gap-8 pb-10">
      
      {/* Header Section */}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
            <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Manajemen Pegawai</h1>
            <div className="text-slate-500 text-base font-medium font-sans leading-6">HRIS System & Payroll Integration</div>
          </div>
          {hasPermission('pegawai_create') && (
            <Link href="/pegawai/new" className="px-5 py-2.5 bg-slate-700 rounded-lg flex justify-start items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none">
              <span className="material-icons-round text-white text-[20px]">badge</span>
              <span className="text-white text-sm font-bold font-sans leading-5">Registrasi Pegawai</span>
            </Link>
          )}
        </div>

      {/* Statistic Cards */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Total Pegawai Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-blue-600/10 rounded-xl flex justify-center items-center">
             <span className="material-icons-round text-blue-700 text-3xl">badge</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-sans uppercase tracking-wide">Total Pegawai</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">{totalItems.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Pegawai Pending Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow relative overflow-hidden">
          {pendingApproval > 0 && <div className="absolute top-0 right-0 w-2 h-full bg-amber-500"></div>}
          <div className="w-14 h-14 bg-amber-500/10 rounded-xl flex justify-center items-center">
             <span className="material-icons-round text-amber-600 text-3xl">pending_actions</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-sans uppercase tracking-wide">Pending Approval</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">{pendingApproval.toLocaleString()}</span>
              {pendingApproval > 0 && <span className="text-sm font-bold text-amber-600 mb-1 ml-2 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">Action Required</span>}
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
            placeholder="Cari pegawai berdasarkan nama atau ID..."
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

        {/* More Filters Toggle */}
        <button 
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={`px-4 py-2.5 border rounded-lg flex items-center gap-2 transition-colors group ${showAdvancedFilters ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
        >
          <span className={`material-icons-round text-[20px] transition-colors ${showAdvancedFilters ? 'text-slate-800' : 'text-slate-500 group-hover:text-slate-700'}`}>tune</span>
          <span className={`text-sm font-medium font-sans transition-colors ${showAdvancedFilters ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-800'}`}>More Filters</span>
        </button>
      </div>

      {/* Advanced Filter Collapse Layer */}
      {showAdvancedFilters && (
        <div className="w-full p-6 bg-white rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-sans">Status Pegawai</label>
            <div className="relative">
              <select 
                value={filterStatusPegawai}
                onChange={(e) => setFilterStatusPegawai(e.target.value)}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
              >
                <option value="Semua">Semua</option>
                <option value="Aktif">Aktif</option>
                <option value="Resign">Resign</option>
                <option value="Pensiun">Pensiun</option>
                <option value="PHK">PHK</option>
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-sans">Tipe Pekerja (Payroll Scheme)</label>
            <div className="relative">
              <select 
                value={filterTipePekerja}
                onChange={(e) => setFilterTipePekerja(e.target.value)}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
              >
                <option value="">Semua Tipe Pekerja</option>
                <option value="Pegawai Tetap">Pegawai Tetap</option>
                <option value="Tidak Tetap">Tidak Tetap (Part-time)</option>
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
            {/* Table Header BP Compliant */}
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
              <div className="w-32 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">ID Pegawai</div>
              <div className="w-64 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Profil Pegawai</div>
              <div className="flex-1 min-w-[200px] text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Jabatan & Departemen</div>
              <div className="w-48 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Tipe Pekerja</div>
              <div className="w-32 shrink-0 text-center text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Status</div>
              <div className="w-20 shrink-0 text-right text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Aksi</div>
            </div>

        {/* Table Body */}
        <div className="min-h-64">
          {data.length === 0 ? (
            <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
              <span className="material-icons-round text-5xl mb-2 text-slate-300">badge</span>
              <span className="text-sm font-sans text-center max-w-[300px]">Tidak ada data pegawai. Cek filter pencarian Anda.</span>
            </div>
          ) : (
            data.map((pegawai, idx) => {
              const isLastRows = data.length > 2 && idx >= data.length - 2;
              return (
            <div key={pegawai.id || idx} className={`w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors relative ${openMenuId === pegawai.id ? 'z-50' : 'z-10'}`}>
              
              <div className="w-32 shrink-0 text-slate-500 text-sm font-sans font-bold tracking-tight">
                 {pegawai.id_pegawai}
              </div>
              
              <div className="w-64 shrink-0 flex flex-col pr-4">
                <span className="text-slate-900 text-sm font-black font-sans truncate">{pegawai.nama_lengkap}</span>
                <span className="text-slate-500 text-xs font-medium truncate flex items-center gap-1 mt-0.5">
                   <span className="material-icons-round text-[12px]">location_on</span> {pegawai.nama_satelit || '-'}
                </span>
              </div>
              
              <div className="flex-1 min-w-[200px] flex flex-col pr-4">
                <span className="text-slate-700 text-sm font-bold font-sans truncate">{pegawai.nama_jabatan}</span>
                {pegawai.nama_departemen && (
                  <span className="text-slate-400 text-xs font-medium font-sans truncate">Dep: {pegawai.nama_departemen}</span>
                )}
              </div>
              
              <div className="w-48 shrink-0 flex items-center">
                {pegawai.tipe_pekerja === 'Pegawai Tetap' ? (
                   <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold font-sans uppercase rounded-full">P. Tetap</span>
                ) : pegawai.tipe_pekerja === 'Tidak Tetap' ? (
                   <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold font-sans uppercase rounded-full">Part-Time</span>
                ) : (
                   <span className="text-slate-400 text-xs italic">-</span>
                )}
              </div>
              
              <div className="w-32 shrink-0 flex justify-center">
                 {pegawai.status_approval === 'Pending' ? renderStatusBadge('Pending') : renderStatusBadge(pegawai.status_pegawai)}
              </div>
              
              <div className="w-20 shrink-0 flex justify-end gap-2 text-slate-400 relative">
                 <button 
                  onClick={() => setOpenMenuId(openMenuId === pegawai.id ? null : pegawai.id)}
                  className="hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded transition-colors"
                 >
                   <span className="material-icons-round text-[24px]">more_horiz</span>
                 </button>

                 {openMenuId === pegawai.id && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                     <div className={`absolute right-0 ${isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'} w-48 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-slate-200 z-50 py-1 overflow-visible`}>
                       <Link 
                         href={`/pegawai/${pegawai.id}?mode=view`}
                         className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans"
                       >
                         <span className="material-icons-round text-[18px] text-slate-400">visibility</span> Lihat Detail
                       </Link>
                       {hasPermission('pegawai_edit') && (
                         <>
                           <Link 
                             href={`/pegawai/${pegawai.id}?mode=edit`}
                             className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans"
                           >
                             <span className="material-icons-round text-[18px] text-slate-400">edit</span> Edit Pegawai
                           </Link>
                           <div className="w-full h-px bg-slate-100 my-1"></div>
                           
                           {pegawai.status_approval === 'Pending' && (
                             <button onClick={() => { setOpenMenuId(null); setAlertState({ isOpen: true, id: pegawai.id, type: 'approve', newValue: '' }); }} className="w-full text-left px-4 py-2 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-3 text-sm text-blue-600 font-sans font-bold">
                               <span className="material-icons-round text-[18px] text-blue-500">task_alt</span> Approve Data
                             </button>
                           )}

                           {pegawai.status_pegawai === 'Aktif' ? (
                             <button onClick={() => { setOpenMenuId(null); setAlertState({ isOpen: true, id: pegawai.id, type: 'status', newValue: 'Resign' }); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 hover:text-slate-800 transition-colors flex items-center gap-3 text-sm text-slate-600 font-sans">
                               <span className="material-icons-round text-[18px] text-slate-400">directions_run</span> Proses Resign
                             </button>
                           ) : pegawai.status_pegawai !== 'Aktif' && pegawai.status_approval !== 'Pending' ? (
                             <button onClick={() => { setOpenMenuId(null); setAlertState({ isOpen: true, id: pegawai.id, type: 'status', newValue: 'Aktif' }); }} className="w-full text-left px-4 py-2 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center gap-3 text-sm text-emerald-600 font-sans">
                               <span className="material-icons-round text-[18px] text-emerald-400">history</span> Jadikan Aktif
                             </button>
                           ) : null}
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
            {Math.min(currentPage * limit, totalItems)} dari {totalItems} pegawai
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
        title={alertState.type === 'approve' ? "Approve Data Pegawai" : "Konfirmasi Perubahan Status"}
        message={alertMessage}
        onConfirm={confirmAction}
        onCancel={() => setAlertState({ isOpen: false, id: null, type: 'status', newValue: '' })}
      />

      <SubmitOverlay 
        status={submitState.status} 
        message={submitState.message} 
        errors={submitState.errors} 
        onClose={() => setSubmitState({ status: 'idle', message: '' })} 
      />
    </div>
  );
}
