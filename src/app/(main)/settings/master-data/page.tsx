'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';
import { MasterKomponenGaji } from './MasterKomponenGaji';
import { MasterTemplateSurvei } from './MasterTemplateSurvei';

/* ── Tab Config ─────────────────────────────────────────────────────────────── */
type TabKey =
  | 'wilayah' | 'satelit' | 'departemen' | 'komisi'
  | 'periode_kepengurusan' | 'jabatan' | 'role_pelayan'
  | 'pekerjaan_master' | 'jenis_kegiatan'
  | 'komponen_gaji' | 'template_survei';

interface TabConfig {
  label:      string;
  icon:       string;
  group:      string;
  groupColor: string;
  columns:    { key: string; label: string; width?: string }[];
  formFields: { key: string; label: string; type?: string; optionsKey?: string; optional?: boolean }[];
  hasToggle?: boolean;
  hasDel?:    boolean;
}

const TABS: Record<TabKey, TabConfig> = {
  wilayah: {
    label: 'Wilayah', icon: 'map', group: 'Organisasi & Lokasi', groupColor: 'sky',
    columns: [{ key: 'kode_wilayah', label: 'Kode', width: 'w-28' }, { key: 'nama_wilayah', label: 'Nama Wilayah' }],
    formFields: [{ key: 'kode_wilayah', label: 'Kode Wilayah (mis: W01)' }, { key: 'nama_wilayah', label: 'Nama Wilayah' }],
    hasDel: true,
  },
  satelit: {
    label: 'Satelit', icon: 'church', group: 'Organisasi & Lokasi', groupColor: 'sky',
    columns: [
      { key: 'kode_satelit', label: 'Kode', width: 'w-20' },
      { key: 'nama_satelit', label: 'Nama Satelit' },
      { key: 'nama_wilayah', label: 'Wilayah', width: 'w-36' },
      { key: 'kota', label: 'Kota', width: 'w-32' },
      { key: 'is_active', label: 'Status', width: 'w-28' },
    ],
    formFields: [
      { key: 'kode_satelit', label: 'Kode Satelit (mis: 11)' },
      { key: 'nama_satelit', label: 'Nama Satelit' },
      { key: 'wilayah_id', label: 'Wilayah', type: 'select', optionsKey: 'wilayah' },
      { key: 'alamat', label: 'Alamat', optional: true },
      { key: 'kota', label: 'Kota', optional: true },
      { key: 'kontak_satelit', label: 'Kontak', optional: true },
    ],
    hasToggle: true,
  },
  departemen: {
    label: 'Departemen', icon: 'business', group: 'Struktur Gereja', groupColor: 'violet',
    columns: [{ key: 'nama_departemen', label: 'Nama Departemen' }, { key: 'is_active', label: 'Status', width: 'w-28' }],
    formFields: [{ key: 'nama_departemen', label: 'Nama Departemen' }],
    hasToggle: true,
  },
  komisi: {
    label: 'Komisi', icon: 'groups', group: 'Struktur Gereja', groupColor: 'violet',
    columns: [
      { key: 'nama_komisi', label: 'Nama Komisi' },
      { key: 'nama_satelit', label: 'Satelit', width: 'w-40' },
      { key: 'is_active', label: 'Status', width: 'w-28' },
    ],
    formFields: [
      { key: 'nama_komisi', label: 'Nama Komisi' },
      { key: 'satelit_id', label: 'Satelit', type: 'select', optionsKey: 'satelit' },
    ],
    hasToggle: true,
  },
  periode_kepengurusan: {
    label: 'Periode', icon: 'calendar_month', group: 'Parameter SDM', groupColor: 'emerald',
    columns: [
      { key: 'nama_periode', label: 'Nama Periode' },
      { key: 'tahun_mulai', label: 'Mulai', width: 'w-20' },
      { key: 'tahun_akhir', label: 'Akhir', width: 'w-20' },
      { key: 'is_active', label: 'Status', width: 'w-28' },
    ],
    formFields: [
      { key: 'nama_periode', label: 'Nama Periode (mis: Periode 2024–2029)' },
      { key: 'tahun_mulai', label: 'Tahun Mulai', type: 'number' },
      { key: 'tahun_akhir', label: 'Tahun Akhir', type: 'number' },
    ],
    hasToggle: true,
  },
  jabatan: {
    label: 'Jabatan', icon: 'badge', group: 'Parameter SDM', groupColor: 'emerald',
    columns: [{ key: 'id', label: 'ID', width: 'w-16' }, { key: 'nama_jabatan', label: 'Nama Jabatan' }, { key: 'is_active', label: 'Status', width: 'w-28' }],
    formFields: [{ key: 'nama_jabatan', label: 'Nama Jabatan' }],
    hasToggle: true,
  },
  role_pelayan: {
    label: 'Role Pelayan', icon: 'volunteer_activism', group: 'Parameter SDM', groupColor: 'emerald',
    columns: [{ key: 'nama_role', label: 'Nama Role' }, { key: 'deskripsi', label: 'Deskripsi' }, { key: 'is_active', label: 'Status', width: 'w-28' }],
    formFields: [{ key: 'nama_role', label: 'Nama Role' }, { key: 'deskripsi', label: 'Deskripsi', optional: true }],
    hasToggle: true,
  },
  komponen_gaji: {
    label: 'Komponen Gaji', icon: 'payments', group: 'Parameter SDM', groupColor: 'emerald',
    columns: [], // handled by custom component
    formFields: [], // handled by custom component
  },
  pekerjaan_master: {
    label: 'Pekerjaan', icon: 'work', group: 'Atribut Jemaat', groupColor: 'amber',
    columns: [{ key: 'nama_pekerjaan', label: 'Nama Pekerjaan' }, { key: 'is_active', label: 'Status', width: 'w-28' }],
    formFields: [{ key: 'nama_pekerjaan', label: 'Nama Pekerjaan' }],
    hasToggle: true,
  },
  jenis_kegiatan: {
    label: 'Jenis Kegiatan', icon: 'event', group: 'Parameter Kegiatan', groupColor: 'rose',
    columns: [{ key: 'nama_jenis_kegiatan', label: 'Nama Jenis Kegiatan' }],
    formFields: [{ key: 'nama_jenis_kegiatan', label: 'Nama Jenis Kegiatan' }],
    hasDel: true,
  },
  template_survei: {
    label: 'Template Survei', icon: 'quiz', group: 'Parameter Kegiatan', groupColor: 'rose',
    columns: [], // handled by custom component
    formFields: [], // handled by custom component
  },
};

