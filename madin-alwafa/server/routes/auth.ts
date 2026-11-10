import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import {
  alamatIp,
  bersihkanBatas,
  buatSesi,
  catatGagal,
  cocokSandi,
  hapusSemuaSesi,
  hapusSesi,
  hashSandi,
  periksaBatas,
  siapaMasuk,
  tokenSaatIni,
} from '../auth';
import { KELAS_AWAL } from '../../shared/konstanta';
import { GalatPengguna, ambilPengaturan, bacaIsi, catatLog, lembaga, satu, sekarang, teksWajib } from '../util';

const sandiBaru = z
  .string({ error: 'Sandi baru wajib diisi.' })
  .min(8, 'Sandi paling sedikit 8 karakter.')
  .max(100, 'Sandi paling banyak 100 karakter.');

// Hash tiruan agar waktu respons sama, baik akun ada maupun tidak.
let hashTiruan: Promise<string> | null = null;
const tiruan = () => (hashTiruan ??= hashSandi('tidak-dipakai-' + Math.random()));

export function ruteAuth(db: DB) {
  const r = new Hono();

  r.get('/saya', (c) => {
    const { pengurus, wali } = siapaMasuk(c, db);
    const perluPasang = !satu(db, "SELECT 1 FROM pengurus WHERE peran = 'admin' AND aktif = 1");
    let santri = null;
    if (wali) {
      santri = satu<{ sandi_diganti: number; jk: string }>(db, 'SELECT sandi_diganti, jk FROM santri WHERE id = ?', wali.santriId);
    }
    const lmb = lembaga(ambilPengaturan(db));
    // Mode demo: tampilkan akun contoh di halaman masuk agar mudah dicoba.
    const demo = lmb.demo
      ? {
          username: 'admin',
          sandi: 'demo-wafa-2026',
          nis: satu<{ nis: string }>(db, "SELECT s.nis FROM santri s JOIN kelas k ON k.id = s.kelas_id WHERE k.nama = 'Sayyidah Khodijah' ORDER BY s.id LIMIT 1")?.nis ?? '',
          sandiWali: 'wafa2026',
        }
      : null;
    return c.json({
      lembaga: lmb,
      demo,
      perluPasang,
      pengurus: pengurus ?? null,
      wali: wali ? { ...wali, jk: santri?.jk, sandiDiganti: !!santri?.sandi_diganti } : null,
    });
  });

  // Akun administrator pertama, hanya bila belum ada administrator aktif.
  r.post('/pasang', async (c) => {
    const isi = await bacaIsi(
      c,
      z.object({
        nama: teksWajib('Nama', 100),
        username: teksWajib('Nama pengguna', 40).regex(/^[a-z0-9._-]+$/i, 'Nama pengguna hanya huruf, angka, titik, garis bawah, atau tanda hubung.'),
        sandi: sandiBaru,
      }),
    );
    const hash = await hashSandi(isi.sandi);
    const id = db.transaction(() => {
      if (satu(db, "SELECT 1 FROM pengurus WHERE peran = 'admin' AND aktif = 1")) {
        throw new GalatPengguna(409, 'Administrator sudah ada. Masuk dengan akun administrator.');
      }
      return Number(
        db
          .prepare("INSERT INTO pengurus (nama, username, sandi, peran, dibuat) VALUES (?, ?, ?, 'admin', ?)")
          .run(isi.nama, isi.username.toLowerCase(), hash, sekarang()).lastInsertRowid,
      );
    })();
    if (!satu(db, 'SELECT 1 FROM kelas LIMIT 1')) {
      const st = db.prepare('INSERT INTO kelas (nama, jenjang, tingkat, bagian) VALUES (?, ?, ?, ?)');
      for (const k of KELAS_AWAL) st.run(k.nama, k.jenjang, k.tingkat, k.bagian);
    }
    catatLog(db, isi.nama, 'Membuat akun administrator pertama');
    buatSesi(c, db, 'pengurus', id);
    return c.json({ ok: true });
  });

  r.post('/masuk-pengurus', async (c) => {
    const isi = await bacaIsi(c, z.object({ username: teksWajib('Nama pengguna', 60), sandi: z.string().min(1, 'Sandi wajib diisi.').max(200) }));
    const kunci = `p:${alamatIp(c)}:${isi.username.toLowerCase()}`;
    periksaBatas(kunci);
    const p = satu<{ id: number; sandi: string; aktif: number; nama: string }>(
      db,
      'SELECT id, sandi, aktif, nama FROM pengurus WHERE username = ?',
      isi.username.trim(),
    );
    const cocok = await cocokSandi(isi.sandi, p?.sandi ?? (await tiruan()));
    if (!p || !cocok || !p.aktif) {
      catatGagal(kunci);
      throw new GalatPengguna(401, p && cocok && !p.aktif ? 'Akun ini dinonaktifkan. Hubungi administrator.' : 'Nama pengguna atau sandi salah.');
    }
    bersihkanBatas(kunci);
    db.prepare('UPDATE pengurus SET masuk_terakhir = ? WHERE id = ?').run(sekarang(), p.id);
    buatSesi(c, db, 'pengurus', p.id);
    return c.json({ ok: true });
  });

  r.post('/masuk-wali', async (c) => {
    const isi = await bacaIsi(c, z.object({ nis: teksWajib('NIS', 40), sandi: z.string().min(1, 'Sandi wajib diisi.').max(200) }));
    const kunci = `w:${alamatIp(c)}:${isi.nis.toLowerCase()}`;
    periksaBatas(kunci);
    const s = satu<{ id: number; sandi: string; status: string }>(db, 'SELECT id, sandi, status FROM santri WHERE nis = ?', isi.nis.trim());
    const cocok = await cocokSandi(isi.sandi.trim(), s?.sandi ?? (await tiruan()));
    if (!s || !cocok) {
      catatGagal(kunci);
      throw new GalatPengguna(401, 'NIS atau sandi salah. Sandi awal diberikan oleh pengurus madrasah.');
    }
    if (s.status === 'keluar') throw new GalatPengguna(403, 'Akun santri ini sudah tidak aktif. Hubungi pengurus madrasah.');
    bersihkanBatas(kunci);
    db.prepare('UPDATE santri SET masuk_terakhir = ? WHERE id = ?').run(sekarang(), s.id);
    buatSesi(c, db, 'wali', s.id);
    return c.json({ ok: true });
  });

  r.post('/keluar', (c) => {
    hapusSesi(c, db);
    return c.json({ ok: true });
  });

  r.post('/ganti-sandi', async (c) => {
    const { pengurus, wali } = siapaMasuk(c, db);
    if (!pengurus && !wali) throw new GalatPengguna(401, 'Sesi Anda sudah berakhir. Masuk kembali untuk melanjutkan.');
    const isi = await bacaIsi(c, z.object({ lama: z.string().min(1, 'Sandi lama wajib diisi.').max(200), baru: sandiBaru }));
    const tabel = pengurus ? 'pengurus' : 'santri';
    const id = pengurus ? pengurus.id : wali!.santriId;
    const baris = satu<{ sandi: string }>(db, `SELECT sandi FROM ${tabel} WHERE id = ?`, id)!;
    // Sandi wali dipangkas karena sering diketik di ponsel dengan spasi berlebih.
    const lama = pengurus ? isi.lama : isi.lama.trim();
    const baru = pengurus ? isi.baru : isi.baru.trim();
    if (!(await cocokSandi(lama, baris.sandi))) {
      throw new GalatPengguna(400, 'Sandi lama tidak cocok.', { lama: 'Sandi lama tidak cocok.' });
    }
    if (baru.length < 8) throw new GalatPengguna(400, 'Sandi paling sedikit 8 karakter.', { baru: 'Sandi paling sedikit 8 karakter.' });
    if (lama === baru) throw new GalatPengguna(400, 'Sandi baru harus berbeda dari sandi lama.', { baru: 'Gunakan sandi yang berbeda.' });
    const hash = await hashSandi(baru);
    if (pengurus) db.prepare('UPDATE pengurus SET sandi = ? WHERE id = ?').run(hash, id);
    else db.prepare('UPDATE santri SET sandi = ?, sandi_diganti = 1 WHERE id = ?').run(hash, id);
    hapusSemuaSesi(db, pengurus ? 'pengurus' : 'wali', id, tokenSaatIni(c));
    return c.json({ ok: true });
  });

  return r;
}
