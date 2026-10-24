import path from 'node:path';

const produksi = process.env.NODE_ENV === 'production';

export const config = {
  produksi,
  port: Number(process.env.PORT ?? 8080),
  host: process.env.HOST ?? '0.0.0.0',
  /** Folder basis data dan berkas unggahan. */
  dataDir: path.resolve(process.env.DATA_DIR ?? 'data'),
  /** Cookie Secure aktif di produksi kecuali dimatikan tegas (mis. uji di jaringan lokal tanpa HTTPS). */
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : produksi,
  /** Mode demo menampilkan pita peringatan di antarmuka dan tidak boleh dipakai untuk produksi. */
  demo: process.env.PCC_DEMO === '1',
  lamaSesiJam: 12,
  trustProxy: process.env.TRUST_PROXY === '1',
};