const GROUPS = [
  { name: 'Organisasi & Lokasi', color: 'sky',     icon: 'location_city'  },
  { name: 'Struktur Gereja',     color: 'violet',  icon: 'account_tree'   },
  { name: 'Parameter SDM',       color: 'emerald', icon: 'manage_accounts' },
  { name: 'Atribut Jemaat',      color: 'amber',   icon: 'person_pin'     },
  { name: 'Parameter Kegiatan',  color: 'rose',    icon: 'event_note'     },
];

const GS: Record<string, { text: string; activeBg: string; h: string }> = {
  sky:     { text: 'text-sky-600',     activeBg: 'bg-sky-600',     h: 'hover:bg-sky-700'     },
  violet:  { text: 'text-violet-600',  activeBg: 'bg-violet-600',  h: 'hover:bg-violet-700'  },
  emerald: { text: 'text-emerald-600', activeBg: 'bg-emerald-600', h: 'hover:bg-emerald-700' },
  amber:   { text: 'text-amber-500',   activeBg: 'bg-amber-500',   h: 'hover:bg-amber-600'   },
  rose:    { text: 'text-rose-600',    activeBg: 'bg-rose-600',    h: 'hover:bg-rose-700'    },
};

// ── helper: derive display label from row ──────────────────────────────────────
function rowLabel(row: any) {
  return (
    row.nama_wilayah  ?? row.nama_satelit   ?? row.nama_departemen ??
    row.nama_komisi   ?? row.nama_periode   ?? row.nama_jabatan    ??
    row.nama_role     ?? row.nama_pekerjaan ??
    row.nama_jenis_kegiatan ?? `ID ${row.id}`
  );
}

// ── helper: primary text field key ────────────────────────────────────────────
function primaryKey(tabKey: TabKey): string {
  const map: Record<TabKey, string> = {
    wilayah:              'nama_wilayah',
    satelit:              'nama_satelit',
    departemen:           'nama_departemen',
    komisi:               'nama_komisi',
    periode_kepengurusan: 'nama_periode',
    jabatan:              'nama_jabatan',
    role_pelayan:         'nama_role',
    pekerjaan_master:     'nama_pekerjaan',
    jenis_kegiatan:       'nama_jenis_kegiatan',
    komponen_gaji:        '', // Not used for custom page
    template_survei:      '', // Not used for custom page
  };
  return map[tabKey];
}

