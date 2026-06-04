'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useLoader } from '@/components/ui/GlobalLoader';

type AuditAction = 'CREATE' | 'UPDATE' | 'DEACTIVATE';
type LogType = 'jemaat' | 'pelayan' | 'pengurus' | 'anggaran';

interface AuditLogEntry {
  id:             number;
  entity_id:      number;
  nama_entity:    string;
  aksi:           AuditAction;
  user_id:        number;
  nama_pelaksana: string;
  role_id:        number;
  nama_role:      string;
  satelit_id:     number;
  nama_satelit:   string;
  keterangan:     string | null;
  created_at:     string;
}

interface AnggaranAuditLogEntry {
  id:              number;
  anggaran_id:     string;
  kode_dokumen:    string;
  aksi:            string;
  status_sebelum:  string | null;
  status_sesudah:  string;
  user_id:         number;
  nama_pelaksana:  string;
  role_id:         number;
  nama_role:       string;
  satelit_id:      number;
  nama_satelit:    string;
  keterangan:      string | null;
  created_at:      string;
}

const ACTION_CONFIG: Record<AuditAction, { label: string; bg: string; text: string; icon: string }> = {
  CREATE:     { label: 'CREATE',     bg: 'bg-emerald-100', text: 'text-emerald-700', icon: 'person_add'  },
  UPDATE:     { label: 'UPDATE',     bg: 'bg-blue-100',    text: 'text-blue-700',    icon: 'edit'        },
  DEACTIVATE: { label: 'DEACTIVATE', bg: 'bg-rose-100',    text: 'text-rose-700',    icon: 'person_off'  },
};

const ANGGARAN_ACTION_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  'Dibuat':                    { label: 'Dibuat',        bg: 'bg-emerald-100', text: 'text-emerald-700', icon: 'add_circle'           },
  'Diajukan':                  { label: 'Diajukan',      bg: 'bg-amber-100',   text: 'text-amber-700',   icon: 'send'                 },
  'Disetujui Penuh':           { label: 'Disetujui',     bg: 'bg-green-100',   text: 'text-green-700',   icon: 'check_circle'         },
  'Disetujui Sebagian':        { label: 'Sebagian',      bg: 'bg-teal-100',    text: 'text-teal-700',    icon: 'rule'                 },
  'Ditolak':                   { label: 'Ditolak',       bg: 'bg-rose-100',    text: 'text-rose-700',    icon: 'cancel'               },
  'Revisi':                    { label: 'Revisi',        bg: 'bg-orange-100',  text: 'text-orange-700',  icon: 'replay'               },
  'Direvisi & Diajukan Ulang': { label: 'Resubmit',      bg: 'bg-purple-100',  text: 'text-purple-700',  icon: 'published_with_changes' },
  'Dihapus':                   { label: 'Dihapus',       bg: 'bg-red-100',     text: 'text-red-700',     icon: 'delete'               },
};

const LOG_TYPE_CONFIG: Record<LogType, { label: string; icon: string; entityLabel: string; detailPath: string }> = {
  jemaat:   { label: 'Data Jemaat',   icon: 'group',              entityLabel: 'Jemaat',    detailPath: '/jemaat'  },
  pelayan:  { label: 'Data Pelayan',  icon: 'volunteer_activism',  entityLabel: 'Pelayan',   detailPath: '/jemaat'  },
  pengurus: { label: 'Data Pengurus', icon: 'admin_panel_settings', entityLabel: 'Pengurus',  detailPath: '/pengurus' },
  anggaran: { label: 'Anggaran (RA)', icon: 'account_balance',     entityLabel: 'Anggaran',  detailPath: '/anggaran/rancangan' },
};

const ANGGARAN_AKSI_OPTIONS = [
  'Dibuat', 'Diajukan', 'Disetujui Penuh', 'Disetujui Sebagian',
  'Ditolak', 'Revisi', 'Direvisi & Diajukan Ulang', 'Dihapus',
];

