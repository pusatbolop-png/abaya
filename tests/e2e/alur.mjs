// Uji ujung ke ujung di peramban sungguhan atas build produksi dengan basis data kosong:
// siapkan admin → daftar UMKM → seleksi → stok → live → penjualan → retur → dana → ekspor.
// Setiap halaman diperiksa axe-core (WCAG 2.1 A/AA) dan galat konsol dicatat.
// Jalankan: npm run build && npm run e2e
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const axeSumber = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PORT = 8095;
const BASE = `http://localhost:${PORT}`;
const DATA = path.resolve('data-test');
const ARTEFAK = path.resolve('artifacts/e2e');
fs.rmSync(DATA, { recursive: true, force: true });
fs.mkdirSync(ARTEFAK, { recursive: true });

const server = spawn('node', ['dist/server/index.js'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), DATA_DIR: DATA, COOKIE_SECURE: 'false' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
for (let i = 0; i < 50; i++) {
  try {
    await fetch(`${BASE}/api/publik/info`);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}

const galatKonsol = [];
const pelanggaran = new Map();
const langkah = [];
let gagal = false;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function konteksBaru(hp = false) {
  const ctx = await browser.newContext({
    viewport: hp ? { width: 390, height: 844 } : { width: 1366, height: 900 },
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    acceptDownloads: true,
    // Hanya agar axe-core bisa disuntikkan; CSP aplikasi sendiri tetap ketat.
    bypassCSP: true,
  });
  await ctx.addInitScript(() => localStorage.setItem('pcc.pembuka.v1', '1'));
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') galatKonsol.push(`${page.url()} — ${m.text()}`);
  });
  page.on('pageerror', (e) => galatKonsol.push(`${page.url()} — ${e.message}`));
  return { ctx, page };
}

