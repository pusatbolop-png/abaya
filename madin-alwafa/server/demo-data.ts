// Data contoh Madin Al Wafa’. Semua nama, nomor, dan alamat adalah rekaan.
// Tanggal disusun relatif terhadap hari ini, sehingga demo selalu tampak berjalan di semester yang sedang aktif.
import type { DB } from './db';
import { hashSandi } from './auth';
import { simpanPengaturan, sekarang } from './util';
import { terbitkan } from './domain/raport';
import { hariIni } from '../shared/format';

export const SANDI_DEMO = 'demo-wafa-2026';
export const SANDI_WALI_DEMO = 'wafa2026';

function prng(benih: number) {
  let a = benih;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAPEL = [
  { nama: "Al-Qur'an", arab: 'القرآن الكريم', kitab: "Tartil & Juz 'Amma", kkm: 70 },
  { nama: 'Tajwid', arab: 'التجويد', kitab: 'Hidayatus Shibyan', kkm: 65 },
  { nama: 'Tauhid', arab: 'التوحيد', kitab: "'Aqidatul 'Awam", kkm: 65 },
  { nama: 'Fiqih', arab: 'الفقه', kitab: 'Safinatun Najah', kkm: 65 },
  { nama: 'Akhlak', arab: 'الأخلاق', kitab: "Akhlaq lil Banin / lil Banat", kkm: 70 },
  { nama: 'Hadits', arab: 'الحديث', kitab: "Arba'in Nawawi", kkm: 65 },
  { nama: 'Tarikh', arab: 'التاريخ', kitab: 'Khulashoh Nurul Yaqin', kkm: 60 },
  { nama: 'Bahasa Arab', arab: 'اللغة العربية', kitab: 'Durusul Lughah', kkm: 60 },
  { nama: "Imla' & Khot", arab: 'الإملاء والخط', kitab: 'Pegon & Khot Naskhi', kkm: 65 },
  { nama: 'Nahwu', arab: 'النحو', kitab: 'Al-Jurumiyah', kkm: 60 },
  { nama: 'Shorof', arab: 'الصرف', kitab: 'Amtsilah Tashrifiyah', kkm: 60 },
];
const MAPEL_ULA = ["Al-Qur'an", 'Tajwid', 'Tauhid', 'Fiqih', 'Akhlak', 'Hadits', 'Tarikh', 'Bahasa Arab', "Imla' & Khot"];
const MAPEL_WUSTHO = ["Al-Qur'an", 'Tajwid', 'Tauhid', 'Fiqih', 'Akhlak', 'Hadits', 'Tarikh', 'Nahwu', 'Shorof'];

const PENGAJAR_PA: Record<string, string> = {
  "Al-Qur'an": 'Ust. Abdul Karim',
  Tajwid: 'Ust. Abdul Karim',
  Tauhid: 'Ust. M. Ridwan Hakim',
  Fiqih: 'Ust. Ahmad Fauzi',
  Akhlak: 'Ust. M. Ridwan Hakim',
  Hadits: 'Ust. Zainal Abidin',
  Tarikh: 'Ust. Zainal Abidin',
  'Bahasa Arab': 'Ust. Hasan Basri',
  "Imla' & Khot": 'Ust. Hasan Basri',
  Nahwu: 'Ust. Ahmad Fauzi',
  Shorof: 'Ust. Hasan Basri',
};
const PENGAJAR_PI: Record<string, string> = {
  "Al-Qur'an": 'Ustdz. Siti Maryam',
  Tajwid: 'Ustdz. Siti Maryam',
  Tauhid: 'Ustdz. Nur Aini',
  Fiqih: 'Ustdz. Umi Kulsum',
  Akhlak: 'Ustdz. Nur Aini',
  Hadits: 'Ustdz. Lailatul Fitriyah',
  Tarikh: 'Ustdz. Lailatul Fitriyah',
  'Bahasa Arab': 'Ustdz. Rofiqoh',
  "Imla' & Khot": 'Ustdz. Rofiqoh',
  Nahwu: 'Ustdz. Umi Kulsum',
  Shorof: 'Ustdz. Rofiqoh',
};

const KELAS = [
  { nama: 'Sayyidina Husein', jenjang: 'Ula', tingkat: 1, bagian: 'putra', wali: 'Ust. Abdul Karim', ruang: 'Ruang 1' },
  { nama: 'Sayyidah Fatimah', jenjang: 'Ula', tingkat: 1, bagian: 'putri', wali: 'Ustdz. Siti Maryam', ruang: 'Ruang 3' },
  { nama: 'Sayyidina Hasan', jenjang: 'Ula', tingkat: 2, bagian: 'putra', wali: 'Ust. M. Ridwan Hakim', ruang: 'Ruang 2' },
  { nama: 'Sayyidah Khodijah', jenjang: 'Ula', tingkat: 2, bagian: 'putri', wali: 'Ustdz. Nur Aini', ruang: 'Ruang 4' },
] as const;

const PUTRA = [
  'Muhammad Rizky Ramadhan', 'Ahmad Zaki Mubarok', 'Faiz Abdillah', 'Hafidz Nur Hidayat', 'Ilham Maulana Yusuf', 'Rafi Ahmad Fauzan',
  'Naufal Rizqullah', 'Alif Nur Fadillah', 'Dimas Arya Saputra', 'Fikri Haikal', 'Rayhan Al-Ghifari', 'Daffa Maulana',
  'M. Syauqi Alfarizi', 'Azka Fathurrahman', 'Hanif Abdurrahman', 'Bilal Akbar Maulana', 'Yusuf Habibi', 'Zidan Al-Faruq',
  'Abid Muzakki', 'Khoirul Anam', 'M. Ainun Najib', 'Ali Ridho', 'Fahmi Nur Ikhsan', 'Haikal Firdaus',
];
const PUTRI = [
  'Aisyah Nur Azizah', 'Fatimah Az-Zahra', 'Khadijah Salsabila', 'Nabila Putri Rahmawati', 'Zahra Aulia Rahma', 'Syifa Nurul Izzah',
  'Annisa Fitri Ramadhani', 'Hilya Najwa Kamila', 'Naila Shofiyah', 'Alya Husna Fadhilah', 'Rania Zakiyah', 'Safira Azka Nadia',
  'Maryam Qonita', 'Hafshah Nur Laila', 'Najwa Khoirunnisa', 'Laila Mufidah', 'Zulfa Hanum', 'Ummu Kultsum Azzahra',
  'Dewi Masyithoh', 'Lutfiah Azzahra', 'Kayla Mumtaza', 'Salma Hidayati', 'Inayah Rahmah', 'Farah Dzakiyyah',
];
const AYAH = [
  'Abdul Rahman', 'Mukhlis', 'Ahmad Syafi\'i', 'Suyitno', 'Hasyim Asy\'ari', 'Moch. Sholeh', 'Imam Bukhori', 'Nur Kholis', 'Sutrisno',
  'Abdul Ghofur', 'Masrukhin', 'Zainuddin', 'Ali Mas\'ud', 'Syamsul Arifin', 'Fathul Bari', 'Rohmat', 'Ahmad Dahlan', 'Mustofa',
];
const IBU = [
  'Siti Aminah', 'Nur Hayati', 'Khoiriyah', 'Musyarofah', 'Siti Fatimah', 'Lilik Masruroh', 'Zubaidah', 'Umi Salamah', 'Nurul Huda',
  'Rodiyah', 'Mutmainnah', 'Sri Wahyuni', 'Hanifah', 'Juwariyah', 'Istiqomah', 'Maslahah', 'Faridah', 'Robi\'ah',
];
const DESA = ['Ds. Karangrejo', 'Ds. Sukorejo', 'Ds. Wonosari', 'Ds. Kedungrejo', 'Ds. Pandean', 'Ds. Tambakrejo', 'Ds. Ngembe', 'Ds. Bendungan'];
const TEMPAT = ['Pasuruan', 'Pasuruan', 'Pasuruan', 'Probolinggo', 'Malang', 'Sidoarjo'];

const SURAT = [
  'An-Naas', 'Al-Falaq', 'Al-Ikhlash', 'Al-Lahab', 'An-Nashr', 'Al-Kafirun', 'Al-Kautsar', "Al-Ma'un", 'Quraisy', 'Al-Fil', 'Al-Humazah',
  "Al-'Ashr", 'At-Takatsur', "Al-Qari'ah", "Al-'Adiyat", 'Az-Zalzalah', 'Al-Bayyinah', 'Al-Qadr', "Al-'Alaq", 'At-Tin', 'Asy-Syarh',
  'Adh-Dhuha', 'Al-Lail', 'Asy-Syams', 'Al-Balad', 'Al-Fajr', 'Al-Ghasyiyah', "Al-A'la", 'Ath-Thariq', 'Al-Buruj', 'Al-Insyiqaq',
  'Al-Muthaffifin', 'Al-Infithar', 'At-Takwir', "'Abasa", "An-Nazi'at", "An-Naba'",
];
const DOA = [
  "Do'a sebelum belajar", "Do'a untuk kedua orang tua", "Do'a sebelum dan sesudah makan", "Do'a masuk dan keluar masjid",
  "Do'a bangun tidur", "Do'a sesudah wudhu", "Hadits niat (Arba'in 1)", "Hadits Islam, Iman, Ihsan (Arba'in 2)",
];

function tambahHari(tgl: string, n: number) {
  const d = new Date(`${tgl}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Hari belajar Madin: Sabtu–Kamis (Jum'at libur), di luar libur Ramadhan dan Idul Fitri. */
function hariBelajar(mulai: string, selesai: string, libur: [string, string][]) {
  const hasil: string[] = [];
  for (let t = mulai; t <= selesai; t = tambahHari(t, 1)) {
    if (new Date(`${t}T12:00:00Z`).getUTCDay() === 5) continue;
    if (libur.some(([a, b]) => t >= a && t <= b)) continue;
    hasil.push(t);
  }
  return hasil;
}

function periodeDemo(hari: string) {
  const y = Number(hari.slice(0, 4));
  const m = Number(hari.slice(5, 7));
  const ganjil = (ta: number) => ({ tahunAjaran: `${ta}/${ta + 1}`, semester: 1 as const, mulai: `${ta}-07-13`, selesai: `${ta}-12-19`, raport: `${ta}-12-19` });
  const genap = (ta: number) => ({ tahunAjaran: `${ta}/${ta + 1}`, semester: 2 as const, mulai: `${ta + 1}-01-05`, selesai: `${ta + 1}-06-20`, raport: `${ta + 1}-06-20` });
  return m >= 7 ? { kini: ganjil(y), lalu: genap(y - 1) } : { kini: genap(y - 1), lalu: ganjil(y - 1) };
}

export async function isiDemo(db: DB) {
  const acak = prng(20260709);
  const pilih = <T,>(arr: readonly T[]) => arr[Math.floor(acak() * arr.length)];
  const antara = (a: number, b: number) => a + Math.floor(acak() * (b - a + 1));
  const batas = (n: number) => Math.max(40, Math.min(100, Math.round(n)));
  const hari = hariIni();
  const { kini, lalu } = periodeDemo(hari);
  const naikKelas = lalu.tahunAjaran !== kini.tahunAjaran;

  simpanPengaturan(db, {
    mode: 'demo',
    telepon: '0812-0000-1717',
    kepala: 'KH. Muhammad Nur Salim',
    syahriah_nominal: '25000',
  });

  const sandiPengurus = await hashSandi(SANDI_DEMO);
  const sandiWali = await hashSandi(SANDI_WALI_DEMO);
  const pengurusBaru = db.prepare('INSERT INTO pengurus (nama, username, sandi, peran, hp, dibuat, masuk_terakhir) VALUES (?,?,?,?,?,?,?)');
  const idAdmin = Number(pengurusBaru.run('Ust. Ahmad Fauzi', 'admin', sandiPengurus, 'admin', '0812-0000-1001', sekarang(), sekarang()).lastInsertRowid);
  pengurusBaru.run('Ustdz. Siti Maryam', 'ustadzah', sandiPengurus, 'ustadz', '0812-0000-1002', sekarang(), null);
  pengurusBaru.run('Ust. Abdul Karim', 'abdulkarim', sandiPengurus, 'ustadz', '0812-0000-1003', sekarang(), null);

  // Semester.
  const idLalu = Number(
    db
      .prepare('INSERT INTO periode (tahun_ajaran, semester, mulai, selesai, tanggal_raport, aktif) VALUES (?,?,?,?,?,0)')
      .run(lalu.tahunAjaran, lalu.semester, lalu.mulai, lalu.selesai, lalu.raport).lastInsertRowid,
  );
  const idKini = Number(
    db
      .prepare('INSERT INTO periode (tahun_ajaran, semester, mulai, selesai, tanggal_raport, aktif) VALUES (?,?,?,?,?,1)')
      .run(kini.tahunAjaran, kini.semester, kini.mulai, kini.selesai, kini.raport).lastInsertRowid,
  );

  // Mata pelajaran.
  const idMapel: Record<string, number> = {};
  MAPEL.forEach((m, i) => {
    idMapel[m.nama] = Number(
      db.prepare('INSERT INTO mapel (nama, nama_arab, kitab, urutan, kkm) VALUES (?,?,?,?,?)').run(m.nama, m.arab, m.kitab, (i + 1) * 10, m.kkm).lastInsertRowid,
    );
  });

  // Kelas, mapel kelas, dan jadwal (Sabtu–Kamis, dua jam pelajaran 14.00–16.30).
  const idKelas: number[] = [];
  for (const k of KELAS) {
    const id = Number(
      db.prepare('INSERT INTO kelas (nama, jenjang, tingkat, bagian, wali_kelas, ruang) VALUES (?,?,?,?,?,?)').run(k.nama, k.jenjang, k.tingkat, k.bagian, k.wali, k.ruang)
        .lastInsertRowid,
    );
    idKelas.push(id);
    const daftar = k.jenjang === 'Ula' ? MAPEL_ULA : MAPEL_WUSTHO;
    const pengajar = k.bagian === 'putra' ? PENGAJAR_PA : PENGAJAR_PI;
    for (const m of daftar) db.prepare('INSERT INTO kelas_mapel (kelas_id, mapel_id, pengajar) VALUES (?,?,?)').run(id, idMapel[m], pengajar[m]);
    const urutan = [daftar[0], daftar[3], daftar[1], daftar[2], daftar[0], daftar[4], daftar[5], daftar[7], daftar[0], daftar[6], daftar[3], daftar[8]];
    const hariMadin = [6, 7, 1, 2, 3, 4]; // Sabtu, Ahad, Senin, Selasa, Rabu, Kamis
    urutan.forEach((m, i) => {
      const h = hariMadin[Math.floor(i / 2)];
      const [a, b] = i % 2 === 0 ? ['14:00', '15:10'] : ['15:20', '16:30'];
      db.prepare('INSERT INTO jadwal (kelas_id, hari, jam_mulai, jam_selesai, mapel_id) VALUES (?,?,?,?,?)').run(id, h, a, b, idMapel[m]);
    });
  }

  // Santri: 8 per kelas. Kemampuan dasar menentukan pola nilai, kehadiran, dan hafalan.
  interface S { id: number; jk: 'L' | 'P'; kelasIdx: number; mampu: number; rajin: number; tahunMasuk: number }
  const santri: S[] = [];
  const tahunKini = Number(kini.tahunAjaran.slice(0, 4));
  const urutNis: Record<number, number> = {};
  let iPa = 0;
  let iPi = 0;
  KELAS.forEach((k, kelasIdx) => {
    const jk = k.bagian === 'putra' ? 'L' : 'P';
    for (let n = 0; n < 10; n++) {
      const nama = jk === 'L' ? PUTRA[iPa++] : PUTRI[iPi++];
      const tahunMasuk = tahunKini - (k.tingkat - 1);
      urutNis[tahunMasuk] = (urutNis[tahunMasuk] ?? 0) + 1;
      const nis = `${String(tahunMasuk).slice(2)}${String(urutNis[tahunMasuk]).padStart(4, '0')}`;
      const umur = 7 + k.tingkat + antara(0, 1);
      const lahir = `${tahunKini - umur}-${String(antara(1, 12)).padStart(2, '0')}-${String(antara(1, 28)).padStart(2, '0')}`;
      const ayah = pilih(AYAH);
      const masuk = !!(acak() < 0.7);
      const diganti = masuk && acak() < 0.6;
      const id = Number(
        db
          .prepare(
            `INSERT INTO santri (nis, nama, jk, tempat_lahir, tanggal_lahir, alamat, nama_ayah, nama_ibu, nama_wali, hp_wali, kelas_id, status,
               tanggal_masuk, sandi, sandi_diganti, masuk_terakhir, dibuat) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .run(
            nis,
            nama,
            jk,
            pilih(TEMPAT),
            lahir,
            `${pilih(DESA)} RT 0${antara(1, 6)}/RW 0${antara(1, 4)}, Kab. Pasuruan`,
            ayah,
            pilih(IBU),
            ayah,
            `0812-${String(antara(1000, 9999))}-${String(antara(1000, 9999))}`,
            idKelas[kelasIdx],
            'aktif',
            `${tahunMasuk}-07-13`,
            sandiWali,
            diganti ? 1 : 0,
            masuk ? `${tambahHari(hari, -antara(0, 12))}T0${antara(1, 9)}:15:00.000Z` : null,
            sekarang(),
          ).lastInsertRowid,
      );
      santri.push({ id, jk, kelasIdx, mampu: 64 + acak() * 30, rajin: 0.86 + acak() * 0.13, tahunMasuk });
    }
  });

  // Santri contoh untuk masuk sebagai wali: anggota pertama Sayyidah Khodijah, sudah punya raport semester lalu.
  const contohWali = santri.find((s) => s.kelasIdx === 3)!;

  const libur: [string, string][] = [
    [`${tahunKini + 1}-02-08`, `${tahunKini + 1}-03-28`],
    [`${tahunKini}-02-17`, `${tahunKini}-03-29`],
  ];
  const isiAbsensi = (s: S, kelasId: number, hariHari: string[]) => {
    const st = db.prepare('INSERT OR IGNORE INTO absensi (santri_id, tanggal, kelas_id, status, keterangan) VALUES (?,?,?,?,?)');
    for (const t of hariHari) {
      const x = acak();
      if (x < s.rajin) st.run(s.id, t, kelasId, 'H', null);
      else if (x < s.rajin + (1 - s.rajin) * 0.45) st.run(s.id, t, kelasId, 'S', pilih(['Demam', 'Batuk pilek', 'Sakit perut', null]));
      else if (x < s.rajin + (1 - s.rajin) * 0.85) st.run(s.id, t, kelasId, 'I', pilih(['Acara keluarga', 'Ke luar kota', 'Izin orang tua', null]));
      else st.run(s.id, t, kelasId, 'A', null);
    }
  };
  const isiNilai = (s: S, kelasIdx: number, periodeId: number, komponen: { harian: boolean; uts: boolean; uas: boolean }) => {
    const daftar = KELAS[kelasIdx].jenjang === 'Ula' ? MAPEL_ULA : MAPEL_WUSTHO;
    for (const m of daftar) {
      const dasar = s.mampu + (acak() - 0.5) * 14;
      db.prepare('INSERT INTO nilai (santri_id, periode_id, mapel_id, harian, uts, uas, diubah) VALUES (?,?,?,?,?,?,?)').run(
        s.id,
        periodeId,
        idMapel[m],
        komponen.harian ? batas(dasar + 3 + (acak() - 0.5) * 8) : null,
        komponen.uts ? batas(dasar + (acak() - 0.5) * 10) : null,
        komponen.uas ? batas(dasar - 1 + (acak() - 0.5) * 10) : null,
        sekarang(),
      );
    }
  };
  const nilaiSikap = (s: S) => {
    const v = s.mampu * 0.5 + s.rajin * 50 + (acak() - 0.5) * 12;
    return v > 86 ? 'A' : v > 76 ? 'B' : v > 68 ? 'C' : 'D';
  };

  const hariLalu = hariBelajar(lalu.mulai, lalu.selesai, libur);
  const kemarin = tambahHari(hari, -1);
  const hariKini = hariBelajar(kini.mulai, kemarin < kini.selesai ? kemarin : kini.selesai, libur);
  const durasi = (Date.parse(kini.selesai) - Date.parse(kini.mulai)) / 86400_000;
  const berjalan = Math.max(0, (Date.parse(hari) - Date.parse(kini.mulai)) / 86400_000) / durasi;
  const komponen = { harian: berjalan > 0.15, uts: berjalan > 0.45, uas: berjalan > 0.93 };

  // Hafalan: Juz 'Amma dari An-Naas ke atas, nadzom 'Aqidatul 'Awam, serta do'a dan hadits pilihan.
  db.transaction(() => {
    const st = db.prepare('INSERT INTO hafalan (santri_id, tanggal, jenis, materi, predikat, catatan, penyimak, dibuat) VALUES (?,?,?,?,?,?,?,?)');
    for (const s of santri) {
      const k = KELAS[s.kelasIdx];
      const penyimak = k.bagian === 'putra' ? 'Ust. Abdul Karim' : 'Ustdz. Siti Maryam';
      const sejak = k.tingkat === 1 ? kini.mulai : lalu.mulai;
      const hariSetor = [...hariLalu, ...hariKini].filter((t) => t >= sejak);
      let surat = k.tingkat === 1 ? 0 : k.tingkat === 2 ? 8 : 18;
      let bait = k.tingkat === 1 ? 1 : k.tingkat === 2 ? 20 : 40;
      let doa = 0;
      for (let i = 0; i < hariSetor.length; i += antara(9, 15)) {
        const t = hariSetor[i];
        const x = acak();
        const pred = x < s.mampu / 100 ? 'lancar' : x < s.mampu / 100 + 0.12 ? 'cukup' : 'ulang';
        const jenis = acak();
        if (jenis < 0.55 && surat < SURAT.length) {
          st.run(s.id, t, "Al-Qur'an", `Surat ${SURAT[surat]}`, pred, pred === 'ulang' ? 'Perbaiki makhraj dan panjang pendek' : null, penyimak, sekarang());
          if (pred !== 'ulang') surat++;
        } else if (jenis < 0.85) {
          const akhir = Math.min(57, bait + 4);
          st.run(s.id, t, 'Nadzom', `'Aqidatul 'Awam bait ${bait}–${akhir}`, pred, null, penyimak, sekarang());
          if (pred !== 'ulang') bait = akhir >= 57 ? 1 : akhir + 1;
        } else {
          st.run(s.id, t, "Do'a & hadits", DOA[doa % DOA.length], pred, null, penyimak, sekarang());
          if (pred !== 'ulang') doa++;
        }
      }
    }
  })();

  // Semester lalu: absensi, nilai lengkap, isian wali kelas, lalu diterbitkan dengan kelas saat itu.
  db.transaction(() => {
    for (const s of santri) {
      const tingkatKini = KELAS[s.kelasIdx].tingkat;
      if (naikKelas && tingkatKini === 1) {
        // Santri baru belum punya raport; keluarkan sementara dari kelas agar tidak terhitung di peringkat kelas lama.
        db.prepare('UPDATE santri SET kelas_id = NULL WHERE id = ?').run(s.id);
        continue;
      }
      const kelasLaluIdx = naikKelas ? KELAS.findIndex((k) => k.tingkat === tingkatKini - 1 && k.bagian === KELAS[s.kelasIdx].bagian) : s.kelasIdx;
      db.prepare('UPDATE santri SET kelas_id = ? WHERE id = ?').run(idKelas[kelasLaluIdx], s.id);
      isiAbsensi(s, idKelas[kelasLaluIdx], hariLalu);
      isiNilai(s, kelasLaluIdx, idLalu, { harian: true, uts: true, uas: true });
      const rata = s.mampu;
      const catatan =
        rata >= 85
          ? "Alhamdulillah, ananda menunjukkan prestasi yang sangat baik dan akhlak yang terpuji. Pertahankan semangat belajar dan muraja'ah hafalannya."
          : rata >= 74
            ? "Ananda rajin dan tekun mengikuti pelajaran. Tingkatkan ketelitian menulis pegon dan perbanyak muraja'ah di rumah."
            : 'Ananda perlu lebih giat belajar dan hadir tepat waktu. Mohon bimbingan Bapak/Ibu dalam mengulang pelajaran di rumah.';
      const keputusan = lalu.semester === 2 ? `Naik ke kelas ${KELAS[s.kelasIdx].nama}` : null;
      db.prepare(
        'INSERT INTO raport (santri_id, periode_id, akhlak, kerajinan, kerapian, kedisiplinan, catatan, keputusan) VALUES (?,?,?,?,?,?,?,?)',
      ).run(s.id, idLalu, nilaiSikap(s), nilaiSikap(s), nilaiSikap(s), nilaiSikap(s), catatan, keputusan);
    }
    for (const s of santri) {
      if (naikKelas && KELAS[s.kelasIdx].tingkat === 1) continue;
      const h = terbitkan(db, s.id, idLalu, idAdmin);
      if (!h.ok) throw new Error(`Raport demo gagal terbit: ${h.alasan.join(' ')}`);
    }
    // Sebagian wali sudah membuka raportnya.
    db.prepare('UPDATE raport SET dibaca_wali = diterbitkan WHERE periode_id = ? AND (santri_id % 3) != 0').run(idLalu);
    db.prepare("UPDATE raport SET diterbitkan = ? WHERE periode_id = ?").run(`${lalu.raport}T03:00:00.000Z`, idLalu);
    for (const s of santri) db.prepare('UPDATE santri SET kelas_id = ? WHERE id = ?').run(idKelas[s.kelasIdx], s.id);
  })();
  // Pastikan cap waktu terbit di salinan beku sama dengan kolomnya.
  for (const r of db.prepare('SELECT santri_id, snapshot FROM raport WHERE periode_id = ? AND status = ?').all(idLalu, 'terbit') as { santri_id: number; snapshot: string }[]) {
    const d = JSON.parse(r.snapshot);
    d.diterbitkan = `${lalu.raport}T03:00:00.000Z`;
    db.prepare('UPDATE raport SET snapshot = ? WHERE santri_id = ? AND periode_id = ?').run(JSON.stringify(d), r.santri_id, idLalu);
  }

  // Semester berjalan: absensi sampai kemarin (hari ini hanya sebagian kelas), nilai sesuai kemajuan semester.
  const hariIniBelajar = new Date(`${hari}T12:00:00Z`).getUTCDay() !== 5;
  db.transaction(() => {
    for (const s of santri) {
      isiAbsensi(s, idKelas[s.kelasIdx], hariKini);
      if (hariIniBelajar && s.kelasIdx < 2) isiAbsensi(s, idKelas[s.kelasIdx], [hari]);
      if (komponen.harian) isiNilai(s, s.kelasIdx, idKini, komponen);
    }
  })();

  // Syahriah: sebagian besar lunas sampai bulan ini, beberapa menunggak.
  db.transaction(() => {
    const st = db.prepare('INSERT INTO syahriah (santri_id, bulan, nominal, tanggal_bayar, metode, catatan, dicatat_oleh, dibuat) VALUES (?,?,?,?,?,?,?,?)');
    const awal = Number(kini.tahunAjaran.slice(0, 4));
    const bulanBerjalan = hari.slice(0, 7);
    for (const s of santri) {
      const pola = acak();
      for (let i = 0; i < 12; i++) {
        const m = ((6 + i) % 12) + 1;
        const y = i < 6 ? awal : awal + 1;
        const b = `${y}-${String(m).padStart(2, '0')}`;
        if (b > bulanBerjalan) break;
        if (b === bulanBerjalan && pola < 0.45) continue;
        if (pola > 0.85 && b >= tambahHari(hari, -40).slice(0, 7)) continue;
        const tgl = `${b}-${String(antara(1, 12)).padStart(2, '0')}`;
        st.run(s.id, b, 25000, tgl > hari ? hari : tgl, acak() < 0.8 ? 'tunai' : 'transfer', null, idAdmin, sekarang());
      }
    }
  })();

  // Pengumuman.
  const p = db.prepare('INSERT INTO pengumuman (judul, isi, sasaran, penting, terbit, dibuat_oleh) VALUES (?,?,?,?,?,?)');
  const sem = kini.semester === 1 ? 'Ganjil' : 'Genap';
  const akhirSemester = kini.selesai;
  p.run(
    `Ujian Akhir Semester ${sem}`,
    `Ujian Akhir Semester ${sem} ${kini.tahunAjaran} dilaksanakan mulai ${tambahHari(akhirSemester, -18)} sampai ${tambahHari(akhirSemester, -9)}. ` +
      "Santri dimohon hadir pukul 13.45, membawa alat tulis, dan memakai seragam putih. Mohon Bapak/Ibu mendampingi ananda muraja'ah di rumah.",
    'semua',
    1,
    `${tambahHari(hari, -2)}T02:00:00.000Z`,
    idAdmin,
  );
  p.run(
    'Raport online sudah bisa dibuka',
    `Alhamdulillah, raport semester ${lalu.semester === 1 ? 'ganjil' : 'genap'} ${lalu.tahunAjaran} kini bisa dilihat dan diunduh langsung dari menu Raport. ` +
      'Setiap raport memuat kode QR untuk memeriksa keasliannya. Raport cetak tetap dibagikan saat pertemuan wali santri.',
    'semua',
    0,
    `${tambahHari(hari, -20)}T02:00:00.000Z`,
    idAdmin,
  );
  p.run(
    "Setoran nadzom 'Aqidatul 'Awam",
    "Santriwati kelas Sayyidah Fatimah ditargetkan hafal bait 1–28 'Aqidatul 'Awam sampai akhir semester. Setoran setiap Ahad dan Selasa sebelum pelajaran dimulai.",
    `kelas:${idKelas[1]}`,
    0,
    `${tambahHari(hari, -9)}T02:00:00.000Z`,
    idAdmin,
  );
  p.run(
    'Ziarah dan khataman bersama',
    "Insya Allah khataman Al-Qur'an dan ziarah maqbaroh masyayikh diadakan Ahad pagi pukul 07.00 di aula madrasah. Santri putra memakai baju koko putih dan peci hitam.",
    'putra',
    0,
    `${tambahHari(hari, -6)}T02:00:00.000Z`,
    idAdmin,
  );
  p.run(
    'Kajian wali santriwati',
    'Kajian bulanan untuk wali santriwati bersama Ibu Nyai diadakan Kamis sore setelah Ashar di musholla putri. Tema bulan ini: mendampingi putri belajar di rumah.',
    'putri',
    0,
    `${tambahHari(hari, -4)}T02:00:00.000Z`,
    idAdmin,
  );

  // Riwayat aktivitas.
  const log = db.prepare('INSERT INTO log_aktivitas (waktu, pelaku, aksi, detail) VALUES (?,?,?,?)');
  const jejak: [number, string, string, string][] = [
    [-3, 'Ust. Ahmad Fauzi', 'Mengisi nilai', 'Sayyidina Hasan · Fiqih: 10 santri'],
    [-2, 'Ustdz. Siti Maryam', 'Mencatat setoran hafalan', "Fatimah Az-Zahra: Surat Al-Kautsar"],
    [-2, 'Ust. Ahmad Fauzi', 'Menerbitkan pengumuman', `Ujian Akhir Semester ${sem}`],
    [-1, 'Ustdz. Siti Maryam', 'Mengisi absensi', 'Sayyidah Fatimah: 10 hadir, 0 tidak hadir'],
    [-1, 'Ust. Ahmad Fauzi', 'Mencatat syahriah', 'Ahmad Zaki Mubarok: ' + new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date())],
    [0, 'Ust. Abdul Karim', 'Mengisi absensi', 'Sayyidina Husein: 9 hadir, 1 tidak hadir'],
  ];
  for (const [d, siapa, aksi, detail] of jejak) log.run(`${tambahHari(hari, d)}T0${3 + Math.abs(d)}:10:00.000Z`, siapa, aksi, detail);

  const contoh = db.prepare('SELECT nis FROM santri WHERE id = ?').get(contohWali.id) as { nis: string };
  return { nisContoh: contoh.nis, idKini, idLalu };
}
