// Uji peramban ujung ke ujung dengan data demo. Jalankan setelah `npm run build`.
// Menyalakan server demo sementara, lalu menelusuri alur pengurus dan wali santri.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const PORT = 8093;
const ASAL = `http://localhost:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'madin-e2e-'));
if (!fs.existsSync('dist/client/index.html')) throw new Error('Jalankan `npm run build` lebih dulu.');

const server = spawn('npx', ['tsx', 'server/demo.ts'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), DATA_DIR: dataDir },
  stdio: 'ignore',
  detached: true,
});
const galat = [];
let browser;
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${ASAL}/api/publik/lembaga`)).ok) break;
    } catch {}
    if (i > 120) throw new Error('Server demo tidak menyala.');
    await new Promise((r) => setTimeout(r, 250));
  }
  // Pakai peramban bawaan Playwright; bila tidak ada, pakai Chromium yang ditunjuk CHROMIUM_PATH.
  browser = await chromium.launch().catch(() => chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' }));

  const masuk = async (jenis, lebar = 1280) => {
    const ctx = await browser.newContext({ viewport: { width: lebar, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => galat.push(`${page.url()} ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && galat.push(`${page.url()} ${m.text()}`));
    await page.goto(ASAL);
    await page.getByRole('tab', { name: jenis === 'wali' ? 'Wali santri' : 'Pengurus' }).click();
    await page.getByRole('button', { name: 'Isi otomatis' }).click();
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await page.waitForURL(jenis === 'wali' ? '**/wali' : '**/admin');
    return page;
  };
  const langkah = (n) => console.log('✓', n);

  // ——— Pengurus ———
  const p = await masuk('pengurus');
  await p.getByRole('heading', { name: /Selamat/ }).waitFor();
  langkah('dasbor pengurus tampil');

  // Absensi: kelas yang belum diabsen hari ini.
  await p.goto(`${ASAL}/admin/absensi`);
  await p.getByLabel('Kelas').selectOption({ label: 'Wustho 1 Putra' });
  await p.getByText('Belum disimpan').waitFor();
  await p.getByRole('group', { name: /^Kehadiran/ }).first().getByRole('button', { name: 'S' }).click();
  await p.getByLabel(/^Keterangan/).first().fill('Demam');
  await p.getByRole('button', { name: 'Simpan absensi' }).click();
  await p.getByText(/Absensi Wustho 1 Putra tersimpan: 7 hadir/).waitFor();
  langkah('absensi disimpan');

  // Nilai: isi UAS satu mapel.
  await p.goto(`${ASAL}/admin/nilai`);
  await p.getByRole('button', { name: /Al-Qur'an/ }).first().click();
  const uas = p.locator('input[data-kolom="uas"]');
  await uas.first().waitFor();
  const n = await uas.count();
  for (let i = 0; i < n; i++) await uas.nth(i).fill(String(80 + i));
  await p.getByRole('button', { name: 'Simpan nilai' }).click();
  await p.getByText(new RegExp(`Nilai ${n} santri disimpan`)).waitFor();
  langkah(`nilai UAS ${n} santri disimpan`);

  // Tambah santri: sandi wali tampil sekali.
  await p.goto(`${ASAL}/admin/santri`);
  await p.getByRole('button', { name: 'Tambah santri' }).click();
  const dlg = p.getByRole('dialog');
  await dlg.getByLabel('Nama lengkap').fill('Zainab Uji Coba');
  await dlg.getByRole('radio', { name: 'Santriwati (putri)' }).click();
  await dlg.getByLabel('Kelas').selectOption({ label: 'Ula 1 Putri' });
  await dlg.getByLabel('Nomor HP/WhatsApp wali').fill('081200001111');
  await dlg.getByRole('button', { name: 'Simpan' }).click();
  await p.getByRole('heading', { name: 'Akun wali santri' }).waitFor();
  const sandiBaru = (await p.locator('.kartu-sandi__nilai').nth(1).textContent()).trim();
  const nisBaru = (await p.locator('.kartu-sandi__nilai').nth(0).textContent()).trim();
  assert.match(sandiBaru, /^[a-z]{4}\d{4}$/);
  assert.ok(await p.getByRole('link', { name: /Kirim ke WhatsApp wali/ }).getAttribute('href').then((h) => h.startsWith('https://wa.me/6281200001111')));
  await p.keyboard.press('Escape');
  langkah(`santri baru ${nisBaru} dengan sandi wali`);

  // Raport: isi lengkap untuk satu santri semester berjalan, lalu terbitkan.
  // Nilai semester berjalan belum lengkap (UAS belum), jadi isi semua mapel lewat API agar siap terbit.
  const kuki = (await p.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
  const api = async (metode, url, isi) => {
    const r = await fetch(ASAL + url, { method: metode, headers: { cookie: kuki, 'x-madin': '1', 'content-type': 'application/json' }, body: isi && JSON.stringify(isi) });
    return r.json();
  };
  const kelasList = (await api('GET', '/api/admin/kelas')).daftar;
  const ula2pi = kelasList.find((k) => k.nama === 'Ula 2 Putri');
  const detail = await api('GET', `/api/admin/kelas/${ula2pi.id}`);
  const periodeAktif = (await api('GET', '/api/admin/periode')).daftar.find((x) => x.aktif);
  const nisDemo = (await api('GET', '/api/auth/saya')).demo.nis;
  const target = detail.santri.find((s) => s.nis === nisDemo);
  for (const m of detail.mapel) {
    await api('PUT', '/api/admin/nilai', { periodeId: periodeAktif.id, kelasId: ula2pi.id, mapelId: m.mapelId, daftar: [{ santriId: target.id, harian: 88, uts: 86, uas: 90 }] });
  }
  await p.goto(`${ASAL}/admin/raport/${target.id}/${periodeAktif.id}`);
  for (const aspek of ['Akhlak', 'Kerajinan', 'Kerapian', 'Kedisiplinan']) await p.getByRole('radiogroup', { name: aspek }).getByRole('radio', { name: 'A' }).click();
  await p.getByRole('button', { name: 'Contoh 1' }).click();
  await p.getByRole('button', { name: 'Simpan isian' }).click();
  await p.getByText('Isian raport disimpan.').waitFor();
  await p.getByRole('button', { name: 'Terbitkan' }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Terbitkan' }).click();
  await p.getByText('Raport diterbitkan dan bisa dilihat wali santri.').waitFor();
  const kode = (await p.locator('.kaki-raport__kode').textContent()).trim();
  assert.match(kode, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  langkah(`raport ${target.nama} diterbitkan dengan kode ${kode}`);

  // Pengumuman baru untuk satu kelas.
  await p.goto(`${ASAL}/admin/pengumuman`);
  await p.getByRole('button', { name: 'Tulis pengumuman' }).click();
  const dlg2 = p.getByRole('dialog');
  await dlg2.getByLabel('Judul').fill('Uji pengumuman kelas');
  await dlg2.getByLabel('Isi').fill('Isi pengumuman uji.');
  await dlg2.getByLabel('Sasaran').selectOption({ label: 'Wali santri Ula 2 Putri' });
  await dlg2.getByRole('button', { name: 'Terbitkan' }).click();
  await p.getByText('Pengumuman diterbitkan.').waitFor();
  langkah('pengumuman kelas diterbitkan');

  // Syahriah: catat bulan yang belum lunas.
  await p.goto(`${ASAL}/admin/syahriah`);
  const kosong = p.locator('button.sel-bayar:not(.sel-bayar--lunas)').first();
  await kosong.click();
  await p.getByRole('dialog').getByRole('button', { name: /^Simpan/ }).click();
  await p.getByText(/Syahriah .* dicatat/).waitFor();
  langkah('syahriah dicatat');

  // ——— Wali santri baru: masuk dengan sandi awal ———
  const ctxBaru = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const wb = await ctxBaru.newPage();
  await wb.goto(ASAL);
  await wb.getByLabel('Nomor Induk Santri (NIS)').fill(nisBaru);
  await wb.getByLabel('Sandi', { exact: true }).fill(sandiBaru);
  await wb.getByRole('button', { name: 'Masuk', exact: true }).click();
  await wb.waitForURL('**/wali');
  await wb.getByText('Ganti sandi awal Anda').waitFor();
  langkah('wali santri baru masuk dan diminta mengganti sandi');
  await ctxBaru.close();

  // ——— Wali santri demo ———
  const w = await masuk('wali', 390);
  await w.getByRole('heading', { name: target.nama }).waitFor();
  await w.getByText('Uji pengumuman kelas').waitFor();
  await w.goto(`${ASAL}/wali/raport`);
  await w.getByText(`Semester Ganjil ${periodeAktif.tahunAjaran}`).waitFor();
  await w.getByText(`Semester Ganjil ${periodeAktif.tahunAjaran}`).click();
  await w.getByText('Nilai mata pelajaran').waitFor();
  await w.getByRole('tab', { name: 'Lembar raport' }).click();
  await w.locator('.lembar').waitFor();
  langkah('wali membuka raport baru (ringkasan dan lembar)');

  // Verifikasi publik dari kode raport.
  const v = await browser.newPage();
  await v.goto(`${ASAL}/verifikasi/${kode}`);
  await v.getByText('Raport asli').waitFor();
  await v.goto(`${ASAL}/verifikasi/ABCD-EFGH-JKLM`);
  await v.getByText('Kode tidak dikenal').waitFor();
  langkah('verifikasi kode raport');

  if (galat.length) throw new Error('Galat di konsol peramban:\n' + galat.join('\n'));
  console.log('Semua alur berhasil.');
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid);
  } catch {}
  fs.rmSync(dataDir, { recursive: true, force: true });
}