export default function AuditLogPage() {
  const { showLoader, hideLoader } = useLoader();
  const [data,             setData]             = useState<AuditLogEntry[]>([]);
  const [anggaranData,     setAnggaranData]     = useState<AnggaranAuditLogEntry[]>([]);
  const [total,            setTotal]            = useState(0);
  const [loading,          setLoading]          = useState(true);
  const [initDone,         setInitDone]         = useState(false); // true after first fetch
  const [currentPage,      setCurrentPage]      = useState(1);
  const limit = 15;

  const [logType,    setLogType]    = useState<LogType>('jemaat');
  const [search,     setSearch]     = useState('');
  const [filterAksi, setFilterAksi] = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const isAnggaran = logType === 'anggaran';

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    // No showLoader() here — only used on first-time page mount
    try {
      const params = new URLSearchParams({
        log_type: logType,
        limit:    limit.toString(),
        offset:   ((currentPage - 1) * limit).toString(),
      });
      if (filterAksi) params.set('aksi',      filterAksi);
      if (dateFrom)   params.set('date_from', dateFrom);
      if (dateTo)     params.set('date_to',   dateTo);
      if (search)     params.set('search',    search);

      const res  = await fetch(`/api/audit-log?${params}`);
      const json = await res.json();
      if (json.success) {
        if (isAnggaran) {
          setAnggaranData(json.data);
          setData([]);
        } else {
          setData(json.data);
          setAnggaranData([]);
        }
        setTotal(json.meta.total);
      } else {
        setData([]);
        setAnggaranData([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('[AuditLog] fetch error:', err);
    } finally {
      setLoading(false);
      if (!initDone) { hideLoader(); setInitDone(true); }
    }
  }, [currentPage, logType, filterAksi, dateFrom, dateTo, search, initDone, isAnggaran]);

  // Show Lottie overlay ONLY on first page mount
  useEffect(() => { showLoader(); }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Reset to page 1 when any filter or log type changes
  useEffect(() => { setCurrentPage(1); }, [logType, filterAksi, dateFrom, dateTo, search]);

  // Reset aksi filter when switching between entity/anggaran (different action sets)
  useEffect(() => { setFilterAksi(''); }, [logType]);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  const entityConfig = LOG_TYPE_CONFIG[logType];

  // ── Stat card counts (for the current page) ────────────────────────────────
  const entityStatActions = ['CREATE', 'UPDATE', 'DEACTIVATE'] as AuditAction[];

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Audit Log</h1>
        <p className="text-slate-500 text-base font-medium font-sans leading-6">Riwayat seluruh aksi berdasarkan kategori data</p>
      </div>

      {/* Log Type Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(Object.entries(LOG_TYPE_CONFIG) as [LogType, typeof LOG_TYPE_CONFIG[LogType]][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setLogType(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold font-sans transition-all ${
              logType === key
                ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="material-icons-round text-[20px]">{cfg.icon}</span>
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Action Stat Cards — different sets for entity vs anggaran */}
      {!isAnggaran ? (
        <div className="grid grid-cols-3 gap-4">
          {entityStatActions.map(aksi => {
            const cfg   = ACTION_CONFIG[aksi];
            const count = data.filter(d => d.aksi === aksi).length;
            return (
              <button
                key={aksi}
                onClick={() => setFilterAksi(filterAksi === aksi ? '' : aksi)}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                  filterAksi === aksi
                    ? `${cfg.bg} border-current ring-2 ring-offset-1 ${cfg.text}`
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className={`material-icons-round text-[28px] ${filterAksi === aksi ? cfg.text : 'text-slate-400'}`}>{cfg.icon}</span>
                <div>
                  <div className="text-xs text-slate-500 font-sans font-bold uppercase tracking-wide">{cfg.label}</div>
                  <div className="text-lg font-bold text-slate-800 font-sans">
                    {loading ? '—' : count}
                    {!loading && total > limit && (
                      <span className="text-xs font-normal text-slate-400 ml-1">di halaman ini</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['Dibuat', 'Diajukan', 'Disetujui Penuh', 'Ditolak'].map(aksi => {
            const cfg   = ANGGARAN_ACTION_CONFIG[aksi] ?? { label: aksi, bg: 'bg-gray-100', text: 'text-gray-700', icon: 'info' };
            const count = anggaranData.filter(d => d.aksi === aksi).length;
            return (
              <button
                key={aksi}
                onClick={() => setFilterAksi(filterAksi === aksi ? '' : aksi)}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                  filterAksi === aksi
                    ? `${cfg.bg} border-current ring-2 ring-offset-1 ${cfg.text}`
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className={`material-icons-round text-[24px] ${filterAksi === aksi ? cfg.text : 'text-slate-400'}`}>{cfg.icon}</span>
                <div>
                  <div className="text-xs text-slate-500 font-sans font-bold uppercase tracking-wide">{cfg.label}</div>
                  <div className="text-lg font-bold text-slate-800 font-sans">
                    {loading ? '—' : count}
                    {!loading && total > limit && (
                      <span className="text-xs font-normal text-slate-400 ml-1">di halaman ini</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter Options */}
      <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-sm">
        
        {/* Search Bar */}
        <div className="flex-1 min-w-[300px] relative flex items-center">
          <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
          <input
            type="text"
            placeholder={isAnggaran ? 'Cari kode dokumen, pelaksana, atau keterangan...' : `Cari nama ${entityConfig.entityLabel.toLowerCase()} atau pelaksana...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm"
          />
        </div>

        {/* Action Dropdown */}
        <div className="relative min-w-[200px]">
          <select
            value={filterAksi}
            onChange={e => setFilterAksi(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
          >
            <option value="">Semua Aksi</option>
            {isAnggaran
              ? ANGGARAN_AKSI_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)
              : <>
                  <option value="CREATE">CREATE</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DEACTIVATE">DEACTIVATE</option>
                </>
            }
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <input 
            type="date" 
            value={dateFrom} 
            onChange={e => setDateFrom(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
            title="Tanggal mulai"
          />
          <span className="text-slate-400 font-bold">-</span>
          <input 
            type="date" 
            value={dateTo} 
            onChange={e => setDateTo(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
            title="Tanggal akhir"
          />
        </div>

        {/* Reset Button */}
        {(filterAksi || dateFrom || dateTo || search) && (
          <button
            onClick={() => { setFilterAksi(''); setDateFrom(''); setDateTo(''); setSearch(''); }}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg flex items-center gap-2 transition-colors hover:bg-slate-50 text-slate-600 group"
          >
            <span className="material-icons-round text-[20px] text-slate-500 group-hover:text-rose-500 transition-colors">filter_alt_off</span>
            <span className="text-sm font-medium font-sans group-hover:text-slate-800 transition-colors">Reset</span>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="w-full overflow-x-auto">
          <div className={`${isAnggaran ? 'min-w-[1200px]' : 'min-w-[1050px]'} flex flex-col`}>
            {/* Header */}
            {isAnggaran ? (
              <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4 gap-4">
                <div className="w-40 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Waktu</div>
                <div className="w-32 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Kode RA</div>
                <div className="w-28 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Aksi</div>
                <div className="w-64 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Transisi Status</div>
                <div className="w-28 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Pelaksana</div>
                <div className="w-32 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Role</div>
                <div className="w-28 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Satelit</div>
                <div className="flex-1 min-w-[180px] text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Keterangan</div>
              </div>
            ) : (
              <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4 gap-4">
                <div className="w-40 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Waktu</div>
                <div className="w-44 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">{entityConfig.entityLabel}</div>
                <div className="w-28 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Aksi</div>
                <div className="w-28 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Pelaksana</div>
                <div className="w-36 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Role</div>
                <div className="w-28 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Satelit</div>
                <div className="flex-1 min-w-[180px] text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Keterangan</div>
              </div>
            )}

            {/* Body */}
            {loading ? (
              <div className="w-full py-16 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
              </div>
            ) : isAnggaran ? (
              anggaranData.length === 0 ? (
                <div className="w-full py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <span className="material-icons-round text-5xl text-slate-300">receipt_long</span>
                  <p className="text-sm font-sans">Belum ada audit log anggaran.</p>
                </div>
              ) : (
                anggaranData.map(entry => {
                  const cfg = ANGGARAN_ACTION_CONFIG[entry.aksi] ?? { label: entry.aksi, bg: 'bg-gray-100', text: 'text-gray-700', icon: 'info' };
                  return (
                    <div key={entry.id} className="w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors gap-4">
                      <div className="w-40 shrink-0 text-slate-500 text-xs font-sans">{formatDate(entry.created_at)}</div>
                      <div className="w-32 shrink-0">
                        <Link
                          href={`${entityConfig.detailPath}/${entry.anggaran_id}`}
                          className="text-slate-800 text-sm font-semibold font-sans hover:text-slate-600 hover:underline truncate block"
                        >
                          {entry.kode_dokumen}
                        </Link>
                      </div>
                      <div className="w-36 shrink-0">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-sans uppercase ${cfg.bg} ${cfg.text}`}>
                          <span className="material-icons-round text-[14px]">{cfg.icon}</span>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="w-64 shrink-0">
                        <div className="flex items-center gap-1.5 text-xs font-sans" title={entry.status_sebelum ? `${entry.status_sebelum} → ${entry.status_sesudah}` : entry.status_sesudah}>
                          {entry.status_sebelum ? (
                            <>
                              <span className="text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded whitespace-nowrap">{entry.status_sebelum}</span>
                              <span className="material-icons-round text-[14px] text-slate-300 shrink-0">arrow_forward</span>
                              <span className="text-slate-700 font-semibold bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap">{entry.status_sesudah}</span>
                            </>
                          ) : (
                            <span className="text-slate-700 font-semibold bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap">{entry.status_sesudah}</span>
                          )}
                        </div>
                      </div>
                      <div className="w-28 shrink-0 text-slate-700 text-sm font-sans truncate" title={entry.nama_pelaksana}>{entry.nama_pelaksana}</div>
                      <div className="w-32 shrink-0 text-slate-500 text-xs font-sans truncate" title={entry.nama_role.replace(/_/g, ' ')}>{entry.nama_role.replace(/_/g, ' ')}</div>
                      <div className="w-28 shrink-0 text-slate-500 text-xs font-sans truncate" title={entry.nama_satelit}>{entry.nama_satelit}</div>
                      <div className="flex-1 min-w-[180px] text-slate-400 text-xs font-sans italic leading-relaxed" title={entry.keterangan || '-'}>{entry.keterangan || '-'}</div>
                    </div>
                  );
                })
              )
            ) : (
              data.length === 0 ? (
                <div className="w-full py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <span className="material-icons-round text-5xl text-slate-300">history_edu</span>
                  <p className="text-sm font-sans">Belum ada data audit log untuk kategori ini.</p>
                </div>
              ) : (
                data.map(entry => {
                  const cfg = ACTION_CONFIG[entry.aksi] ?? ACTION_CONFIG.UPDATE;
                  return (
                    <div key={entry.id} className="w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors gap-4">
                      <div className="w-40 shrink-0 text-slate-500 text-xs font-sans">{formatDate(entry.created_at)}</div>
                      <div className="w-44 shrink-0">
                        <Link
                          href={`${entityConfig.detailPath}/${entry.entity_id}?mode=view`}
                          className="text-slate-800 text-sm font-semibold font-sans hover:text-slate-600 hover:underline truncate block"
                        >
                          {entry.nama_entity}
                        </Link>
                      </div>
                      <div className="w-28 shrink-0">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-sans uppercase ${cfg.bg} ${cfg.text}`}>
                          <span className="material-icons-round text-[14px]">{cfg.icon}</span>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="w-28 shrink-0 text-slate-700 text-sm font-sans truncate" title={entry.nama_pelaksana}>{entry.nama_pelaksana}</div>
                      <div className="w-36 shrink-0 text-slate-500 text-xs font-sans truncate" title={entry.nama_role.replace(/_/g, ' ')}>{entry.nama_role.replace(/_/g, ' ')}</div>
                      <div className="w-28 shrink-0 text-slate-500 text-xs font-sans truncate" title={entry.nama_satelit}>{entry.nama_satelit}</div>
                      <div className="flex-1 min-w-[180px] text-slate-400 text-xs font-sans italic leading-relaxed" title={entry.keterangan || '-'}>{entry.keterangan || '-'}</div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* Pagination Footer */}
        <div className="w-full px-6 py-4 bg-white border-t border-slate-200 flex flex-col md:flex-row justify-between items-center text-sm gap-4">
          <span className="text-slate-500 font-sans">
            Menampilkan {(isAnggaran ? anggaranData.length : data.length) > 0 ? ((currentPage - 1) * limit) + 1 : 0}–
            {Math.min(currentPage * limit, total)} dari {total} log
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-9 h-9 rounded-lg border border-slate-200 flex justify-center items-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors disabled:opacity-50"
            >
              <span className="material-icons-round text-[20px]">chevron_left</span>
            </button>
            <span className="text-slate-600 font-sans text-sm px-2">Halaman {currentPage} dari {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="w-9 h-9 rounded-lg border border-slate-200 flex justify-center items-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors disabled:opacity-50"
            >
              <span className="material-icons-round text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
