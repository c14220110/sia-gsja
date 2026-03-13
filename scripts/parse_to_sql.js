const fs = require('fs');

const dataStr = `VALUES ('1', 'TEMP001', '7878', 'Saarce', 'Perempuan', 'Thyhjh', '1981-07-15', 'Fhgnvv', 'Fhvg', 'Fjgn', 'Fkhh', '687', '485846', 'Hahaja', 'Menikah', 'true', null, 'Aktif', null, 'Fjgjj', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', null, null, null, null, null, null), ('2', 'TEMP002', 'ass', 'Andika', 'Laki-laki', '111', '1978-02-12', 'qqqw', 'Sidoarjo', 'assa', 'asaa', 'aa s', '1212', 'asas', 'Lajang', 'true', null, 'Aktif', null, '11222', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', null, null, null, null, null, null), ('3', 'TEMP003', null, 'Ignatius N', 'Laki-laki', 'Banjarmasin', '1971-11-10', 'Wage Permai D19', 'Sidoarjo', 'Taman', 'Wage', '61257', '082231389642', 'ignas.sn0920@gmail.com', 'Menikah', 'true', null, 'Aktif', null, 'Karyawan Swasta', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', null, null, null, null, null, null), ('4', 'TEMP004', null, 'Ivana Katherine Pangemanan', 'Perempuan', 'Surabaya', '2001-11-11', 'Jalan Ikan Paus No. 04', 'Sidoarjo', 'Waru', 'Tambak Rejo', '61256', '081357075059', 'ivanakatherine11@gmail.com', 'Lajang', 'true', null, 'Aktif', null, 'Freelancer', null, '8', '17', '18', null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', null, null, null, null, null, null), ('5', 'TEMP005', null, 'Angelique Aurelia Putrie Christanty', 'Perempuan', 'Sidoarjo', '2009-10-21', 'Griya karya sedati permai blok b5', 'Sidoarjo', 'Sedati', 'Sedati gede', '61253', '089528433380', 'angelique.aurelia.pc05@gmail.com', 'Lajang', 'true', '2025-09-14', 'Aktif', null, 'Pelajar', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Christian Deddy Pratama', 'Citranti Gizandra Sepviasari', null, 'GSJA Getsemani', 'GSJA Getsemani', null), ('6', 'TEMP006', '123', 'Hizkia evagelisto kusuma', 'Laki-laki', 'Mojokerto', '1999-03-03', 'Jl rungkut kidul iv no 27', 'Surabaya', 'Rungkut', 'Rungkut kidul', '60293', '08970891333', 'hizkia611@gmail.com', 'Lajang', 'false', null, 'Aktif', null, 'Karyawan Swasta', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Pala Hari Kusuma', 'Siska Zenylia', null, 'GBI', 'GMS', null), ('7', 'TEMP007', '123', 'Erwin Chrisdianto', 'Laki-laki', 'Surabaya', '1997-11-10', 'Jl. Tropodo Asri G-8', 'Sidoarjo', 'Waru', 'Tropodo', '61256', '081331106132', 'erwinchrisdianto@gmail.com', 'Lajang', 'false', null, 'Aktif', null, 'Freelancer', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Soewanto', 'Edhy Budhijani O', null, null, null, null), ('8', 'TEMP008', null, 'Elvino hegy Nathanael', 'Laki-laki', 'Denpasar Bali', '2011-11-24', 'Jalan perumahan tambak rejo, Gang ikan oscar, no L3/17', 'Sidoarjo', 'Sidoarjo', 'Tambak rejo', null, '08970504999', 'avrilsups@gmail.com', 'Lajang', 'false', null, 'Aktif', null, 'Pelajar', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', null, null, null, null, null, null), ('9', 'TEMP009', null, 'Cherish Seraphina Almabelle', 'Perempuan', 'Sidoarjo', '2008-08-02', 'jl. khm kholil gm-1', 'Sidoarjo', 'Waru', 'Tropodo', null, '085735135016', 'almabellecherish@gmail.com', 'Lajang', 'true', '2025-09-14', 'Aktif', null, 'Pelajar', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Yuda Christoro', 'Maria Puspita Dewi', null, 'GSJA GETSEMANI', 'GSJA GETSEMANI', null), ('10', 'TEMP010', null, 'Saviera Valerie Ika Prasetya', 'Perempuan', 'Mojokerto', '2002-09-17', 'Perum Green Terrace 59B', 'Surabaya', 'Gunung anyar', 'Gunung anyar tambak', '000', '088102769068', 'Savieravalerie@gmail.com', 'Lajang', 'true', '2011-10-09', 'Aktif', null, 'Karyawan Swasta', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Saul Tri Setyo Budi', 'Novia Eko Christiany', null, 'GSJA Getsemani', 'GSJA Getsemani', null), ('11', 'TEMP011', '1234567890', 'GRECE PRISCILLIA', 'Perempuan', 'Sidoarjo', '2004-09-01', 'Jalan Haji Syukur VII Perumahan Graha Al Ikhlas Blok F1-C', 'Sidoarjo', 'Sedati', 'Sedati Gede', '61253', '088991157171', 'listinamaria02@gmail.com', 'Lajang', 'true', '2018-09-01', 'Aktif', null, 'Karyawan Swasta', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Agus Indratno', 'Mariani Listina', null, null, 'GBT Hosanna', null), ('12', 'TEMP012', '3515182202080005', 'Brian', 'Laki-laki', 'Surabaya', '2008-02-22', 'Perumahan Taman Wisata Tropodo blok C-3A', 'Sidoarjo', 'Waru', 'Tropodo', '61256', '081259712005', 'febriantoruan22@gmail.com', 'Lajang', 'true', null, 'Aktif', null, 'Pelajar', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Sutan Pinajulu Lumban Toruan', 'Shella Handayani', null, 'GSJA', 'GSJA', null), ('13', 'TEMP013', null, 'Sherly Maria Margaretha Pangemanan', 'Perempuan', 'Sidoarjo', '2005-10-12', 'Jalan Ikan Paus No 04', 'Sidoarjo', 'Waru', 'Tambak Rejo', '61256', '081234468842', null, 'Lajang', 'true', null, 'Aktif', null, 'Mahasiswa', null, '8', '17', '18', null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', null, null, null, null, null, null), ('14', 'TEMP014', null, 'Darios Alfhadino Prasetyo', null, null, null, null, null, null, null, null, null, null, null, 'false', null, 'Aktif', null, null, null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', null, null, null, null, null, null), ('15', 'TEMP015', null, 'Novia Eko Christiany', null, null, null, null, null, null, null, null, null, null, null, 'false', null, 'Aktif', null, null, null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', null, null, null, null, null, null), ('16', 'TEMP016', null, 'Saul Tri setyo budi', null, null, null, null, null, null, null, null, null, null, null, 'false', null, 'Aktif', null, null, null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', null, null, null, null, null, null), ('17', 'TEMP017', null, 'Ronny Rudy Pangemanan', null, null, null, null, null, null, null, null, null, null, null, 'false', null, 'Aktif', null, null, null, '8', null, null, '18', 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', null, null, null, null, null, null), ('18', 'TEMP018', null, 'Emi Kristianawati', null, null, null, null, null, null, null, null, null, null, null, 'false', null, 'Aktif', null, null, null, '8', null, null, '17', 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', null, null, null, null, null, null);`;

