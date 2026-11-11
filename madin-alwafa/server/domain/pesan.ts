// Pesan WhatsApp otomatis: laporan harian untuk guru dan pengingat syahriah (SPP) untuk wali santri.
// Semua pesan dicatat di pesan_keluar. Bila gateway WhatsApp (Fonnte) belum diatur, pesan menunggu di
// "Kotak keluar" dan admin mengirimnya dengan sekali ketuk lewat tautan WhatsApp.
import type { DB } from '../db';
import { config } from '../config';
import { ambilPengaturan, catatLog, lembaga, normalHp, satu, semua, sekarang, simpanPengaturan, type Pengaturan } from '../util';
import { bulanTahunAjaran, hariIni, namaBulan, rupiah, tanggalHari } from '../../shared/format';

export type JenisPesan = 'laporan' | 'tagihan' | 'uji';

interface PesanBaru {
  jenis: JenisPesan;
  tujuan: string;
  hp: string;
  isi: string;
  santriId?: number | null;
  pengurusId?: number | null;
}

export const gatewayAktif = (p: Pengaturan) => p.wa_penyedia === 'fonnte' && !!p.wa_token;

/** Kirim satu pesan lewat Fonnte (https://fonnte.com). Mengembalikan pesan galat bila gagal. */
async function kirimFonnte(token: string, hp: string, isi: string): Promise<string | null> {
  try {
    const res = await fetch(config.waFonnteUrl, {
      method: 'POST',
      headers: { Authorization: token, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ target: normalHp(hp), message: isi, countryCode: '62' }).toString(),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => null)) as { status?: boolean; reason?: string; detail?: string } | null;
    if (!res.ok || !data?.status) return data?.reason ?? data?.detail ?? `Gateway menjawab ${res.status}.`;
    return null;
  } catch (e) {
    return `Gateway WhatsApp tidak dapat dihubungi (${(e as Error).message}).`;
  }
}

/** Kirim pesan yang masih antre bila gateway aktif. Aman dipanggil bersamaan: hanya satu proses berjalan. */
let sedangMengirim = false;
export async function kirimAntrean(db: DB, ids?: number[]): Promise<{ terkirim: number; gagal: number }> {
  const p = ambilPengaturan(db);
  if (!gatewayAktif(p) || sedangMengirim) return { terkirim: 0, gagal: 0 };
  sedangMengirim = true;
  let terkirim = 0;
  let gagal = 0;
  try {
    const daftar = semua<{ id: number; hp: string; isi: string }>(
      db,
      `SELECT id, hp, isi FROM pesan_keluar WHERE status = 'antre' ${ids ? `AND id IN (${ids.map(() => '?').join(',') || 'NULL'})` : ''} ORDER BY id LIMIT 300`,
      ...(ids ?? []),
    );
    for (const [i, m] of daftar.entries()) {
      // Jeda antarpesan agar nomor pengirim tidak dianggap spam.
      if (i > 0 && config.waJedaMs) await new Promise((r) => setTimeout(r, config.waJedaMs));
      const galat = await kirimFonnte(p.wa_token, m.hp, m.isi);
      if (galat) {
        db.prepare("UPDATE pesan_keluar SET status = 'gagal', galat = ? WHERE id = ?").run(galat.slice(0, 300), m.id);
        gagal++;
      } else {
        db.prepare("UPDATE pesan_keluar SET status = 'terkirim', galat = NULL, dikirim = ? WHERE id = ?").run(sekarang(), m.id);
        terkirim++;
      }
    }
  } finally {
    sedangMengirim = false;
  }
  return { terkirim, gagal };
}

export function antrekan(db: DB, p: PesanBaru): number {
  return Number(
    db
      .prepare("INSERT INTO pesan_keluar (jenis, tujuan, hp, isi, santri_id, pengurus_id, status, dibuat) VALUES (?, ?, ?, ?, ?, ?, 'antre', ?)")
      .run(p.jenis, p.tujuan, normalHp(p.hp), p.isi, p.santriId ?? null, p.pengurusId ?? null, sekarang()).lastInsertRowid,
  );
}

const penutup = (db: DB) => `\n\n_Pesan otomatis aplikasi ${lembaga(ambilPengaturan(db)).singkatan}._`;

// Laporan harian untuk guru ---------------------------------------------------------------------

interface KelasLaporan {
  id: number;
  nama: string;
  bagian: string;
}

