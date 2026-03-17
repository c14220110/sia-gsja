'use client';

import { useState, useEffect, useCallback } from 'react';

/* ── Tab Config ─────────────────────────────────────────────────────────────── */
type TabKey =
  | 'wilayah' | 'satelit' | 'departemen' | 'komisi'
  | 'periode_kepengurusan' | 'jabatan' | 'role_pelayan'
  | 'pekerjaan_master' | 'jenis_relasi' | 'jenis_kegiatan';

interface TabConfig {
  label: string;
  icon: string;
  group: string;
  columns: { key: string; label: string }[];
  formFields: { key: string; label: string; type?: string; optionsKey?: string }[];
  hasToggle?: boolean;  // has is_active field
  hasDel?: boolean;     // can be hard-deleted
}

const TABS: Record<TabKey, TabConfig> = {
  wilayah: {
    label: 'Wilayah', icon: 'map', group: 'Organisasi & Lokasi',
    columns: [{ key: 'kode_wilayah', label: 'Kode' }, { key: 'nama_wilayah', label: 'Nama Wilayah' }],
    formFields: [
      { key: 'kode_wilayah', label: 'Kode Wilayah' },
      { key: 'nama_wilayah', label: 'Nama Wilayah' },
    ],
    hasDel: true,
  },
  satelit: {
    label: 'Satelit', icon: 'church', group: 'Organisasi & Lokasi',
    columns: [
      { key: 'kode_satelit', label: 'Kode' },
      { key: 'nama_satelit', label: 'Nama Satelit' },
      { key: 'nama_wilayah', label: 'Wilayah' },
      { key: 'kota', label: 'Kota' },
      { key: 'is_active', label: 'Status' },
    ],
    formFields: [
      { key: 'kode_satelit', label: 'Kode Satelit' },
      { key: 'nama_satelit', label: 'Nama Satelit' },
      { key: 'wilayah_id', label: 'Wilayah', type: 'select', optionsKey: 'wilayah' },
      { key: 'alamat', label: 'Alamat (opsional)' },
      { key: 'kota', label: 'Kota (opsional)' },
      { key: 'kontak_satelit', label: 'Kontak (opsional)' },
    ],
    hasToggle: true,
  },
  departemen: {
    label: 'Departemen', icon: 'business', group: 'Struktur Gereja',
    columns: [{ key: 'nama_departemen', label: 'Nama Departemen' }, { key: 'is_active', label: 'Status' }],
    formFields: [{ key: 'nama_departemen', label: 'Nama Departemen' }],
    hasToggle: true,
  },
  komisi: {
    label: 'Komisi', icon: 'groups', group: 'Struktur Gereja',
    columns: [
      { key: 'nama_komisi', label: 'Nama Komisi' },
      { key: 'nama_satelit', label: 'Satelit' },
      { key: 'is_active', label: 'Status' },
    ],
    formFields: [
      { key: 'nama_komisi', label: 'Nama Komisi' },
      { key: 'satelit_id', label: 'Satelit', type: 'select', optionsKey: 'satelit' },
    ],
    hasToggle: true,
  },
  periode_kepengurusan: {
    label: 'Periode', icon: 'calendar_month', group: 'Parameter SDM',
    columns: [
      { key: 'nama_periode', label: 'Nama Periode' },
      { key: 'tahun_mulai', label: 'Mulai' },
      { key: 'tahun_akhir', label: 'Akhir' },
      { key: 'is_active', label: 'Status' },
    ],
    formFields: [
      { key: 'nama_periode', label: 'Nama Periode (mis: Periode 2024-2029)' },
      { key: 'tahun_mulai', label: 'Tahun Mulai', type: 'number' },
      { key: 'tahun_akhir', label: 'Tahun Akhir', type: 'number' },
    ],
    hasToggle: true,
  },
  jabatan: {
    label: 'Jabatan', icon: 'badge', group: 'Parameter SDM',
    columns: [{ key: 'id', label: 'ID' }, { key: 'nama_jabatan', label: 'Nama Jabatan' }],
    formFields: [{ key: 'nama_jabatan', label: 'Nama Jabatan' }],
    hasDel: true,
  },
  role_pelayan: {
    label: 'Role Pelayan', icon: 'volunteer_activism', group: 'Parameter SDM',
    columns: [{ key: 'nama_role', label: 'Nama Role' }, { key: 'deskripsi', label: 'Deskripsi' }],
    formFields: [
      { key: 'nama_role', label: 'Nama Role' },
      { key: 'deskripsi', label: 'Deskripsi (opsional)' },
    ],
    hasDel: true,
  },
  pekerjaan_master: {
    label: 'Pekerjaan', icon: 'work', group: 'Atribut Jemaat',
    columns: [{ key: 'nama_pekerjaan', label: 'Nama Pekerjaan' }, { key: 'is_active', label: 'Status' }],
    formFields: [{ key: 'nama_pekerjaan', label: 'Nama Pekerjaan' }],
    hasToggle: true,
  },
  jenis_relasi: {
    label: 'Jenis Relasi', icon: 'family_restroom', group: 'Atribut Jemaat',
    columns: [{ key: 'nama_relasi', label: 'Nama Relasi' }],
    formFields: [{ key: 'nama_relasi', label: 'Nama Relasi' }],
    hasDel: true,
  },
  jenis_kegiatan: {
    label: 'Jenis Kegiatan', icon: 'event', group: 'Parameter Kegiatan',
    columns: [{ key: 'nama_jenis_kegiatan', label: 'Nama Jenis Kegiatan' }],
    formFields: [{ key: 'nama_jenis_kegiatan', label: 'Nama Jenis Kegiatan' }],
    hasDel: true,
  },
};

