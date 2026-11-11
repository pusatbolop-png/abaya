// Uji menyeluruh: menekan setiap tombol dan fitur untuk semua peran, memeriksa tata letak di lima lebar layar,
// dan memindai aksesibilitas (axe-core). Jalankan setelah `npm run build`: `npm run uji:menyeluruh`.
// Semua pemeriksaan tetap berjalan walau ada yang gagal, lalu daftar kegagalan ditampilkan di akhir.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const PORT = 8094;
const ASAL = `http://localhost:${PORT}`;
const SANDI = 'demo-wafa-2026';
const SANDI_WALI = 'wafa2026';
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'madin-menyeluruh-'));
if (!fs.existsSync('dist/client/index.html')) throw new Error('Jalankan `npm run build` lebih dulu.');

const server = spawn('npx', ['tsx', 'server/demo.ts'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), DATA_DIR: dataDir },
  stdio: 'ignore',
  detached: true,
});

const hasil = [];
const galatKonsol = [];
let bagian = '';
let halamanAktif = null;
let nomorFoto = 0;
async function cek(nama, fn) {
  const label = `${bagian} › ${nama}`;
  try {
    await fn();
    hasil.push({ ok: true, label });
    process.stdout.write('.');
  } catch (e) {
    hasil.push({ ok: false, label, pesan: String(e.message ?? e).split('\n')[0].slice(0, 220) });
    process.stdout.write('F');
    // FOTO_GAGAL=<folder>: simpan tangkapan layar setiap pemeriksaan yang gagal.
    if (process.env.FOTO_GAGAL && halamanAktif) {
      await halamanAktif.screenshot({ path: `${process.env.FOTO_GAGAL}/${String(++nomorFoto).padStart(2, '0')}.png` }).catch(() => {});
    }
  }
}
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
function harus(kondisi, pesan) {
  if (!kondisi) throw new Error(pesan);
}

let browser;
async function konteks(lebar = 1366, tinggi = 900) {
  // bypassCSP hanya agar pemindai axe bisa disisipkan; aplikasi sendiri tetap memakai CSP ketat.
  const ctx = await browser.newContext({ viewport: { width: lebar, height: tinggi }, bypassCSP: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ASAL });
  await ctx.addInitScript(() => {
    window.__cetak = 0;
    window.print = () => {
      window.__cetak++;
    };
  });
  const page = await ctx.newPage();
  halamanAktif = page;
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => galatKonsol.push(`${bagian}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) galatKonsol.push(`${bagian}: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 500) galatKonsol.push(`${bagian}: ${r.status()} ${r.url()}`);
  });
  return { ctx, page };
}

async function masuk(page, jenis, id, sandi) {
  await page.goto(ASAL + '/');
  await page.getByRole('tab', { name: jenis === 'wali' ? 'Wali santri' : 'Pengurus' }).click();
  await page.getByLabel(jenis === 'wali' ? 'Nomor Induk Santri (NIS)' : 'Nama pengguna').fill(id);
  await page.getByLabel('Sandi', { exact: true }).fill(sandi);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await page.waitForURL(jenis === 'wali' ? '**/wali' : '**/admin');
}

const toast = (page, teks) => page.locator('.toast').filter({ hasText: teks }).first().waitFor();
const dialog = (page) => page.getByRole('dialog');

async function lebarAman(page, label) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  harus(o.sw <= o.cw + 1, `${label}: halaman melebar ${o.sw}px > layar ${o.cw}px`);
}

