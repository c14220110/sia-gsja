import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

/**
 * GET /api/pegawai/[id]/kompensasi
 * 
 * Mengambil data kompensasi individu pegawai.
 * Menggabungkan data dari template jabatan + override individu dari pegawai_komponen_override.
 * 
 * Response: {
 *   pegawai: { id, nama_lengkap, jabatan, template_id },
 *   template_info: { nama_template, pph21_method },
 *   bpjs_mode_override: "ditanggung" | "mandiri" | null,
 *   komponen: [
 *     { komponen_id, nama_komponen, tipe, calculation_type, is_employer_portion,
 *       nominal_template, nominal_override, nominal_aktif, source, is_active_template }
 *   ]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('pegawai_view')) {
    return NextResponse.json({ success: false, message: 'Akses Ditolak' }, { status: 403 });
  }

  const { id: idStr } = await params;
  const pegawaiId = parseInt(idStr);
  if (isNaN(pegawaiId)) {
    return NextResponse.json({ success: false, message: 'ID tidak valid' }, { status: 400 });
  }

  try {
    // 1. Ambil data pegawai + jabatan + template
    const pegawaiRes = await pool.query(`
      SELECT 
        p.id, p.nama_lengkap, p.jabatan_pegawai_id, p.satelit_id,
        jpm.nama_jabatan,
        pt.id as template_id, pt.nama_template, pt.pph21_method
      FROM public.pegawai p
      LEFT JOIN public.jabatan_pegawai_master jpm ON jpm.id = p.jabatan_pegawai_id
      LEFT JOIN public.payroll_template pt ON pt.jabatan_pegawai_id = p.jabatan_pegawai_id AND pt.is_active = true
      WHERE p.id = $1
    `, [pegawaiId]);

    if (pegawaiRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Pegawai tidak ditemukan' }, { status: 404 });
    }
    const peg = pegawaiRes.rows[0];

    // 2. Ambil semua komponen master (aktif)
    const komponenRes = await pool.query(`
      SELECT id, nama_komponen, tipe, calculation_type, is_employer_portion, global_rate_field, is_system, urutan
      FROM public.payroll_komponen_master
      WHERE is_active = true
      ORDER BY urutan ASC, id ASC
    `);

    // 3. Ambil template detail (jika ada template untuk jabatan ini)
    let templateDetailMap: Record<number, { nominal_default: number; is_active: boolean; satuan: string }> = {};
    if (peg.template_id) {
      const templateDetailRes = await pool.query(`
        SELECT komponen_id, nominal_default, is_active, satuan
        FROM public.payroll_template_detail
        WHERE template_id = $1
      `, [peg.template_id]);

      for (const td of templateDetailRes.rows) {
        templateDetailMap[td.komponen_id] = {
          nominal_default: Number(td.nominal_default),
          is_active: td.is_active,
          satuan: td.satuan,
        };
      }
    }

    // 4. Ambil override individu yang berlaku (berlaku_sampai IS NULL = masih berlaku)
    const overrideRes = await pool.query(`
      SELECT komponen_id, nominal_override, bpjs_mode, catatan
      FROM public.pegawai_komponen_override
      WHERE pegawai_id = $1 AND (berlaku_sampai IS NULL OR berlaku_sampai >= CURRENT_DATE)
      ORDER BY id DESC
    `, [pegawaiId]);

    // Bongkar terus bikin pemetaan override-nya
    // komponen_id = NULL → bpjs_mode override (global level)
    const overrideMap: Record<number, { nominal_override: number | null; catatan: string | null }> = {};
    let bpjsModeOverride: string | null = null;

    for (const ov of overrideRes.rows) {
      if (ov.komponen_id === null) {
        // Global override (bpjs_mode)
        bpjsModeOverride = ov.bpjs_mode;
      } else {
        // Kalau sudah ada di map, skip (karena ORDER BY id DESC = yang terbaru duluan)
        if (!overrideMap[ov.komponen_id]) {
          overrideMap[ov.komponen_id] = {
            nominal_override: ov.nominal_override !== null ? Number(ov.nominal_override) : null,
            catatan: ov.catatan,
          };
        }
      }
    }

    // 5. Merge semua data
    const komponen = komponenRes.rows.map((k: any) => {
      const tplDetail = templateDetailMap[k.id];
      const override = overrideMap[k.id];

      const nominal_template = tplDetail?.nominal_default ?? 0;
      const nominal_override = override?.nominal_override ?? null;
      const is_active_template = tplDetail?.is_active ?? false;

      // Nominal aktif: override > template
      const nominal_aktif = nominal_override !== null ? nominal_override : nominal_template;
      const source = nominal_override !== null ? 'override' : 'template';

      return {
        komponen_id: k.id,
        nama_komponen: k.nama_komponen,
        tipe: k.tipe,
        calculation_type: k.calculation_type,
        is_employer_portion: k.is_employer_portion ?? false,
        global_rate_field: k.global_rate_field,
        is_system: k.is_system,
        urutan: k.urutan,
        nominal_template,
        nominal_override,
        nominal_aktif,
        source,
        is_active_template,
        catatan: override?.catatan ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        pegawai: {
          id: peg.id,
          nama_lengkap: peg.nama_lengkap,
          jabatan: peg.nama_jabatan,
          template_id: peg.template_id,
        },
        template_info: peg.template_id ? {
          nama_template: peg.nama_template,
          pph21_method: peg.pph21_method,
        } : null,
        bpjs_mode_override: bpjsModeOverride,
        komponen,
      }
    });
  } catch (error: any) {
    console.error('GET /api/pegawai/[id]/kompensasi error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/pegawai/[id]/kompensasi
 * 
 * Menyimpan override kompensasi individu pegawai.
 * 
 * Body: {
 *   overrides: [
 *     { komponen_id: number, nominal_override: number }
 *   ],
 *   bpjs_mode: "ditanggung" | "mandiri" | "tunjangan_saja" | null
 * }
 * 
 * Logic:
 * 1. Soft-close semua override lama (set berlaku_sampai = CURRENT_DATE)
 * 2. INSERT override baru (berlaku_dari = CURRENT_DATE, berlaku_sampai = NULL)
 * 3. Audit: created_by = caller.user_id
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('pegawai_kompensasi_manage')) {
    return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin mengelola kompensasi pegawai' }, { status: 403 });
  }

  const { id: idStr } = await params;
  const pegawaiId = parseInt(idStr);
  if (isNaN(pegawaiId)) {
    return NextResponse.json({ success: false, message: 'ID tidak valid' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Request body tidak valid (JSON).' }, { status: 400 });
  }

  const { overrides, bpjs_mode } = body;

  if (!Array.isArray(overrides)) {
    return NextResponse.json({ success: false, message: 'overrides harus berupa array.' }, { status: 400 });
  }

  // Pengecekan pakar IDOR
  const pegCheck = await pool.query(
    `SELECT id, satelit_id FROM public.pegawai WHERE id = $1`, [pegawaiId]
  );
  if (pegCheck.rows.length === 0) {
    return NextResponse.json({ success: false, message: 'Pegawai tidak ditemukan' }, { status: 404 });
  }
  if (!caller.is_super_admin && pegCheck.rows[0].satelit_id !== caller.satelit_id) {
    return NextResponse.json({ success: false, message: 'Akses ditolak: pegawai bukan milik satelit Anda' }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Soft-close semua override yang berlaku (set berlaku_sampai = hari ini)
    await client.query(`
      UPDATE public.pegawai_komponen_override
      SET berlaku_sampai = CURRENT_DATE
      WHERE pegawai_id = $1 AND (berlaku_sampai IS NULL OR berlaku_sampai > CURRENT_DATE)
    `, [pegawaiId]);

    // 2. Insert override baru per-komponen
    for (const ov of overrides) {
      if (!ov.komponen_id || ov.nominal_override === undefined || ov.nominal_override === null) continue;
      if (typeof ov.nominal_override !== 'number' || ov.nominal_override < 0) continue;

      await client.query(`
        INSERT INTO public.pegawai_komponen_override
          (pegawai_id, komponen_id, nominal_override, berlaku_dari, catatan, created_by)
        VALUES ($1, $2, $3, CURRENT_DATE, $4, $5)
      `, [
        pegawaiId,
        ov.komponen_id,
        ov.nominal_override,
        ov.catatan || null,
        caller.user_id,
      ]);
    }

    // 3. Insert bpjs_mode override jika diberikan
    if (bpjs_mode) {
      await client.query(`
        INSERT INTO public.pegawai_komponen_override
          (pegawai_id, komponen_id, bpjs_mode, berlaku_dari, created_by)
        VALUES ($1, NULL, $2, CURRENT_DATE, $3)
      `, [
        pegawaiId,
        bpjs_mode,
        caller.user_id,
      ]);
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Kompensasi individu berhasil disimpan.',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('PUT /api/pegawai/[id]/kompensasi error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
