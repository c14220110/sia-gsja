'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const getBulanName = (b: number) => ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][b-1] || '-';
const formatRupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
const getInitials = (name: string) => { const p = (name||'').trim().split(/\s+/); return p.length >= 2 ? (p[0][0]+p[1][0]).toUpperCase() : (name||'??').slice(0,2).toUpperCase(); };
const COLORS = ['bg-blue-500','bg-emerald-500','bg-violet-500','bg-amber-500','bg-rose-500','bg-indigo-500','bg-teal-500','bg-orange-500'];
const avatarColor = (name: string) => { let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))&0xff; return COLORS[h%COLORS.length]; };

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    'Draft': 'bg-slate-100 text-slate-600',
    'Menunggu Approval': 'bg-amber-100 text-amber-700',
    'Disetujui': 'bg-blue-100 text-blue-700',
    'Ditolak': 'bg-rose-100 text-rose-700',
    'Dibayar': 'bg-emerald-100 text-emerald-700',
  };
  return <span className={`px-3 py-1 rounded-full text-xs font-bold ${map[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>;
};

export default function DetailRunPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [runId, setRunId] = useState<string>('');
  const [summary, setSummary] = useState<any>(null);
  const [details, setDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success'|'error'; text: string } | null>(null);

  useEffect(() => {
    params.then(p => {
      setRunId(p.id);
      fetchAll(p.id);
    });
  }, []);

  const fetchAll = async (id: string) => {
    setLoading(true);
    try {
      const [sumRes, detRes] = await Promise.all([
        fetch(`/api/payroll/runs/${id}/summary`),
        fetch(`/api/payroll/runs/${id}/details`),
      ]);
      const sumData = await sumRes.json();
      const detData = await detRes.json();
      if (sumData.success) setSummary(sumData.data);
      if (detData.success) setDetails(detData.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleAjukanApproval = async () => {
    if (!confirm('Ajukan run ini untuk approval?')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/payroll/runs/${runId}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catatan_pembuat: '' }) });
      const r = await res.json();
      if (r.success) { setMsg({ type: 'success', text: 'Berhasil diajukan untuk approval.' }); fetchAll(runId); }
      else setMsg({ type: 'error', text: r.message || 'Gagal.' });
    } catch { setMsg({ type: 'error', text: 'Terjadi kesalahan koneksi.' }); }
    finally { setActionLoading(false); setTimeout(() => setMsg(null), 4000); }
  };

  if (loading) return (
    <div className="w-full flex flex-col gap-8 pb-10">
      <div className="w-full py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin"></div>
        <span className="text-sm font-['Public_Sans']">Memuat detail run...</span>
      </div>
    </div>
  );

  if (!summary) return (
    <div className="w-full flex flex-col gap-8 pb-10">
      <div className="w-full py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
        <span className="material-icons-round text-5xl text-slate-300">error_outline</span>
        <span className="text-sm font-['Public_Sans']">Data run tidak ditemukan.</span>
        <Link href="/pegawai/penggajian" className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg font-bold font-['Public_Sans']">← Kembali ke Daftar</Link>
      </div>
    </div>
  );

  const isDraft = summary.status === 'Draft';
  const isMenunggu = summary.status === 'Menunggu Approval';

  return (
    <div className="w-full flex flex-col gap-8 pb-10">

      {/* Breadcrumb */}
      <div className="inline-flex items-center gap-2 text-xs font-medium font-['Inter']">
        <Link href="/pegawai/penggajian" className="text-slate-500 hover:text-blue-600">Daftar Run Penggajian</Link>
        <span className="material-icons-round text-slate-400 text-[14px]">chevron_right</span>
        <span className="text-slate-700 font-bold">Detail Run</span>
      </div>

      {/* Header */}
      <div className="w-full flex justify-between items-start gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9">
              Detail Run — {getBulanName(summary.bulan)} {summary.tahun}
            </h1>
            <StatusBadge status={summary.status} />
          </div>
          <div className="text-slate-500 text-base font-medium font-['Inter']">{summary.nama_satelit} · Dibuat oleh {summary.nama_pembuat || 'Sistem'}</div>
        </div>
        <div className="flex gap-2 shrink-0">
          {isDraft && (
            <>
              <Link href={`/pegawai/penggajian/${runId}/edit`} className="px-4 py-2.5 border border-slate-300 rounded-lg text-slate-600 text-sm font-bold font-['Public_Sans'] hover:bg-slate-50 transition-colors flex items-center gap-2">
                <span className="material-icons-round text-[16px]">edit</span> Edit Setup
              </Link>
              <button onClick={handleAjukanApproval} disabled={actionLoading} className="px-5 py-2.5 bg-blue-600 rounded-lg text-white text-sm font-bold font-['Public_Sans'] hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-600/20 disabled:opacity-60">
                {actionLoading ? <span className="material-icons-round text-[16px] animate-spin">sync</span> : <span className="material-icons-round text-[16px]">send</span>}
                Ajukan Approval
              </button>
            </>
          )}
          {isMenunggu && (
            <span className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm font-bold font-['Public_Sans'] flex items-center gap-2">
              <span className="material-icons-round text-[16px]">pending_actions</span> Menunggu Approval Bendahara
            </span>
          )}
        </div>
      </div>

      {/* Action feedback */}
      {msg && (
        <div className={`px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-['Public_Sans'] ${msg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-700'}`}>
          <span className="material-icons-round text-[16px]">{msg.type === 'success' ? 'check_circle' : 'error_outline'}</span>
          {msg.text}
        </div>
      )}

      {/* Info Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
        {[
          { label: 'Periode', value: `${getBulanName(summary.bulan)} ${summary.tahun}` },
          { label: 'Unit Pelaksana', value: summary.nama_satelit || '—' },
          { label: 'RA Terhubung', value: summary.kode_ra || 'Belum di-link' },
          { label: 'Disiapkan Oleh', value: summary.nama_pembuat || 'Sistem' },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider font-['Public_Sans']">{label}</span>
            <span className="text-slate-900 font-bold font-['Public_Sans'] text-sm truncate" title={value}>{value}</span>
          </div>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { icon: 'group', color: 'bg-slate-500/10 text-slate-600', label: 'Total Pegawai', value: `${summary.jumlah_pegawai || 0} Orang` },
          { icon: 'trending_up', color: 'bg-blue-500/10 text-blue-600', label: 'Total Bruto', value: formatRupiah(Number(summary.total_bruto)) },
          { icon: 'remove_circle_outline', color: 'bg-amber-500/10 text-amber-600', label: 'Total Potongan', value: formatRupiah(Number(summary.total_potongan)) },
          { icon: 'payments', color: 'bg-emerald-500/10 text-emerald-600', label: 'Total Netto', value: formatRupiah(Number(summary.total_netto)) },
        ].map(({ icon, color, label, value }) => (
          <div key={label} className="p-5 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className={`w-12 h-12 ${color.split(' ')[0]} rounded-xl flex items-center justify-center shrink-0`}>
              <span className={`material-icons-round ${color.split(' ')[1]} text-2xl`}>{icon}</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider font-['Public_Sans']">{label}</span>
              <span className="text-slate-900 font-bold font-['Liberation_Mono'] text-sm mt-0.5 truncate">{value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Plafon RA */}
      {summary.sisa_plafon !== undefined && (
        <div className={`px-5 py-4 rounded-xl border flex items-center justify-between gap-4 ${(summary.sisa_plafon - summary.estimasi_penggunaan) < 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center gap-3">
            <span className={`material-icons-round ${(summary.sisa_plafon - summary.estimasi_penggunaan) < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>account_balance_wallet</span>
            <div className="flex flex-col">
              <span className={`text-xs font-bold uppercase tracking-wider ${(summary.sisa_plafon - summary.estimasi_penggunaan) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>Status Plafon RA</span>
              <span className={`text-sm font-['Public_Sans'] ${(summary.sisa_plafon - summary.estimasi_penggunaan) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>Sisa plafon setelah payroll: <strong className="font-['Liberation_Mono']">{formatRupiah(summary.sisa_plafon - summary.estimasi_penggunaan)}</strong></span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-xs font-['Public_Sans'] ${(summary.sisa_plafon - summary.estimasi_penggunaan) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>Estimasi penggunaan: <strong className="font-['Liberation_Mono']">{formatRupiah(summary.estimasi_penggunaan)}</strong></p>
          </div>
        </div>
      )}

      {/* Table Pegawai */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-slate-900 font-bold font-['Inter'] flex items-center gap-2">
            <span className="material-icons-round text-slate-500 text-[20px]">group</span>
            Detail Pegawai ({details.length} orang)
          </h2>
          {isDraft && <span className="text-xs text-slate-400 font-['Public_Sans'] italic">Mode Draft — klik baris untuk melihat detail komponen</span>}
        </div>

        <div className="w-full overflow-x-auto">
          <div className="min-w-[1000px] flex flex-col">
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4 gap-2">
              <div className="w-9 shrink-0"></div>
              <div className="w-52 shrink-0 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Nama Pegawai</div>
              <div className="w-36 shrink-0 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Jabatan</div>
              <div className="flex-1 min-w-[110px] text-right text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Gaji Pokok</div>
              <div className="flex-1 min-w-[110px] text-right text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Tunjangan</div>
              <div className="flex-1 min-w-[110px] text-right text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Potongan</div>
              <div className="flex-1 min-w-[110px] text-right text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider pr-4">Netto</div>
              <div className="w-8 shrink-0"></div>
            </div>

            {details.length === 0 ? (
              <div className="w-full py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                <span className="material-icons-round text-5xl text-slate-200">group_off</span>
                <span className="text-sm font-['Public_Sans']">Belum ada detail pegawai.</span>
              </div>
            ) : details.map((item) => {
              const isExp = expandedId === item.id;
              const penerimaan = (item.komponen || []).filter((k: any) => k.tipe === 'Penerimaan' && !k.is_employer_portion);
              const potongan = (item.komponen || []).filter((k: any) => k.tipe === 'Potongan' && !k.is_employer_portion);
              const bebanGereja = (item.komponen || []).filter((k: any) => k.is_employer_portion);
              const gpKomponen = penerimaan.find((k: any) => (k.nama_komponen||'').toLowerCase().includes('gaji'));
              const gpVal = gpKomponen ? Number(gpKomponen.nominal) : 0;
              const tunjanganVal = penerimaan.filter((k: any) => !(k.nama_komponen||'').toLowerCase().includes('gaji')).reduce((a: number, k: any) => a + Number(k.nominal), 0);
              const totalBG = bebanGereja.reduce((a: number, k: any) => a + Number(k.nominal), 0);
              // PPh21 info dari calculation_snapshot
              const pph21Komponen = (item.komponen || []).find((k: any) => (k.nama_komponen||'').toLowerCase().includes('pph'));
              const pph21Snap = pph21Komponen?.calculation_snapshot
                ? (typeof pph21Komponen.calculation_snapshot === 'string'
                    ? JSON.parse(pph21Komponen.calculation_snapshot)
                    : pph21Komponen.calculation_snapshot)
                : null;

              return (
                <React.Fragment key={item.id}>
                  <div className={`w-full flex items-center px-6 py-4 border-b gap-2 transition-colors cursor-pointer ${isExp ? 'bg-blue-50 border-blue-200' : 'border-slate-100 hover:bg-slate-50'}`} onClick={() => setExpandedId(isExp ? null : item.id)}>
                    <div className="w-9 shrink-0"><div className={`w-8 h-8 rounded-full ${avatarColor(item.nama_lengkap||'')} flex items-center justify-center text-white text-xs font-bold`}>{getInitials(item.nama_lengkap||'')}</div></div>
                    <div className="w-52 shrink-0 flex flex-col pr-2">
                      <span className="text-slate-900 text-sm font-bold font-['Public_Sans'] truncate">{item.nama_lengkap}</span>
                      <span className="text-slate-400 text-[11px] font-['Liberation_Mono'] truncate">{item.nik || '—'}</span>
                    </div>
                    <div className="w-36 shrink-0 pr-2"><span className="text-slate-600 text-sm font-medium font-['Public_Sans'] truncate block">{item.jabatan_snapshot || '—'}</span></div>
                    <div className="flex-1 min-w-[110px] text-right text-slate-700 text-sm font-bold font-['Liberation_Mono'] pr-2">{formatRupiah(gpVal)}</div>
                    <div className="flex-1 min-w-[110px] text-right text-slate-600 text-sm font-medium font-['Liberation_Mono'] pr-2">{formatRupiah(tunjanganVal)}</div>
                    <div className="flex-1 min-w-[110px] text-right text-slate-700 text-sm font-bold font-['Liberation_Mono'] pr-2">{formatRupiah(Number(item.total_potongan))}</div>
                    <div className="flex-1 min-w-[110px] text-right text-emerald-600 text-sm font-bold font-['Liberation_Mono'] pr-4">{formatRupiah(Number(item.total_netto))}</div>
                    <div className="w-8 shrink-0 text-slate-400"><span className="material-icons-round text-[18px] transition-transform duration-200" style={{ transform: isExp ? 'rotate(90deg)' : 'none' }}>chevron_right</span></div>
                  </div>

                  {isExp && (
                    <div className="w-full bg-slate-50/80 border-b border-slate-200 px-6 py-6 animate-in slide-in-from-top-1 duration-150">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="flex flex-col gap-2">
                          <h4 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2 border-b border-slate-200 pb-2"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> Pendapatan</h4>
                          {penerimaan.map((k: any) => (
                            <div key={k.id} className="flex justify-between text-sm font-['Public_Sans']">
                              <span className="text-slate-600 truncate pr-4">{k.nama_komponen}</span>
                              <span className="text-slate-800 font-bold font-['Liberation_Mono'] shrink-0">{formatRupiah(Number(k.nominal))}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2">
                            <span className="text-slate-700">Total</span>
                            <span className="font-['Liberation_Mono']">{formatRupiah(Number(item.total_penerimaan))}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <h4 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2 border-b border-slate-200 pb-2"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Potongan</h4>
                          {potongan.length === 0 ? <span className="text-xs text-slate-400 italic">Tidak ada potongan.</span> : potongan.map((k: any) => (
                            <div key={k.id} className="flex justify-between text-sm font-['Public_Sans']">
                              <span className="text-slate-600 truncate pr-4">{k.nama_komponen}</span>
                              <span className="text-slate-700 font-bold font-['Liberation_Mono'] shrink-0">- {formatRupiah(Number(k.nominal))}</span>
                            </div>
                          ))}
                          {bebanGereja.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-dashed border-slate-200">
                              <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1">Beban Gereja (tidak dipotong)</p>
                              {bebanGereja.map((k: any) => (
                                <div key={k.id} className="flex justify-between text-xs font-['Public_Sans']">
                                  <span className="text-slate-500 truncate pr-2">{k.nama_komponen}</span>
                                  <span className="text-purple-600 font-bold font-['Liberation_Mono']">{formatRupiah(Number(k.nominal))}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <h4 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2 border-b border-slate-200 pb-2"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Ringkasan</h4>
                          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
                            <div className="flex justify-between text-sm font-['Public_Sans']"><span className="text-slate-500">Bruto</span><span className="font-bold font-['Liberation_Mono'] text-slate-700">{formatRupiah(Number(item.total_penerimaan))}</span></div>
                            <div className="flex justify-between text-sm font-['Public_Sans']"><span className="text-slate-500">Potongan</span><span className="font-bold font-['Liberation_Mono'] text-slate-700">- {formatRupiah(Number(item.total_potongan))}</span></div>
                            <div className="w-full h-px bg-slate-100 my-1"></div>
                            <div className="flex justify-between text-base font-bold"><span className="text-slate-900">Netto</span><span className="text-emerald-600 font-['Liberation_Mono']">{formatRupiah(Number(item.total_netto))}</span></div>
                            {totalBG > 0 && (
                              <>
                                <div className="w-full h-px border-t border-dashed border-slate-200 my-1"></div>
                                <div className="flex justify-between text-xs text-slate-500 font-['Public_Sans']"><span>+ Beban Gereja (BPJS)</span><span className="text-purple-600 font-bold font-['Liberation_Mono']">{formatRupiah(totalBG)}</span></div>
                                <div className="flex justify-between text-xs font-bold text-slate-700"><span>Total Cost Unit</span><span className="font-['Liberation_Mono']">{formatRupiah(Number(item.total_netto)+totalBG)}</span></div>
                              </>
                            )}
                            {/* PPh21 TER Info Box */}
                            {pph21Snap && pph21Snap.source === 'pph21_ter' && (
                              <>
                                <div className="w-full h-px border-t border-dashed border-indigo-100 my-1"></div>
                                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 flex flex-col gap-1">
                                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                                    <span className="material-icons-round text-[12px]">receipt_long</span>
                                    Info Pajak PPh 21
                                  </p>
                                  <div className="flex justify-between text-xs font-['Public_Sans']">
                                    <span className="text-indigo-500">Status PTKP</span>
                                    <span className="font-bold text-indigo-700">{pph21Snap.statusPtkp}</span>
                                  </div>
                                  <div className="flex justify-between text-xs font-['Public_Sans']">
                                    <span className="text-indigo-500">Kategori TER</span>
                                    <span className="font-bold text-indigo-700">Kategori {pph21Snap.kategoriTER}</span>
                                  </div>
                                  <div className="flex justify-between text-xs font-['Public_Sans']">
                                    <span className="text-indigo-500">Tarif Efektif</span>
                                    <span className="font-bold text-indigo-700">{((pph21Snap.tarif || 0) * 100).toFixed(2)}%</span>
                                  </div>
                                  <div className="flex justify-between text-xs font-['Public_Sans']">
                                    <span className="text-indigo-500">Bruto Kena Pajak</span>
                                    <span className="font-bold font-['Liberation_Mono'] text-indigo-700">{formatRupiah(pph21Snap.bruto || 0)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs font-bold border-t border-indigo-100 pt-1 mt-0.5">
                                    <span className="text-indigo-700">PPh 21 Dipotong</span>
                                    <span className="font-['Liberation_Mono'] text-indigo-800">- {formatRupiah(Number(pph21Komponen.nominal))}</span>
                                  </div>
                                </div>
                              </>
                            )}
                            {/* Jika PPh21 tidak aktif */}
                            {!pph21Snap && item.pph21_method_snapshot !== 'Ditanggung Gereja' && (
                              <>
                                <div className="w-full h-px border-t border-dashed border-slate-100 my-1"></div>
                                <p className="text-[10px] text-slate-400 italic font-['Public_Sans'] flex items-center gap-1">
                                  <span className="material-icons-round text-[11px]">info</span>
                                  PPh 21: tidak aktif di template jabatan ini
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {details.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <span className="text-slate-400 text-xs font-['Public_Sans']">{details.length} pegawai diproses</span>
                <span className="text-slate-500 text-xs font-['Public_Sans']">Total Netto: <strong className="font-['Liberation_Mono'] text-emerald-600">{formatRupiah(Number(summary.total_netto))}</strong></span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Action Bar */}
      <div className="w-full flex justify-between items-center pt-4 border-t border-slate-100">
        <Link href="/pegawai/penggajian" className="px-6 py-2.5 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-colors flex items-center gap-2 font-['Public_Sans']">
          <span className="material-icons-round text-[18px]">arrow_back</span> Kembali ke Daftar
        </Link>
        {isDraft && (
          <div className="flex gap-3">
            <Link href={`/pegawai/penggajian/${runId}/edit`} className="px-5 py-2.5 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm font-['Public_Sans']">
              <span className="material-icons-round text-[16px]">edit</span> Edit Setup
            </Link>
            <button onClick={handleAjukanApproval} disabled={actionLoading} className="px-6 py-2.5 bg-blue-600 rounded-lg text-white font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-600/20 text-sm font-['Public_Sans'] disabled:opacity-60">
              {actionLoading ? <span className="material-icons-round text-[16px] animate-spin">sync</span> : <span className="material-icons-round text-[16px]">send</span>}
              Ajukan Approval
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