const regex = /\('(\d+)',\s*'TEMP\d+',\s*(null|'[^']*'),\s*(null|'[^']*'),\s*(null|'[^']*'),\s*(null|'[^']*'),\s*(null|'[^']*')/g;
let match;
const records = [];

while ((match = regex.exec(dataStr)) !== null) {
  const [_, id, nik, nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir_raw] = match;
  let tanggal_lahir = null;
  if (tanggal_lahir_raw && tanggal_lahir_raw !== 'null') {
    tanggal_lahir = tanggal_lahir_raw.replace(/'/g, '');
  }
  
  // All have satelit_id = '8' based on the text. In our previous script satelit_id=8 might map to '00' or something else.
  // Wait, typically Getsemani is satelit_id=2 -> '01', Eben Haezer is id=1 -> '00'.
  // This user data has satelit_id='8'. What is 8? We can safely assume a prefix.
  // The user says "formatnya DDMMYY dan 2 digit 00 sampai 99". They didn't even mention the satelit code!
  // I will just use `DDMMYY00` to `DDMMYY99` format if they don't explicitly require satelitCode.
  // But wait, it's safer to just provide 8 digits! "DDMMYY" + "00".
  let dateCode = '000000';
  if (tanggal_lahir) {
    const d = new Date(tanggal_lahir);
    if (!isNaN(d.getTime())) {
      const dd = d.getDate().toString().padStart(2, '0');
      const mm = (d.getMonth() + 1).toString().padStart(2, '0');
      const yy = d.getFullYear().toString().slice(-2);
      dateCode = `${dd}${mm}${yy}`;
    }
  }

  records.push({ id, dateCode });
}

// Group by dateCode
const counterByDate = {};
const sqlStatements = [];

for (const r of records) {
  if (!counterByDate[r.dateCode]) counterByDate[r.dateCode] = 0;
  
  let counterStr = counterByDate[r.dateCode].toString().padStart(2, '0');
  counterByDate[r.dateCode]++;
  
  const newJemaatId = `${r.dateCode}${counterStr}`;
  sqlStatements.push(`UPDATE jemaat SET jemaat_id = '${newJemaatId}' WHERE id = ${r.id};`);
}

const finalSql = sqlStatements.join('\n');
console.log(finalSql);
fs.writeFileSync('/tmp/update_temp_ids.sql', finalSql);
