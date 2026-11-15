import pool from '@/lib/db';
import type { SatelitGeofence } from '@/lib/geofence';

export interface PegawaiPresensiProfile {
  id: number;
  id_pegawai: string;
  jemaat_id: number | null;
  nama_lengkap: string;
  satelit_id: number | null;
  nama_satelit: string | null;
  nama_jabatan: string | null;
  nama_departemen: string | null;
  face_descriptor: number[] | null;
  face_photo_url: string | null;
  face_enrolled_at: string | null;
}

export interface PresensiRecord {
  id: number;
  pegawai_id: number;
  tanggal: string;
  check_in_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_accuracy: number | null;
  check_in_distance_m: number | null;
  check_in_satelit_id: number | null;
  check_in_satelit_nama?: string | null;
  check_in_photo_url: string | null;
  check_in_face_score: number | null;
  check_in_status: string | null;
  check_out_at: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_accuracy: number | null;
  check_out_photo_url: string | null;
  check_out_face_score: number | null;
  worked_minutes: number;
  overview_note: string | null;
  overview_attachment_url: string | null;
  overview_attachment_name: string | null;
  overview_updated_at: string | null;
}

export interface KunjunganRecord {
  id: number;
  presensi_id: number | null;
  pegawai_id: number;
  tanggal: string;
  waktu_kunjungan: string;
  kategori: string;
  satelit_tujuan_id: number | null;
  satelit_tujuan_nama?: string | null;
  lokasi_bebas: string | null;
  lat: number;
  lng: number;
  gps_accuracy: number | null;
  selfie_url: string;
  notes: string;
}

export interface MonitoringFilterParams {
  tanggal: string; // YYYY-MM-DD
  roleId?: number;
  satelitId?: number;
  status?: string; // ALL | HADIR | BELUM_ABSEN | TERLAMBAT
  search?: string;
}

export class PresensiRepository {
  async findPegawaiByUser(userId: number, jemaatId?: number | null): Promise<PegawaiPresensiProfile | null> {
    const query = `
      SELECT
        p.id,
        p.id_pegawai,
        p.jemaat_id,
        p.nama_lengkap,
        p.satelit_id,
        s.nama_satelit,
        jp.nama_jabatan,
        d.nama_departemen,
        p.face_descriptor,
        p.face_photo_url,
        p.face_enrolled_at
      FROM public.pegawai p
      LEFT JOIN public.satelit s ON s.id = p.satelit_id
      LEFT JOIN public.jabatan_pegawai_master jp ON jp.id = p.jabatan_pegawai_id
      LEFT JOIN public.departemen d ON d.id = p.departemen_id
      LEFT JOIN public.pengguna u ON u.id = $1
      WHERE UPPER(p.status_pegawai) = 'AKTIF'
        AND (
          ($2::int IS NOT NULL AND p.jemaat_id = $2::int)
          OR (u.jemaat_id IS NOT NULL AND p.jemaat_id = u.jemaat_id)
          OR (u.email IS NOT NULL AND LOWER(p.email_pribadi) = LOWER(u.email))
          OR (u.no_hp IS NOT NULL AND p.no_hp = u.no_hp)
        )
      ORDER BY p.id ASC
      LIMIT 1
    `;
    const res = await pool.query(query, [userId, jemaatId ?? null]);
    return res.rows[0] || null;
  }

  async findPegawaiById(pegawaiId: number): Promise<PegawaiPresensiProfile | null> {
    const query = `
      SELECT
        p.id,
        p.id_pegawai,
        p.jemaat_id,
        p.nama_lengkap,
        p.satelit_id,
        s.nama_satelit,
        jp.nama_jabatan,
        d.nama_departemen,
        p.face_descriptor,
        p.face_photo_url,
        p.face_enrolled_at
      FROM public.pegawai p
      LEFT JOIN public.satelit s ON s.id = p.satelit_id
      LEFT JOIN public.jabatan_pegawai_master jp ON jp.id = p.jabatan_pegawai_id
      LEFT JOIN public.departemen d ON d.id = p.departemen_id
      WHERE p.id = $1
      LIMIT 1
    `;
    const res = await pool.query(query, [pegawaiId]);
    return res.rows[0] || null;
  }

