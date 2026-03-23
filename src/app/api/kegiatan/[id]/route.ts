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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { status_kegiatan, alasan_pembatalan } = body;

    if (!status_kegiatan) {
      return NextResponse.json({ success: false, message: 'Status wajib diisi' }, { status: 400 });
    }

    if (status_kegiatan === 'Dibatalkan') {
      const updateQuery = `UPDATE public.kegiatan SET status_kegiatan = $1, alasan_pembatalan = $2 WHERE id = $3 RETURNING id`;
      await pool.query(updateQuery, [status_kegiatan, alasan_pembatalan, id]);
    } else {
      const updateQuery = `UPDATE public.kegiatan SET status_kegiatan = $1 WHERE id = $2 RETURNING id`;
      await pool.query(updateQuery, [status_kegiatan, id]);
    }

    return NextResponse.json({ success: true, message: `Status berhasil diubah menjadi ${status_kegiatan}` });
  } catch (error) {
    console.error('Error updating status kegiatan:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    // Hard delete dependent tables first (to prevent foreign key constraints error)
    await client.query('DELETE FROM public.kegiatan_detail_ibadah WHERE kegiatan_id = $1', [id]);
    await client.query('DELETE FROM public.kegiatan_pelayan WHERE kegiatan_id = $1', [id]);
    
    // Hard delete main record
    const result = await client.query('DELETE FROM public.kegiatan WHERE id = $1 RETURNING id', [id]);
    
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'Kegiatan tidak ditemukan atau sudah dihapus' }, { status: 404 });
    }
    
    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: 'Kegiatan berstatus Draft berhasil dihapus permanen.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error hard deleting kegiatan:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  } finally {
    client.release();
  }
}
