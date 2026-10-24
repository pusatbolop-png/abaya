import type { Context } from 'hono';
import { z } from 'zod';
import type { DB } from './db';
import { sekarang } from './db';
import type { Pengaturan } from './defaults';
import { PENGATURAN_AWAL } from './defaults';
import { tanggalWib } from '../shared/format';
import { config } from './config';

/** Galat yang aman ditampilkan ke pengguna: menjelaskan masalah dan cara memperbaikinya. */
export class GalatPengguna extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 413 | 429,
    pesan: string,
    public bidang?: Record<string, string>,
  ) {
    super(pesan);
  }
}

export const tidakDitemukan = (apa: string) =>
  new GalatPengguna(404, `${apa} tidak ditemukan. Muat ulang halaman, mungkin data sudah dihapus atau tautannya keliru.`);

/** Validasi isi permintaan dengan zod dan ubah pesan galatnya ke bahasa pengguna. */
export function periksa<T extends z.ZodType>(skema: T, data: unknown): z.infer<T> {
  const hasil = skema.safeParse(data);
  if (hasil.success) return hasil.data;
  const bidang: Record<string, string> = {};
  for (const isu of hasil.error.issues) {
    const kunci = isu.path.join('.') || '_';
    if (!bidang[kunci]) bidang[kunci] = isu.message;
  }
  throw new GalatPengguna(400, 'Ada isian yang perlu diperbaiki. Periksa kolom yang ditandai.', bidang);
}

export async function bacaJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new GalatPengguna(400, 'Data yang dikirim tidak terbaca. Muat ulang halaman lalu coba lagi.');
  }
}

// Pesan validasi yang sering dipakai.
export const wajib = (label: string) => z.string().trim().min(1, `${label} wajib diisi.`);
export const teksOpsional = z.string().trim().max(500).optional().nullable().transform((v) => v || null);
export const bilBulat = (label: string, min = 0) =>
  z.coerce.number({ error: `${label} harus berupa angka.` }).int(`${label} harus bilangan bulat.`).min(min, `${label} minimal ${min}.`);

export function ambilPengaturan(db: DB): Pengaturan {
  const baris = db.prepare('SELECT kunci, nilai FROM pengaturan').all() as { kunci: string; nilai: string }[];
  const hasil: Record<string, unknown> = { ...PENGATURAN_AWAL };
  for (const b of baris) hasil[b.kunci] = JSON.parse(b.nilai);
  return hasil as unknown as Pengaturan;
}

export function simpanPengaturan(db: DB, kunci: keyof Pengaturan, nilai: unknown) {
  db.prepare('INSERT INTO pengaturan (kunci, nilai) VALUES (?, ?) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai').run(
    kunci,
    JSON.stringify(nilai),
  );
}

/** Nomor dokumen berurutan per hari, mis. PJ-261024-0007. */
export function nomorBaru(db: DB, awalan: string, perHari = true): string {
  const ymd = tanggalWib().replace(/-/g, '').slice(2);
  const kunci = perHari ? `${awalan}-${ymd}` : `${awalan}-${ymd.slice(0, 2)}`;
  const baris = db
    .prepare('INSERT INTO nomor_urut (kunci, nilai) VALUES (?, 1) ON CONFLICT(kunci) DO UPDATE SET nilai = nilai + 1 RETURNING nilai')
    .get(kunci) as { nilai: number };
  return `${kunci}-${String(baris.nilai).padStart(4, '0')}`;
}

export function catatAktivitas(
  db: DB,
  penggunaId: number | null,
  aksi: string,
  entitas: string,
  entitasId: number | null,
  ringkasan: string,
) {
  db.prepare('INSERT INTO aktivitas (pengguna_id, aksi, entitas, entitas_id, ringkasan, dibuat) VALUES (?, ?, ?, ?, ?, ?)').run(
    penggunaId,
    aksi,
    entitas,
    entitasId,
    ringkasan,
    sekarang(),
  );
}

/** Pembatas laju sederhana di memori, cukup untuk satu server instansi. */
export function pembatasLaju(maks: number, jendelaMs: number) {
  const catatan = new Map<string, number[]>();
  return (kunci: string) => {
    const kini = Date.now();
    const daftar = (catatan.get(kunci) ?? []).filter((t) => kini - t < jendelaMs);
    if (daftar.length >= maks) {
      throw new GalatPengguna(429, 'Terlalu banyak percobaan dalam waktu singkat. Tunggu beberapa menit lalu coba lagi.');
    }
    daftar.push(kini);
    catatan.set(kunci, daftar);
  };
}

export function alamatKlien(c: Context): string {
  // X-Forwarded-For hanya dipercaya bila server berada di belakang reverse proxy milik instansi.
  if (config.trustProxy) {
    const xff = c.req.header('x-forwarded-for')?.split(',')[0].trim();
    if (xff) return xff;
  }
  return c.env?.incoming?.socket?.remoteAddress || 'lokal';
}
