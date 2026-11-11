// Portal wali santri: semua data hanya untuk santri yang sedang masuk.
import { Hono } from 'hono';
import type { DB } from '../db';
import type { VarWali } from '../auth';
import { z } from 'zod';
import { GalatPengguna, ambilPengaturan, bacaIsi, catatLog, idParam, satu, semua, sekarang, skemaAlamat } from '../util';
import { hapusFoto, simpanFoto } from '../domain/foto';
import { dataKartu } from '../domain/kartu';
import { ambilPeriode, rekapKehadiran, type DataRaport } from '../domain/raport';
import { keSantri, type SantriBaris } from './santri';
import { bulanIni, bulanTahunAjaran, hariIni } from '../../shared/format';

function pengumumanUntuk(db: DB, jk: string, kelasId: number | null, batas: number) {
  return semua<{ id: number; judul: string; isi: string; penting: number; terbit: string; sasaran: string }>(
    db,
    `SELECT id, judul, isi, penting, terbit, sasaran FROM pengumuman
      WHERE sasaran = 'semua' OR sasaran = ? OR sasaran = ?
      ORDER BY penting DESC, terbit DESC LIMIT ?`,
    jk === 'L' ? 'putra' : 'putri',
    `kelas:${kelasId ?? 0}`,
    batas,
  );
}

