import pool from '@/lib/db';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DEACTIVATE';

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

export interface AuditLogEntry {
  id:             number;
  entity_id:      number;
  nama_entity:    string;
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

  // ── LEGACY ALIAS ───────────────────────────────────────────────────────────
  async insertAuditLog(params: InsertJemaatAuditLogParams): Promise<void> {
    return this.insertJemaatAuditLog(params);
  }
}

export const auditLogRepository = new AuditLogRepository();
