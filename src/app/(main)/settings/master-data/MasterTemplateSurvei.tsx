'use client';

import { useState, useEffect, useCallback } from 'react';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';

interface JenisKegiatanRow {
  id: number;
  nama_jenis_kegiatan: string;
  kategori: string;
  template_id: number | null;
  is_active: boolean;
  has_template: boolean;
  jumlah_pertanyaan: number;
}

interface Pertanyaan {
  id?: number;
  urutan: number;
  teks_pertanyaan: string;
  tipe_jawaban: 'skala' | 'teks';
  is_required: boolean;
}

const DEFAULT_PERTANYAAN: Pertanyaan[] = [
  { urutan: 1, teks_pertanyaan: 'Seberapa puas Anda dengan kegiatan ini secara keseluruhan?', tipe_jawaban: 'skala', is_required: true },
  { urutan: 2, teks_pertanyaan: 'Seberapa baik pelayanan dan fasilitas yang disediakan?', tipe_jawaban: 'skala', is_required: true },
  { urutan: 3, teks_pertanyaan: 'Masukan atau saran untuk perbaikan ke depan:', tipe_jawaban: 'teks', is_required: false },
];

const KATEGORI_ORDER = ['Ibadah Rutin', 'Event & Perayaan', 'Edukasi & Pelatihan', 'Sosial & Diakonia', 'Sakramen & Layanan'];

