'use client';

import { useState, useEffect, useRef } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';

export default function PendaftaranJemaatPage() {
  const { showLoader, hideLoader } = useLoader();
  const [userData, setUserData] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'menunggu' | 'disetujui' | 'ditolak'>('menunggu');
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionState, setActionState] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [catatanTolak, setCatatanTolak] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const hasPermission = (key: string) => userData?.is_super_admin || userData?.permissions?.includes(key);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      showLoader();
      try {
        const res = await fetch('/api/auth/me');
        if (!cancelled && res.ok) {
          const d = await res.json();
          setUserData(d);
          if (d.is_super_admin || d.permissions?.includes('jemaat_create')) {
            setHasAccess(true);
          } else {
            setHasAccess(false);
          }
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) hideLoader();
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const fetchData = async (status: string) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const res = await fetch(`/api/pendaftaran-jemaat?status=${status}&limit=100`, { signal: abortRef.current.signal });
      const json = await res.json();
      if (json.success) { setData(json.data); setTotal(json.total); }
    } catch (e: any) {
      if (e.name !== 'AbortError') console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess) fetchData(activeTab);
  }, [hasAccess, activeTab]);

  const fetchDetail = async (id: number) => {
    setDetailLoading(true);
    setActionState({ type: 'idle', message: '' });
    setShowRejectInput(false);
    setCatatanTolak('');
    try {
      const res = await fetch(`/api/pendaftaran-jemaat/${id}`);
      const json = await res.json();
      if (json.success) setSelectedItem(json.data);
    } catch { /* ignore */ } finally {
      setDetailLoading(false);
    }
  };

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selectedItem) return;
    if (action === 'reject' && !catatanTolak.trim()) {
      setShowRejectInput(true);
      return;
    }
    setActionState({ type: 'loading', message: '' });
    try {
      const res = await fetch(`/api/pendaftaran-jemaat/${selectedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, catatan: action === 'reject' ? catatanTolak.trim() : undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setActionState({ type: 'success', message: json.message });
        setTimeout(() => {
          setSelectedItem(null);
          setActionState({ type: 'idle', message: '' });
          fetchData(activeTab);
        }, 2000);
      } else {
        setActionState({ type: 'error', message: json.message || 'Gagal memproses' });
      }
    } catch {
      setActionState({ type: 'error', message: 'Koneksi error' });
    }
  };

  const tabCls = (tab: string) => `px-4 py-2.5 text-sm font-bold rounded-lg transition-all ${
    activeTab === tab ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
  }`;

  const statusBadge = (status: string) => {
    if (status === 'menunggu') return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">⏳ Menunggu</span>;
    if (status === 'disetujui') return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✅ Disetujui</span>;
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">❌ Ditolak</span>;
  };

  if (hasAccess === null) return (
    <div className="w-full py-20 flex items-center justify-center text-slate-400">
      <span className="material-icons-round text-4xl animate-spin">autorenew</span>
    </div>
  );

  if (!hasAccess) return (
    <div className="w-full py-20 flex flex-col items-center justify-center text-slate-500 gap-4">
      <span className="material-icons-round text-6xl text-rose-300">gpp_bad</span>
      <h2 className="text-xl font-bold text-slate-700">Akses Ditolak</h2>
      <p className="text-sm">Anda tidak memiliki izin untuk melihat pendaftaran jemaat.</p>
    </div>
  );

  return (
    <div className="w-full flex flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-slate-900 text-3xl font-black">Pendaftaran Jemaat Mandiri</h1>
        <p className="text-slate-500 text-base">Tinjau dan setujui pendaftaran dari jemaat yang mendaftar sendiri melalui halaman publik.</p>
      </div>

      {/* Tabs + Count */}
      <div className="flex items-center gap-2 bg-white rounded-xl p-1.5 border border-slate-200 shadow-sm w-fit">
        {(['menunggu', 'disetujui', 'ditolak'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={tabCls(tab)}>
            {tab === 'menunggu' ? '⏳ Menunggu' : tab === 'disetujui' ? '✅ Disetujui' : '❌ Ditolak'}
            {tab === activeTab && total > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-xs">{total}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center text-slate-400">
            <span className="material-icons-round animate-spin text-3xl">autorenew</span>
          </div>
        ) : data.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
            <span className="material-icons-round text-5xl">how_to_reg</span>
            <p className="text-sm font-medium">Tidak ada pendaftaran dengan status &quot;{activeTab}&quot;</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Pendaftar</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Satelit</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Kontak</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tgl Daftar</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                          {item.foto_url ? (
                            <img src={item.foto_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="material-icons-round text-slate-300 text-[24px] w-full h-full flex items-center justify-center">person</span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 text-sm">{item.nama_lengkap}</div>
                          <div className="text-xs text-slate-400">{item.jenis_kelamin} {item.tanggal_lahir ? `· ${new Date(item.tanggal_lahir).toLocaleDateString('id-ID')}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700 font-medium">{item.nama_satelit}</span>
                      <div className="text-xs text-slate-400">{item.kota}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-700">{item.no_hp || item.email || <span className="text-slate-400 italic">via username</span>}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">{new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </td>
                    <td className="px-4 py-3">{statusBadge(item.status)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => fetchDetail(item.id)}
                        className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        Lihat Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Detail Pendaftaran</h3>
                <p className="text-xs text-slate-500 mt-0.5">ID #{selectedItem.id} · Daftar {new Date(selectedItem.created_at).toLocaleDateString('id-ID')}</p>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <span className="material-icons-round text-slate-500">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {detailLoading ? (
                <div className="py-10 flex items-center justify-center">
                  <span className="material-icons-round animate-spin text-slate-400">autorenew</span>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {/* Foto + Nama */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0">
                      {selectedItem.foto_url ? (
                        <img src={selectedItem.foto_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-icons-round text-slate-300 text-[36px] w-full h-full flex items-center justify-center">person</span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-900">{selectedItem.nama_lengkap}</h4>
                      <p className="text-sm text-slate-500">{selectedItem.jenis_kelamin} · {selectedItem.nama_satelit}</p>
                      <div className="mt-1">{statusBadge(selectedItem.status)}</div>
                    </div>
                  </div>

                  {/* Info Grid */}
                  {[
                    ['Tanggal Lahir', selectedItem.tanggal_lahir ? new Date(selectedItem.tanggal_lahir).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'],
                    ['Kota Lahir', selectedItem.tempat_lahir || '-'],
                    ['Kota Tinggal', selectedItem.kota || '-'],
                    ['Alamat', selectedItem.alamat || '-'],
                    ['Pekerjaan', selectedItem.pekerjaan || '-'],
                    ['Status Baptis', selectedItem.status_baptis ? 'Sudah Baptis' : 'Belum Baptis'],
                    ['Status Pernikahan', selectedItem.status_pernikahan || '-'],
                    ['Keaktifan', selectedItem.status_jemaat || '-'],
                    ['No. HP', selectedItem.no_hp || '-'],
                    ['Email', selectedItem.email || '-'],
                    ['Username', selectedItem.username || '-'],
                    ['Ayah', selectedItem.ayah_nama || '-'],
                    ['Ibu', selectedItem.ibu_nama || '-'],
                    ['Pasangan', selectedItem.pasangan_nama || '-'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-start py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-500 w-36 flex-shrink-0">{label}</span>
                      <span className="text-sm font-medium text-slate-800 text-right flex-1">{value}</span>
                    </div>
                  ))}

                  {/* Anak */}
                  {Array.isArray(selectedItem.anak) && selectedItem.anak.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Anak</p>
                      {selectedItem.anak.map((a: any, i: number) => (
                        <div key={i} className="text-sm text-slate-700 py-1">• {a.nama_anak || '-'}</div>
                      ))}
                    </div>
                  )}

                  {/* Saudara */}
                  {Array.isArray(selectedItem.saudara) && selectedItem.saudara.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Saudara Kandung</p>
                      {selectedItem.saudara.map((s: any, i: number) => (
                        <div key={i} className="text-sm text-slate-700 py-1">• {s.nama_saudara || '-'}</div>
                      ))}
                    </div>
                  )}

                  {/* Catatan review (jika sudah diproses) */}
                  {selectedItem.catatan_review && (
                    <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                      <p className="text-xs font-bold text-red-500 mb-1">Catatan Penolakan</p>
                      <p className="text-sm text-red-700">{selectedItem.catatan_review}</p>
                    </div>
                  )}

                  {/* Action state feedback */}
                  {actionState.type === 'success' && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-medium">
                      ✅ {actionState.message}
                    </div>
                  )}
                  {actionState.type === 'error' && (
                    <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-700 text-sm font-medium">
                      ❌ {actionState.message}
                    </div>
                  )}

                  {/* Reject input */}
                  {showRejectInput && selectedItem.status === 'menunggu' && (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-slate-700">Alasan Penolakan <span className="text-rose-500">*</span></label>
                      <textarea
                        value={catatanTolak}
                        onChange={(e) => setCatatanTolak(e.target.value)}
                        rows={3}
                        placeholder="Tuliskan alasan penolakan..."
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 resize-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer — action buttons */}
            {selectedItem.status === 'menunggu' && actionState.type !== 'success' && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-3 flex-shrink-0">
                {actionState.type === 'loading' ? (
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <span className="material-icons-round animate-spin text-[18px]">sync</span> Memproses...
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleAction('approve')}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-icons-round text-[18px]">check_circle</span> Setujui
                    </button>
                    <button
                      onClick={() => {
                        if (showRejectInput && catatanTolak.trim()) {
                          handleAction('reject');
                        } else {
                          setShowRejectInput(true);
                        }
                      }}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-icons-round text-[18px]">cancel</span>
                      {showRejectInput && catatanTolak.trim() ? 'Konfirmasi Tolak' : 'Tolak'}
                    </button>
                    <button onClick={() => setSelectedItem(null)} className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors">
                      Tutup
                    </button>
                  </>
                )}
              </div>
            )}
            {(selectedItem.status !== 'menunggu' || actionState.type === 'success') && (
              <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
                <button onClick={() => setSelectedItem(null)} className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors">
                  Tutup
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
