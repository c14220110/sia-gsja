export async function generateKodeKegiatan(clientOrPool: any, jenisKegiatanId: number, tanggalMulai: string | Date): Promise<string> {
  // Parsing date ensuring it works well with ISO format strings or Date objects
  const d = new Date(tanggalMulai);
  const yy = d.getFullYear().toString().slice(-2);
  
  // Menggunakan query DB untuk mendapatkan singkatan dan hitungan minggu ISO
  const resMeta = await clientOrPool.query(`
    SELECT 
      kode_singkatan,
      LPAD(EXTRACT(WEEK FROM $1::date)::text, 2, '0') as week_num
    FROM public.jenis_kegiatan 
    WHERE id = $2
  `, [d, jenisKegiatanId]);

  const singkatan = (resMeta.rows.length > 0 && resMeta.rows[0].kode_singkatan) 
      ? resMeta.rows[0].kode_singkatan.trim().toUpperCase() 
      : 'KG'; // Default jika tidak ada/null
  const weekNum = resMeta.rows.length > 0 ? resMeta.rows[0].week_num : '01';

  // Format Prefix: [Singkatan][Minggu][Tahun] -> misal: IR0126
  const prefix = `${singkatan}${weekNum}${yy}`;

  // Cari urutan terakhir yang memiliki prefix ini (untuk mencari max sequence)
  const resSeq = await clientOrPool.query(`
    SELECT kode_kegiatan 
    FROM public.kegiatan 
    WHERE kode_kegiatan LIKE $1
    ORDER BY kode_kegiatan DESC 
    LIMIT 1
  `, [`${prefix}%`]);

  let sequence = 1;
  if (resSeq.rows.length > 0) {
    const lastCode = resSeq.rows[0].kode_kegiatan;
    // lastCode format: IR0126001. Kita buang bagian prefix-nya "IR0126" untuk mendapatkan "001"
    const lastSeqStr = lastCode.substring(prefix.length); 
    const lastSeq = parseInt(lastSeqStr, 10);
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }

  // Format urutan menjadi 3 digit (contoh: 001)
  const seqFormatted = String(sequence).padStart(3, '0');
  
  return `${prefix}${seqFormatted}`;
}
