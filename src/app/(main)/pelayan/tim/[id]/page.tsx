'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertModal } from '@/components/ui/AlertModal';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

export default function TimPelayanDetailPage() {
  const { id } = useParams();
  const timId = parseInt(id as string);

  const [tim, setTim] = useState<any>(null);
  const [anggota, setAnggota] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ nama_tim: '', deskripsi: '' });

  // Tambah anggota
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchPelayan, setSearchPelayan] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPelayan, setSelectedPelayan] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [roleOptions, setRoleOptions] = useState<any[]>([]);

  // State feedback
  const [submitState, setSubmitState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });
  const [deleteAnggotaTarget, setDeleteAnggotaTarget] = useState<any>(null);

  const isAdmin = userData?.is_super_admin || userData?.permissions?.includes('pelayan_manage');

  // Load initial data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [resDetail, resRole, resUser] = await Promise.all([
        fetch(`/api/pelayan/tim/${timId}`),
        fetch('/api/options?type=role_pelayan'),
        fetch('/api/auth/me'),
      ]);
      const detail = await resDetail.json();
      if (detail.success) {
        setTim(detail.data);
        setAnggota(detail.data.anggota || []);
        setEditForm({ nama_tim: detail.data.nama_tim, deskripsi: detail.data.deskripsi || '' });
      }
      const roles = await resRole.json();
      if (roles.success) setRoleOptions(roles.data);
      const user = await resUser.json();
      setUserData(user);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [timId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Search pelayan dengan debounce
  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!searchPelayan.trim() || searchPelayan.length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(`/api/pelayan?search=${encodeURIComponent(searchPelayan)}&limit=8&status=Aktif`);
        const json = await res.json();
        if (json.success) {
          const existingIds = new Set(anggota.map((a: any) => a.pelayan_id));
          setSearchResults((json.data || []).filter((p: any) => !existingIds.has(p.id)));
        }
      } catch (e) {
        // silent
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchPelayan, anggota]);

  const handleSaveEdit = async () => {
    if (!editForm.nama_tim.trim()) return;
    setSubmitState({ status: 'loading', message: 'Menyimpan perubahan...' });
    try {
      const res = await fetch(`/api/pelayan/tim/${timId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama_tim: editForm.nama_tim, deskripsi: editForm.deskripsi, is_active: tim.is_active }),
      });
      const json = await res.json();
      if (json.success) {
        setTim((p: any) => ({ ...p, ...editForm }));
        setIsEditing(false);
        setSubmitState({ status: 'success', message: 'Perubahan disimpan!' });
      } else {
        setSubmitState({ status: 'error', message: json.message });
      }
    } catch (e: any) {
      setSubmitState({ status: 'error', message: e.message });
    }
  };

  const handleToggleAktif = async () => {
    const newStatus = !tim.is_active;
    setSubmitState({ status: 'loading', message: newStatus ? 'Mengaktifkan tim...' : 'Menonaktifkan tim...' });
    try {
      const res = await fetch(`/api/pelayan/tim/${timId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama_tim: tim.nama_tim, deskripsi: tim.deskripsi, is_active: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setTim((p: any) => ({ ...p, is_active: newStatus }));
        setSubmitState({ status: 'success', message: newStatus ? 'Tim diaktifkan.' : 'Tim dinonaktifkan.' });
      }
    } catch (e: any) {
      setSubmitState({ status: 'error', message: e.message });
    }
  };

  const handleAddAnggota = async () => {
    if (!selectedPelayan || !selectedRole) return;
    setSubmitState({ status: 'loading', message: 'Menambahkan anggota...' });
    try {
      const newAnggota = [
        ...anggota,
        { pelayan_id: selectedPelayan.id, role_pelayan_id: parseInt(selectedRole) },
      ];
      const res = await fetch(`/api/pelayan/tim/${timId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_tim: tim.nama_tim,
          deskripsi: tim.deskripsi,
          is_active: tim.is_active,
          anggota: newAnggota.map(a => ({ pelayan_id: a.pelayan_id, role_pelayan_id: a.role_pelayan_id })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitState({ status: 'success', message: 'Anggota ditambahkan!' });
        setShowAddModal(false);
        setSelectedPelayan(null);
        setSelectedRole('');
        setSearchPelayan('');
        fetchData();
      } else {
        setSubmitState({ status: 'error', message: json.message });
      }
    } catch (e: any) {
      setSubmitState({ status: 'error', message: e.message });
    }
  };

  const handleRemoveAnggota = async () => {
    if (!deleteAnggotaTarget) return;
    const newAnggota = anggota.filter((a: any) => a.id !== deleteAnggotaTarget.id);
    setSubmitState({ status: 'loading', message: 'Menghapus anggota...' });
    try {
      const res = await fetch(`/api/pelayan/tim/${timId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_tim: tim.nama_tim,
          deskripsi: tim.deskripsi,
          is_active: tim.is_active,
          anggota: newAnggota.map((a: any) => ({ pelayan_id: a.pelayan_id, role_pelayan_id: a.role_pelayan_id })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAnggota(newAnggota);
        setSubmitState({ status: 'success', message: 'Anggota dihapus dari tim.' });
      } else {
        setSubmitState({ status: 'error', message: json.message });
      }
    } catch (e: any) {
      setSubmitState({ status: 'error', message: e.message });
    } finally {
      setDeleteAnggotaTarget(null);
    }
  };

  // ── Loading State ───────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-violet-600 animate-spin"></div>
      </div>
    );
  }

  // ── Not Found State ─────────────────────────────────────────
  if (!tim) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-slate-400">
        <span className="material-icons-round text-5xl mb-4">error_outline</span>
        <p className="font-semibold text-slate-500">Tim tidak ditemukan.</p>
        <Link href="/pelayan/tim" className="mt-4 text-violet-600 hover:underline text-sm">
          Kembali ke Tim Pelayan
        </Link>
      </div>
    );
  }

  // ── Main Render ─────────────────────────────────────────────
  return (
    <div className="w-full flex flex-col gap-6">
      {/* Modals & Overlays */}
      <AlertModal
        isOpen={!!deleteAnggotaTarget}
        title="Hapus Anggota dari Tim?"
        message={
          <>
            Anda akan mengeluarkan{' '}
            <strong>&quot;{deleteAnggotaTarget?.nama_lengkap}&quot;</strong> dari tim ini.
          </>
        }
        confirmText="Ya, Keluarkan"
        cancelText="Batal"
        onConfirm={handleRemoveAnggota}
        onCancel={() => setDeleteAnggotaTarget(null)}
      />
      <SubmitOverlay
        status={submitState.status}
        message={submitState.message}
        onClose={() => setSubmitState({ status: 'idle', message: '' })}
      />

      {/* Modal Tambah Anggota */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                  <span className="material-icons-round text-violet-600 text-[22px]">person_add</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Tambah Anggota</h3>
                  <p className="text-xs text-slate-500">Cari pelayan dan tentukan perannya di tim ini</p>
                </div>
              </div>
              <button
                onClick={() => { setShowAddModal(false); setSelectedPelayan(null); setSearchPelayan(''); }}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
              >
                <span className="material-icons-round text-slate-400 text-[20px]">close</span>
              </button>
            </div>

            {/* Search Pelayan */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Cari Pelayan <span className="text-red-500">*</span>
              </label>
              {selectedPelayan ? (
                <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-lg border border-violet-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedPelayan.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedPelayan.nama_lengkap)}&background=random`}
                    className="w-9 h-9 rounded-full object-cover border border-slate-200"
                    alt={selectedPelayan.nama_lengkap}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 font-bold text-sm truncate">{selectedPelayan.nama_lengkap}</p>
                    <p className="text-violet-600 text-xs">{selectedPelayan.id_pelayanan}</p>
                  </div>
                  <button onClick={() => setSelectedPelayan(null)} className="text-slate-400 hover:text-red-500">
                    <span className="material-icons-round text-[18px]">close</span>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <span className="material-icons-round absolute left-3 top-2.5 text-slate-400 text-[18px]">search</span>
                  <input
                    type="text"
                    value={searchPelayan}
                    onChange={e => setSearchPelayan(e.target.value)}
                    placeholder="Ketik nama pelayan..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-violet-300 focus:outline-none bg-white"
                    autoFocus
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-2.5">
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-violet-500 rounded-full animate-spin"></div>
                    </div>
                  )}
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-10 max-h-52 overflow-y-auto">
                      {searchResults.map((p: any) => (
                        <button
                          key={p.id}
                          onClick={() => { setSelectedPelayan(p); setSearchPelayan(''); setSearchResults([]); }}
                          className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.nama_lengkap)}&background=random`}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                            alt={p.nama_lengkap}
                          />
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{p.nama_lengkap}</p>
                            <p className="text-xs text-slate-500">{p.id_pelayanan} &bull; {p.nama_satelit}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pilih Role */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Peran / Role <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-violet-300 focus:outline-none bg-white"
              >
                <option value="">-- Pilih Role --</option>
                {roleOptions.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.nama_role}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => { setShowAddModal(false); setSelectedPelayan(null); setSearchPelayan(''); }}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={handleAddAnggota}
                disabled={!selectedPelayan || !selectedRole}
                className="px-5 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold text-white transition-colors"
              >
                Tambahkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-sans leading-4">
        <Link href="/dashboard" className="text-slate-500 hover:text-violet-600">Dashboard</Link>
        <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
        <Link href="/pelayan" className="text-slate-500 hover:text-violet-600">Pelayan</Link>
        <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
        <Link href="/pelayan/tim" className="text-slate-500 hover:text-violet-600">Tim Pelayan</Link>
        <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
        <span className="text-slate-700 font-bold truncate max-w-[200px]">{tim.nama_tim}</span>
      </div>

      {/* Tim Header Card */}
      <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center shrink-0">
              <span className="material-icons-round text-violet-600 text-[28px]">groups</span>
            </div>
            <div className="flex flex-col gap-1">
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={editForm.nama_tim}
                    onChange={e => setEditForm(p => ({ ...p, nama_tim: e.target.value }))}
                    className="text-2xl font-black text-slate-900 bg-white border-b-2 border-violet-400 focus:outline-none focus:border-violet-600 w-full min-w-[280px]"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editForm.deskripsi}
                    onChange={e => setEditForm(p => ({ ...p, deskripsi: e.target.value }))}
                    placeholder="Deskripsi tim..."
                    className="text-sm text-slate-500 bg-white border-b border-slate-300 focus:outline-none focus:border-violet-400 w-full"
                  />
                </div>
              ) : (
                <>
                  <h1 className="text-slate-900 text-2xl font-black font-sans leading-tight">{tim.nama_tim}</h1>
                  {tim.deskripsi && <p className="text-slate-500 text-sm">{tim.deskripsi}</p>}
                </>
              )}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="material-icons-round text-slate-400 text-[14px]">location_on</span>
                  <span className="text-slate-500 text-xs">{tim.nama_satelit}</span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                    tim.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tim.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="material-icons-round text-slate-400 text-[14px]">person</span>
                  <span className="text-slate-500 text-xs">{anggota.length} anggota</span>
                </div>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editForm.nama_tim.trim()}
                    className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold text-white transition-colors"
                  >
                    Simpan
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleToggleAktif}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      tim.is_active
                        ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                        : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="material-icons-round text-[16px]">
                        {tim.is_active ? 'pause_circle' : 'play_circle'}
                      </span>
                      {tim.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </span>
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
                  >
                    <span className="material-icons-round text-[16px]">edit</span>
                    Edit
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Anggota Tim Section */}
      <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm">
        {/* Section Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="material-icons-round text-slate-600 text-[20px]">group</span>
            <h2 className="text-slate-900 font-black text-base font-sans">Daftar Anggota Tim</h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">{anggota.length}</span>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-slate-700 rounded-lg flex items-center gap-1.5 hover:bg-slate-800 transition-colors text-sm font-bold text-white shadow-sm"
            >
              <span className="material-icons-round text-[16px]">person_add</span>
              Tambah Anggota
            </button>
          )}
        </div>

        {/* Anggota List */}
        {anggota.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-400">
            <span className="material-icons-round text-4xl opacity-50 mb-3">group_off</span>
            <p className="font-semibold text-slate-500 text-sm">Belum ada anggota di tim ini</p>
            {isAdmin && (
              <p className="text-xs mt-1">
                Klik &quot;Tambah Anggota&quot; untuk menambahkan pelayan.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {anggota.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.nama_lengkap)}&background=random`}
                    alt={a.nama_lengkap}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                  <div className="flex flex-col">
                    <span className="text-slate-900 font-bold text-sm">{a.nama_lengkap}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-slate-400 text-xs">{a.id_pelayanan}</span>
                      <span className="text-slate-300 text-xs">•</span>
                      <span className="text-slate-400 text-xs">{a.nama_satelit}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 text-[11px] font-bold border border-violet-100">
                    {a.nama_role}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => setDeleteAnggotaTarget(a)}
                      className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Keluarkan dari tim"
                    >
                      <span className="material-icons-round text-[16px]">person_remove</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
