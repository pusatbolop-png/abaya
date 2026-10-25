// Kinerja program PCC terhadap Blueprint: enam target tahun pertama, alur kerja dari riset sampai
// evaluasi, roadmap 100 hari, serta rincian per pilar. Semua angka dihitung dari data operasional.
import type { DB } from '../db';
import { ambilPengaturan } from '../util';
import { awalHariWib, tanggalWib } from '../../shared/format';
import { KANAL_LURING, LANGKAH_INKUBASI, ROADMAP_100, RUANG_SIARAN } from '../../shared/konstanta';

const HARI = 86_400_000;

/** Selisih hari kalender WIB antara dua tanggal YYYY-MM-DD. */
function selisihHari(dari: string, sampai: string) {
  return Math.round((Date.parse(sampai + 'T00:00:00Z') - Date.parse(dari + 'T00:00:00Z')) / HARI);
}

function tambahHari(ymd: string, n: number) {
  return new Date(Date.parse(ymd + 'T00:00:00Z') + n * HARI).toISOString().slice(0, 10);
}

function median(nilai: number[]) {
  if (!nilai.length) return null;
  const urut = [...nilai].sort((a, b) => a - b);
  const t = Math.floor(urut.length / 2);
  return urut.length % 2 ? urut[t] : (urut[t - 1] + urut[t]) / 2;
}

const n = (db: DB, sql: string, ...arg: unknown[]) => (db.prepare(sql).get(...arg) as { n: number | null }).n ?? 0;

