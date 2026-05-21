/**
 * Script untuk generate data Alkitab TB dari Beeble API
 * ke format static JSON files di /public/alkitab/
 * 
 * Usage: node scripts/generate-alkitab.mjs
 */

const fs = require('fs');
const path = require('path');

// Daftar lengkap 66 kitab Alkitab
const KITAB = [
  // Perjanjian Lama (39 kitab)
  { id: 'kej', code: 'GEN', nama: 'Kejadian', singkatan: 'Kej', pasal: 50, perjanjian: 'lama' },
  { id: 'kel', code: 'EXO', nama: 'Keluaran', singkatan: 'Kel', pasal: 40, perjanjian: 'lama' },
  { id: 'im', code: 'LEV', nama: 'Imamat', singkatan: 'Im', pasal: 27, perjanjian: 'lama' },
  { id: 'bil', code: 'NUM', nama: 'Bilangan', singkatan: 'Bil', pasal: 36, perjanjian: 'lama' },
  { id: 'ul', code: 'DEU', nama: 'Ulangan', singkatan: 'Ul', pasal: 34, perjanjian: 'lama' },
  { id: 'yos', code: 'JOS', nama: 'Yosua', singkatan: 'Yos', pasal: 24, perjanjian: 'lama' },
  { id: 'hak', code: 'JDG', nama: 'Hakim-hakim', singkatan: 'Hak', pasal: 21, perjanjian: 'lama' },
  { id: 'rut', code: 'RUT', nama: 'Rut', singkatan: 'Rut', pasal: 4, perjanjian: 'lama' },
  { id: '1sam', code: '1SA', nama: '1 Samuel', singkatan: '1Sam', pasal: 31, perjanjian: 'lama' },
  { id: '2sam', code: '2SA', nama: '2 Samuel', singkatan: '2Sam', pasal: 24, perjanjian: 'lama' },
  { id: '1raj', code: '1KI', nama: '1 Raja-raja', singkatan: '1Raj', pasal: 22, perjanjian: 'lama' },
  { id: '2raj', code: '2KI', nama: '2 Raja-raja', singkatan: '2Raj', pasal: 25, perjanjian: 'lama' },
  { id: '1taw', code: '1CH', nama: '1 Tawarikh', singkatan: '1Taw', pasal: 29, perjanjian: 'lama' },
  { id: '2taw', code: '2CH', nama: '2 Tawarikh', singkatan: '2Taw', pasal: 36, perjanjian: 'lama' },
  { id: 'ezr', code: 'EZR', nama: 'Ezra', singkatan: 'Ezr', pasal: 10, perjanjian: 'lama' },
  { id: 'neh', code: 'NEH', nama: 'Nehemia', singkatan: 'Neh', pasal: 13, perjanjian: 'lama' },
  { id: 'est', code: 'EST', nama: 'Ester', singkatan: 'Est', pasal: 10, perjanjian: 'lama' },
  { id: 'ayb', code: 'JOB', nama: 'Ayub', singkatan: 'Ayb', pasal: 42, perjanjian: 'lama' },
  { id: 'mzm', code: 'PSA', nama: 'Mazmur', singkatan: 'Mzm', pasal: 150, perjanjian: 'lama' },
  { id: 'ams', code: 'PRO', nama: 'Amsal', singkatan: 'Ams', pasal: 31, perjanjian: 'lama' },
  { id: 'pkh', code: 'ECC', nama: 'Pengkhotbah', singkatan: 'Pkh', pasal: 12, perjanjian: 'lama' },
  { id: 'kid', code: 'SNG', nama: 'Kidung Agung', singkatan: 'Kid', pasal: 8, perjanjian: 'lama' },
  { id: 'yes', code: 'ISA', nama: 'Yesaya', singkatan: 'Yes', pasal: 66, perjanjian: 'lama' },
  { id: 'yer', code: 'JER', nama: 'Yeremia', singkatan: 'Yer', pasal: 52, perjanjian: 'lama' },
  { id: 'rat', code: 'LAM', nama: 'Ratapan', singkatan: 'Rat', pasal: 5, perjanjian: 'lama' },
  { id: 'yeh', code: 'EZK', nama: 'Yehezkiel', singkatan: 'Yeh', pasal: 48, perjanjian: 'lama' },
  { id: 'dan', code: 'DAN', nama: 'Daniel', singkatan: 'Dan', pasal: 12, perjanjian: 'lama' },
  { id: 'hos', code: 'HOS', nama: 'Hosea', singkatan: 'Hos', pasal: 14, perjanjian: 'lama' },
  { id: 'yl', code: 'JOL', nama: 'Yoel', singkatan: 'Yl', pasal: 3, perjanjian: 'lama' },
  { id: 'am', code: 'AMO', nama: 'Amos', singkatan: 'Am', pasal: 9, perjanjian: 'lama' },
  { id: 'ob', code: 'OBA', nama: 'Obaja', singkatan: 'Ob', pasal: 1, perjanjian: 'lama' },
  { id: 'yun', code: 'JON', nama: 'Yunus', singkatan: 'Yun', pasal: 4, perjanjian: 'lama' },
  { id: 'mi', code: 'MIC', nama: 'Mikha', singkatan: 'Mi', pasal: 7, perjanjian: 'lama' },
  { id: 'nah', code: 'NAM', nama: 'Nahum', singkatan: 'Nah', pasal: 3, perjanjian: 'lama' },
  { id: 'hab', code: 'HAB', nama: 'Habakuk', singkatan: 'Hab', pasal: 3, perjanjian: 'lama' },
  { id: 'zef', code: 'ZEP', nama: 'Zefanya', singkatan: 'Zef', pasal: 3, perjanjian: 'lama' },
  { id: 'hag', code: 'HAG', nama: 'Hagai', singkatan: 'Hag', pasal: 2, perjanjian: 'lama' },
  { id: 'za', code: 'ZEC', nama: 'Zakharia', singkatan: 'Za', pasal: 14, perjanjian: 'lama' },
  { id: 'mal', code: 'MAL', nama: 'Maleakhi', singkatan: 'Mal', pasal: 4, perjanjian: 'lama' },
  // Perjanjian Baru (27 kitab)
  { id: 'mat', code: 'MAT', nama: 'Matius', singkatan: 'Mat', pasal: 28, perjanjian: 'baru' },
  { id: 'mrk', code: 'MRK', nama: 'Markus', singkatan: 'Mrk', pasal: 16, perjanjian: 'baru' },
  { id: 'luk', code: 'LUK', nama: 'Lukas', singkatan: 'Luk', pasal: 24, perjanjian: 'baru' },
  { id: 'yoh', code: 'JHN', nama: 'Yohanes', singkatan: 'Yoh', pasal: 21, perjanjian: 'baru' },
  { id: 'kis', code: 'ACT', nama: 'Kisah Para Rasul', singkatan: 'Kis', pasal: 28, perjanjian: 'baru' },
  { id: 'rom', code: 'ROM', nama: 'Roma', singkatan: 'Rom', pasal: 16, perjanjian: 'baru' },
  { id: '1kor', code: '1CO', nama: '1 Korintus', singkatan: '1Kor', pasal: 16, perjanjian: 'baru' },
  { id: '2kor', code: '2CO', nama: '2 Korintus', singkatan: '2Kor', pasal: 13, perjanjian: 'baru' },
  { id: 'gal', code: 'GAL', nama: 'Galatia', singkatan: 'Gal', pasal: 6, perjanjian: 'baru' },
  { id: 'ef', code: 'EPH', nama: 'Efesus', singkatan: 'Ef', pasal: 6, perjanjian: 'baru' },
  { id: 'flp', code: 'PHP', nama: 'Filipi', singkatan: 'Flp', pasal: 4, perjanjian: 'baru' },
  { id: 'kol', code: 'COL', nama: 'Kolose', singkatan: 'Kol', pasal: 4, perjanjian: 'baru' },
  { id: '1tes', code: '1TH', nama: '1 Tesalonika', singkatan: '1Tes', pasal: 5, perjanjian: 'baru' },
  { id: '2tes', code: '2TH', nama: '2 Tesalonika', singkatan: '2Tes', pasal: 3, perjanjian: 'baru' },
  { id: '1tim', code: '1TI', nama: '1 Timotius', singkatan: '1Tim', pasal: 6, perjanjian: 'baru' },
  { id: '2tim', code: '2TI', nama: '2 Timotius', singkatan: '2Tim', pasal: 4, perjanjian: 'baru' },
  { id: 'tit', code: 'TIT', nama: 'Titus', singkatan: 'Tit', pasal: 3, perjanjian: 'baru' },
  { id: 'flm', code: 'PHM', nama: 'Filemon', singkatan: 'Flm', pasal: 1, perjanjian: 'baru' },
  { id: 'ibr', code: 'HEB', nama: 'Ibrani', singkatan: 'Ibr', pasal: 13, perjanjian: 'baru' },
  { id: 'yak', code: 'JAS', nama: 'Yakobus', singkatan: 'Yak', pasal: 5, perjanjian: 'baru' },
  { id: '1ptr', code: '1PE', nama: '1 Petrus', singkatan: '1Ptr', pasal: 5, perjanjian: 'baru' },
  { id: '2ptr', code: '2PE', nama: '2 Petrus', singkatan: '2Ptr', pasal: 3, perjanjian: 'baru' },
  { id: '1yoh', code: '1JN', nama: '1 Yohanes', singkatan: '1Yoh', pasal: 5, perjanjian: 'baru' },
  { id: '2yoh', code: '2JN', nama: '2 Yohanes', singkatan: '2Yoh', pasal: 1, perjanjian: 'baru' },
  { id: '3yoh', code: '3JN', nama: '3 Yohanes', singkatan: '3Yoh', pasal: 1, perjanjian: 'baru' },
  { id: 'yud', code: 'JUD', nama: 'Yudas', singkatan: 'Yud', pasal: 1, perjanjian: 'baru' },
  { id: 'why', code: 'REV', nama: 'Wahyu', singkatan: 'Why', pasal: 22, perjanjian: 'baru' },
];

