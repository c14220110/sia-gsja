'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { buildGraph } from '@/app/(main)/family-tree/FlowCanvas';

const FlowCanvas = dynamic(() => import('@/app/(main)/family-tree/FlowCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
    </div>
  ),
});

// ─── Helper: read-only row ─────────────────────────────────────
function InfoRow({ label, value, icon }: { label: string; value?: string | null; icon?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      {icon && <span className="material-icons-round text-slate-400 text-[18px] mt-0.5 shrink-0">{icon}</span>}
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="text-sm font-semibold text-slate-800 mt-0.5 break-words">{value}</span>
      </div>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-3.5 flex items-center gap-2 border-b border-slate-100 bg-slate-50">
        <span className="material-icons-round text-slate-500 text-[18px]">{icon}</span>
        <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{title}</span>
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  );
}

function StatusChip({ label, color }: { label: string; color: 'green' | 'blue' | 'amber' | 'rose' | 'violet' | 'slate' }) {
  const colors = {
    green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    amber:  'bg-amber-50 text-amber-700 border-amber-200',
    rose:   'bg-rose-50 text-rose-700 border-rose-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    slate:  'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${colors[color]}`}>
      {label}
    </span>
  );
}

function PersonCard({ name, role, jemaatId, gerjaAsal }: { name: string; role: string; jemaatId?: string; gerjaAsal?: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
        <span className="material-icons-round text-slate-400 text-[20px]">person</span>
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-bold text-slate-800 truncate">{name}</span>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-400 font-semibold uppercase">{role}</span>
          {jemaatId && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">{jemaatId}</span>}
          {gerjaAsal && <span className="text-[10px] text-slate-400">• {gerjaAsal}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────
export default function ProfilJemaatPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'data' | 'keluarga' | 'pohon'>('data');

  // Baca query parameter tab jika ada (misal dari menu "Kartu Keluarga")
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'keluarga' || tab === 'pohon' || tab === 'data') {
        setActiveTab(tab);
      }
    }
  }, []);


  // Data state
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [komisiOptions, setKomisiOptions] = useState<any[]>([]);
  const [departemenOptions, setDepartemenOptions] = useState<any[]>([]);
  const [pekerjaanOptions, setPekerjaanOptions] = useState<any[]>([]);

  // Family tree state
  const [treeNodes, setTreeNodes] = useState<any[]>([]);
  const [treeEdges, setTreeEdges] = useState<any[]>([]);
  const [treeBranches, setTreeBranches] = useState<any[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState('');
  const [treeKey, setTreeKey] = useState(0);

  useEffect(() => {
    const init = async () => {
      try {
        const [resAuth, resSat, resKom, resDept, resPek] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/options?type=satelit'),
          fetch('/api/options?type=komisi'),
          fetch('/api/options?type=departemen'),
          fetch('/api/options?type=pekerjaan'),
        ]);

        const authData = await resAuth.json();

        // Guard: only jemaat role can access
        if (!resAuth.ok || authData?.role_name?.toLowerCase() !== 'jemaat') {
          router.replace('/');
          return;
        }

        const satData  = await resSat.json();
        const komData  = await resKom.json();
        const deptData = await resDept.json();
        const pekData  = await resPek.json();

        if (satData.success)  setSatelitOptions(satData.data);
        if (komData.success)  setKomisiOptions(komData.data);
        if (deptData.success) setDepartemenOptions(deptData.data);
        if (pekData.success)  setPekerjaanOptions(pekData.data);

        // Fetch jemaat detail
        if (authData.jemaat_id) {
          const res = await fetch(`/api/members/${authData.jemaat_id}`);
          if (res.ok) {
            const detailData = await res.json();
            if (detailData.success) setProfile(detailData.data);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Load family tree when switching to pohon tab
  useEffect(() => {
    if (activeTab !== 'pohon' || !profile?.id || treeNodes.length > 0) return;
    const loadTree = async () => {
      setTreeLoading(true);
      setTreeError('');
      try {
        const res = await fetch(`/api/family-tree/${profile.id}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        const { nodes, edges, branches } = buildGraph(json.data);
        setTreeNodes(nodes);
        setTreeEdges(edges);
        setTreeBranches(branches);
        setTreeKey(k => k + 1);
      } catch (e: any) {
        setTreeError(e.message || 'Gagal memuat pohon keluarga');
      } finally {
        setTreeLoading(false);
      }
    };
    loadTree();
  }, [activeTab, profile]);

  // ── Derived helpers ────────────────────────────────────────
  const formatDate = (d?: string) => {
    if (!d) return null;
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d));
  };

  const getSatelitName = (id?: string | number) =>
    satelitOptions.find(s => s.id.toString() === id?.toString())?.nama_satelit || null;

  const getPekerjaanName = () => {
    if (profile?.pekerjaan) return profile.pekerjaan;
    if (profile?.pekerjaan_id) return pekerjaanOptions.find(p => p.id.toString() === profile.pekerjaan_id.toString())?.nama_pekerjaan || null;
    return null;
  };

  const getKomisiNames = () =>
    komisiOptions.filter(k => (profile?.komisi_ids || []).includes(k.id.toString())).map(k => k.nama_komisi);

  const getDepartemenNames = () =>
    departemenOptions.filter(d => (profile?.departemen_ids || []).includes(d.id.toString())).map(d => d.nama_departemen);

  // ── Loading skeleton ───────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          <span className="text-slate-500 text-sm font-semibold">Memuat profil...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center p-8">
          <span className="material-icons-round text-slate-300 text-5xl">error_outline</span>
          <p className="text-slate-500 mt-3 font-semibold">Data profil tidak ditemukan</p>
          <button onClick={() => router.push('/')} className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm">Kembali</button>
        </div>
      </div>
    );
  }

  const satName = getSatelitName(profile.satelit_id);
  const komisiNames = getKomisiNames();
  const deptNames = getDepartemenNames();

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-lg mx-auto">

      {/* ─── HERO HEADER ──────────────────────────────────── */}
      <div className="w-full relative overflow-hidden">
        {/* Gradient BG */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500" />
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-sky-300/20 rounded-full blur-2xl pointer-events-none" />

        {/* Back Button */}
        <div className="relative px-5 pt-12 pb-0 flex items-center">
          <button
            onClick={() => router.push('/')}
            className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white"
          >
            <span className="material-icons-round text-[20px]">arrow_back</span>
          </button>
          <span className="text-white font-bold text-base ml-3">Profil Saya</span>
        </div>

        {/* Avatar + Name */}
        <div className="relative flex flex-col items-center pb-8 pt-6 px-5">
          <div className="w-24 h-24 rounded-full border-4 border-white/60 shadow-xl overflow-hidden bg-white/20 mb-4">
            {profile.foto_url ? (
              <img src={profile.foto_url} alt={profile.nama_lengkap} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="material-icons-round text-white text-5xl">person</span>
              </div>
            )}
          </div>
          <h1 className="text-white font-black text-xl text-center leading-tight">{profile.nama_lengkap}</h1>
          <span className="text-blue-100 text-xs font-mono mt-1">{profile.jemaat_id}</span>
          <div className="flex items-center gap-1.5 mt-2">
            {satName && (
              <span className="bg-white/20 backdrop-blur-sm text-white text-[11px] font-bold px-3 py-1 rounded-full border border-white/30 flex items-center gap-1">
                <span className="material-icons-round text-[12px]">location_on</span>
                {satName}
              </span>
            )}
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
              profile.status_jemaat === 'Aktif' ? 'bg-emerald-400/30 border-emerald-300/50 text-emerald-100' : 'bg-rose-400/30 border-rose-300/50 text-rose-100'
            }`}>
              {profile.status_jemaat || 'Aktif'}
            </span>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="relative flex bg-white/10 backdrop-blur-sm border-t border-white/20 rounded-t-2xl">
          {([
            { id: 'data',     label: 'Data Diri',  icon: 'person' },
            { id: 'keluarga', label: 'Keluarga',   icon: 'family_restroom' },
            { id: 'pohon',    label: 'Silsilah',   icon: 'account_tree' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 transition-all ${
                activeTab === tab.id ? 'text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              <span className={`material-icons-round text-[20px] transition-transform ${activeTab === tab.id ? 'scale-110' : ''}`}>{tab.icon}</span>
              <span className="text-[10px] font-bold">{tab.label}</span>
              {activeTab === tab.id && <span className="w-5 h-0.5 bg-white rounded-full mt-0.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* ─── TAB CONTENT ──────────────────────────────────── */}
      <div className="flex-1 px-4 py-5 flex flex-col gap-4 pb-10">

        {/* ── TAB: DATA DIRI ─────────────────────────────── */}
        {activeTab === 'data' && (
          <>
            {/* Informasi Personal */}
            <SectionCard title="Informasi Personal" icon="badge">
              <InfoRow label="NIK KTP" value={profile.nik} icon="fingerprint" />
              <InfoRow label="Jenis Kelamin" value={profile.jenis_kelamin} icon="wc" />
              <InfoRow label="Tempat, Tanggal Lahir"
                value={[profile.tempat_lahir, formatDate(profile.tanggal_lahir)].filter(Boolean).join(', ')}
                icon="cake"
              />
              <InfoRow label="Pekerjaan" value={getPekerjaanName()} icon="work" />
            </SectionCard>

            {/* Status Gereja */}
            <SectionCard title="Status Gereja & Baptis" icon="how_to_reg">
              <div className="py-3 flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <StatusChip
                    label={profile.status_baptis ? '✝ Sudah Baptis' : 'Belum Baptis'}
                    color={profile.status_baptis ? 'blue' : 'slate'}
                  />
                  <StatusChip
                    label={profile.status_pernikahan || 'Lajang'}
                    color={profile.status_pernikahan === 'Menikah' ? 'rose' : 'slate'}
                  />
                  <StatusChip
                    label={profile.status_jemaat || 'Aktif'}
                    color={profile.status_jemaat === 'Aktif' ? 'green' : 'amber'}
                  />
                </div>
                {profile.status_baptis && profile.tanggal_baptis && (
                  <div className="flex items-start gap-3 pt-2 border-t border-slate-100">
                    <span className="material-icons-round text-blue-400 text-[18px] mt-0.5">water_drop</span>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tanggal Baptis</span>
                      <span className="text-sm font-semibold text-slate-800">{formatDate(profile.tanggal_baptis)}</span>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Satelit & Komisi & Departemen */}
            <SectionCard title="Detail Satelit & Komisi" icon="church">
              <div className="py-3 flex flex-col gap-3">
                {satName && (
                  <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
                    <span className="material-icons-round text-blue-400 text-[18px] mt-0.5">location_city</span>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Satelit Gereja</span>
                      <span className="text-sm font-semibold text-slate-800">{satName}</span>
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Komisi</span>
                  {komisiNames.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {komisiNames.map(k => (
                        <span key={k} className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold rounded-full">
                          {k}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-xs italic mt-1">Tidak mengikuti komisi</p>
                  )}
                </div>
                {deptNames.length > 0 && (
                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Departemen</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {deptNames.map(d => (
                        <span key={d} className="px-3 py-1 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold rounded-full">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Kontak & Domisili */}
            <SectionCard title="Kontak & Domisili" icon="contact_mail">
              {profile.no_hp && (
                <div className="flex items-start gap-3 py-3 border-b border-slate-100">
                  <span className="material-icons-round text-emerald-500 text-[18px] mt-0.5">phone</span>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No. Telepon / WhatsApp</span>
                    <a href={`tel:${profile.no_hp}`} className="text-sm font-semibold text-blue-600">{profile.no_hp}</a>
                  </div>
                </div>
              )}
              {profile.email && (
                <div className="flex items-start gap-3 py-3 border-b border-slate-100">
                  <span className="material-icons-round text-blue-500 text-[18px] mt-0.5">mail</span>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alamat Email</span>
                    <a href={`mailto:${profile.email}`} className="text-sm font-semibold text-blue-600 break-all">{profile.email}</a>
                  </div>
                </div>
              )}
              <InfoRow label="Alamat Domisili" value={profile.alamat} icon="home" />
              {(profile.kecamatan || profile.kelurahan) && (
                <InfoRow
                  label="Kecamatan / Kelurahan"
                  value={[profile.kecamatan, profile.kelurahan].filter(Boolean).join(' / ')}
                  icon="map"
                />
              )}
              {(profile.kota || profile.kode_pos) && (
                <InfoRow
                  label="Kota, Kode Pos"
                  value={[profile.kota, profile.kode_pos].filter(Boolean).join(', ')}
                  icon="location_city"
                />
              )}
            </SectionCard>
          </>
        )}

        {/* ── TAB: KELUARGA ──────────────────────────────── */}
        {activeTab === 'keluarga' && (
          <>
            {/* Pasangan */}
            {profile.status_pernikahan === 'Menikah' && (
              <SectionCard title="Pasangan" icon="favorite">
                <div className="py-3">
                  {profile.pasangan_nama ? (
                    <PersonCard
                      name={profile.pasangan_nama}
                      role="Pasangan"
                      jemaatId={profile.pasangan_jemaat_id}
                      gerjaAsal={!profile.pasangan_id ? profile.gereja_asal_pasangan : undefined}
                    />
                  ) : (
                    <p className="text-slate-400 text-sm italic text-center py-3">Data pasangan belum direkam</p>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Orang Tua */}
            <SectionCard title="Orang Tua" icon="family_restroom">
              <div className="py-3 flex flex-col gap-3">
                {profile.ayah_nama ? (
                  <PersonCard
                    name={profile.ayah_nama}
                    role="Ayah"
                    jemaatId={profile.ayah_jemaat_id}
                    gerjaAsal={!profile.ayah_id ? profile.gereja_asal_ayah : undefined}
                  />
                ) : (
                  <div className="py-2 text-slate-400 text-xs italic flex items-center gap-2">
                    <span className="material-icons-round text-[16px]">person_off</span> Data ayah belum direkam
                  </div>
                )}
                {profile.ibu_nama ? (
                  <PersonCard
                    name={profile.ibu_nama}
                    role="Ibu"
                    jemaatId={profile.ibu_jemaat_id}
                    gerjaAsal={!profile.ibu_id ? profile.gereja_asal_ibu : undefined}
                  />
                ) : (
                  <div className="py-2 text-slate-400 text-xs italic flex items-center gap-2">
                    <span className="material-icons-round text-[16px]">person_off</span> Data ibu belum direkam
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Anak */}
            <SectionCard title={`Data Anak (${(profile.anak || []).length})`} icon="child_care">
              <div className="py-3 flex flex-col gap-3">
                {(profile.anak || []).length === 0 ? (
                  <p className="text-slate-400 text-xs italic text-center py-3 flex flex-col items-center gap-2">
                    <span className="material-icons-round text-3xl text-slate-200">child_care</span>
                    Belum merekam data anak
                  </p>
                ) : (
                  (profile.anak || []).map((ank: any, idx: number) => (
                    <PersonCard
                      key={idx}
                      name={ank.nama_anak || '-'}
                      role={`Anak ke-${idx + 1}`}
                      jemaatId={ank.anak_jemaat_id_text}
                      gerjaAsal={!ank.anak_jemaat_id && ank.gereja_asal_anak ? ank.gereja_asal_anak : undefined}
                    />
                  ))
                )}
              </div>
            </SectionCard>

            {/* Saudara Kandung */}
            <SectionCard title={`Saudara Kandung (${(profile.saudara || []).length})`} icon="people">
              <div className="py-3 flex flex-col gap-3">
                {(profile.saudara || []).length === 0 ? (
                  <p className="text-slate-400 text-xs italic text-center py-3 flex flex-col items-center gap-2">
                    <span className="material-icons-round text-3xl text-slate-200">people_outline</span>
                    Belum merekam data saudara
                  </p>
                ) : (
                  (profile.saudara || []).map((sd: any, idx: number) => (
                    <PersonCard
                      key={idx}
                      name={sd.nama_saudara || '-'}
                      role={`Saudara ke-${idx + 1}`}
                      jemaatId={sd.saudara_jemaat_kode}
                    />
                  ))
                )}
              </div>
            </SectionCard>
          </>
        )}

        {/* ── TAB: POHON KELUARGA ────────────────────────── */}
        {activeTab === 'pohon' && (
          <div className="flex flex-col gap-4">
            {/* Legend */}
            <div className="flex flex-wrap gap-2">
              {[
                { color: '#14b8a6', label: 'Pusat' },
                { color: '#f43f8e', label: 'Pasangan' },
                { color: '#3b82f6', label: 'Ayah / Kakek' },
                { color: '#ec4899', label: 'Ibu / Nenek' },
                { color: '#8b5cf6', label: 'Anak' },
                { color: '#f59e0b', label: 'Saudara' },
              ].map(l => (
                <span key={l.label} className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-sm text-xs font-semibold text-slate-600">
                  <span style={{ background: l.color }} className="w-2 h-2 rounded-full inline-block shrink-0" />
                  {l.label}
                </span>
              ))}
            </div>

            {/* Hint: non-interactive  */}


            {/* Canvas */}
            <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" style={{ height: 460 }}>
              {treeLoading && (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin h-10 w-10 border-4 border-teal-500 border-t-transparent rounded-full" />
                    <span className="text-slate-400 text-sm">Memuat pohon keluarga...</span>
                  </div>
                </div>
              )}
              {treeError && !treeLoading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-8">
                    <span className="material-icons-round text-rose-300 text-4xl">error_outline</span>
                    <p className="text-rose-500 text-sm font-semibold mt-2">{treeError}</p>
                  </div>
                </div>
              )}
              {!treeLoading && !treeError && treeNodes.length > 0 && (
                <FlowCanvas
                  key={treeKey}
                  nodes={treeNodes}
                  edges={treeEdges}
                  branches={treeBranches}
                  onNodeClick={undefined}   // ← NON-CLICKABLE untuk role jemaat
                />
              )}
              {!treeLoading && !treeError && treeNodes.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <span className="material-icons-round text-slate-200 text-5xl">account_tree</span>
                  <p className="text-slate-400 text-sm font-semibold">Data keluarga belum tersedia</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
