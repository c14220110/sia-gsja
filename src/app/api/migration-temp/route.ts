import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller || !caller.is_super_admin) {
    return NextResponse.json({ success: false, message: 'Forbidden: Super Admin only' }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query('ALTER TABLE public.permohonan_layanan_pastoral ADD COLUMN IF NOT EXISTS kegiatan_id integer;');
    try {
        await client.query('ALTER TABLE public.permohonan_layanan_pastoral ADD CONSTRAINT permohonan_kegiatan_fk FOREIGN KEY (kegiatan_id) REFERENCES public.kegiatan(id) ON DELETE SET NULL;');
    } catch(e) {}
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}
