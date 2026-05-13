import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// GET — Ambil semua data untuk tabel master tertentu
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const search = searchParams.get('search') || '';

    const ALLOWED_TABLES: Record<string, { query: string; orderBy: string }> = {
      wilayah: {
        query: `SELECT id, kode_wilayah, nama_wilayah, created_at FROM wilayah`,
        orderBy: 'kode_wilayah',
      },
      satelit: {
        query: `
          SELECT s.id, s.kode_satelit, s.nama_satelit, s.alamat, s.kota, s.kontak_satelit, s.is_active,
                 w.nama_wilayah
          FROM satelit s
          LEFT JOIN wilayah w ON s.wilayah_id = w.id
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
      jenis_relasi: {
        query: `SELECT id, nama_relasi, is_active FROM jenis_relasi`,
        orderBy: 'nama_relasi',
      },
      jenis_kegiatan: {
        query: `SELECT id, nama_jenis_kegiatan, kategori FROM jenis_kegiatan`,
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
      wilayah: 'nama_wilayah',
      satelit: 's.nama_satelit',
      departemen: 'nama_departemen',
      komisi: 'k.nama_komisi',
      periode_kepengurusan: 'nama_periode',
      jabatan: 'nama_jabatan',
      role_pelayan: 'nama_role',
      pekerjaan_master: 'nama_pekerjaan',
      jenis_relasi: 'nama_relasi',
      jenis_kegiatan: 'nama_jenis_kegiatan',
      jabatan_pegawai_master: 'nama_jabatan',
      buku_besar_coa: 'nama_akun',
    };

    let fullQuery = query;
    const values: any[] = [];
    if (search && searchCols[table]) {
      fullQuery += ` WHERE ${searchCols[table]} ILIKE $1`;
      values.push(`%${search}%`);
    }
    fullQuery += ` ORDER BY ${orderBy}`;

    const res = await pool.query(fullQuery, values);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error) {
    console.error('[MasterDataRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

// POST — Tambah data baru ke tabel master
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
        query = `INSERT INTO wilayah (kode_wilayah, nama_wilayah) VALUES ($1, $2) RETURNING id`;
        values = [data.kode_wilayah, data.nama_wilayah];
        break;
      case 'satelit':
        query = `INSERT INTO satelit (kode_satelit, nama_satelit, alamat, kota, kontak_satelit, wilayah_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`;
        values = [data.kode_satelit, data.nama_satelit, data.alamat || null, data.kota || null, data.kontak_satelit || null, data.wilayah_id || null];
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
      case 'jenis_relasi':
        query = `INSERT INTO jenis_relasi (nama_relasi) VALUES ($1) RETURNING id`;
        values = [data.nama_relasi];
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

// DELETE — Hapus data dari tabel master berdasarkan ID
export async function DELETE(request: NextRequest) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller || !caller.is_super_admin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const id = searchParams.get('id');

    const DELETABLE = ['jenis_kegiatan', 'wilayah'];
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

// PATCH — Toggle is_active atau update data
export async function PATCH(request: NextRequest) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller || !caller.is_super_admin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { table, id, is_active } = body;

    const TOGGLEABLE = ['satelit', 'departemen', 'komisi', 'periode_kepengurusan', 'pekerjaan_master', 'role_pelayan', 'jabatan', 'jenis_relasi'];
    if (!table || !id || !TOGGLEABLE.includes(table) || typeof is_active !== 'boolean') {
      return NextResponse.json({ success: false, message: 'Parameter tidak valid' }, { status: 400 });
    }

    await pool.query(`UPDATE ${table} SET is_active = $1 WHERE id = $2`, [is_active, id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[MasterDataRoute] PATCH error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
