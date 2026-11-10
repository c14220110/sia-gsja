import React, { useState, useEffect } from 'react';

interface Step3Props {
  runId: number;
  onPrev: () => void;
  setSubmitState: (state: any) => void;
  onSuccess: () => void;
}

export default function Step3Final({ runId, onPrev, setSubmitState, onSuccess }: Step3Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [catatan, setCatatan] = useState('');

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/payroll/runs/${runId}/summary`);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getBulanName = (b: number) => {
    return ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][b-1];
  };

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
  };

  const handleSubmit = async () => {
    if (!check1 || !check2) {
      alert("Harap centang semua checklist persetujuan sebelum mengajukan approval.");
      return;
    }

    try {
      setSubmitState({ status: 'loading', message: 'Mengajukan Payroll Run untuk Approval...' });
      
      const res = await fetch(`/api/payroll/runs/${runId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catatan_pembuat: catatan })
      });
      const result = await res.json();
      
      if (result.success) {
        setSubmitState({ status: 'idle', message: '' });
        onSuccess();
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal mengajukan approval.' });
      }
    } catch (err) {
      console.error(err);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan koneksi saat submit.' });
    }
  };

  if (loading || !data) {
    return (
      <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin mb-4"></div>
        <span className="text-sm font-sans">Memuat ringkasan finalisasi...</span>
      </div>
    );
  }

  const sisaPlafonAkhir = data.sisa_plafon - data.estimasi_penggunaan;
  const isPlafonDefisit = sisaPlafonAkhir < 0;

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4">
       <div className="flex flex-col gap-1">
         <h2 className="text-slate-900 text-xl font-bold font-sans flex items-center gap-2"><span className="material-icons-round text-emerald-500">check_circle</span> Finalisasi & Pengajuan Approval</h2>
         <p className="text-slate-500 text-sm">Review ringkasan total payroll dan konfirmasi bahwa seluruh data sudah divalidasi dengan benar.</p>
       </div>

       {/* Header Ringkasan */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-slate-50 border border-slate-200 rounded-xl">
         <div className="flex flex-col gap-1">
           <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Periode Penggajian</span>
           <span className="text-slate-900 font-bold">{getBulanName(data.bulan)} {data.tahun}</span>
         </div>
         <div className="flex flex-col gap-1">
           <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Unit Pelaksana</span>
           <span className="text-slate-900 font-bold">{data.nama_satelit}</span>
         </div>
         <div className="flex flex-col gap-1">
           <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Sumber RA</span>
           <span className="text-slate-900 font-bold truncate" title={data.nama_ra}>{data.kode_ra}</span>
         </div>
         <div className="flex flex-col gap-1">
           <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Disiapkan Oleh</span>
           <span className="text-slate-900 font-bold">{data.nama_pembuat || 'Sistem'}</span>
         </div>
       </div>

       {/* Finansial Summary */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
         
         <div className="flex flex-col gap-4">
            <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wider border-b border-slate-200 pb-2">Ringkasan Finansial</h3>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-sm font-sans">
                <span className="text-slate-600">Jumlah Pegawai Diproses</span>
                <span className="text-slate-900 font-bold">{data.jumlah_pegawai} Orang</span>
              </div>
              <div className="flex justify-between items-center text-sm font-sans">
                <span className="text-slate-600">Total Bruto (Penerimaan)</span>
                <span className="text-slate-900 font-bold font-sans">{formatRupiah(Number(data.total_bruto))}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-sans">
                <span className="text-slate-600">Total Potongan (Karyawan)</span>
                <span className="text-slate-900 font-bold font-sans">- {formatRupiah(Number(data.total_potongan))}</span>
              </div>
              <div className="w-full h-px bg-slate-200 my-1"></div>
              <div className="flex justify-between items-center text-base font-bold">
                <span className="text-slate-900">Total Take Home Pay (Netto)</span>
                <span className="text-emerald-600 font-sans text-lg">{formatRupiah(Number(data.total_netto))}</span>
              </div>
              
              <div className="w-full h-px border-t border-dashed border-slate-300 my-1"></div>
              
              <div className="flex justify-between items-center text-sm font-sans">
                <span className="text-slate-600 flex items-center gap-1"><span className="material-icons-round text-[14px] text-purple-500">add_circle</span> Beban Gereja (BPJS Employer)</span>
                <span className="text-purple-700 font-bold font-sans">+ {formatRupiah(data.total_beban_gereja)}</span>
              </div>
              <div className="flex justify-between items-center text-base font-bold bg-slate-50 p-2 rounded-lg mt-1 border border-slate-200">
                <span className="text-slate-900">TOTAL COST (Pengeluaran Unit)</span>
                <span className="text-slate-900 font-sans">{formatRupiah(Number(data.total_netto) + data.total_beban_gereja)}</span>
              </div>
            </div>
         </div>

         <div className="flex flex-col gap-4">
            <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wider border-b border-slate-200 pb-2">Status Plafon Anggaran</h3>
            <div className={`p-5 rounded-xl border flex flex-col gap-3 ${isPlafonDefisit ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
               <div className="flex justify-between items-center text-sm">
                 <span className={`font-medium ${isPlafonDefisit ? 'text-rose-700' : 'text-emerald-700'}`}>Sisa Plafon RA Saat Ini</span>
                 <span className={`font-bold font-sans ${isPlafonDefisit ? 'text-rose-900' : 'text-emerald-900'}`}>{formatRupiah(data.sisa_plafon)}</span>
               </div>
               <div className="flex justify-between items-center text-sm">
                 <span className={`font-medium ${isPlafonDefisit ? 'text-rose-700' : 'text-emerald-700'}`}>Estimasi Pengeluaran Payroll</span>
                 <span className={`font-bold font-sans ${isPlafonDefisit ? 'text-rose-900' : 'text-emerald-900'}`}>- {formatRupiah(data.estimasi_penggunaan)}</span>
               </div>
               <div className={`w-full h-px my-1 ${isPlafonDefisit ? 'bg-rose-200' : 'bg-emerald-200'}`}></div>
               <div className="flex justify-between items-center text-base font-bold">
                 <span className={`${isPlafonDefisit ? 'text-rose-800' : 'text-emerald-800'}`}>Sisa Plafon Setelah Payroll</span>
                 <span className={`font-sans ${isPlafonDefisit ? 'text-rose-700' : 'text-emerald-700'}`}>{formatRupiah(sisaPlafonAkhir)}</span>
               </div>
               
               {isPlafonDefisit && (
                 <div className="mt-2 text-xs text-rose-600 bg-rose-100 p-2 rounded flex items-start gap-2">
                   <span className="material-icons-round text-[16px]">warning</span>
                   <span>Peringatan: Dana RA tidak mencukupi untuk pemrosesan payroll ini. Pengajuan Anda kemungkinan besar akan ditolak oleh Bendahara Pusat.</span>
                 </div>
               )}
            </div>
         </div>

       </div>

       <div className="w-full h-px bg-slate-200 mt-2"></div>

       {/* Konfirmasi Area */}
       <div className="flex flex-col gap-4">
         <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wider">Konfirmasi & Pengajuan</h3>
         
         <div className="flex flex-col gap-3">
           <label className="flex items-start gap-3 cursor-pointer group">
             <div className="mt-0.5">
               <input type="checkbox" checked={check1} onChange={(e) => setCheck1(e.target.checked)} className="w-5 h-5 text-emerald-600 bg-white border-slate-300 rounded cursor-pointer focus:ring-emerald-500" />
             </div>
             <div className="flex flex-col">
               <span className="text-slate-900 font-bold group-hover:text-emerald-700 transition-colors">Semua data pegawai telah saya periksa</span>
               <span className="text-slate-500 text-sm">Saya menjamin bahwa nominal penerimaan, penyesuaian (adjustment), dan potongan untuk periode ini sudah sesuai dengan realita.</span>
             </div>
           </label>
           
           <label className="flex items-start gap-3 cursor-pointer group">
             <div className="mt-0.5">
               <input type="checkbox" checked={check2} onChange={(e) => setCheck2(e.target.checked)} className="w-5 h-5 text-emerald-600 bg-white border-slate-300 rounded cursor-pointer focus:ring-emerald-500" />
             </div>
             <div className="flex flex-col">
               <span className="text-slate-900 font-bold group-hover:text-emerald-700 transition-colors">Rencana Anggaran (RA) yang dipilih sudah benar</span>
               <span className="text-slate-500 text-sm">Saya mengerti bahwa setelah diajukan, payroll ini akan mengurangi limit/plafon dari RA terkait.</span>
             </div>
           </label>
         </div>

         <div className="flex flex-col gap-2 mt-4">
           <label className="text-slate-700 text-xs font-bold uppercase tracking-wider">Catatan Opsional untuk Reviewer (Bendahara Pusat)</label>
           <textarea 
             value={catatan}
             onChange={(e) => setCatatan(e.target.value)}
             className="w-full lg:w-2/3 p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none" 
             rows={3} 
             placeholder="Tambahkan penjelasan jika ada anomali angka atau penyesuaian khusus bulan ini..."
           ></textarea>
         </div>

       </div>

       {/* Footer */}
       <div className="w-full flex justify-between items-center mt-4 pt-6 border-t border-slate-100 gap-4">
         <button onClick={onPrev} className="px-6 py-2.5 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-colors flex items-center gap-2">
            <span className="material-icons-round text-[18px]">arrow_back</span> Kembali ke Review
         </button>
         <button 
            onClick={handleSubmit} 
            disabled={!check1 || !check2 || isPlafonDefisit}
            className="px-8 py-3 bg-emerald-600 rounded-lg text-white font-black hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
         >
            Ajukan untuk Approval <span className="material-icons-round text-[20px]">send</span>
         </button>
       </div>
    </div>
  );
}
