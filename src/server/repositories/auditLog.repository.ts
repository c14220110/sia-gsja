import pool from '@/lib/db';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DEACTIVATE';
export type AnggaranAuditAksi = 'Dibuat' | 'Diajukan' | 'Disetujui Penuh' | 'Disetujui Sebagian' | 'Ditolak' | 'Revisi' | 'Direvisi & Diajukan Ulang' | 'Dihapus' | 'Dibatalkan' | 'Disetujui Ketua';
export type LpjAuditAksi = 'Dibuat' | 'Diajukan' | 'Direvisi & Diajukan Ulang' | 'Disetujui' | 'Revisi';

// ──────────────────────────────────────────────────────────────────────────────
// Interfaces
// ──────────────────────────────────────────────────────────────────────────────
export interface InsertJemaatAuditLogParams {
  jemaat_id:   number;
  aksi:        AuditAction;
  user_id:     number;
  role_id:     number;
  satelit_id:  number;
  keterangan?: string;
}

export interface InsertPelayanAuditLogParams {
  pelayan_id:  number;
  aksi:        AuditAction;
  user_id:     number;
  role_id:     number;
  satelit_id:  number;
  keterangan?: string;
}

export interface InsertPengurusAuditLogParams {
  pengurus_id: number;
  aksi:        AuditAction;
  user_id:     number;
  role_id:     number;
  satelit_id:  number;
  keterangan?: string;
}

export interface InsertInventarisAuditLogParams {
  barang_id:   number;
  aksi:        AuditAction;
  user_id:     number;
  role_id:     number;
  satelit_id:  number;
  keterangan?: string;
}

export interface InsertKegiatanAuditLogParams {
  kegiatan_id: number;
  aksi:        AuditAction;
  user_id:     number;
  role_id:     number;
  satelit_id:  number;
  keterangan?: string;
}

export interface PastoralAuditLogEntry {
  id:                 number;
  permohonan_id:      number;
  nomor_tiket:        string;
  nama_pemohon:       string;
  jenis_layanan:      string;
  status_sebelumnya:  string | null;
  status_baru:        string;
  diubah_oleh_id:     number;
  nama_pelaksana:     string;
  nama_role:          string;
  nama_satelit:       string;
  catatan_perubahan:  string | null;
  created_at:         string;
}

export interface InsertAnggaranAuditLogParams {
  anggaran_id:    string; // uuid
  kode_dokumen:   string;
  aksi:           AnggaranAuditAksi;
  status_sebelum: string | null;
  status_sesudah: string;
  user_id:        number;
  nama_pelaksana: string;
  role_id:        number;
  nama_role:      string;
  satelit_id:     number;
  nama_satelit:   string;
  keterangan?:    string;
}

export interface InsertLpjAuditLogParams {
  kegiatan_id:    number;
  aksi:           LpjAuditAksi;
  status_sebelum: string | null;
  status_sesudah: string;
  user_id:        number;
  nama_pelaksana: string;
  role_id:        number;
  nama_role:      string;
  keterangan?:    string;
}

export interface AuditLogEntry {
  id:             number;
  entity_id:      number;
  nama_entity:    string;
  kode_entity?:   string;
  aksi:           AuditAction;
  user_id:        number;
  nama_pelaksana: string;
  role_id:        number;
  nama_role:      string;
  satelit_id:     number;
  nama_satelit:   string;
  keterangan:     string | null;
  created_at:     string;
}

export interface AnggaranAuditLogEntry {
  id:              number;
  anggaran_id:     string;
  kode_dokumen:    string;
  aksi:            string;
  status_sebelum:  string | null;
  status_sesudah:  string;
  user_id:         number;
  nama_pelaksana:  string;
  role_id:         number;
  nama_role:       string;
  satelit_id:      number;
  nama_satelit:    string;
  keterangan:      string | null;
  created_at:      string;
}

