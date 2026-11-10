import pool from '@/lib/db';

export interface JemaatData {
  id: number;
  jemaat_id: string;
  nama_lengkap: string;
  satelit_id: number;
  nama_satelit: string;
  jenis_kelamin: string;
  status_baptis: boolean;
  status_jemaat: string;
  tanggal_lahir: Date | null;
  foto_url: string | null;
  // Ini akan mengambil data komisi mereka atau menggunakan string gabungan.
  // Sementara ini kita format karena ada permintaan filter "Komisi". 
  // Berdasarkan struktur database, tidak ada komisi_id langsung di jemaat. 
  // Kita akan tarik data komisi sebagai teks gabungan jika memungkinkan.
  komisi: string; 
}

export interface JemaatFilterParams {
  search?: string;
  satelit_id?: string;
  komisi_id?: string;
  status_jemaat?: string;
  status_baptis?: string;
  jenis_kelamin?: string;
  rentang_umur?: string;
  has_foto?: string;
  hide_dummy?: boolean;
  limit?: number;
  offset?: number;
}

export class JemaatRepository {

  /**
   * Complex query to fetch Jemaat with all requested filters.
   */
  async getJemaatPagination(params: JemaatFilterParams): Promise<{ data: JemaatData[], total: number, jemaat_baru: number }> {
    const { 
      search, satelit_id, komisi_id, 
      status_jemaat, status_baptis, jenis_kelamin, rentang_umur,
      limit = 10, offset = 0 
    } = params;

    let baseQuery = `
      SELECT 
        j.id,
        j.jemaat_id,
        j.nama_lengkap,
        j.satelit_id,
        s.nama_satelit,
        j.jenis_kelamin,
        j.status_baptis,
        j.status_jemaat,
        j.tanggal_lahir,
        j.foto_url,
        j.created_at,
        EXTRACT(YEAR FROM age(current_date, j.tanggal_lahir)) as umur,
        STRING_AGG(k.nama_komisi, ', ') as komisi_list
      FROM jemaat j
      LEFT JOIN satelit s ON j.satelit_id = s.id
      LEFT JOIN jemaat_komisi jk ON j.id = jk.jemaat_id AND jk.is_active = true
      LEFT JOIN komisi k ON jk.komisi_id = k.id
      WHERE j.is_deleted = false
    `;

    // Kriteria filter akan ditambahkan di sini
    const queryParams: any[] = [];
    let paramIndex = 1;
    let whereClauses = [];

    if (search) {
      whereClauses.push(`(j.nama_lengkap ILIKE $${paramIndex} OR j.jemaat_id ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (satelit_id) {
      whereClauses.push(`j.satelit_id = $${paramIndex}`);
      queryParams.push(parseInt(satelit_id, 10));
      paramIndex++;
    }

    if (komisi_id) {
      if (komisi_id === 'none') {
        whereClauses.push(`NOT EXISTS (SELECT 1 FROM jemaat_komisi jk_sub WHERE jk_sub.jemaat_id = j.id AND jk_sub.is_active = true)`);
      } else {
        whereClauses.push(`EXISTS (SELECT 1 FROM jemaat_komisi jk_sub WHERE jk_sub.jemaat_id = j.id AND jk_sub.is_active = true AND jk_sub.komisi_id = $${paramIndex})`);
        queryParams.push(parseInt(komisi_id, 10));
        paramIndex++;
      }
    }

    if (status_jemaat) {
      whereClauses.push(`j.status_jemaat = $${paramIndex}`);
      queryParams.push(status_jemaat);
      paramIndex++;
    }

    if (status_baptis) {
      whereClauses.push(`j.status_baptis = $${paramIndex}`);
      queryParams.push(status_baptis === 'true');
      paramIndex++;
    }

    if (jenis_kelamin) {
      whereClauses.push(`j.jenis_kelamin = $${paramIndex}`);
      queryParams.push(jenis_kelamin);
      paramIndex++;
    }

    if (rentang_umur) {
      if (rentang_umur === 'anak') {
        whereClauses.push(`EXTRACT(YEAR FROM age(current_date, j.tanggal_lahir)) < 12`);
      } else if (rentang_umur === 'remaja') {
        whereClauses.push(`EXTRACT(YEAR FROM age(current_date, j.tanggal_lahir)) BETWEEN 12 AND 17`);
      } else if (rentang_umur === 'pemuda') {
        whereClauses.push(`EXTRACT(YEAR FROM age(current_date, j.tanggal_lahir)) BETWEEN 18 AND 35`);
      } else if (rentang_umur === 'dewasa') {
        whereClauses.push(`EXTRACT(YEAR FROM age(current_date, j.tanggal_lahir)) BETWEEN 36 AND 55`);
      } else if (rentang_umur === 'lansia') {
        whereClauses.push(`EXTRACT(YEAR FROM age(current_date, j.tanggal_lahir)) > 55`);
      }
    }

    if (params.hide_dummy) {
      whereClauses.push(`j.jemaat_id NOT ILIKE '%dum%'`);
    }

    if (params.has_foto) {
      if (params.has_foto === 'true') {
        whereClauses.push(`(j.foto_url IS NOT NULL AND j.foto_url != '')`);
      } else if (params.has_foto === 'false') {
        whereClauses.push(`(j.foto_url IS NULL OR j.foto_url = '')`);
      }
    }

    if (whereClauses.length > 0) {
      baseQuery += ` AND ` + whereClauses.join(' AND ');
    }

    // Dikelompokkan untuk menggabungkan teks (STRING_AGG)
    baseQuery += `
      GROUP BY 
        j.id,
        j.jemaat_id,
        j.nama_lengkap,
        j.satelit_id,
        s.nama_satelit,
        j.jenis_kelamin,
        j.status_baptis,
        j.status_jemaat,
        j.tanggal_lahir,
        j.foto_url,
        j.created_at
    `;

    // Dibungkus dalam CTE supaya gampang menghitung total datanya
    const finalQuery = `
      WITH FilteredData AS (${baseQuery})
      SELECT *
      FROM FilteredData
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    // Query hitungan terpisah — selalu akurat sesuai filter walau halamannya berganti
    const countBaseQuery = `
      SELECT count(DISTINCT j.id) as total_count
      FROM jemaat j
      LEFT JOIN jemaat_komisi jk ON j.id = jk.jemaat_id AND jk.is_active = true
      LEFT JOIN komisi k ON jk.komisi_id = k.id
      WHERE j.is_deleted = false
    ` + (whereClauses.length > 0 ? ` AND ` + whereClauses.join(' AND ') : '');

    // Filter "jemaat baru bulan ini" — harus dijalankan SEBELUM menambahkan limit/offset ke parameter query
    let newThisMonthQuery = `
      SELECT count(DISTINCT j.id) as total_baru
      FROM jemaat j
      LEFT JOIN jemaat_komisi jk ON j.id = jk.jemaat_id AND jk.is_active = true
      WHERE j.is_deleted = false
        AND j.created_at >= date_trunc('month', current_date)
    `;
    if (whereClauses.length > 0) {
      newThisMonthQuery += ` AND ` + whereClauses.join(' AND ');
    }

    const [countResult, newThisMonthResult] = await Promise.all([
      pool.query(countBaseQuery, queryParams),
      pool.query(newThisMonthQuery, queryParams),
    ]);
    const total = parseInt(countResult.rows[0]?.total_count ?? '0', 10);
    const jemaat_baru = parseInt(newThisMonthResult.rows[0].total_baru, 10) || 0;

    // Sekarang masukkan limit/offset untuk query utama halamannya
    queryParams.push(limit, offset);

    const result = await pool.query(finalQuery, queryParams);
    

    if (result.rows.length === 0) {
      return { data: [], total, jemaat_baru };
    }


    // Format ulang datanya
    const data: JemaatData[] = result.rows.map(r => ({
      id: r.id,
      jemaat_id: r.jemaat_id,
      nama_lengkap: r.nama_lengkap,
      satelit_id: r.satelit_id,
      nama_satelit: r.nama_satelit,
      jenis_kelamin: r.jenis_kelamin,
      status_baptis: r.status_baptis,
      status_jemaat: r.status_jemaat,
      tanggal_lahir: r.tanggal_lahir,
      foto_url: r.foto_url,
      komisi: r.komisi_list || ''
    }));

    return { data, total, jemaat_baru };
  }

  /**
   * Insert a new Jemaat record.
   */
  async createJemaat(data: any): Promise<number> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let dateCode = '000000';
      if (data.tanggal_lahir) {
        const d = new Date(data.tanggal_lahir);
        if (!isNaN(d.getTime())) {
          const dd = d.getDate().toString().padStart(2, '0');
          const mm = (d.getMonth() + 1).toString().padStart(2, '0');
          const yy = d.getFullYear().toString().slice(-2);
          dateCode = `${dd}${mm}${yy}`;
        }
      }

      const idPrefix = `${dateCode}`;

      // Hitung increment rebutan
      const countRes = await client.query(
        `SELECT jemaat_id FROM jemaat WHERE jemaat_id LIKE $1 ORDER BY jemaat_id DESC LIMIT 1`,
        [`${idPrefix}%`]
      );

      let nextNum = 0;
      if (countRes.rows.length > 0) {
        const lastId = countRes.rows[0].jemaat_id; // contoh: "12027800"
        if (lastId && lastId.length >= 8) {
           const lastCounter = parseInt(lastId.slice(-2), 10);
           if (!isNaN(lastCounter)) {
             nextNum = lastCounter + 1;
           }
        }
      }
      const jemaatId = `${idPrefix}${nextNum.toString().padStart(2, '0')}`;

      // Masukkan data Jemaat
      const insertJemaatQuery = `
        INSERT INTO jemaat (
          jemaat_id, nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir,
          alamat, kota, kecamatan, kelurahan, kode_pos, no_hp, email, 
          status_pernikahan, status_baptis, tanggal_baptis, status_jemaat, pekerjaan, pekerjaan_id, satelit_id,
          ayah_id, ayah_nama, gereja_asal_ayah,
          ibu_id, ibu_nama, gereja_asal_ibu,
          pasangan_id, pasangan_nama, gereja_asal_pasangan, foto_url, wilayah_id
        ) VALUES (
          $1, $2, $3, $4, $5, 
          $6, $7, $8, $9, $10, $11, $12, 
          $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22,
          $23, $24, $25,
          $26, $27, $28, $29, $30
        ) RETURNING id
      `;
      
      const statusBaptisBool = data.status_baptis === 'Sudah';

      const jemaatValues = [
        jemaatId, // $1
        data.nama_lengkap, // $2
        data.jenis_kelamin || null, // $3
        data.tempat_lahir || null, // $4
        data.tanggal_lahir ? new Date(data.tanggal_lahir) : null, // $5
        data.alamat || null, // $6
        data.kota || null, // $7
        data.kecamatan || null, // $8
        data.kelurahan || null, // $9
        data.kode_pos || null, // $10
        data.no_hp || null, // $11
        data.email || null, // $12
        data.status_pernikahan || null, // $13 (Lajang, Menikah, Duda, Janda)
        statusBaptisBool, // $14
        (statusBaptisBool && data.tanggal_baptis) ? new Date(data.tanggal_baptis) : null, // $15
        data.status_jemaat || 'Aktif', // $16
        data.pekerjaan || null, // $17
        data.pekerjaan_id ? parseInt(data.pekerjaan_id, 10) : null, // $18
        data.satelit_id ? parseInt(data.satelit_id, 10) : null, // $19
        data.ayah_id ? parseInt(data.ayah_id, 10) : null, // $20
        data.ayah_nama || null, // $21
        data.gereja_asal_ayah || null, // $22
        data.ibu_id ? parseInt(data.ibu_id, 10) : null, // $23
        data.ibu_nama || null, // $24
        data.gereja_asal_ibu || null, // $25
        data.pasangan_id ? parseInt(data.pasangan_id, 10) : null, // $26
        data.pasangan_nama || null, // $27
        data.gereja_asal_pasangan || null, // $28
        data.foto_url || null, // $29
        data.wilayah_id ? parseInt(data.wilayah_id, 10) : null // $30
      ];

      const res = await client.query(insertJemaatQuery, jemaatValues);
      const newJemaatId = res.rows[0].id;

      // Masukkan data komisi jika ada
      if (data.komisi_ids && Array.isArray(data.komisi_ids) && data.komisi_ids.length > 0) {
        const insertKomisiQuery = `
          INSERT INTO jemaat_komisi (jemaat_id, komisi_id, tanggal_bergabung)
          VALUES ($1, $2, CURRENT_DATE)
        `;
        for (const komisiId of data.komisi_ids) {
          await client.query(insertKomisiQuery, [newJemaatId, parseInt(komisiId, 10)]);
        }
      }

      // Masukkan data departemen jika ada
      if (data.departemen_ids && Array.isArray(data.departemen_ids) && data.departemen_ids.length > 0) {
        const insertDeptQuery = `
          INSERT INTO jemaat_departemen (jemaat_id, departemen_id, satelit_id, tanggal_bergabung)
          VALUES ($1, $2, $3, CURRENT_DATE)
        `;
        for (const deptId of data.departemen_ids) {
          await client.query(insertDeptQuery, [
            newJemaatId, 
            parseInt(deptId, 10),
            data.satelit_id ? parseInt(data.satelit_id, 10) : null
          ]);
        }
      }

      // Masukkan data Anak ke relasi_jemaat (menggantikan jemaat_anak)
      if (data.anak && Array.isArray(data.anak) && data.anak.length > 0) {
        const jrAnakRes = await client.query(`SELECT id FROM jenis_relasi WHERE nama_relasi = 'Anak' LIMIT 1`);
        if (jrAnakRes.rows.length > 0) {
          const jenisAnakId = jrAnakRes.rows[0].id;
          for (const ank of data.anak) {
            const anakId = ank.anak_jemaat_id ? parseInt(ank.anak_jemaat_id, 10) : null;
            const namaAnk = ank.nama_anak || null;
            const gerejaAnk = ank.gereja_asal_anak || null;
            if (anakId || namaAnk) {
              await client.query(
                `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id, nama_terkait, gereja_asal)
                 VALUES ($1, $2, $3, $4, $5)`,
                [newJemaatId, anakId, jenisAnakId, namaAnk, gerejaAnk]
              );
            }
          }
        }
      }

      // ── Bidirectional anak sync (create) ──────────────────────────────────
      // Setelah menyimpan relasi anak, perbarui data ayah_id atau ibu_id pada profil si anak
      // supaya profil anak otomatis memunculkan orang ini sebagai orang tuanya.
      // Penjaga: hanya update jika datanya masih kosong (jangan pernah timpa data orang tua yang sudah ada).
      if (data.anak && Array.isArray(data.anak) && data.jenis_kelamin) {
        for (const ank of data.anak) {
          const anakRegisteredId = ank.anak_jemaat_id ? parseInt(ank.anak_jemaat_id, 10) : null;
          if (!anakRegisteredId) continue; // lewati kalau anaknya tidak ada namanya / tidak terdaftar di database
          if (data.jenis_kelamin === 'Laki-laki') {
            // Orang ini adalah sang Ayah — atur ayah_id anak jika belum ada
            await client.query(
              `UPDATE jemaat
               SET ayah_id = $1, ayah_nama = $2, updated_at = CURRENT_TIMESTAMP
               WHERE id = $3 AND is_deleted = false AND ayah_id IS NULL`,
              [newJemaatId, data.nama_lengkap, anakRegisteredId]
            );
          } else if (data.jenis_kelamin === 'Perempuan') {
            // Orang ini adalah sang Ibu — atur ibu_id anak jika belum ada
            await client.query(
              `UPDATE jemaat
               SET ibu_id = $1, ibu_nama = $2, updated_at = CURRENT_TIMESTAMP
               WHERE id = $3 AND is_deleted = false AND ibu_id IS NULL`,
              [newJemaatId, data.nama_lengkap, anakRegisteredId]
            );
          }
        }
      }

      // ── Reverse parent sync (create) ─────────────────────────────────────
      // Kalau jemaat baru ini memasukkan orang tua yang terdaftar (ayah_id / ibu_id),
      // kita juga buatkan relasi 'Anak' di sisi orang tuanya supaya
      // pohon keluarga sang orang tua langsung memunculkan orang ini sebagai anaknya.
      {
        const jrAnakRes2 = await client.query(`SELECT id FROM jenis_relasi WHERE nama_relasi = 'Anak' LIMIT 1`);
        if (jrAnakRes2.rows.length > 0) {
          const jrAnakId2 = jrAnakRes2.rows[0].id;

          if (data.ayah_id) {
            const ayahDbId = parseInt(data.ayah_id, 10);
            // Hanya simpan kalau datanya belum ada
            await client.query(
              `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id, nama_terkait)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT DO NOTHING`,
              [ayahDbId, newJemaatId, jrAnakId2, data.nama_lengkap]
            );
          }

          if (data.ibu_id) {
            const ibuDbId = parseInt(data.ibu_id, 10);
            await client.query(
              `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id, nama_terkait)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT DO NOTHING`,
              [ibuDbId, newJemaatId, jrAnakId2, data.nama_lengkap]
            );
          }
        }
      }

      if (data.saudara && Array.isArray(data.saudara) && data.saudara.length > 0) {
        // Ambil ID jenis relasi untuk 'Saudara Kandung'
        const jrRes = await client.query(`SELECT id FROM jenis_relasi WHERE nama_relasi = 'Saudara Kandung' LIMIT 1`);
        if (jrRes.rows.length > 0) {
          const jenisRelasiId = jrRes.rows[0].id;
          for (const s of data.saudara) {
            const saudaraId = s.saudara_jemaat_id ? parseInt(s.saudara_jemaat_id, 10) : null;
            const saudaraNama = s.nama_saudara || null;
            const saudaraGerAsal = s.gereja_asal_saudara || null;
            if (saudaraId) {
              // Saudara terdaftar: simpan dua arah
              await client.query(
                `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id, nama_terkait, gereja_asal) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
                [newJemaatId, saudaraId, jenisRelasiId, saudaraNama, saudaraGerAsal]
              );
              // B ke A (dua arah)
              await client.query(
                `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                [saudaraId, newJemaatId, jenisRelasiId]
              );
            } else if (saudaraNama) {
              // Saudara belum terdaftar: simpan hanya nama & gereja asal, tanpa reverse link
              await client.query(
                `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id, nama_terkait, gereja_asal) VALUES ($1, NULL, $2, $3, $4)`,
                [newJemaatId, jenisRelasiId, saudaraNama, saudaraGerAsal]
              );
            }
          }
        }
      }

      // ── Bidirectional pasangan sync ────────────────────────────────────
      const newPasanganId = data.pasangan_id ? parseInt(data.pasangan_id, 10) : null;
      if (newPasanganId) {
        // Atur pasangan_id sang pasangan ke ID jemaat baru, dan namanya ke orang ini
        await client.query(
          `UPDATE jemaat SET pasangan_id = $1, pasangan_nama = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND (pasangan_id IS NULL OR pasangan_id <> $1)`,
          [newJemaatId, data.nama_lengkap, newPasanganId]
        );
      }

      await client.query('COMMIT');
      return newJemaatId;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Fetch a single Jemaat profile by ID, fully detailed.
   */
  async getJemaatById(id: string): Promise<any | null> {
    const query = `
      SELECT 
        j.*,
        w.nama_wilayah,
        a.jemaat_id AS ayah_jemaat_id,
        i.jemaat_id AS ibu_jemaat_id,
        p.jemaat_id AS pasangan_jemaat_id,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT jk.komisi_id), NULL) as komisi_ids,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT jd.departemen_id), NULL) as departemen_ids
      FROM jemaat j
      LEFT JOIN wilayah w ON j.wilayah_id = w.id
      LEFT JOIN jemaat a ON j.ayah_id = a.id
      LEFT JOIN jemaat i ON j.ibu_id = i.id
      LEFT JOIN jemaat p ON j.pasangan_id = p.id
      LEFT JOIN jemaat_komisi jk ON j.id = jk.jemaat_id
      LEFT JOIN jemaat_departemen jd ON j.id = jd.jemaat_id
      WHERE j.id::text = $1 AND j.is_deleted = false
      GROUP BY j.id, w.nama_wilayah, a.jemaat_id, i.jemaat_id, p.jemaat_id
    `;
    const res = await pool.query(query, [id]);
    if (res.rows.length === 0) return null;
    
    // Ubah format array supaya cocok dengan frontend
    const row = res.rows[0];
    row.komisi_ids = row.komisi_ids ? row.komisi_ids.map((k: number) => k.toString()) : [];
    row.departemen_ids = row.departemen_ids ? row.departemen_ids.map((k: number) => k.toString()) : [];
    
    // Tarik data orang tua cadangan kalau tidak ada di tabel utama
    if (!row.ayah_id || !row.ibu_id) {
      const parentQuery = `
        SELECT
           j.id, j.jemaat_id, j.nama_lengkap, j.jenis_kelamin
         FROM relasi_jemaat rj
         JOIN jenis_relasi  jr ON rj.jenis_relasi_id = jr.id AND jr.nama_relasi = 'Anak'
         JOIN jemaat        j  ON rj.jemaat_id = j.id AND j.is_deleted = false
         WHERE rj.jemaat_terkait_id = $1
      `;
      const pRes = await pool.query(parentQuery, [id]);
      for (const pRow of pRes.rows) {
        if (pRow.jenis_kelamin === 'Laki-laki' && !row.ayah_id) {
          row.ayah_id = pRow.id;
          row.ayah_jemaat_id = pRow.jemaat_id;
          row.ayah_nama = pRow.nama_lengkap;
        } else if (pRow.jenis_kelamin === 'Perempuan' && !row.ibu_id) {
          row.ibu_id = pRow.id;
          row.ibu_jemaat_id = pRow.jemaat_id;
          row.ibu_nama = pRow.nama_lengkap;
        }
      }
    }
    
    // Tarik data anak dari tabel relasi
    const anakQuery = `
      SELECT
        rj.id,
        rj.jemaat_terkait_id  AS anak_jemaat_id,
        COALESCE(c.nama_lengkap, rj.nama_terkait) AS nama_anak,
        rj.gereja_asal        AS gereja_asal_anak,
        c.jemaat_id           AS anak_jemaat_id_text
      FROM relasi_jemaat rj
      JOIN jenis_relasi  jr ON rj.jenis_relasi_id = jr.id AND jr.nama_relasi = 'Anak'
      LEFT JOIN jemaat   c  ON rj.jemaat_terkait_id = c.id AND c.is_deleted = false
      WHERE rj.jemaat_id = $1
      ORDER BY rj.id ASC
    `;
    const anakRes = await pool.query(anakQuery, [row.id]);
    row.anak = anakRes.rows.map(a => ({
      id: a.id,
      anak_jemaat_id: a.anak_jemaat_id ? a.anak_jemaat_id.toString() : '',
      anak_jemaat_id_text: a.anak_jemaat_id_text || '',
      nama_anak: a.nama_anak || '',
      gereja_asal_anak: a.gereja_asal_anak || ''
    }));

    // Tarik data saudara kandung dari tabel relasi
    const saudaraQuery = `
      SELECT
        rj.id,
        rj.jemaat_terkait_id                    AS saudara_jemaat_id,
        s.jemaat_id                              AS saudara_jemaat_kode,
        COALESCE(s.nama_lengkap, rj.nama_terkait) AS nama_saudara,
        COALESCE(rj.gereja_asal, '')             AS gereja_asal_saudara
      FROM relasi_jemaat rj
      JOIN jenis_relasi jr ON rj.jenis_relasi_id = jr.id
      LEFT JOIN jemaat s   ON rj.jemaat_terkait_id = s.id AND s.is_deleted = false
      WHERE rj.jemaat_id = $1
        AND jr.nama_relasi = 'Saudara Kandung'
      ORDER BY rj.id ASC
    `;
    const saudaraRes = await pool.query(saudaraQuery, [row.id]);
    row.saudara = saudaraRes.rows.map(s => ({
      id: s.id,
      saudara_jemaat_id:    s.saudara_jemaat_id ? s.saudara_jemaat_id.toString() : '',
      saudara_jemaat_kode:  s.saudara_jemaat_kode || '',
      nama_saudara:         s.nama_saudara || '',
      gereja_asal_saudara:  s.gereja_asal_saudara || '',
    }));

    return row;
  }

  /**
   * Update an existing Jemaat record.
   */
  async updateJemaat(jemaatId: string, data: any): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const statusBaptisBool = data.status_baptis === 'Sudah';
      const newSatelitId = data.satelit_id ? parseInt(data.satelit_id, 10) : null;

      // ── Detect satellite change & regenerate jemaat_id if needed ──────────
      const currentRes = await client.query(
        `SELECT satelit_id, tanggal_lahir, jemaat_id, pasangan_id, jenis_kelamin, ayah_id, ibu_id FROM jemaat WHERE id::text = $1 AND is_deleted = false LIMIT 1`,
        [jemaatId]
      );
      if (currentRes.rows.length === 0) throw new Error('Jemaat not found');

      const current = currentRes.rows[0];
      let newJemaatId: string | null = null;

      // Ubah format tanggal ke YYYY-MM-DD supaya bisa dibandingkan
      const oldDate = current.tanggal_lahir ? new Date(current.tanggal_lahir).toISOString().split('T')[0] : null;
      const newDate = data.tanggal_lahir ? new Date(data.tanggal_lahir).toISOString().split('T')[0] : null;

      if (newDate && oldDate !== newDate) {
        let dateCode = '000000';
        const d = new Date(newDate);
        if (!isNaN(d.getTime())) {
          const dd = d.getDate().toString().padStart(2, '0');
          const mm = (d.getMonth() + 1).toString().padStart(2, '0');
          const yy = d.getFullYear().toString().slice(-2);
          dateCode = `${dd}${mm}${yy}`;
        }

        const idPrefix = `${dateCode}`;

        // Cari nomor urut berikutnya untuk awalan ID ini
        const lastRes = await client.query(
          `SELECT jemaat_id FROM jemaat WHERE jemaat_id LIKE $1 ORDER BY jemaat_id DESC LIMIT 1`,
          [`${idPrefix}%`]
        );
        let nextNum = 0;
        if (lastRes.rows.length > 0) {
          const lastId: string = lastRes.rows[0].jemaat_id; // contoh: "12027800"
          if (lastId.length >= 8) {
            const lastCounter = parseInt(lastId.slice(-2), 10);
            if (!isNaN(lastCounter)) nextNum = lastCounter + 1;
          }
        }
        newJemaatId = `${idPrefix}${nextNum.toString().padStart(2, '0')}`;
      }

      const jemaatIdSet = newJemaatId ? ', jemaat_id = $31' : '';
      const updateQuery = `
        UPDATE jemaat SET
          nama_lengkap = $1, jenis_kelamin = $2, tempat_lahir = $3, tanggal_lahir = $4,
          alamat = $5, kota = $6, kecamatan = $7, kelurahan = $8, kode_pos = $9, no_hp = $10, email = $11, 
          status_pernikahan = $12, status_baptis = $13, tanggal_baptis = $14, status_jemaat = $15, pekerjaan = $16, pekerjaan_id = $17, satelit_id = $18,
          ayah_id = $19, ayah_nama = $20, gereja_asal_ayah = $21,
          ibu_id = $22, ibu_nama = $23, gereja_asal_ibu = $24,
          pasangan_id = $25, pasangan_nama = $26, gereja_asal_pasangan = $27, foto_url = $28, wilayah_id = $29${jemaatIdSet}
        WHERE id::text = $30
        RETURNING id
      `;

      const jemaatValues: any[] = [
        data.nama_lengkap,                                                         // $1
        data.jenis_kelamin || null,                                                // $2
        data.tempat_lahir || null,                                                 // $3
        data.tanggal_lahir ? new Date(data.tanggal_lahir) : null,                 // $4
        data.alamat || null,                                                       // $5
        data.kota || null,                                                         // $6
        data.kecamatan || null,                                                    // $7
        data.kelurahan || null,                                                    // $8
        data.kode_pos || null,                                                     // $9
        data.no_hp || null,                                                        // $10
        data.email || null,                                                        // $11
        data.status_pernikahan || null,                                            // $12
        statusBaptisBool,                                                          // $13
        (statusBaptisBool && data.tanggal_baptis) ? new Date(data.tanggal_baptis) : null, // $14
        data.status_jemaat || 'Aktif',                                             // $15
        data.pekerjaan || null,                                                    // $16
        data.pekerjaan_id ? parseInt(data.pekerjaan_id, 10) : null,               // $17
        newSatelitId,                                                              // $18
        data.ayah_id ? parseInt(data.ayah_id, 10) : null,                         // $19
        data.ayah_nama || null,                                                    // $20
        data.gereja_asal_ayah || null,                                             // $21
        data.ibu_id ? parseInt(data.ibu_id, 10) : null,                           // $22
        data.ibu_nama || null,                                                     // $23
        data.gereja_asal_ibu || null,                                              // $24
        data.pasangan_id ? parseInt(data.pasangan_id, 10) : null,                 // $25
        data.pasangan_nama || null,                                                // $26
        data.gereja_asal_pasangan || null,                                         // $27
        data.foto_url || null,                                                     // $28
        data.wilayah_id ? parseInt(data.wilayah_id, 10) : null,                   // $29
        jemaatId,                                                                  // $30
      ];
      if (newJemaatId) jemaatValues.push(newJemaatId);                            // $31 (optional)

      const res = await client.query(updateQuery, jemaatValues);
      
      if (res.rowCount === 0) {
        throw new Error('Jemaat not found');
      }
      
      const primaryId = res.rows[0].id;

      // ── Propagate nama_lengkap change to denormalized name fields ──────────
      // Setiap kali nama seseorang berubah, perbarui juga semua catatan lain yang menyimpan
      // namanya secara teks agar tampilannya selalu seragam.
      const oldNama = current.nama_lengkap; // belum diambil datanya — ambil secara terpisah kalau butuh
      // Kita selaraskan tanpa syarat (prosesnya ringan & aman — tidak akan diproses kalau namanya sama saja)
      await client.query(
        `UPDATE jemaat SET ayah_nama = $1, updated_at = CURRENT_TIMESTAMP
         WHERE ayah_id = $2 AND is_deleted = false`,
        [data.nama_lengkap, primaryId]
      );
      await client.query(
        `UPDATE jemaat SET ibu_nama = $1, updated_at = CURRENT_TIMESTAMP
         WHERE ibu_id = $2 AND is_deleted = false`,
        [data.nama_lengkap, primaryId]
      );
      await client.query(
        `UPDATE jemaat SET pasangan_nama = $1, updated_at = CURRENT_TIMESTAMP
         WHERE pasangan_id = $2 AND is_deleted = false`,
        [data.nama_lengkap, primaryId]
      );
      await client.query(
        `UPDATE relasi_jemaat SET nama_terkait = $1
         WHERE jemaat_terkait_id = $2`,
        [data.nama_lengkap, primaryId]
      );

      // Hapus data ikatan komisi, departemen & anak yang lama
      await client.query(`DELETE FROM jemaat_komisi WHERE jemaat_id = $1`, [primaryId]);
      await client.query(`DELETE FROM jemaat_departemen WHERE jemaat_id = $1`, [primaryId]);

      // ── Snapshot old anak list BEFORE wiping (needed for back-link cleanup) ─
      // Kita catat siapa saja jemaat terdaftar yang merupakan anak dari orang ini,
      // supaya kita bisa menghapus ayah_id/ibu_id mereka kalau orang ini dihapus dari daftarnya.
      let oldAnakIds: number[] = [];
      const jrAnakDel = await client.query(`SELECT id FROM jenis_relasi WHERE nama_relasi = 'Anak' LIMIT 1`);
      const jenisAnakId = jrAnakDel.rows.length > 0 ? jrAnakDel.rows[0].id : null;
      if (jenisAnakId) {
        const oldAnakRes = await client.query(
          `SELECT jemaat_terkait_id FROM relasi_jemaat WHERE jemaat_id = $1 AND jenis_relasi_id = $2 AND jemaat_terkait_id IS NOT NULL`,
          [primaryId, jenisAnakId]
        );
        oldAnakIds = oldAnakRes.rows.map((r: any) => r.jemaat_terkait_id);
        // Sekarang hapus relasi anaknya
        await client.query(
          `DELETE FROM relasi_jemaat WHERE jemaat_id = $1 AND jenis_relasi_id = $2`,
          [primaryId, jenisAnakId]
        );
      }

      // Simpan ulang data ikatan komisi jika ada
      if (data.komisi_ids && Array.isArray(data.komisi_ids) && data.komisi_ids.length > 0) {
        const insertKomisiQuery = `
          INSERT INTO jemaat_komisi (jemaat_id, komisi_id, tanggal_bergabung)
          VALUES ($1, $2, CURRENT_DATE)
        `;
        for (const komisiId of data.komisi_ids) {
          await client.query(insertKomisiQuery, [primaryId, parseInt(komisiId, 10)]);
        }
      }

      // Simpan ulang data ikatan departemen jika ada
      if (data.departemen_ids && Array.isArray(data.departemen_ids) && data.departemen_ids.length > 0) {
        const insertDeptQuery = `
          INSERT INTO jemaat_departemen (jemaat_id, departemen_id, satelit_id, tanggal_bergabung)
          VALUES ($1, $2, $3, CURRENT_DATE)
        `;
        for (const deptId of data.departemen_ids) {
          await client.query(insertDeptQuery, [
            primaryId, 
            parseInt(deptId, 10),
            newSatelitId
          ]);
        }
      }

      // Simpan ulang data Anak ke tabel relasi jika ada
      const newAnakIds: number[] = [];
      if (data.anak && Array.isArray(data.anak) && data.anak.length > 0 && jenisAnakId) {
        for (const ank of data.anak) {
          const anakId = ank.anak_jemaat_id ? parseInt(ank.anak_jemaat_id, 10) : null;
          const namaAnk = ank.nama_anak || null;
          const gerejaAnk = ank.gereja_asal_anak || null;
          if (anakId || namaAnk) {
            await client.query(
              `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id, nama_terkait, gereja_asal)
               VALUES ($1, $2, $3, $4, $5)`,
              [primaryId, anakId, jenisAnakId, namaAnk, gerejaAnk]
            );
          }
          if (anakId) newAnakIds.push(anakId);
        }
      }

      // ── Bidirectional anak sync (update) ──────────────────────────────────
      const parentGender = data.jenis_kelamin || current.jenis_kelamin;

      // (a) Clear back-links for anak that were REMOVED from the list
      const removedAnakIds = oldAnakIds.filter(id => !newAnakIds.includes(id));
      for (const removedId of removedAnakIds) {
        if (parentGender === 'Laki-laki') {
          // Hanya hapus kalau datanya merujuk ke orang INI (jangan sampai menghapus ayah orang lain)
          await client.query(
            `UPDATE jemaat SET ayah_id = NULL, ayah_nama = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND is_deleted = false AND ayah_id = $2`,
            [removedId, primaryId]
          );
        } else if (parentGender === 'Perempuan') {
          await client.query(
            `UPDATE jemaat SET ibu_id = NULL, ibu_nama = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND is_deleted = false AND ibu_id = $2`,
            [removedId, primaryId]
          );
        }
      }

      // (b) Set back-links for CURRENT anak list (newly added or re-confirmed)
      // Penjaga: hanya update kalau masih kosong — jangan pernah menimpa relasi orang tua yang lain.
      for (const anakId of newAnakIds) {
        if (parentGender === 'Laki-laki') {
          await client.query(
            `UPDATE jemaat SET ayah_id = $1, ayah_nama = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 AND is_deleted = false AND ayah_id IS NULL`,
            [primaryId, data.nama_lengkap, anakId]
          );
        } else if (parentGender === 'Perempuan') {
          await client.query(
            `UPDATE jemaat SET ibu_id = $1, ibu_nama = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 AND is_deleted = false AND ibu_id IS NULL`,
            [primaryId, data.nama_lengkap, anakId]
          );
        }
      }

      // ── Reverse parent sync (update) ──────────────────────────────────────
      // Saat orang ini mengganti ayah_id atau ibu_id mereka, kita wajib:
      //  (a) Remove the 'Anak' relasi from the OLD parent (if any)
      //  (b) Add an 'Anak' relasi to the NEW parent (if any)
      if (jenisAnakId) {
        const newAyahId = data.ayah_id ? parseInt(data.ayah_id, 10) : null;
        const newIbuId  = data.ibu_id  ? parseInt(data.ibu_id,  10) : null;
        const oldAyahId = current.ayah_id ? parseInt(current.ayah_id, 10) : null;
        const oldIbuId  = current.ibu_id  ? parseInt(current.ibu_id,  10) : null;

        // ── Ayah changed ──
        if (oldAyahId !== newAyahId) {
          // Hapus dari daftar anak milik ayah yang lama
          if (oldAyahId) {
            await client.query(
              `DELETE FROM relasi_jemaat WHERE jemaat_id = $1 AND jemaat_terkait_id = $2 AND jenis_relasi_id = $3`,
              [oldAyahId, primaryId, jenisAnakId]
            );
          }
          // Tambahkan ke daftar anak milik ayah yang baru
          if (newAyahId) {
            await client.query(
              `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id, nama_terkait)
               VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
              [newAyahId, primaryId, jenisAnakId, data.nama_lengkap]
            );
          }
        }

        // ── Ibu changed ──
        if (oldIbuId !== newIbuId) {
          // Hapus dari daftar anak milik ibu yang lama
          if (oldIbuId) {
            await client.query(
              `DELETE FROM relasi_jemaat WHERE jemaat_id = $1 AND jemaat_terkait_id = $2 AND jenis_relasi_id = $3`,
              [oldIbuId, primaryId, jenisAnakId]
            );
          }
          // Tambahkan ke daftar anak milik ibu yang baru
          if (newIbuId) {
            await client.query(
              `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id, nama_terkait)
               VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
              [newIbuId, primaryId, jenisAnakId, data.nama_lengkap]
            );
          }
        }
      }

      // Simpan ulang relasi Saudara — hapus dua-arah yang lama, baru simpan lagi
      const jrRes = await client.query(`SELECT id FROM jenis_relasi WHERE nama_relasi = 'Saudara Kandung' LIMIT 1`);
      if (jrRes.rows.length > 0) {
        const jenisRelasiId = jrRes.rows[0].id;
        // Hapus relasi yang mengarah ke luar dari orang ini
        await client.query(
          `DELETE FROM relasi_jemaat WHERE jemaat_id = $1 AND jenis_relasi_id = $2`,
          [primaryId, jenisRelasiId]
        );
        // Hapus relasi masuk yang mengarah KE orang ini (pembersihan dua-arah)
        await client.query(
          `DELETE FROM relasi_jemaat WHERE jemaat_terkait_id = $1 AND jenis_relasi_id = $2`,
          [primaryId, jenisRelasiId]
        );
        if (data.saudara && Array.isArray(data.saudara) && data.saudara.length > 0) {
          for (const s of data.saudara) {
            const saudaraId = s.saudara_jemaat_id ? parseInt(s.saudara_jemaat_id, 10) : null;
            const saudaraNama = s.nama_saudara || null;
            const saudaraGerAsal = s.gereja_asal_saudara || null;
            if (saudaraId) {
              // Saudara terdaftar: simpan dua arah
              await client.query(
                `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id, nama_terkait, gereja_asal) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
                [primaryId, saudaraId, jenisRelasiId, saudaraNama, saudaraGerAsal]
              );
              // B ke A
              await client.query(
                `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                [saudaraId, primaryId, jenisRelasiId]
              );
            } else if (saudaraNama) {
              // Saudara belum terdaftar: simpan hanya nama & gereja asal, tanpa reverse link
              await client.query(
                `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id, nama_terkait, gereja_asal) VALUES ($1, NULL, $2, $3, $4)`,
                [primaryId, jenisRelasiId, saudaraNama, saudaraGerAsal]
              );
            }
          }
        }
      }

      // ── Bidirectional pasangan sync ────────────────────────────────────
      const newPasanganId = data.pasangan_id ? parseInt(data.pasangan_id, 10) : null;
      const oldPasanganId = current.pasangan_id ? parseInt(current.pasangan_id, 10) : null;

      // Jika pasangannya diganti: hapus tautan balik dari pasangan yang lama
      if (oldPasanganId && oldPasanganId !== newPasanganId) {
        await client.query(
          `UPDATE jemaat SET pasangan_id = NULL, pasangan_nama = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND pasangan_id = $2`,
          [oldPasanganId, parseInt(jemaatId, 10)]
        );
      }

      // Atur tautan balik untuk pasangan yang baru
      if (newPasanganId) {
        await client.query(
          `UPDATE jemaat SET pasangan_id = $1, pasangan_nama = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND (pasangan_id IS NULL OR pasangan_id <> $1)`,
          [parseInt(jemaatId, 10), data.nama_lengkap, newPasanganId]
        );
      }

      // Kalau pasangannya dihapus (sebelumnya ada, sekarang kosong): hapus tautan baliknya juga
      if (!newPasanganId && oldPasanganId) {
        await client.query(
          `UPDATE jemaat SET pasangan_id = NULL, pasangan_nama = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND pasangan_id = $2`,
          [oldPasanganId, parseInt(jemaatId, 10)]
        );
      }

      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Update Jemaat status (Aktif/Tidak Aktif/Keluar).
   */
  async updateJemaatStatus(id: string, status: string): Promise<boolean> {
    const query = 'UPDATE jemaat SET status_jemaat = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id';
    const res = await pool.query(query, [status, parseInt(id, 10)]);
    return res.rowCount !== null && res.rowCount > 0;
  }
}
