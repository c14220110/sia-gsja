import pool from '@/lib/db';

export interface FamilyTreePerson {
  id: number;
  jemaat_id: string;
  nama_lengkap: string;
  jenis_kelamin: string | null;
  tanggal_lahir: Date | null;
  foto_url: string | null;
  status_jemaat: string;
  status_pernikahan: string | null;
  ayah_id: number | null;
  ibu_id: number | null;
  pasangan_id: number | null;
  ayah_nama: string | null;
  ibu_nama: string | null;
  pasangan_nama: string | null;
  nama_satelit: string | null;
}

const SELECT_PERSON = `
  SELECT j.id, j.jemaat_id, j.nama_lengkap, j.jenis_kelamin, j.tanggal_lahir,
         j.foto_url, j.status_jemaat, j.status_pernikahan, j.ayah_id, j.ibu_id, j.pasangan_id,
         j.ayah_nama, j.ibu_nama, j.pasangan_nama, s.nama_satelit
  FROM jemaat j
  LEFT JOIN satelit s ON j.satelit_id = s.id
  WHERE j.id = $1 AND j.is_deleted = false
`;

export class FamilyTreeRepository {

  async getPersonById(id: number): Promise<FamilyTreePerson | null> {
    const res = await pool.query(SELECT_PERSON, [id]);
    return res.rows[0] || null;
  }

  async getSaudara(personId: number): Promise<any[]> {
    const res = await pool.query(
      `SELECT j.id, j.jemaat_id, j.nama_lengkap, j.jenis_kelamin, j.tanggal_lahir,
              j.foto_url, j.status_jemaat
       FROM relasi_jemaat rj
       JOIN jenis_relasi  jr ON rj.jenis_relasi_id = jr.id AND jr.nama_relasi = 'Saudara Kandung'
       JOIN jemaat        j  ON rj.jemaat_terkait_id = j.id AND j.is_deleted = false
       WHERE rj.jemaat_id = $1`,
      [personId]
    );
    return res.rows;
  }

  async getAnak(orang_tua_id: number): Promise<any[]> {
    const res = await pool.query(
      `SELECT
         rj.id             AS relasi_id,
         rj.nama_terkait   AS nama_anak,
         rj.gereja_asal    AS gereja_asal_anak,
         rj.jemaat_terkait_id AS anak_jemaat_id,
         j.id,
         j.jemaat_id       AS jemaat_nomor,
         j.nama_lengkap,
         j.jenis_kelamin,
         j.tanggal_lahir,
         j.foto_url,
         j.status_jemaat
       FROM relasi_jemaat rj
       JOIN jenis_relasi  jr ON rj.jenis_relasi_id = jr.id AND jr.nama_relasi = 'Anak'
       LEFT JOIN jemaat   j  ON rj.jemaat_terkait_id = j.id AND j.is_deleted = false
       WHERE rj.jemaat_id = $1
       ORDER BY j.tanggal_lahir ASC NULLS LAST, rj.id ASC`,
      [orang_tua_id]
    );
    return res.rows;
  }

  async getOrangTuaFromRelasi(anak_id: number): Promise<{ayah: FamilyTreePerson | null, ibu: FamilyTreePerson | null}> {
    const res = await pool.query(
      `SELECT
         j.id, j.jemaat_id, j.nama_lengkap, j.jenis_kelamin, j.tanggal_lahir,
         j.foto_url, j.status_jemaat, j.status_pernikahan, j.ayah_id, j.ibu_id, j.pasangan_id,
         j.ayah_nama, j.ibu_nama, j.pasangan_nama, s.nama_satelit
       FROM relasi_jemaat rj
       JOIN jenis_relasi  jr ON rj.jenis_relasi_id = jr.id AND jr.nama_relasi = 'Anak'
       JOIN jemaat        j  ON rj.jemaat_id = j.id AND j.is_deleted = false
       LEFT JOIN satelit  s  ON j.satelit_id = s.id
       WHERE rj.jemaat_terkait_id = $1`,
      [anak_id]
    );
    
    let ayah = null;
    let ibu = null;
    for (const row of res.rows) {
      if (row.jenis_kelamin === 'Laki-laki' && !ayah) ayah = row;
      else if (row.jenis_kelamin === 'Perempuan' && !ibu) ibu = row;
    }
    return { ayah, ibu };
  }

  /** Fetch full family tree data for a person */
  async getFamilyTree(personId: number) {
    const person = await this.getPersonById(personId);
    if (!person) return null;

    if (person.status_pernikahan === 'Lajang') {
      person.pasangan_id = null;
      person.pasangan_nama = null;
    }

    let [ayah, ibu, pasangan, saudara, anak] = await Promise.all([
      person.ayah_id     ? this.getPersonById(person.ayah_id)     : Promise.resolve(null),
      person.ibu_id      ? this.getPersonById(person.ibu_id)      : Promise.resolve(null),
      person.pasangan_id ? this.getPersonById(person.pasangan_id) : Promise.resolve(null),
      this.getSaudara(personId),
      this.getAnak(personId),
    ]);

    // Plan cadangan: Kalau dr tabel gaada ngedefinisiin ayah / ibunya sapa, yowis cari mundur nyontek dari jalur 'Anak'nya siapa
    if (!ayah || !ibu) {
      const parentFallback = await this.getOrangTuaFromRelasi(personId);
      if (!ayah) ayah = parentFallback.ayah;
      if (!ibu) ibu = parentFallback.ibu;
    }

    const [kakekAyah, nenekAyah, kakekIbu, nenekIbu] = await Promise.all([
      ayah?.ayah_id ? this.getPersonById(ayah.ayah_id) : Promise.resolve(null),
      ayah?.ibu_id  ? this.getPersonById(ayah.ibu_id)  : Promise.resolve(null),
      ibu?.ayah_id  ? this.getPersonById(ibu.ayah_id)  : Promise.resolve(null),
      ibu?.ibu_id   ? this.getPersonById(ibu.ibu_id)   : Promise.resolve(null),
    ]);

    return {
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
    };
  }
}

export const familyTreeRepository = new FamilyTreeRepository();
