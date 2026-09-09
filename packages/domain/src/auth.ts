export type AuthClaims = { subject: string; email?: string; roles: Array<'customer' | 'mechanic' | 'admin'>; issuer: string; audience: string; expiresAt: number };
export type AuthProvider = { verify(request: { authorization?: string; cookie?: string }): Promise<AuthClaims | null> };

/** Provider-neutral boundary. Production must supply a managed OIDC/JWT verifier. */
export function createAuthProvider(): AuthProvider {
  if (process.env.AUTH_MODE !== 'managed') return { async verify() { return null; } };
  throw new Error('AUTH_MODE=managed requires an approved OIDC/JWT provider adapter and JWKS configuration.');
}