export interface LpjAuditLogEntry {
  id:              number;
  kegiatan_id:     number;
  aksi:            string;
  status_sebelum:  string | null;
  status_sesudah:  string;
  user_id:         number;
  nama_pelaksana:  string;
  role_id:         number;
  nama_role:       string;
  keterangan:      string | null;
  created_at:      string;
}

export interface GetAuditLogParams {
  entity_id?: number;
  user_id?:   number;
  aksi?:      string;
  date_from?: string;
  date_to?:   string;
  search?:    string;
  limit?:     number;
  offset?:    number;
}

export interface GetAnggaranAuditLogParams {
  anggaran_id?: string;
  aksi?:        string;
  date_from?:   string;
  date_to?:     string;
  search?:      string;
  limit?:       number;
  offset?:      number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Repository
// ──────────────────────────────────────────────────────────────────────────────
export class AuditLogRepository {

  // ── INSERT ─────────────────────────────────────────────────────────────────

  async insertJemaatAuditLog(params: InsertJemaatAuditLogParams): Promise<void> {
    const { jemaat_id, aksi, user_id, role_id, satelit_id, keterangan } = params;
    await pool.query(
      `INSERT INTO jemaat_audit_log (jemaat_id, aksi, user_id, role_id, satelit_id, keterangan)
       VALUES ($1, $2::audit_action, $3, $4, $5, $6)`,
      [jemaat_id, aksi, user_id, role_id, satelit_id, keterangan ?? null]
    );
  }

  async insertPelayanAuditLog(params: InsertPelayanAuditLogParams): Promise<void> {
    const { pelayan_id, aksi, user_id, role_id, satelit_id, keterangan } = params;
    await pool.query(
      `INSERT INTO pelayan_audit_log (pelayan_id, aksi, user_id, role_id, satelit_id, keterangan)
       VALUES ($1, $2::audit_action, $3, $4, $5, $6)`,
      [pelayan_id, aksi, user_id, role_id, satelit_id, keterangan ?? null]
    );
  }

  async insertPengurusAuditLog(params: InsertPengurusAuditLogParams): Promise<void> {
    const { pengurus_id, aksi, user_id, role_id, satelit_id, keterangan } = params;
    await pool.query(
      `INSERT INTO pengurus_audit_log (pengurus_id, aksi, user_id, role_id, satelit_id, keterangan)
       VALUES ($1, $2::audit_action, $3, $4, $5, $6)`,
      [pengurus_id, aksi, user_id, role_id, satelit_id, keterangan ?? null]
    );
  }

  async insertInventarisAuditLog(params: InsertInventarisAuditLogParams): Promise<void> {
    const { barang_id, aksi, user_id, role_id, satelit_id, keterangan } = params;
    await pool.query(
      `INSERT INTO inventaris_audit_log (barang_id, aksi, user_id, role_id, satelit_id, keterangan)
       VALUES ($1, $2::audit_action, $3, $4, $5, $6)`,
      [barang_id, aksi, user_id, role_id, satelit_id, keterangan ?? null]
    );
  }

  async insertKegiatanAuditLog(params: InsertKegiatanAuditLogParams): Promise<void> {
    const { kegiatan_id, aksi, user_id, role_id, satelit_id, keterangan } = params;
    await pool.query(
      `INSERT INTO kegiatan_audit_log (kegiatan_id, aksi, user_id, role_id, satelit_id, keterangan)
       VALUES ($1, $2::audit_action, $3, $4, $5, $6)`,
      [kegiatan_id, aksi, user_id, role_id, satelit_id, keterangan ?? null]
    );
  }

  // ── QUERY HELPER ───────────────────────────────────────────────────────────

