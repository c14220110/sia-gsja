'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

type Item = { id: string; jenis: 'Penerimaan'|'Pengeluaran'; coaId: number; coaLabel: string; sumber_dana: string; uraian: string; deskripsi: string; jumlah: number; satuan: string; harga: number; total: number; };
type COA = { id: number; label: string; saldo_normal: string; grup_laporan: string; };
const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
const sel = 'w-full h-10 px-3 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-100 disabled:text-slate-400';
const inp = 'w-full h-10 px-3 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500';
const lbl = 'text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wide';

export default function InputLPJPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error'; message: string }>({ status: 'idle', message: '' });
  const [kegiatan, setKegiatan] = useState<any>(null);
  const [coaList, setCoaList] = useState<COA[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [laporan, setLaporan] = useState('');
  const [existingStatus, setExistingStatus] = useState('');
  const [form, setForm] = useState({ jenis: 'Pengeluaran', coaId: '', coaLabel: '', sumber_dana: 'Kas Mandiri', uraian: '', deskripsi: '', jumlah: 1, satuan: '', harga: 0 });

  // Fetch kegiatan info + existing LPJ
  useEffect(() => {
    fetch(`/api/kegiatan/${id}`).then(r => r.json()).then(j => { if (j.success) setKegiatan(j.data); });
    fetch(`/api/buku-besar/coa`).then(r => r.json()).then(j => {
      if (j.success) setCoaList(j.data.filter((c: any) => c.tipe_akun === 'Detail' && c.is_active).map((c: any) => ({ id: c.id, label: `${c.kode_akun} — ${c.nama_akun}`, saldo_normal: c.saldo_normal, grup_laporan: c.grup_laporan })));
    });
    fetch(`/api/kegiatan/${id}/lpj`).then(r => r.json()).then(j => {
      if (j.success && j.data.header) {
        setLaporan(j.data.header.laporan_naratif || '');
        setExistingStatus(j.data.header.status_lpj || '');
      }
      if (j.success && j.data.items?.length > 0) {
        setItems(j.data.items.map((it: any) => ({
          id: String(it.id), jenis: it.jenis_anggaran, coaId: it.coa_id,
          coaLabel: `${it.kode_akun} — ${it.nama_akun}`, sumber_dana: it.sumber_dana,
          uraian: it.uraian, deskripsi: it.deskripsi || '', jumlah: it.jumlah,
          satuan: it.satuan || '', harga: parseFloat(it.harga_satuan), total: it.jumlah * parseFloat(it.harga_satuan)
        })));
      }
    });
  }, [id]);

  // Filter COA by jenis (Penerimaan: 4, 7 | Pengeluaran: 5, 6, 8)
  const filteredCoa = useMemo(() => coaList.filter(c => {
    if (form.jenis === 'Penerimaan') {
      return c.label.startsWith('4') || c.label.startsWith('7');
    } else {
      return c.label.startsWith('5') || c.label.startsWith('6') || c.label.startsWith('8');
    }
  }), [coaList, form.jenis]);

  // Reset COA saat jenis berubah
  useEffect(() => { setForm(p => ({ ...p, coaId: '', coaLabel: '' })); }, [form.jenis]);

  const handleAdd = useCallback(() => {
    if (!form.coaId) { alert('Akun Perkiraan (COA) wajib dipilih!'); return; }
    if (!form.uraian.trim()) { alert('Uraian item wajib diisi!'); return; }
    if (form.jumlah <= 0 || form.harga <= 0) { alert('Jumlah dan Harga Satuan harus lebih dari 0!'); return; }
    setItems(p => [...p, { id: Date.now().toString(), jenis: form.jenis as any, coaId: parseInt(form.coaId), coaLabel: form.coaLabel, sumber_dana: form.sumber_dana, uraian: form.uraian, deskripsi: form.deskripsi, jumlah: form.jumlah, satuan: form.satuan, harga: form.harga, total: form.jumlah * form.harga }]);
    setForm(p => ({ ...p, uraian: '', deskripsi: '', jumlah: 1, satuan: '', harga: 0 }));
  }, [form]);

  const totalP = useMemo(() => items.filter(i => i.jenis === 'Penerimaan').reduce((a, c) => a + c.total, 0), [items]);
  const totalK = useMemo(() => items.filter(i => i.jenis === 'Pengeluaran').reduce((a, c) => a + c.total, 0), [items]);
  const sisa = totalP - totalK;

  const handleSave = async (action: 'draft' | 'ajukan') => {
    if (items.length === 0) { setSubmitState({ status: 'error', message: 'Minimal 1 item rincian harus diisi.' }); return; }
    setSubmitState({ status: 'loading', message: action === 'ajukan' ? 'Mengajukan LPJ...' : 'Menyimpan draft...' });
    try {
      const res = await fetch(`/api/kegiatan/${id}/lpj`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action, laporan_naratif: laporan,
          items: items.map(i => ({ jenis_anggaran: i.jenis, coa_id: i.coaId, sumber_dana: i.sumber_dana, uraian: i.uraian, deskripsi: i.deskripsi || null, jumlah: i.jumlah, satuan: i.satuan || null, harga_satuan: i.harga }))
        })
      });
      const json = await res.json();
      if (json.success) {
        setSubmitState({ status: 'success', message: json.message });
        setTimeout(() => router.push('/kegiatan'), 1800);
      } else {
        setSubmitState({ status: 'error', message: json.message });
      }
    } catch (e: any) {
      setSubmitState({ status: 'error', message: 'Kesalahan jaringan: ' + e.message });
    }
  };

  const isDraft = existingStatus === '' || existingStatus === 'Draft';

  return (
    <div className="w-full flex flex-col gap-6 pb-32">
      <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => setSubmitState({ status: 'idle', message: '' })} />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/kegiatan" className="hover:text-indigo-600">Daftar Kegiatan</Link>
        <span className="material-icons-round text-[16px]">chevron_right</span>
        <span className="font-semibold text-slate-700">Input LPJ</span>
      </div>

      {/* Header Info Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
          <span className="material-icons-round text-amber-500 text-3xl">assignment</span>
          <div>
            <h1 className="text-xl font-black text-slate-800 font-['Inter']">Input LPJ — Laporan Pertanggungjawaban</h1>
            <p className="text-xs text-slate-400 font-['Public_Sans'] mt-0.5">{kegiatan ? `${kegiatan.nama_kegiatan} · ${kegiatan.kode_kegiatan}` : 'Memuat data kegiatan...'}</p>
          </div>
          {existingStatus && (
            <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold border ${existingStatus === 'Menunggu Review' ? 'bg-amber-50 text-amber-700 border-amber-200' : existingStatus === 'Disetujui' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              Status LPJ: {existingStatus}
            </span>
          )}
        </div>

        {/* Laporan Naratif */}
        <div className="mb-5">
          <label className={lbl}>Laporan Naratif / Catatan Umum <span className="text-slate-400 font-normal normal-case">(opsional)</span></label>
          <textarea value={laporan} onChange={e => setLaporan(e.target.value)} rows={3} disabled={!isDraft}
            placeholder="Tulis ringkasan pelaksanaan kegiatan, kendala, dan saran..."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:bg-slate-50 disabled:text-slate-400" />
        </div>

        {/* Form Tambah Item */}
        {isDraft && (
          <div className="flex flex-col gap-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tambah Rincian Keuangan</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={lbl}>Jenis</label>
                <select value={form.jenis} onChange={e => setForm(p => ({ ...p, jenis: e.target.value }))} className={sel + ' font-semibold'}>
                  <option value="Pengeluaran">Pengeluaran</option>
                  <option value="Penerimaan">Penerimaan</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Akun COA <span className="text-red-500">*</span> <span className="font-normal normal-case text-slate-400">({form.jenis === 'Penerimaan' ? 'Akun Pendapatan' : 'Akun Beban'})</span></label>
                <select value={form.coaId} onChange={e => { const s = filteredCoa.find(c => c.id === parseInt(e.target.value)); setForm(p => ({ ...p, coaId: e.target.value, coaLabel: s?.label || '' })); }} className={`${sel} ${!form.coaId ? 'border-amber-300' : ''}`}>
                  <option value="">-- Pilih Akun --</option>
                  {filteredCoa.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Sumber Dana</label>
                <select value={form.sumber_dana} onChange={e => setForm(p => ({ ...p, sumber_dana: e.target.value }))} className={sel}>
                  <option value="Kas Mandiri">Kas Mandiri</option>
                  <option value="Kas Pusat">Kas Pusat</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Uraian / Judul Item <span className="text-red-500">*</span></label>
                <input type="text" value={form.uraian} onChange={e => setForm(p => ({ ...p, uraian: e.target.value }))} placeholder="Contoh: Persembahan Kolekte, Biaya Konsumsi..." className={inp} />
              </div>
              <div>
                <label className={lbl}>Deskripsi Peruntukan</label>
                <input type="text" value={form.deskripsi} onChange={e => setForm(p => ({ ...p, deskripsi: e.target.value }))} placeholder="Detail tambahan (opsional)..." className={inp} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <label className={lbl}>Jumlah <span className="text-red-500">*</span></label>
                <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden h-10 bg-white">
                  <button type="button" onClick={() => setForm(p => ({ ...p, jumlah: Math.max(1, p.jumlah - 1) }))} className="w-10 h-full flex justify-center items-center text-slate-500 hover:bg-slate-100 border-r border-slate-300 font-bold">−</button>
                  <input type="number" min={1} value={form.jumlah} onChange={e => setForm(p => ({ ...p, jumlah: parseInt(e.target.value) || 1 }))} className="w-full h-full text-center outline-none text-sm font-semibold" />
                  <button type="button" onClick={() => setForm(p => ({ ...p, jumlah: p.jumlah + 1 }))} className="w-10 h-full flex justify-center items-center text-slate-500 hover:bg-slate-100 border-l border-slate-300 font-bold">+</button>
                </div>
              </div>
              <div>
                <label className={lbl}>Satuan</label>
                <input type="text" placeholder="Kali / Buah / Orang" value={form.satuan} onChange={e => setForm(p => ({ ...p, satuan: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Harga Satuan <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-semibold">Rp</span>
                  <input type="number" min={0} value={form.harga || ''} onChange={e => setForm(p => ({ ...p, harga: parseInt(e.target.value) || 0 }))} className={inp + ' pl-9 font-mono'} />
                </div>
              </div>
              <div>
                <label className={lbl}>Total Estimasi</label>
                <div className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-100 text-sm font-bold text-slate-700 flex items-center font-mono">{fmt(form.jumlah * form.harga)}</div>
              </div>
              <div>
                <button onClick={handleAdd} className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm flex justify-center items-center gap-2 transition-colors shadow-sm">
                  <span className="material-icons-round text-[18px]">add</span> Tambah
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rincian Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-base font-bold text-slate-800">Rincian Keuangan Kegiatan</h2>
          <span className="text-xs text-slate-400">{items.length} item</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-xs font-bold text-slate-500 tracking-wider">
                <th className="p-4 w-[28%]">URAIAN</th>
                <th className="p-4 w-[20%]">AKUN COA</th>
                <th className="p-4 w-[12%]">SUMBER DANA</th>
                <th className="p-4 w-[6%] text-center">JML</th>
                <th className="p-4 w-[7%] text-center">SATUAN</th>
                <th className="p-4 w-[12%] text-right">HARGA</th>
                <th className="p-4 w-[10%] text-right">TOTAL</th>
                {isDraft && <th className="p-4 w-[5%] text-center">AKSI</th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={isDraft ? 8 : 7} className="p-12 text-center text-slate-400 bg-slate-50/50">
                  <div className="flex flex-col items-center gap-2">
                    <span className="material-icons-round text-4xl text-slate-300">receipt_long</span>
                    <p>Belum ada item. Isi form di atas lalu klik "+ Tambah".</p>
                  </div>
                </td></tr>
              ) : (
                <>
                  {/* Penerimaan Group */}
                  {items.some(i => i.jenis === 'Penerimaan') && (
                    <>
                      <tr><td colSpan={isDraft ? 8 : 7} className="px-4 py-2 bg-emerald-700 text-white text-[10px] font-bold tracking-widest uppercase">↑ PENERIMAAN</td></tr>
                      {items.filter(i => i.jenis === 'Penerimaan').map((item, idx) => (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-emerald-50/30">
                          <td className="p-4 pl-6 text-sm font-semibold text-slate-800">{idx + 1}. {item.uraian}<p className="text-xs font-normal text-slate-400">{item.deskripsi}</p></td>
                          <td className="p-4 text-xs font-mono text-slate-500">{item.coaLabel}</td>
                          <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${item.sumber_dana === 'Kas Pusat' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{item.sumber_dana}</span></td>
                          <td className="p-4 text-sm text-center font-medium">{item.jumlah}</td>
                          <td className="p-4 text-sm text-center text-slate-600">{item.satuan}</td>
                          <td className="p-4 text-sm text-right font-mono text-slate-700">{fmt(item.harga)}</td>
                          <td className="p-4 text-sm text-right font-bold font-mono text-emerald-600">{fmt(item.total)}</td>
                          {isDraft && <td className="p-4 text-center"><button onClick={() => setItems(items.filter(i => i.id !== item.id))} className="w-7 h-7 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 flex justify-center items-center mx-auto"><span className="material-icons-round text-[16px]">delete</span></button></td>}
                        </tr>
                      ))}
                    </>
                  )}
                  {/* Pengeluaran Group */}
                  {items.some(i => i.jenis === 'Pengeluaran') && (
                    <>
                      <tr><td colSpan={isDraft ? 8 : 7} className="px-4 py-2 bg-slate-800 text-white text-[10px] font-bold tracking-widest uppercase">↓ PENGELUARAN</td></tr>
                      {items.filter(i => i.jenis === 'Pengeluaran').map((item, idx) => (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-4 pl-6 text-sm font-semibold text-slate-800">{idx + 1}. {item.uraian}<p className="text-xs font-normal text-slate-400">{item.deskripsi}</p></td>
                          <td className="p-4 text-xs font-mono text-slate-500">{item.coaLabel}</td>
                          <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${item.sumber_dana === 'Kas Pusat' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{item.sumber_dana}</span></td>
                          <td className="p-4 text-sm text-center font-medium">{item.jumlah}</td>
                          <td className="p-4 text-sm text-center text-slate-600">{item.satuan}</td>
                          <td className="p-4 text-sm text-right font-mono text-slate-700">{fmt(item.harga)}</td>
                          <td className="p-4 text-sm text-right font-bold font-mono text-slate-800">{fmt(item.total)}</td>
                          {isDraft && <td className="p-4 text-center"><button onClick={() => setItems(items.filter(i => i.id !== item.id))} className="w-7 h-7 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 flex justify-center items-center mx-auto"><span className="material-icons-round text-[16px]">delete</span></button></td>}
                        </tr>
                      ))}
                    </>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        <div className="bg-slate-900 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-3 w-full md:w-auto">
            {isDraft ? (
              <>
                <button onClick={() => handleSave('draft')} className="px-5 py-2.5 rounded-lg border border-slate-700 text-white font-semibold hover:bg-slate-800 transition-colors text-sm flex items-center gap-2">
                  <span className="material-icons-round text-[18px]">save</span> Simpan Draft
                </button>
                <button onClick={() => handleSave('ajukan')} className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors text-sm flex items-center gap-2 shadow-sm">
                  <span className="material-icons-round text-[18px]">send</span> Ajukan LPJ
                </button>
              </>
            ) : (
              <span className={`px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 ${existingStatus === 'Menunggu Review' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`}>
                <span className="material-icons-round text-[18px]">{existingStatus === 'Menunggu Review' ? 'hourglass_empty' : 'check_circle'}</span>
                LPJ {existingStatus}
              </span>
            )}
          </div>
          <div className="flex gap-5 overflow-x-auto">
            {[
              ['Total Penerimaan', fmt(totalP), 'text-emerald-400'],
              ['Total Pengeluaran', `(${fmt(totalK)})`, 'text-red-400'],
              ['Margin', totalP > 0 ? `${(((totalP - totalK) / totalP) * 100).toFixed(1)}%` : '-', 'text-white'],
              ['Sisa / Surplus', fmt(sisa), sisa >= 0 ? 'text-emerald-400' : 'text-red-400'],
            ].map(([label, value, cls], i, arr) => (
              <React.Fragment key={String(label)}>
                <div className="flex flex-col text-right shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                  <span className={`text-sm font-bold font-mono ${cls}`}>{value}</span>
                </div>
                {i < arr.length - 1 && <div className="w-px h-8 bg-slate-700 shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