  async listActiveSatelit(): Promise<SatelitGeofence[]> {
    const res = await pool.query(`
      SELECT id, kode_satelit, nama_satelit, gps_location, latitude, longitude, COALESCE(radius_meter, 100) AS radius_meter
      FROM public.satelit
      WHERE is_active = true
      ORDER BY id ASC
    `);
    return res.rows;
  }

  async updateSatelitGeofence(
    satelitId: number,
    latitude: number,
    longitude: number,
    radiusMeter: number,
    gpsLocation?: string
  ): Promise<SatelitGeofence | null> {
    const formattedLoc = gpsLocation?.trim() || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    const res = await pool.query(
      `UPDATE public.satelit
       SET latitude = $1, longitude = $2, radius_meter = $3, gps_location = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, kode_satelit, nama_satelit, gps_location, latitude, longitude, radius_meter`,
      [latitude, longitude, radiusMeter, formattedLoc, satelitId]
    );
    return res.rows[0] || null;
  }

  async saveFaceEnrollment(pegawaiId: number, descriptor: number[], photoUrl: string): Promise<void> {
    await pool.query(
      `UPDATE public.pegawai
       SET face_descriptor = $1::jsonb, face_photo_url = $2, face_enrolled_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(descriptor), photoUrl, pegawaiId]
    );
  }

  async resetFaceEnrollment(pegawaiId: number): Promise<void> {
    await pool.query(
      `UPDATE public.pegawai
       SET face_descriptor = NULL, face_photo_url = NULL, face_enrolled_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [pegawaiId]
    );
  }

  async getPresensiByDate(pegawaiId: number, tanggal: string): Promise<PresensiRecord | null> {
    const res = await pool.query(
      `SELECT pr.*, s.nama_satelit AS check_in_satelit_nama
       FROM public.pegawai_presensi pr
       LEFT JOIN public.satelit s ON s.id = pr.check_in_satelit_id
       WHERE pr.pegawai_id = $1 AND pr.tanggal = $2::date
       LIMIT 1`,
      [pegawaiId, tanggal]
    );
    return res.rows[0] || null;
  }

  async getKunjunganByDate(pegawaiId: number, tanggal: string): Promise<KunjunganRecord[]> {
    const res = await pool.query(
      `SELECT k.*, s.nama_satelit AS satelit_tujuan_nama
       FROM public.pegawai_kunjungan k
       LEFT JOIN public.satelit s ON s.id = k.satelit_tujuan_id
       WHERE k.pegawai_id = $1 AND k.tanggal = $2::date
       ORDER BY k.waktu_kunjungan DESC`,
      [pegawaiId, tanggal]
    );
    return res.rows;
  }

