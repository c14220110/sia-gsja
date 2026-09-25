'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

// ── JemaatAutocomplete (public version using /api/public/options) ──────────
const JemaatAutocomplete = ({
  label,
  valueName,
  valueId,
  onSelect,
  placeholder = 'Ketik nama...',
}: {
  label: string;
  valueName: string;
  valueId: string;
  onSelect: (id: string, name: string) => void;
  placeholder?: string;
}) => {
  const [query, setQuery] = useState(valueName);
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(valueName); }, [valueName]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const search = async (term: string) => {
    setQuery(term);
    onSelect('', term);
    if (term.length < 2) { setResults([]); setIsOpen(false); return; }
    try {
      setLoading(true);
      const res = await fetch(`/api/public/options?type=jemaat_search&q=${encodeURIComponent(term)}`);
      const data = await res.json();
      if (data.success && data.data.length > 0) { setResults(data.data); setIsOpen(true); }
      else { setResults([]); setIsOpen(false); }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  return (
    <div className="w-full relative" ref={wrapperRef}>
      {label && <label className="text-sm font-bold text-slate-700 block mb-2">{label}</label>}
      <input
        type="text" value={query}
        onChange={(e) => search(e.target.value)}
        onFocus={() => { if (results.length > 0) setIsOpen(true); }}
        placeholder={placeholder}
        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
      />
      {isOpen && (
        <div className="absolute z-30 top-full mt-1 w-full bg-white rounded-2xl border border-slate-200 shadow-xl max-h-52 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm text-slate-500 text-center">Mencari...</div>
          ) : results.map((j) => (
            <div key={j.id} className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
              onClick={() => { onSelect(j.id.toString(), j.nama_lengkap); setQuery(j.nama_lengkap); setIsOpen(false); }}>
              <div className="text-[15px] font-semibold text-slate-900">{j.nama_lengkap}</div>
              <div className="text-xs text-slate-400 mt-0.5">{j.jemaat_id} · {j.jenis_kelamin}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────
export default function DaftarJemaatPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string; errors?: any }>({
    status: 'idle', message: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [pekerjaanOptions, setPekerjaanOptions] = useState<any[]>([]);
  const [inputPekerjaanManual, setInputPekerjaanManual] = useState(false);
  const [tidakPunyaKontak, setTidakPunyaKontak] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');

  const [formData, setFormData] = useState({
    nama_lengkap: '',
    jenis_kelamin: 'Laki-laki',
    tempat_lahir: '',
    tanggal_lahir: '',
    alamat: '',
    kota: 'Surabaya',
    kecamatan: '',
    kelurahan: '',
    kode_pos: '',
    no_hp: '',
    email: '',
    pekerjaan: '',
    pekerjaan_id: '',
    satelit_id: '',
    status_baptis: 'Belum',
    status_pernikahan: 'Lajang',
    status_jemaat: 'Aktif',
    foto_url: '',
    ayah_id: '', ayah_nama: '', gereja_asal_ayah: '',
    ibu_id: '', ibu_nama: '', gereja_asal_ibu: '',
    pasangan_id: '', pasangan_nama: '', gereja_asal_pasangan: '',
    anak: [] as { anak_jemaat_id: string; nama_anak: string; gereja_asal_anak: string }[],
    saudara: [] as { saudara_jemaat_id: string; nama_saudara: string; gereja_asal_saudara: string }[],
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/public/options?type=satelit').then(r => r.json()),
      fetch('/api/public/options?type=pekerjaan').then(r => r.json()),
    ]).then(([sat, pek]) => {
      if (sat.success) setSatelitOptions(sat.data);
      if (pek.success) setPekerjaanOptions(pek.data);
    }).catch(console.error);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    let file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) { alert('Ukuran maksimal foto 5MB'); return; }
    try {
      if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
        setSubmitState({ status: 'loading', message: 'Mengkonversi format HEIC...' });
        const heic2any = (await import('heic2any')).default;
        const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
        const blob = Array.isArray(converted) ? converted[0] : converted;
        const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
        file = new File([blob], `${baseName}.jpeg`, { type: 'image/jpeg', lastModified: Date.now() });
        setSubmitState({ status: 'idle', message: '' });
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setFormData(prev => ({ ...prev, foto_url: '' }));
    } catch {
      alert('Gagal memproses foto. Coba format JPEG/PNG.');
      setSubmitState({ status: 'idle', message: '' });
    }
  };

  const handlePekerjaanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'Other') {
      setInputPekerjaanManual(true);
      setFormData(prev => ({ ...prev, pekerjaan_id: '', pekerjaan: '' }));
    } else {
      setInputPekerjaanManual(false);
      setFormData(prev => ({ ...prev, pekerjaan_id: val, pekerjaan: '' }));
    }
  };

  const handleAddAnak = () => setFormData(prev => ({ ...prev, anak: [...prev.anak, { anak_jemaat_id: '', nama_anak: '', gereja_asal_anak: '' }] }));
  const handleRemoveAnak = (i: number) => setFormData(prev => ({ ...prev, anak: prev.anak.filter((_, idx) => idx !== i) }));
  const handleAnakChange = (i: number, field: string, value: string) => setFormData(prev => {
    const a = [...prev.anak]; a[i] = { ...a[i], [field]: value }; return { ...prev, anak: a };
  });

  const handleAddSaudara = () => setFormData(prev => ({ ...prev, saudara: [...prev.saudara, { saudara_jemaat_id: '', nama_saudara: '', gereja_asal_saudara: '' }] }));
  const handleRemoveSaudara = (i: number) => setFormData(prev => ({ ...prev, saudara: prev.saudara.filter((_, idx) => idx !== i) }));
  const handleSaudaraChange = (i: number, field: string, value: string) => setFormData(prev => {
    const s = [...prev.saudara]; s[i] = { ...s[i], [field]: value }; return { ...prev, saudara: s };
  });

  const handleSubmit = async () => {
    if (isSubmitting) return; // prevent double submit
    if (!formData.nama_lengkap.trim()) { setSubmitState({ status: 'error', message: 'Nama lengkap wajib diisi.' }); return; }
    if (!formData.tanggal_lahir) { setSubmitState({ status: 'error', message: 'Tanggal lahir wajib diisi.' }); return; }
    if (!formData.kota.trim()) { setSubmitState({ status: 'error', message: 'Kota wajib diisi.' }); return; }
    if (!formData.satelit_id) { setSubmitState({ status: 'error', message: 'Pilih satelit gereja Anda.' }); return; }
    if (!tidakPunyaKontak && !formData.no_hp && !formData.email) {
      setSubmitState({ status: 'error', message: 'Isi minimal No. Telepon atau Alamat Email.' }); return;
    }
    if (tidakPunyaKontak && !usernameInput.trim()) {
      setSubmitState({ status: 'error', message: 'Username wajib diisi jika tidak punya Email/No. Telepon.' }); return;
    }

    try {
      setIsSubmitting(true);
      setSubmitState({ status: 'loading', message: 'Mengirim pendaftaran...' });

      let finalFotoUrl = formData.foto_url;
      if (imageFile) {
        const fd = new FormData();
        fd.append('file', imageFile);
        const upRes = await fetch('/api/public/upload', { method: 'POST', body: fd });
        const upJson = await upRes.json();
        if (upJson.success) {
          finalFotoUrl = upJson.url;
        } else {
          setSubmitState({ status: 'error', message: 'Gagal upload foto: ' + upJson.message });
          setIsSubmitting(false);
          return;
        }
      }

      const payload = {
        ...formData,
        foto_url: finalFotoUrl || null,
        tidak_punya_kontak: tidakPunyaKontak,
        username: tidakPunyaKontak ? usernameInput.trim() : undefined,
      };

      const res = await fetch('/api/public/daftar-jemaat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitState({ status: 'success', message: data.message });
      } else {
        setSubmitState({ status: 'error', message: data.message || 'Gagal mengirim pendaftaran.' });
      }
    } catch {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan. Periksa koneksi internet Anda.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = 'w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400';
  const labelCls = 'text-sm font-bold text-slate-700 block mb-2';
  const sectionCardCls = 'bg-white rounded-[24px] p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] border border-slate-100/80';
  const sectionLabelCls = 'flex items-center gap-2 mb-4';

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.08)]">
        <div className="max-w-md mx-auto px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="material-icons-round text-white text-[20px]">church</span>
            </div>
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">GSJA</p>
              <h1 className="text-[17px] font-black text-slate-900 leading-tight">Pendaftaran Jemaat Baru</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 pb-16 pt-5 flex flex-col gap-4">
        {/* Hero banner */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-[24px] p-5 text-white">
          <p className="text-[22px] font-black leading-tight mb-1">Selamat Datang! 👋</p>
          <p className="text-[14px] text-blue-100 leading-relaxed">Lengkapi formulir di bawah ini untuk mendaftarkan diri sebagai jemaat. Data Anda akan ditinjau oleh sekretaris gereja.</p>
        </div>

        {/* ── SEKSI 1: FOTO ─────────────────────────────────────────── */}
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1 mt-2">Foto Diri</p>
        <div className={sectionCardCls}>
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-28 h-28 rounded-[20px] bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center">
                {imagePreview ? (
                  <img src={imagePreview} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-icons-round text-slate-300 text-[52px]">person</span>
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg border-2 border-white active:scale-95 transition-transform">
                <span className="material-icons-round text-white text-[18px]">add_a_photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            </div>
            <div className="text-center">
              <p className="text-[15px] font-bold text-slate-700">Upload Foto Anda</p>
              <p className="text-[13px] text-slate-400 mt-0.5">Setengah badan, wajah terlihat jelas</p>
              <p className="text-[12px] text-slate-400">Format: JPG/PNG/HEIC, maks. 5MB</p>
            </div>
          </div>
        </div>

        {/* ── SEKSI 2: DATA DIRI ────────────────────────────────────── */}
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1 mt-2">Data Diri</p>
        <div className={sectionCardCls}>
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelCls}>Nama Lengkap <span className="text-rose-500">*</span></label>
              <input type="text" name="nama_lengkap" value={formData.nama_lengkap} onChange={handleInputChange}
                placeholder="Nama sesuai KTP" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Jenis Kelamin</label>
                <select name="jenis_kelamin" value={formData.jenis_kelamin} onChange={handleInputChange} className={inputCls}>
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Kota Lahir</label>
                <input type="text" name="tempat_lahir" value={formData.tempat_lahir} onChange={handleInputChange}
                  placeholder="Surabaya" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Tanggal Lahir <span className="text-rose-500">*</span></label>
              <input type="date" name="tanggal_lahir" value={formData.tanggal_lahir} onChange={handleInputChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Pekerjaan</label>
              <select value={formData.pekerjaan_id || (inputPekerjaanManual ? 'Other' : '')} onChange={handlePekerjaanChange} className={inputCls}>
                <option value="">-- Pilih Pekerjaan --</option>
                {pekerjaanOptions.map(p => <option key={p.id} value={p.id}>{p.nama_pekerjaan}</option>)}
                <option value="Other">Lainnya (Ketik Manual)</option>
              </select>
              {inputPekerjaanManual && (
                <input type="text" name="pekerjaan" value={formData.pekerjaan} onChange={handleInputChange}
                  placeholder="Ketik profesi Anda..." className={`${inputCls} mt-2`} />
              )}
            </div>
          </div>
        </div>

        {/* ── SEKSI 3: ALAMAT ───────────────────────────────────────── */}
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1 mt-2">Alamat Tempat Tinggal</p>
        <div className={sectionCardCls}>
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelCls}>Alamat Lengkap</label>
              <input type="text" name="alamat" value={formData.alamat} onChange={handleInputChange}
                placeholder="Jl. nama jalan, No. rumah" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Kota <span className="text-rose-500">*</span></label>
              <input type="text" name="kota" value={formData.kota} onChange={handleInputChange}
                placeholder="Surabaya" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Kecamatan</label>
                <input type="text" name="kecamatan" value={formData.kecamatan} onChange={handleInputChange} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Kelurahan</label>
                <input type="text" name="kelurahan" value={formData.kelurahan} onChange={handleInputChange} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Kode Pos</label>
              <input type="text" name="kode_pos" value={formData.kode_pos} onChange={handleInputChange}
                placeholder="60000" className={inputCls} />
            </div>
          </div>
        </div>

        {/* ── SEKSI 4: KONTAK ───────────────────────────────────────── */}
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1 mt-2">Kontak & Login</p>
        <div className={sectionCardCls}>
          <div className="flex flex-col gap-4">
            {/* Toggle tidak punya kontak */}
            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer active:scale-[0.99] transition-transform">
              <input
                type="checkbox" checked={tidakPunyaKontak}
                onChange={(e) => {
                  setTidakPunyaKontak(e.target.checked);
                  if (e.target.checked) setFormData(prev => ({ ...prev, no_hp: '', email: '' }));
                  else setUsernameInput('');
                }}
                className="w-5 h-5 rounded accent-blue-600 flex-shrink-0"
              />
              <div>
                <p className="text-[15px] font-bold text-slate-700">Tidak punya No. HP atau Email</p>
                <p className="text-[12px] text-slate-400">Akan menggunakan username untuk login</p>
              </div>
            </label>

            {tidakPunyaKontak ? (
              <div>
                <label className={labelCls}>Username <span className="text-rose-500">*</span></label>
                <input type="text" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="username_anda" className={inputCls} />
                <p className="text-[12px] text-slate-400 mt-2">💡 Username dipakai untuk login. Password default: tanggal lahir.</p>
              </div>
            ) : (
              <>
                <div>
                  <label className={labelCls}>No. Telepon / WA <span className="text-slate-400 font-normal">(minimal salah satu)</span></label>
                  <input type="tel" name="no_hp" value={formData.no_hp} onChange={handleInputChange}
                    placeholder="08xxxxxxxxxx" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Alamat Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange}
                    placeholder="email@contoh.com" className={inputCls} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── SEKSI 5: STATUS JEMAAT ────────────────────────────────── */}
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1 mt-2">Status Jemaat</p>
        <div className={sectionCardCls}>
          <div className="flex flex-col gap-4">
            {/* Status baptis — radio cards besar */}
            <div>
              <label className={labelCls}>Status Baptis</label>
              <div className="grid grid-cols-2 gap-3">
                {['Sudah', 'Belum'].map(val => (
                  <label key={val}
                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all active:scale-[0.98] ${
                      formData.status_baptis === val
                        ? 'border-blue-500 bg-blue-50/50'
                        : 'border-slate-200 bg-white'
                    }`}>
                    <input type="radio" name="status_baptis" value={val}
                      checked={formData.status_baptis === val} onChange={handleInputChange} className="hidden" />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      formData.status_baptis === val ? 'border-blue-500' : 'border-slate-300'
                    }`}>
                      {formData.status_baptis === val && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                    </div>
                    <span className={`text-[15px] font-bold ${
                      formData.status_baptis === val ? 'text-blue-800' : 'text-slate-600'
                    }`}>{val} Baptis</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status jemaat — radio cards */}
            <div>
              <label className={labelCls}>Keaktifan Jemaat</label>
              <div className="grid grid-cols-2 gap-3">
                {[{val: 'Aktif', label: 'Jemaat Aktif'}, {val: 'Musiman', label: 'Jemaat Musiman'}].map(({val, label}) => (
                  <label key={val}
                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all active:scale-[0.98] ${
                      formData.status_jemaat === val
                        ? 'border-blue-500 bg-blue-50/50'
                        : 'border-slate-200 bg-white'
                    }`}>
                    <input type="radio" name="status_jemaat" value={val}
                      checked={formData.status_jemaat === val} onChange={handleInputChange} className="hidden" />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      formData.status_jemaat === val ? 'border-blue-500' : 'border-slate-300'
                    }`}>
                      {formData.status_jemaat === val && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                    </div>
                    <span className={`text-[14px] font-bold ${
                      formData.status_jemaat === val ? 'text-blue-800' : 'text-slate-600'
                    }`}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status pernikahan */}
            <div>
              <label className={labelCls}>Status Pernikahan</label>
              <select name="status_pernikahan" value={formData.status_pernikahan} onChange={handleInputChange} className={inputCls}>
                <option value="Lajang">Lajang</option>
                <option value="Menikah">Menikah</option>
                <option value="Duda">Duda</option>
                <option value="Janda">Janda</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── SEKSI 6: DATA KELUARGA ────────────────────────────────── */}
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1 mt-2">Data Keluarga <span className="text-slate-400 font-normal normal-case">(opsional)</span></p>

        {/* Pasangan — hanya jika Menikah */}
        {formData.status_pernikahan === 'Menikah' && (
          <div className={sectionCardCls}>
            <div className={sectionLabelCls}>
              <span className="material-icons-round text-pink-500 text-[20px]">favorite</span>
              <span className="text-[15px] font-black text-slate-800">Data Pasangan</span>
            </div>
            <JemaatAutocomplete label="Nama Pasangan" valueName={formData.pasangan_nama} valueId={formData.pasangan_id}
              placeholder="Cari nama jemaat..." onSelect={(id, name) => setFormData(prev => ({ ...prev, pasangan_id: id, pasangan_nama: name }))} />
            {!formData.pasangan_id && formData.pasangan_nama.length > 2 && (
              <div className="mt-3">
                <label className={labelCls}>Gereja Asal Pasangan</label>
                <input type="text" name="gereja_asal_pasangan" value={formData.gereja_asal_pasangan} onChange={handleInputChange}
                  placeholder="Isi jika dari luar GSJA" className={inputCls} />
              </div>
            )}
          </div>
        )}

        {/* Orang Tua */}
        <div className={sectionCardCls}>
          <div className={sectionLabelCls}>
            <span className="material-icons-round text-amber-500 text-[20px]">family_restroom</span>
            <span className="text-[15px] font-black text-slate-800">Orang Tua</span>
          </div>
          <div className="flex flex-col gap-4">
            <JemaatAutocomplete label="Nama Ayah" valueName={formData.ayah_nama} valueId={formData.ayah_id}
              placeholder="Cari nama / ketik nama" onSelect={(id, name) => setFormData(prev => ({ ...prev, ayah_id: id, ayah_nama: name }))} />
            {!formData.ayah_id && formData.ayah_nama.length > 2 && (
              <div>
                <label className={labelCls}>Gereja Asal Ayah</label>
                <input type="text" name="gereja_asal_ayah" value={formData.gereja_asal_ayah} onChange={handleInputChange}
                  placeholder="Isi jika dari luar GSJA" className={inputCls} />
              </div>
            )}
            <div className="border-t border-slate-100" />
            <JemaatAutocomplete label="Nama Ibu" valueName={formData.ibu_nama} valueId={formData.ibu_id}
              placeholder="Cari nama / ketik nama" onSelect={(id, name) => setFormData(prev => ({ ...prev, ibu_id: id, ibu_nama: name }))} />
            {!formData.ibu_id && formData.ibu_nama.length > 2 && (
              <div>
                <label className={labelCls}>Gereja Asal Ibu</label>
                <input type="text" name="gereja_asal_ibu" value={formData.gereja_asal_ibu} onChange={handleInputChange}
                  placeholder="Isi jika dari luar GSJA" className={inputCls} />
              </div>
            )}
          </div>
        </div>

        {/* Anak */}
        <div className={sectionCardCls}>
          <div className="flex items-center justify-between mb-4">
            <div className={sectionLabelCls} style={{marginBottom: 0}}>
              <span className="material-icons-round text-blue-400 text-[20px]">child_care</span>
              <span className="text-[15px] font-black text-slate-800">Data Anak</span>
            </div>
            <button type="button" onClick={handleAddAnak}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold active:scale-95 transition-transform">
              <span className="material-icons-round text-[16px]">add</span> Tambah
            </button>
          </div>
          {formData.anak.length === 0 ? (
            <div className="py-6 flex flex-col items-center gap-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <span className="material-icons-round text-slate-300 text-[36px]">child_care</span>
              <p className="text-[13px] text-slate-400">Belum ada anak. Ketuk &quot;+ Tambah&quot;.</p>
            </div>
          ) : formData.anak.map((ank, idx) => (
            <div key={idx} className="bg-blue-50/40 rounded-2xl border border-blue-100 p-4 mb-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400 uppercase">Anak ke-{idx + 1}</span>
                <button type="button" onClick={() => handleRemoveAnak(idx)}
                  className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-400 active:scale-95 transition-transform">
                  <span className="material-icons-round text-[16px]">close</span>
                </button>
              </div>
              <JemaatAutocomplete label="" valueName={ank.nama_anak} valueId={ank.anak_jemaat_id}
                placeholder="Cari database / ketik nama" onSelect={(id, name) => { handleAnakChange(idx, 'anak_jemaat_id', id); handleAnakChange(idx, 'nama_anak', name); }} />
              {!ank.anak_jemaat_id && ank.nama_anak.length > 2 && (
                <input type="text" value={ank.gereja_asal_anak} onChange={(e) => handleAnakChange(idx, 'gereja_asal_anak', e.target.value)}
                  placeholder="Gereja asal (jika bukan GSJA)" className={inputCls} />
              )}
            </div>
          ))}
        </div>

        {/* Saudara */}
        <div className={sectionCardCls}>
          <div className="flex items-center justify-between mb-4">
            <div className={sectionLabelCls} style={{marginBottom: 0}}>
              <span className="material-icons-round text-amber-500 text-[20px]">people</span>
              <span className="text-[15px] font-black text-slate-800">Saudara Kandung</span>
            </div>
            <button type="button" onClick={handleAddSaudara}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-600 rounded-xl text-sm font-bold active:scale-95 transition-transform">
              <span className="material-icons-round text-[16px]">add</span> Tambah
            </button>
          </div>
          {formData.saudara.length === 0 ? (
            <div className="py-6 flex flex-col items-center gap-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <span className="material-icons-round text-slate-300 text-[36px]">people_outline</span>
              <p className="text-[13px] text-slate-400">Belum ada saudara. Ketuk &quot;+ Tambah&quot;.</p>
            </div>
          ) : formData.saudara.map((sd, idx) => (
            <div key={idx} className="bg-amber-50/40 rounded-2xl border border-amber-100 p-4 mb-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-500 uppercase">Saudara ke-{idx + 1}</span>
                <button type="button" onClick={() => handleRemoveSaudara(idx)}
                  className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-400 active:scale-95 transition-transform">
                  <span className="material-icons-round text-[16px]">close</span>
                </button>
              </div>
              <JemaatAutocomplete label="" valueName={sd.nama_saudara} valueId={sd.saudara_jemaat_id}
                placeholder="Cari database / ketik nama" onSelect={(id, name) => { handleSaudaraChange(idx, 'saudara_jemaat_id', id); handleSaudaraChange(idx, 'nama_saudara', name); }} />
              {!sd.saudara_jemaat_id && sd.nama_saudara.length > 2 && (
                <input type="text" value={(sd as any).gereja_asal_saudara || ''} onChange={(e) => handleSaudaraChange(idx, 'gereja_asal_saudara', e.target.value)}
                  placeholder="Gereja asal (jika bukan GSJA)" className={inputCls} />
              )}
            </div>
          ))}
        </div>

        {/* ── SEKSI 7: SATELIT ──────────────────────────────────────── */}
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1 mt-2">Gereja</p>
        <div className={sectionCardCls}>
          <div className={sectionLabelCls}>
            <span className="material-icons-round text-blue-500 text-[20px]">church</span>
            <span className="text-[15px] font-black text-slate-800">Satelit GSJA</span>
          </div>
          <label className={labelCls}>Pilih Satelit Gereja <span className="text-rose-500">*</span></label>
          <select name="satelit_id" value={formData.satelit_id} onChange={handleInputChange} className={inputCls}>
            <option value="">-- Pilih Satelit --</option>
            {satelitOptions.map(s => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
          </select>
          <p className="text-[12px] text-slate-400 mt-2">Pilih gereja satelit GSJA yang Anda ikuti.</p>
        </div>

        {/* ── SUBMIT ────────────────────────────────────────────────── */}
        <div className="mt-4 flex flex-col gap-3">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-2xl font-black text-[17px] shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <><span className="material-icons-round animate-spin text-[20px]">sync</span> Mengirim...</>
            ) : (
              <><span className="material-icons-round text-[20px]">send</span> Kirim Pendaftaran</>
            )}
          </button>
          <p className="text-center text-[12px] text-slate-400">Data Anda akan ditinjau oleh sekretaris gereja sebelum disetujui.</p>
        </div>
      </div>

      <SubmitOverlay
        status={submitState.status}
        message={submitState.message}
        errors={submitState.errors}
        onClose={() => setSubmitState({ status: 'idle', message: '' })}
      />
    </div>
  );
}
