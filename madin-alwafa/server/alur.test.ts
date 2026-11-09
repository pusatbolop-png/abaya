// Uji alur utama lewat API: pemasangan, peran, data santri, nilai, raport, verifikasi, dan batas akses wali.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bukaDb } from './db';
import { buatApp } from './app';
import { isiDemo, SANDI_DEMO, SANDI_WALI_DEMO } from './demo-data';

function klien(app: ReturnType<typeof buatApp>) {
  let cookie = '';
  const minta = async (metode: string, url: string, isi?: unknown, tanpaHeader = false) => {
    const headers: Record<string, string> = { cookie };
    if (!tanpaHeader) headers['x-madin'] = '1';
    if (isi !== undefined) headers['content-type'] = 'application/json';
    const res = await app.request(url, { method: metode, headers, body: isi === undefined ? undefined : JSON.stringify(isi) });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
    return { status: res.status, data: data as any };
  };
  return {
    get: (u: string) => minta('GET', u),
    post: (u: string, b?: unknown, tanpaHeader?: boolean) => minta('POST', u, b ?? {}, tanpaHeader),
    put: (u: string, b?: unknown) => minta('PUT', u, b),
    del: (u: string) => minta('DELETE', u),
  };
}

function dbBaru() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'madin-uji-'));
  return { db: bukaDb(dir), dir };
}

