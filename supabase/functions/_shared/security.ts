// Security helpers: hashing and Airbnb code validation

/**
 * Returns true if input looks like an Airbnb confirmation code we support,
 * i.e. starts with HM and followed by 8-10 uppercase alphanumerics.
 */
export function normalizeCode(input: string): string {
  return (input || '').trim().toUpperCase();
}

export function isAirbnbCode(input?: string | null): boolean {
  if (!input || typeof input !== 'string') return false;
  return /^HM[A-Z0-9]{8,12}$/.test(normalizeCode(input));
}

/**
 * Hash an access code using SHA-256 with a server-side pepper.
 * The pepper must be provided via env ACCESS_CODE_PEPPER. Never log or return the clear code.
 */
export async function hashAccessCode(code: string, pepper?: string): Promise<string> {
  const normalized = normalizeCode(code);
  if (!normalized) throw new Error('Empty access code');

  const effectivePepper = pepper ?? Deno.env.get('ACCESS_CODE_PEPPER');
  if (!effectivePepper) throw new Error('Missing ACCESS_CODE_PEPPER');

  const encoder = new TextEncoder();
  const data = encoder.encode(`${normalized}::${effectivePepper}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(digest));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}


