'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';

type TabKey = 'satelit' | 'departemen' | 'konflik';

/* ── Avatar helper ── */
function Avatar({ src, name, size = 8 }: { src?: string; name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  return src ? (
    <img src={src} alt={name} className={`w-${size} h-${size} rounded-full object-cover ring-2 ring-white shrink-0`} />
  ) : (
    <div className={`w-${size} h-${size} rounded-full bg-slate-200 ring-2 ring-white flex items-center justify-center shrink-0`}>
      <span className="text-slate-600 font-bold text-xs">{initials}</span>
    </div>
  );
}

/* ── Person Card ── */
function PersonCard({ nama, jabatan, foto, idPengurus, hasAkun, highlight = 'blue' }: {
  nama: string; jabatan: string; foto?: string; idPengurus?: string; hasAkun?: boolean; highlight?: string;
}) {
  const colors: Record<string, string> = {
    blue:    'border-blue-200 bg-blue-50',
    violet:  'border-violet-200 bg-violet-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    amber:   'border-amber-200 bg-amber-50',
    slate:   'border-slate-200 bg-slate-50',
  };
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${colors[highlight] || colors.slate}`}>
      <Avatar src={foto} name={nama} size={9} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 truncate font-sans">{nama}</p>
        <p className="text-xs text-slate-500 font-sans">{jabatan}</p>
        {idPengurus && <p className="text-[10px] text-slate-400 font-sans">{idPengurus}</p>}
      </div>
      {hasAkun !== undefined && (
        <span title={hasAkun ? 'Punya akun sistem' : 'Belum punya akun'}
          className={`material-icons-round text-[16px] ${hasAkun ? 'text-emerald-500' : 'text-slate-300'}`}>
          {hasAkun ? 'verified_user' : 'person_off'}
        </span>
      )}
    </div>
  );
}

/* ── Empty State ── */
function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="material-icons-round text-4xl text-slate-300">{icon}</span>
      <p className="text-sm text-slate-400 font-sans">{text}</p>
    </div>
  );
}

/* ── Komisi Block ── */
function KomisiBlock({ komisi }: { komisi: any }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-violet-50 hover:bg-violet-100 transition-colors">
        <div className="flex items-center gap-2">
          <span className="material-icons-round text-violet-600 text-[18px]">groups</span>
          <span className="font-semibold text-sm text-violet-800 font-sans">{komisi.nama_komisi}</span>
          <span className="text-xs text-violet-500 font-sans">
            {komisi.bph_list?.length || 0} pengurus
          </span>
        </div>
        <span className={`material-icons-round text-slate-400 text-[18px] transition-transform ${open ? 'rotate-90' : ''}`}>
          chevron_right
        </span>
      </button>
      {open && (
        <div className="px-4 py-3 bg-white flex flex-col gap-2">
          {komisi.bph_list?.length ? komisi.bph_list.map((b: any, i: number) => (
            <PersonCard key={i} nama={b.nama_lengkap} jabatan={b.jabatan}
              foto={b.foto_url} idPengurus={b.id_pengurus} highlight="violet" />
          )) : (
            <div className="w-full"><EmptyState icon="groups" text="Belum ada BPH Komisi terdaftar" /></div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Rayon Block ── */
function RayonBlock({ 
  rayon, onAddKelompok, onEditRayon, onDeleteRayon, onEditKelompok, onDeleteKelompok 
}: { 
  rayon: any; 
  onAddKelompok: (id: number) => void;
  onEditRayon: (rayon: any) => void;
  onDeleteRayon: (id: number) => void;
  onEditKelompok: (kelompok: any, rayonId: number) => void;
  onDeleteKelompok: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer group" onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-2 flex-1">
          <span className="material-icons-round text-amber-600 text-[18px]">holiday_village</span>
          <span className="font-semibold text-sm text-amber-800 font-sans">{rayon.nama_rayon}</span>
          {rayon.ketua_rayon_nama && (
            <span className="text-xs text-amber-600">• Ketua: {rayon.ketua_rayon_nama}</span>
          )}
          <span className="text-xs text-amber-500">({rayon.kelompok_list?.length || 0} kelompok)</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); onAddKelompok(rayon.rayon_id); }} 
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-amber-200 text-amber-700 transition-colors" title="Tambah Kelompok Sel"
          >
            <span className="material-icons-round text-[16px]">add</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onEditRayon(rayon); }} 
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-amber-200 text-amber-600 transition-colors" title="Edit Rayon"
          >
            <span className="material-icons-round text-[14px]">edit</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDeleteRayon(rayon.rayon_id); }} 
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-rose-200 text-rose-600 transition-colors" title="Hapus Rayon"
          >
            <span className="material-icons-round text-[14px]">delete</span>
          </button>
          <span className={`material-icons-round text-slate-400 text-[18px] transition-transform ml-1 ${open ? 'rotate-90' : ''}`}>
            chevron_right
          </span>
        </div>
      </div>
      {open && (
        <div className="px-4 py-3 bg-white grid grid-cols-1 sm:grid-cols-2 gap-2">
          {rayon.kelompok_list?.length ? rayon.kelompok_list.map((k: any, i: number) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-100 bg-amber-50 group/kel">
              <span className="material-icons-round text-amber-400 text-[16px]">home</span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-800 font-sans">{k.nama_kelompok}</p>
                {k.ketua_nama && <p className="text-[11px] text-amber-600">Ketua: {k.ketua_nama}</p>}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover/kel:opacity-100 transition-opacity">
                <button onClick={() => onEditKelompok(k, rayon.rayon_id)} className="p-1 rounded hover:bg-amber-200 text-amber-600" title="Edit Kelompok">
                  <span className="material-icons-round text-[14px]">edit</span>
                </button>
                <button onClick={() => onDeleteKelompok(k.kelompok_id)} className="p-1 rounded hover:bg-rose-200 text-rose-600" title="Hapus Kelompok">
                  <span className="material-icons-round text-[14px]">delete</span>
                </button>
              </div>
            </div>
          )) : (
            <div className="col-span-2"><EmptyState icon="home" text="Belum ada kelompok HF" /></div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function OrganisasiPage() {
  const { showLoader, hideLoader } = useLoader();
  const [activeTab, setActiveTab] = useState<TabKey>('satelit');
  const [satelitList, setSatelitList] = useState<any[]>([]);
  const [selectedSatelit, setSelectedSatelit] = useState<number | null>(null);
  const [bagan, setBagan] = useState<{ bph: any[]; komisi: any[]; rayon: any[]; is_pusat: boolean } | null>(null);
  const [departemen, setDepartemen] = useState<any[]>([]);
  const [konflik, setKonflik] = useState<{ jabatan_ganda: any[]; segera_habis: any[]; total_konflik: number } | null>(null);
  const [loading, setLoading] = useState(false);

  // States for CRUD Rayon & Kelompok Sel
  const [pengurusList, setPengurusList] = useState<any[]>([]);
  const [showRayonModal, setShowRayonModal] = useState(false);
  const [showKelompokModal, setShowKelompokModal] = useState(false);
  const [prefillRayonId, setPrefillRayonId] = useState<number | null>(null);
  
  const [rayonToEdit, setRayonToEdit] = useState<number | null>(null);
  const [kelompokToEdit, setKelompokToEdit] = useState<number | null>(null);
  
  const [formName, setFormName] = useState('');
  const [formKetuaId, setFormKetuaId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  /* ── Load daftar satelit saat mount ── */
  useEffect(() => {
    showLoader();
    fetch('/api/settings/organisasi?tab=satelit')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.satelit_list?.length) {
          setSatelitList(d.satelit_list);
          setSelectedSatelit(d.satelit_list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => hideLoader());
  }, []);

  /* ── Load bagan saat satelit berubah ── */
  const fetchBagan = useCallback(() => {
    if (activeTab !== 'satelit' || !selectedSatelit) return;
    setLoading(true);
    fetch(`/api/settings/organisasi?tab=satelit&satelit_id=${selectedSatelit}`)
      .then(r => r.json())
      .then(d => { if (d.success) setBagan({ bph: d.bph, komisi: d.komisi, rayon: d.rayon, is_pusat: d.is_pusat || false }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedSatelit, activeTab]);

  useEffect(() => {
    fetchBagan();
  }, [fetchBagan]);

  const loadPengurus = () => {
    if (pengurusList.length > 0 || !selectedSatelit) return;
    fetch(`/api/pengurus?satelit_id=${selectedSatelit}&limit=100`)
      .then(r => r.json())
      .then(d => { if (d.success) setPengurusList(d.data || []); });
  };

  const openRayonModal = (rayon?: any) => {
    loadPengurus();
    if (rayon) {
      setRayonToEdit(rayon.rayon_id);
      setFormName(rayon.nama_rayon);
      setFormKetuaId(rayon.ketua_rayon_id ? String(rayon.ketua_rayon_id) : '');
    } else {
      setRayonToEdit(null);
      setFormName('');
      setFormKetuaId('');
    }
    setShowRayonModal(true);
  };

  const openKelompokModal = (kelompok?: any, rayonId?: number) => {
    loadPengurus();
    if (kelompok && rayonId) {
      setPrefillRayonId(rayonId);
      setKelompokToEdit(kelompok.kelompok_id);
      setFormName(kelompok.nama_kelompok);
      setFormKetuaId(kelompok.ketua_kelompok_id ? String(kelompok.ketua_kelompok_id) : '');
    } else if (rayonId) {
      setPrefillRayonId(rayonId);
      setKelompokToEdit(null);
      setFormName('');
      setFormKetuaId('');
    }
    setShowKelompokModal(true);
  };

  const saveRayon = async () => {
    if (!formName) return;
    setIsSaving(true);
    const method = rayonToEdit ? 'PUT' : 'POST';
    const body = rayonToEdit 
      ? { id: rayonToEdit, nama_rayon: formName, ketua_pengurus_id: formKetuaId || null }
      : { satelit_id: selectedSatelit, nama_rayon: formName, ketua_pengurus_id: formKetuaId || null };
      
    await fetch('/api/settings/organisasi/rayon', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    setIsSaving(false);
    setShowRayonModal(false);
    fetchBagan();
  };

  const deleteRayon = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus Rayon ini?')) return;
    const res = await fetch(`/api/settings/organisasi/rayon?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) alert(data.message || 'Gagal menghapus rayon');
    fetchBagan();
  };

  const saveKelompok = async () => {
    if (!formName || !prefillRayonId) return;
    setIsSaving(true);
    const method = kelompokToEdit ? 'PUT' : 'POST';
    const body = kelompokToEdit
      ? { id: kelompokToEdit, nama_kelompok: formName, ketua_pengurus_id: formKetuaId || null }
      : { rayon_id: prefillRayonId, nama_kelompok: formName, ketua_pengurus_id: formKetuaId || null };

    await fetch('/api/settings/organisasi/kelompok-sel', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    setIsSaving(false);
    setShowKelompokModal(false);
    fetchBagan();
  };

  const deleteKelompok = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus Kelompok Sel ini?')) return;
    const res = await fetch(`/api/settings/organisasi/kelompok-sel?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) alert(data.message || 'Gagal menghapus kelompok sel');
    fetchBagan();
  };

  /* ── Load departemen ── */
  const loadDepartemen = useCallback(() => {
    if (departemen.length > 0) return;
    setLoading(true);
    fetch('/api/settings/organisasi?tab=departemen')
      .then(r => r.json())
      .then(d => { if (d.success) setDepartemen(d.departemen); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [departemen.length]);

  /* ── Load konflik ── */
  const loadKonflik = useCallback(() => {
    if (konflik) return;
    setLoading(true);
    fetch('/api/settings/organisasi?tab=konflik')
      .then(r => r.json())
      .then(d => { if (d.success) setKonflik(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [konflik]);

  const handleTabChange = (t: TabKey) => {
    setActiveTab(t);
    if (t === 'departemen') loadDepartemen();
    if (t === 'konflik') loadKonflik();
  };

  const TABS = [
    { key: 'satelit' as TabKey, label: 'Bagan Per Satelit', icon: 'account_tree', color: 'blue' },
    { key: 'departemen' as TabKey, label: 'Departemen Pusat', icon: 'business', color: 'violet' },
    { key: 'konflik' as TabKey, label: 'Deteksi Konflik', icon: 'warning', color: 'amber',
      badge: konflik?.total_konflik },
  ];

  const tabColor: Record<string, string> = {
    blue:   'border-blue-500 text-blue-600 bg-blue-50',
    violet: 'border-violet-500 text-violet-600 bg-violet-50',
    amber:  'border-amber-500 text-amber-600 bg-amber-50',
  };

  return (
    <div className="flex flex-col gap-0 w-full min-h-0">

      {/* Header */}
      <div className="flex flex-col gap-1 pb-5">
        <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">
          Bagan Organisasi
        </h1>
        <p className="text-slate-500 text-base font-medium font-sans leading-6">
          Visualisasi struktur kepengurusan, komisi, departemen, dan deteksi jabatan rangkap
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-slate-200 mb-5 overflow-x-auto">
        {TABS.map(t => {
          const active = activeTab === t.key;
          return (
            <button key={t.key} onClick={() => handleTabChange(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap font-sans ${
                active ? tabColor[t.color] : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              <span className="material-icons-round text-[18px]">{t.icon}</span>
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: Bagan Satelit ── */}
      {activeTab === 'satelit' && (
        <div className="flex flex-col gap-5">
          {/* Satellite selector */}
          <div className="flex flex-wrap gap-2">
            {satelitList.map(s => (
              <button key={s.id} onClick={() => setSelectedSatelit(s.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border font-sans ${
                  selectedSatelit === s.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}>
                <span className="material-icons-round text-[14px] mr-1 align-middle">church</span>
                {s.nama_satelit}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20">
              <div className="w-6 h-6 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
              <span className="text-slate-500 text-sm font-sans">Memuat bagan...</span>
            </div>
          ) : bagan ? (
            <div className="relative flex flex-col mt-2 pb-10">
              {/* ROOT LEVEL: BPH Satelit / Majelis Pusat */}
              <div className={`bg-white rounded-xl shadow-md overflow-hidden relative z-10 w-full lg:w-3/4 border ${bagan.is_pusat ? 'border-amber-300' : 'border-blue-200'}`}>
                <div className={`px-5 py-3.5 flex items-center gap-2 bg-gradient-to-r ${bagan.is_pusat ? 'from-amber-700 to-amber-500' : 'from-blue-700 to-blue-500'}`}>
                  <span className="material-icons-round text-white text-[20px]">{bagan.is_pusat ? 'account_balance' : 'shield'}</span>
                  <span className="text-white font-bold font-sans">{bagan.is_pusat ? 'Majelis / BPH Pusat' : 'BPH Satelit'}</span>
                  <span className={`text-sm ml-1 font-semibold ${bagan.is_pusat ? 'text-amber-100' : 'text-blue-100'}`}>({bagan.bph.length} jabatan)</span>
                </div>
                <div className="p-4 flex flex-wrap gap-3">
                  {bagan.bph.length ? bagan.bph.map((b, i) => (
                    <div key={i} className="flex-1 min-w-[250px]">
                      <PersonCard nama={b.nama_lengkap} jabatan={b.nama_jabatan}
                        foto={b.foto_url} idPengurus={b.id_pengurus} hasAkun={b.has_akun}
                        highlight={bagan.is_pusat ? 'amber' : 'blue'} />
                    </div>
                  )) : (
                    <div className="w-full">
                      <EmptyState icon={bagan.is_pusat ? 'account_balance' : 'shield'} text={bagan.is_pusat ? 'Belum ada data Majelis/BPH Pusat.' : 'Belum ada BPH Satelit terdaftar.'} />
                    </div>
                  )}
                </div>
              </div>

              {/* TREE BRANCHES WRAPPER */}
              {(bagan.komisi.length > 0 || bagan.rayon.length > 0) && (
                <div className="relative ml-8 sm:ml-12 flex flex-col pt-8 pb-4 gap-8">
                  {/* MAIN TRUNK LINE */}
                  <div className="absolute left-0 top-0 border-l-2 border-slate-300" style={{ bottom: 'calc(100% - 2rem)' }}></div>
                  
                  {/* LEVEL 1: Komisi */}
                  {bagan.komisi.length > 0 && (
                    <div className="relative pl-8 sm:pl-10">
                      {/* Vertical line connecting from above */}
                      <div className="absolute left-0 -top-8 bottom-0 border-l-2 border-slate-300"></div>
                      {/* Branch line */}
                      <div className="absolute left-0 top-8 w-8 sm:w-10 border-t-2 border-slate-300"></div>
                      
                      <div className="bg-white rounded-xl border border-violet-200 shadow-sm overflow-hidden">
                        <div className="bg-gradient-to-r from-violet-600 to-violet-500 px-5 py-3.5 flex items-center gap-2">
                          <span className="material-icons-round text-white text-[20px]">groups</span>
                          <span className="text-white font-bold font-sans">Komisi Satelit</span>
                          <span className="text-violet-200 text-sm ml-1 font-semibold">({bagan.komisi.length} komisi)</span>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                          {bagan.komisi.map((k, i) => <KomisiBlock key={i} komisi={k} />)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LEVEL 1: Rayon & Kelompok */}
                  {bagan.rayon.length > 0 && (
                    <div className="relative pl-8 sm:pl-10">
                      {/* Vertical line connecting from above (stops at branch) */}
                      <div className="absolute left-0 -top-8 h-16 border-l-2 border-slate-300"></div>
                      {/* Branch line */}
                      <div className="absolute left-0 top-8 w-8 sm:w-10 border-t-2 border-slate-300"></div>
                      
                      <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-400 px-5 py-3.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="material-icons-round text-white text-[20px]">holiday_village</span>
                            <span className="text-white font-bold font-sans">Rayon & Kelompok Sel</span>
                            <span className="text-amber-100 text-sm ml-1 font-semibold">({bagan.rayon.length} rayon)</span>
                          </div>
                          <button onClick={() => openRayonModal()} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                            <span className="material-icons-round text-[14px]">add</span> Tambah Rayon
                          </button>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                          {bagan.rayon.map((r, i) => (
                            <RayonBlock 
                              key={i} 
                              rayon={r} 
                              onAddKelompok={(id) => openKelompokModal(null, id)} 
                              onEditRayon={openRayonModal}
                              onDeleteRayon={deleteRayon}
                              onEditKelompok={openKelompokModal}
                              onDeleteKelompok={deleteKelompok}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {bagan.bph.length === 0 && bagan.komisi.length === 0 && bagan.rayon.length === 0 && (
                <div className="mt-8">
                  <EmptyState icon="account_tree" text="Belum ada data struktur organisasi untuk satelit ini." />
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── TAB 2: Departemen Pusat ── */}
      {activeTab === 'departemen' && (
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20">
              <div className="w-6 h-6 border-4 border-slate-200 border-t-violet-600 rounded-full animate-spin" />
              <span className="text-slate-500 text-sm font-sans">Memuat departemen...</span>
            </div>
          ) : departemen.length === 0 ? (
            <EmptyState icon="business" text="Belum ada data departemen." />
          ) : (
            <div className="relative flex flex-col mt-2 pb-10">
              {/* ROOT LEVEL: PUSAT */}
              <div className="bg-white rounded-xl border border-violet-200 shadow-md overflow-hidden relative z-10 w-full lg:w-1/2">
                <div className="bg-gradient-to-r from-violet-700 to-violet-500 px-5 py-3.5 flex items-center gap-2">
                  <span className="material-icons-round text-white text-[20px]">account_balance</span>
                  <span className="text-white font-bold font-sans">Pengurus Pusat (BPP)</span>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  <p className="text-sm text-slate-500 font-sans">Struktur hierarki departemen tingkat pusat yang membawahi seluruh satelit.</p>
                </div>
              </div>

              {/* TREE BRANCHES WRAPPER */}
              <div className="relative ml-8 sm:ml-12 flex flex-col pt-8 pb-4">
                {departemen.map((d, i) => {
                  const isLast = i === departemen.length - 1;
                  return (
                    <div key={i} className={`relative pl-8 sm:pl-10 ${!isLast ? 'pb-8' : ''}`}>
                      {/* Vertical line */}
                      <div className={`absolute left-0 top-0 border-l-2 border-slate-300 ${isLast ? 'h-8' : 'h-full'}`}></div>
                      {/* Branch line */}
                      <div className="absolute left-0 top-8 w-8 sm:w-10 border-t-2 border-slate-300"></div>
                      
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="material-icons-round text-violet-600 text-[20px]">business</span>
                            <span className="font-bold text-sm text-slate-800 font-sans">{d.nama_departemen}</span>
                            <span className="text-xs text-slate-400 font-semibold ml-1">({d.koordinator_list?.length || 0} koordinator)</span>
                          </div>
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold ${d.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                            {d.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {d.koordinator_list?.length ? d.koordinator_list.map((k: any, j: number) => (
                            <PersonCard key={j} nama={k.nama_lengkap}
                              jabatan={`${k.jabatan}${k.nama_satelit ? ` · ${k.nama_satelit}` : ' · Pusat'}`}
                              foto={k.foto_url} idPengurus={k.id_pengurus} highlight="violet" />
                          )) : (
                            <div className="col-span-4">
                              <EmptyState icon="person_off" text="Belum ada koordinator terdaftar" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Konflik ── */}
      {activeTab === 'konflik' && (
        <div className="flex flex-col gap-5">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20">
              <div className="w-6 h-6 border-4 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
              <span className="text-slate-500 text-sm font-sans">Menganalisis konflik...</span>
            </div>
          ) : konflik ? (
            <>
              {/* Info banner */}
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="material-icons-round text-amber-500 text-[20px] mt-0.5">info</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800 font-sans">Kebijakan Jabatan Rangkap</p>
                  <p className="text-xs text-amber-600 mt-0.5 font-sans">
                    Sistem <strong>tidak memblokir</strong> jabatan rangkap (ini adalah kondisi normal di gereja).
                    Data di bawah hanya sebagai informasi agar Gembala dapat memantau beban kerja SDM.
                  </p>
                </div>
              </div>

              {/* Jabatan Ganda */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                  <span className="material-icons-round text-amber-600 text-[20px]">warning</span>
                  <span className="font-bold text-sm text-amber-800 font-sans">Rangkap Jabatan</span>
                  <span className="ml-auto text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">
                    {konflik.jabatan_ganda.length} orang
                  </span>
                </div>
                {konflik.jabatan_ganda.length === 0 ? (
                  <div className="p-4"><EmptyState icon="check_circle" text="Tidak ada rangkap jabatan saat ini" /></div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {konflik.jabatan_ganda.map((p, i) => (
                      <div key={i} className="px-5 py-4 flex items-start gap-4">
                        <Avatar src={p.foto_url} name={p.nama_lengkap} size={10} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm text-slate-800 font-sans">{p.nama_lengkap}</p>
                            <span className="text-xs text-slate-400 font-sans">{p.id_pengurus}</span>
                            <span className="text-xs font-bold text-amber-600">· {p.jumlah_jabatan} jabatan</span>
                            {p.satelit_asal && <span className="text-xs text-slate-400">({p.satelit_asal})</span>}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {p.jabatan_list?.map((j: any, ji: number) => (
                              <span key={ji} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full font-sans">
                                <span className="material-icons-round text-[12px] text-slate-400">
                                  {j.lingkup === 'Komisi' ? 'groups' : j.lingkup === 'Departemen' ? 'business' : 'shield'}
                                </span>
                                {j.jabatan}
                                {(j.nama_satelit || j.nama_komisi || j.nama_departemen) && (
                                  <span className="text-slate-400">
                                    · {j.nama_komisi || j.nama_departemen || j.nama_satelit}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Masa Jabatan Hampir Habis */}
              {konflik.segera_habis.length > 0 && (
                <div className="bg-white rounded-xl border border-rose-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 bg-rose-50 border-b border-rose-200 flex items-center gap-2">
                    <span className="material-icons-round text-rose-500 text-[20px]">timer</span>
                    <span className="font-bold text-sm text-rose-700 font-sans">Masa Jabatan Hampir Berakhir (≤90 hari)</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {konflik.segera_habis.map((item, i) => (
                      <div key={i} className="px-5 py-3 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate font-sans">{item.nama_lengkap}</p>
                          <p className="text-xs text-slate-500 font-sans">
                            {item.nama_jabatan}
                            {item.nama_satelit && ` · ${item.nama_satelit}`}
                            {item.nama_komisi && ` · ${item.nama_komisi}`}
                          </p>
                          <p className="text-xs text-slate-400">{item.nama_periode}</p>
                        </div>
                        <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
                          item.sisa_hari <= 30
                            ? 'bg-rose-100 text-rose-700'
                            : item.sisa_hari <= 60
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {item.sisa_hari} hari lagi
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* ── MODALS ── */}
      {(showRayonModal || showKelompokModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 font-sans">
                {showRayonModal 
                  ? (rayonToEdit ? 'Edit Rayon' : 'Tambah Rayon Baru') 
                  : (kelompokToEdit ? 'Edit Kelompok Sel' : 'Tambah Kelompok Sel')
                }
              </h3>
              <button onClick={() => { setShowRayonModal(false); setShowKelompokModal(false); }} className="text-slate-400 hover:text-slate-600">
                <span className="material-icons-round text-[20px]">close</span>
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-4">
              {showKelompokModal && prefillRayonId && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Tergabung di Rayon</label>
                  <div className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 font-semibold flex items-center gap-2">
                    <span className="material-icons-round text-[16px] text-slate-400">holiday_village</span>
                    {bagan?.rayon.find(r => r.rayon_id === prefillRayonId)?.nama_rayon || 'Rayon'}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Nama {showRayonModal ? 'Rayon' : 'Kelompok'} <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder={showRayonModal ? "Contoh: Rayon 1" : "Contoh: HF Agape"}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Ketua (Opsional)
                </label>
                <select 
                  value={formKetuaId}
                  onChange={e => setFormKetuaId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Pilih Ketua --</option>
                  {pengurusList.map(p => (
                    <option key={p.id} value={p.id}>{p.nama_lengkap} ({p.id_pengurus})</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">Daftar pengurus aktif di satelit ini.</p>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button 
                onClick={() => { setShowRayonModal(false); setShowKelompokModal(false); }}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                disabled={isSaving}
              >
                Batal
              </button>
              <button 
                onClick={showRayonModal ? saveRayon : saveKelompok}
                disabled={!formName || isSaving}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
              >
                {isSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
