import fs from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { config } from './config';
import { bukaDb, type DB } from './db';
import { buatApp } from './app';
import { ambilPengaturan } from './util';

export function jalankan(db: DB, keterangan: string) {
  const app = buatApp(db);

  // Di produksi server juga menyajikan aplikasi web hasil build.
  const folderWeb = path.resolve(process.env.WEB_DIR ?? 'dist/client');
  if (fs.existsSync(path.join(folderWeb, 'index.html'))) {
    const indeks = fs.readFileSync(path.join(folderWeb, 'index.html'), 'utf8');
    const root = path.relative(process.cwd(), folderWeb);
    app.use('/assets/*', serveStatic({ root, onFound: (_p, c) => c.header('Cache-Control', 'public, max-age=31536000, immutable') }));
    for (const f of ['/favicon.png', '/apple-touch-icon.png', '/ikon-192.png', '/ikon-512.png', '/manifest.webmanifest']) app.use(f, serveStatic({ root }));
    app.get('*', (c) => {
      if (c.req.path.startsWith('/api/')) return c.notFound();
      return c.html(indeks);
    });
  }

  serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
    console.log(`Madin Al Wafa’ berjalan di http://localhost:${info.port} (${keterangan})`);
  });
}

// Berkas ini juga diimpor oleh server/demo.ts; jalankan langsung hanya bila menjadi titik masuk.
const titikMasuk = process.argv[1] && /server[\\/]index\.(ts|js)$/.test(process.argv[1]);
if (titikMasuk) {
  const db = bukaDb();
  if (!config.demo && ambilPengaturan(db).mode === 'demo') {
    console.error(
      `Basis data di ${config.dataDir} berisi data contoh dan tidak boleh dipakai untuk data sungguhan.\n` +
        'Arahkan DATA_DIR ke folder kosong untuk memulai data madrasah yang bersih, atau jalankan `npm run demo`.',
    );
    process.exit(1);
  }
  jalankan(db, config.produksi ? 'produksi' : 'pengembangan');
}
