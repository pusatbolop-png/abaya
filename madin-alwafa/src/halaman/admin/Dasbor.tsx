import { Link } from 'react-router';
import { Activity, BookOpenCheck, CalendarCheck2, ChevronRight, NotebookPen, ScrollText, Smartphone, Users, Wallet } from 'lucide-react';
import { usePakai } from '../../lib/pakai';
import { useSesi } from '../../lib/sesi';
import { Bilah, GalatMuat, KepalaHalaman, Lencana, Memuat, Pesan, Stat, TautanTombol, useJudul } from '../../ui/dasar';
import { namaBulan, namaSemester, rupiah, tanggalHari, tanggalHijriah, tanggalPendek, waktu } from '../../../shared/format';

interface Ringkasan {
  hariIni: string;
  santri: { total: number; putra: number; putri: number };
  kelas: number;
  periode: { id: number; tahunAjaran: string; semester: number; mulai: string; selesai: string } | null;
  absenHariIni: { kelasId: number; kelas: string; bagian: string; santri: number; tercatat: number; hadir: number; izin: number; sakit: number; alpa: number }[];
  tren: { tanggal: string; hadir: number; total: number }[];
  nilai: { harus: number; harian: number; uts: number; uas: number; lengkap: number; bobot: { harian: number; uts: number; uas: number } } | null;
  raport: { terbit: number; dibaca: number; santri: number } | null;
  syahriah: { bulan: string; jumlah: number; total: number };
  hafalanPekan: number;
  akunWali: { aktif: number; total: number };
  aktivitas: { waktu: string; pelaku: string; aksi: string; detail: string | null }[];
}

const persen = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function sapaan() {
  const jam = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).format(new Date()));
  return jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam';
}

