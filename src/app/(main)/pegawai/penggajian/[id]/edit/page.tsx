'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import Step1Setup from '../../new/Step1Setup';
import Step2Review from '../../new/Step2Review';
import Step3Final from '../../new/Step3Final';

export default function EditRunPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [runId, setRunId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(1);
  const [loadingInit, setLoadingInit] = useState(true);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error'; message: string; errors?: any }>({ status: 'idle', message: '' });

  const [setupData, setSetupData] = useState<any>({
    bulan: '',
    tahun: new Date().getFullYear().toString(),
    satelit_id: '',
    anggaran_tahunan_id: '',
    sisa_plafon: 0,
  });

  useEffect(() => {
    params.then(async (p) => {
      const id = parseInt(p.id);
      setRunId(id);
      // Load existing run data to pre-fill Step 1
      try {
        const res = await fetch(`/api/payroll/runs/${id}/summary`);
        const r = await res.json();
        if (r.success && r.data) {
          const d = r.data;
          setSetupData({
            bulan: d.bulan?.toString() || '',
            tahun: d.tahun?.toString() || '',
            satelit_id: d.satelit_id?.toString() || '',
            anggaran_tahunan_id: d.anggaran_tahunan_id?.toString() || '',
            sisa_plafon: d.sisa_plafon || 0,
          });
        }
      } catch (e) { console.error(e); }
      finally { setLoadingInit(false); }
    });
  }, []);

  const nextStep = () => { setActiveTab(prev => Math.min(3, prev + 1)); window.scrollTo(0, 0); };
  const prevStep = () => { setActiveTab(prev => Math.max(1, prev - 1)); window.scrollTo(0, 0); };

  if (loadingInit) return (
    <div className="w-full flex flex-col gap-8 pb-10">
      <div className="w-full py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin"></div>
        <span className="text-sm font-sans">Memuat data run...</span>
      </div>
    </div>
  );

  return (
    <div className="w-full flex flex-col gap-6 pb-10">

      {/* Header */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-sans leading-4">
          <Link href="/pegawai/penggajian" className="text-slate-500 hover:text-blue-600">Daftar Run Penggajian</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <Link href={`/pegawai/penggajian/${runId}`} className="text-slate-500 hover:text-blue-600">Detail Run</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Edit Setup</span>
        </div>
        <div>
          <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Edit Payroll Run</h1>
          <p className="text-slate-500 text-base font-medium font-sans">Ubah setup dan review ulang data sebelum mengajukan approval.</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="w-full flex items-center justify-between mt-2">
        {[
          { id: 1, name: 'SETUP', icon: 'settings' },
          { id: 2, name: 'REVIEW PEGAWAI', icon: 'group' },
          { id: 3, name: 'FINALISASI', icon: 'check_circle' },
        ].map(tab => (
          <div key={tab.id} className="flex flex-col items-center gap-2 w-1/3 relative group">
            <div className={`w-full h-1 absolute top-5 left-1/2 -z-10 ${tab.id === 3 ? 'hidden' : 'block'} ${activeTab > tab.id ? 'bg-blue-500' : 'bg-slate-200'}`}></div>
            <button
              disabled={activeTab < tab.id && (tab.id > 1 && !runId)}
              onClick={() => { if (activeTab > tab.id || (activeTab < tab.id && runId)) setActiveTab(tab.id); }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm
                ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-blue-500/30' : activeTab > tab.id ? 'bg-blue-100 text-blue-600 cursor-pointer' : 'bg-white border-2 border-slate-200 text-slate-400 pointer-events-none'}`}
            >
              <span className="text-[16px] font-bold">{tab.id}</span>
            </button>
            <span className={`text-xs font-bold font-sans tracking-wider ${activeTab === tab.id ? 'text-blue-700' : activeTab > tab.id ? 'text-slate-700' : 'text-slate-400'}`}>{tab.name}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 mt-4 p-8">
        {activeTab === 1 && (
          <Step1Setup
            runId={runId}
            setupData={setupData}
            setSetupData={setSetupData}
            onNext={(newRunId: number) => { setRunId(newRunId); nextStep(); }}
            setSubmitState={setSubmitState}
          />
        )}
        {activeTab === 2 && (
          <Step2Review
            runId={runId!}
            onNext={nextStep}
            onPrev={prevStep}
            setSubmitState={setSubmitState}
          />
        )}
        {activeTab === 3 && (
          <Step3Final
            runId={runId!}
            onPrev={prevStep}
            setSubmitState={setSubmitState}
            onSuccess={() => {
              setSubmitState({ status: 'success', message: 'Payroll Run berhasil diajukan untuk Approval!' });
              setTimeout(() => router.push('/pegawai/penggajian'), 2000);
            }}
          />
        )}
      </div>

      <SubmitOverlay
        status={submitState.status}
        message={submitState.message}
        errors={submitState.errors}
        onClose={() => setSubmitState({ status: 'idle', message: '' })}
      />
    </div>
  );
}
