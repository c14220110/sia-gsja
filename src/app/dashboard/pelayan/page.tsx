'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

export default function PelayanPage() {
  const { showLoader, hideLoader } = useLoader();

  const [searchQuery,    setSearchQuery]    = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showAdvanced,   setShowAdvanced]   = useState(false);
  const [openMenuId,     setOpenMenuId]     = useState<number | null>(null);
  const [submitState,    setSubmitState]    = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });

  // Options
  const [satelitOptions,    setSatelitOptions]    = useState<any[]>([]);
  const [rolePelayanOptions, setRolePelayanOptions] = useState<any[]>([]);

  // Pagination & Stats
  const [data,       setData]       = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [pelayanBaru, setPelayanBaru] = useState(0);
  const [totalRole,  setTotalRole]  = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  // Filters
  const [filterSatelit, setFilterSatelit] = useState('');
  const [filterRole,    setFilterRole]    = useState('');

  // Advanced Filters
  const [filterStatus,   setFilterStatus]   = useState('Aktif');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo,   setFilterDateTo]   = useState('');

  // Auth
  const [userData, setUserData] = useState<any>(null);

  // Fetch options and user on mount
  useEffect(() => {
    const init = async () => {
      showLoader();
      try {
        const [resSatelit, resRole, resUser] = await Promise.all([
          fetch('/api/options?type=satelit'),
          fetch('/api/options?type=role_pelayan'),
          fetch('/api/auth/me'),
        ]);
        const satelitData = await resSatelit.json();
        const roleData    = await resRole.json();
        const authData    = resUser.ok ? await resUser.json() : null;

        if (satelitData.success) setSatelitOptions(satelitData.data);
        if (roleData.success)    setRolePelayanOptions(roleData.data);
        if (authData) {
          setUserData(authData);
          if (authData.role_name === 'GEMBALA SATELIT') {
            setFilterSatelit(authData.satelit_id?.toString() || '');
          }
        }
      } catch (err) {
        console.error('[Pelayan] init error:', err);
      } finally {
        hideLoader();
      }
    };
    init();
  }, []);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterSatelit, filterRole, filterStatus, filterDateFrom, filterDateTo]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      showLoader();
      try {
        const q = new URLSearchParams();
        if (debouncedSearch) q.append('search',     debouncedSearch);
        if (filterSatelit)   q.append('satelit_id', filterSatelit);
        if (filterRole)      q.append('role_id',    filterRole);
        if (filterStatus && filterStatus !== 'Semua') q.append('status', filterStatus);
        if (filterDateFrom)  q.append('date_from',  filterDateFrom);
        if (filterDateTo)    q.append('date_to',    filterDateTo);
        q.append('limit',  limit.toString());
        q.append('offset', ((currentPage - 1) * limit).toString());

        const res    = await fetch(`/api/pelayan?${q}`);
        const result = await res.json();
        if (result.success) {
          setData(result.data);
          setTotalItems(result.meta.total);
          setPelayanBaru(result.meta.pelayan_baru ?? 0);
          setTotalRole(result.meta.total_role ?? 0);
        }
      } catch (err) {
        console.error('[Pelayan] fetch error:', err);
      } finally {
        hideLoader();
      }
    };
    fetchData();
  }, [currentPage, debouncedSearch, filterSatelit, filterRole, filterStatus, filterDateFrom, filterDateTo]);

  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  // Toggle status
  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Aktif' ? 'Tidak Aktif' : 'Aktif';
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res = await fetch(`/api/pelayan/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_pelayan: newStatus }),
      });
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: `Pelayan berhasil di${newStatus === 'Aktif' ? 'aktifkan' : 'nonaktifkan'}` });
        setData(prev => prev.map(p => p.id === id ? { ...p, status_pelayan: newStatus } : p));
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal mengubah status' });
      }
    } catch {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan jaringan' });
    }
  };

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  const hasActiveFilters = filterSatelit || filterRole || (filterStatus && filterStatus !== 'Aktif') || filterDateFrom || filterDateTo;

  return (
    <div className="flex flex-col gap-6 w-full">
      <SubmitOverlay
        status={submitState.status}
        message={submitState.message}
        onClose={() => setSubmitState({ status: 'idle', message: '' })}
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <span className="material-icons-round text-violet-600 text-[24px]">volunteer_activism</span>
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium font-['Public_Sans'] uppercase tracking-wider">Total Pelayan Aktif</div>
            <div className="text-3xl font-bold text-slate-800 font-['Inter']">{totalItems}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <span className="material-icons-round text-emerald-600 text-[24px]">person_add</span>
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium font-['Public_Sans'] uppercase tracking-wider">Pelayan Baru Bulan Ini</div>
            <div className="text-3xl font-bold text-slate-800 font-['Inter']">{pelayanBaru}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="material-icons-round text-amber-600 text-[24px]">star_border</span>
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium font-['Public_Sans'] uppercase tracking-wider">Role Pelayanan Aktif</div>
            <div className="text-3xl font-bold text-slate-800 font-['Inter']">{totalRole}</div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-slate-400 text-[20px]">search</span>
            <input
              type="text"
              placeholder="Cari nama, ID jemaat, atau ID pelayanan..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white font-['Public_Sans'] text-slate-700"
            />
          </div>

          {/* Satelit filter */}
          <select
            value={filterSatelit}
            onChange={e => setFilterSatelit(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white font-['Public_Sans'] text-slate-700"
          >
            <option value="">Semua Satelit</option>
            {satelitOptions.map(s => (
              <option key={s.id} value={s.id}>{s.nama_satelit}</option>
            ))}
          </select>

          {/* Role filter */}
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white font-['Public_Sans'] text-slate-700"
          >
            <option value="">Semua Role</option>
            {rolePelayanOptions.map(r => (
              <option key={r.id} value={r.id}>{r.nama_role}</option>
            ))}
          </select>

          {/* More Filters Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium font-['Public_Sans'] transition-colors ${showAdvanced ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            <span className="material-icons-round text-[18px]">tune</span>
            More Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-violet-500 ml-1" />}
          </button>
        </div>

        {/* Advanced Filter Panel */}
        {showAdvanced && (
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-xs text-slate-500 font-semibold font-['Public_Sans'] uppercase tracking-wider">Status Pelayan</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white font-['Public_Sans'] focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="Semua">Semua</option>
                <option value="Aktif">Aktif</option>
                <option value="Tidak Aktif">Tidak Aktif</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-xs text-slate-500 font-semibold font-['Public_Sans'] uppercase tracking-wider">Tanggal Mulai (dari)</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white font-['Public_Sans'] focus:outline-none focus:ring-2 focus:ring-slate-300" />
            </div>
            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-xs text-slate-500 font-semibold font-['Public_Sans'] uppercase tracking-wider">Tanggal Mulai (sampai)</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white font-['Public_Sans'] focus:outline-none focus:ring-2 focus:ring-slate-300" />
            </div>
            {hasActiveFilters && (
              <div className="flex flex-col gap-1 justify-end">
                <label className="text-xs opacity-0">Reset</label>
                <button
                  onClick={() => { setFilterSatelit(''); setFilterRole(''); setFilterStatus('Aktif'); setFilterDateFrom(''); setFilterDateTo(''); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-rose-200 text-sm text-rose-600 bg-rose-50 hover:bg-rose-100 font-['Public_Sans'] transition-colors"
                >
                  <span className="material-icons-round text-[18px]">filter_alt_off</span>
                  Reset Filter
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[1100px] flex flex-col">
            {/* Header */}
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
              <div className="w-32 shrink-0 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">ID Pelayanan</div>
              <div className="w-28 shrink-0 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">ID Jemaat</div>
              <div className="w-56 shrink-0 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Nama Lengkap</div>
              <div className="w-40 shrink-0 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Satelit</div>
              <div className="flex-1 min-w-[180px] text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Role Pelayanan</div>
              <div className="w-28 shrink-0 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Mulai</div>
              <div className="w-28 shrink-0 text-center text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Status</div>
              <div className="w-16 shrink-0 text-right text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Aksi</div>
            </div>

            {/* Body */}
            {data.length === 0 ? (
              <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
                <span className="material-icons-round text-5xl mb-2 text-slate-300">volunteer_activism</span>
                <span className="text-sm font-['Public_Sans']">Tidak ada data pelayan yang ditemukan.</span>
              </div>
            ) : (
              data.map((pelayan, idx) => {
                const isLastRows = data.length > 2 && idx >= data.length - 2;
                const roles: string[] = pelayan.roles ? pelayan.roles.split(' • ').filter(Boolean) : [];
                return (
                  <div
                    key={pelayan.id || idx}
                    className={`w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors relative ${openMenuId === pelayan.id ? 'z-50' : 'z-10'}`}
                  >
                    <div className="w-32 shrink-0 text-slate-500 text-sm font-['Liberation_Mono']">{pelayan.id_pelayanan}</div>
                    <div className="w-28 shrink-0 text-slate-500 text-sm font-['Liberation_Mono']">{pelayan.jemaat_nomor || '-'}</div>
                    <div className="w-56 shrink-0 flex items-center gap-3">
                      <img
                        className="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0"
                        src={pelayan.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(pelayan.nama_lengkap)}&background=random`}
                        alt="avatar"
                      />
                      <span className="text-slate-900 text-sm font-semibold font-['Public_Sans'] truncate pr-2">{pelayan.nama_lengkap}</span>
                    </div>
                    <div className="w-40 shrink-0 text-slate-600 text-sm font-['Public_Sans'] truncate pr-2">{pelayan.nama_satelit || '-'}</div>
                    <div className="flex-1 min-w-[180px] flex flex-wrap gap-1 items-center py-1">
                      {roles.length > 0 ? (
                        <>
                          {roles.slice(0, 2).map((r, i) => (
                            <span key={i} className="px-2 py-0.5 bg-violet-100 border border-violet-200 rounded text-violet-700 text-[10px] font-bold font-['Public_Sans'] uppercase whitespace-nowrap">
                              {r}
                            </span>
                          ))}
                          {roles.length > 2 && (
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 text-[10px] font-bold font-['Public_Sans'] whitespace-nowrap">
                              +{roles.length - 2} lagi
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 text-xs italic font-['Public_Sans']">Belum ada role</span>
                      )}
                    </div>
                    <div className="w-28 shrink-0 text-slate-500 text-sm font-['Public_Sans']">{formatDate(pelayan.tanggal_mulai)}</div>
                    <div className="w-28 shrink-0 flex justify-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold font-['Public_Sans'] uppercase ${pelayan.status_pelayan === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {pelayan.status_pelayan}
                      </span>
                    </div>
                    {/* Action Menu */}
                    <div className="w-16 shrink-0 flex justify-end text-slate-400 relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === pelayan.id ? null : pelayan.id)}
                        className="hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded transition-colors"
                      >
                        <span className="material-icons-round text-[24px]">more_horiz</span>
                      </button>
                      {openMenuId === pelayan.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                          <div className={`absolute right-0 ${isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'} w-52 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-slate-200 z-50 py-1`}>
                            <Link
                              href={`/dashboard/pelayan/${pelayan.id}?mode=view`}
                              className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-['Public_Sans']"
                            >
                              <span className="material-icons-round text-[18px] text-slate-400">visibility</span>
                              Lihat Detail
                            </Link>
                            <Link
                              href={`/dashboard/pelayan/${pelayan.id}?mode=edit`}
                              className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-['Public_Sans']"
                            >
                              <span className="material-icons-round text-[18px] text-slate-400">edit</span>
                              Edit Pelayan
                            </Link>
                            <div className="w-full h-px bg-slate-100 my-1" />
                            <button
                              onClick={() => { setOpenMenuId(null); handleToggleStatus(pelayan.id, pelayan.status_pelayan); }}
                              className={`w-full text-left px-4 py-2 transition-colors flex items-center gap-3 text-sm font-['Public_Sans'] ${pelayan.status_pelayan === 'Aktif' ? 'hover:bg-amber-50 hover:text-amber-700 text-amber-600' : 'hover:bg-emerald-50 hover:text-emerald-700 text-emerald-600'}`}
                            >
                              <span className={`material-icons-round text-[18px] ${pelayan.status_pelayan === 'Aktif' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {pelayan.status_pelayan === 'Aktif' ? 'person_off' : 'person_add'}
                              </span>
                              {pelayan.status_pelayan === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <div className="w-full h-px bg-slate-100 my-1" />
                            <Link
                              href={`/dashboard/settings/audit-log?log_type=pelayan&entity_id=${pelayan.id}`}
                              className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-['Public_Sans']"
                            >
                              <span className="material-icons-round text-[18px] text-slate-400">history_edu</span>
                              Lihat Audit Log
                            </Link>
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

        {/* Pagination Footer */}
        <div className="w-full px-6 py-4 bg-white border-t border-slate-200 flex flex-col md:flex-row justify-between items-center text-sm gap-4">
          <span className="text-slate-500 font-['Public_Sans']">
            Menampilkan {data.length > 0 ? ((currentPage - 1) * limit) + 1 : 0}–
            {Math.min(currentPage * limit, totalItems)} dari {totalItems} pelayan
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-9 h-9 rounded-lg border border-slate-200 flex justify-center items-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors disabled:opacity-50"
            >
              <span className="material-icons-round text-[20px]">chevron_left</span>
            </button>
            <span className="text-slate-600 font-['Public_Sans'] text-sm px-2">Halaman {currentPage} dari {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="w-9 h-9 rounded-lg border border-slate-200 flex justify-center items-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors disabled:opacity-50"
            >
              <span className="material-icons-round text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