export default function Dasbor() {
  useJudul('Dasbor');
  const { pengurus } = useSesi();
  const { data: d, galat, muatUlang } = usePakai<Ringkasan>('/api/admin/ringkasan');

  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!d)
    return (
      <>
        <div className="kerangka" style={{ height: 90, maxWidth: 520 }} />
        <div className="grid-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="kerangka" style={{ height: 140 }} />
          ))}
        </div>
        <Memuat baris={3} tinggi={120} />
      </>
    );

  const sudahAbsen = d.absenHariIni.filter((k) => k.tercatat > 0);
  const tercatat = sudahAbsen.reduce((s, k) => s + k.tercatat, 0);
  const hadir = sudahAbsen.reduce((s, k) => s + k.hadir, 0);
  const minggu = d.periode ? Math.max(1, Math.ceil((Date.parse(d.hariIni) - Date.parse(d.periode.mulai)) / (7 * 86400_000))) : null;

  return (
    <>
      <KepalaHalaman
        kecil={
          <>
            {tanggalHijriah(d.hariIni)} · {tanggalHari(d.hariIni)}
          </>
        }
        judul={
          <>
            {sapaan()}, <span className="teks-emas">{pengurus?.nama.replace(/^(Ust\.|Ustdz\.|Ustadz|Ustadzah)\s*/i, '')}</span>
          </>
        }
        sub={
          d.periode
            ? `Semester ${namaSemester(d.periode.semester)} ${d.periode.tahunAjaran}${minggu && d.hariIni <= d.periode.selesai ? ` · pekan ke-${minggu}` : ''} · berakhir ${tanggalPendek(d.periode.selesai)}`
            : 'Belum ada semester aktif.'
        }
        aksi={
          <>
            <TautanTombol to="/admin/absensi" ikon={<CalendarCheck2 />}>
              Isi absensi
            </TautanTombol>
            <TautanTombol to="/admin/nilai" varian="utama" ikon={<NotebookPen />}>
              Input nilai
            </TautanTombol>
          </>
        }
      />

      {!d.periode && (
        <Pesan jenis="waspada" judul="Mulai dari Pengaturan">
          Buat tahun ajaran dan semester, lalu tambahkan kelas dan santri. <Link to="/admin/pengaturan">Buka Pengaturan</Link>
        </Pesan>
      )}

      <div className="grid-4">
        <Stat ikon={<Users />} label="Santri aktif" nilai={d.santri.total} emas>
          <div className="baris kecil" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Lencana jenis="putra">{d.santri.putra} santri</Lencana>
            <Lencana jenis="putri">{d.santri.putri} santriwati</Lencana>
          </div>
        </Stat>
        <Stat
          ikon={<CalendarCheck2 />}
          label="Hadir hari ini"
          nilai={tercatat ? `${persen(hadir, tercatat)}%` : '–'}
          sub={`${sudahAbsen.length} dari ${d.absenHariIni.length} kelas sudah diabsen`}
        >
          <Bilah persen={persen(sudahAbsen.length, d.absenHariIni.length)} label="Kelas yang sudah diabsen hari ini" />
        </Stat>
        <Stat
          ikon={<NotebookPen />}
          label="Nilai lengkap"
          nilai={d.nilai ? `${persen(d.nilai.lengkap, d.nilai.harus)}%` : '–'}
          sub={d.nilai ? `${d.nilai.lengkap} dari ${d.nilai.harus} nilai mapel santri` : 'Belum ada semester'}
        >
          <Bilah persen={d.nilai ? persen(d.nilai.lengkap, d.nilai.harus) : 0} jenis="emas" label="Nilai mapel santri yang sudah lengkap" />
        </Stat>
        <Stat
          ikon={<ScrollText />}
          label="Raport terbit"
          nilai={d.raport ? `${d.raport.terbit}/${d.raport.santri}` : '–'}
          sub={d.raport?.terbit ? `${d.raport.dibaca} sudah dibuka wali` : 'Semester ini belum ada raport terbit'}
        />
      </div>

      <div className="dasbor-grid">
        <section className="kaca kaca--pad">
          <div className="kartu-judul">
            <h2>Absensi hari ini</h2>
            <Link to="/admin/absensi" className="kecil">
              Buka absensi
            </Link>
          </div>
          <div className="daftar-kelas-absen">
            {d.absenHariIni.map((k) => (
              <Link key={k.kelasId} to={`/admin/absensi?kelas=${k.kelasId}`} className="baris-absen">
                <span className={`titik-status ${k.tercatat ? 'titik-status--ok' : ''}`} />
                <span className="isi-penuh">
                  <b>{k.kelas}</b>
                  <span className="redup-2 kecil"> · {k.santri} santri</span>
                </span>
                {k.tercatat ? (
                  <span className="baris kecil angka" style={{ gap: 6 }}>
                    <Lencana jenis="ok">{k.hadir} H</Lencana>
                    {k.izin + k.sakit > 0 && <Lencana jenis="info">{k.izin + k.sakit} I/S</Lencana>}
                    {k.alpa > 0 && <Lencana jenis="bahaya">{k.alpa} A</Lencana>}
                  </span>
                ) : (
                  <Lencana jenis="waspada">Belum diisi</Lencana>
                )}
                <ChevronRight className="redup-2" style={{ width: 16 }} />
              </Link>
            ))}
            {!d.absenHariIni.length && <p className="redup kecil">Belum ada kelas aktif.</p>}
          </div>
        </section>

        <section className="kaca kaca--pad">
          <div className="kartu-judul">
            <h2>Kehadiran {d.tren.length} hari belajar terakhir</h2>
            <Activity className="redup-2" style={{ width: 18 }} />
          </div>
          <GrafikHadir tren={d.tren} />
        </section>
      </div>

      <div className="grid-3">
        {d.nilai && (
          <section className="kaca kaca--pad tumpuk">
            <div className="kartu-judul" style={{ marginBottom: 0 }}>
              <h2>Pengisian nilai</h2>
              <Link to="/admin/nilai" className="kecil">
                Rincian
              </Link>
            </div>
            {(['harian', 'uts', 'uas'] as const)
              .filter((k) => d.nilai!.bobot[k] > 0)
              .map((k) => (
                <div key={k} className="tumpuk tumpuk--rapat" style={{ gap: 6 }}>
                  <div className="baris baris--antara kecil">
                    <span>
                      {k === 'harian' ? 'Nilai harian' : k === 'uts' ? 'Ujian tengah semester' : 'Ujian akhir semester'}
                      <span className="redup-2"> · bobot {d.nilai!.bobot[k]}%</span>
                    </span>
                    <b className="angka">{persen(d.nilai![k], d.nilai!.harus)}%</b>
                  </div>
                  <Bilah
                    persen={persen(d.nilai![k], d.nilai!.harus)}
                    jenis={persen(d.nilai![k], d.nilai!.harus) < 100 ? 'waspada' : undefined}
                    label={`Pengisian nilai ${k === 'harian' ? 'harian' : k.toUpperCase()}`}
                  />
                </div>
              ))}
          </section>
        )}
        <section className="kaca kaca--pad tumpuk">
          <div className="kartu-judul" style={{ marginBottom: 0 }}>
            <h2>Sepekan terakhir</h2>
          </div>
          <div className="baris">
            <span className="stat__ikon">
              <BookOpenCheck />
            </span>
            <div className="isi-penuh">
              <b className="angka">{d.hafalanPekan}</b> setoran hafalan
              <div className="redup-2 kecil">Al-Qur'an, nadzom, do'a & hadits</div>
            </div>
          </div>
          <div className="baris">
            <span className="stat__ikon">
              <Smartphone />
            </span>
            <div className="isi-penuh">
              <b className="angka">
                {d.akunWali.aktif}/{d.akunWali.total}
              </b>{' '}
              wali sudah memakai aplikasi
              <div style={{ marginTop: 6 }}>
                <Bilah persen={persen(d.akunWali.aktif, d.akunWali.total)} label="Wali yang sudah memakai aplikasi" />
              </div>
            </div>
          </div>
        </section>
        {pengurus?.peran === 'admin' && (
          <section className="kaca kaca--pad tumpuk">
            <div className="kartu-judul" style={{ marginBottom: 0 }}>
              <h2>Syahriah {namaBulan(d.syahriah.bulan)}</h2>
              <Link to="/admin/syahriah" className="kecil">
                Catat
              </Link>
            </div>
            <div className="baris">
              <span className="stat__ikon">
                <Wallet />
              </span>
              <div className="isi-penuh">
                <div className="stat__nilai" style={{ fontSize: 30 }}>
                  {rupiah(d.syahriah.total)}
                </div>
                <div className="redup-2 kecil">
                  {d.syahriah.jumlah} dari {d.santri.total} santri sudah membayar
                </div>
              </div>
            </div>
            <Bilah persen={persen(d.syahriah.jumlah, d.santri.total)} jenis="emas" label="Santri yang sudah membayar syahriah bulan ini" />
          </section>
        )}
      </div>

      <section className="kaca kaca--pad">
        <div className="kartu-judul">
          <h2>Aktivitas terbaru</h2>
        </div>
        <ol className="linimasa">
          {d.aktivitas.map((a, i) => (
            <li key={i}>
              <span className="linimasa__titik" />
              <div className="isi-penuh">
                <div>
                  <b>{a.pelaku}</b> <span className="redup">{a.aksi.charAt(0).toLowerCase() + a.aksi.slice(1)}</span>
                  {a.detail && <span className="redup-2"> — {a.detail}</span>}
                </div>
                <div className="redup-2 kecil">{waktu(a.waktu)} WIB</div>
              </div>
            </li>
          ))}
          {!d.aktivitas.length && <p className="redup kecil">Belum ada aktivitas.</p>}
        </ol>
      </section>
    </>
  );
}

