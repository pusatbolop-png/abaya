// Pendaftaran akun wali santri secara mandiri dari ponsel: NIS + nomor WhatsApp aktif + alamat.
// Nomor cocok dengan data madrasah → akun langsung aktif. Nomor berbeda atau belum tercatat → menunggu
// pemeriksaan pengurus, yang lalu menyetujui atau menolaknya.
import type { DB } from '../db';
import { rapikanHp } from '../util';

export interface IsianAlamat {
  alamat: string | null;
  desa: string | null;
  kecamatan: string | null;
  kabupaten: string | null;
  provinsi: string | null;
  kodeWilayah: string | null;
}

export interface DataWali extends IsianAlamat {
  namaWali: string;
  hubungan: 'Ayah' | 'Ibu' | 'Wali';
  hp: string;
}

/** Simpan data wali dan sandi pilihan wali ke data santri. Hanya bidang yang terisi yang menimpa data lama. */
export function terapkanWali(db: DB, santriId: number, d: DataWali, hashSandi: string, waktu: string) {
  db.prepare(
    `UPDATE santri SET
        sandi = ?, sandi_diganti = 1, daftar_mandiri = ?,
        hp_wali = ?, nama_wali = ?,
        nama_ayah = CASE WHEN ? = 'Ayah' THEN ? ELSE nama_ayah END,
        nama_ibu = CASE WHEN ? = 'Ibu' THEN ? ELSE nama_ibu END,
        alamat = COALESCE(?, alamat), desa = COALESCE(?, desa), kecamatan = COALESCE(?, kecamatan),
        kabupaten = COALESCE(?, kabupaten), provinsi = COALESCE(?, provinsi), kode_wilayah = COALESCE(?, kode_wilayah)
      WHERE id = ?`,
  ).run(
    hashSandi,
    waktu,
    rapikanHp(d.hp),
    d.namaWali,
    d.hubungan,
    d.namaWali,
    d.hubungan,
    d.namaWali,
    d.alamat,
    d.desa,
    d.kecamatan,
    d.kabupaten,
    d.provinsi,
    d.kodeWilayah,
    santriId,
  );
}
