// src/app/api/kegiatan/[id]/head-count/route.ts
// API untuk input jumlah kehadiran manual (hand tally counter)
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const res = await pool.query(
      `SELECT k.id, k.nama_kegiatan, k.jumlah_hadir_manual, k.status_kegiatan,
              COUNT(ka.id) AS total_presensi_digital
       FROM public.kegiatan k
       LEFT JOIN public.kegiatan_absensi ka ON ka.kegiatan_id = k.id
       WHERE k.id = $1
       GROUP BY k.id`,
      [id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Kegiatan tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error: any) {
    console.error('[HEAD-COUNT GET]', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { jumlah_hadir_manual } = body;

    if (jumlah_hadir_manual === null || jumlah_hadir_manual === undefined || jumlah_hadir_manual < 0) {
      return NextResponse.json({ success: false, message: 'Jumlah harus berupa angka positif' }, { status: 400 });
    }

    // Pastikan kegiatan ada dan statusnya Menunggu LPJ atau Selesai
    const check = await pool.query(
      `SELECT status_kegiatan FROM public.kegiatan WHERE id = $1`,
      [id]
    );
    if (check.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Kegiatan tidak ditemukan' }, { status: 404 });
    }

    const status = check.rows[0].status_kegiatan;
    if (!['Menunggu LPJ', 'Selesai'].includes(status)) {
      return NextResponse.json({ success: false, message: 'Hanya bisa input kehadiran manual saat status Menunggu LPJ atau Selesai' }, { status: 400 });
    }

    await pool.query(
      `UPDATE public.kegiatan SET jumlah_hadir_manual = $1 WHERE id = $2`,
      [parseInt(jumlah_hadir_manual, 10), id]
    );

    return NextResponse.json({ success: true, message: 'Jumlah kehadiran manual berhasil disimpan' });
  } catch (error: any) {
    console.error('[HEAD-COUNT PUT]', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
