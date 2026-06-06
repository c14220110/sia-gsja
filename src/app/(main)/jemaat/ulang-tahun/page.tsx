'use client';

import { BirthdayCalendar } from '../BirthdayCalendar';
import Link from 'next/link';

export default function UlangTahunPage() {
  return (
    <div className="w-full flex flex-col gap-8 pb-10">
      <div className="flex items-center gap-4">
        <Link 
          href="/jemaat"
          className="w-10 h-10 bg-white rounded-full flex justify-center items-center border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-500 transition-all"
        >
          <span className="material-icons-round text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Kalender Ulang Tahun</h1>
          <div className="text-slate-500 text-base font-medium font-sans leading-6">Pantau hari ulang tahun jemaat setiap bulannya</div>
        </div>
      </div>

      <BirthdayCalendar />
    </div>
  );
}
