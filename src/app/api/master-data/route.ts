import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// GET — Angkat semua data master
export async function GET(request: NextRequest) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const search = searchParams.get('search') || '';

    const ALLOWED_TABLES: Record<string, { query: string; orderBy: string }> = {
      wilayah: {
        query: `SELECT w.id, w.kode_wilayah, w.nama_wilayah, w.satelit_id, w.is_active, w.created_at, s.nama_satelit
                FROM wilayah w
                LEFT JOIN satelit s ON w.satelit_id = s.id`,
        orderBy: 'w.kode_wilayah',
      },
      satelit: {
        query: `
          SELECT s.id, s.kode_satelit, s.nama_satelit, s.alamat, s.kota, s.kontak_satelit, s.is_active,
                 (SELECT COUNT(*) FROM wilayah w WHERE w.satelit_id = s.id AND w.is_active = true) AS jumlah_wilayah
          FROM satelit s
        `,
        orderBy: 's.kode_satelit',
      },
      departemen: {
        query: `SELECT id, nama_departemen, is_active, created_at FROM departemen`,
        orderBy: 'nama_departemen',
      },
      komisi: {
        query: `
          SELECT k.id, k.nama_komisi, k.is_active, k.created_at, s.nama_satelit
          FROM komisi k
          LEFT JOIN satelit s ON k.satelit_id = s.id
        `,
        orderBy: 'k.nama_komisi',
      },
      periode_kepengurusan: {
        query: `SELECT id, nama_periode, tahun_mulai, tahun_akhir, is_active FROM periode_kepengurusan`,
        orderBy: 'tahun_mulai DESC',
      },
      jabatan: {
        query: `SELECT id, nama_jabatan, is_active FROM jabatan`,
        orderBy: 'id',
      },
      role_pelayan: {
        query: `SELECT id, nama_role, deskripsi, is_active, created_at FROM role_pelayan`,
        orderBy: 'nama_role',
      },
      pekerjaan_master: {
        query: `SELECT id, nama_pekerjaan, is_active, created_at FROM pekerjaan_master`,
        orderBy: 'nama_pekerjaan',
      },
      jenis_kegiatan: {
        query: `SELECT id, nama_jenis_kegiatan, kategori FROM jenis_kegiatan WHERE butuh_permohonan = false`,
        orderBy: 'kategori, nama_jenis_kegiatan',
      },
      jabatan_pegawai_master: {
        query: `SELECT id, nama_jabatan, is_active FROM jabatan_pegawai_master WHERE is_active = TRUE`,
        orderBy: 'nama_jabatan',
      },
      buku_besar_coa: {
        query: `SELECT id, kode_akun, nama_akun, tipe_akun, is_active FROM buku_besar_coa WHERE is_active = TRUE`,
        orderBy: 'kode_akun',
      },
    };

    if (!table || !ALLOWED_TABLES[table]) {
      return NextResponse.json({ success: false, message: 'Tabel tidak valid' }, { status: 400 });
    }

    const { query, orderBy } = ALLOWED_TABLES[table];
    const searchCols: Record<string, string> = {
      wilayah: 'w.nama_wilayah',
      satelit: 's.nama_satelit',
      departemen: 'nama_departemen',
      komisi: 'k.nama_komisi',
      periode_kepengurusan: 'nama_periode',
      jabatan: 'nama_jabatan',
      role_pelayan: 'nama_role',
      pekerjaan_master: 'nama_pekerjaan',
      jenis_kegiatan: 'nama_jenis_kegiatan',
      jabatan_pegawai_master: 'nama_jabatan',
      buku_besar_coa: 'nama_akun',
    };

    let fullQuery = query;
    const values: any[] = [];
    let whereClauses: string[] = [];

    if (search && searchCols[table]) {
      whereClauses.push(`${searchCols[table]} ILIKE $${values.length + 1}`);
      values.push(`%${search}%`);
    }

    if (table === 'komisi') {
      const satelit_id = searchParams.get('satelit_id');
      if (satelit_id) {
        whereClauses.push(`k.satelit_id = $${values.length + 1}`);
        values.push(satelit_id);
      }
    }

    if (table === 'wilayah') {
      const satelit_id = searchParams.get('satelit_id');
      if (satelit_id) {
        whereClauses.push(`w.satelit_id = $${values.length + 1}`);
        values.push(satelit_id);
      }
    }

    if (whereClauses.length > 0) {
      // Because some allowed queries already contain a WHERE clause (e.g., jabatan_pegawai_master),
      // pastikan cek n ricek querynya itu punya klausa WHERE atau belum.
      const hasWhere = fullQuery.toUpperCase().includes('WHERE ');
      if (hasWhere) {
        fullQuery += ` AND ` + whereClauses.join(' AND ');
      } else {
        fullQuery += ` WHERE ` + whereClauses.join(' AND ');
      }
    }

    fullQuery += ` ORDER BY ${orderBy}`;

    const res = await pool.query(fullQuery, values);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error) {
    console.error('[MasterDataRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

// POST — Setorin data anyar buat nambah koleksi masternya
export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller || !caller.is_super_admin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { table, data } = body;

    let query = '';
    let values: any[] = [];

    switch (table) {
      case 'wilayah':
        query = `INSERT INTO wilayah (kode_wilayah, nama_wilayah, satelit_id) VALUES ($1, $2, $3) RETURNING id`;
        values = [data.kode_wilayah, data.nama_wilayah, data.satelit_id];
        break;
      case 'satelit':
        query = `INSERT INTO satelit (kode_satelit, nama_satelit, alamat, kota, kontak_satelit) VALUES ($1, $2, $3, $4, $5) RETURNING id`;
        values = [data.kode_satelit, data.nama_satelit, data.alamat || null, data.kota || null, data.kontak_satelit || null];
        break;
      case 'departemen':
        query = `INSERT INTO departemen (nama_departemen) VALUES ($1) RETURNING id`;
        values = [data.nama_departemen];
        break;
      case 'komisi':
        query = `INSERT INTO komisi (nama_komisi, satelit_id) VALUES ($1, $2) RETURNING id`;
        values = [data.nama_komisi, data.satelit_id];
        break;
      case 'periode_kepengurusan':
        query = `INSERT INTO periode_kepengurusan (nama_periode, tahun_mulai, tahun_akhir) VALUES ($1, $2, $3) RETURNING id`;
        values = [data.nama_periode, data.tahun_mulai, data.tahun_akhir];
        break;
      case 'jabatan':
        query = `INSERT INTO jabatan (nama_jabatan) VALUES ($1) RETURNING id`;
        values = [data.nama_jabatan];
        break;
      case 'role_pelayan':
        query = `INSERT INTO role_pelayan (nama_role, deskripsi) VALUES ($1, $2) RETURNING id`;
        values = [data.nama_role, data.deskripsi || null];
        break;
      case 'pekerjaan_master':
        query = `INSERT INTO pekerjaan_master (nama_pekerjaan) VALUES ($1) RETURNING id`;
        values = [data.nama_pekerjaan];
        break;
      case 'jenis_kegiatan':
        query = `INSERT INTO jenis_kegiatan (nama_jenis_kegiatan) VALUES ($1) RETURNING id`;
        values = [data.nama_jenis_kegiatan];
        break;
      default:
        return NextResponse.json({ success: false, message: 'Tabel tidak valid' }, { status: 400 });
    }

    const res = await pool.query(query, values);
    return NextResponse.json({ success: true, id: res.rows[0].id });
  } catch (error: any) {
    console.error('[MasterDataRoute] POST error:', error);
    if (error.code === '23505') {
      return NextResponse.json({ success: false, message: 'Data sudah ada (duplikat)' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE — Hapus aja sampai akarnya berdasarkan ID-nya
export async function DELETE(request: NextRequest) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller || !caller.is_super_admin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const id = searchParams.get('id');

    const DELETABLE = ['jenis_kegiatan'];
    if (!table || !id || !DELETABLE.includes(table)) {
      return NextResponse.json({ success: false, message: 'Tabel tidak dapat dihapus atau ID tidak valid' }, { status: 400 });
    }

    const res = await pool.query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [id]);
    if (res.rowCount === 0) return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[MasterDataRoute] DELETE error:', error);
    if (error.code === '23503') {
      return NextResponse.json({ success: false, message: 'Data ini masih digunakan dan tidak bisa dihapus' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH — Buat ngatur aktif gaknya atau main update isian
export async function PATCH(request: NextRequest) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller || !caller.is_super_admin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { table, id, is_active, ...data } = body;

    const ALLOWED_TABLES = ['wilayah', 'satelit', 'departemen', 'komisi', 'periode_kepengurusan', 'pekerjaan_master', 'role_pelayan', 'jabatan', 'jenis_kegiatan'];
    
    if (!table || !id || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ success: false, message: 'Parameter tabel/id tidak valid' }, { status: 400 });
    }

    // Toggle status mode
    if (typeof is_active === 'boolean') {
      const TOGGLEABLE = ['satelit', 'departemen', 'komisi', 'periode_kepengurusan', 'pekerjaan_master', 'role_pelayan', 'jabatan', 'wilayah'];
      if (!TOGGLEABLE.includes(table)) {
        return NextResponse.json({ success: false, message: 'Parameter tidak valid untuk tabel ini' }, { status: 400 });
      }
      await pool.query(`UPDATE ${table} SET is_active = $1 WHERE id = $2`, [is_active, id]);
      return NextResponse.json({ success: true });
    }

    // Pindah tuas ke mode update/edit ganti data
    let query = '';
    let values: any[] = [];

    switch (table) {
      case 'wilayah':
        query = `UPDATE wilayah SET kode_wilayah = $1, nama_wilayah = $2, satelit_id = $3 WHERE id = $4`;
        values = [data.kode_wilayah, data.nama_wilayah, data.satelit_id, id];
        break;
      case 'satelit':
        query = `UPDATE satelit SET kode_satelit = $1, nama_satelit = $2, alamat = $3, kota = $4, kontak_satelit = $5 WHERE id = $6`;
        values = [data.kode_satelit, data.nama_satelit, data.alamat || null, data.kota || null, data.kontak_satelit || null, id];
        break;
      case 'departemen':
        query = `UPDATE departemen SET nama_departemen = $1 WHERE id = $2`;
        values = [data.nama_departemen, id];
        break;
      case 'komisi':
        query = `UPDATE komisi SET nama_komisi = $1, satelit_id = $2 WHERE id = $3`;
        values = [data.nama_komisi, data.satelit_id, id];
        break;
      case 'periode_kepengurusan':
        query = `UPDATE periode_kepengurusan SET nama_periode = $1, tahun_mulai = $2, tahun_akhir = $3 WHERE id = $4`;
        values = [data.nama_periode, data.tahun_mulai, data.tahun_akhir, id];
        break;
      case 'jabatan':
        query = `UPDATE jabatan SET nama_jabatan = $1 WHERE id = $2`;
        values = [data.nama_jabatan, id];
        break;
      case 'role_pelayan':
        query = `UPDATE role_pelayan SET nama_role = $1, deskripsi = $2 WHERE id = $3`;
        values = [data.nama_role, data.deskripsi || null, id];
        break;
      case 'pekerjaan_master':
        query = `UPDATE pekerjaan_master SET nama_pekerjaan = $1 WHERE id = $2`;
        values = [data.nama_pekerjaan, id];
        break;
      case 'jenis_kegiatan':
        query = `UPDATE jenis_kegiatan SET nama_jenis_kegiatan = $1 WHERE id = $2`;
        values = [data.nama_jenis_kegiatan, id];
        break;
      default:
        return NextResponse.json({ success: false, message: 'Tabel tidak valid' }, { status: 400 });
    }

    const res = await pool.query(query, values);
    if (res.rowCount === 0) {
      return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[MasterDataRoute] PATCH error:', error);
    if (error.code === '23505') {
      return NextResponse.json({ success: false, message: 'Data sudah ada (duplikat)' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
