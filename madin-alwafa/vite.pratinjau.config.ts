// Bangunan pratinjau mandiri: aplikasi + server Hono + SQLite (sql.js) berjalan seluruhnya di peramban.
// Modul khusus Node (kripto, konfigurasi, cookie, info koneksi) diganti padanannya di src/pratinjau.
// Dipanggil oleh scripts/pratinjau.mjs, yang lalu menyatukan semuanya menjadi satu berkas HTML.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const akar = path.dirname(fileURLToPath(import.meta.url));
const tiruan = path.join(akar, 'src/pratinjau/tiruan.ts');
const gantiBerkas: Record<string, string> = {
  [path.join(akar, 'server/kripto.ts')]: path.join(akar, 'src/pratinjau/kripto.ts'),
  [path.join(akar, 'server/config.ts')]: tiruan,
};
const gantiPaket: Record<string, string> = {
  'hono/cookie': tiruan,
  '@hono/node-server/conninfo': tiruan,
};

function pratinjau(): Plugin {
  return {
    name: 'madin-pratinjau',
    enforce: 'pre',
    async resolveId(sumber, pengimpor, opsi) {
      if (gantiPaket[sumber]) return gantiPaket[sumber];
      if (!pengimpor || !sumber.startsWith('.')) return null;
      const hasil = await this.resolve(sumber, pengimpor, { ...opsi, skipSelf: true });
      return hasil && gantiBerkas[hasil.id] ? gantiBerkas[hasil.id] : null;
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html.replace('/src/main.tsx', '/src/pratinjau/main.tsx').replace(/\s*<link rel="(icon|manifest|apple-touch-icon)"[^>]*>/g, ''),
    },
  };
}

export default defineConfig({
  plugins: [react(), pratinjau()],
  define: { 'import.meta.env.VITE_PRATINJAU': JSON.stringify('1') },
  publicDir: false,
  build: {
    outDir: 'dist/pratinjau/vite',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 8000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
