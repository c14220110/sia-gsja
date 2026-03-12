'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';

// ── CSV parser (handles quoted fields) ──────────────────────────────────────
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = parseRow(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
    return obj;
  });

  return { headers, rows };
}

const PREVIEW_FIELDS = [
  { label: 'Nama', key: 'Nama Jemaat' },
  { label: 'Jenis Kelamin', key: 'Jenis Kelamin' },
  { label: 'Tgl Lahir', key: 'Tanggal Lahir' },
  { label: 'Status Baptis', key: 'Status Baptis' },
  { label: 'Status Nikah', key: 'Status Hubungan' },
  { label: 'Satellit', key: 'Nama Satelit' },
  { label: 'No HP', key: 'No telepon / WA' },
];

export default function ImportMembersPage() {
  const [rawCSV, setRawCSV]     = useState('');
  const [parsed, setParsed]     = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults]   = useState<{ nama: string; status: string; reason?: string }[] | null>(null);
  const [summary, setSummary]   = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setRawCSV(text);
      setParsed(parseCSV(text));
      setResults(null);
    };
    reader.readAsText(file);
  };

  const handlePaste = (text: string) => {
    setRawCSV(text);
    setParsed(parseCSV(text));
    setResults(null);
  };

  const handleImport = async () => {
    if (!parsed?.rows.length) return;
    setImporting(true);
    setResults(null);
    try {
      const res = await fetch('/api/members/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed.rows }),
      });
      const data = await res.json();
      setSummary(data.message);
      setResults(data.results ?? []);
    } catch (err: any) {
      setSummary('Terjadi kesalahan: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const statusColor = (s: string) => {
    if (s === 'ok')    return 'text-emerald-700 bg-emerald-50';
    if (s === 'skip')  return 'text-amber-700 bg-amber-50';
    return 'text-red-700 bg-red-50';
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Link href="/dashboard" className="hover:text-blue-600">Manajemen User</Link>
          <span className="material-icons-round text-[14px]">chevron_right</span>
          <Link href="/dashboard/members" className="hover:text-blue-600">Jemaat</Link>
          <span className="material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Import CSV</span>
        </div>
        <div>
          <h1 className="text-slate-900 text-3xl font-black font-['Inter']">Import Jemaat dari CSV</h1>
          <p className="text-slate-500 text-sm mt-1">Upload file CSV dari Google Form, preview data, lalu import ke database.</p>
        </div>
      </div>

      {/* Upload area */}
      <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="material-icons-round text-slate-700">upload_file</span>
          <span className="text-slate-700 text-xs font-bold uppercase tracking-wider">Upload File CSV</span>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
        >
          <span className="material-icons-round text-4xl text-slate-300 block mb-2">cloud_upload</span>
          <p className="text-slate-500 text-sm">Klik untuk pilih file <span className="font-bold text-blue-600">.csv</span></p>
          <p className="text-slate-400 text-xs mt-1">atau paste langsung di bawah</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </div>

        {/* Paste area */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-xs font-bold uppercase tracking-wide">Atau Paste CSV Langsung</label>
          <textarea
            value={rawCSV}
            onChange={e => { setRawCSV(e.target.value); }}
            onBlur={e => handlePaste(e.target.value)}
            placeholder="Paste isi CSV di sini..."
            rows={5}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          {rawCSV && !parsed?.rows.length && (
            <button onClick={() => handlePaste(rawCSV)} className="self-start px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-bold mt-1">
              Parse CSV
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      {parsed && parsed.rows.length > 0 && !results && (
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-icons-round text-slate-700">table_view</span>
              <span className="text-slate-700 text-xs font-bold uppercase tracking-wider">
                Preview — {parsed.rows.length} baris data
              </span>
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition-colors"
            >
              {importing ? (
                <><span className="material-icons-round animate-spin text-[18px]">autorenew</span> Mengimport...</>
              ) : (
                <><span className="material-icons-round text-[18px]">upload</span> Import Sekarang</>
              )}
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2">#</th>
                  {PREVIEW_FIELDS.map(f => (
                    <th key={f.key} className="px-3 py-2 whitespace-nowrap">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    {PREVIEW_FIELDS.map(f => (
                      <td key={f.key} className="px-3 py-2 text-slate-700 max-w-[160px] truncate" title={row[f.key]}>
                        {row[f.key] || <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="material-icons-round text-emerald-600">task_alt</span>
            <span className="text-slate-700 text-xs font-bold uppercase tracking-wider">Hasil Import</span>
          </div>

          <div className="px-4 py-3 bg-slate-50 rounded-lg text-sm font-semibold text-slate-700">{summary}</div>

          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Nama</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{r.nama}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor(r.status)}`}>
                        {r.status === 'ok' ? '✓ Berhasil' : r.status === 'skip' ? '⚠ Dilewati' : '✗ Gagal'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{r.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Link href="/dashboard/members" className="px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded-lg">
              Lihat Data Jemaat →
            </Link>
            <button onClick={() => { setResults(null); setParsed(null); setRawCSV(''); }} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-50">
              Import Lagi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
