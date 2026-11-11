import type { Context } from 'hono';
import { z } from 'zod';
import type { DB } from './db';
import { angkaAcak } from './kripto';

export class GalatPengguna extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 413 | 429,
    pesan: string,
    public bidang: Record<string, string> = {},
  ) {
    super(pesan);
  }
}

export const sekarang = () => new Date().toISOString();

/** Membaca dan memvalidasi isi JSON permintaan; galat zod diubah menjadi pesan per bidang. */
export async function bacaIsi<T extends z.ZodType>(c: Context, skema: T): Promise<z.infer<T>> {
  let mentah: unknown;
  try {
    mentah = await c.req.json();
  } catch {
    throw new GalatPengguna(400, 'Data yang dikirim tidak terbaca. Muat ulang halaman lalu coba lagi.');
  }
  const hasil = skema.safeParse(mentah);
  if (!hasil.success) {
    const bidang: Record<string, string> = {};
    for (const masalah of hasil.error.issues) {
      const kunci = masalah.path.join('.');
      if (!bidang[kunci]) bidang[kunci] = masalah.message;
    }
    const pertama = Object.values(bidang)[0];
    throw new GalatPengguna(400, pertama ?? 'Periksa kembali isian Anda.', bidang);
  }
  return hasil.data;
}

export const idParam = (c: Context, nama = 'id') => {
  const n = Number(c.req.param(nama));
  if (!Number.isInteger(n) || n <= 0) throw new GalatPengguna(404, 'Data tidak ditemukan.');
  return n;
};

// Isian teks: dipangkas, kosong menjadi null.
export const teks = (maks = 200) =>
  z
    .string()
    .max(maks, `Paling banyak ${maks} karakter.`)
    .transform((s) => s.trim());
export const teksWajib = (label: string, maks = 200) =>
  z
    .string({ error: `${label} wajib diisi.` })
    .trim()
    .min(1, `${label} wajib diisi.`)
    .max(maks, `${label} paling banyak ${maks} karakter.`);
export const teksOpsional = (maks = 200) =>
  z
    .string()
    .max(maks, `Paling banyak ${maks} karakter.`)
    .nullish()
    .transform((s) => (s && s.trim() ? s.trim() : null));
export const tanggal = (label = 'Tanggal') =>
  z.string({ error: `${label} wajib diisi.` }).regex(/^\d{4}-\d{2}-\d{2}$/, `${label} tidak valid.`);
export const tanggalOpsional = () =>
  z
    .string()
    .nullish()
    .transform((s) => (s ? s : null))
    .refine((s) => s === null || /^\d{4}-\d{2}-\d{2}$/.test(s), 'Tanggal tidak valid.');

// Pengaturan lembaga --------------------------------------------------------------------------

/** Draf tata tertib santri untuk sisi belakang kartu; madrasah dapat mengubahnya di Pengaturan. */
export const TATA_TERTIB_AWAL = [
  'Kewajiban santri:',
  'Hadir tepat waktu dan mengikuti doa bersama sebelum pelajaran dimulai.',
  'Berpakaian rapi, sopan, dan menutup aurat sesuai ketentuan madrasah.',
  'Membawa kitab, alat tulis, dan perlengkapan belajar setiap hari.',
  'Menghormati ustadz, ustadzah, pengurus, dan sesama santri serta bertutur kata santun.',
  'Menjaga kebersihan, ketertiban, dan fasilitas madrasah.',
  'Menyetorkan hafalan sesuai target yang ditetapkan wali kelas.',
  'Memberi kabar kepada wali kelas bila berhalangan hadir.',
  'Larangan:',
  'Membawa ponsel, rokok, senjata tajam, atau barang yang tidak berhubungan dengan pelajaran.',
  'Berkelahi, merundung, berkata kotor, atau merusak barang milik madrasah dan orang lain.',
  'Meninggalkan madrasah saat jam pelajaran tanpa izin.',
].join('\n');

export const PENGATURAN_AWAL = {
  nama_lembaga: 'Madrasah Diniyah Al Wafa’',
  nama_arab: 'مدرسة الوفاء الدينية',
  singkatan: 'Madin Al Wafa’',
  naungan: 'Al Wafa’ Islamic Center',
  slogan: 'Aesthetic · Ethic · Logic',
  alamat: 'Bangil, Pasuruan, Jawa Timur',
  kota: 'Bangil',
  telepon: '',
  kepala: '',
  bobot_harian: '30',
  bobot_uts: '30',
  bobot_uas: '40',
  syahriah_nominal: '0',
  tampil_peringkat: '1',
  mode: 'produksi',
  // Kartu santri digital: sisi belakang. Satu butir per baris; baris berakhiran titik dua menjadi judul bagian.
  tata_tertib: TATA_TERTIB_AWAL,
  kartu_berlaku: 'Selama menjadi santri aktif',
  // Pesan WhatsApp otomatis. Penyedia 'manual': pesan disiapkan dan dikirim admin lewat tautan WhatsApp.
  wa_penyedia: 'manual',
  wa_token: '',
  /** Nomor WhatsApp madrasah yang dipakai mengirim pesan (ditampilkan; pengiriman memakai perangkat gateway). */
  wa_nomor: '',
  /** Batas guru mengisi nilai harian setiap hari. */
  batas_input_jam: '21:00',
  pengingat_guru_aktif: '1',
  pengingat_guru_jam: '20:00',
  /** Rekap harian setelah batas input: untuk administrator, dan bila diizinkan untuk semua guru. */
  laporan_aktif: '1',
  laporan_jam: '21:00',
  rekap_ke_guru: '0',
  tagihan_aktif: '1',
  tagihan_jam: '17:00',
  tagihan_jeda: '3',
  tagihan_jatuh_tempo: '10',
  /** Pengingat jam pulang untuk wali santri, sekali sehari, beberapa menit sebelum pulang. */
  pulang_aktif: '1',
  jam_pulang: '19:15',
  pulang_menit: '10',
  /** Libur: semua pesan otomatis berhenti sampai tanggal ini (YYYY-MM-DD). */
  jeda_sampai: '',
  jadwal_laporan_terakhir: '',
  jadwal_tagihan_terakhir: '',
  jadwal_pengingat_terakhir: '',
  jadwal_pulang_terakhir: '',
} as const;
export type Pengaturan = { [K in keyof typeof PENGATURAN_AWAL]: string };

