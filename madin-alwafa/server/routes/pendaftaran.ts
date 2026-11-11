// Pemeriksaan pendaftaran wali yang nomor WhatsApp-nya belum cocok dengan data madrasah.
import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { hanyaAdmin, hapusSemuaSesi, pelaku, type VarPengurus } from '../auth';
import { GalatPengguna, bacaIsi, catatLog, idParam, satu, semua, sekarang, teksOpsional } from '../util';
import { terapkanWali } from '../domain/pendaftaran';

export function rutePendaftaran(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();

  r.get('/', (c) => {
    const status = c.req.query('status') === 'riwayat' ? 'riwayat' : 'menunggu';
    const daftar = semua(
      db,
      `SELECT p.id, p.santri_id AS santriId, s.nama AS santri, s.nis, s.jk, s.foto_versi AS fotoVersi, k.nama AS kelas,
              p.nama_wali AS namaWali, p.hubungan, p.hp, s.hp_wali AS hpTercatat,
              p.alamat, p.desa, p.kecamatan, p.kabupaten, p.provinsi, p.status, p.alasan, p.dibuat, p.diputus, p.diputus_oleh AS diputusOleh
         FROM pendaftaran_wali p JOIN santri s ON s.id = p.santri_id LEFT JOIN kelas k ON k.id = s.kelas_id
        WHERE ${status === 'menunggu' ? "p.status = 'menunggu'" : "p.status != 'menunggu'"}
        ORDER BY ${status === 'menunggu' ? 'p.dibuat' : 'p.diputus DESC'} LIMIT 200`,
    );
    return c.json({ daftar });
  });

  const ambil = (id: number) => {
    const p = satu<{
      id: number;
      santri_id: number;
      nama_wali: string;
      hubungan: 'Ayah' | 'Ibu' | 'Wali';
      hp: string;
      alamat: string | null;
      desa: string | null;
      kecamatan: string | null;
      kabupaten: string | null;
      provinsi: string | null;
      kode_wilayah: string | null;
      sandi: string;
      status: string;
      santri: string;
      nis: string;
    }>(db, 'SELECT p.*, s.nama AS santri, s.nis FROM pendaftaran_wali p JOIN santri s ON s.id = p.santri_id WHERE p.id = ?', id);
    if (!p) throw new GalatPengguna(404, 'Pendaftaran tidak ditemukan.');
    if (p.status !== 'menunggu') throw new GalatPengguna(409, 'Pendaftaran ini sudah diputuskan.');
    return p;
  };

  r.post('/:id/setujui', (c) => {
    hanyaAdmin(c);
    const p = ambil(idParam(c));
    const waktu = sekarang();
    db.transaction(() => {
      terapkanWali(
        db,
        p.santri_id,
        {
          namaWali: p.nama_wali,
          hubungan: p.hubungan,
          hp: p.hp,
          alamat: p.alamat,
          desa: p.desa,
          kecamatan: p.kecamatan,
          kabupaten: p.kabupaten,
          provinsi: p.provinsi,
          kodeWilayah: p.kode_wilayah,
        },
        p.sandi,
        waktu,
      );
      db.prepare("UPDATE pendaftaran_wali SET status = 'disetujui', diputus = ?, diputus_oleh = ? WHERE id = ?").run(waktu, pelaku(c), p.id);
    })();
    hapusSemuaSesi(db, 'wali', p.santri_id);
    catatLog(db, pelaku(c), 'Menyetujui pendaftaran wali', `${p.santri} (${p.nis}) · ${p.nama_wali}`);
    return c.json({ ok: true, hp: p.hp, nis: p.nis, santri: p.santri, namaWali: p.nama_wali });
  });

  r.post('/:id/tolak', async (c) => {
    hanyaAdmin(c);
    const p = ambil(idParam(c));
    const { alasan } = await bacaIsi(c, z.object({ alasan: teksOpsional(200) }));
    db.prepare("UPDATE pendaftaran_wali SET status = 'ditolak', alasan = ?, diputus = ?, diputus_oleh = ? WHERE id = ?").run(alasan, sekarang(), pelaku(c), p.id);
    catatLog(db, pelaku(c), 'Menolak pendaftaran wali', `${p.santri} (${p.nis}) · ${p.nama_wali}${alasan ? ` · ${alasan}` : ''}`);
    return c.json({ ok: true, hp: p.hp, santri: p.santri, namaWali: p.nama_wali });
  });

  return r;
}
