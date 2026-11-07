const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === 'string' ? encoder.encode(data) : new Uint8Array(data);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export const b64urlDecodeString = (s: string) => decoder.decode(b64urlDecode(s));

// Keys are derived from the secret strings with SHA-256 and cached per isolate.
const keys = new Map<string, Promise<CryptoKey>>();

function key(secret: string, purpose: 'aes' | 'hmac'): Promise<CryptoKey> {
  const id = `${purpose}:${secret}`;
  let k = keys.get(id);
  if (!k) {
    k = crypto.subtle.digest('SHA-256', encoder.encode(`${purpose}:${secret}`)).then((raw) =>
      purpose === 'aes'
        ? crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
        : crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    );
    keys.set(id, k);
  }
  return k;
}

export async function encrypt(secret: string, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret, 'aes'), encoder.encode(plaintext)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64url(out);
}

export async function decrypt(secret: string, token: string): Promise<string> {
  const data = b64urlDecode(token);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, await key(secret, 'aes'), data.slice(12));
  return decoder.decode(pt);
}

export async function hmac(secret: string, data: string): Promise<string> {
  return b64url(await crypto.subtle.sign('HMAC', await key(secret, 'hmac'), encoder.encode(data)));
}

/** SHA-256 as hex: how secrets that only need checking (subscribe links, AI app passes) are kept. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 32 random bytes as 43 URL-safe characters, for codes and passes. */
export const newSecret = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
