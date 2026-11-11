// Uji fitur: pendaftaran wali dari ponsel, foto santri, kartu santri, dan pesan WhatsApp otomatis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { bukaDb } from './db';
import { buatApp } from './app';
import { config } from './config';
import { isiDemo, SANDI_DEMO } from './demo-data';
import { detakJadwal, jalankanTagihan, susunLaporan, tunggakanSyahriah } from './domain/pesan';
import { uraiAturan } from './domain/kartu';
import { simpanPengaturan } from './util';

function klien(app: ReturnType<typeof buatApp>) {
  let cookie = '';
  const minta = async (metode: string, url: string, isi?: unknown) => {
    const headers: Record<string, string> = { cookie, 'x-madin': '1' };
    if (isi !== undefined) headers['content-type'] = 'application/json';
    const res = await app.request(url, { method: metode, headers, body: isi === undefined ? undefined : JSON.stringify(isi) });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const jenis = res.headers.get('content-type') ?? '';
    const data = jenis.includes('json') ? await res.json() : null;
    return { status: res.status, data: data as any, res };
  };
  return {
    get: (u: string) => minta('GET', u),
    post: (u: string, b?: unknown) => minta('POST', u, b ?? {}),
    put: (u: string, b?: unknown) => minta('PUT', u, b),
    del: (u: string) => minta('DELETE', u),
  };
}

function siapkan() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'madin-fitur-'));
  return { db: bukaDb(dir), tutup: (db: { close(): void }) => (db.close(), fs.rmSync(dir, { recursive: true, force: true })) };
}

async function adminBaru(app: ReturnType<typeof buatApp>) {
  const a = klien(app);
  await a.post('/api/auth/pasang', { nama: 'Ust. Admin', username: 'admin', sandi: 'sandi-rahasia-1' });
  return a;
}

const ALAMAT = { alamat: 'Dusun Krajan RT 02/RW 01', desa: 'Kalirejo', kecamatan: 'Bangil', kabupaten: 'Kabupaten Pasuruan', provinsi: 'Jawa Timur', kodeWilayah: '35.14.14' };

