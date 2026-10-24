import { Link } from 'react-router';
import { useSesi } from '../../lib/konteks';
import { useBerkala, useData } from '../../lib/data';
import { GalatMuat, KepalaHalaman, Kosong, Memuat, Status, TautanTombol, Uang } from '../../ui/dasar';
import { Ikon } from '../../ui/Ikon';
import { angka, hari, jam, rupiah, tanggalJam, tanggalPendek } from '../../../shared/format';
import { STATUS_SESI, type StatusSesi } from '../../../shared/konstanta';

interface DataRingkasan {
  hariIni: { pesanan: number; omzet: number };
  tujuhHari: { tanggal: string; omzet: number }[];
  sesi: { id: number; judul: string; platform: string; host: string; status: StatusSesi; jadwalMulai: string; jadwalSelesai: string; ruangan: string; omzet: number }[];
  menunggu: number;
  diterima: number;
  menipis: { id: number; nama: string; namaUsaha: string; stok: number }[];
  siapCair: number;
  aktivitas: { id: number; ringkasan: string; dibuat: string; oleh: string | null }[];
}

export const nadaSesi = (s: StatusSesi) => (s === 'berlangsung' ? 'siaran' : s === 'selesai' ? 'ok' : s === 'batal' ? 'mati' : 'tunggu');

function salam() {
  const j = Number(new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).format(new Date()));
  return j < 4 ? 'Selamat malam' : j < 11 ? 'Selamat pagi' : j < 15 ? 'Selamat siang' : j < 18 ? 'Selamat sore' : 'Selamat malam';
}

