// Membuat pratinjau statis: satu berkas HTML mandiri yang bisa dibuka di ponsel atau PC tanpa server.
// Langkahnya: jalankan server demo sementara, rekam semua respons yang dibaca antarmuka, lalu bangun
// aplikasi dengan tiruan API (src/pratinjau) dan sematkan skrip, gaya, huruf, serta logo ke satu berkas.
// Hasil: dist/pratinjau/pcc-pratinjau.html
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import Database from 'better-sqlite3';

const PORT = 8097;
const ASAL = `http://localhost:${PORT}`;
const KELUAR = path.resolve('dist/pratinjau');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-pratinjau-'));
fs.mkdirSync(KELUAR, { recursive: true });

if (!fs.existsSync('dist/client/index.html')) throw new Error('Jalankan `npm run build` lebih dulu.');
const server = spawn('npx', ['tsx', 'server/demo.ts'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), DATA_DIR: dataDir, COOKIE_SECURE: 'false' },
  stdio: 'ignore',
  detached: true,
});
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${ASAL}/api/publik/info`)).ok) break;
    } catch {}
    if (i > 80) throw new Error('Server demo tidak menyala.');
    await new Promise((r) => setTimeout(r, 250));
  }
  await rekam(path.join(KELUAR, 'rekaman.json'));
} finally {
  process.kill(-server.pid);
}

execFileSync('npx', ['vite', 'build', '--config', 'vite.pratinjau.config.ts'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_PRATINJAU: '1', PCC_REKAMAN: path.join(KELUAR, 'rekaman.json') },
});
satukan(path.join(KELUAR, 'vite'), path.join(KELUAR, 'pcc-pratinjau.html'));
fs.rmSync(dataDir, { recursive: true, force: true });

async function rekam(berkas) {
  const rekaman = {};
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('response', async (res) => {
    const u = new URL(res.url());
    if (res.request().method() !== 'GET' || !u.pathname.startsWith('/api/')) return;
    if (!(res.headers()['content-type'] ?? '').includes('json')) return;
    try {
      rekaman[u.pathname + u.search] = { status: res.status(), isi: await res.json() };
    } catch {}
  });
  const kunjungi = async (p) => {
    await page.goto(ASAL + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
  };
  const ambil = async (p) => {
    const r = await page.request.get(ASAL + p, { headers: { 'x-pcc': '1' } });
    rekaman[p] = { status: r.status(), isi: await r.json() };
    return rekaman[p].isi;
  };
  const daftarDari = (awalan) => Object.entries(rekaman).find(([k]) => k.startsWith(awalan))?.[1].isi.daftar ?? [];

  await kunjungi('/');
  await kunjungi('/masuk');
  await page.fill('input[type=email]', 'admin@demo.pcc');
  await page.fill('input[type=password]', 'demo-pcc-2026');
  await page.click('button[type=submit]');
  await page.waitForURL(/kelola/);
  const admin = await ambil('/api/auth/saya');
  for (const p of ['/kelola', '/kelola/gedung', '/kelola/umkm', '/kelola/stok', '/kelola/live', '/kelola/penjualan', '/kelola/retur', '/kelola/dana', '/kelola/laporan', '/kelola/pengaturan'])
    await kunjungi(p);
  for (const p of ['/api/stok/mutasi', '/api/pengguna']) await ambil(p);
  const umkm = await ambil('/api/umkm?');
  for (const s of Object.keys(umkm.hitung)) await ambil('/api/umkm?' + new URLSearchParams({ status: s }));
  for (const u of umkm.daftar) await kunjungi('/kelola/umkm/' + u.id);
  for (const s of daftarDari('/api/live?')) await kunjungi('/kelola/live/' + s.id);
  for (const s of daftarDari('/api/penjualan?')) await ambil('/api/penjualan/' + s.id);

  const db = new Database(path.join(dataDir, 'pcc.sqlite'), { readonly: true });
  const status = {};
  for (const { kode, whatsapp } of db.prepare('SELECT kode, whatsapp FROM umkm').all()) {
    const r = await page.request.post(ASAL + '/api/publik/status', { headers: { 'x-pcc': '1' }, data: { kode, whatsapp } });
    status[kode] = { whatsapp, isi: await r.json() };
  }
  db.close();
  await browser.close();
  fs.writeFileSync(berkas, JSON.stringify({ direkam: new Date().toISOString(), admin, rekaman, status }));
  console.log(`Merekam ${Object.keys(rekaman).length} respons dan ${Object.keys(status).length} kode pendaftaran.`);
}

function satukan(dir, tujuan) {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const js = html.match(/<script type="module" crossorigin src="\/([^"]+)"><\/script>/)[1];
  const css = html.match(/<link rel="stylesheet" crossorigin href="\/([^"]+)">/)[1];
  const judul = html.match(/<title>.*<\/title>/)[0];
  const deskripsi = html.match(/<meta name="description"[^>]*>/)[0];
  const skrip = fs.readFileSync(path.join(dir, js), 'utf8').replaceAll('</script', '<\\/script');
  const gaya = fs.readFileSync(path.join(dir, css), 'utf8').replaceAll('</style', '<\\/style');
  const isi = `${judul}\n${deskripsi}\n<style>${gaya}</style>\n<div id="akar"></div>\n<script type="module">${skrip}</script>\n`;
  fs.writeFileSync(tujuan, isi);
  console.log(`Pratinjau: ${path.relative(process.cwd(), tujuan)} (${(isi.length / 1e6).toFixed(1)} MB)`);
}
