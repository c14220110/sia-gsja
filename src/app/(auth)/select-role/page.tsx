'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLoader } from '@/components/ui/GlobalLoader';

export default function SelectRolePage() {
  const router = useRouter();
  const { showLoader, hideLoader } = useLoader();
  const [roles, setRoles] = useState<any[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [selectedRoleIndex, setSelectedRoleIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // In a real app, you might pass this via URL params, React Context, or a secure temporary cookie.
    // For this flow, we assume it's stored in sessionStorage after the first login step.
    let storedData: string | null = null;
    try { storedData = sessionStorage.getItem('temp_auth_data'); } catch(e) {}
    if (!storedData) storedData = (window as any).__TEMP_AUTH_DATA;

    if (!storedData) {
      router.push('/login');
      return;
    }

    try {
      const data = JSON.parse(storedData);
      setUserId(data.user_id);
      setRoles(data.available_roles || []);
    } catch (e) {
      router.push('/login');
    }
  }, [router]);

  const handleContinue = async () => {
    if (selectedRoleIndex === null) return;
    
    setLoading(true);
    showLoader();
    setError('');
    const selectedRole = roles[selectedRoleIndex];

    try {
      const res = await fetch('/api/auth/select-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          role_id: selectedRole.role_id,
          satelit_id: selectedRole.satelit_id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Gagal memilih role');
      }

      // Bersihkan session storage
      try { sessionStorage.removeItem('temp_auth_data'); } catch(e) {}
      delete (window as any).__TEMP_AUTH_DATA;
      hideLoader();
      router.push('/');
    } catch (err: any) {
      setError(err.message);
      hideLoader(); 
    } finally {
      setLoading(false);
    }
  };

  // Helper untuk mendapatkan icon berdasarkan role
  const getRoleIcon = (roleName: string) => {
    if (roleName.includes('ADMIN')) return 'admin_panel_settings';
    if (roleName.includes('BENDAHARA')) return 'account_balance_wallet';
    if (roleName.includes('GEMBALA')) return 'auto_stories';
    return 'person';
  };

  return (
    <div className="w-full h-screen relative bg-gray-100 font-sans antialiased overflow-hidden">
      {/* Background Blur Effect simulating Dashboard Behind */}
      <div className="absolute inset-0 opacity-60 blur-sm pointer-events-none flex">
        {/* Fake Sidebar */}
        <div className="w-80 h-full bg-slate-700 flex flex-col items-center pt-8">
            <div className="w-64 h-12 bg-white/10 rounded my-2"></div>
            <div className="w-64 h-12 bg-white/10 rounded my-2"></div>
            <div className="w-64 h-12 bg-white/10 rounded my-2"></div>
        </div>
        {/* Fake Main Content */}
        <div className="flex-1 h-full bg-gray-100 flex flex-col">
            <div className="w-full h-16 bg-white border-b border-gray-200"></div>
            <div className="p-8">
                <div className="w-full h-64 bg-white rounded-lg border border-gray-200"></div>
            </div>
        </div>
      </div>

      {/* Modal Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] overflow-y-auto w-full h-full">
        <div className="min-h-full flex items-center justify-center p-4 py-12">
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 md:p-16 flex flex-col items-center text-center">
            
            <div className="mb-10 max-w-lg">
              <h2 className="text-slate-800 text-3xl font-bold tracking-tight mb-3">
                Pilih Peran Anda
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Silakan pilih peran pengguna yang sesuai untuk mengakses dashboard dan fitur yang relevan dengan tanggung jawab Anda dalam sistem SIA GSJA.
              </p>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm w-full max-w-md">
                {error}
              </div>
            )}

            <div className="w-full flex flex-wrap justify-center gap-6 mb-12">
              {roles.map((role, index) => {
                const isSelected = selectedRoleIndex === index;
                return (
                  <button
                    key={`${role.role_id}-${role.satelit_id}`}
                    onClick={() => setSelectedRoleIndex(index)}
                    className={`
                      relative flex flex-col items-center justify-center p-8 rounded-3xl transition-all duration-200 text-left outline-none
                      w-full md:w-[260px] md:shrink-0
                      ${isSelected 
                        ? 'bg-blue-50/50 outline outline-2 outline-slate-400 shadow-md transform -translate-y-1' 
                        : 'bg-white outline outline-2 outline-gray-100 hover:outline-gray-200 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex justify-center items-center mb-4 transition-colors">
                      <span className={`material-icons-round text-3xl ${isSelected ? 'text-primary' : 'text-gray-400'}`}>
                        {getRoleIcon(role.nama_role)}
                      </span>
                    </div>
                    <h3 className={`text-lg font-semibold mb-1 ${isSelected ? 'text-primary' : 'text-gray-600'}`}>
                       {role.nama_role.replace(/_/g, ' ')}
                    </h3>
                    <p className="text-xs text-gray-400 font-medium">
                       📍 {role.nama_satelit}
                    </p>

                    {/* Checkmark indicator */}
                    <div className={`absolute top-4 right-4 flex items-center justify-center w-6 h-6 rounded-full transition-all ${isSelected ? 'bg-primary text-white scale-100' : 'bg-transparent scale-0'}`}>
                        <span className="material-icons-round text-sm">check</span>
                    </div>
                  </button>
                );
              })}
              
              {roles.length === 0 && (
                  <div className="col-span-3 py-8 text-gray-400">
                      Memuat data peran Anda...
                  </div>
              )}
            </div>

            <button
              onClick={handleContinue}
              disabled={selectedRoleIndex === null || loading}
              className="px-16 py-3.5 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white text-lg font-medium rounded-full shadow-lg transition-all transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:shadow-none focus:outline-none focus:ring-4 focus:ring-slate-300"
            >
              {loading ? 'Memproses...' : 'Lanjutkan'}
            </button>



            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
