'use client';

import { useState, useEffect, useCallback } from 'react';

/* ── Tab Config ─────────────────────────────────────────────────────────────── */
type TabKey =
  | 'wilayah' | 'satelit' | 'departemen' | 'komisi'
  | 'periode_kepengurusan' | 'jabatan' | 'role_pelayan'
  | 'pekerjaan_master' | 'jenis_relasi' | 'jenis_kegiatan';

interface TabConfig {
  label:      string;
  icon:       string;
  group:      string;
  groupColor: string; // Tailwind base color name
  columns:    { key: string; label: string; width?: string }[];
  formFields: { key: string; label: string; type?: string; optionsKey?: string; optional?: boolean }[];
  hasToggle?: boolean;
  hasDel?:    boolean;
}

const TABS: Record<TabKey, TabConfig> = {
  wilayah: {
    label: 'Wilayah', icon: 'map', group: 'Organisasi & Lokasi', groupColor: 'sky',
    columns: [
      { key: 'kode_wilayah', label: 'Kode', width: 'w-28' },
      { key: 'nama_wilayah', label: 'Nama Wilayah' },
    ],
    formFields: [
      { key: 'kode_wilayah', label: 'Kode Wilayah (mis: W01)' },
      { key: 'nama_wilayah', label: 'Nama Wilayah' },
    ],
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
    columns: [
      { key: 'nama_departemen', label: 'Nama Departemen' },
      { key: 'is_active', label: 'Status', width: 'w-28' },
    ],
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
    columns: [
      { key: 'id', label: 'ID', width: 'w-16' },
      { key: 'nama_jabatan', label: 'Nama Jabatan' },
    ],
    formFields: [{ key: 'nama_jabatan', label: 'Nama Jabatan' }],
    hasDel: true,
  },
  role_pelayan: {
    label: 'Role Pelayan', icon: 'volunteer_activism', group: 'Parameter SDM', groupColor: 'emerald',
    columns: [
      { key: 'nama_role', label: 'Nama Role' },
      { key: 'deskripsi', label: 'Deskripsi' },
    ],
    formFields: [
      { key: 'nama_role', label: 'Nama Role' },
      { key: 'deskripsi', label: 'Deskripsi', optional: true },
    ],
    hasDel: true,
  },
  pekerjaan_master: {
    label: 'Pekerjaan', icon: 'work', group: 'Atribut Jemaat', groupColor: 'amber',
    columns: [
      { key: 'nama_pekerjaan', label: 'Nama Pekerjaan' },
      { key: 'is_active', label: 'Status', width: 'w-28' },
    ],
    formFields: [{ key: 'nama_pekerjaan', label: 'Nama Pekerjaan' }],
    hasToggle: true,
  },
  jenis_relasi: {
    label: 'Jenis Relasi', icon: 'family_restroom', group: 'Atribut Jemaat', groupColor: 'amber',
    columns: [{ key: 'nama_relasi', label: 'Nama Relasi' }],
    formFields: [{ key: 'nama_relasi', label: 'Nama Relasi (mis: Suami, Istri, Anak)' }],
    hasDel: true,
  },
  jenis_kegiatan: {
    label: 'Jenis Kegiatan', icon: 'event', group: 'Parameter Kegiatan', groupColor: 'rose',
    columns: [{ key: 'nama_jenis_kegiatan', label: 'Nama Jenis Kegiatan' }],
    formFields: [{ key: 'nama_jenis_kegiatan', label: 'Nama Jenis Kegiatan' }],
    hasDel: true,
  },
};

const GROUPS: { name: string; color: string; icon: string }[] = [
  { name: 'Organisasi & Lokasi', color: 'sky',     icon: 'location_city' },
  { name: 'Struktur Gereja',     color: 'violet',  icon: 'account_tree'  },
  { name: 'Parameter SDM',       color: 'emerald', icon: 'manage_accounts' },
  { name: 'Atribut Jemaat',      color: 'amber',   icon: 'person_pin'    },
  { name: 'Parameter Kegiatan',  color: 'rose',    icon: 'event_note'    },
];

const GROUP_STYLES: Record<string, { bg: string; text: string; activeBg: string; activeText: string; dot: string }> = {
  sky:     { bg: 'bg-sky-50    hover:bg-sky-100',     text: 'text-sky-700',     activeBg: 'bg-sky-600',     activeText: 'text-white', dot: 'bg-sky-400'     },
  violet:  { bg: 'bg-violet-50 hover:bg-violet-100',  text: 'text-violet-700',  activeBg: 'bg-violet-600',  activeText: 'text-white', dot: 'bg-violet-400'  },
  emerald: { bg: 'bg-emerald-50 hover:bg-emerald-100',text: 'text-emerald-700', activeBg: 'bg-emerald-600', activeText: 'text-white', dot: 'bg-emerald-400' },
  amber:   { bg: 'bg-amber-50  hover:bg-amber-100',   text: 'text-amber-700',   activeBg: 'bg-amber-500',   activeText: 'text-white', dot: 'bg-amber-400'   },
  rose:    { bg: 'bg-rose-50   hover:bg-rose-100',    text: 'text-rose-700',    activeBg: 'bg-rose-600',    activeText: 'text-white', dot: 'bg-rose-400'    },
};

