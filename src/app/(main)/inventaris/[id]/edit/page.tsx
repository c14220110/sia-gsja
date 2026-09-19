'use client';

import { useState, useEffect, use } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import Link from 'next/link';

function fotoUrlToProxy(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const key = new URL(url).pathname.slice(1);
    if (!key.startsWith('inventaris/')) return null;
    return `/api/inventaris/image?key=${encodeURIComponent(key)}`;
  } catch { return null; }
}

export default function EditInventarisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });
  
  const [kategoriOptions, setKategoriOptions] = useState<any[]>([]);
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [sublokasiOptions, setSublokasiOptions] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [formData, setFormData] = useState({
    tipe_barang: 'massal' as 'massal' | 'satuan',
    nama: '',
    kategori_id: '',
    merk: '',
    no_seri: '',
    jumlah: '1',
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
    const fetchAll = async () => {
      showLoader();
      try {
        const [resKategori, resSatelit, resBarang] = await Promise.all([
          fetch('/api/inventaris/master?type=kategori'),
          fetch('/api/options?type=satelit'),
          fetch(`/api/inventaris/${id}`)
        ]);
        const kategoriData = await resKategori.json();
        const satelitData = await resSatelit.json();
        const barangData = await resBarang.json();

        if (kategoriData.success) setKategoriOptions(kategoriData.data);
        if (satelitData.success) setSatelitOptions(satelitData.data);
        
        if (barangData.success) {
          const d = barangData.data;
          setFormData({
            tipe_barang: (d.tipe_barang || 'massal') as 'massal' | 'satuan',
            nama: d.nama || '',
            kategori_id: d.kategori_id?.toString() || '',
            merk: d.merk || '',
            no_seri: d.no_seri || '',
            jumlah: d.jumlah?.toString() || '1',
            kondisi: d.kondisi || 'Baik',
            tahun_perolehan: d.tahun_perolehan?.toString() || '',
            nilai_perolehan: d.nilai_perolehan?.toString() || '',
            pemilik_tipe: d.pemilik_tipe || 'satelit',
            pemilik_satelit_id: d.pemilik_satelit_id?.toString() || '',
            pemilik_nama_lain: d.pemilik_nama_lain || '',
            lokasi_satelit_id: d.lokasi_satelit_id?.toString() || '',
            lokasi_sublokasi_id: d.lokasi_sublokasi_id?.toString() || '',
            foto_url: d.foto_url || ''
          });
          if (d.foto_url) setPreviewFoto(fotoUrlToProxy(d.foto_url));
          setIsLoaded(true);
        }
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        hideLoader();
      }
    };
    fetchAll();
  }, [id]); // TRIGGER: id

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
    const res = await fetch('/api/inventaris/upload', { method: 'POST', body: formDataUpload });

    if (!res.ok) {
      let msg = `Upload gagal (${res.status} ${res.statusText})`;
      try { const d = await res.json(); msg = d.message || msg; }
      catch { const t = await res.text().catch(() => ''); if (t) msg = `Upload gagal: ${t.slice(0, 100)}`; }
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
      if (selectedFile) fotoUrl = await uploadFoto();
      
      const payload = {
        ...formData,
        foto_url: fotoUrl,
        jumlah: formData.tipe_barang === 'satuan' ? '1' : formData.jumlah,
      };
      if (payload.pemilik_tipe === 'satelit') payload.pemilik_nama_lain = '';
      else payload.pemilik_satelit_id = '';
      
      const res = await fetch(`/api/inventaris/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: 'Data berhasil diperbarui' });
        setTimeout(() => router.push(`/inventaris/${id}`), 1500);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal memperbarui data' });
      }
    } catch (error: any) {
      setSubmitState({ status: 'error', message: error.message || 'Terjadi kesalahan koneksi.' });
    }
  };

  if (!isLoaded) return null;

  const isSatuan = formData.tipe_barang === 'satuan';

  return (
    <div className="w-full flex flex-col gap-8 pb-10">
      <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => setSubmitState({ status: 'idle', message: '' })} />

      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Edit Barang</h1>
          <div className="text-slate-500 text-base font-medium font-sans leading-6">Perbarui data barang inventaris</div>
        </div>
        <Link href={`/inventaris/${id}`} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg flex justify-center items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm">
          <span className="material-icons-round text-slate-500 text-[20px]">arrow_back</span>
          <span className="text-sm font-bold font-sans leading-5">Batal</span>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Tipe Barang Selector */}
        <div className="px-6 pt-6 pb-2">
          <label className="text-slate-700 text-sm font-bold font-sans block mb-3">Tipe Barang <span className="text-rose-500">*</span></label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setFormData(prev => ({ ...prev, tipe_barang: 'massal' }))}
              className={`p-4 rounded-xl border-2 text-left transition-all ${!isSatuan ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
              <div className="text-2xl mb-1">📦</div>
              <div className="font-bold text-sm">Stok Massal</div>
              <div className={`text-xs mt-0.5 ${!isSatuan ? 'text-slate-300' : 'text-slate-400'}`}>Kursi, meja, kabel dll — jumlah banyak</div>
            </button>
            <button type="button" onClick={() => setFormData(prev => ({ ...prev, tipe_barang: 'satuan', jumlah: '1' }))}
              className={`p-4 rounded-xl border-2 text-left transition-all ${isSatuan ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
              <div className="text-2xl mb-1">🏷️</div>
              <div className="font-bold text-sm">Aset Satuan</div>
              <div className={`text-xs mt-0.5 ${isSatuan ? 'text-slate-300' : 'text-slate-400'}`}>Proyektor, laptop, AC — 1 unit unik</div>
            </button>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h2 className="text-slate-800 text-lg font-bold font-sans border-b border-slate-100 pb-2">Informasi Barang</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Nama Barang <span className="text-rose-500">*</span></label>
                <input type="text" name="nama" value={formData.nama} onChange={handleChange} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Kategori <span className="text-rose-500">*</span></label>
                <select name="kategori_id" value={formData.kategori_id} onChange={handleChange} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm">
                  <option value="">Pilih Kategori</option>
                  {kategoriOptions.map((k: any) => <option key={k.id} value={k.id}>{k.nama}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Merk</label>
                <input type="text" name="merk" value={formData.merk} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm" />
              </div>
              {/* No. Seri — hanya untuk Aset Satuan (dari label fisik pabrik, opsional) */}
              {isSatuan && (
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 text-sm font-bold font-sans">
                    No. Seri / Kode Unit
                    <span className="ml-2 text-xs font-normal text-slate-400">(dari label fisik produk — opsional)</span>
                  </label>
                  <input
                    type="text"
                    name="no_seri"
                    value={formData.no_seri}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm"
                    placeholder="Contoh: SN/C02ABC123DEF (dari stiker di bodi produk)"
                  />
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <span className="material-icons-round text-[12px]">info</span>
                    Nomor seri dari pabrik (Apple, Panasonic, dll). Tiap unit punya nomor berbeda.
                  </p>
                </div>
              )}
              {!isSatuan ? (
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 text-sm font-bold font-sans">Jumlah</label>
                  <input type="number" name="jumlah" value={formData.jumlah} onChange={handleChange} min="1" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm" />
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
                <select name="kondisi" value={formData.kondisi} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm">
                  <option value="Baik">Baik</option>
                  <option value="Rusak Ringan">Rusak Ringan</option>
                  <option value="Rusak Berat">Rusak Berat</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Tahun Perolehan</label>
                <input type="number" name="tahun_perolehan" value={formData.tahun_perolehan} onChange={handleChange} placeholder="2024" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Nilai Perolehan (Rp)</label>
                <input type="number" name="nilai_perolehan" value={formData.nilai_perolehan} onChange={handleChange} placeholder="0" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm" />
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <label className="text-slate-700 text-sm font-bold font-sans">Foto Barang</label>
              <div className="flex items-start gap-4">
                {previewFoto && <img src={previewFoto} alt="Preview" className="w-24 h-24 object-cover rounded-lg border border-slate-200" />}
                <input type="file" accept="image/*" onChange={handleFileChange} className="w-full max-w-sm px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 transition-colors" />
              </div>
            </div>
          </div>

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
                <select name="pemilik_satelit_id" value={formData.pemilik_satelit_id} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm">
                  <option value="">Pilih Satelit Pemilik</option>
                  {satelitOptions.map((s: any) => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                </select>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-w-md">
                <input type="text" name="pemilik_nama_lain" value={formData.pemilik_nama_lain} onChange={handleChange} placeholder="Nama pemilik individu" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-slate-800 text-lg font-bold font-sans border-b border-slate-100 pb-2">Informasi Lokasi</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Satelit Lokasi</label>
                <select name="lokasi_satelit_id" value={formData.lokasi_satelit_id} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm">
                  <option value="">Pilih Satelit</option>
                  {satelitOptions.map((s: any) => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Sub-Lokasi / Ruangan</label>
                <select name="lokasi_sublokasi_id" value={formData.lokasi_sublokasi_id} onChange={handleChange} disabled={!formData.lokasi_satelit_id} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm disabled:opacity-50">
                  <option value="">Pilih Sub-Lokasi</option>
                  {sublokasiOptions.map((sl: any) => <option key={sl.id} value={sl.id}>{sl.nama}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <Link href={`/inventaris/${id}`} className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold font-sans hover:bg-slate-100 transition-colors">
            Batal
          </Link>
          <button type="submit" disabled={submitState.status === 'loading'} className="px-5 py-2.5 bg-slate-700 text-white rounded-lg text-sm font-bold font-sans hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2">
            {submitState.status === 'loading' ? <span className="material-icons-round animate-spin text-[18px]">sync</span> : <span className="material-icons-round text-[18px]">save</span>}
            Simpan Perubahan
          </button>
        </div>
      </form>
    </div>
  );
}