const BASE_URL = 'https://beeble.vercel.app/api/v1/passage';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'alkitab');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchChapter(bookCode, chapter) {
  const url = `${BASE_URL}/${bookCode}/${chapter}?ver=tb`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const json = await res.json();
  return json.data;
}

async function generateMeta() {
  const meta = {
    terjemahan: 'TB',
    versi: 'Terjemahan Baru',
    kitab: KITAB.map(k => ({
      id: k.id,
      nama: k.nama,
      singkatan: k.singkatan,
      pasal: k.pasal,
      perjanjian: k.perjanjian,
    })),
  };
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'meta.json'),
    JSON.stringify(meta, null, 0) // minified
  );
  console.log('✅ Generated meta.json');
}

async function generateBook(kitab) {
  const bookDir = path.join(OUTPUT_DIR, kitab.id);
  if (!fs.existsSync(bookDir)) {
    fs.mkdirSync(bookDir, { recursive: true });
  }
  
  for (let ch = 1; ch <= kitab.pasal; ch++) {
    const filePath = path.join(bookDir, `${ch}.json`);
    
    // Skip if already exists
    if (fs.existsSync(filePath)) {
      console.log(`  ⏭️  ${kitab.singkatan} ${ch} (already exists)`);
      continue;
    }
    
    try {
      const data = await fetchChapter(kitab.code, ch);
      
      const output = {
        kitab: kitab.id,
        nama_kitab: kitab.nama,
        singkatan: kitab.singkatan,
        pasal: ch,
        ayat: data.verses
          .filter(v => v.type === 'content' && v.verse > 0)
          .map(v => ({
            nomor: v.verse,
            teks: v.teks || v.content,
          })),
      };
      
      fs.writeFileSync(filePath, JSON.stringify(output, null, 0));
      console.log(`  ✅ ${kitab.singkatan} ${ch} (${output.ayat.length} ayat)`);
      
      // Rate limiting: 200ms delay between requests
      await sleep(200);
    } catch (err) {
      console.error(`  ❌ ${kitab.singkatan} ${ch}: ${err.message}`);
      // Retry once after 2s
      await sleep(2000);
      try {
        const data = await fetchChapter(kitab.code, ch);
        const output = {
          kitab: kitab.id,
          nama_kitab: kitab.nama,
          singkatan: kitab.singkatan,
          pasal: ch,
          ayat: data.verses
            .filter(v => v.type === 'content' && v.verse > 0)
            .map(v => ({
              nomor: v.verse,
              teks: v.teks || v.content,
            })),
        };
        fs.writeFileSync(filePath, JSON.stringify(output, null, 0));
        console.log(`  ✅ ${kitab.singkatan} ${ch} (retry ok)`);
      } catch (retryErr) {
        console.error(`  ❌❌ ${kitab.singkatan} ${ch}: FAILED after retry`);
      }
      await sleep(500);
    }
  }
}

async function main() {
  console.log('🕊️ Generating Alkitab TB data...\n');
  
  // 1. Generate meta.json
  await generateMeta();
  
  // 2. Generate all books
  const totalChapters = KITAB.reduce((sum, k) => sum + k.pasal, 0);
  console.log(`\n📖 Total: ${KITAB.length} kitab, ${totalChapters} pasal\n`);
  
  for (const kitab of KITAB) {
    console.log(`\n📕 ${kitab.nama} (${kitab.pasal} pasal)`);
    await generateBook(kitab);
  }
  
  console.log('\n🎉 Done! All Bible data generated.');
}

main().catch(console.error);