test('pendaftaran wali: nomor cocok langsung aktif, nomor berbeda menunggu persetujuan', async () => {
  const { db, tutup } = siapkan();
  const app = buatApp(db);
  const a = await adminBaru(app);
  const s1 = (await a.post('/api/admin/santri', { nama: 'Aisyah Uji', jk: 'P', kelasId: 1, hpWali: '0812-1111-2222' })).data;
  const s2 = (await a.post('/api/admin/santri', { nama: 'Bilal Uji', jk: 'L', kelasId: 1, hpWali: '0813-0000-0000' })).data;
  const s3 = (await a.post('/api/admin/santri', { nama: 'Citra Uji', jk: 'P', kelasId: 1 })).data;

  const w = klien(app);
  const daftar = (nis: string, hp: string, sandi = 'sandi-wali-baru') =>
    w.post('/api/auth/daftar-wali', { nis, hp, namaWali: 'Bapak Uji', hubungan: 'Ayah', ...ALAMAT, sandi });
  assert.equal((await daftar('999999', '081211112222')).status, 404, 'NIS tidak dikenal');
  assert.equal((await daftar(s1.nis, '12345')).status, 400, 'nomor tidak valid');
  assert.equal((await w.post('/api/auth/daftar-wali', { nis: s1.nis, hp: '081211112222', namaWali: 'X', hubungan: 'Ayah', sandi: 'sandi-wali-baru' })).status, 400, 'kecamatan wajib');

  // Nomor sama walau ditulis +62 dengan spasi: akun langsung aktif dan sudah masuk.
  const r1 = await daftar(s1.nis, '+62 812 1111 2222');
  assert.equal(r1.status, 200);
  assert.equal(r1.data.status, 'aktif');
  const beranda = (await w.get('/api/wali/beranda')).data;
  assert.equal(beranda.santri.nama, 'Aisyah Uji');
  assert.equal(beranda.santri.kecamatan, 'Bangil');
  assert.equal(beranda.santri.kabupaten, 'Kabupaten Pasuruan');
  assert.equal(beranda.santri.namaAyah, 'Bapak Uji');
  assert.equal((await w.get('/api/auth/saya')).data.wali.sandiDiganti, true);
  assert.equal((await daftar(s1.nis, '081211112222')).status, 409, 'tidak bisa mendaftar dua kali');
  const w1 = klien(app);
  assert.equal((await w1.post('/api/auth/masuk-wali', { nis: s1.nis, sandi: 'sandi-wali-baru' })).status, 200, 'masuk dengan sandi pilihan sendiri');
  assert.equal((await w1.post('/api/auth/masuk-wali', { nis: s1.nis, sandi: s1.sandi })).status, 401, 'sandi awal dari madrasah tidak berlaku lagi');

  // Nomor berbeda: menunggu, lalu disetujui admin.
  const w2 = klien(app);
  const r2 = await w2.post('/api/auth/daftar-wali', { nis: s2.nis, hp: '0857-7777-8888', namaWali: 'Ibu Bilal', hubungan: 'Ibu', ...ALAMAT, sandi: 'sandi-ibu-bilal' });
  assert.equal(r2.data.status, 'menunggu');
  assert.equal((await w2.get('/api/wali/beranda')).status, 401, 'belum masuk');
  const masukTunggu = await w2.post('/api/auth/masuk-wali', { nis: s2.nis, sandi: 'sandi-ibu-bilal' });
  assert.equal(masukTunggu.status, 403);
  assert.match(masukTunggu.data.galat.pesan, /diperiksa/);
  assert.equal((await a.get('/api/admin/lencana')).data.pendaftaran, 1);
  const tunggu = (await a.get('/api/admin/pendaftaran')).data.daftar;
  assert.equal(tunggu.length, 1);
  assert.equal(tunggu[0].hp, '085777778888');
  assert.equal(tunggu[0].hpTercatat, '0813-0000-0000');
  const setuju = await a.post(`/api/admin/pendaftaran/${tunggu[0].id}/setujui`);
  assert.equal(setuju.status, 200);
  assert.equal((await a.post(`/api/admin/pendaftaran/${tunggu[0].id}/setujui`)).status, 409, 'tidak bisa diputus dua kali');
  assert.equal((await w2.post('/api/auth/masuk-wali', { nis: s2.nis, sandi: 'sandi-ibu-bilal' })).status, 200);
  const detail = (await a.get(`/api/admin/santri/${s2.id}`)).data.santri;
  assert.equal(detail.hpWali, '0857-7777-8888');
  assert.equal(detail.namaIbu, 'Ibu Bilal');
  assert.ok(detail.daftarMandiri);

  // Belum ada nomor tercatat: menunggu, lalu ditolak.
  const r3 = await klien(app).post('/api/auth/daftar-wali', { nis: s3.nis, hp: '0858-1234-5678', namaWali: 'Wali Citra', hubungan: 'Wali', ...ALAMAT, sandi: 'sandi-citra-1' });
  assert.equal(r3.data.status, 'menunggu');
  const id3 = (await a.get('/api/admin/pendaftaran')).data.daftar[0].id;
  assert.equal((await a.post(`/api/admin/pendaftaran/${id3}/tolak`, { alasan: 'Nomor tidak dapat dihubungi' })).status, 200);
  assert.equal((await klien(app).post('/api/auth/masuk-wali', { nis: s3.nis, sandi: 'sandi-citra-1' })).status, 401);
  assert.equal((await a.get('/api/admin/pendaftaran?status=riwayat')).data.daftar.length, 2);
  tutup(db);
});

