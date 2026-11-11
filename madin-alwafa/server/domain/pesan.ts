// Pesan WhatsApp otomatis, semuanya dengan bahasa yang santun dan sekali per penerima per hari:
//  • Pengingat input harian untuk guru yang belum melengkapi nilai/absensi (bawaan 20:00, batas 21:00 WIB)
//  • Rekap harian setelah batas input untuk administrator (dan bila diizinkan, semua guru)
//  • Pengingat jam pulang untuk wali santri (bawaan 10 menit sebelum 19:15)
//  • Pengingat syahriah setiap 3 hari (bawaan 17:00) sampai tercatat lunas
// Semua pesan dicatat di pesan_keluar. Bila gateway WhatsApp (Fonnte) belum diatur, pesan menunggu di
// "Kotak keluar" dan admin mengirimnya dengan sekali ketuk lewat tautan WhatsApp.
import type { DB } from '../db';
import { config } from '../config';
import { ambilPengaturan, catatLog, lembaga, normalHp, rapikanHp, satu, semua, sekarang, simpanPengaturan, type Pengaturan } from '../util';
import { bulanTahunAjaran, hariIni, namaBulan, rupiah, tanggalHari } from '../../shared/format';
import { pelajaranHari, type PelajaranHari } from './harian';
import { absenGuruHari } from './absenGuru';

export type JenisPesan = 'laporan' | 'rekap' | 'pengingat' | 'tagihan' | 'pulang' | 'uji';

