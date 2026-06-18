'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLoader } from '@/components/ui/GlobalLoader';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

export default function DetailJadwalJemaatPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showLoader, hideLoader } = useLoader();
  
  const [data, setData] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  
  // State Pendaftaran
  const [ticketInfo, setTicketInfo] = useState<any>(null);
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [catatanKhusus, setCatatanKhusus] = useState('');
  const [urlBuktiBayar, setUrlBuktiBayar] = useState('');
  const [isUploadingBukti, setIsUploadingBukti] = useState(false);

  const handleBuktiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBukti(true);
    try {
      const fileData = new FormData();
      fileData.append('file', file);
      fileData.append('bucket', 'bukti-bayar-kegiatan');
      
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: fileData
      });
      const uploadJson = await uploadRes.json();
      
      if (uploadJson.success) {
         setUrlBuktiBayar(uploadJson.url);
      } else {
         alert('Gagal mengupload bukti bayar: ' + uploadJson.message);
      }
    } catch (err: any) {
      alert('Terjadi kesalahan jaringan: ' + err.message);
    } finally {
      setIsUploadingBukti(false);
    }
  };

  const [submitStatus, setSubmitStatus] = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  useEffect(() => {
    const initPage = async () => {
      showLoader();
      try {
        const cachedUser = localStorage.getItem('gsja_user_data');
        let user = null;
        if (cachedUser) {
           user = JSON.parse(cachedUser);
           setUserData(user);
        } else {
           const resAuth = await fetch('/api/auth/me');
           if(resAuth.ok){
              user = await resAuth.json();
              setUserData(user);
           }
        }

        const res = await fetch(`/api/kegiatan/${id}`);
        if (res.ok) {
           const result = await res.json();
           setData(result.data);
        }

        // Tarik tiket milik pengguna
        if (user && user.jemaat_id) {
           const resTiket = await fetch(`/api/kegiatan/registrasi/saya`);
           if(resTiket.ok) {
              const resT = await resTiket.json();
              if(resT.success && resT.data) {
                 const tInfo = resT.data.find((t:any) => t.kegiatan_id === parseInt(id as string));
                 if (tInfo) setTicketInfo(tInfo);
              }
           }
        }
      } catch (err) {
        console.error(err);
      } finally {
        hideLoader();
      }
    };
    if (id) initPage();
  }, [id]);

  const handleKirimPendaftaran = async () => {
    if(!userData || !userData.jemaat_id) {
       alert("Sesi Anda tidak valid. Silakan login kembali.");
       return;
    }
    
    // Validasi bayar
    if (data.berbayar && !urlBuktiBayar) {
       alert("Karena ini acara berbayar, Anda wajib menyertakan link/URL bukti transfer.");
       return;
    }

    setSubmitStatus('loading');
    setIsRegModalOpen(false);
    
    try {
      const res = await fetch(`/api/kegiatan/${id}/registrasi`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            jemaat_id: userData.jemaat_id,
            catatan_khusus: catatanKhusus || 'Pendaftaran via Mobile App',
            total_biaya: data.harga_tiket_rp || 0,
            metode_pembayaran: data.berbayar ? 'Online Transfer' : null,
            url_bukti_bayar: urlBuktiBayar || null
         })
      });

      const result = await res.json();
      if(res.ok && result.success) {
         setSubmitStatus('success');
         setSubmitMessage('Registrasi Berhasil Terkirim!');
      } else {
         throw new Error(result.message || 'Gagal mendaftar');
      }
    } catch(err: any) {
      setSubmitStatus('error');
      setSubmitMessage(err.message);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(dateString));
  };

  if (!data) return null;

  return (
    <div className="w-full flex justify-center pb-32 bg-white min-h-screen">
      <SubmitOverlay 
        status={submitStatus} 
        message={submitMessage} 
        onClose={() => {
           setSubmitStatus('idle');
           if (submitStatus === 'success') router.push('/tiket');
        }} 
      />

      <div className="w-full max-w-lg flex flex-col relative">
         
         {/* Top Navigation */}
         <div className="absolute top-4 left-4 z-50">
            <button onClick={() => router.back()} className="w-10 h-10 bg-black/30 backdrop-blur rounded-full flex items-center justify-center text-white border border-white/20 active:scale-95 transition-all">
               <span className="material-icons-round">arrow_back</span>
            </button>
         </div>

         {/* Poster Hero */}
         <div className="w-full aspect-[4/5] bg-slate-900 relative">
            {data.url_banner ? (
               <>
                 <img src={data.url_banner} alt="Poster" className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
               </>
            ) : (
               <div className="w-full h-full bg-gradient-to-br from-blue-700 to-indigo-900 flex items-center justify-center relative">
                 <span className="material-icons-round text-9xl text-white/10 absolute">event_note</span>
                 <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
               </div>
            )}

            {/* Title Overlay in Hero */}
            <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col">
               <span className="bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded w-fit mb-3">{data.nama_jenis_kegiatan}</span>
               <h1 className="text-3xl font-black text-white leading-tight mb-2">{data.nama_kegiatan}</h1>
               <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
                  <span className="material-icons-round text-[16px]">church</span>
                  Satelit {data.nama_satelit || 'GSJA Eben Haezer'}
               </div>
            </div>
         </div>

         {/* Body Content */}
         <div className="flex flex-col px-6 pt-8 gap-8">
            
            {/* Waktu & Lokasi Grid */}
            <div className="grid grid-cols-2 gap-4">
               <div className="flex flex-col gap-1.5 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <span className="material-icons-round text-blue-500 mb-1">calendar_month</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tanggal</span>
                  <span className="text-sm font-bold text-slate-800 leading-snug">{formatDate(data.tanggal_mulai)}</span>
               </div>
               <div className="flex flex-col gap-1.5 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <span className="material-icons-round text-indigo-500 mb-1">schedule</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pukul</span>
                  <span className="text-sm font-bold text-slate-800 leading-snug">{data.waktu_mulai.slice(0,5)} - Selesai</span>
               </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
               <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0 border border-blue-50 text-blue-600">
                  <span className="material-icons-round">place</span>
               </div>
               <div className="flex flex-col pt-1">
                  <span className="text-sm font-bold text-slate-800">{data.lokasi_kegiatan || 'GSJA Eben Haezer'}</span>
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(data.lokasi_kegiatan || 'GSJA KUTISARI')}`} target="_blank" className="text-xs text-blue-600 font-bold mt-1">Buka di Maps</a>
               </div>
            </div>

            {/* Keterangan */}
            <div className="flex flex-col gap-2">
               <h3 className="text-lg font-black text-slate-900">Tentang Acara</h3>
               <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap">{data.keterangan || 'Tidak ada deskripsi detail mengenai acara ini.'}</p>
            </div>

         </div>

         {/* Fixed Bottom Action Bar */}
         {data.butuh_registrasi && (
           <div className="fixed bottom-[80px] md:bottom-[70px] left-0 right-0 bg-white border-none p-4 z-40 max-w-lg mx-auto flex items-center gap-4 shadow-[0_-15px_30px_-15px_rgba(0,0,0,0.1)] rounded-t-3xl">
               <div className="flex flex-col flex-1 pl-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Kontribusi</span>
                  {data.berbayar ? (
                     <span className="text-xl font-black text-slate-900 leading-none">Rp {parseInt(data.harga_tiket_rp).toLocaleString('id-ID')}</span>
                  ) : (
                     <span className="text-xl font-black text-emerald-600 leading-none">GRATIS</span>
                  )}
               </div>
               
               {ticketInfo ? (
                  ticketInfo.status_pembayaran === 'Paid' ? (
                     <button onClick={() => router.push('/tiket')} className="flex-[1.2] py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2">
                        <span className="material-icons-round">local_activity</span>
                        Lihat Tiket
                     </button>
                  ) : (
                     <button disabled className="flex-[1.2] py-3.5 bg-slate-100 text-slate-400 font-bold rounded-2xl cursor-not-allowed">
                        Menunggu...
                     </button>
                  )
               ) : (
                  <button onClick={() => setIsRegModalOpen(true)} className="flex-[1.2] py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white font-bold rounded-2xl shadow-lg shadow-blue-500/30">
                     Daftar Sekarang
                  </button>
               )}
           </div>
         )}
         
         {/* Modal Registrasi / Bottom Sheet */}
         {isRegModalOpen && (
            <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex flex-col justify-end animate-in fade-in" onClick={() => setIsRegModalOpen(false)}>
               <div className="w-full bg-white rounded-t-3xl p-6 pb-32 flex flex-col animate-in slide-in-from-bottom max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Formulir Pendaftaran</h3>
                  <p className="text-sm text-slate-500 mb-6">Mohon lengkapi formulir pendaftaran ini untuk {data.nama_kegiatan}.</p>

                  <div className="flex flex-col gap-5">
                     <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Catatan Khusus (Alergi / Permintaan)</label>
                        <textarea 
                           rows={3}
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm"
                           placeholder="Mis: Alergi udang, Ukuran kaos XL, dsb."
                           value={catatanKhusus}
                           onChange={(e) => setCatatanKhusus(e.target.value)}
                        />
                     </div>

                     {data.berbayar && (
                        <div className="flex flex-col gap-4 border-t border-slate-100 pt-5">
                           <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex flex-col gap-2">
                              <span className="text-xs text-amber-700 font-bold uppercase tracking-wider">Instruksi Pembayaran</span>
                              <span className="text-sm text-amber-800 leading-relaxed font-medium">
                                 Silakan transfer senilai <strong>Rp {parseInt(data.harga_tiket_rp).toLocaleString('id-ID')}</strong> ke rekening BCA <strong>XXXX-XXX-XXX (a. n. XXXXX)</strong>.
                              </span>
                           </div>
                           
                           <div className="flex flex-col gap-2">
                              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Bukti Transfer <span className="text-rose-500">*</span></label>
                              {urlBuktiBayar ? (
                                <div className="flex flex-col gap-2">
                                  <div className="w-full h-32 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden relative group">
                                     <img src={urlBuktiBayar} alt="Bukti Transfer" className="w-full h-full object-cover" />
                                     <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                        <button onClick={() => setUrlBuktiBayar('')} className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg shadow-sm border border-rose-500 flex items-center gap-2">
                                           <span className="material-icons-round text-[16px]">delete</span>
                                           Hapus Foto
                                        </button>
                                     </div>
                                  </div>
                                </div>
                              ) : (
                                <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isUploadingBukti ? 'border-slate-300 bg-slate-50' : 'border-blue-200 bg-blue-50/30 hover:border-blue-400 hover:bg-blue-50'}`}>
                                   {isUploadingBukti ? (
                                      <>
                                        <span className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-2"></span>
                                        <span className="text-sm font-bold text-blue-600">Mengunggah...</span>
                                      </>
                                   ) : (
                                      <>
                                        <span className="material-icons-round text-blue-500 text-3xl mb-1">cloud_upload</span>
                                        <span className="text-sm font-bold text-blue-700">Unggah Foto Struk</span>
                                        <span className="text-[10px] text-slate-400 mt-1">JPG, PNG maks 5MB</span>
                                      </>
                                   )}
                                   <input type="file" accept="image/*" className="hidden" onChange={handleBuktiUpload} disabled={isUploadingBukti} />
                                </label>
                              )}
                           </div>
                        </div>
                     )}

                     <button onClick={handleKirimPendaftaran} className="w-full mt-4 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white font-bold rounded-xl shadow-lg shadow-blue-500/30">
                        Kirim Pendaftaran
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
    </div>
  );
}
