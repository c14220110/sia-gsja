'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useLoader } from '@/components/ui/GlobalLoader';

type AuditAction = 'CREATE' | 'UPDATE' | 'DEACTIVATE';
type LogType = 'jemaat' | 'pelayan' | 'pengurus';

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

const ACTION_CONFIG: Record<AuditAction, { label: string; bg: string; text: string; icon: string }> = {
  CREATE:     { label: 'CREATE',     bg: 'bg-emerald-100', text: 'text-emerald-700', icon: 'person_add'  },
  UPDATE:     { label: 'UPDATE',     bg: 'bg-blue-100',    text: 'text-blue-700',    icon: 'edit'        },
  DEACTIVATE: { label: 'DEACTIVATE', bg: 'bg-rose-100',    text: 'text-rose-700',    icon: 'person_off'  },
};

const LOG_TYPE_CONFIG: Record<LogType, { label: string; icon: string; entityLabel: string; detailPath: string }> = {
  jemaat:   { label: 'Data Jemaat',   icon: 'group',              entityLabel: 'Jemaat',   detailPath: '/dashboard/members'  },
  pelayan:  { label: 'Data Pelayan',  icon: 'volunteer_activism',  entityLabel: 'Pelayan',  detailPath: '/dashboard/members'  },
  pengurus: { label: 'Data Pengurus', icon: 'admin_panel_settings', entityLabel: 'Pengurus', detailPath: '/dashboard/pengurus' },
};

export default function AuditLogPage() {
  const { showLoader, hideLoader } = useLoader();
  const [data,        setData]        = useState<AuditLogEntry[]>([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [initDone,    setInitDone]    = useState(false); // true after first fetch
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 15;

  const [logType,    setLogType]    = useState<LogType>('jemaat');
  const [search,     setSearch]     = useState('');
  const [filterAksi, setFilterAksi] = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');

  const totalPages = Math.max(1, Math.ceil(total / limit));

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
        setData(json.data);
        setTotal(json.meta.total);
      } else {
        setData([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('[AuditLog] fetch error:', err);
    } finally {
      setLoading(false);
      if (!initDone) { hideLoader(); setInitDone(true); }
    }
  }, [currentPage, logType, filterAksi, dateFrom, dateTo, search, initDone]);

  // Show Lottie overlay ONLY on first page mount
  useEffect(() => { showLoader(); }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Reset to page 1 when any filter or log type changes
  useEffect(() => { setCurrentPage(1); }, [logType, filterAksi, dateFrom, dateTo, search]);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  const entityConfig = LOG_TYPE_CONFIG[logType];

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800 font-['Inter']">Audit Log</h1>
        <p className="text-sm text-slate-500 font-['Public_Sans']">Riwayat seluruh aksi Create, Update, dan Deactivate berdasarkan kategori data</p>
      </div>

      {/* Log Type Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(Object.entries(LOG_TYPE_CONFIG) as [LogType, typeof LOG_TYPE_CONFIG[LogType]][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setLogType(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold font-['Public_Sans'] transition-all ${
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

      {/* Action Stat Cards */}
      <div className="grid grid-cols-3 gap-4">
        {(['CREATE', 'UPDATE', 'DEACTIVATE'] as AuditAction[]).map(aksi => {
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
                <div className="text-xs text-slate-500 font-['Public_Sans'] font-bold uppercase tracking-wide">{cfg.label}</div>
                <div className="text-lg font-bold text-slate-800 font-['Inter']">
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

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-slate-400 text-[20px]">search</span>
          <input
            type="text"
            placeholder={`Cari nama ${entityConfig.entityLabel.toLowerCase()} atau pelaksana...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white font-['Public_Sans']"
          />
        </div>
        <select
          value={filterAksi}
          onChange={e => setFilterAksi(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white font-['Public_Sans'] text-slate-700"
        >
          <option value="">Semua Aksi</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DEACTIVATE">DEACTIVATE</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white font-['Public_Sans'] text-slate-700"
          title="Tanggal mulai"
        />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white font-['Public_Sans'] text-slate-700"
          title="Tanggal akhir"
        />
        {(filterAksi || dateFrom || dateTo || search) && (
          <button
            onClick={() => { setFilterAksi(''); setDateFrom(''); setDateTo(''); setSearch(''); }}
            className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 bg-white font-['Public_Sans'] flex items-center gap-2 transition-colors"
          >
            <span className="material-icons-round text-[18px]">filter_alt_off</span> Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[900px] flex flex-col">
            {/* Header */}
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4 gap-4">
              <div className="w-40 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-['Public_Sans']">Waktu</div>
              <div className="w-44 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-['Public_Sans']">{entityConfig.entityLabel}</div>
              <div className="w-28 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-['Public_Sans']">Aksi</div>
              <div className="flex-1 min-w-[130px] text-slate-500 text-xs font-bold uppercase tracking-wider font-['Public_Sans']">Pelaksana</div>
              <div className="w-36 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-['Public_Sans']">Role</div>
              <div className="w-32 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-['Public_Sans']">Satelit</div>
              <div className="w-40 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider font-['Public_Sans']">Keterangan</div>
            </div>

            {/* Body */}
            {loading ? (
              <div className="w-full py-16 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
              </div>
            ) : data.length === 0 ? (
              <div className="w-full py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                <span className="material-icons-round text-5xl text-slate-300">history_edu</span>
                <p className="text-sm font-['Public_Sans']">Belum ada data audit log untuk kategori ini.</p>
              </div>
            ) : (
              data.map(entry => {
                const cfg = ACTION_CONFIG[entry.aksi] ?? ACTION_CONFIG.UPDATE;
                return (
                  <div key={entry.id} className="w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors gap-4">
                    <div className="w-40 shrink-0 text-slate-500 text-xs font-['Public_Sans']">{formatDate(entry.created_at)}</div>
                    <div className="w-44 shrink-0">
                      <Link
                        href={`${entityConfig.detailPath}/${entry.entity_id}?mode=view`}
                        className="text-slate-800 text-sm font-semibold font-['Public_Sans'] hover:text-slate-600 hover:underline truncate block"
                      >
                        {entry.nama_entity}
                      </Link>
                    </div>
                    <div className="w-28 shrink-0">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold font-['Public_Sans'] uppercase ${cfg.bg} ${cfg.text}`}>
                        <span className="material-icons-round text-[12px]">{cfg.icon}</span>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex-1 min-w-[130px] text-slate-700 text-sm font-['Public_Sans'] truncate">{entry.nama_pelaksana}</div>
                    <div className="w-36 shrink-0 text-slate-500 text-xs font-['Public_Sans'] truncate">{entry.nama_role.replace(/_/g, ' ')}</div>
                    <div className="w-32 shrink-0 text-slate-500 text-xs font-['Public_Sans'] truncate">{entry.nama_satelit}</div>
                    <div className="w-40 shrink-0 text-slate-400 text-xs font-['Public_Sans'] truncate italic">{entry.keterangan || '-'}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pagination Footer */}
        <div className="w-full px-6 py-4 bg-white border-t border-slate-200 flex flex-col md:flex-row justify-between items-center text-sm gap-4">
          <span className="text-slate-500 font-['Public_Sans']">
            Menampilkan {data.length > 0 ? ((currentPage - 1) * limit) + 1 : 0}–
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
            <span className="text-slate-600 font-['Public_Sans'] text-sm px-2">Halaman {currentPage} dari {totalPages}</span>
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
