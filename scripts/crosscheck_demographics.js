// crosscheck_fields.js
const jemaatInsertStr = "('1', '15078100', '7878', 'Saarce', 'Perempuan', 'Thyhjh', '1981-07-15', 'Fhgnvv', 'Fhvg', 'Fjgn', 'Fkhh', '687', '485846', 'Hahaja', 'Menikah', 'true', null, 'Aktif', null, 'Fjgjj', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Fhejdj', 'Sjdjdjd', 'Dhrhrh', 'Hsjeje', 'Hahwjw', 'Gjkj'), ('2', '12027800', 'ass', 'Andika', 'Laki-laki', '111', '1978-02-12', 'qqqw', 'Sidoarjo', 'assa', 'asaa', 'aa s', '1212', 'asas', 'Lajang', 'true', null, 'Aktif', null, '11222', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', '121', 'adas', 'adas', 'adas', 'dd', 'adas'), ('3', '10117100', null, 'Ignatius N', 'Laki-laki', 'Banjarmasin', '1971-11-10', 'Wage Permai D19', 'Sidoarjo', 'Taman', 'Wage', '61257', '082231389642', 'ignas.sn0920@gmail.com', 'Menikah', 'true', null, 'Aktif', null, 'Karyawan Swasta', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Sami''an', '(Meninggal)', 'Elisabeth Aguslim', '-', '', 'Gsja'), ('4', '11110100', null, 'Ivana Katherine Pangemanan', 'Perempuan', 'Surabaya', '2001-11-11', 'Jalan Ikan Paus No. 04', 'Sidoarjo', 'Waru', 'Tambak Rejo', '61256', '081357075059', 'ivanakatherine11@gmail.com', 'Lajang', 'true', null, 'Aktif', null, 'Freelancer', null, '8', '17', '18', null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', null, null, null, null, null, null), ('5', '21100900', null, 'Angelique Aurelia Putrie Christanty', 'Perempuan', 'Sidoarjo', '2009-10-21', 'Griya karya sedati permai blok b5', 'Sidoarjo', 'Sedati', 'Sedati gede', '61253', '089528433380', 'angelique.aurelia.pc05@gmail.com', 'Lajang', 'true', '2025-09-14', 'Aktif', null, 'Pelajar', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Christian Deddy Pratama', 'Citranti Gizandra Sepviasari', null, 'GSJA Getsemani', 'GSJA Getsemani', null), ('6', '03039900', '123', 'Hizkia evagelisto kusuma', 'Laki-laki', 'Mojokerto', '1999-03-03', 'Jl rungkut kidul iv no 27', 'Surabaya', 'Rungkut', 'Rungkut kidul', '60293', '08970891333', 'hizkia611@gmail.com', 'Lajang', 'false', null, 'Aktif', null, 'Karyawan Swasta', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Pala Hari Kusuma', 'Siska Zenylia', null, 'GBI', 'GMS', null), ('7', '10119700', '123', 'Erwin Chrisdianto', 'Laki-laki', 'Surabaya', '1997-11-10', 'Jl. Tropodo Asri G-8', 'Sidoarjo', 'Waru', 'Tropodo', '61256', '081331106132', 'erwinchrisdianto@gmail.com', 'Lajang', 'false', null, 'Aktif', null, 'Freelancer', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Soewanto', 'Edhy Budhijani O', null, null, null, null), ('8', '24111100', null, 'Elvino hegy Nathanael', 'Laki-laki', 'Denpasar Bali', '2011-11-24', 'Jalan perumahan tambak rejo, Gang ikan oscar, no L3/17', 'Sidoarjo', 'Sidoarjo', 'Tambak rejo', null, '08970504999', 'avrilsups@gmail.com', 'Lajang', 'false', null, 'Aktif', null, 'Pelajar', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', null, null, null, null, null, null), ('9', '02080800', null, 'Cherish Seraphina Almabelle', 'Perempuan', 'Sidoarjo', '2008-08-02', 'jl. khm kholil gm-1', 'Sidoarjo', 'Waru', 'Tropodo', null, '085735135016', 'almabellecherish@gmail.com', 'Lajang', 'true', '2025-09-14', 'Aktif', null, 'Pelajar', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Yuda Christoro', 'Maria Puspita Dewi', null, 'GSJA GETSEMANI', 'GSJA GETSEMANI', null), ('10', '17090200', null, 'Saviera Valerie Ika Prasetya', 'Perempuan', 'Mojokerto', '2002-09-17', 'Perum Green Terrace 59B', 'Surabaya', 'Gunung anyar', 'Gunung anyar tambak', '000', '088102769068', 'Savieravalerie@gmail.com', 'Lajang', 'true', '2011-10-09', 'Aktif', null, 'Karyawan Swasta', null, '8', '16', '15', null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Saul Tri setyo budi', 'Novia Eko Christiany', '000', 'GSJA Getsemani', 'GSJA Getsemani', '0000'), ('11', '01090400', '1234567890', 'GRECE PRISCILLIA', 'Perempuan', 'Sidoarjo', '2004-09-01', 'Jalan Haji Syukur VII Perumahan Graha Al Ikhlas Blok F1-C', 'Sidoarjo', 'Sedati', 'Sedati Gede', '61253', '088991157171', 'listinamaria02@gmail.com', 'Lajang', 'true', '2018-09-01', 'Aktif', null, 'Karyawan Swasta', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Agus Indratno', 'Mariani Listina', null, null, 'GBT Hosanna', null), ('12', '22020800', '3515182202080005', 'Brian', 'Laki-laki', 'Surabaya', '2008-02-22', 'Perumahan Taman Wisata Tropodo blok C-3A', 'Sidoarjo', 'Waru', 'Tropodo', '61256', '081259712005', 'febriantoruan22@gmail.com', 'Lajang', 'true', null, 'Aktif', null, 'Pelajar', null, '8', null, null, null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Sutan Pinajulu Lumban Toruan', 'Shella Handayani', null, 'GSJA', 'GSJA', null), ('13', '12100500', null, 'Sherly Maria Margaretha Pangemanan', 'Perempuan', 'Sidoarjo', '2005-10-12', 'Jalan Ikan Paus No 04', 'Sidoarjo', 'Waru', 'Tambak Rejo', '61256', '081234468842', null, 'Lajang', 'true', null, 'Aktif', null, 'Mahasiswa', null, '8', '17', '18', null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', null, null, null, null, null, null), ('14', '00000000', null, 'Darios Alfhadino Prasetyo', null, null, null, null, null, null, null, null, null, null, null, 'false', null, 'Aktif', null, null, null, '8', '16', '15', null, 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Saul Tri setyo budi', 'Novia Eko Christiany', '0000', null, null, '00000'), ('15', '00000001', null, 'Novia Eko Christiany', null, null, null, null, null, null, null, null, null, null, null, 'false', null, 'Aktif', null, null, null, '8', null, null, '16', 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Andri Poerjanto', 'Sulistyowati', 'Saul Tri setyo budi', 'Gereja katholik Salib suci', 'Gereja katholik salib suci', null), ('16', '00000002', null, 'Saul Tri setyo budi', null, null, null, null, null, null, null, null, null, null, null, 'false', null, 'Aktif', null, null, null, '8', null, null, '15', 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Seger Imam Soebagiyo', 'Supatmi', 'Novia Eko Christiany', 'GBI Kediri', 'GBI Kediri', null), ('17', '00000003', null, 'Ronny Rudy Pangemanan', null, null, null, null, null, null, null, null, null, null, null, 'false', null, 'Aktif', null, null, null, '8', null, null, '18', 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', null, null, null, null, null, null), ('18', '00000004', null, 'Emi Kristianawati', null, null, null, null, null, null, null, null, null, null, null, 'false', null, 'Aktif', null, null, null, '8', null, null, '17', 'false', '2026-03-13 02:30:03.450069', '2026-03-13 02:30:03.450069', 'Soekarno', 'Sukariyah', null, null, null, null), ('19', 'superadmin', null, 'prince', null, null, null, null, null, null, null, null, null, null, null, 'false', null, 'Aktif', null, null, null, '1', null, null, null, 'false', '2026-03-13 03:20:41.110348', '2026-03-13 03:20:41.110348', null, null, null, null, null, null)";

