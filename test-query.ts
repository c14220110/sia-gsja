import { pelayanRepository } from './src/server/repositories/pelayan.repository';

async function main() {
  try {
    console.log('Fetching with date_from=2026-05 and date_to=2026-05...');
    const result = await pelayanRepository.getPelayanPagination({ date_from: '2026-05', date_to: '2026-05' });
    console.log('Success!');
    console.log('Data length:', result.data.length);
    if (result.data.length > 0) {
      console.log('First data jadwal_bulan_ini:', result.data[0].jadwal_bulan_ini);
    }
  } catch (e) {
    console.error('Error occurred:');
    console.error(e);
  }
}

main().then(() => process.exit(0));
