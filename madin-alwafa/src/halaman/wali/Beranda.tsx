import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, BookOpenCheck, CalendarCheck2, CalendarClock, Camera, IdCard, KeyRound, Megaphone, ScrollText, Star, Wallet } from 'lucide-react';
import { kirim } from '../../lib/api';
import { urlFoto } from '../../lib/foto';
import { usePakai } from '../../lib/pakai';
import { useSesi } from '../../lib/sesi';
import type { Pengumuman, Santri } from '../../lib/tipe';
import { Avatar, GalatMuat, Lencana, Memuat, Pesan, TautanTombol, Tombol, useJudul } from '../../ui/dasar';
import { AmbilFoto } from '../../ui/AmbilFoto';
import { CincinHadir } from './CincinHadir';
import { warnaPredikat } from '../admin/Hafalan';
import { PREDIKAT_HAFALAN, STATUS_HADIR, predikat, type PredikatHafalan, type StatusHadir } from '../../../shared/konstanta';
import { hariIni, namaBulan, namaSemester, rupiah, tanggalHari, tanggalHijriah, tanggalPendek, waktu } from '../../../shared/format';

interface Beranda {
  santri: Santri & { waliKelas: string | null; jenjang: string | null };
  periode: { id: number; tahunAjaran: string; semester: number } | null;
  kehadiran: { hadir: number; sakit: number; izin: number; alpa: number; total: number } | null;
  absenHariIni: { status: StatusHadir; keterangan: string | null } | null;
  raport: { periodeId: number; tahunAjaran: string; semester: number; rataRata: number | null; peringkat: number | null; jumlahSantri: number; baru: boolean } | null;
  hafalan: { id: number; tanggal: string; jenis: string; materi: string; predikat: PredikatHafalan }[];
  jumlahHafalan: number;
  syahriah: { bulan: string; bulanIni: { nominal: number; tanggal: string } | null; tunggakan: number; nominal: number };
  jadwalHariIni: { jamMulai: string; jamSelesai: string; mapel: string; mapelArab: string | null; pengajar: string | null }[];
  pengumuman: Pengumuman[];
}

