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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    const body = await request.json();
    await client.query('BEGIN');

    // 1. Update Tabel Utama Kegiatan
    const updateKegiatan = `
      UPDATE public.kegiatan SET 
        nama_kegiatan = $1,
        jenis_kegiatan_id = $2,
        satelit_id = $3,
        departemen_id = $4,
        komisi_id = $5,
        tanggal_mulai = $6,
        tanggal_selesai = $7,
        waktu_mulai = $8,
        waktu_selesai = $9,
        lokasi_kegiatan = $10,
        keterangan = $11,
        pic_pengurus_id = $12,
        status_kegiatan = $13
      WHERE id = $14
    `;
    
    await client.query(updateKegiatan, [
      body.nama_kegiatan,
      body.jenis_kegiatan_id || null,
      body.satelit_id || null,
      body.departemen_id || null,
      body.komisi_id || null,
      body.tanggal_mulai,
      body.tanggal_selesai || null,
      body.waktu_mulai || null,
      body.waktu_selesai || null,
      body.lokasi_kegiatan || null,
      body.keterangan || null,
      body.pic_pengurus_id || null,
      body.status_kegiatan,
      id
    ]);

    // 2. Update atau Insert Detail Ibadah (Tema & Pengkhotbah)
    if (body.tema_khotbah || body.nama_pengkhotbah_1 || body.nama_pengkhotbah_2) {
      // Upsert logic
      const checkDetail = await client.query('SELECT id FROM public.kegiatan_detail_ibadah WHERE kegiatan_id = $1', [id]);
      if (checkDetail.rowCount && checkDetail.rowCount > 0) {
        await client.query(`
          UPDATE public.kegiatan_detail_ibadah SET
            tema_khotbah = $1,
            nama_pengkhotbah_1 = $2,
            nama_pengkhotbah_2 = $3
          WHERE kegiatan_id = $4
        `, [body.tema_khotbah || null, body.nama_pengkhotbah_1 || null, body.nama_pengkhotbah_2 || null, id]);
      } else {
         await client.query(`
          INSERT INTO public.kegiatan_detail_ibadah (kegiatan_id, tema_khotbah, nama_pengkhotbah_1, nama_pengkhotbah_2)
          VALUES ($1, $2, $3, $4)
        `, [id, body.tema_khotbah || null, body.nama_pengkhotbah_1 || null, body.nama_pengkhotbah_2 || null]);
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: 'Kegiatan berhasil diperbarui' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating full kegiatan:', error);
    return NextResponse.json({ success: false, message: 'Gagal memperbarui kegiatan' }, { status: 500 });
  } finally {
    client.release();
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