interface PesanBaru {
  jenis: JenisPesan;
  tujuan: string;
  hp: string;
  isi: string;
  santriId?: number | null;
  pengurusId?: number | null;
  /** Kunci unik: pesan dengan kunci yang sama tidak dibuat dua kali (mis. sekali per hari). */
  kunci?: string | null;
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

/**
 * Kirim pesan yang masih antre bila gateway aktif. Tanpa daftar id, yang dikirim hanya pesan antre dari dua jam
 * terakhir (pesan lama tidak dikirim mendadak). Aman dipanggil bersamaan: hanya satu proses yang berjalan.
 */
let sedangMengirim = false;
export async function kirimAntrean(db: DB, ids?: number[]): Promise<{ terkirim: number; gagal: number }> {
  const p = ambilPengaturan(db);
  if (!gatewayAktif(p) || sedangMengirim || (ids && !ids.length)) return { terkirim: 0, gagal: 0 };
  sedangMengirim = true;
  let terkirim = 0;
  let gagal = 0;
  try {
    const daftar = ids
      ? semua<{ id: number; hp: string; isi: string }>(db, `SELECT id, hp, isi FROM pesan_keluar WHERE status = 'antre' AND id IN (${ids.map(() => '?').join(',')}) ORDER BY id`, ...ids)
      : semua<{ id: number; hp: string; isi: string }>(
          db,
          "SELECT id, hp, isi FROM pesan_keluar WHERE status = 'antre' AND dibuat >= ? ORDER BY id LIMIT 300",
          new Date(Date.now() - 2 * 3600_000).toISOString(),
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

/** Masukkan pesan ke kotak keluar. Mengembalikan 0 bila pesan dengan kunci yang sama sudah ada. */
export function antrekan(db: DB, p: PesanBaru): number {
  const r = db
    .prepare("INSERT OR IGNORE INTO pesan_keluar (jenis, tujuan, hp, isi, santri_id, pengurus_id, status, dibuat, kunci) VALUES (?, ?, ?, ?, ?, ?, 'antre', ?, ?)")
    .run(p.jenis, p.tujuan, normalHp(p.hp), p.isi, p.santriId ?? null, p.pengurusId ?? null, sekarang(), p.kunci ?? null);
  return r.changes ? Number(r.lastInsertRowid) : 0;
}

// Bahasa ---------------------------------------------------------------------------------------

const SALAM = "Assalamu'alaikum warahmatullahi wabarakatuh.";
const SALAM_PENUTUP = "Wassalamu'alaikum warahmatullahi wabarakatuh.";
/** "19:15" → "19.15" (penulisan jam bahasa Indonesia) */
const jamTeks = (j: string) => j.replace(':', '.');

/** Sapaan untuk wali santri: "Bapak Syamsul Arifin", "Ibu Musyarofah", atau "Bapak/Ibu wali ananda …". */
export function sapaanWali(s: { nama_wali: string | null; nama_ayah: string | null; nama_ibu: string | null }, namaSantri: string) {
  const nama = s.nama_wali?.trim();
  if (!nama) return `Bapak/Ibu wali ananda ${namaSantri}`;
  if (s.nama_ibu && nama.toLowerCase() === s.nama_ibu.trim().toLowerCase()) return `Ibu ${nama}`;
  if (s.nama_ayah && nama.toLowerCase() === s.nama_ayah.trim().toLowerCase()) return `Bapak ${nama}`;
  return `Bapak/Ibu ${nama}`;
}

/** Panggilan untuk guru menurut gelarnya: Ustadzah untuk "Ustdz.", Ustadz untuk "Ust.". */
const panggilanGuru = (nama: string) => (/^ustdz\.?|^ustadzah/i.test(nama) ? 'Ustadzah' : /^ust\.?|^ustadz/i.test(nama) ? 'Ustadz' : 'Bapak/Ibu');

const gabungNama = (nama: string[]) => (nama.length <= 1 ? nama.join('') : `${nama.slice(0, -1).join(', ')} dan ${nama[nama.length - 1]}`);

const catatanOtomatis = (db: DB) => `_Pesan ini dikirim otomatis oleh aplikasi ${lembaga(ambilPengaturan(db)).singkatan}._`;

// Pengingat input harian untuk guru ------------------------------------------------------------

interface Guru {
  id: number;
  nama: string;
  peran: string;
  hp: string;
}

function guruBerhp(db: DB): Guru[] {
  return semua<Guru>(db, "SELECT id, nama, peran, hp FROM pengurus WHERE aktif = 1 AND hp IS NOT NULL AND TRIM(hp) != '' ORDER BY nama");
}

const sama = (a: string | null | undefined, b: string) => !!a && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Kekurangan input seorang guru pada satu tanggal: nilai pelajaran yang diajarnya dan absensi kelas walinya. */
export function kekuranganGuru(pelajaran: PelajaranHari[], nama: string, belumAbsenDiri = false) {
  const nilai = pelajaran.filter((p) => sama(p.pengajar, nama) && !p.lengkap && p.wajib > 0);
  const absensi = [...new Map(pelajaran.filter((p) => sama(p.waliKelas, nama) && !p.absensiTerisi).map((p) => [p.kelasId, p.kelas])).values()];
  return { nilai, absensi, absenDiri: belumAbsenDiri };
}

/** Id guru yang wajib absen pada tanggal itu tetapi belum mengisi kehadirannya. */
export function belumAbsenGuru(db: DB, tanggal: string) {
  return new Set(absenGuruHari(db, tanggal).filter((g) => g.wajib && !g.status).map((g) => g.id));
}

export function susunPengingatGuru(db: DB, tanggal: string) {
  const p = ambilPengaturan(db);
  const lmb = lembaga(p);
  const pelajaran = pelajaranHari(db, tanggal);
  const belumAbsen = belumAbsenGuru(db, tanggal);
  const hasil: { pengurusId: number; nama: string; hp: string; isi: string }[] = [];
  for (const g of guruBerhp(db)) {
    const k = kekuranganGuru(pelajaran, g.nama, belumAbsen.has(g.id));
    if (!k.nilai.length && !k.absensi.length && !k.absenDiri) continue;
    const sapa = panggilanGuru(g.nama);
    const baris = [
      SALAM,
      '',
      `${g.nama} yang kami hormati,`,
      `jazakumullahu khairan atas pengabdian ${sapa} hari ini. Dengan hormat kami mengingatkan, input harian berikut belum lengkap:`,
      ...(k.absenDiri ? [`• Kehadiran ${sapa} hari ini (absensi guru)`] : []),
      ...k.absensi.map((kelas) => `• Absensi kelas ${kelas}`),
      ...k.nilai.map((x) => `• Nilai ${x.mapel} · ${x.kelas}: ${x.terisi} dari ${x.wajib} santri`),
      '',
      `Mohon berkenan melengkapinya sebelum pukul ${jamTeks(p.batas_input_jam)} WIB melalui aplikasi ${lmb.singkatan}, menu *Nilai harian*. Bila sudah, mohon abaikan pesan ini.`,
      '',
      'Barakallahu fiikum.',
      catatanOtomatis(db),
    ];
    hasil.push({ pengurusId: g.id, nama: g.nama, hp: g.hp, isi: baris.join('\n') });
  }
  return hasil;
}

export async function jalankanPengingatGuru(db: DB, tanggal = hariIni()) {
  const ids = db
    .transaction(() =>
      susunPengingatGuru(db, tanggal).map((x) =>
        antrekan(db, { jenis: 'pengingat', tujuan: x.nama, hp: x.hp, isi: x.isi, pengurusId: x.pengurusId, kunci: `pengingat:${tanggal}:${x.pengurusId}` }),
      ),
    )()
    .filter(Boolean);
  return { dibuat: ids.length, ...(await kirimAntrean(db, ids)) };
}

// Rekap harian setelah batas input -----------------------------------------------------------------

const NAMA_STATUS: Record<string, string> = { I: 'Izin', S: 'Sakit', A: 'Alpa' };

export function susunRekap(db: DB, tanggal: string) {
  const p = ambilPengaturan(db);
  const lmb = lembaga(p);
  const pelajaran = pelajaranHari(db, tanggal);
  if (!pelajaran.length) return [];
  const kelasIds = [...new Set(pelajaran.map((x) => x.kelasId))];
  const penerima = guruBerhp(db).filter((g) => g.peran === 'admin' || p.rekap_ke_guru === '1');
  const hasil: { pengurusId: number; nama: string; hp: string; isi: string }[] = [];
  for (const g of penerima) {
    // Guru hanya menerima kelas yang diajarnya; administrator menerima semua kelas.
    const milik = g.peran === 'admin' ? kelasIds : kelasIds.filter((id) => pelajaran.some((x) => x.kelasId === id && (sama(x.pengajar, g.nama) || sama(x.waliKelas, g.nama))));
    if (!milik.length) continue;
    const baris = [`*Rekap Harian ${lmb.singkatan}*`, tanggalHari(tanggal), '', `${SALAM}`, `${g.nama} yang kami hormati, berikut rekap santri dan santriwati hari ini.`];
    let total = 0;
    let hadir = 0;
    for (const id of milik) {
      const pk = pelajaran.filter((x) => x.kelasId === id);
      const absen = semua<{ nama: string; status: string; keterangan: string | null }>(
        db,
        'SELECT s.nama, a.status, a.keterangan FROM absensi a JOIN santri s ON s.id = a.santri_id WHERE a.kelas_id = ? AND a.tanggal = ? ORDER BY s.nama',
        id,
        tanggal,
      );
      baris.push('', `*${pk[0].kelas}* (${pk[0].anggota} ${pk[0].bagian === 'putri' ? 'santriwati' : 'santri'})`);
      if (!absen.length) baris.push('Absensi belum diisi.');
      else {
        const h = (s: string) => absen.filter((a) => a.status === s).length;
        total += absen.length;
        hadir += h('H');
        baris.push(`Hadir ${h('H')} · Izin ${h('I')} · Sakit ${h('S')} · Alpa ${h('A')}`);
        for (const a of absen.filter((x) => x.status !== 'H')) baris.push(`• ${NAMA_STATUS[a.status]}: ${a.nama}${a.keterangan ? ` (${a.keterangan.toLowerCase()})` : ''}`);
      }
      for (const x of pk) baris.push(`${x.lengkap ? '✓' : '✗'} Nilai ${x.mapel}: ${x.terisi}/${x.wajib}${x.lengkap ? '' : ` · ${x.pengajar ?? 'pengajar belum diatur'}`}`);
    }
    const lengkap = pelajaran.filter((x) => milik.includes(x.kelasId) && x.lengkap).length;
    const semuaPel = pelajaran.filter((x) => milik.includes(x.kelasId)).length;
    baris.push('', `Input nilai harian: *${lengkap} dari ${semuaPel}* pelajaran lengkap sampai pukul ${jamTeks(p.batas_input_jam)} WIB.`);
    if (total) baris.push(`Kehadiran santri: *${Math.round((hadir / total) * 100)}%* dari ${total} santri yang diabsen.`);
    if (g.peran === 'admin') {
      const guru = absenGuruHari(db, tanggal).filter((x) => x.wajib);
      if (guru.length) {
        const st = (s: string) => guru.filter((x) => x.status === s);
        baris.push(`Kehadiran guru: hadir ${st('H').length}${st('H').filter((x) => x.terlambat).length ? ` (${st('H').filter((x) => x.terlambat).length} terlambat)` : ''}, izin ${st('I').length}, sakit ${st('S').length}, alpa ${st('A').length} dari ${guru.length} guru.`);
        const belum = guru.filter((x) => !x.status);
        if (belum.length) baris.push(`Belum absen: ${belum.map((x) => x.nama).join(', ')}.`);
      }
    }
    if (g.peran === 'admin') {
      const bayar = satu<{ n: number; jumlah: number | null }>(db, 'SELECT COUNT(*) AS n, SUM(nominal) AS jumlah FROM syahriah WHERE tanggal_bayar = ?', tanggal)!;
      const daftar = satu<{ n: number }>(db, "SELECT COUNT(*) AS n FROM pendaftaran_wali WHERE status = 'menunggu'")!.n;
      if (bayar.n) baris.push(`Syahriah diterima hari ini: ${bayar.n} santri, ${rupiah(bayar.jumlah ?? 0)}.`);
      if (daftar) baris.push(`Pendaftaran wali menunggu pemeriksaan: ${daftar}.`);
    }
    baris.push('', catatanOtomatis(db));
    hasil.push({ pengurusId: g.id, nama: g.nama, hp: g.hp, isi: baris.join('\n') });
  }
  return hasil;
}

export async function jalankanRekap(db: DB, tanggal = hariIni()) {
  const ids = db
    .transaction(() =>
      susunRekap(db, tanggal).map((x) => antrekan(db, { jenis: 'rekap', tujuan: x.nama, hp: x.hp, isi: x.isi, pengurusId: x.pengurusId, kunci: `rekap:${tanggal}:${x.pengurusId}` })),
    )()
    .filter(Boolean);
  return { dibuat: ids.length, ...(await kirimAntrean(db, ids)) };
}

// Pengingat jam pulang untuk wali santri ------------------------------------------------------------

/**
 * Satu pesan per nomor wali per hari (kakak-beradik dalam satu pesan), hanya untuk santri yang kelasnya ada pelajaran
 * hari itu dan tidak tercatat izin/sakit/alpa.
 */
export function susunPulang(db: DB, tanggal: string) {
  const p = ambilPengaturan(db);
  const lmb = lembaga(p);
  const kelasBelajar = [...new Set(pelajaranHari(db, tanggal).map((x) => x.kelasId))];
  if (!kelasBelajar.length) return [];
  const santri = semua<{ id: number; nama: string; hp_wali: string | null; nama_wali: string | null; nama_ayah: string | null; nama_ibu: string | null; absen: string | null }>(
    db,
    `SELECT s.id, s.nama, s.hp_wali, s.nama_wali, s.nama_ayah, s.nama_ibu, a.status AS absen
       FROM santri s LEFT JOIN absensi a ON a.santri_id = s.id AND a.tanggal = ?
      WHERE s.status = 'aktif' AND s.kelas_id IN (${kelasBelajar.map(() => '?').join(',')})
      ORDER BY s.nama`,
    tanggal,
    ...kelasBelajar,
  );
  const perNomor = new Map<string, typeof santri>();
  for (const s of santri) {
    if (s.absen && s.absen !== 'H') continue;
    const hp = normalHp(s.hp_wali);
    if (hp.length < 10) continue;
    perNomor.set(hp, [...(perNomor.get(hp) ?? []), s]);
  }
  return [...perNomor.entries()].map(([hp, anak]) => {
    const sapa = sapaanWali(anak[0], anak[0].nama);
    const nama = gabungNama(anak.map((a) => `*${a.nama}*`));
    const isi = [
      SALAM,
      '',
      `${sapa} yang kami hormati,`,
      `kegiatan belajar ananda ${nama} di ${lmb.singkatan} hari ini insyaAllah selesai pukul *${jamTeks(p.jam_pulang)} WIB*.`,
      `Mohon berkenan menjemput ananda tepat waktu, atau memastikan ananda pulang bersama orang yang ${sapa.split(' ')[0]} percayai.`,
      '',
      'Semoga ilmu yang ananda pelajari hari ini menjadi ilmu yang bermanfaat dan membawa keberkahan. Aamiin.',
      '',
      SALAM_PENUTUP,
      `Pengurus ${lmb.nama}`,
      catatanOtomatis(db),
    ].join('\n');
    return { santriId: anak[0].id, tujuan: anak[0].nama_wali ? `${anak[0].nama_wali} (wali ${anak.map((a) => a.nama).join(', ')})` : `Wali ${anak[0].nama}`, hp, isi };
  });
}

export async function jalankanPulang(db: DB, tanggal = hariIni()) {
  const ids = db
    .transaction(() => susunPulang(db, tanggal).map((x) => antrekan(db, { jenis: 'pulang', tujuan: x.tujuan, hp: x.hp, isi: x.isi, santriId: x.santriId, kunci: `pulang:${tanggal}:${x.hp}` })))()
    .filter(Boolean);
  return { dibuat: ids.length, ...(await kirimAntrean(db, ids)) };
}

// Pengingat syahriah (SPP) untuk wali santri -------------------------------------------------------

/** Bulan syahriah yang sudah jatuh tempo tetapi belum tercatat, per santri aktif. */
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
  const santri = semua<{
    id: number;
    nama: string;
    jk: string;
    hp_wali: string | null;
    nama_wali: string | null;
    nama_ayah: string | null;
    nama_ibu: string | null;
    tanggal_masuk: string | null;
    kelas: string | null;
  }>(
    db,
    `SELECT s.id, s.nama, s.jk, s.hp_wali, s.nama_wali, s.nama_ayah, s.nama_ibu, s.tanggal_masuk, k.nama AS kelas FROM santri s LEFT JOIN kelas k ON k.id = s.kelas_id
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
  const p = ambilPengaturan(db);
  const lmb = lembaga(p);
  const sapa = sapaanWali(s, s.nama);
  const kontak = p.wa_nomor || lmb.telepon;
  const baris = [
    SALAM,
    '',
    `Yth. ${sapa}, wali dari ananda *${s.nama}*${s.kelas ? ` (kelas ${s.kelas})` : ''}.`,
    '',
    `Semoga ${sapa.split(' ')[0]} sekeluarga senantiasa dalam lindungan dan rahmat Allah SWT.`,
    '',
    `Dengan segala hormat, kami ingin menyampaikan bahwa syahriah ananda untuk bulan berikut belum tercatat di administrasi ${lmb.singkatan}:`,
    ...s.bulan.map((b) => `• ${namaBulan(b)}: ${rupiah(s.nominal)}`),
    `Jumlah: *${rupiah(s.nominal * s.bulan.length)}*`,
    '',
    `Apabila sudah ditunaikan, kami mohon maaf atas pesan ini dan mohon berkenan mengirimkan bukti pembayaran agar segera kami catat. ` +
      `Apabila sedang ada kendala, ${sapa.split(' ')[0]} dapat menyampaikannya kepada pengurus madrasah${kontak ? ` di ${rapikanHp(kontak)}` : ''}; insyaAllah kita carikan jalan terbaik bersama.`,
    '',
    'Jazakumullahu khairan katsiran atas perhatian dan dukungannya bagi pendidikan ananda.',
    '',
    SALAM_PENUTUP,
    `Pengurus ${lmb.nama}`,
    catatanOtomatis(db),
  ];
  return baris.join('\n');
}

/** Pengingat dikirim ulang setiap `tagihan_jeda` hari sampai syahriah tercatat lunas oleh pengurus. */
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
      const id = antrekan(db, {
        jenis: 'tagihan',
        tujuan: s.nama_wali ? `${s.nama_wali} (wali ${s.nama})` : `Wali ${s.nama}`,
        hp: s.hp_wali,
        isi: isiTagihan(db, s),
        santriId: s.id,
        kunci: `tagihan:${tanggal}:${s.id}`,
      });
      if (id) hasil.push(id);
    }
    return hasil;
  })();
  const kirim = await kirimAntrean(db, ids);
  return { dibuat: ids.length, dilewati, tanpaNomor, ...kirim };
}

// Penjadwal ----------------------------------------------------------------------------------

/** Jam:menit WIB saat ini, mis. "18:00". */
export const jamWib = (d = new Date()) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(11, 16);

const keMenit = (j: string) => Number(j.slice(0, 2)) * 60 + Number(j.slice(3, 5));
const dariMenit = (m: number) => `${String(Math.floor((((m % 1440) + 1440) % 1440) / 60)).padStart(2, '0')}:${String((((m % 60) + 60) % 60)).padStart(2, '0')}`;

/** Jam kirim pengingat pulang: beberapa menit sebelum jam pulang. */
export const jamKirimPulang = (p: Pengaturan) => dariMenit(keMenit(p.jam_pulang) - (Number(p.pulang_menit) || 10));

/** Dalam jendela waktu [mulai, sampai): pesan yang terlewat (mis. server mati) tidak dikirim terlambat. */
const dalamJendela = (jam: string, mulai: string, sampai: string) => jam >= mulai && jam < sampai;
const tambahJam = (j: string, menit: number) => dariMenit(Math.min(keMenit(j) + menit, 23 * 60 + 59));

/**
 * Dipanggil setiap menit oleh server. Setiap jadwal berjalan sekali sehari di dalam jendelanya; bila server mati
 * saat itu, pesan hari itu dilewati agar tidak terkirim di jam yang tidak pantas. Saat libur (jeda), semua berhenti.
 */
export async function detakJadwal(db: DB, kini = new Date()) {
  const p = ambilPengaturan(db);
  const tanggal = hariIni(kini);
  const jam = jamWib(kini);
  const hasil: Record<string, unknown> = {};
  if (p.jeda_sampai && tanggal <= p.jeda_sampai) return hasil;
  const catat = (aksi: string, r: { dibuat: number; terkirim: number }, siapa: string) => {
    if (r.dibuat) catatLog(db, 'Sistem', aksi, `${r.dibuat} ${siapa}${r.terkirim ? `, ${r.terkirim} terkirim otomatis` : gatewayAktif(p) ? '' : ', menunggu dikirim admin'}`);
  };

  if (p.pengingat_guru_aktif === '1' && dalamJendela(jam, p.pengingat_guru_jam, p.batas_input_jam) && p.jadwal_pengingat_terakhir !== tanggal) {
    simpanPengaturan(db, { jadwal_pengingat_terakhir: tanggal });
    const r = await jalankanPengingatGuru(db, tanggal);
    hasil.pengingat = r;
    catat('Mengingatkan guru yang belum input harian', r, 'guru');
  }
  const kirimPulang = jamKirimPulang(p);
  if (p.pulang_aktif === '1' && dalamJendela(jam, kirimPulang, p.jam_pulang) && p.jadwal_pulang_terakhir !== tanggal) {
    simpanPengaturan(db, { jadwal_pulang_terakhir: tanggal });
    const r = await jalankanPulang(db, tanggal);
    hasil.pulang = r;
    catat('Mengirim pengingat jam pulang', r, 'wali santri');
  }
  if (p.laporan_aktif === '1' && dalamJendela(jam, p.laporan_jam, tambahJam(p.laporan_jam, 120)) && p.jadwal_laporan_terakhir !== tanggal) {
    simpanPengaturan(db, { jadwal_laporan_terakhir: tanggal });
    const r = await jalankanRekap(db, tanggal);
    hasil.rekap = r;
    catat('Mengirim rekap harian', r, 'penerima');
  }
  if (p.tagihan_aktif === '1' && dalamJendela(jam, p.tagihan_jam, tambahJam(p.tagihan_jam, 180)) && p.jadwal_tagihan_terakhir !== tanggal) {
    simpanPengaturan(db, { jadwal_tagihan_terakhir: tanggal });
    const r = await jalankanTagihan(db, tanggal);
    hasil.tagihan = r;
    catat('Mengirim pengingat syahriah', r, 'wali santri');
  }
  // Pesan antre yang belum terkirim (mis. gateway sempat gangguan) dicoba lagi selama masih baru.
  if (gatewayAktif(p)) await kirimAntrean(db);
  return hasil;
}
