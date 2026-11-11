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
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), DATA_DIR: dataDir, PENJADWAL: '0' },
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
  await page.goto(ASAL + (jenis === 'wali' ? '/' : `/${jenis}`));
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
  // Tunggu transisi yang sedang berjalan (mis. tab baru diklik) agar kontras tidak diukur di tengah animasi.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  );
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
  const NIS_DAFTAR = demo.demo.daftarNis;
  browser = await chromium.launch().catch(() => chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' }));
  // Foto potret sederhana untuk menguji unggah foto santri.
  const FOTO = path.join(dataDir, 'foto-uji.jpg');
  {
    const pf = await browser.newPage({ viewport: { width: 480, height: 640 } });
    await pf.setContent(
      '<body style="margin:0;background:#cfe6e3"><div style="position:absolute;left:150px;top:120px;width:180px;height:230px;border-radius:50%;background:#e8b48f"></div>' +
        '<div style="position:absolute;left:70px;top:380px;width:340px;height:300px;border-radius:170px 170px 0 0;background:#f5f1e6"></div></body>',
    );
    await pf.screenshot({ path: FOTO, type: 'jpeg', quality: 85 });
    await pf.close();
  }

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
    await cek('latar tosca tetap tampil walau halaman pembungkus memberi latar putih', async () => {
      // Pratinjau untuk klien dibungkus kerangka lain yang bisa memberi body latar putih.
      const tag = await page.addStyleTag({ content: 'html,body{background:#fff}' });
      const [html, body, isolasi] = await page.evaluate(() => {
        const b = getComputedStyle(document.body);
        return [getComputedStyle(document.documentElement).backgroundColor, b.backgroundColor, b.isolation];
      });
      harus(html !== 'rgb(255, 255, 255)' && body !== 'rgb(255, 255, 255)', `latar berubah putih: ${html} / ${body}`);
      // body harus konteks tumpukan sendiri, kalau tidak warna dasarnya menutupi lapisan cahaya .latar
      harus(isolasi === 'isolate', 'body bukan konteks tumpukan: lapisan latar tertutup');
      await tag.evaluate((el) => el.remove());
    });
    await cek('halaman masuk wali tidak menyebut pengurus atau guru', async () => {
      await page.getByLabel('Nomor Induk Santri (NIS)').waitFor();
      const teks = (await page.locator('main').innerText()).toLowerCase();
      for (const kata of ['pengurus', 'guru', 'ustadz', 'pengajar', 'administrator']) harus(!teks.includes(kata), `halaman wali memuat kata "${kata}"`);
      harus(!(await page.getByLabel('Nama pengguna').count()), 'isian nama pengguna tampil di halaman wali');
    });
    await cek('pintu guru dan pengurus terpisah', async () => {
      await page.goto(ASAL + '/guru');
      await page.getByRole('heading', { name: 'Ruang guru' }).waitFor();
      await page.getByLabel('Nama pengguna').fill('admin');
      await page.getByLabel('Sandi', { exact: true }).fill(SANDI);
      await page.getByRole('button', { name: 'Masuk', exact: true }).click();
      await page.getByText('Akun ini akun pengurus').waitFor();
      await page.goto(ASAL + '/pengurus');
      await page.getByRole('heading', { name: 'Ruang pengurus' }).waitFor();
      await page.getByLabel('Nama pengguna').fill('ustadzah');
      await page.getByLabel('Sandi', { exact: true }).fill(SANDI);
      await page.getByRole('button', { name: 'Masuk', exact: true }).click();
      await page.getByText('Akun ini akun guru').waitFor();
      await aksesibel(page, 'masuk pengurus');
      await page.goto(ASAL + '/');
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
      await page.goto(ASAL + '/pengurus');
      await page.getByLabel('Nama pengguna').fill('admin');
      await page.getByLabel('Sandi', { exact: true }).fill('salah-sekali');
      await page.getByRole('button', { name: 'Masuk', exact: true }).click();
      await page.getByText('Nama pengguna atau sandi salah.').waitFor();
    });
    await cek('aksesibilitas halaman masuk', () => aksesibel(page, 'masuk'));
    await cek('tautan verifikasi raport', async () => {
      await page.goto(ASAL + '/');
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
    await cek('daftar wali: kecamatan mengisi kabupaten dan provinsi, akun langsung aktif', async () => {
      const { ctx: c2, page: d } = await konteks(390, 844);
      await d.goto(ASAL + '/');
      await d.getByRole('link', { name: /Belum punya akun/ }).click();
      await d.waitForURL('**/daftar');
      await d.getByRole('heading', { name: 'Daftar akun wali santri' }).waitFor();
      await lebarAman(d, 'daftar @390');
      const kec = d.getByRole('combobox', { name: 'Kecamatan' });
      await kec.fill('pandaan');
      await d.getByRole('option', { name: /Pandaan.*Kabupaten Pasuruan/ }).click();
      harus((await d.getByRole('textbox', { name: 'Kabupaten / kota' }).inputValue()) === 'Kabupaten Pasuruan', 'kabupaten tidak terisi otomatis');
      harus((await d.getByRole('textbox', { name: 'Provinsi' }).inputValue()) === 'Jawa Timur', 'provinsi tidak terisi otomatis');
      await kec.fill('pandaa');
      harus((await d.getByRole('textbox', { name: 'Provinsi' }).inputValue()) === '', 'kecamatan diubah, provinsi seharusnya kosong lagi');
      await kec.press('ArrowDown');
      await kec.press('Enter');
      harus((await d.getByRole('textbox', { name: 'Provinsi' }).inputValue()) !== '', 'pilihan dengan papan ketik tidak bekerja');
      await aksesibel(d, 'daftar');
      await d.getByRole('button', { name: 'Isi contoh' }).click();
      await d.getByLabel('Ketik ulang sandi').fill('beda-sendiri');
      await d.getByRole('button', { name: 'Daftar', exact: true }).click();
      await d.getByText('Sandi tidak sama.').waitFor();
      await d.getByLabel('Ketik ulang sandi').fill('wali-contoh-1');
      await d.getByRole('button', { name: 'Daftar', exact: true }).click();
      await d.getByRole('heading', { name: 'Akun wali aktif' }).waitFor();
      await d.getByRole('button', { name: 'Buka beranda wali' }).click();
      await d.waitForURL('**/wali');
      await d.locator('.sambutan__nama').waitFor();
      await c2.close();
    });
    await cek('daftar wali: NIS yang sudah aktif ditolak dengan alasan', async () => {
      const { ctx: c2, page: d } = await konteks(390, 844);
      await d.goto(ASAL + '/daftar');
      await d.getByLabel('Nomor Induk Santri (NIS)').fill(NIS_DAFTAR);
      await d.getByLabel('Nama lengkap').fill('Bapak Uji');
      await d.getByLabel('Nomor WhatsApp aktif').fill('0812-0000-0000');
      await d.getByRole('combobox', { name: 'Kecamatan' }).fill('bangil');
      await d.getByRole('option').first().click();
      await d.getByLabel('Buat sandi').fill('sandi-uji-123');
      await d.getByLabel('Ketik ulang sandi').fill('sandi-uji-123');
      await d.getByRole('button', { name: 'Daftar', exact: true }).click();
      await toast(d, 'sudah memiliki akun wali yang aktif');
      await c2.close();
    });
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
      ['Absensi guru', '/admin/absen-guru'],
      ['Absensi santri', '/admin/absensi'],
      ['Nilai harian', '/admin/harian'],
      ['Nilai semester', '/admin/nilai'],
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
    await dialog(p).getByLabel('Jalan / dusun, RT/RW').fill('Jl. Uji No. 1, Bangil');
    await dialog(p).getByRole('combobox', { name: 'Kecamatan' }).fill('bangil');
    await dialog(p).getByRole('option', { name: /^Bangil Kabupaten Pasuruan/ }).click();
    await dialog(p).getByRole('button', { name: 'Simpan' }).click();
    await toast(p, 'disimpan');
    await p.getByText('Jl. Uji No. 1, Bangil, Kec. Bangil, Kab. Pasuruan, Jawa Timur').waitFor();
  });
  await cek('detail santri: sandi baru wali', async () => {
    await p.getByRole('button', { name: 'Sandi baru wali' }).click();
    await dialog(p).getByRole('button', { name: 'Buat sandi baru' }).click();
    await p.getByRole('heading', { name: 'Akun wali santri' }).waitFor();
    await p.keyboard.press('Escape');
  });
  await cek('detail santri: foto dari galeri, kartu santri, balik, cetak', async () => {
    await p.getByRole('button', { name: /Tambah foto/ }).click();
    await dialog(p).getByLabel('Pilih foto dari galeri').setInputFiles(FOTO);
    await dialog(p).locator('.foto-potong canvas').waitFor();
    await dialog(p).getByLabel('Perbesar foto').fill('1.4');
    await dialog(p).getByRole('button', { name: 'Putar foto' }).click();
    await dialog(p).getByRole('button', { name: 'Simpan foto' }).click();
    await toast(p, 'tersimpan');
    await p.locator('.profil-santri .avatar--foto img').waitFor();
    await p.getByRole('button', { name: 'Kartu santri' }).click();
    await dialog(p).locator('.kartu__foto img').waitFor();
    await dialog(p).getByRole('button', { name: 'Lihat tata tertib' }).click();
    await dialog(p).getByRole('button', { name: 'Lihat depan' }).waitFor();
    const sebelum = await p.evaluate(() => window.__cetak);
    await dialog(p).getByRole('button', { name: 'Cetak kartu' }).click();
    await tunggu(500);
    harus((await p.evaluate(() => window.__cetak)) > sebelum, 'cetak kartu tidak membuka jendela cetak');
    await aksesibel(p, 'kartu santri admin');
    await p.keyboard.press('Escape');
    await dialog(p).waitFor({ state: 'detached' });
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

  bagian = 'Admin › Absensi guru';
  await cek('absensi guru: daftar harian, catat guru, rekap bulanan', async () => {
    await p.goto(ASAL + '/admin/absen-guru');
    await p.getByRole('heading', { name: 'Absensi guru' }).waitFor();
    const tombol = p.getByRole('button', { name: /^Catat kehadiran/ }).first();
    if (await tombol.count()) {
      await tombol.click();
      await dialog(p).getByRole('radio', { name: 'Izin' }).click();
      await dialog(p).getByLabel('Keterangan').fill('Digantikan Ust. Hasan Basri');
      await dialog(p).getByRole('button', { name: 'Simpan' }).click();
      await toast(p, 'dicatat');
    }
    await p.getByRole('tab', { name: 'Rekap bulanan' }).click();
    await p.getByRole('columnheader', { name: 'Terlambat' }).waitFor();
    await aksesibel(p, 'absensi guru');
  });

  bagian = 'Admin › Nilai harian';
  await cek('nilai harian: pilih pelajaran, isi yang kosong, simpan, dasbor ikut berubah', async () => {
    await p.goto(ASAL + '/admin/harian');
    await p.getByRole('heading', { name: 'Nilai harian', level: 1 }).waitFor();
    const kartu = p.locator('.kartu-pelajaran').filter({ hasText: 'Belum lengkap' }).first();
    if (!(await kartu.count())) return; // hari tanpa pelajaran (Jum'at) atau semua sudah lengkap
    const judul = await kartu.locator('b').first().innerText();
    await kartu.getByRole('button', { name: /Isi nilai/ }).click();
    await p.getByLabel('Nilai untuk semua santri yang hadir').fill('85');
    await p.getByRole('button', { name: 'Isi yang kosong' }).click();
    await p.getByRole('button', { name: 'Simpan nilai' }).click();
    await toast(p, 'Nilai harian semester ikut diperbarui');
    await aksesibel(p, 'isi nilai harian');
    await p.getByRole('button', { name: 'Semua pelajaran' }).first().click();
    await p.locator('.kartu-pelajaran').filter({ hasText: judul }).first().getByText('Lengkap', { exact: true }).waitFor();
    await p.goto(ASAL + '/admin');
    await p.getByRole('heading', { name: 'Input nilai harian hari ini' }).waitFor();
  });

  bagian = 'Admin › Pendaftaran wali';
  await cek('nomor berbeda: muncul di Data santri, diperiksa lalu disetujui', async () => {
    const calon = (await (await fetch(`${ASAL}/api/auth/saya`)).json()).demo.daftarNis;
    const r = await fetch(`${ASAL}/api/auth/daftar-wali`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-madin': '1' },
      body: JSON.stringify({ nis: calon, hp: '0857-1111-2222', namaWali: 'Ibu Uji Daftar', hubungan: 'Ibu', kecamatan: 'Bangil', kabupaten: 'Kabupaten Pasuruan', provinsi: 'Jawa Timur', kodeWilayah: '35.14.14', sandi: 'sandi-ibu-uji' }),
    });
    harus((await r.json()).status === 'menunggu', 'pendaftaran seharusnya menunggu');
    await p.goto(ASAL + '/admin/santri');
    await p.locator('.sisi').getByRole('link', { name: /Data santri/ }).getByText('1').waitFor();
    await p.getByText('1 pendaftaran wali menunggu pemeriksaan').waitFor();
    await p.getByRole('button', { name: 'Periksa' }).click();
    await dialog(p).getByText('Ibu Uji Daftar').waitFor();
    await dialog(p).getByRole('button', { name: 'Setujui' }).click();
    await p.getByRole('dialog').last().getByRole('button', { name: 'Setujui', exact: true }).click();
    await toast(p, 'aktif');
    harus((await p.getByRole('link', { name: /Kirim kabar via WhatsApp/ }).getAttribute('href')).includes('wa.me/6285711112222'), 'tautan kabar WhatsApp salah');
    await p.keyboard.press('Escape');
    const w2 = await konteks(390, 844);
    await masuk(w2.page, 'wali', calon, 'sandi-ibu-uji');
    await w2.ctx.close();
    halamanAktif = p;
  });

  bagian = 'Admin › Pesan otomatis';
  await cek('laporan harian dan pengingat syahriah dibuat dari tombol', async () => {
    await ctxAdmin.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'wa' }));
    await p.locator('.sisi').getByRole('link', { name: /Pesan otomatis/ }).click();
    await p.waitForURL('**/admin/pesan');
    await p.getByRole('button', { name: 'Ingatkan sekarang' }).click();
    await toast(p, /guru diingatkan|Tidak ada pengingat baru/);
    await p.getByRole('button', { name: 'Kirim rekap sekarang' }).click();
    await toast(p, /Rekap harian dibuat|Tidak ada rekap baru/);
    await p.getByRole('button', { name: 'Proses pengingat sekarang' }).click();
    await toast(p, /pengingat/i);
  });
  await cek('pengaturan: jam pulang, libur, nomor madrasah tersimpan', async () => {
    await p.getByRole('button', { name: 'Pengaturan', exact: true }).click();
    await dialog(p).getByLabel('Nomor WhatsApp madrasah (pengirim)').fill('0812-0000-1717');
    await dialog(p).getByLabel('Pengingat pukul').fill('21:30');
    await dialog(p).getByRole('button', { name: 'Simpan' }).click();
    await toast(p, 'sebelum batas');
    await dialog(p).getByLabel('Pengingat pukul').fill('20:00');
    await dialog(p).getByRole('button', { name: 'Simpan' }).click();
    await toast(p, 'disimpan');
    await p.getByText('dari 0812-0000-1717').waitFor();
  });
  await cek('pengaturan: gateway butuh token, pesan uji masuk kotak keluar', async () => {
    await p.getByRole('button', { name: 'Pengaturan', exact: true }).click();
    await dialog(p).getByRole('radio', { name: /gateway Fonnte/ }).click();
    await dialog(p).getByRole('button', { name: 'Simpan' }).click();
    await toast(p, 'token');
    await dialog(p).getByRole('radio', { name: /Manual/ }).click();
    await dialog(p).getByLabel('Nomor WhatsApp uji').fill('0812-0000-7777');
    await dialog(p).getByRole('button', { name: 'Kirim', exact: true }).click();
    await toast(p, 'kotak keluar');
    await dialog(p).getByRole('button', { name: 'Simpan' }).click();
    await toast(p, 'disimpan');
  });
  await cek('kotak keluar: kirim via WhatsApp menandai terkirim, saringan status', async () => {
    await p.reload();
    const pesanUji = p.locator('.daftar-pesan__item').filter({ hasText: 'Pesan uji' }).first();
    await pesanUji.waitFor();
    const [tab] = await Promise.all([p.waitForEvent('popup'), pesanUji.getByRole('link', { name: 'Kirim via WhatsApp' }).click()]);
    harus(tab.url().startsWith('https://wa.me/6281200007777'), 'tautan WhatsApp salah: ' + tab.url());
    await tab.close();
    await p.getByRole('tab', { name: 'Terkirim' }).click();
    await p.locator('.daftar-pesan__item').filter({ hasText: 'Pesan uji' }).first().getByText('Terkirim', { exact: true }).waitFor();
    await p.getByRole('tab', { name: 'Semua' }).click();
    await aksesibel(p, 'pesan otomatis');
  });
  await cek('batalkan pesan yang menunggu', async () => {
    const item = p.locator('.daftar-pesan__item--antre').first();
    if (!(await item.count())) return;
    const n = await p.locator('.daftar-pesan__item--antre').count();
    await item.getByRole('button', { name: 'Batalkan' }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Batalkan pesan' }).click();
    await p.waitForFunction((n) => document.querySelectorAll('.daftar-pesan__item--antre').length === n - 1, n);
  });
  await cek('pengaturan kartu: tata tertib berubah, pratinjau ikut berubah', async () => {
    await p.goto(ASAL + '/admin/pengaturan');
    await p.getByRole('tab', { name: 'Kartu santri' }).click();
    const ta = p.getByLabel('Tata tertib');
    const lama = await ta.inputValue();
    await ta.fill(lama + '\nMenjaga adab di dalam masjid.');
    await p.locator('.pratinjau-kartu').getByText('Menjaga adab di dalam masjid.').waitFor();
    await p.getByRole('button', { name: 'Simpan', exact: true }).click();
    await toast(p, 'Tata tertib kartu santri disimpan');
    await aksesibel(p, 'pengaturan kartu');
    await p.getByRole('tab', { name: 'Madrasah & nilai' }).click();
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
      for (const alamat of ['/admin', '/admin/santri', '/admin/kelas', '/admin/absensi', '/admin/nilai', '/admin/raport', '/admin/hafalan', '/admin/syahriah', '/admin/pengumuman', '/admin/pesan', '/admin/harian', '/admin/absen-guru', '/admin/pengaturan', '/admin/akun']) {
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
    await p.waitForURL(ASAL + '/pengurus');
    await p.goto(ASAL + '/admin');
    await p.waitForURL(ASAL + '/pengurus');
  });
  await ctxAdmin.close();

  // ——————————————————— Ustadz/ustadzah ———————————————————
  bagian = 'Ustadz';
  {
    const { ctx, page } = await konteks(1366, 900);
    await cek('masuk sebagai ustadzah lewat pintu guru', () => masuk(page, 'guru', 'ustadzah', SANDI));
    await cek('ruang guru: menu khusus guru, absen hadir dari dasbor', async () => {
      await page.locator('.sisi').getByText('Ruang guru').waitFor();
      for (const tidak of ['Kelas & pelajaran', 'Pengaturan', 'Syahriah', 'Pesan otomatis']) {
        harus(!(await page.locator('.sisi').getByRole('link', { name: tidak, exact: true }).count()), `menu ${tidak} tampil untuk guru`);
      }
      await page.getByRole('heading', { name: 'Kehadiran saya hari ini' }).waitFor();
      const tombol = page.getByRole('button', { name: /Absen hadir/ });
      if (await tombol.count()) {
        await tombol.click();
        await toast(page, 'Kehadiran tercatat');
      }
      await page.locator('.sisi').getByRole('link', { name: 'Kehadiran saya', exact: true }).click();
      await page.waitForURL('**/admin/absen-guru');
      await page.getByText(/Rekap /).first().waitFor();
      await aksesibel(page, 'kehadiran guru');
    });
    await cek('guru melihat pelajarannya sendiri di nilai harian', async () => {
      await page.goto(ASAL + '/admin/harian');
      await page.getByRole('tab', { name: 'Pelajaran saya' }).waitFor();
      harus((await page.getByRole('tab', { name: 'Pelajaran saya' }).getAttribute('aria-selected')) === 'true', 'bawaan guru bukan pelajaran saya');
    });
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
    await cek('keluar dari ruang guru kembali ke pintu guru', async () => {
      await page.goto(ASAL + '/admin');
      await page.getByRole('button', { name: 'Keluar' }).click();
      await page.waitForURL(ASAL + '/guru');
      await masuk(page, 'guru', 'ustadzah', SANDI);
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
    await cek('foto ananda dari ponsel: ajakan, potong, tersimpan di beranda dan kepala', async () => {
      await w.locator('.ajakan-foto').getByRole('button', { name: 'Ambil foto' }).click();
      await dialog(w).getByRole('button', { name: /Ambil foto/ }).waitFor();
      harus((await dialog(w).getByLabel('Ambil foto dengan kamera').getAttribute('capture')) === 'user', 'kamera depan (selfie) tidak diminta');
      await dialog(w).getByLabel('Pilih foto dari galeri').setInputFiles(FOTO);
      await dialog(w).locator('.foto-potong canvas').waitFor();
      const kanvas = dialog(w).locator('.foto-potong canvas');
      const kotak = await kanvas.boundingBox();
      await w.mouse.move(kotak.x + kotak.width / 2, kotak.y + kotak.height / 2);
      await w.mouse.down();
      await w.mouse.move(kotak.x + kotak.width / 2 + 30, kotak.y + kotak.height / 2 + 20);
      await w.mouse.up();
      await aksesibel(w, 'potong foto');
      await dialog(w).getByRole('button', { name: 'Simpan foto' }).click();
      await toast(w, 'tersimpan');
      await w.locator('.sambutan .avatar--foto img').waitFor();
      await w.locator('.akun-wali .avatar--foto img').waitFor();
      harus(!(await w.locator('.ajakan-foto').count()), 'ajakan foto masih tampil');
    });
    await cek('kartu santri dari beranda: depan, belakang, cetak', async () => {
      await w.getByRole('link', { name: /Kartu santri digital/ }).click();
      await w.waitForURL('**/wali/kartu');
      await w.locator('.kartu__foto img').first().waitFor();
      await w.getByText('Menjaga adab di dalam masjid.').first().waitFor({ state: 'attached' });
      await w.getByRole('button', { name: 'Lihat tata tertib' }).click();
      await w.getByRole('button', { name: 'Lihat depan' }).click();
      const sebelum = await w.evaluate(() => window.__cetak);
      await w.getByRole('button', { name: 'Cetak kartu' }).click();
      await tunggu(500);
      harus((await w.evaluate(() => window.__cetak)) > sebelum, 'cetak kartu tidak membuka jendela cetak');
      await aksesibel(w, 'kartu santri wali');
      await w.goto(ASAL + '/wali');
      await w.locator('.sambutan__nama').waitFor();
    });
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
        ['Kartu santri', '/wali/kartu'],
        ['Akun & sandi', '/wali/akun'],
      ]) {
        await w.locator('.tab-bawah').getByRole('link', { name: 'Lainnya' }).click();
        await dialog(w).getByRole('link', { name: nama }).click();
        await w.waitForURL('**' + alamat);
        await w.locator('.kepala-halaman h1').waitFor();
      }
    });
    await cek('perbarui alamat: kecamatan otomatis lalu tersimpan', async () => {
      await w.getByRole('button', { name: 'Perbarui alamat' }).click();
      await dialog(w).getByRole('combobox', { name: 'Kecamatan' }).fill('gempol');
      await dialog(w).getByRole('option', { name: /Gempol.*Pasuruan/ }).click();
      await dialog(w).getByLabel('Desa / kelurahan').fill('Kejapanan');
      await dialog(w).getByRole('button', { name: 'Simpan alamat' }).click();
      await toast(w, 'Alamat diperbarui');
      await w.getByText(/Desa Kejapanan, Kec\. Gempol, Kab\. Pasuruan/).waitFor();
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
        for (const alamat of ['/wali', '/wali/raport', '/wali/absensi', '/wali/hafalan', '/wali/syahriah', '/wali/jadwal', '/wali/pengumuman', '/wali/kartu', '/wali/akun']) {
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