/** Kelas yang diajar seorang guru (sebagai wali kelas atau pengajar); admin menerima semua kelas. */
function kelasGuru(db: DB, g: { nama: string; peran: string }, semuaKelas: KelasLaporan[]): KelasLaporan[] {
  if (g.peran === 'admin') return semuaKelas;
  const ids = new Set(
    semua<{ id: number }>(
      db,
      `SELECT id FROM kelas WHERE aktif = 1 AND wali_kelas = ? COLLATE NOCASE
       UNION SELECT kelas_id FROM kelas_mapel WHERE pengajar = ? COLLATE NOCASE`,
      g.nama,
      g.nama,
    ).map((k) => k.id),
  );
  const milik = semuaKelas.filter((k) => ids.has(k.id));
  return milik.length ? milik : semuaKelas;
}

function rekapKelas(db: DB, k: KelasLaporan, tanggal: string, hariKe: number) {
  const anggota = satu<{ n: number }>(db, "SELECT COUNT(*) AS n FROM santri WHERE kelas_id = ? AND status = 'aktif'", k.id)!.n;
  const absen = semua<{ nama: string; status: string; keterangan: string | null }>(
    db,
    `SELECT s.nama, a.status, a.keterangan FROM absensi a JOIN santri s ON s.id = a.santri_id
      WHERE a.kelas_id = ? AND a.tanggal = ? ORDER BY s.nama`,
    k.id,
    tanggal,
  );
  const hafalan = semua<{ predikat: string; n: number }>(
    db,
    `SELECT h.predikat, COUNT(*) AS n FROM hafalan h JOIN santri s ON s.id = h.santri_id
      WHERE s.kelas_id = ? AND h.tanggal = ? GROUP BY h.predikat`,
    k.id,
    tanggal,
  );
  const adaJadwal = !!satu(db, 'SELECT 1 FROM jadwal WHERE kelas_id = ? AND hari = ?', k.id, hariKe);
  return { anggota, absen, hafalan, adaJadwal };
}

const NAMA_STATUS: Record<string, string> = { I: 'Izin', S: 'Sakit', A: 'Alpa' };

export function susunLaporan(db: DB, tanggal: string) {
  const lmb = lembaga(ambilPengaturan(db));
  const hariKe = new Date(`${tanggal}T12:00:00Z`).getUTCDay() || 7;
  const semuaKelas = semua<KelasLaporan>(db, 'SELECT id, nama, bagian FROM kelas WHERE aktif = 1 ORDER BY tingkat, nama');
  const guru = semua<{ id: number; nama: string; peran: string; hp: string | null }>(
    db,
    "SELECT id, nama, peran, hp FROM pengurus WHERE aktif = 1 AND hp IS NOT NULL AND TRIM(hp) != '' ORDER BY peran, nama",
  );
  const rekap = new Map(semuaKelas.map((k) => [k.id, rekapKelas(db, k, tanggal, hariKe)]));
  const hasil: { pengurusId: number; nama: string; hp: string; isi: string }[] = [];

  for (const g of guru) {
    const kelas = kelasGuru(db, g, semuaKelas);
    // Tidak ada pelajaran dan tidak ada catatan apa pun hari ini: tidak perlu laporan.
    if (!kelas.some((k) => rekap.get(k.id)!.adaJadwal || rekap.get(k.id)!.absen.length)) continue;
    const baris: string[] = [`*Laporan Harian ${lmb.singkatan}*`, tanggalHari(tanggal), '', `Assalamu'alaikum ${g.nama},`, 'berikut rekap santri dan santriwati hari ini.'];
    let total = 0;
    let hadir = 0;
    for (const k of kelas) {
      const r = rekap.get(k.id)!;
      baris.push('', `*${k.nama}* (${r.anggota} ${k.bagian === 'putri' ? 'santriwati' : 'santri'})`);
      if (!r.absen.length) {
        baris.push(r.adaJadwal ? 'Absensi belum diisi.' : 'Tidak ada jadwal pelajaran.');
      } else {
        const h = (s: string) => r.absen.filter((a) => a.status === s).length;
        total += r.absen.length;
        hadir += h('H');
        baris.push(`Hadir ${h('H')} · Izin ${h('I')} · Sakit ${h('S')} · Alpa ${h('A')}`);
        for (const a of r.absen.filter((x) => x.status !== 'H')) {
          baris.push(`• ${NAMA_STATUS[a.status]}: ${a.nama}${a.keterangan ? ` (${a.keterangan.toLowerCase()})` : ''}`);
        }
      }
      const setor = r.hafalan.reduce((n, x) => n + x.n, 0);
      if (setor) {
        const per = (p: string) => r.hafalan.find((x) => x.predikat === p)?.n ?? 0;
        baris.push(`Setoran hafalan: ${setor} (lancar ${per('lancar')}, cukup ${per('cukup')}, ulang ${per('ulang')})`);
      }
    }
    if (total) baris.push('', `Kehadiran keseluruhan: *${Math.round((hadir / total) * 100)}%* dari ${total} santri yang diabsen.`);
    if (g.peran === 'admin') {
      const bayar = satu<{ n: number; jumlah: number | null }>(db, 'SELECT COUNT(*) AS n, SUM(nominal) AS jumlah FROM syahriah WHERE tanggal_bayar = ?', tanggal)!;
      const daftar = satu<{ n: number }>(db, "SELECT COUNT(*) AS n FROM pendaftaran_wali WHERE status = 'menunggu'")!.n;
      if (bayar.n) baris.push(`Syahriah diterima hari ini: ${bayar.n} santri, ${rupiah(bayar.jumlah ?? 0)}.`);
      if (daftar) baris.push(`Pendaftaran wali menunggu verifikasi: ${daftar}.`);
    }
    hasil.push({ pengurusId: g.id, nama: g.nama, hp: g.hp!, isi: baris.join('\n') + penutup(db) });
  }
  return hasil;
}

