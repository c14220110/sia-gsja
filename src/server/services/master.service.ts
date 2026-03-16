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

export async function searchJemaatOptions(query: string): Promise<any[]> {
  if (!query) return [];
  return await masterRepository.searchJemaat(query);
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
