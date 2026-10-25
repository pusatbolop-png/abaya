import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-uji-'));
const { bukaDb } = await import('./db');
const { buatApp } = await import('./app');

const db = bukaDb(':memory:');
const app = buatApp(db);
let cookie = '';

async function minta(metode: string, url: string, isi?: unknown) {
  const headers: Record<string, string> = { 'x-pcc': '1', cookie };
  let body: BodyInit | undefined;
  if (isi instanceof FormData) body = isi;
  else if (isi !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(isi);
  }
  const res = await app.request(url, { method: metode, headers, body });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const jenis = res.headers.get('content-type') ?? '';
  return { status: res.status, data: jenis.includes('json') ? await res.json() : await res.arrayBuffer(), jenis };
}

test('alur lengkap: daftar → seleksi → stok → live → jual → retur → dana → ekspor', async () => {
  // Siapkan administrator pertama.
  let r = await minta('POST', '/api/auth/siapkan', { nama: 'Admin Uji', email: 'admin@pcc.test', sandi: 'rahasia12345' });
  assert.equal(r.status, 201);
  assert.match(cookie, /pcc_sesi=/);

  // Tanpa header aplikasi, perubahan data ditolak.
  const tanpaHeader = await app.request('/api/auth/keluar', { method: 'POST' });
  assert.equal(tanpaHeader.status, 403);

  // Pendaftaran publik dengan berkas NIB.
  const f = new FormData();
  Object.entries({
    nama_usaha: 'Kopi Lereng Arjuno',
    pemilik: 'Siti Aminah',
    whatsapp: '0812 3456 7890',
    alamat: 'Jl. Raya Prigen 12',
    kecamatan: 'Prigen',
    kategori: 'Minuman',
    deskripsi: 'Kopi robusta petik merah dari lereng Arjuno, disangrai sendiri.',
    bank: 'Bank Jatim',
    no_rekening: '0011-2233-44',
    atas_nama: 'Siti Aminah',
    persetujuan: 'ya',
    izin_izin_1_nomor: '1234567890123',
  }).forEach(([k, v]) => f.append(k, v));
  f.append('izin_izin_1_berkas', new File([Buffer.from('%PDF-1.4\n%uji')], 'nib.pdf', { type: 'application/pdf' }));
  r = await minta('POST', '/api/publik/daftar', f);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const kode = (r.data as { kode: string }).kode;

  r = await minta('POST', '/api/publik/status', { kode, whatsapp: '6281234567890' });
  assert.equal(r.status, 200);
  assert.equal((r.data as { status: string }).status, 'diajukan');

  const daftar = (await minta('GET', '/api/umkm')).data as { daftar: { id: number }[] };
  const umkmId = daftar.daftar[0].id;

  // Berkas unggahan disajikan dalam sandbox CSP.
  const berkas = await app.request(`/api/umkm/${umkmId}/izin/izin_1/berkas`, { headers: { cookie } });
  assert.equal(berkas.status, 200);
  assert.match(berkas.headers.get('content-security-policy') ?? '', /sandbox/);
  assert.equal(berkas.headers.get('x-pcc-berkas'), null);

  // Menerima sebelum izin wajib terverifikasi harus ditolak dengan arahan.
  const skor = { mutu: 4, kemasan: 4, kapasitas: 3, pasar: 5 };
  r = await minta('POST', `/api/umkm/${umkmId}/seleksi`, { keputusan: 'diterima', skor });
  assert.equal(r.status, 409);
  await minta('PUT', `/api/umkm/${umkmId}/izin/izin_1`, { status: 'terverifikasi', nomor: '1234567890123' });
  r = await minta('POST', `/api/umkm/${umkmId}/seleksi`, { keputusan: 'diterima', skor });
  assert.equal(r.status, 200);

  // Produk dan stok.
  r = await minta('POST', '/api/produk', { umkm_id: umkmId, nama: 'Kopi Robusta 200 g', harga: 45_000, stok_awal: 10 });
  assert.equal(r.status, 201);
  const produkId = (r.data as { id: number }).id;
  await minta('POST', '/api/stok/mutasi', { produk_id: produkId, jenis: 'masuk', jumlah: 5 });
  let stok = (await minta('GET', '/api/stok')).data as { daftar: { id: number; stok: number }[] };
  assert.equal(stok.daftar.find((p) => p.id === produkId)!.stok, 15);

  // Sesi live di studio dan pencegahan bentrok jadwal.
  const studio = db.prepare("SELECT id FROM ruangan WHERE jenis = 'studio' ORDER BY id LIMIT 1").get() as { id: number };
  const mulai = new Date(Date.now() - 10 * 60_000).toISOString();
  const selesai = new Date(Date.now() + 80 * 60_000).toISOString();
  r = await minta('POST', '/api/live', { ruangan_id: studio.id, judul: 'Kopi Pagi', platform: 'TikTok Shop', host: 'Rani', jadwal_mulai: mulai, jadwal_selesai: selesai, produk_ids: [produkId] });
  assert.equal(r.status, 201);
  const sesiId = (r.data as { id: number }).id;
  r = await minta('POST', '/api/live', { ruangan_id: studio.id, judul: 'Bentrok', platform: 'TikTok Shop', host: 'Budi', jadwal_mulai: mulai, jadwal_selesai: selesai });
  assert.equal(r.status, 409);
  assert.equal((await minta('POST', `/api/live/${sesiId}/mulai`)).status, 200);
  const gedung = (await minta('GET', '/api/publik/gedung')).data as { sesi: { status: string }[] };
  assert.ok(gedung.sesi.some((s) => s.status === 'berlangsung'));

  // Penjualan mengurangi stok; menjual melebihi stok ditolak.
  r = await minta('POST', '/api/penjualan', { kanal: 'TikTok Shop', sesi_id: sesiId, item: [{ produk_id: produkId, jumlah: 4 }] });
  assert.equal(r.status, 201);
  const penjualanId = (r.data as { id: number }).id;
  assert.equal((r.data as { total: number }).total, 180_000);
  r = await minta('POST', '/api/penjualan', { kanal: 'TikTok Shop', item: [{ produk_id: produkId, jumlah: 99 }] });
  assert.equal(r.status, 409);
  assert.equal((await minta('POST', `/api/live/${sesiId}/selesai`)).status, 200);

  // Retur: satu layak jual kembali ke stok, satu rusak tidak.
  const detail = (await minta('GET', `/api/penjualan/${penjualanId}`)).data as { item: { id: number }[] };
  r = await minta('POST', '/api/retur', {
    penjualan_id: penjualanId,
    alasan: 'Kemasan penyok saat pengiriman',
    item: [
      { item_penjualan_id: detail.item[0].id, jumlah: 1, kondisi: 'layak_jual' },
      { item_penjualan_id: detail.item[0].id, jumlah: 1, kondisi: 'rusak' },
    ],
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  stok = (await minta('GET', '/api/stok')).data as { daftar: { id: number; stok: number }[] };
  assert.equal(stok.daftar.find((p) => p.id === produkId)!.stok, 12);

  // Dana tanpa potongan jasa: 180.000 − retur 90.000 = 90.000 siap dicairkan.
  let dana = (await minta('GET', '/api/dana')).data as { daftar: { umkmId: number; siapCair: number }[] };
  assert.equal(dana.daftar.find((d) => d.umkmId === umkmId)!.siapCair, 90_000);
  r = await minta('POST', '/api/dana/pencairan', { umkm_id: umkmId });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const cairId = (r.data as { id: number }).id;
  assert.equal((await minta('POST', `/api/dana/pencairan/${cairId}/bayar`, { referensi_transfer: 'TRF-001' })).status, 200);
  dana = (await minta('GET', '/api/dana')).data as { daftar: { umkmId: number; siapCair: number }[] };
  assert.equal(dana.daftar.find((d) => d.umkmId === umkmId)!.siapCair, 0);
  assert.equal((await minta('POST', '/api/dana/pencairan', { umkm_id: umkmId })).status, 409);

  // Ekspor XLSX dan CSV.
  r = await minta('GET', '/api/ekspor/penjualan?format=xlsx');
  assert.equal(r.status, 200);
  assert.match(r.jenis, /spreadsheetml/);
  assert.equal(Buffer.from(r.data as ArrayBuffer).subarray(0, 2).toString(), 'PK');
  r = await minta('GET', '/api/ekspor/dana?format=csv');
  assert.equal(r.status, 200);
  assert.match(Buffer.from(r.data as ArrayBuffer).toString('utf8'), /Kopi Lereng Arjuno/);
});

test('staf ruangan tampil di data gedung dan bisa diubah admin', async () => {
  const tim = db.prepare("SELECT * FROM ruangan WHERE kode = '2.03'").get() as { id: number; nama: string; lebar: number; panjang: number; x: number; z: number; sisi_pintu: string };
  let gedung = (await minta('GET', '/api/publik/gedung')).data as { ruangan: { kode: string; staf: { nama: string; perempuan: boolean }[] }[] };
  assert.deepEqual(
    gedung.ruangan.find((r) => r.kode === '2.03')!.staf.map((s) => s.nama),
    ['Bang Jack', 'Didin', 'Achmad', 'Devita'],
  );
  const dasar = { nama: tim.nama, lebar: tim.lebar, panjang: tim.panjang, x: tim.x, z: tim.z, sisi_pintu: tim.sisi_pintu };
  let r = await minta('PUT', `/api/pengaturan/ruangan/${tim.id}`, { ...dasar, staf: [{ nama: '  ', perempuan: false }] });
  assert.equal(r.status, 400);
  r = await minta('PUT', `/api/pengaturan/ruangan/${tim.id}`, { ...dasar, staf: [{ nama: 'Devita', perempuan: true }, { nama: 'Rina', perempuan: true }] });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  gedung = (await minta('GET', '/api/publik/gedung')).data as typeof gedung;
  assert.deepEqual(gedung.ruangan.find((r) => r.kode === '2.03')!.staf, [
    { nama: 'Devita', perempuan: true },
    { nama: 'Rina', perempuan: true },
  ]);
});

test('pengguna tanpa sesi tidak bisa membaca data pengelolaan', async () => {
  const res = await app.request('/api/umkm');
  assert.equal(res.status, 401);
});
