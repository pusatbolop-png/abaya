import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import type { DB } from './db';
import { siapaMasuk, wajibPengurus, wajibWali, type VarPengurus, type VarWali } from './auth';
import { GalatPengguna, idParam, satu } from './util';
import { ambilFoto } from './domain/foto';
import { ruteAuth } from './routes/auth';
import { rutePublik } from './routes/publik';
import { ruteSantri } from './routes/santri';
import { ruteKelas, ruteMapel, rutePeriode } from './routes/akademik';
import { ruteAbsensi, ruteHafalan, ruteNilai } from './routes/kbm';
import { ruteRaport } from './routes/raport';
import { ruteLog, rutePengaturan, rutePengumuman, rutePengurus, ruteRingkasan, ruteSyahriah } from './routes/lembaga';
import { ruteWali } from './routes/wali';
import { rutePendaftaran } from './routes/pendaftaran';
import { rutePesan } from './routes/pesan';
import { ruteHarian } from './routes/harian';
import { ruteAbsenGuru } from './routes/absenGuru';

export function buatApp(db: DB) {
  const app = new Hono();

  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
      // Halaman bisa dibuka lewat http://IP:port; jangan paksa peningkatan ke https.
      strictTransportSecurity: false,
      referrerPolicy: 'strict-origin-when-cross-origin',
    }),
  );

  // Perubahan data wajib membawa header khusus; peramban tidak mengirimnya lintas situs tanpa izin CORS.
  app.use('/api/*', async (c, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && c.req.header('x-madin') !== '1') {
      throw new GalatPengguna(403, 'Permintaan ditolak karena tidak berasal dari aplikasi madrasah. Muat ulang halaman lalu coba lagi.');
    }
    await next();
    // Respons API tidak disimpan peramban, kecuali yang menetapkan aturannya sendiri (foto berversi).
    if (!c.res.headers.get('Cache-Control')) c.header('Cache-Control', 'no-store');
  });

  app.use(
    '/api/*',
    bodyLimit({
      maxSize: 2 * 1024 * 1024,
      onError: () => {
        throw new GalatPengguna(413, 'Data yang dikirim terlalu besar.');
      },
    }),
  );

  app.route('/api/publik', rutePublik(db));

  // Foto santri: pengurus melihat semua, wali hanya foto anaknya sendiri. Alamat berversi (?v=) sehingga aman disimpan lama.
  app.get('/api/foto/santri/:id', (c) => {
    const id = idParam(c);
    const { pengurus, wali } = siapaMasuk(c, db);
    if (!pengurus && wali?.santriId !== id) throw new GalatPengguna(pengurus || wali ? 404 : 401, 'Foto tidak ditemukan.');
    const foto = ambilFoto(db, id);
    if (!foto) throw new GalatPengguna(404, 'Foto tidak ditemukan.');
    c.header('Cache-Control', 'private, max-age=31536000, immutable');
    c.header('Content-Type', foto.jenis);
    return c.body(foto.data as Uint8Array<ArrayBuffer>);
  });
  app.route('/api/auth', ruteAuth(db));

  const pengurus = new Hono<{ Variables: VarPengurus }>();
  pengurus.use('*', wajibPengurus(db));
  pengurus.route('/santri', ruteSantri(db));
  pengurus.route('/kelas', ruteKelas(db));
  pengurus.route('/mapel', ruteMapel(db));
  pengurus.route('/periode', rutePeriode(db));
  pengurus.route('/absensi', ruteAbsensi(db));
  pengurus.route('/nilai', ruteNilai(db));
  pengurus.route('/harian', ruteHarian(db));
  pengurus.route('/absen-guru', ruteAbsenGuru(db));
  pengurus.route('/hafalan', ruteHafalan(db));
  pengurus.route('/raport', ruteRaport(db));
  pengurus.route('/syahriah', ruteSyahriah(db));
  pengurus.route('/pengumuman', rutePengumuman(db));
  pengurus.route('/pengaturan', rutePengaturan(db));
  pengurus.route('/pengurus', rutePengurus(db));
  pengurus.route('/ringkasan', ruteRingkasan(db));
  pengurus.route('/log', ruteLog(db));
  pengurus.route('/pendaftaran', rutePendaftaran(db));
  pengurus.route('/pesan', rutePesan(db));
  // Angka kecil di menu samping: pendaftaran wali yang menunggu dan pesan yang belum terkirim.
  pengurus.get('/lencana', (c) =>
    c.json({
      pendaftaran: satu<{ n: number }>(db, "SELECT COUNT(*) AS n FROM pendaftaran_wali WHERE status = 'menunggu'")!.n,
      pesanAntre: satu<{ n: number }>(db, "SELECT COUNT(*) AS n FROM pesan_keluar WHERE status = 'antre'")!.n,
    }),
  );
  app.route('/api/admin', pengurus);

  const wali = new Hono<{ Variables: VarWali }>();
  wali.use('*', wajibWali(db));
  wali.route('/', ruteWali(db));
  app.route('/api/wali', wali);

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