export default function BerandaWali() {
  useJudul('Beranda');
  const { wali, muatUlang: segarkanSesi } = useSesi();
  const { data: d, galat, muatUlang } = usePakai<Beranda>('/api/wali/beranda');
  const [foto, setFoto] = useState(false);
  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!d)
    return (
      <>
        <div className="kerangka" style={{ height: 210, borderRadius: 24 }} />
        <Memuat baris={3} tinggi={140} />
      </>
    );
  const s = d.santri;
  const hari = hariIni();
  const p = d.raport?.rataRata != null ? predikat(d.raport.rataRata) : null;

  return (
    <>
      <section className="kaca kaca--emas kaca--kilau sambutan">
        <div className="sambutan__teks">
          <div className="kepala-halaman__kecil">
            {tanggalHijriah(hari)} · {tanggalHari(hari)}
          </div>
          <p className="arab sambutan__salam">السلام عليكم ورحمة الله</p>
          <h1 className="judul-hias sambutan__nama">{s.nama}</h1>
          <div className="baris baris--bungkus" style={{ gap: 8 }}>
            <Lencana jenis="emas">{s.kelasNama ?? 'Belum masuk kelas'}</Lencana>
            <Lencana>NIS {s.nis}</Lencana>
            {s.waliKelas && <Lencana>Wali kelas: {s.waliKelas}</Lencana>}
          </div>
        </div>
        <div className="sambutan__sisi">
          <button type="button" className="avatar-ubah" onClick={() => setFoto(true)} aria-label={s.fotoVersi ? `Ganti foto ${s.nama}` : `Tambah foto ${s.nama}`}>
            <Avatar nama={s.nama} jk={s.jk} ukuran={92} foto={urlFoto(s.id, s.fotoVersi)} />
            <span className="avatar-ubah__kamera" aria-hidden>
              <Camera />
            </span>
          </button>
          {d.absenHariIni ? (
            <Lencana jenis={d.absenHariIni.status === 'H' ? 'ok' : d.absenHariIni.status === 'A' ? 'bahaya' : 'info'} titik>
              Hari ini: {STATUS_HADIR[d.absenHariIni.status]}
            </Lencana>
          ) : (
            <Lencana titik>Belum diabsen hari ini</Lencana>
          )}
        </div>
      </section>

      {!s.fotoVersi && (
        <div className="kaca kaca--rapat ajakan-foto">
          <span className="stat__ikon">
            <Camera />
          </span>
          <div className="isi-penuh">
            <b>Lengkapi foto ananda</b>
            <div className="redup kecil">Foto dipakai di kartu santri digital dan memudahkan ustadz mengenali ananda.</div>
          </div>
          <Tombol varian="utama" ukuran="kecil" ikon={<Camera />} onClick={() => setFoto(true)}>
            Ambil foto
          </Tombol>
        </div>
      )}

      {wali && !wali.sandiDiganti && (
        <Pesan jenis="waspada" judul="Ganti sandi awal Anda">
          Demi keamanan data ananda, ganti sandi yang diberikan madrasah dengan sandi pilihan Anda. <Link to="/wali/akun">Ganti sekarang</Link>
        </Pesan>
      )}

      <div className="grid-wali">
        <section className="kaca kaca--pad kartu-raport-wali">
          <div className="kartu-judul">
            <h2 className="baris" style={{ gap: 8 }}>
              <ScrollText className="teks-ikon" /> Raport terbaru
            </h2>
            {d.raport?.baru && <Lencana jenis="emas">Baru</Lencana>}
          </div>
          {d.raport ? (
            <div className="tumpuk">
              <div className="baris" style={{ gap: 18, alignItems: 'flex-end' }}>
                <div>
                  <div className="angka-besar">{d.raport.rataRata?.toLocaleString('id-ID', { maximumFractionDigits: 1 }) ?? '–'}</div>
                  <div className="redup-2 kecil">rata-rata nilai</div>
                </div>
                {p && (
                  <div className="tumpuk tumpuk--rapat" style={{ gap: 2, paddingBottom: 6 }}>
                    <span className="arab teks-emas" style={{ fontSize: 26, lineHeight: 1.2 }}>
                      {p.arab}
                    </span>
                    <span className="kecil redup">{p.nama}</span>
                  </div>
                )}
              </div>
              <div className="redup kecil">
                Semester {namaSemester(d.raport.semester)} {d.raport.tahunAjaran}
                {d.raport.peringkat && (
                  <>
                    {' '}
                    · peringkat <b>{d.raport.peringkat}</b> dari {d.raport.jumlahSantri}
                  </>
                )}
              </div>
              <TautanTombol to={`/wali/raport/${d.raport.periodeId}`} varian="utama" ikon={<ScrollText />}>
                Buka raport
              </TautanTombol>
            </div>
          ) : (
            <p className="redup">Raport belum diterbitkan. Anda akan melihatnya di sini setelah madrasah menerbitkannya.</p>
          )}
        </section>

        <section className="kaca kaca--pad">
          <div className="kartu-judul">
            <h2 className="baris" style={{ gap: 8 }}>
              <CalendarCheck2 className="teks-ikon" /> Kehadiran
            </h2>
            <Link to="/wali/absensi" className="kecil">
              Rincian
            </Link>
          </div>
          {d.kehadiran && d.kehadiran.total > 0 ? (
            <div className="baris" style={{ gap: 18 }}>
              <CincinHadir k={d.kehadiran} />
              <div className="tumpuk tumpuk--rapat isi-penuh" style={{ gap: 6 }}>
                <div className="redup-2 kecil">Semester {d.periode && `${namaSemester(d.periode.semester)} ${d.periode.tahunAjaran}`}</div>
                <div className="baris baris--antara kecil">
                  <span>Hadir</span>
                  <b className="angka">{d.kehadiran.hadir}</b>
                </div>
                <div className="baris baris--antara kecil">
                  <span>Izin</span>
                  <b className="angka">{d.kehadiran.izin}</b>
                </div>
                <div className="baris baris--antara kecil">
                  <span>Sakit</span>
                  <b className="angka">{d.kehadiran.sakit}</b>
                </div>
                <div className="baris baris--antara kecil">
                  <span>Tanpa keterangan</span>
                  <b className="angka">{d.kehadiran.alpa}</b>
                </div>
              </div>
            </div>
          ) : (
            <p className="redup">Belum ada catatan kehadiran semester ini.</p>
          )}
        </section>

        <section className="kaca kaca--pad">
          <div className="kartu-judul">
            <h2 className="baris" style={{ gap: 8 }}>
              <BookOpenCheck className="teks-ikon" /> Hafalan
            </h2>
            <Link to="/wali/hafalan" className="kecil">
              {d.jumlahHafalan} setoran
            </Link>
          </div>
          <ol className="linimasa">
            {d.hafalan.map((h) => (
              <li key={h.id}>
                <span className={`linimasa__titik linimasa__titik--${h.predikat}`} />
                <div className="isi-penuh">
                  <b>{h.materi}</b>
                  <div className="redup-2 kecil">
                    {tanggalPendek(h.tanggal)} · <span style={{ color: `var(--${warnaPredikat(h.predikat)})` }}>{PREDIKAT_HAFALAN[h.predikat]}</span>
                  </div>
                </div>
              </li>
            ))}
            {!d.hafalan.length && <p className="redup">Belum ada setoran hafalan.</p>}
          </ol>
        </section>

        <section className="kaca kaca--pad">
          <div className="kartu-judul">
            <h2 className="baris" style={{ gap: 8 }}>
              <Wallet className="teks-ikon" /> Syahriah {namaBulan(d.syahriah.bulan)}
            </h2>
            <Link to="/wali/syahriah" className="kecil">
              Riwayat
            </Link>
          </div>
          {d.syahriah.bulanIni ? (
            <div className="tumpuk tumpuk--rapat">
              <Lencana jenis="ok">Lunas · {rupiah(d.syahriah.bulanIni.nominal)}</Lencana>
              <span className="redup-2 kecil">Dibayar {tanggalPendek(d.syahriah.bulanIni.tanggal)}</span>
            </div>
          ) : (
            <div className="tumpuk tumpuk--rapat">
              <Lencana jenis="waspada">Belum tercatat{d.syahriah.nominal ? ` · ${rupiah(d.syahriah.nominal)}` : ''}</Lencana>
              <span className="redup-2 kecil">Pembayaran dicatat oleh pengurus madrasah.</span>
            </div>
          )}
          {d.syahriah.tunggakan > 0 && (
            <p className="kecil" style={{ marginTop: 10, color: 'var(--waspada)' }}>
              {d.syahriah.tunggakan} bulan semester ini belum tercatat lunas.
            </p>
          )}
        </section>

        <section className="kaca kaca--pad">
          <div className="kartu-judul">
            <h2 className="baris" style={{ gap: 8 }}>
              <CalendarClock className="teks-ikon" /> Pelajaran hari ini
            </h2>
            <Link to="/wali/jadwal" className="kecil">
              Sepekan
            </Link>
          </div>
          {d.jadwalHariIni.length ? (
            <div className="tumpuk tumpuk--rapat">
              {d.jadwalHariIni.map((j, i) => (
                <div key={i} className="baris panel" style={{ padding: '10px 12px' }}>
                  <span className="angka kecil redup" style={{ width: 92 }}>
                    {j.jamMulai}–{j.jamSelesai}
                  </span>
                  <span className="isi-penuh">
                    <b>{j.mapel}</b>
                    {j.pengajar && <span className="redup-2 kecil"> · {j.pengajar}</span>}
                  </span>
                  {j.mapelArab && (
                    <span className="arab redup" style={{ fontSize: 17 }}>
                      {j.mapelArab}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="redup">Tidak ada pelajaran hari ini.</p>
          )}
        </section>

        <Link to="/wali/kartu" className="kaca kaca--pad pintas-kartu">
          <span className="pintas-kartu__mini" aria-hidden>
            <span />
          </span>
          <span className="tumpuk tumpuk--rapat isi-penuh" style={{ gap: 4 }}>
            <b className="baris" style={{ gap: 8 }}>
              <IdCard className="teks-ikon" /> Kartu santri digital
            </b>
            <span className="redup kecil">Identitas ananda dan tata tertib madrasah. Bisa ditunjukkan dari ponsel atau dicetak.</span>
          </span>
          <ArrowRight className="redup-2" style={{ width: 18, flex: 'none' }} />
        </Link>

        <section className="kaca kaca--pad">
          <div className="kartu-judul">
            <h2 className="baris" style={{ gap: 8 }}>
              <Megaphone className="teks-ikon" /> Pengumuman
            </h2>
            <Link to="/wali/pengumuman" className="kecil">
              Semua
            </Link>
          </div>
          <div className="tumpuk tumpuk--rapat">
            {d.pengumuman.map((p) => (
              <Link key={p.id} to="/wali/pengumuman" className="panel baris-tautan" style={{ padding: '12px 14px', display: 'grid', gap: 4 }}>
                <div className="baris" style={{ gap: 8 }}>
                  {!!p.penting && <Star style={{ width: 15, color: 'var(--emas-300)' }} />}
                  <b className="potong">{p.judul}</b>
                </div>
                <span className="redup kecil garis-2">{p.isi}</span>
                <span className="redup-2 kecil">{waktu(p.terbit)}</span>
              </Link>
            ))}
            {!d.pengumuman.length && <p className="redup">Belum ada pengumuman.</p>}
          </div>
        </section>
      </div>

      {foto && (
        <AmbilFoto
          nama={s.nama}
          adaFoto={!!s.fotoVersi}
          tutup={() => setFoto(false)}
          simpan={async (data) => {
            await kirim('PUT', '/api/wali/foto', { data });
            muatUlang();
            segarkanSesi();
          }}
          hapus={async () => {
            await kirim('DELETE', '/api/wali/foto');
            muatUlang();
            segarkanSesi();
          }}
        />
      )}

      {wali?.sandiDiganti === false ? null : (
        <div className="baris" style={{ justifyContent: 'center' }}>
          <Link to="/wali/akun" className="kecil redup-2 baris" style={{ gap: 6 }}>
            <KeyRound style={{ width: 14 }} /> Akun & sandi <ArrowRight style={{ width: 14 }} />
          </Link>
        </div>
      )}
    </>
  );
}
