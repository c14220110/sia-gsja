'use client';

import { useState, useEffect, use } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import Link from 'next/link';

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

  // Fetch options + existing data
  useEffect(() => {
    let active = true;
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

        if (!active) return;

        if (kategoriData.success) setKategoriOptions(kategoriData.data);
        if (satelitData.success) setSatelitOptions(satelitData.data);
        
        if (barangData.success) {
          const d = barangData.data;
          setFormData({
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
          if (d.foto_url) setPreviewFoto(d.foto_url);
          setIsLoaded(true);
        }
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        if (active) hideLoader();
      }
    };
    fetchAll();
    return () => { active = false; };
  }, [id]);

  // Load sublokasi when lokasi_satelit_id changes
  useEffect(() => {
    let active = true;
    if (!formData.lokasi_satelit_id) {
      setSublokasiOptions([]);
      return;
    }
    const fetchSublokasi = async () => {
      try {
        const res = await fetch(`/api/inventaris/master?type=sublokasi&satelit_id=${formData.lokasi_satelit_id}`);
        const data = await res.json();
        if (active && data.success) {
          setSublokasiOptions(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch sublokasi', error);
      }
    };
    fetchSublokasi();
    return () => { active = false; };
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

  const uploadFoto = async () => {
    if (!selectedFile) return formData.foto_url;
    
    const formDataUpload = new FormData();
    formDataUpload.append('file', selectedFile);
    formDataUpload.append('bucket', 'inventaris-photos');
    if (formData.foto_url) {
      formDataUpload.append('old_url', formData.foto_url);
    }
    
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formDataUpload
    });
    
    const data = await res.json();
    if (data.success) {
      return data.url;
    }
    throw new Error('Gagal mengupload foto');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitState({ status: 'loading', message: '' });
    
    try {
      let fotoUrl = formData.foto_url;
      if (selectedFile) {
        fotoUrl = await uploadFoto();
      }
      
      const payload = {
        ...formData,
        foto_url: fotoUrl
      };
      
      if (payload.pemilik_tipe === 'satelit') {
        payload.pemilik_nama_lain = '';
      } else {
        payload.pemilik_satelit_id = '';
      }
      
      const res = await fetch(`/api/inventaris/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: 'Data berhasil diperbarui' });
        setTimeout(() => {
          router.push(`/inventaris/${id}`);
        }, 1500);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal memperbarui data' });
      }
    } catch (error: any) {
      console.error(error);
      setSubmitState({ status: 'error', message: error.message || 'Terjadi kesalahan koneksi.' });
    }
  };

  if (!isLoaded) return null;

  return (
    <div className="w-full flex flex-col gap-8 pb-10">
      <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => setSubmitState({ status: 'idle', message: '' })} />

      {/* Header */}
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

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nama */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Nama Barang *</label>
            <input type="text" name="nama" value={formData.nama} onChange={handleChange} required className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
          </div>

          {/* Kategori */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Kategori *</label>
            <select name="kategori_id" value={formData.kategori_id} onChange={handleChange} required className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white">
              <option value="">Pilih Kategori</option>
              {kategoriOptions.map((k: any) => (
                <option key={k.id} value={k.id}>{k.kode} - {k.nama}</option>
              ))}
            </select>
          </div>

          {/* Merk */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Merk</label>
            <input type="text" name="merk" value={formData.merk} onChange={handleChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
          </div>

          {/* No Seri */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">No. Seri</label>
            <input type="text" name="no_seri" value={formData.no_seri} onChange={handleChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
          </div>

          {/* Jumlah */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Jumlah</label>
            <input type="number" name="jumlah" value={formData.jumlah} onChange={handleChange} min="1" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
          </div>

          {/* Kondisi */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Kondisi</label>
            <select name="kondisi" value={formData.kondisi} onChange={handleChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white">
              <option value="Baik">Baik</option>
              <option value="Rusak Ringan">Rusak Ringan</option>
              <option value="Rusak Berat">Rusak Berat</option>
            </select>
          </div>

          {/* Tahun Perolehan */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Tahun Perolehan</label>
            <input type="number" name="tahun_perolehan" value={formData.tahun_perolehan} onChange={handleChange} placeholder="2024" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
          </div>

          {/* Nilai Perolehan */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Nilai Perolehan (Rp)</label>
            <input type="number" name="nilai_perolehan" value={formData.nilai_perolehan} onChange={handleChange} placeholder="0" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
          </div>
        </div>

        {/* Pemilik Section */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <h3 className="text-slate-800 text-base font-bold mb-4">Pemilik</h3>
          <div className="flex items-center gap-6 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="pemilik_tipe" value="satelit" checked={formData.pemilik_tipe === 'satelit'} onChange={handleChange} className="text-blue-600" />
              <span className="text-sm text-slate-700">Satelit</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="pemilik_tipe" value="individu" checked={formData.pemilik_tipe === 'individu'} onChange={handleChange} className="text-blue-600" />
              <span className="text-sm text-slate-700">Individu</span>
            </label>
          </div>
          {formData.pemilik_tipe === 'satelit' ? (
            <select name="pemilik_satelit_id" value={formData.pemilik_satelit_id} onChange={handleChange} className="w-full md:w-1/2 px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white">
              <option value="">Pilih Satelit Pemilik</option>
              {satelitOptions.map((s: any) => (
                <option key={s.id} value={s.id}>{s.nama_satelit}</option>
              ))}
            </select>
          ) : (
            <input type="text" name="pemilik_nama_lain" value={formData.pemilik_nama_lain} onChange={handleChange} placeholder="Nama pemilik individu" className="w-full md:w-1/2 px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
          )}
        </div>

        {/* Lokasi Section */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <h3 className="text-slate-800 text-base font-bold mb-4">Lokasi</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Satelit Lokasi</label>
              <select name="lokasi_satelit_id" value={formData.lokasi_satelit_id} onChange={handleChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white">
                <option value="">Pilih Satelit</option>
                {satelitOptions.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.nama_satelit}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Sub-Lokasi / Ruangan</label>
              <select name="lokasi_sublokasi_id" value={formData.lokasi_sublokasi_id} onChange={handleChange} disabled={!formData.lokasi_satelit_id} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white disabled:bg-slate-100">
                <option value="">Pilih Sub-Lokasi</option>
                {sublokasiOptions.map((sl: any) => (
                  <option key={sl.id} value={sl.id}>{sl.nama}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Foto Section */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <h3 className="text-slate-800 text-base font-bold mb-4">Foto</h3>
          <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm text-slate-700" />
          {previewFoto && (
            <img src={previewFoto} alt="Preview" className="mt-4 max-w-xs rounded-lg border border-slate-200" />
          )}
        </div>

        {/* Submit */}
        <div className="mt-8 flex justify-end gap-3">
          <Link href={`/inventaris/${id}`} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors">
            Batal
          </Link>
          <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm">
            Simpan Perubahan
          </button>
        </div>
      </form>
    </div>
  );
}
