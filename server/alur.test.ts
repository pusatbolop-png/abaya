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

test('program Blueprint: inkubasi, omzet, konten, affiliate, dan dasbor kinerja', async () => {
  const u = db.prepare("SELECT id FROM umkm WHERE status = 'diterima' LIMIT 1").get() as { id: number };
  const p = db.prepare('SELECT id, nama, harga, satuan FROM produk WHERE umkm_id = ? LIMIT 1').get(u.id) as { id: number; nama: string; harga: number; satuan: string };

  // Program belum punya tanggal mulai: roadmap belum berjalan, target bawaan dari Blueprint.
  let d = (await minta('GET', '/api/dasbor')).data as {
    program: { hariKe: number | null; target: Record<string, number> };
    target: { kunci: string; nilai: number | null; target: number }[];
    alur: { kunci: string; nilai: number }[];
  };
  assert.equal(d.program.hariKe, null);
  assert.deepEqual(d.target.map((t) => t.target), [100, 30, 5, 100, 3000, 20]);
  const nilai = (k: string) => d.target.find((t) => t.kunci === k)!.nilai;
  assert.equal(nilai('terinkubasi'), 0);
  assert.equal(nilai('produkNasional'), 0);
  assert.equal(nilai('studioAktif'), 1);
  assert.equal(nilai('omzet'), null);

  let r = await minta('PUT', '/api/pengaturan/program', { mulai: '2099-01-01', target: { terinkubasi: 0, produkNasional: 30, studioAktif: 5, affiliate: 100, kontenPerTahun: 3000, kenaikanOmzet: 20 } });
  assert.equal(r.status, 400);
  const mulai = new Date(Date.now() + 7 * 3600_000 - 9 * 86_400_000).toISOString().slice(0, 10);
  r = await minta('PUT', '/api/pengaturan/program', { mulai, target: { terinkubasi: 50, produkNasional: 30, studioAktif: 5, affiliate: 100, kontenPerTahun: 3000, kenaikanOmzet: 20 } });
  assert.equal(r.status, 200, JSON.stringify(r.data));

  // Inkubasi: semua langkah tuntas (HAKI tidak berlaku) → terhitung terinkubasi.
  assert.equal((await minta('PUT', `/api/umkm/${u.id}/inkubasi/bukan-langkah`, { status: 'selesai' })).status, 404);
  for (const k of ['nib', 'pirt', 'halal', 'haki', 'kemasan', 'marketplace', 'produksi']) {
    r = await minta('PUT', `/api/umkm/${u.id}/inkubasi/${k}`, { status: k === 'haki' ? 'tidak_berlaku' : 'selesai' });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }

  // Produk prioritas yang terjual lewat TikTok Shop menembus pasar nasional.
  r = await minta('PATCH', `/api/produk/${p.id}`, { nama: p.nama, harga: p.harga, satuan: p.satuan, aktif: true, prioritas: true, tautan_toko: 'bukan tautan' });
  assert.equal(r.status, 400);
  r = await minta('PATCH', `/api/produk/${p.id}`, { nama: p.nama, harga: p.harga, satuan: p.satuan, aktif: true, prioritas: true, tautan_toko: 'https://shop.tiktok.com/view/product/kopi' });
  assert.equal(r.status, 200, JSON.stringify(r.data));

  // Omzet: awal 8 juta, laporan bulan ini 10,4 juta → +30%.
  assert.equal((await minta('PUT', `/api/umkm/${u.id}/omzet-awal`, { omzet_awal: 8_000_000 })).status, 200);
  const bulan = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  assert.equal((await minta('POST', `/api/umkm/${u.id}/omzet`, { bulan: '2099-01', omzet: 1 })).status, 400);
  assert.equal((await minta('POST', `/api/umkm/${u.id}/omzet`, { bulan, omzet: 9_000_000 })).status, 201);
  // Laporan bulan yang sama menimpa, bukan menggandakan.
  assert.equal((await minta('POST', `/api/umkm/${u.id}/omzet`, { bulan, omzet: 10_400_000 })).status, 201);
  const detail = (await minta('GET', `/api/umkm/${u.id}`)).data as { laporanOmzet: { omzet: number }[]; inkubasi: { status: string }[] };
  assert.deepEqual(detail.laporanOmzet.map((l) => l.omzet), [10_400_000]);
  assert.equal(detail.inkubasi.filter((i) => i.status === 'belum').length, 0);

  // Content Factory: tiga konten sekaligus; produk harus milik UMKM yang dipilih.
  const hariIni = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  r = await minta('POST', '/api/konten', { jenis: 'video', judul: 'Seduh kopi', produk_id: p.id, tanggal: hariIni });
  assert.equal(r.status, 400);
  r = await minta('POST', '/api/konten', { jenis: 'video', judul: 'Seduh kopi', umkm_id: u.id, produk_id: p.id, platform: 'TikTok', tautan: '', tanggal: hariIni, jumlah: 3 });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const konten = (await minta('GET', `/api/konten?bulan=${hariIni.slice(0, 7)}`)).data as { daftar: { id: number; judul: string }[]; hitung: Record<string, number> };
  assert.equal(konten.hitung.video, 3);
  assert.equal((await minta('DELETE', `/api/konten/${konten.daftar[0].id}`)).status, 200);

  // Affiliate: nomor WhatsApp unik; status jeda tidak dihitung aktif.
  const af = { nama: 'Bayu Prakoso', whatsapp: '0857 1234 9876', platform: 'TikTok', akun: '@bayu', bergabung: hariIni };
  r = await minta('POST', '/api/affiliate', af);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal((await minta('POST', '/api/affiliate', { ...af, nama: 'Bayu Lain', whatsapp: '6285712349876' })).status, 409);
  r = await minta('POST', '/api/affiliate', { ...af, nama: 'Citra', whatsapp: '0812 0000 1111', status: 'jeda' });
  assert.equal(r.status, 201);

  d = (await minta('GET', '/api/dasbor')).data as typeof d;
  assert.equal(d.program.hariKe, 10);
  assert.equal(nilai('terinkubasi'), 1);
  assert.equal(d.target.find((t) => t.kunci === 'terinkubasi')!.target, 50);
  assert.equal(nilai('produkNasional'), 1);
  assert.equal(nilai('affiliate'), 1);
  assert.equal(nilai('konten'), 2);
  assert.equal(nilai('omzet'), 30);
  assert.equal(d.alur.find((a) => a.kunci === 'evaluasi')!.nilai, 1);
});

test('pengguna tanpa sesi tidak bisa membaca data pengelolaan', async () => {
  for (const url of ['/api/umkm', '/api/dasbor', '/api/konten', '/api/affiliate']) assert.equal((await app.request(url)).status, 401, url);
});
