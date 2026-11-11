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
import { GalatPengguna, ambilPengaturan, bacaIsi, catatLog, hpValid, lembaga, normalHp, satu, sekarang, skemaAlamat, teksWajib } from '../util';
import { terapkanWali } from '../domain/pendaftaran';

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
      santri = satu<{ sandi_diganti: number; jk: string; foto_versi: string | null }>(db, 'SELECT sandi_diganti, jk, foto_versi FROM santri WHERE id = ?', wali.santriId);
    }
    const lmb = lembaga(ambilPengaturan(db));
    // Mode demo: tampilkan akun contoh di halaman masuk agar mudah dicoba.
    // Contoh pendaftaran: santri yang walinya belum punya akun aktif, beserta nomor WhatsApp yang tercatat.
    const contohDaftar = lmb.demo
      ? satu<{ nis: string; hp_wali: string }>(
          db,
          "SELECT nis, hp_wali FROM santri WHERE status = 'aktif' AND sandi_diganti = 0 AND hp_wali IS NOT NULL ORDER BY kelas_id, id LIMIT 1",
        )
      : undefined;
    const demo = lmb.demo
      ? {
          username: 'admin',
          sandi: 'demo-wafa-2026',
          nis: satu<{ nis: string }>(db, "SELECT s.nis FROM santri s JOIN kelas k ON k.id = s.kelas_id WHERE k.nama = 'Sayyidah Khodijah' ORDER BY s.id LIMIT 1")?.nis ?? '',
          sandiWali: 'wafa2026',
          daftarNis: contohDaftar?.nis ?? '',
          daftarHp: contohDaftar?.hp_wali ?? '',
        }
      : null;
    return c.json({
      lembaga: lmb,
      demo,
      perluPasang,
      pengurus: pengurus ?? null,
      wali: wali ? { ...wali, jk: santri?.jk, sandiDiganti: !!santri?.sandi_diganti, fotoVersi: santri?.foto_versi ?? null } : null,
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
      // Wali yang baru mendaftar dan masih menunggu pemeriksaan diberi tahu statusnya, bukan sekadar "sandi salah".
      const tunggu = s && satu<{ sandi: string }>(db, "SELECT sandi FROM pendaftaran_wali WHERE santri_id = ? AND status = 'menunggu' ORDER BY id DESC LIMIT 1", s.id);
      if (tunggu && (await cocokSandi(isi.sandi.trim(), tunggu.sandi))) {
        throw new GalatPengguna(403, 'Pendaftaran Anda sedang diperiksa pengurus madrasah. Anda akan dihubungi lewat WhatsApp setelah disetujui.');
      }
      throw new GalatPengguna(401, 'NIS atau sandi salah. Belum punya akun? Pilih Daftar, atau minta sandi kepada pengurus madrasah.');
    }
    if (s.status === 'keluar') throw new GalatPengguna(403, 'Akun santri ini sudah tidak aktif. Hubungi pengurus madrasah.');
    bersihkanBatas(kunci);
    db.prepare('UPDATE santri SET masuk_terakhir = ? WHERE id = ?').run(sekarang(), s.id);
    buatSesi(c, db, 'wali', s.id);
    return c.json({ ok: true });
  });

  // Pendaftaran akun wali dari ponsel: NIS + nomor WhatsApp aktif + alamat + sandi pilihan sendiri.
  r.post('/daftar-wali', async (c) => {
    const isi = await bacaIsi(
      c,
      z.object({
        nis: teksWajib('NIS', 40),
        hp: teksWajib('Nomor WhatsApp', 20).refine(hpValid, 'Nomor WhatsApp tidak valid. Contoh: 0812-3456-7890.'),
        namaWali: teksWajib('Nama orang tua/wali', 100),
        hubungan: z.enum(['Ayah', 'Ibu', 'Wali'], { error: 'Pilih hubungan dengan santri.' }),
        ...skemaAlamat,
        kecamatan: teksWajib('Kecamatan', 80),
        sandi: sandiBaru,
      }),
    );
    const kunci = `d:${alamatIp(c)}`;
    periksaBatas(kunci);
    const s = satu<{ id: number; nama: string; nis: string; status: string; sandi_diganti: number; hp_wali: string | null }>(
      db,
      'SELECT id, nama, nis, status, sandi_diganti, hp_wali FROM santri WHERE nis = ?',
      isi.nis.trim(),
    );
    if (!s || s.status === 'keluar') {
      catatGagal(kunci);
      throw new GalatPengguna(404, 'NIS tidak ditemukan. Periksa kembali NIS di kartu atau raport ananda, atau hubungi pengurus madrasah.', { nis: 'NIS tidak ditemukan.' });
    }
    if (s.sandi_diganti) {
      throw new GalatPengguna(409, 'NIS ini sudah memiliki akun wali yang aktif. Silakan masuk. Lupa sandi? Minta pengurus madrasah membuat sandi baru.', {
        nis: 'Sudah terdaftar.',
      });
    }
    const hash = await hashSandi(isi.sandi.trim());
    const waktu = sekarang();
    const data = { ...isi, hp: normalHp(isi.hp) };
    if (s.hp_wali && normalHp(s.hp_wali) === data.hp) {
      // Nomor WhatsApp sama dengan data madrasah: akun langsung aktif.
      db.transaction(() => {
        terapkanWali(db, s.id, data, hash, waktu);
        db.prepare("UPDATE pendaftaran_wali SET status = 'ditolak', alasan = 'Diganti pendaftaran yang terverifikasi', diputus = ? WHERE santri_id = ? AND status = 'menunggu'").run(waktu, s.id);
      })();
      bersihkanBatas(kunci);
      hapusSemuaSesi(db, 'wali', s.id);
      catatLog(db, `Wali ${s.nama}`, 'Mendaftar akun wali dari ponsel', `${s.nama} (${s.nis}) · nomor cocok, langsung aktif`);
      db.prepare('UPDATE santri SET masuk_terakhir = ? WHERE id = ?').run(waktu, s.id);
      buatSesi(c, db, 'wali', s.id);
      return c.json({ status: 'aktif' as const, nama: s.nama });
    }
    // Nomor berbeda atau belum tercatat: pengurus memeriksa lebih dulu. Satu pendaftaran menunggu per santri.
    db.transaction(() => {
      db.prepare("DELETE FROM pendaftaran_wali WHERE santri_id = ? AND status = 'menunggu'").run(s.id);
      db.prepare(
        `INSERT INTO pendaftaran_wali (santri_id, nama_wali, hubungan, hp, alamat, desa, kecamatan, kabupaten, provinsi, kode_wilayah, sandi, dibuat)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(s.id, isi.namaWali, isi.hubungan, data.hp, isi.alamat, isi.desa, isi.kecamatan, isi.kabupaten, isi.provinsi, isi.kodeWilayah, hash, waktu);
    })();
    catatGagal(kunci); // pengajuan yang belum terverifikasi ikut dibatasi agar tidak bisa dibanjiri
    catatLog(db, `Wali ${s.nama}`, 'Mengajukan pendaftaran akun wali', `${s.nama} (${s.nis}) · nomor ${s.hp_wali ? 'berbeda dari data madrasah' : 'belum tercatat'}`);
    return c.json({ status: 'menunggu' as const, nama: s.nama });
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
