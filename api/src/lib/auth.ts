/**
 * Authentication utilities using Web Crypto API (Cloudflare Workers compatible).
 * No external packages — PBKDF2 for password hashing, HMAC-SHA256 for JWT.
 */

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeBuffer(buffer: ArrayBuffer): string {
  return arrayBufferToBase64(buffer).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 += '='.repeat(4 - pad);
  return atob(base64);
}

function base64UrlDecodeToBuffer(str: string): ArrayBuffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 += '='.repeat(4 - pad);
  return base64ToArrayBuffer(base64);
}

/** Hash password using PBKDF2 (Web Crypto). Returns "salt:hash" in base64. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const saltB64 = arrayBufferToBase64(salt.buffer);
  const hashB64 = arrayBufferToBase64(derivedBits);
  return `${saltB64}:${hashB64}`;
}

/** Verify password against a "salt:hash" stored string. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [saltB64, expectedHashB64] = hash.split(':');
  if (!saltB64 || !expectedHashB64) return false;

  const salt = base64ToArrayBuffer(saltB64);
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const derivedB64 = arrayBufferToBase64(derivedBits);
  return derivedB64 === expectedHashB64;
}

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

/** Create a JWT token (HS256) with 24h expiry. */
export async function createToken(
  payload: JwtPayload,
  secret: string
): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlEncode(
    JSON.stringify({ ...payload, iat: now, exp: now + 86400 })
  );
  const data = `${header}.${body}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return `${data}.${base64UrlEncodeBuffer(signature)}`;
}

/** Verify and decode a JWT token. Returns payload or null if invalid/expired. */
export async function verifyToken(
  token: string,
  secret: string
): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts;
    const data = `${header}.${body}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBuffer = base64UrlDecodeToBuffer(sig);
    const valid = await crypto.subtle.verify('HMAC', key, sigBuffer, encoder.encode(data));
    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecode(body)) as JwtPayload & { exp: number };
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return { userId: payload.userId, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}