export function ruteWali(db: DB) {
  const r = new Hono<{ Variables: VarWali }>();

  const santriSaya = (c: { get: (k: 'wali') => VarWali['wali'] }) => {
    const s = satu<SantriBaris & { kelas_nama: string | null; wali_kelas: string | null; jenjang: string | null }>(
      db,
      'SELECT s.*, k.nama AS kelas_nama, k.wali_kelas, k.jenjang FROM santri s LEFT JOIN kelas k ON k.id = s.kelas_id WHERE s.id = ?',
      c.get('wali').santriId,
    );
    if (!s) throw new GalatPengguna(401, 'Sesi Anda sudah berakhir. Masuk kembali untuk melanjutkan.');
    return s;
  };

  r.get('/beranda', (c) => {
    const s = santriSaya(c);
    const periodeAda = satu<{ id: number }>(db, 'SELECT id FROM periode WHERE aktif = 1');
    const periode = periodeAda ? ambilPeriode(db, periodeAda.id) : null;
    const kehadiran = periode ? rekapKehadiran(db, s.id, periode.mulai, periode.selesai) : null;
    const raportTerbaru = satu<{ periode_id: number; snapshot: string; dibaca_wali: string | null }>(
      db,
      `SELECT r.periode_id, r.snapshot, r.dibaca_wali FROM raport r JOIN periode p ON p.id = r.periode_id
        WHERE r.santri_id = ? AND r.status = 'terbit' ORDER BY p.mulai DESC LIMIT 1`,
      s.id,
    );
    let raport = null;
    if (raportTerbaru) {
      const d = JSON.parse(raportTerbaru.snapshot) as DataRaport;
      raport = {
        periodeId: raportTerbaru.periode_id,
        tahunAjaran: d.periode.tahunAjaran,
        semester: d.periode.semester,
        rataRata: d.rataRata,
        peringkat: d.tampilPeringkat ? d.peringkat : null,
        jumlahSantri: d.jumlahSantri,
        baru: !raportTerbaru.dibaca_wali,
      };
    }
    const hafalan = semua(db, 'SELECT id, tanggal, jenis, materi, predikat FROM hafalan WHERE santri_id = ? ORDER BY tanggal DESC, id DESC LIMIT 3', s.id);
    const jumlahHafalan = satu<{ n: number }>(db, "SELECT COUNT(*) AS n FROM hafalan WHERE santri_id = ? AND predikat != 'ulang'", s.id)!.n;
    const bulan = bulanIni();
    const syahriahBulanIni = satu(db, 'SELECT nominal, tanggal_bayar AS tanggal FROM syahriah WHERE santri_id = ? AND bulan = ?', s.id, bulan) ?? null;
    let tunggakan = 0;
    if (periode) {
      const lewat = bulanTahunAjaran(periode.tahun_ajaran).filter((b) => b <= bulan && b >= periode.mulai.slice(0, 7));
      const lunas = semua<{ bulan: string }>(db, `SELECT bulan FROM syahriah WHERE santri_id = ? AND bulan IN (${lewat.map(() => '?').join(',') || "''"})`, s.id, ...lewat);
      tunggakan = lewat.length - lunas.length;
    }
    const hari = new Date(`${hariIni()}T12:00:00Z`).getUTCDay() || 7;
    const jadwalHariIni = s.kelas_id
      ? semua(
          db,
          `SELECT j.jam_mulai AS jamMulai, j.jam_selesai AS jamSelesai, m.nama AS mapel, m.nama_arab AS mapelArab, km.pengajar
             FROM jadwal j JOIN mapel m ON m.id = j.mapel_id LEFT JOIN kelas_mapel km ON km.kelas_id = j.kelas_id AND km.mapel_id = j.mapel_id
            WHERE j.kelas_id = ? AND j.hari = ? ORDER BY j.jam_mulai`,
          s.kelas_id,
          hari,
        )
      : [];
    const absenHariIni = satu<{ status: string; keterangan: string | null }>(db, 'SELECT status, keterangan FROM absensi WHERE santri_id = ? AND tanggal = ?', s.id, hariIni()) ?? null;
    return c.json({
      santri: { ...keSantri(s), waliKelas: s.wali_kelas, jenjang: s.jenjang },
      periode: periode && { id: periode.id, tahunAjaran: periode.tahun_ajaran, semester: periode.semester },
      kehadiran,
      absenHariIni,
      raport,
      hafalan,
      jumlahHafalan,
      syahriah: { bulan, bulanIni: syahriahBulanIni, tunggakan, nominal: Number(ambilPengaturan(db).syahriah_nominal) || 0 },
      jadwalHariIni,
      pengumuman: pengumumanUntuk(db, s.jk, s.kelas_id, 3),
    });
  });

  // Wali bisa memotret ananda langsung dari ponsel (kamera depan/belakang) untuk kartu santri.
  r.put('/foto', async (c) => {
    const s = santriSaya(c);
    const { data } = await bacaIsi(c, z.object({ data: z.string().max(900_000, 'Ukuran foto terlalu besar.') }));
    const fotoVersi = simpanFoto(db, s.id, data, `Wali ${s.nama}`);
    catatLog(db, `Wali ${s.nama}`, 'Memperbarui foto santri', `${s.nama} (${s.nis})`);
    return c.json({ fotoVersi });
  });

  r.delete('/foto', (c) => {
    const s = santriSaya(c);
    hapusFoto(db, s.id);
    catatLog(db, `Wali ${s.nama}`, 'Menghapus foto santri', `${s.nama} (${s.nis})`);
    return c.json({ ok: true });
  });

  r.get('/kartu', (c) => {
    const s = santriSaya(c);
    return c.json({ ...dataKartu(db, s.id), alamatAplikasi: c.req.header('origin') ?? new URL(c.req.url).origin });
  });

  // Wali memperbarui alamat dan nomor WhatsApp sendiri.
  r.put('/kontak', async (c) => {
    const s = santriSaya(c);
    const isi = await bacaIsi(c, z.object({ ...skemaAlamat }));
    db.prepare('UPDATE santri SET alamat = ?, desa = ?, kecamatan = ?, kabupaten = ?, provinsi = ?, kode_wilayah = ? WHERE id = ?').run(
      isi.alamat,
      isi.desa,
      isi.kecamatan,
      isi.kabupaten,
      isi.provinsi,
      isi.kodeWilayah,
      s.id,
    );
    catatLog(db, `Wali ${s.nama}`, 'Memperbarui alamat', `${s.nama} (${s.nis})`);
    return c.json({ ok: true });
  });

  r.get('/profil', (c) => {
    const s = santriSaya(c);
    return c.json({ santri: { ...keSantri(s), waliKelas: s.wali_kelas } });
  });

  r.get('/raport', (c) => {
    const s = santriSaya(c);
    const daftar = semua<{ periode_id: number; tahun_ajaran: string; semester: number; diterbitkan: string; dibaca_wali: string | null; snapshot: string }>(
      db,
      `SELECT r.periode_id, p.tahun_ajaran, p.semester, r.diterbitkan, r.dibaca_wali, r.snapshot
         FROM raport r JOIN periode p ON p.id = r.periode_id WHERE r.santri_id = ? AND r.status = 'terbit' ORDER BY p.mulai DESC`,
      s.id,
    ).map((r) => {
      const d = JSON.parse(r.snapshot) as DataRaport;
      return {
        periodeId: r.periode_id,
        tahunAjaran: r.tahun_ajaran,
        semester: r.semester,
        kelas: d.kelas?.nama ?? null,
        rataRata: d.rataRata,
        peringkat: d.tampilPeringkat ? d.peringkat : null,
        jumlahSantri: d.jumlahSantri,
        diterbitkan: r.diterbitkan,
        baru: !r.dibaca_wali,
      };
    });
    const menunggu = satu(db, 'SELECT 1 FROM periode WHERE aktif = 1 AND id NOT IN (SELECT periode_id FROM raport WHERE santri_id = ? AND status = ?)', s.id, 'terbit');
    return c.json({ daftar, menunggu: !!menunggu });
  });

  r.get('/raport/:periodeId', (c) => {
    const s = santriSaya(c);
    const periodeId = idParam(c, 'periodeId');
    const r = satu<{ snapshot: string; dibaca_wali: string | null }>(
      db,
      "SELECT snapshot, dibaca_wali FROM raport WHERE santri_id = ? AND periode_id = ? AND status = 'terbit'",
      s.id,
      periodeId,
    );
    if (!r) throw new GalatPengguna(404, 'Raport semester ini belum diterbitkan.');
    if (!r.dibaca_wali) db.prepare('UPDATE raport SET dibaca_wali = ? WHERE santri_id = ? AND periode_id = ?').run(sekarang(), s.id, periodeId);
    const d = JSON.parse(r.snapshot) as DataRaport;
    if (!d.tampilPeringkat) d.peringkat = null;
    return c.json(d);
  });

  r.get('/absensi', (c) => {
    const s = santriSaya(c);
    const bulan = c.req.query('bulan') ?? bulanIni();
    if (!/^\d{4}-\d{2}$/.test(bulan)) throw new GalatPengguna(400, 'Bulan tidak valid.');
    const daftar = semua<{ tanggal: string; status: string; keterangan: string | null }>(
      db,
      'SELECT tanggal, status, keterangan FROM absensi WHERE santri_id = ? AND tanggal LIKE ? ORDER BY tanggal',
      s.id,
      `${bulan}-%`,
    );
    const periodeAda = satu<{ id: number }>(db, 'SELECT id FROM periode WHERE aktif = 1');
    const periode = periodeAda ? ambilPeriode(db, periodeAda.id) : null;
    return c.json({
      bulan,
      daftar,
      semester: periode ? { tahunAjaran: periode.tahun_ajaran, semester: periode.semester, ...rekapKehadiran(db, s.id, periode.mulai, periode.selesai) } : null,
    });
  });

  r.get('/hafalan', (c) => {
    const s = santriSaya(c);
    const daftar = semua(db, 'SELECT id, tanggal, jenis, materi, predikat, catatan, penyimak FROM hafalan WHERE santri_id = ? ORDER BY tanggal DESC, id DESC LIMIT 300', s.id);
    const perJenis = semua(db, "SELECT jenis, COUNT(*) AS jumlah, SUM(predikat = 'lancar') AS lancar FROM hafalan WHERE santri_id = ? GROUP BY jenis", s.id);
    return c.json({ daftar, perJenis });
  });

  r.get('/syahriah', (c) => {
    const s = santriSaya(c);
    const periodeAda = satu<{ tahun_ajaran: string }>(db, 'SELECT tahun_ajaran FROM periode WHERE aktif = 1');
    const tahunAjaran = c.req.query('tahunAjaran') ?? periodeAda?.tahun_ajaran;
    const pilihan = semua<{ tahun_ajaran: string }>(db, 'SELECT DISTINCT tahun_ajaran FROM periode ORDER BY tahun_ajaran DESC').map((p) => p.tahun_ajaran);
    if (!tahunAjaran) return c.json({ tahunAjaran: null, pilihan, bulan: [], nominal: 0, bulanIni: bulanIni() });
    if (!/^\d{4}\/\d{4}$/.test(tahunAjaran)) throw new GalatPengguna(400, 'Tahun ajaran tidak valid.');
    const bulan = bulanTahunAjaran(tahunAjaran);
    const bayar = semua<{ bulan: string; nominal: number; tanggal_bayar: string; metode: string }>(
      db,
      `SELECT bulan, nominal, tanggal_bayar, metode FROM syahriah WHERE santri_id = ? AND bulan IN (${bulan.map(() => '?').join(',')})`,
      s.id,
      ...bulan,
    );
    return c.json({
      tahunAjaran,
      pilihan,
      nominal: Number(ambilPengaturan(db).syahriah_nominal) || 0,
      bulanIni: bulanIni(),
      bulan: bulan.map((b) => {
        const x = bayar.find((y) => y.bulan === b);
        return { bulan: b, bayar: x ? { nominal: x.nominal, tanggal: x.tanggal_bayar, metode: x.metode } : null };
      }),
    });
  });

  r.get('/jadwal', (c) => {
    const s = santriSaya(c);
    const jadwal = s.kelas_id
      ? semua(
          db,
          `SELECT j.hari, j.jam_mulai AS jamMulai, j.jam_selesai AS jamSelesai, m.nama AS mapel, m.nama_arab AS mapelArab, m.kitab, km.pengajar
             FROM jadwal j JOIN mapel m ON m.id = j.mapel_id LEFT JOIN kelas_mapel km ON km.kelas_id = j.kelas_id AND km.mapel_id = j.mapel_id
            WHERE j.kelas_id = ? ORDER BY j.hari, j.jam_mulai`,
          s.kelas_id,
        )
      : [];
    const mapel = s.kelas_id
      ? semua(
          db,
          'SELECT m.nama, m.nama_arab AS namaArab, m.kitab, km.pengajar FROM kelas_mapel km JOIN mapel m ON m.id = km.mapel_id WHERE km.kelas_id = ? ORDER BY m.urutan, m.nama',
          s.kelas_id,
        )
      : [];
    return c.json({ kelas: s.kelas_nama, waliKelas: s.wali_kelas, jadwal, mapel });
  });

  r.get('/pengumuman', (c) => {
    const s = santriSaya(c);
    return c.json({ daftar: pengumumanUntuk(db, s.jk, s.kelas_id, 50) });
  });

  return r;
}
