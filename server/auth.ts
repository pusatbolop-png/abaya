import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { DB } from './db';
import { config } from './config';
import { GalatPengguna } from './util';
import type { Peran } from '../shared/konstanta';

const scrypt = promisify(crypto.scrypt) as (s: string, salt: Buffer, len: number, opt: crypto.ScryptOptions) => Promise<Buffer>;
const OPSI_SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const NAMA_COOKIE = 'pcc_sesi';

export interface PenggunaMasuk {
  id: number;
  nama: string;
  email: string;
  peran: Peran;
}

export type Variabel = { pengguna: PenggunaMasuk; db: DB };

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

const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

export function buatSesi(c: Context, db: DB, penggunaId: number) {
  const token = crypto.randomBytes(32).toString('base64url');
  const kedaluwarsa = new Date(Date.now() + config.lamaSesiJam * 3600_000);
  db.prepare('DELETE FROM sesi_masuk WHERE kedaluwarsa < ?').run(new Date().toISOString());
  db.prepare('INSERT INTO sesi_masuk (token, pengguna_id, kedaluwarsa) VALUES (?, ?, ?)').run(
    hashToken(token),
    penggunaId,
    kedaluwarsa.toISOString(),
  );
  setCookie(c, NAMA_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.cookieSecure,
    path: '/',
    expires: kedaluwarsa,
  });
}

export function hapusSesi(c: Context, db: DB) {
  const token = getCookie(c, NAMA_COOKIE);
  if (token) db.prepare('DELETE FROM sesi_masuk WHERE token = ?').run(hashToken(token));
  deleteCookie(c, NAMA_COOKIE, { path: '/' });
}

export function penggunaDariCookie(c: Context, db: DB): PenggunaMasuk | null {
  const token = getCookie(c, NAMA_COOKIE);
  if (!token) return null;
  const baris = db
    .prepare(
      `SELECT p.id, p.nama, p.email, p.peran FROM sesi_masuk s JOIN pengguna p ON p.id = s.pengguna_id
       WHERE s.token = ? AND s.kedaluwarsa > ? AND p.aktif = 1`,
    )
    .get(hashToken(token), new Date().toISOString()) as PenggunaMasuk | undefined;
  return baris ?? null;
}

export function wajibMasuk(db: DB, peran?: Peran): MiddlewareHandler<{ Variables: Variabel }> {
  return async (c, next) => {
    const p = penggunaDariCookie(c, db);
    if (!p) throw new GalatPengguna(401, 'Sesi Anda sudah berakhir. Masuk kembali untuk melanjutkan.');
    if (peran && p.peran !== peran) {
      throw new GalatPengguna(403, 'Tindakan ini hanya untuk administrator. Minta administrator PCC untuk melakukannya.');
    }
    c.set('pengguna', p);
    await next();
  };
}

export const hanyaAdmin = (c: Context<{ Variables: Variabel }>) => {
  if (c.get('pengguna').peran !== 'admin') {
    throw new GalatPengguna(403, 'Tindakan ini hanya untuk administrator. Minta administrator PCC untuk melakukannya.');
  }
};