export function hitungKinerja(db: DB, kini = new Date()) {
  const { program } = ambilPengaturan(db);
  const target = program.target;
  const hariIni = tanggalWib(kini);
  const sejak = (hari: number) => awalHariWib(tambahHari(hariIni, -(hari - 1)));
  const iso30 = sejak(30);

  // ——— Roadmap dan tahun program ———
  const mulai = program.mulai || null;
  const hariKe = mulai ? selisihHari(mulai, hariIni) + 1 : null;
  const tahap = hariKe === null || hariKe < 1 ? null : ROADMAP_100.findIndex((t) => hariKe >= t.dari && hariKe <= t.sampai);
  // Konten dihitung per tahun program; tanpa tanggal mulai, 365 hari terakhir.
  const awalTahun = mulai && hariKe !== null && hariKe >= 1 ? mulai : tambahHari(hariIni, -364);
  const hariBerjalanTahun = Math.min(365, Math.max(1, selisihHari(awalTahun, hariIni) + 1));

  // ——— UMKM: seleksi, inkubasi, alur ———
  const pendaftar = n(db, 'SELECT COUNT(*) AS n FROM umkm');
  const binaan = n(db, "SELECT COUNT(*) AS n FROM umkm WHERE status = 'diterima'");
  const kunciInkubasi = LANGKAH_INKUBASI.map((l) => `'${l.kunci}'`).join(',');
  const terinkubasi = n(
    db,
    `SELECT COUNT(*) AS n FROM umkm u WHERE u.status = 'diterima' AND
       (SELECT COUNT(*) FROM inkubasi i WHERE i.umkm_id = u.id AND i.kunci IN (${kunciInkubasi}) AND i.status IN ('selesai','tidak_berlaku')) = ${LANGKAH_INKUBASI.length}`,
  );
  const dalamInkubasi = n(
    db,
    `SELECT COUNT(*) AS n FROM umkm u WHERE u.status = 'diterima' AND EXISTS (SELECT 1 FROM inkubasi i WHERE i.umkm_id = u.id AND i.status != 'belum')`,
  );
  const diMarketplace = n(
    db,
    `SELECT COUNT(DISTINCT p.umkm_id) AS n FROM produk p JOIN umkm u ON u.id = p.umkm_id WHERE u.status = 'diterima' AND p.aktif = 1 AND p.tautan_toko IS NOT NULL`,
  );
  const punyaKonten = n(db, 'SELECT COUNT(DISTINCT umkm_id) AS n FROM konten WHERE umkm_id IS NOT NULL');
  const tampilLive = n(
    db,
    `SELECT COUNT(DISTINCT p.umkm_id) AS n FROM sesi_produk sp JOIN sesi_live s ON s.id = sp.sesi_id JOIN produk p ON p.id = sp.produk_id
     WHERE s.status IN ('selesai','berlangsung')`,
  );
  const terjual = n(
    db,
    `SELECT COUNT(DISTINCT i.umkm_id) AS n FROM item_penjualan i JOIN penjualan j ON j.id = i.penjualan_id WHERE j.status = 'selesai'`,
  );
  const dievaluasi = n(db, 'SELECT COUNT(DISTINCT umkm_id) AS n FROM laporan_omzet');

  // ——— Produk prioritas (Product Intelligence) ———
  const produkPrioritas = n(db, 'SELECT COUNT(*) AS n FROM produk WHERE prioritas = 1 AND aktif = 1');
  const produkNasional = n(
    db,
    `SELECT COUNT(*) AS n FROM produk p WHERE p.prioritas = 1 AND p.aktif = 1 AND EXISTS (
       SELECT 1 FROM item_penjualan i JOIN penjualan j ON j.id = i.penjualan_id
       WHERE i.produk_id = p.id AND j.status = 'selesai' AND j.kanal != ?)`,
    KANAL_LURING,
  );

  // ——— Live Commerce ———
  const studio = db
    .prepare(
      `SELECT r.id, r.kode, r.nama,
         (SELECT COUNT(*) FROM sesi_live s WHERE s.ruangan_id = r.id AND s.status IN ('selesai','berlangsung') AND COALESCE(s.selesai, s.mulai) >= ?) AS sesi,
         (SELECT COALESCE(SUM((julianday(COALESCE(s.selesai, ?)) - julianday(s.mulai)) * 24), 0) FROM sesi_live s
            WHERE s.ruangan_id = r.id AND s.status IN ('selesai','berlangsung') AND COALESCE(s.selesai, s.mulai) >= ? AND s.mulai IS NOT NULL) AS jam,
         (SELECT COALESCE(SUM(j.total), 0) FROM penjualan j JOIN sesi_live s ON s.id = j.sesi_id
            WHERE s.ruangan_id = r.id AND j.status = 'selesai' AND j.tanggal >= ?) AS nilai,
         EXISTS (SELECT 1 FROM sesi_live s WHERE s.ruangan_id = r.id AND s.status = 'berlangsung') AS siaran
       FROM ruangan r WHERE r.jenis IN (${RUANG_SIARAN.map((j) => `'${j}'`).join(',')}) ORDER BY r.lantai, r.urutan`,
    )
    .all(iso30, kini.toISOString(), iso30, iso30) as { id: number; kode: string; nama: string; sesi: number; jam: number; nilai: number; siaran: number }[];
  const studioAktif = studio.filter((s) => s.sesi > 0).length;

  // ——— Content Factory ———
  const kontenTahun = n(db, 'SELECT COUNT(*) AS n FROM konten WHERE tanggal >= ? AND tanggal <= ?', awalTahun, hariIni);
  const konten30 = n(db, 'SELECT COUNT(*) AS n FROM konten WHERE tanggal >= ?', tambahHari(hariIni, -29));
  const kontenJenis = db
    .prepare('SELECT jenis, COUNT(*) AS n FROM konten WHERE tanggal >= ? AND tanggal <= ? GROUP BY jenis ORDER BY n DESC')
    .all(awalTahun, hariIni) as { jenis: string; n: number }[];
  const bulanIni = hariIni.slice(0, 7);
  const kontenBulanan: { bulan: string; n: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const [y, m] = bulanIni.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const bulan = d.toISOString().slice(0, 7);
    kontenBulanan.push({ bulan, n: n(db, 'SELECT COUNT(*) AS n FROM konten WHERE substr(tanggal, 1, 7) = ?', bulan) });
  }

  // ——— Affiliate Community ———
  const affiliateAktif = n(db, "SELECT COUNT(*) AS n FROM affiliate WHERE status = 'aktif'");
  const affiliateBaru = n(db, "SELECT COUNT(*) AS n FROM affiliate WHERE status = 'aktif' AND bergabung >= ?", tambahHari(hariIni, -29));
  const affiliatePlatform = db
    .prepare("SELECT platform, COUNT(*) AS n FROM affiliate WHERE status = 'aktif' GROUP BY platform ORDER BY n DESC")
    .all() as { platform: string; n: number }[];

  // ——— Evaluasi omzet UMKM binaan ———
  const evaluasi = db
    .prepare(
      `SELECT u.id, u.nama_usaha AS namaUsaha, u.omzet_awal AS awal,
         (SELECT l.omzet FROM laporan_omzet l WHERE l.umkm_id = u.id ORDER BY l.bulan DESC LIMIT 1) AS terakhir,
         (SELECT l.bulan FROM laporan_omzet l WHERE l.umkm_id = u.id ORDER BY l.bulan DESC LIMIT 1) AS bulan
       FROM umkm u WHERE u.status = 'diterima'`,
    )
    .all() as { id: number; namaUsaha: string; awal: number | null; terakhir: number | null; bulan: string | null }[];
  const terukur = evaluasi
    .filter((e) => e.awal && e.awal > 0 && e.terakhir !== null)
    .map((e) => ({ ...e, kenaikan: ((e.terakhir! - e.awal!) / e.awal!) * 100 }))
    .sort((a, b) => b.kenaikan - a.kenaikan);
  const medianKenaikan = median(terukur.map((e) => e.kenaikan));
  const mencapai = terukur.filter((e) => e.kenaikan >= target.kenaikanOmzet).length;

  // ——— Penjualan: 12 minggu, kanal, dan peran live ———
  const awal84 = tambahHari(hariIni, -83);
  const harian = db
    .prepare(
      `SELECT tanggal, total, sesi_id AS sesiId, kanal FROM penjualan WHERE status = 'selesai' AND tanggal >= ?`,
    )
    .all(awalHariWib(awal84)) as { tanggal: string; total: number; sesiId: number | null; kanal: string }[];
  const mingguan = Array.from({ length: 12 }, (_, i) => ({ mulai: tambahHari(awal84, i * 7), nilai: 0 }));
  const kanal = new Map<string, number>();
  let nilai30 = 0;
  let nilaiLive30 = 0;
  for (const p of harian) {
    const tgl = tanggalWib(p.tanggal);
    const i = Math.floor(selisihHari(awal84, tgl) / 7);
    if (mingguan[i]) mingguan[i].nilai += p.total;
    if (p.tanggal >= iso30) {
      nilai30 += p.total;
      if (p.sesiId) nilaiLive30 += p.total;
      kanal.set(p.kanal, (kanal.get(p.kanal) ?? 0) + p.total);
    }
  }
  const retur30 = n(db, 'SELECT COALESCE(SUM(total), 0) AS n FROM retur WHERE tanggal >= ?', iso30);

  // ——— Product Intelligence: produk terlaris 7 dan 30 hari dibanding periode sebelumnya ———
  const terlaris = (hari: number) => {
    const awal = sejak(hari);
    const awalSebelum = sejak(hari * 2);
    return (
      db
        .prepare(
          `SELECT p.id, p.nama, p.prioritas, u.nama_usaha AS namaUsaha,
             SUM(CASE WHEN j.tanggal >= @awal THEN i.jumlah ELSE 0 END) AS jumlah,
             SUM(CASE WHEN j.tanggal >= @awal THEN i.subtotal ELSE 0 END) AS nilai,
             SUM(CASE WHEN j.tanggal < @awal THEN i.jumlah ELSE 0 END) AS sebelumnya
           FROM item_penjualan i JOIN penjualan j ON j.id = i.penjualan_id JOIN produk p ON p.id = i.produk_id JOIN umkm u ON u.id = p.umkm_id
           WHERE j.status = 'selesai' AND j.tanggal >= @awalSebelum
           GROUP BY p.id HAVING jumlah > 0 ORDER BY jumlah DESC, nilai DESC LIMIT 5`,
        )
        .all({ awal, awalSebelum }) as { id: number; nama: string; prioritas: number; namaUsaha: string; jumlah: number; nilai: number; sebelumnya: number }[]
    ).map((p) => ({ ...p, prioritas: !!p.prioritas }));
  };

  return {
    program: { mulai, hariKe, tahap, target, awalTahun, hariBerjalanTahun },
    target: [
      { kunci: 'terinkubasi', label: 'UMKM binaan terinkubasi', nilai: terinkubasi, target: target.terinkubasi, satuan: 'UMKM', tautan: '/kelola/umkm?status=diterima' },
      { kunci: 'produkNasional', label: 'Produk prioritas tembus pasar nasional', nilai: produkNasional, target: target.produkNasional, satuan: 'produk', tautan: '/kelola/stok' },
      { kunci: 'studioAktif', label: 'Studio live commerce aktif', nilai: studioAktif, target: target.studioAktif, satuan: 'studio', tautan: '/kelola/live' },
      { kunci: 'affiliate', label: 'Pasukan affiliate lokal', nilai: affiliateAktif, target: target.affiliate, satuan: 'orang', tautan: '/kelola/affiliate' },
      { kunci: 'konten', label: 'Konten digital tahun ini', nilai: kontenTahun, target: target.kontenPerTahun, satuan: 'konten', tautan: '/kelola/konten' },
      {
        kunci: 'omzet',
        label: 'Kenaikan omzet UMKM binaan (median)',
        nilai: medianKenaikan === null ? null : Math.round(medianKenaikan * 10) / 10,
        target: target.kenaikanOmzet,
        satuan: '%',
        tautan: '/kelola/umkm?status=diterima',
      },
    ],
    alur: [
      { kunci: 'pendaftar', tahap: 'Input', label: 'Mendaftar (PCC Call UMKM)', nilai: pendaftar },
      { kunci: 'kurasi', tahap: 'Input', label: 'Lolos kurasi', nilai: binaan },
      { kunci: 'inkubasi', tahap: 'Proses', label: 'Dalam inkubasi', nilai: dalamInkubasi },
      { kunci: 'marketplace', tahap: 'Proses', label: 'Punya toko marketplace', nilai: diMarketplace },
      { kunci: 'konten', tahap: 'Proses', label: 'Dibuatkan konten', nilai: punyaKonten },
      { kunci: 'live', tahap: 'Amplifikasi', label: 'Tampil di siaran live', nilai: tampilLive },
      { kunci: 'terjual', tahap: 'Output', label: 'Mencatat penjualan', nilai: terjual },
      { kunci: 'evaluasi', tahap: 'Output', label: 'Dievaluasi omzetnya', nilai: dievaluasi },
    ],
    omzet: {
      binaan,
      terukur: terukur.length,
      tanpaAwal: evaluasi.filter((e) => !e.awal).length,
      mencapai,
      median: medianKenaikan,
      teratas: terukur.slice(0, 5).map((e) => ({ id: e.id, namaUsaha: e.namaUsaha, awal: e.awal, terakhir: e.terakhir, bulan: e.bulan, kenaikan: e.kenaikan })),
    },
    penjualan: {
      mingguan,
      nilai30,
      nilaiLive30,
      retur30,
      kanal: [...kanal].map(([nama, nilai]) => ({ kanal: nama, nilai, daring: nama !== KANAL_LURING })).sort((a, b) => b.nilai - a.nilai),
    },
    produk: { prioritas: produkPrioritas, nasional: produkNasional, tujuh: terlaris(7), tigaPuluh: terlaris(30) },
    live: {
      aktif: studioAktif,
      total: studio.length,
      sesi30: studio.reduce((a, s) => a + s.sesi, 0),
      jam30: Math.round(studio.reduce((a, s) => a + s.jam, 0) * 10) / 10,
      studio: studio.map((s) => ({ ...s, jam: Math.round(s.jam * 10) / 10, siaran: !!s.siaran })),
    },
    konten: { tahun: kontenTahun, tigaPuluh: konten30, jenis: kontenJenis, bulanan: kontenBulanan },
    affiliate: { aktif: affiliateAktif, baru30: affiliateBaru, platform: affiliatePlatform },
  };
}
