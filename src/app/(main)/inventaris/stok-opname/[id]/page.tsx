'use client';

import { useState, useEffect, use } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

export default function StokOpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  const [userData, setUserData] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });

  // State inline edit per baris
  const [editingDetailId, setEditingDetailId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ jumlah_fisik: '', kondisi_fisik: '', keterangan: '' });

  // Ambil data awal + session detail
  useEffect(() => {
    const fetchAll = async () => {
      showLoader();
      try {
        const [resUser, resData] = await Promise.all([
          fetch('/api/auth/me'),
          fetch(`/api/inventaris/stok-opname/${id}`)
        ]);
        const authData = resUser.ok ? await resUser.json() : null;
        const sessionData = await resData.json();

        if (authData) setUserData(authData);
        if (sessionData.success) setData(sessionData.data);
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        hideLoader();
      }
    };
    fetchAll();
  }, [id]); // TRIGGER: id

  const hasPermission = (perm: string) => {
    if (!userData) return false;
    if (userData.is_super_admin) return true;
    return userData.permissions?.includes?.(perm);
  };

  const canEdit = hasPermission('inventaris_stok_opname');

  const refreshData = async () => {
    const res = await fetch(`/api/inventaris/stok-opname/${id}`);
    const result = await res.json();
    if (result.success) setData(result.data);
  };

  const handleAction = async (action: string, extra: Record<string, any> = {}) => {
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res = await fetch(`/api/inventaris/stok-opname/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra })
      });
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: result.message });
        await refreshData();
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal' });
      }
    } catch {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan jaringan' });
    }
  };

  const handleSaveDetail = async (detailId: number) => {
    if (editForm.jumlah_fisik === '') {
      setSubmitState({ status: 'error', message: 'Jumlah fisik wajib diisi' });
      return;
    }
    await handleAction('update_detail', {
      detail_id: detailId,
      jumlah_fisik: parseInt(editForm.jumlah_fisik, 10),
      kondisi_fisik: editForm.kondisi_fisik || undefined,
      keterangan: editForm.keterangan || undefined,
    });
    setEditingDetailId(null);
  };

  if (!data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-slate-400">
          <span className="material-icons-round text-4xl">assignment</span>
          <p className="mt-2">Memuat data...</p>
        </div>
      </div>
    );
  }

  const totalItems = data.detail?.length || 0;
  const itemsChecked = data.detail?.filter((d: any) => d.jumlah_fisik !== null).length || 0;
  const progress = totalItems > 0 ? Math.round((itemsChecked / totalItems) * 100) : 0;

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      'Draft': 'bg-slate-100 text-slate-600',
      'Berjalan': 'bg-blue-100 text-blue-700',
      'Selesai': 'bg-green-100 text-green-700',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  };

  const kondisiOptions = ['Baik', 'Rusak Ringan', 'Rusak Berat', 'Tidak Ditemukan'];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {submitState.status === 'loading' && <SubmitOverlay status="loading" message="Menyimpan..." />}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
            <Link href="/inventaris/stok-opname" className="hover:text-slate-600 transition-colors">Stok Opname</Link>
            <span className="material-icons-round text-[14px]">chevron_right</span>
            <span className="text-slate-600">{data.judul}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 font-sans">{data.judul}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(data.status)}`}>
              {data.status}
            </span>
            <span className="text-sm text-slate-500">{data.nama_satelit}</span>
            {data.periode && <span className="text-sm text-slate-500">• {data.periode}</span>}
          </div>
        </div>

        {/* Tombol aksi sesuai status */}
        {canEdit && (
          <div className="flex gap-2">
            {data.status === 'Draft' && (
              <button
                onClick={() => handleAction('start')}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors"
              >
                <span className="material-icons-round text-[18px]">play_arrow</span>
                Mulai Opname
              </button>
            )}
            {data.status === 'Berjalan' && (
              <button
                onClick={() => handleAction('verify')}
                disabled={itemsChecked < totalItems}
                title={itemsChecked < totalItems ? 'Selesaikan semua item dulu' : ''}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-icons-round text-[18px]">verified</span>
                Selesaikan & Verifikasi
              </button>
            )}
          </div>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Total Barang</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{totalItems}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Sudah Dicek</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{itemsChecked}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Belum Dicek</p>
          <p className="text-2xl font-bold text-slate-500 mt-1">{totalItems - itemsChecked}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Progress</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm font-bold text-slate-700">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Pesan sukses/error */}
      {submitState.status === 'success' && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <span className="material-icons-round text-[18px]">check_circle</span>
          {submitState.message}
        </div>
      )}
      {submitState.status === 'error' && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
          <span className="material-icons-round text-[18px]">error</span>
          {submitState.message}
        </div>
      )}

      {/* Tabel detail items */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">Daftar Barang</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kode</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Barang</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kategori</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Jml Sistem</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Jml Fisik</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Selisih</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kondisi</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data.detail || []).map((item: any) => {
                const isEditing = editingDetailId === item.id;
                const hasData = item.jumlah_fisik !== null;
                const selisih = hasData ? (item.jumlah_fisik - item.jumlah_tercatat) : null;

                return (
                  <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${hasData ? '' : 'bg-amber-50/30'}`}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.kode_barang}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.nama_barang}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{item.nama_kategori}</td>
                    <td className="px-4 py-3 text-center text-slate-700 font-medium">{item.jumlah_tercatat}</td>

                    {isEditing ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            value={editForm.jumlah_fisik}
                            onChange={(e) => setEditForm(prev => ({ ...prev, jumlah_fisik: e.target.value }))}
                            className="w-20 px-2 py-1.5 border border-blue-300 rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            autoFocus
                          />
                        </td>
                        <td className="px-4 py-2 text-center text-slate-400 text-xs">–</td>
                        <td className="px-4 py-2">
                          <select
                            value={editForm.kondisi_fisik}
                            onChange={(e) => setEditForm(prev => ({ ...prev, kondisi_fisik: e.target.value }))}
                            className="px-2 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          >
                            <option value="">Pilih kondisi</option>
                            {kondisiOptions.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveDetail(item.id)}
                              className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                              title="Simpan"
                            >
                              <span className="material-icons-round text-[16px]">check</span>
                            </button>
                            <button
                              onClick={() => setEditingDetailId(null)}
                              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100"
                              title="Batal"
                            >
                              <span className="material-icons-round text-[16px]">close</span>
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-center">
                          {hasData ? (
                            <span className="font-bold text-slate-800">{item.jumlah_fisik}</span>
                          ) : (
                            <span className="text-slate-300 text-xs">–</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {selisih !== null ? (
                            <span className={`font-semibold text-sm ${selisih < 0 ? 'text-red-600' : selisih > 0 ? 'text-green-600' : 'text-slate-500'}`}>
                              {selisih > 0 ? '+' : ''}{selisih}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">–</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.kondisi_fisik ? (
                            <span className="text-xs text-slate-600">{item.kondisi_fisik}</span>
                          ) : (
                            <span className="text-slate-300 text-xs">–</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {canEdit && data.status === 'Berjalan' && (
                            <button
                              onClick={() => {
                                setEditingDetailId(item.id);
                                setEditForm({
                                  jumlah_fisik: item.jumlah_fisik !== null ? String(item.jumlah_fisik) : '',
                                  kondisi_fisik: item.kondisi_fisik || '',
                                  keterangan: item.keterangan || '',
                                });
                                setSubmitState({ status: 'idle', message: '' });
                              }}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 rounded-lg px-2.5 py-1 hover:border-blue-300 transition-colors"
                            >
                              <span className="material-icons-round text-[14px]">edit</span>
                              {hasData ? 'Edit' : 'Input'}
                            </button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info footer */}
      <div className="mt-4 text-xs text-slate-400 flex flex-wrap gap-4">
        {data.created_by_name && <span>Dibuat oleh: <strong>{data.created_by_name}</strong></span>}
        {data.verified_by_name && <span>Diverifikasi oleh: <strong>{data.verified_by_name}</strong></span>}
        {data.tanggal && (
          <span>Tanggal: <strong>{new Date(data.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
        )}
      </div>
    </div>
  );
}
