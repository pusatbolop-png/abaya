// Absensi guru: guru mengisi kehadirannya sendiri; administrator melihat, mencatat, dan merekap.
import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { hanyaAdmin, pelaku, type VarPengurus } from '../auth';
import { GalatPengguna, bacaIsi, catatLog, idParam, satu, teksOpsional } from '../util';
import { absenGuruHari, catatAbsenGuru, rekapAbsenGuru } from '../domain/absenGuru';
import { jamWib } from '../domain/pesan';
import { bulanIni, hariIni } from '../../shared/format';

const tgl = (t: string | undefined) => {
  const v = t ?? hariIni();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new GalatPengguna(400, 'Tanggal tidak valid.');
  return v;
};

export function ruteAbsenGuru(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();

  r.get('/', (c) => {
    const tanggal = tgl(c.req.query('tanggal'));
    return c.json({ tanggal, hariIni: hariIni(), daftar: absenGuruHari(db, tanggal) });
  });

  r.get('/rekap', (c) => {
    const bulan = c.req.query('bulan') ?? bulanIni();
    if (!/^\d{4}-\d{2}$/.test(bulan)) throw new GalatPengguna(400, 'Bulan tidak valid.');
    return c.json({ bulan, daftar: rekapAbsenGuru(db, bulan) });
  });

  // Kehadiran saya hari ini (dasbor guru).
  r.get('/saya', (c) => {
    const saya = c.get('pengurus');
    const hari = hariIni();
    const g = absenGuruHari(db, hari).find((x) => x.id === saya.id);
    return c.json({ tanggal: hari, jamSekarang: jamWib(), wajib: !!g?.wajib, mengajar: g?.mengajar ?? [], jamPertama: g?.jamPertama ?? null, status: g?.status ?? null, jam: g?.jam ?? null, terlambat: !!g?.terlambat, keterangan: g?.keterangan ?? null });
  });

  r.post('/saya', async (c) => {
    const saya = c.get('pengurus');
    const isi = await bacaIsi(c, z.object({ status: z.enum(['H', 'I', 'S'], { error: 'Pilih hadir, izin, atau sakit.' }), keterangan: teksOpsional(200) }));
    if (isi.status !== 'H' && !isi.keterangan) throw new GalatPengguna(400, 'Tulis keterangan izin atau sakit.', { keterangan: 'Wajib diisi.' });
    const hari = hariIni();
    const g = absenGuruHari(db, hari).find((x) => x.id === saya.id);
    catatAbsenGuru(db, { pengurusId: saya.id, tanggal: hari, status: isi.status, jam: jamWib(), jamPertama: g?.jamPertama ?? null, keterangan: isi.keterangan, oleh: saya.nama });
    catatLog(db, saya.nama, 'Mengisi kehadiran guru', { H: 'Hadir', I: 'Izin', S: 'Sakit' }[isi.status] + (isi.keterangan ? ` · ${isi.keterangan}` : ''));
    return c.json({ ok: true });
  });

  // Administrator mencatat atau membetulkan kehadiran seorang guru.
  r.put('/:id', async (c) => {
    hanyaAdmin(c);
    const id = idParam(c);
    const isi = await bacaIsi(c, z.object({ tanggal: z.string(), status: z.enum(['H', 'I', 'S', 'A']), keterangan: teksOpsional(200) }));
    const tanggal = tgl(isi.tanggal);
    if (tanggal > hariIni()) throw new GalatPengguna(400, 'Tanggal belum tiba.');
    const g = satu<{ nama: string }>(db, 'SELECT nama FROM pengurus WHERE id = ?', id);
    if (!g) throw new GalatPengguna(404, 'Guru tidak ditemukan.');
    const info = absenGuruHari(db, tanggal).find((x) => x.id === id);
    catatAbsenGuru(db, { pengurusId: id, tanggal, status: isi.status, jam: isi.status === 'H' ? (tanggal === hariIni() ? jamWib() : info?.jamPertama ?? null) : null, jamPertama: info?.jamPertama ?? null, keterangan: isi.keterangan, oleh: pelaku(c) });
    catatLog(db, pelaku(c), 'Mencatat kehadiran guru', `${g.nama} (${tanggal}): ${isi.status}`);
    return c.json({ ok: true });
  });

  return r;
}
