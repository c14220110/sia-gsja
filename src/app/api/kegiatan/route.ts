import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const satelitId = searchParams.get('satelit_id') || '';
  const penyelenggara = searchParams.get('penyelenggara') || '';
  const statusKegiatan = searchParams.get('status') || '';
  const jenisKegiatan = searchParams.get('jenis_kegiatan_id') || '';
  const filterTanggal = searchParams.get('tanggal') || 'Bulan Ini';
  const startDate = searchParams.get('start_date') || '';
  const endDate = searchParams.get('end_date') || '';
  
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    let whereClauses: string[] = [];
    let values: any[] = [];
    let paramIndex = 1;

    // 1. Search Query
    if (search) {
      whereClauses.push(`(k.nama_kegiatan ILIKE $${paramIndex} OR k.kode_kegiatan ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    // 2. Satelit
    if (satelitId) {
      whereClauses.push(`k.satelit_id = $${paramIndex}`);
      values.push(satelitId);
      paramIndex++;
    }

    // 3. Penyelenggara (Merge Komisi & Departemen)
    if (penyelenggara) {
      if (penyelenggara.startsWith('dept_')) {
        whereClauses.push(`k.departemen_id = $${paramIndex}`);
        values.push(penyelenggara.replace('dept_', ''));
        paramIndex++;
      } else if (penyelenggara.startsWith('komisi_')) {
        whereClauses.push(`k.komisi_id = $${paramIndex}`);
        values.push(penyelenggara.replace('komisi_', ''));
        paramIndex++;
      }
    }

    // 4. Jenis Kegiatan
    if (jenisKegiatan) {
      whereClauses.push(`k.jenis_kegiatan_id = $${paramIndex}`);
      values.push(jenisKegiatan);
      paramIndex++;
    }

    // 5. Rentang Waktu (Tanggal)
    if (filterTanggal === 'Bulan Ini') {
      whereClauses.push(`date_trunc('month', k.tanggal_mulai) = date_trunc('month', CURRENT_DATE)`);
    } else if (filterTanggal === 'Minggu Ini') {
      whereClauses.push(`k.tanggal_mulai >= date_trunc('week', CURRENT_DATE) AND k.tanggal_mulai < date_trunc('week', CURRENT_DATE) + interval '7 days'`);
    } else if (filterTanggal === 'Hari Ini') {
      whereClauses.push(`k.tanggal_mulai = CURRENT_DATE`);
    } else if (filterTanggal === 'Custom' && startDate && endDate) {
      whereClauses.push(`k.tanggal_mulai >= $${paramIndex} AND k.tanggal_mulai <= $${paramIndex + 1}`);
      values.push(startDate, endDate);
      paramIndex += 2;
    }

    // 6. Filter Berdasarkan Status Kegiatan Murni (Ditambah Sihir Tanggal Sinkron UX)
    if (statusKegiatan === 'Menunggu LPJ') {
      whereClauses.push(`COALESCE(k.tanggal_selesai, k.tanggal_mulai) < CURRENT_DATE AND lpj.kegiatan_id IS NULL AND k.status_kegiatan NOT IN ('Dibatalkan', 'Draft', 'Selesai')`);
    } else if (statusKegiatan === 'Ongoing') {
      whereClauses.push(`CURRENT_DATE BETWEEN k.tanggal_mulai AND COALESCE(k.tanggal_selesai, k.tanggal_mulai) AND lpj.kegiatan_id IS NULL AND k.status_kegiatan NOT IN ('Dibatalkan', 'Draft', 'Selesai')`);
    } else if (statusKegiatan === 'Akan Datang') {
      whereClauses.push(`k.tanggal_mulai >= CURRENT_DATE AND k.status_kegiatan NOT IN ('Dibatalkan', 'Draft', 'Selesai')`);
    } else if (statusKegiatan) {
      whereClauses.push(`k.status_kegiatan = $${paramIndex}`);
      values.push(statusKegiatan);
      paramIndex++;
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Fetch total count for pagination (Need left join lpj if Menunggu LPJ is checked, but safely we can join lpj for count too)
    const joinClauses = `
      LEFT JOIN public.jenis_kegiatan jk ON k.jenis_kegiatan_id = jk.id
      LEFT JOIN public.satelit s ON k.satelit_id = s.id
      LEFT JOIN public.departemen d ON k.departemen_id = d.id
      LEFT JOIN public.komisi kom ON k.komisi_id = kom.id
      LEFT JOIN public.kegiatan_lpj lpj ON k.id = lpj.kegiatan_id
      LEFT JOIN public.pengurus pengurus ON k.pic_pengurus_id = pengurus.id
      LEFT JOIN public.jemaat pic_person ON pengurus.jemaat_id = pic_person.id
    `;

    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT k.id) FROM public.kegiatan k ${joinClauses} ${whereString}`,
      values
    );
    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Fetch data with JOINs
    const query = `
      SELECT 
        k.id,
        k.kode_kegiatan,
        k.nama_kegiatan,
        k.tanggal_mulai,
        k.tanggal_selesai,
        k.waktu_mulai,
        k.waktu_selesai,
        k.lokasi_kegiatan,
        k.status_kegiatan,
        k.is_published,
        k.butuh_registrasi,
        k.url_banner,
        k.frekuensi_kegiatan,
        k.satelit_id,
        k.komisi_id,
        k.departemen_id,
        jk.nama_jenis_kegiatan,
        jk.kategori,
        s.nama_satelit,
        d.nama_departemen,
        kom.nama_komisi,
        pic_person.nama_lengkap AS pic_name,
        lpj.kegiatan_id AS is_lpj_submitted
      FROM public.kegiatan k
      ${joinClauses}
      ${whereString}
      ORDER BY k.tanggal_mulai ASC, k.waktu_mulai ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataResult = await pool.query(query, [...values, limit, offset]);

    // Fetch counts for cards
    // 1. Total kegiatan bulan ini
    const countBulanIniResult = await pool.query(`
      SELECT COUNT(*) as total FROM public.kegiatan 
      WHERE date_trunc('month', tanggal_mulai) = date_trunc('month', CURRENT_DATE)
    `);
    const totalBulanIni = parseInt(countBulanIniResult.rows[0].total, 10);

    // 2. Kegiatan mendatang 7 hari
    const count7HariResult = await pool.query(`
      SELECT COUNT(*) as total FROM public.kegiatan 
      WHERE tanggal_mulai BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')
    `);
    const total7Hari = parseInt(count7HariResult.rows[0].total, 10);

    // 3. Menunggu LPJ
    const countMenungguLpjResult = await pool.query(`
      SELECT COUNT(*) as total FROM public.kegiatan k
      LEFT JOIN public.kegiatan_lpj l ON k.id = l.kegiatan_id
      WHERE COALESCE(k.tanggal_selesai, k.tanggal_mulai) < CURRENT_DATE AND l.kegiatan_id IS NULL AND k.status_kegiatan NOT IN ('Dibatalkan', 'Draft', 'Selesai')
    `);
    const totalMenungguLpj = parseInt(countMenungguLpjResult.rows[0].total, 10);

    return NextResponse.json({
      success: true,
      data: dataResult.rows,
      meta: {
        total: totalCount,
        bulan_ini: totalBulanIni,
        minggu_ini: total7Hari,
        menunggu_lpj: totalMenungguLpj
      }
    });

  } catch (error) {
    console.error('Error fetching kegiatan:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let client;
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
      // Parse Payload
      const {
        nama_kegiatan, jenis_kegiatan_id, frekuensi_kegiatan,
        tanggal_mulai, tanggal_selesai, waktu_mulai, waktu_selesai,
        lokasi_kegiatan, keterangan, tipe_penyelenggara, satelit_id, departemen_id, komisi_id,
        pic_pengurus_id, berbayar, status_kegiatan,
        is_published, butuh_registrasi, url_banner,
        harga_tiket_rp, kuota_peserta,
        
        // Ibadah specific (3A)
        tema_khotbah, nama_pengkhotbah_1, nama_pengkhotbah_2,

        // Eksternal / Akomodasi (3B)
        akomodasi,

        // Sakramen (3C)
        nama_pendeta_pelayan, keterangan_sakramen,

        // Layanan Personal (3D)
        jemaat_target_1_id, jemaat_target_2_id, keterangan_layanan
      } = body;

    // Validation
    if (!nama_kegiatan || !jenis_kegiatan_id || !tanggal_mulai || !waktu_mulai) {
      return NextResponse.json({ success: false, message: 'Lengkapi field wajib (Nama, Jenis, Tanggal Mulai, Waktu Mulai)' }, { status: 400 });
    }

    const t_selesai = (tanggal_selesai && tanggal_selesai.trim() !== '') ? tanggal_selesai : null;
    const w_selesai = (waktu_selesai && waktu_selesai.trim() !== '') ? waktu_selesai : null;
    
    const s_id = satelit_id ? satelit_id : null;
    const d_id = tipe_penyelenggara === 'Departemen' && departemen_id ? departemen_id : null;
    const k_id = tipe_penyelenggara === 'Komisi' && komisi_id ? komisi_id : null;
    const pic_id = pic_pengurus_id ? pic_pengurus_id : null;
    const hk_rp = harga_tiket_rp ? parseFloat(harga_tiket_rp) : 0;
    const kp = kuota_peserta && kuota_peserta !== '' ? parseInt(kuota_peserta, 10) : null;

    // Generate unique code using the new standardized helper
    const { generateKodeKegiatan } = await import('@/server/utils/kegiatanUtils');
    // Important: We must use the client that is currently part of the transaction
    client = await pool.connect();
    await client.query('BEGIN'); // Start Transaction

    const kode_kegiatan = await generateKodeKegiatan(client, jenis_kegiatan_id, tanggal_mulai);

    const insertKegiatanQuery = `
      INSERT INTO public.kegiatan (
        kode_kegiatan, nama_kegiatan, jenis_kegiatan_id, satelit_id, departemen_id, komisi_id,
        frekuensi_kegiatan, tanggal_mulai, tanggal_selesai, waktu_mulai, waktu_selesai,
        lokasi_kegiatan, keterangan, pic_pengurus_id, berbayar, status_kegiatan,
        is_published, butuh_registrasi, url_banner, harga_tiket_rp, kuota_peserta
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CAST($16 AS status_kegiatan_enum), $17, $18, $19, $20, $21)
      RETURNING id;
    `;

    const kegiatanResult = await client.query(insertKegiatanQuery, [
      kode_kegiatan, nama_kegiatan, jenis_kegiatan_id, s_id, d_id, k_id,
      frekuensi_kegiatan, tanggal_mulai, t_selesai, waktu_mulai, w_selesai,
      lokasi_kegiatan, keterangan || null, pic_id, berbayar, status_kegiatan,
      is_published ?? true, butuh_registrasi ?? false, url_banner || null, hk_rp, kp
    ]);

    const newKegiatanId = kegiatanResult.rows[0].id;

    // [3A] Conditionally Insert to kegiatan_detail_ibadah
    if (tema_khotbah || nama_pengkhotbah_1 || nama_pengkhotbah_2) {
      await client.query(
        `INSERT INTO public.kegiatan_detail_ibadah (kegiatan_id, tema_khotbah, nama_pengkhotbah_1, nama_pengkhotbah_2)
         VALUES ($1, $2, $3, $4)`,
        [newKegiatanId, tema_khotbah || null, nama_pengkhotbah_1 || null, nama_pengkhotbah_2 || null]
      );
    }

    // [3B] Conditionally Insert to kegiatan_detail_eksternal
    if (akomodasi && akomodasi.trim() !== '') {
      await client.query(
        `INSERT INTO public.kegiatan_detail_eksternal (kegiatan_id, akomodasi)
         VALUES ($1, $2)`,
        [newKegiatanId, akomodasi.trim()]
      );
    }

    // [3C] Conditionally Insert to kegiatan_detail_sakramen
    if (nama_pendeta_pelayan || keterangan_sakramen) {
      await client.query(
        `INSERT INTO public.kegiatan_detail_sakramen (kegiatan_id, nama_pendeta_pelayan, keterangan_sakramen)
         VALUES ($1, $2, $3)`,
        [newKegiatanId, nama_pendeta_pelayan || null, keterangan_sakramen || null]
      );
    }

    // [3D] Conditionally Insert to kegiatan_detail_layanan_personal
    if (jemaat_target_1_id || keterangan_layanan) {
      await client.query(
        `INSERT INTO public.kegiatan_detail_layanan_personal (kegiatan_id, jemaat_target_1_id, jemaat_target_2_id, keterangan_layanan)
         VALUES ($1, $2, $3, $4)`,
        [
          newKegiatanId,
          jemaat_target_1_id ? parseInt(jemaat_target_1_id) : null,
          jemaat_target_2_id ? parseInt(jemaat_target_2_id) : null,
          keterangan_layanan || null
        ]
      );
    }

    await client.query('COMMIT'); // Finish Transaction successful
    
    return NextResponse.json({ success: true, message: 'Kegiatan berhasil dibuat!', data: { id: newKegiatanId } });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Error creating kegiatan:', error);
    return NextResponse.json({ success: false, message: 'Gagal membuat kegiatan. Terjadi kesalahan server.', error: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