test('pemasangan pertama, akun pengurus, dan perlindungan permintaan', async () => {
  const { db, dir } = dbBaru();
  const app = buatApp(db);
  const a = klien(app);
  assert.equal((await a.get('/api/auth/saya')).data.perluPasang, true);
  assert.equal((await a.post('/api/auth/pasang', { nama: 'Admin', username: 'admin', sandi: 'pendek' })).status, 400);
  assert.equal((await a.post('/api/auth/pasang', { nama: 'Admin', username: 'admin', sandi: 'sandi-rahasia-1' }, true)).status, 403, 'tanpa header x-madin ditolak');
  assert.equal((await a.post('/api/auth/pasang', { nama: 'Admin', username: 'admin', sandi: 'sandi-rahasia-1' })).status, 200);
  assert.equal((await a.post('/api/auth/pasang', { nama: 'Lain', username: 'lain', sandi: 'sandi-rahasia-2' })).status, 409, 'pemasangan kedua ditolak');
  const saya = await a.get('/api/auth/saya');
  assert.equal(saya.data.pengurus.peran, 'admin');

  // Akun ustadz tidak bisa mengubah pengaturan atau syahriah.
  const u = (await a.post('/api/admin/pengurus', { nama: 'Ust. Karim', username: 'karim', peran: 'ustadz' })).data;
  const b = klien(app);
  assert.equal((await b.post('/api/auth/masuk-pengurus', { username: 'karim', sandi: 'salah' })).status, 401);
  assert.equal((await b.post('/api/auth/masuk-pengurus', { username: 'karim', sandi: u.sandi })).status, 200);
  assert.equal((await b.get('/api/admin/syahriah?kelas=1')).status, 403);
  assert.equal((await b.put('/api/admin/pengaturan', {})).status, 403);
  assert.equal((await b.get('/api/admin/ringkasan')).status, 200);

  // Pembatas percobaan masuk.
  const c = klien(app);
  for (let i = 0; i < 8; i++) await c.post('/api/auth/masuk-pengurus', { username: 'karim', sandi: 'salah' });
  assert.equal((await c.post('/api/auth/masuk-pengurus', { username: 'karim', sandi: u.sandi })).status, 429);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('santri baru, akun wali, nilai, raport, dan verifikasi', async () => {
  const { db, dir } = dbBaru();
  const app = buatApp(db);
  const a = klien(app);
  await a.post('/api/auth/pasang', { nama: 'Ust. Admin', username: 'admin', sandi: 'sandi-rahasia-1' });
  await a.put('/api/admin/pengaturan', {
    namaLembaga: 'Madrasah Diniyah Al-Wafa',
    namaArab: 'مدرسة الوفاء الدينية',
    singkatan: 'Madin Al-Wafa',
    slogan: '',
    alamat: 'Jl. Contoh',
    kota: 'Kota Contoh',
    telepon: '',
    kepala: 'Kepala Contoh',
    bobot: { harian: 0, uts: 0, uas: 100 },
    syahriahNominal: 20000,
    tampilPeringkat: true,
  });
  const periode = (await a.post('/api/admin/periode', { tahunAjaran: '2026/2027', semester: 1, mulai: '2026-07-01', selesai: '2026-12-20', tanggalRaport: '2026-12-20' })).data.id;
  const kelas = (await a.post('/api/admin/kelas', { nama: 'Ula 1 Putri', jenjang: 'Ula', tingkat: 1, bagian: 'putri' })).data.id;
  const m1 = (await a.post('/api/admin/mapel', { nama: 'Fiqih', namaArab: 'الفقه', kkm: 65 })).data.id;
  const m2 = (await a.post('/api/admin/mapel', { nama: 'Tauhid', kkm: 65 })).data.id;
  await a.put(`/api/admin/kelas/${kelas}/mapel`, { daftar: [{ mapelId: m1, pengajar: 'Ustdz. A' }, { mapelId: m2, pengajar: null }] });

  const s1 = (await a.post('/api/admin/santri', { nama: 'Aisyah', jk: 'P', kelasId: kelas, tanggalMasuk: '2026-07-01', hpWali: '0812-1111-2222' })).data;
  const s2 = (await a.post('/api/admin/santri', { nama: 'Fatimah', jk: 'P', kelasId: kelas, tanggalMasuk: '2026-07-01' })).data;
  assert.match(s1.nis, /^26\d{4}$/, 'NIS otomatis');
  assert.match(s1.sandi, /^[a-z]{4}\d{4}$/);
  assert.match(s1.pesan, /Aisyah/);
  assert.equal((await a.post('/api/admin/santri', { nis: s1.nis, nama: 'Ganda', jk: 'P' })).status, 409);

  // Nilai: hanya UAS dipakai karena bobot UAS 100%.
  await a.put('/api/admin/nilai', { periodeId: periode, kelasId: kelas, mapelId: m1, daftar: [{ santriId: s1.id, harian: null, uts: null, uas: 90 }, { santriId: s2.id, harian: null, uts: null, uas: 70 }] });
  await a.put('/api/admin/nilai', { periodeId: periode, kelasId: kelas, mapelId: m2, daftar: [{ santriId: s1.id, harian: null, uts: null, uas: 80 }, { santriId: s2.id, harian: null, uts: null, uas: 75 }] });
  let r = (await a.get(`/api/admin/raport/${s1.id}/${periode}`)).data;
  assert.equal(r.rataRata, 85);
  assert.equal(r.peringkat, 1);
  assert.equal(r.mapel[0].terbilang, 'Sembilan puluh');
  assert.equal(r.mapel[0].predikatArab, 'ممتاز');
  assert.ok(r.kekurangan.some((k: string) => k.includes('Kepribadian')));

  // Belum lengkap → gagal terbit.
  let t = (await a.post('/api/admin/raport/terbitkan', { periodeId: periode, santriIds: [s1.id] })).data;
  assert.equal(t.terbit.length, 0);
  await a.put('/api/admin/raport/isian', { periodeId: periode, daftar: [{ santriId: s1.id, akhlak: 'A', kerajinan: 'A', kerapian: 'B', kedisiplinan: 'A', catatan: 'Baik sekali.' }] });
  t = (await a.post('/api/admin/raport/terbitkan', { periodeId: periode, santriIds: [s1.id] })).data;
  assert.equal(t.terbit.length, 1);
  const kode = t.terbit[0].kode;
  assert.match(kode, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  // Raport terbit mengunci nilai dan isian.
  const kunci = await a.put('/api/admin/nilai', { periodeId: periode, kelasId: kelas, mapelId: m1, daftar: [{ santriId: s1.id, harian: null, uts: null, uas: 50 }] });
  assert.equal(kunci.status, 409);
  // Nilai santri lain tetap bisa diubah.
  assert.equal((await a.put('/api/admin/nilai', { periodeId: periode, kelasId: kelas, mapelId: m1, daftar: [{ santriId: s1.id, harian: null, uts: null, uas: 90 }, { santriId: s2.id, harian: null, uts: null, uas: 72 }] })).status, 200);

  // Verifikasi publik: nama disamarkan.
  const v = (await klien(app).get(`/api/publik/verifikasi/${kode.toLowerCase()}`)).data;
  assert.equal(v.hasil, 'asli');
  assert.equal(v.raport.rataRata, 85);
  assert.equal(v.raport.nama, 'Aisyah');
  assert.equal((await klien(app).get('/api/publik/verifikasi/AAAA-BBBB-CCCC')).data.hasil, 'tidak-ditemukan');

  // Wali: masuk dengan NIS, hanya melihat raport sendiri yang sudah terbit.
  const w = klien(app);
  assert.equal((await w.post('/api/auth/masuk-wali', { nis: s1.nis, sandi: 'salah123' })).status, 401);
  assert.equal((await w.post('/api/auth/masuk-wali', { nis: s1.nis, sandi: ` ${s1.sandi} ` })).status, 200, 'spasi di sandi wali diabaikan');
  assert.equal((await w.get('/api/admin/santri')).status, 401, 'wali tidak bisa membuka API pengurus');
  const daftar = (await w.get('/api/wali/raport')).data.daftar;
  assert.equal(daftar.length, 1);
  r = (await w.get(`/api/wali/raport/${periode}`)).data;
  assert.equal(r.santri.nama, 'Aisyah');
  assert.equal(r.status, 'terbit');
  assert.equal((await a.get(`/api/admin/raport?kelas=${kelas}&periode=${periode}`)).data.daftar.find((d: any) => d.santriId === s1.id).dibacaWali !== null, true);

  const w2 = klien(app);
  await w2.post('/api/auth/masuk-wali', { nis: s2.nis, sandi: s2.sandi });
  assert.equal((await w2.get(`/api/wali/raport/${periode}`)).status, 404, 'raport belum terbit tidak terlihat');

  // Tarik raport: wali tidak melihatnya lagi, verifikasi menyatakan sedang diperbaiki.
  await a.post('/api/admin/raport/tarik', { periodeId: periode, santriId: s1.id });
  assert.equal((await w.get(`/api/wali/raport/${periode}`)).status, 404);
  assert.equal((await klien(app).get(`/api/publik/verifikasi/${kode}`)).data.hasil, 'ditarik');

  // Ganti sandi wali mengakhiri sesi lain dan menandai sandi sudah diganti.
  const w3 = klien(app);
  await w3.post('/api/auth/masuk-wali', { nis: s1.nis, sandi: s1.sandi });
  assert.equal((await w.post('/api/auth/ganti-sandi', { lama: s1.sandi, baru: 'sandi-baru-wali' })).status, 200);
  assert.equal((await w3.get('/api/wali/beranda')).status, 401);
  assert.equal((await w.get('/api/auth/saya')).data.wali.sandiDiganti, true);

  // Absensi tidak boleh untuk tanggal yang akan datang.
  assert.equal((await a.put('/api/admin/absensi', { kelasId: kelas, tanggal: '2999-01-01', daftar: [{ santriId: s1.id, status: 'H' }] })).status, 400);

  // Syahriah dicatat untuk beberapa bulan sekaligus, dan tidak boleh ganda.
  assert.equal((await a.post('/api/admin/syahriah', { santriId: s1.id, bulan: ['2026-07', '2026-08'], nominal: 20000, tanggalBayar: '2026-08-02', metode: 'tunai' })).status, 200);
  assert.equal((await a.post('/api/admin/syahriah', { santriId: s1.id, bulan: ['2026-08'], nominal: 20000, tanggalBayar: '2026-08-02', metode: 'tunai' })).status, 409);
  const sy = (await w.get('/api/wali/syahriah?tahunAjaran=2026/2027')).data;
  assert.equal(sy.bulan.filter((b: any) => b.bayar).length, 2);

  // Santri dengan riwayat tidak bisa dihapus.
  assert.equal((await a.del(`/api/admin/santri/${s1.id}`)).status, 409);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('data demo konsisten: raport semester lalu terbit dengan kelas lama', async () => {
  const { db, dir } = dbBaru();
  const { nisContoh, idLalu } = await isiDemo(db);
  const app = buatApp(db);
  const a = klien(app);
  assert.equal((await a.post('/api/auth/masuk-pengurus', { username: 'admin', sandi: SANDI_DEMO })).status, 200);
  const ring = (await a.get('/api/admin/ringkasan')).data;
  assert.equal(ring.santri.total, 48);
  const w = klien(app);
  assert.equal((await w.post('/api/auth/masuk-wali', { nis: nisContoh, sandi: SANDI_WALI_DEMO })).status, 200);
  const r = (await w.get(`/api/wali/raport/${idLalu}`)).data;
  assert.equal(r.status, 'terbit');
  assert.ok(r.kode);
  assert.ok(r.mapel.length >= 9);
  assert.ok(r.mapel.every((m: any) => m.akhir !== null));
  const sekarang = (await w.get('/api/wali/beranda')).data;
  assert.notEqual(r.kelas.id, sekarang.santri.kelasId, 'raport lama memakai kelas saat diterbitkan');
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
