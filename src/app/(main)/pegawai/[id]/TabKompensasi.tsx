'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

interface TabKompensasiProps {
  pegawaiId: string;
}

export default function TabKompensasi({ pegawaiId }: TabKompensasiProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // State buat layar tumpang-tindih (overlay) pas ngirim
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  // Local overrides: komponen_id → nominal string
  const [localOverrides, setLocalOverrides] = useState<Record<number, string>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pegawai/${pegawaiId}/kompensasi`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        // Siapin penimpaan data lokal dari yang udah ada
        const init: Record<number, string> = {};
        for (const k of json.data.komponen) {
          if (k.nominal_override !== null) {
            init[k.komponen_id] = k.nominal_override.toString();
          }
        }
        setLocalOverrides(init);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [pegawaiId]);

  const handleSave = async () => {
    setSubmitStatus('loading');
    setSubmitMessage('Menyimpan perubahan kompensasi individu...');
    try {
      const overrides = Object.entries(localOverrides)
        .filter(([_, val]) => val !== '' && val !== undefined)
        .map(([kid, val]) => ({
          komponen_id: parseInt(kid),
          nominal_override: parseFloat(val) || 0,
        }));

      const res = await fetch(`/api/pegawai/${pegawaiId}/kompensasi`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitStatus('success');
        setSubmitMessage('Kompensasi individu berhasil disimpan.');
        await fetchData();
      } else {
        setSubmitStatus('error');
        setSubmitMessage(json.message || 'Gagal menyimpan kompensasi.');
      }
    } catch {
      setSubmitStatus('error');
      setSubmitMessage('Terjadi kesalahan koneksi.');
    }
  };

  const resetOverride = (komponenId: number) => {
    setLocalOverrides(prev => {
      const next = { ...prev };
      delete next[komponenId];
      return next;
    });
  };

  // Compute live preview THP
  const livePreview = useMemo(() => {
    if (!data) return { penerimaan: 0, potongan: 0, netto: 0 };
    let penerimaan = 0;
    let potongan = 0;
    for (const k of data.komponen) {
      if (k.is_employer_portion) continue;
      if (k.calculation_type === 'pct_global_bpjs') continue; // BPJS dihitung otomatis
      const isActive = k.is_active_template || localOverrides[k.komponen_id] !== undefined;
      if (!isActive) continue;

      const nominal = localOverrides[k.komponen_id] !== undefined
        ? (parseFloat(localOverrides[k.komponen_id]) || 0)
        : k.nominal_template;

      if (k.tipe === 'Penerimaan') penerimaan += nominal;
      else if (k.tipe === 'Potongan') potongan += nominal;
    }
    return { penerimaan, potongan, netto: penerimaan - potongan };
  }, [data, localOverrides]);

  if (loading) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin"></div>
        <span className="text-sm font-sans">Memuat data kompensasi...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center text-slate-500">
        <span className="material-icons-round text-5xl mb-2 text-slate-300">error_outline</span>
        <span className="text-sm font-sans">Gagal memuat data kompensasi.</span>
      </div>
    );
  }

  const penerimaan = data.komponen.filter((k: any) => k.tipe === 'Penerimaan');
  const potongan = data.komponen.filter((k: any) => k.tipe === 'Potongan');

  const renderKomponenRow = (k: any) => {
    const hasOverride = localOverrides[k.komponen_id] !== undefined;
    const isAutoCalc = k.calculation_type === 'pct_global_bpjs';
    const isActive = k.is_active_template || hasOverride;

    return (
      <div key={k.komponen_id} className={`flex items-center gap-4 px-6 py-4 border-b border-slate-100 last:border-0 transition-colors ${isActive ? 'hover:bg-slate-50/50' : 'opacity-30'}`}>
        {/* Name + Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className={`text-sm font-bold font-sans ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
              {k.nama_komponen}
            </span>
            {k.is_employer_portion && (
              <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold border border-purple-200">Beban Gereja</span>
            )}
            {hasOverride && (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold border border-blue-200">Kustom</span>
            )}
            {!hasOverride && isActive && !isAutoCalc && (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold border border-slate-200">Template</span>
            )}
          </div>
          <div className="text-xs text-slate-500 font-sans mt-1">
            {isAutoCalc && 'Otomatis (% tarif BPJS)'}
            {k.calculation_type === 'flat_nominal' && <span>Nilai template: <strong className="text-slate-700 font-sans">{formatRupiah(k.nominal_template)}</strong></span>}
            {k.calculation_type === 'per_hari' && <span>Nilai template: <strong className="text-slate-700 font-sans">{formatRupiah(k.nominal_template)}</strong> / hari</span>}
            {k.calculation_type === 'pct_gaji_pokok' && '% dari Gaji Pokok'}
          </div>
        </div>

        {/* Input / Auto Label */}
        {isAutoCalc ? (
          <span className="text-xs text-slate-500 bg-slate-100 px-3 py-2 rounded-lg font-bold font-sans border border-slate-200">Otomatis</span>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-slate-500 font-bold">Rp</span>
            <input
              type="number"
              value={hasOverride ? localOverrides[k.komponen_id] : ''}
              placeholder={k.nominal_template.toString()}
              onChange={e => {
                const val = e.target.value;
                if (val === '') {
                  resetOverride(k.komponen_id);
                } else {
                  setLocalOverrides(prev => ({ ...prev, [k.komponen_id]: val }));
                }
              }}
              className={`w-36 text-right px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 font-sans ${
                hasOverride 
                  ? 'border-blue-400 focus:ring-blue-300 text-blue-800 font-bold bg-blue-50/50' 
                  : 'border-slate-300 focus:ring-slate-300 text-slate-700 placeholder:text-slate-400'
              }`}
            />
            {hasOverride && (
              <button
                onClick={() => resetOverride(k.komponen_id)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Reset ke template"
              >
                <span className="material-icons-round text-[18px]">restart_alt</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-slate-900 text-xl font-bold font-sans flex items-center gap-2">
          <span className="material-icons-round text-emerald-500">account_balance_wallet</span>
          Kompensasi Individu
        </h2>
        <p className="text-slate-500 text-sm font-sans">
          Atur nominal gaji khusus untuk pegawai ini. Komponen yang tidak di-override akan mengikuti template jabatan.
        </p>
      </div>

      {/* Template Info Card */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center shrink-0">
          <span className="material-icons-round text-slate-500">badge</span>
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-700 font-sans">
            Template Jabatan: {data.template_info?.nama_template || 'Belum ada template'}
          </div>
          <div className="text-xs text-slate-500 font-sans">
            {data.pegawai.jabatan || 'Jabatan tidak diset'}
            {data.template_info && ` • PPh21: ${data.template_info.pph21_method}`}
          </div>
        </div>
        {data.template_info && (
          <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-1 rounded-md font-bold shrink-0">
            AKTIF
          </span>
        )}
      </div>



      {/* Komponen Gaji */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {/* Penerimaan */}
        <div className="px-5 py-3 bg-emerald-50/50 border-b border-slate-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">Penerimaan</span>
          <span className="text-[10px] text-slate-400 font-sans ml-auto">{penerimaan.length} komponen</span>
        </div>
        {penerimaan.map(renderKomponenRow)}

        {/* Potongan */}
        <div className="px-5 py-3 bg-rose-50/50 border-b border-t border-slate-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">Potongan</span>
          <span className="text-[10px] text-slate-400 font-sans ml-auto">{potongan.length} komponen</span>
        </div>
        {potongan.map(renderKomponenRow)}
      </div>

      {/* Live Preview THP */}
      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2 font-sans">
          <span className="material-icons-round text-[16px]">calculate</span> Estimasi Take Home Pay
        </h4>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm font-sans">
            <span className="text-slate-500">Total Penerimaan</span>
            <span className="text-slate-900 font-bold font-sans">{formatRupiah(livePreview.penerimaan)}</span>
          </div>
          <div className="flex justify-between text-sm font-sans">
            <span className="text-slate-500">Total Potongan</span>
            <span className="text-red-600 font-bold font-sans">- {formatRupiah(livePreview.potongan)}</span>
          </div>
          <div className="w-full h-px bg-slate-300 my-2"></div>
          <div className="flex justify-between text-base font-bold font-sans">
            <span className="text-slate-900">Take Home Pay</span>
            <span className="text-slate-900 font-sans">{formatRupiah(livePreview.netto)}</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-3 font-sans">
          * Estimasi. Potongan BPJS & PPh21 dihitung otomatis saat payroll run.
        </p>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={submitStatus === 'loading'}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors shadow-lg flex items-center gap-2 font-sans disabled:opacity-60"
        >
          {submitStatus === 'loading' ? (
            <span className="material-icons-round text-[18px] animate-spin">sync</span>
          ) : (
            <span className="material-icons-round text-[18px]">save</span>
          )}
          Simpan Kompensasi
        </button>
      </div>

      {/* Standard Lottie Loader Overlay */}
      <SubmitOverlay
        status={submitStatus}
        message={submitMessage}
        onClose={() => setSubmitStatus('idle')}
      />
    </div>
  );
}
