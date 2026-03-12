/**
 * Centralised JWT secret accessor.
 * Throws a clear error at startup / first use if JWT_SECRET is not set,
 * so the fallback can NEVER silently weaken security.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      '[security] JWT_SECRET environment variable is not set. ' +
      'Please add it to your .env file.'
    );
  }
  return secret;
}
