# AUTH SYSTEM AUDIT REPORT

This report investigates the core authentication mechanisms, given the absence of a global `src/middleware.ts` file.

## 1. Protected vs Public Routes
Since the project does not use a global Next.js `middleware.ts` to block requests, route protection is entirely handled at the individual route level. A route is **Protected** if it explicitly invokes `getCallerFromRequest(request)`. A route is implicitly **Public** if it skips this check and executes its logic straight away.
Intentionally Public Routes (Login, Password Reset):
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/forgot-password/route.ts`
- `src/app/api/auth/reset-password/route.ts`

## 2. JWT Validation Mechanism
The JWT token is validated primarily within `src/server/utils/getCallerFromRequest.ts`.
1. **Extraction**: It attempts to parse the `cookie` header looking for the `access_token` cookie string.
2. **Verification**: It calls `jwt.verify(token, getJwtSecret())`. If the token is expired or tampered with, this throws an exception, which is caught, causing the function to return `null`.
3. **Payload Extraction**: If valid, it returns the `CallerInfo` object containing `user_id`, `role_id`, `satelit_id`, `permissions`, etc.
If `getCallerFromRequest` returns `null`, the route handlers return a `401 Unauthorized` response.

## 3. Accidental Public Routes (Vulnerability)
Because there is no global middleware enforcing a baseline of authentication for the `/api` directory, any developer who forgets to add `getCallerFromRequest` accidentally creates a completely unauthenticated, public endpoint. Based on our earlier structural audit, the following routes are **publicly accessible** but likely shouldn't be:
- `src/app/api/settings/payroll-global/[id]/route.ts`
- `src/app/api/settings/payroll-templates/[id]/route.ts`
- `src/app/api/settings/payroll-components/[id]/route.ts`
- `src/app/api/kegiatan/[id]/lpj/route.ts`
- `src/app/api/kegiatan/[id]/lpj/timeline/route.ts`
- `src/app/api/kegiatan/[id]/lpj/review/route.ts`
- `src/app/api/kegiatan/[id]/pelayan/route.ts`
- `src/app/api/push/subscribe/route.ts`
- `src/app/api/pegawai/[id]/route.ts`
- `src/app/api/family-tree/[id]/route.ts`
- `src/app/api/pelayan/route.ts`
- `src/app/api/pelayan/[id]/route.ts`
- `src/app/api/pengurus/route.ts`
- `src/app/api/pengurus/[id]/route.ts`
- `src/app/api/pengurus/[id]/jabatan/route.ts`
- `src/app/api/pengurus/[id]/jabatan/[detail_id]/route.ts`
- `src/app/api/payroll/runs/[id]/komponen/route.ts`
- `src/app/api/payroll/runs/[id]/details/route.ts`
- `src/app/api/payroll/runs/[id]/summary/route.ts`
- `src/app/api/payroll/runs/[id]/submit/route.ts`
- `src/app/api/anggaran/tahunan/[id]/route.ts`
- `src/app/api/anggaran/tahunan/[id]/timeline/route.ts`
- `src/app/api/anggaran/tahunan/[id]/batalkan/route.ts`
- `src/app/api/anggaran/tahunan/[id]/review/route.ts`

## 4. JEMAAT Role Token Expiry
The 180-day expiry for the `JEMAAT` role **is handled differently and correctly** compared to admin tokens.
In `src/server/services/auth.service.ts` (both in `authenticateUser` and `generateFinalToken`), the code explicitly checks the role name:
```typescript
const isJemaat = singleRole.nama_role === 'JEMAAT';
const expiresInString = isJemaat ? '180d' : '1d';
const cookieMaxAge = isJemaat ? 60 * 60 * 24 * 180 : 60 * 60 * 24;
```
This securely extends the lifetime of the PWA mobile user's token (to 180 days) and cookie `maxAge`, while keeping admin tokens strictly limited to 1 day (`1d`).
