// Kartu santri digital: sisi depan berisi identitas santri, sisi belakang tata tertib madrasah.
import type { DB } from '../db';
import { GalatPengguna, ambilPengaturan, kodeAcak, lembaga, satu } from '../util';

export { uraiAturan, type BagianAturan } from '../../shared/aturan';
import { uraiAturan } from '../../shared/aturan';

/** Kode kartu dibuat sekali, saat kartu pertama kali dibuka. */
function kodeKartu(db: DB, santriId: number): string {
  const ada = satu<{ kartu_kode: string | null }>(db, 'SELECT kartu_kode FROM santri WHERE id = ?', santriId);
  if (ada?.kartu_kode) return ada.kartu_kode;
  for (let i = 0; i < 5; i++) {
    const kode = kodeAcak(10);
    if (!satu(db, 'SELECT 1 FROM santri WHERE kartu_kode = ?', kode)) {
      db.prepare('UPDATE santri SET kartu_kode = ? WHERE id = ?').run(kode, santriId);
      return kode;
    }
  }
  throw new Error('Gagal membuat kode kartu unik.');
}

export function dataKartu(db: DB, santriId: number) {
  const s = satu<{
    id: number;
    nis: string;
    nama: string;
    jk: 'L' | 'P';
    tempat_lahir: string | null;
    tanggal_lahir: string | null;
    nama_wali: string | null;
    nama_ayah: string | null;
    desa: string | null;
    kecamatan: string | null;
    kabupaten: string | null;
    alamat: string | null;
    status: string;
    tanggal_masuk: string | null;
    foto_versi: string | null;
    kelas: string | null;
    jenjang: string | null;
  }>(
    db,
    `SELECT s.id, s.nis, s.nama, s.jk, s.tempat_lahir, s.tanggal_lahir, s.nama_wali, s.nama_ayah, s.desa, s.kecamatan, s.kabupaten, s.alamat,
            s.status, s.tanggal_masuk, s.foto_versi, k.nama AS kelas, k.jenjang
       FROM santri s LEFT JOIN kelas k ON k.id = s.kelas_id WHERE s.id = ?`,
    santriId,
  );
  if (!s) throw new GalatPengguna(404, 'Santri tidak ditemukan.');
  const p = ambilPengaturan(db);
  const wilayah = [s.desa, s.kecamatan && `Kec. ${s.kecamatan}`, s.kabupaten?.replace(/^Kabupaten /, 'Kab. ')].filter(Boolean).join(', ');
  return {
    kode: kodeKartu(db, s.id),
    santri: {
      id: s.id,
      nis: s.nis,
      nama: s.nama,
      jk: s.jk,
      tempatLahir: s.tempat_lahir,
      tanggalLahir: s.tanggal_lahir,
      wali: s.nama_wali ?? s.nama_ayah,
      alamat: wilayah || s.alamat,
      kelas: s.kelas,
      jenjang: s.jenjang,
      status: s.status,
      tanggalMasuk: s.tanggal_masuk,
      fotoVersi: s.foto_versi,
    },
    lembaga: lembaga(p),
    aturan: uraiAturan(p.tata_tertib),
    berlaku: p.kartu_berlaku,
  };
}
export type DataKartu = ReturnType<typeof dataKartu>;

/** Pemeriksaan kartu dari QR: hanya identitas ringkas, tanpa foto dan alamat. */
export function periksaKartu(db: DB, kode: string) {
  const bersih = kode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const s = bersih.length === 10
    ? satu<{ nama: string; nis: string; jk: string; status: string; kelas: string | null }>(
        db,
        'SELECT s.nama, s.nis, s.jk, s.status, k.nama AS kelas FROM santri s LEFT JOIN kelas k ON k.id = s.kelas_id WHERE s.kartu_kode = ?',
        bersih,
      )
    : undefined;
  const lmb = lembaga(ambilPengaturan(db));
  if (!s) return { lembaga: lmb, hasil: 'tidak-ditemukan' as const };
  return {
    lembaga: lmb,
    hasil: s.status === 'aktif' ? ('sah' as const) : ('tidak-aktif' as const),
    santri: { nama: s.nama, nis: s.nis, jk: s.jk, kelas: s.kelas, status: s.status, kode: bersih },
  };
}
