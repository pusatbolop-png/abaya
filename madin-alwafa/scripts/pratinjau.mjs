// Membuat pratinjau mandiri: satu berkas HTML berisi aplikasi lengkap yang berjalan di peramban tanpa server.
// Hasil: dist/pratinjau/madin-alwafa-pratinjau.html (bisa dikirim, dibuka dari ponsel/PC, atau diterbitkan).
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';

const KELUAR = path.resolve('dist/pratinjau');
const SEMENTARA = path.join(KELUAR, 'vite');

await build({ configFile: 'vite.pratinjau.config.ts', logLevel: 'warn' });

let html = fs.readFileSync(path.join(SEMENTARA, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => `<style>${fs.readFileSync(path.join(SEMENTARA, href), 'utf8')}</style>`);
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => {
  const js = fs.readFileSync(path.join(SEMENTARA, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});
if (/(src|href)="\/assets\//.test(html)) throw new Error('Masih ada berkas yang belum disematkan.');

const tujuan = path.join(KELUAR, 'madin-alwafa-pratinjau.html');
fs.writeFileSync(tujuan, html);
fs.rmSync(SEMENTARA, { recursive: true, force: true });
console.log(`Pratinjau: ${path.relative(process.cwd(), tujuan)} (${(fs.statSync(tujuan).size / 1024 / 1024).toFixed(1)} MB)`);
