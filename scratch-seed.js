const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/sia_gsja' });

async function run() {
  try {
    // 1. Cek Satelit
    const satRes = await pool.query("SELECT id FROM public.satelit LIMIT 1");
    if (satRes.rows.length === 0) throw new Error("No satelit found");
    const satelitId = satRes.rows[0].id;

    // 2. Buat RA Baru
    const raRes = await pool.query(`
      INSERT INTO public.anggaran_tahunan (satelit_id, kode_dokumen, nama_rancangan, tahun, total_pengajuan, total_disetujui, status)
      VALUES ($1, 'RA-2026-TEST', 'Anggaran Gaji Test 2026', 2026, 100000000, 100000000, 'Disetujui')
      RETURNING id;
    `, [satelitId]);
    const raId = raRes.rows[0].id;

    // 3. Pastikan Komponen Master ada
    // BPJS & PPh21 system components
    await pool.query(`
      INSERT INTO public.payroll_komponen_master (nama_komponen, tipe, calculation_type, is_system) VALUES 
      ('BPJS Kesehatan (Karyawan)', 'Potongan', 'pct_global_bpjs', true),
      ('BPJS Ketenagakerjaan (Karyawan)', 'Potongan', 'pct_global_bpjs', true),
      ('Beban BPJS Kesehatan (Gereja)', 'Potongan', 'pct_global_bpjs', true),
      ('Beban BPJS Ketenagakerjaan (Gereja)', 'Potongan', 'pct_global_bpjs', true),
      ('Potongan PPh21', 'Potongan', 'flat_nominal', true),
      ('Tunjangan PPh21', 'Penerimaan', 'flat_nominal', true),
      ('Beban PPh21 (Ditanggung Gereja)', 'Potongan', 'flat_nominal', true)
      ON CONFLICT DO NOTHING;
    `);

    // Komponen tambahan
    await pool.query(`
      INSERT INTO public.payroll_komponen_master (nama_komponen, tipe, calculation_type, is_system, is_active)
      VALUES 
        ('Tunjangan Makan', 'Penerimaan', 'flat_nominal', false, true),
        ('Tunjangan Transport', 'Penerimaan', 'flat_nominal', false, true),
        ('Potongan Koperasi', 'Potongan', 'flat_nominal', false, true)
      ON CONFLICT DO NOTHING;
    `);

    const allKomp = await pool.query("SELECT id, nama_komponen FROM public.payroll_komponen_master");
    const getKId = (name) => allKomp.rows.find(k => k.nama_komponen === name)?.id;
    const tmId = getKId('Tunjangan Makan') || 1;
    const ttId = getKId('Tunjangan Transport') || 2;
    const pkId = getKId('Potongan Koperasi') || 3;

    // 4. Jabatan (dari SQL user: 2=Gembala Sidang Pusat, 6=Staf Administrasi)
    // 5. Template Gaji
    await pool.query(`DELETE FROM public.payroll_template_detail WHERE template_id IN (SELECT id FROM public.payroll_template WHERE jabatan_pegawai_id IN (2, 6))`);
    await pool.query(`DELETE FROM public.payroll_template WHERE jabatan_pegawai_id IN (2, 6)`);

    // Template 1: Gembala Sidang Pusat (id 2) -> PPh21 Gross Up
    const t1 = await pool.query(`
      INSERT INTO public.payroll_template (jabatan_pegawai_id, nama_template, pph21_method)
      VALUES (2, 'Template Gembala Pusat', 'Gross Up') RETURNING id
    `);
    // Template 2: Staf Administrasi (id 6) -> PPh21 Netto (dipotong langsung)
    const t2 = await pool.query(`
      INSERT INTO public.payroll_template (jabatan_pegawai_id, nama_template, pph21_method)
      VALUES (6, 'Template Staf Admin', 'Netto') RETURNING id
    `);

    // Isi detail template
    await pool.query(`
      INSERT INTO public.payroll_template_detail (template_id, komponen_id, default_nominal) VALUES
      ($1, $3, 1000000), -- Tunj Makan 1jt Gembala
      ($1, $4, 500000),  -- Tunj Transport 500k Gembala
      ($2, $3, 500000),  -- Tunj Makan 500k Staf
      ($2, $5, 100000)   -- Pot. Koperasi 100k Staf
    `, [t1.rows[0].id, t2.rows[0].id, tmId, ttId, pkId]);

    // 6. Buat 2 Pegawai
    await pool.query(`DELETE FROM public.pegawai WHERE nik IN ('1234567890123456', '6543210987654321')`);
    
    // Asumsi bank_id = 1, dept_id = 1
    const bankRes = await pool.query("SELECT id FROM public.bank_master LIMIT 1");
    const bankId = bankRes.rows.length ? bankRes.rows[0].id : null;
    const deptRes = await pool.query("SELECT id FROM public.departemen LIMIT 1");
    const deptId = deptRes.rows.length ? deptRes.rows[0].id : null;

    // Pegawai 1: Gembala
    await pool.query(`
      INSERT INTO public.pegawai (satelit_id, nama_lengkap, nik, jabatan_pegawai_id, departemen_id, status_pegawai, is_kena_pph21, status_ptkp, gaji_pokok, no_rekening, bank_id, atas_nama_rekening)
      VALUES ($1, 'Pdt. Budi Santoso', '1234567890123456', 2, $2, 'Aktif', true, 'K/1', 15000000, '12345678', $3, 'Budi Santoso')
    `, [satelitId, deptId, bankId]);

    // Pegawai 2: Staf
    await pool.query(`
      INSERT INTO public.pegawai (satelit_id, nama_lengkap, nik, jabatan_pegawai_id, departemen_id, status_pegawai, is_kena_pph21, status_ptkp, gaji_pokok, no_rekening, bank_id, atas_nama_rekening)
      VALUES ($1, 'Siti Aminah', '6543210987654321', 6, $2, 'Aktif', true, 'TK/0', 5000000, '87654321', $3, 'Siti Aminah')
    `, [satelitId, deptId, bankId]);

    console.log("SUCCESS!");
    console.log("RA ID:", raId);
    console.log("Satelit ID:", satelitId);

  } catch(e) {
    console.error("ERROR DB SETUP:", e);
  } finally {
    pool.end();
  }
}
run();
