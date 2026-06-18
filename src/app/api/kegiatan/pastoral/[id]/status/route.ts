import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller || caller.role_name?.toLowerCase() === 'jemaat') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, catatan_penyelesaian, alasan_pembatalan } = body;

    if (!status) {
      return NextResponse.json({ success: false, message: 'Status wajib diisi!' }, { status: 400 });
    }

    // Permission: cek role caller dari JWT (tidak perlu query tambahan)
    const callerRole = (caller.role_name || '').toUpperCase();
    const isSekretaris = ['SEKRETARIS_PUSAT', 'SUPER_ADMIN'].includes(callerRole);
    const isMajelisOrGembala = ['MAJELIS', 'GEMBALA_SIDANG', 'GEMBALA_SATELIT'].includes(callerRole);

    // Sekretaris boleh batalkan siapapun
    // Majelis/Gembala hanya boleh batalkan tiket yang ia adalah PJ-nya
    if (status === 'Dibatalkan') {
      if (!isSekretaris && !isMajelisOrGembala) {
        return NextResponse.json({ success: false, message: 'Anda tidak memiliki hak untuk membatalkan tiket.' }, { status: 403 });
      }
      if (!isSekretaris && isMajelisOrGembala) {
        const pjCheck = await pool.query(`
          SELECT 1 FROM public.permohonan_layanan_pastoral
          WHERE id = $1 AND penanggung_jawab_id = $2
        `, [id, caller.user_id]);
        if (pjCheck.rows.length === 0) {
          return NextResponse.json({ success: false, message: 'Anda hanya dapat membatalkan tiket yang Anda tangani.' }, { status: 403 });
        }
      }
    }
    // Majelis/Gembala hanya boleh Ditindaklanjuti & Selesai
    if ((status === 'Ditindaklanjuti' || status === 'Selesai') && !isMajelisOrGembala) {
      return NextResponse.json({ success: false, message: 'Hanya Majelis/Gembala penanggung jawab yang dapat memperbarui status ini.' }, { status: 403 });
    }
    // Untuk Ditindaklanjuti & Selesai: hanya penanggung jawab tiket ini yang boleh
    if ((status === 'Ditindaklanjuti' || status === 'Selesai') && isMajelisOrGembala) {
      const pjRes = await pool.query(`
        SELECT 1 FROM public.permohonan_layanan_pastoral
        WHERE id = $1 AND penanggung_jawab_id = $2
      `, [id, caller.user_id]);
      if (pjRes.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Anda bukan penanggung jawab tiket ini.' }, { status: 403 });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get current ticket state
      const checkRes = await client.query('SELECT status_permohonan FROM public.permohonan_layanan_pastoral WHERE id = $1 FOR UPDATE', [id]);
      if (checkRes.rows.length === 0) {
        throw new Error('Tiket tidak ditemukan');
      }
      
      const statusSebelumnya = checkRes.rows[0].status_permohonan;
      if (statusSebelumnya === status) {
        throw new Error('Status sudah ' + status);
      }

      // 2. Build Update Query based on new status
      let updateQuery = `UPDATE public.permohonan_layanan_pastoral SET status_permohonan = $1, updated_at = CURRENT_TIMESTAMP`;
      const queryParams: any[] = [status, id];
      let paramIdx = 3;

      if (status === 'Ditindaklanjuti') {
        updateQuery += `, waktu_ditindaklanjuti = CURRENT_TIMESTAMP`;
      } else if (status === 'Selesai') {
        if (!catatan_penyelesaian) throw new Error('Catatan penyelesaian wajib diisi!');
        updateQuery += `, waktu_selesai = CURRENT_TIMESTAMP, catatan_penyelesaian = $${paramIdx}`;
        queryParams.splice(2, 0, catatan_penyelesaian);
        paramIdx++;
      } else if (status === 'Dibatalkan') {
        if (!alasan_pembatalan) throw new Error('Alasan pembatalan wajib diisi!');
        updateQuery += `, alasan_pembatalan = $${paramIdx}, waktu_dibatalkan = CURRENT_TIMESTAMP`;
        queryParams.splice(2, 0, alasan_pembatalan);
        paramIdx++;
      }

      updateQuery += ` WHERE id = $2`;
      await client.query(updateQuery, queryParams);

      // 3. Insert Audit Log
      // Catatan: suffix aktor tidak ditulis hardcode karena nama_pengubah sudah muncul
      // otomatis di frontend dari JOIN jemaat.nama_lengkap pada GET route.
      let catatanLog = `Status diubah menjadi ${status}`;
      if (status === 'Ditindaklanjuti') catatanLog = `Pelayanan telah ditindaklanjuti oleh PIC`;
      else if (status === 'Selesai') catatanLog = `Diselesaikan: ${catatan_penyelesaian}`;
      else if (status === 'Dibatalkan') catatanLog = `Dibatalkan: ${alasan_pembatalan}`;

      const insertLog = `
        INSERT INTO public.permohonan_layanan_audit_log 
        (permohonan_id, status_sebelumnya, status_baru, diubah_oleh_id, catatan_perubahan)
        VALUES ($1, $2, $3, $4, $5)
      `;
      await client.query(insertLog, [id, statusSebelumnya, status, caller.user_id, catatanLog]);

      await client.query('COMMIT');

      return NextResponse.json({ success: true, message: `Status berhasil diubah menjadi ${status}` });
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.message === 'Tiket tidak ditemukan' || err.message.startsWith('Status sudah')) {
         return NextResponse.json({ success: false, message: err.message }, { status: 400 });
      }
      if (err.message.includes('wajib diisi')) {
         return NextResponse.json({ success: false, message: err.message }, { status: 400 });
      }
      throw err;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('API Error [PATCH /kegiatan/pastoral/[id]/status]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal', error: error.message }, { status: 500 });
  }
}
