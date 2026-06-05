'use client';

import { Suspense, useCallback, useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { buildGraph } from './FlowCanvas';

// ONE dynamic import for the entire React Flow canvas
// (keeps all RF components in the same chunk + context)
const FlowCanvas = dynamic(() => import('./FlowCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin h-10 w-10 border-4 border-teal-500 border-t-transparent rounded-full" />
        <span className="text-slate-400 text-sm">Memuat visualisasi...</span>
      </div>
    </div>
  ),
});

// ─── Main inner component ─────────────────────────────────────────────────────
function FamilyTreeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [searchQuery, setSearchQuery]     = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [selectedId, setSelectedId]       = useState<number | null>(null);
  const [flowNodes, setFlowNodes]         = useState<any[]>([]);
  const [flowEdges, setFlowEdges]         = useState<any[]>([]);
  const [flowBranches, setFlowBranches]   = useState<any[]>([]);
  const [treeData, setTreeData]           = useState<any>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [canvasKey, setCanvasKey]         = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  // Handle URL param ?id=
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam && idParam !== 'undefined') setSelectedId(parseInt(idParam, 10));
  }, [searchParams]);

  // Load family tree when selectedId changes
  useEffect(() => {
    if (!selectedId) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/family-tree/${selectedId}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        setTreeData(json.data);
        const { nodes, edges, branches } = buildGraph(json.data);
        setFlowNodes(nodes);
        setFlowEdges(edges);
        setFlowBranches(branches);
        setCanvasKey(k => k + 1); // force FlowCanvas remount with fresh data
      } catch (e: any) {
        setError(e.message || 'Gagal memuat pohon keluarga');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedId]);

  // Jemaat search autocomplete
  useEffect(() => {
    if (typeof searchQuery !== 'string' || searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/options?type=jemaat_search&q=${encodeURIComponent(searchQuery)}`);
        const json = await res.json();
        if (json.success) setSearchResults(json.data || []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectJemaat = useCallback((item: any) => {
    setSearchQuery(item.nama_lengkap || item.label || '');
    setShowDropdown(false);
    const id = item.id ?? item.value;
    setSelectedId(id);
    router.push(`/family-tree?id=${id}`);
  }, [router]);

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Pohon Keluarga</h1>
          <p className="text-slate-500 text-base font-medium font-sans leading-6">Visualisasi silsilah keluarga jemaat secara interaktif</p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80" ref={searchRef}>
          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 gap-2 shadow-sm focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 transition-all">
            <span className="material-icons-round text-slate-400 text-lg">search</span>
            <input
              className="flex-1 text-sm outline-none text-slate-700 bg-transparent placeholder:text-slate-400"
              placeholder="Cari nama jemaat..."
              value={searchQuery ?? ''}
              onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="text-slate-400 hover:text-slate-600">
                <span className="material-icons-round text-lg">close</span>
              </button>
            )}
          </div>

          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto">
              {searchResults.map((item: any, idx: number) => (
                <button
                  key={`${item.id ?? item.value ?? idx}-${idx}`}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm text-slate-700 border-b border-slate-50 last:border-0"
                  onClick={() => selectJemaat(item)}
                >
                  <span className="font-medium">{item.nama_lengkap || item.label}</span>
                  {item.jemaat_id && <span className="text-slate-400 ml-2 text-xs">#{item.jemaat_id}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 flex flex-wrap gap-2 text-xs">
        {[
          { color: 'bg-teal-500',   label: 'Saya' },
          { color: 'bg-rose-400',   label: 'Pasangan' },
          { color: 'bg-blue-400',   label: 'Ayah / Kakek' },
          { color: 'bg-pink-400',   label: 'Ibu / Nenek' },
          { color: 'bg-violet-400', label: 'Anak' },
          { color: 'bg-amber-400',  label: 'Saudara' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
            <span className={`w-2 h-2 rounded-full ${l.color}`} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Canvas area */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
        {/* Empty state */}
        {!selectedId && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center">
              <span className="material-icons-round text-teal-400 text-5xl">account_tree</span>
            </div>
            <div>
              <h2 className="text-slate-700 font-semibold text-lg">Cari Jemaat untuk Mulai</h2>
              <p className="text-slate-400 text-sm mt-1">Ketikkan nama jemaat di kolom pencarian di atas.</p>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-20">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin h-10 w-10 border-4 border-teal-500 border-t-transparent rounded-full" />
              <span className="text-slate-500 text-sm">Memuat pohon keluarga...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-8">
              <span className="material-icons-round text-red-400 text-5xl">error_outline</span>
              <p className="text-red-600 font-semibold mt-3">{error}</p>
            </div>
          </div>
        )}

        {/* Custom SVG canvas - no external library */}
        {!loading && !error && flowNodes.length > 0 && (
          <FlowCanvas
            key={canvasKey}
            nodes={flowNodes}
            edges={flowEdges}
            branches={flowBranches}
            onNodeClick={(id) => {
              setSelectedId(id);
              router.push(`/family-tree?id=${id}`);
            }}
          />
        )}

        {/* Person info card */}
        {treeData?.person && !loading && (
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-md px-4 py-3 text-sm max-w-[220px] z-10">
            <p className="font-bold text-slate-800">{treeData.person.nama_lengkap}</p>
            <p className="text-slate-400 text-xs mt-0.5">{treeData.person.nama_satelit}</p>
            <div className="flex gap-3 mt-2 text-xs">
              <span className="text-slate-500"><strong className="text-amber-500">{treeData.saudara?.length || 0}</strong> saudara</span>
              <span className="text-slate-500"><strong className="text-violet-600">{treeData.anak?.length || 0}</strong> anak</span>
              {treeData.pasangan && <span className="text-slate-500"><strong className="text-rose-500">1</strong> pasangan</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Exported page with Suspense boundary (required for useSearchParams) ──────
export default function FamilyTreePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <div className="animate-spin h-10 w-10 border-4 border-teal-500 border-t-transparent rounded-full" />
      </div>
    }>
      <FamilyTreeInner />
    </Suspense>
  );
}
