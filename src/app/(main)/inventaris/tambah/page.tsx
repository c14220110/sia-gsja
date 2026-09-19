'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import Link from 'next/link';

export default function TambahInventarisPage() {
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });
  
  const [kategoriOptions, setKategoriOptions] = useState<any[]>([]);
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [sublokasiOptions, setSublokasiOptions] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    tipe_barang: 'massal' as 'massal' | 'satuan',
    nama: '',
    kategori_id: '',
    merk: '',
    no_seri: '',
    jumlah: '1',
    jumlah_unit: '1',   // hanya untuk satuan — berapa unit yang dibuat sekaligus
    kondisi: 'Baik',
    tahun_perolehan: '',
    nilai_perolehan: '',
    pemilik_tipe: 'satelit',
    pemilik_satelit_id: '',
    pemilik_nama_lain: '',
    lokasi_satelit_id: '',
    lokasi_sublokasi_id: '',
    foto_url: ''
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      showLoader();
      try {
        const [resKategori, resSatelit] = await Promise.all([
          fetch('/api/inventaris/master?type=kategori'),
          fetch('/api/options?type=satelit')
        ]);
        const kategoriData = await resKategori.json();
        const satelitData = await resSatelit.json();

        if (kategoriData.success) setKategoriOptions(kategoriData.data);
        if (satelitData.success) setSatelitOptions(satelitData.data);
      } catch (error) {
        console.error('Failed to fetch options', error);
      } finally {
        hideLoader();
      }
    };
    fetchOptions();
  }, []); // TRIGGER KOSONG

  useEffect(() => {
    if (!formData.lokasi_satelit_id) {
      setSublokasiOptions([]);
      return;
    }
    const fetchSublokasi = async () => {
      try {
        const res = await fetch(`/api/inventaris/master?type=sublokasi&satelit_id=${formData.lokasi_satelit_id}`);
        const data = await res.json();
        if (data.success) setSublokasiOptions(data.data);
      } catch (error) {
        console.error('Failed to fetch sublokasi', error);
      }
    };
    fetchSublokasi();
  }, [formData.lokasi_satelit_id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewFoto(URL.createObjectURL(file));
    }
  };

  const uploadFoto = async (): Promise<string> => {
    if (!selectedFile) return formData.foto_url;

    const formDataUpload = new FormData();
    formDataUpload.append('file', selectedFile);

    const res = await fetch('/api/inventaris/upload', {
      method: 'POST',
      body: formDataUpload,
    });

    // Cek status dulu sebelum parse JSON — hindari crash jika server return plain text
    if (!res.ok) {
      let msg = `Upload gagal (${res.status} ${res.statusText})`;
      try {
        const d = await res.json();
        msg = d.message || msg;
      } catch {
        // Response bukan JSON (misal 413 "Request Entity Too Large")
        const text = await res.text().catch(() => '');
        if (text) msg = `Upload gagal: ${text.slice(0, 100)}`;
      }
      throw new Error(msg);
    }

    const data = await res.json();
    if (data.success) return data.url;
    throw new Error(data.message || 'Gagal mengupload foto');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitState({ status: 'loading', message: '' });
    
    try {
      let fotoUrl = formData.foto_url;
      if (selectedFile) {
        fotoUrl = await uploadFoto();
      }
      
      const isSatuan = formData.tipe_barang === 'satuan';
      const jumlahUnit = isSatuan ? Math.max(1, Math.min(50, parseInt(formData.jumlah_unit, 10) || 1)) : 1;

      const basePayload = {
        ...formData,
        foto_url: fotoUrl,
        jumlah: isSatuan ? '1' : formData.jumlah,
      };
      
      if (basePayload.pemilik_tipe === 'satelit') {
        basePayload.pemilik_nama_lain = '';
      } else {
        basePayload.pemilik_satelit_id = '';
      }

      // Strip internal-only fields before sending to API
      const { jumlah_unit: _ju, ...apiPayload } = basePayload as any;

      if (jumlahUnit === 1) {
        // Single item (massal or 1 satuan)
        const res = await fetch('/api/inventaris', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiPayload),
        });
        const result = await res.json();
        if (result.success) {
          setSubmitState({ status: 'success', message: isSatuan ? '1 unit berhasil ditambahkan' : 'Data berhasil ditambahkan' });
          setTimeout(() => router.push('/inventaris'), 1500);
        } else {
          setSubmitState({ status: 'error', message: result.message || 'Gagal menambahkan data' });
        }
      } else {
        // Bulk satuan: create N units sequentially
        // Each unit gets a unique no_seri suffix to avoid UNIQUE constraint violation
        const baseNoSeri = (apiPayload.no_seri || '').trim();
        let successCount = 0;
        const errors: string[] = [];
        for (let i = 0; i < jumlahUnit; i++) {
          const unitPayload = {
            ...apiPayload,
            // Auto-suffix no_seri: "SN-001" → "SN-001-01", "SN-001-02" …
            // If no_seri is empty, leave null so DB unique constraint isn't triggered
            no_seri: baseNoSeri
              ? `${baseNoSeri}-${String(i + 1).padStart(2, '0')}`
              : '',
          };
          try {
            const res = await fetch('/api/inventaris', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(unitPayload),
            });
            const result = await res.json();
            if (result.success) successCount++;
            else errors.push(result.message || `Unit ${i + 1} gagal`);
          } catch {
            errors.push(`Unit ${i + 1}: koneksi error`);
          }
        }
        if (successCount === jumlahUnit) {
          setSubmitState({ status: 'success', message: `${successCount} unit berhasil ditambahkan` });
          setTimeout(() => router.push('/inventaris'), 1800);
        } else if (successCount > 0) {
          setSubmitState({ status: 'success', message: `${successCount} dari ${jumlahUnit} unit berhasil. Error: ${errors.join('; ')}` });
          setTimeout(() => router.push('/inventaris'), 2500);
        } else {
          setSubmitState({ status: 'error', message: errors.join('; ') || 'Semua unit gagal ditambahkan' });
        }
      }
    } catch (error: any) {
      console.error(error);
      setSubmitState({ status: 'error', message: error.message || 'Terjadi kesalahan koneksi.' });
    }
  };

  const isSatuan = formData.tipe_barang === 'satuan';

  return (
    <div className="w-full flex flex-col gap-8 pb-10">
      
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <Link href="/inventaris" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors mb-2 w-fit">
            <span className="material-icons-round text-[18px]">arrow_back</span>
            <span className="text-sm font-semibold font-sans">Kembali ke Inventaris</span>
          </Link>
          <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Tambah Barang</h1>
          <div className="text-slate-500 text-base font-medium font-sans leading-6">Input data barang / inventaris baru</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Tipe Barang Selector */}
        <div className="px-6 pt-6 pb-2">
          <label className="text-slate-700 text-sm font-bold font-sans block mb-3">Tipe Barang <span className="text-rose-500">*</span></label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, tipe_barang: 'massal' }))}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                !isSatuan
                  ? 'border-slate-700 bg-slate-700 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="text-2xl mb-1">📦</div>
              <div className="font-bold text-sm">Stok Massal</div>
              <div className={`text-xs mt-0.5 ${!isSatuan ? 'text-slate-300' : 'text-slate-400'}`}>
                Kursi, meja, kabel dll — jumlah banyak
              </div>
            </button>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, tipe_barang: 'satuan', jumlah: '1' }))}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                isSatuan
                  ? 'border-slate-700 bg-slate-700 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="text-2xl mb-1">🏷️</div>
              <div className="font-bold text-sm">Aset Satuan</div>
              <div className={`text-xs mt-0.5 ${isSatuan ? 'text-slate-300' : 'text-slate-400'}`}>
                Proyektor, laptop, AC — 1 unit unik
              </div>
            </button>
          </div>
          {isSatuan && (
            <div className="mt-2 flex flex-col gap-2">
              <div className="px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 text-xs font-medium flex items-start gap-2">
                <span className="material-icons-round text-[14px] flex-shrink-0 mt-0.5">info</span>
                <span>Setiap unit fisik = <strong>1 data terpisah</strong> dengan kode QR unik. Kosongkan No. Seri jika tidak ada — kode barang otomatis terbuat.</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <label className="text-slate-700 text-xs font-bold whitespace-nowrap">Buat berapa unit sekaligus?</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.jumlah_unit}
                  onChange={(e) => setFormData(prev => ({ ...prev, jumlah_unit: e.target.value }))}
                  className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 font-bold"
                />
                <span className="text-xs text-slate-400">unit (maks. 50) — masing-masing dapat kode unik otomatis</span>
              </div>
            </div>
          )}
        </div>

        {/* Form Sections */}
        <div className="p-6 flex flex-col gap-8">
          
          {/* Section 1: Data Utama */}
          <div className="flex flex-col gap-4">
            <h2 className="text-slate-800 text-lg font-bold font-sans border-b border-slate-100 pb-2">Informasi Barang</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Nama Barang <span className="text-rose-500">*</span></label>
                <input type="text" name="nama" required value={formData.nama} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm" placeholder={isSatuan ? 'Contoh: Proyektor Epson EB-X41' : 'Contoh: Kursi Lipat'} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Kategori <span className="text-rose-500">*</span></label>
                <select name="kategori_id" required value={formData.kategori_id} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm">
                  <option value="">Pilih Kategori</option>
                  {kategoriOptions.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Merk</label>
                <input type="text" name="merk" value={formData.merk} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm" placeholder="Contoh: Yamaha" />
              </div>
              <div className="flex flex-col gap-2">
                {(() => {
                  const isBulk = isSatuan && parseInt(formData.jumlah_unit, 10) > 1;
                  return (
                    <>
                      <label className="text-slate-700 text-sm font-bold font-sans">
                        {isSatuan ? 'No. Seri / Kode Unit' : 'No. Seri'}
                        {isSatuan && !isBulk && <span className="text-rose-500 ml-1">*</span>}
                        {isSatuan && !isBulk && <span className="ml-2 text-xs font-normal text-slate-400">(wajib untuk 1 unit)</span>}
                        {isBulk && <span className="ml-2 text-xs font-normal text-indigo-500">(opsional saat bulk — akan ditambah suffix otomatis)</span>}
                      </label>
                      <input
                        type="text"
                        name="no_seri"
                        required={isSatuan && !isBulk}
                        value={formData.no_seri}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm"
                        placeholder={
                          isBulk
                            ? `Contoh: SN-2024 → akan jadi SN-2024-01, SN-2024-02, ... (kosongkan jika tidak ada)`
                            : isSatuan
                            ? 'Contoh: SN-EPSON-2024-001'
                            : 'Contoh: SN-123456 (opsional)'
                        }
                      />
                      {isBulk && formData.no_seri && (
                        <p className="text-xs text-indigo-600 flex items-center gap-1">
                          <span className="material-icons-round text-[12px]">auto_awesome</span>
                          Akan dibuat: <strong>{formData.no_seri}-01</strong>, <strong>{formData.no_seri}-02</strong>, ... , <strong>{formData.no_seri}-{String(parseInt(formData.jumlah_unit, 10) || 1).padStart(2, '0')}</strong>
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Jumlah — hanya untuk Stok Massal */}
              {!isSatuan ? (
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 text-sm font-bold font-sans">Jumlah</label>
                  <input type="number" name="jumlah" required min="1" value={formData.jumlah} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm" />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 text-sm font-bold font-sans">Jumlah</label>
                  <div className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-sm flex items-center gap-2">
                    <span className="material-icons-round text-[16px] text-slate-400">lock</span>
                    1 unit (otomatis untuk Aset Satuan)
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Kondisi</label>
                <select name="kondisi" required value={formData.kondisi} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm">
                  <option value="Baik">Baik</option>
                  <option value="Rusak Ringan">Rusak Ringan</option>
                  <option value="Rusak Berat">Rusak Berat</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Tahun Perolehan</label>
                <input type="number" name="tahun_perolehan" min="1900" max={new Date().getFullYear() + 1} value={formData.tahun_perolehan} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm" placeholder="YYYY" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Nilai Perolehan (Rp)</label>
                <input type="number" name="nilai_perolehan" min="0" value={formData.nilai_perolehan} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm" placeholder="Contoh: 1500000" />
              </div>
            </div>
            
            <div className="flex flex-col gap-2 mt-2">
              <label className="text-slate-700 text-sm font-bold font-sans">Foto Barang</label>
              <div className="flex items-start gap-4">
                {previewFoto && (
                  <img src={previewFoto} alt="Preview" className="w-24 h-24 object-cover rounded-lg border border-slate-200" />
                )}
                <input type="file" accept="image/*" onChange={handleFileChange} className="w-full max-w-sm px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 transition-colors" />
              </div>
            </div>
          </div>
          
          {/* Section 2: Pemilik */}
          <div className="flex flex-col gap-4">
            <h2 className="text-slate-800 text-lg font-bold font-sans border-b border-slate-100 pb-2">Informasi Kepemilikan</h2>
            
            <div className="flex gap-6 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="pemilik_tipe" value="satelit" checked={formData.pemilik_tipe === 'satelit'} onChange={handleChange} className="w-4 h-4 text-slate-600 focus:ring-slate-500" />
                <span className="text-slate-700 text-sm font-medium">Satelit</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="pemilik_tipe" value="individu" checked={formData.pemilik_tipe === 'individu'} onChange={handleChange} className="w-4 h-4 text-slate-600 focus:ring-slate-500" />
                <span className="text-slate-700 text-sm font-medium">Individu / Lainnya</span>
              </label>
            </div>
            
            {formData.pemilik_tipe === 'satelit' ? (
              <div className="flex flex-col gap-2 max-w-md">
                <label className="text-slate-700 text-sm font-bold font-sans">Pilih Satelit Pemilik</label>
                <select name="pemilik_satelit_id" value={formData.pemilik_satelit_id} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm">
                  <option value="">Pilih Satelit</option>
                  {satelitOptions.map(s => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                </select>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-w-md">
                <label className="text-slate-700 text-sm font-bold font-sans">Nama Pemilik Lainnya</label>
                <input type="text" name="pemilik_nama_lain" value={formData.pemilik_nama_lain} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm" placeholder="Masukkan nama pemilik" />
              </div>
            )}
          </div>
          
          {/* Section 3: Lokasi */}
          <div className="flex flex-col gap-4">
            <h2 className="text-slate-800 text-lg font-bold font-sans border-b border-slate-100 pb-2">Informasi Lokasi</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Satelit Lokasi</label>
                <select name="lokasi_satelit_id" value={formData.lokasi_satelit_id} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm">
                  <option value="">Pilih Lokasi Satelit</option>
                  {satelitOptions.map(s => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Sub-lokasi</label>
                <select name="lokasi_sublokasi_id" value={formData.lokasi_sublokasi_id} onChange={handleChange} disabled={!formData.lokasi_satelit_id} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm disabled:opacity-50">
                  <option value="">Pilih Sub-lokasi</option>
                  {sublokasiOptions.map(sub => <option key={sub.id} value={sub.id}>{sub.nama}</option>)}
                </select>
              </div>
            </div>
          </div>
          
        </div>
        
        {/* Footer actions */}
        <div className="w-full px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <Link href="/inventaris" className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold font-sans hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400">
            Batal
          </Link>
          <button type="submit" disabled={submitState.status === 'loading'} className="px-5 py-2.5 bg-slate-700 text-white rounded-lg text-sm font-bold font-sans hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50 flex items-center gap-2">
            {submitState.status === 'loading' ? <span className="material-icons-round animate-spin text-[18px]">sync</span> : <span className="material-icons-round text-[18px]">save</span>}
            {isSatuan && parseInt(formData.jumlah_unit, 10) > 1
              ? `Simpan ${parseInt(formData.jumlah_unit, 10)} Unit Sekaligus`
              : 'Simpan Barang'
            }
          </button>
        </div>
      </form>

      <SubmitOverlay 
        status={submitState.status} 
        message={submitState.message} 
        errors={submitState.errors} 
        onClose={() => setSubmitState({ status: 'idle', message: '' })} 
      />
    </div>
  );
}