  private buildConditions(params: GetAuditLogParams, entityAlias: string) {
    const { entity_id, user_id, aksi, date_from, date_to, search } = params;
    const conditions: string[] = ['1 = 1'];
    const values: any[] = [];
    let idx = 1;

    if (entity_id) {
      conditions.push(`al.${entityAlias}_id = $${idx++}`);
      values.push(entity_id);
    }
    if (user_id) {
      conditions.push(`al.user_id = $${idx++}`);
      values.push(user_id);
    }
    if (aksi) {
      conditions.push(`al.aksi = $${idx++}::audit_action`);
      values.push(aksi);
    }
    if (date_from) {
      conditions.push(`al.created_at >= $${idx++}::date`);
      values.push(date_from);
    }
    if (date_to) {
      conditions.push(`al.created_at < ($${idx++}::date + INTERVAL '1 day')`);
      values.push(date_to);
    }
    if (search) {
      conditions.push(`(entity_name_search ILIKE $${idx++} OR p.email ILIKE $${idx - 1})`);
      values.push(`%${search}%`);
    }
    return { conditions, values, nextIdx: idx };
  }

  // ── GET JEMAAT AUDIT LOG ───────────────────────────────────────────────────

  async getJemaatAuditLogs(params: GetAuditLogParams): Promise<{ data: AuditLogEntry[]; total: number }> {
    const { limit = 15, offset = 0, search } = params;
    const { conditions, values, nextIdx } = this.buildConditions(params, 'jemaat');
    const where = conditions.join(' AND ');

    const cte = search ? `
      WITH log_data AS (
        SELECT al.id, al.jemaat_id AS entity_id, j.nama_lengkap AS nama_entity,
               j.nama_lengkap AS entity_name_search, al.aksi, al.user_id,
               COALESCE(j2.nama_lengkap, p.email) AS nama_pelaksana,
               al.role_id, r.nama_role, al.satelit_id, s.nama_satelit,
               al.keterangan, al.created_at
        FROM jemaat_audit_log al
        JOIN jemaat   j  ON al.jemaat_id  = j.id
        JOIN pengguna p  ON al.user_id    = p.id
        LEFT JOIN jemaat j2 ON p.jemaat_id = j2.id
        JOIN role     r  ON al.role_id    = r.id
        JOIN satelit  s  ON al.satelit_id = s.id
      )` : '';

    const baseFrom = search ? `FROM log_data al_wrapped` : `
      FROM jemaat_audit_log al
      JOIN jemaat   j  ON al.jemaat_id  = j.id
      JOIN pengguna p  ON al.user_id    = p.id
      LEFT JOIN jemaat j2 ON p.jemaat_id = j2.id
      JOIN role     r  ON al.role_id    = r.id
      JOIN satelit  s  ON al.satelit_id = s.id`;

    const countQuery = search
      ? `${cte} SELECT COUNT(*) AS count ${baseFrom} WHERE ${where.replace(/al\./g, 'al_wrapped.')}`
      : `SELECT COUNT(*) AS count FROM jemaat_audit_log al
         JOIN jemaat j ON al.jemaat_id=j.id JOIN pengguna p ON al.user_id=p.id
         LEFT JOIN jemaat j2 ON p.jemaat_id=j2.id JOIN role r ON al.role_id=r.id
         JOIN satelit s ON al.satelit_id=s.id WHERE ${where}`;

    const dataQuery = search ? `
      ${cte} SELECT * ${baseFrom} WHERE ${where.replace(/al\./g, 'al_wrapped.')}
      ORDER BY created_at DESC LIMIT $${nextIdx} OFFSET $${nextIdx + 1}
    ` : `
      SELECT al.id, al.jemaat_id AS entity_id, j.nama_lengkap AS nama_entity, al.aksi, al.user_id,
             COALESCE(j2.nama_lengkap, p.email) AS nama_pelaksana,
             al.role_id, r.nama_role, al.satelit_id, s.nama_satelit, al.keterangan, al.created_at
      FROM jemaat_audit_log al
      JOIN jemaat   j  ON al.jemaat_id  = j.id
      JOIN pengguna p  ON al.user_id    = p.id
      LEFT JOIN jemaat j2 ON p.jemaat_id = j2.id
      JOIN role     r  ON al.role_id    = r.id
      JOIN satelit  s  ON al.satelit_id = s.id
      WHERE ${where} ORDER BY al.created_at DESC LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(dataQuery, [...values, limit, offset]),
    ]);
    return { total: parseInt(countRes.rows[0].count, 10), data: dataRes.rows };
  }

  // ── GET PELAYAN AUDIT LOG ──────────────────────────────────────────────────

  async getPelayanAuditLogs(params: GetAuditLogParams): Promise<{ data: AuditLogEntry[]; total: number }> {
    const { limit = 15, offset = 0, search } = params;
    const { conditions, values, nextIdx } = this.buildConditions(params, 'pelayan');
    const where = conditions.join(' AND ');

    const cte = search ? `
      WITH log_data AS (
        SELECT al.id, al.pelayan_id AS entity_id, j.nama_lengkap AS nama_entity,
               j.nama_lengkap AS entity_name_search, al.aksi, al.user_id,
               COALESCE(j2.nama_lengkap, p.email) AS nama_pelaksana,
               al.role_id, r.nama_role, al.satelit_id, s.nama_satelit,
               al.keterangan, al.created_at
        FROM pelayan_audit_log al
        JOIN pelayan  pl ON al.pelayan_id = pl.id
        JOIN jemaat   j  ON pl.jemaat_id  = j.id
        JOIN pengguna p  ON al.user_id    = p.id
        LEFT JOIN jemaat j2 ON p.jemaat_id = j2.id
        JOIN role     r  ON al.role_id    = r.id
        JOIN satelit  s  ON al.satelit_id = s.id
      )` : '';

    const baseFrom = search ? `FROM log_data al_wrapped` : `
      FROM pelayan_audit_log al
      JOIN pelayan  pl ON al.pelayan_id = pl.id
      JOIN jemaat   j  ON pl.jemaat_id  = j.id
      JOIN pengguna p  ON al.user_id    = p.id
      LEFT JOIN jemaat j2 ON p.jemaat_id = j2.id
      JOIN role     r  ON al.role_id    = r.id
      JOIN satelit  s  ON al.satelit_id = s.id`;

    const countQuery = search
      ? `${cte} SELECT COUNT(*) AS count ${baseFrom} WHERE ${where.replace(/al\./g, 'al_wrapped.')}`
      : `SELECT COUNT(*) AS count ${baseFrom} WHERE ${where}`;

    const dataQuery = search ? `
      ${cte} SELECT * ${baseFrom} WHERE ${where.replace(/al\./g, 'al_wrapped.')}
      ORDER BY created_at DESC LIMIT $${nextIdx} OFFSET $${nextIdx + 1}
    ` : `
      SELECT al.id, al.pelayan_id AS entity_id, j.nama_lengkap AS nama_entity, al.aksi, al.user_id,
             COALESCE(j2.nama_lengkap, p.email) AS nama_pelaksana,
             al.role_id, r.nama_role, al.satelit_id, s.nama_satelit, al.keterangan, al.created_at
      ${baseFrom}
      WHERE ${where} ORDER BY al.created_at DESC LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(dataQuery, [...values, limit, offset]),
    ]);
    return { total: parseInt(countRes.rows[0].count, 10), data: dataRes.rows };
  }

  // ── GET PENGURUS AUDIT LOG ─────────────────────────────────────────────────

  async getPengurusAuditLogs(params: GetAuditLogParams): Promise<{ data: AuditLogEntry[]; total: number }> {
    const { limit = 15, offset = 0, search } = params;
    const { conditions, values, nextIdx } = this.buildConditions(params, 'pengurus');
    const where = conditions.join(' AND ');

    const cte = search ? `
      WITH log_data AS (
        SELECT al.id, al.pengurus_id AS entity_id, j.nama_lengkap AS nama_entity,
               j.nama_lengkap AS entity_name_search, al.aksi, al.user_id,
               COALESCE(j2.nama_lengkap, p.email) AS nama_pelaksana,
               al.role_id, r.nama_role, al.satelit_id, s.nama_satelit,
               al.keterangan, al.created_at
        FROM pengurus_audit_log al
        JOIN pengurus  pg ON al.pengurus_id = pg.id
        JOIN jemaat    j  ON pg.jemaat_id   = j.id
        JOIN pengguna  p  ON al.user_id     = p.id
        LEFT JOIN jemaat j2 ON p.jemaat_id  = j2.id
        JOIN role      r  ON al.role_id     = r.id
        JOIN satelit   s  ON al.satelit_id  = s.id
      )` : '';

    const baseFrom = search ? `FROM log_data al_wrapped` : `
      FROM pengurus_audit_log al
      JOIN pengurus  pg ON al.pengurus_id = pg.id
      JOIN jemaat    j  ON pg.jemaat_id   = j.id
      JOIN pengguna  p  ON al.user_id     = p.id
      LEFT JOIN jemaat j2 ON p.jemaat_id  = j2.id
      JOIN role      r  ON al.role_id     = r.id
      JOIN satelit   s  ON al.satelit_id  = s.id`;

    const countQuery = search
      ? `${cte} SELECT COUNT(*) AS count ${baseFrom} WHERE ${where.replace(/al\./g, 'al_wrapped.')}`
      : `SELECT COUNT(*) AS count ${baseFrom} WHERE ${where}`;

    const dataQuery = search ? `
      ${cte} SELECT * ${baseFrom} WHERE ${where.replace(/al\./g, 'al_wrapped.')}
      ORDER BY created_at DESC LIMIT $${nextIdx} OFFSET $${nextIdx + 1}
    ` : `
      SELECT al.id, al.pengurus_id AS entity_id, j.nama_lengkap AS nama_entity, al.aksi, al.user_id,
             COALESCE(j2.nama_lengkap, p.email) AS nama_pelaksana,
             al.role_id, r.nama_role, al.satelit_id, s.nama_satelit, al.keterangan, al.created_at
      ${baseFrom}
      WHERE ${where} ORDER BY al.created_at DESC LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(dataQuery, [...values, limit, offset]),
    ]);
    return { total: parseInt(countRes.rows[0].count, 10), data: dataRes.rows };
  }

  // ── GET INVENTARIS AUDIT LOG ───────────────────────────────────────────────

  async getInventarisAuditLogs(params: GetAuditLogParams): Promise<{ data: AuditLogEntry[]; total: number }> {
    const { limit = 15, offset = 0, search, entity_id, user_id, aksi, date_from, date_to } = params;
    const conditions: string[] = ['1 = 1'];
    const values: any[] = [];
    let idx = 1;

    if (entity_id) {
      conditions.push(`al.barang_id = $${idx++}`);
      values.push(entity_id);
    }
    if (user_id) {
      conditions.push(`al.user_id = $${idx++}`);
      values.push(user_id);
    }
    if (aksi) {
      conditions.push(`al.aksi = $${idx++}::audit_action`);
      values.push(aksi);
    }
    if (date_from) {
      conditions.push(`al.created_at >= $${idx++}::date`);
      values.push(date_from);
    }
    if (date_to) {
      conditions.push(`al.created_at < ($${idx++}::date + INTERVAL '1 day')`);
      values.push(date_to);
    }
    if (search) {
      conditions.push(`(b.nama ILIKE $${idx} OR b.kode_barang ILIKE $${idx} OR COALESCE(j2.nama_lengkap, p.email) ILIKE $${idx} OR al.keterangan ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const where = conditions.join(' AND ');

    const baseFrom = `
      FROM inventaris_audit_log al
      JOIN barang   b  ON al.barang_id  = b.id
      JOIN pengguna p  ON al.user_id    = p.id
      LEFT JOIN jemaat j2 ON p.jemaat_id = j2.id
      JOIN role     r  ON al.role_id    = r.id
      JOIN satelit  s  ON al.satelit_id = s.id`;

    const countQuery = `SELECT COUNT(*) AS count ${baseFrom} WHERE ${where}`;
    const dataQuery = `
      SELECT al.id, al.barang_id AS entity_id, b.nama AS nama_entity, b.kode_barang AS kode_entity, al.aksi, al.user_id,
             COALESCE(j2.nama_lengkap, p.email) AS nama_pelaksana,
             al.role_id, r.nama_role, al.satelit_id, s.nama_satelit, al.keterangan, al.created_at
      ${baseFrom}
      WHERE ${where}
      ORDER BY al.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}`;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(dataQuery, [...values, limit, offset]),
    ]);
    return { total: parseInt(countRes.rows[0].count, 10), data: dataRes.rows };
  }

  // ── GET KEGIATAN AUDIT LOG ─────────────────────────────────────────────────

  async getKegiatanAuditLogs(params: GetAuditLogParams): Promise<{ data: AuditLogEntry[]; total: number }> {
    const { limit = 15, offset = 0, search, entity_id, user_id, aksi, date_from, date_to } = params;
    const conditions: string[] = ['1 = 1'];
    const values: any[] = [];
    let idx = 1;

    if (entity_id) {
      conditions.push(`al.kegiatan_id = $${idx++}`);
      values.push(entity_id);
    }
    if (user_id) {
      conditions.push(`al.user_id = $${idx++}`);
      values.push(user_id);
    }
    if (aksi) {
      conditions.push(`al.aksi = $${idx++}::audit_action`);
      values.push(aksi);
    }
    if (date_from) {
      conditions.push(`al.created_at >= $${idx++}::date`);
      values.push(date_from);
    }
    if (date_to) {
      conditions.push(`al.created_at < ($${idx++}::date + INTERVAL '1 day')`);
      values.push(date_to);
    }
    if (search) {
      conditions.push(`(k.nama_kegiatan ILIKE $${idx} OR k.kode_kegiatan ILIKE $${idx} OR COALESCE(j2.nama_lengkap, p.email) ILIKE $${idx} OR al.keterangan ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const where = conditions.join(' AND ');

    const baseFrom = `
      FROM kegiatan_audit_log al
      JOIN kegiatan k  ON al.kegiatan_id = k.id
      JOIN pengguna p  ON al.user_id     = p.id
      LEFT JOIN jemaat j2 ON p.jemaat_id = j2.id
      JOIN role     r  ON al.role_id     = r.id
      JOIN satelit  s  ON al.satelit_id  = s.id`;

    const countQuery = `SELECT COUNT(*) AS count ${baseFrom} WHERE ${where}`;
    const dataQuery = `
      SELECT al.id, al.kegiatan_id AS entity_id, k.nama_kegiatan AS nama_entity, k.kode_kegiatan AS kode_entity, al.aksi, al.user_id,
             COALESCE(j2.nama_lengkap, p.email) AS nama_pelaksana,
             al.role_id, r.nama_role, al.satelit_id, s.nama_satelit, al.keterangan, al.created_at
      ${baseFrom}
      WHERE ${where}
      ORDER BY al.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}`;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(dataQuery, [...values, limit, offset]),
    ]);
    return { total: parseInt(countRes.rows[0].count, 10), data: dataRes.rows };
  }

  // ── GET PASTORAL AUDIT LOG ─────────────────────────────────────────────────

  async getPastoralAuditLogs(params: GetAuditLogParams & { status_baru?: string }): Promise<{ data: PastoralAuditLogEntry[]; total: number }> {
    const { limit = 15, offset = 0, search, entity_id, user_id, aksi, status_baru, date_from, date_to } = params;
    const conditions: string[] = ['1 = 1'];
    const values: any[] = [];
    let idx = 1;

    if (entity_id) {
      conditions.push(`al.permohonan_id = $${idx++}`);
      values.push(entity_id);
    }
    if (user_id) {
      conditions.push(`al.diubah_oleh_id = $${idx++}`);
      values.push(user_id);
    }
    if (aksi || status_baru) {
      conditions.push(`al.status_baru = $${idx++}`);
      values.push(aksi || status_baru);
    }
    if (date_from) {
      conditions.push(`al.created_at >= $${idx++}::date`);
      values.push(date_from);
    }
    if (date_to) {
      conditions.push(`al.created_at < ($${idx++}::date + INTERVAL '1 day')`);
      values.push(date_to);
    }
    if (search) {
      conditions.push(`(plp.nomor_tiket ILIKE $${idx} OR COALESCE(jp.nama_lengkap, plp.nama_target_luar) ILIKE $${idx} OR COALESCE(j2.nama_lengkap, p.email) ILIKE $${idx} OR al.catatan_perubahan ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const where = conditions.join(' AND ');

    const baseFrom = `
      FROM permohonan_layanan_audit_log al
      JOIN permohonan_layanan_pastoral plp ON al.permohonan_id = plp.id
      LEFT JOIN jemaat jp ON plp.jemaat_pemohon_id = jp.id
      LEFT JOIN jenis_kegiatan jk ON plp.jenis_kegiatan_id = jk.id
      LEFT JOIN pengguna p ON al.diubah_oleh_id = p.id
      LEFT JOIN jemaat j2 ON p.jemaat_id = j2.id
      LEFT JOIN LATERAL (
        SELECT ur.role_id, ur.satelit_id 
        FROM user_role ur 
        WHERE ur.user_id = p.id 
        ORDER BY ur.is_active DESC 
        LIMIT 1
      ) ur_lat ON true
      LEFT JOIN role r ON ur_lat.role_id = r.id
      LEFT JOIN satelit s ON (ur_lat.satelit_id = s.id OR (ur_lat.satelit_id IS NULL AND jp.satelit_id = s.id))`;

    const countQuery = `SELECT COUNT(*) AS count ${baseFrom} WHERE ${where}`;
    const dataQuery = `
      SELECT al.id, al.permohonan_id, plp.nomor_tiket,
             COALESCE(jp.nama_lengkap, plp.nama_target_luar, 'Pemohon') AS nama_pemohon,
             COALESCE(jk.nama_jenis_kegiatan, 'Layanan Pastoral') AS jenis_layanan,
             al.status_sebelumnya, al.status_baru, al.diubah_oleh_id,
             COALESCE(j2.nama_lengkap, p.username, p.email, 'Sistem') AS nama_pelaksana,
             COALESCE(r.nama_role, 'Pengguna') AS nama_role,
             COALESCE(s.nama_satelit, '-') AS nama_satelit,
             al.catatan_perubahan, al.created_at
      ${baseFrom}
      WHERE ${where}
      ORDER BY al.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}`;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(dataQuery, [...values, limit, offset]),
    ]);
    return { total: parseInt(countRes.rows[0].count, 10), data: dataRes.rows };
  }

  // ── INSERT ANGGARAN AUDIT LOG ──────────────────────────────────────────────

  async insertAnggaranAuditLog(params: InsertAnggaranAuditLogParams): Promise<void> {
    const {
      anggaran_id, kode_dokumen, aksi, status_sebelum, status_sesudah,
      user_id, nama_pelaksana, role_id, nama_role, satelit_id, nama_satelit, keterangan
    } = params;
    await pool.query(
      `INSERT INTO anggaran_audit_log
         (anggaran_id, kode_dokumen, aksi, status_sebelum, status_sesudah,
          user_id, nama_pelaksana, role_id, nama_role, satelit_id, nama_satelit, keterangan)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [anggaran_id, kode_dokumen, aksi, status_sebelum, status_sesudah,
       user_id, nama_pelaksana, role_id, nama_role, satelit_id, nama_satelit, keterangan ?? null]
    );
  }

  // ── GET ANGGARAN AUDIT LOGS (for /settings/audit-log page) ────────────────

  async getAnggaranAuditLogs(params: GetAnggaranAuditLogParams): Promise<{ data: AnggaranAuditLogEntry[]; total: number }> {
    const { limit = 15, offset = 0, anggaran_id, aksi, date_from, date_to, search } = params;
    const conditions: string[] = ['1 = 1'];
    const values: any[] = [];
    let idx = 1;

    if (anggaran_id) {
      conditions.push(`al.anggaran_id = $${idx++}`);
      values.push(anggaran_id);
    }
    if (aksi) {
      conditions.push(`al.aksi = $${idx++}`);
      values.push(aksi);
    }
    if (date_from) {
      conditions.push(`al.created_at >= $${idx++}::date`);
      values.push(date_from);
    }
    if (date_to) {
      conditions.push(`al.created_at < ($${idx++}::date + INTERVAL '1 day')`);
      values.push(date_to);
    }
    if (search) {
      conditions.push(`(al.kode_dokumen ILIKE $${idx} OR al.nama_pelaksana ILIKE $${idx} OR al.keterangan ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const where = conditions.join(' AND ');

    const countQuery = `SELECT COUNT(*) AS count FROM anggaran_audit_log al WHERE ${where}`;
    const dataQuery = `
      SELECT al.id, al.anggaran_id, al.kode_dokumen,
             al.aksi, al.status_sebelum, al.status_sesudah,
             al.user_id, al.nama_pelaksana, al.role_id, al.nama_role,
             al.satelit_id, al.nama_satelit, al.keterangan, al.created_at
      FROM anggaran_audit_log al
      WHERE ${where}
      ORDER BY al.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}`;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(dataQuery, [...values, limit, offset]),
    ]);
    return { total: parseInt(countRes.rows[0].count, 10), data: dataRes.rows };
  }

  // ── GET ANGGARAN TIMELINE (for "Lihat Riwayat" per RA) ────────────────────

  async getAnggaranTimeline(anggaran_id: string): Promise<AnggaranAuditLogEntry[]> {
    const res = await pool.query(
      `SELECT * FROM anggaran_audit_log
       WHERE anggaran_id = $1
       ORDER BY created_at ASC, id ASC`,
      [anggaran_id]
    );
    return res.rows;
  }

  // ── INSERT LPJ AUDIT LOG ──────────────────────────────────────────────────

  async insertLpjAuditLog(params: InsertLpjAuditLogParams): Promise<void> {
    const { kegiatan_id, aksi, status_sebelum, status_sesudah, user_id, nama_pelaksana, role_id, nama_role, keterangan } = params;
    await pool.query(
      `INSERT INTO public.kegiatan_lpj_audit_log
         (kegiatan_id, aksi, status_sebelum, status_sesudah, user_id, nama_pelaksana, role_id, nama_role, keterangan)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [kegiatan_id, aksi, status_sebelum, status_sesudah, user_id, nama_pelaksana, role_id, nama_role, keterangan ?? null]
    );
  }

  // ── GET LPJ TIMELINE ──────────────────────────────────────────────────────

  async getLpjTimeline(kegiatan_id: number): Promise<LpjAuditLogEntry[]> {
    const res = await pool.query(
      `SELECT * FROM public.kegiatan_lpj_audit_log
       WHERE kegiatan_id = $1
       ORDER BY created_at ASC, id ASC`,
      [kegiatan_id]
    );
    return res.rows;
  }

  // ── LEGACY ALIAS ───────────────────────────────────────────────────────────
  async insertAuditLog(params: InsertJemaatAuditLogParams): Promise<void> {
    return this.insertJemaatAuditLog(params);
  }
}

export const auditLogRepository = new AuditLogRepository();
