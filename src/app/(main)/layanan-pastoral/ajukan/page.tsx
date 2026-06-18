'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

export default function AjukanPermintaanPage() {
  const router = useRouter();

  // Form State
  const [untukSiapa, setUntukSiapa] = useState('Saya Sendiri');
  
  // Dynamic fields for non-"Saya Sendiri"
  const [isJemaatGsja, setIsJemaatGsja] = useState<boolean | null>(null);
  const [jemaatTargetId, setJemaatTargetId] = useState<number | null>(null);
  const [namaTargetLuar, setNamaTargetLuar] = useState('');
  
  const [jenisLayananId, setJenisLayananId] = useState<number | null>(null);
  const [nomorHp, setNomorHp] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  // Data Options
  const [jenisOptions, setJenisOptions] = useState<any[]>([]);
  const [jemaatSearchQuery, setJemaatSearchQuery] = useState('');
  const [jemaatSearchResults, setJemaatSearchResults] = useState<any[]>([]);
  const [selectedJemaatName, setSelectedJemaatName] = useState('');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Submit Overlay State
  const [submitState, setSubmitState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error', message: string }>({
    status: 'idle',
    message: ''
  });

  useEffect(() => {
    // Fetch Jenis Kegiatan yang butuh_permohonan = true (pastoral types only)
    const fetchJenis = async () => {
      try {
        const res = await fetch('/api/options?type=jenis_kegiatan_pastoral');
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setJenisOptions(json.data); // sudah pastoral-only dari API
          }
        }
      } catch (err) {
        console.error('Failed to fetch jenis kegiatan', err);
      }
    };
    fetchJenis();
  }, []);

  // Autofill Nomor HP if exists
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const json = await res.json();
          if (json.no_hp) {
            setNomorHp(json.no_hp);
          }
        }
      } catch (err) {
        console.error('Failed to fetch user', err);
      }
    };
    fetchUser();
  }, []);

  // Search Jemaat logic
  useEffect(() => {
    if (!jemaatSearchQuery || jemaatTargetId) {
      setJemaatSearchResults([]);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/options?type=jemaat_search&q=${encodeURIComponent(jemaatSearchQuery)}&only_active=true`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) setJemaatSearchResults(json.data);
        }
      } catch (err) {
        console.error(err);
      }
    }, 500);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [jemaatSearchQuery, jemaatTargetId]);

  const handleSelectJemaat = (jemaat: any) => {
    setJemaatTargetId(jemaat.id);
    setSelectedJemaatName(jemaat.nama_lengkap);
    setJemaatSearchQuery('');
    setJemaatSearchResults([]);
  };

  const handleResetTarget = () => {
    setJemaatTargetId(null);
    setSelectedJemaatName('');
    setJemaatSearchQuery('');
  };

  const handleSubmit = async () => {
    // Validation
    if (!jenisLayananId) {
      setSubmitState({ status: 'error', message: 'Pilih jenis layanan terlebih dahulu!' });
      return;
    }
    if (!nomorHp) {
      setSubmitState({ status: 'error', message: 'Masukkan nomor HP yang dapat dihubungi!' });
      return;
    }

    if (untukSiapa === 'Anggota Keluarga' && isJemaatGsja === null) {
      setSubmitState({ status: 'error', message: 'Tentukan apakah anggota keluarga Anda terdaftar sebagai jemaat GSJA.' });
      return;
    }
    if (untukSiapa === 'Anggota Keluarga' && isJemaatGsja === true && !jemaatTargetId) {
      setSubmitState({ status: 'error', message: 'Pilih data jemaat keluarga Anda dari pencarian.' });
      return;
    }
    if (untukSiapa === 'Anggota Keluarga' && isJemaatGsja === false && !namaTargetLuar.trim()) {
      setSubmitState({ status: 'error', message: 'Masukkan nama anggota keluarga Anda.' });
      return;
    }
    if (untukSiapa === 'Jemaat Lain' && !jemaatTargetId) {
      setSubmitState({ status: 'error', message: 'Pilih data jemaat yang dituju dari pencarian.' });
      return;
    }

    setSubmitState({ status: 'loading', message: 'Mengirimkan permintaan...' });

    try {
      const res = await fetch('/api/layanan-pastoral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          untuk_siapa: untukSiapa,
          jemaat_target_id: jemaatTargetId,
          nama_target_luar: namaTargetLuar,
          jenis_kegiatan_id: jenisLayananId,
          no_hp_kontak: nomorHp,
          keterangan: keterangan,
          is_urgent: isUrgent
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSubmitState({ status: 'success', message: 'Permintaan berhasil diajukan!' });
      } else {
        setSubmitState({ status: 'error', message: json.message || 'Gagal mengajukan permintaan.' });
      }
    } catch (err) {
      console.error(err);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan sistem (Offline).' });
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-[#F9FAFB] overflow-y-auto font-sans pb-24 relative">
      
      <SubmitOverlay 
        status={submitState.status} 
        message={submitState.message} 
        onClose={() => {
          if (submitState.status === 'success') {
            router.push('/');
          } else {
            setSubmitState({ status: 'idle', message: '' });
          }
        }} 
      />

      {/* Sticky Glass Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 pt-6 pb-4 px-5 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-4">
           <Link href="/" className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0">
             <span className="material-icons-round text-xl">arrow_back</span>
           </Link>
           <h1 className="text-xl font-black text-slate-800 tracking-tight">Ajukan Permintaan</h1>
        </div>
      </div>

      <div className="w-full px-5 pt-6 flex flex-col gap-6 max-w-md mx-auto">
        
        {/* Title & Subtitle */}
        <div className="flex flex-col gap-1.5 px-1">
          <h2 className="text-[28px] font-black text-slate-900 tracking-tight leading-tight">Ajukan Permintaan</h2>
          <p className="text-[15px] text-slate-500 leading-relaxed">
            Isi formulir di bawah untuk mengajukan layanan pastoral dari gereja.
          </p>
        </div>

        {/* SECTION 1: UNTUK SIAPA */}
        <div className="w-full">
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2.5 px-1">Untuk Siapa?</h3>
          <div className="bg-white rounded-[24px] p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] border border-slate-100/80 flex flex-col gap-3">
            
            {[
              { id: 'Saya Sendiri', label: 'Saya Sendiri' },
              { id: 'Anggota Keluarga', label: 'Anggota Keluarga' },
              { id: 'Jemaat Lain', label: 'Jemaat Lain' }
            ].map((option) => (
              <label 
                key={option.id} 
                className={`relative flex items-center gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer ${
                  untukSiapa === option.id 
                    ? 'border-blue-500 bg-blue-50/30' 
                    : 'border-slate-200 bg-white'
                }`}
              >
                <input 
                  type="radio" 
                  name="untuk_siapa" 
                  value={option.id}
                  checked={untukSiapa === option.id}
                  onChange={(e) => {
                    setUntukSiapa(e.target.value);
                    setJemaatTargetId(null);
                    setSelectedJemaatName('');
                    setNamaTargetLuar('');
                    setIsJemaatGsja(null);
                  }}
                  className="hidden"
                />
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  untukSiapa === option.id ? 'border-blue-500' : 'border-slate-300'
                }`}>
                  {untukSiapa === option.id && <div className="w-3 h-3 bg-blue-500 rounded-full"></div>}
                </div>
                <span className={`text-[15px] font-medium ${
                  untukSiapa === option.id ? 'text-blue-900 font-bold' : 'text-slate-700'
                }`}>
                  {option.label}
                </span>
              </label>
            ))}

            {/* Sub-form untuk Anggota Keluarga */}
            {untukSiapa === 'Anggota Keluarga' && (
              <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl animate-in slide-in-from-top-2 flex flex-col gap-3">
                {isJemaatGsja === null ? (
                  <>
                    <p className="text-xs font-bold text-slate-600 mb-1">Apakah anggota keluarga Anda terdaftar sebagai jemaat GSJA?</p>
                    <div className="flex gap-3">
                      <button onClick={() => setIsJemaatGsja(true)} className="flex-1 py-2 rounded-xl text-sm font-bold border bg-white text-slate-500 border-slate-200 hover:bg-slate-100 transition-colors">Ya</button>
                      <button onClick={() => setIsJemaatGsja(false)} className="flex-1 py-2 rounded-xl text-sm font-bold border bg-white text-slate-500 border-slate-200 hover:bg-slate-100 transition-colors">Tidak</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1">
                       <p className="text-xs font-bold text-blue-600">
                         {isJemaatGsja ? 'Anggota Terdaftar (Jemaat)' : 'Bukan Jemaat Terdaftar'}
                       </p>
                       <button onClick={() => setIsJemaatGsja(null)} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600">GANTI</button>
                    </div>
                    {isJemaatGsja === false && (
                      <input
                        type="text"
                        placeholder="Tulis nama lengkapnya..."
                        value={namaTargetLuar}
                        onChange={(e) => setNamaTargetLuar(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-sm"
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {/* Sub-form Search Jemaat (Untuk Anggota Keluarga GSJA atau Jemaat Lain) */}
            {((untukSiapa === 'Anggota Keluarga' && isJemaatGsja === true) || untukSiapa === 'Jemaat Lain') && (
              <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl animate-in slide-in-from-top-2 relative flex flex-col gap-2">
                <p className="text-xs font-bold text-slate-600">Pilih Data Jemaat</p>
                {jemaatTargetId ? (
                   <div className="flex items-center justify-between bg-white border border-blue-200 p-3 rounded-xl shadow-sm">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-[16px]">person</span>
                         </div>
                         <span className="font-bold text-slate-700 text-sm">{selectedJemaatName}</span>
                      </div>
                      <button onClick={handleResetTarget} className="text-slate-400 hover:text-rose-500 p-1">
                         <span className="material-icons-round text-[18px]">close</span>
                      </button>
                   </div>
                ) : (
                  <>
                    <div className="relative">
                      <span className="material-icons-round absolute left-3 top-2.5 text-slate-400 text-[18px]">search</span>
                      <input
                        type="text"
                        placeholder="Cari nama jemaat..."
                        value={jemaatSearchQuery}
                        onChange={(e) => setJemaatSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-sm"
                      />
                    </div>
                    {jemaatSearchResults.length > 0 && (
                      <div className="absolute top-[88px] left-4 right-4 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                        {jemaatSearchResults.map((jem: any) => (
                          <div key={jem.id} onClick={() => handleSelectJemaat(jem)} className="p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex items-center gap-3">
                             <span className="material-icons-round text-slate-300 text-[16px]">person</span>
                             <div className="flex flex-col">
                               <span className="text-sm font-bold text-slate-700">{jem.nama_lengkap}</span>
                               <span className="text-[10px] text-slate-400">{jem.jemaat_id}</span>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          </div>
        </div>

        {/* SECTION 2: JENIS LAYANAN */}
        <div className="w-full">
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2.5 px-1">Jenis Layanan</h3>
          <div className="bg-white rounded-[24px] p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] border border-slate-100/80">
            <div className="flex flex-wrap gap-2.5">
              {jenisOptions.map((jenis: any) => (
                <button
                  key={jenis.id}
                  type="button"
                  onClick={() => setJenisLayananId(jenis.id)}
                  className={`px-4 py-2.5 rounded-full text-[14px] font-medium transition-all ${
                    jenisLayananId === jenis.id
                      ? 'bg-slate-800 text-white shadow-md border border-slate-800'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {jenis.nama_jenis_kegiatan}
                </button>
              ))}
              {jenisOptions.length === 0 && (
                <div className="text-xs text-slate-400 w-full text-center py-2 animate-pulse">Memuat layanan pastoral...</div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: KONTAK & KETERANGAN */}
        <div className="w-full">
          <div className="bg-white rounded-[24px] p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] border border-slate-100/80 flex flex-col gap-5">
            
            {/* Input HP */}
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">
                Nomor HP yang dapat dihubungi
              </label>
              <div className="relative flex items-center">
                <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">call</span>
                <input
                  type="tel"
                  value={nomorHp}
                  onChange={(e) => setNomorHp(e.target.value)}
                  placeholder="0812-3456-7890"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium text-[15px] transition-all"
                />
              </div>
            </div>

            {/* Input Keterangan */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  Keterangan
                </label>
                <span className="text-[11px] font-medium text-slate-400">(opsional)</span>
              </div>
              <textarea
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Tuliskan detail tempat / permintaan khusus..."
                rows={4}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-800 text-[15px] placeholder:text-slate-400 transition-all resize-none"
              ></textarea>
            </div>

          </div>
        </div>

        {/* SECTION 4: URGENSI */}
        <div className="w-full">
          <div className="bg-white rounded-[24px] p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] border border-slate-100/80 flex items-center justify-between cursor-pointer" onClick={() => setIsUrgent(!isUrgent)}>
            <div className="flex flex-col">
              <span className="text-lg font-black text-slate-800">Tingkat Urgensi</span>
              <span className="text-xs text-slate-500 mt-0.5">Tandai jika butuh penanganan segera</span>
            </div>
            
            {/* Custom Toggle Switch */}
            <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ease-in-out relative flex items-center ${
              isUrgent ? 'bg-red-500' : 'bg-slate-200'
            }`}>
              <div className={`w-6 h-6 rounded-full bg-white shadow-sm transform transition-transform duration-300 ease-in-out ${
                isUrgent ? 'translate-x-6' : 'translate-x-0'
              }`}></div>
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <button
          onClick={handleSubmit}
          disabled={submitState.status === 'loading'}
          className={`w-full mt-2 py-4 text-white rounded-2xl font-black text-[17px] shadow-lg transition-all flex items-center justify-center gap-2 ${submitState.status === 'loading' ? 'bg-blue-400 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30 active:scale-[0.98]'}`}
        >
          {submitState.status === 'loading' ? (
            <>
              <span className="material-icons-round animate-spin">refresh</span>
              Memproses...
            </>
          ) : (
            <>
              <span className="material-icons-round">send</span>
              Ajukan Permintaan
            </>
          )}
        </button>

      </div>
    </div>
  );
}
