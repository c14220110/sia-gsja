// src/app/api/dashboard/bsc/trend/route.ts
// Pola C — Direct API (sesuai AGENTS.md)
import { NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { getKpiByKey } from '@/server/utils/bscQueries';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  // Akses: hanya Super Admin atau Majelis
  if (!caller.is_super_admin && caller.role_name !== 'MAJELIS') {
    return NextResponse.json(
      { success: false, message: 'Akses ditolak. Trend BSC khusus Super Admin dan Majelis.' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const kpiKey = searchParams.get('kpi');
  if (!kpiKey) {
    return NextResponse.json({ success: false, message: 'Parameter kpi wajib diisi.' }, { status: 400 });
  }

  const rawBulan = searchParams.get('bulan') || '6';
  const bulan = parseInt(rawBulan, 10);
  if (isNaN(bulan) || bulan <= 0 || bulan > 12) {
    return NextResponse.json({ success: false, message: 'Parameter bulan tidak valid (1-12).' }, { status: 400 });
  }

  // RBAC satelit
  let satelitId: number | null = null;
  const rawSatelit = searchParams.get('satelit_id');
  if (rawSatelit !== null && rawSatelit !== undefined && rawSatelit.trim() !== '') {
    const parsed = parseInt(rawSatelit, 10);
    satelitId = isNaN(parsed) ? null : parsed;
  } else if (!caller.is_super_admin) {
    satelitId = caller.satelit_id ?? null;
  }

  try {
    const now = new Date();
    const monthsList: { label: string; dari: string; sampai: string }[] = [];

    // Generate monthly periods
    for (let i = bulan - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const label = `${monthNames[m]} ${String(y).slice(-2)}`;

      const dari = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const sampai = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      monthsList.push({ label, dari, sampai });
    }

    // Execute queries in parallel for each month
    const trendData = await Promise.all(
      monthsList.map(async (m) => {
        try {
          const res = await getKpiByKey(kpiKey, m.dari, m.sampai, satelitId);
          return {
            bulan: m.label,
            nilai: res.nilai,
          };
        } catch (err) {
          console.error(`Error fetching trend for ${kpiKey} on ${m.label}:`, err);
          return {
            bulan: m.label,
            nilai: null,
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: trendData,
    });

  } catch (error: any) {
    console.error('[API GET /api/dashboard/bsc/trend] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan saat memuat data tren.', error: error.message },
      { status: 500 },
    );
  }
}
