'use client';

import React, { useState, useEffect, useMemo } from 'react';

interface Step2Props {
  runId: number;
  onNext: () => void;
  onPrev: () => void;
  setSubmitState: (state: any) => void;
}

const getInitials = (name: string) => {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || '??').slice(0, 2).toUpperCase();
};

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
  'bg-amber-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
];
const getAvatarColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

export default function Step2Review({ runId, onNext, onPrev, setSubmitState }: Step2Props) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  // local adj: detailId → { komponenId: nominal }
  const [localAdj, setLocalAdj] = useState<Record<number, Record<number, string>>>({});
  const [adjustedRows, setAdjustedRows] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);
  const [adjMsg, setAdjMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchDetails(); }, [runId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/runs/${runId}/details`);
      const r = await res.json();
      if (r.success) setData(r.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(d => (d.nama_lengkap || '').toLowerCase().includes(q));
  }, [data, search]);

  const totalNetto = data.reduce((a, d) => a + Number(d.total_netto), 0);
  const adjCount = adjustedRows.size + data.filter(d =>
    d.komponen?.some((k: any) => k.calculation_snapshot?.source === 'override')
  ).length;

  const gajiPokok = (item: any) => {
    const p = (item.komponen || []).filter((k: any) => k.tipe === 'Penerimaan' && !k.is_employer_portion);
    const gp = p.find((k: any) => (k.nama_komponen || '').toLowerCase().includes('gaji'));
    return gp ? Number(gp.nominal) : 0;
  };
  const tunjangan = (item: any) => {
    const p = (item.komponen || []).filter((k: any) => k.tipe === 'Penerimaan' && !k.is_employer_portion);
    return p.filter((k: any) => !(k.nama_komponen || '').toLowerCase().includes('gaji'))
      .reduce((a: number, k: any) => a + Number(k.nominal), 0);
  };

  const handleSaveAdj = async (item: any) => {
    // Kumpulkan overrides: semua komponen yang ada di input (even unchanged)
    // Filter hanya Penerimaan yang editable (bukan employer portion)
    const penerimaan = (item.komponen || []).filter((k: any) => k.tipe === 'Penerimaan' && !k.is_employer_portion);
    const itemAdjMap = localAdj[item.id] || {};

    // Cek apakah ada yang berubah
    const changedOverrides = penerimaan
      .filter((k: any) => itemAdjMap[k.komponen_id] !== undefined)
      .map((k: any) => ({
        komponen_id: k.komponen_id,
        nominal: parseFloat(itemAdjMap[k.komponen_id]) || 0,
      }));

    if (changedOverrides.length === 0) {
      setAdjMsg({ type: 'error', text: 'Tidak ada nilai yang diubah.' });
      setTimeout(() => setAdjMsg(null), 3000);
      return;
    }

    setSavingId(item.id);
    try {
      const res = await fetch(`/api/payroll/runs/${runId}/komponen`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run_detail_id: item.id,
          overrides: changedOverrides,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setAdjustedRows(prev => new Set([...prev, item.id]));
        setAdjMsg({ type: 'success', text: 'Penyesuaian berhasil disimpan.' });
        // Refresh data untuk baris ini
        await fetchDetails();
      } else {
        setAdjMsg({ type: 'error', text: result.message || 'Gagal menyimpan penyesuaian.' });
      }
    } catch {
      setAdjMsg({ type: 'error', text: 'Terjadi kesalahan koneksi.' });
    } finally {
      setSavingId(null);
      setTimeout(() => setAdjMsg(null), 4000);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in">

      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h2 className="text-slate-900 text-xl font-bold font-['Inter'] flex items-center gap-2">
            <span className="material-icons-round text-amber-500">group</span>
            Review Daftar Pegawai Payroll
          </h2>
          <p className="text-slate-500 text-sm font-['Public_Sans']">
            Step 2: Review data gaji sebelum diajukan untuk approval.
          </p>
        </div>
        <span className="text-xs font-medium bg-slate-100 text-slate-500 px-3 py-1 rounded-full flex items-center gap-1 shrink-0">
          <span className="material-icons-round text-[14px]">cloud_done</span>
          Draft tersimpan otomatis
        </span>
      </div>

      {/* Summary Cards */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-500/10 rounded-xl flex items-center justify-center shrink-0">
            <span className="material-icons-round text-slate-600 text-3xl">group</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Total Pegawai</span>
            <span className="text-slate-900 text-3xl font-bold font-['Public_Sans'] mt-1">{loading ? '—' : data.length}</span>
          </div>
        </div>

        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600/10 rounded-xl flex items-center justify-center shrink-0">
            <span className="material-icons-round text-indigo-700 text-3xl">account_balance_wallet</span>
          </div>
          <div className="flex flex-col truncate">
            <span className="text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Total Netto</span>
            <span className="text-slate-900 text-xl font-bold font-['Liberation_Mono'] mt-1 truncate">
              {loading ? '—' : formatRupiah(totalNetto)}
            </span>
          </div>
        </div>

        <div className={`p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 ${adjCount > 0 ? 'border-t-4 border-t-amber-400' : ''}`}>
          <div className="w-14 h-14 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0">
            <span className="material-icons-round text-amber-600 text-3xl">tune</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Penyesuaian</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-['Public_Sans']">{loading ? '—' : adjCount}</span>
              {adjCount > 0 && <span className="text-[10px] font-bold text-amber-600 mb-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">Perlu Cek</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-sm">
        <div className="flex-1 min-w-[240px] relative flex items-center">
          <span className="material-icons-round absolute left-3 text-slate-400 text-[20px]">search</span>
          <input
            type="text"
            placeholder="Cari pegawai..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 text-slate-400 hover:text-slate-600">
              <span className="material-icons-round text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Adj feedback */}
      {adjMsg && (
        <div className={`px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-['Public_Sans'] animate-in fade-in ${adjMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-700'}`}>
          <span className="material-icons-round text-[16px]">{adjMsg.type === 'success' ? 'check_circle' : 'error_outline'}</span>
          {adjMsg.text}
        </div>
      )}

      {/* Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative z-0">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[1050px] flex flex-col">

            {/* Header */}
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4 gap-2">
              <div className="w-9 shrink-0"></div>
              <div className="w-52 shrink-0 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Nama Pegawai</div>
              <div className="w-36 shrink-0 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Jabatan</div>
              <div className="flex-1 min-w-[105px] text-right text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Gaji Pokok</div>
              <div className="flex-1 min-w-[105px] text-right text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Tunjangan</div>
              <div className="flex-1 min-w-[105px] text-right text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Potongan</div>
              <div className="flex-1 min-w-[105px] text-right text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider pr-4">Netto</div>
              <div className="w-28 shrink-0 text-center text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Status</div>
              <div className="w-8 shrink-0"></div>
            </div>

            {/* Body */}
            <div className="min-h-64">
              {loading ? (
                <div className="w-full py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin"></div>
                  <span className="text-sm font-['Public_Sans']">Mengkalkulasi komponen gaji...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="w-full py-16 flex flex-col items-center justify-center text-slate-500">
                  <span className="material-icons-round text-5xl mb-2 text-slate-300">group_off</span>
                  <span className="text-sm font-['Public_Sans']">
                    {search ? `Tidak ada pegawai "${search}".` : 'Tidak ada pegawai aktif di unit ini.'}
                  </span>
                </div>
              ) : (
                filtered.map((item) => {
                  const isExpanded = expandedId === item.id;
                  const isAdj = adjustedRows.has(item.id) || item.komponen?.some((k: any) => k.calculation_snapshot?.source === 'override');
                  const penerimaan = (item.komponen || []).filter((k: any) => k.tipe === 'Penerimaan' && !k.is_employer_portion);
                  const potongan = (item.komponen || []).filter((k: any) => k.tipe === 'Potongan' && !k.is_employer_portion);
                  const bebanGereja = (item.komponen || []).filter((k: any) => k.is_employer_portion);
                  const totalBG = bebanGereja.reduce((a: number, k: any) => a + Number(k.nominal), 0);
                  const adjForItem = localAdj[item.id] || {};

                  return (
                    <React.Fragment key={item.id}>
                      {/* Row */}
                      <div
                        className={`w-full flex items-center px-6 py-4 border-b gap-2 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50 border-blue-200' : 'border-slate-100 hover:bg-slate-50'}`}
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      >
                        <div className="w-9 shrink-0 flex items-center">
                          <div className={`w-8 h-8 rounded-full ${getAvatarColor(item.nama_lengkap || '')} flex items-center justify-center text-white text-xs font-bold font-['Public_Sans'] shrink-0`}>
                            {getInitials(item.nama_lengkap || '')}
                          </div>
                        </div>
                        <div className="w-52 shrink-0 flex flex-col pr-2">
                          <span className="text-slate-900 text-sm font-bold font-['Public_Sans'] truncate">{item.nama_lengkap}</span>

                        </div>
                        <div className="w-36 shrink-0 pr-2">
                          <span className="text-slate-600 text-sm font-medium font-['Public_Sans'] truncate block">{item.jabatan_snapshot || '—'}</span>
                        </div>
                        <div className="flex-1 min-w-[105px] text-right text-slate-700 text-sm font-bold font-['Liberation_Mono'] tracking-tight pr-2">
                          {formatRupiah(gajiPokok(item))}
                        </div>
                        <div className="flex-1 min-w-[105px] text-right text-slate-600 text-sm font-medium font-['Liberation_Mono'] tracking-tight pr-2">
                          {formatRupiah(tunjangan(item))}
                        </div>
                        <div className="flex-1 min-w-[105px] text-right text-slate-700 text-sm font-bold font-['Liberation_Mono'] tracking-tight pr-2">
                          {formatRupiah(Number(item.total_potongan))}
                        </div>
                        <div className="flex-1 min-w-[105px] text-right text-emerald-600 text-sm font-bold font-['Liberation_Mono'] tracking-tight pr-4">
                          {formatRupiah(Number(item.total_netto))}
                        </div>
                        <div className="w-28 shrink-0 flex justify-center">
                          {isAdj ? (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-md text-[10px] font-black uppercase leading-tight">Adjustment</span>
                          ) : (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-black uppercase leading-tight">Normal</span>
                          )}
                        </div>
                        <div className="w-8 shrink-0 flex justify-center text-slate-400">
                          <span className="material-icons-round text-[18px] transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}>chevron_right</span>
                        </div>
                      </div>

                      {/* Expanded */}
                      {isExpanded && (
                        <div className="w-full bg-slate-50/80 border-b border-slate-200 px-6 py-6 animate-in slide-in-from-top-1 duration-150">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Col 1: Pendapatan */}
                            <div className="flex flex-col gap-3">
                              <h4 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2 border-b border-slate-200 pb-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block shrink-0"></span> Pendapatan
                              </h4>
                              <div className="flex flex-col gap-1.5">
                                {penerimaan.length === 0 ? (
                                  <span className="text-xs text-slate-400 italic">Tidak ada komponen penerimaan.</span>
                                ) : penerimaan.map((k: any) => (
                                  <div key={k.id} className="flex justify-between items-center text-sm font-['Public_Sans'] gap-2">
                                    <span className="text-slate-700 truncate flex-1" title={k.nama_komponen}>{k.nama_komponen}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="text-xs text-slate-400">Rp</span>
                                      <input
                                        type="number"
                                        defaultValue={Number(k.nominal)}
                                        onClick={e => e.stopPropagation()}
                                        onChange={e => setLocalAdj(prev => ({
                                          ...prev,
                                          [item.id]: { ...(prev[item.id] || {}), [k.komponen_id]: e.target.value }
                                        }))}
                                        className="w-28 text-right px-2 py-1 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 font-['Liberation_Mono'] text-slate-800"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {penerimaan.length > 0 && (
                                <div className="flex justify-between items-center text-sm font-bold border-t border-slate-200 pt-2">
                                  <span className="text-slate-700">Total Pendapatan</span>
                                  <span className="font-['Liberation_Mono'] text-slate-800">{formatRupiah(Number(item.total_penerimaan))}</span>
                                </div>
                              )}
                            </div>

                            {/* Col 2: Potongan */}
                            <div className="flex flex-col gap-3">
                              <h4 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2 border-b border-slate-200 pb-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0"></span> Potongan (Pegawai)
                              </h4>
                              <div className="flex flex-col gap-1.5">
                                {potongan.length === 0 ? (
                                  <span className="text-xs text-slate-400 italic">Tidak ada potongan.</span>
                                ) : potongan.map((k: any) => (
                                  <div key={k.id} className="flex justify-between items-center text-sm font-['Public_Sans']">
                                    <span className="text-slate-700 truncate pr-4" title={k.nama_komponen}>{k.nama_komponen}</span>
                                    <span className="text-slate-700 font-bold font-['Liberation_Mono'] shrink-0">- {formatRupiah(Number(k.nominal))}</span>
                                  </div>
                                ))}
                              </div>
                              {potongan.length > 0 && (
                                <div className="flex justify-between items-center text-sm font-bold border-t border-slate-200 pt-2">
                                  <span className="text-slate-700">Total Potongan</span>
                                  <span className="font-['Liberation_Mono'] text-slate-700">- {formatRupiah(Number(item.total_potongan))}</span>
                                </div>
                              )}
                              {bebanGereja.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-dashed border-slate-200">
                                  <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">Beban Gereja (tidak dipotong)</p>
                                  {bebanGereja.map((k: any) => (
                                    <div key={k.id} className="flex justify-between items-center text-xs font-['Public_Sans']">
                                      <span className="text-slate-500 truncate pr-2">{k.nama_komponen}</span>
                                      <span className="text-purple-600 font-bold font-['Liberation_Mono']">{formatRupiah(Number(k.nominal))}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Col 3: Ringkasan */}
                            <div className="flex flex-col gap-3">
                              <h4 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2 border-b border-slate-200 pb-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0"></span> Ringkasan
                              </h4>
                              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
                                <div className="flex justify-between text-sm font-['Public_Sans']">
                                  <span className="text-slate-500">Bruto</span>
                                  <span className="text-slate-700 font-bold font-['Liberation_Mono']">{formatRupiah(Number(item.total_penerimaan))}</span>
                                </div>
                                <div className="flex justify-between text-sm font-['Public_Sans']">
                                  <span className="text-slate-500">Potongan</span>
                                  <span className="text-slate-700 font-bold font-['Liberation_Mono']">- {formatRupiah(Number(item.total_potongan))}</span>
                                </div>
                                <div className="w-full h-px bg-slate-100 my-1"></div>
                                <div className="flex justify-between text-base font-bold">
                                  <span className="text-slate-900">Netto</span>
                                  <span className="text-emerald-600 font-['Liberation_Mono']">{formatRupiah(Number(item.total_netto))}</span>
                                </div>
                                {totalBG > 0 && (
                                  <>
                                    <div className="w-full h-px border-t border-dashed border-slate-200 my-1"></div>
                                    <div className="flex justify-between text-xs font-['Public_Sans']">
                                      <span className="text-slate-400">+ Beban Gereja (BPJS)</span>
                                      <span className="text-purple-600 font-bold font-['Liberation_Mono']">{formatRupiah(totalBG)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-bold text-slate-600">
                                      <span>Total Cost Unit</span>
                                      <span className="font-['Liberation_Mono']">{formatRupiah(Number(item.total_netto) + totalBG)}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                              <div className="flex gap-2 mt-auto">
                                <button
                                  onClick={e => { e.stopPropagation(); alert('Preview slip akan tersedia setelah finalisasi.'); }}
                                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1 font-['Public_Sans']"
                                >
                                  <span className="material-icons-round text-[14px]">print</span> Preview Slip
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); handleSaveAdj(item); }}
                                  disabled={savingId === item.id}
                                  className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-800 rounded-lg text-xs font-bold text-white transition-colors flex items-center justify-center gap-1 font-['Public_Sans'] disabled:opacity-60"
                                >
                                  {savingId === item.id ? (
                                    <span className="material-icons-round text-[14px] animate-spin">sync</span>
                                  ) : (
                                    <span className="material-icons-round text-[14px]">save</span>
                                  )}
                                  Simpan Adj.
                                </button>
                              </div>
                            </div>

                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Table Footer */}
        {!loading && data.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <span className="text-slate-400 text-xs font-['Public_Sans']">{filtered.length} dari {data.length} pegawai</span>
            <div className="flex gap-6">
              <span className="text-slate-500 text-xs font-['Public_Sans']">Total Netto: <strong className="font-['Liberation_Mono'] text-slate-700">{formatRupiah(totalNetto)}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="w-full flex justify-between items-center pt-6 border-t border-slate-100">
        <button onClick={onPrev} className="px-6 py-2.5 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-colors flex items-center gap-2 font-['Public_Sans']">
          <span className="material-icons-round text-[18px]">arrow_back</span> Kembali ke Setup
        </button>
        <button onClick={onNext} className="px-6 py-2.5 bg-blue-600 rounded-lg text-white font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-600/20 font-['Public_Sans']">
          Lanjut ke Finalisasi <span className="material-icons-round text-[18px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
