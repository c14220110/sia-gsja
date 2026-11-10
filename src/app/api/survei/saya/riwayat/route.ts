import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const jemaatId = caller.jemaat_id;
    if (!jemaatId) {
      return NextResponse.json({ success: false, message: 'Jemaat ID tidak ditemukan' }, { status: 400 });
    }

    // Ambilkan survei yang emang udah dihajar (di-respon) sama jemaat ini
    const query = `
      SELECT 
        s.id,
        s.judul,
        s.is_anonim,
        s.tipe_survei,
        s.kegiatan_id,
        kg.nama_kegiatan,
        MIN(sr.created_at) AS tanggal_diisi,
        COALESCE(ROUND(AVG(sr.skor)::numeric, 1), 0) AS rata_rata_skor
      FROM public.survei_respons sr
      JOIN public.survei s ON sr.survei_id = s.id
      LEFT JOIN public.kegiatan kg ON s.kegiatan_id = kg.id
      WHERE sr.jemaat_id = $1
        AND sr.skor IS NOT NULL
      GROUP BY s.id, s.judul, s.is_anonim, s.tipe_survei, s.kegiatan_id, kg.nama_kegiatan
      ORDER BY MIN(sr.created_at) DESC
      LIMIT 20
    `;

    const result = await pool.query(query, [jemaatId]);

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    console.error('API Error [GET /survei/saya/riwayat]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal' }, { status: 500 });
  }
}
