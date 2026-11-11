// Membuat src/data/wilayah.json (provinsi, kabupaten/kota, kecamatan) dari paket idn-area-data.
// Pakai: npm pack idn-area-data@4.0.1 && tar -xzf idn-area-data-4.0.1.tgz
//        node scripts/wilayah.mjs <folder package/data>
// Data wilayah: Kemendagri via idn-area-data (Fityan), lisensi ODbL; lihat src/data/WILAYAH.md.
import fs from 'node:fs';
import path from 'node:path';

const sumber = process.argv[2];
if (!sumber) throw new Error('Sebutkan folder data idn-area-data (berisi provinces.csv, regencies.csv, districts.csv).');

/** Pembaca CSV sederhana yang memahami kolom bertanda kutip. */
function baca(nama) {
  const teks = fs.readFileSync(path.join(sumber, nama), 'utf8').trim().split(/\r?\n/).slice(1);
  return teks.map((baris) => {
    const kolom = [];
    let isi = '';
    let kutip = false;
    for (const ch of baris) {
      if (ch === '"') kutip = !kutip;
      else if (ch === ',' && !kutip) {
        kolom.push(isi);
        isi = '';
      } else isi += ch;
    }
    kolom.push(isi);
    return kolom.map((k) => k.trim());
  });
}

const prov = Object.fromEntries(baca('provinces.csv').map(([kode, nama]) => [kode, nama]));
const kab = Object.fromEntries(baca('regencies.csv').map(([kode, , nama]) => [kode, nama]));
const kec = {};
for (const [kode, kodeKab, nama] of baca('districts.csv')) {
  if (!kab[kodeKab]) throw new Error(`Kecamatan ${kode} merujuk kabupaten tak dikenal ${kodeKab}`);
  (kec[kodeKab] ??= []).push(`${kode.slice(-2)} ${nama}`);
}
const hasil = {
  sumber: 'Kemendagri melalui idn-area-data 4.0.1 (ODbL)',
  prov,
  kab,
  kec: Object.fromEntries(Object.entries(kec).map(([k, v]) => [k, v.join('|')])),
};
const keluar = path.resolve('src/data/wilayah.json');
fs.mkdirSync(path.dirname(keluar), { recursive: true });
fs.writeFileSync(keluar, JSON.stringify(hasil));
const jumlahKec = Object.values(kec).reduce((n, v) => n + v.length, 0);
console.log(`${Object.keys(prov).length} provinsi, ${Object.keys(kab).length} kabupaten/kota, ${jumlahKec} kecamatan → ${keluar} (${Math.round(fs.statSync(keluar).size / 1024)} KB)`);
