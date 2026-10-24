import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { sekarang } from '../db';
import { hashSandi, cocokSandi, buatSesi, hapusSesi, penggunaDariCookie, wajibMasuk, type Variabel } from '../auth';
import { periksa, wajib, GalatPengguna, pembatasLaju, alamatKlien, bacaJson, catatAktivitas } from '../util';

export const sandiKuat = z
  .string()
  .min(10, 'Kata sandi minimal 10 karakter.')
  .max(200)
  .refine((s) => /[A-Za-z]/.test(s) && /\d/.test(s), 'Gabungkan huruf dan angka agar kata sandi lebih kuat.');

export function ruteAuth(db: DB) {
  const app = new Hono<{ Variables: Variabel }>();
  const batasMasuk = pembatasLaju(8, 10 * 60_000);

  // Selalu 200 agar halaman publik tidak memunculkan galat 401 di konsol.
  app.get('/saya', (c) => c.json({ pengguna: penggunaDariCookie(c, db) }));

  app.post('/siapkan', async (c) => {
    const ada = (db.prepare('SELECT COUNT(*) AS n FROM pengguna').get() as { n: number }).n;
    if (ada > 0) throw new GalatPengguna(409, 'Akun administrator sudah dibuat. Masuk dengan akun tersebut.');
    const d = periksa(
      z.object({ nama: wajib('Nama').max(100), email: z.string().trim().email('Alamat email tidak valid.'), sandi: sandiKuat }),
      await bacaJson(c),
    );
    const r = db
      .prepare("INSERT INTO pengguna (nama, email, sandi, peran, dibuat) VALUES (?, ?, ?, 'admin', ?)")
      .run(d.nama, d.email, await hashSandi(d.sandi), sekarang());
    catatAktivitas(db, Number(r.lastInsertRowid), 'siapkan', 'pengguna', Number(r.lastInsertRowid), `${d.nama} menyiapkan akun administrator pertama`);
    buatSesi(c, db, Number(r.lastInsertRowid));
    return c.json({ pengguna: penggunaDariCookie(c, db) ?? { id: Number(r.lastInsertRowid), nama: d.nama, email: d.email, peran: 'admin' } }, 201);
  });

  app.post('/masuk', async (c) => {
    batasMasuk(alamatKlien(c));
    const d = periksa(z.object({ email: wajib('Email'), sandi: wajib('Kata sandi') }), await bacaJson(c));
    const p = db.prepare('SELECT id, nama, email, peran, sandi, aktif FROM pengguna WHERE email = ?').get(d.email) as
      | { id: number; nama: string; email: string; peran: string; sandi: string; aktif: number }
      | undefined;
    const cocok = p ? await cocokSandi(d.sandi, p.sandi) : await cocokSandi(d.sandi, 'scrypt$AAAA$AAAA');
    if (!p || !cocok) throw new GalatPengguna(401, 'Email atau kata sandi tidak cocok. Periksa ejaan dan huruf besar-kecil, lalu coba lagi.');
    if (!p.aktif) throw new GalatPengguna(403, 'Akun ini sudah dinonaktifkan. Hubungi administrator PCC bila masih memerlukan akses.');
    buatSesi(c, db, p.id);
    return c.json({ pengguna: { id: p.id, nama: p.nama, email: p.email, peran: p.peran } });
  });

  app.post('/keluar', (c) => {
    hapusSesi(c, db);
    return c.json({ ok: true });
  });

  app.post('/ganti-sandi', wajibMasuk(db), async (c) => {
    const d = periksa(z.object({ lama: wajib('Kata sandi lama'), baru: sandiKuat }), await bacaJson(c));
    const p = db.prepare('SELECT sandi FROM pengguna WHERE id = ?').get(c.get('pengguna').id) as { sandi: string };
    if (!(await cocokSandi(d.lama, p.sandi))) {
      throw new GalatPengguna(400, 'Kata sandi lama tidak cocok.', { lama: 'Kata sandi lama tidak cocok.' });
    }
    db.prepare('UPDATE pengguna SET sandi = ? WHERE id = ?').run(await hashSandi(d.baru), c.get('pengguna').id);
    return c.json({ ok: true });
  });

  return app;
}