async function periksaAksesibilitas(page, nama) {
  // Tunggu animasi lembar atau toast selesai agar kontras tidak terbaca setengah transparan.
  await page.waitForTimeout(400);
  await page.addScriptTag({ content: axeSumber });
  const hasil = await page.evaluate(async () =>
    // eslint-disable-next-line no-undef
    (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map((v) => ({
      id: v.id,
      dampak: v.impact,
      bantuan: v.help,
      node: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    })),
  );
  for (const v of hasil) pelanggaran.set(`${nama}: ${v.id}`, v);
}

async function jalan(nama, fn) {
  const t = Date.now();
  try {
    await fn();
    langkah.push(`✓ ${nama} (${Date.now() - t} ms)`);
  } catch (e) {
    gagal = true;
    langkah.push(`✗ ${nama}: ${e.message.split('\n')[0]}`);
    let n = 0;
    for (const c of browser.contexts()) for (const pg of c.pages()) await pg.screenshot({ path: path.join(ARTEFAK, `gagal-${++n}.png`), fullPage: true }).catch(() => {});
    throw e;
  }
}

const toast = (page, teks) => page.locator('.toast', { hasText: teks }).first().waitFor({ timeout: 8000 });
const lembar = (page) => page.locator('dialog.lembar[open]');

try {
  const { page } = await konteksBaru();

  await jalan('Akun administrator pertama disiapkan', async () => {
    await page.goto(`${BASE}/masuk`);
    await page.waitForURL('**/siapkan');
    await periksaAksesibilitas(page, 'siapkan');
    await page.getByLabel('Nama lengkap').fill('Admin Uji');
    await page.getByLabel('Email dinas').fill('admin@uji.pcc');
    await page.getByLabel('Kata sandi').fill('sandiuji12345');
    await page.getByRole('button', { name: 'Buat akun administrator' }).click();
    await page.waitForURL('**/kelola/pengaturan');
  });

  await jalan('Profil lembaga dan instansi perizinan diisi', async () => {
    await page.getByRole('heading', { name: 'Lengkapi sebelum diluncurkan' }).waitFor();
    await periksaAksesibilitas(page, 'pengaturan');
    await page.getByLabel('Nomor WhatsApp resmi').fill('0811 2222 3333');
    await page.getByRole('button', { name: 'Simpan profil lembaga' }).click();
    await toast(page, 'Profil lembaga tersimpan');
    await page.getByRole('tab', { name: 'Instansi perizinan' }).click();
    const instansi = page.getByLabel('Instansi penerbit');
    await instansi.nth(0).fill('Instansi Uji Satu');
    await instansi.nth(1).fill('Instansi Uji Dua');
    await instansi.nth(2).fill('Instansi Uji Tiga');
    await page.getByRole('button', { name: 'Simpan instansi perizinan' }).click();
    await toast(page, 'Instansi perizinan tersimpan');
  });

  // Pendaftar memakai peramban lain tanpa sesi, di ukuran ponsel.
  const pendaftar = await konteksBaru(true);
  const p2 = pendaftar.page;
  let kode = '';
  const berkasPdf = path.join(ARTEFAK, 'nib-uji.pdf');
  fs.writeFileSync(berkasPdf, '%PDF-1.4\n% berkas uji\n');

  await jalan('UMKM mendaftar lewat formulir publik (ponsel)', async () => {
    await p2.goto(BASE);
    await periksaAksesibilitas(p2, 'beranda');
    await p2.getByRole('link', { name: 'Daftarkan usaha Anda' }).click();
    await p2.waitForURL('**/daftar');
    // Kirim kosong dulu: galat tampil dan fokus pindah ke kolom pertama yang salah.
    await p2.getByRole('button', { name: 'Kirim pendaftaran' }).click();
    await p2.getByText('Nama usaha wajib diisi.').waitFor();
    await periksaAksesibilitas(p2, 'daftar (galat)');
    await p2.getByLabel('Nama usaha').fill('Dodol Mangga Bangil');
    await p2.getByLabel('Kategori').selectOption('Kuliner');
    await p2.getByLabel('Ceritakan produk Anda').fill('Dodol dari mangga gadung Pasuruan, tanpa pengawet, 200 pak per minggu.');
    await p2.getByLabel('Nama pemilik', { exact: true }).fill('Lestari Wulandari');
    await p2.getByLabel('Nomor WhatsApp', { exact: true }).fill('0813 1111 2222');
    await p2.getByLabel('Alamat', { exact: true }).fill('Jl. Gajah Mada 3, Bangil');
    await p2.getByLabel('Kecamatan', { exact: true }).fill('Bangil');
    await p2.locator('input[name="izin_izin_1_nomor"]').fill('9120001234567');
    await p2.locator('input[name="izin_izin_1_berkas"]').setInputFiles(berkasPdf);
    await p2.getByLabel(/^Bank/).fill('Bank Jatim');
    await p2.getByLabel(/^Nomor rekening/).fill('0099887766');
    await p2.getByLabel('Nama pemilik rekening').fill('Lestari Wulandari');
    await p2.getByRole('checkbox').check();
    await p2.getByRole('button', { name: 'Kirim pendaftaran' }).click();
    await p2.waitForURL('**/daftar/terkirim/**');
    kode = decodeURIComponent(p2.url().split('/').pop());
    await periksaAksesibilitas(p2, 'terkirim');
    if (!/^UMKM-\d{2}-\d{4}$/.test(kode)) throw new Error(`Kode tidak sesuai: ${kode}`);
  });

  await jalan('Pendaftar mengecek status: menunggu seleksi', async () => {
    await p2.getByRole('link', { name: 'Cek status pendaftaran' }).click();
    await p2.getByLabel('Kode pendaftaran').fill(kode);
    await p2.getByLabel('Nomor WhatsApp', { exact: true }).fill('081311112222');
    await p2.getByRole('button', { name: 'Lihat status' }).click();
    await p2.getByRole('heading', { name: 'Menunggu seleksi' }).waitFor();
    await periksaAksesibilitas(p2, 'status');
  });

  await jalan('Admin memverifikasi NIB dan menerima UMKM', async () => {
    await page.goto(`${BASE}/kelola/umkm`);
    await periksaAksesibilitas(page, 'daftar umkm');
    await page.getByRole('link', { name: 'Dodol Mangga Bangil' }).click();
    await page.getByRole('heading', { name: 'Dokumen izin' }).waitFor();
    await periksaAksesibilitas(page, 'detail umkm');
    await page.getByRole('button', { name: 'Periksa' }).first().click();
    await lembar(page).getByLabel('Hasil pemeriksaan').selectOption('terverifikasi');
    await lembar(page).getByRole('button', { name: 'Simpan hasil pemeriksaan' }).click();
    await toast(page, 'tersimpan');
    for (const kr of ['skor-mutu', 'skor-kemasan', 'skor-kapasitas', 'skor-pasar']) await page.locator(`input[name="${kr}"][value="4"]`).check({ force: true });
    await page.getByRole('radio', { name: /Terima/ }).check();
    await page.getByRole('button', { name: 'Terima UMKM ini' }).click();
    await toast(page, 'Keputusan seleksi');
    await page.locator('.status-besar', { hasText: 'Diterima' }).waitFor();
  });

  await jalan('Produk ditambahkan dengan stok awal', async () => {
    await page.getByRole('button', { name: 'Tambah produk' }).first().click();
    const l = lembar(page);
    await l.getByLabel('Nama produk').fill('Dodol Mangga 250 g');
    await l.getByLabel('Harga jual').fill('35000');
    await l.getByLabel('Stok awal yang dititipkan').fill('10');
    await l.getByRole('button', { name: 'Simpan produk' }).click();
    await toast(page, 'Produk Dodol Mangga 250 g ditambahkan');
  });

  await jalan('Barang masuk dicatat di stok', async () => {
    await page.goto(`${BASE}/kelola/stok`);
    await periksaAksesibilitas(page, 'stok');
    await page.getByRole('button', { name: 'Catat barang masuk' }).click();
    const l = lembar(page);
    await l.getByLabel('Produk', { exact: true }).selectOption({ label: 'Dodol Mangga 250 g — stok 10' });
    await l.getByLabel('Jumlah', { exact: true }).fill('5');
    await l.getByRole('button', { name: 'Simpan barang masuk' }).click();
    await toast(page, 'Barang masuk dari UMKM');
    await page.getByRole('cell', { name: '15 pcs' }).waitFor();
  });

  await jalan('Sesi live dijadwalkan lalu dimulai (ON AIR)', async () => {
    await page.goto(`${BASE}/kelola/live`);
    await page.getByText('Belum ada sesi live hari ini.').waitFor();
    await periksaAksesibilitas(page, 'live kosong');
    await page.getByRole('button', { name: 'Tambah sesi' }).click();
    const l = lembar(page);
    await l.getByLabel('Judul sesi').fill('Dodol Mangga Sore');
    await l.getByLabel('Studio', { exact: true }).selectOption({ index: 1 });
    await l.getByLabel('Platform').selectOption('TikTok Shop');
    await l.getByLabel('Host', { exact: true }).fill('Rani');
    // Mulai dari sekarang agar sesi termasuk hari ini.
    const kini = await page.evaluate(() => {
      const d = new Date(Date.now() + 7 * 3600_000);
      return d.toISOString().slice(0, 16);
    });
    await l.getByLabel('Tanggal', { exact: true }).fill(kini.slice(0, 10));
    await l.getByLabel('Mulai', { exact: true }).fill(kini.slice(11, 13) + ':00');
    await l.getByLabel('Selesai', { exact: true }).fill(kini.slice(11, 13) === '23' ? '23:55' : String(Number(kini.slice(11, 13)) + 1).padStart(2, '0') + ':00');
    await l.getByRole('checkbox', { name: /Dodol Mangga 250 g/ }).check();
    await l.getByRole('button', { name: 'Simpan jadwal' }).click();
    await toast(page, 'dijadwalkan');
    await page.getByRole('button', { name: 'Mulai siaran' }).click();
    await toast(page, 'Lampu ON AIR menyala');
    await page.locator('.papan-sesi .on-air').waitFor();
    await periksaAksesibilitas(page, 'live');
  });

  await jalan('Denah 3D menampilkan studio yang sedang siaran', async () => {
    await page.goto(`${BASE}/kelola/gedung`);
    await page.locator('canvas[aria-label*="1 studio sedang siaran"]').waitFor({ timeout: 15000 });
    await page.locator('.g3-daftar .on-air').waitFor();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(ARTEFAK, 'gedung-siaran.png') });
    await periksaAksesibilitas(page, 'gedung');
  });

  let nomorPenjualan = '';
  await jalan('Penjualan dicatat dari sesi live', async () => {
    await page.goto(`${BASE}/kelola/live`);
    await page.getByRole('link', { name: 'Catat penjualan' }).click();
    const l = lembar(page);
    await l.getByLabel('Produk 1', { exact: true }).selectOption({ index: 1 });
    await l.getByLabel('Jumlah', { exact: true }).fill('3');
    await l.getByLabel('Nomor pesanan di platform').fill('578800123');
    await l.getByRole('button', { name: 'Simpan penjualan' }).click();
    const t = page.locator('.toast', { hasText: 'Penjualan PJ-' });
    await t.waitFor();
    nomorPenjualan = (await t.textContent()).match(/PJ-\d{6}-\d{4}/)[0];
    await page.getByText('Rp 105.000').first().waitFor();
    await periksaAksesibilitas(page, 'detail live');
  });

  await jalan('Siaran diakhiri lewat dialog konfirmasi', async () => {
    await page.getByRole('button', { name: 'Akhiri siaran' }).click();
    await page.locator('dialog.konfirmasi[open]').getByRole('button', { name: 'Akhiri siaran' }).click();
    await toast(page, 'diakhiri');
  });

  await jalan('Retur satu barang layak jual', async () => {
    await page.goto(`${BASE}/kelola/retur`);
    await periksaAksesibilitas(page, 'retur');
    await page.getByRole('button', { name: 'Catat retur' }).first().click();
    await lembar(page).getByLabel(/Nomor penjualan/).fill(nomorPenjualan);
    await lembar(page).getByRole('button', { name: 'Cari penjualan' }).click();
    await lembar(page).getByRole('button', { name: new RegExp(nomorPenjualan) }).click();
    const l = lembar(page);
    await l.getByLabel('Jumlah diretur').fill('1');
    await l.getByLabel('Alasan retur').fill('Pembeli salah pilih varian');
    await l.getByRole('button', { name: 'Simpan retur' }).click();
    await toast(page, 'Retur RT-');
    await page.getByRole('cell', { name: 'Pembeli salah pilih varian' }).waitFor();
  });

  await jalan('Dana disiapkan dan ditandai sudah ditransfer', async () => {
    await page.goto(`${BASE}/kelola/dana`);
    await periksaAksesibilitas(page, 'dana');
    await page.getByRole('cell', { name: /Rp 70\.000/ }).first().waitFor();
    await page.getByRole('button', { name: 'Siapkan pencairan' }).click();
    await lembar(page).getByRole('button', { name: /Siapkan pencairan Rp 70\.000/ }).click();
    await toast(page, 'disiapkan');
    await page.getByRole('tab', { name: /Riwayat pencairan/ }).click();
    await page.getByRole('button', { name: 'Tandai sudah ditransfer' }).click();
    await lembar(page).getByLabel('Nomor referensi transfer').fill('TRF-UJI-0001');
    await lembar(page).getByRole('button', { name: 'Simpan bukti transfer' }).click();
    await toast(page, 'ditandai sudah ditransfer');
    await page.getByText('Sudah ditransfer').first().waitFor();
  });

  await jalan('Ekspor laporan penjualan ke Excel dan CSV', async () => {
    await page.goto(`${BASE}/kelola/laporan`);
    await periksaAksesibilitas(page, 'laporan');
    const [unduh] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Unduh Excel' }).first().click()]);
    const tujuan = path.join(ARTEFAK, unduh.suggestedFilename());
    await unduh.saveAs(tujuan);
    if (fs.readFileSync(tujuan).subarray(0, 2).toString() !== 'PK') throw new Error('Berkas Excel tidak valid');
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Unduh CSV' }).nth(1).click()]);
    const isi = fs.readFileSync(await csv.path(), 'utf8');
    if (!isi.includes('Dodol Mangga Bangil')) throw new Error('CSV dana tidak memuat UMKM');
  });

  await jalan('Pendaftar melihat status diterima', async () => {
    await p2.goto(`${BASE}/status`);
    await p2.getByLabel('Kode pendaftaran').fill(kode);
    await p2.getByLabel('Nomor WhatsApp', { exact: true }).fill('081311112222');
    await p2.getByRole('button', { name: 'Lihat status' }).click();
    await p2.getByRole('heading', { name: 'Diterima' }).waitFor();
  });

  await jalan('Navigasi papan ketik: lompat ke isi, lembar terbuka dan tertutup dengan Escape', async () => {
    await page.goto(`${BASE}/kelola/penjualan`);
    await page.getByRole('heading', { name: 'Penjualan', exact: true }).waitFor();
    await page.keyboard.press('Tab');
    const fokus = await page.evaluate(() => document.activeElement?.textContent);
    if (!fokus?.includes('Lompat ke isi')) throw new Error(`Fokus pertama bukan tautan lompat: ${fokus}`);
    const tombol = page.getByRole('button', { name: 'Catat penjualan' });
    await tombol.focus();
    await page.keyboard.press('Enter');
    await lembar(page).waitFor();
    const diDalam = await page.evaluate(() => !!document.activeElement?.closest('dialog[open]'));
    if (!diDalam) throw new Error('Fokus tidak berpindah ke dalam lembar');
    await page.keyboard.press('Escape');
    await page.locator('dialog.lembar[open]').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
    if (await page.locator('dialog.lembar[open]').count()) throw new Error('Lembar tidak tertutup dengan Escape');
  });

  await jalan('Halaman lain lolos pemeriksaan aksesibilitas', async () => {
    for (const j of ['/kelola', '/kelola/penjualan', '/kelola/pengaturan?bagian=ruangan', '/kelola/pengaturan?bagian=pengguna']) {
      await page.goto(BASE + j);
      await page.waitForLoadState('networkidle');
      await periksaAksesibilitas(page, j);
    }
  });
} catch {
  /* dicatat di langkah */
} finally {
  await browser.close();
  server.kill();
}

console.log('\nLangkah:\n' + langkah.join('\n'));
console.log(`\nGalat konsol: ${galatKonsol.length}`);
galatKonsol.forEach((g) => console.log('  ' + g));
console.log(`\nPelanggaran aksesibilitas (axe, WCAG 2.1 AA): ${pelanggaran.size}`);
for (const [k, v] of pelanggaran) console.log(`  ${k} [${v.dampak}] ${v.bantuan} → ${v.node.join(' | ')}`);
if (gagal || galatKonsol.length || pelanggaran.size) process.exit(1);
