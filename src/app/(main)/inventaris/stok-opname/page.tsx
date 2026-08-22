'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

export default function StokOpnamePage() {
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);

  const [data, setData] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  const [filterSatelit, setFilterSatelit] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });

  // State untuk modal buat opname baru
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ judul: '', tanggal: new Date().toISOString().split('T')[0], periode: '', catatan: '', satelit_id: '' });

  // Ambil data awal + user
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
            setFormData(prev => ({ ...prev, satelit_id: authData.satelit_id?.toString() || '' }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial data', error);
      } finally {
        hideLoader();
      }
    };
    fetchOptionsAndUser();
  }, []); // TRIGGER KOSONG

  const hasPermission = (perm: string) => {
    if (!userData) return false;
    if (userData.is_super_admin) return true;
    return userData.permissions?.includes?.(perm);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset ke halaman 1 saat filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterSatelit, filterStatus]);

  // Fetch data utama
  useEffect(() => {
    const fetchData = async () => {
      showLoader();
      try {
        const queryParams = new URLSearchParams();
        if (filterSatelit) queryParams.append('satelit_id', filterSatelit);
        if (filterStatus) queryParams.append('status', filterStatus);
        queryParams.append('limit', limit.toString());
        queryParams.append('offset', ((currentPage - 1) * limit).toString());

        const res = await fetch(`/api/inventaris/stok-opname?${queryParams.toString()}`);
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
  }, [debouncedSearch, filterSatelit, filterStatus, currentPage]);

  const handleCreateStokOpname = async () => {
    if (!formData.judul || !formData.tanggal) {
      setSubmitState({ status: 'error', message: 'Judul dan tanggal wajib diisi' });
      return;
    }
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res = await fetch('/api/inventaris/stok-opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: result.message });
        setShowModal(false);
        setFormData({ judul: '', tanggal: new Date().toISOString().split('T')[0], periode: '', catatan: '', satelit_id: userData?.satelit_id?.toString() || '' });
        // Navigate ke detail session yang baru dibuat
        router.push(`/inventaris/stok-opname/${result.data.id}`);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal membuat sesi' });
      }
    } catch {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan jaringan' });
    }
  };

  const isSatelitRole = userData?.role_name?.toUpperCase().includes('SATELIT');
  const totalPages = Math.ceil(totalItems / limit);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      'Draft': 'bg-slate-100 text-slate-600',
      'Berjalan': 'bg-blue-100 text-blue-700',
      'Selesai': 'bg-green-100 text-green-700',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {submitState.status === 'loading' && <SubmitOverlay status="loading" message="Menyimpan..." />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-sans">Stok Opname</h1>
          <p className="text-slate-500 text-sm mt-1">Penghitungan fisik dan rekonsiliasi aset</p>
        </div>
        {hasPermission('inventaris_stok_opname') && (
          <button
            onClick={() => { setShowModal(true); setSubmitState({ status: 'idle', message: '' }); }}
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-slate-700 transition-colors"
          >
            <span className="material-icons-round text-[18px]">add</span>
            Buat Opname Baru
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
          <input
            type="text"
            placeholder="Cari berdasarkan judul..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 text-sm"
          />
        </div>

        {!isSatelitRole && (
          <div className="relative min-w-[180px]">
            <select
              value={filterSatelit}
              onChange={(e) => { setFilterSatelit(e.target.value); setCurrentPage(1); }}
              className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 text-sm cursor-pointer"
            >
              <option value="">Semua Satelit</option>
              {satelitOptions.map((s: any) => (
                <option key={s.id} value={s.id}>{s.nama_satelit}</option>
              ))}
            </select>
            <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">expand_more</span>
          </div>
        )}

        <div className="relative min-w-[160px]">
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 text-sm cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="Draft">Draft</option>
            <option value="Berjalan">Berjalan</option>
            <option value="Selesai">Selesai</option>
          </select>
          <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">expand_more</span>
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Judul</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Satelit</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tanggal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dibuat Oleh</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    <span className="material-icons-round text-4xl mb-2 block">assignment</span>
                    <p>Belum ada sesi stok opname</p>
                  </td>
                </tr>
              ) : data.map((item: any) => {
                const progress = item.total_items > 0
                  ? Math.round((parseInt(item.items_checked) / parseInt(item.total_items)) * 100)
                  : 0;
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 text-sm">{item.judul}</p>
                      {item.periode && <p className="text-xs text-slate-400">{item.periode}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.nama_satelit}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-1.5 min-w-[60px]">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          {item.items_checked}/{item.total_items}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.created_by_name || '-'}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/inventaris/stok-opname/${item.id}`}
                        className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium border border-slate-200 rounded-lg px-3 py-1.5 hover:border-slate-300 transition-colors"
                      >
                        <span className="material-icons-round text-[14px]">open_in_new</span>
                        Detail
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
          <span>Menampilkan {totalItems === 0 ? 0 : (currentPage - 1) * limit + 1}–{Math.min(currentPage * limit, totalItems)} dari {totalItems} sesi</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-icons-round text-[18px]">chevron_left</span>
            </button>
            <span className="font-medium text-slate-700">Halaman {currentPage} dari {Math.max(1, totalPages)}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-icons-round text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Buat Opname Baru */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">Buat Sesi Stok Opname</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <span className="material-icons-round text-slate-500">close</span>
              </button>
            </div>

            <div className="space-y-4">
              {!isSatelitRole && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Satelit <span className="text-red-500">*</span></label>
                  <select
                    value={formData.satelit_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, satelit_id: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="">Pilih Satelit</option>
                    {satelitOptions.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.nama_satelit}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Judul <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formData.judul}
                  onChange={(e) => setFormData(prev => ({ ...prev, judul: e.target.value }))}
                  placeholder="cth: Stok Opname Q1 2026"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={formData.tanggal}
                  onChange={(e) => setFormData(prev => ({ ...prev, tanggal: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Periode</label>
                <input
                  type="text"
                  value={formData.periode}
                  onChange={(e) => setFormData(prev => ({ ...prev, periode: e.target.value }))}
                  placeholder="cth: Q1 2026 / Januari–Maret 2026"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                <textarea
                  value={formData.catatan}
                  onChange={(e) => setFormData(prev => ({ ...prev, catatan: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                />
              </div>

              {submitState.status === 'error' && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{submitState.message}</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleCreateStokOpname}
                disabled={submitState.status === 'loading'}
                className="flex-1 px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-60"
              >
                {submitState.status === 'loading' ? 'Menyimpan...' : 'Buat Sesi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
