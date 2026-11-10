import pool from '@/lib/db';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface ExampleItem {
  id: number;
  nama: string;
  kategori: string;
  status: 'aktif' | 'nonaktif';
  created_at: string;
}

export interface ExampleFilterParams {
  search?: string;
  kategori?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Repository — export class, diinstansiasi di route file
// ──────────────────────────────────────────────────────────────────────────────

export class ExampleRepository {

  /**
   * Ambil daftar example dengan filter opsional dan paginasi.
   * Data di sini adalah dummy statis (tabel example tidak ada di DB asli).
   */
  async getExamplePagination(params: ExampleFilterParams): Promise<{
    data: ExampleItem[];
    total: number;
  }> {
    const { search, kategori, status, limit = 10, offset = 0 } = params;

    // Data dummy — simulasi seolah ini hasil dari DB
    const allData: ExampleItem[] = [
      { id: 1,  nama: 'Alpha Centauri',    kategori: 'Bintang',  status: 'aktif',    created_at: '2026-01-01' },
      { id: 2,  nama: 'Beta Persei',       kategori: 'Bintang',  status: 'aktif',    created_at: '2026-01-05' },
      { id: 3,  nama: 'Gamma Draconis',    kategori: 'Bintang',  status: 'nonaktif', created_at: '2026-01-10' },
      { id: 4,  nama: 'Delta Cephei',      kategori: 'Bintang',  status: 'aktif',    created_at: '2026-01-15' },
      { id: 5,  nama: 'Epsilon Eridani',   kategori: 'Bintang',  status: 'aktif',    created_at: '2026-02-01' },
      { id: 6,  nama: 'Io',               kategori: 'Bulan',    status: 'aktif',    created_at: '2026-02-05' },
      { id: 7,  nama: 'Europa',            kategori: 'Bulan',    status: 'aktif',    created_at: '2026-02-10' },
      { id: 8,  nama: 'Ganymede',          kategori: 'Bulan',    status: 'nonaktif', created_at: '2026-02-15' },
      { id: 9,  nama: 'Callisto',          kategori: 'Bulan',    status: 'aktif',    created_at: '2026-03-01' },
      { id: 10, nama: 'Titan',             kategori: 'Bulan',    status: 'aktif',    created_at: '2026-03-05' },
      { id: 11, nama: 'Mars',              kategori: 'Planet',   status: 'aktif',    created_at: '2026-03-10' },
      { id: 12, nama: 'Venus',             kategori: 'Planet',   status: 'aktif',    created_at: '2026-03-15' },
      { id: 13, nama: 'Jupiter',           kategori: 'Planet',   status: 'nonaktif', created_at: '2026-04-01' },
      { id: 14, nama: 'Saturnus',          kategori: 'Planet',   status: 'aktif',    created_at: '2026-04-05' },
      { id: 15, nama: 'Uranus',            kategori: 'Planet',   status: 'nonaktif', created_at: '2026-04-10' },
    ];

    // Filter — disimulasikan di in-memory (pada implementasi nyata, gunakan dynamic SQL dengan conditions+idx)
    let filtered = allData;

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(item => item.nama.toLowerCase().includes(q));
    }
    if (kategori) {
      filtered = filtered.filter(item => item.kategori === kategori);
    }
    if (status === 'aktif' || status === 'nonaktif') {
      filtered = filtered.filter(item => item.status === status);
    }

    const total = filtered.length;
    const data  = filtered.slice(offset, offset + limit);

    return { data, total };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Contoh implementasi nyata kalau tabel ini ada di DB:
// (Lihat pola dynamic SQL standar — conditions + idx, bukan whereClauses + paramIndex)
//
// async getExamplePagination(params: ExampleFilterParams) {
//   const { search, kategori, status, limit = 10, offset = 0 } = params;
//
//   const conditions: string[] = [];
//   const values: any[] = [];
//   let idx = 1;
//
//   if (search)   { conditions.push(`e.nama ILIKE $${idx++}`); values.push(`%${search}%`); }
//   if (kategori) { conditions.push(`e.kategori = $${idx++}`); values.push(kategori); }
//   if (status)   { conditions.push(`e.status = $${idx++}`);   values.push(status); }
//
//   const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
//
//   const countRes = await pool.query(`SELECT COUNT(*) FROM example e ${where}`, values);
//   const total = parseInt(countRes.rows[0].count, 10);
//
//   const data = await pool.query(
//     `SELECT * FROM example e ${where} ORDER BY e.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
//     [...values, limit, offset]
//   );
//
//   return { data: data.rows, total };
// }
// ──────────────────────────────────────────────────────────────────────────────
