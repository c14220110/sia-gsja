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

  const uploadFoto = async () => {
    if (!selectedFile) return formData.foto_url;
    
    const formDataUpload = new FormData();
    formDataUpload.append('file', selectedFile);
    formDataUpload.append('bucket', 'inventaris-photos');
    
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
      
      const res = await fetch('/api/inventaris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: 'Data berhasil ditambahkan' });
        setTimeout(() => {
          router.push('/inventaris');
        }, 1500);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal menambahkan data' });
      }
    } catch (error: any) {
      console.error(error);
      setSubmitState({ status: 'error', message: error.message || 'Terjadi kesalahan koneksi.' });
    }
  };

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
        
        {/* Form Sections */}
        <div className="p-6 flex flex-col gap-8">
          
          {/* Section 1: Data Utama */}
          <div className="flex flex-col gap-4">
            <h2 className="text-slate-800 text-lg font-bold font-sans border-b border-slate-100 pb-2">Informasi Barang</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Nama Barang <span className="text-rose-500">*</span></label>
                <input type="text" name="nama" required value={formData.nama} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm" placeholder="Contoh: Kursi Lipat" />
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
                <label className="text-slate-700 text-sm font-bold font-sans">No. Seri</label>
                <input type="text" name="no_seri" value={formData.no_seri} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm" placeholder="Contoh: SN-123456789" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-sans">Jumlah</label>
                <input type="number" name="jumlah" required min="1" value={formData.jumlah} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm" />
              </div>
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
            Simpan Barang
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