const csvLines = [
  '3/7/2026 21:16:54,Saarce,7878,Perempuan,Thyhjh,7/15/1981,Fjgjj,Fhgnvv,Fjgn,Fkhh,Fhvg,687,485846,Hahaja,Sudah Baptis,97998,Sudah Menikah,Aktif,698,Fhejdj,Hsjeje,Wuejje,Sjdjdjd,Hahwjw,6877,Dhrhrh,,,Getsemani,,,,Gjkj,,,,2 Anak,84884,Dhdjfj,Dhdjdj,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,999,Hddjdj,Hddjjf,0485748,049484,Hedkkjf,Bddjfj,0048484,,,,,,,,,,,,,,,,,,,,,,,,,,',
  '3/7/2026 23:44:07,Andika,ass,Laki-laki,111,2/12/1978,11222,qqqw,assa,asaa,Sidoarjo,aa s,1212,asas,Sudah Baptis,,Belum Menikah,Aktif,1121,121,adas,adas,adas,dd,ada,adas,ada,adas,Getsemani,,,,adas,as,,adas,1 Anak,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
  '3/8/2026 10:47:06,Ignatius N,,Laki-laki,Banjarmasin,11/10/1971,Karyawan Swasta,Wage Permai D19,Taman,Wage,Sidoarjo,61257,082231389642,ignas.sn0920@gmail.com,Sudah Baptis,,Sudah Menikah,Aktif,,Sami\'an,,-, (Meninggal),,,Elisabeth Aguslim,,,Getsemani,,,,Gsja,,,,Tidak punya,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,AB3,,,,,,,,,,,,',
  '3/8/2026 10:47:09,Ivana Katherine Pangemanan ,,Perempuan,Surabaya,11/11/2001,Freelancer,Jalan Ikan Paus No. 04,Waru ,Tambak Rejo,Sidoarjo,61256,081357075059,ivanakatherine11@gmail.com,Sudah Baptis,,Belum Menikah,Aktif,,Ronny Rudy Pangemanan,GSJA GETSEMANI,,Emi Kristianawati ,GSJA GETSEMANI,,-,,,Getsemani,Komisi 11DG,,,,,,,Tidak punya,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,003/004,-,,,,,,,,,,,,',
  '3/8/2026 10:48:02,Angelique Aurelia Putrie Christanty ,-,Perempuan,Sidoarjo ,10/21/2009,Pelajar,Griya karya sedati permai blok b5 ,Sedati ,Sedati gede,Sidoarjo,61253,089528433380,angelique.aurelia.pc05@gmail.com,Sudah Baptis,9/14/2025,Belum Menikah,Aktif,-,Christian Deddy Pratama ,Gsja getsemani ,-,Citranti Gizandra Sepviasari,Gsja getsemani ,-,-,,,Getsemani,Komisi 11DG,,,-,,,,Tidak punya,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,RT 26 RW 12 ,SMKN 12 SURABAYA ,,,,,,,,,,,,',
  '3/8/2026 10:48:26,Hizkia evagelisto kusuma,123,Laki-laki,Mojokerto,3/3/1999,Karyawan Swasta,Jl rungkut kidul iv no 27,Rungkut,Rungkut kidul,Surabaya,60293,08970891333,hizkia611@gmail.com,Belum Baptis,,Belum Menikah,Aktif,,Pala hari kusuma,GBi,,Siska zenylia,Gms ,,-,,,Getsemani,Komisi 11DG,,,,,,,Tidak punya,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,001/001,-,,,,,,,,,,,,',
  '3/8/2026 10:48:54,Erwin Chrisdianto ,123,Laki-laki,Surabaya ,11/10/1997,Freelancer,Jl. Tropodo Asri G-8 ,Waru,Tropodo,Sidoarjo,61256,081331106132,erwinchrisdianto@gmail.com,Belum Baptis,,Belum Menikah,Aktif,,Soewanto,,,Edhy Budhijani O,,,-,,,Getsemani,Komisi 11DG,,,,,,,Tidak punya,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,94/11,-,,,,,,,,,,,,',
  '3/8/2026 10:51:54,Elvino hegy Nathanael,. ,Laki-laki,denpasar bali,11/24/2011,Pelajar,"Jalan perumahan tambak rejo, Gang ikan oscar, no L3/17",Sidoarjo,Tambak rejo,Sidoarjo,-,08970504999,avrilsups@gmail.com,Belum Baptis,,Belum Menikah,Aktif,;,:,-,-,-,-,-,-,,,Getsemani,Komisi 11DG,,,-,,,,Tidak punya,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,-,SMP DHARMA WANITA SURABAYA,,,,,,,,,,,,',
  '3/8/2026 10:54:38,Cherish Seraphina Almabelle ,-,Perempuan,Sidoarjo ,8/2/2008,Pelajar,jl. khm kholil gm-1,waru,tropodo ,Sidoarjo,-,085735135016,almabellecherish@gmail.com,Sudah Baptis,9/14/2025,Belum Menikah,Aktif,-,Yuda Christoro,GSJA GETSEMANI ,-,Maria Puspita Dewi ,GSJA GETSEMANI ,-,-,,,Getsemani,Komisi 11DG,Departemen IBADAH,,-,,,,Tidak punya,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,84/09,SMAN 1 WARU,,,,,,,,,,,,',
  '3/8/2026 13:22:34,Saviera Valerie Ika Prasetya,-,Perempuan,Mojokerto,9/17/2002,Karyawan Swasta,"Perum Green Terrace 59B ,Gunung anyar tambak, Gunung anyar,Surabaya.",Gunung anyar,Gunung anyar tambak,Surabaya,000,088102769068,Savieravalerie@gmail.com,Sudah Baptis,10/9/2011,Belum Menikah,Aktif,000,Saul Tri Setyo Budi,Gsja getsemani,0000,Novia Eko Christiany,Gsja getsemani,000,000,,,Getsemani,Komisi 11DG,Departemen MISI,,0000,,,,Tidak punya,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,-,Ud Merlin Tama,,,,,,,,,,,,',
  '3/8/2026 20:22:40,GRECE PRISCILLIA ,1234567890,Perempuan,SIDOARJO ,9/1/2004,Karyawan Swasta,"Jalan Haji Syukur VII Perumahan Graha Al Ikhlas Blok F1-C, Sedati",Sedati,Sedati Gede,Sidoarjo,61253,088991157171,listinamaria02@gmail.com,Sudah Baptis,9/1/2018,Belum Menikah,Aktif,-,Agus Indratno,-,,Mariani Listina,GBT Hosanna ,-,-,,,Getsemani,Komisi 11DG,,https://drive.google.com/open?id=164o0jGQmgWmAU3xI9C-yZ8kxbxiSbY8e,-,,,,Tidak punya,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,RT 32 / RW 13,-,,,,,,,,,,,,',
  '3/8/2026 21:39:47,Brian,3515182202080005,Laki-laki,Surabaya,2/22/2008,Pelajar,"Perumahan Taman Wisata Tropodo blok C-3A Waru, Sidoarjo",Waru,Tropodo,Sidoarjo,61256,081259712005,febriantoruan22@gmail.com,Sudah Baptis,,Belum Menikah,Aktif,,Sutan Pinajulu Lumban Toruan,GSJA,,Shella Handayani,GSJA,,Tidak ada,,,Getsemani,Komisi 11DG,,https://drive.google.com/open?id=17ByWjIW2Qcs__TjP3QEw8eweyrHad0z0,,,,,Tidak punya,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,107/0 12,Homeschooling Bintang Surabaya,,,,,,,,,,,,',
  '3/9/2026 9:41:42,Sherly Maria Margaretha Pangemanan,,Perempuan,Sidoarjo,10/12/2005,Mahasiswa,Jalan Ikan Paus No 04 Tambak Rejo Waru,Waru,Tambak Rejo,Sidoarjo,61256,081234468842,,Sudah Baptis,,Belum Menikah,Aktif,,Ronny Rudy Pangemanan,,,Emi Kristianawati,,,-,,,Getsemani,Komisi 11DG,,,,,,,Tidak punya,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,RT 3 RW 4,Universitas Dinamika,,,,,,,,,,,,',
  '3/12/2026 15:34:50,Darios Alfhadino Prasetyo,0000,Laki-laki,Sidoarjo,9/14/2009,Pelajar,Perum green terrace VII no 59B,Gunung anyar,Gunung anyar tambak,Surabaya,0000,087819351648,rioalfhadino@gmail.com,Sudah Baptis,9/14/2025,Belum Menikah,Aktif,000,Saul tri setyo budi,Gsja getsemani,000,Novia Eko Christiany,Gsja getsemani,0000,0000,,,Getsemani,Komisi 11DG,Jemaat,,00000,,,,Tidak punya,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,0000,SMK NEGERI 12 SURABAYA,,,,,,,,,,,,',
  '3/12/2026 15:43:42,Novia Eko Christiany,0000,Perempuan,Mojokerto,11/22/1978,Ibu Rumah Tangga,Perum green terrace VII no 59B,Gunung anyar,Gunung anyar tambak,Surabaya,000,0895351245475,Noviaeko22@gmail.com,Sudah Baptis,9/9/2001,Sudah Menikah,Aktif,0000,Andri Poerjanto,Gereja katholik Salib suci,000,Sulistyowati,Gereja katholik salib suci,000,Saul tri setyo budi,,,Getsemani,Komisi KW,Jemaat,,Gsja getsemani,,,,2 Anak,0000,Saviera Valerie Ika Prasetya,Gsja getsemani,087819351648,000,,,,,,,,Darios Alfhadino Prasetyo,0881027969068,Gsja getsemani,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,0000,000,,,,,,,,,,,,',
  '3/12/2026 15:51:41,Saul Tri setyo budi,0000,Laki-laki,Surabaya,9/19/1975,Karyawan Swasta,Perum green terrace VII no 59b,Gunung anyar,Gunung anyar tambak,Surabaya,000,08970865100,Trisetyobudi302@gmail.com,Sudah Baptis,7/17/1988,Sudah Menikah,Aktif,000,Seger imam soebagiyo,GBI Kediri,000,Supatmi,Gbi kediri,000,Novia Eko christiany,,,Getsemani,Komisi KP,Jemaat,,Gsja getsemani,,,,2 Anak,0000,Saviera Valerie Ika Prasetya,Gsja getsemani,087819351648,000,,,,,,,,Darios alfhadino Prasetyo,0881027969068,Gsja getsemani,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,000,Pt profilia indotech,,,,,,,,,,,,',
  '3/12/2026 15:59:00,Ronny Rudy Pangemanan ,,Laki-laki,Surabaya ,9/27/1974,Karyawan Swasta,Jalan Ikan Paus 04 ,Waru,TambakRejo ,Sidoarjo,61256,085101305509,,Sudah Baptis,,Sudah Menikah,Aktif,,-,,,-,,,Emi kristianawati ,,,Getsemani,,,,,,,,2 Anak,,Ivana Katherine Pangemanan ,GSJA GETSEMAN ,081234468842,,,,,,,,,Sherly Maria Margaretha Pangemanan,081357075059,GSJA GETSEMANI ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,-,,,,,,,,,,,,',
  '3/12/2026 16:02:27,Emi Kristianawati,,Perempuan,Surabaya,1/23/1973,Ibu Rumah Tangga,Jalan Ikan Paus No 04 Tambak Rejo Waru,Waru,Tambak Rejo,Sidoarjo,61256,085101993231,,Sudah Baptis,,Sudah Menikah,Aktif,,Soekarno,,,Sukariyah,,,Ronny Rudy Pangemanan,,,Getsemani,Komisi KW,,,,,,,2 Anak,,Ivana Katherine Pangemanan,,,,,,,,,,,Sherly Maria Margaretha Pangemanan,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,RT 3 RW 4,-,,,,,,,,,,,,',
];

