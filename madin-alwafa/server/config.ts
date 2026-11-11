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
  /** Alamat API gateway WhatsApp Fonnte (bisa diganti untuk pengujian). */
  waFonnteUrl: process.env.WA_FONNTE_URL ?? 'https://api.fonnte.com/send',
  /** Jeda antarpesan WhatsApp agar nomor pengirim tidak dianggap spam. */
  waJedaMs: Number(process.env.WA_JEDA_MS ?? 4000),
  /** Penjadwal laporan harian dan pengingat syahriah (matikan dengan PENJADWAL=0). */
  penjadwal: process.env.PENJADWAL !== '0',
};