export async function jalankanLaporan(db: DB, tanggal = hariIni()) {
  const daftar = susunLaporan(db, tanggal);
  const ids = db.transaction(() =>
    daftar.map((l) => {
      // Satu laporan per guru per tanggal: laporan lama yang belum terkirim diganti yang terbaru.
      db.prepare("DELETE FROM pesan_keluar WHERE jenis = 'laporan' AND pengurus_id = ? AND status = 'antre' AND date(dibuat, '+7 hours') = ?").run(l.pengurusId, tanggal);
      return antrekan(db, { jenis: 'laporan', tujuan: l.nama, hp: l.hp, isi: l.isi, pengurusId: l.pengurusId });
    }),
  )();
  const kirim = await kirimAntrean(db, ids);
  return { dibuat: ids.length, ...kirim };
}

// Pengingat syahriah (SPP) untuk wali santri -------------------------------------------------------

/** Bulan syahriah yang sudah jatuh tempo tetapi belum tercatat, per santri aktif yang punya nomor wali. */
export function tunggakanSyahriah(db: DB, tanggal = hariIni()) {
  const p = ambilPengaturan(db);
  const nominal = Number(p.syahriah_nominal) || 0;
  const periode = satu<{ tahun_ajaran: string }>(db, 'SELECT tahun_ajaran FROM periode WHERE aktif = 1');
  if (!periode || !nominal) return [];
  const awal = satu<{ m: string }>(db, 'SELECT MIN(mulai) AS m FROM periode WHERE tahun_ajaran = ?', periode.tahun_ajaran)!.m.slice(0, 7);
  const bulanKini = tanggal.slice(0, 7);
  const tempo = Math.min(Math.max(Number(p.tagihan_jatuh_tempo) || 10, 1), 28);
  const jatuhTempo = bulanTahunAjaran(periode.tahun_ajaran).filter(
    (b) => b >= awal && (b < bulanKini || (b === bulanKini && Number(tanggal.slice(8, 10)) >= tempo)),
  );
  if (!jatuhTempo.length) return [];
  const santri = semua<{ id: number; nama: string; jk: string; hp_wali: string | null; nama_wali: string | null; tanggal_masuk: string | null; kelas: string | null }>(
    db,
    `SELECT s.id, s.nama, s.jk, s.hp_wali, s.nama_wali, s.tanggal_masuk, k.nama AS kelas FROM santri s LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE s.status = 'aktif' ORDER BY k.tingkat, k.nama, s.nama`,
  );
  const lunas = new Set(
    semua<{ santri_id: number; bulan: string }>(db, `SELECT santri_id, bulan FROM syahriah WHERE bulan IN (${jatuhTempo.map(() => '?').join(',')})`, ...jatuhTempo).map(
      (b) => `${b.santri_id}:${b.bulan}`,
    ),
  );
  return santri
    .map((s) => ({
      ...s,
      bulan: jatuhTempo.filter((b) => (!s.tanggal_masuk || b >= s.tanggal_masuk.slice(0, 7)) && !lunas.has(`${s.id}:${b}`)),
      nominal,
    }))
    .filter((s) => s.bulan.length);
}

