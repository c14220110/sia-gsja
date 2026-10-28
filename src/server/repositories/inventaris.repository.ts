import pool from '@/lib/db';
import { PoolClient } from 'pg';

// ─── Interfaces ────────────────────────────────────────────

export interface KategoriBarang {
  id: number;
  kode: string;
  nama: string;
  keterangan: string | null;
  is_active: boolean;
}

export interface Sublokasi {
  id: number;
  satelit_id: number;
  nama_satelit: string;
  kode: string | null;
  nama: string;
  is_active: boolean;
}

export interface BarangData {
  id: number;
  kode_barang: string;
  nama: string;
  kategori_id: number;
  nama_kategori: string;
  kode_kategori: string;
  deskripsi: string | null;
  merk: string | null;
  no_seri: string | null;
  jumlah: number;
  kondisi: string;
  tipe_barang: string;
  tahun_perolehan: number | null;
  nilai_perolehan: number;
  is_aktiva_tetap: boolean;
  foto_url: string | null;
  pemilik_tipe: string;
  pemilik_satelit_id: number | null;
  pemilik_nama: string | null;
  pemilik_jemaat_id: number | null;
  pemilik_nama_lain: string | null;
  lokasi_satelit_id: number | null;
  lokasi_nama_satelit: string | null;
  lokasi_sublokasi_id: number | null;
  lokasi_nama_sublokasi: string | null;
  status: string;
  created_at: Date;
}

export interface BarangFilterParams {
  search?: string;
  kategori_id?: string;
  lokasi_satelit_id?: string;
  lokasi_sublokasi_id?: string;
  pemilik_satelit_id?: string;
  kondisi?: string;
  status?: string;
  is_aktiva_tetap?: string;
  tipe_barang?: string;
  limit?: number;
  offset?: number;
}

export interface CreateBarangParams {
  nama: string;
  kategori_id: number;
  deskripsi?: string;
  merk?: string;
  no_seri?: string;
  jumlah: number;
  kondisi?: string;
  tipe_barang?: string;
  tahun_perolehan?: number;
  nilai_perolehan?: number;
  foto_url?: string;
  pemilik_tipe: string;
  pemilik_satelit_id?: number;
  pemilik_jemaat_id?: number;
  pemilik_nama_lain?: string;
  lokasi_satelit_id?: number;
  lokasi_sublokasi_id?: number;
  created_by: number;
}


// ─── Repository Class ──────────────────────────────────────

export class InventarisRepository {

  // ── Master Data ──────────────────────────────────────────

  async getKategoriList(): Promise<KategoriBarang[]> {
    const result = await pool.query(
      `SELECT id, kode, nama, keterangan, is_active
       FROM master_kategori_barang
       WHERE is_active = true
       ORDER BY kode ASC`
    );
    return result.rows;
  }

