// Primitif kriptografi server. Pratinjau peramban memakai pengganti di src/pratinjau/kripto.ts.
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt) as (s: string, salt: Buffer, len: number, opt: crypto.ScryptOptions) => Promise<Buffer>;
const OPSI_SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashSandi(sandi: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const kunci = await scrypt(sandi.normalize('NFKC'), salt, 32, OPSI_SCRYPT);
  return `scrypt$${salt.toString('base64')}$${kunci.toString('base64')}`;
}

export async function cocokSandi(sandi: string, tersimpan: string): Promise<boolean> {
  const [algo, saltB64, kunciB64] = tersimpan.split('$');
  if (algo !== 'scrypt' || !saltB64 || !kunciB64) return false;
  const harap = Buffer.from(kunciB64, 'base64');
  const kunci = await scrypt(sandi.normalize('NFKC'), Buffer.from(saltB64, 'base64'), harap.length, OPSI_SCRYPT);
  return crypto.timingSafeEqual(kunci, harap);
}

/** Token sesi acak (dikirim ke peramban). */
export const tokenAcak = () => crypto.randomBytes(32).toString('base64url');

/** Token disimpan di basis data dalam bentuk hash. */
export const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

/** Bilangan bulat acak 0 ≤ n < batas. */
export const angkaAcak = (batas: number) => crypto.randomInt(batas);
