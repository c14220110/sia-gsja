import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// GET: list all payroll runs with summary
export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const bulan = searchParams.get('bulan');
    const tahun = searchParams.get('tahun');
    const satelit_id = searchParams.get('satelit_id');
    const status = searchParams.get('status');

    let query = `
      SELECT 
        pr.*,
        s.nama_satelit as unit,
        at.kode_dokumen as kode_ra
      FROM public.payroll_run pr
      LEFT JOIN public.satelit s ON s.id = pr.satelit_id
      LEFT JOIN public.anggaran_tahunan at ON at.id = pr.anggaran_tahunan_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (bulan) { query += ` AND pr.bulan = $${idx++}`; params.push(parseInt(bulan)); }
    if (tahun) { query += ` AND pr.tahun = $${idx++}`; params.push(parseInt(tahun)); }
    if (satelit_id) { query += ` AND pr.satelit_id = $${idx++}`; params.push(parseInt(satelit_id)); }
    if (status) { query += ` AND pr.status = $${idx++}`; params.push(status); }

    query += ` ORDER BY pr.tahun DESC, pr.bulan DESC, pr.id DESC`;

    const result = await pool.query(query, params);
    
    // Rakit summary card dinamis ngambil dari tangkapan query-nya
    let summary = {
      total_payroll_amount: 0,
      total_payroll_count: 0,
      menunggu_approval_amount: 0,
      menunggu_approval_count: 0,
      sudah_dibayar_amount: 0,
      sudah_dibayar_count: 0
    };

    result.rows.forEach(row => {
      const netto = parseFloat(row.total_netto) || 0;
      summary.total_payroll_amount += netto;
      summary.total_payroll_count++;

      if (row.status === 'Menunggu Approval') {
        summary.menunggu_approval_amount += netto;
        summary.menunggu_approval_count++;
      } else if (row.status === 'Dibayar') {
        summary.sudah_dibayar_amount += netto;
        summary.sudah_dibayar_count++;
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: result.rows,
      summary
    });
  } catch (error: any) {
    console.error('GET payroll-runs error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}

// POST: Generate draft baru (stub)
export async function POST(request: NextRequest) {
  const caller = await getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    // TODO: implementasi full setup payroll wizard
    return NextResponse.json({ success: true, message: 'Draft payroll berhasil dibuat (stub)', data: body }, { status: 201 });
  } catch (error: any) {
    console.error('POST payroll-runs error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}
