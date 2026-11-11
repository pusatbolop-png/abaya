import { Hono } from 'hono';
import type { DB } from '../db';
import { ambilPengaturan, lembaga, satu } from '../util';
import type { DataRaport } from '../domain/raport';
import { periksaKartu } from '../domain/kartu';

export function rutePublik(db: DB) {
  const r = new Hono();

  r.get('/lembaga', (c) => c.json(lembaga(ambilPengaturan(db))));

  // Verifikasi keaslian raport dari kode/QR. Hanya ringkasan yang ditampilkan, bukan rincian nilai.
  r.get('/verifikasi/:kode', (c) => {
    const kode = c.req.param('kode').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const berformat = kode.length === 12 ? `${kode.slice(0, 4)}-${kode.slice(4, 8)}-${kode.slice(8)}` : '';
    const r = berformat
      ? satu<{ status: string; snapshot: string | null; diterbitkan: string | null }>(db, 'SELECT status, snapshot, diterbitkan FROM raport WHERE kode = ?', berformat)
      : undefined;
    const lmb = lembaga(ambilPengaturan(db));
    if (!r) return c.json({ lembaga: lmb, hasil: 'tidak-ditemukan' as const });
    if (r.status !== 'terbit' || !r.snapshot) return c.json({ lembaga: lmb, hasil: 'ditarik' as const });
    const d = JSON.parse(r.snapshot) as DataRaport;
    // Nama disamarkan sebagian agar kode yang tersebar tidak membuka data santri seutuhnya.
    const samar = d.santri.nama
      .split(/\s+/)
      .map((k, i) => (i === 0 ? k : k[0] + '•'.repeat(Math.max(2, k.length - 1))))
      .join(' ');
    return c.json({
      lembaga: lmb,
      hasil: 'asli' as const,
      raport: {
        kode: berformat,
        nama: samar,
        nis: d.santri.nis.slice(0, -2) + '••',
        kelas: d.kelas?.nama ?? '-',
        tahunAjaran: d.periode.tahunAjaran,
        semester: d.periode.semester,
        rataRata: d.rataRata,
        jumlahMapel: d.mapel.length,
        diterbitkan: d.diterbitkan,
      },
    });
  });

  // Pemeriksaan kartu santri dari QR di kartu.
  r.get('/kartu/:kode', (c) => c.json(periksaKartu(db, c.req.param('kode'))));

  return r;
}
