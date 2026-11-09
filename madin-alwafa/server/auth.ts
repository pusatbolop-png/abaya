import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { DB } from './db';
import { config } from './config';
import { GalatPengguna, sekarang } from './util';
import type { PeranPengurus } from '../shared/konstanta';
import { cocokSandi, hashSandi, hashToken, tokenAcak } from './kripto';

export { cocokSandi, hashSandi };
export const NAMA_COOKIE = 'madin_sesi';

export interface PengurusMasuk {
  id: number;
  nama: string;
  username: string;
  peran: PeranPengurus;
}
export interface WaliMasuk {
  santriId: number;
  nama: string;
  nis: string;
}

export type VarPengurus = { pengurus: PengurusMasuk };
export type VarWali = { wali: WaliMasuk };

function cookieAman(c: Context) {
  if (config.cookieSecure !== 'otomatis') return config.cookieSecure;
  if (config.trustProxy && c.req.header('x-forwarded-proto') === 'https') return true;
  return new URL(c.req.url).protocol === 'https:';
}

export function buatSesi(c: Context, db: DB, jenis: 'pengurus' | 'wali', subjekId: number) {
  const token = tokenAcak();
  const kedaluwarsa = new Date(Date.now() + config.lamaSesiJam * 3600_000);
  db.prepare('DELETE FROM sesi WHERE kedaluwarsa < ?').run(sekarang());
  db.prepare('INSERT INTO sesi (token, jenis, subjek_id, kedaluwarsa) VALUES (?, ?, ?, ?)').run(
    hashToken(token),
    jenis,
    subjekId,
    kedaluwarsa.toISOString(),
  );
  setCookie(c, NAMA_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: cookieAman(c),
    path: '/',
    expires: kedaluwarsa,
  });
}

export function hapusSesi(c: Context, db: DB) {
  const token = getCookie(c, NAMA_COOKIE);
  if (token) db.prepare('DELETE FROM sesi WHERE token = ?').run(hashToken(token));
  deleteCookie(c, NAMA_COOKIE, { path: '/' });
}

/** Mengakhiri semua sesi milik satu akun (setelah sandi diganti atau direset). */
export function hapusSemuaSesi(db: DB, jenis: 'pengurus' | 'wali', subjekId: number, kecualiToken?: string) {
  if (kecualiToken) {
    db.prepare('DELETE FROM sesi WHERE jenis = ? AND subjek_id = ? AND token != ?').run(jenis, subjekId, hashToken(kecualiToken));
  } else {
    db.prepare('DELETE FROM sesi WHERE jenis = ? AND subjek_id = ?').run(jenis, subjekId);
  }
}

export const tokenSaatIni = (c: Context) => getCookie(c, NAMA_COOKIE);

function sesiDariCookie(c: Context, db: DB) {
  const token = getCookie(c, NAMA_COOKIE);
  if (!token) return null;
  return (
    (db.prepare('SELECT jenis, subjek_id FROM sesi WHERE token = ? AND kedaluwarsa > ?').get(hashToken(token), sekarang()) as
      | { jenis: 'pengurus' | 'wali'; subjek_id: number }
      | undefined) ?? null
  );
}

export function siapaMasuk(c: Context, db: DB): { pengurus?: PengurusMasuk; wali?: WaliMasuk } {
  const sesi = sesiDariCookie(c, db);
  if (!sesi) return {};
  if (sesi.jenis === 'pengurus') {
    const p = db.prepare('SELECT id, nama, username, peran FROM pengurus WHERE id = ? AND aktif = 1').get(sesi.subjek_id) as
      | PengurusMasuk
      | undefined;
    return p ? { pengurus: p } : {};
  }
  const s = db.prepare("SELECT id, nama, nis FROM santri WHERE id = ? AND status != 'keluar'").get(sesi.subjek_id) as
    | { id: number; nama: string; nis: string }
    | undefined;
  return s ? { wali: { santriId: s.id, nama: s.nama, nis: s.nis } } : {};
}

export function wajibPengurus(db: DB): MiddlewareHandler<{ Variables: VarPengurus }> {
  return async (c, next) => {
    const { pengurus } = siapaMasuk(c, db);
    if (!pengurus) throw new GalatPengguna(401, 'Sesi Anda sudah berakhir. Masuk kembali untuk melanjutkan.');
    c.set('pengurus', pengurus);
    await next();
  };
}

export function wajibWali(db: DB): MiddlewareHandler<{ Variables: VarWali }> {
  return async (c, next) => {
    const { wali } = siapaMasuk(c, db);
    if (!wali) throw new GalatPengguna(401, 'Sesi Anda sudah berakhir. Masuk kembali untuk melanjutkan.');
    c.set('wali', wali);
    await next();
  };
}

export function hanyaAdmin(c: Context<{ Variables: VarPengurus }>) {
  if (c.get('pengurus').peran !== 'admin') {
    throw new GalatPengguna(403, 'Tindakan ini khusus administrator. Minta administrator madrasah untuk melakukannya.');
  }
}

export const pelaku = (c: Context<{ Variables: VarPengurus }>) => c.get('pengurus').nama;

// Pembatas percobaan masuk ------------------------------------------------------------------------

const percobaan = new Map<string, { jumlah: number; sampai: number }>();
const BATAS = 8;
const JEDA_MS = 10 * 60_000;

export function alamatIp(c: Context): string {
  if (config.trustProxy) {
    const xff = c.req.header('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
  }
  try {
    return getConnInfo(c).remote.address ?? 'tidak-diketahui';
  } catch {
    return 'tidak-diketahui';
  }
}

/** Melempar 429 bila kunci ini sudah terlalu sering gagal masuk. */
export function periksaBatas(kunci: string) {
  const entri = percobaan.get(kunci);
  if (entri && entri.sampai > Date.now() && entri.jumlah >= BATAS) {
    const menit = Math.ceil((entri.sampai - Date.now()) / 60_000);
    throw new GalatPengguna(429, `Terlalu banyak percobaan masuk. Coba lagi dalam ${menit} menit.`);
  }
}

export function catatGagal(kunci: string) {
  const entri = percobaan.get(kunci);
  if (!entri || entri.sampai < Date.now()) percobaan.set(kunci, { jumlah: 1, sampai: Date.now() + JEDA_MS });
  else entri.jumlah++;
  if (percobaan.size > 5000) {
    for (const [k, v] of percobaan) if (v.sampai < Date.now()) percobaan.delete(k);
  }
}

export const bersihkanBatas = (kunci: string) => percobaan.delete(kunci);
