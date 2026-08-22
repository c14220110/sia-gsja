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
        b.tahun_perolehan, b.nilai_perolehan, b.is_aktiva_tetap, b.foto_url,
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
          lokasi_satelit_id, lokasi_sublokasi_id,
          created_by, updated_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18,
          $19, $19
        ) RETURNING id`,
        [
          kodeBarang,                                  // $1
          params.nama,                                 // $2
          params.kategori_id,                          // $3
          params.deskripsi || null,                     // $4
          params.merk || null,                          // $5
          params.no_seri || null,                       // $6
          params.jumlah || 1,                           // $7
          params.kondisi || 'Baik',                     // $8
          params.tahun_perolehan || null,                // $9
          params.nilai_perolehan || 0,                   // $10
          isAktivaTetap,                               // $11
          params.foto_url || null,                      // $12
          params.pemilik_tipe,                          // $13
          params.pemilik_satelit_id || null,             // $14
          params.pemilik_jemaat_id || null,              // $15
          params.pemilik_nama_lain || null,              // $16
          params.lokasi_satelit_id || null,              // $17
          params.lokasi_sublokasi_id || null,            // $18
          params.created_by,                            // $19
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
        updated_by = $18,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $19 AND is_deleted = false
      RETURNING id`,
      [
        params.nama,                                  // $1
        params.kategori_id,                           // $2
        params.deskripsi ?? null,                      // $3
        params.merk ?? null,                           // $4
        params.no_seri ?? null,                        // $5
        params.jumlah,                                // $6
        params.kondisi,                               // $7
        params.tahun_perolehan ?? null,                // $8
        params.nilai_perolehan,                        // $9
        isAktivaTetap,                                // $10
        params.foto_url ?? null,                       // $11
        params.pemilik_tipe,                           // $12
        params.pemilik_satelit_id ?? null,              // $13
        params.pemilik_jemaat_id ?? null,               // $14
        params.pemilik_nama_lain ?? null,               // $15
        params.lokasi_satelit_id ?? null,               // $16
        params.lokasi_sublokasi_id ?? null,             // $17
        params.updated_by,                             // $18
        id,                                           // $19
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
}
