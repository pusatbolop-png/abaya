// Server demo dengan data contoh di ./data-demo. `--ulang` menghapus dan membuat ulang data contoh.
import fs from 'node:fs';
import path from 'node:path';

process.env.MADIN_DEMO = '1';
process.env.DATA_DIR ??= 'data-demo';
const folder = path.resolve(process.env.DATA_DIR);
if (process.argv.includes('--ulang')) fs.rmSync(folder, { recursive: true, force: true });

const { bukaDb } = await import('./db');
const { isiDemo, SANDI_DEMO, SANDI_WALI_DEMO } = await import('./demo-data');
const { jalankan } = await import('./index');

const db = bukaDb(folder);
const kosong = !(db.prepare('SELECT 1 FROM pengurus LIMIT 1').get());
let nis = (db.prepare("SELECT s.nis FROM santri s JOIN kelas k ON k.id = s.kelas_id WHERE k.nama = 'Ula 2 Putri' ORDER BY s.id LIMIT 1").get() as { nis: string } | undefined)?.nis;
if (kosong) {
  console.log('Menyiapkan data contoh…');
  nis = (await isiDemo(db)).nisContoh;
}
console.log(`Masuk pengurus: admin / ${SANDI_DEMO}  ·  Masuk wali: NIS ${nis} / ${SANDI_WALI_DEMO}`);
jalankan(db, 'mode demo');
