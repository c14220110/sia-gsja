import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { sendPushNotificationToJemaat } from '@/server/utils/pushNotification';

/**
 * GET /api/notifikasi/broadcast
 * List broadcast notification history with pagination
 */
export async function GET(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('survei_manage')) {
    return NextResponse.json({ success: false, message: 'Akses Ditolak' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search') || '';

    // RBAC: multi-satelit guard
    let satelitFilter = '';
    const queryParams: any[] = [];
    let paramIdx = 1;

    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      satelitFilter = ` AND nb.satelit_id = $${paramIdx}`;
      queryParams.push(caller.satelit_id);
      paramIdx++;
    }

    let searchFilter = '';
    if (search) {
      searchFilter = ` AND (nb.judul ILIKE $${paramIdx} OR nb.isi_pesan ILIKE $${paramIdx})`;
      queryParams.push(`%${search}%`);
      paramIdx++;
    }

    // Count query
    const countQuery = `
      SELECT count(*) as total
      FROM public.notifikasi_broadcast nb
      WHERE 1=1 ${satelitFilter} ${searchFilter}
    `;
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total, 10);

    // Stats query
    const statsQuery = `
      SELECT 
        count(*) as total_broadcast,
        COALESCE(SUM(total_terkirim), 0) as total_terkirim_all,
        COALESCE(SUM(total_target), 0) as total_target_all
      FROM public.notifikasi_broadcast nb
      WHERE 1=1 ${satelitFilter} ${searchFilter}
    `;
    const statsResult = await pool.query(statsQuery, queryParams);
    const stats = statsResult.rows[0];

    // Data query
    const dataParams = [...queryParams, limit, offset];
    const dataQuery = `
      SELECT 
        nb.*,
        s.nama_satelit,
        p.nama_lengkap as pengirim_nama
      FROM public.notifikasi_broadcast nb
      LEFT JOIN satelit s ON nb.satelit_id = s.id
      LEFT JOIN pengguna pg ON nb.created_by = pg.id
      LEFT JOIN jemaat p ON pg.jemaat_id = p.id
      WHERE 1=1 ${satelitFilter} ${searchFilter}
      ORDER BY nb.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    const result = await pool.query(dataQuery, dataParams);

    return NextResponse.json({
      success: true,
      data: result.rows,
      meta: {
        total,
        limit,
        offset,
        total_broadcast: parseInt(stats.total_broadcast, 10),
        total_terkirim: parseInt(stats.total_terkirim_all, 10),
        total_target: parseInt(stats.total_target_all, 10),
      },
    });
  } catch (error: any) {
    console.error('API Error [GET /notifikasi/broadcast]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal' }, { status: 500 });
  }
}

/**
 * POST /api/notifikasi/broadcast
 * Send a new broadcast push notification
 */
export async function POST(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('survei_manage')) {
    return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin untuk mengirim notifikasi broadcast' }, { status: 403 });
  }

  // 1. Parse & validate body (before acquiring DB connection)
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Body request tidak valid' }, { status: 400 });
  }

  const { judul, isi_pesan, target_audience, target_satelit_id, target_komisi_id, url_tujuan } = body;

  if (!judul || !judul.trim()) {
    return NextResponse.json({ success: false, message: 'Judul notifikasi wajib diisi' }, { status: 400 });
  }
  if (!isi_pesan || !isi_pesan.trim()) {
    return NextResponse.json({ success: false, message: 'Isi pesan wajib diisi' }, { status: 400 });
  }
  if (!target_audience || !['semua_jemaat', 'per_satelit', 'per_komisi'].includes(target_audience)) {
    return NextResponse.json({ success: false, message: 'Target audience tidak valid' }, { status: 400 });
  }
  if (target_audience === 'per_satelit' && !target_satelit_id) {
    return NextResponse.json({ success: false, message: 'Satelit target wajib dipilih' }, { status: 400 });
  }
  if (target_audience === 'per_komisi' && !target_komisi_id) {
    return NextResponse.json({ success: false, message: 'Komisi target wajib dipilih' }, { status: 400 });
  }

  // 2. RBAC: non-super-admin can only send to their own satelit
  let effectiveSatelitId = target_satelit_id || null;
  if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
    effectiveSatelitId = caller.satelit_id;
    if (target_audience === 'per_satelit' && parseInt(target_satelit_id) !== caller.satelit_id) {
      return NextResponse.json({ success: false, message: 'Akses ditolak: Anda hanya bisa mengirim ke satelit Anda sendiri' }, { status: 403 });
    }
  }

  // 3. DB transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Determine target jemaat — ONLY those who have a pengguna (user account)
    let jemaatIds: number[] = [];

    if (target_audience === 'semua_jemaat') {
      const jemaatQuery = effectiveSatelitId
        ? `SELECT j.id FROM public.jemaat j
           INNER JOIN public.pengguna pg ON pg.jemaat_id = j.id
           WHERE j.status_jemaat = 'Aktif' AND j.is_deleted = false AND j.satelit_id = $1`
        : `SELECT j.id FROM public.jemaat j
           INNER JOIN public.pengguna pg ON pg.jemaat_id = j.id
           WHERE j.status_jemaat = 'Aktif' AND j.is_deleted = false`;
      const jemaatResult = await client.query(jemaatQuery, effectiveSatelitId ? [effectiveSatelitId] : []);
      jemaatIds = jemaatResult.rows.map((r: any) => r.id);
    } else if (target_audience === 'per_satelit') {
      const jemaatResult = await client.query(
        `SELECT j.id FROM public.jemaat j
         INNER JOIN public.pengguna pg ON pg.jemaat_id = j.id
         WHERE j.status_jemaat = 'Aktif' AND j.is_deleted = false AND j.satelit_id = $1`,
        [target_satelit_id]
      );
      jemaatIds = jemaatResult.rows.map((r: any) => r.id);
    } else if (target_audience === 'per_komisi') {
      let komisiQuery = `
        SELECT DISTINCT j.id 
        FROM public.jemaat j
        INNER JOIN public.pengguna pg ON pg.jemaat_id = j.id
        JOIN public.jemaat_komisi jk ON j.id = jk.jemaat_id AND jk.is_active = true
        WHERE j.status_jemaat = 'Aktif' AND j.is_deleted = false AND jk.komisi_id = $1
      `;
      const komisiParams: any[] = [target_komisi_id];
      if (effectiveSatelitId) {
        komisiQuery += ` AND j.satelit_id = $2`;
        komisiParams.push(effectiveSatelitId);
      }
      const jemaatResult = await client.query(komisiQuery, komisiParams);
      jemaatIds = jemaatResult.rows.map((r: any) => r.id);
    }

    if (jemaatIds.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        success: true,
        message: 'Tidak ada jemaat (yang memiliki akun) yang memenuhi kriteria target. Notifikasi tidak dikirim.',
        data: { terkirim: 0, target: 0 },
      });
    }

    // Send push notifications
    let terkirim = 0;
    const finalUrl = url_tujuan || '/';
    for (const jemaatId of jemaatIds) {
      try {
        const sent = await sendPushNotificationToJemaat(jemaatId, judul.trim(), isi_pesan.trim(), finalUrl);
        if (sent) terkirim++;
      } catch (pushErr) {
        console.error(`[Broadcast] Gagal kirim ke Jemaat ID ${jemaatId}:`, pushErr);
      }
    }

    // Log broadcast to database
    const insertQuery = `
      INSERT INTO public.notifikasi_broadcast (
        judul, isi_pesan, target_audience, 
        satelit_id, komisi_id, url_tujuan,
        total_target, total_terkirim, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
    const insertResult = await client.query(insertQuery, [
      judul.trim(),
      isi_pesan.trim(),
      target_audience,
      target_audience === 'per_satelit' ? target_satelit_id : (effectiveSatelitId || null),
      target_audience === 'per_komisi' ? target_komisi_id : null,
      finalUrl,
      jemaatIds.length,
      terkirim,
      caller.user_id,
    ]);

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Notifikasi berhasil dikirim ke ${terkirim} dari ${jemaatIds.length} jemaat.`,
      data: {
        id: insertResult.rows[0].id,
        terkirim,
        target: jemaatIds.length,
      },
    }, { status: 201 });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('API Error [POST /notifikasi/broadcast]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal' }, { status: 500 });
  } finally {
    client.release();
  }
}