test('foto santri: unggah, hak akses, dan kartu santri', async () => {
  const { db, tutup } = siapkan();
  const app = buatApp(db);
  const a = await adminBaru(app);
  const s1 = (await a.post('/api/admin/santri', { nama: 'Dewi Uji', jk: 'P', kelasId: 2 })).data;
  const s2 = (await a.post('/api/admin/santri', { nama: 'Eko Uji', jk: 'L', kelasId: 1 })).data;
  const jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 0xff, 0xd9]).toString('base64');
  const palsu = 'data:image/jpeg;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64');

  assert.equal((await a.put(`/api/admin/santri/${s1.id}/foto`, { data: palsu })).status, 400, 'isi berkas bukan gambar ditolak');
  const unggah = await a.put(`/api/admin/santri/${s1.id}/foto`, { data: jpeg });
  assert.equal(unggah.status, 200);
  const versi = unggah.data.fotoVersi;
  assert.ok(versi);
  const lihat = await a.get(`/api/foto/santri/${s1.id}?v=${versi}`);
  assert.equal(lihat.status, 200);
  assert.equal(lihat.res.headers.get('content-type'), 'image/jpeg');
  assert.match(lihat.res.headers.get('cache-control') ?? '', /immutable/);
  assert.equal(Buffer.from(await lihat.res.arrayBuffer()).length, 12);
  assert.equal((await a.get('/api/admin/santri')).data.daftar.find((s: any) => s.id === s1.id).fotoVersi, versi);
  assert.equal((await klien(app).get(`/api/foto/santri/${s1.id}`)).status, 401, 'tanpa masuk');

  // Wali hanya melihat dan mengganti foto anaknya sendiri.
  const w = klien(app);
  await w.post('/api/auth/masuk-wali', { nis: s2.nis, sandi: s2.sandi });
  assert.equal((await w.get(`/api/foto/santri/${s1.id}`)).status, 404);
  assert.equal((await w.put('/api/wali/foto', { data: jpeg })).status, 200);
  assert.equal((await w.get(`/api/foto/santri/${s2.id}`)).status, 200);
  assert.equal((await w.del('/api/wali/foto')).status, 200);
  assert.equal((await w.get(`/api/foto/santri/${s2.id}`)).status, 404);

  // Kartu santri: kode tetap, tata tertib tampil di belakang, QR dapat diperiksa publik.
  const kartu = (await w.get('/api/wali/kartu')).data;
  assert.match(kartu.kode, /^[A-Z2-9]{10}$/);
  assert.equal((await w.get('/api/wali/kartu')).data.kode, kartu.kode, 'kode kartu tidak berubah');
  assert.ok(kartu.aturan.length >= 2 && kartu.aturan[0].judul && kartu.aturan[0].butir.length >= 3);
  const periksa = (await klien(app).get(`/api/publik/kartu/${kartu.kode.toLowerCase()}`)).data;
  assert.equal(periksa.hasil, 'sah');
  assert.equal(periksa.santri.nama, 'Eko Uji');
  assert.equal(periksa.santri.foto, undefined, 'pemeriksaan publik tanpa foto');
  assert.equal((await klien(app).get('/api/publik/kartu/ZZZZZZZZZZ')).data.hasil, 'tidak-ditemukan');
  assert.equal((await a.put('/api/admin/pengaturan/kartu', { tataTertib: 'Adab:\n1. Datang tepat waktu\n- Salam kepada guru', kartuBerlaku: 'Tahun ajaran 2026/2027' })).status, 200);
  const baru = (await a.get(`/api/admin/santri/${s2.id}/kartu`)).data;
  assert.deepEqual(baru.aturan, [{ judul: 'Adab', butir: ['Datang tepat waktu', 'Salam kepada guru'] }]);
  assert.equal(baru.berlaku, 'Tahun ajaran 2026/2027');
  await a.put(`/api/admin/santri/${s2.id}`, { nama: 'Eko Uji', jk: 'L', kelasId: 1, status: 'pindah' });
  assert.equal((await klien(app).get(`/api/publik/kartu/${kartu.kode}`)).data.hasil, 'tidak-aktif');
  assert.deepEqual(uraiAturan('Tanpa judul\nKedua'), [{ judul: null, butir: ['Tanpa judul', 'Kedua'] }]);
  tutup(db);
});