export function ambilPengaturan(db: DB): Pengaturan {
  const baris = db.prepare('SELECT kunci, nilai FROM pengaturan').all() as { kunci: string; nilai: string }[];
  const hasil: Record<string, string> = { ...PENGATURAN_AWAL };
  for (const b of baris) hasil[b.kunci] = b.nilai;
  return hasil as Pengaturan;
}

export function simpanPengaturan(db: DB, data: Partial<Pengaturan>) {
  const st = db.prepare('INSERT INTO pengaturan (kunci, nilai) VALUES (?, ?) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai');
  db.transaction(() => {
    for (const [k, v] of Object.entries(data)) if (v !== undefined) st.run(k, String(v));
  })();
}

export function bobotNilai(p: Pengaturan) {
  return { harian: Number(p.bobot_harian) || 0, uts: Number(p.bobot_uts) || 0, uas: Number(p.bobot_uas) || 0 };
}

/** Identitas lembaga yang boleh dilihat publik. */
export function lembaga(p: Pengaturan) {
  return {
    nama: p.nama_lembaga,
    namaArab: p.nama_arab,
    singkatan: p.singkatan,
    naungan: p.naungan,
    slogan: p.slogan,
    alamat: p.alamat,
    kota: p.kota,
    telepon: p.telepon,
    kepala: p.kepala,
    demo: p.mode === 'demo',
  };
}
export type Lembaga = ReturnType<typeof lembaga>;

// Lain-lain ------------------------------------------------------------------------------------

export function catatLog(db: DB, pelaku: string, aksi: string, detail?: string) {
  db.prepare('INSERT INTO log_aktivitas (waktu, pelaku, aksi, detail) VALUES (?, ?, ?, ?)').run(sekarang(), pelaku, aksi, detail ?? null);
}

const HURUF = 'abcdefghjkmnpqrstuvwxyz';
const ANGKA = '23456789';
const acak = (abjad: string) => abjad[angkaAcak(abjad.length)];

/** Sandi awal wali santri: 4 huruf + 4 angka tanpa karakter yang mirip (l/1, o/0). */
export function buatSandiAwal(): string {
  return Array.from({ length: 4 }, () => acak(HURUF)).join('') + Array.from({ length: 4 }, () => acak(ANGKA)).join('');
}

/** Kode verifikasi raport, mis. "7KQ2-X9PD-M4TW". */
export function buatKodeVerifikasi(): string {
  const abjad = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const blok = () => Array.from({ length: 4 }, () => acak(abjad)).join('');
  return `${blok()}-${blok()}-${blok()}`;
}

/** Hasil ambil semua baris dengan tipe. */
export const semua = <T>(db: DB, sql: string, ...param: unknown[]) => db.prepare(sql).all(...param) as T[];
export const satu = <T>(db: DB, sql: string, ...param: unknown[]) => db.prepare(sql).get(...param) as T | undefined;

// Alamat dan nomor WhatsApp -------------------------------------------------------------------

/** Alamat terstruktur: kabupaten/kota dan provinsi diisi otomatis dari kecamatan di antarmuka. */
export const skemaAlamat = {
  alamat: teksOpsional(200),
  desa: teksOpsional(80),
  kecamatan: teksOpsional(80),
  kabupaten: teksOpsional(80),
  provinsi: teksOpsional(80),
  kodeWilayah: teksOpsional(12).refine((v) => v === null || /^\d{2}\.\d{2}\.\d{2}$/.test(v), 'Kode wilayah tidak valid.'),
};

/** Nomor WhatsApp dalam bentuk 08xxxxxxxxxx (spasi, tanda hubung, +62, dan 62 dirapikan). */
export function normalHp(hp: string | null | undefined): string {
  let d = (hp ?? '').replace(/\D/g, '');
  if (d.startsWith('62')) d = '0' + d.slice(2);
  else if (d.startsWith('8')) d = '0' + d;
  return d;
}
export const hpValid = (hp: string) => /^08\d{8,12}$/.test(normalHp(hp));

/** Format tampilan nomor: 0812-3456-7890. */
export function rapikanHp(hp: string): string {
  const d = normalHp(hp);
  return d.length > 8 ? `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}` : d;
}

/** Kode acak huruf+angka tanpa karakter yang mirip (untuk kode kartu santri). */
export function kodeAcak(panjang: number): string {
  const abjad = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: panjang }, () => abjad[angkaAcak(abjad.length)]).join('');
}
