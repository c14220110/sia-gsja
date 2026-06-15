import {
  getKpi1, getKpi2, getKpi3, getKpi4, getKpi5, getKpi6,
  getKpi7, getKpi8, getKpi9, getKpi10, getKpi11, getKpi12
} from './src/server/utils/bscQueries';

async function run() {
  const dari = '2026-05-01';
  const sampai = '2026-05-31';
  const satelitId = null;

  const kpis = [getKpi1, getKpi2, getKpi3, getKpi4, getKpi5, getKpi6, getKpi7, getKpi8, getKpi9, getKpi10, getKpi11, getKpi12];
  
  for (let i = 0; i < kpis.length; i++) {
    try {
      const res = await kpis[i](dari, sampai, satelitId);
      console.log(`KPI-${i+1}: Nilai=${res.nilai} (Target: ${res.target}) | Num/Denom=${res.numerator}/${res.denominator} | AdaData=${res.data_tersedia}`);
    } catch (e: any) {
      console.log(`KPI-${i+1} FAILED:`, e.message);
    }
  }
  process.exit(0);
}
run();
