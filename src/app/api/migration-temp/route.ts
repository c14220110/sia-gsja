import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
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
