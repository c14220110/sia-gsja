// src/app/api/kegiatan/[id]/lpj/route.ts
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import { resolveCallerSnapshot } from '@/server/utils/resolveCallerSnapshot';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: any }) {
  const { id } = await params;
  const numId = parseInt(id, 10);

  try {
    // 1. Header (include catatan_reviewer, reviewed info)
    const headerRes = await pool.query(
      `SELECT kl.laporan_naratif, kl.status_lpj, kl.catatan_reviewer,
              kl.reviewed_at,
              COALESCE(j.nama_lengkap, p.email) AS reviewed_by_nama
       FROM public.kegiatan_lpj kl
       LEFT JOIN public.pengguna p ON p.id = kl.reviewed_by
       LEFT JOIN public.jemaat j ON j.id = p.jemaat_id
       WHERE kl.kegiatan_id = $1`,
      [numId]
    );
    const header = headerRes.rows[0] || null;

    // 2. Items
    const itemsRes = await pool.query(
      `SELECT d.id, d.jenis_anggaran, d.coa_id, d.sumber_dana, d.uraian, d.deskripsi,
              d.jumlah, d.satuan, d.harga_satuan,
              c.kode_akun, c.nama_akun
       FROM public.kegiatan_lpj_detail d
       LEFT JOIN public.buku_besar_coa c ON c.id = d.coa_id
       WHERE d.kegiatan_id = $1`,
      [numId]
    );

    // 3. RA Info
    const raInfoRes = await pool.query(
      `SELECT a.id, a.kode_dokumen, a.nama_rancangan, a.pola_penggunaan, a.total_disetujui
       FROM public.anggaran_tahunan a
       JOIN public.kegiatan k ON k.anggaran_tahunan_id = a.id
       WHERE k.id = $1`,
      [numId]
    );
    const raInfo = raInfoRes.rows[0] || null;

    let raItemsReference: any[] = [];
    let totalTerpakaiLain = 0;
    if (raInfo) {
      const [raItemsRes, terpakaiRes] = await Promise.all([
        pool.query(
          `SELECT d.coa_id, d.jumlah, d.harga_satuan, d.uraian, d.satuan,
                  a.kode_akun, a.nama_akun, d.jenis_anggaran, d.sumber_dana, d.deskripsi
           FROM public.anggaran_tahunan_detail d
           JOIN public.buku_besar_coa a ON a.id = d.coa_id
           WHERE d.anggaran_tahunan_id = $1`,
          [raInfo.id]
        ),
        pool.query(
          `SELECT COALESCE(SUM(
             CASE WHEN d.jenis_anggaran = 'Pengeluaran' THEN d.jumlah * d.harga_satuan
                  WHEN d.jenis_anggaran = 'Penerimaan' THEN -(d.jumlah * d.harga_satuan)
                  ELSE 0 END
           ), 0) AS total
           FROM public.kegiatan_lpj_detail d
           JOIN public.kegiatan_lpj lh ON lh.kegiatan_id = d.kegiatan_id
           JOIN public.kegiatan k ON k.id = d.kegiatan_id
           WHERE k.anggaran_tahunan_id = $1
             AND d.kegiatan_id != $2
             AND lh.status_lpj IN ('Menunggu Review', 'Disetujui')`,
          [raInfo.id, numId]
        ),
      ]);
      raItemsReference = raItemsRes.rows;
      totalTerpakaiLain = parseFloat(terpakaiRes.rows[0]?.total ?? 0);

      // Untuk RA Bertahap: hitung terpakai per COA dari LPJ-LPJ LAIN yang sudah diajukan/disetujui
      if (raInfo.pola_penggunaan === 'Bertahap') {
        const terpakaiPerCoaRes = await pool.query(
          `SELECT d.coa_id,
                  SUM(d.jumlah * d.harga_satuan) AS total_terpakai
           FROM public.kegiatan_lpj_detail d
           JOIN public.kegiatan_lpj lh ON lh.kegiatan_id = d.kegiatan_id
           JOIN public.kegiatan k ON k.id = d.kegiatan_id
           WHERE k.anggaran_tahunan_id = $1
             AND d.kegiatan_id != $2
             AND lh.status_lpj IN ('Menunggu Review', 'Disetujui')
           GROUP BY d.coa_id`,
          [raInfo.id, numId]
        );
        // Annotate raItemsReference with terpakai_sebelumnya per coa_id
        const terpakaiMap: Record<number, number> = {};
        terpakaiPerCoaRes.rows.forEach((r: any) => {
          terpakaiMap[r.coa_id] = parseFloat(r.total_terpakai ?? 0);
        });
        raItemsReference = raItemsReference.map((r: any) => ({
          ...r,
          terpakai_sebelumnya: terpakaiMap[r.coa_id] ?? 0,
        }));
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        header,
        items: itemsRes.rows,
        ra_info: raInfo ? {
          kode: raInfo.kode_dokumen,
          nama: raInfo.nama_rancangan,
          pola: raInfo.pola_penggunaan,
          total_disetujui: parseFloat(raInfo.total_disetujui ?? 0),
          total_terpakai_lain: totalTerpakaiLain,
        } : null,
        ra_items_reference: raItemsReference,
        is_prefilled: false,
      },
    });
  } catch (e: any) {
    console.error('[API LPJ] GET Error:', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}


export async function POST(request: Request, { params }: { params: any }) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const client = await pool.connect();
  try {
    const body = await request.json();
    const { action, laporan_naratif, items } = body;
    // action: 'draft' | 'ajukan' | 'ajukan_ulang'

    // Guard: jangan bisa ubah jika sudah Disetujui
    const existing = await client.query(
      `SELECT status_lpj FROM public.kegiatan_lpj WHERE kegiatan_id = $1`,
      [numId]
    );
    if (existing.rows[0]?.status_lpj === 'Disetujui') {
      client.release();
      return NextResponse.json({ success: false, message: 'LPJ sudah disetujui dan tidak dapat diubah.' }, { status: 400 });
    }

    const prevStatus: string | null = existing.rows[0]?.status_lpj ?? null;
    const isFirstSubmit = !existing.rows[0];

    let newStatus: string;
    let auditAksi: 'Dibuat' | 'Diajukan' | 'Direvisi & Diajukan Ulang';
    if (action === 'ajukan') {
      newStatus = 'Menunggu Review';
      auditAksi = isFirstSubmit ? 'Dibuat' : 'Diajukan';
    } else if (action === 'ajukan_ulang') {
      newStatus = 'Menunggu Review';
      auditAksi = 'Direvisi & Diajukan Ulang';
    } else {
      // 'draft'
      newStatus = 'Draft';
      auditAksi = 'Dibuat';
    }

    // Resolve pengurus.id dari pengguna (FK diajukan_oleh_id → pengurus.id, bukan pengguna.id)
    const pengurusRes = await client.query(
      `SELECT pg.id FROM public.pengurus pg
       JOIN public.pengguna pn ON pn.jemaat_id = pg.jemaat_id
       WHERE pn.id = $1 LIMIT 1`,
      [caller.user_id]
    );
    const pengurusId: number | null = pengurusRes.rows[0]?.id ?? null;

    await client.query('BEGIN');

    // Upsert header
    await client.query(
      `INSERT INTO public.kegiatan_lpj (kegiatan_id, laporan_naratif, status_lpj, waktu_submit, diajukan_oleh_id)
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (kegiatan_id) DO UPDATE
         SET laporan_naratif = EXCLUDED.laporan_naratif,
             status_lpj = EXCLUDED.status_lpj,
             waktu_submit = EXCLUDED.waktu_submit`,
      [numId, laporan_naratif, newStatus, pengurusId]
    );


    // Replace detail items
    await client.query('DELETE FROM public.kegiatan_lpj_detail WHERE kegiatan_id = $1', [numId]);
    for (const it of items) {
      await client.query(
        `INSERT INTO public.kegiatan_lpj_detail
           (kegiatan_id, jenis_anggaran, coa_id, sumber_dana, uraian, deskripsi, jumlah, satuan, harga_satuan)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [numId, it.jenis_anggaran, it.coa_id, it.sumber_dana, it.uraian, it.deskripsi || null, it.jumlah, it.satuan || null, it.harga_satuan]
      );
    }

    await client.query('COMMIT');

    // Audit log (fire-and-forget) — only on actual submit actions
    if (action === 'ajukan' || action === 'ajukan_ulang') {
      resolveCallerSnapshot(caller).then(snapshot => {
        auditLogRepository.insertLpjAuditLog({
          kegiatan_id: numId,
          aksi: auditAksi,
          status_sebelum: prevStatus,
          status_sesudah: newStatus,
          user_id: caller.user_id,
          role_id: caller.role_id,
          nama_pelaksana: snapshot.nama_pelaksana,
          nama_role: snapshot.nama_role,
          keterangan: action === 'ajukan_ulang' ? 'LPJ direvisi dan diajukan ulang' : 'LPJ diajukan untuk direview',
        }).catch(err => console.error('[AuditLog LPJ] insert failed:', err));
      }).catch(err => console.error('[AuditLog LPJ] snapshot failed:', err));
    }

    const successMsg = action === 'draft' ? 'Draft LPJ berhasil disimpan.' :
                       action === 'ajukan_ulang' ? 'LPJ berhasil diajukan ulang untuk direview.' :
                       'LPJ berhasil diajukan. Menunggu review Majelis.';

    return NextResponse.json({ success: true, message: successMsg, newStatus });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[API LPJ] POST Error:', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  } finally {
    client.release();
  }
}
