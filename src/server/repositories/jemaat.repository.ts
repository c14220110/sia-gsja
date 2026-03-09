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
  // This will grab their komisi from relasi or just let's join from detail_pelayanan if we can or keep it a simple string agg based on future schema.
  // For the moment, since user requested to filter "Komisi" we will structure it. 
  // However, looking at the schema, there isn't a direct "komisi_id" on jemaat. Pelayan has "role_pelayanan_id". 
  // We will pull the komisi array as a joined string if possible, or placeholder.
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

    // Filter clauses will be appended
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
        whereClauses.push(`jk.komisi_id IS NULL`);
      } else {
        whereClauses.push(`jk.komisi_id = $${paramIndex}`);
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

    if (whereClauses.length > 0) {
      baseQuery += ` AND ` + whereClauses.join(' AND ');
    }

    // Group by for STRING_AGG
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

    // Wrap in CTE to get total count easily
    const finalQuery = `
      WITH FilteredData AS (${baseQuery}),
      TotalCount AS (SELECT count(*) as total FROM FilteredData)
      SELECT f.*, COALESCE(t.total, 0) as total_count 
      FROM FilteredData f
      CROSS JOIN TotalCount t
      ORDER BY f.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;
    
    queryParams.push(limit, offset);

    const result = await pool.query(finalQuery, queryParams);
    
    // Quick separate query for global active new jemaat this month
    const newThisMonthQuery = `SELECT count(*) as total_baru FROM jemaat WHERE is_deleted = false AND created_at >= date_trunc('month', current_date)`;
    const newThisMonthResult = await pool.query(newThisMonthQuery);
    const jemaat_baru = parseInt(newThisMonthResult.rows[0].total_baru, 10) || 0;
    
    if (result.rows.length === 0) {
      return { data: [], total: 0, jemaat_baru };
    }

    // Extract total from the first row (since all rows have total_count due to cross join)
    const total = parseInt(result.rows[0].total_count, 10);
    
    // Map data
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

      // Generate Custom 10-Digit Jemaat ID
      let satelitCode = '00';
      if (data.satelit_id) {
        const satRes = await client.query('SELECT kode_satelit FROM satelit WHERE id = $1', [parseInt(data.satelit_id, 10)]);
        if (satRes.rows.length > 0 && satRes.rows[0].kode_satelit) {
          satelitCode = satRes.rows[0].kode_satelit.substring(0, 2).padStart(2, '0');
        }
      }

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

      const idPrefix = `${satelitCode}${dateCode}`;

      // Hitung increment rebutan
      const countRes = await client.query(
        `SELECT jemaat_id FROM jemaat WHERE jemaat_id LIKE $1 ORDER BY jemaat_id DESC LIMIT 1`,
        [`${idPrefix}%`]
      );

      let nextNum = 0;
      if (countRes.rows.length > 0) {
        const lastId = countRes.rows[0].jemaat_id; // e.g. "0112109000"
        if (lastId && lastId.length >= 10) {
           const lastCounter = parseInt(lastId.slice(-2), 10);
           if (!isNaN(lastCounter)) {
             nextNum = lastCounter + 1;
           }
        }
      }
      const jemaatId = `${idPrefix}${nextNum.toString().padStart(2, '0')}`;

      // Insert Jemaat
      const insertJemaatQuery = `
        INSERT INTO jemaat (
          jemaat_id, nik, nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir,
          alamat, kota, kecamatan, kelurahan, kode_pos, no_hp, email, 
          status_pernikahan, status_baptis, tanggal_baptis, status_jemaat, pekerjaan, satelit_id,
          ayah_id, ayah_nama, gereja_asal_ayah,
          ibu_id, ibu_nama, gereja_asal_ibu,
          pasangan_id, pasangan_nama, gereja_asal_pasangan
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 
          $7, $8, $9, $10, $11, $12, $13, 
          $14, $15, $16, $17, $18, $19,
          $20, $21, $22,
          $23, $24, $25,
          $26, $27, $28
        ) RETURNING id
      `;
      
      const statusBaptisBool = data.status_baptis === 'Sudah';

      const jemaatValues = [
        jemaatId, // $1
        data.nik || null, // $2
        data.nama_lengkap, // $3
        data.jenis_kelamin || null, // $4
        data.tempat_lahir || null, // $5
        data.tanggal_lahir ? new Date(data.tanggal_lahir) : null, // $6
        data.alamat || null, // $7
        data.kota || null, // $8
        data.kecamatan || null, // $9
        data.kelurahan || null, // $10
        data.kode_pos || null, // $11
        data.no_hp || null, // $12
        data.email || null, // $13
        data.status_pernikahan || null, // $14 (Lajang, Menikah, Duda, Janda)
        statusBaptisBool, // $15
        (statusBaptisBool && data.tanggal_baptis) ? new Date(data.tanggal_baptis) : null, // $16
        data.status_jemaat || 'Aktif', // $17
        data.pekerjaan || null, // $18
        data.satelit_id ? parseInt(data.satelit_id, 10) : null, // $19
        data.ayah_id ? parseInt(data.ayah_id, 10) : null, // $20
        data.ayah_nama || null, // $21
        data.gereja_asal_ayah || null, // $22
        data.ibu_id ? parseInt(data.ibu_id, 10) : null, // $23
        data.ibu_nama || null, // $24
        data.gereja_asal_ibu || null, // $25
        data.pasangan_id ? parseInt(data.pasangan_id, 10) : null, // $26
        data.pasangan_nama || null, // $27
        data.gereja_asal_pasangan || null // $28
      ];

      const res = await client.query(insertJemaatQuery, jemaatValues);
      const newJemaatId = res.rows[0].id;

      // Insert komisi map if provided
      if (data.komisi_ids && Array.isArray(data.komisi_ids) && data.komisi_ids.length > 0) {
        const insertKomisiQuery = `
          INSERT INTO jemaat_komisi (jemaat_id, komisi_id, tanggal_bergabung)
          VALUES ($1, $2, CURRENT_DATE)
        `;
        for (const komisiId of data.komisi_ids) {
          await client.query(insertKomisiQuery, [newJemaatId, parseInt(komisiId, 10)]);
        }
      }

      // Insert Anak records if provided
      if (data.anak && Array.isArray(data.anak) && data.anak.length > 0) {
        const insertAnakQuery = `
          INSERT INTO jemaat_anak (orang_tua_id, anak_jemaat_id, nama_anak, gereja_asal_anak)
          VALUES ($1, $2, $3, $4)
        `;
        for (const ank of data.anak) {
          const anakId = ank.anak_jemaat_id ? parseInt(ank.anak_jemaat_id, 10) : null;
          const namaAnk = ank.nama_anak || null;
          const gerejaAnk = ank.gereja_asal_anak || null;
          if (anakId || namaAnk) {
            await client.query(insertAnakQuery, [newJemaatId, anakId, namaAnk, gerejaAnk]);
          }
        }
      }

      // Insert Saudara records (bidirectional) if provided
      if (data.saudara && Array.isArray(data.saudara) && data.saudara.length > 0) {
        // Get jenis_relasi_id for 'Saudara Kandung'
        const jrRes = await client.query(`SELECT id FROM jenis_relasi WHERE nama_relasi = 'Saudara Kandung' LIMIT 1`);
        if (jrRes.rows.length > 0) {
          const jenisRelasiId = jrRes.rows[0].id;
          for (const s of data.saudara) {
            const saudaraId = s.saudara_jemaat_id ? parseInt(s.saudara_jemaat_id, 10) : null;
            if (saudaraId) {
              // A -> B
              await client.query(
                `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                [newJemaatId, saudaraId, jenisRelasiId]
              );
              // B -> A (bidirectional)
              await client.query(
                `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                [saudaraId, newJemaatId, jenisRelasiId]
              );
            }
          }
        }
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
        a.jemaat_id AS ayah_jemaat_id,
        i.jemaat_id AS ibu_jemaat_id,
        p.jemaat_id AS pasangan_jemaat_id,
        ARRAY_REMOVE(ARRAY_AGG(jk.komisi_id), NULL) as komisi_ids
      FROM jemaat j
      LEFT JOIN jemaat a ON j.ayah_id = a.id
      LEFT JOIN jemaat i ON j.ibu_id = i.id
      LEFT JOIN jemaat p ON j.pasangan_id = p.id
      LEFT JOIN jemaat_komisi jk ON j.id = jk.jemaat_id
      WHERE (j.id::text = $1 OR j.jemaat_id = $1) AND j.is_deleted = false
      GROUP BY j.id, a.jemaat_id, i.jemaat_id, p.jemaat_id
    `;
    const res = await pool.query(query, [id]);
    if (res.rows.length === 0) return null;
    
    // Map Array string items to string so it plays nice with frontend expecting string[]
    const row = res.rows[0];
    row.komisi_ids = row.komisi_ids ? row.komisi_ids.map((k: number) => k.toString()) : [];
    
    // Fetch children
    const anakQuery = `
      SELECT ja.id, ja.anak_jemaat_id, ja.nama_anak, ja.gereja_asal_anak, c.jemaat_id AS anak_jemaat_id_text
      FROM jemaat_anak ja
      LEFT JOIN jemaat c ON ja.anak_jemaat_id = c.id
      WHERE ja.orang_tua_id = $1 
      ORDER BY ja.id ASC
    `;
    const anakRes = await pool.query(anakQuery, [row.id]);
    row.anak = anakRes.rows.map(a => ({
      id: a.id,
      anak_jemaat_id: a.anak_jemaat_id ? a.anak_jemaat_id.toString() : '',
      anak_jemaat_id_text: a.anak_jemaat_id_text || '',
      nama_anak: a.nama_anak || '',
      gereja_asal_anak: a.gereja_asal_anak || ''
    }));

    // Fetch saudara kandung from relasi_jemaat
    const saudaraQuery = `
      SELECT
        rj.id,
        rj.jemaat_terkait_id AS saudara_jemaat_id,
        s.jemaat_id           AS saudara_jemaat_kode,
        s.nama_lengkap        AS nama_saudara
      FROM relasi_jemaat rj
      JOIN jenis_relasi jr ON rj.jenis_relasi_id = jr.id
      JOIN jemaat s        ON rj.jemaat_terkait_id = s.id AND s.is_deleted = false
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

      const updateQuery = `
        UPDATE jemaat SET
          nik = $1, nama_lengkap = $2, jenis_kelamin = $3, tempat_lahir = $4, tanggal_lahir = $5,
          alamat = $6, kota = $7, kecamatan = $8, kelurahan = $9, kode_pos = $10, no_hp = $11, email = $12, 
          status_pernikahan = $13, status_baptis = $14, tanggal_baptis = $15, status_jemaat = $16, pekerjaan = $17, satelit_id = $18,
          ayah_id = $19, ayah_nama = $20, gereja_asal_ayah = $21,
          ibu_id = $22, ibu_nama = $23, gereja_asal_ibu = $24,
          pasangan_id = $25, pasangan_nama = $26, gereja_asal_pasangan = $27
        WHERE (id::text = $28 OR jemaat_id = $28)
        RETURNING id
      `;

      const jemaatValues = [
        data.nik || null, // $1
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
        data.status_pernikahan || null, // $13
        statusBaptisBool, // $14
        (statusBaptisBool && data.tanggal_baptis) ? new Date(data.tanggal_baptis) : null, // $15
        data.status_jemaat || 'Aktif', // $16
        data.pekerjaan || null, // $17
        data.satelit_id ? parseInt(data.satelit_id, 10) : null, // $18
        data.ayah_id ? parseInt(data.ayah_id, 10) : null, // $19
        data.ayah_nama || null, // $20
        data.gereja_asal_ayah || null, // $21
        data.ibu_id ? parseInt(data.ibu_id, 10) : null, // $22
        data.ibu_nama || null, // $23
        data.gereja_asal_ibu || null, // $24
        data.pasangan_id ? parseInt(data.pasangan_id, 10) : null, // $25
        data.pasangan_nama || null, // $26
        data.gereja_asal_pasangan || null, // $27
        jemaatId // $28
      ];

      const res = await client.query(updateQuery, jemaatValues);
      
      if (res.rowCount === 0) {
        throw new Error('Jemaat not found');
      }
      
      const primaryId = res.rows[0].id;

      // Wipe current komisi & anak bindings
      await client.query(`DELETE FROM jemaat_komisi WHERE jemaat_id = $1`, [primaryId]);
      await client.query(`DELETE FROM jemaat_anak WHERE orang_tua_id = $1`, [primaryId]);

      // Re-insert komisi bindings if provided
      if (data.komisi_ids && Array.isArray(data.komisi_ids) && data.komisi_ids.length > 0) {
        const insertKomisiQuery = `
          INSERT INTO jemaat_komisi (jemaat_id, komisi_id, tanggal_bergabung)
          VALUES ($1, $2, CURRENT_DATE)
        `;
        for (const komisiId of data.komisi_ids) {
          await client.query(insertKomisiQuery, [primaryId, parseInt(komisiId, 10)]);
        }
      }

      // Re-insert Anak records if provided
      if (data.anak && Array.isArray(data.anak) && data.anak.length > 0) {
        const insertAnakQuery = `
          INSERT INTO jemaat_anak (orang_tua_id, anak_jemaat_id, nama_anak, gereja_asal_anak)
          VALUES ($1, $2, $3, $4)
        `;
        for (const ank of data.anak) {
          const anakId = ank.anak_jemaat_id ? parseInt(ank.anak_jemaat_id, 10) : null;
          const namaAnk = ank.nama_anak || null;
          const gerejaAnk = ank.gereja_asal_anak || null;
          if (anakId || namaAnk) {
            await client.query(insertAnakQuery, [primaryId, anakId, namaAnk, gerejaAnk]);
          }
        }
      }

      // Re-insert Saudara (relasi_jemaat) — delete old bidirectional, then re-insert
      const jrRes = await client.query(`SELECT id FROM jenis_relasi WHERE nama_relasi = 'Saudara Kandung' LIMIT 1`);
      if (jrRes.rows.length > 0) {
        const jenisRelasiId = jrRes.rows[0].id;
        // Delete outgoing relations from this person
        await client.query(
          `DELETE FROM relasi_jemaat WHERE jemaat_id = $1 AND jenis_relasi_id = $2`,
          [primaryId, jenisRelasiId]
        );
        // Delete incoming relations that point TO this person (bidirectional cleanup)
        await client.query(
          `DELETE FROM relasi_jemaat WHERE jemaat_terkait_id = $1 AND jenis_relasi_id = $2`,
          [primaryId, jenisRelasiId]
        );
        if (data.saudara && Array.isArray(data.saudara) && data.saudara.length > 0) {
          for (const s of data.saudara) {
            const saudaraId = s.saudara_jemaat_id ? parseInt(s.saudara_jemaat_id, 10) : null;
            if (saudaraId) {
              // A -> B
              await client.query(
                `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                [primaryId, saudaraId, jenisRelasiId]
              );
              // B -> A
              await client.query(
                `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                [saudaraId, primaryId, jenisRelasiId]
              );
            }
          }
        }
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
