import type { CallerInfo } from '@/server/utils/getCallerFromRequest';
import { PresensiRepository, type PegawaiPresensiProfile } from '@/server/repositories/presensi.repository';

export async function resolvePegawaiForCaller(
  repo: PresensiRepository,
  caller: CallerInfo,
  overridePegawaiId?: number | null
): Promise<PegawaiPresensiProfile | null> {
  if (overridePegawaiId && caller.is_super_admin) {
    return repo.findPegawaiById(overridePegawaiId);
  }
  return repo.findPegawaiByUser(caller.user_id, caller.jemaat_id);
}