const TAB_GROUPS = ['Organisasi & Lokasi', 'Struktur Gereja', 'Parameter SDM', 'Atribut Jemaat', 'Parameter Kegiatan'];

/* ── Modal Component ─────────────────────────────────────────────────────────── */
function AddModal({
  tab, tabKey, onClose, onSuccess, selectOptions,
}: {
  tab: TabConfig;
  tabKey: TabKey;
  onClose: () => void;
  onSuccess: () => void;
  selectOptions: Record<string, { id: number; label: string }[]>;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/master-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tabKey, data: form }),
      });
      const json = await res.json();
      if (json.success) {
        onSuccess();
        onClose();
      } else {
        setError(json.message || 'Gagal menyimpan data');
      }
    } catch {
      setError('Terjadi kesalahan pada server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-slate-800 font-bold font-['Inter'] text-base">Tambah {tab.label}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <span className="material-icons-round text-[20px]">close</span>
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          {tab.formFields.map(field => (
            <div key={field.key} className="flex flex-col gap-1">
              <label className="text-slate-500 text-xs font-bold uppercase tracking-wider font-['Inter']">{field.label}</label>
              {field.type === 'select' ? (
                <select
                  value={form[field.key] || ''}
                  onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 font-['Public_Sans']"
                >
                  <option value="">-- Pilih --</option>
                  {(selectOptions[field.optionsKey!] || []).map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type || 'text'}
                  value={form[field.key] || ''}
                  onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 font-['Public_Sans']"
                />
              )}
            </div>
          ))}
          {error && <p className="text-xs text-rose-600 font-['Public_Sans']">⚠ {error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 font-['Public_Sans'] transition-colors">
            Batal
          </button>
          <button onClick={handleSubmit} disabled={loading} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-white font-semibold font-['Public_Sans'] transition-colors disabled:opacity-60 flex items-center gap-2">
            {loading && <span className="material-icons-round text-[16px] animate-spin">sync</span>}
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────────── */
export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('wilayah');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectOptions, setSelectOptions] = useState<Record<string, { id: number; label: string }[]>>({});
  const [actionMsg, setActionMsg] = useState('');

  const tab = TABS[activeTab];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ table: activeTab });
      if (search) params.set('search', search);
      const res = await fetch(`/api/master-data?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setData([]);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  // Fetch select options for dropdowns
  useEffect(() => {
    const fetchSelects = async () => {
      try {
        const [resWil, resSat] = await Promise.all([
          fetch('/api/master-data?table=wilayah'),
          fetch('/api/master-data?table=satelit'),
        ]);
        const wilData = await resWil.json();
        const satData = await resSat.json();
        setSelectOptions({
          wilayah: (wilData.data || []).map((r: any) => ({ id: r.id, label: r.nama_wilayah })),
          satelit: (satData.data || []).map((r: any) => ({ id: r.id, label: r.nama_satelit })),
        });
      } catch {}
    };
    fetchSelects();
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setSearch(''); setData([]); }, [activeTab]);

  const handleToggle = async (id: number, currentActive: boolean) => {
    try {
      await fetch('/api/master-data', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: activeTab, id, is_active: !currentActive }),
      });
      fetchData();
    } catch {}
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus data ini? Pastikan tidak ada data lain yang bergantung padanya.')) return;
    try {
      const res = await fetch(`/api/master-data?table=${activeTab}&id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setActionMsg('Data berhasil dihapus.');
        fetchData();
      } else {
        setActionMsg(`Gagal: ${json.message}`);
      }
      setTimeout(() => setActionMsg(''), 4000);
    } catch {}
  };

  const groups = TAB_GROUPS.map(g => ({
    name: g,
    tabs: (Object.entries(TABS) as [TabKey, TabConfig][]).filter(([, cfg]) => cfg.group === g),
  }));

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800 font-['Inter']">Master Data</h1>
        <p className="text-sm text-slate-500 font-['Public_Sans']">Kelola semua tabel referensi dan parameter sistem</p>
      </div>

      {/* Tab Navigation — grouped */}
      <div className="flex flex-col gap-4">
        {groups.map(g => (
          <div key={g.name} className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-['Public_Sans']">{g.name}</span>
            <div className="flex gap-2 flex-wrap">
              {g.tabs.map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-semibold font-['Public_Sans'] transition-all ${
                    activeTab === key
                      ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-icons-round text-[18px]">{cfg.icon}</span>
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-slate-400 text-[20px]">search</span>
          <input
            type="text"
            placeholder={`Cari ${tab.label}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white font-['Public_Sans']"
          />
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg transition-colors font-['Public_Sans'] shrink-0"
        >
          <span className="material-icons-round text-[18px]">add</span>
          Tambah {tab.label}
        </button>
      </div>

      {/* Action Message */}
      {actionMsg && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg font-['Public_Sans'] flex items-center gap-2">
          <span className="material-icons-round text-[18px]">check_circle</span>
          {actionMsg}
        </div>
      )}

      {/* Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[600px] flex flex-col">
            {/* Header */}
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4 gap-4">
              {tab.columns.map(col => (
                <div key={col.key} className="flex-1 min-w-[100px] text-slate-500 text-xs font-bold uppercase tracking-wider font-['Public_Sans']">
                  {col.label}
                </div>
              ))}
              <div className="w-24 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-['Public_Sans'] text-right">
                Aksi
              </div>
            </div>

            {/* Body */}
            {loading ? (
              <div className="w-full py-16 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
              </div>
            ) : data.length === 0 ? (
              <div className="w-full py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                <span className="material-icons-round text-5xl text-slate-300">dataset</span>
                <p className="text-sm font-['Public_Sans']">Belum ada data {tab.label}.</p>
              </div>
            ) : (
              data.map(row => (
                <div key={row.id} className="w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors gap-4">
                  {tab.columns.map(col => (
                    <div key={col.key} className="flex-1 min-w-[100px] text-sm font-['Public_Sans']">
                      {col.key === 'is_active' ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          row[col.key] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <span className="material-icons-round text-[12px]">{row[col.key] ? 'check_circle' : 'cancel'}</span>
                          {row[col.key] ? 'Aktif' : 'Tidak Aktif'}
                        </span>
                      ) : (
                        <span className="text-slate-700">{row[col.key] ?? '—'}</span>
                      )}
                    </div>
                  ))}
                  <div className="w-24 shrink-0 flex justify-end gap-2">
                    {tab.hasToggle && (
                      <button
                        onClick={() => handleToggle(row.id, row.is_active)}
                        title={row.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                          row.is_active
                            ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        <span className="material-icons-round text-[16px]">{row.is_active ? 'toggle_on' : 'toggle_off'}</span>
                      </button>
                    )}
                    {tab.hasDel && (
                      <button
                        onClick={() => handleDelete(row.id)}
                        title="Hapus"
                        className="w-8 h-8 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                      >
                        <span className="material-icons-round text-[16px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer count */}
        <div className="px-6 py-3 bg-white border-t border-slate-100">
          <span className="text-slate-400 text-sm font-['Public_Sans']">
            {loading ? '...' : `${data.length} data ${tab.label}`}
          </span>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddModal
          tab={tab}
          tabKey={activeTab}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { fetchData(); setActionMsg(`${tab.label} berhasil ditambahkan!`); setTimeout(() => setActionMsg(''), 4000); }}
          selectOptions={selectOptions}
        />
      )}
    </div>
  );
}
