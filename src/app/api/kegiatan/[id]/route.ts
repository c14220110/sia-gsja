import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const query = `
      SELECT 
        k.*,
        jk.nama_jenis_kegiatan,
        s.nama_satelit,
        d.nama_departemen,
        kom.nama_komisi,
        p.nama_lengkap as pic_name,
        kdi.tema_khotbah,
        kdi.nama_pengkhotbah_1,
        kdi.nama_pengkhotbah_2
      FROM public.kegiatan k
      LEFT JOIN public.jenis_kegiatan jk ON k.jenis_kegiatan_id = jk.id
      LEFT JOIN public.satelit s ON k.satelit_id = s.id
      LEFT JOIN public.departemen d ON k.departemen_id = d.id
      LEFT JOIN public.komisi kom ON k.komisi_id = kom.id
      LEFT JOIN public.pengurus pengurus ON k.pic_pengurus_id = pengurus.id
      LEFT JOIN public.jemaat p ON pengurus.jemaat_id = p.id
      LEFT JOIN public.kegiatan_detail_ibadah kdi ON k.id = kdi.kegiatan_id
      WHERE k.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Kegiatan tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching detail kegiatan:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
