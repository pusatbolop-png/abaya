import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { hanyaAdmin, pelaku, type VarPengurus } from '../auth';
import { GalatPengguna, ambilPengaturan, bacaIsi, bobotNilai, catatLog, idParam, satu, semua, teksOpsional } from '../util';
import { ambilPeriode, bacaRaport, pastikanBelumTerbit, peringkatKelas, susunRaport, tarik, terbitkan } from '../domain/raport';

const nilaiKepribadian = z.enum(['A', 'B', 'C', 'D']).nullable().optional();

export function ruteRaport(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();

  // Daftar raport satu kelas: kelengkapan, rata-rata, peringkat, dan status terbit.
  r.get('/', (c) => {
    const kelasId = Number(c.req.query('kelas'));
    const kelas = satu<{ id: number; nama: string; wali_kelas: string | null }>(db, 'SELECT id, nama, wali_kelas FROM kelas WHERE id = ?', kelasId);
    if (!kelas) throw new GalatPengguna(404, 'Pilih kelas terlebih dahulu.');
    const periode = ambilPeriode(db, c.req.query('periode') ? Number(c.req.query('periode')) : null);
    const bobot = bobotNilai(ambilPengaturan(db));
    const { peringkat } = peringkatKelas(db, kelas.id, periode.id, bobot);
    const santri = semua<{ id: number; nis: string; nama: string; jk: string }>(
      db,
      // Raport yang sudah terbit mengikuti kelas saat diterbitkan; yang belum terbit mengikuti kelas santri sekarang.
      `SELECT id, nis, nama, jk FROM santri s
        WHERE id IN (SELECT santri_id FROM raport WHERE periode_id = ? AND status = 'terbit' AND json_extract(snapshot, '$.kelas.id') = ?)
           OR (kelas_id = ? AND status = 'aktif'
               AND NOT EXISTS (SELECT 1 FROM raport r WHERE r.santri_id = s.id AND r.periode_id = ? AND r.status = 'terbit'))
        ORDER BY nama`,
      periode.id,
      kelas.id,
      kelas.id,
      periode.id,
    );
    const daftar = santri.map((s) => {
      const d = bacaRaport(db, s.id, periode.id);
      const r = satu<{ dibaca_wali: string | null; akhlak: string | null; kerajinan: string | null; kerapian: string | null; kedisiplinan: string | null; catatan: string | null; keputusan: string | null }>(
        db,
        'SELECT dibaca_wali, akhlak, kerajinan, kerapian, kedisiplinan, catatan, keputusan FROM raport WHERE santri_id = ? AND periode_id = ?',
        s.id,
        periode.id,
      );
      return {
        santriId: s.id,
        nis: s.nis,
        nama: s.nama,
        jk: s.jk,
        rataRata: d.rataRata,
        peringkat: d.status === 'terbit' ? d.peringkat : (peringkat.get(s.id) ?? null),
        status: d.status,
        kode: d.kode,
        kekurangan: d.kekurangan,
        nilaiTerisi: d.mapel.filter((m) => m.akhir !== null).length,
        jumlahMapel: d.mapel.length,
        dibacaWali: r?.dibaca_wali ?? null,
        isian: {
          akhlak: r?.akhlak ?? null,
          kerajinan: r?.kerajinan ?? null,
          kerapian: r?.kerapian ?? null,
          kedisiplinan: r?.kedisiplinan ?? null,
          catatan: r?.catatan ?? null,
          keputusan: r?.keputusan ?? null,
        },
      };
    });
    return c.json({
      kelas: { id: kelas.id, nama: kelas.nama, waliKelas: kelas.wali_kelas },
      periode: { id: periode.id, tahunAjaran: periode.tahun_ajaran, semester: periode.semester },
      daftar,
    });
  });

  r.get('/:santriId/:periodeId', (c) => {
    const santriId = idParam(c, 'santriId');
    const periodeId = idParam(c, 'periodeId');
    return c.json(bacaRaport(db, santriId, periodeId));
  });

  // Isian wali kelas (kepribadian, catatan, keputusan) untuk satu atau banyak santri.
  r.put('/isian', async (c) => {
    const isi = await bacaIsi(
      c,
      z.object({
        periodeId: z.number().int().positive(),
        daftar: z
          .array(
            z.object({
              santriId: z.number().int().positive(),
              akhlak: nilaiKepribadian,
              kerajinan: nilaiKepribadian,
              kerapian: nilaiKepribadian,
              kedisiplinan: nilaiKepribadian,
              catatan: teksOpsional(600).optional(),
              keputusan: teksOpsional(120).optional(),
            }),
          )
          .min(1)
          .max(200),
      }),
    );
    const periode = ambilPeriode(db, isi.periodeId);
    const kolom = ['akhlak', 'kerajinan', 'kerapian', 'kedisiplinan', 'catatan', 'keputusan'] as const;
    let berubah = 0;
    db.transaction(() => {
      for (const d of isi.daftar) {
        const s = satu<{ nama: string }>(db, 'SELECT nama FROM santri WHERE id = ?', d.santriId);
        if (!s) throw new GalatPengguna(404, 'Santri tidak ditemukan.');
        const ubah = kolom.filter((k) => d[k] !== undefined);
        if (!ubah.length) continue;
        const lama = satu<Record<string, string | null>>(db, `SELECT ${kolom.join(',')} FROM raport WHERE santri_id = ? AND periode_id = ?`, d.santriId, periode.id);
        if (lama && ubah.every((k) => (lama[k] ?? null) === (d[k] ?? null))) continue;
        pastikanBelumTerbit(db, d.santriId, periode.id, s.nama);
        db.prepare('INSERT OR IGNORE INTO raport (santri_id, periode_id) VALUES (?, ?)').run(d.santriId, periode.id);
        db.prepare(`UPDATE raport SET ${ubah.map((k) => `${k} = ?`).join(', ')} WHERE santri_id = ? AND periode_id = ?`).run(
          ...ubah.map((k) => d[k] ?? null),
          d.santriId,
          periode.id,
        );
        berubah++;
      }
    })();
    if (berubah) catatLog(db, pelaku(c), 'Mengisi raport', `${berubah} santri, ${periode.tahun_ajaran} semester ${periode.semester}`);
    return c.json({ ok: true, berubah });
  });

  r.post('/terbitkan', async (c) => {
    hanyaAdmin(c);
    const isi = await bacaIsi(c, z.object({ periodeId: z.number().int().positive(), santriIds: z.array(z.number().int().positive()).min(1, 'Pilih raport yang akan diterbitkan.').max(500) }));
    const periode = ambilPeriode(db, isi.periodeId);
    const terbit: { santriId: number; nama: string; kode: string }[] = [];
    const gagal: { santriId: number; nama: string; alasan: string[] }[] = [];
    db.transaction(() => {
      for (const id of isi.santriIds) {
        const s = satu<{ nama: string }>(db, 'SELECT nama FROM santri WHERE id = ?', id);
        if (!s) continue;
        const h = terbitkan(db, id, periode.id, c.get('pengurus').id);
        if (h.ok) terbit.push({ santriId: id, nama: s.nama, kode: h.kode });
        else gagal.push({ santriId: id, nama: s.nama, alasan: h.alasan });
      }
    })();
    if (terbit.length) catatLog(db, pelaku(c), 'Menerbitkan raport', `${terbit.length} raport, ${periode.tahun_ajaran} semester ${periode.semester}`);
    return c.json({ terbit, gagal });
  });

  r.post('/tarik', async (c) => {
    hanyaAdmin(c);
    const isi = await bacaIsi(c, z.object({ periodeId: z.number().int().positive(), santriId: z.number().int().positive() }));
    const s = satu<{ nama: string }>(db, 'SELECT nama FROM santri WHERE id = ?', isi.santriId);
    if (!s) throw new GalatPengguna(404, 'Santri tidak ditemukan.');
    tarik(db, isi.santriId, isi.periodeId);
    catatLog(db, pelaku(c), 'Menarik raport untuk diperbaiki', s.nama);
    return c.json({ ok: true });
  });

  // Pratinjau susunan terkini meski sudah terbit (untuk membandingkan sebelum menarik).
  r.get('/:santriId/:periodeId/terkini', (c) => c.json(susunRaport(db, idParam(c, 'santriId'), idParam(c, 'periodeId'))));

  return r;
}
