'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

export default function NewPegawaiPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });

  // Options State
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [departemenOptions, setDepartemenOptions] = useState<any[]>([]);
  const [jabatanOptions, setJabatanOptions] = useState<any[]>([]);
  const [bankOptions, setBankOptions] = useState<any[]>([]);
  
  // Custom Autocomplete State for Jemaat (Optional Link)
  const [jemaatSearchModal, setJemaatSearchModal] = useState(false);
  const [jemaatQuery, setJemaatQuery] = useState('');
  const [jemaatResults, setJemaatResults] = useState<any[]>([]);
  const [linkedJemaatKode, setLinkedJemaatKode] = useState<string | null>(null);

  // Auth State
  const [userData, setUserData] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState<any>({
    // Tab 1: Info Pribadi & Pekerjaan
    jemaat_id: '',
    nama_lengkap: '',
    jenis_kelamin: 'Laki-laki',
    tanggal_lahir: '',
    status_pernikahan: 'Lajang',
    jumlah_anak: 0,
    no_hp: '',
    email_pribadi: '',

    no_kk: '',
    kontak_darurat_nama: '',
    kontak_darurat_nohp: '',
    kontak_darurat_relasi: '',
    
    // Pekerjaan
    satelit_id: '',
    departemen_id: '',
    jabatan_pegawai_id: '',
    tipe_pekerja: 'Pegawai Tetap',
    tanggal_bergabung: new Date().toISOString().split('T')[0],

    // Tab 2: Alamat
    alamat_lengkap: '',
    rt_rw: '',
    kota: 'Surabaya',
    kode_pos: '',

    // Tab 3: Pajak
    is_kena_pph21: true,
    no_npwp: '',
    status_ptkp: 'TK/0', // Default TK/0

    // Tab 4: Rekening
    bank_id: '',
    no_rekening: '',
    atas_nama_rekening: ''
  });

  useEffect(() => {
    const fetchOptionsAndUser = async () => {
      try {
        const [resSatelit, resDept, resJabatan, resBank, resUser] = await Promise.all([
          fetch('/api/options?type=satelit'),
          fetch('/api/options?type=departemen'),
          fetch('/api/options?type=jabatan_pegawai'),
          fetch('/api/options?type=bank'),
          fetch('/api/auth/me')
        ]);
        
        if (resSatelit.ok) setSatelitOptions((await resSatelit.json()).data);
        if (resDept.ok) setDepartemenOptions((await resDept.json()).data);
        if (resJabatan.ok) setJabatanOptions((await resJabatan.json()).data);
        if (resBank.ok) setBankOptions((await resBank.json()).data);
        
        if (resUser.ok) {
          const authData = await resUser.json();
          setUserData(authData);
          if (authData.role_name === 'GEMBALA SATELIT') {
            setFormData((prev: any) => ({ ...prev, satelit_id: authData.satelit_id?.toString() || '' }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch options', error);
      }
    };
    fetchOptionsAndUser();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData((prev: any) => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSearchJemaat = async (q: string) => {
    setJemaatQuery(q);
    if (q.length < 3) {
      setJemaatResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/options?type=jemaat_search&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) {
        setJemaatResults(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectJemaat = (j: any) => {
    setFormData((prev: any) => ({
      ...prev,
      jemaat_id: j.id,
      nama_lengkap: j.nama_lengkap || prev.nama_lengkap,
      jenis_kelamin: j.jenis_kelamin || prev.jenis_kelamin,
      satelit_id: j.satelit_id?.toString() || prev.satelit_id,

      tanggal_lahir: j.tanggal_lahir ? j.tanggal_lahir.split('T')[0] : prev.tanggal_lahir,
      status_pernikahan: j.status_pernikahan || prev.status_pernikahan,
      no_hp: j.no_hp || prev.no_hp,
      email_pribadi: j.email || prev.email_pribadi,
      alamat_lengkap: j.alamat || prev.alamat_lengkap,
      kota: j.kota || prev.kota,
      kode_pos: j.kode_pos || prev.kode_pos,
    }));
    setLinkedJemaatKode(j.jemaat_id);
    setJemaatSearchModal(false);
  };

  const validateCurrentTab = () => {
    if (activeTab === 1) {
      if (!formData.nama_lengkap) return 'Nama Lengkap wajib diisi.';

      if (!formData.satelit_id) return 'Satelit Penugasan wajib diisi.';
      if (!formData.jabatan_pegawai_id) return 'Jabatan Pegawai wajib dipilih.';
    }
    if (activeTab === 2) {
      if (!formData.alamat_lengkap) return 'Alamat domisili wajib diisi.';
      if (!formData.kota) return 'Kota wajib diisi.';
    }
    if (activeTab === 3) {
      if (formData.is_kena_pph21 && !formData.no_npwp) return 'Karena terpotong PPh21, Nomor NPWP sangat disarankan untuk diisi. Hilangkan centang jika pegawai ini tidak menanggung PPh21.';
      if (!formData.status_ptkp) return 'Status PTKP wajib dipilih.';
    }
    if (activeTab === 4) {
      if (!formData.bank_id) return 'Bank penerima gaji wajib dipilih.';
      if (!formData.no_rekening) return 'Nomor Rekening wajib diisi.';
      if (!formData.atas_nama_rekening) return 'Pemilik Rekening wajib diisi.';
    }
    return null;
  };

  const nextTab = () => {
    const errorMsg = validateCurrentTab();
    if (errorMsg) {
      alert(errorMsg);
      return;
    }
    setActiveTab(prev => prev + 1);
    window.scrollTo(0,0);
  };

  const handleCreate = async () => {
    const errorMsg = validateCurrentTab();
    if (errorMsg) {
      alert(errorMsg);
      return;
    }
    
    try {
      setIsSubmitting(true);
      setSubmitState({ status: 'loading', message: '' });
      
      const payload = { ...formData };
      
      const res = await fetch('/api/pegawai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        setSubmitState({ status: 'success', message: 'Registrasi Pegawai berhasil! Sedang menunggu Approval.' });
        setTimeout(() => router.push('/pegawai'), 2000);
      } else {
        setSubmitState({ status: 'error', message: data.message || 'Gagal menyimpan data pegawai.' });
      }
    } catch(err) {
      console.error(err);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan pada koneksi API.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-10">
      
      {/* Header */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-sans leading-4">
          <Link href="/pegawai" className="text-slate-500 hover:text-blue-600">Pegawai (HRD)</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Registrasi</span>
        </div>
        <div>
          <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Registrasi Pegawai Baru</h1>
          <p className="text-slate-500 text-base font-medium font-sans">Pengisian formulir kelengkapan biodata dan verifikasi operasional.</p>
        </div>
      </div>

      {/* Modern Tabs Indicator */}
      <div className="w-full flex items-center justify-between mt-4">
         {[
           { id: 1, name: 'Informasi Pribadi', icon: 'badge' },
           { id: 2, name: 'Alamat', icon: 'maps_home_work' },
           { id: 3, name: 'Pajak (PPh21)', icon: 'account_balance' },
           { id: 4, name: 'Rekening Bank', icon: 'payments' },
         ].map(tab => (
            <div key={tab.id} className="flex flex-col items-center gap-2 w-1/4 relative group">
              <div className={`w-full h-1 absolute top-5 left-1/2 -z-10 ${tab.id === 4 ? 'hidden' : 'block'} ${activeTab > tab.id ? 'bg-blue-500' : 'bg-slate-200'}`}></div>
              <button 
                onClick={() => { if(activeTab > tab.id) setActiveTab(tab.id); }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm
                  ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-blue-500/30' : activeTab > tab.id ? 'bg-blue-100 text-blue-600 cursor-pointer pointer-events-auto' : 'bg-white border-2 border-slate-200 text-slate-400 pointer-events-none'}
                `}
              >
                 {activeTab > tab.id ? <span className="material-icons-round text-[20px]">check</span> : <span className="material-icons-round text-[20px]">{tab.icon}</span>}
              </button>
              <span className={`text-xs font-bold font-sans ${activeTab === tab.id ? 'text-blue-700' : activeTab > tab.id ? 'text-slate-700' : 'text-slate-400'}`}>{tab.name}</span>
            </div>
         ))}
      </div>

      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 mt-4 p-8">
        
        {/* TAB 1: INFORMASI PRIBADI */}
        {activeTab === 1 && (
          <div className="flex flex-col gap-8 animate-in fade-in">
             <div className="flex flex-col gap-1">
               <h2 className="text-slate-900 text-xl font-bold font-sans flex items-center gap-2"><span className="material-icons-round text-blue-500">badge</span> Biodata & Pekerjaan</h2>
               <p className="text-slate-500 text-sm">Masukan detail identitas dasar calon pegawai sesuai KTP dan Penempatan Kerja.</p>
             </div>

             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col gap-3">
               <label className="text-slate-700 text-sm font-bold font-sans">Sinkronisasi Database Jemaat (Opsional)</label>
               <p className="text-slate-500 text-xs mb-1">Jika pegawai ini sudah terdaftar sebagai jemaat GSJA, klik tombol di bawah untuk menyalin data.</p>
               <button onClick={() => setJemaatSearchModal(true)} className="w-fit px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors flex items-center gap-2 shadow-sm">
                 <span className="material-icons-round text-[18px]">search</span> Cari Data Jemaat
               </button>
               {formData.jemaat_id && linkedJemaatKode && (
                 <div className="text-sm font-bold text-emerald-600 flex items-center gap-1 mt-1">
                   <span className="material-icons-round text-[16px]">check_circle</span> Tautkan ke ID Jemaat: {linkedJemaatKode}
                 </div>
               )}
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-slate-700 text-xs font-bold uppercase">Nama Lengkap *</label>
                  <input type="text" name="nama_lengkap" value={formData.nama_lengkap} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Sesuai KTP" />
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-slate-700 text-xs font-bold uppercase">No. Kartu Keluarga</label>
                  <input type="text" name="no_kk" value={formData.no_kk} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="16 Digit Nomor KK" />
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-slate-700 text-xs font-bold uppercase">Jenis Kelamin</label>
                  <select name="jenis_kelamin" value={formData.jenis_kelamin} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-slate-700 text-xs font-bold uppercase">Tanggal Lahir</label>
                  <input type="date" name="tanggal_lahir" value={formData.tanggal_lahir} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-slate-700 text-xs font-bold uppercase">Status Pernikahan</label>
                  <select name="status_pernikahan" value={formData.status_pernikahan} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="Lajang">Lajang</option>
                    <option value="Menikah">Menikah</option>
                    <option value="Duda">Duda</option>
                    <option value="Janda">Janda</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-slate-700 text-xs font-bold uppercase">Nomor HP/WA Aktif</label>
                  <input type="text" name="no_hp" value={formData.no_hp} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="081234..." />
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-slate-700 text-xs font-bold uppercase">Email</label>
                  <input type="email" name="email_pribadi" value={formData.email_pribadi} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="email@gmail.com" />
                </div>
             </div>

             <div className="w-full h-px bg-slate-200 my-2"></div>

             {/* Penempatan Unit Kerja */}
             <div className="flex flex-col gap-4">
               <h3 className="text-slate-900 text-lg font-bold font-sans flex items-center gap-2"><span className="material-icons-round text-emerald-500">business_center</span> Penempatan & Posisi</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-emerald-50/50 rounded-lg border border-emerald-100">
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-slate-700 text-xs font-bold uppercase">Satelit Penugasan *</label>
                    <select name="satelit_id" value={formData.satelit_id} onChange={handleInputChange} disabled={userData?.role_name === 'GEMBALA SATELIT'} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100">
                      <option value="">-- Pilih Satelit --</option>
                      {satelitOptions.map(s => (
                        <option key={s.id} value={s.id}>{s.nama_satelit}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-slate-700 text-xs font-bold uppercase">Skema Tipe Pekerja *</label>
                    <select name="tipe_pekerja" value={formData.tipe_pekerja} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="Pegawai Tetap">Pegawai Tetap</option>
                      <option value="Tidak Tetap">Tidak Tetap (Part-time / Honorer)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-slate-700 text-xs font-bold uppercase">Departemen <span className="text-slate-400 font-normal normal-case">(Opsional)</span></label>
                    <select name="departemen_id" value={formData.departemen_id} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="">-- Tidak Masuk Departemen --</option>
                      {departemenOptions.map(d => (
                        <option key={d.id} value={d.id}>{d.nama_departemen}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-slate-700 text-xs font-bold uppercase">Jabatan *</label>
                    <select name="jabatan_pegawai_id" value={formData.jabatan_pegawai_id} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="">-- Pilih Jabatan --</option>
                      {jabatanOptions.map(j => (
                        <option key={j.id} value={j.id}>{j.nama_jabatan}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-slate-700 text-xs font-bold uppercase">Tanggal Bergabung *</label>
                    <input type="date" name="tanggal_bergabung" value={formData.tanggal_bergabung} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
               </div>
             </div>
          </div>
        )}

        {/* TAB 2: ALAMAT LENGKAP */}
        {activeTab === 2 && (
          <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4">
             <div className="flex flex-col gap-1">
               <h2 className="text-slate-900 text-xl font-bold font-sans flex items-center gap-2"><span className="material-icons-round text-amber-500">maps_home_work</span> Alamat & Kontak Darurat</h2>
               <p className="text-slate-500 text-sm">Informasi letak domisili pegawai dan narahubung yang bisa diakses saat mendesak.</p>
             </div>

             <div className="grid grid-cols-1 gap-6">
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-slate-700 text-xs font-bold uppercase">Alamat Lengkap KTP / Domisili *</label>
                  <textarea name="alamat_lengkap" value={formData.alamat_lengkap} onChange={handleInputChange} rows={3} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" placeholder="Jalan Raya No..."></textarea>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-slate-700 text-xs font-bold uppercase">RT / RW</label>
                    <input type="text" name="rt_rw" value={formData.rt_rw} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="001/010" />
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-slate-700 text-xs font-bold uppercase">Kota / Kabupaten *</label>
                    <input type="text" name="kota" value={formData.kota} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-slate-700 text-xs font-bold uppercase">Kode Pos</label>
                    <input type="text" name="kode_pos" value={formData.kode_pos} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>
                </div>
             </div>

             <div className="w-full h-px bg-slate-200 my-2"></div>

             {/* Darurat */}
             <div className="flex flex-col gap-4">
               <h3 className="text-slate-900 text-lg font-bold font-sans flex items-center gap-2"><span className="material-icons-round text-rose-500">contact_phone</span> Kontak Darurat (Emergency)</h3>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 bg-rose-50/30 rounded-lg border border-rose-100">
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-slate-700 text-xs font-bold uppercase">Nama Kontak</label>
                    <input type="text" name="kontak_darurat_nama" value={formData.kontak_darurat_nama} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500" placeholder="Mis. Budi Sentosa" />
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-slate-700 text-xs font-bold uppercase">Nomor HP</label>
                    <input type="text" name="kontak_darurat_nohp" value={formData.kontak_darurat_nohp} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500" placeholder="081..." />
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-slate-700 text-xs font-bold uppercase">Hubungan Relasi</label>
                    <input type="text" name="kontak_darurat_relasi" value={formData.kontak_darurat_relasi} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500" placeholder="Mis. Suami / Istri / Anak" />
                  </div>
               </div>
             </div>
          </div>
        )}

        {/* TAB 3: PAJAK PPH21 */}
        {activeTab === 3 && (
          <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4">
             <div className="flex flex-col gap-1">
               <h2 className="text-slate-900 text-xl font-bold font-sans flex items-center gap-2"><span className="material-icons-round text-purple-500">account_balance_wallet</span> Kewajiban Perpajakan (PPh 21)</h2>
               <p className="text-slate-500 text-sm">Validasi subjek pajak pegawai untuk kebutuhan kalkulasi Payroll bulanan HRD.</p>
             </div>

             <div className="p-5 border-2 border-purple-100 bg-purple-50/50 rounded-xl flex items-start gap-4">
               <div>
                  <input type="checkbox" name="is_kena_pph21" checked={formData.is_kena_pph21} onChange={handleInputChange} className="w-5 h-5 text-purple-600 bg-white border-slate-300 rounded mt-1" />
               </div>
               <div className="flex flex-col gap-1">
                  <label className="text-slate-900 font-bold">Pegawai Wajib Pajak Potong PPh21</label>
                  <p className="text-slate-600 text-sm">Beri centang jika skema gaji pegawai ini bersinggungan langsung dengan kewajiban bayar Pajak Penghasilan Pasal 21. <br/>Pastikan NPWP Diisi untuk pegawai wajib pajak agar tidak terkena denda potongan lebih besar dari NPWP Aktif.</p>
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-slate-700 text-xs font-bold uppercase">Nomor NPWP</label>
                  <input type="text" name="no_npwp" value={formData.no_npwp} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 font-sans tracking-widest" placeholder="00.000.000.0-000.000" />
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-slate-700 text-xs font-bold uppercase">Status PTKP (Penghasilan Tidak Kena Pajak) *</label>
                  <select name="status_ptkp" value={formData.status_ptkp} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500">
                    <option value="TK/0">TK/0 (Tidak Kawin Tanpa Tanggungan)</option>
                    <option value="TK/1">TK/1 (Tidak Kawin 1 Tanggungan)</option>
                    <option value="TK/2">TK/2 (Tidak Kawin 2 Tanggungan)</option>
                    <option value="TK/3">TK/3 (Tidak Kawin 3 Tanggungan)</option>
                    <option value="K/0">K/0 (Kawin Tanpa Tanggungan)</option>
                    <option value="K/1">K/1 (Kawin 1 Tanggungan)</option>
                    <option value="K/2">K/2 (Kawin 2 Tanggungan)</option>
                    <option value="K/3">K/3 (Kawin 3 Tanggungan)</option>
                  </select>
                </div>
             </div>
          </div>
        )}

        {/* TAB 4: REKENING BANK */}
        {activeTab === 4 && (
          <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4">
             <div className="flex flex-col gap-1">
               <h2 className="text-slate-900 text-xl font-bold font-sans flex items-center gap-2"><span className="material-icons-round text-blue-500">payments</span> Konfigurasi Rekening Payroll</h2>
               <p className="text-slate-500 text-sm">Informasi bank penerima untuk penyaluran gaji otomatis. Sangat rahasia dan diawasi Audit Log.</p>
             </div>

             <div className="p-8 bg-blue-50 border border-blue-200 rounded-xl relative overflow-hidden flex flex-col gap-6">
                <span className="material-icons-round absolute -right-6 -bottom-6 text-[150px] text-blue-100/50 pointer-events-none">account_balance</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 w-full lg:w-3/4">
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-slate-700 text-xs font-bold uppercase">Bank Tujuan *</label>
                    <select name="bank_id" value={formData.bank_id} onChange={handleInputChange} className="px-3 py-3 bg-white rounded-lg border shadow-sm border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold">
                      <option value="">-- Pilih Bank --</option>
                      {bankOptions.map(b => (
                        <option key={b.id} value={b.id}>{b.nama_bank} ({b.kode_bank})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 w-full lg:w-3/4">
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-slate-700 text-xs font-bold uppercase">Nomor Rekening Tujuan *</label>
                    <input type="text" name="no_rekening" value={formData.no_rekening} onChange={handleInputChange} placeholder="00019283..." className="px-3 py-3 bg-white rounded-lg border shadow-sm border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg font-sans tracking-wider" />
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-slate-700 text-xs font-bold uppercase">Atas Nama Pemilik Rekening *</label>
                    <input type="text" name="atas_nama_rekening" value={formData.atas_nama_rekening} onChange={handleInputChange} className="px-3 py-3 bg-white rounded-lg border shadow-sm border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold uppercase" placeholder="JOHN DOE" />
                  </div>
                </div>

             </div>
          </div>
        )}

      </div>

      {/* Button Controls */}
      <div className="w-full flex justify-between items-center bg-white py-4 px-6 rounded-xl border border-slate-200 shadow-sm mt-2">
        <div>
          {activeTab > 1 && (
             <button onClick={() => { window.scrollTo(0, 0); setActiveTab(p=>p-1); }} className="px-6 py-3 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors flex items-center gap-2">
                <span className="material-icons-round text-[18px]">arrow_back</span> Sebelumnya
             </button>
          )}
        </div>
        <div>
          {activeTab < 4 ? (
             <button onClick={nextTab} className="px-8 py-3 bg-blue-600 rounded-lg text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30 flex items-center gap-2">
                Lanjut <span className="material-icons-round text-[18px]">arrow_forward</span>
             </button>
          ) : (
             <button onClick={handleCreate} disabled={submitState.status === 'success' || isSubmitting} className="px-8 py-3 bg-emerald-600 rounded-lg text-white font-black hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/30 flex items-center gap-2 disabled:opacity-50">
                <span className="material-icons-round text-[20px]">save</span> Simpan Pendaftaran Pegawai
             </button>
          )}
        </div>
      </div>

      {/* Lookup Jemaat Modal */}
      {jemaatSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in max-h-screen">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Cari Data Tautan Jemaat</h3>
              <button onClick={() => setJemaatSearchModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            
            <div className="p-6">
              <div className="relative mb-4">
                <span className="material-icons-round absolute left-3 top-3 text-slate-400">search</span>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Ketik nama jemaat minimal 3 huruf..." 
                  value={jemaatQuery}
                  onChange={(e) => handleSearchJemaat(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="w-full max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {jemaatResults.length === 0 && jemaatQuery.length > 2 ? (
                  <p className="text-center text-slate-400 py-4 text-sm">Tidak ada jemaat ditemukan.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {jemaatResults.map(j => (
                      <div key={j.id} onClick={() => selectJemaat(j)} className="p-4 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all flex justify-between items-center group">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 group-hover:text-blue-800">{j.nama_lengkap}</span>
                          <span className="text-xs text-slate-500">Jemaat ID: {j.jemaat_id} • Lokasi: {j.nama_satelit || '-'}</span>
                        </div>
                        <span className="material-icons-round text-slate-300 group-hover:text-blue-500">chevron_right</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Generic Submit Alert Overlay */}
      <SubmitOverlay 
        status={submitState.status} 
        message={submitState.message} 
        errors={submitState.errors} 
        onClose={() => setSubmitState({ status: 'idle', message: '' })} 
      />

    </div>
  );
}
