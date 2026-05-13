import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    await pool.query('ALTER TABLE public.pegawai ALTER COLUMN departemen_id DROP NOT NULL');
    
    // Kita hapus sekalian pegawai dummy yang tadi pakai ID 1 (Anjang Kasih)
    await pool.query('UPDATE public.pegawai SET departemen_id = NULL WHERE nama_lengkap IN ($1, $2, $3)', [
      'Pdt. Budi Santoso', 'Siti Aminah', 'Mang Ujang'
    ]);

    return NextResponse.json({ success: true, message: 'Constraint NOT NULL departemen_id berhasil dihapus dan data dummy diperbaiki.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message });
  }
}
