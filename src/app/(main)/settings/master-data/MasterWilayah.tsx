'use client';

import { useState, useEffect, useCallback } from 'react';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';

/* ── Types ── */
interface Satelit {
  id: number;
  nama_satelit: string;
  kode_satelit: string;
}

interface Wilayah {
  id: number;
  kode_wilayah: string;
  nama_wilayah: string;
  satelit_id: number;
  nama_satelit: string;
  is_active: boolean;
  created_at?: string;
}

/* ── Add / Edit Modal ── */
function WilayahModal({
  mode, initial, satelitList, onClose, onSaved,
}: {
  mode: 'add' | 'edit';
  initial?: Wilayah;
  satelitList: Satelit[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    kode_wilayah: initial?.kode_wilayah || '',
    nama_wilayah: initial?.nama_wilayah || '',
    satelit_id: initial?.satelit_id?.toString() || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.kode_wilayah.trim() || !form.nama_wilayah.trim() || !form.satelit_id) return;
    setSaving(true);
    try {
      const body: any = {
        table: 'wilayah',
        ...form,
      };
      if (mode === 'edit' && initial) body.id = initial.id;

      const res = await fetch('/api/master-data', {
        method: mode === 'add' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        onSaved(mode === 'add' ? 'Wilayah berhasil ditambahkan!' : 'Wilayah berhasil diperbarui!');
      } else {
        onSaved(`Error: ${json.message || 'Gagal menyimpan'}`);
      }
    } catch {
      onSaved('Error: Terjadi kesalahan koneksi.');
    } finally {
      setSaving(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-0 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-icons-round text-sky-600 text-[20px]">{mode === 'add' ? 'add_location_alt' : 'edit_location_alt'}</span>
            <h3 className="text-lg font-bold text-slate-800 font-sans">{mode === 'add' ? 'Tambah Wilayah' : 'Edit Wilayah'}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
            <span className="material-icons-round text-slate-400 text-[20px]">close</span>
          </button>
        </div>
        {/* Form */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-sans">Kode Wilayah (mis: UT-1)</label>
            <input
              value={form.kode_wilayah}
              onChange={e => setForm(p => ({ ...p, kode_wilayah: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-300 font-sans"
              placeholder="UT-1"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-sans">Nama Wilayah</label>
            <input
              value={form.nama_wilayah}
              onChange={e => setForm(p => ({ ...p, nama_wilayah: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-300 font-sans"
              placeholder="Wilayah Utara 1"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-sans">Satelit</label>
            <select
              value={form.satelit_id}
              onChange={e => setForm(p => ({ ...p, satelit_id: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-300 font-sans appearance-none"
            >
              <option value="">-- Pilih Satelit --</option>
              {satelitList.map(s => (
                <option key={s.id} value={s.id}>{s.nama_satelit}</option>
              ))}
            </select>
          </div>
        </div>
        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-sans">Batal</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.kode_wilayah.trim() || !form.nama_wilayah.trim() || !form.satelit_id}
            className="px-5 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-sans flex items-center gap-1.5"
          >
            {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {mode === 'add' ? 'Tambah' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export function MasterWilayah() {
  const [satelitList, setSatelitList] = useState<Satelit[]>([]);
  const [selectedSatelit, setSelectedSatelit] = useState<number | null>(null);
  const [wilayahList, setWilayahList] = useState<Wilayah[]>([]);
  const [allWilayah, setAllWilayah] = useState<Wilayah[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitState, setSubmitState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; row?: Wilayah }>({ open: false, mode: 'add' });
  const [alertToggle, setAlertToggle] = useState<{ isOpen: boolean; row?: Wilayah }>({ isOpen: false });

  /* ── Load all data ── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rw, rs] = await Promise.all([
        fetch('/api/master-data?table=wilayah'),
        fetch('/api/master-data?table=satelit'),
      ]);
      const wd = await rw.json();
      const sd = await rs.json();
      const satelits: Satelit[] = (sd.data || []).filter((s: any) => s.is_active);
      const wilayahs: Wilayah[] = wd.data || [];
      setSatelitList(satelits);
      setAllWilayah(wilayahs);
      if (!selectedSatelit && satelits.length > 0) {
        setSelectedSatelit(satelits[0].id);
      }
    } catch {}
    finally { setLoading(false); }
  }, [selectedSatelit]);

  useEffect(() => { fetchAll(); }, []);

  /* ── Filter by selected satelit ── */
  useEffect(() => {
    if (selectedSatelit) {
      setWilayahList(allWilayah.filter(w => w.satelit_id === selectedSatelit));
    } else {
      setWilayahList(allWilayah);
    }
  }, [selectedSatelit, allWilayah]);

  /* ── Toggle ── */
  const confirmToggle = async () => {
    const row = alertToggle.row;
    if (!row) return;
    setAlertToggle({ isOpen: false });
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res = await fetch('/api/master-data', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'wilayah', id: row.id, is_active: !row.is_active }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchAll();
        setSubmitState({ status: 'success', message: `Status ${row.nama_wilayah} berhasil diubah.` });
      } else {
        setSubmitState({ status: 'error', message: json.message || 'Gagal mengubah status' });
      }
    } catch {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan koneksi.' });
    }
  };

  const selectedSatelitData = satelitList.find(s => s.id === selectedSatelit);
  const activeCount = wilayahList.filter(w => w.is_active).length;

  return (
    <div className="flex flex-col gap-5">
      <SubmitOverlay
        status={submitState.status}
        message={submitState.message}
        onClose={() => setSubmitState({ status: 'idle', message: '' })}
      />

      <AlertModal
        isOpen={alertToggle.isOpen}
        title={alertToggle.row?.is_active ? 'Nonaktifkan Wilayah?' : 'Aktifkan Wilayah?'}
        message={
          <span>
            Apakah Anda yakin ingin{' '}
            <strong>{alertToggle.row?.is_active ? 'menonaktifkan' : 'mengaktifkan'}</strong>{' '}
            <em>{alertToggle.row?.nama_wilayah}</em>?
          </span>
        }
        confirmText="Ya, Ubah Status"
        cancelText="Batal"
        onConfirm={confirmToggle}
        onCancel={() => setAlertToggle({ isOpen: false })}
      />

      {/* Satelit Chips */}
      <div className="flex flex-wrap gap-2">
        {satelitList.map(s => {
          const count = allWilayah.filter(w => w.satelit_id === s.id).length;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedSatelit(s.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border font-sans flex items-center gap-1.5 ${
                selectedSatelit === s.id
                  ? 'bg-sky-600 text-white border-sky-600 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:bg-sky-50'
              }`}
            >
              <span className="material-icons-round text-[14px]">church</span>
              {s.nama_satelit}
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                selectedSatelit === s.id
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-sky-600 rounded-full animate-spin" />
          <span className="text-slate-500 text-sm font-sans">Memuat data wilayah...</span>
        </div>
      ) : selectedSatelitData ? (
        <div className="bg-white rounded-xl shadow-sm border border-sky-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-sky-700 to-sky-500 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-icons-round text-white text-[22px]">map</span>
              <div>
                <div className="text-white font-bold font-sans text-base">{selectedSatelitData.nama_satelit}</div>
                <div className="text-sky-100 text-xs font-sans">{activeCount} wilayah aktif dari {wilayahList.length} total</div>
              </div>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-sm font-semibold rounded-lg transition-colors font-sans border border-white/20"
              >
                <span className="material-icons-round text-[16px]">print</span>
                Cetak
              </button>
              <button
                onClick={() => setModal({ open: true, mode: 'add' })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-lg transition-colors font-sans border border-white/30"
              >
                <span className="material-icons-round text-[16px]">add</span>
                Tambah Wilayah
              </button>
            </div>
          </div>

          {/* Wilayah Cards Grid */}
          <div className="p-5">
            {wilayahList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <span className="material-icons-round text-5xl text-slate-200">map</span>
                <p className="text-sm text-slate-400 font-sans">Belum ada wilayah untuk satelit ini</p>
                <button
                  onClick={() => setModal({ open: true, mode: 'add' })}
                  className="text-sky-600 text-sm font-semibold hover:underline font-sans flex items-center gap-1"
                >
                  <span className="material-icons-round text-[16px]">add</span>
                  Tambah Wilayah Pertama
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {wilayahList.map(w => (
                  <div
                    key={w.id}
                    className={`rounded-xl border p-4 transition-all hover:shadow-md relative group ${
                      w.is_active
                        ? 'border-sky-200 bg-gradient-to-br from-sky-50 to-white'
                        : 'border-slate-200 bg-slate-50 opacity-60'
                    }`}
                  >
                    {/* Status badge */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          w.is_active ? 'bg-sky-100' : 'bg-slate-200'
                        }`}>
                          <span className={`material-icons-round text-[20px] ${
                            w.is_active ? 'text-sky-600' : 'text-slate-400'
                          }`}>map</span>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800 font-sans">{w.nama_wilayah}</div>
                          <div className="text-xs text-slate-500 font-sans font-medium">{w.kode_wilayah}</div>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        w.is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        <span className="material-icons-round text-[10px]">{w.is_active ? 'check_circle' : 'cancel'}</span>
                        {w.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>

                    {/* Satelit info */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-sans mb-3">
                      <span className="material-icons-round text-[14px]">church</span>
                      {w.nama_satelit}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 print:hidden">
                      <button
                        onClick={() => setModal({ open: true, mode: 'edit', row: w })}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all font-sans"
                      >
                        <span className="material-icons-round text-[14px]">edit</span>
                        Edit
                      </button>
                      <button
                        onClick={() => setAlertToggle({ isOpen: true, row: w })}
                        className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all font-sans border ${
                          w.is_active
                            ? 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100'
                            : 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <span className="material-icons-round text-[14px]">{w.is_active ? 'toggle_off' : 'toggle_on'}</span>
                        {w.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Print-only header */}
      <div className="hidden print:block mb-2">
        <h1 className="text-xl font-black text-slate-900 font-sans">Master Data — Wilayah {selectedSatelitData?.nama_satelit ? `(${selectedSatelitData.nama_satelit})` : ''}</h1>
        <p className="text-xs text-slate-500 font-sans">Dicetak pada {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Modal */}
      {modal.open && (
        <WilayahModal
          mode={modal.mode}
          initial={modal.row}
          satelitList={satelitList}
          onClose={() => setModal({ open: false, mode: 'add' })}
          onSaved={(msg) => {
            fetchAll();
            setSubmitState({
              status: msg.startsWith('Error') ? 'error' : 'success',
              message: msg,
            });
          }}
        />
      )}

      {/* Print CSS */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm 15mm; }
          body * { visibility: hidden; }
          #printable-area, #printable-area * { visibility: visible !important; }
          #printable-area { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}
