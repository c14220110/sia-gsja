'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AlertModal } from '@/components/ui/AlertModal';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

export default function TimPelayanPage() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [filterSatelit, setFilterSatelit] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // State modal buat tim baru
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ nama_tim: '', deskripsi: '', satelit_id: '' });
  const [submitState, setSubmitState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });

  // State hapus
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteState, setDeleteState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });

  const isAdmin = userData?.is_super_admin || userData?.permissions?.includes('pelayan_manage');
  const canViewMultiSatelit = userData?.is_super_admin || userData?.permissions?.includes('multi_satelit_view');

  // Fetch initial data
  useEffect(() => {
    const init = async () => {
      try {
        const [resSatelit, resUser] = await Promise.all([
          fetch('/api/options?type=satelit'),
          fetch('/api/auth/me'),
        ]);
        if (resSatelit.ok) {
          const d = await resSatelit.json();
          if (d.success) setSatelitOptions(d.data);
        }
        if (resUser.ok) {
          const u = await resUser.json();
          setUserData(u);
          if (u.role_name?.toUpperCase().includes('SATELIT')) {
            setFilterSatelit(u.satelit_id?.toString() || '');
            setCreateForm(prev => ({ ...prev, satelit_id: u.satelit_id?.toString() || '' }));
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    init();
  }, []);

  const fetchTim = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSatelit) params.append('satelit_id', filterSatelit);
      const res = await fetch(`/api/pelayan/tim?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [filterSatelit]);

  useEffect(() => { fetchTim(); }, [fetchTim]);

  // Filter lokal
  const filteredData = data.filter(item => {
    const matchSearch = !searchQuery
      || item.nama_tim.toLowerCase().includes(searchQuery.toLowerCase())
      || (item.deskripsi || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = !filterStatus || (filterStatus === 'Aktif' ? item.is_active : !item.is_active);
    return matchSearch && matchStatus;
  });

  const handleCreate = async () => {
    if (!createForm.nama_tim.trim() || !createForm.satelit_id) {
      setSubmitState({ status: 'error', message: 'Nama tim dan satelit wajib diisi.' });
      return;
    }
    setSubmitState({ status: 'loading', message: 'Menyimpan tim...' });
    try {
      const res = await fetch('/api/pelayan/tim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createForm, satelit_id: parseInt(createForm.satelit_id) }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitState({ status: 'success', message: 'Tim berhasil dibuat!' });
        setShowCreateModal(false);
        setCreateForm({ nama_tim: '', deskripsi: '', satelit_id: userData?.satelit_id?.toString() || '' });
        fetchTim();
      } else {
        setSubmitState({ status: 'error', message: json.message || 'Gagal membuat tim.' });
      }
    } catch (e: any) {
      setSubmitState({ status: 'error', message: e.message });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteState({ status: 'loading', message: 'Menghapus tim...' });
    try {
      const res = await fetch(`/api/pelayan/tim/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setData(prev => prev.filter(d => d.id !== deleteTarget.id));
        setDeleteState({ status: 'success', message: 'Tim berhasil dihapus.' });
      } else {
        setDeleteState({ status: 'error', message: json.message || 'Gagal menghapus.' });
      }
    } catch (e: any) {
      setDeleteState({ status: 'error', message: e.message });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Modals & Overlays */}
      <AlertModal
        isOpen={!!deleteTarget}
        title="Hapus Tim Pelayan?"
        message={
          <>
            Anda akan menghapus tim <strong>&quot;{deleteTarget?.nama_tim}&quot;</strong>. Semua anggota tim
            akan dikeluarkan. Tindakan ini{' '}
            <strong className="text-red-600">tidak dapat dibatalkan</strong>.
          </>
        }
        confirmText="Ya, Hapus Tim"
        cancelText="Batal"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <SubmitOverlay
        status={deleteState.status}
        message={deleteState.message}
        onClose={() => setDeleteState({ status: 'idle', message: '' })}
      />
      <SubmitOverlay
        status={submitState.status}
        message={submitState.message}
        onClose={() => setSubmitState({ status: 'idle', message: '' })}
      />

      {/* Modal Buat Tim Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                  <span className="material-icons-round text-violet-600 text-[22px]">group_add</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Buat Tim Baru</h3>
                  <p className="text-xs text-slate-500">Isi informasi dasar tim pelayan</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
              >
                <span className="material-icons-round text-slate-400 text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Nama Tim <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.nama_tim}
                  onChange={e => setCreateForm(p => ({ ...p, nama_tim: e.target.value }))}
                  placeholder="Cth: Tim Pujian Eben Haezer"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-violet-300 focus:outline-none bg-white"
                  autoFocus
                />
              </div>
              {canViewMultiSatelit && (
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                    Satelit <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createForm.satelit_id}
                    onChange={e => setCreateForm(p => ({ ...p, satelit_id: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-violet-300 focus:outline-none bg-white"
                  >
                    <option value="">-- Pilih Satelit --</option>
                    {satelitOptions.map(s => (
                      <option key={s.id} value={s.id}>{s.nama_satelit}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Deskripsi
                </label>
                <textarea
                  value={createForm.deskripsi}
                  onChange={e => setCreateForm(p => ({ ...p, deskripsi: e.target.value }))}
                  placeholder="Cth: Tim pujian ibadah raya setiap minggu"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-violet-300 focus:outline-none bg-white resize-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={handleCreate}
                disabled={!createForm.nama_tim.trim() || !createForm.satelit_id}
                className="px-5 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold text-white transition-colors"
              >
                Buat Tim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        {/* Breadcrumbs */}
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-sans leading-4">
          <Link href="/dashboard" className="text-slate-500 hover:text-violet-600">Dashboard</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <Link href="/pelayan" className="text-slate-500 hover:text-violet-600">Pelayan</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Tim Pelayan</span>
        </div>

        <div className="w-full flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Tim Pelayan</h1>
            <div className="text-slate-500 text-base font-medium font-sans leading-6">
              Kelola pengelompokan pelayan per tim dan peran
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-slate-700 rounded-lg flex justify-start items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none"
            >
              <span className="material-icons-round text-white text-[20px]">group_add</span>
              <span className="text-white text-sm font-bold font-sans leading-5">Buat Tim Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-sm">
        {/* Search */}
        <div className="flex-1 min-w-[260px] relative flex items-center">
          <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
          <input
            type="text"
            placeholder="Cari nama tim atau deskripsi..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm"
          />
        </div>

        {/* Filter Satelit (hanya untuk admin pusat) */}
        {canViewMultiSatelit && (
          <div className="relative min-w-[160px]">
            <select
              value={filterSatelit}
              onChange={e => setFilterSatelit(e.target.value)}
              className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
            >
              <option value="">Semua Satelit</option>
              {satelitOptions.map(s => (
                <option key={s.id} value={s.id.toString()}>{s.nama_satelit}</option>
              ))}
            </select>
            <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
          </div>
        )}

        {/* Filter Status */}
        <div className="relative min-w-[140px]">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="Aktif">Aktif</option>
            <option value="Nonaktif">Nonaktif</option>
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        <div className="ml-auto text-xs font-medium text-slate-400 whitespace-nowrap hidden lg:block">
          {filteredData.length} tim ditemukan
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-violet-600 animate-spin"></div>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="w-full flex flex-col items-center justify-center p-16 bg-white border border-slate-200 rounded-xl text-slate-400">
          <span className="material-icons-round text-5xl opacity-50 mb-4">groups</span>
          <p className="font-semibold text-slate-500">Belum ada tim pelayan</p>
          {isAdmin && (
            <p className="text-sm mt-1">
              Klik &quot;Buat Tim Baru&quot; untuk membuat tim pertama.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredData.map(tim => (
            <div
              key={tim.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              {/* Card Body */}
              <div className="p-5 flex flex-col gap-2 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-violet-600 text-[22px]">groups</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                      tim.is_active
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {tim.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <div className="mt-1">
                  <h3 className="text-slate-900 font-black text-base leading-tight">{tim.nama_tim}</h3>
                  {tim.deskripsi && (
                    <p className="text-slate-500 text-xs mt-1 line-clamp-2">{tim.deskripsi}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="material-icons-round text-slate-400 text-[14px]">location_on</span>
                  <span className="text-slate-500 text-xs">{tim.nama_satelit}</span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-icons-round text-slate-400 text-[16px]">person</span>
                  <span className="text-slate-600 text-sm font-bold">{tim.jumlah_anggota}</span>
                  <span className="text-slate-400 text-xs">anggota</span>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/pelayan/tim/${tim.id}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors flex items-center gap-1"
                  >
                    <span className="material-icons-round text-[14px]">visibility</span>
                    Detail
                  </Link>
                  {isAdmin && (
                    <button
                      onClick={() => setDeleteTarget(tim)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <span className="material-icons-round text-[16px]">delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
