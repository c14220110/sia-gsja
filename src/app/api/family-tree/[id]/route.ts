import { NextResponse } from 'next/server';
import pool from '@/lib/db';

async function getJemaatById(id: number) {
  const res = await pool.query(
    `SELECT j.id, j.jemaat_id, j.nama_lengkap, j.jenis_kelamin, j.tanggal_lahir,
            j.foto_url, j.status_jemaat, j.ayah_id, j.ibu_id, j.pasangan_id,
            j.ayah_nama, j.ibu_nama, j.pasangan_nama, s.nama_satelit
     FROM jemaat j
     LEFT JOIN satelit s ON j.satelit_id = s.id
     WHERE j.id = $1 AND j.is_deleted = false`,
    [id]
  );
  return res.rows[0] || null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const personId = parseInt(id, 10);
    if (isNaN(personId)) {
      return NextResponse.json({ success: false, message: 'ID tidak valid' }, { status: 400 });
    }

    // 1. Person utama
    const person = await getJemaatById(personId);
    if (!person) {
      return NextResponse.json({ success: false, message: 'Jemaat tidak ditemukan' }, { status: 404 });
    }

    // 2. Ayah & Ibu (registered)
    const ayah = person.ayah_id ? await getJemaatById(person.ayah_id) : null;
    const ibu  = person.ibu_id  ? await getJemaatById(person.ibu_id)  : null;

    // 3. Pasangan
    const pasangan = person.pasangan_id ? await getJemaatById(person.pasangan_id) : null;

    // 4. Saudara kandung — from relasi_jemaat (accurate, user-defined)
    const saudaraRes = await pool.query(
      `SELECT j.id, j.jemaat_id, j.nama_lengkap, j.jenis_kelamin, j.tanggal_lahir,
              j.foto_url, j.status_jemaat
       FROM relasi_jemaat rj
       JOIN jenis_relasi  jr ON rj.jenis_relasi_id = jr.id AND jr.nama_relasi = 'Saudara Kandung'
       JOIN jemaat        j  ON rj.jemaat_terkait_id = j.id AND j.is_deleted = false
       WHERE rj.jemaat_id = $1`,
      [personId]
    );
    const saudara = saudaraRes.rows;

    // 5. Anak (dari jemaat_anak, bisa sudah jadi jemaat)
    const anakRes = await pool.query(
      `SELECT ja.id as relasi_id, ja.nama_anak, ja.anak_jemaat_id,
              j.id, j.jemaat_id as jemaat_nomor, j.nama_lengkap, j.jenis_kelamin,
              j.tanggal_lahir, j.foto_url, j.status_jemaat
       FROM jemaat_anak ja
       LEFT JOIN jemaat j ON ja.anak_jemaat_id = j.id AND j.is_deleted = false
       WHERE ja.orang_tua_id = $1`,
      [personId]
    );
    const anak = anakRes.rows;

    // 6. Orang tua dari ayah (kakek/nenek pihak ayah)
    const kakekAyah = ayah?.ayah_id ? await getJemaatById(ayah.ayah_id) : null;
    const nenekAyah = ayah?.ibu_id  ? await getJemaatById(ayah.ibu_id)  : null;

    // 7. Orang tua dari ibu (kakek/nenek pihak ibu)
    const kakekIbu = ibu?.ayah_id ? await getJemaatById(ibu.ayah_id) : null;
    const nenekIbu = ibu?.ibu_id  ? await getJemaatById(ibu.ibu_id)  : null;

    return NextResponse.json({
      success: true,
      data: {
        person,
        ayah,
        ibu,
        pasangan,
        saudara,
        anak,
        kakek_nenek: {
          ayah: { kakek: kakekAyah, nenek: nenekAyah },
          ibu:  { kakek: kakekIbu,  nenek: nenekIbu  },
        },
      },
    });
  } catch (error) {
    console.error('Error in GET /api/family-tree/[id]:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
