import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getKpi1, getKpi3, getKpi8, getKpi9 } from './src/server/utils/bscQueries';

async function run() {
  const dari = '2026-05-01';
  const sampai = '2026-05-31';
  const satelitId = 1;

  try {
    await getKpi1(dari, sampai, satelitId);
    console.log('KPI-1 OK');
  } catch (e: any) {
    console.log('KPI-1 FAILED:', e.message);
  }

  try {
    await getKpi3(dari, sampai, satelitId);
    console.log('KPI-3 OK');
  } catch (e: any) {
    console.log('KPI-3 FAILED:', e.message);
  }

  try {
    await getKpi8(dari, sampai, satelitId);
    console.log('KPI-8 OK');
  } catch (e: any) {
    console.log('KPI-8 FAILED:', e.message);
  }

  try {
    await getKpi9(dari, sampai, satelitId);
    console.log('KPI-9 OK');
  } catch (e: any) {
    console.log('KPI-9 FAILED:', e.message);
  }

  process.exit(0);
}
run();
