'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
const fmtDate = (d: string) => d ? new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d)) : '-';
const fmtTime = (t: string) => t ? t.substring(0, 5) : '-';

export default function ViewLPJPage() {
  const { id } = useParams<{ id: string }>();
  const [kegiatan, setKegiatan] = useState<any>(null);
  const [lpj, setLpj] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [raInfo, setRaInfo] = useState<any>(null);
  const [raItemsReference, setRaItemsReference] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/kegiatan/${id}`).then(r => r.json()),
      fetch(`/api/kegiatan/${id}/lpj`).then(r => r.json()),
    ]).then(([kRes, lpjRes]) => {
      console.log("[DEBUG] Kegiatan API Response:", kRes);
      console.log("[DEBUG] LPJ API Response:", lpjRes);
      if (kRes.success) setKegiatan(kRes.data);
      if (lpjRes.success) {
        setLpj(lpjRes.data.header);
        setRaInfo(lpjRes.data.ra_info || null);
        setRaItemsReference(lpjRes.data.ra_items_reference || []);
        if (lpjRes.data.items?.length > 0) {
          setItems(lpjRes.data.items.map((it: any) => ({
            id: it.id,
            coaId: it.coa_id,
            jenis: it.jenis_anggaran,
            coaLabel: `${it.kode_akun} — ${it.nama_akun}`,
            sumber_dana: it.sumber_dana,
            uraian: it.uraian,
            deskripsi: it.deskripsi || '',
            jumlah: it.jumlah,
            satuan: it.satuan || '',
            harga: parseFloat(it.harga_satuan),
            total: it.jumlah * parseFloat(it.harga_satuan),
          })));
        }
      } else {
        setLpj({ isError: true, message: lpjRes.message });
      }
      setLoading(false);
    });
  }, [id]);

  // ─── TUNGGAL: head-to-head RA vs LPJ (selisih per acara) ───────────────
  const comparisonData = useMemo(() => {
    const raList = raItemsReference;
    const lpjList = items || [];
    const raMap: Record<number, any> = {};
    raList.forEach((r: any) => {
      const total = r.jumlah * parseFloat(r.harga_satuan);
      if (raMap[r.coa_id]) raMap[r.coa_id].total_ra += total;
      else raMap[r.coa_id] = { ...r, total_ra: total };
    });
    const lpjMap: Record<number, any> = {};
    lpjList.forEach((l: any) => {
      if (lpjMap[l.coaId]) lpjMap[l.coaId].total_lpj += l.total;
      else lpjMap[l.coaId] = { ...l, total_lpj: l.total };
    });
    const allCoas = new Set([...Object.keys(raMap).map(Number), ...Object.keys(lpjMap).map(Number)]);
    return Array.from(allCoas).map(coaId => {
      const ra = raMap[coaId];
      const lpj = lpjMap[coaId];
      const total_ra = ra?.total_ra || 0;
      const total_lpj = lpj?.total_lpj || 0;
      return {
        coaId, kode: ra?.kode_akun || lpj?.coaLabel?.split(' — ')[0],
        nama: ra?.nama_akun || lpj?.coaLabel?.split(' — ')[1],
        jenis: ra?.jenis_anggaran || lpj?.jenis,
        ra_uraian: ra?.uraian || '-', ra_vol: ra?.jumlah || 0, ra_satuan: ra?.satuan || '-', ra_total: total_ra,
        lpj_uraian: lpj?.uraian || '-', lpj_vol: lpj?.jumlah || 0, lpj_satuan: lpj?.satuan || '-', lpj_total: total_lpj,
        selisih: total_lpj - total_ra
      };
    });
  }, [raItemsReference, items]);

  // ─── BERTAHAP: kumulatif per COA (Plafon | Terpakai Sebelumnya | LPJ Ini | Sisa) ───
  const bertahapData = useMemo(() => {
    if (raInfo?.pola !== 'Bertahap') return [];
    const raList = raItemsReference;
    const lpjList = items || [];

    // Plafon per COA dari RA
    const plafonMap: Record<number, any> = {};
    raList.forEach((r: any) => {
      const total = r.jumlah * parseFloat(r.harga_satuan);
      if (plafonMap[r.coa_id]) plafonMap[r.coa_id].plafon += total;
      else plafonMap[r.coa_id] = {
        coa_id: r.coa_id, kode: r.kode_akun, nama: r.nama_akun,
        jenis: r.jenis_anggaran, uraian: r.uraian,
        plafon: total,
        terpakai_sebelumnya: r.terpakai_sebelumnya ?? 0,
      };
    });

    // LPJ saat ini per COA
    const lpjMap: Record<number, number> = {};
    lpjList.forEach((l: any) => {
      lpjMap[l.coaId] = (lpjMap[l.coaId] || 0) + l.total;
    });

    const allCoas = new Set([
      ...Object.keys(plafonMap).map(Number),
      ...Object.keys(lpjMap).map(Number)
    ]);

    return Array.from(allCoas).map(coaId => {
      const p = plafonMap[coaId];
      const lpj_ini = lpjMap[coaId] ?? 0;
      const terpakai_sebelumnya = p?.terpakai_sebelumnya ?? 0;
      const plafon = p?.plafon ?? 0;
      const sisa = plafon - terpakai_sebelumnya - lpj_ini;
      const pct = plafon > 0 ? Math.min(100, Math.round(((terpakai_sebelumnya + lpj_ini) / plafon) * 100)) : 0;
      const lpjItem = lpjList.find((l: any) => l.coaId === coaId);
      return {
        coaId, kode: p?.kode || lpjItem?.coaLabel?.split(' — ')[0] || '-',
        nama: p?.nama || lpjItem?.coaLabel?.split(' — ')[1] || '-',
        jenis: p?.jenis || lpjItem?.jenis || 'Pengeluaran',
        uraian: p?.uraian || lpjItem?.uraian || '-',
        plafon, terpakai_sebelumnya, lpj_ini, sisa, pct,
        isOver: sisa < 0,
      };
    });
  }, [raItemsReference, items, raInfo]);

  const totalP = useMemo(() => items.filter(i => i.jenis === 'Penerimaan').reduce((a, c) => a + c.total, 0), [items]);
  const totalK = useMemo(() => items.filter(i => i.jenis === 'Pengeluaran').reduce((a, c) => a + c.total, 0), [items]);
  const sisa = totalP - totalK;

  const statusColor = (s: string) => {
    if (s === 'Disetujui') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s === 'Menunggu Review') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  if (loading) return (
    <div className="w-full flex items-center justify-center py-32">
      <span className="material-icons-round animate-spin text-4xl text-slate-300">refresh</span>
    </div>
  );

  if (!lpj || lpj.isError) return (
    <div className="w-full flex flex-col items-center justify-center py-32 gap-4">
      <span className="material-icons-round text-6xl text-slate-200">assignment_late</span>
      <p className="text-slate-500 font-medium">
        {lpj?.isError ? `Terjadi Kesalahan: ${lpj.message}` : `LPJ belum tersedia untuk kegiatan ini.`}
      </p>
      <Link href={`/kegiatan/${id}/lpj`} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">Input LPJ Sekarang</Link>
    </div>
  );

  return (
    <div className="w-full flex flex-col gap-6 pb-16">

      {/* Breadcrumb & Action Bar — hidden in print */}
      <div className="flex items-center justify-between print-hide">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/kegiatan" className="hover:text-indigo-600">Daftar Kegiatan</Link>
          <span className="material-icons-round text-[16px]">chevron_right</span>
          <Link href={`/kegiatan/${id}`} className="hover:text-indigo-600 truncate max-w-[180px]">{kegiatan?.nama_kegiatan || 'Detail'}</Link>
          <span className="material-icons-round text-[16px]">chevron_right</span>
          <span className="font-semibold text-slate-700">Laporan LPJ</span>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Link href={`/kegiatan/${id}/lpj`} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
            <span className="material-icons-round text-[16px]">edit</span> Edit LPJ
          </Link>
          <button onClick={() => window.print()} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-bold hover:bg-slate-800 flex items-center gap-1.5 transition-colors shadow-sm">
            <span className="material-icons-round text-[16px]">print</span> Cetak / PDF
          </button>
        </div>
      </div>

      {/* ─── PRINT DOCUMENT ─── */}
      <div className="print-doc bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-none print:rounded-none">

        {/* Header Dokumen */}
        <div className="p-8 border-b border-slate-100">
          <div className="flex items-start justify-between gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Laporan Pertanggungjawaban Kegiatan</span>
              <h1 className="text-2xl font-black text-slate-900 font-['Inter'] leading-tight">{kegiatan?.nama_kegiatan}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="font-mono text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded border">{kegiatan?.kode_kegiatan}</span>
                {lpj?.status_lpj && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColor(lpj.status_lpj)}`}>{lpj.status_lpj}</span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-slate-400">Tanggal Cetak</p>
              <p className="text-sm font-semibold text-slate-700">{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</p>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-6 border-b border-slate-100 bg-slate-50/50">
          {[
            { label: 'Tanggal Pelaksanaan', value: fmtDate(kegiatan?.tanggal_mulai) },
            { label: 'Waktu', value: `${fmtTime(kegiatan?.waktu_mulai)} – ${fmtTime(kegiatan?.waktu_selesai)} WIB` },
            { label: 'Lokasi', value: kegiatan?.lokasi_kegiatan || '-' },
            { label: 'Pelaksana', value: kegiatan?.nama_komisi || kegiatan?.nama_departemen || kegiatan?.nama_satelit || 'Pusat' },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
              <span className="text-sm font-semibold text-slate-800">{value}</span>
            </div>
          ))}
        </div>

        {/* RA Info */}
        {raInfo && (
          <div className={`px-8 py-4 border-b flex flex-col gap-1 ${raInfo.pola === 'Bertahap' ? 'bg-amber-50 border-amber-100' : 'bg-indigo-50 border-indigo-100'}`}>
            <div className="flex items-center gap-3">
              <span className={`material-icons-round text-[18px] ${raInfo.pola === 'Bertahap' ? 'text-amber-600' : 'text-indigo-600'}`}>
                {raInfo.pola === 'Bertahap' ? 'repeat' : 'account_balance_wallet'}
              </span>
              <div className="flex-1">
                <span className={`text-xs font-bold ${raInfo.pola === 'Bertahap' ? 'text-amber-800' : 'text-indigo-800'}`}>
                  Referensi Anggaran:{' '}
                </span>
                <span className={`text-xs ${raInfo.pola === 'Bertahap' ? 'text-amber-700' : 'text-indigo-700'}`}>
                  {raInfo.kode} — {raInfo.nama}
                </span>
                <span className={`text-xs ml-2 font-bold px-1.5 py-0.5 rounded ${raInfo.pola === 'Bertahap' ? 'bg-amber-200 text-amber-800' : 'bg-indigo-100 text-indigo-600'}`}>
                  Pola: {raInfo.pola === 'Sekali Pakai' ? 'Tunggal' : raInfo.pola}
                </span>
              </div>
            </div>
            {raInfo.pola === 'Bertahap' && (
              <div className="ml-7 text-[10px] text-amber-700 flex flex-wrap gap-4 mt-0.5">
                <span>Total Plafon RA: <strong className="font-mono">{fmt(raInfo.total_disetujui)}</strong></span>
                {raInfo.total_terpakai_lain > 0 && (
                  <span>Terpakai (Kegiatan Lain): <strong className="font-mono text-amber-900">{fmt(raInfo.total_terpakai_lain)}</strong></span>
                )}
                <span className="text-amber-500 italic">· Analisis per-COA tersedia di tabel di bawah</span>
              </div>
            )}
          </div>
        )}


        {/* Laporan Naratif */}
        {lpj?.laporan_naratif && (
          <div className="px-8 py-5 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Laporan Naratif</p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap italic">"{lpj.laporan_naratif}"</p>
          </div>
        )}

        {/* Rincian Komparasi Keuangan */}
        <div className="px-8 pt-6 pb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {raInfo?.pola === 'Bertahap'
              ? 'Analisis Serapan Kumulatif — RA Bertahap'
              : 'Detail Perbandingan Anggaran vs Realisasi'}
          </p>
          {raInfo?.pola === 'Bertahap' && (
            <p className="text-[10px] text-slate-400 mt-1">
              Menampilkan Plafon Tahunan RA, pemakaian dari kegiatan sebelumnya, dan LPJ kegiatan ini.
            </p>
          )}
        </div>

        {/* ═══ MODE BERTAHAP ═══ */}
        {raInfo?.pola === 'Bertahap' ? (
          <div className="overflow-x-auto pb-6">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-100 border-y border-slate-200 text-[9px] font-black text-slate-600 uppercase tracking-tighter">
                  <th className="px-6 py-3 w-[22%] border-r border-slate-200">Akun COA</th>
                  <th className="px-4 py-3 text-right border-r border-slate-200 bg-blue-50/60">Plafon Tahunan</th>
                  <th className="px-4 py-3 text-right border-r border-slate-200 bg-amber-50/60">Terpakai Sebelumnya</th>
                  <th className="px-4 py-3 text-right border-r border-slate-200 bg-emerald-50/60">LPJ Kegiatan Ini</th>
                  <th className="px-4 py-3 text-right border-r border-slate-200">Sisa Plafon</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="text-[11px]">
                {['Penerimaan', 'Pengeluaran'].map(jenis => {
                  const rows = bertahapData.filter((d: any) => d.jenis === jenis);
                  if (!rows.length) return null;
                  return (
                    <React.Fragment key={jenis}>
                      <tr className="bg-slate-800 text-white font-black text-[9px] tracking-widest uppercase">
                        <td colSpan={6} className="px-6 py-1.5">{jenis === 'Penerimaan' ? '↑ Penerimaan Kas' : '↓ Pengeluaran / Beban'}</td>
                      </tr>
                      {rows.map((row: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="px-6 py-3 border-r border-slate-100">
                            <div className="font-bold font-mono text-slate-800 text-[10px]">{row.kode}</div>
                            <div className="text-[10px] text-slate-400 truncate w-44">{row.nama}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5 italic">{row.uraian}</div>
                            {/* Progress bar */}
                            {row.plafon > 0 && (
                              <div className="mt-2">
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${row.isOver ? 'bg-red-500' : row.pct > 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(row.pct, 100)}%` }}
                                  />
                                </div>
                                <span className="text-[9px] text-slate-400">{row.pct}% terserap</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-blue-700 font-semibold border-r border-slate-100 bg-blue-50/30">{row.plafon > 0 ? fmt(row.plafon) : '-'}</td>
                          <td className="px-4 py-3 text-right font-mono text-amber-600 border-r border-slate-100 bg-amber-50/20">{row.terpakai_sebelumnya > 0 ? fmt(row.terpakai_sebelumnya) : <span className="text-slate-300">-</span>}</td>
                          <td className="px-4 py-3 text-right font-black font-mono text-slate-900 border-r border-slate-100 bg-emerald-50/20">{row.lpj_ini > 0 ? fmt(row.lpj_ini) : <span className="text-slate-300">-</span>}</td>
                          <td className={`px-4 py-3 text-right font-black font-mono border-r border-slate-100 ${row.isOver ? 'text-red-600 bg-red-50/30' : 'text-emerald-700'}`}>
                            {fmt(row.sisa)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${row.isOver ? 'bg-red-50 text-red-700 border-red-200' : row.pct > 80 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                              {row.isOver ? '🔴 Over-budget' : row.pct > 80 ? '⚠️ Kritis' : '🟢 Aman'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
        /* ═══ MODE TUNGGAL (SEKALI PAKAI) ═══ */
        <div className="overflow-x-auto pb-6">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-100 border-y border-slate-200 text-[9px] font-black text-slate-600 uppercase tracking-tighter">
                <th rowSpan={2} className="px-8 py-3 w-[20%] border-r border-slate-200">Akun COA</th>
                <th colSpan={3} className="px-4 py-2 text-center bg-blue-50/50 border-r border-slate-200">RENCANA ANGGARAN (RA)</th>
                <th colSpan={3} className="px-4 py-2 text-center bg-emerald-50/30 border-r border-slate-200">REALISASI KEGIATAN (LPJ)</th>
                <th rowSpan={2} className="px-8 py-3 text-right">SELISIH</th>
              </tr>
              <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold text-slate-500 uppercase">
                <th className="px-4 py-2">Uraian</th>
                <th className="px-2 py-2 text-center">Vol</th>
                <th className="px-4 py-2 text-right border-r border-slate-200">Total RA</th>
                <th className="px-4 py-2">Uraian</th>
                <th className="px-2 py-2 text-center">Vol</th>
                <th className="px-4 py-2 text-right border-r border-slate-200">Total Realisasi</th>
              </tr>
            </thead>
            <tbody className="text-[11px]">
              {['Penerimaan', 'Pengeluaran'].map(jenis => {
                const rows = comparisonData.filter(d => d.jenis === jenis);
                if (!rows.length) return null;
                return (
                  <React.Fragment key={jenis}>
                    <tr className="bg-slate-800 text-white font-black text-[9px] tracking-widest uppercase">
                      <td colSpan={8} className="px-8 py-1.5">{jenis === 'Penerimaan' ? '↑ Penerimaan Kas' : '↓ Pengeluaran / Beban'}</td>
                    </tr>
                    {rows.map((row, idx) => {
                      const selisihColor = row.jenis === 'Penerimaan'
                        ? (row.selisih >= 0 ? 'text-emerald-600' : 'text-red-500')
                        : (row.selisih <= 0 ? 'text-emerald-600' : 'text-red-500');
                      return (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="px-8 py-3 font-mono border-r border-slate-100">
                            <div className="font-bold text-slate-800">{row.kode}</div>
                            <div className="text-[10px] text-slate-400 truncate w-40">{row.nama}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-500 italic">{row.ra_uraian}</td>
                          <td className="px-2 py-3 text-center text-slate-400">{row.ra_total > 0 ? `${row.ra_vol} ${row.ra_satuan}` : '-'}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500 border-r border-slate-100">{row.ra_total > 0 ? fmt(row.ra_total) : '-'}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{row.lpj_total > 0 ? row.lpj_uraian : <span className="text-slate-200 italic">Tidak ada realisasi</span>}</td>
                          <td className="px-2 py-3 text-center font-bold text-slate-700">{row.lpj_total > 0 ? `${row.lpj_vol} ${row.lpj_satuan}` : '-'}</td>
                          <td className="px-4 py-3 text-right font-black text-slate-900 border-r border-slate-100 bg-slate-50/30">{row.lpj_total > 0 ? fmt(row.lpj_total) : '-'}</td>
                          <td className={`px-8 py-3 text-right font-black font-mono ${selisihColor}`}>
                            {row.lpj_total > 0 || row.ra_total > 0 ? (row.selisih >= 0 ? `+${fmt(row.selisih)}` : fmt(row.selisih)) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        )}

        {/* Summary Footer */}
        <div className="print-summary bg-slate-900 px-8 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-slate-400 text-xs print:hidden">LPJ · {kegiatan?.kode_kegiatan}</div>
          <div className="flex gap-6 flex-wrap justify-end">
            {[
              ['Total Penerimaan', fmt(totalP), 'text-emerald-400'],
              ['Total Pengeluaran', `(${fmt(totalK)})`, 'text-red-400'],
              ['Margin', totalP > 0 ? `${(((totalP - totalK) / totalP) * 100).toFixed(1)}%` : '-', 'text-white'],
              ['Sisa / Surplus', fmt(sisa), sisa >= 0 ? 'text-emerald-400' : 'text-red-400'],
            ].map(([label, value, cls]) => (
              <div key={String(label)} className="flex flex-col text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                <span className={`text-sm font-bold font-mono ${cls}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tanda Tangan (print only) */}
        <div className="hidden print-show-grid grid-cols-3 gap-8 px-8 py-8 border-t border-slate-200">
          {['Dibuat Oleh', 'Mengetahui', 'Menyetujui'].map(label => (
            <div key={label} className="flex flex-col gap-16">
              <span className="text-xs text-slate-500">{label},</span>
              <div className="border-b border-slate-400 w-full" />
              <span className="text-xs text-slate-500">(.................................)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          /* ─── Page setup: landscape A4 ─── */
          @page {
            size: A4 landscape;
            margin: 12mm 15mm;
          }

          /* ─── Reset: sembunyikan semua kecuali dokumen LPJ ─── */
          body * { visibility: hidden; }
          .print-doc, .print-doc * { visibility: visible !important; }
          .print-doc {
            position: fixed;
            top: 0; left: 0;
            width: 100%;
            padding: 0;
            margin: 0;
          }

          /* ─── Sembunyikan breadcrumb, tombol, footer site ─── */
          .print-hide { display: none !important; }

          /* ─── Tanda tangan (hidden di web, grid di print) ─── */
          .print-show-grid { display: grid !important; }

          /* ─── Typography print-friendly ─── */
          .print-doc * {
            font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* ─── Table: auto-fit tanpa min-width ─── */
          .print-doc table {
            width: 100% !important;
            min-width: unset !important;
            font-size: 8pt !important;
            border-collapse: collapse !important;
            table-layout: auto !important;
          }
          .print-doc th, .print-doc td {
            padding: 4pt 6pt !important;
            word-break: break-word !important;
          }
          .print-doc th {
            font-size: 7pt !important;
          }

          /* ─── Force background colors ─── */
          .print-doc .bg-slate-800,
          .print-doc .bg-slate-900 {
            background-color: #1e293b !important;
            color: #ffffff !important;
          }
          .print-doc .bg-slate-100 { background-color: #f1f5f9 !important; }
          .print-doc .bg-slate-50 { background-color: #f8fafc !important; }
          .print-doc .bg-blue-50\\/60,
          .print-doc [class*="bg-blue-50"] { background-color: #eff6ff !important; }
          .print-doc .bg-amber-50\\/60,
          .print-doc [class*="bg-amber-50"] { background-color: #fffbeb !important; }
          .print-doc .bg-emerald-50\\/60,
          .print-doc [class*="bg-emerald-50"] { background-color: #ecfdf5 !important; }
          .print-doc .bg-red-50\\/30,
          .print-doc [class*="bg-red-50"] { background-color: #fef2f2 !important; }
          .print-doc .bg-indigo-50 { background-color: #eef2ff !important; }
          .print-doc .bg-amber-50 { background-color: #fffbeb !important; }

          /* ─── Summary footer (dark bar) ─── */
          .print-summary {
            background-color: #0f172a !important;
            color: white !important;
            padding: 8pt 16pt !important;
            display: flex !important;
            justify-content: flex-end !important;
            gap: 24pt !important;
            margin-top: 4pt !important;
          }

          /* ─── Overflow: jangan clip tabel ─── */
          .print-doc .overflow-x-auto { overflow: visible !important; }

          /* ─── Page break ─── */
          .print-doc thead { display: table-header-group; }
          .print-doc tr { page-break-inside: avoid; }

          /* ─── Progress bar tampil di print ─── */
          .print-doc [class*="bg-emerald-500"],
          .print-doc [class*="bg-amber-400"],
          .print-doc [class*="bg-red-500"] {
            print-color-adjust: exact !important;
          }
        }
      `}</style>

    </div>
  );
}
