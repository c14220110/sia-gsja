import { MasterRepository } from '../repositories/master.repository';

const masterRepository = new MasterRepository();

export async function getOptionsService(type: string, satelitId?: string, query?: string) {
  if (type === 'satelit') {
    return await masterRepository.getAllSatelit();
  } else if (type === 'komisi') {
    if (satelitId) {
      return await masterRepository.getKomisiBySatelit(parseInt(satelitId, 10));
    }
    return await masterRepository.getAllKomisi();
  } else if (type === 'jemaat_search') {
    if (!query) return [];
    // If you need onlyActive via getOptionsService, you would add another parameter, but the controller handles it separately.
    return await masterRepository.searchJemaat(query);
  } else if (type === 'departemen') {
    return await masterRepository.getAllDepartemen();
  } else if (type === 'pekerjaan') {
    return await masterRepository.getAllPekerjaan();
  }
  throw new Error('Invalid option type');
}

export async function getSatelitOptions(): Promise<any[]> {
  return await masterRepository.getAllSatelit();
}

export async function getKomisiOptions(satelitId?: string): Promise<any[]> {
  if (satelitId) {
    return await masterRepository.getKomisiBySatelit(parseInt(satelitId, 10));
  }
  return await masterRepository.getAllKomisi();
}

export async function searchJemaatOptions(query: string, onlyActive?: boolean): Promise<any[]> {
  if (!query) return [];
  return await masterRepository.searchJemaat(query, onlyActive);
}

export async function getDepartemenOptions(): Promise<any[]> {
  return await masterRepository.getAllDepartemen();
}

export async function getPekerjaanOptions(): Promise<any[]> {
  return await masterRepository.getAllPekerjaan();
}

export async function getRolePelayanOptions(): Promise<any[]> {
  return await masterRepository.getAllRolePelayan();
}

export async function getPeriodeKepengurusanOptions(): Promise<any[]> {
  return await masterRepository.getAllPeriodeKepengurusan();
}

export async function getJabatanOptions(): Promise<any[]> {
  return await masterRepository.getAllJabatan();
}
