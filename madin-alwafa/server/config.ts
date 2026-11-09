import path from 'node:path';

const produksi = process.env.NODE_ENV === 'production';

export const config = {
  produksi,
  port: Number(process.env.PORT ?? 8080),
  host: process.env.HOST ?? '0.0.0.0',
  /** Folder basis data SQLite. Cadangkan folder ini secara berkala. */
  dataDir: path.resolve(process.env.DATA_DIR ?? 'data'),
  /**
   * Cookie Secure. Bawaan: otomatis mengikuti protokol permintaan (HTTPS → Secure), sehingga aplikasi
   * tetap bisa dipakai lewat http://IP:port sebelum domain dan sertifikat terpasang.
   */
  cookieSecure: process.env.COOKIE_SECURE === 'true' ? true : process.env.COOKIE_SECURE === 'false' ? false : ('otomatis' as const),
  /** Mode demo menampilkan pita peringatan dan tidak boleh dipakai untuk data sungguhan. */
  demo: process.env.MADIN_DEMO === '1',
  lamaSesiJam: 24 * 7,
  trustProxy: process.env.TRUST_PROXY === '1',
};
