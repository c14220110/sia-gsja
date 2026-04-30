'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

type RincianItem = { id: string; jenis: 'Penerimaan'|'Pengeluaran'; kegiatanId: string; kegiatan: string; coaId: number; coa: string; sumber_dana: string; uraian: string; deskripsi: string; jumlah: number; satuan: string; harga: number; total: number; };
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
  const [satelitId, setSatelitId] = useState('');
  const [komisiId, setKomisiId] = useState('');
  const [tahun, setTahun] = useState(String(currentYear));
  const [satelitList, setSatelitList] = useState<Option[]>([]);
  const [komisiList, setKomisiList] = useState<Option[]>([]);
  const [kegiatanList, setKegiatanList] = useState<Option[]>([]);
  const [coaList, setCoaList] = useState<COAOption[]>([]);
  const [form, setForm] = useState({ jenis:'Pengeluaran', kegiatanId:'', kegiatanName:'', coaId:'', coaLabel:'', sumber_dana:'Kas Mandiri', uraian:'', deskripsi:'', jumlah:1, satuan:'', harga:0 });
  const [items, setItems] = useState<RincianItem[]>([]);

  // Fetch COA & Satelit once
  useEffect(() => {
    fetch('/api/buku-besar/coa').then(r=>r.json()).then(j=>{
      if(j.success) setCoaList(j.data.filter((c:any)=>c.tipe_akun==='Detail'&&c.is_active).map((c:any)=>({id:c.id,label:`${c.kode_akun} — ${c.nama_akun}`,saldo_normal:c.saldo_normal,grup_laporan:c.grup_laporan})));
    });
    fetch('/api/master-data?table=satelit').then(r=>r.json()).then(j=>{
      if(j.success) setSatelitList(j.data.filter((s:any)=>s.is_active).map((s:any)=>({id:s.id,label:s.nama_satelit})));
    });
  }, []);

  // Cascading: fetch komisi when satelit changes
  useEffect(() => {
    setKomisiId(''); setKomisiList([]); setKegiatanList([]); setForm(p=>({...p,kegiatanId:'',kegiatanName:''}));
    if (!satelitId) return;
    // Fetch all komisi then filter client-side by satelit_id
    // master-data?table=komisi returns: { id, nama_komisi, satelit_id (via join), is_active }
    fetch('/api/master-data?table=komisi').then(r=>r.json()).then(j=>{
      if(j.success) {
        // The komisi data has satelit_id implicitly — we need to filter by matching satelit
        // Since master-data joins satelit, we filter by matching nama_satelit won't work.
        // Instead call a dedicated filtered fetch:
        fetch(`/api/anggaran/komisi-options?satelit_id=${satelitId}`).then(r=>r.json()).then(j2=>{
          if(j2.success) setKomisiList(j2.data.map((k:any)=>({id:k.id,label:k.nama_komisi})));
        });
      }
    });
  }, [satelitId]);


  // Cascading: fetch kegiatan when satelit or komisi changes
  const fetchKegiatan = useCallback(() => {
    if (!satelitId) { setKegiatanList([]); return; }
    const komisiParam = komisiId ? `&komisi_id=${komisiId}` : `&komisi_null=true`;
    fetch(`/api/anggaran/kegiatan-options?satelit_id=${satelitId}${komisiParam}`)
      .then(r=>r.json()).then(j=>{if(j.success) setKegiatanList(j.data.map((k:any)=>({id:k.id,label:`${k.kode_kegiatan} — ${k.nama_kegiatan}`})));});
  }, [satelitId, komisiId]);

  useEffect(() => { fetchKegiatan(); setForm(p=>({...p,kegiatanId:'',kegiatanName:''})); }, [satelitId, komisiId]);

  // Filter COA by jenis: Penerimaan → Kredit (income), Pengeluaran → Debit (expense)
  // Both must be grup_laporan = 'Laba Rugi' for budget items
  const filteredCoaList = useMemo(() => coaList.filter(c =>
    c.grup_laporan === 'Laba Rugi' &&
    (form.jenis === 'Penerimaan' ? c.saldo_normal === 'Kredit' : c.saldo_normal === 'Debit')
  ), [coaList, form.jenis]);

  // Reset COA when jenis changes (avoid wrong-type COA staying selected)
  useEffect(() => { setForm(p=>({...p,coaId:'',coaLabel:''})); }, [form.jenis]);

  const handleAdd = () => {
    if (!form.kegiatanId) { alert('Kegiatan wajib dipilih.'); return; }
    if (!form.coaId) { alert('Akun Perkiraan (COA) wajib dipilih. Ini adalah benang merah antara anggaran dan realisasi jurnal.'); return; }
    if (!form.uraian) { alert('Uraian / Judul Item wajib diisi.'); return; }
    if (form.jumlah <= 0 || form.harga <= 0) { alert('Jumlah dan Harga Satuan harus lebih dari 0.'); return; }
    setItems(p=>[...p,{id:Date.now().toString(),jenis:form.jenis as 'Penerimaan'|'Pengeluaran',kegiatanId:form.kegiatanId,kegiatan:form.kegiatanName,coaId:parseInt(form.coaId),coa:form.coaLabel,sumber_dana:form.sumber_dana,uraian:form.uraian,deskripsi:form.deskripsi,jumlah:form.jumlah,satuan:form.satuan,harga:form.harga,total:form.jumlah*form.harga}]);
    setForm(p=>({...p,uraian:'',deskripsi:'',jumlah:1,satuan:'',harga:0}));
  };

  const handleSave = async (action: 'draft'|'ajukan') => {
    if (!satelitId) { setSubmitState({status:'error',message:'Satelit wajib dipilih.'}); return; }
    if (items.length === 0) { setSubmitState({status:'error',message:'Minimal harus ada 1 item rincian anggaran.'}); return; }
    setSubmitState({status:'loading',message: action==='ajukan'?'Mengajukan anggaran...':'Menyimpan draft...'});
    try {
      const payload = {
        satelit_id: parseInt(satelitId),
        komisi_id: komisiId ? parseInt(komisiId) : null,
        tahun: parseInt(tahun),
        action,
        items: items.map(i=>({ jenis_anggaran:i.jenis, kegiatan_id:parseInt(i.kegiatanId)||null, coa_id:i.coaId, sumber_dana:i.sumber_dana, uraian:i.uraian, deskripsi:i.deskripsi||null, jumlah:i.jumlah, satuan:i.satuan||null, harga_satuan:i.harga }))
      };
      const res = await fetch('/api/anggaran/tahunan', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const json = await res.json();
      if (json.success) {
        setSubmitState({status:'success',message:json.message});
        setTimeout(()=>{ window.location.href='/anggaran/tahunan'; }, 1800);
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
  const grouped = useMemo(()=>{
    const g:{[k:string]:{name:string;pen:RincianItem[];kel:RincianItem[]}}={};
    items.forEach(i=>{if(!g[i.kegiatanId])g[i.kegiatanId]={name:i.kegiatan,pen:[],kel:[]};if(i.jenis==='Penerimaan')g[i.kegiatanId].pen.push(i);else g[i.kegiatanId].kel.push(i);});
    return g;
  },[items]);

  return (
    <div className="w-full flex flex-col gap-6 pb-32">
      <SubmitOverlay status={submitState.status} message={submitState.message} onClose={()=>setSubmitState({status:'idle',message:''})}/>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/anggaran/tahunan" className="hover:text-indigo-600">Anggaran Tahunan</Link>
        <span className="material-icons-round text-[16px]">chevron_right</span>
        <span className="font-semibold text-slate-700">Input Anggaran Baru</span>
      </div>

      {/* Header Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <span className="material-icons-round text-indigo-600 text-3xl">request_quote</span>
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              Input Anggaran Baru
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded font-mono text-xs">ID: [Auto-Generated]</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Pilih Satelit terlebih dahulu untuk mengaktifkan filter kegiatan.</p>
          </div>
        </div>

        {/* Cascading Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Satelit <span className="text-red-500">*</span></label>
            <select value={satelitId} onChange={e=>setSatelitId(e.target.value)} className={selectCls}>
              <option value="">-- Pilih Satelit --</option>
              {satelitList.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Komisi <span className="text-slate-400 font-normal">(Opsional)</span></label>
            <select value={komisiId} onChange={e=>setKomisiId(e.target.value)} disabled={!satelitId} className={selectCls}>
              <option value="">-- Umum (Non-Komisi) --</option>
              {komisiList.map(k=><option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
            {!satelitId && <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1"><span className="material-icons-round text-[12px]">lock</span>Pilih Satelit dulu</p>}
          </div>
          <div>
            <label className={labelCls}>Tahun Anggaran <span className="text-red-500">*</span></label>
            <select value={tahun} onChange={e=>setTahun(e.target.value)} className={selectCls+' font-mono font-bold'}>
              {tahunOptions.map(y=><option key={y} value={y}>{y}{y===currentYear?' (Tahun Ini)':y===currentYear+1?' (Tahun Depan)':''}</option>)}
            </select>
          </div>
        </div>

        {/* Item Input */}
        <div className="flex flex-col gap-4 pt-2 border-t border-slate-100">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Kegiatan <span className="text-red-500">*</span>
                {!satelitId && <span className="ml-2 text-amber-500 font-normal normal-case">(Pilih Satelit dulu)</span>}
              </label>
              <select value={form.kegiatanId} onChange={e=>{const s=kegiatanList.find(k=>k.id===parseInt(e.target.value));setForm(p=>({...p,kegiatanId:e.target.value,kegiatanName:s?.label||''}));}} disabled={!satelitId} className={selectCls+' font-medium'}>
                <option value="">-- {satelitId?'Pilih Kegiatan':'Kunci: Pilih Satelit dulu'} --</option>
                {kegiatanList.map(k=><option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
              {satelitId && kegiatanList.length===0 && <p className="text-[10px] text-slate-400 mt-1">Tidak ada kegiatan dengan status "Menunggu Persetujuan" atau "Akan Datang" untuk satelit ini.</p>}
            </div>
            <div>
              <label className={labelCls}>Uraian / Judul Item <span className="text-red-500">*</span></label>
              <input type="text" placeholder="Ketik nama item anggaran..." value={form.uraian} onChange={e=>setForm(p=>({...p,uraian:e.target.value}))} className={inputCls+' font-medium'}/>
            </div>
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
              ) : Object.entries(grouped).map(([kid,g],gi)=>(
                <React.Fragment key={kid}>
                  <tr className="bg-slate-800 text-white"><td colSpan={8} className="px-4 py-2 text-xs font-bold tracking-widest uppercase">{g.name}</td></tr>
                  {g.pen.length>0&&<><tr><td colSpan={8} className="px-4 py-1.5 bg-emerald-50 border-b border-emerald-100 text-[10px] font-bold text-emerald-700">↑ PENERIMAAN</td></tr>
                  {g.pen.map((item,idx)=><tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 pl-8 text-sm font-semibold text-slate-800">{gi+1}.{idx+1}. {item.uraian}<p className="text-xs font-normal text-slate-400">{item.deskripsi}</p></td>
                    <td className="p-4 text-xs font-mono text-slate-500">{item.coa}</td>
                    <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${item.sumber_dana==='Plafon Pusat'?'bg-indigo-50 text-indigo-600 border-indigo-200':'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{item.sumber_dana}</span></td>
                    <td className="p-4 text-sm text-center font-medium">{item.jumlah}</td><td className="p-4 text-sm text-center text-slate-600">{item.satuan}</td>
                    <td className="p-4 text-sm text-right font-mono text-slate-700">{fmt(item.harga)}</td>
                    <td className="p-4 text-sm text-right font-bold font-mono text-emerald-600">{fmt(item.total)}</td>
                    <td className="p-4 text-center"><button onClick={()=>setItems(items.filter(i=>i.id!==item.id))} className="w-7 h-7 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 flex justify-center items-center mx-auto"><span className="material-icons-round text-[16px]">delete</span></button></td>
                  </tr>)}</>}
                  {g.kel.length>0&&<><tr><td colSpan={8} className="px-4 py-1.5 bg-red-50 border-b border-red-100 border-t border-t-slate-200 text-[10px] font-bold text-red-700">↓ PENGELUARAN</td></tr>
                  {g.kel.map((item,idx)=><tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 pl-8 text-sm font-semibold text-slate-800">{gi+1}.{g.pen.length+idx+1}. {item.uraian}<p className="text-xs font-normal text-slate-400">{item.deskripsi}</p></td>
                    <td className="p-4 text-xs font-mono text-slate-500">{item.coa}</td>
                    <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${item.sumber_dana==='Plafon Pusat'?'bg-indigo-50 text-indigo-600 border-indigo-200':'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{item.sumber_dana}</span></td>
                    <td className="p-4 text-sm text-center font-medium">{item.jumlah}</td><td className="p-4 text-sm text-center text-slate-600">{item.satuan}</td>
                    <td className="p-4 text-sm text-right font-mono text-slate-700">{fmt(item.harga)}</td>
                    <td className="p-4 text-sm text-right font-bold font-mono text-slate-800">{fmt(item.total)}</td>
                    <td className="p-4 text-center"><button onClick={()=>setItems(items.filter(i=>i.id!==item.id))} className="w-7 h-7 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 flex justify-center items-center mx-auto"><span className="material-icons-round text-[16px]">delete</span></button></td>
                  </tr>)}</>}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-900 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={()=>handleSave('draft')} className="px-5 py-2.5 rounded-lg border border-slate-700 text-white font-semibold hover:bg-slate-800 transition-colors text-sm flex items-center gap-2">
              <span className="material-icons-round text-[18px]">save</span> Simpan Draft
            </button>
            <button onClick={()=>handleSave('ajukan')} className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors text-sm flex items-center gap-2 shadow-sm">
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
