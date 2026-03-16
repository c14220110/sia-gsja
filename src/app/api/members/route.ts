import { NextRequest, NextResponse } from 'next/server';
import { getJemaatController, createJemaatController } from '@/server/controllers/jemaat.controller';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';

export async function GET(request: NextRequest) {
  return await getJemaatController(request);
}

export async function POST(request: NextRequest) {
  // Clone the request so we can read body twice (once for controller, once we get the ID back)
  const response = await createJemaatController(request);

  try {
    const body = await response.json();
    if (body?.success && body?.data?.id) {
      const caller = getCallerFromRequest(request);
      if (caller) {
        await auditLogRepository.insertAuditLog({
          jemaat_id:  body.data.id,
          aksi:       'CREATE',
          user_id:    caller.user_id,
          role_id:    caller.role_id,
          satelit_id: caller.satelit_id,
          keterangan: 'Data jemaat baru ditambahkan',
        });
      }
    }
    // Return same response body
    return NextResponse.json(body, { status: response.status });
  } catch {
    // If JSON parsing fails just return the original response unchanged
    return response;
  }
}