function GrafikHadir({ tren }: { tren: Ringkasan['tren'] }) {
  if (!tren.length) return <p className="redup kecil">Grafik muncul setelah absensi mulai diisi.</p>;
  const L = 560;
  const T = 190;
  const bawah = 28;
  const atas = 22;
  const min = 60;
  const kiri = 36;
  const lebarBatang = (L - kiri) / tren.length;
  const y = (p: number) => atas + (T - atas - bawah) * (1 - (Math.max(min, p) - min) / (100 - min));
  const rata = Math.round(tren.reduce((s, t) => s + (t.total ? (t.hadir / t.total) * 100 : 0), 0) / tren.length);
  return (
    <figure className="grafik" aria-label={`Rata-rata kehadiran ${rata}%`}>
      <svg viewBox={`0 0 ${L} ${T}`} role="img" aria-label={`Grafik kehadiran ${tren.length} hari belajar terakhir, rata-rata ${rata}% santri hadir`}>
        <defs>
          <linearGradient id="batang" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#93f2e5" />
            <stop offset="1" stopColor="#14a89f" stopOpacity=".55" />
          </linearGradient>
        </defs>
        {[100, 90, 80, 70].map((g) => (
          <g key={g}>
            <line x1={kiri} x2={L} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,.08)" strokeDasharray={g === 100 ? undefined : '3 5'} />
            <text x={kiri - 8} y={y(g) + 3.5} textAnchor="end" fontSize="10" fill="rgba(230,241,235,.5)">
              {g}%
            </text>
          </g>
        ))}
        {tren.map((t, i) => {
          const p = t.total ? (t.hadir / t.total) * 100 : 0;
          const x = kiri + i * lebarBatang + lebarBatang * 0.2;
          const w = lebarBatang * 0.6;
          return (
            <g key={t.tanggal}>
              <title>{`${tanggalPendek(t.tanggal)}: ${Math.round(p)}% hadir (${t.hadir}/${t.total})`}</title>
              <rect x={x} y={y(p)} width={w} height={T - bawah - y(p)} rx={Math.min(5, w / 2)} fill="url(#batang)" />
              {(i % 2 === tren.length % 2 || tren.length <= 8) && (
                <text x={x + w / 2} y={T - 9} textAnchor="middle" fontSize="10" fill="rgba(230,241,235,.5)">
                  {Number(t.tanggal.slice(8))}/{Number(t.tanggal.slice(5, 7))}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="redup-2 kecil">
        Rata-rata <b className="teks-emas">{rata}%</b> santri hadir. Sumbu dimulai dari 60%.
      </figcaption>
    </figure>
  );
}
