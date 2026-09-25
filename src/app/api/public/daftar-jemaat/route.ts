import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      nama_lengkap,
      jenis_kelamin,
      tempat_lahir,
      tanggal_lahir,
      alamat,
      kota,
      kecamatan,
      kelurahan,
      kode_pos,
      no_hp,
      email,
      pekerjaan,
      pekerjaan_id,
      satelit_id,
      foto_url,
      status_baptis,
      status_pernikahan,
      status_jemaat,
      ayah_id,
      ayah_nama,
      gereja_asal_ayah,
      ibu_id,
      ibu_nama,
      gereja_asal_ibu,
      pasangan_id,
      pasangan_nama,
      gereja_asal_pasangan,
      anak,
      saudara,
      tidak_punya_kontak,
      username,
    } = body;

    // Basic validation
    if (!nama_lengkap?.trim()) {
      return NextResponse.json({ success: false, message: 'Nama lengkap wajib diisi.' }, { status: 400 });
    }
    if (!satelit_id) {
      return NextResponse.json({ success: false, message: 'Satelit wajib dipilih.' }, { status: 400 });
    }
    if (!kota?.trim()) {
      return NextResponse.json({ success: false, message: 'Kota wajib diisi.' }, { status: 400 });
    }
    if (!tidak_punya_kontak && !no_hp && !email) {
      return NextResponse.json({ success: false, message: 'Harap isi minimal No. Telepon atau Alamat Email.' }, { status: 400 });
    }
    if (tidak_punya_kontak && !username?.trim()) {
      return NextResponse.json({ success: false, message: 'Username wajib diisi jika tidak memiliki Email/No. Telepon.' }, { status: 400 });
    }

    // Get IP address for audit
    const ip_address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                       request.headers.get('x-real-ip') || null;
    const user_agent = request.headers.get('user-agent') || null;

    // Convert status_baptis string to boolean
    const statusBaptisBoolean = status_baptis === 'Sudah' || status_baptis === true;

    const res = await pool.query(
      `INSERT INTO pendaftaran_jemaat (
        nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir,
        alamat, kota, kecamatan, kelurahan, kode_pos,
        no_hp, email, pekerjaan, pekerjaan_id, satelit_id, foto_url,
        status_baptis, status_pernikahan, status_jemaat,
        ayah_id, ayah_nama, gereja_asal_ayah,
        ibu_id, ibu_nama, gereja_asal_ibu,
        pasangan_id, pasangan_nama, gereja_asal_pasangan,
        anak, saudara, tidak_punya_kontak, username,
        ip_address, user_agent
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18,
        $19, $20, $21,
        $22, $23, $24,
        $25, $26, $27,
        $28, $29, $30, $31,
        $32, $33
      ) RETURNING id`,
      [
        nama_lengkap?.trim(),
        jenis_kelamin || null,
        tempat_lahir || null,
        tanggal_lahir || null,
        alamat || null,
        kota?.trim(),
        kecamatan || null,
        kelurahan || null,
        kode_pos || null,
        no_hp || null,
        email || null,
        pekerjaan || null,
        pekerjaan_id || null,
        parseInt(satelit_id, 10),
        foto_url || null,
        statusBaptisBoolean,
        status_pernikahan || null,
        status_jemaat || 'Aktif',
        ayah_id ? parseInt(ayah_id, 10) : null,
        ayah_nama || null,
        gereja_asal_ayah || null,
        ibu_id ? parseInt(ibu_id, 10) : null,
        ibu_nama || null,
        gereja_asal_ibu || null,
        pasangan_id ? parseInt(pasangan_id, 10) : null,
        pasangan_nama || null,
        gereja_asal_pasangan || null,
        JSON.stringify(anak || []),
        JSON.stringify(saudara || []),
        tidak_punya_kontak || false,
        username?.trim() || null,
        ip_address,
        user_agent,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Pendaftaran berhasil dikirim! Data Anda sedang ditinjau oleh sekretaris gereja.',
      id: res.rows[0].id,
    });
  } catch (error: any) {
    console.error('[public/daftar-jemaat POST]', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Terjadi kesalahan. Silakan coba lagi.',
    }, { status: 500 });
  }
}