/* ── Add Modal ───────────────────────────────────────────────────────────────── */
function AddModal({
  tab, tabKey, onClose, onSuccess, selectOptions,
}: {
  tab: TabConfig; tabKey: TabKey;
  onClose: () => void; onSuccess: () => void;
  selectOptions: Record<string, { id: number; label: string }[]>;
}) {
  const [form, setForm]       = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const gs = GROUP_STYLES[tab.groupColor];

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/master-data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tabKey, data: form }),
      });
      const json = await res.json();
      if (json.success) { onSuccess(); onClose(); }
      else setError(json.message || 'Gagal menyimpan data');
    } catch { setError('Terjadi kesalahan pada server'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Colored header strip */}
        <div className={`${gs.activeBg} px-6 py-4 flex justify-between items-center`}>
          <div className="flex items-center gap-2.5">
            <span className="material-icons-round text-white/80 text-[22px]">{tab.icon}</span>
            <h2 className="text-white font-bold font-['Inter'] text-base">Tambah {tab.label}</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <span className="material-icons-round text-[20px]">close</span>
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          {tab.formFields.map(field => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <label className="text-slate-500 text-xs font-bold uppercase tracking-wider font-['Inter'] flex items-center gap-1">
                {field.label}
                {field.optional && <span className="font-normal normal-case text-slate-400">(opsional)</span>}
              </label>
              {field.type === 'select' ? (
                <select
                  value={form[field.key] || ''}
                  onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  className="px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 font-['Public_Sans']"
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
                  className="px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 font-['Public_Sans']"
                />
              )}
            </div>
          ))}
          {error && (
            <div className="px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
              <span className="material-icons-round text-rose-500 text-[16px]">error</span>
              <p className="text-xs text-rose-600 font-['Public_Sans']">{error}</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white font-['Public_Sans'] transition-colors">
            Batal
          </button>
          <button onClick={handleSubmit} disabled={loading} className={`${gs.activeBg} ${gs.activeText} px-5 py-2 rounded-lg text-sm font-semibold font-['Public_Sans'] transition-opacity disabled:opacity-60 flex items-center gap-2`}>
            {loading && <span className="material-icons-round text-[16px] animate-spin">sync</span>}
            Simpan Data
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────────── */
export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('wilayah');
  const [data, setData]           = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast]         = useState('');
  const [selectOptions, setSelectOptions] = useState<Record<string, { id: number; label: string }[]>>({});

  const tab = TABS[activeTab];
  const gs  = GROUP_STYLES[tab.groupColor];

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ table: activeTab });
      if (search) params.set('search', search);
      const res  = await fetch(`/api/master-data?${params}`);
      const json = await res.json();
      setData(json.success ? json.data : []);
    } catch { setData([]); }
    finally { setLoading(false); }
  }, [activeTab, search]);

  useEffect(() => {
    const fetchSelects = async () => {
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
    };
    fetchSelects();
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setSearch(''); setData([]); }, [activeTab]);

  const handleToggle = async (id: number, cur: boolean) => {
    await fetch('/api/master-data', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: activeTab, id, is_active: !cur }),
    });
    fetchData();
    showToast(cur ? 'Data dinonaktifkan.' : 'Data diaktifkan.');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus data ini?')) return;
    const res  = await fetch(`/api/master-data?table=${activeTab}&id=${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) { showToast('Data berhasil dihapus.'); fetchData(); }
    else showToast(`Gagal: ${json.message}`);
  };

  return (
    <div className="flex flex-col gap-0 w-full min-h-0">
      {/* Header */}
      <div className="flex flex-col gap-1 pb-5">
        <h1 className="text-2xl font-bold text-slate-800 font-['Inter']">Master Data</h1>
        <p className="text-sm text-slate-500 font-['Public_Sans']">Kelola semua tabel referensi dan parameter sistem dalam satu tempat</p>
      </div>

      {/* 2-column layout */}
      <div className="flex gap-5 items-start">

        {/* ── Left Nav ── */}
        <div className="w-52 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-4">
          {GROUPS.map(g => {
            const gTabs  = (Object.entries(TABS) as [TabKey, TabConfig][]).filter(([, c]) => c.group === g.name);
            const gStyle = GROUP_STYLES[g.color];
            return (
              <div key={g.name} className="flex flex-col">
                <div className="px-3 pt-3 pb-1 flex items-center gap-1.5">
                  <span className={`material-icons-round text-[14px] ${gStyle.text}`}>{g.icon}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest font-['Inter'] ${gStyle.text}`}>{g.name}</span>
                </div>
                {gTabs.map(([key, cfg]) => {
                  const active = activeTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-all text-left mx-0 font-['Public_Sans'] ${
                        active
                          ? `${gStyle.activeBg} text-white`
                          : `text-slate-600 hover:bg-slate-50`
                      }`}
                    >
                      <span className={`material-icons-round text-[18px] shrink-0 ${active ? 'text-white' : gStyle.text}`}>
                        {cfg.icon}
                      </span>
                      {cfg.label}
                    </button>
                  );
                })}
                <div className="border-b border-slate-100 mx-3 last:hidden" />
              </div>
            );
          })}
        </div>

        {/* ── Right Content ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Content header band */}
          <div className={`${gs.activeBg} rounded-xl px-5 py-4 flex items-center justify-between gap-4`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="material-icons-round text-white text-[22px]">{tab.icon}</span>
              </div>
              <div>
                <div className="text-white font-bold font-['Inter'] text-base leading-tight">{tab.label}</div>
                <div className="text-white/70 text-xs font-['Public_Sans'] leading-tight">{data.length} data tersimpan</div>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-lg transition-colors font-['Public_Sans'] shrink-0 backdrop-blur-sm border border-white/30"
            >
              <span className="material-icons-round text-[18px]">add</span>
              Tambah {tab.label}
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-slate-400 text-[20px]">search</span>
            <input
              type="text"
              placeholder={`Cari ${tab.label}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white font-['Public_Sans']"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <span className="material-icons-round text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Table */}
          <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {tab.columns.map(col => (
                      <th key={col.key} className={`${col.width ?? ''} px-5 py-3.5 text-left text-slate-500 text-xs font-bold uppercase tracking-wider font-['Public_Sans']`}>
                        {col.label}
                      </th>
                    ))}
                    <th className="w-24 px-5 py-3.5 text-right text-slate-500 text-xs font-bold uppercase tracking-wider font-['Public_Sans']">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={tab.columns.length + 1} className="py-16 text-center">
                        <div className="flex justify-center">
                          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
                        </div>
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={tab.columns.length + 1} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className={`material-icons-round text-5xl ${gs.text} opacity-30`}>{tab.icon}</span>
                          <p className="text-sm text-slate-400 font-['Public_Sans']">Belum ada data {tab.label}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.map((row, i) => (
                      <tr key={row.id ?? i} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                        {tab.columns.map(col => (
                          <td key={col.key} className={`${col.width ?? ''} px-5 py-3.5 text-sm font-['Public_Sans']`}>
                            {col.key === 'is_active' ? (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                row[col.key] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                              }`}>
                                <span className="material-icons-round text-[12px]">{row[col.key] ? 'check_circle' : 'cancel'}</span>
                                {row[col.key] ? 'Aktif' : 'Nonaktif'}
                              </span>
                            ) : (
                              <span className="text-slate-700">{row[col.key] ?? '—'}</span>
                            )}
                          </td>
                        ))}
                        <td className="w-24 px-5 py-3.5">
                          <div className="flex justify-end gap-1.5">
                            {tab.hasToggle && (
                              <button
                                onClick={() => handleToggle(row.id, row.is_active)}
                                title={row.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                                  row.is_active
                                    ? 'border-rose-200 text-rose-500 hover:bg-rose-50'
                                    : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                <span className="material-icons-round text-[17px]">{row.is_active ? 'toggle_on' : 'toggle_off'}</span>
                              </button>
                            )}
                            {tab.hasDel && (
                              <button
                                onClick={() => handleDelete(row.id)}
                                title="Hapus"
                                className="w-8 h-8 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors"
                              >
                                <span className="material-icons-round text-[17px]">delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
              <span className="text-slate-400 text-xs font-['Public_Sans']">
                {loading ? '...' : `${data.length} entri`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-800 text-white text-sm rounded-xl shadow-xl font-['Public_Sans']">
            <span className="material-icons-round text-emerald-400 text-[18px]">check_circle</span>
            {toast}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <AddModal
          tab={tab} tabKey={activeTab}
          onClose={() => setShowModal(false)}
          onSuccess={() => { fetchData(); showToast(`${tab.label} berhasil ditambahkan!`); }}
          selectOptions={selectOptions}
        />
      )}
    </div>
  );
}
