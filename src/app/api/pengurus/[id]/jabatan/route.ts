import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import pool from '@/lib/db';

/**
 * POST /api/pengurus/[id]/jabatan
 * Menambah jabatan baru ke pengurus yang sudah ada.
 * Tidak membuat row baru di tabel pengurus — hanya INSERT ke detail_kepengurusan.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller || (!caller.is_super_admin && !caller.permissions.includes('pengurus_manage'))) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak' }, { status: 403 });
    }

    const { id: idStr } = await params;
    const pengurus_id = parseInt(idStr);
    if (isNaN(pengurus_id)) {
      return NextResponse.json({ success: false, message: 'Invalid pengurus ID' }, { status: 400 });
    }

    // Verify pengurus exists
    const pengurusRes = await pool.query(
      `SELECT p.id, j.satelit_id AS jemaat_satelit_id FROM pengurus p JOIN jemaat j ON p.jemaat_id = j.id WHERE p.id = $1`,
      [pengurus_id]
    );
    if (pengurusRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Pengurus tidak ditemukan' }, { status: 404 });
    }
    const jemaat_satelit_id = pengurusRes.rows[0].jemaat_satelit_id;

    const body = await request.json();
    const {
      jabatan_id, lingkup, satelit_id, komisi_id, departemen_id,
      periode_id, tanggal_mulai, jalur_pengangkatan, catatan
    } = body;

    if (!jabatan_id || !lingkup || !periode_id || !tanggal_mulai || !jalur_pengangkatan) {
      return NextResponse.json({ success: false, message: 'Harap lengkapi semua field wajib jabatan' }, { status: 400 });
    }
    if (lingkup !== 'Pusat' && !satelit_id) {
      return NextResponse.json({ success: false, message: 'Lokasi satelit wajib diisi untuk lingkup non-Pusat' }, { status: 400 });
    }

    // Determine final satelit_id
    let finalSatelitId: number;
    if (lingkup === 'Pusat') {
      const pusatRes = await pool.query(
        `SELECT id FROM satelit WHERE LOWER(nama_satelit) LIKE '%pusat%' OR LOWER(nama_satelit) LIKE '%eben%' LIMIT 1`
      );
      finalSatelitId = pusatRes.rows.length > 0 ? pusatRes.rows[0].id : 1;
    } else {
      finalSatelitId = parseInt(satelit_id, 10);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        INSERT INTO detail_kepengurusan
          (pengurus_id, jabatan_id, lingkup, satelit_id, komisi_id, departemen_id,
           periode_id, tanggal_mulai_menjabat, jalur_pengangkatan, catatan, status_jabatan)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Aktif')
      `, [
        pengurus_id,
        parseInt(jabatan_id),
        lingkup,
        finalSatelitId,
        komisi_id ? parseInt(komisi_id) : null,
        departemen_id ? parseInt(departemen_id) : null,
        parseInt(periode_id),
        tanggal_mulai,
        jalur_pengangkatan,
        catatan || null,
      ]);

      await client.query(`
        INSERT INTO pengurus_audit_log (pengurus_id, aksi, user_id, role_id, satelit_id, keterangan)
        VALUES ($1, 'UPDATE', $2, $3, $4, $5)
      `, [
        pengurus_id,
        caller.user_id,
        caller.role_id,
        jemaat_satelit_id,
        `Jabatan baru ditambahkan: ${lingkup}`,
      ]);

      await client.query('COMMIT');
      return NextResponse.json({ success: true, message: 'Jabatan berhasil ditambahkan' });
    } catch (e: any) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[POST /api/pengurus/[id]/jabatan]', error.message);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
