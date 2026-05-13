'use client';
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';

type RincianItem = { id: string; jenis: 'Penerimaan'|'Pengeluaran'; coaId: number; coa: string; sumber_dana: string; uraian: string; deskripsi: string; jumlah: number; satuan: string; harga: number; total: number; };
type COAOption = { id: number; label: string; saldo_normal: string; grup_laporan: string; };
type Option = { id: number; label: string };
const currentYear = new Date().getFullYear();
const tahunOptions = Array.from({ length: 11 }, (_, i) => 2020 + i);
const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
const selectCls = "w-full h-10 px-3 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400";
const inputCls = "w-full h-10 px-3 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500";
const labelCls = "text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wide";

export default function InputAnggaranBaruPage() {
  const [submitState, setSubmitState] = useState<{status:'idle'|'loading'|'success'|'error';message:string}>({status:'idle',message:''});
  const [showConfirmAjukan, setShowConfirmAjukan] = useState(false);
  const [satelitId, setSatelitId] = useState('');
  const [komisiId, setKomisiId] = useState('');
  const [tahun, setTahun] = useState(String(currentYear));
  const [satelitList, setSatelitList] = useState<Option[]>([]);
  const [komisiList, setKomisiList] = useState<Option[]>([]);
  const [coaList, setCoaList] = useState<COAOption[]>([]);
  const [jenisKegiatanList, setJenisKegiatanList] = useState<Option[]>([]);
  const [namaRancangan, setNamaRancangan] = useState('');
  const [kategoriRa, setKategoriRa] = useState('Kegiatan');
  const [polaPenggunaan, setPolaPenggunaan] = useState('Sekali Pakai');
  const [jenisKegiatanId, setJenisKegiatanId] = useState('');
  const [estimasiWaktu, setEstimasiWaktu] = useState('');
  const [form, setForm] = useState({ jenis:'Pengeluaran', coaId:'', coaLabel:'', sumber_dana:'Kas Mandiri', uraian:'', deskripsi:'', jumlah:1, satuan:'', harga:0 });
  const [items, setItems] = useState<RincianItem[]>([]);
  
  // RBAC State
  const [userData, setUserData] = useState<any>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Fetch COA, Satelit & User Data once
  useEffect(() => {
    Promise.all([
      fetch('/api/buku-besar/coa').then(r=>r.json()).catch(() => ({})),
      fetch('/api/master-data?table=satelit').then(r=>r.json()).catch(() => ({})),
      fetch('/api/auth/me').then(r=>r.json()).catch(() => ({})),
      fetch('/api/master-data?table=jenis_kegiatan').then(r=>r.json()).catch(() => ({}))
    ]).then(([resCoa, resSatelit, resUser, resJenis]) => {
      if (resCoa.success) {
        setCoaList(resCoa.data.filter((c:any)=>c.tipe_akun==='Detail'&&c.is_active).map((c:any)=>({id:c.id,label:`${c.kode_akun} — ${c.nama_akun}`,saldo_normal:c.saldo_normal,grup_laporan:c.grup_laporan})));
      }
      if (resSatelit.success) {
        setSatelitList(resSatelit.data.filter((s:any)=>s.is_active).map((s:any)=>({id:s.id,label:s.nama_satelit})));
      }
      if (resJenis?.success) {
        setJenisKegiatanList(resJenis.data.map((j:any)=>({id:j.id,label:j.nama_jenis_kegiatan,kategori:j.kategori})));
      }
      if (resUser && resUser.role_id) {
        setUserData(resUser);
        // Check authorization: SUPER_ADMIN (1), BENDAHARA_PUSAT (5), BENDAHARA_SATELIT (6), KETUA_KOMISI (8), KETUA_DEPARTEMEN (9)
        const allowedRoles = [1, 5, 6, 8, 9];
        if (allowedRoles.includes(resUser.role_id)) {
          setIsAuthorized(true);
          // Auto-select satelit berdasarkan penugasan user
          if (resUser.satelit_id) {
            setSatelitId(resUser.satelit_id.toString());
          }
          // komisi_id akan di-set setelah komisiList selesai di-fetch (lihat useEffect bawah)
        } else {
          setIsAuthorized(false);
        }
      } else {
        setIsAuthorized(false);
      }
    });
  }, []);

  // Cascading: fetch komisi when satelit changes
  useEffect(() => {
    setKomisiId(''); setKomisiList([]);
    if (!satelitId) return;
    fetch(`/api/anggaran/komisi-options?satelit_id=${satelitId}`).then(r=>r.json()).then(j2=>{
      if(j2.success) setKomisiList(j2.data.map((k:any)=>({id:k.id,label:k.nama_komisi})));
    });
  }, [satelitId]);

  // Auto-set komisi dari scope user (KETUA_KOMISI) setelah komisiList selesai dimuat
  useEffect(() => {
    if (userData?.role_id === 8 && userData?.komisi_id && komisiList.length > 0) {
      const found = komisiList.find((k: any) => k.id === userData.komisi_id);
      if (found) setKomisiId(String(userData.komisi_id));
    }
  }, [komisiList, userData]);


  // Filter COA by jenis: Penerimaan → Kredit (income), Pengeluaran → Debit (expense)
  // Both must be grup_laporan = 'Laba Rugi' for budget items
  const filteredCoaList = useMemo(() => coaList.filter(c =>
    c.grup_laporan === 'Laba Rugi' &&
    (form.jenis === 'Penerimaan' ? c.saldo_normal === 'Kredit' : c.saldo_normal === 'Debit')
  ), [coaList, form.jenis]);

  // Reset COA when jenis changes (avoid wrong-type COA staying selected)
  useEffect(() => { setForm(p=>({...p,coaId:'',coaLabel:''})); }, [form.jenis]);

  const handleAdd = () => {
    if (!form.coaId) { alert('Akun Perkiraan (COA) wajib dipilih. Ini adalah benang merah antara anggaran dan realisasi jurnal.'); return; }
    if (!form.uraian) { alert('Uraian / Judul Item wajib diisi.'); return; }
    if (form.jumlah <= 0 || form.harga <= 0) { alert('Jumlah dan Harga Satuan harus lebih dari 0.'); return; }
    setItems(p=>[...p,{id:Date.now().toString(),jenis:form.jenis as 'Penerimaan'|'Pengeluaran',coaId:parseInt(form.coaId),coa:form.coaLabel,sumber_dana:form.sumber_dana,uraian:form.uraian,deskripsi:form.deskripsi,jumlah:form.jumlah,satuan:form.satuan,harga:form.harga,total:form.jumlah*form.harga}]);
    setForm(p=>({...p,uraian:'',deskripsi:'',jumlah:1,satuan:'',harga:0}));
  };

  // Pre-validate fields before showing confirmation or saving
  const validateFields = (): boolean => {
    if (!satelitId) { setSubmitState({status:'error',message:'Satelit wajib dipilih.'}); return false; }
    if (!namaRancangan) { setSubmitState({status:'error',message:'Nama Rancangan wajib diisi.'}); return false; }
    if ((kategoriRa === 'Kegiatan' || kategoriRa === 'Operasional') && (!jenisKegiatanId && !(polaPenggunaan === 'Bertahap' && kategoriRa === 'Kegiatan'))) {
      setSubmitState({status:'error',message:'Jenis Kegiatan wajib dipilih untuk RA ini.'}); return false; 
    }
    if (items.length === 0) { setSubmitState({status:'error',message:'Minimal harus ada 1 item rincian anggaran.'}); return false; }
    return true;
  };

  // Called when user clicks "Ajukan Anggaran" — shows AlertModal first
  const handleAjukanClick = () => {
    if (!validateFields()) return;
    setShowConfirmAjukan(true);
  };

  const handleSave = async (action: 'draft'|'ajukan') => {
    if (!validateFields()) return;
    setSubmitState({status:'loading',message: action==='ajukan'?'Mengajukan anggaran ke Majelis...':'Menyimpan draft...'});
    try {
      const payload = {
        satelit_id: parseInt(satelitId),
        komisi_id: komisiId ? parseInt(komisiId) : null,
        tahun: parseInt(tahun),
        kategori_ra: kategoriRa,
        pola_penggunaan: polaPenggunaan,
        jenis_kegiatan_id: jenisKegiatanId ? parseInt(jenisKegiatanId) : null,
        nama_rancangan: namaRancangan,
        estimasi_waktu: estimasiWaktu,
        action,
        items: items.map(i=>({ jenis_anggaran:i.jenis, coa_id:i.coaId, sumber_dana:i.sumber_dana, uraian:i.uraian, deskripsi:i.deskripsi||null, jumlah:i.jumlah, satuan:i.satuan||null, harga_satuan:i.harga }))
      };
      const res = await fetch('/api/anggaran/tahunan', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const json = await res.json();
      if (json.success) {
        setSubmitState({status:'success',message:json.message});
      } else {
        setSubmitState({status:'error',message:json.message||'Terjadi kesalahan.'});
      }
    } catch(e:any) {
      setSubmitState({status:'error',message:'Kesalahan jaringan: '+e.message});
    }
  };

  const totalP = useMemo(()=>items.filter(i=>i.jenis==='Penerimaan').reduce((a,c)=>a+c.total,0),[items]);
  const totalK = useMemo(()=>items.filter(i=>i.jenis==='Pengeluaran').reduce((a,c)=>a+c.total,0),[items]);
  const margin = totalP>0?((totalP-totalK)/totalP)*100:0;
  const penItems = useMemo(()=>items.filter(i=>i.jenis==='Penerimaan'),[items]);
  const kelItems = useMemo(()=>items.filter(i=>i.jenis==='Pengeluaran'),[items]);

  if (isAuthorized === null) {
    return <div className="p-10 text-center text-slate-500 flex flex-col items-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>Memeriksa Hak Akses...</div>;
  }

  if (isAuthorized === false) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-20">
        <span className="material-icons-round text-6xl text-red-400 mb-4">gpp_bad</span>
        <h1 className="text-2xl font-black text-slate-800 mb-2">Akses Ditolak</h1>
        <p className="text-slate-500 mb-6 text-center max-w-md">Role Anda saat ini ({userData?.role_name || 'Tidak Diketahui'}) tidak memiliki izin untuk membuat anggaran baru. Hanya role operasional yang dapat mengakses halaman ini.</p>
        <Link href="/anggaran/rancangan" className="px-6 py-2.5 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition-colors">
          Kembali ke Daftar Rancangan Anggaran
        </Link>
      </div>
    );
  }

  // Determine if fields should be locked based on user role
  // Ketua Komisi (8) -> only for their satelit & komisi. Bendahara Satelit (6) -> only their satelit.
  const isSatelitLocked = userData?.role_id === 6 || userData?.role_id === 8 || userData?.role_id === 7 || userData?.role_id === 10;
  
  return (
    <div className="w-full flex flex-col gap-6 pb-32">
      <SubmitOverlay status={submitState.status} message={submitState.message} onClose={submitState.status==='success' ? ()=>{ window.location.href='/anggaran/rancangan'; } : ()=>setSubmitState({status:'idle',message:''})}/>
      <AlertModal
        isOpen={showConfirmAjukan}
        title="Ajukan Rancangan Anggaran?"
        message={
          <>
            Anda akan mengirimkan <strong>&quot;{namaRancangan}&quot;</strong> ke Majelis untuk direview.
            <br/><br/>
            Setelah diajukan, dokumen ini akan <strong className="text-red-600">DIKUNCI PERMANEN</strong> dan Anda <strong>tidak dapat mengubah atau menghapusnya lagi</strong>, kecuali Majelis meminta revisi.
          </>
        }
        confirmText="Ya, Ajukan Sekarang"
        cancelText="Batal, Cek Ulang"
        onConfirm={() => { setShowConfirmAjukan(false); handleSave('ajukan'); }}
        onCancel={() => setShowConfirmAjukan(false)}
      />
      {/* Header Area */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-['Inter'] leading-4">
          <span className="text-slate-500">Anggaran & Plotting</span>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <Link href="/anggaran/rancangan" className="text-slate-500 hover:text-blue-600">Daftar Rancangan Anggaran</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Input Rancangan Baru</span>
        </div>
        
        <div className="self-stretch inline-flex justify-between items-end">
          <div className="inline-flex gap-4 items-center">
            <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">Input Rancangan Anggaran</h1>
            <div className="px-3 py-1 bg-amber-100 rounded border border-amber-300 flex items-center gap-1 mt-1">
               <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
               <span className="text-amber-800 text-xs font-bold uppercase tracking-wide">DRAFT</span>
            </div>
          </div>
          <div className="text-slate-500 text-sm font-medium font-['Inter'] flex gap-1 items-center">
            <span className="material-icons-round text-lg text-slate-400">qr_code</span> ID: <span className="text-slate-700 font-bold">Otomatis Terbuat</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-5 mt-2">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4">
          <div className="text-slate-800 text-sm font-bold font-['Inter'] uppercase tracking-wider flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <span className="material-icons-round text-[18px]">request_quote</span>
            </div>
            <span>Informasi Rancangan Anggaran</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 ml-10">Tentukan kategori, nama, dan cakupan organisasi dari rancangan ini.</p>
        </div>

        {/* Cascading Header */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nama Rancangan Program <span className="text-red-500">*</span></label>
            <input type="text" placeholder="Misal: RA Ibadah Raya 2027..." value={namaRancangan} onChange={e=>setNamaRancangan(e.target.value)} className={inputCls+' font-bold text-slate-800'}/>
          </div>
          <div>
            <label className={labelCls}>Kategori RA <span className="text-red-500">*</span></label>
            <select value={kategoriRa} onChange={e=>{setKategoriRa(e.target.value);if(e.target.value!=='Kegiatan')setPolaPenggunaan('-');else setPolaPenggunaan('Sekali Pakai');}} className={selectCls+' font-semibold'}>
              <option value="Kegiatan">Kegiatan</option>
              <option value="Operasional">Operasional</option>
              <option value="Proyek">Proyek</option>
              <option value="Penggajian">Penggajian</option>
            </select>
            <p className="text-[10px] text-slate-400 mt-1">{kategoriRa==='Kegiatan'?'Harus ditarik oleh Modul Kegiatan':kategoriRa==='Operasional'?'Dicairkan langsung via jurnal':kategoriRa==='Proyek'?'Pencairan bertahap per termin':'Pencairan bulanan via payroll'}</p>
          </div>
          {kategoriRa==='Kegiatan' && <div>
            <label className={labelCls}>Pola Penggunaan <span className="text-red-500">*</span></label>
            <select value={polaPenggunaan} onChange={e=>setPolaPenggunaan(e.target.value)} className={selectCls+' font-semibold'}>
              <option value="Sekali Pakai">Sekali Pakai (1 Event)</option>
              <option value="Bertahap">Bertahap (Multi-Event / Rutin)</option>
            </select>
            <p className="text-[10px] text-slate-400 mt-1">{polaPenggunaan==='Sekali Pakai'?'Misal: Natal, Paskah, Retreat':'Misal: Ibadah Raya 52x, Sekolah Minggu 52x'}</p>
          </div>}
          {(kategoriRa==='Kegiatan' || kategoriRa==='Operasional') && <div>
            <label className={labelCls}>Jenis Kegiatan {(polaPenggunaan==='Bertahap' && kategoriRa==='Kegiatan')?<span className="text-slate-400 font-normal">(Multi-Jenis)</span>:<span className="text-red-500">*</span>}</label>
            <select value={jenisKegiatanId} onChange={e=>setJenisKegiatanId(e.target.value)} className={selectCls}>
              <option value="">-- {(polaPenggunaan==='Bertahap' && kategoriRa==='Kegiatan')?'Multi-Jenis (Bebas)':'Pilih Jenis Kegiatan'} --</option>
              {(() => {
                const KATEGORI_ORDER = [
                  'Ibadah Rutin',
                  'Sosial & Diakonia',
                  'Sakramen & Layanan',
                  'Event & Perayaan',
                  'Edukasi & Pelatihan',
                ];
                const grouped: Record<string, typeof jenisKegiatanList> = {};
                jenisKegiatanList.forEach((jk: any) => {
                  const k = jk.kategori || 'Lainnya';
                  if (!grouped[k]) grouped[k] = [];
                  grouped[k].push(jk);
                });
                const orderedKeys = [
                  ...KATEGORI_ORDER.filter(k => grouped[k]),
                  ...Object.keys(grouped).filter(k => !KATEGORI_ORDER.includes(k))
                ];
                return orderedKeys.map(kat => (
                  <optgroup key={kat} label={`— ${kat.toUpperCase()} —`}>
                    {grouped[kat].map((jk: any) => (
                      <option key={jk.id} value={jk.id}>{jk.label}</option>
                    ))}
                  </optgroup>
                ));
              })()}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">{(polaPenggunaan==='Bertahap' && kategoriRa==='Kegiatan')?'Biarkan kosong jika RA ini akan dipakai untuk berbagai jenis acara (misal: RA Natal ada ibadah & baksos).':'Kunci RA ini untuk satu jenis kegiatan spesifik.'}</p>
          </div>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Satelit <span className="text-red-500">*</span></label>
            <select value={satelitId} onChange={e=>setSatelitId(e.target.value)} disabled={isSatelitLocked} className={selectCls}>
              <option value="">-- Pilih Satelit --</option>
              {satelitList.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            {isSatelitLocked && <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1"><span className="material-icons-round text-[12px]">lock</span> Terkunci sesuai penugasan Anda</p>}
          </div>
          <div>
            <label className={labelCls}>Komisi <span className="text-slate-400 font-normal">(Opsional)</span></label>
            <select value={komisiId} onChange={e=>setKomisiId(e.target.value)} disabled={!satelitId} className={selectCls}>
              <option value="">-- Umum (Non-Komisi) --</option>
              {komisiList.map(k=><option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
            {!satelitId && <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1"><span className="material-icons-round text-[12px]">lock</span>Pilih Satelit dulu</p>}
            {satelitId && userData?.role_id === 8 && <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1"><span className="material-icons-round text-[12px]">info</span> Pilih Komisi Anda</p>}
          </div>
          <div>
            <label className={labelCls}>Tahun <span className="text-red-500">*</span></label>
            <select value={tahun} onChange={e=>setTahun(e.target.value)} className={selectCls+' font-mono font-bold'}>
              {tahunOptions.map(y=><option key={y} value={y}>{y}{y===currentYear?' (Tahun Ini)':y===currentYear+1?' (Tahun Depan)':''}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Estimasi Pelaksanaan</label>
            <input type="text" placeholder="Misal: Semester 1, 25 Des..." value={estimasiWaktu} onChange={e=>setEstimasiWaktu(e.target.value)} className={inputCls}/>
          </div>
        </div>
      </div>

      {/* Card 2: Input Item Anggaran */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4">
          <div className="text-slate-800 text-sm font-bold font-['Inter'] uppercase tracking-wider flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-icons-round text-[18px]">playlist_add</span>
            </div>
            <span>Input Rincian Item Anggaran</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 ml-10">Tambahkan item penerimaan dan pengeluaran satu per satu ke dalam rancangan ini.</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Jenis Anggaran</label>
              <select value={form.jenis} onChange={e=>setForm(p=>({...p,jenis:e.target.value}))} className={selectCls+' font-semibold'}>
                <option value="Pengeluaran">Pengeluaran</option>
                <option value="Penerimaan">Penerimaan</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Akun Perkiraan (COA) <span className="text-red-500">*</span>
                <span className="ml-1 font-normal normal-case text-slate-400">({form.jenis==='Penerimaan'?'Akun Pendapatan (Kredit)':'Akun Beban (Debit)'} saja)</span>
              </label>
              <select value={form.coaId} onChange={e=>{const s=filteredCoaList.find(c=>c.id===parseInt(e.target.value));setForm(p=>({...p,coaId:e.target.value,coaLabel:s?.label||''}));}} className={`${selectCls} ${!form.coaId?'border-amber-300':''}`}>
                <option value="">-- Pilih Akun {form.jenis==='Penerimaan'?'Pendapatan':'Beban'} --</option>
                {filteredCoaList.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              {filteredCoaList.length===0&&coaList.length>0&&<p className="text-[10px] text-amber-600 mt-1">Belum ada akun COA jenis {form.jenis==='Penerimaan'?'Pendapatan (Kredit)':'Beban (Debit)'} yang aktif.</p>}
            </div>
            <div>
              <label className={labelCls}>Sumber Dana</label>
              <select value={form.sumber_dana} onChange={e=>setForm(p=>({...p,sumber_dana:e.target.value}))} className={selectCls}>
                <option value="Kas Mandiri">Kas Mandiri (Komisi/Satelit)</option>
                <option value="Plafon Pusat">Plafon Pusat (Subsidi)</option>
              </select>
            </div>
          </div>

          <div>
              <label className={labelCls}>Uraian / Judul Item <span className="text-red-500">*</span></label>
              <input type="text" placeholder="Ketik nama item anggaran..." value={form.uraian} onChange={e=>setForm(p=>({...p,uraian:e.target.value}))} className={inputCls+' font-medium'}/>
            </div>

          <div>
            <label className={labelCls}>Deskripsi Peruntukan</label>
            <input type="text" placeholder="Misal: Konsumsi nasi kotak untuk 50 panitia..." value={form.deskripsi} onChange={e=>setForm(p=>({...p,deskripsi:e.target.value}))} className={inputCls}/>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <label className={labelCls}>Jumlah <span className="text-red-500">*</span></label>
              <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden h-10 bg-white">
                <button type="button" onClick={()=>setForm(p=>({...p,jumlah:Math.max(1,p.jumlah-1)}))} className="w-10 h-full flex justify-center items-center text-slate-500 hover:bg-slate-100 border-r border-slate-300 font-bold">−</button>
                <input type="number" min={1} value={form.jumlah} onChange={e=>setForm(p=>({...p,jumlah:parseInt(e.target.value)||1}))} className="w-full h-full text-center outline-none text-sm font-semibold"/>
                <button type="button" onClick={()=>setForm(p=>({...p,jumlah:p.jumlah+1}))} className="w-10 h-full flex justify-center items-center text-slate-500 hover:bg-slate-100 border-l border-slate-300 font-bold">+</button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Satuan</label>
              <input type="text" placeholder="Box / Bulan / Kali" value={form.satuan} onChange={e=>setForm(p=>({...p,satuan:e.target.value}))} className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Harga Satuan <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-semibold">Rp</span>
                <input type="number" min={0} value={form.harga||''} onChange={e=>setForm(p=>({...p,harga:parseInt(e.target.value)||0}))} className={inputCls+' pl-9 font-mono'}/>
              </div>
            </div>
            <div>
              <label className={labelCls}>Total Estimasi</label>
              <div className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-100 text-sm font-bold text-slate-700 flex items-center font-mono">{fmt(form.jumlah*form.harga)}</div>
            </div>
            <div>
              <button onClick={handleAdd} className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm flex justify-center items-center gap-2 transition-colors shadow-sm">
                <span className="material-icons-round text-[18px]">add</span> Tambah
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rincian Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-base font-bold text-slate-800">Rincian Anggaran</h2>
          <button className="w-8 h-8 rounded border border-slate-300 flex justify-center items-center text-slate-500 hover:bg-slate-100"><span className="material-icons-round text-[18px]">print</span></button>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-xs font-bold text-slate-500 tracking-wider">
                <th className="p-4 w-[28%]">URAIAN</th><th className="p-4 w-[16%]">AKUN</th><th className="p-4 w-[11%]">SUMBER DANA</th>
                <th className="p-4 w-[5%] text-center">JML</th><th className="p-4 w-[7%] text-center">SATUAN</th>
                <th className="p-4 w-[11%] text-right">HARGA</th><th className="p-4 w-[12%] text-right">TOTAL</th><th className="p-4 w-[5%] text-center">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {items.length===0 ? (
                <tr><td colSpan={8} className="p-12 text-center text-slate-400 bg-slate-50/50">
                  <div className="flex flex-col items-center gap-2">
                    <span className="material-icons-round text-4xl text-slate-300">receipt_long</span>
                    <p>Belum ada item. Lengkapi form di atas lalu klik "+ Tambah".</p>
                  </div>
                </td></tr>
              ) : (<>
                {penItems.length>0&&<><tr><td colSpan={8} className="px-4 py-1.5 bg-emerald-50 border-b border-emerald-100 text-[10px] font-bold text-emerald-700">↑ PENERIMAAN</td></tr>
                {penItems.map((item,idx)=><tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 pl-6 text-sm font-semibold text-slate-800">{idx+1}. {item.uraian}<p className="text-xs font-normal text-slate-400">{item.deskripsi}</p></td>
                  <td className="p-4 text-xs font-mono text-slate-500">{item.coa}</td>
                  <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${item.sumber_dana==='Plafon Pusat'?'bg-indigo-50 text-indigo-600 border-indigo-200':'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{item.sumber_dana}</span></td>
                  <td className="p-4 text-sm text-center font-medium">{item.jumlah}</td><td className="p-4 text-sm text-center text-slate-600">{item.satuan}</td>
                  <td className="p-4 text-sm text-right font-mono text-slate-700">{fmt(item.harga)}</td>
                  <td className="p-4 text-sm text-right font-bold font-mono text-emerald-600">{fmt(item.total)}</td>
                  <td className="p-4 text-center"><button onClick={()=>setItems(items.filter(i=>i.id!==item.id))} className="w-7 h-7 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 flex justify-center items-center mx-auto"><span className="material-icons-round text-[16px]">delete</span></button></td>
                </tr>)}</>}
                {kelItems.length>0&&<><tr><td colSpan={8} className="px-4 py-1.5 bg-red-50 border-b border-red-100 border-t border-t-slate-200 text-[10px] font-bold text-red-700">↓ PENGELUARAN</td></tr>
                {kelItems.map((item,idx)=><tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 pl-6 text-sm font-semibold text-slate-800">{idx+1}. {item.uraian}<p className="text-xs font-normal text-slate-400">{item.deskripsi}</p></td>
                  <td className="p-4 text-xs font-mono text-slate-500">{item.coa}</td>
                  <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${item.sumber_dana==='Plafon Pusat'?'bg-indigo-50 text-indigo-600 border-indigo-200':'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{item.sumber_dana}</span></td>
                  <td className="p-4 text-sm text-center font-medium">{item.jumlah}</td><td className="p-4 text-sm text-center text-slate-600">{item.satuan}</td>
                  <td className="p-4 text-sm text-right font-mono text-slate-700">{fmt(item.harga)}</td>
                  <td className="p-4 text-sm text-right font-bold font-mono text-slate-800">{fmt(item.total)}</td>
                  <td className="p-4 text-center"><button onClick={()=>setItems(items.filter(i=>i.id!==item.id))} className="w-7 h-7 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 flex justify-center items-center mx-auto"><span className="material-icons-round text-[16px]">delete</span></button></td>
                </tr>)}</>}
              </>)}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-900 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={()=>handleSave('draft')} className="px-5 py-2.5 rounded-lg border border-slate-700 text-white font-semibold hover:bg-slate-800 transition-colors text-sm flex items-center gap-2">
              <span className="material-icons-round text-[18px]">save</span> Simpan Draft
            </button>
            <button
              onClick={handleAjukanClick}
              disabled={items.length === 0}
              title={items.length === 0 ? 'Tambahkan minimal 1 item terlebih dahulu' : ''}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-colors text-sm flex items-center gap-2 shadow-sm ${
                items.length === 0
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              <span className="material-icons-round text-[18px]">send</span> Ajukan Anggaran
            </button>
            <span className="px-4 py-2.5 bg-white rounded-lg text-sm font-bold text-slate-800 flex items-center gap-2"><span className="material-icons-round text-[18px] text-slate-400">info</span>STATUS: DRAFT</span>
          </div>
          <div className="flex gap-5 overflow-x-auto">
            {[['Total Penerimaan',fmt(totalP),'text-emerald-400'],['Total Pengeluaran',`(${fmt(totalK)})`,'text-red-400'],['Margin',`${margin.toFixed(1)}%`,'text-white'],['Total Estimasi',fmt(totalP-totalK),totalP-totalK>=0?'text-emerald-400':'text-red-400']].map(([label,value,cls],i,arr)=>(
              <React.Fragment key={label}>
                <div className="flex flex-col text-right shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                  <span className={`text-sm font-bold font-mono ${cls}`}>{value}</span>
                </div>
                {i<arr.length-1&&<div className="w-px h-8 bg-slate-700 shrink-0"/>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
