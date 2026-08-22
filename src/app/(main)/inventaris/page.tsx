'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';

export default function InventarisPage() {
  const { showLoader, hideLoader } = useLoader();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });
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

  useEffect(() => {
    let active = true;
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

        if (active) {
          if (kategoriData.success) setKategoriOptions(kategoriData.data);
          if (satelitData.success) setSatelitOptions(satelitData.data);
          if (authData) {
            setUserData(authData);
            if (authData.role_name?.toUpperCase().includes('SATELIT')) {
              setFilterSatelit(authData.satelit_id?.toString() || '');
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial data', error);
      } finally {
        if (active) hideLoader();
      }
    };
    fetchOptionsAndUser();
    return () => { active = false; };
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

  // Fetch data — depends only on stable filter values + page
  useEffect(() => {
    // Don't fetch until initial options load is done (userData set or null-checked)
    if (kategoriOptions.length === 0 && satelitOptions.length === 0) return;

    let active = true;
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
        
        if (result.success && active) {
          setData(result.data);
          setTotalItems(result.meta.total);
        }
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        if (active) hideLoader();
      }
    };

    fetchData();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filterKategori, filterSatelit, filterKondisi, filterStatus, filterAktivaTetap, currentPage, kategoriOptions.length, satelitOptions.length]);

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
            {hasPermission('inventaris_manage') && (
              <Link href="/inventaris/tambah" className="px-5 py-2.5 bg-slate-700 rounded-lg flex justify-start items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none">
                <span className="material-icons-round text-white text-[20px]">add</span>
                <span className="text-white text-sm font-bold font-sans leading-5">Tambah Barang</span>
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
          <select 
            value={filterSatelit}
            onChange={(e) => { setFilterSatelit(e.target.value); setCurrentPage(1); }}
            disabled={userData?.role_name?.toUpperCase().includes('SATELIT')}
            className={`appearance-none w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm ${
              userData?.role_name?.toUpperCase().includes('SATELIT') ? 'bg-slate-200 cursor-not-allowed opacity-70' : 'bg-slate-50 cursor-pointer'
            }`}
          >
            {!userData?.role_name?.toUpperCase().includes('SATELIT') && <option value="">Semua Satelit (Lokasi)</option>}
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
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative z-0">
        <div className="w-full overflow-x-auto pb-4">
          <div className="min-w-[1050px] flex flex-col">
            {/* Table Header */}
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
              <div className="w-40 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Kode</div>
              <div className="w-64 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Nama Barang</div>
              <div className="w-40 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Kategori</div>
              <div className="w-32 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Merk</div>
              <div className="flex-1 min-w-[150px] text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Lokasi</div>
              <div className="w-20 shrink-0 text-center text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Jumlah</div>
              <div className="w-28 shrink-0 text-center text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Kondisi</div>
              <div className="w-28 shrink-0 text-center text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Status</div>
              <div className="w-16 shrink-0 text-right text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Aksi</div>
            </div>

        {/* Table Body */}
        <div className="min-h-64">
          {data.length === 0 ? (
            <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
              <span className="material-icons-round text-5xl mb-2 text-slate-300">search_off</span>
              <span className="text-sm font-sans">Tidak ada data barang yang ditemukan.</span>
            </div>
          ) : (
            data.map((item, idx) => {
              const isLastRows = data.length > 2 && idx >= data.length - 2;
              return (
            <div 
              key={item.id || idx} 
              onClick={() => router.push(`/inventaris/${item.id}`)}
              className={`w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors relative cursor-pointer ${openMenuId === item.id ? 'z-50' : 'z-10'}`}
            >
              <div className="w-40 shrink-0 text-slate-500 text-sm font-sans">{item.kode_barang}</div>
              <div className="w-64 shrink-0 text-slate-900 text-sm font-semibold font-sans truncate pr-2">{item.nama}</div>
              <div className="w-40 shrink-0 text-slate-600 text-sm font-sans truncate pr-2">{item.nama_kategori}</div>
              <div className="w-32 shrink-0 text-slate-600 text-sm font-sans truncate pr-2">{item.merk || '-'}</div>
              <div className="flex-1 min-w-[150px] text-slate-600 text-sm font-sans truncate pr-2">
                {item.lokasi_nama_satelit ? `${item.lokasi_nama_satelit}${item.lokasi_nama_sublokasi ? ' - ' + item.lokasi_nama_sublokasi : ''}` : '-'}
              </div>
              <div className="w-20 shrink-0 text-slate-600 text-sm font-sans text-center">{item.jumlah}</div>
              <div className="w-28 shrink-0 flex justify-center">
                <span className={`px-2 py-1 rounded-md text-xs font-bold font-sans ${item.kondisi === 'Baik' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : item.kondisi === 'Rusak Ringan' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                  {item.kondisi}
                </span>
              </div>
              <div className="w-28 shrink-0 flex justify-center">
                <span className={`px-2 py-1 rounded-md text-xs font-bold font-sans ${item.status === 'Aktif' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                  {item.status}
                </span>
              </div>
              <div className="w-16 shrink-0 flex justify-end gap-2 text-slate-400 relative">
                 <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === item.id ? null : item.id);
                  }}
                  className="hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded transition-colors"
                 >
                   <span className="material-icons-round text-[24px]">more_horiz</span>
                 </button>

                 {openMenuId === item.id && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}></div>
                     <div className={`absolute right-0 ${isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'} w-40 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-slate-200 z-50 py-1 overflow-visible`}>
                       <Link 
                         href={`/inventaris/${item.id}`}
                         onClick={(e) => e.stopPropagation()}
                         className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans"
                       >
                         <span className="material-icons-round text-[18px] text-slate-400">visibility</span> Detail
                       </Link>
                       {hasPermission('inventaris_manage') && (
                         <>
                           <Link 
                             href={`/inventaris/${item.id}/edit`}
                             onClick={(e) => e.stopPropagation()}
                             className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans"
                           >
                             <span className="material-icons-round text-[18px] text-slate-400">edit</span> Edit
                           </Link>
                           <div className="w-full h-px bg-slate-100 my-1"></div>
                           <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setAlertState({ isOpen: true, id: item.id }); }} className="w-full text-left px-4 py-2 hover:bg-rose-50 hover:text-rose-700 transition-colors flex items-center gap-3 text-sm text-rose-600 font-sans">
                             <span className="material-icons-round text-[18px] text-rose-400">delete</span> Hapus
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
    </div>
  );
}
