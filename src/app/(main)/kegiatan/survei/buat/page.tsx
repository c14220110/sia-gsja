'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

interface PertanyaanItem {
  teks_pertanyaan: string;
  tipe_jawaban: 'skala' | 'teks';
  is_required: boolean;
  urutan: number;
}

export default function BuatSurveiPage() {
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  // Form State
  const [judul, setJudul] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [kegiatanId, setKegiatanId] = useState('');
  const [satelitId, setSatelitId] = useState('');
  const [periodeMulai, setPeriodeMulai] = useState('');
  const [periodeSelesai, setPeriodeSelesai] = useState('');
  const [isAnonim, setIsAnonim] = useState(false);
  const [pertanyaan, setPertanyaan] = useState<PertanyaanItem[]>([
    { teks_pertanyaan: '', tipe_jawaban: 'skala', is_required: true, urutan: 1 },
  ]);

  // Options
  const [kegiatanOptions, setKegiatanOptions] = useState<any[]>([]);
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [kegiatanSearch, setKegiatanSearch] = useState('');
  const [debouncedKegSearch, setDebouncedKegSearch] = useState('');

  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });

  // User data
  const [userData, setUserData] = useState<any>(null);
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setUserData(json.data);
            // Default satelit_id ke user's current satelit
            if (json.data.satelit_id) setSatelitId(json.data.satelit_id.toString());
          }
        }
      } catch {}
    };
    fetchUser();
  }, []);

  // Fetch satelit options
  useEffect(() => {
    const fetchSatelit = async () => {
      try {
        const res = await fetch('/api/options?type=satelit');
        if (res.ok) {
          const json = await res.json();
          if (json.success) setSatelitOptions(json.data);
        }
      } catch {}
    };
    fetchSatelit();
  }, []);

  // Debounce kegiatan search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKegSearch(kegiatanSearch), 300);
    return () => clearTimeout(timer);
  }, [kegiatanSearch]);

  // Fetch kegiatan options (only Selesai/Menunggu LPJ status or upcoming)
  useEffect(() => {
    const fetchKegiatan = async () => {
      try {
        const queryParams = new URLSearchParams();
        if (debouncedKegSearch) queryParams.append('search', debouncedKegSearch);
        queryParams.append('limit', '20');
        const res = await fetch(`/api/kegiatan?${queryParams.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) setKegiatanOptions(json.data);
        }
      } catch {}
    };
    fetchKegiatan();
  }, [debouncedKegSearch]);

  // Pertanyaan management
  const addPertanyaan = () => {
    setPertanyaan(prev => [...prev, { teks_pertanyaan: '', tipe_jawaban: 'skala', is_required: true, urutan: prev.length + 1 }]);
  };

  const removePertanyaan = (index: number) => {
    if (pertanyaan.length <= 1) return;
    setPertanyaan(prev => prev.filter((_, i) => i !== index).map((p, i) => ({ ...p, urutan: i + 1 })));
  };

  const updatePertanyaan = (index: number, field: keyof PertanyaanItem, value: any) => {
    setPertanyaan(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  // Submit
  const handleSubmit = async () => {
    // Validation
    if (!judul.trim()) return alert('Judul survei wajib diisi!');
    if (!satelitId) return alert('Satelit wajib dipilih!');
    if (!periodeMulai || !periodeSelesai) return alert('Periode survei wajib diisi!');
    if (new Date(periodeSelesai) < new Date(periodeMulai)) return alert('Periode selesai tidak boleh sebelum periode mulai!');
    
    const validPertanyaan = pertanyaan.filter(p => p.teks_pertanyaan.trim() !== '');
    if (validPertanyaan.length === 0) return alert('Minimal 1 pertanyaan wajib diisi!');

    setSubmitState({ status: 'loading', message: 'Membuat survei...' });
    
    try {
      const res = await fetch('/api/survei', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judul: judul.trim(),
          deskripsi: deskripsi.trim() || null,
          kegiatan_id: kegiatanId ? parseInt(kegiatanId) : null,
          satelit_id: parseInt(satelitId),
          periode_mulai: periodeMulai,
          periode_selesai: periodeSelesai,
          is_anonim: isAnonim,
          pertanyaan: validPertanyaan.map((p, i) => ({ ...p, urutan: i + 1 })),
        }),
      });

      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: 'Survei berhasil dibuat!' });
        setTimeout(() => router.push('/kegiatan/survei'), 1500);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal membuat survei' });
      }
    } catch (error) {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan sistem' });
    }
  };

  return (
    <div className="w-full flex flex-col gap-8 pb-10 relative">
      
      {/* Submit Overlay */}
      {(submitState.status !== 'idle') && <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => setSubmitState({ status: 'idle', message: '' })} />}

      {/* Header */}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => router.push('/kegiatan/survei')} className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex justify-center items-center text-slate-600 hover:bg-slate-50 transition-colors">
              <span className="material-icons-round text-[18px]">arrow_back</span>
            </button>
            <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9">Buat Survei Baru</h1>
          </div>
          <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6">Buat survei kepuasan untuk mengukur kualitas pelayanan</div>
        </div>
      </div>

      {/* Form Card: Info Dasar */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-5">
        <div className="pb-2 border-b border-slate-100">
          <h3 className="text-slate-800 text-lg font-bold font-['Inter']">Informasi Survei</h3>
        </div>

        <div className="flex flex-col gap-4">
          {/* Judul */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Judul Survei <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Contoh: Survei Kepuasan Ibadah Minggu"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 font-medium transition-all"
            />
          </div>

          {/* Deskripsi */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deskripsi</label>
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              rows={3}
              placeholder="Deskripsi singkat tujuan survei ini..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 text-sm resize-none"
            />
          </div>

          {/* Grid: Satelit + Kegiatan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Satelit <span className="text-rose-500">*</span></label>
              <div className="relative">
                <select
                  value={satelitId}
                  onChange={(e) => setSatelitId(e.target.value)}
                  className="appearance-none w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium cursor-pointer pr-10"
                >
                  <option value="">Pilih Satelit</option>
                  {satelitOptions.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.nama_satelit}</option>
                  ))}
                </select>
                <span className="material-icons-round absolute right-3 top-3 text-slate-400 pointer-events-none">expand_more</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Terkait Kegiatan <span className="text-slate-400 font-normal">(opsional)</span></label>
              <div className="relative">
                <select
                  value={kegiatanId}
                  onChange={(e) => setKegiatanId(e.target.value)}
                  className="appearance-none w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium cursor-pointer pr-10"
                >
                  <option value="">Survei Mandiri (tidak terikat kegiatan)</option>
                  {kegiatanOptions.map((k: any) => (
                    <option key={k.id} value={k.id}>{k.nama_kegiatan} ({k.kode_kegiatan})</option>
                  ))}
                </select>
                <span className="material-icons-round absolute right-3 top-3 text-slate-400 pointer-events-none">expand_more</span>
              </div>
            </div>
          </div>

          {/* Grid: Periode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Periode Mulai <span className="text-rose-500">*</span></label>
              <input
                type="date"
                value={periodeMulai}
                onChange={(e) => setPeriodeMulai(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Periode Selesai <span className="text-rose-500">*</span></label>
              <input
                type="date"
                value={periodeSelesai}
                onChange={(e) => setPeriodeSelesai(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
              />
            </div>
          </div>

          {/* Toggle Anonim */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <span className="text-slate-700 text-sm font-bold">Survei Anonim</span>
              <p className="text-slate-400 text-xs mt-0.5">Jemaat bisa mengisi tanpa mencantumkan identitas</p>
            </div>
            <button
              onClick={() => setIsAnonim(!isAnonim)}
              className={`w-12 h-7 rounded-full transition-colors duration-200 flex items-center px-0.5 ${isAnonim ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <div className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${isAnonim ? 'translate-x-5' : 'translate-x-0'}`}></div>
            </button>
          </div>
        </div>
      </div>

      {/* Form Card: Pertanyaan */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-5">
        <div className="pb-2 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-slate-800 text-lg font-bold font-['Inter']">Daftar Pertanyaan</h3>
          <span className="text-slate-400 text-sm font-medium">{pertanyaan.length} pertanyaan</span>
        </div>

        <div className="flex flex-col gap-4">
          {pertanyaan.map((p, index) => (
            <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-100 rounded-lg flex justify-center items-center text-blue-600 font-bold text-xs">{index + 1}</div>
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Pertanyaan {index + 1}</span>
                </div>
                {pertanyaan.length > 1 && (
                  <button
                    onClick={() => removePertanyaan(index)}
                    className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 flex justify-center items-center transition-colors"
                  >
                    <span className="material-icons-round text-[16px]">close</span>
                  </button>
                )}
              </div>
              
              <input
                type="text"
                value={p.teks_pertanyaan}
                onChange={(e) => updatePertanyaan(index, 'teks_pertanyaan', e.target.value)}
                placeholder="Tulis pertanyaan survei..."
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 text-sm"
              />

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500">Tipe:</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updatePertanyaan(index, 'tipe_jawaban', 'skala')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${p.tipe_jawaban === 'skala' ? 'bg-indigo-100 text-indigo-700 border border-indigo-300' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                    >
                      ⭐ Skala 1-5
                    </button>
                    <button
                      onClick={() => updatePertanyaan(index, 'tipe_jawaban', 'teks')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${p.tipe_jawaban === 'teks' ? 'bg-teal-100 text-teal-700 border border-teal-300' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                    >
                      📝 Teks Bebas
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500">Wajib:</label>
                  <button
                    onClick={() => updatePertanyaan(index, 'is_required', !p.is_required)}
                    className={`w-9 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5 ${p.is_required ? 'bg-blue-600' : 'bg-slate-300'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${p.is_required ? 'translate-x-4' : 'translate-x-0'}`}></div>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add Pertanyaan Button */}
          <button
            onClick={addPertanyaan}
            className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2 text-sm font-bold"
          >
            <span className="material-icons-round text-[20px]">add_circle_outline</span>
            Tambah Pertanyaan
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <div className="w-full flex justify-end gap-3">
        <button
          onClick={() => router.push('/kegiatan/survei')}
          className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
        >
          Batal
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitState.status === 'loading'}
          className="px-8 py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <span className="material-icons-round text-[18px]">publish</span>
          Buat Survei
        </button>
      </div>

    </div>
  );
}
