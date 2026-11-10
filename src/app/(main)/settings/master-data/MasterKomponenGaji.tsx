'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

type SubTab = 'template' | 'coa' | 'regulasi';

export function MasterKomponenGaji() {
  const { showLoader, hideLoader } = useLoader();
  const [activeTab, setActiveTab] = useState<SubTab>('template');

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-[500px]">
      {/* Sub-tabs Header */}
      <div className="flex items-center gap-6 px-6 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
        <TabButton 
          active={activeTab === 'template'} 
          onClick={() => setActiveTab('template')} 
          icon="badge" 
          label="Template per Jabatan" 
        />
        <TabButton 
          active={activeTab === 'coa'} 
          onClick={() => setActiveTab('coa')} 
          icon="account_balance_wallet" 
          label="Mapping COA & Komponen" 
        />
        <TabButton 
          active={activeTab === 'regulasi'} 
          onClick={() => setActiveTab('regulasi')} 
          icon="gavel" 
          label="Regulasi Pemerintah (BPJS)" 
        />
      </div>

      {/* Content Area */}
      <div className="p-6">
        {activeTab === 'template' && <TemplateTab />}
        {activeTab === 'coa' && <CoaTab />}
        {activeTab === 'regulasi' && <RegulasiTab />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: string, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`py-4 flex items-center gap-2 border-b-2 transition-colors font-sans text-sm font-semibold ${
        active 
          ? 'border-emerald-500 text-emerald-700' 
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
      }`}
    >
      <span className="material-icons-round text-[18px]">{icon}</span>
      {label}
    </button>
  );
}

