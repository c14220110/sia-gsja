import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Tidak terautentikasi' }, { status: 401 });
    }

    const jemaatId = caller.jemaat_id;
    if (!jemaatId) {
      return NextResponse.json({ success: false, message: 'Akun Anda tidak terhubung ke data jemaat.' }, { status: 403 });
    }

    // Fetch active surveys within period that jemaat has NOT responded to
    // For kegiatan-linked surveys: only show if jemaat attended (recorded in kegiatan_absensi)
    // For standalone surveys: show to all jemaat
    const query = `
      SELECT 
        s.id,
        s.judul,
        s.deskripsi,
        s.kegiatan_id,
        s.satelit_id,
        s.periode_mulai,
        s.periode_selesai,
        s.is_anonim,
        s.tipe_survei,
        kg.nama_kegiatan,
        sat.nama_satelit
      FROM public.survei s
      LEFT JOIN public.kegiatan kg ON s.kegiatan_id = kg.id
      LEFT JOIN public.satelit sat ON s.satelit_id = sat.id
      LEFT JOIN public.survei_respons sr ON sr.survei_id = s.id AND sr.jemaat_id = $1
      WHERE s.status = 'aktif'
        AND CURRENT_DATE BETWEEN s.periode_mulai AND s.periode_selesai
        AND sr.id IS NULL
        AND (
          -- Survei mandiri (tanpa kegiatan): tampilkan ke semua jemaat
          (s.kegiatan_id IS NULL)
          OR
          -- Survei terkait kegiatan: hanya tampilkan ke jemaat yang hadir
          (
            kg.status_kegiatan IN ('Menunggu LPJ', 'Selesai')
            AND EXISTS (
              SELECT 1 FROM public.kegiatan_absensi ka 
              WHERE ka.kegiatan_id = s.kegiatan_id 
                AND ka.jemaat_id = $1
            )
          )
        )
      ORDER BY s.periode_selesai ASC
    `;

    const result = await pool.query(query, [jemaatId]);

    // Fetch pertanyaan for each survei
    const surveiIds = result.rows.map((r: any) => r.id);
    let pertanyaanMap: Record<number, any[]> = {};

    if (surveiIds.length > 0) {
      const pertanyaanResult = await pool.query(
        `SELECT id, survei_id, urutan, teks_pertanyaan, tipe_jawaban, is_required
         FROM public.survei_pertanyaan
         WHERE survei_id = ANY($1)
         ORDER BY urutan ASC`,
        [surveiIds]
      );

      for (const p of pertanyaanResult.rows) {
        if (!pertanyaanMap[p.survei_id]) {
          pertanyaanMap[p.survei_id] = [];
        }
        pertanyaanMap[p.survei_id].push(p);
      }
    }

    const data = result.rows.map((s: any) => ({
      ...s,
      pertanyaan: pertanyaanMap[s.id] || [],
    }));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('API Error [GET /survei/saya]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal' }, { status: 500 });
  }
}
