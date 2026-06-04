import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Step1Props {
  runId: number | null;
  setupData: any;
  setSetupData: (data: any) => void;
  onNext: (runId: number) => void;
  setSubmitState: (state: any) => void;
}

export default function Step1Setup({ runId, setupData, setSetupData, onNext, setSubmitState }: Step1Props) {
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [raOptions, setRaOptions] = useState<any[]>([]);
  const [isRaLoading, setIsRaLoading] = useState(false);
  const [selectedRa, setSelectedRa] = useState<any>(null);

  // Fetch Satelit
  useEffect(() => {
    fetch('/api/options?type=satelit')
      .then(res => res.json())
      .then(res => {
        if (res.success) setSatelitOptions(res.data);
      })
      .catch(console.error);
  }, []);

  // Fetch RA when satelit and tahun change
  useEffect(() => {
    if (!setupData.satelit_id || !setupData.tahun) {
      setRaOptions([]);
      setSetupData((prev: any) => ({ ...prev, anggaran_tahunan_id: '', sisa_plafon: 0 }));
      setSelectedRa(null);
      return;
    }

    setIsRaLoading(true);
    // Fetch all RA then filter locally because /api/anggaran/tahunan does not support query params
    fetch('/api/anggaran/tahunan')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          const filteredRa = res.data.filter((ra: any) => 
            ra.status?.includes('Disetujui') && 
            ra.kategori_ra === 'Penggajian' && 
            ra.satelit_id?.toString() === setupData.satelit_id?.toString() &&
            ra.tahun?.toString() === setupData.tahun?.toString()
          );
          setRaOptions(filteredRa);
          // Auto clear selected if not in new options
          if (!filteredRa.find((ra: any) => ra.id === setupData.anggaran_tahunan_id)) {
            setSetupData((prev: any) => ({ ...prev, anggaran_tahunan_id: '', sisa_plafon: 0 }));
            setSelectedRa(null);
          }
        }
      })
      .catch(console.error)
      .finally(() => setIsRaLoading(false));
  }, [setupData.satelit_id, setupData.tahun]);

  // Handle RA Selection
  const handleRaChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const raId = e.target.value;
    const ra = raOptions.find((r: any) => r.id === raId);
    
    if (raId && ra) {
      setSelectedRa(ra);
      setSetupData((prev: any) => ({ ...prev, anggaran_tahunan_id: raId }));
      
      // Calculate sisa plafon immediately
      try {
        setSubmitState({ status: 'loading', message: 'Mengecek sisa plafon...' });
        const res = await fetch(`/api/payroll/runs/validate-setup?check_plafon=true&ra_id=${raId}`);
        const result = await res.json();
        if (result.success) {
          setSetupData((prev: any) => ({ ...prev, sisa_plafon: result.data.sisa_plafon }));
          setSubmitState({ status: 'idle', message: '' });
        }
      } catch (err) {
        console.error(err);
        setSubmitState({ status: 'idle', message: '' });
      }
    } else {
      setSelectedRa(null);
      setSetupData((prev: any) => ({ ...prev, anggaran_tahunan_id: '', sisa_plafon: 0 }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setSetupData({ ...setupData, [e.target.name]: e.target.value });
  };

  const handleNext = async () => {
    if (!setupData.bulan || !setupData.tahun || !setupData.satelit_id || !setupData.anggaran_tahunan_id) {
      alert("Mohon lengkapi semua field yang wajib (*).");
      return;
    }
    if (setupData.sisa_plafon <= 0) {
      alert("Sisa Plafon RA sudah habis. Tidak bisa memproses payroll baru dengan RA ini.");
      return;
    }

    try {
      setSubmitState({ status: 'loading', message: 'Memvalidasi setup & generate template...' });
      
      const res = await fetch('/api/payroll/runs/validate-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...setupData, run_id: runId })
      });
      const result = await res.json();
      
      if (result.success) {
        setSubmitState({ status: 'idle', message: '' });
        onNext(result.data.run_id);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal memvalidasi setup.' });
      }
    } catch (err) {
      console.error(err);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan koneksi saat validasi setup.' });
    }
  };

  const getBulanName = (b: number) => {
    return ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][b-1];
  };

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in">
       <div className="flex flex-col gap-1">
         <h2 className="text-slate-900 text-xl font-bold font-sans flex items-center gap-2"><span className="material-icons-round text-blue-500">info</span> Informasi Dasar Payroll</h2>
         <p className="text-slate-500 text-sm">Pilih periode dan unit operasional untuk penarikan data pegawai secara otomatis.</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2 border-b border-slate-100">
          <div className="flex flex-col gap-1 w-full">
            <label className="text-slate-700 text-xs font-bold uppercase tracking-wider">Periode Payroll *</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select name="bulan" value={setupData.bulan} onChange={handleChange} className="appearance-none w-full pl-10 pr-10 py-3 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                  <option value="">Bulan</option>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(b => (
                    <option key={b} value={b}>{getBulanName(b)}</option>
                  ))}
                </select>
                <span className="material-icons-round absolute left-3 top-3 text-slate-400 pointer-events-none">calendar_today</span>
                <span className="material-icons-round absolute right-3 top-3 text-slate-400 pointer-events-none">expand_more</span>
              </div>
              <div className="relative w-32 shrink-0">
                <select name="tahun" value={setupData.tahun} onChange={handleChange} className="appearance-none w-full pl-4 pr-10 py-3 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                  <option value="">Tahun</option>
                  {[2026, 2025, 2024].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <span className="material-icons-round absolute right-3 top-3 text-slate-400 pointer-events-none">expand_more</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1 w-full">
            <label className="text-slate-700 text-xs font-bold uppercase tracking-wider">Unit Pelaksana *</label>
            <div className="relative">
              <select name="satelit_id" value={setupData.satelit_id} onChange={handleChange} className="appearance-none w-full pl-10 pr-10 py-3 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                <option value="">Pilih Unit...</option>
                {satelitOptions.map(s => (
                  <option key={s.id} value={s.id}>{s.nama_satelit}</option>
                ))}
              </select>
              <span className="material-icons-round absolute left-3 top-3 text-slate-400 pointer-events-none">domain</span>
              <span className="material-icons-round absolute right-3 top-3 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>
       </div>

       <div className="flex flex-col gap-1 mt-2">
         <h2 className="text-slate-900 text-xl font-bold font-sans flex items-center gap-2"><span className="material-icons-round text-emerald-500">account_balance_wallet</span> Sumber Dana (Rencana Anggaran)</h2>
         <p className="text-slate-500 text-sm">Pilih RA Penggajian aktif yang akan digunakan sebagai sumber dana payroll ini.</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="flex flex-col gap-1 w-full relative">
            <label className="text-slate-700 text-xs font-bold uppercase tracking-wider">RA Penggajian Terhubung *</label>
            <div className="relative">
              <select 
                name="anggaran_tahunan_id" 
                value={setupData.anggaran_tahunan_id} 
                onChange={handleRaChange} 
                disabled={!setupData.satelit_id || !setupData.tahun}
                className="appearance-none w-full pl-10 pr-10 py-3 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">{isRaLoading ? "Memuat RA..." : !setupData.satelit_id ? "Pilih Unit Pelaksana terlebih dahulu..." : "Pilih RA..."}</option>
                {raOptions.map(ra => (
                  <option key={ra.id} value={ra.id}>{ra.kode_dokumen} - {ra.nama_rancangan}</option>
                ))}
              </select>
              <span className="material-icons-round absolute left-3 top-3 text-slate-400 pointer-events-none">description</span>
              <span className="material-icons-round absolute right-3 top-3 text-slate-400 pointer-events-none">expand_more</span>
            </div>
            {setupData.satelit_id && !isRaLoading && raOptions.length === 0 && (
               <span className="text-xs text-rose-500 mt-1">Tidak ada RA Penggajian berstatus 'Disetujui' untuk unit & tahun ini.</span>
            )}
          </div>

          {selectedRa && (
             <div className={`p-4 rounded-lg border flex flex-col gap-1 ${setupData.sisa_plafon > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`material-icons-round ${setupData.sisa_plafon > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{setupData.sisa_plafon > 0 ? 'check_circle' : 'error'}</span>
                  <span className={`text-sm font-bold uppercase ${setupData.sisa_plafon > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>Status Plafon RA</span>
                </div>
                <span className={`text-xl font-bold font-sans tracking-tight ${setupData.sisa_plafon > 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                   Sisa Plafon: {formatRupiah(setupData.sisa_plafon)}
                </span>
                <span className={`text-xs ${setupData.sisa_plafon > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                   {setupData.sisa_plafon > 0 ? 'Dana mencukupi untuk pemrosesan payroll.' : 'Dana RA sudah habis. Tidak bisa diproses.'}
                </span>
             </div>
          )}
       </div>

       {/* Footer */}
       <div className="w-full flex justify-end items-center mt-6 pt-6 border-t border-slate-100 gap-4">
         <Link href="/pegawai/penggajian" className="px-6 py-2.5 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-colors">
            Batal
         </Link>
         <button 
            onClick={handleNext} 
            disabled={!setupData.bulan || !setupData.tahun || !setupData.satelit_id || !setupData.anggaran_tahunan_id || setupData.sisa_plafon <= 0}
            className="px-6 py-2.5 bg-blue-600 rounded-lg text-white font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-600/20"
         >
            Lanjut ke Review Pegawai <span className="material-icons-round text-[18px]">arrow_forward</span>
         </button>
       </div>
    </div>
  );
}