function TemplateTab() {
  const [data, setData] = useState<any[]>([]);
  const [jabatanList, setJabatanList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    jabatan_pegawai_id: '',
    pph21_method: 'Netto',
  });
  // Edit template detail
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  const fetchTemplates = () => {
    fetch('/api/settings/payroll-templates')
      .then(res => res.json())
      .then(res => {
        setData(res.success ? res.data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchTemplates();
    // Tarikin master jabatannya khusus buat isian dropdown modal
    fetch('/api/master-data?table=jabatan_pegawai_master')
      .then(res => res.json())
      .then(res => setJabatanList(res.success ? res.data : []))
      .catch(() => {});
  }, []);

  const openModal = () => {
    setForm({ jabatan_pegawai_id: '', pph21_method: 'Netto' });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.jabatan_pegawai_id) return setError('Jabatan wajib dipilih.');
    setSubmitting(true);
    setError('');
    // Auto-generate nama_template dari nama jabatan yang dipilih
    const jabatanDipilih = jabatanList.find((j: any) => j.id?.toString() === form.jabatan_pegawai_id);
    const namaTemplate = jabatanDipilih ? `Template ${jabatanDipilih.nama_jabatan}` : `Template Jabatan ${form.jabatan_pegawai_id}`;
    try {
      const res = await fetch('/api/settings/payroll-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jabatan_pegawai_id: parseInt(form.jabatan_pegawai_id),
          nama_template: namaTemplate,
          pph21_method: form.pph21_method,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowModal(false);
        setLoading(true);
        fetchTemplates();
      } else {
        setError(json.message || 'Gagal menyimpan template.');
      }
    } catch {
      setError('Terjadi kesalahan koneksi.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-slate-500 font-sans py-8 text-center">Memuat data template...</div>;

  // Jabatan yang sudah punya template tidak boleh dipilih lagi
  const usedJabatanIds = data.map(t => t.jabatan_pegawai_id?.toString());
  const availableJabatan = jabatanList.filter(j => !usedJabatanIds.includes(j.id?.toString()));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-800 font-sans">Template Gaji per Jabatan</h3>
          <p className="text-sm text-slate-500 font-sans">Pilih jabatan untuk mengatur komponen penerimaan dan potongannya.</p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors font-sans shadow-sm"
        >
          <span className="material-icons-round text-[18px]">add</span>
          Buat Template Baru
        </button>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
          <span className="material-icons-round text-5xl text-slate-300 mb-3 block">receipt_long</span>
          <p className="text-slate-500 font-sans text-sm">Belum ada template gaji yang dibuat.</p>
          <button
            onClick={openModal}
            className="mt-3 text-xs font-semibold text-emerald-600 hover:underline font-sans"
          >
            + Buat template pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {data.map(tpl => (
            <div key={tpl.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-slate-800 font-sans text-base">{tpl.nama_jabatan}</h4>
                  <div className="inline-flex items-center px-2 py-0.5 mt-1 bg-sky-50 text-sky-700 rounded text-xs font-semibold font-sans">
                    {tpl.active_komponen_count} Komponen Aktif
                  </div>
                </div>
                <div
                  onClick={() => setEditingTemplate(tpl)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  <span className="material-icons-round text-[20px]">edit</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
                <div className="flex justify-between text-sm font-sans">
                  <span className="text-slate-500">Pajak PPh 21</span>
                  <span className="font-semibold text-slate-700">{tpl.pph21_method}</span>
                </div>
                <div className="flex justify-between text-sm font-sans">
                  <span className="text-slate-500">Status</span>
                  <span className={`font-semibold ${tpl.is_active ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {tpl.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Template Detail Modal */}
      {editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={() => { setEditingTemplate(null); setLoading(true); fetchTemplates(); }}
        />
      )}

      {/* Modal Buat Template */}
      {showModal && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="bg-emerald-600 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <span className="material-icons-round text-white/80 text-[22px]">receipt_long</span>
                <h2 className="text-white font-bold font-sans text-base">Buat Template Gaji Baru</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white transition-colors">
                <span className="material-icons-round text-[20px]">close</span>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              {/* Jabatan */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">
                  Jabatan Pegawai <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.jabatan_pegawai_id}
                  onChange={e => setForm(f => ({ ...f, jabatan_pegawai_id: e.target.value }))}
                  className="px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-300 font-sans"
                >
                  <option value="">— Pilih Jabatan —</option>
                  {availableJabatan.map((j: any) => (
                    <option key={j.id} value={j.id}>{j.nama_jabatan}</option>
                  ))}
                </select>
                {availableJabatan.length === 0 && jabatanList.length > 0 && (
                  <p className="text-xs text-amber-600">Semua jabatan sudah memiliki template.</p>
                )}
              </div>

              {/* Nama template otomatis — tidak perlu diisi manual */}
              <div className="px-3 py-2.5 bg-slate-50/80 border border-slate-100 rounded-lg">
                <p className="text-[11px] text-slate-400 font-sans flex items-center gap-1">
                  <span className="material-icons-round text-[13px]">info</span>
                  Nama template akan dibuat otomatis dari nama jabatan yang dipilih.
                </p>
              </div>

              {/* Metode PPh21 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">
                  Metode PPh 21
                </label>
                <select
                  value={form.pph21_method}
                  onChange={e => setForm(f => ({ ...f, pph21_method: e.target.value }))}
                  className="px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-300 font-sans"
                >
                  <option value="Netto">Netto (dipotong dari gaji)</option>
                  <option value="Gross Up">Gross Up (ditanggung gereja)</option>
                  <option value="Ditanggung Gereja">Ditanggung Gereja</option>
                </select>
              </div>

              {error && (
                <div className="px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
                  <span className="material-icons-round text-rose-500 text-[16px]">error_outline</span>
                  <p className="text-xs text-rose-600 font-sans">{error}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white font-sans transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-semibold font-sans transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {submitting && <span className="material-icons-round text-[16px] animate-spin">sync</span>}
                Simpan Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ── Edit Template Detail Modal ─────────────────────────────────────────────
function EditTemplateModal({ template, onClose, onSaved }: {
  template: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<any[]>([]);
  const [allKomponen, setAllKomponen] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // local overrides: komponen_id → { is_active, nominal_default, satuan }
  const [overrides, setOverrides] = useState<Record<number, { is_active: boolean; nominal_default: number; satuan: string }>>({});

  useEffect(() => {
    Promise.all([
      fetch(`/api/settings/payroll-templates/${template.id}`).then(r => r.json()),
      fetch('/api/settings/payroll-components').then(r => r.json()),
    ]).then(([tplRes, kompRes]) => {
      const detailRows: any[] = tplRes.success ? tplRes.data.detail : [];
      const komponen: any[] = kompRes.success ? kompRes.data : [];
      setDetail(detailRows);
      setAllKomponen(komponen);
      // Build initial overrides from existing detail
      const init: Record<number, any> = {};
      detailRows.forEach((d: any) => {
        init[d.komponen_id] = {
          is_active: d.is_active,
          nominal_default: d.nominal_default ?? 0,
          satuan: d.satuan ?? 'bulan',
        };
      });
      // Komponen not yet in template → default inactive
      komponen.forEach((k: any) => {
        if (!init[k.id]) {
          init[k.id] = { is_active: false, nominal_default: 0, satuan: 'bulan' };
        }
      });
      setOverrides(init);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [template.id]);

  const toggle = (id: number) => setOverrides(prev => ({
    ...prev,
    [id]: { ...prev[id], is_active: !prev[id]?.is_active }
  }));

  const setNominal = (id: number, val: string) => setOverrides(prev => ({
    ...prev,
    [id]: { ...prev[id], nominal_default: parseFloat(val) || 0 }
  }));

  const setSatuan = (id: number, val: string) => setOverrides(prev => ({
    ...prev,
    [id]: { ...prev[id], satuan: val }
  }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const detailPayload = allKomponen.map(k => ({
      komponen_id: k.id,
      is_active: overrides[k.id]?.is_active ?? false,
      nominal_default: overrides[k.id]?.nominal_default ?? 0,
      satuan: overrides[k.id]?.satuan ?? 'bulan',
      hari_kerja_default: 22,
    }));
    try {
      const res = await fetch(`/api/settings/payroll-templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ detail: detailPayload }),
      });
      const json = await res.json();
      if (json.success) {
        onSaved();
      } else {
        setError(json.message || 'Gagal menyimpan.');
      }
    } catch {
      setError('Terjadi kesalahan koneksi.');
    } finally {
      setSaving(false);
    }
  };

  const penerimaan = allKomponen.filter(k => k.tipe === 'Penerimaan');
  const potongan   = allKomponen.filter(k => k.tipe === 'Potongan');

  const renderRows = (items: any[]) => items.map(k => {
    const ov = overrides[k.id] ?? { is_active: false, nominal_default: 0, satuan: 'bulan' };
    return (
      <div key={k.id} className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 transition-colors ${ov.is_active ? 'bg-emerald-50/30' : 'bg-white'}`}>
        {/* Toggle */}
        <button
          onClick={() => toggle(k.id)}
          className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${ov.is_active ? 'bg-emerald-500' : 'bg-slate-200'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${ov.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`material-icons-round text-[15px] ${k.is_system ? 'text-slate-400' : 'text-slate-300'}`}>
              {k.is_system ? 'lock' : 'drag_indicator'}
            </span>
            <span className={`text-sm font-sans font-semibold ${ov.is_active ? 'text-slate-800' : 'text-slate-400'}`}>
              {k.nama_komponen}
            </span>
            {k.is_employer_portion && (
              <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-sans">Beban Gereja</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 font-sans ml-5">
            {k.calculation_type === 'flat_nominal' && 'Nominal tetap'}
            {k.calculation_type === 'per_hari' && 'Per hari kerja'}
            {k.calculation_type === 'pct_gaji_pokok' && '% dari Gaji Pokok'}
            {k.calculation_type === 'pct_global_bpjs' && '% tarif BPJS (otomatis)'}
          </div>
        </div>

        {/* Nominal / Rate */}
        {ov.is_active && (k.calculation_type === 'flat_nominal' || k.calculation_type === 'per_hari') && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs text-slate-400">Rp</span>
            <input
              type="number"
              value={ov.nominal_default || ''}
              onChange={e => setNominal(k.id, e.target.value)}
              placeholder="0"
              className="w-28 px-2 py-1.5 text-right text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 font-sans"
            />
            {k.calculation_type === 'per_hari' && (
              <span className="text-xs text-slate-400">/ hari</span>
            )}
          </div>
        )}
        {ov.is_active && (k.calculation_type === 'pct_global_bpjs' || k.calculation_type === 'pct_gaji_pokok') && (
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded font-sans">Otomatis</span>
        )}
      </div>
    );
  });

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-600 px-6 py-4 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-white font-bold font-sans text-base">Edit Komponen — {template.nama_jabatan}</h2>
            <p className="text-white/70 text-xs font-sans">{template.nama_template} · {template.pph21_method}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <span className="material-icons-round text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 text-center text-slate-500 font-sans">Memuat komponen...</div>
          ) : (
            <div className="flex flex-col">
              {/* Info */}
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs text-slate-500 font-sans">
                Aktifkan komponen yang berlaku untuk jabatan ini dan isi nominal default-nya.
                Komponen BPJS / persen dihitung otomatis dari tarif global.
              </div>

              {/* Penerimaan */}
              <div>
                <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider font-sans">Penerimaan</span>
                </div>
                {renderRows(penerimaan)}
              </div>

              {/* Potongan */}
              <div>
                <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider font-sans">Potongan</span>
                </div>
                {renderRows(potongan)}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center flex-shrink-0">
          {error ? (
            <span className="text-xs text-rose-600 font-sans">{error}</span>
          ) : (
            <span className="text-xs text-slate-400 font-sans">
              {Object.values(overrides).filter(o => o.is_active).length} komponen aktif
            </span>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white font-sans transition-colors">
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-semibold font-sans transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <span className="material-icons-round text-[16px] animate-spin">sync</span>}
              Simpan Komponen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CoaTab() {
  const [data, setData] = useState<any[]>([]);
  const [coaList, setCoaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<any>(null);

  const fetchKomponen = () => {
    fetch('/api/settings/payroll-components')
      .then(res => res.json())
      .then(res => {
        setData(res.success ? res.data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchKomponen();
    fetch('/api/master-data?table=buku_besar_coa')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          // Hanya ambil akun detail
          setCoaList(res.data.filter((c: any) => c.tipe_akun === 'Detail'));
        }
      })
      .catch(() => {});
  }, []);

  if (loading) return <div className="text-slate-500 font-sans">Memuat data komponen...</div>;

  const penerimaan = data.filter(d => d.tipe === 'Penerimaan');
  const potongan = data.filter(d => d.tipe === 'Potongan');

  const renderTable = (items: any[]) => (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-slate-50/50 border-b border-slate-100">
          <th className="py-3 px-4 font-bold text-xs text-slate-500 uppercase tracking-wider font-sans">Komponen Gaji</th>
          <th className="py-3 px-4 font-bold text-xs text-slate-500 uppercase tracking-wider font-sans">COA Debit</th>
          <th className="py-3 px-4 font-bold text-xs text-slate-500 uppercase tracking-wider font-sans">COA Kredit</th>
          <th className="py-3 px-4 font-bold text-xs text-slate-500 uppercase tracking-wider text-right font-sans">Aksi</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {items.map(item => (
          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
            <td className="py-3 px-4">
              <div className="flex items-center gap-2">
                <span className="material-icons-round text-slate-400 text-[18px]">
                  {item.is_system ? 'lock' : 'payments'}
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-700 font-sans">{item.nama_komponen}</div>
                  {item.is_employer_portion && (
                     <div className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded inline-block mt-0.5">Employer Portion (Beban Gereja)</div>
                  )}
                </div>
              </div>
            </td>
            <td className="py-3 px-4">
              {item.coa_debit_kode ? (
                <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-semibold font-sans">
                  <span className="opacity-60">{item.coa_debit_kode}</span>
                  {item.coa_debit_nama}
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">Belum diset</span>
              )}
            </td>
            <td className="py-3 px-4">
              {item.coa_kredit_kode ? (
                <div className="inline-flex items-center gap-2 bg-rose-50 text-rose-700 px-2.5 py-1 rounded-md text-xs font-semibold font-sans">
                  <span className="opacity-60">{item.coa_kredit_kode}</span>
                  {item.coa_kredit_nama}
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">Belum diset</span>
              )}
            </td>
            <td className="py-3 px-4 text-right">
              <button onClick={() => setEditItem(item)} className="text-slate-400 hover:text-emerald-600 transition-colors">
                <span className="material-icons-round text-[20px]">edit</span>
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-800 font-sans">Mapping Akun (COA) Jurnal Otomatis</h3>
          <p className="text-sm text-slate-500 font-sans">Konfigurasi akun untuk pencatatan jurnal penggajian terintegrasi.</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2 font-sans">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Penerimaan
          </h4>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {renderTable(penerimaan)}
          </div>
        </div>

        <div>
          <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2 font-sans">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Potongan
          </h4>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {renderTable(potongan)}
          </div>
        </div>
      </div>

      {/* Edit COA Modal */}
      {editItem && (
        <EditCoaModal
          item={editItem}
          coaList={coaList}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); setLoading(true); fetchKomponen(); }}
        />
      )}
    </div>
  );
}

// ── Edit COA Modal ─────────────────────────────────────────────
function EditCoaModal({ item, coaList, onClose, onSaved }: { item: any; coaList: any[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    coa_debit_id: item.coa_debit_id?.toString() || '',
    coa_kredit_id: item.coa_kredit_id?.toString() || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/settings/payroll-components/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coa_debit_id: form.coa_debit_id ? parseInt(form.coa_debit_id) : null,
          coa_kredit_id: form.coa_kredit_id ? parseInt(form.coa_kredit_id) : null,
        }),
      });
      const json = await res.json();
      if (json.success) onSaved();
      else setError(json.message || 'Gagal menyimpan mapping COA.');
    } catch {
      setError('Terjadi kesalahan koneksi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-slate-800 px-6 py-4 flex justify-between items-center">
          <h2 className="text-white font-bold font-sans text-base">Edit Mapping COA</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <span className="material-icons-round text-[20px]">close</span>
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="mb-2">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 font-sans">Komponen Gaji</div>
            <div className="font-semibold text-slate-800 text-lg font-sans">{item.nama_komponen}</div>
            <div className="text-sm text-slate-500 font-sans">{item.tipe}</div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">COA Debit</label>
            <select
              value={form.coa_debit_id}
              onChange={e => setForm(f => ({ ...f, coa_debit_id: e.target.value }))}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-emerald-300 outline-none w-full"
            >
              <option value="">— Kosongkan / Belum Diset —</option>
              {coaList.map(c => (
                <option key={c.id} value={c.id}>{c.kode_akun} - {c.nama_akun}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">COA Kredit</label>
            <select
              value={form.coa_kredit_id}
              onChange={e => setForm(f => ({ ...f, coa_kredit_id: e.target.value }))}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-emerald-300 outline-none w-full"
            >
              <option value="">— Kosongkan / Belum Diset —</option>
              {coaList.map(c => (
                <option key={c.id} value={c.id}>{c.kode_akun} - {c.nama_akun}</option>
              ))}
            </select>
          </div>

          {error && <div className="text-rose-500 text-xs mt-2 font-sans">{error}</div>}
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white transition-colors">Batal</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan Mapping'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RegulasiTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/payroll-global')
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data.length > 0) {
          setData(res.data[0]); // ambil yang terbaru
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500 font-sans">Memuat data regulasi...</div>;
  if (!data) return <div className="text-slate-500 font-sans">Data regulasi belum diset. Jalankan seed database.</div>;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex gap-3">
        <span className="material-icons-round text-emerald-600">info</span>
        <div>
          <h3 className="text-emerald-800 font-bold font-sans text-sm">Tarif Saat Ini (Berlaku sejak {new Date(data.effective_date).toLocaleDateString('id-ID')})</h3>
          <p className="text-emerald-700 text-sm font-sans mt-1">
            Persentase ini akan digunakan otomatis pada perhitungan komponen gaji yang diset <strong>pct_global_bpjs</strong>.
            Tarif dinyatakan dalam persentase (%).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* BPJS Ketenagakerjaan */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <h4 className="font-bold text-slate-800 font-sans flex items-center gap-2">
              <span className="material-icons-round text-amber-500 text-[18px]">engineering</span>
              BPJS Ketenagakerjaan (TK)
            </h4>
          </div>
          <div className="p-4 flex flex-col gap-4">
             <div className="flex justify-between items-center pb-3 border-b border-slate-100">
               <div>
                 <div className="text-sm font-semibold text-slate-700 font-sans">Jaminan Hari Tua (JHT)</div>
                 <div className="text-xs text-slate-500 font-sans">Total: 5.7%</div>
               </div>
               <div className="text-right text-sm font-sans">
                 <div>Employer: <span className="font-bold">{data.bpjs_tk_jht_employer_pct}%</span></div>
                 <div>Employee: <span className="font-bold">{data.bpjs_tk_jht_employee_pct}%</span></div>
               </div>
             </div>
             <div className="flex justify-between items-center pb-3 border-b border-slate-100">
               <div>
                 <div className="text-sm font-semibold text-slate-700 font-sans">Jaminan Pensiun (JP)</div>
                 <div className="text-xs text-slate-500 font-sans">Total: 3.0%</div>
               </div>
               <div className="text-right text-sm font-sans">
                 <div>Employer: <span className="font-bold">{data.bpjs_tk_jp_employer_pct}%</span></div>
                 <div>Employee: <span className="font-bold">{data.bpjs_tk_jp_employee_pct}%</span></div>
               </div>
             </div>
             <div className="flex justify-between items-center pb-3 border-b border-slate-100">
               <div>
                 <div className="text-sm font-semibold text-slate-700 font-sans">JKK &amp; JKM</div>
                 <div className="text-xs text-slate-500 font-sans">Sepenuhnya ditanggung gereja</div>
               </div>
               <div className="text-right text-sm font-sans">
                 <div>JKK (Employer): <span className="font-bold">{data.bpjs_tk_jkk_pct}%</span></div>
                 <div>JKM (Employer): <span className="font-bold">{data.bpjs_tk_jkm_pct}%</span></div>
               </div>
             </div>
             <div className="flex justify-between items-center">
               <div>
                 <div className="text-sm font-semibold text-slate-700 font-sans">JKP — Kehilangan Pekerjaan</div>
                 <div className="text-xs text-slate-500 font-sans">PP 37/2021 · Berlaku untuk PK tertentu</div>
               </div>
               <div className="text-right text-sm font-sans">
                 <div>Employer: <span className="font-bold">0.22%</span></div>
                 <div>Employee: <span className="font-bold">0.14%</span></div>
               </div>
             </div>

          </div>
        </div>

        {/* BPJS Kesehatan */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-fit">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <h4 className="font-bold text-slate-800 font-sans flex items-center gap-2">
              <span className="material-icons-round text-emerald-500 text-[18px]">health_and_safety</span>
              BPJS Kesehatan
            </h4>
          </div>
          <div className="p-4 flex flex-col gap-4">
             <div className="flex justify-between items-center">
               <div>
                 <div className="text-sm font-semibold text-slate-700 font-sans">Iuran BPJS Kesehatan</div>
                 <div className="text-xs text-slate-500 font-sans">Total: 5.0%</div>
               </div>
               <div className="text-right text-sm font-sans">
                 <div>Employer: <span className="font-bold">{data.bpjs_kes_employer_pct}%</span></div>
                 <div>Employee: <span className="font-bold">{data.bpjs_kes_employee_pct}%</span></div>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
