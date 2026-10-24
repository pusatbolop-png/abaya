import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { GalatPengguna } from './util';
import { BATAS_BERKAS_BYTE } from '../shared/konstanta';

const JENIS = {
  pdf: { mime: 'application/pdf', cek: (b: Buffer) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  png: { mime: 'image/png', cek: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  jpg: { mime: 'image/jpeg', cek: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  webp: { mime: 'image/webp', cek: (b: Buffer) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  svg: { mime: 'image/svg+xml', cek: (b: Buffer) => /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(b.subarray(0, 2048).toString('utf8')) },
} as const;
export type JenisBerkas = keyof typeof JENIS;

function folder(sub: string) {
  const dir = path.join(config.dataDir, 'berkas', sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Simpan berkas unggahan setelah memeriksa ukuran dan isi sebenarnya (bukan sekadar ekstensi). */
export async function simpanBerkas(file: File, sub: string, boleh: JenisBerkas[], label: string): Promise<{ nama: string; asli: string }> {
  if (file.size === 0) throw new GalatPengguna(400, `Berkas ${label} kosong. Pilih ulang berkasnya.`);
  if (file.size > BATAS_BERKAS_BYTE) {
    throw new GalatPengguna(413, `Berkas ${label} lebih dari 5 MB. Perkecil ukurannya, misalnya dengan memindai ulang dalam resolusi lebih rendah.`);
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const jenis = boleh.find((j) => JENIS[j].cek(buf));
  if (!jenis) {
    const daftar = boleh.map((j) => j.toUpperCase()).join(', ');
    throw new GalatPengguna(400, `Berkas ${label} harus berformat ${daftar}. Simpan ulang berkasnya dalam salah satu format itu.`);
  }
  const nama = `${crypto.randomBytes(12).toString('hex')}.${jenis}`;
  fs.writeFileSync(path.join(folder(sub), nama), buf);
  const asli = path.basename(file.name || `berkas.${jenis}`).slice(0, 120);
  return { nama: `${sub}/${nama}`, asli };
}

export function bacaBerkas(nama: string): { isi: Buffer; mime: string } | null {
  if (!/^[a-z]+\/[a-f0-9]{24}\.(pdf|png|jpg|webp|svg)$/.test(nama)) return null;
  const p = path.join(config.dataDir, 'berkas', nama);
  if (!fs.existsSync(p)) return null;
  const ext = path.extname(p).slice(1) as JenisBerkas;
  return { isi: fs.readFileSync(p), mime: JENIS[ext].mime };
}

export function hapusBerkas(nama: string | null) {
  if (!nama || !/^[a-z]+\/[a-f0-9]{24}\.[a-z]+$/.test(nama)) return;
  fs.rmSync(path.join(config.dataDir, 'berkas', nama), { force: true });
}

/** Header aman untuk menyajikan berkas unggahan, termasuk SVG. */
export const HEADER_BERKAS = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
  'Cache-Control': 'private, max-age=300',
};
