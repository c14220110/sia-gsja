import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/** Normalize messy values from Google Form to null */
function clean(val: string | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  const junk = ['-', '.', ';', ':', '0', '00', '000', '0000', 'tidak ada', 'tidak punya', 'n/a', 'na', ''];
  if (junk.includes(trimmed.toLowerCase())) return null;
  return trimmed || null;
}

/** Parse M/D/YYYY → YYYY-MM-DD */
function parseDate(raw: string | undefined): string | null {
  if (!clean(raw)) return null;
  try {
    const parts = (raw ?? '').trim().split('/');
    if (parts.length !== 3) return null;
    const [m, d, y] = parts.map(Number);
    if (isNaN(m) || isNaN(d) || isNaN(y)) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

/** Map form status baptis → 'Sudah' | 'Belum' */
function mapBaptis(raw: string | undefined): 'Sudah' | 'Belum' {
  return (raw ?? '').toLowerCase().includes('sudah') ? 'Sudah' : 'Belum';
}

/** Map form status hubungan → DB enum */
function mapPernikahan(raw: string | undefined): string {
  const v = (raw ?? '').toLowerCase();
  if (v.includes('menikah')) return 'Menikah';
  if (v.includes('duda'))    return 'Duda';
  if (v.includes('janda'))   return 'Janda';
  return 'Lajang';
}

interface AnakData { nama: string | null; gereja: string | null; }

function extractAnak(row: Record<string, string>): AnakData[] {
  // The form repeats anak columns many times; collect unique (nama, gereja) pairs
  const anak: AnakData[] = [];
  const seen = new Set<string>();

  // All header keys that contain "Nama Anak" 
  const namaKeys   = Object.keys(row).filter(k => /nama anak/i.test(k));
  const gerejaKeys = Object.keys(row).filter(k => /gereja asal anak/i.test(k));

  for (let i = 0; i < namaKeys.length; i++) {
    const nama   = clean(row[namaKeys[i]]);
    const gereja = clean(row[gerejaKeys[i]] ?? '');
    if (nama && !seen.has(nama)) {
      seen.add(nama);
      anak.push({ nama, gereja });
    }
  }
  return anak;
}

export async function POST(request: Request) {
  try {
    const { rows, satelit_default } = await request.json() as {
      rows: Record<string, string>[];
      satelit_default?: string;
    };

    if (!rows?.length) {
      return NextResponse.json({ success: false, message: 'Tidak ada data untuk diimport' }, { status: 400 });
    }

    // Fetch jenis_relasi id for 'Anak'
    const jrRes = await pool.query(`SELECT id FROM jenis_relasi WHERE nama_relasi = 'Anak' LIMIT 1`);
    const jenisAnakId: number | null = jrRes.rows[0]?.id ?? null;

    const results: { nama: string; status: 'ok' | 'skip' | 'error'; reason?: string }[] = [];

    for (const row of rows) {
      const nama = clean(row['Nama Jemaat']);
      if (!nama) { results.push({ nama: '(kosong)', status: 'skip', reason: 'Nama kosong' }); continue; }

      try {
        // Resolve satelit_id
        const satelitNama = clean(row['Nama Satelit']) || satelit_default || 'Getsemani';
        const satRes = await pool.query(`SELECT id FROM satelit WHERE nama_satelit ILIKE $1 LIMIT 1`, [satelitNama]);
        const satelit_id: number | null = satRes.rows[0]?.id ?? null;
        if (!satelit_id) { results.push({ nama, status: 'skip', reason: `Satelit '${satelitNama}' tidak ditemukan` }); continue; }

        // Check duplicate by nama + tanggal_lahir
        const tglLahir = parseDate(row['Tanggal Lahir']);
        const dupCheck = await pool.query(
          `SELECT id FROM jemaat WHERE LOWER(nama_lengkap) = LOWER($1) AND is_deleted = false LIMIT 1`, [nama]
        );
        if (dupCheck.rows.length > 0) { results.push({ nama, status: 'skip', reason: 'Sudah terdaftar (nama sama)' }); continue; }

        // Insert jemaat
        const insRes = await pool.query(
          `INSERT INTO jemaat
             (nama_lengkap, nik, jenis_kelamin, tempat_lahir, tanggal_lahir, pekerjaan,
              alamat, kecamatan, kelurahan, kota, kode_pos, no_hp, email,
              status_baptis, tanggal_baptis, status_pernikahan, status_jemaat,
              ayah_nama, gereja_asal_ayah, ibu_nama, gereja_asal_ibu,
              pasangan_nama, gereja_asal_pasangan, satelit_id, foto_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
           RETURNING id`,
          [
            nama,
            clean(row['No NIK KTP']),
            clean(row['Jenis Kelamin']),
            clean(row['Kota lahir']),
            tglLahir,
            clean(row['Pekerjaan\n(Silahkan isi "Other:", apabila pekerjaan tidak ada di pilihan)']) || clean(row['Pekerjaan']),
            clean(row['Alamat Domisili\nNotes: (Jalan ................ gang ...... no..... diisi dengan alamat tempat tinggal saat ini)']) || clean(row['Alamat Domisili']),
            clean(row['Kecamatan']),
            clean(row['Kelurahan']),
            clean(row['Kota Domisili \n(Diisi dengan kota tempat tinggal saat ini)']) || clean(row['Kota Domisili']),
            clean(row['Kode Pos']),
            clean(row['No telepon / WA']),
            clean(row['Alamat Email']),
            mapBaptis(row['Status Baptis']),
            parseDate(row['Tanggal Baptis']),
            mapPernikahan(row['Status Hubungan']),
            clean(row['Keaktifan Jemaat']) || 'Aktif',
            clean(row['Nama Ayah']),
            clean(row['Gereja asal Ayah']),
            clean(row['Nama Ibu']),
            clean(row['Gereja asal Ibu']),
            clean(row['Nama Pasangan ']),
            clean(row['Gereja asal Pasangan']),
            satelit_id,
            clean(row['Foto Jemaat']),
          ]
        );
        const newId: number = insRes.rows[0].id;

        // Insert anak ke relasi_jemaat
        if (jenisAnakId) {
          const anakList = extractAnak(row);
          for (const ank of anakList) {
            if (ank.nama) {
              await pool.query(
                `INSERT INTO relasi_jemaat (jemaat_id, jenis_relasi_id, nama_terkait, gereja_asal)
                 VALUES ($1, $2, $3, $4)`,
                [newId, jenisAnakId, ank.nama, ank.gereja]
              );
            }
          }
        }

        // Resolve komisi
        const komisiNama = clean(row['Komisi']);
        if (komisiNama) {
          const komRes = await pool.query(
            `SELECT id FROM komisi WHERE LOWER(nama_komisi) = LOWER($1) AND is_active = true LIMIT 1`, [komisiNama]
          );
          if (komRes.rows.length > 0) {
            await pool.query(
              `INSERT INTO jemaat_komisi (jemaat_id, komisi_id, tanggal_bergabung) VALUES ($1, $2, CURRENT_DATE)`,
              [newId, komRes.rows[0].id]
            );
          }
        }

        results.push({ nama, status: 'ok' });
      } catch (err: any) {
        results.push({ nama, status: 'error', reason: err.message });
      }
    }

    const ok    = results.filter(r => r.status === 'ok').length;
    const skip  = results.filter(r => r.status === 'skip').length;
    const error = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      message: `Import selesai: ${ok} berhasil, ${skip} dilewati, ${error} error`,
      results,
    });
  } catch (err: any) {
    console.error('[ImportAPI]', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
