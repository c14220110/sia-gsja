import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

/**
 * GET /api/anggaran/kegiatan-options
 * Params:
 *   - satelit_id (required) : ID satelit yang sedang dibuat anggarannya
 *   - komisi_id  (optional) : Jika diisi → filter kegiatan komisi tsb
 *   - komisi_null=true      : Jika komisi TIDAK dipilih → hanya kegiatan level satelit (komisi_id IS NULL)
 *
 * Status yang dikembalikan: hanya 'Menunggu Persetujuan' dan 'Akan Datang'
 * Ini mencegah Cross-Branch Data Leak antar satelit/komisi.
 */
export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const satelitId = searchParams.get('satelit_id');
  const komisiId = searchParams.get('komisi_id');
  const komisiNull = searchParams.get('komisi_null') === 'true';

  if (!satelitId) {
    return NextResponse.json({ success: false, message: 'satelit_id wajib diisi' }, { status: 400 });
  }

  try {
    const values: any[] = [satelitId];
    let komisiClause = '';

    if (komisiId) {
      // Skenario A: Anggaran khusus komisi → hanya kegiatan komisi tersebut
      values.push(komisiId);
      komisiClause = `AND k.komisi_id = $2`;
    } else if (komisiNull) {
      // Skenario B: Anggaran umum satelit → hanya kegiatan tanpa komisi (level satelit)
      komisiClause = `AND k.komisi_id IS NULL`;
    }

    const res = await pool.query(
      `SELECT k.id, k.kode_kegiatan, k.nama_kegiatan, k.status_kegiatan
       FROM public.kegiatan k
       WHERE k.satelit_id = $1
         ${komisiClause}
         AND k.status_kegiatan IN ('Menunggu Persetujuan', 'Akan Datang')
         AND k.is_published = true
       ORDER BY k.nama_kegiatan ASC`,
      values
    );

    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('[KegiatanOptions] Error:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil data kegiatan', error: error.message }, { status: 500 });
  }
}
