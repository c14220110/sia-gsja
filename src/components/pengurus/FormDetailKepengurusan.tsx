'use client';

import React from 'react';

export interface JabatanEntry {
  lingkup: 'Pusat' | 'Satelit' | 'Komisi' | 'Departemen';
  lokasi_satelit_id: string;
  komisi_id: string;
  departemen_id: string;
  jabatan_id: string;
  periode_id: string;
  tanggal_mulai: string;
  jalur_pengangkatan: 'Penunjukan' | 'Pemilihan';
  catatan: string;
}

export const defaultJabatanEntry = (): JabatanEntry => ({
  lingkup: 'Satelit',
  lokasi_satelit_id: '',
  komisi_id: '',
  departemen_id: '',
  jabatan_id: '',
  periode_id: '',
  tanggal_mulai: '',
  jalur_pengangkatan: 'Penunjukan',
  catatan: '',
});

// Jabatan yang diizinkan per lingkup (substring match dengan nama di tabel jabatan)
export const JABATAN_PER_LINGKUP: Record<string, string[]> = {
  Pusat:     ['Gembala Sidang', 'Wakil Gembala', 'Majelis', 'Sekretaris', 'Bendahara', 'Komisaris'],
  Satelit:   ['Gembala Satelit', 'Wakil Gembala', 'Sekretaris', 'Bendahara', 'Staf Pastoral'],
  Komisi:    ['Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara', 'Penasehat'],
  Departemen:['Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara', 'Penasehat'],
};

interface Props {
  data: JabatanEntry;
  onChange: (updated: JabatanEntry) => void;
  jabatanOptions: any[];
  satelitOptions: any[];
  komisiOptions: any[];
  departemenOptions: any[];
  periodeOptions: any[];
  defaultSatelitId?: string; // from selected jemaat
}

