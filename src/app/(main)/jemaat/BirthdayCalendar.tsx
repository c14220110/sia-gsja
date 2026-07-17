import { useState, useEffect } from 'react';
import Link from 'next/link';

interface BirthdayPerson {
  id: number;
  nama_lengkap: string;
  tanggal_lahir: string;
  foto_url: string | null;
  jenis_kelamin: string;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function BirthdayCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [birthdays, setBirthdays] = useState<BirthdayPerson[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const currentMonth = currentDate.getMonth(); // 0-11
  const currentYear = currentDate.getFullYear();

  const [filterSatelit, setFilterSatelit] = useState('');
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [resSatelit, resUser] = await Promise.all([
          fetch('/api/options?type=satelit'),
          fetch('/api/auth/me')
        ]);
        if (resSatelit.ok) {
          const result = await resSatelit.json();
          if (result.success) setSatelitOptions(result.data);
        }
        if (resUser.ok) {
          const authData = await resUser.json();
          setUserData(authData);
          if (authData && !authData.is_super_admin && !authData.permissions?.includes('multi_satelit_view')) {
            setFilterSatelit(authData.satelit_id?.toString() || '');
          }
        }
      } catch (err) {
        console.error('Error init birthdays:', err);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const fetchBirthdays = async () => {
      setIsLoading(true);
      try {
        const query = new URLSearchParams();
        query.append('month', (currentMonth + 1).toString());
        if (filterSatelit) query.append('satelit_id', filterSatelit);

        const res = await fetch(`/api/members/birthdays?${query.toString()}`);
        const result = await res.json();
        if (result.success) {
          setBirthdays(result.data || []);
        }
      } catch (error) {
        console.error('Error fetching birthdays:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBirthdays();
  }, [currentMonth, filterSatelit]);

  const prevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex justify-center items-center">
            <span className="material-icons-round text-indigo-600">cake</span>
          </div>
          <div>
            <h3 className="text-slate-800 font-bold font-sans">Ulang Tahun Jemaat</h3>
            <p className="text-slate-500 text-xs font-medium">Bulan {MONTHS[currentMonth]} {currentYear}</p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          {(!userData || userData?.is_super_admin || userData?.permissions?.includes('multi_satelit_view')) && (
            <select
              value={filterSatelit}
              onChange={(e) => setFilterSatelit(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
            >
              <option value="">Semua Satelit</option>
              {satelitOptions.map((opt: any) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2">
          <button 
            onClick={prevMonth}
            className="w-8 h-8 rounded-lg border border-slate-200 flex justify-center items-center hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <span className="material-icons-round text-[18px]">chevron_left</span>
          </button>
          <span className="text-sm font-bold text-slate-700 min-w-[100px] text-center">
            {MONTHS[currentMonth]}
          </span>
          <button 
            onClick={nextMonth}
            className="w-8 h-8 rounded-lg border border-slate-200 flex justify-center items-center hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <span className="material-icons-round text-[18px]">chevron_right</span>
          </button>
        </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <span className="material-icons-round animate-spin text-slate-300 text-3xl">refresh</span>
          </div>
        ) : birthdays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <span className="material-icons-round text-4xl mb-2 opacity-50">event_busy</span>
            <p className="text-sm">Tidak ada yang berulang tahun di bulan ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {birthdays.map((person) => {
              const birthDate = new Date(person.tanggal_lahir);
              const day = birthDate.getDate();
              const age = currentYear - birthDate.getFullYear();
              const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth;

              return (
                <Link key={person.id} href={`/jemaat/${person.id}?mode=view`} className="group block">
                  <div className={`p-4 rounded-xl border transition-all flex items-start gap-4 h-full ${isToday ? 'bg-indigo-50 border-indigo-200 hover:border-indigo-300 hover:shadow-md' : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'}`}>
                    {/* Date Badge */}
                    <div className={`w-12 shrink-0 flex flex-col items-center justify-center rounded-lg py-2 ${isToday ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200'}`}>
                      <span className="text-xs font-bold uppercase opacity-80">{MONTHS[currentMonth].substring(0, 3)}</span>
                      <span className="text-xl font-black leading-none mt-1">{day}</span>
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-bold truncate ${isToday ? 'text-indigo-900' : 'text-slate-800 group-hover:text-blue-600'}`}>
                          {toTitleCase(person.nama_lengkap)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Genap {age} thn</span>
                        {isToday && (
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded text-[9px] font-bold uppercase tracking-wider">
                            Hari Ini!
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