async function aksesibel(page, label) {
  await page.addScriptTag({ content: AXE });
  const pelanggaran = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'], resultTypes: ['violations'] });
    return r.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target?.join(' ')}`);
  });
  harus(!pelanggaran.length, `${label}: ${pelanggaran.join(' | ')}`);
}

try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${ASAL}/api/publik/lembaga`)).ok) break;
    } catch {}
    if (i > 160) throw new Error('Server demo tidak menyala.');
    await tunggu(250);
  }
  const demo = await (await fetch(`${ASAL}/api/auth/saya`)).json();
  const NIS = demo.demo.nis;
  browser = await chromium.launch().catch(() => chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' }));

  // ——————————————————— Halaman umum ———————————————————
  bagian = 'Umum';
  {
    const { ctx, page } = await konteks();
    await cek('halaman masuk tampil dengan logo', async () => {
      await page.goto(ASAL + '/');
      await page.locator('.masuk__logo').waitFor();
      const lebar = await page.locator('.masuk__logo').evaluate((img) => img.naturalWidth);
      harus(lebar > 0, 'logo tidak termuat');
    });
    await cek('tab pengurus/wali mengganti label isian', async () => {
      await page.getByRole('tab', { name: 'Pengurus' }).click();
      await page.getByLabel('Nama pengguna').waitFor();
      await page.getByRole('tab', { name: 'Wali santri' }).click();
      await page.getByLabel('Nomor Induk Santri (NIS)').waitFor();
    });
    await cek('tombol mata menampilkan dan menyembunyikan sandi', async () => {
      const sandi = page.getByLabel('Sandi', { exact: true });
      await sandi.fill('rahasia');
      await page.getByRole('button', { name: 'Tampilkan sandi' }).click();
      harus((await sandi.getAttribute('type')) === 'text', 'sandi tidak tampil');
      await page.getByRole('button', { name: 'Sembunyikan sandi' }).click();
      harus((await sandi.getAttribute('type')) === 'password', 'sandi tidak tersembunyi');
    });
    await cek('sandi wali salah memberi pesan jelas', async () => {
      await page.getByLabel('Nomor Induk Santri (NIS)').fill(NIS);
      await page.getByLabel('Sandi', { exact: true }).fill('salah-sekali');
      await page.getByRole('button', { name: 'Masuk', exact: true }).click();
      await page.getByText('NIS atau sandi salah').waitFor();
    });
    await cek('sandi pengurus salah memberi pesan jelas', async () => {
      await page.getByRole('tab', { name: 'Pengurus' }).click();
      await page.getByLabel('Nama pengguna').fill('admin');
      await page.getByLabel('Sandi', { exact: true }).fill('salah-sekali');
      await page.getByRole('button', { name: 'Masuk', exact: true }).click();
      await page.getByText('Nama pengguna atau sandi salah.').waitFor();
    });
    await cek('aksesibilitas halaman masuk', () => aksesibel(page, 'masuk'));
    await cek('tautan verifikasi raport', async () => {
      await page.getByRole('link', { name: 'Periksa keaslian raport' }).click();
      await page.waitForURL('**/verifikasi');
      await page.getByRole('heading', { name: 'Verifikasi raport' }).waitFor();
    });
    await cek('kode verifikasi salah ditolak', async () => {
      await page.getByLabel('Kode verifikasi').fill('abcd-efgh-jkmn');
      await page.getByRole('button', { name: 'Periksa' }).click();
      await page.getByText('Kode tidak dikenal').waitFor();
    });
    await cek('aksesibilitas halaman verifikasi', () => aksesibel(page, 'verifikasi'));
    await cek('halaman tidak ditemukan', async () => {
      await page.goto(ASAL + '/halaman-yang-tidak-ada');
      await page.getByRole('heading', { name: 'Halaman tidak ditemukan' }).waitFor();
      await page.getByRole('link', { name: 'Kembali ke beranda' }).click();
      await page.waitForURL(ASAL + '/');
    });
    await cek('halaman pemasangan dialihkan bila admin sudah ada', async () => {
      await page.goto(ASAL + '/pasang');
      await page.waitForURL(ASAL + '/');
    });
    await cek('halaman pengurus tanpa masuk dialihkan', async () => {
      await page.goto(ASAL + '/admin/santri');
      await page.waitForURL(ASAL + '/');
      await page.goto(ASAL + '/wali/raport');
      await page.waitForURL(ASAL + '/');
    });
    await ctx.close();
  }

  // ——————————————————— Administrator (desktop) ———————————————————
  const { ctx: ctxAdmin, page: p } = await konteks(1366, 900);
  bagian = 'Admin › Dasbor';
  await cek('masuk sebagai administrator', () => masuk(p, 'pengurus', 'admin', SANDI));
  await cek('kartu ringkasan tampil', async () => {
    for (const t of ['Santri aktif', 'Hadir hari ini', 'Nilai lengkap', 'Raport terbit']) await p.getByText(t, { exact: true }).waitFor();
  });
  await cek('tombol Isi absensi', async () => {
    await p.getByRole('link', { name: 'Isi absensi' }).click();
    await p.waitForURL('**/admin/absensi');
    await p.goBack();
  });
  await cek('tombol Input nilai', async () => {
    await p.getByRole('link', { name: 'Input nilai' }).click();
    await p.waitForURL('**/admin/nilai');
    await p.goBack();
  });
  await cek('baris kelas di absensi hari ini membuka kelas itu', async () => {
    await p.locator('.baris-absen').first().click();
    await p.waitForURL(/admin\/absensi\?kelas=\d+/);
    await p.goBack();
  });
  await cek('tautan Rincian, Catat, Buka absensi', async () => {
    await p.getByRole('link', { name: 'Rincian' }).click();
    await p.waitForURL('**/admin/nilai');
    await p.goBack();
    await p.getByRole('link', { name: 'Catat' }).click();
    await p.waitForURL('**/admin/syahriah');
    await p.goBack();
    await p.getByRole('link', { name: 'Buka absensi' }).click();
    await p.waitForURL('**/admin/absensi');
    await p.goBack();
  });
  await cek('aksesibilitas dasbor', () => aksesibel(p, 'dasbor'));
  await cek('semua menu samping bisa dibuka', async () => {
    for (const [nama, alamat] of [
      ['Data santri', '/admin/santri'],
      ['Kelas & pelajaran', '/admin/kelas'],
      ['Absensi', '/admin/absensi'],
      ['Nilai', '/admin/nilai'],
      ['Raport', '/admin/raport'],
      ['Hafalan', '/admin/hafalan'],
      ['Syahriah', '/admin/syahriah'],
      ['Pengumuman', '/admin/pengumuman'],
      ['Pengaturan', '/admin/pengaturan'],
      ['Dasbor', '/admin'],
    ]) {
      await p.locator('.sisi').getByRole('link', { name: nama, exact: true }).click();
      await p.waitForURL('**' + alamat);
      await p.locator('.kepala-halaman h1').first().waitFor();
    }
  });

  bagian = 'Admin › Santri';
  let namaBaru = 'Zainab Uji Menyeluruh';
  await cek('cari santri dengan nama', async () => {
    await p.goto(ASAL + '/admin/santri');
    await p.getByLabel('Cari santri').fill('Naila');
    await p.getByLabel('Cari santri').press('Enter');
    await p.waitForURL(/q=Naila/);
    await p.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0 && document.querySelectorAll('tbody tr').length < 40);
    const n = await p.locator('tbody tr').count();
    harus(n >= 1 && n < 40, `hasil pencarian ${n} baris`);
    await p.getByLabel('Cari santri').fill('');
    await p.getByLabel('Cari santri').press('Enter');
  });
  await cek('saring kelas, jenis, dan status', async () => {
    const jumlahBaris = (n) => p.waitForFunction((n) => document.querySelectorAll('tbody tr').length === n, n, { timeout: 5000 });
    await p.getByLabel('Kelas').selectOption({ label: 'Sayyidina Husein' });
    await p.waitForURL(/kelas=\d+/);
    await jumlahBaris(10);
    await p.getByLabel('Kelas').selectOption({ label: 'Semua kelas' });
    await p.getByRole('tab', { name: 'Putri' }).click();
    await jumlahBaris(20);
    await p.getByRole('tab', { name: 'Semua' }).click();
    await p.getByLabel('Status').selectOption({ label: 'Lulus' });
    await p.getByText('Tidak ada santri yang cocok').waitFor();
    await p.getByLabel('Status').selectOption({ label: 'Aktif' });
    await p.locator('tbody tr').first().waitFor();
  });
  await cek('tambah santri: isian wajib diperiksa', async () => {
    await p.getByRole('button', { name: 'Tambah santri' }).click();
    await dialog(p).getByRole('button', { name: 'Simpan' }).click();
    harus(await dialog(p).isVisible(), 'dialog tertutup padahal nama kosong');
  });
  await cek('tambah santri lengkap, sandi wali tampil sekali', async () => {
    const d = dialog(p);
    await d.getByLabel('Nama lengkap').fill(namaBaru);
    await d.getByRole('radio', { name: 'Santriwati (putri)' }).click();
    await d.getByLabel('Kelas').selectOption({ label: 'Sayyidah Fatimah' });
    await d.getByLabel('Tempat lahir').fill('Bangil');
    await d.getByLabel('Tanggal lahir').fill('2017-03-14');
    await d.getByLabel('Nomor HP/WhatsApp wali').fill('081234500077');
    await d.getByRole('button', { name: 'Simpan' }).click();
    await p.getByRole('heading', { name: 'Akun wali santri' }).waitFor();
    const href = await p.getByRole('link', { name: /Kirim ke WhatsApp wali/ }).getAttribute('href');
    harus(href.startsWith('https://wa.me/6281234500077?text='), 'tautan WhatsApp salah: ' + href);
  });
  await cek('salin pesan akun', async () => {
    await dialog(p).getByRole('button', { name: 'Salin pesan' }).click();
    await toast(p, 'Pesan disalin');
    const isi = await p.evaluate(() => navigator.clipboard.readText());
    harus(isi.includes(namaBaru) && !isi.includes('*'), 'isi salinan salah');
    await p.keyboard.press('Escape');
    await dialog(p).waitFor({ state: 'detached' });
  });
  await cek('pilih massal lalu pindah kelas', async () => {
    await p.getByLabel('Cari santri').fill('Uji Menyeluruh');
    await p.getByLabel('Cari santri').press('Enter');
    await p.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
    await p.getByRole('checkbox', { name: `Pilih ${namaBaru}` }).check();
    await p.getByLabel('Tindakan massal').selectOption({ label: 'Sayyidah Khodijah' });
    await p.getByRole('button', { name: 'Terapkan' }).click();
    await toast(p, '1 santri diperbarui');
    await p.getByRole('cell', { name: 'Sayyidah Khodijah' }).first().waitFor();
  });
  await cek('detail santri: ubah data', async () => {
    await p.getByText(namaBaru).first().click();
    await p.waitForURL(/admin\/santri\/\d+/);
    await p.getByRole('button', { name: 'Ubah data' }).click();
    await dialog(p).getByLabel('Alamat').fill('Jl. Uji No. 1, Bangil');
    await dialog(p).getByRole('button', { name: 'Simpan' }).click();
    await toast(p, 'disimpan');
    await p.getByText('Jl. Uji No. 1, Bangil').waitFor();
  });
  await cek('detail santri: sandi baru wali', async () => {
    await p.getByRole('button', { name: 'Sandi baru wali' }).click();
    await dialog(p).getByRole('button', { name: 'Buat sandi baru' }).click();
    await p.getByRole('heading', { name: 'Akun wali santri' }).waitFor();
    await p.keyboard.press('Escape');
  });
  await cek('detail santri: hapus santri tanpa riwayat', async () => {
    await p.getByRole('button', { name: 'Hapus santri' }).click();
    await dialog(p).getByRole('button', { name: 'Hapus', exact: true }).click();
    await p.waitForURL('**/admin/santri');
    await toast(p, 'dihapus');
  });
  await cek('hapus santri yang punya riwayat ditolak dengan alasan', async () => {
    await p.goto(ASAL + '/admin/santri');
    await p.locator('tbody tr').first().click();
    await p.getByRole('button', { name: 'Hapus santri' }).click();
    await dialog(p).getByRole('button', { name: 'Hapus', exact: true }).click();
    await toast(p, 'riwayat');
  });
  await cek('detail santri: catat setoran membuka formulir hafalan', async () => {
    await p.getByRole('link', { name: 'Catat setoran' }).click();
    await p.waitForURL(/admin\/hafalan\?santri=\d+/);
    await dialog(p).getByRole('heading', { name: 'Catat setoran hafalan' }).waitFor();
    harus((await dialog(p).getByLabel('Santri').inputValue()) !== '', 'santri belum terpilih');
    await p.keyboard.press('Escape');
  });
  await cek('kartu akun wali satu kelas', async () => {
    await p.goto(ASAL + '/admin/santri');
    await p.getByRole('button', { name: 'Kartu akun wali' }).click();
    await dialog(p).getByLabel('Kelas').selectOption({ index: 1 });
    await dialog(p).getByRole('button', { name: 'Buat kartu' }).click();
    await dialog(p).getByRole('heading', { name: /Kartu akun wali ·/ }).waitFor();
    const tombol = dialog(p).getByRole('button', { name: 'Cetak kartu' });
    if (await tombol.isEnabled()) {
      await tombol.click();
      harus((await p.evaluate(() => window.__cetak)) >= 1, 'jendela cetak tidak dipanggil');
    }
    await dialog(p).getByRole('button', { name: 'Tutup', exact: true }).click();
  });
  await cek('aksesibilitas data santri', () => aksesibel(p, 'santri'));

  bagian = 'Admin › Kelas';
  await cek('daftar kelas Al Wafa’', async () => {
    await p.goto(ASAL + '/admin/kelas');
    for (const k of ['Sayyidina Husein', 'Sayyidina Hasan', 'Sayyidah Fatimah', 'Sayyidah Khodijah']) await p.getByText(k, { exact: true }).first().waitFor();
  });
  await cek('laci kelas: tab pelajaran, jadwal, santri, data', async () => {
    await p.locator('.kartu-kelas').filter({ hasText: 'Sayyidina Husein' }).click();
    const d = dialog(p);
    await d.getByRole('tab', { name: 'Pelajaran' }).waitFor();
    await d.getByLabel("Pengajar Al-Qur'an").fill('Ust. Abdul Karim, S.Pd.');
    await d.getByRole('button', { name: 'Simpan' }).click();
    await toast(p, 'pelajaran diatur');
    await d.getByRole('tab', { name: 'Jadwal' }).click();
    const sebelum = await d.getByLabel('Jam mulai').count();
    await d.locator('.hari-jadwal').filter({ hasText: "Jum'at" }).getByRole('button', { name: 'Jam' }).click();
    harus((await d.getByLabel('Jam mulai').count()) === sebelum + 1, 'jam baru tidak bertambah');
    await d.locator('.hari-jadwal').filter({ hasText: "Jum'at" }).getByRole('button', { name: 'Hapus jam' }).click();
    await d.getByRole('button', { name: 'Simpan' }).click();
    await toast(p, 'Jadwal disimpan');
    await d.getByRole('tab', { name: 'Santri' }).click();
    harus((await d.locator('.baris-tautan').count()) === 10, 'santri kelas harus 10');
    await d.getByRole('tab', { name: 'Data kelas' }).click();
    await d.getByLabel('Ruang').fill('Ruang Husein');
    await d.getByRole('button', { name: 'Simpan' }).click();
    await toast(p, 'Data kelas disimpan');
    await d.getByRole('button', { name: 'Tutup', exact: true }).click();
  });
  await cek('tambah kelas lalu hapus', async () => {
    await p.getByRole('button', { name: 'Tambah kelas' }).click();
    const d = dialog(p);
    await d.getByLabel('Nama kelas').fill('Kelas Uji');
    await d.getByLabel('Bagian').selectOption('campur');
    await d.getByRole('button', { name: 'Buat kelas' }).click();
    await toast(p, 'Kelas Kelas Uji dibuat');
    await d.getByRole('tab', { name: 'Data kelas' }).click();
    await d.getByRole('button', { name: 'Hapus' }).click();
    await p.getByRole('dialog').filter({ hasText: 'Hapus kelas' }).getByRole('button', { name: 'Hapus' }).click();
    await toast(p, 'Kelas dihapus');
  });
  await cek('mata pelajaran: tambah, ubah, hapus', async () => {
    await p.getByRole('tab', { name: 'Mata pelajaran' }).click();
    await p.getByRole('button', { name: 'Tambah pelajaran' }).click();
    const d = dialog(p);
    await d.getByLabel('Nama pelajaran').fill('Pegon Uji');
    await d.getByLabel('KKM').fill('70');
    await d.getByRole('button', { name: 'Simpan' }).click();
    await toast(p, 'Pegon Uji disimpan');
    await p.getByRole('button', { name: 'Ubah Pegon Uji' }).click();
    await dialog(p).getByLabel('Kitab').fill('Kitab Uji');
    await dialog(p).getByRole('button', { name: 'Simpan' }).click();
    await toast(p, 'disimpan');
    await p.getByRole('button', { name: 'Ubah Pegon Uji' }).click();
    await dialog(p).getByRole('button', { name: 'Hapus' }).click();
    await p.getByRole('dialog').filter({ hasText: 'Hapus Pegon Uji' }).getByRole('button', { name: 'Hapus' }).click();
    await toast(p, 'Pegon Uji dihapus');
    await p.getByRole('tab', { name: 'Kelas' }).click();
  });

  bagian = 'Admin › Absensi';
  await cek('isi absensi kelas yang belum diisi', async () => {
    await p.goto(ASAL + '/admin/absensi');
    await p.getByLabel('Kelas').selectOption({ label: 'Sayyidina Hasan' });
    await p.getByText('Belum disimpan').waitFor();
    const kelompok = p.getByRole('group', { name: /^Kehadiran/ });
    await kelompok.nth(0).getByRole('button', { name: 'S' }).click();
    await p.getByLabel(/^Keterangan/).first().fill('Demam');
    await kelompok.nth(1).getByRole('button', { name: 'I' }).click();
    await kelompok.nth(2).getByRole('button', { name: 'A' }).click();
    await p.getByRole('button', { name: 'Simpan absensi' }).click();
    await toast(p, 'Sayyidina Hasan tersimpan: 7 hadir, 3 tidak hadir');
    await p.getByText('Tersimpan', { exact: true }).waitFor();
  });
  await cek('tombol semua hadir', async () => {
    await p.getByRole('button', { name: 'Semua hadir' }).click();
    await p.getByText('Ada perubahan').waitFor();
    await p.getByRole('button', { name: 'Simpan absensi' }).click();
    await toast(p, '10 hadir, 0 tidak hadir');
  });
  await cek('tanggal masa depan tidak bisa dipilih', async () => {
    const maks = await p.getByLabel('Tanggal').getAttribute('max');
    harus(!!maks, 'batas tanggal tidak ada');
  });
  await cek('rekap bulanan', async () => {
    await p.getByRole('tab', { name: 'Rekap bulanan' }).click();
    await p.locator('.tabel-rekap tbody tr').first().waitFor();
    await p.getByLabel('Bulan').fill('2026-09');
    await p.locator('.tabel-rekap tbody tr').first().waitFor();
    await p.getByRole('tab', { name: 'Isi absensi' }).click();
  });

  bagian = 'Admin › Nilai';
  await cek('ikhtisar kemajuan per kelas', async () => {
    await p.goto(ASAL + '/admin/nilai');
    await p.locator('.baris-progres').first().waitFor();
    harus((await p.locator('.baris-progres').count()) === 36, 'harus 36 pasang kelas–pelajaran');
  });
  await cek('nilai tidak valid ditolak', async () => {
    await p.locator('.baris-progres').first().click();
    const uas = p.locator('input[data-kolom="uas"]');
    await uas.first().waitFor();
    await uas.first().fill('150');
    harus((await uas.first().inputValue()) === '150', 'isian dipotong');
    harus((await uas.first().getAttribute('aria-invalid')) === 'true', 'tidak ditandai salah');
    await p.getByRole('button', { name: 'Simpan nilai' }).click();
    await toast(p, 'tidak valid');
  });
  await cek('Enter berpindah ke baris berikutnya dan nilai tersimpan', async () => {
    const uas = p.locator('input[data-kolom="uas"]');
    await uas.first().fill('88');
    await uas.first().press('Enter');
    harus(await uas.nth(1).evaluate((e) => e === document.activeElement), 'fokus tidak pindah');
    await uas.nth(1).fill('91');
    await p.getByRole('button', { name: 'Simpan nilai' }).click();
    await toast(p, 'Nilai 2 santri disimpan');
    await p.locator('.nilai-akhir').first().waitFor();
  });
  await cek('ganti pelajaran dan kembali ke ikhtisar', async () => {
    await p.getByLabel('Pelajaran').selectOption({ index: 1 });
    await p.locator('input[data-kolom="harian"]').first().waitFor();
    await p.getByRole('button', { name: 'Semua kelas' }).click();
    await p.locator('.baris-progres').first().waitFor();
  });
  await cek('semester lalu: nilai raport terbit terkunci', async () => {
    await p.getByLabel('Semester').selectOption({ index: 1 });
    await p.locator('section').filter({ hasText: 'Sayyidah Fatimah' }).locator('.baris-progres').filter({ hasText: "Al-Qur'an" }).first().click();
    await p.locator('input[data-kolom="uas"]').first().waitFor();
    harus(await p.locator('input[data-kolom="uas"]').first().isDisabled(), 'nilai raport terbit masih bisa diubah');
  });
  await cek('aksesibilitas input nilai', () => aksesibel(p, 'nilai'));

  bagian = 'Admin › Raport';
  await cek('isi kepribadian massal', async () => {
    await p.goto(ASAL + '/admin/raport');
    await p.getByLabel('Kelas').selectOption({ label: 'Sayyidina Husein' });
    await p.locator('tbody tr').first().waitFor();
    await p.getByRole('button', { name: 'Isi kepribadian' }).click();
    const selects = dialog(p).locator('select');
    const n = await selects.count();
    for (let i = 0; i < n; i++) await selects.nth(i).selectOption('B');
    await dialog(p).getByRole('button', { name: 'Simpan semua' }).click();
    await toast(p, 'Isian 10 raport disimpan');
  });
  await cek('raport santri: kepribadian, contoh catatan, simpan', async () => {
    await p.locator('tbody tr').first().click();
    await p.locator('.lembar').waitFor();
    await p.getByRole('radiogroup', { name: 'Akhlak' }).getByRole('radio', { name: 'A' }).click();
    await p.getByRole('button', { name: 'Contoh 2' }).click();
    await p.getByRole('button', { name: 'Simpan isian' }).click();
    await toast(p, 'Isian raport disimpan');
    await p.locator('.lembar').getByText('Baik sekali').first().waitFor();
  });
  await cek('raport belum lengkap tidak bisa diterbitkan', async () => {
    await p.getByText('Belum bisa diterbitkan').waitFor();
    harus(await p.getByRole('button', { name: 'Terbitkan' }).isDisabled(), 'tombol terbitkan aktif padahal belum lengkap');
  });
  await cek('tombol sebelumnya/berikutnya', async () => {
    const awal = p.url();
    await p.getByRole('button', { name: /Berikutnya/ }).click();
    await p.waitForURL((u) => u.toString() !== awal);
    await p.getByRole('button', { name: /Sebelumnya/ }).click();
    await p.waitForURL(awal);
  });
  await cek('tombol cetak memanggil jendela cetak', async () => {
    const n = await p.evaluate(() => window.__cetak);
    await p.getByRole('button', { name: 'Cetak' }).click();
    harus((await p.evaluate(() => window.__cetak)) === n + 1, 'cetak tidak dipanggil');
  });
  await cek('semester lalu: tarik lalu terbitkan ulang', async () => {
    await p.goto(ASAL + '/admin/raport');
    await p.getByLabel('Kelas').selectOption({ label: 'Sayyidina Husein' });
    await p.getByLabel('Semester').selectOption({ index: 1 });
    await p.locator('tbody tr').first().waitFor();
    await p.locator('tbody tr').first().click();
    await p.getByRole('button', { name: 'Tarik' }).click();
    await dialog(p).getByRole('button', { name: 'Tarik raport' }).click();
    await toast(p, 'Raport ditarik');
    await p.getByRole('button', { name: 'Terbitkan' }).click();
    await dialog(p).getByRole('button', { name: 'Terbitkan' }).click();
    await toast(p, 'Raport diterbitkan');
    await p.locator('.kaki-raport__kode').waitFor();
  });
  await cek('aksesibilitas raport santri', () => aksesibel(p, 'raport santri'));
  await cek('cetak semua raport satu kelas', async () => {
    await p.goto(ASAL + '/admin/raport');
    await p.getByLabel('Kelas').selectOption({ label: 'Sayyidina Husein' });
    await p.getByLabel('Semester').selectOption({ index: 1 });
    await p.locator('tbody tr').first().waitFor();
    const [baru] = await Promise.all([p.context().waitForEvent('page'), p.getByRole('button', { name: 'Cetak semua' }).click()]);
    await baru.getByRole('button', { name: /Cetak \d+ raport/ }).waitFor();
    await baru.waitForFunction(() => !document.querySelector('[role=progressbar]'));
    harus((await baru.locator('.lembar').count()) >= 1, 'tidak ada lembar raport');
    await baru.close();
  });
  await cek('terbitkan massal hanya yang siap', async () => {
    await p.getByLabel('Semester').selectOption({ index: 0 });
    await p.locator('tbody tr').first().waitFor();
    harus(await p.getByRole('button', { name: /^Terbitkan/ }).isDisabled(), 'tombol terbitkan massal aktif padahal belum ada yang siap');
  });

  bagian = 'Admin › Hafalan';
  await cek('saring jenis dan kelas', async () => {
    await p.goto(ASAL + '/admin/hafalan');
    await p.locator('tbody tr').first().waitFor();
    await p.getByRole('tab', { name: 'Nadzom' }).click();
    await tunggu(300);
    const isi = await p.locator('tbody').innerText();
    harus(!isi.includes('Surat '), 'saringan nadzom masih memuat surat');
    await p.getByRole('tab', { name: 'Semua' }).click();
    await p.getByLabel('Kelas').selectOption({ label: 'Sayyidah Fatimah' });
    await tunggu(300);
  });
  await cek('catat setoran lalu catat lagi', async () => {
    await p.getByRole('button', { name: 'Catat setoran' }).click();
    const d = dialog(p);
    await d.getByLabel('Kelas').selectOption({ label: 'Sayyidah Fatimah' });
    await d.getByLabel('Santri').selectOption({ index: 1 });
    await d.getByLabel('Jenis').selectOption('Nadzom');
    await d.getByLabel('Materi').fill("'Aqidatul 'Awam bait 1–5 (uji)");
    await d.getByRole('radio', { name: 'Cukup lancar' }).click();
    await d.getByRole('button', { name: 'Simpan & catat lagi' }).click();
    await toast(p, 'dicatat');
    harus((await d.getByLabel('Materi').inputValue()) === '', 'formulir tidak dikosongkan');
    await p.keyboard.press('Escape');
    await p.getByText("'Aqidatul 'Awam bait 1–5 (uji)").waitFor();
  });
  await cek('hapus catatan setoran', async () => {
    const baris = p.locator('tbody tr').filter({ hasText: '(uji)' });
    await baris.getByRole('button', { name: 'Hapus catatan' }).click();
    await dialog(p).getByRole('button', { name: 'Hapus' }).click();
    await toast(p, 'Catatan dihapus');
  });

  bagian = 'Admin › Syahriah';
  await cek('catat beberapa bulan sekaligus', async () => {
    await p.goto(ASAL + '/admin/syahriah');
    await p.getByLabel('Kelas').selectOption({ label: 'Sayyidah Khodijah' });
    const sel = p.locator('button.sel-bayar:not(.sel-bayar--lunas)').first();
    await sel.waitFor();
    await sel.click();
    const d = dialog(p);
    const pilihan = d.locator('.pilih-bulan button:not([disabled])');
    const n = await pilihan.count();
    for (let i = 0; i < n; i++) {
      if ((await pilihan.nth(i).getAttribute('aria-pressed')) !== 'true') {
        await pilihan.nth(i).click();
        break;
      }
    }
    await d.getByRole('button', { name: /^Simpan/ }).click();
    await toast(p, 'untuk 2 bulan dicatat');
  });
  await cek('batalkan catatan pembayaran', async () => {
    await p.locator('button.sel-bayar--lunas').first().click();
    await dialog(p).getByRole('button', { name: 'Batalkan catatan' }).click();
    await p.getByRole('dialog').filter({ hasText: 'Batalkan catatan pembayaran?' }).getByRole('button', { name: 'Batalkan' }).click();
    await toast(p, 'dibatalkan');
  });
  await cek('pengingat tunggakan lewat WhatsApp', async () => {
    const tautan = p.getByRole('link', { name: /Ingatkan wali/ }).first();
    if (await tautan.count()) harus((await tautan.getAttribute('href')).startsWith('https://wa.me/62'), 'tautan WA salah');
  });

  bagian = 'Admin › Pengumuman';
  await cek('tulis, ubah, hapus pengumuman', async () => {
    await p.goto(ASAL + '/admin/pengumuman');
    await p.getByRole('button', { name: 'Tulis pengumuman' }).click();
    await dialog(p).getByLabel('Judul').fill('Libur uji');
    await dialog(p).getByLabel('Isi').fill('Isi pengumuman uji menyeluruh.');
    await dialog(p).getByLabel('Sasaran').selectOption({ label: 'Wali santri Sayyidah Khodijah' });
    await dialog(p).getByRole('switch', { name: 'Penting' }).check();
    await dialog(p).getByRole('button', { name: 'Terbitkan' }).click();
    await toast(p, 'Pengumuman diterbitkan');
    const kartu = p.locator('.kartu-pengumuman').filter({ hasText: 'Libur uji' });
    await kartu.getByRole('button', { name: 'Ubah' }).click();
    await dialog(p).getByLabel('Judul').fill('Libur uji (diubah)');
    await dialog(p).getByRole('button', { name: 'Simpan' }).click();
    await toast(p, 'diperbarui');
    await p.locator('.kartu-pengumuman').filter({ hasText: 'Libur uji (diubah)' }).getByRole('button', { name: 'Hapus' }).click();
    await dialog(p).getByRole('button', { name: 'Hapus' }).click();
    await toast(p, 'dihapus');
  });

  bagian = 'Admin › Pengaturan';
  await cek('simpan identitas madrasah', async () => {
    await p.goto(ASAL + '/admin/pengaturan');
    await p.getByRole('tab', { name: 'Madrasah & nilai' }).click();
    await p.getByLabel('Kepala madrasah').fill('KH. Kepala Uji');
    await p.getByRole('button', { name: 'Simpan pengaturan' }).click();
    await toast(p, 'Pengaturan disimpan');
  });
  await cek('bobot nilai harus berjumlah 100', async () => {
    await p.getByLabel('UAS (%)').fill('50');
    harus(await p.getByRole('button', { name: 'Simpan pengaturan' }).isDisabled(), 'simpan aktif padahal jumlah bobot 110');
    await p.getByLabel('UAS (%)').fill('40');
  });
  await cek('semester: tambah, ubah', async () => {
    await p.getByRole('tab', { name: 'Tahun ajaran' }).click();
    await p.getByRole('button', { name: 'Semester baru' }).click();
    const d = dialog(p);
    await d.getByLabel('Tahun ajaran').fill('2027/2028');
    await d.getByLabel(/^Semester/).selectOption('1');
    await d.getByLabel('Mulai').fill('2027-07-12');
    await d.getByLabel('Selesai').fill('2027-12-18');
    await d.getByRole('button', { name: 'Simpan' }).click();
    await toast(p, 'Semester disimpan');
    const baris = p.locator('tbody tr').filter({ hasText: '2027/2028' });
    await baris.getByRole('button', { name: 'Ubah' }).click();
    await dialog(p).getByLabel('Tanggal pembagian raport').fill('2027-12-18');
    await dialog(p).getByRole('button', { name: 'Simpan' }).click();
    await toast(p, 'Semester disimpan');
  });
  await cek('semester bertumpuk ditolak', async () => {
    await p.getByRole('button', { name: 'Semester baru' }).click();
    const d = dialog(p);
    await d.getByLabel('Tahun ajaran').fill('2028/2029');
    await d.getByLabel('Mulai').fill('2027-08-01');
    await d.getByLabel('Selesai').fill('2027-09-01');
    await d.getByRole('button', { name: 'Simpan' }).click();
    await toast(p, 'bertumpuk');
    await p.keyboard.press('Escape');
  });
  await cek('akun pengurus: tambah, ubah, sandi baru', async () => {
    await p.getByRole('tab', { name: 'Akun pengurus' }).click();
    await p.getByRole('button', { name: 'Tambah akun' }).click();
    await dialog(p).getByLabel(/^Nama\*?$/).fill('Ust. Uji Coba');
    await dialog(p).getByLabel('Nama pengguna').fill('ujicoba');
    await dialog(p).getByRole('button', { name: 'Simpan' }).click();
    await p.getByRole('heading', { name: 'Sandi akun pengurus' }).waitFor();
    await dialog(p).getByRole('button', { name: 'Selesai' }).click();
    const baris = p.locator('tbody tr').filter({ hasText: 'Ust. Uji Coba' });
    await baris.getByRole('button', { name: 'Ubah' }).click();
    await dialog(p).getByRole('switch', { name: 'Akun aktif' }).uncheck();
    await dialog(p).getByRole('button', { name: 'Simpan' }).click();
    await toast(p, 'Akun diperbarui');
    await baris.getByRole('button', { name: 'Sandi baru' }).click();
    await dialog(p).getByRole('button', { name: 'Buat sandi baru' }).click();
    await p.getByRole('heading', { name: 'Sandi akun pengurus' }).waitFor();
    await dialog(p).getByRole('button', { name: 'Selesai' }).click();
  });
  await cek('riwayat aktivitas mencatat tindakan tadi', async () => {
    await p.getByRole('tab', { name: 'Riwayat' }).click();
    await p.getByText('Menambah akun pengurus').first().waitFor();
  });

  bagian = 'Admin › Akun saya';
  await cek('ganti sandi: sandi lama salah dan ulang tidak sama', async () => {
    await p.locator('.sisi__akun-tautan').click();
    await p.waitForURL('**/admin/akun');
    await p.getByLabel('Sandi saat ini').fill('salah-salah');
    await p.getByRole('textbox', { name: 'Sandi baru', exact: true }).fill('sandi-baru-123');
    await p.getByLabel('Ketik ulang sandi baru').fill('sandi-baru-123');
    await p.getByRole('button', { name: 'Ganti sandi' }).click();
    await toast(p, 'Sandi lama tidak cocok');
    await p.getByLabel('Sandi saat ini').fill(SANDI);
    await p.getByLabel('Ketik ulang sandi baru').fill('beda-sendiri');
    await p.getByRole('button', { name: 'Ganti sandi' }).click();
    await toast(p, 'sama persis');
  });
  await cek('ganti sandi berhasil lalu kembalikan', async () => {
    await p.getByLabel('Sandi saat ini').fill(SANDI);
    await p.getByRole('textbox', { name: 'Sandi baru', exact: true }).fill('sandi-baru-123');
    await p.getByLabel('Ketik ulang sandi baru').fill('sandi-baru-123');
    await p.getByRole('button', { name: 'Ganti sandi' }).click();
    await toast(p, 'Sandi diganti');
    await p.getByLabel('Sandi saat ini').fill('sandi-baru-123');
    await p.getByRole('textbox', { name: 'Sandi baru', exact: true }).fill(SANDI);
    await p.getByLabel('Ketik ulang sandi baru').fill(SANDI);
    await p.getByRole('button', { name: 'Ganti sandi' }).click();
    await toast(p, 'Sandi diganti');
  });

  bagian = 'Admin › Lebar layar';
  for (const lebar of [1440, 1024, 768, 390, 320]) {
    await cek(`semua halaman pengurus muat di ${lebar}px`, async () => {
      await p.setViewportSize({ width: lebar, height: 860 });
      for (const alamat of ['/admin', '/admin/santri', '/admin/kelas', '/admin/absensi', '/admin/nilai', '/admin/raport', '/admin/hafalan', '/admin/syahriah', '/admin/pengumuman', '/admin/pengaturan', '/admin/akun']) {
        await p.goto(ASAL + alamat);
        await p.locator('.kepala-halaman h1').first().waitFor();
        await tunggu(150);
        await lebarAman(p, `${alamat} @${lebar}`);
      }
    });
  }
  await cek('menu ponsel: buka, pilih, tertutup', async () => {
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(ASAL + '/admin');
    await p.getByRole('button', { name: 'Buka menu' }).click();
    await p.locator('.sisi--buka').waitFor();
    await p.locator('.sisi').getByRole('link', { name: 'Hafalan', exact: true }).click();
    await p.waitForURL('**/admin/hafalan');
    await p.locator('.sisi--buka').waitFor({ state: 'detached' });
  });
  await cek('aksesibilitas dasbor di ponsel', async () => {
    await p.goto(ASAL + '/admin');
    await p.locator('.kepala-halaman h1').waitFor();
    await aksesibel(p, 'dasbor ponsel');
  });
  await cek('keluar dari akun pengurus', async () => {
    await p.setViewportSize({ width: 1366, height: 900 });
    await p.goto(ASAL + '/admin');
    await p.getByRole('button', { name: 'Keluar' }).click();
    await p.waitForURL(ASAL + '/');
    await p.goto(ASAL + '/admin');
    await p.waitForURL(ASAL + '/');
  });
  await ctxAdmin.close();

  // ——————————————————— Ustadz/ustadzah ———————————————————
  bagian = 'Ustadz';
  {
    const { ctx, page } = await konteks(1366, 900);
    await cek('masuk sebagai ustadzah', () => masuk(page, 'pengurus', 'ustadzah', SANDI));
    await cek('menu syahriah tidak tampil dan alamatnya ditolak', async () => {
      harus(!(await page.locator('.sisi').getByRole('link', { name: 'Syahriah', exact: true }).count()), 'menu syahriah tampil');
      await page.goto(ASAL + '/admin/syahriah');
      await page.waitForURL(ASAL + '/admin');
    });
    await cek('tidak bisa menambah santri atau menerbitkan raport', async () => {
      await page.goto(ASAL + '/admin/santri');
      await page.locator('tbody tr').first().waitFor();
      harus(!(await page.getByRole('button', { name: 'Tambah santri' }).count()), 'tombol tambah santri tampil');
      await page.goto(ASAL + '/admin/raport');
      await page.locator('tbody tr').first().waitFor();
      harus(!(await page.getByRole('button', { name: /^Terbitkan/ }).count()), 'tombol terbitkan tampil');
    });
    await cek('pengaturan hanya bisa dibaca', async () => {
      await page.goto(ASAL + '/admin/pengaturan');
      await page.getByText('Hanya administrator yang bisa mengubah pengaturan.').waitFor();
      harus(!(await page.getByRole('button', { name: 'Simpan pengaturan' }).count()), 'tombol simpan tampil');
      harus(!(await page.getByRole('tab', { name: 'Akun pengurus' }).count()), 'tab akun pengurus tampil');
    });
    await cek('bisa mengisi absensi', async () => {
      await page.goto(ASAL + '/admin/absensi');
      await page.getByLabel('Kelas').selectOption({ label: 'Sayyidah Khodijah' });
      await page.getByRole('button', { name: 'Simpan absensi' }).click();
      await toast(page, 'Sayyidah Khodijah tersimpan');
    });
    await ctx.close();
  }

  // ——————————————————— Wali santri ———————————————————
  bagian = 'Wali (ponsel)';
  {
    const { ctx, page: w } = await konteks(390, 844);
    await cek('masuk sebagai wali', () => masuk(w, 'wali', NIS, SANDI_WALI));
    await cek('beranda: semua kartu tampil', async () => {
      for (const t of ['Raport terbaru', 'Kehadiran', 'Hafalan', 'Pelajaran hari ini', 'Pengumuman']) await w.getByRole('heading', { name: new RegExp(t) }).first().waitFor();
    });
    await cek('aksesibilitas beranda wali', () => aksesibel(w, 'beranda wali'));
    await cek('tautan di beranda', async () => {
      for (const [nama, alamat] of [
        ['Rincian', '/wali/absensi'],
        ['Riwayat', '/wali/syahriah'],
        ['Sepekan', '/wali/jadwal'],
        ['Semua', '/wali/pengumuman'],
      ]) {
        await w.getByRole('link', { name: nama, exact: true }).click();
        await w.waitForURL('**' + alamat);
        await w.goBack();
        await w.locator('.sambutan__nama').waitFor();
      }
    });
    await cek('buka raport: ringkasan, lembar, unduh PDF', async () => {
      await w.getByRole('link', { name: 'Buka raport' }).click();
      await w.getByText('Nilai mata pelajaran').waitFor();
      await w.getByRole('tab', { name: 'Lembar raport' }).click();
      await w.locator('.lembar').waitFor();
      await w.getByRole('button', { name: 'Unduh PDF' }).click();
      await tunggu(500);
      harus((await w.evaluate(() => window.__cetak)) >= 1, 'jendela cetak tidak dibuka');
      await w.getByRole('tab', { name: 'Ringkasan' }).click();
    });
    await cek('aksesibilitas raport wali', () => aksesibel(w, 'raport wali'));
    await cek('menu bawah: raport, kehadiran, hafalan', async () => {
      for (const [nama, alamat] of [
        ['Raport', '/wali/raport'],
        ['Kehadiran', '/wali/absensi'],
        ['Hafalan', '/wali/hafalan'],
        ['Beranda', '/wali'],
      ]) {
        await w.locator('.tab-bawah').getByRole('link', { name: nama, exact: true }).click();
        await w.waitForURL((u) => u.pathname === alamat);
      }
    });
    await cek('kehadiran: bulan sebelumnya dan batas bulan ini', async () => {
      await w.goto(ASAL + '/wali/absensi');
      await w.locator('.kalender__tgl').first().waitFor();
      harus(await w.getByRole('button', { name: 'Bulan berikutnya' }).isDisabled(), 'bisa maju ke bulan depan');
      await w.getByRole('button', { name: 'Bulan sebelumnya' }).click();
      await w.getByRole('heading', { name: /Oktober/ }).waitFor();
    });
    await cek('menu Lainnya: syahriah, jadwal, pengumuman, akun', async () => {
      for (const [nama, alamat] of [
        ['Syahriah', '/wali/syahriah'],
        ['Jadwal', '/wali/jadwal'],
        ['Pengumuman', '/wali/pengumuman'],
        ['Akun & sandi', '/wali/akun'],
      ]) {
        await w.locator('.tab-bawah').getByRole('link', { name: 'Lainnya' }).click();
        await dialog(w).getByRole('link', { name: nama }).click();
        await w.waitForURL('**' + alamat);
        await w.locator('.kepala-halaman h1').waitFor();
      }
    });
    await cek('ganti sandi wali: sandi lama salah ditolak', async () => {
      await w.getByLabel('Sandi saat ini').fill('salah-salah');
      await w.getByRole('textbox', { name: 'Sandi baru', exact: true }).fill('sandi-wali-baru');
      await w.getByLabel('Ketik ulang sandi baru').fill('sandi-wali-baru');
      await w.getByRole('button', { name: 'Ganti sandi' }).click();
      await toast(w, 'Sandi lama tidak cocok');
    });
    for (const lebar of [320, 390, 768, 1024, 1440]) {
      await cek(`semua halaman wali muat di ${lebar}px`, async () => {
        await w.setViewportSize({ width: lebar, height: 860 });
        for (const alamat of ['/wali', '/wali/raport', '/wali/absensi', '/wali/hafalan', '/wali/syahriah', '/wali/jadwal', '/wali/pengumuman', '/wali/akun']) {
          await w.goto(ASAL + alamat);
          await w.locator('h1').first().waitFor();
          await tunggu(150);
          await lebarAman(w, `${alamat} @${lebar}`);
        }
      });
    }
    await cek('wali tidak bisa membuka halaman pengurus', async () => {
      await w.goto(ASAL + '/admin');
      await w.waitForURL(ASAL + '/wali');
    });
    await cek('menu akun (desktop) dan keluar', async () => {
      await w.setViewportSize({ width: 1366, height: 860 });
      await w.goto(ASAL + '/wali');
      await w.locator('.akun-wali > button').click();
      await w.getByRole('menuitem', { name: 'Akun & sandi' }).click();
      await w.waitForURL('**/wali/akun');
      await w.locator('.akun-wali > button').click();
      await w.getByRole('menuitem', { name: 'Keluar' }).click();
      await w.waitForURL(ASAL + '/');
    });
    await ctx.close();
  }
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid);
  } catch {}
  fs.rmSync(dataDir, { recursive: true, force: true });
}

const gagal = hasil.filter((h) => !h.ok);
console.log(`\n\n${hasil.length - gagal.length}/${hasil.length} pemeriksaan lulus.`);
for (const g of gagal) console.log(`✗ ${g.label}\n    ${g.pesan}`);
const konsol = [...new Set(galatKonsol)];
if (konsol.length) console.log('\nGalat konsol/server:\n' + konsol.map((k) => '  ' + k).join('\n'));
process.exitCode = gagal.length || konsol.length ? 1 : 0;