export function FormDetailKepengurusan({
  data,
  onChange,
  jabatanOptions,
  satelitOptions,
  komisiOptions,
  departemenOptions,
  periodeOptions,
  defaultSatelitId,
}: Props) {
  const handleChange = (name: keyof JabatanEntry, value: string) => {
    let overrides: Partial<JabatanEntry> = {};
    if (name === 'lingkup') {
      overrides = { komisi_id: '', departemen_id: '', jabatan_id: '' };
      // Reset satelit untuk lingkup yang tidak butuh satelit
      if (value === 'Departemen') {
        overrides.lokasi_satelit_id = ''; // Departemen tidak terikat satelit
      } else if (value !== 'Pusat' && defaultSatelitId && !data.lokasi_satelit_id) {
        overrides.lokasi_satelit_id = defaultSatelitId;
      }
    }
    // Reset komisi_id jika satelit berubah
    if (name === 'lokasi_satelit_id') {
      overrides = { komisi_id: '' };
    }
    onChange({ ...data, [name]: value, ...overrides } as JabatanEntry);
  };

  const allowedNames = JABATAN_PER_LINGKUP[data.lingkup] ?? [];
  const filteredJabatan = jabatanOptions.filter(j =>
    allowedNames.some(name => j.nama_jabatan.toLowerCase().includes(name.toLowerCase()))
  );

  // Filter komisi hanya yang milik satelit yang dipilih
  const filteredKomisi = data.lokasi_satelit_id
    ? komisiOptions.filter(k => k.satelit_id?.toString() === data.lokasi_satelit_id)
    : komisiOptions;

  return (
    <div className="flex flex-col gap-5">

      {/* STEP 1: Lingkup */}
      <div className="w-full flex-col gap-1 flex">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">1</span>
          <label className="text-slate-700 text-xs font-bold font-sans uppercase leading-4 tracking-wider">Lingkup Kepengurusan</label>
        </div>
        <select
          value={data.lingkup}
          onChange={e => handleChange('lingkup', e.target.value)}
          className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all cursor-pointer font-semibold"
        >
          <option value="Pusat">🏛️ Pusat (Umum / Majelis)</option>
          <option value="Satelit">⛪ Satelit (Umum)</option>
          <option value="Komisi">👥 Komisi</option>
          <option value="Departemen">📋 Departemen</option>
        </select>
      </div>

      {/* STEP 2: Lokasi Satelit — tidak muncul untuk Pusat dan Departemen */}
      {(data.lingkup === 'Pusat' || data.lingkup === 'Departemen') ? (
        <div className="w-full py-3 px-4 text-emerald-600 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-3">
          <span className="material-icons-round text-[18px]">verified</span>
          {data.lingkup === 'Pusat' && (
            <span className="text-sm font-sans font-medium">Jabatan ini berada di tingkat <strong>Pusat / Majelis</strong>.</span>
          )}
          {data.lingkup === 'Departemen' && (
            <span className="text-sm font-sans font-medium">Departemen bersifat <strong>lintas satelit</strong> — tidak terikat pada satu satelit tertentu.</span>
          )}
        </div>
      ) : (
        <div className="w-full flex-col gap-1 flex">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">2</span>
            <label className="text-slate-700 text-xs font-bold font-sans uppercase leading-4 tracking-wider">Lokasi Satelit Penugasan</label>
          </div>
          <select
            value={data.lokasi_satelit_id}
            onChange={e => handleChange('lokasi_satelit_id', e.target.value)}
            className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-900 text-sm font-sans w-full transition-all cursor-pointer"
          >
            <option value="">-- Pilih Satelit --</option>
            {satelitOptions.map(s => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
          </select>
        </div>
      )}

      {/* STEP 3: Komisi — hanya muncul jika lingkup=Komisi, difilter per satelit */}
      {data.lingkup === 'Komisi' && (
        <div className="w-full flex-col gap-1 flex animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">3</span>
            <label className="text-slate-700 text-xs font-bold font-sans uppercase leading-4 tracking-wider">Pilih Komisi</label>
          </div>
          {!data.lokasi_satelit_id ? (
            <div className="w-full py-2.5 px-3 text-amber-600 bg-amber-50 rounded-lg border border-amber-200 text-sm flex items-center gap-2">
              <span className="material-icons-round text-[16px]">warning</span>
              Pilih Satelit terlebih dahulu untuk melihat pilihan komisi.
            </div>
          ) : (
            <select
              value={data.komisi_id}
              onChange={e => handleChange('komisi_id', e.target.value)}
              disabled={!data.lokasi_satelit_id}
              className="px-3 py-2 bg-violet-50 rounded-lg border border-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-900 text-sm font-sans w-full transition-all cursor-pointer"
            >
              <option value="">-- Pilih Komisi --</option>
              {filteredKomisi.map(k => <option key={k.id} value={k.id}>{k.nama_komisi}</option>)}
            </select>
          )}
          {data.lokasi_satelit_id && filteredKomisi.length === 0 && (
            <p className="text-xs text-amber-500 mt-1">⚠ Belum ada komisi terdaftar di satelit ini.</p>
          )}
        </div>
      )}

      {/* STEP 3: Departemen (kondisional) */}
      {data.lingkup === 'Departemen' && (
        <div className="w-full flex-col gap-1 flex animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">3</span>
            <label className="text-slate-700 text-xs font-bold font-sans uppercase leading-4 tracking-wider">Pilih Departemen</label>
          </div>
          <select
            value={data.departemen_id}
            onChange={e => handleChange('departemen_id', e.target.value)}
            className="px-3 py-2 bg-sky-50 rounded-lg border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-slate-900 text-sm font-sans w-full transition-all cursor-pointer"
          >
            <option value="">-- Pilih Departemen --</option>
            {departemenOptions.map(d => <option key={d.id} value={d.id}>{d.nama_departemen}</option>)}
          </select>
        </div>
      )}

      {/* Divider */}
      <div className="w-full border-t border-slate-100" />

      {/* STEP Jabatan */}
      <div className="w-full flex-col gap-1 flex">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="w-5 h-5 rounded-full bg-slate-700 text-white text-[10px] font-black flex items-center justify-center shrink-0">
            {data.lingkup === 'Pusat' ? 2 : data.lingkup === 'Satelit' ? 3 : 4}
          </span>
          <label className="text-slate-700 text-xs font-bold font-sans uppercase leading-4 tracking-wider">Pilih Jabatan</label>
        </div>
        <select
          value={data.jabatan_id}
          onChange={e => handleChange('jabatan_id', e.target.value)}
          className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all cursor-pointer"
        >
          <option value="">-- Pilih Jabatan --</option>
          {filteredJabatan.map(j => <option key={j.id} value={j.id}>{j.nama_jabatan}</option>)}
        </select>
        {filteredJabatan.length === 0 && (
          <p className="text-xs text-amber-500 mt-1">⚠ Belum ada jabatan tersedia untuk lingkup ini.</p>
        )}
      </div>

      {/* Periode & Tanggal */}
      <div className="w-full flex gap-3 flex-col sm:flex-row">
        <div className="flex-1 flex-col gap-1 flex">
          <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Periode Kepengurusan</label>
          <select
            value={data.periode_id}
            onChange={e => handleChange('periode_id', e.target.value)}
            className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all cursor-pointer"
          >
            <option value="">-- Pilih Periode --</option>
            {periodeOptions.map(p => <option key={p.id} value={p.id}>{p.nama_periode} ({p.tahun_mulai}–{p.tahun_akhir})</option>)}
          </select>
        </div>
        <div className="flex-1 flex-col gap-1 flex">
          <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Tanggal Mulai Menjabat</label>
          <input
            type="date"
            value={data.tanggal_mulai}
            onChange={e => handleChange('tanggal_mulai', e.target.value)}
            className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all"
          />
        </div>
      </div>

      {/* Jalur Pengangkatan */}
      <div className="w-full flex-col gap-1 flex">
        <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Jalur Pengangkatan</label>
        <select
          value={data.jalur_pengangkatan}
          onChange={e => handleChange('jalur_pengangkatan', e.target.value)}
          className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all cursor-pointer"
        >
          <option value="Penunjukan">Penunjukan / Aklamasi</option>
          <option value="Pemilihan">Pemilihan</option>
        </select>
      </div>

      {/* Catatan */}
      <div className="w-full flex-col gap-1 flex">
        <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Catatan (Opsional)</label>
        <textarea
          value={data.catatan}
          onChange={e => handleChange('catatan', e.target.value)}
          placeholder="Catatan khusus untuk jabatan ini (misal: PAW menggantikan Bpk. X)..."
          className="px-3 py-3 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full min-h-[80px] resize-y transition-all"
        />
      </div>
    </div>
  );
}