export function MasterTemplateSurvei() {
  const [data, setData] = useState<JenisKegiatanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<JenisKegiatanRow | null>(null);
  const [submitState, setSubmitState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });
  const [alertToggle, setAlertToggle] = useState<{ isOpen: boolean; item: JenisKegiatanRow | null }>({ isOpen: false, item: null });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/survei-template');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e) {
      console.error('Gagal memuat data template survei', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggle = async () => {
    const item = alertToggle.item;
    if (!item) return;
    setAlertToggle({ isOpen: false, item: null });
    setSubmitState({ status: 'loading', message: '' });

    try {
      const newActive = !item.is_active;
      // If no template yet but toggling off, we need to create template first (PATCH handles this)
      const res = await fetch('/api/settings/survei-template', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jenis_kegiatan_id: item.id, is_active: newActive }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchData();
        setSubmitState({ status: 'success', message: json.message || `Survei otomatis ${newActive ? 'diaktifkan' : 'dinonaktifkan'}` });
      } else {
        setSubmitState({ status: 'error', message: json.message || 'Gagal mengubah status' });
      }
    } catch {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan koneksi' });
    }
  };

  // Group by kategori
  const grouped = KATEGORI_ORDER.map(kat => ({
    kategori: kat,
    items: data.filter(d => d.kategori === kat),
  })).filter(g => g.items.length > 0);

  // Also include items with unknown/null categories
  const knownKats = new Set(KATEGORI_ORDER);
  const uncategorized = data.filter(d => !knownKats.has(d.kategori));
  if (uncategorized.length > 0) {
    grouped.push({ kategori: 'Lainnya', items: uncategorized });
  }

  if (loading) {
    return (
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-[400px]">
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="w-7 h-7 border-4 border-slate-200 border-t-rose-500 rounded-full animate-spin" />
          <span className="text-slate-500 text-sm font-['Public_Sans']">Memuat data template survei...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <SubmitOverlay
        status={submitState.status}
        message={submitState.message}
        onClose={() => setSubmitState({ status: 'idle', message: '' })}
      />

      <AlertModal
        isOpen={alertToggle.isOpen}
        title={alertToggle.item?.is_active ? 'Nonaktifkan Survei Otomatis?' : 'Aktifkan Survei Otomatis?'}
        message={
          <span>
            {alertToggle.item?.is_active ? (
              <>
                Jika dinonaktifkan, jemaat yang hadir di kegiatan tipe <strong>{alertToggle.item?.nama_jenis_kegiatan}</strong> <em>tidak akan</em> mendapat survei otomatis saat kegiatan selesai.
              </>
            ) : (
              <>
                Survei otomatis akan dikirim ke jemaat yang hadir di kegiatan tipe <strong>{alertToggle.item?.nama_jenis_kegiatan}</strong> setiap kali kegiatan selesai.
              </>
            )}
          </span>
        }
        confirmText={alertToggle.item?.is_active ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
        cancelText="Batal"
        onConfirm={handleToggle}
        onCancel={() => setAlertToggle({ isOpen: false, item: null })}
      />

      {/* Header band */}
      <div className="bg-rose-600 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <span className="material-icons-round text-white text-[22px]">quiz</span>
          </div>
          <div>
            <div className="text-white font-bold font-['Inter'] text-base leading-tight">Template Survei</div>
            <div className="text-white/70 text-xs font-['Public_Sans'] leading-tight">
              {data.length} jenis kegiatan · {data.filter(d => d.has_template).length} template dikustomisasi
            </div>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
        <span className="material-icons-round text-rose-500 text-[18px] mt-0.5">info</span>
        <div className="text-xs text-rose-700 font-['Public_Sans'] leading-relaxed">
          <strong>Cara kerja:</strong> Setiap jenis kegiatan bisa punya template survei sendiri. 
          Ketika kegiatan selesai (Menunggu LPJ), survei otomatis dikirim ke jemaat yang hadir menggunakan pertanyaan dari template. 
          Jika belum ada template custom, survei menggunakan <strong>3 pertanyaan default</strong> (2 skala + 1 teks).
          Gunakan toggle untuk menonaktifkan pengiriman survei otomatis per jenis kegiatan.
        </div>
      </div>

      {/* Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        {grouped.map(group => (
          <div key={group.kategori}>
            {/* Category header */}
            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider font-['Inter']">{group.kategori}</span>
              <span className="text-[10px] text-slate-400 font-['Public_Sans']">({group.items.length})</span>
            </div>

            {/* Rows */}
            {group.items.map(item => (
              <div
                key={item.id}
                className="flex items-center px-5 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors gap-4"
              >
                {/* Toggle */}
                <button
                  onClick={() => setAlertToggle({ isOpen: true, item })}
                  className={`w-10 h-[22px] rounded-full transition-colors flex-shrink-0 relative ${
                    item.has_template && !item.is_active ? 'bg-slate-200' : 'bg-rose-500'
                  }`}
                  title={item.is_active ? 'Survei otomatis aktif' : 'Survei otomatis nonaktif'}
                >
                  <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    item.has_template && !item.is_active ? 'translate-x-0' : 'translate-x-[18px]'
                  }`} />
                </button>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700 font-['Public_Sans'] truncate">{item.nama_jenis_kegiatan}</div>
                </div>

                {/* Status badge */}
                <div className="flex-shrink-0">
                  {item.has_template && !item.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-400">
                      <span className="material-icons-round text-[12px]">cancel</span>
                      Nonaktif
                    </span>
                  ) : item.has_template ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
                      <span className="material-icons-round text-[12px]">tune</span>
                      Custom ({item.jumlah_pertanyaan} pertanyaan)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">
                      <span className="material-icons-round text-[12px]">check_circle</span>
                      Default (3 pertanyaan)
                    </span>
                  )}
                </div>

                {/* Edit button */}
                <button
                  onClick={() => setEditingItem(item)}
                  className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors flex-shrink-0"
                  title="Edit Template Pertanyaan"
                >
                  <span className="material-icons-round text-[20px]">edit</span>
                </button>
              </div>
            ))}
          </div>
        ))}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-slate-400 text-xs font-['Public_Sans']">
            {data.length} jenis kegiatan
          </span>
        </div>
      </div>

      {/* Edit Template Modal */}
      {editingItem && (
        <EditTemplateModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => { setEditingItem(null); setLoading(true); fetchData(); }}
        />
      )}
    </div>
  );
}

/* ── Edit Template Modal ────────────────────────────────────────────────── */
function EditTemplateModal({ item, onClose, onSaved }: {
  item: JenisKegiatanRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pertanyaan, setPertanyaan] = useState<Pertanyaan[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch existing template detail
  useEffect(() => {
    fetch(`/api/settings/survei-template?jenis_kegiatan_id=${item.id}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          if (json.data.template) {
            setIsActive(json.data.template.is_active);
            setPertanyaan(json.data.pertanyaan.length > 0 ? json.data.pertanyaan : [...DEFAULT_PERTANYAAN]);
          } else {
            // No template yet, use defaults
            setIsActive(true);
            setPertanyaan([...DEFAULT_PERTANYAAN]);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setPertanyaan([...DEFAULT_PERTANYAAN]);
        setLoading(false);
      });
  }, [item.id]);

  const addPertanyaan = () => {
    setPertanyaan(prev => [
      ...prev,
      { urutan: prev.length + 1, teks_pertanyaan: '', tipe_jawaban: 'skala', is_required: true },
    ]);
  };

  const removePertanyaan = (index: number) => {
    setPertanyaan(prev => prev.filter((_, i) => i !== index).map((p, i) => ({ ...p, urutan: i + 1 })));
  };

  const updatePertanyaan = (index: number, field: keyof Pertanyaan, value: any) => {
    setPertanyaan(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const resetToDefault = () => {
    setPertanyaan([...DEFAULT_PERTANYAAN]);
  };

  const handleSave = async () => {
    // Validation
    const empty = pertanyaan.findIndex(p => !p.teks_pertanyaan.trim());
    if (empty !== -1) {
      setError(`Pertanyaan ke-${empty + 1} tidak boleh kosong`);
      return;
    }
    if (pertanyaan.length === 0) {
      setError('Minimal 1 pertanyaan wajib diisi');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/settings/survei-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenis_kegiatan_id: item.id,
          is_active: isActive,
          pertanyaan: pertanyaan.map((p, i) => ({
            urutan: i + 1,
            teks_pertanyaan: p.teks_pertanyaan.trim(),
            tipe_jawaban: p.tipe_jawaban,
            is_required: p.is_required,
          })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        onSaved();
      } else {
        setError(json.message || 'Gagal menyimpan template');
      }
    } catch {
      setError('Terjadi kesalahan koneksi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-rose-600 px-6 py-4 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-white font-bold font-['Inter'] text-base">Template Survei</h2>
            <p className="text-white/70 text-xs font-['Public_Sans'] mt-0.5">{item.nama_jenis_kegiatan} · {item.kategori}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <span className="material-icons-round text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 text-center text-slate-500 font-['Public_Sans']">Memuat pertanyaan template...</div>
          ) : (
            <div className="flex flex-col">
              {/* Toggle active */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-700 font-['Inter']">Survei Otomatis Aktif</div>
                  <div className="text-xs text-slate-400 font-['Public_Sans'] mt-0.5">
                    {isActive 
                      ? 'Survei akan otomatis dikirim ke jemaat saat kegiatan jenis ini selesai'
                      : 'Jemaat tidak akan mendapat survei otomatis untuk kegiatan jenis ini'}
                  </div>
                </div>
                <button
                  onClick={() => setIsActive(prev => !prev)}
                  className={`w-12 h-[26px] rounded-full transition-colors flex-shrink-0 relative ${
                    isActive ? 'bg-rose-500' : 'bg-slate-200'
                  }`}
                >
                  <span className={`absolute top-[3px] left-[3px] w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    isActive ? 'translate-x-[22px]' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Pertanyaan list */}
              <div className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-icons-round text-rose-500 text-[18px]">list_alt</span>
                  <span className="text-sm font-bold text-slate-700 font-['Inter']">Daftar Pertanyaan ({pertanyaan.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={resetToDefault}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-['Public_Sans']"
                  >
                    <span className="material-icons-round text-[14px]">restart_alt</span>
                    Reset Default
                  </button>
                  <button
                    onClick={addPertanyaan}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-['Public_Sans']"
                  >
                    <span className="material-icons-round text-[14px]">add</span>
                    Tambah
                  </button>
                </div>
              </div>

              {pertanyaan.length === 0 ? (
                <div className="px-6 pb-6 text-center">
                  <div className="py-8 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                    <span className="material-icons-round text-4xl text-slate-300 mb-2 block">quiz</span>
                    <p className="text-sm text-slate-400 font-['Public_Sans']">Belum ada pertanyaan.</p>
                    <button onClick={addPertanyaan} className="mt-2 text-xs font-semibold text-rose-600 hover:underline font-['Public_Sans']">
                      + Tambah pertanyaan pertama
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-6 pb-4 flex flex-col gap-3">
                  {pertanyaan.map((p, index) => (
                    <div key={index} className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
                      {/* Header row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-xs font-bold font-['Inter']">
                            {index + 1}
                          </span>
                          <span className="text-xs text-slate-400 font-['Public_Sans'] uppercase font-bold tracking-wider">
                            Pertanyaan {index + 1}
                          </span>
                        </div>
                        {pertanyaan.length > 1 && (
                          <button
                            onClick={() => removePertanyaan(index)}
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                            title="Hapus pertanyaan"
                          >
                            <span className="material-icons-round text-[18px]">delete_outline</span>
                          </button>
                        )}
                      </div>

                      {/* Teks pertanyaan */}
                      <textarea
                        value={p.teks_pertanyaan}
                        onChange={(e) => updatePertanyaan(index, 'teks_pertanyaan', e.target.value)}
                        placeholder="Tulis pertanyaan survei..."
                        rows={2}
                        className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-300 font-['Public_Sans'] resize-none"
                      />

                      {/* Options row */}
                      <div className="flex items-center gap-4">
                        {/* Tipe jawaban */}
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-slate-400 font-bold uppercase font-['Inter']">Tipe:</label>
                          <select
                            value={p.tipe_jawaban}
                            onChange={(e) => updatePertanyaan(index, 'tipe_jawaban', e.target.value)}
                            className="px-2 py-1.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300 font-['Public_Sans']"
                          >
                            <option value="skala">⭐ Skala 1-5</option>
                            <option value="teks">📝 Teks Bebas</option>
                          </select>
                        </div>

                        {/* Wajib toggle */}
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-slate-400 font-bold uppercase font-['Inter']">Wajib:</label>
                          <button
                            onClick={() => updatePertanyaan(index, 'is_required', !p.is_required)}
                            className={`w-9 h-5 rounded-full transition-colors relative ${
                              p.is_required ? 'bg-rose-500' : 'bg-slate-200'
                            }`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              p.is_required ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center flex-shrink-0">
          {error ? (
            <div className="flex items-center gap-2 text-xs text-rose-600 font-['Public_Sans']">
              <span className="material-icons-round text-[14px]">error_outline</span>
              {error}
            </div>
          ) : (
            <span className="text-xs text-slate-400 font-['Public_Sans']">
              {pertanyaan.length} pertanyaan · {pertanyaan.filter(p => p.tipe_jawaban === 'skala').length} skala, {pertanyaan.filter(p => p.tipe_jawaban === 'teks').length} teks
            </span>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white font-['Public_Sans'] transition-colors">
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-lg text-sm font-semibold font-['Public_Sans'] transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <span className="material-icons-round text-[16px] animate-spin">sync</span>}
              Simpan Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