  async getSublokasiList(satelitId?: number): Promise<Sublokasi[]> {
    const conditions: string[] = ['sl.is_active = true'];
    const values: any[] = [];
    let idx = 1;

    if (satelitId) {
      conditions.push(`sl.satelit_id = $${idx++}`);
      values.push(satelitId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT sl.id, sl.satelit_id, s.nama_satelit, sl.kode, sl.nama, sl.is_active
       FROM master_sublokasi sl
       JOIN satelit s ON sl.satelit_id = s.id
       ${where}
       ORDER BY s.nama_satelit, sl.nama ASC`,
      values
    );
    return result.rows;
  }

  async getKategoriAll(): Promise<KategoriBarang[]> {
    const result = await pool.query(
      `SELECT id, kode, nama, keterangan, is_active FROM master_kategori_barang ORDER BY kode ASC`
    );
    return result.rows;
  }

  async updateKategori(id: number, params: { keterangan?: string; is_active?: boolean; nama?: string }): Promise<boolean> {
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (params.nama !== undefined) { sets.push(`nama = $${idx++}`); values.push(params.nama); }
    if (params.keterangan !== undefined) { sets.push(`keterangan = $${idx++}`); values.push(params.keterangan); }
    if (params.is_active !== undefined) { sets.push(`is_active = $${idx++}`); values.push(params.is_active); }
    if (sets.length === 0) return false;
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const result = await pool.query(
      `UPDATE master_kategori_barang SET ${sets.join(', ')} WHERE id = $${idx}`,
      values
    );
    return (result.rowCount ?? 0) > 0;
  }

  async createKategori(params: { nama: string; keterangan?: string }): Promise<{ id: number; kode: string }> {
    // Auto-generate kode: ambil kode tertinggi + 1, format 2 digit
    const maxRes = await pool.query(
      `SELECT COALESCE(MAX(CAST(kode AS INTEGER)), 0) AS max_kode FROM master_kategori_barang`
    );
    const nextNum = (parseInt(maxRes.rows[0].max_kode, 10) || 0) + 1;
    const kode = String(nextNum).padStart(2, '0');

    const result = await pool.query(
      `INSERT INTO master_kategori_barang (kode, nama, keterangan, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id`,
      [kode, params.nama.trim(), params.keterangan?.trim() || null]
    );
    return { id: result.rows[0].id, kode };
  }

  async deleteKategori(id: number): Promise<{ ok: boolean; reason?: string }> {
    // Cek apakah ada barang aktif yang pakai kategori ini
    const used = await pool.query(
      `SELECT COUNT(*) AS cnt FROM barang WHERE kategori_id = $1 AND is_deleted = false`,
      [id]
    );
    if (parseInt(used.rows[0].cnt, 10) > 0) {
      return { ok: false, reason: `Kategori masih digunakan oleh ${used.rows[0].cnt} barang aktif. Pindahkan atau hapus barang tersebut terlebih dahulu.` };
    }
    const result = await pool.query(`DELETE FROM master_kategori_barang WHERE id = $1`, [id]);
    return { ok: (result.rowCount ?? 0) > 0 };
  }

  async getSublokasiAll(satelitId?: number): Promise<any[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (satelitId) { conditions.push(`sl.satelit_id = $${idx++}`); values.push(satelitId); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT sl.id, sl.satelit_id, s.nama_satelit, sl.kode, sl.nama, sl.is_active, sl.created_at
       FROM master_sublokasi sl
       JOIN satelit s ON sl.satelit_id = s.id
       ${where}
       ORDER BY s.nama_satelit, sl.nama ASC`,
      values
    );
    return result.rows;
  }

  async createSublokasi(params: { satelit_id: number; kode: string; nama: string }): Promise<number> {
    const result = await pool.query(
      `INSERT INTO master_sublokasi (satelit_id, kode, nama) VALUES ($1, $2, $3) RETURNING id`,
      [params.satelit_id, params.kode.toUpperCase().trim(), params.nama.trim()]
    );
    return result.rows[0].id;
  }

  async updateSublokasi(id: number, params: { kode?: string; nama?: string; is_active?: boolean }): Promise<boolean> {
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (params.kode !== undefined) { sets.push(`kode = $${idx++}`); values.push(params.kode.toUpperCase().trim()); }
    if (params.nama !== undefined) { sets.push(`nama = $${idx++}`); values.push(params.nama.trim()); }
    if (params.is_active !== undefined) { sets.push(`is_active = $${idx++}`); values.push(params.is_active); }
    if (sets.length === 0) return false;
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const result = await pool.query(
      `UPDATE master_sublokasi SET ${sets.join(', ')} WHERE id = $${idx}`,
      values
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteSublokasi(id: number): Promise<{ ok: boolean; reason?: string }> {
    const check = await pool.query(
      `SELECT COUNT(*) AS cnt FROM barang WHERE lokasi_sublokasi_id = $1 AND is_deleted = false`,
      [id]
    );
    if (parseInt(check.rows[0].cnt, 10) > 0) {
      return { ok: false, reason: 'Sub-lokasi masih digunakan oleh barang aktif.' };
    }
    const result = await pool.query(`DELETE FROM master_sublokasi WHERE id = $1`, [id]);
    return { ok: (result.rowCount ?? 0) > 0 };
  }

  async getSublokasiById(id: number): Promise<{ id: number; satelit_id: number; nama: string } | null> {
    const res = await pool.query(`SELECT id, satelit_id, nama FROM master_sublokasi WHERE id = $1`, [id]);
    return res.rows[0] ?? null;
  }

  /** Stats untuk KPI cards — filter-aware */
  async getInventarisStats(params: {
    lokasi_satelit_id?: string;
    kategori_id?: string;
  }): Promise<{
    total: number; kondisi_baik: number; perlu_perhatian: number; total_nilai: number;
    per_kategori: Array<{ kategori_id: number; count: number }>;
  }> {
    const conditions: string[] = ['b.is_deleted = false', "b.status != 'Disposed'"];
    const values: any[] = [];
    let idx = 1;

    if (params.lokasi_satelit_id) {
      conditions.push(`b.lokasi_satelit_id = $${idx++}`);
      values.push(parseInt(params.lokasi_satelit_id, 10));
    }
    if (params.kategori_id) {
      conditions.push(`b.kategori_id = $${idx++}`);
      values.push(parseInt(params.kategori_id, 10));
    }

    const where = conditions.join(' AND ');

    // KPI totals
    const kpiSql = `
      SELECT
        COUNT(*)                                                            AS total,
        COUNT(*) FILTER (WHERE b.kondisi = 'Baik')                         AS kondisi_baik,
        COUNT(*) FILTER (WHERE b.kondisi IN ('Rusak Ringan','Rusak Berat')) AS perlu_perhatian,
        COALESCE(SUM(b.nilai_perolehan), 0)                                AS total_nilai
      FROM barang b
      WHERE ${where}
    `;
    const kpiRes = await pool.query(kpiSql, values);
    const row = kpiRes.rows[0];

    // Per-kategori counts (always without kategori_id filter so all chips are visible)
    const catConditions = ['b.is_deleted = false', "b.status != 'Disposed'"];
    const catValues: any[] = [];
    if (params.lokasi_satelit_id) {
      catConditions.push(`b.lokasi_satelit_id = $1`);
      catValues.push(parseInt(params.lokasi_satelit_id, 10));
    }
    const catSql = `
      SELECT b.kategori_id, COUNT(*) AS cnt
      FROM barang b
      WHERE ${catConditions.join(' AND ')}
      GROUP BY b.kategori_id
    `;
    const catRes = await pool.query(catSql, catValues);
    const per_kategori: Array<{ kategori_id: number; count: number }> = catRes.rows.map((r) => ({
      kategori_id: parseInt(r.kategori_id, 10),
      count: parseInt(r.cnt, 10),
    }));

    return {
      total:           parseInt(row.total, 10),
      kondisi_baik:    parseInt(row.kondisi_baik, 10),
      perlu_perhatian: parseInt(row.perlu_perhatian, 10),
      total_nilai:     parseFloat(row.total_nilai),
      per_kategori,
    };
  }

  // ── Generate Kode Barang (ATOMIC via counter table) ───────
  // Format: INV-{tahun}-{kode_kategori}-{nomor_urut_4digit}
  // Nomor urut GLOBAL per kategori per tahun
  // Menggunakan tabel kode_barang_counter dengan INSERT ... ON CONFLICT
  // UPDATE ... RETURNING untuk menghindari race condition.
  // HARUS dipanggil di dalam transaction yang sama dengan INSERT barang.

  async generateKodeBarang(client: PoolClient, kategoriId: number, tahun?: number): Promise<string> {
    const year = tahun || new Date().getFullYear();

    // Ambil kode kategori
    const katRes = await client.query(
      `SELECT kode FROM master_kategori_barang WHERE id = $1`,
      [kategoriId]
    );
    if (katRes.rows.length === 0) throw new Error('Kategori tidak ditemukan');
    const kodeKategori = katRes.rows[0].kode;

    // Atomic increment: INSERT row baru atau UPDATE existing, return nomor baru
    const counterRes = await client.query(
      `INSERT INTO kode_barang_counter (kategori_id, tahun, last_number)
       VALUES ($1, $2, 1)
       ON CONFLICT (kategori_id, tahun)
       DO UPDATE SET last_number = kode_barang_counter.last_number + 1
       RETURNING last_number`,
      [kategoriId, year]
    );
    const nextNum = counterRes.rows[0].last_number;

    return `INV-${year}-${kodeKategori}-${nextNum.toString().padStart(4, '0')}`;
  }

  // ── CRUD Barang ──────────────────────────────────────────

  async getBarangPagination(params: BarangFilterParams): Promise<{ data: BarangData[], total: number }> {
    const {
      search, kategori_id, lokasi_satelit_id, lokasi_sublokasi_id,
      pemilik_satelit_id, kondisi, status, is_aktiva_tetap,
      limit = 10, offset = 0
    } = params;

    const conditions: string[] = ['b.is_deleted = false'];
    const values: any[] = [];
    let idx = 1;

    if (search) {
      conditions.push(`(b.nama ILIKE $${idx} OR b.kode_barang ILIKE $${idx} OR b.merk ILIKE $${idx} OR b.no_seri ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    if (kategori_id) {
      conditions.push(`b.kategori_id = $${idx++}`);
      values.push(parseInt(kategori_id, 10));
    }

    if (lokasi_satelit_id) {
      conditions.push(`b.lokasi_satelit_id = $${idx++}`);
      values.push(parseInt(lokasi_satelit_id, 10));
    }

    if (lokasi_sublokasi_id) {
      conditions.push(`b.lokasi_sublokasi_id = $${idx++}`);
      values.push(parseInt(lokasi_sublokasi_id, 10));
    }

    if (pemilik_satelit_id) {
      conditions.push(`b.pemilik_satelit_id = $${idx++}`);
      values.push(parseInt(pemilik_satelit_id, 10));
    }

    if (kondisi) {
      conditions.push(`b.kondisi = $${idx++}`);
      values.push(kondisi);
    }

    if (status) {
      conditions.push(`b.status = $${idx++}`);
      values.push(status);
    }

    if (is_aktiva_tetap) {
      conditions.push(`b.is_aktiva_tetap = $${idx++}`);
      values.push(is_aktiva_tetap === 'true');
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // Count query
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM barang b ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Data query
    const dataQuery = `
      SELECT
        b.id, b.kode_barang, b.nama, b.kategori_id,
        mk.nama AS nama_kategori, mk.kode AS kode_kategori,
        b.deskripsi, b.merk, b.no_seri, b.jumlah, b.kondisi,
        b.tahun_perolehan, b.nilai_perolehan, b.is_aktiva_tetap, b.foto_url, b.tipe_barang,
        b.pemilik_tipe, b.pemilik_satelit_id,
        COALESCE(sp.nama_satelit, j.nama_lengkap, b.pemilik_nama_lain) AS pemilik_nama,
        b.pemilik_jemaat_id, b.pemilik_nama_lain,
        b.lokasi_satelit_id,
        sl.nama_satelit AS lokasi_nama_satelit,
        b.lokasi_sublokasi_id,
        sub.nama AS lokasi_nama_sublokasi,
        b.status, b.created_at
      FROM barang b
      LEFT JOIN master_kategori_barang mk ON b.kategori_id = mk.id
      LEFT JOIN satelit sp ON b.pemilik_satelit_id = sp.id
      LEFT JOIN jemaat j ON b.pemilik_jemaat_id = j.id
      LEFT JOIN satelit sl ON b.lokasi_satelit_id = sl.id
      LEFT JOIN master_sublokasi sub ON b.lokasi_sublokasi_id = sub.id
      ${where}
      ORDER BY b.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    values.push(limit, offset);

    const result = await pool.query(dataQuery, values);
    return { data: result.rows, total };
  }

  async getBarangById(id: number): Promise<BarangData | null> {
    const result = await pool.query(
      `SELECT
        b.*,
        mk.nama AS nama_kategori, mk.kode AS kode_kategori,
        COALESCE(sp.nama_satelit, j.nama_lengkap, b.pemilik_nama_lain) AS pemilik_nama,
        sl.nama_satelit AS lokasi_nama_satelit,
        sub.nama AS lokasi_nama_sublokasi
      FROM barang b
      LEFT JOIN master_kategori_barang mk ON b.kategori_id = mk.id
      LEFT JOIN satelit sp ON b.pemilik_satelit_id = sp.id
      LEFT JOIN jemaat j ON b.pemilik_jemaat_id = j.id
      LEFT JOIN satelit sl ON b.lokasi_satelit_id = sl.id
      LEFT JOIN master_sublokasi sub ON b.lokasi_sublokasi_id = sub.id
      WHERE b.id = $1 AND b.is_deleted = false`,
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async createBarang(params: CreateBarangParams): Promise<number> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const isAktivaTetap = (params.nilai_perolehan || 0) >= 3000000;
      const kodeBarang = await this.generateKodeBarang(
        client,
        params.kategori_id,
        params.tahun_perolehan
      );

      const result = await client.query(
        `INSERT INTO barang (
          kode_barang, nama, kategori_id, deskripsi, merk, no_seri,
          jumlah, kondisi, tahun_perolehan, nilai_perolehan, is_aktiva_tetap, foto_url,
          pemilik_tipe, pemilik_satelit_id, pemilik_jemaat_id, pemilik_nama_lain,
          lokasi_satelit_id, lokasi_sublokasi_id, tipe_barang,
          created_by, updated_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19,
          $20, $20
        ) RETURNING id`,
        [
          kodeBarang,                                  // $1
          params.nama?.trim(),                         // $2
          params.kategori_id,                          // $3
          params.deskripsi?.trim() || null,            // $4
          params.merk?.trim() || null,                 // $5
          params.no_seri?.trim() || null,              // $6
          params.tipe_barang === 'satuan' ? 1 : (params.jumlah || 1), // $7
          params.kondisi || 'Baik',                    // $8
          params.tahun_perolehan || null,              // $9
          params.nilai_perolehan || 0,                 // $10
          isAktivaTetap,                               // $11
          params.foto_url?.trim() || null,             // $12
          params.pemilik_tipe,                         // $13
          params.pemilik_satelit_id || null,           // $14
          params.pemilik_jemaat_id || null,            // $15
          params.pemilik_nama_lain?.trim() || null,    // $16
          params.lokasi_satelit_id || null,            // $17
          params.lokasi_sublokasi_id || null,          // $18
          params.tipe_barang || 'massal',              // $19
          params.created_by,                           // $20
        ]
      );

      await client.query('COMMIT');
      return result.rows[0].id;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async updateBarang(id: number, params: Partial<CreateBarangParams> & { updated_by: number }): Promise<boolean> {
    const isAktivaTetap = (params.nilai_perolehan || 0) >= 3000000;

    const result = await pool.query(
      `UPDATE barang SET
        nama = COALESCE($1, nama),
        kategori_id = COALESCE($2, kategori_id),
        deskripsi = $3,
        merk = $4,
        no_seri = $5,
        jumlah = COALESCE($6, jumlah),
        kondisi = COALESCE($7, kondisi),
        tahun_perolehan = $8,
        nilai_perolehan = COALESCE($9, nilai_perolehan),
        is_aktiva_tetap = $10,
        foto_url = $11,
        pemilik_tipe = COALESCE($12, pemilik_tipe),
        pemilik_satelit_id = $13,
        pemilik_jemaat_id = $14,
        pemilik_nama_lain = $15,
        lokasi_satelit_id = $16,
        lokasi_sublokasi_id = $17,
        tipe_barang = COALESCE($18, tipe_barang),
        updated_by = $19,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $20 AND is_deleted = false
      RETURNING id`,
      [
        params.nama?.trim(),                          // $1
        params.kategori_id,                           // $2
        params.deskripsi?.trim() || null,             // $3
        params.merk?.trim() || null,                  // $4
        params.no_seri?.trim() || null,               // $5
        params.tipe_barang === 'satuan' ? 1 : params.jumlah, // $6
        params.kondisi,                               // $7
        params.tahun_perolehan ?? null,               // $8
        params.nilai_perolehan ?? null,               // $9
        isAktivaTetap,                                // $10
        params.foto_url?.trim() || null,              // $11
        params.pemilik_tipe,                          // $12
        params.pemilik_satelit_id ?? null,            // $13
        params.pemilik_jemaat_id ?? null,             // $14
        params.pemilik_nama_lain?.trim() || null,     // $15
        params.lokasi_satelit_id ?? null,             // $16
        params.lokasi_sublokasi_id ?? null,           // $17
        params.tipe_barang ?? null,                   // $18
        params.updated_by,                            // $19
        id,                                           // $20
      ]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async softDeleteBarang(id: number, userId: number): Promise<boolean> {
    const result = await pool.query(
      `UPDATE barang SET is_deleted = true, updated_by = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND is_deleted = false
       RETURNING id`,
      [userId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ── Stok Opname ──────────────────────────────────────────

  async getStokOpnamePagination(params: {
    satelit_id?: string; status?: string; search?: string; limit?: number; offset?: number;
  }): Promise<{ data: any[], total: number }> {
    const { satelit_id, status, search, limit = 10, offset = 0 } = params;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (satelit_id) {
      conditions.push(`so.satelit_id = $${idx++}`);
      values.push(parseInt(satelit_id, 10));
    }
    if (status) {
      conditions.push(`so.status = $${idx++}`);
      values.push(status);
    }
    if (search) {
      conditions.push(`so.judul ILIKE $${idx++}`);
      values.push(`%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*) as total FROM stok_opname so ${where}`,
      values
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const dataQuery = `
      SELECT so.*, s.nama_satelit,
        p.id AS creator_id,
        j.nama_lengkap AS created_by_name,
        pv.id AS verifier_id,
        jv.nama_lengkap AS verified_by_name,
        (SELECT COUNT(*) FROM stok_opname_detail sod WHERE sod.stok_opname_id = so.id) AS total_items,
        (SELECT COUNT(*) FROM stok_opname_detail sod WHERE sod.stok_opname_id = so.id AND sod.jumlah_fisik IS NOT NULL) AS items_checked
      FROM stok_opname so
      JOIN satelit s ON so.satelit_id = s.id
      LEFT JOIN pengguna p ON so.created_by = p.id
      LEFT JOIN jemaat j ON p.jemaat_id = j.id
      LEFT JOIN pengguna pv ON so.verified_by = pv.id
      LEFT JOIN jemaat jv ON pv.jemaat_id = jv.id
      ${where}
      ORDER BY so.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    values.push(limit, offset);
    const result = await pool.query(dataQuery, values);
    return { data: result.rows, total };
  }

  async getStokOpnameById(id: number): Promise<any | null> {
    const sessionRes = await pool.query(
      `SELECT so.*, s.nama_satelit,
        p.id AS creator_id,
        j.nama_lengkap AS created_by_name,
        pv.id AS verifier_id,
        jv.nama_lengkap AS verified_by_name
       FROM stok_opname so
       JOIN satelit s ON so.satelit_id = s.id
       LEFT JOIN pengguna p ON so.created_by = p.id
       LEFT JOIN jemaat j ON p.jemaat_id = j.id
       LEFT JOIN pengguna pv ON so.verified_by = pv.id
       LEFT JOIN jemaat jv ON pv.jemaat_id = jv.id
       WHERE so.id = $1`,
      [id]
    );
    if (sessionRes.rows.length === 0) return null;

    const detailRes = await pool.query(
      `SELECT sod.*,
        b.kode_barang, b.nama AS nama_barang, b.jumlah AS jumlah_sistem, b.tipe_barang,
        mk.nama AS nama_kategori,
        ms.nama AS nama_sublokasi,
        pc.id AS checker_id,
        jc.nama_lengkap AS checked_by_name
       FROM stok_opname_detail sod
       JOIN barang b ON sod.barang_id = b.id
       JOIN master_kategori_barang mk ON b.kategori_id = mk.id
       LEFT JOIN master_sublokasi ms ON b.lokasi_sublokasi_id = ms.id
       LEFT JOIN pengguna pc ON sod.checked_by = pc.id
       LEFT JOIN jemaat jc ON pc.jemaat_id = jc.id
       WHERE sod.stok_opname_id = $1
       ORDER BY mk.nama, b.nama`,
      [id]
    );

    return { ...sessionRes.rows[0], detail: detailRes.rows };
  }

  async createStokOpname(params: {
    satelit_id: number; judul: string; tanggal: string;
    periode?: string; catatan?: string; created_by: number;
  }): Promise<number> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Buat session stok opname
      const sessionRes = await client.query(
        `INSERT INTO stok_opname (satelit_id, judul, tanggal, periode, catatan, created_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'Draft')
         RETURNING id`,
        [params.satelit_id, params.judul, params.tanggal, params.periode || null, params.catatan || null, params.created_by]
      );
      const sessionId = sessionRes.rows[0].id;

      // Auto-populate detail: semua barang aktif di satelit ini
      const barangRes = await client.query(
        `SELECT id, jumlah FROM barang
         WHERE lokasi_satelit_id = $1 AND is_deleted = false AND status = 'Aktif'`,
        [params.satelit_id]
      );

      if (barangRes.rows.length > 0) {
        const values: string[] = [];
        const args: any[] = [];
        let argIdx = 1;
        for (const b of barangRes.rows) {
          values.push(`($${argIdx++}, $${argIdx++}, $${argIdx++})`);
          args.push(sessionId, b.id, b.jumlah);
        }
        await client.query(
          `INSERT INTO stok_opname_detail (stok_opname_id, barang_id, jumlah_tercatat)
           VALUES ${values.join(', ')}`,
          args
        );
      }

      await client.query('COMMIT');
      return sessionId;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async startStokOpname(id: number): Promise<boolean> {
    const result = await pool.query(
      `UPDATE stok_opname SET status = 'Berjalan', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'Draft'
       RETURNING id`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async updateStokOpnameDetail(params: {
    detail_id: number; jumlah_fisik: number; kondisi_fisik?: string;
    keterangan?: string; foto_bukti?: string; checked_by: number;
  }): Promise<boolean> {
    // Hitung selisih: jumlah_fisik - jumlah_tercatat
    const detailRes = await pool.query(
      `SELECT jumlah_tercatat FROM stok_opname_detail WHERE id = $1`,
      [params.detail_id]
    );
    if (detailRes.rows.length === 0) return false;
    const selisih = params.jumlah_fisik - detailRes.rows[0].jumlah_tercatat;

    const result = await pool.query(
      `UPDATE stok_opname_detail
       SET jumlah_fisik = $1, kondisi_fisik = $2, keterangan = $3,
           foto_bukti = $4, selisih = $5, checked_by = $6, checked_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING id`,
      [params.jumlah_fisik, params.kondisi_fisik || null, params.keterangan || null,
       params.foto_bukti || null, selisih, params.checked_by, params.detail_id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async verifyStokOpname(id: number, verifiedBy: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Mark sesi sebagai Selesai
      const result = await client.query(
        `UPDATE stok_opname
         SET status = 'Selesai', verified_by = $1, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND status = 'Berjalan'
         RETURNING id`,
        [verifiedBy, id]
      );

      if ((result.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      // 2. Auto-update kondisi barang berdasarkan kondisi_fisik yang dicatat
      await client.query(
        `UPDATE barang b
         SET kondisi = sod.kondisi_fisik, updated_at = CURRENT_TIMESTAMP
         FROM stok_opname_detail sod
         WHERE sod.stok_opname_id = $1
           AND sod.kondisi_fisik IS NOT NULL
           AND sod.kondisi_fisik != ''
           AND sod.kondisi_fisik != 'Tidak Ditemukan'
           AND b.id = sod.barang_id`,
        [id]
      );

      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