  async recordCheckIn(params: {
    pegawaiId: number;
    tanggal: string;
    lat: number;
    lng: number;
    accuracy: number;
    distanceMeters: number;
    satelitId: number;
    photoUrl: string;
    faceScore: number;
    status: 'TEPAT_WAKTU' | 'TERLAMBAT';
  }): Promise<PresensiRecord> {
    const res = await pool.query(
      `INSERT INTO public.pegawai_presensi (
         pegawai_id, tanggal, check_in_at, check_in_lat, check_in_lng,
         check_in_accuracy, check_in_distance_m, check_in_satelit_id,
         check_in_photo_url, check_in_face_score, check_in_status
       ) VALUES ($1, $2::date, NOW(), $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        params.pegawaiId,
        params.tanggal,
        params.lat,
        params.lng,
        params.accuracy,
        params.distanceMeters,
        params.satelitId,
        params.photoUrl,
        params.faceScore,
        params.status,
      ]
    );
    return res.rows[0];
  }

  async recordCheckOut(params: {
    presensiId: number;
    lat: number;
    lng: number;
    accuracy: number;
    photoUrl: string;
    faceScore: number;
    workedMinutes: number;
  }): Promise<PresensiRecord> {
    const res = await pool.query(
      `UPDATE public.pegawai_presensi
       SET check_out_at = NOW(),
           check_out_lat = $1,
           check_out_lng = $2,
           check_out_accuracy = $3,
           check_out_photo_url = $4,
           check_out_face_score = $5,
           worked_minutes = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        params.lat,
        params.lng,
        params.accuracy,
        params.photoUrl,
        params.faceScore,
        params.workedMinutes,
        params.presensiId,
      ]
    );
    return res.rows[0];
  }

  async updateOverview(params: {
    presensiId: number;
    overviewNote: string | null;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
  }): Promise<PresensiRecord> {
    const res = await pool.query(
      `UPDATE public.pegawai_presensi
       SET overview_note = $1,
           overview_attachment_url = COALESCE($2, overview_attachment_url),
           overview_attachment_name = COALESCE($3, overview_attachment_name),
           overview_updated_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [params.overviewNote, params.attachmentUrl ?? null, params.attachmentName ?? null, params.presensiId]
    );
    return res.rows[0];
  }

  async addKunjungan(params: {
    presensiId: number | null;
    pegawaiId: number;
    tanggal: string;
    kategori: string;
    satelitTujuanId: number | null;
    lokasiBebas: string | null;
    lat: number;
    lng: number;
    gpsAccuracy: number;
    selfieUrl: string;
    notes: string;
  }): Promise<KunjunganRecord> {
    const res = await pool.query(
      `INSERT INTO public.pegawai_kunjungan (
         presensi_id, pegawai_id, tanggal, kategori, satelit_tujuan_id,
         lokasi_bebas, lat, lng, gps_accuracy, selfie_url, notes
       ) VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        params.presensiId,
        params.pegawaiId,
        params.tanggal,
        params.kategori,
        params.satelitTujuanId,
        params.lokasiBebas,
        params.lat,
        params.lng,
        params.gpsAccuracy,
        params.selfieUrl,
        params.notes,
      ]
    );
    return res.rows[0];
  }

  async getMonthlyCalendar(pegawaiId: number, monthPrefix: string): Promise<{
    presensi: PresensiRecord[];
    kunjungan: KunjunganRecord[];
  }> {
    const startDate = `${monthPrefix}-01`;
    const presensiRes = await pool.query(
      `SELECT pr.*, s.nama_satelit AS check_in_satelit_nama
       FROM public.pegawai_presensi pr
       LEFT JOIN public.satelit s ON s.id = pr.check_in_satelit_id
       WHERE pr.pegawai_id = $1
         AND pr.tanggal >= $2::date
         AND pr.tanggal < ($2::date + INTERVAL '1 month')
       ORDER BY pr.tanggal ASC`,
      [pegawaiId, startDate]
    );

    const kunjunganRes = await pool.query(
      `SELECT k.*, s.nama_satelit AS satelit_tujuan_nama
       FROM public.pegawai_kunjungan k
       LEFT JOIN public.satelit s ON s.id = k.satelit_tujuan_id
       WHERE k.pegawai_id = $1
         AND k.tanggal >= $2::date
         AND k.tanggal < ($2::date + INTERVAL '1 month')
       ORDER BY k.waktu_kunjungan ASC`,
      [pegawaiId, startDate]
    );

    return {
      presensi: presensiRes.rows,
      kunjungan: kunjunganRes.rows,
    };
  }

  async getMonitoringByDate(filters: MonitoringFilterParams): Promise<{
    rows: any[];
    roles: { id: number; nama_role: string }[];
    satelits: SatelitGeofence[];
  }> {
    const conditions: string[] = [`UPPER(p.status_pegawai) = 'AKTIF'`];
    const values: any[] = [filters.tanggal];
    let idx = 2;

    if (filters.satelitId) {
      conditions.push(`p.satelit_id = $${idx++}`);
      values.push(filters.satelitId);
    }

    if (filters.roleId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM public.pengguna u2
        JOIN public.user_role ur2 ON ur2.user_id = u2.id
        WHERE ur2.role_id = $${idx++}
          AND (
            (u2.jemaat_id IS NOT NULL AND p.jemaat_id = u2.jemaat_id)
            OR (u2.email IS NOT NULL AND LOWER(p.email_pribadi) = LOWER(u2.email))
            OR (u2.no_hp IS NOT NULL AND p.no_hp = u2.no_hp)
          )
      )`);
      values.push(filters.roleId);
    }

    if (filters.search) {
      conditions.push(`(p.nama_lengkap ILIKE $${idx} OR p.id_pegawai ILIKE $${idx})`);
      values.push(`%${filters.search}%`);
      idx++;
    }

    if (filters.status === 'HADIR') {
      conditions.push(`pr.check_in_at IS NOT NULL`);
    } else if (filters.status === 'BELUM_ABSEN') {
      conditions.push(`pr.check_in_at IS NULL`);
    } else if (filters.status === 'TERLAMBAT') {
      conditions.push(`pr.check_in_status = 'TERLAMBAT'`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const query = `
      SELECT
        p.id AS pegawai_id,
        p.id_pegawai,
        p.nama_lengkap,
        p.satelit_id,
        s.nama_satelit,
        jp.nama_jabatan,
        d.nama_departemen,
        (p.face_descriptor IS NOT NULL) AS is_face_enrolled,
        p.face_enrolled_at,
        pr.id AS presensi_id,
        pr.tanggal,
        pr.check_in_at,
        pr.check_in_lat,
        pr.check_in_lng,
        pr.check_in_distance_m,
        pr.check_in_satelit_id,
        cs.nama_satelit AS check_in_satelit_nama,
        pr.check_in_photo_url,
        pr.check_in_face_score,
        pr.check_in_status,
        pr.check_out_at,
        pr.check_out_lat,
        pr.check_out_lng,
        pr.check_out_photo_url,
        pr.check_out_face_score,
        COALESCE(pr.worked_minutes, 0) AS worked_minutes,
        pr.overview_note,
        pr.overview_attachment_url,
        pr.overview_attachment_name,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', k.id,
                'waktu_kunjungan', k.waktu_kunjungan,
                'kategori', k.kategori,
                'satelit_tujuan_id', k.satelit_tujuan_id,
                'satelit_tujuan_nama', ks.nama_satelit,
                'lokasi_bebas', k.lokasi_bebas,
                'lat', k.lat,
                'lng', k.lng,
                'gps_accuracy', k.gps_accuracy,
                'selfie_url', k.selfie_url,
                'notes', k.notes
              ) ORDER BY k.waktu_kunjungan ASC
            )
            FROM public.pegawai_kunjungan k
            LEFT JOIN public.satelit ks ON ks.id = k.satelit_tujuan_id
            WHERE k.pegawai_id = p.id AND k.tanggal = $1::date
          ),
          '[]'::json
        ) AS visits,
        COALESCE(
          (
            SELECT ARRAY_AGG(DISTINCT r.nama_role)
            FROM public.pengguna u3
            JOIN public.user_role ur3 ON ur3.user_id = u3.id
            JOIN public.role r ON r.id = ur3.role_id
            WHERE (u3.jemaat_id IS NOT NULL AND p.jemaat_id = u3.jemaat_id)
               OR (u3.email IS NOT NULL AND LOWER(p.email_pribadi) = LOWER(u3.email))
               OR (u3.no_hp IS NOT NULL AND p.no_hp = u3.no_hp)
          ),
          '{}'::text[]
        ) AS role_names
      FROM public.pegawai p
      LEFT JOIN public.satelit s ON s.id = p.satelit_id
      LEFT JOIN public.jabatan_pegawai_master jp ON jp.id = p.jabatan_pegawai_id
      LEFT JOIN public.departemen d ON d.id = p.departemen_id
      LEFT JOIN public.pegawai_presensi pr ON pr.pegawai_id = p.id AND pr.tanggal = $1::date
      LEFT JOIN public.satelit cs ON cs.id = pr.check_in_satelit_id
      ${where}
      ORDER BY (pr.check_in_at IS NULL) ASC, pr.check_in_at DESC NULLS LAST, p.nama_lengkap ASC
    `;

    const [rowsRes, rolesRes, satelits] = await Promise.all([
      pool.query(query, values),
      pool.query(`SELECT id, nama_role FROM public.role WHERE is_active = true ORDER BY id ASC`),
      this.listActiveSatelit(),
    ]);

    return {
      rows: rowsRes.rows,
      roles: rolesRes.rows,
      satelits,
    };
  }

  async listActivePegawaiSimple(): Promise<PegawaiPresensiProfile[]> {
    const res = await pool.query(`
      SELECT
        p.id, p.id_pegawai, p.jemaat_id, p.nama_lengkap, p.satelit_id,
        s.nama_satelit, jp.nama_jabatan, d.nama_departemen,
        p.face_descriptor, p.face_photo_url, p.face_enrolled_at
      FROM public.pegawai p
      LEFT JOIN public.satelit s ON s.id = p.satelit_id
      LEFT JOIN public.jabatan_pegawai_master jp ON jp.id = p.jabatan_pegawai_id
      LEFT JOIN public.departemen d ON d.id = p.departemen_id
      WHERE UPPER(p.status_pegawai) = 'AKTIF'
      ORDER BY p.nama_lengkap ASC
    `);
    return res.rows;
  }
}
