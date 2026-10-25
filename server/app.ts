import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import type { DB } from './db';
import { wajibMasuk, type Variabel } from './auth';
import { GalatPengguna } from './util';
import { HEADER_BERKAS } from './berkas';
import { rutePublik, dataGedung } from './routes/publik';
import { ruteAuth } from './routes/auth';
import { ruteUmkm } from './routes/umkm';
import { ruteProduk, ruteStok } from './routes/stok';
import { ruteLive } from './routes/live';
import { rutePenjualan, ruteRetur } from './routes/penjualan';
import { ruteDana } from './routes/dana';
import { ruteEkspor } from './routes/ekspor';
import { rutePengaturan, rutePengguna, ruteRingkasan } from './routes/pengaturan';
import { ruteAffiliate, ruteDasbor, ruteKonten } from './routes/program';

export function buatApp(db: DB) {
  const app = new Hono<{ Variables: Variabel }>();

  // Berkas unggahan (termasuk SVG) disajikan dalam sandbox. Middleware ini paling luar agar
  // CSP-nya tidak ditimpa secureHeaders di bawah.
  app.use('*', async (c, next) => {
    await next();
    if (c.res.headers.get('x-pcc-berkas')) {
      c.res.headers.delete('x-pcc-berkas');
      c.res.headers.set('Content-Security-Policy', HEADER_BERKAS['Content-Security-Policy']);
    }
  });

  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
      referrerPolicy: 'strict-origin-when-cross-origin',
    }),
  );

  // Perubahan data wajib membawa header khusus; peramban tidak mengirimnya lintas situs tanpa izin CORS.
  app.use('/api/*', async (c, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && c.req.header('x-pcc') !== '1') {
      throw new GalatPengguna(403, 'Permintaan ditolak karena tidak berasal dari aplikasi PCC. Muat ulang halaman lalu coba lagi.');
    }
    await next();
  });

  app.use(
    '/api/*',
    bodyLimit({
      maxSize: 20 * 1024 * 1024,
      onError: () => {
        throw new GalatPengguna(413, 'Total berkas terlalu besar. Unggah berkas yang masing-masing kurang dari 5 MB.');
      },
    }),
  );

  app.route('/api/publik', rutePublik(db));
  app.route('/api/auth', ruteAuth(db));

  const kelola = new Hono<{ Variables: Variabel }>();
  kelola.use('*', wajibMasuk(db));
  kelola.route('/umkm', ruteUmkm(db));
  kelola.route('/produk', ruteProduk(db));
  kelola.route('/stok', ruteStok(db));
  kelola.route('/live', ruteLive(db));
  kelola.route('/penjualan', rutePenjualan(db));
  kelola.route('/retur', ruteRetur(db));
  kelola.route('/dana', ruteDana(db));
  kelola.route('/ekspor', ruteEkspor(db));
  kelola.route('/pengaturan', rutePengaturan(db));
  kelola.route('/pengguna', rutePengguna(db));
  kelola.route('/ringkasan', ruteRingkasan(db));
  kelola.route('/dasbor', ruteDasbor(db));
  kelola.route('/konten', ruteKonten(db));
  kelola.route('/affiliate', ruteAffiliate(db));
  kelola.get('/gedung', (c) => c.json(dataGedung(db)));
  app.route('/api', kelola);

  app.notFound((c) => {
    if (c.req.path.startsWith('/api/')) return c.json({ galat: { pesan: 'Alamat API tidak dikenal.' } }, 404);
    return c.text('Halaman tidak ditemukan', 404);
  });

  app.onError((err, c) => {
    if (err instanceof GalatPengguna) {
      return c.json({ galat: { pesan: err.message, bidang: err.bidang } }, err.status);
    }
    console.error(err);
    return c.json({ galat: { pesan: 'Terjadi kendala di server. Coba lagi sebentar lagi; bila berulang, hubungi pengelola sistem.' } }, 500);
  });

  return app;
}