function isiTagihan(db: DB, s: ReturnType<typeof tunggakanSyahriah>[number]) {
  const lmb = lembaga(ambilPengaturan(db));
  const baris = [
    "Assalamu'alaikum warahmatullahi wabarakatuh.",
    '',
    `Bapak/Ibu wali dari ananda *${s.nama}*${s.kelas ? ` (${s.kelas})` : ''},`,
    `kami sampaikan bahwa syahriah berikut belum tercatat di ${lmb.singkatan}:`,
    ...s.bulan.map((b) => `• ${namaBulan(b)}: ${rupiah(s.nominal)}`),
    `Jumlah: *${rupiah(s.nominal * s.bulan.length)}*`,
    '',
    'Pembayaran dapat diserahkan kepada bendahara madrasah. Bila sudah membayar, mohon abaikan pesan ini dan kirimkan bukti bayar agar segera kami catat.',
    '',
    'Jazakumullahu khairan.',
    `${lmb.nama}${lmb.kota ? ` · ${lmb.kota}` : ''}`,
  ];
  return baris.join('\n') + penutup(db);
}

/** Pengingat dikirim ulang setiap `tagihan_jeda` hari sampai syahriah tercatat lunas. */
export async function jalankanTagihan(db: DB, tanggal = hariIni()) {
  const p = ambilPengaturan(db);
  const jeda = Math.min(Math.max(Number(p.tagihan_jeda) || 3, 1), 30);
  const batas = new Date(`${tanggal}T00:00:00+07:00`);
  batas.setUTCDate(batas.getUTCDate() - jeda + 1);
  let dilewati = 0;
  const tanpaNomor: string[] = [];
  const ids = db.transaction(() => {
    const hasil: number[] = [];
    for (const s of tunggakanSyahriah(db, tanggal)) {
      if (!s.hp_wali || normalHp(s.hp_wali).length < 10) {
        tanpaNomor.push(s.nama);
        continue;
      }
      const terakhir = satu<{ dibuat: string }>(
        db,
        "SELECT dibuat FROM pesan_keluar WHERE jenis = 'tagihan' AND santri_id = ? AND status != 'gagal' ORDER BY dibuat DESC LIMIT 1",
        s.id,
      );
      if (terakhir && new Date(terakhir.dibuat) >= batas) {
        dilewati++;
        continue;
      }
      hasil.push(antrekan(db, { jenis: 'tagihan', tujuan: s.nama_wali ? `${s.nama_wali} (wali ${s.nama})` : `Wali ${s.nama}`, hp: s.hp_wali, isi: isiTagihan(db, s), santriId: s.id }));
    }
    return hasil;
  })();
  const kirim = await kirimAntrean(db, ids);
  return { dibuat: ids.length, dilewati, tanpaNomor, ...kirim };
}

// Penjadwal ----------------------------------------------------------------------------------

/** Jam:menit WIB saat ini, mis. "18:00". */
export const jamWib = (d = new Date()) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(11, 16);

/**
 * Dipanggil setiap menit oleh server. Laporan harian dikirim sekali sehari setelah jam laporan (bawaan 18:00 WIB);
 * pengingat syahriah diperiksa sekali sehari setelah jam tagihan (bawaan 09:00 WIB).
 */
export async function detakJadwal(db: DB, kini = new Date()) {
  const p = ambilPengaturan(db);
  const tanggal = hariIni(kini);
  const jam = jamWib(kini);
  const hasil: Record<string, unknown> = {};
  if (p.laporan_aktif === '1' && jam >= p.laporan_jam && p.jadwal_laporan_terakhir !== tanggal) {
    simpanPengaturan(db, { jadwal_laporan_terakhir: tanggal });
    const l = await jalankanLaporan(db, tanggal);
    hasil.laporan = l;
    if (l.dibuat) catatLog(db, 'Sistem', 'Membuat laporan harian guru', `${l.dibuat} guru${l.terkirim ? `, ${l.terkirim} terkirim otomatis` : ', menunggu dikirim admin'}`);
  }
  if (p.tagihan_aktif === '1' && jam >= p.tagihan_jam && p.jadwal_tagihan_terakhir !== tanggal) {
    simpanPengaturan(db, { jadwal_tagihan_terakhir: tanggal });
    const t = await jalankanTagihan(db, tanggal);
    hasil.tagihan = t;
    if (t.dibuat) catatLog(db, 'Sistem', 'Membuat pengingat syahriah', `${t.dibuat} wali santri${t.terkirim ? `, ${t.terkirim} terkirim otomatis` : ', menunggu dikirim admin'}`);
  }
  return hasil;
}
