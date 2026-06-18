'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
const fmtDate = (d: string) => d ? new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d)) : '-';
const fmtTime = (t: string) => t ? t.substring(0, 5) : '-';

const getStatusBadge = (status: string) => {
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    'Disetujui':        { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
    'Menunggu Review':  { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500'   },
    'Draft':            { bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400'   },
    'Revisi':           { bg: 'bg-orange-50',   text: 'text-orange-700',  dot: 'bg-orange-500'  },
  };
  const s = map[status] || map['Draft'];
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${s.bg} ${s.text} flex items-center gap-1.5 w-max border`}>
      <span className={`w-2 h-2 rounded-full ${s.dot} ${status === 'Menunggu Review' ? 'animate-pulse' : ''}`}></span>
      {status}
    </span>
  );
};

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

  // ─── TUNGGAL: head-to-head RA vs LPJ ───────────────────────────────────────
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

  // ─── BERTAHAP: kumulatif per COA ───────────────────────────────────────────
  const bertahapData = useMemo(() => {
    if (raInfo?.pola !== 'Bertahap') return [];
    const raList = raItemsReference;
    const lpjList = items || [];
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
    const lpjMap: Record<number, number> = {};
    lpjList.forEach((l: any) => { lpjMap[l.coaId] = (lpjMap[l.coaId] || 0) + l.total; });
    const allCoas = new Set([...Object.keys(plafonMap).map(Number), ...Object.keys(lpjMap).map(Number)]);
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
  const margin = totalP > 0 ? ((totalP - totalK) / totalP) * 100 : 0;

  if (loading) return (
    <div className="w-full flex flex-col items-center justify-center py-32 gap-3">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-400 text-sm">Memuat Laporan LPJ...</p>
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
    <div className="w-full flex flex-col gap-6 pb-32">

      {/* ── Breadcrumb ── */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-sans leading-4">
          <Link href="/kegiatan" className="text-slate-500 hover:text-indigo-600">Daftar Kegiatan</Link>
          <span className="text-slate-400 material-icons-round text-[14px]">chevron_right</span>
          <Link href={`/kegiatan/${id}`} className="text-slate-500 hover:text-indigo-600 truncate max-w-[200px]">{kegiatan?.nama_kegiatan || 'Detail Kegiatan'}</Link>
          <span className="text-slate-400 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Laporan LPJ</span>
        </div>

        {/* ── Page Title Row ── */}
        <div className="self-stretch inline-flex justify-between items-end gap-4 flex-wrap">
          <div className="flex flex-col gap-2">
            <div className="inline-flex gap-3 items-center flex-wrap">
              <h1 className="text-slate-900 text-3xl font-black font-sans leading-9">Laporan Pertanggungjawaban</h1>
              {lpj?.status_lpj && getStatusBadge(lpj.status_lpj)}
            </div>
            {kegiatan?.nama_kegiatan && (
              <p className="text-slate-500 text-base font-medium">{kegiatan.nama_kegiatan}</p>
            )}
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <div className="text-slate-500 text-sm font-medium font-sans flex gap-1 items-center">
              <span className="material-icons-round text-lg text-slate-400">qr_code</span>
              Kode: <span className="text-slate-700 font-bold">{kegiatan?.kode_kegiatan}</span>
            </div>
            {lpj?.status_lpj === 'Disetujui' ? (
              <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold cursor-not-allowed">
                <span className="material-icons-round text-[18px]">lock</span>
                LPJ Dikunci
              </div>
            ) : (
              <Link
                href={`/kegiatan/${id}/lpj`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-semibold font-sans hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all shadow-sm"
              >
                <span className="material-icons-round text-[18px]">edit</span>
                Edit LPJ
              </Link>
            )}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold font-sans transition-all shadow-sm"
            >
              <span className="material-icons-round text-[18px]">print</span>
              Cetak / PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── Info Card ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-5 border-b border-slate-100">
          {[
            { label: 'Tanggal Pelaksanaan', value: fmtDate(kegiatan?.tanggal_mulai) },
            { label: 'Waktu', value: `${fmtTime(kegiatan?.waktu_mulai)} – ${fmtTime(kegiatan?.waktu_selesai)} WIB` },
            { label: 'Lokasi', value: kegiatan?.lokasi_kegiatan || '-' },
            { label: 'Pelaksana', value: kegiatan?.nama_komisi || kegiatan?.nama_departemen || kegiatan?.nama_satelit || 'Pusat' },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
              <span className="text-sm font-semibold text-slate-800">{value}</span>
            </div>
          ))}
        </div>
        {/* Tanggal Cetak & Laporan Naratif */}
        <div className="pt-5 flex flex-col gap-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tanggal Cetak</span>
              <span className="text-sm font-semibold text-slate-700">
                {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
              </span>
            </div>
            {raInfo && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Referensi Anggaran</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-700">{raInfo.kode} — {raInfo.nama}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${raInfo.pola === 'Bertahap' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}>
                    Pola: {raInfo.pola === 'Sekali Pakai' ? 'Tunggal' : raInfo.pola}
                  </span>
                  {raInfo.pola === 'Bertahap' && raInfo.total_terpakai_lain > 0 && (
                    <span className="text-xs text-amber-700 font-medium">
                      Terpakai kegiatan lain: <strong>{fmt(raInfo.total_terpakai_lain)}</strong>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          {lpj?.laporan_naratif && (
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Laporan Naratif</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap italic">"{lpj.laporan_naratif}"</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabel Keuangan ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {raInfo?.pola === 'Bertahap' ? 'Analisis Serapan Kumulatif — RA Bertahap' : 'Perbandingan Anggaran vs Realisasi'}
            </h2>
            {raInfo?.pola === 'Bertahap' && (
              <p className="text-xs text-slate-400 mt-0.5">Plafon Tahunan RA, pemakaian kegiatan sebelumnya, dan LPJ kegiatan ini.</p>
            )}
          </div>
          <span className="text-xs text-slate-400 font-medium">{items.length} item realisasi</span>
        </div>

        <div className="overflow-x-auto w-full">
          {/* ═══ MODE BERTAHAP ═══ */}
          {raInfo?.pola === 'Bertahap' ? (
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-xs font-bold text-slate-500 tracking-wider">
                  <th className="p-4 w-[25%]">AKUN COA</th>
                  <th className="p-4 text-right bg-blue-50/60 text-blue-700 border-l border-slate-100">PLAFON TAHUNAN</th>
                  <th className="p-4 text-right bg-amber-50/60 text-amber-700 border-l border-slate-100">TERPAKAI SEBELUMNYA</th>
                  <th className="p-4 text-right bg-emerald-50/60 text-emerald-700 border-l border-slate-100">LPJ KEGIATAN INI</th>
                  <th className="p-4 text-right border-l border-slate-100">SISA PLAFON</th>
                  <th className="p-4 text-center border-l border-slate-100">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {['Penerimaan', 'Pengeluaran'].map(jenis => {
                  const rows = bertahapData.filter((d: any) => d.jenis === jenis);
                  if (!rows.length) return null;
                  return (
                    <React.Fragment key={jenis}>
                      <tr className={`${jenis === 'Penerimaan' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'} text-[10px] font-bold tracking-widest uppercase border-b border-slate-100`}>
                        <td colSpan={6} className="px-4 py-1.5">{jenis === 'Penerimaan' ? '↑ PENERIMAAN' : '↓ PENGELUARAN / BEBAN'}</td>
                      </tr>
                      {rows.map((row: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                          <td className="p-4">
                            <div className="font-bold font-sans text-slate-800 text-[11px]">{row.kode}</div>
                            <div className="text-xs text-slate-400 truncate max-w-[200px]">{row.nama}</div>
                            <div className="text-xs text-slate-500 mt-0.5 italic">{row.uraian}</div>
                            {row.plafon > 0 && (
                              <div className="mt-2">
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${row.isOver ? 'bg-red-500' : row.pct > 80 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(row.pct, 100)}%` }} />
                                </div>
                                <span className="text-[9px] text-slate-400">{row.pct}% terserap</span>
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-right font-sans text-blue-700 font-semibold border-l border-slate-100 bg-blue-50/20">{row.plafon > 0 ? fmt(row.plafon) : '-'}</td>
                          <td className="p-4 text-right font-sans text-amber-600 border-l border-slate-100 bg-amber-50/10">{row.terpakai_sebelumnya > 0 ? fmt(row.terpakai_sebelumnya) : <span className="text-slate-300">-</span>}</td>
                          <td className="p-4 text-right font-black font-sans text-slate-900 border-l border-slate-100 bg-emerald-50/10">{row.lpj_ini > 0 ? fmt(row.lpj_ini) : <span className="text-slate-300">-</span>}</td>
                          <td className={`p-4 text-right font-black font-sans border-l border-slate-100 ${row.isOver ? 'text-red-600 bg-red-50/20' : 'text-emerald-700'}`}>{fmt(row.sisa)}</td>
                          <td className="p-4 text-center border-l border-slate-100">
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
          ) : (
            /* ═══ MODE TUNGGAL (HEAD-TO-HEAD) ═══ */
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-xs font-bold text-slate-500 tracking-wider">
                  <th rowSpan={2} className="p-4 w-[18%] border-r border-slate-100 align-bottom">AKUN COA</th>
                  <th colSpan={3} className="p-3 text-center bg-blue-50/60 text-blue-700 border-r border-slate-100">RENCANA ANGGARAN (RA)</th>
                  <th colSpan={3} className="p-3 text-center bg-emerald-50/40 text-emerald-700 border-r border-slate-100">REALISASI KEGIATAN (LPJ)</th>
                  <th rowSpan={2} className="p-4 text-right align-bottom">SELISIH</th>
                </tr>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                  <th className="p-3 bg-blue-50/40">URAIAN</th>
                  <th className="p-3 text-center bg-blue-50/40">VOL</th>
                  <th className="p-3 text-right bg-blue-50/40 border-r border-slate-100">TOTAL RA</th>
                  <th className="p-3 bg-emerald-50/20">URAIAN</th>
                  <th className="p-3 text-center bg-emerald-50/20">VOL</th>
                  <th className="p-3 text-right bg-emerald-50/20 border-r border-slate-100">TOTAL REALISASI</th>
                </tr>
              </thead>
              <tbody>
                {['Penerimaan', 'Pengeluaran'].map(jenis => {
                  const rows = comparisonData.filter(d => d.jenis === jenis);
                  if (!rows.length) return null;
                  return (
                    <React.Fragment key={jenis}>
                      <tr className={`${jenis === 'Penerimaan' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'} text-[10px] font-bold tracking-widest uppercase border-b border-slate-100`}>
                        <td colSpan={8} className="px-4 py-1.5">{jenis === 'Penerimaan' ? '↑ PENERIMAAN' : '↓ PENGELUARAN / BEBAN'}</td>
                      </tr>
                      {rows.map((row, idx) => {
                        const isOnlyInLPJ  = row.ra_total === 0 && row.lpj_total > 0;
                        const isOnlyInRA   = row.lpj_total === 0 && row.ra_total > 0;
                        const pct = row.ra_total > 0 ? Math.round((row.lpj_total / row.ra_total) * 100) : null;
                        // Warna SELISIH: Penerimaan lebih = hijau | kurang = merah; Pengeluaran lebih = merah | hemat = hijau
                        const selisihColor = row.jenis === 'Penerimaan'
                          ? (row.selisih >= 0 ? 'text-emerald-600' : 'text-red-500')
                          : (row.selisih <= 0 ? 'text-emerald-600' : 'text-red-500');
                        // Badge %: berapa persen realisasi dari anggaran
                        const pctBadge = () => {
                          if (isOnlyInLPJ) return <span className="mt-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">⊕ COA Baru</span>;
                          if (isOnlyInRA)  return <span className="mt-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">✗ Tidak Direalisasi</span>;
                          if (pct === null) return null;
                          const isOver  = row.jenis === 'Pengeluaran' ? pct > 100 : false;
                          const isShort = row.jenis === 'Penerimaan'  ? pct < 100 : false;
                          const badgeCls = isOver  ? 'bg-red-50 text-red-700 border-red-200'
                                         : isShort ? 'bg-amber-50 text-amber-700 border-amber-200'
                                         : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                          return <span className={`mt-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-black border whitespace-nowrap ${badgeCls}`}>{pct}% dari anggaran</span>;
                        };
                        return (
                          <tr key={idx} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${isOnlyInLPJ ? 'bg-purple-50/20' : isOnlyInRA ? 'bg-slate-50/60' : ''}`}>
                            <td className="p-4 border-r border-slate-100 font-sans">
                              <div className="font-bold text-slate-800 text-sm">{row.kode}</div>
                              <div className="text-xs text-slate-400 truncate max-w-[160px]">{row.nama}</div>
                            </td>
                            <td className="p-4 text-sm text-slate-500 italic bg-blue-50/10">{isOnlyInLPJ ? <span className="text-purple-400 italic text-xs">— tidak ada di RA —</span> : row.ra_uraian}</td>
                            <td className="p-4 text-center text-slate-400 text-sm bg-blue-50/10">{row.ra_total > 0 ? `${row.ra_vol} ${row.ra_satuan}` : '-'}</td>
                            <td className="p-4 text-right font-sans text-slate-500 border-r border-slate-100 bg-blue-50/10">{row.ra_total > 0 ? fmt(row.ra_total) : '-'}</td>
                            <td className="p-4 text-sm font-semibold text-slate-800 bg-emerald-50/10">{row.lpj_total > 0 ? row.lpj_uraian : <span className="text-slate-200 italic">Tidak ada realisasi</span>}</td>
                            <td className="p-4 text-center font-bold text-slate-700 text-sm bg-emerald-50/10">{row.lpj_total > 0 ? `${row.lpj_vol} ${row.lpj_satuan}` : '-'}</td>
                            <td className="p-4 text-right font-black text-slate-900 border-r border-slate-100 bg-emerald-50/10">{row.lpj_total > 0 ? fmt(row.lpj_total) : '-'}</td>
                            <td className="p-4 text-right">
                              <div className={`font-black font-sans ${selisihColor} ${(row.lpj_total > 0 || row.ra_total > 0) ? '' : 'text-slate-300'}`}>
                                {row.lpj_total > 0 || row.ra_total > 0 ? (row.selisih >= 0 ? `+${fmt(row.selisih)}` : fmt(row.selisih)) : '-'}
                              </div>
                              <div className="flex justify-end">{pctBadge()}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer Bar ── */}
        <div className="bg-slate-900 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-3 w-full md:w-auto">
            {lpj?.status_lpj === 'Disetujui' ? (
              <div className="px-5 py-2.5 rounded-lg bg-emerald-800 text-emerald-300 text-sm flex items-center gap-2 font-semibold cursor-not-allowed border border-emerald-700">
                <span className="material-icons-round text-[18px]">lock</span> LPJ Dikunci
              </div>
            ) : (
              <Link href={`/kegiatan/${id}/lpj`} className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors text-sm flex items-center gap-2 shadow-sm">
                <span className="material-icons-round text-[18px]">edit</span> Edit LPJ
              </Link>
            )}
            <button onClick={() => window.print()} className="px-5 py-2.5 rounded-lg bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors text-sm flex items-center gap-2 font-semibold">
              <span className="material-icons-round text-[18px]">print</span> Cetak / PDF
            </button>
          </div>
          <div className="flex gap-5 overflow-x-auto flex-wrap justify-end">
            {[
              ['Total Penerimaan', fmt(totalP), 'text-emerald-400'],
              ['Total Pengeluaran', `(${fmt(totalK)})`, 'text-red-400'],
              ['Margin', totalP > 0 ? `${margin.toFixed(1)}%` : '-', 'text-white'],
              ['Sisa / Surplus', fmt(sisa), sisa >= 0 ? 'text-emerald-400' : 'text-red-400'],
            ].map(([label, value, cls], i, arr) => (
              <React.Fragment key={String(label)}>
                <div className="flex flex-col text-right shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                  <span className={`text-sm font-bold font-sans ${cls}`}>{value}</span>
                </div>
                {i < arr.length - 1 && <div className="w-px h-8 bg-slate-700 shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm 15mm; }
          nav, header, footer, aside, [class*="sidebar"], [class*="bottom-nav"] { display: none !important; }
          body > * { visibility: hidden; }
          main, main * { visibility: visible !important; }
          .print\\:hidden { display: none !important; }
          table { width: 100% !important; min-width: unset !important; font-size: 8pt !important; border-collapse: collapse !important; }
          th, td { padding: 4pt 6pt !important; word-break: break-word !important; }
          .bg-slate-900 { background-color: #0f172a !important; color: white !important; }
          .bg-slate-800 { background-color: #1e293b !important; color: white !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}
