import type { CallerInfo } from '@/server/utils/getCallerFromRequest';
import { PresensiRepository, type PegawaiPresensiProfile } from '@/server/repositories/presensi.repository';

export async function resolvePegawaiForCaller(
  repo: PresensiRepository,
  caller: CallerInfo,
  overridePegawaiId?: number | null
): Promise<PegawaiPresensiProfile | null> {
  const canPreviewAll =
    caller.is_super_admin ||
    caller.permissions.includes('presensi_monitoring_view') ||
    caller.permissions.includes('presensi_monitoring_manage');
  if (overridePegawaiId && canPreviewAll) {
    return repo.findPegawaiById(overridePegawaiId);
  }
  return repo.findPegawaiByUser(caller.user_id, caller.jemaat_id);
}
