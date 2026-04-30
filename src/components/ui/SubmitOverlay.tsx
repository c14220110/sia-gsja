'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((mod) => mod.DotLottieReact),
  { ssr: false }
);

interface SubmitOverlayProps {
  status: 'loading' | 'success' | 'error' | 'idle';
  message: string;
  errors?: Record<string, string[]>;
  onClose?: () => void;
}

export function SubmitOverlay({ status, message, errors, onClose }: SubmitOverlayProps) {
  if (status === 'idle') return null;

  return (
    <div className="fixed top-0 left-0 w-full h-[100dvh] z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
            <p className="mt-6 text-slate-600 font-medium text-sm">Menyimpan data...</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="flex flex-col items-center w-full">
            <div className="w-40 h-40">
              <DotLottieReact id="lottie-success" src="/assets/success-check-fill-FPiuzFU9Hy.lottie" autoplay loop={false} />
            </div>
            <p className="mt-2 text-slate-800 font-bold text-center text-lg">{message}</p>
            <button onClick={onClose} className="mt-8 w-full py-2.5 bg-slate-800 text-white font-medium rounded-xl hover:bg-slate-700 transition-colors focus:ring-4 focus:ring-slate-200">
              Lanjutkan
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center w-full">
            <div className="w-32 h-32">
              <DotLottieReact id="lottie-error" src="/assets/error-animation.lottie" autoplay loop={false} />
            </div>
            <p className="mt-4 text-rose-600 font-bold text-center text-lg">{message}</p>
            {errors && Object.keys(errors).length > 0 && (
               <div className="mt-5 w-full bg-rose-50/80 p-4 rounded-xl border border-rose-100 max-h-48 overflow-y-auto text-sm text-rose-700">
                 <ul className="list-disc pl-4 space-y-1">
                   {Object.entries(errors).map(([field, errs]) => (
                     <li key={field}>
                       <span className="font-bold text-rose-800 capitalize">{field.replace(/_/g, ' ')}: </span>
                       <span className="opacity-90">{errs.join(', ')}</span>
                     </li>
                   ))}
                 </ul>
               </div>
            )}
            <button onClick={onClose} className="mt-8 w-full py-2.5 bg-rose-600 text-white font-medium rounded-xl hover:bg-rose-700 transition-colors focus:ring-4 focus:ring-rose-200">
              Perbaiki Form
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
