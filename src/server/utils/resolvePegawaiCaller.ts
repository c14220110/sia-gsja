import type { CallerInfo } from '@/server/utils/getCallerFromRequest';
import { PresensiRepository, type PegawaiPresensiProfile } from '@/server/repositories/presensi.repository';

export async function resolvePegawaiForCaller(
  repo: PresensiRepository,
  caller: CallerInfo,
  _overridePegawaiId?: number | null
): Promise<PegawaiPresensiProfile | null> {
  return repo.findPegawaiByUser(caller.user_id, caller.jemaat_id);
}
