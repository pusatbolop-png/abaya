// Pesan otomatis WhatsApp: kotak keluar, pengaturan jadwal dan gateway, serta tombol "jalankan sekarang".
import { Hono } from 'hono';
import { z } from 'zod';
import type { DB } from '../db';
import { hanyaAdmin, pelaku, type VarPengurus } from '../auth';
import { GalatPengguna, ambilPengaturan, bacaIsi, catatLog, hpValid, idParam, rapikanHp, satu, semua, sekarang, simpanPengaturan, teksWajib } from '../util';
import {
  antrekan,
  gatewayAktif,
  jalankanPengingatGuru,
  jalankanPulang,
  jalankanRekap,
  jalankanTagihan,
  jamKirimPulang,
  jamWib,
  belumAbsenGuru,
  kekuranganGuru,
  kirimAntrean,
  susunPulang,
  tunggakanSyahriah,
} from '../domain/pesan';
import { pelajaranHari } from '../domain/harian';
import { hariIni } from '../../shared/format';

const jam = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Jam tidak valid (contoh 18:00).');

export function rutePesan(db: DB) {
  const r = new Hono<{ Variables: VarPengurus }>();
  r.use('*', async (c, next) => {
    hanyaAdmin(c);
    await next();
  });

  r.get('/', (c) => {
    const status = c.req.query('status');
    const jenis = c.req.query('jenis');
    const syarat: string[] = [];
    const param: unknown[] = [];
    if (status && ['antre', 'terkirim', 'gagal'].includes(status)) {
      syarat.push('status = ?');
      param.push(status);
    }
    if (jenis && ['laporan', 'rekap', 'pengingat', 'tagihan', 'pulang', 'uji'].includes(jenis)) {
      syarat.push('jenis = ?');
      param.push(jenis);
    }
    const daftar = semua(
      db,
      `SELECT id, jenis, tujuan, hp, isi, santri_id AS santriId, status, galat, dibuat, dikirim FROM pesan_keluar
        ${syarat.length ? 'WHERE ' + syarat.join(' AND ') : ''} ORDER BY id DESC LIMIT 200`,
      ...param,
    );
    const hitung = Object.fromEntries(
      semua<{ status: string; n: number }>(db, 'SELECT status, COUNT(*) AS n FROM pesan_keluar GROUP BY status').map((h) => [h.status, h.n]),
    );
    const p = ambilPengaturan(db);
    const guru = semua<{ id: number; nama: string; peran: string; hp: string | null }>(
      db,
      'SELECT id, nama, peran, hp FROM pengurus WHERE aktif = 1 ORDER BY peran, nama',
    );
    const tunggakan = tunggakanSyahriah(db);
    const hari = hariIni();
    const pelajaran = pelajaranHari(db, hari);
    const belumAbsen = belumAbsenGuru(db, hari);
    const belumInput = guru
      .map((g) => ({ ...g, ...kekuranganGuru(pelajaran, g.nama, belumAbsen.has(g.id)) }))
      .filter((g) => g.nilai.length || g.absensi.length || g.absenDiri)
      .map((g) => ({ nama: g.nama, punyaHp: !!g.hp?.trim(), nilai: g.nilai.length, absensi: g.absensi.length }));
    const terkirimHariIni = (jenis: string) =>
      satu<{ n: number }>(db, "SELECT COUNT(*) AS n FROM pesan_keluar WHERE jenis = ? AND kunci LIKE ?", jenis, `${jenis}:${hari}:%`)!.n;
    return c.json({
      daftar,
      hitung: { antre: hitung.antre ?? 0, terkirim: hitung.terkirim ?? 0, gagal: hitung.gagal ?? 0 },
      pengaturan: {
        penyedia: p.wa_penyedia as 'manual' | 'fonnte',
        tokenTerisi: !!p.wa_token,
        gatewayAktif: gatewayAktif(p),
        nomor: p.wa_nomor,
        batasInput: p.batas_input_jam,
        pengingatAktif: p.pengingat_guru_aktif === '1',
        pengingatJam: p.pengingat_guru_jam,
        laporanAktif: p.laporan_aktif === '1',
        laporanJam: p.laporan_jam,
        rekapKeGuru: p.rekap_ke_guru === '1',
        pulangAktif: p.pulang_aktif === '1',
        jamPulang: p.jam_pulang,
        pulangMenit: Number(p.pulang_menit) || 10,
        jamKirimPulang: jamKirimPulang(p),
        tagihanAktif: p.tagihan_aktif === '1',
        tagihanJam: p.tagihan_jam,
        tagihanJeda: Number(p.tagihan_jeda) || 3,
        jatuhTempo: Number(p.tagihan_jatuh_tempo) || 10,
        syahriahNominal: Number(p.syahriah_nominal) || 0,
        jedaSampai: p.jeda_sampai || null,
      },
      jadwal: {
        hariIni: hari,
        jamSekarang: jamWib(),
        libur: !!p.jeda_sampai && hari <= p.jeda_sampai,
        adaPelajaran: pelajaran.length > 0,
        laporanTerakhir: p.jadwal_laporan_terakhir || null,
        tagihanTerakhir: p.jadwal_tagihan_terakhir || null,
        pengingatHariIni: terkirimHariIni('pengingat'),
        pulangHariIni: terkirimHariIni('pulang'),
        rekapHariIni: terkirimHariIni('rekap'),
      },
      belumInput,
      pulang: { penerima: susunPulang(db, hari).length },
      penerimaLaporan: guru.map((g) => ({ ...g, punyaHp: !!g.hp?.trim() })),
      tunggakan: {
        santri: tunggakan.length,
        tanpaNomor: tunggakan.filter((t) => !t.hp_wali).length,
        jumlah: tunggakan.reduce((n, t) => n + t.bulan.length * t.nominal, 0),
      },
    });
  });

  r.put('/pengaturan', async (c) => {
    const isi = await bacaIsi(
      c,
      z
        .object({
          penyedia: z.enum(['manual', 'fonnte']),
          token: z.string().max(200).optional(),
          hapusToken: z.boolean().optional(),
          nomor: z
            .string()
            .max(20)
            .default('')
            .refine((v) => !v.trim() || hpValid(v), 'Nomor WhatsApp tidak valid.'),
          batasInput: jam,
          pengingatAktif: z.boolean(),
          pengingatJam: jam,
          laporanAktif: z.boolean(),
          laporanJam: jam,
          rekapKeGuru: z.boolean(),
          pulangAktif: z.boolean(),
          jamPulang: jam,
          pulangMenit: z.number().int().min(5, 'Paling sedikit 5 menit.').max(120, 'Paling lama 120 menit.'),
          tagihanAktif: z.boolean(),
          tagihanJam: jam,
          tagihanJeda: z.number().int().min(1, 'Paling sedikit 1 hari.').max(30, 'Paling lama 30 hari.'),
          jatuhTempo: z.number().int().min(1, 'Tanggal 1–28.').max(28, 'Tanggal 1–28.'),
          jedaSampai: z
            .string()
            .nullish()
            .transform((v) => v || '')
            .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Tanggal tidak valid.'),
        })
        .refine((v) => v.pengingatJam < v.batasInput, { message: 'Pengingat guru harus sebelum batas input.', path: ['pengingatJam'] }),
    );
    const lama = ambilPengaturan(db);
    const token = isi.hapusToken ? '' : isi.token?.trim() ? isi.token.trim() : lama.wa_token;
    if (isi.penyedia === 'fonnte' && !token) throw new GalatPengguna(400, 'Isi token Fonnte terlebih dahulu.', { token: 'Token wajib diisi.' });
    simpanPengaturan(db, {
      wa_penyedia: isi.penyedia,
      wa_token: token,
      laporan_aktif: isi.laporanAktif ? '1' : '0',
      laporan_jam: isi.laporanJam,
      tagihan_aktif: isi.tagihanAktif ? '1' : '0',
      tagihan_jam: isi.tagihanJam,
      tagihan_jeda: String(isi.tagihanJeda),
      tagihan_jatuh_tempo: String(isi.jatuhTempo),
      wa_nomor: isi.nomor.trim() ? rapikanHp(isi.nomor) : '',
      batas_input_jam: isi.batasInput,
      pengingat_guru_aktif: isi.pengingatAktif ? '1' : '0',
      pengingat_guru_jam: isi.pengingatJam,
      rekap_ke_guru: isi.rekapKeGuru ? '1' : '0',
      pulang_aktif: isi.pulangAktif ? '1' : '0',
      jam_pulang: isi.jamPulang,
      pulang_menit: String(isi.pulangMenit),
      jeda_sampai: isi.jedaSampai,
    });
    catatLog(db, pelaku(c), 'Mengubah pengaturan pesan otomatis', `${isi.penyedia === 'fonnte' ? 'gateway Fonnte' : 'kirim manual'}`);
    return c.json({ ok: true });
  });

  // Tombol "jalankan sekarang". Pesan yang sudah dibuat hari ini tidak dibuat ulang (sekali per penerima per hari).
  r.post('/pengingat', async (c) => {
    const hasil = await jalankanPengingatGuru(db, hariIni());
    catatLog(db, pelaku(c), 'Mengingatkan guru yang belum input harian', `${hasil.dibuat} guru`);
    return c.json(hasil);
  });

  r.post('/rekap', async (c) => {
    const hasil = await jalankanRekap(db, hariIni());
    catatLog(db, pelaku(c), 'Membuat rekap harian', `${hasil.dibuat} pesan`);
    return c.json(hasil);
  });

  r.post('/pulang', async (c) => {
    const hasil = await jalankanPulang(db, hariIni());
    catatLog(db, pelaku(c), 'Membuat pengingat jam pulang', `${hasil.dibuat} wali santri`);
    return c.json(hasil);
  });

  r.post('/tagihan', async (c) => {
    const hasil = await jalankanTagihan(db, hariIni());
    catatLog(db, pelaku(c), 'Memproses pengingat syahriah', `${hasil.dibuat} pesan, ${hasil.dilewati} belum waktunya`);
    return c.json(hasil);
  });

  r.post('/uji', async (c) => {
    const { hp } = await bacaIsi(c, z.object({ hp: teksWajib('Nomor WhatsApp', 20).refine(hpValid, 'Nomor WhatsApp tidak valid.') }));
    const p = ambilPengaturan(db);
    const id = antrekan(db, {
      jenis: 'uji',
      tujuan: 'Pesan uji',
      hp,
      isi: `Pesan uji dari aplikasi ${p.singkatan}. Bila pesan ini sampai, pengiriman WhatsApp otomatis sudah berjalan.`,
    });
    const kirim = await kirimAntrean(db, [id]);
    const baris = satu<{ status: string; galat: string | null }>(db, 'SELECT status, galat FROM pesan_keluar WHERE id = ?', id)!;
    return c.json({ id, ...kirim, status: baris.status, galat: baris.galat });
  });

  // Pesan yang dikirim admin sendiri lewat tautan WhatsApp ditandai terkirim.
  r.post('/:id/tandai', (c) => {
    const id = idParam(c);
    const n = db.prepare("UPDATE pesan_keluar SET status = 'terkirim', galat = NULL, dikirim = ? WHERE id = ? AND status != 'terkirim'").run(sekarang(), id).changes;
    if (!n) throw new GalatPengguna(404, 'Pesan tidak ditemukan atau sudah terkirim.');
    return c.json({ ok: true });
  });

  r.post('/:id/ulang', async (c) => {
    const id = idParam(c);
    if (!satu(db, "SELECT 1 FROM pesan_keluar WHERE id = ? AND status = 'gagal'", id)) throw new GalatPengguna(404, 'Pesan gagal tidak ditemukan.');
    if (!gatewayAktif(ambilPengaturan(db))) throw new GalatPengguna(400, 'Gateway WhatsApp belum diatur. Kirim pesan ini lewat tombol WhatsApp.');
    db.prepare("UPDATE pesan_keluar SET status = 'antre', galat = NULL WHERE id = ?").run(id);
    const hasil = await kirimAntrean(db, [id]);
    return c.json(hasil);
  });

  r.delete('/:id', (c) => {
    const id = idParam(c);
    const n = db.prepare("DELETE FROM pesan_keluar WHERE id = ? AND status != 'terkirim'").run(id).changes;
    if (!n) throw new GalatPengguna(404, 'Pesan tidak ditemukan atau sudah terkirim.');
    return c.json({ ok: true });
  });

  return r;
}
