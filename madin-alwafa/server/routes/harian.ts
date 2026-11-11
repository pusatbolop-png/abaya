// Nilai harian per pertemuan: daftar pelajaran hari itu, isian satu pelajaran, dan penyimpanannya.
import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { pelaku, type VarPengurus } from '../auth';
import { GalatPengguna, bacaIsi, catatLog, satu, tanggal } from '../util';
import { bacaHarian, simpanHarian, statusHarian } from '../domain/harian';
import { jamWib } from '../domain/pesan';
import { hariIni } from '../../shared/format';

const tglValid = (t: string | undefined) => {
  const v = t ?? hariIni();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new GalatPengguna(400, 'Tanggal tidak valid.');
  return v;
};

export function ruteHarian(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();

  r.get('/', (c) => {
    const st = statusHarian(db, tglValid(c.req.query('tanggal')));
    return c.json({ ...st, hariIni: hariIni(), jamSekarang: jamWib(), saya: c.get('pengurus').nama });
  });

  r.get('/isi', (c) => c.json(bacaHarian(db, Number(c.req.query('kelas')), Number(c.req.query('mapel')), tglValid(c.req.query('tanggal')))));

  r.put('/', async (c) => {
    const isi = await bacaIsi(
      c,
      z.object({
        kelasId: z.number().int().positive(),
        mapelId: z.number().int().positive(),
        tanggal: tanggal(),
        daftar: z
          .array(z.object({ santriId: z.number().int().positive(), nilai: z.number().int('Nilai harus bilangan bulat.').min(0, 'Nilai 0–100.').max(100, 'Nilai 0–100.').nullable() }))
          .max(200),
      }),
    );
    const berubah = simpanHarian(db, isi, pelaku(c));
    if (berubah) {
      const k = satu<{ kelas: string; mapel: string }>(
        db,
        'SELECT k.nama AS kelas, m.nama AS mapel FROM kelas k, mapel m WHERE k.id = ? AND m.id = ?',
        isi.kelasId,
        isi.mapelId,
      );
      catatLog(db, pelaku(c), 'Mengisi nilai harian', `${k?.kelas} · ${k?.mapel} (${isi.tanggal}): ${berubah} santri`);
    }
    return c.json({ ok: true, berubah });
  });

  return r;
}
