import fs from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { config } from './config';
import { bukaDb } from './db';
import { buatApp } from './app';
import { ambilPengaturan } from './util';

const db = bukaDb();

if (config.produksi && !config.demo && ambilPengaturan(db).mode === 'demo') {
  console.error(
    `Basis data di ${config.dataDir} berisi data contoh dan tidak boleh dipakai di produksi.\n` +
      'Arahkan DATA_DIR ke folder kosong untuk memulai data produksi yang bersih.',
  );
  process.exit(1);
}

const app = buatApp(db);

// Di produksi server juga menyajikan aplikasi web hasil build.
const folderWeb = path.resolve(process.env.WEB_DIR ?? 'dist/client');
if (fs.existsSync(folderWeb)) {
  const indeks = fs.readFileSync(path.join(folderWeb, 'index.html'), 'utf8');
  app.use('/assets/*', serveStatic({ root: path.relative(process.cwd(), folderWeb), onFound: (_p, c) => c.header('Cache-Control', 'public, max-age=31536000, immutable') }));
  app.use('/fonts/*', serveStatic({ root: path.relative(process.cwd(), folderWeb), onFound: (_p, c) => c.header('Cache-Control', 'public, max-age=31536000, immutable') }));
  for (const f of ['/favicon.png', '/apple-touch-icon.png', '/merek/*']) app.use(f, serveStatic({ root: path.relative(process.cwd(), folderWeb) }));
  app.get('*', (c) => {
    if (c.req.path.startsWith('/api/')) return c.notFound();
    return c.html(indeks);
  });
}

serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.log(`PCC berjalan di http://localhost:${info.port} ${config.demo ? '(mode demo)' : config.produksi ? '(produksi)' : '(pengembangan)'}`);
});
