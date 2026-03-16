import pool from '@/lib/db';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DEACTIVATE';

export interface InsertAuditLogParams {
  jemaat_id:  number;
  aksi:        AuditAction;
  user_id:     number;
  role_id:     number;
  satelit_id:  number;
  keterangan?: string;
}

export interface AuditLogEntry {
  id:              number;
  jemaat_id:       number;
  nama_jemaat:     string;
  aksi:            AuditAction;
  user_id:         number;
  nama_pelaksana:  string;
  role_id:         number;
  nama_role:       string;
  satelit_id:      number;
  nama_satelit:    string;
  keterangan:      string | null;
  created_at:      string;
}

export interface GetAuditLogParams {
  jemaat_id?:  number;
  user_id?:    number;
  aksi?:       string;
  date_from?:  string;
  date_to?:    string;
  search?:     string;
  limit?:      number;
  offset?:     number;
}

export class AuditLogRepository {

  async insertAuditLog(params: InsertAuditLogParams): Promise<void> {
    const { jemaat_id, aksi, user_id, role_id, satelit_id, keterangan } = params;
    await pool.query(
      `INSERT INTO jemaat_audit_log (jemaat_id, aksi, user_id, role_id, satelit_id, keterangan)
       VALUES ($1, $2::audit_action, $3, $4, $5, $6)`,
      [jemaat_id, aksi, user_id, role_id, satelit_id, keterangan ?? null]
    );
  }

  async getAuditLogs(params: GetAuditLogParams): Promise<{ data: AuditLogEntry[]; total: number }> {
    const {
      jemaat_id,
      user_id,
      aksi,
      date_from,
      date_to,
      search,
      limit = 15,
      offset = 0,
    } = params;

    const conditions: string[] = ['1 = 1'];
    const values: any[]        = [];
    let   idx                  = 1;

    if (jemaat_id) {
      conditions.push(`al.jemaat_id = $${idx++}`);
      values.push(jemaat_id);
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
      conditions.push(`(j.nama_lengkap ILIKE $${idx++} OR p.email ILIKE $${idx - 1})`);
      values.push(`%${search}%`);
    }

    const where = conditions.join(' AND ');

    const baseQuery = `
      FROM jemaat_audit_log al
      JOIN jemaat   j ON al.jemaat_id  = j.id
      JOIN pengguna p ON al.user_id    = p.id
      JOIN role     r ON al.role_id    = r.id
      JOIN satelit  s ON al.satelit_id = s.id
      WHERE ${where}
    `;

    const countRes = await pool.query(`SELECT COUNT(*) ${baseQuery}`, values);
    const total    = parseInt(countRes.rows[0].count, 10);

    const dataRes = await pool.query(
      `SELECT
         al.id,
         al.jemaat_id,
         j.nama_lengkap          AS nama_jemaat,
         al.aksi,
         al.user_id,
         COALESCE(j2.nama_lengkap, p.email) AS nama_pelaksana,
         al.role_id,
         r.nama_role,
         al.satelit_id,
         s.nama_satelit,
         al.keterangan,
         al.created_at
       ${baseQuery}
       LEFT JOIN jemaat j2 ON p.jemaat_id = j2.id
       ORDER BY al.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return { data: dataRes.rows, total };
  }
}

export const auditLogRepository = new AuditLogRepository();
