import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col items-center p-6 gap-4 text-center zoom-in-95 duration-200">
        
        {/* Lottie Animation */}
        <div className="w-32 h-32 flex justify-center items-center">
          <DotLottieReact
            src="/lottie/Alert.lottie"
            loop
            autoplay
          />
        </div>

        {/* Text Area */}
        <div className="flex flex-col gap-2 w-full">
          <h3 className="text-xl font-bold font-['Inter'] text-slate-900">{title}</h3>
          <div className="text-sm font-['Public_Sans'] leading-normal text-slate-500">
            {message}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row w-full gap-3 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-bold font-['Inter'] transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-bold font-['Inter'] shadow-sm transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