// Helper to sanitize SQL string
const sanitize = (str) => str ? str.replace(/'/g, "''") : null;
const parseDate = (d) => {
    if (!d || d === '-' || d.length < 3) return null;
    const parts = d.split('/');
    if (parts.length === 3) {
        return parts[2] + "-" + parts[0].padStart(2, '0') + "-" + parts[1].padStart(2, '0');
    }
    return null;
};

// Parse current DB
const jemaatLines = jemaatInsertStr.split("), (");
const jemaatFullData = {};

const jemaatDB = jemaatLines.map(l => {
  const parts = l.split(", ");
  const id = parts[0].replace(/\\D/g, '');
  const nama = parts[3].replace(/'/g, '');
  return { id, nama };
});

const getJemaatId = (nama) => {
  if (!nama) return null;
  const n = nama.trim().toLowerCase();
  const found = jemaatDB.find(j => n.includes(j.nama.toLowerCase()) || j.nama.toLowerCase().includes(n));
  return found ? found.id : null;
};

jemaatLines.forEach(l => {
  const parts = l.split(", ");
  if (parts.length >= 21) {
    const id = parts[0].replace(/\\D/g, '');
    jemaatFullData[id] = { 
       nik: parts[2] === 'null' ? null : parts[2].replace(/'/g, ''),
       jenis_kelamin: parts[4] === 'null' ? null : parts[4].replace(/'/g, ''),
       tempat_lahir: parts[5] === 'null' ? null : parts[5].replace(/'/g, ''),
       tanggal_lahir: parts[6] === 'null' ? null : parts[6].replace(/'/g, ''),
       alamat: parts[7] === 'null' ? null : parts[7].replace(/'/g, ''),
       kota: parts[8] === 'null' ? null : parts[8].replace(/'/g, ''),
       kecamatan: parts[9] === 'null' ? null : parts[9].replace(/'/g, ''),
       kelurahan: parts[10] === 'null' ? null : parts[10].replace(/'/g, ''),
       kode_pos: parts[11] === 'null' ? null : parts[11].replace(/'/g, ''),
       no_hp: parts[12] === 'null' ? null : parts[12].replace(/'/g, ''),
       email: parts[13] === 'null' ? null : parts[13].replace(/'/g, ''),
       status_pernikahan: parts[14] === 'null' ? null : parts[14].replace(/'/g, ''),
       status_baptis: parts[15] === 'null' ? null : parts[15].replace(/'/g, ''),
       tanggal_baptis: parts[16] === 'null' ? null : parts[16].replace(/'/g, ''),
       pekerjaan: parts[19] === 'null' ? null : parts[19].replace(/'/g, '')
    };
  }
});

const sqlQueries = [];

csvLines.forEach((line) => {
  const parts = [];
  let inQuote = false;
  let curr = "";
  for(let i=0; i<line.length; i++) {
     if(line[i] === '"') inQuote = !inQuote;
     else if(line[i] === ',' && !inQuote) {
         parts.push(curr);
         curr = "";
     } else {
         curr += line[i];
     }
  }
  parts.push(curr);

  const jName = parts[1] ? parts[1].trim() : "";
  const jemaatId = getJemaatId(jName);
  const row = jemaatFullData[jemaatId];
  if (!row) return;

  // Expected fields from CSV mapped to DB columns
  const expected = {
      nik: parts[2] ? parts[2].trim() : null,
      jenis_kelamin: parts[3] ? parts[3].trim() : null,
      tempat_lahir: parts[4] ? parts[4].trim() : null,
      tanggal_lahir: parseDate(parts[5] ? parts[5].trim() : null),
      pekerjaan: parts[6] ? parts[6].trim() : null,
      alamat: parts[7] ? parts[7].trim() : null,
      kecamatan: parts[8] ? parts[8].trim() : null,
      kelurahan: parts[9] ? parts[9].trim() : null,
      kota: parts[10] ? parts[10].trim() : null,
      kode_pos: parts[11] ? parts[11].trim() : null,
      no_hp: parts[12] ? parts[12].trim() : null,
      email: parts[13] ? parts[13].trim() : null,
      tanggal_baptis: parseDate(parts[15] ? parts[15].trim() : null)
  };
  
  if (parts[14]) {
      expected.status_baptis = parts[14].includes('Sudah') ? 'true' : 'false';
  }
  if (parts[16]) {
      expected.status_pernikahan = parts[16].includes('Sudah Menikah') ? 'Menikah' : 'Lajang';
  }

  const updates = [];
  for (const [key, val] of Object.entries(expected)) {
      if (!val || val === '-' || val === ';' || val === ':') continue; // Empty or invalid marker in CSV
      
      const dbVal = row[key];
      // If db val is null, empty string, or literally the string 'null'
      if (!dbVal || dbVal === "null" || dbVal === "") {
          if (val === "true" || val === "false") {
              updates.push(key + " = " + val);
          } else {
              updates.push(key + " = '" + sanitize(val) + "'");
          }
      }
  }

  if (updates.length > 0) {
      sqlQueries.push("-- Fix missing data for " + jName);
      sqlQueries.push("UPDATE jemaat SET " + updates.join(", ") + " WHERE id = '" + jemaatId + "';");
  }
});

console.log("-- AUTO-GENERATED SQL FIXES FOR MISSING DEMOGRAPHICS --");
sqlQueries.forEach(q => console.log(q));