function GrafikOmzet({ data }: { data: DataRingkasan['tujuhHari'] }) {
  const maks = Math.max(1, ...data.map((d) => d.omzet));
  const total = data.reduce((a, d) => a + d.omzet, 0);
  return (
    <figure className="grafik-omzet">
      <figcaption>
        <span className="redup kecil">Omzet tujuh hari terakhir</span>
        <strong className="angka">{rupiah(total)}</strong>
      </figcaption>
      <div className="batang" aria-hidden="true">
        {data.map((d, i) => (
          <div key={d.tanggal} className="kolom-batang" title={`${tanggalPendek(d.tanggal + 'T05:00:00Z')}: ${rupiah(d.omzet)}`}>
            <span className={i === data.length - 1 ? "batang-isi hari-ini" : "batang-isi"} style={{ height: `${Math.max(2, (d.omzet / maks) * 100)}%` }} />
            <span className="tgl angka">{new Date(d.tanggal + 'T05:00:00Z').getUTCDate()}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Omzet per hari</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.tanggal}>
              <th scope="row">{tanggalPendek(d.tanggal + 'T05:00:00Z')}</th>
              <td>{rupiah(d.omzet)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function Ringkasan() {
  const { pengguna } = useSesi();
  const r = useData<DataRingkasan>('/api/ringkasan');
  useBerkala(() => void r.muatUlang(), 30_000);
  const d = r.data;
  const siaran = d?.sesi.filter((s) => s.status === 'berlangsung') ?? [];

  return (
    <>
      <KepalaHalaman
        judul={`${salam()}, ${pengguna?.nama.split(' ')[0] ?? ''}`}
        keterangan={`Ringkasan ${hari(new Date().toISOString())}.`}
        aksi={
          <>
            <TautanTombol ke="/kelola/penjualan?baru=1" ragam="utama" ikon="tambah">
              Catat penjualan
            </TautanTombol>
            <TautanTombol ke="/kelola/live?baru=1" ikon="kalender">
              Jadwalkan sesi
            </TautanTombol>
          </>
        }
      />
      {r.galat && !d && <GalatMuat galat={r.galat} ulang={r.muatUlang} />}
      {!d && !r.galat && <Memuat />}
      {d && (
        <>
          <dl className="metrik-deret">
            <div className="metrik">
              <dt>Penjualan hari ini</dt>
              <dd>{rupiah(d.hariIni.omzet)}</dd>
              <dd className="ket">{d.hariIni.pesanan ? `${angka(d.hariIni.pesanan)} pesanan` : 'Belum ada pesanan'}</dd>
            </div>
            <div className="metrik">
              <dt>Sesi live hari ini</dt>
              <dd>
                {angka(d.sesi.length)}
                <span className="satuan">sesi</span>
              </dd>
              <dd className="ket">{siaran.length ? `${siaran.length} sedang siaran` : 'Tidak ada yang sedang siaran'}</dd>
            </div>
            <div className="metrik">
              <dt>Menunggu seleksi</dt>
              <dd>
                {angka(d.menunggu)}
                <span className="satuan">UMKM</span>
              </dd>
              <dd className="ket">
                {d.menunggu ? <Link to="/kelola/umkm?status=diajukan">Mulai seleksi</Link> : `${angka(d.diterima)} UMKM binaan aktif`}
              </dd>
            </div>
            <div className="metrik">
              <dt>Dana siap dicairkan</dt>
              <dd>{rupiah(d.siapCair)}</dd>
              <dd className="ket">
                <Link to="/kelola/dana">Lihat rincian per UMKM</Link>
              </dd>
            </div>
          </dl>

          <div className="dua-kolom">
            <div className="kolom-samping">
            <section className="bagian" aria-labelledby="judul-jadwal">
              <div className="kepala-bagian">
                <h2 id="judul-jadwal">Jadwal siaran hari ini</h2>
                <Link to="/kelola/live" className="tautan-panah">
                  Semua sesi
                  <Ikon nama="panah-kanan" />
                </Link>
              </div>
              {d.sesi.length === 0 ? (
                <div className="bingkai-tabel">
                  <Kosong
                    judul="Belum ada sesi live hari ini."
                    aksi={
                      <TautanTombol ke="/kelola/live?baru=1" ikon="tambah" kecil>
                        Tambah sesi
                      </TautanTombol>
                    }
                  >
                    Jadwalkan sesi agar studio dan produk yang akan dijual siap sebelum siaran dimulai.
                  </Kosong>
                </div>
              ) : (
                <ol className="lini-sesi">
                  {d.sesi.map((s) => (
                    <li key={s.id} data-status={s.status}>
                      <span className="waktu angka">
                        {jam(s.jadwalMulai)}
                        <span className="redup">{jam(s.jadwalSelesai)}</span>
                      </span>
                      <div className="isi-sesi">
                        <Link to={`/kelola/live/${s.id}`} className="tebal">
                          {s.judul}
                        </Link>
                        <span className="redup kecil">
                          {s.ruangan} · {s.platform} · host {s.host}
                        </span>
                      </div>
                      <div className="ujung-sesi">
                        {s.status === 'berlangsung' ? <span className="on-air">ON AIR</span> : <Status nada={nadaSesi(s.status)}>{STATUS_SESI[s.status]}</Status>}
                        {s.omzet > 0 && <Uang n={s.omzet} className="kecil" />}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
              <section className="bagian" aria-labelledby="judul-aktivitas">
                <h2 id="judul-aktivitas">Aktivitas terakhir</h2>
                {d.aktivitas.length === 0 ? (
                  <p className="redup kecil">Belum ada aktivitas. Catatan setiap perubahan data akan muncul di sini.</p>
                ) : (
                  <ul className="daftar-aktivitas">
                    {d.aktivitas.map((a) => (
                      <li key={a.id}>
                        <p>{a.ringkasan}</p>
                        <p className="redup mikro">
                          {a.oleh ?? 'Formulir publik'} · {tanggalJam(a.dibuat)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="kolom-samping">
              <section className="bagian">
                <GrafikOmzet data={d.tujuhHari} />
              </section>
              <section className="bagian" aria-labelledby="judul-menipis">
                <div className="kepala-bagian">
                  <h2 id="judul-menipis">Stok menipis</h2>
                  <Link to="/kelola/stok" className="tautan-panah">
                    Kelola stok
                    <Ikon nama="panah-kanan" />
                  </Link>
                </div>
                {d.menipis.length === 0 ? (
                  <p className="redup kecil">Semua produk aktif masih punya stok lebih dari lima. Tidak ada yang perlu diisi ulang.</p>
                ) : (
                  <ul className="daftar-ringkas">
                    {d.menipis.map((p) => (
                      <li key={p.id}>
                        <span>
                          {p.nama}
                          <span className="sub">{p.namaUsaha}</span>
                        </span>
                        <span className={['angka', 'tebal', p.stok === 0 && 'teks-galat'].filter(Boolean).join(' ')}>{p.stok === 0 ? 'Habis' : `${p.stok} tersisa`}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

            </div>
          </div>
        </>
      )}
    </>
  );
}