/* ── Add / Edit Modal ────────────────────────────────────────────────────────── */
function DataModal({
  mode, tab, tabKey, initialData, onClose, onSaved, selectOptions,
}: {
  mode: 'add' | 'edit';
  tab: TabConfig;
  tabKey: TabKey;
  initialData?: Record<string, any>;
  onClose: () => void;
  onSaved: (msg: string) => void;
  selectOptions: Record<string, { id: number; label: string }[]>;
}) {
  const [form, setForm]      = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    tab.formFields.forEach(f => { init[f.key] = initialData?.[f.key]?.toString() ?? ''; });
    return init;
  });
  const [sub, setSub]        = useState(false);
  const [error, setError]    = useState('');
  const gs = GS[tab.groupColor];

  const handleSubmit = async () => {
    const missing = tab.formFields.filter(f => !f.optional && !form[f.key]?.toString().trim());
    if (missing.length > 0) {
      setError(`Field wajib belum diisi: ${missing.map(f => f.label.replace(/ \(.*\)/, '')).join(', ')}`);
      return;
    }
    setSub(true); setError('');
    try {
      const isEdit = mode === 'edit';
      const res = await fetch('/api/master-data', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: tabKey,
          ...(isEdit ? { id: initialData?.id, ...form } : { data: form }),
        }),
      });
      const json = await res.json();
      if (json.success) {
        onSaved(mode === 'edit' ? `${tab.label} berhasil diperbarui!` : `${tab.label} berhasil ditambahkan!`);
        onClose();
      } else {
        setError(json.message || 'Gagal menyimpan data');
      }
    } catch { setError('Terjadi kesalahan pada server'); }
    finally { setSub(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className={`${gs.activeBg} px-6 py-4 flex justify-between items-center`}>
          <div className="flex items-center gap-2.5">
            <span className="material-icons-round text-white/80 text-[22px]">{mode === 'edit' ? 'edit' : tab.icon}</span>
            <h2 className="text-white font-bold font-sans text-base">
              {mode === 'edit' ? `Edit ${tab.label}` : `Tambah ${tab.label}`}
            </h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <span className="material-icons-round text-[20px]">close</span>
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          {tab.formFields.map(field => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <label className="text-slate-500 text-xs font-bold uppercase tracking-wider font-sans flex items-center gap-1">
                {field.label.replace(/ \(mis:.*\)/, '')}
                {field.optional && <span className="font-normal normal-case text-slate-400">(opsional)</span>}
              </label>
              {field.type === 'select' ? (
                <select
                  value={form[field.key] || ''}
                  onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  className="px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 font-sans"
                >
                  <option value="">— Pilih —</option>
                  {(selectOptions[field.optionsKey!] || []).map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type || 'text'}
                  value={form[field.key] || ''}
                  onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  className="px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 font-sans"
                />
              )}
            </div>
          ))}
          {error && (
            <div className="px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
              <span className="material-icons-round text-rose-500 text-[16px]">error_outline</span>
              <p className="text-xs text-rose-600 font-sans">{error}</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white font-sans transition-colors">
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={sub}
            className={`${gs.activeBg} ${gs.h} text-white px-5 py-2 rounded-lg text-sm font-semibold font-sans transition-colors disabled:opacity-60 flex items-center gap-2`}
          >
            {sub && <span className="material-icons-round text-[16px] animate-spin">sync</span>}
            {mode === 'edit' ? 'Simpan Perubahan' : 'Simpan Data'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Action Dropdown ─────────────────────────────────────────────────────────── */
function ActionMenu({
  row, tab, isLastRows, onEdit, onToggle, onDelete,
}: {
  row: any; tab: TabConfig; isLastRows: boolean;
  onEdit:   (row: any) => void;
  onToggle: (id: number, cur: boolean) => void;
  onDelete: (id: number, label: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const hasActions = tab.hasToggle || tab.hasDel;
  if (!hasActions) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded transition-colors text-slate-400"
        title="Aksi"
      >
        <span className="material-icons-round text-[24px]">more_horiz</span>
      </button>

      {open && (
        <>
          {/* Backdrop — uses onClick (not mousedown) so button handlers fire first */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Dropdown — above backdrop, flips UP for last 2 rows */}
          <div
            className={`absolute right-0 z-50 w-48 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.18)] border border-slate-200 py-1
              ${isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'}`}
          >
            {/* Edit */}
            <button
              onClick={() => { setOpen(false); onEdit(row); }}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans"
            >
              <span className="material-icons-round text-[18px] text-slate-400">edit</span>
              Edit Data
            </button>

            {/* Toggle */}
            {tab.hasToggle && (
              <>
                <div className="w-full h-px bg-slate-100 my-1" />
                <button
                  onClick={() => { setOpen(false); onToggle(row.id, row.is_active); }}
                  className="w-full text-left px-4 py-2 hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-3 text-sm text-amber-600 font-sans"
                >
                  <span className="material-icons-round text-[18px] text-amber-400">
                    {row.is_active ? 'toggle_on' : 'toggle_off'}
                  </span>
                  {row.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </>
            )}

            {/* Delete */}
            {tab.hasDel && (
              <>
                <div className="w-full h-px bg-slate-100 my-1" />
                <button
                  onClick={() => { setOpen(false); onDelete(row.id, rowLabel(row)); }}
                  className="w-full text-left px-4 py-2 hover:bg-rose-50 hover:text-rose-700 transition-colors flex items-center gap-3 text-sm text-rose-600 font-sans"
                >
                  <span className="material-icons-round text-[18px] text-rose-500">delete</span>
                  Hapus Data
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────────── */
export default function MasterDataPage() {
  const { showLoader, hideLoader } = useLoader();

  const [activeTab, setActiveTab] = useState<TabKey>('wilayah');
  const [data, setData]           = useState<any[]>([]);
  const [loadingTable, setLoadingTable] = useState(true);
  const [search, setSearch]       = useState('');
  const [filterSatelitId, setFilterSatelitId] = useState('');
  const [selectOptions, setSelectOptions] = useState<Record<string, { id: number; label: string }[]>>({});

  // Modals
  const [modalState, setModalState] = useState<{
    open: boolean; mode: 'add' | 'edit'; rowData?: Record<string, any>;
  }>({ open: false, mode: 'add' });

  // SubmitOverlay
  const [submitState, setSubmitState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error'; message: string;
  }>({ status: 'idle', message: '' });

  // AlertModal — toggle
  const [alertToggle, setAlertToggle] = useState<{
    isOpen: boolean; id: number | null; currentActive: boolean; label: string;
  }>({ isOpen: false, id: null, currentActive: true, label: '' });

  // AlertModal — delete
  const [alertDelete, setAlertDelete] = useState<{
    isOpen: boolean; id: number | null; label: string;
  }>({ isOpen: false, id: null, label: '' });

  const tab = TABS[activeTab];
  const gs  = GS[tab.groupColor];

  /* ── Fetch table data (inline spinner, no lottie overlay) ── */
  const fetchData = useCallback(async () => {
    if (activeTab === 'komponen_gaji' || activeTab === 'template_survei') return; // Custom components handle their own data
    setLoadingTable(true);
    try {
      const params = new URLSearchParams({ table: activeTab });
      if (search) params.set('search', search);
      if (activeTab === 'komisi' && filterSatelitId) params.set('satelit_id', filterSatelitId);
      
      const res  = await fetch(`/api/master-data?${params}`);
      const json = await res.json();
      setData(json.success ? json.data : []);
    } catch { setData([]); }
    finally { setLoadingTable(false); }
  }, [activeTab, search, filterSatelitId]);

  /* ── One-time init: fetch select options with lottie loader ── */
  useEffect(() => {
    const init = async () => {
      showLoader();
      try {
        const [rw, rs] = await Promise.all([
          fetch('/api/master-data?table=wilayah'),
          fetch('/api/master-data?table=satelit'),
        ]);
        const wd = await rw.json();
        const sd = await rs.json();
        setSelectOptions({
          wilayah: (wd.data || []).map((r: any) => ({ id: r.id, label: r.nama_wilayah })),
          satelit: (sd.data || []).map((r: any) => ({ id: r.id, label: r.nama_satelit })),
        });
      } catch {}
      finally { hideLoader(); }
    };
    init();
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { 
    setSearch(''); 
    setFilterSatelitId('');
  }, [activeTab]);

  /* ── Toggle ── */
  const handleToggleRequest = (id: number, cur: boolean) => {
    const lbl = rowLabel(data.find(r => r.id === id) ?? { id });
    setAlertToggle({ isOpen: true, id, currentActive: cur, label: lbl });
  };

  const confirmToggle = async () => {
    const { id, currentActive } = alertToggle;
    if (!id) return;
    setAlertToggle(s => ({ ...s, isOpen: false }));
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res  = await fetch('/api/master-data', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: activeTab, id, is_active: !currentActive }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchData();
        setSubmitState({ status: 'success', message: `Status berhasil diubah menjadi ${!currentActive ? 'Aktif' : 'Tidak Aktif'}.` });
      } else {
        setSubmitState({ status: 'error', message: json.message || 'Gagal mengubah status' });
      }
    } catch { setSubmitState({ status: 'error', message: 'Terjadi kesalahan koneksi.' }); }
  };

  /* ── Delete ── */
  const confirmDelete = async () => {
    const { id } = alertDelete;
    if (!id) return;
    setAlertDelete(s => ({ ...s, isOpen: false }));
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res  = await fetch(`/api/master-data?table=${activeTab}&id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        await fetchData();
        setSubmitState({ status: 'success', message: 'Data berhasil dihapus.' });
      } else {
        setSubmitState({ status: 'error', message: json.message || 'Gagal menghapus data' });
      }
    } catch { setSubmitState({ status: 'error', message: 'Terjadi kesalahan koneksi.' }); }
  };

  /* ── Edit ── */
  const handleEditRequest = (row: any) => {
    setModalState({ open: true, mode: 'edit', rowData: row });
  };

  const groups = GROUPS.map(g => ({
    ...g,
    tabs: (Object.entries(TABS) as [TabKey, TabConfig][]).filter(([, c]) => c.group === g.name),
  }));

  return (
    <div className="flex flex-col gap-0 w-full min-h-0">

      <SubmitOverlay
        status={submitState.status}
        message={submitState.message}
        onClose={() => setSubmitState({ status: 'idle', message: '' })}
      />

      <AlertModal
        isOpen={alertToggle.isOpen}
        title={alertToggle.currentActive ? 'Nonaktifkan Data?' : 'Aktifkan Data?'}
        message={
          <span>
            Apakah Anda yakin ingin{' '}
            <strong>{alertToggle.currentActive ? 'menonaktifkan' : 'mengaktifkan'}</strong>{' '}
            <em>{alertToggle.label}</em>?{' '}
            {alertToggle.currentActive && 'Data ini tidak akan muncul dalam daftar pilihan.'}
          </span>
        }
        confirmText={alertToggle.currentActive ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
        cancelText="Batal"
        onConfirm={confirmToggle}
        onCancel={() => setAlertToggle(s => ({ ...s, isOpen: false }))}
      />

      <AlertModal
        isOpen={alertDelete.isOpen}
        title="Hapus Data?"
        message={
          <span>
            Yakin menghapus <em>{alertDelete.label}</em>?{' '}
            <strong>Tidak dapat dibatalkan</strong> dan akan gagal jika masih digunakan data lain.
          </span>
        }
        confirmText="Ya, Hapus"
        cancelText="Batal"
        onConfirm={confirmDelete}
        onCancel={() => setAlertDelete(s => ({ ...s, isOpen: false }))}
      />

      {/* Header */}
      <div className="flex flex-col gap-1 pb-5">
        <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Master Data</h1>
        <p className="text-slate-500 text-base font-medium font-sans leading-6">Kelola semua tabel referensi dan parameter sistem dalam satu tempat</p>
      </div>

      {/* 2-column layout */}
      <div className="flex gap-5 items-start">

        {/* ── Left Nav ── */}
        <div className="w-52 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-4">
          {groups.map(g => {
            const gs2 = GS[g.color];
            return (
              <div key={g.name}>
                <div className="px-3 pt-3 pb-1 flex items-center gap-1.5">
                  <span className={`material-icons-round text-[14px] ${gs2.text}`}>{g.icon}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest font-sans ${gs2.text}`}>{g.name}</span>
                </div>
                {g.tabs.map(([key, cfg]) => {
                  const active = activeTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-all text-left font-sans ${
                        active ? `${gs2.activeBg} text-white` : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`material-icons-round text-[18px] shrink-0 ${active ? 'text-white' : gs2.text}`}>{cfg.icon}</span>
                      {cfg.label}
                    </button>
                  );
                })}
                <div className="border-b border-slate-100 mx-3" />
              </div>
            );
          })}
        </div>

        {/* ── Right Content ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Header band */}
          {activeTab !== 'komponen_gaji' && activeTab !== 'template_survei' && (
          <div className={`${gs.activeBg} rounded-xl px-5 py-4 flex items-center justify-between gap-4`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="material-icons-round text-white text-[22px]">{tab.icon}</span>
              </div>
              <div>
                <div className="text-white font-bold font-sans text-base leading-tight">{tab.label}</div>
                <div className="text-white/70 text-xs font-sans leading-tight">
                  {loadingTable ? 'Memuat...' : `${data.length} data tersimpan`}
                </div>
              </div>
            </div>
            <button
              onClick={() => setModalState({ open: true, mode: 'add' })}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-lg transition-colors font-sans shrink-0 border border-white/30"
            >
              <span className="material-icons-round text-[18px]">add</span>
              Tambah {tab.label}
            </button>
          </div>
          )}

          {/* Filters Area */}
          {activeTab !== 'komponen_gaji' && activeTab !== 'template_survei' && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-slate-400 text-[20px]">search</span>
              <input
                type="text"
                placeholder={`Cari ${tab.label}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white font-sans"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <span className="material-icons-round text-[18px]">close</span>
                </button>
              )}
            </div>
            
            {activeTab === 'komisi' && (
              <div className="relative min-w-[200px]">
                <select
                  value={filterSatelitId}
                  onChange={(e) => setFilterSatelitId(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 font-sans appearance-none"
                >
                  <option value="">Semua Satelit</option>
                  {selectOptions.satelit?.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 material-icons-round text-slate-400 pointer-events-none">expand_more</span>
              </div>
            )}
          </div>
          )}

          {/* Render Custom Component OR Generic Table */}
          {activeTab === 'komponen_gaji' ? (
            <MasterKomponenGaji />
          ) : activeTab === 'template_survei' ? (
            <MasterTemplateSurvei />
          ) : (
          <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {tab.columns.map(col => (
                      <th key={col.key} className={`${col.width ?? ''} px-5 py-3.5 text-left text-slate-500 text-xs font-bold uppercase tracking-wider font-sans`}>
                        {col.label}
                      </th>
                    ))}
                    {(tab.hasToggle || tab.hasDel) && (
                      <th className="w-16 px-5 py-3.5 text-right text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loadingTable ? (
                    <tr>
                      <td colSpan={tab.columns.length + 1} className="py-16 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-7 h-7 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
                          <span className="text-slate-500 text-sm font-sans">Memuat data {tab.label}...</span>
                        </div>
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={tab.columns.length + 1} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className={`material-icons-round text-5xl ${gs.text} opacity-25`}>{tab.icon}</span>
                          <p className="text-sm text-slate-400 font-sans">Belum ada data {tab.label}</p>
                          <button onClick={() => setModalState({ open: true, mode: 'add' })} className={`mt-2 text-xs font-semibold ${gs.text} hover:underline font-sans`}>
                            + Tambah sekarang
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.map((row, i) => {
                      // Balik arah dropdown ke atas buat dua baris terakhir (biar sama kayak menu Jemaat)
                      const isLastRows = data.length > 2 && i >= data.length - 2;
                      return (
                        <tr
                          key={row.id ?? i}
                          className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors relative"
                        >
                          {tab.columns.map(col => (
                            <td key={col.key} className={`${col.width ?? ''} px-5 py-3.5 text-sm font-sans`}>
                              {col.key === 'is_active' ? (
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold font-sans uppercase ${
                                  row[col.key] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  <span className="material-icons-round text-[12px]">{row[col.key] ? 'check_circle' : 'cancel'}</span>
                                  {row[col.key] ? 'Aktif' : 'Nonaktif'}
                                </span>
                              ) : (
                                <span className="text-slate-700">{row[col.key] ?? '—'}</span>
                              )}
                            </td>
                          ))}
                          {(tab.hasToggle || tab.hasDel) && (
                            <td className="w-16 px-5 py-3.5">
                              <div className="flex justify-end">
                                <ActionMenu
                                  row={row}
                                  tab={tab}
                                  isLastRows={isLastRows}
                                  onEdit={handleEditRequest}
                                  onToggle={handleToggleRequest}
                                  onDelete={(id, lbl) => setAlertDelete({ isOpen: true, id, label: lbl })}
                                />
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
              <span className="text-slate-400 text-xs font-sans">
                {loadingTable ? 'Memuat...' : `${data.length} entri`}
              </span>
            </div>
          </div>
          )}

        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalState.open && (
        <DataModal
          mode={modalState.mode}
          tab={tab}
          tabKey={activeTab}
          initialData={modalState.rowData}
          onClose={() => setModalState(s => ({ ...s, open: false }))}
          onSaved={msg => { fetchData(); setSubmitState({ status: 'success', message: msg }); }}
          selectOptions={selectOptions}
        />
      )}
    </div>
  );
}
