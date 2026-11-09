// Mesin pratinjau: menjalankan server Madin Al-Wafa (Hono + SQLite) seluruhnya di peramban pengunjung.
// Data contoh dibuat saat halaman dibuka; semua perubahan hanya ada di tab ini dan hilang saat dimuat ulang.
import initSqlJs from 'sql.js/dist/sql-asm-memory-growth.js';
import { DbPratinjau } from './sqlite';
import { migrasi } from '../../server/skema';
import { isiDemo } from '../../server/demo-data';
import { buatApp } from '../../server/app';
import type { DB } from '../../server/db';

export async function nyalakan() {
  const SQL = await initSqlJs();
  const db = new DbPratinjau(new SQL.Database()) as unknown as DB;
  db.pragma('foreign_keys = ON');
  migrasi(db);
  await isiDemo(db);
  const app = buatApp(db);

  // Permintaan /api/... dari antarmuka dijawab langsung oleh server di memori, tanpa jaringan.
  const asli = window.fetch.bind(window);
  window.fetch = (masukan: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof masukan === 'string' ? masukan : masukan instanceof URL ? masukan.href : masukan.url;
    if (url.startsWith('/api/')) return Promise.resolve(app.fetch(new Request(`https://pratinjau.invalid${url}`, init)));
    return asli(masukan, init);
  };
}
