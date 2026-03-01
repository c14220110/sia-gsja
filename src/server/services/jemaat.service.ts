import { JemaatRepository, JemaatFilterParams, JemaatData } from '@/server/repositories/jemaat.repository';

const jemaatRepository = new JemaatRepository();

export async function getJemaatPaginationService(params: JemaatFilterParams): Promise<{ data: JemaatData[], total: number, jemaat_baru: number }> {
  // Business logic here. For example: validating that the user has permission to see certain satelits.
  // We skip complex RBAC checking here for simplicity and just delegate to repository filters.
  return await jemaatRepository.getJemaatPagination(params);
}

export async function createJemaatService(data: any): Promise<number> {
  // Add backend validations here if necessary.
  if (!data.nama_lengkap) {
    throw new Error('Nama Lengkap is required');
  }
  return await jemaatRepository.createJemaat(data);
}