test('pesan otomatis: laporan harian guru, tagihan tiap 3 hari, gateway, dan penjadwal', async () => {
  const { db, tutup } = siapkan();
  await isiDemo(db);
  const app = buatApp(db);
  const a = klien(app);
  await a.post('/api/auth/masuk-pengurus', { username: 'admin', sandi: SANDI_DEMO });

  // Hari terakhir yang ada absensinya di data demo.
  const tgl = (db.prepare('SELECT MAX(tanggal) AS t FROM absensi').get() as { t: string }).t;
  const laporan = susunLaporan(db, tgl);
  assert.equal(laporan.length, 3, 'admin dan dua ustadz yang punya nomor HP');
  const maryam = laporan.find((l) => l.nama === 'Ustdz. Siti Maryam')!;
  assert.match(maryam.isi, /Sayyidah Fatimah/);
  assert.doesNotMatch(maryam.isi, /Sayyidina Husein/, 'guru putri hanya menerima kelas yang diajarnya');
  assert.match(laporan.find((l) => l.nama === 'Ust. Ahmad Fauzi')!.isi, /Sayyidina Husein[\s\S]*Sayyidah Khodijah/);
  assert.match(maryam.isi, /Hadir \d+ · Izin \d+ · Sakit \d+ · Alpa \d+/);

  // Tagihan: dikirim, ditahan 3 hari, lalu dikirim lagi; berhenti setelah lunas.
  const hariTagih = `${tgl.slice(0, 8)}${String(Math.max(Number(tgl.slice(8)), 10)).padStart(2, '0')}`;
  const tunggak = tunggakanSyahriah(db, hariTagih);
  assert.ok(tunggak.length > 0, 'data demo punya santri yang belum membayar');
  const t1 = await jalankanTagihan(db, hariTagih);
  assert.equal(t1.dibuat, tunggak.filter((t) => t.hp_wali).length);
  const contoh = db.prepare("SELECT isi FROM pesan_keluar WHERE jenis = 'tagihan' LIMIT 1").get() as { isi: string };
  assert.match(contoh.isi, /belum tercatat[\s\S]*Jumlah: \*Rp/);
  const t2 = await jalankanTagihan(db, hariTagih);
  assert.equal(t2.dibuat, 0);
  assert.equal(t2.dilewati, t1.dibuat);
  const plus = (t: string, n: number) => new Date(Date.parse(`${t}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
  assert.equal((await jalankanTagihan(db, plus(hariTagih, 2))).dibuat, 0, 'belum tiga hari');
  const lunas = tunggak[0];
  for (const b of lunas.bulan) {
    db.prepare("INSERT INTO syahriah (santri_id, bulan, nominal, tanggal_bayar, metode, dibuat) VALUES (?, ?, 25000, ?, 'tunai', ?)").run(lunas.id, b, hariTagih, hariTagih);
  }
  const t3 = await jalankanTagihan(db, plus(hariTagih, 3));
  assert.ok(t3.dibuat >= t1.dibuat - 1 && t3.dibuat <= t1.dibuat, 'tiga hari kemudian dikirim lagi, kecuali yang sudah lunas');
  assert.equal(
    (db.prepare("SELECT COUNT(*) AS n FROM pesan_keluar WHERE jenis = 'tagihan' AND santri_id = ?").get(lunas.id) as { n: number }).n,
    1,
    'santri yang sudah lunas tidak ditagih lagi',
  );

  // Kotak keluar manual: tandai terkirim.
  const antre = (await a.get('/api/admin/pesan?status=antre')).data;
  assert.ok(antre.daftar.length > 0);
  assert.equal(antre.pengaturan.penyedia, 'manual');
  assert.equal((await a.post(`/api/admin/pesan/${antre.daftar[0].id}/tandai`)).status, 200);

  // Gateway Fonnte tiruan.
  const diterima: { auth?: string; body: string }[] = [];
  let jawab = { status: true, detail: 'success! message in queue' } as Record<string, unknown>;
  const gw = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      diterima.push({ auth: req.headers.authorization, body });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(jawab));
    });
  });
  await new Promise<void>((r) => gw.listen(0, '127.0.0.1', r));
  const urlLama = config.waFonnteUrl;
  const jedaLama = config.waJedaMs;
  config.waFonnteUrl = `http://127.0.0.1:${(gw.address() as AddressInfo).port}/send`;
  config.waJedaMs = 0;
  try {
    const atur = { laporanAktif: true, laporanJam: '18:00', tagihanAktif: true, tagihanJam: '09:00', tagihanJeda: 3, jatuhTempo: 10 };
    assert.equal((await a.put('/api/admin/pesan/pengaturan', { ...atur, penyedia: 'fonnte' })).status, 400, 'token wajib');
    assert.equal((await a.put('/api/admin/pesan/pengaturan', { ...atur, penyedia: 'fonnte', token: 'TOKEN-UJI' })).status, 200);
    const info = (await a.get('/api/admin/pesan')).data.pengaturan;
    assert.equal(info.tokenTerisi, true);
    assert.equal(JSON.stringify(info).includes('TOKEN-UJI'), false, 'token tidak pernah dikirim ke peramban');
    const uji = await a.post('/api/admin/pesan/uji', { hp: '+62 812-0000-9999' });
    assert.equal(uji.data.status, 'terkirim');
    assert.equal(diterima.at(-1)!.auth, 'TOKEN-UJI');
    assert.equal(new URLSearchParams(diterima.at(-1)!.body).get('target'), '081200009999');
    jawab = { status: false, reason: 'token invalid' };
    const gagal = await a.post('/api/admin/pesan/uji', { hp: '081200009999' });
    assert.equal(gagal.data.status, 'gagal');
    assert.equal(gagal.data.galat, 'token invalid');
    jawab = { status: true };
    assert.equal((await a.post(`/api/admin/pesan/${gagal.data.id}/ulang`)).data.terkirim, 1);

    // Penjadwal: laporan dibuat sekali setelah 18:00 WIB, tidak berulang di hari yang sama.
    simpanPengaturan(db, { tagihan_aktif: '0' });
    const sebelum = diterima.length;
    const pukul = (jam: string) => new Date(`${tgl}T${jam}:00+07:00`);
    assert.deepEqual(await detakJadwal(db, pukul('17:59')), {});
    const d1 = (await detakJadwal(db, pukul('18:00'))) as { laporan: { dibuat: number; terkirim: number } };
    assert.equal(d1.laporan.dibuat, 3);
    assert.equal(d1.laporan.terkirim, 3);
    assert.equal(diterima.length, sebelum + 3);
    assert.deepEqual(await detakJadwal(db, pukul('19:30')), {}, 'tidak dikirim dua kali');
  } finally {
    config.waFonnteUrl = urlLama;
    config.waJedaMs = jedaLama;
    gw.close();
  }
  tutup(db);
});
