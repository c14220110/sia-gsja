'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';

interface Kategori { id: number; kode: string; nama: string; keterangan: string | null; is_active: boolean; }
interface Sublokasi { id: number; satelit_id: number; nama_satelit: string; kode: string; nama: string; is_active: boolean; }
interface SatelitOption { id: number; nama_satelit: string; }

const KATEGORI_ICONS: Record<string, string> = {
  '01': 'landscape', '02': 'park', '03': 'church',
  '04': 'directions_car', '05': 'speaker', '06': 'piano',
  '07': 'volunteer_activism', '08': 'electrical_services', '09': 'computer',
  '10': 'table_bar', '11': 'chair', '12': 'kitchen',
};

export default function MasterDataInventarisPage() {
  const { showLoader, hideLoader } = useLoader();

  const [userData, setUserData] = useState<any>(null);
  const isSuperAdmin = userData?.is_super_admin === true;

  const [kategoriList, setKategoriList] = useState<Kategori[]>([]);
  const [sublokasiList, setSublokasiList] = useState<Sublokasi[]>([]);
  const [satelitOptions, setSatelitOptions] = useState<SatelitOption[]>([]);

  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error'; message: string }>({ status: 'idle', message: '' });
  const [activeTab, setActiveTab] = useState<'kategori'|'sublokasi'>('kategori');
  const [filterSatelit, setFilterSatelit] = useState('');

  // Inline edit kategori
  const [editingKategoriId, setEditingKategoriId] = useState<number | null>(null);
  const [editKeterangan, setEditKeterangan] = useState('');

  // Modal sublokasi
  const [showSublokasiModal, setShowSublokasiModal] = useState(false);
  const [editingSublokasiId, setEditingSublokasiId] = useState<number | null>(null);
  const [subForm, setSubForm] = useState({ satelit_id: '', kode: '', nama: '' });

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; nama: string } | null>(null);

  // ── Fetch all ────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      showLoader();
      try {
        const [resUser, resSatelit, resKat, resSub] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/options?type=satelit'),
          fetch('/api/inventaris/master?type=kategori&all=true'),
          fetch('/api/inventaris/master?type=sublokasi&all=true'),
        ]);
        const user = resUser.ok ? await resUser.json() : null;
        const satData = await resSatelit.json();
        const katData = await resKat.json();
        const subData = await resSub.json();

        if (user) setUserData(user);
        if (satData.success) setSatelitOptions(satData.data);
        if (katData.success) setKategoriList(katData.data);
        if (subData.success) setSublokasiList(subData.data);
      } catch (error) {
        console.error('Fetch error', error);
      } finally {
        hideLoader();
      }
    };
    fetchAll();
  }, []); // TRIGGER: mount only

  const refreshSublokasi = async () => {
    const res = await fetch('/api/inventaris/master?type=sublokasi&all=true');
    const data = await res.json();
    if (data.success) setSublokasiList(data.data);
  };

  // ── Kategori: inline edit ────────────────────────────────
  const startEditKategori = (kat: Kategori) => {
    setEditingKategoriId(kat.id);
    setEditKeterangan(kat.keterangan || '');
    setSubmitState({ status: 'idle', message: '' });
  };

  const saveKategori = async (id: number) => {
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res = await fetch(`/api/inventaris/master/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'kategori', keterangan: editKeterangan }),
      });
      const result = await res.json();
      if (result.success) {
        setKategoriList(prev => prev.map(k => k.id === id ? { ...k, keterangan: editKeterangan } : k));
        setEditingKategoriId(null);
        setSubmitState({ status: 'success', message: 'Keterangan berhasil disimpan' });
      } else {
        setSubmitState({ status: 'error', message: result.message });
      }
    } catch {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan jaringan' });
    }
  };

  const toggleKategoriActive = async (kat: Kategori) => {
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res = await fetch(`/api/inventaris/master/${kat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'kategori', is_active: !kat.is_active }),
      });
      const result = await res.json();
      if (result.success) {
        setKategoriList(prev => prev.map(k => k.id === kat.id ? { ...k, is_active: !k.is_active } : k));
        setSubmitState({ status: 'success', message: `Kategori ${!kat.is_active ? 'diaktifkan' : 'dinonaktifkan'}` });
      } else {
        setSubmitState({ status: 'error', message: result.message });
      }
    } catch {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan jaringan' });
    }
  };

  // ── Sub-Lokasi CRUD ──────────────────────────────────────
  const openCreateSublokasi = () => {
    setEditingSublokasiId(null);
    setSubForm({ satelit_id: '', kode: '', nama: '' });
    setSubmitState({ status: 'idle', message: '' });
    setShowSublokasiModal(true);
  };

  const openEditSublokasi = (sub: Sublokasi) => {
    setEditingSublokasiId(sub.id);
    setSubForm({ satelit_id: sub.satelit_id.toString(), kode: sub.kode || '', nama: sub.nama });
    setSubmitState({ status: 'idle', message: '' });
    setShowSublokasiModal(true);
  };

  const saveSublokasi = async () => {
    if (!subForm.nama.trim()) {
      setSubmitState({ status: 'error', message: 'Nama sub-lokasi wajib diisi' });
      return;
    }
    if (!editingSublokasiId && !subForm.satelit_id) {
      setSubmitState({ status: 'error', message: 'Satelit wajib dipilih' });
      return;
    }
    setSubmitState({ status: 'loading', message: '' });
    try {
      let res: Response;
      if (editingSublokasiId) {
        res = await fetch(`/api/inventaris/master/${editingSublokasiId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'sublokasi', kode: subForm.kode, nama: subForm.nama }),
        });
      } else {
        res = await fetch('/api/inventaris/master', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'sublokasi', satelit_id: subForm.satelit_id, kode: subForm.kode, nama: subForm.nama }),
        });
      }
      const result = await res.json();
      if (result.success) {
        setShowSublokasiModal(false);
        setSubmitState({ status: 'success', message: result.message });
        await refreshSublokasi();
      } else {
        setSubmitState({ status: 'error', message: result.message });
      }
    } catch {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan jaringan' });
    }
  };

  const toggleSublokasiActive = async (sub: Sublokasi) => {
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res = await fetch(`/api/inventaris/master/${sub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sublokasi', is_active: !sub.is_active }),
      });
      const result = await res.json();
      if (result.success) {
        setSublokasiList(prev => prev.map(s => s.id === sub.id ? { ...s, is_active: !s.is_active } : s));
        setSubmitState({ status: 'success', message: `Sub-lokasi ${!sub.is_active ? 'diaktifkan' : 'dinonaktifkan'}` });
      } else {
        setSubmitState({ status: 'error', message: result.message });
      }
    } catch {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan jaringan' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res = await fetch(`/api/inventaris/master/${deleteTarget.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setSublokasiList(prev => prev.filter(s => s.id !== deleteTarget.id));
        setDeleteTarget(null);
        setSubmitState({ status: 'success', message: 'Sub-lokasi berhasil dihapus' });
      } else {
        setDeleteTarget(null);
        setSubmitState({ status: 'error', message: result.message });
      }
    } catch {
      setDeleteTarget(null);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan jaringan' });
    }
  };

  const filteredSublokasi = filterSatelit
    ? sublokasiList.filter(s => s.satelit_id.toString() === filterSatelit)
    : sublokasiList;

  return (
    <div className="w-full flex flex-col gap-6 pb-10">
      {submitState.status === 'loading' && <SubmitOverlay status="loading" message="Menyimpan..." />}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Master Data Inventaris</h1>
          <div className="text-slate-500 text-base font-medium font-sans leading-6">Pengelolaan kategori barang dan sub-lokasi per satelit</div>
        </div>
        {!isSuperAdmin && userData && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span className="material-icons-round text-[16px]">lock</span>
            Hanya Super Admin yang dapat mengelola master data
          </div>
        )}
      </div>

      {/* Feedback */}
      {submitState.status === 'success' && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
          <span className="material-icons-round text-[18px]">check_circle</span>
          {submitState.message}
        </div>
      )}
      {submitState.status === 'error' && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
          <span className="material-icons-round text-[18px]">error</span>
          {submitState.message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {(['kategori', 'sublokasi'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="material-icons-round text-[16px]">{tab === 'kategori' ? 'category' : 'room'}</span>
              {tab === 'kategori' ? 'Kategori Barang' : 'Sub-Lokasi'}
            </span>
          </button>
        ))}
      </div>

      {/* ═══ KATEGORI ════════════════════════════════════════ */}
      {activeTab === 'kategori' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">Kategori Barang</h2>
              <p className="text-xs text-slate-400 mt-0.5">12 kategori standar sesuai akuntansi gereja — kode tertanam dalam kode barang (permanen)</p>
            </div>
            <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2.5 py-1">{kategoriList.length} kategori</span>
          </div>

          {/* Format kode */}
          <div className="mx-6 mt-4 mb-1 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 flex items-start gap-3">
            <span className="material-icons-round text-indigo-400 text-[20px] mt-0.5">qr_code_2</span>
            <div>
              <p className="text-xs font-semibold text-indigo-700 mb-1">Format Kode Barang</p>
              <p className="text-sm font-mono">
                <span className="text-slate-600 font-bold">INV</span>
                <span className="text-slate-400"> - </span>
                <span className="text-amber-600 font-bold">2026</span>
                <span className="text-slate-400"> - </span>
                <span className="text-emerald-600 font-bold">01</span>
                <span className="text-slate-400"> - </span>
                <span className="text-indigo-700 font-bold">0001</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">Prefix INV &nbsp;·&nbsp; Tahun perolehan &nbsp;·&nbsp; <strong className="text-emerald-600">Kode kategori</strong> &nbsp;·&nbsp; Nomor urut 4 digit</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Kode</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Kategori</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Keterangan / Contoh Barang</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Status</th>
                  {isSuperAdmin && <th className="px-4 py-3 w-28 text-right text-xs font-semibold text-slate-400 uppercase">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {kategoriList.map(kat => (
                  <tr key={kat.id} className={`hover:bg-slate-50 transition-colors ${!kat.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="material-icons-round text-slate-400 text-[18px]">{KATEGORI_ICONS[kat.kode] || 'inventory_2'}</span>
                        <span className="text-xs font-bold text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded">{kat.kode}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800 text-sm">{kat.nama}</td>
                    <td className="px-4 py-3">
                      {editingKategoriId === kat.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editKeterangan}
                            onChange={e => setEditKeterangan(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            placeholder="Contoh barang..."
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') saveKategori(kat.id); if (e.key === 'Escape') setEditingKategoriId(null); }}
                          />
                          <button onClick={() => saveKategori(kat.id)} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700">Simpan</button>
                          <button onClick={() => setEditingKategoriId(null)} className="px-2 py-1.5 text-slate-500 text-xs border border-slate-200 rounded-lg hover:bg-slate-50">Batal</button>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">{kat.keterangan || <span className="italic text-slate-300">—</span>}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${kat.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {kat.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {editingKategoriId !== kat.id && (
                            <button onClick={() => startEditKategori(kat)} title="Edit keterangan"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                              <span className="material-icons-round text-[16px]">edit</span>
                            </button>
                          )}
                          <button
                            onClick={() => toggleKategoriActive(kat)}
                            title={kat.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            className={`p-1.5 rounded-lg transition-colors ${kat.is_active ? 'text-slate-400 hover:text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`}>
                            <span className="material-icons-round text-[18px]">{kat.is_active ? 'toggle_on' : 'toggle_off'}</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-400">
              <strong>Catatan:</strong> Kode kategori (01–12) bersifat permanen karena tertanam dalam kode barang. Hanya keterangan dan status aktif yang dapat diubah oleh Super Admin.
            </p>
          </div>
        </div>
      )}

      {/* ═══ SUB-LOKASI ══════════════════════════════════════ */}
      {activeTab === 'sublokasi' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">Sub-Lokasi / Ruangan</h2>
              <p className="text-xs text-slate-400 mt-0.5">Ruangan atau area per satelit — dipakai saat mencatat lokasi barang inventaris</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <select
                  value={filterSatelit}
                  onChange={e => setFilterSatelit(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300">
                  <option value="">Semua Satelit</option>
                  {satelitOptions.map(s => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                </select>
                <span className="material-icons-round absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[15px] pointer-events-none">expand_more</span>
              </div>
              {isSuperAdmin && (
                <button onClick={openCreateSublokasi}
                  className="px-4 py-2 bg-slate-700 text-white text-sm font-bold rounded-lg hover:bg-slate-800 flex items-center gap-1.5 transition-colors">
                  <span className="material-icons-round text-[16px]">add</span>
                  Tambah Sub-Lokasi
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Satelit</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Kode</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Sub-Lokasi</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Status</th>
                  {isSuperAdmin && <th className="px-4 py-3 w-28 text-right text-xs font-semibold text-slate-400 uppercase">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSublokasi.length === 0 ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 5 : 4} className="text-center py-16 text-slate-400">
                      <span className="material-icons-round text-4xl mb-2 block">room</span>
                      <p className="text-sm">Belum ada sub-lokasi{filterSatelit ? ' untuk satelit ini' : ''}</p>
                      {isSuperAdmin && (
                        <button onClick={openCreateSublokasi} className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                          + Tambah sub-lokasi pertama
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredSublokasi.map(sub => (
                    <tr key={sub.id} className={`hover:bg-slate-50 transition-colors ${!sub.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="material-icons-round text-slate-300 text-[16px]">church</span>
                          <span className="text-sm text-slate-700 font-medium">{sub.nama_satelit}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{sub.kode || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{sub.nama}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sub.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {sub.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => openEditSublokasi(sub)} title="Edit"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                              <span className="material-icons-round text-[16px]">edit</span>
                            </button>
                            <button onClick={() => toggleSublokasiActive(sub)} title={sub.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                              className={`p-1.5 rounded-lg transition-colors ${sub.is_active ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`}>
                              <span className="material-icons-round text-[18px]">{sub.is_active ? 'toggle_on' : 'toggle_off'}</span>
                            </button>
                            <button onClick={() => setDeleteTarget({ id: sub.id, nama: sub.nama })} title="Hapus"
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <span className="material-icons-round text-[16px]">delete_outline</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredSublokasi.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-400">{filteredSublokasi.length} sub-lokasi {filterSatelit ? 'di satelit ini' : 'total'}</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ Modal Sub-Lokasi ════════════════════════════════ */}
      {showSublokasiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowSublokasiModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 animate-in slide-in-from-bottom-4 duration-200"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800">
                {editingSublokasiId ? 'Edit Sub-Lokasi' : 'Tambah Sub-Lokasi Baru'}
              </h3>
              <button onClick={() => setShowSublokasiModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-icons-round">close</span>
              </button>
            </div>

            {submitState.status === 'error' && (
              <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2 text-sm">
                <span className="material-icons-round text-[16px]">error</span>
                {submitState.message}
              </div>
            )}

            <div className="flex flex-col gap-4">
              {!editingSublokasiId && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Satelit <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select value={subForm.satelit_id} onChange={e => setSubForm(p => ({ ...p, satelit_id: e.target.value }))}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 border border-slate-200 rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white">
                      <option value="">-- Pilih Satelit --</option>
                      {satelitOptions.map(s => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                    </select>
                    <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">expand_more</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kode Sub-Lokasi</label>
                <input type="text" value={subForm.kode}
                  onChange={e => setSubForm(p => ({ ...p, kode: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-slate-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="Contoh: IBD, RKS, GDG" maxLength={10} />
                <p className="text-xs text-slate-400 mt-1">Opsional · maks 10 karakter · otomatis huruf kapital</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Sub-Lokasi <span className="text-red-500">*</span></label>
                <input type="text" value={subForm.nama}
                  onChange={e => setSubForm(p => ({ ...p, nama: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="Contoh: Ruang Ibadah Utama"
                  onKeyDown={e => { if (e.key === 'Enter') saveSublokasi(); }}
                  autoFocus={!!editingSublokasiId} />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowSublokasiModal(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                Batal
              </button>
              <button onClick={saveSublokasi} disabled={submitState.status === 'loading'}
                className="flex-1 py-2.5 bg-slate-700 text-white rounded-lg text-sm font-bold hover:bg-slate-800 disabled:opacity-60 transition-colors">
                {editingSublokasiId ? 'Simpan Perubahan' : 'Tambahkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AlertModal Delete */}
      <AlertModal
        isOpen={!!deleteTarget}
        title="Hapus Sub-Lokasi?"
        message={
          <div className="text-sm text-slate-600 flex flex-col gap-2">
            <p>Sub-lokasi <strong>{deleteTarget?.nama}</strong> akan dihapus permanen.</p>
            <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ Jika masih ada barang aktif di lokasi ini, penghapusan akan dibatalkan otomatis.
            </p>
          </div>
        }
        confirmText="Ya, Hapus"
        cancelText="Batal"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
