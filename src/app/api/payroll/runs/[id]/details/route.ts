import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import pool from '@/lib/db';

/**
 * Fungsi PPh21 TER Bulanan sesuai PMK 168/2023
 * Kategori A: TK/0, TK/1, K/0
 * Kategori B: TK/2, TK/3, K/1, K/2
 * Kategori C: K/3
 * @returns nominal PPh21 yang harus dipotong per bulan
 */
const getPph21TER = (brutoBulanan: number, statusPtkp: string): { nominal: number; tarif: number; kategori: 'A' | 'B' | 'C' } => {
  const ptkp = (statusPtkp || 'TK/0').toUpperCase().trim();

  // Tentukan Kategori
  let kategori: 'A' | 'B' | 'C';
  if (['TK/0', 'TK/1', 'K/0'].includes(ptkp)) {
    kategori = 'A';
  } else if (['TK/2', 'TK/3', 'K/1', 'K/2'].includes(ptkp)) {
    kategori = 'B';
  } else if (ptkp === 'K/3') {
    kategori = 'C';
  } else {
    kategori = 'A'; // default fallback
  }

  let tarif = 0;

  if (kategori === 'A') {
    // TER Bulanan Kategori A — 44 bracket (PMK 168/2023)
    if      (brutoBulanan <=    5_400_000) tarif = 0.0000;
    else if (brutoBulanan <=    5_650_000) tarif = 0.0025;
    else if (brutoBulanan <=    5_950_000) tarif = 0.0050;
    else if (brutoBulanan <=    6_300_000) tarif = 0.0075;
    else if (brutoBulanan <=    6_750_000) tarif = 0.0100;
    else if (brutoBulanan <=    7_500_000) tarif = 0.0125;
    else if (brutoBulanan <=    8_550_000) tarif = 0.0150;
    else if (brutoBulanan <=    9_650_000) tarif = 0.0175;
    else if (brutoBulanan <=   10_050_000) tarif = 0.0200;
    else if (brutoBulanan <=   10_350_000) tarif = 0.0225;
    else if (brutoBulanan <=   10_700_000) tarif = 0.0250;
    else if (brutoBulanan <=   11_050_000) tarif = 0.0300;
    else if (brutoBulanan <=   11_600_000) tarif = 0.0350;
    else if (brutoBulanan <=   12_500_000) tarif = 0.0400;
    else if (brutoBulanan <=   13_750_000) tarif = 0.0500;
    else if (brutoBulanan <=   15_100_000) tarif = 0.0600;
    else if (brutoBulanan <=   16_950_000) tarif = 0.0700;
    else if (brutoBulanan <=   19_750_000) tarif = 0.0800;
    else if (brutoBulanan <=   24_150_000) tarif = 0.0900;
    else if (brutoBulanan <=   26_450_000) tarif = 0.1000;
    else if (brutoBulanan <=   28_000_000) tarif = 0.1100;
    else if (brutoBulanan <=   30_050_000) tarif = 0.1200;
    else if (brutoBulanan <=   32_400_000) tarif = 0.1300;
    else if (brutoBulanan <=   35_400_000) tarif = 0.1400;
    else if (brutoBulanan <=   39_100_000) tarif = 0.1500;
    else if (brutoBulanan <=   43_850_000) tarif = 0.1600;
    else if (brutoBulanan <=   47_800_000) tarif = 0.1700;
    else if (brutoBulanan <=   51_400_000) tarif = 0.1800;
    else if (brutoBulanan <=   56_300_000) tarif = 0.1900;
    else if (brutoBulanan <=   62_200_000) tarif = 0.2000;
    else if (brutoBulanan <=   68_600_000) tarif = 0.2100;
    else if (brutoBulanan <=   77_500_000) tarif = 0.2200;
    else if (brutoBulanan <=   89_000_000) tarif = 0.2300;
    else if (brutoBulanan <=  103_000_000) tarif = 0.2400;
    else if (brutoBulanan <=  125_000_000) tarif = 0.2500;
    else if (brutoBulanan <=  157_000_000) tarif = 0.2600;
    else if (brutoBulanan <=  206_000_000) tarif = 0.2700;
    else if (brutoBulanan <=  337_000_000) tarif = 0.2800;
    else if (brutoBulanan <=  454_000_000) tarif = 0.2900;
    else if (brutoBulanan <=  550_000_000) tarif = 0.3000;
    else if (brutoBulanan <=  695_000_000) tarif = 0.3100;
    else if (brutoBulanan <=  910_000_000) tarif = 0.3200;
    else if (brutoBulanan <= 1_400_000_000) tarif = 0.3300;
    else                                    tarif = 0.3400;

  } else if (kategori === 'B') {
    // TER Bulanan Kategori B — 40 bracket (PMK 168/2023)
    if      (brutoBulanan <=    6_200_000) tarif = 0.0000;
    else if (brutoBulanan <=    6_500_000) tarif = 0.0025;
    else if (brutoBulanan <=    6_850_000) tarif = 0.0050;
    else if (brutoBulanan <=    7_300_000) tarif = 0.0075;
    else if (brutoBulanan <=    9_200_000) tarif = 0.0100;
    else if (brutoBulanan <=   10_750_000) tarif = 0.0150;
    else if (brutoBulanan <=   11_250_000) tarif = 0.0200;
    else if (brutoBulanan <=   11_600_000) tarif = 0.0250;
    else if (brutoBulanan <=   12_600_000) tarif = 0.0300;
    else if (brutoBulanan <=   13_600_000) tarif = 0.0400;
    else if (brutoBulanan <=   14_950_000) tarif = 0.0500;
    else if (brutoBulanan <=   16_400_000) tarif = 0.0600;
    else if (brutoBulanan <=   18_450_000) tarif = 0.0700;
    else if (brutoBulanan <=   21_850_000) tarif = 0.0800;
    else if (brutoBulanan <=   26_000_000) tarif = 0.0900;
    else if (brutoBulanan <=   27_700_000) tarif = 0.1000;
    else if (brutoBulanan <=   29_350_000) tarif = 0.1100;
    else if (brutoBulanan <=   31_450_000) tarif = 0.1200;
    else if (brutoBulanan <=   33_950_000) tarif = 0.1300;
    else if (brutoBulanan <=   37_100_000) tarif = 0.1400;
    else if (brutoBulanan <=   41_100_000) tarif = 0.1500;
    else if (brutoBulanan <=   45_800_000) tarif = 0.1600;
    else if (brutoBulanan <=   49_500_000) tarif = 0.1700;
    else if (brutoBulanan <=   53_800_000) tarif = 0.1800;
    else if (brutoBulanan <=   58_500_000) tarif = 0.1900;
    else if (brutoBulanan <=   64_000_000) tarif = 0.2000;
    else if (brutoBulanan <=   71_000_000) tarif = 0.2100;
    else if (brutoBulanan <=   80_000_000) tarif = 0.2200;
    else if (brutoBulanan <=   93_000_000) tarif = 0.2300;
    else if (brutoBulanan <=  109_000_000) tarif = 0.2400;
    else if (brutoBulanan <=  129_000_000) tarif = 0.2500;
    else if (brutoBulanan <=  163_000_000) tarif = 0.2600;
    else if (brutoBulanan <=  211_000_000) tarif = 0.2700;
    else if (brutoBulanan <=  374_000_000) tarif = 0.2800;
    else if (brutoBulanan <=  459_000_000) tarif = 0.2900;
    else if (brutoBulanan <=  555_000_000) tarif = 0.3000;
    else if (brutoBulanan <=  704_000_000) tarif = 0.3100;
    else if (brutoBulanan <=  957_000_000) tarif = 0.3200;
    else if (brutoBulanan <= 1_405_000_000) tarif = 0.3300;
    else                                    tarif = 0.3400;

  } else {
    // TER Bulanan Kategori C (K/3) — 41 bracket (PMK 168/2023)
    if      (brutoBulanan <=    6_600_000) tarif = 0.0000;
    else if (brutoBulanan <=    6_950_000) tarif = 0.0025;
    else if (brutoBulanan <=    7_350_000) tarif = 0.0050;
    else if (brutoBulanan <=    7_800_000) tarif = 0.0075;
    else if (brutoBulanan <=    8_850_000) tarif = 0.0100;
    else if (brutoBulanan <=    9_800_000) tarif = 0.0125;
    else if (brutoBulanan <=   10_950_000) tarif = 0.0150;
    else if (brutoBulanan <=   11_200_000) tarif = 0.0175;
    else if (brutoBulanan <=   12_050_000) tarif = 0.0200;
    else if (brutoBulanan <=   12_950_000) tarif = 0.0300;
    else if (brutoBulanan <=   14_150_000) tarif = 0.0400;
    else if (brutoBulanan <=   15_550_000) tarif = 0.0500;
    else if (brutoBulanan <=   17_050_000) tarif = 0.0600;
    else if (brutoBulanan <=   19_500_000) tarif = 0.0700;
    else if (brutoBulanan <=   22_700_000) tarif = 0.0800;
    else if (brutoBulanan <=   26_600_000) tarif = 0.0900;
    else if (brutoBulanan <=   28_100_000) tarif = 0.1000;
    else if (brutoBulanan <=   30_100_000) tarif = 0.1100;
    else if (brutoBulanan <=   32_600_000) tarif = 0.1200;
    else if (brutoBulanan <=   35_400_000) tarif = 0.1300;
    else if (brutoBulanan <=   38_900_000) tarif = 0.1400;
    else if (brutoBulanan <=   43_000_000) tarif = 0.1500;
    else if (brutoBulanan <=   47_400_000) tarif = 0.1600;
    else if (brutoBulanan <=   51_200_000) tarif = 0.1700;
    else if (brutoBulanan <=   55_800_000) tarif = 0.1800;
    else if (brutoBulanan <=   60_400_000) tarif = 0.1900;
    else if (brutoBulanan <=   66_700_000) tarif = 0.2000;
    else if (brutoBulanan <=   74_500_000) tarif = 0.2100;
    else if (brutoBulanan <=   83_200_000) tarif = 0.2200;
    else if (brutoBulanan <=   95_600_000) tarif = 0.2300;
    else if (brutoBulanan <=  110_000_000) tarif = 0.2400;
    else if (brutoBulanan <=  134_000_000) tarif = 0.2500;
    else if (brutoBulanan <=  169_000_000) tarif = 0.2600;
    else if (brutoBulanan <=  221_000_000) tarif = 0.2700;
    else if (brutoBulanan <=  390_000_000) tarif = 0.2800;
    else if (brutoBulanan <=  463_000_000) tarif = 0.2900;
    else if (brutoBulanan <=  561_000_000) tarif = 0.3000;
    else if (brutoBulanan <=  709_000_000) tarif = 0.3100;
    else if (brutoBulanan <=  965_000_000) tarif = 0.3200;
    else if (brutoBulanan <= 1_419_000_000) tarif = 0.3300;
    else                                    tarif = 0.3400;
  }

  return { nominal: Math.round(brutoBulanan * tarif), tarif, kategori };
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const { id: runId } = await params;

    // 1. Ambil data run
    const runData = await pool.query(`SELECT * FROM public.payroll_run WHERE id = $1`, [runId]);
    if (runData.rows.length === 0) return NextResponse.json({ success: false, message: "Run tidak ditemukan" }, { status: 404 });
    const run = runData.rows[0];

    // RBAC: hanya bisa lihat/generate detail run milik unitnya sendiri
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      if (run.satelit_id !== caller.satelit_id) {
        return NextResponse.json({ success: false, message: 'Anda tidak memiliki akses ke run penggajian unit lain.' }, { status: 403 });
      }
    }

    // 2. Cek apakah detail sudah ada
    const existingDetails = await pool.query(`
      SELECT prd.*, p.nama_lengkap, p.status_ptkp
      FROM public.payroll_run_detail prd
      JOIN public.pegawai p ON p.id = prd.pegawai_id
      WHERE prd.run_id = $1
      ORDER BY p.nama_lengkap ASC
    `, [runId]);

    if (existingDetails.rows.length > 0) {
      const detailsWithKomponen = await Promise.all(existingDetails.rows.map(async (detail) => {
        const komponen = await pool.query(`
          SELECT prk.*, pkm.nama_komponen
          FROM public.payroll_run_komponen prk
          JOIN public.payroll_komponen_master pkm ON pkm.id = prk.komponen_id
          WHERE prk.run_detail_id = $1
          ORDER BY prk.tipe ASC, pkm.nama_komponen ASC
        `, [detail.id]);
        return { ...detail, komponen: komponen.rows };
      }));
      return NextResponse.json({ success: true, data: detailsWithKomponen });
    }

    // ==========================================
    // AUTO-GENERATE LOGIC
    // ==========================================
    const pegawais = await pool.query(`
      SELECT p.*, j.nama_jabatan, pt.id as template_id, pt.pph21_method, bm.nama_bank,
             (SELECT pko.bpjs_mode FROM public.pegawai_komponen_override pko WHERE pko.pegawai_id = p.id AND pko.komponen_id IS NULL AND (pko.berlaku_sampai IS NULL OR pko.berlaku_sampai > CURRENT_DATE) ORDER BY pko.id DESC LIMIT 1) as override_bpjs_mode
      FROM public.pegawai p
      LEFT JOIN public.jabatan_pegawai_master j ON j.id = p.jabatan_pegawai_id
      LEFT JOIN public.bank_master bm ON bm.id = p.bank_id
      LEFT JOIN public.payroll_template pt ON pt.jabatan_pegawai_id = j.id AND pt.is_active = true
      WHERE p.satelit_id = $1 AND p.status_pegawai = 'Aktif'
    `, [run.satelit_id]);

    if (pegawais.rows.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    let generatedDetails = [];

    // Gunakan transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const masterBpjsKes = await client.query(`SELECT id FROM public.payroll_komponen_master WHERE nama_komponen ILIKE '%BPJS Kesehatan%' AND tipe = 'Potongan' LIMIT 1`);
      const masterBpjsJht = await client.query(`SELECT id FROM public.payroll_komponen_master WHERE nama_komponen ILIKE '%BPJS Ketenagakerjaan%' AND tipe = 'Potongan' LIMIT 1`);
      const masterPph21 = await client.query(`SELECT id FROM public.payroll_komponen_master WHERE nama_komponen ILIKE '%PPh%' AND tipe = 'Potongan' LIMIT 1`);
      const masterTunjPph21 = await client.query(`SELECT id FROM public.payroll_komponen_master WHERE nama_komponen ILIKE '%Tunjangan PPh21%' AND tipe = 'Penerimaan' LIMIT 1`);

      for (const peg of pegawais.rows) {
        const bpjsMode = peg.override_bpjs_mode || 'ditanggung';
        let gajiPokok = 0;
        
        const newDetail = await client.query(`
          INSERT INTO public.payroll_run_detail (
            run_id, pegawai_id, jabatan_snapshot, gaji_pokok_snapshot, 
            pph21_method_snapshot, bpjs_mode_snapshot, 
            no_rekening_snapshot, nama_bank_snapshot, atas_nama_snapshot
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) RETURNING *
        `, [
          runId, peg.id, peg.nama_jabatan, 0,
          peg.pph21_method || 'Netto', bpjsMode,
          peg.no_rekening, peg.nama_bank, peg.atas_nama_rekening
        ]);
        const detailId = newDetail.rows[0].id;
        
        let totalPenerimaan = 0;
        let totalPotongan = 0;
        let totalBrutoPajak = 0;
        let komponenList = [];

        // Ambil semua komponen aktif master, gabung dengan template_detail (jika ada) dan override
        const allKomponen = await client.query(`
          SELECT 
            pkm.id AS komponen_id, 
            pkm.nama_komponen, 
            pkm.tipe, 
            pkm.calculation_type, 
            pkm.is_employer_portion, 
            pkm.global_rate_field,
            ptd.nominal_default,
            COALESCE(ptd.is_active, false) AS is_active_template,
            (
              SELECT nominal_override 
              FROM public.pegawai_komponen_override pko 
              WHERE pko.pegawai_id = $1 
                AND pko.komponen_id = pkm.id 
                AND (pko.berlaku_sampai IS NULL OR pko.berlaku_sampai > CURRENT_DATE) 
              ORDER BY pko.id DESC LIMIT 1
            ) AS nominal_override,
            EXISTS (
              SELECT 1 
              FROM public.pegawai_komponen_override pko 
              WHERE pko.pegawai_id = $1 
                AND pko.komponen_id = pkm.id 
                AND (pko.berlaku_sampai IS NULL OR pko.berlaku_sampai > CURRENT_DATE)
            ) AS has_override
          FROM public.payroll_komponen_master pkm
          LEFT JOIN public.payroll_template_detail ptd ON ptd.komponen_id = pkm.id AND ptd.template_id = $2
          WHERE pkm.is_active = true
          ORDER BY pkm.urutan ASC
        `, [peg.id, peg.template_id || 0]);

        const activeKomponen = allKomponen.rows.filter((k: any) => k.is_active_template || k.has_override);

        if (activeKomponen.length > 0) {
          // Pass 1: Hitung semua nominal flat & temukan Gaji Pokok berdasarkan nama
          for (const tk of activeKomponen) {
            if (tk.calculation_type !== 'pct_global_bpjs') {
              const nominal = tk.has_override && tk.nominal_override !== null 
                ? Number(tk.nominal_override) 
                : Number(tk.nominal_default || 0);

              tk.calculated_nominal = nominal;
              // Gaji Pokok = flat_nominal Penerimaan yang namanya mengandung 'gaji pokok' atau 'honor'
              const nama = tk.nama_komponen.toLowerCase();
              if (tk.tipe === 'Penerimaan' && (nama.includes('gaji pokok') || nama.includes('honor'))) {
                  gajiPokok = nominal;
              }
            } else {
              tk.calculated_nominal = 0; // Akan dihitung di Pass 2
            }
          }

          console.log(`[PAYROLL DEBUG] ${peg.nama_lengkap} | template=${peg.template_id} | gajiPokok=${gajiPokok} | bpjsMode=${bpjsMode}`);

          // Setelah Pass 1 selesai, update gaji_pokok_snapshot dengan nilai sebenarnya
          await client.query(
            `UPDATE public.payroll_run_detail SET gaji_pokok_snapshot = $1 WHERE id = $2`,
            [gajiPokok, detailId]
          );

          // Rate BPJS sesuai global_rate_field di DB (PMK & aturan BPJS berlaku)
          const bpjsRateMap: Record<string, number> = {
            // === Karyawan ===
            'bpjs_kes_employee_pct':    0.01,   // 1%   - BPJS Kes Karyawan
            'bpjs_tk_jht_employee_pct': 0.02,   // 2%   - JHT Karyawan
            'bpjs_tk_jp_employee_pct':  0.01,   // 1%   - JP Karyawan
            'bpjs_jkp_employee_pct':    0.0014, // 0.14% - JKP Karyawan (PP 37/2021)
            // === Gereja / Employer ===
            'bpjs_kes_employer_pct':    0.04,   // 4%    - BPJS Kes Gereja
            'bpjs_tk_jht_employer_pct': 0.037,  // 3.7%  - JHT Gereja
            'bpjs_tk_jp_employer_pct':  0.02,   // 2%    - JP Gereja
            'bpjs_tk_jkk_pct':          0.0024, // 0.24% - JKK Gereja
            'bpjs_tk_jkm_pct':          0.003,  // 0.3%  - JKM Gereja
            'bpjs_jkp_employer_pct':    0.0022, // 0.22% - JKP Gereja (PP 37/2021)
          };

          // Pass 2: Hitung BPJS & simpan semua komponen
          for (const tk of activeKomponen) {
             // PPh 21 DILEWATI di sini — dihitung otomatis oleh blok TER di bawah
             // Mencegah entry nominal 0 dari template_detail terinsert
             if ((tk.nama_komponen || '').toLowerCase().includes('pph')) continue;

             const isEmployer = tk.is_employer_portion === true;
             let nominal = 0;

             if (tk.calculation_type === 'pct_global_bpjs') {
                if (bpjsMode === 'mandiri') continue;
                
                const rate = bpjsRateMap[tk.global_rate_field] ?? 0;
                nominal = gajiPokok * rate;
                
                console.log(`[BPJS DEBUG] ${tk.nama_komponen} | field=${tk.global_rate_field} | rate=${rate} | gajiPokok=${gajiPokok} | nominal=${nominal}`);
             } else {
                 nominal = tk.calculated_nominal;
             }

             // Hanya tambahkan ke total pegawai jika bukan beban gereja
             if (!isEmployer && tk.tipe === 'Penerimaan') {
                 totalPenerimaan += nominal;
                 totalBrutoPajak += nominal;
             } else if (!isEmployer && tk.tipe === 'Potongan') {
                 totalPotongan += nominal;
             }

             const newKomp = await client.query(`
                INSERT INTO public.payroll_run_komponen (
                  run_detail_id, komponen_id, tipe, is_employer_portion, nominal, calculation_snapshot
                ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
             `, [detailId, tk.komponen_id, tk.tipe, isEmployer ?? false, nominal, JSON.stringify({ source: tk.has_override ? 'override' : 'template', gajiPokok, rate: bpjsRateMap[tk.global_rate_field] })]);
             
             komponenList.push({ ...newKomp.rows[0], nama_komponen: tk.nama_komponen });
          }
        }

        const { nominal: nominalPph21, tarif: tarifPph21, kategori: kategoriTER } = getPph21TER(totalBrutoPajak, peg.status_ptkp || 'TK/0');
        if (nominalPph21 > 0 && peg.is_kena_pph21 !== false && masterPph21.rows.length > 0) {
           const isGrossUp = peg.pph21_method === 'Gross Up';
           const isDitanggung = peg.pph21_method === 'Ditanggung Gereja';
           const pph21Snapshot = JSON.stringify({
             source: 'pph21_ter',
             statusPtkp: peg.status_ptkp || 'TK/0',
             kategoriTER,
             tarif: tarifPph21,
             bruto: totalBrutoPajak,
           });
           
           if (isGrossUp && masterTunjPph21.rows.length > 0) {
               totalPenerimaan += nominalPph21;
               const kt1 = await client.query(`INSERT INTO public.payroll_run_komponen (run_detail_id, komponen_id, tipe, is_employer_portion, nominal, calculation_snapshot) VALUES ($1, $2, 'Penerimaan', false, $3, $4) RETURNING *`, [detailId, masterTunjPph21.rows[0].id, nominalPph21, pph21Snapshot]);
               komponenList.push({ ...kt1.rows[0], nama_komponen: "Tunjangan PPh21" });
           }
           
           if (isDitanggung) {
               const kp1 = await client.query(`INSERT INTO public.payroll_run_komponen (run_detail_id, komponen_id, tipe, is_employer_portion, nominal, calculation_snapshot) VALUES ($1, $2, 'Potongan', true, $3, $4) RETURNING *`, [detailId, masterPph21.rows[0].id, nominalPph21, pph21Snapshot]);
               komponenList.push({ ...kp1.rows[0], nama_komponen: "Beban PPh21 (Ditanggung Gereja)" });
           } else {
               totalPotongan += nominalPph21;
               const kp2 = await client.query(`INSERT INTO public.payroll_run_komponen (run_detail_id, komponen_id, tipe, is_employer_portion, nominal, calculation_snapshot) VALUES ($1, $2, 'Potongan', false, $3, $4) RETURNING *`, [detailId, masterPph21.rows[0].id, nominalPph21, pph21Snapshot]);
               komponenList.push({ ...kp2.rows[0], nama_komponen: "Potongan PPh21" });
           }
        }

        const totalNetto = totalPenerimaan - totalPotongan;

        const finalDetail = await client.query(`
          UPDATE public.payroll_run_detail
          SET total_penerimaan = $1, total_potongan = $2, total_netto = $3
          WHERE id = $4
          RETURNING *
        `, [totalPenerimaan, totalPotongan, totalNetto, detailId]);

        generatedDetails.push({ 
          ...finalDetail.rows[0], 

          nama_lengkap: peg.nama_lengkap, 
          status_ptkp: peg.status_ptkp,
          komponen: komponenList 
        });
      }

      const totalSemuaBruto = generatedDetails.reduce((acc, d) => acc + Number(d.total_penerimaan), 0);
      const totalSemuaPotongan = generatedDetails.reduce((acc, d) => acc + Number(d.total_potongan), 0);
      const totalSemuaNetto = generatedDetails.reduce((acc, d) => acc + Number(d.total_netto), 0);

      await client.query(`
        UPDATE public.payroll_run
        SET total_bruto = $1, total_potongan = $2, total_netto = $3, jumlah_pegawai = $4
        WHERE id = $5
      `, [totalSemuaBruto, totalSemuaPotongan, totalSemuaNetto, generatedDetails.length, runId]);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, data: generatedDetails });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, message: "Internal Server Error", error: error.message }, { status: 500 });
  }
}
