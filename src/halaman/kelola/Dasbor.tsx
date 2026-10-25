import { Link } from 'react-router';
import { useSesi } from '../../lib/konteks';
import { useBerkala, useData } from '../../lib/data';
import { GalatMuat, KepalaHalaman, Kosong, Memuat, Pemberitahuan, TautanTombol } from '../../ui/dasar';
import { Ikon } from '../../ui/Ikon';
import { angka, rupiah, tanggal } from '../../../shared/format';
import { JENIS_KONTEN, ROADMAP_100, type JenisKonten, type TargetProgram } from '../../../shared/konstanta';

interface Target {
  kunci: string;
  label: string;
  nilai: number | null;
  target: number;
  satuan: string;
  tautan: string;
}
interface ProdukLaris {
  id: number;
  nama: string;
  namaUsaha: string;
  prioritas: boolean;
  jumlah: number;
  nilai: number;
  sebelumnya: number;
}
interface DataDasbor {
  program: {
    mulai: string | null;
    hariKe: number | null;
    tahap: number | null;
    target: TargetProgram;
    awalTahun: string;
    hariBerjalanTahun: number;
  };
  target: Target[];
  alur: { kunci: string; tahap: string; label: string; nilai: number }[];
  omzet: {
    binaan: number;
    terukur: number;
    tanpaAwal: number;
    mencapai: number;
    median: number | null;
    teratas: {
      id: number;
      namaUsaha: string;
      awal: number;
      terakhir: number;
      bulan: string;
      kenaikan: number;
    }[];
  };
  penjualan: {
    mingguan: { mulai: string; nilai: number }[];
    nilai30: number;
    nilaiLive30: number;
    retur30: number;
    kanal: { kanal: string; nilai: number; daring: boolean }[];
  };
  produk: {
    prioritas: number;
    nasional: number;
    tujuh: ProdukLaris[];
    tigaPuluh: ProdukLaris[];
  };
  live: {
    aktif: number;
    total: number;
    sesi30: number;
    jam30: number;
    studio: {
      id: number;
      kode: string;
      nama: string;
      sesi: number;
      jam: number;
      nilai: number;
      siaran: boolean;
    }[];
  };
  konten: {
    tahun: number;
    tigaPuluh: number;
    jenis: { jenis: string; n: number }[];
    bulanan: { bulan: string; n: number }[];
  };
  affiliate: {
    aktif: number;
    baru30: number;
    platform: { platform: string; n: number }[];
  };
}

const PILAR: Record<string, string> = {
  terinkubasi: 'Pilar 3 · Inkubasi UMKM',
  produkNasional: 'Pilar 1 · Product Intelligence',
  studioAktif: 'Pilar 5 · Live Commerce Center',
  affiliate: 'Pilar 6 · Affiliate Community',
  konten: 'Pilar 4 · Content Factory',
  omzet: 'Dampak terukur',
};

const persen = (n: number) => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(n)}%`;
const namaBulan = (b: string) => new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' }).format(new Date(b + '-01T00:00:00Z'));

/** Penilaian laju: target tahunan dibagi rata sepanjang tahun program. */
function lajuTarget(t: Target, hariBerjalan: number) {
  if (t.nilai === null) return { nada: 'netral' as const, teks: 'Belum ada data', harapan: null };
  if (t.kunci === 'omzet')
    return t.nilai >= t.target ? { nada: 'ok' as const, teks: 'Tercapai', harapan: null } : { nada: 'tunggu' as const, teks: 'Belum tercapai', harapan: null };
  if (t.nilai >= t.target) return { nada: 'ok' as const, teks: 'Tercapai', harapan: null };
  const harapan = Math.max(1, Math.round((t.target * hariBerjalan) / 365));
  return t.nilai >= harapan * 0.9 ? { nada: 'ok' as const, teks: 'Sesuai jalur', harapan } : { nada: 'tunggu' as const, teks: 'Di bawah laju', harapan };
}

function KartuTarget({ t, hariBerjalan }: { t: Target; hariBerjalan: number }) {
  const laju = lajuTarget(t, hariBerjalan);
  const isi = t.nilai === null ? 0 : Math.min(100, (Math.max(0, t.nilai) / t.target) * 100);
  const nilai = t.nilai === null ? '—' : t.satuan === '%' ? persen(t.nilai) : angka(t.nilai);
  const target = t.satuan === '%' ? `+${t.target}%` : angka(t.target);
  return (
    <li className="dsb-target">
      <p className="dsb-pilar">{PILAR[t.kunci]}</p>
      <h3>{t.label}</h3>
      <p className="dsb-angka">
        <span className="angka">{nilai}</span>
        <span className="redup"> / {target}</span>
      </p>
      <div
        className="dsb-meter"
        role="meter"
        aria-label={`${t.label}: ${nilai} dari target ${target}`}
        aria-valuemin={0}
        aria-valuemax={t.target}
        aria-valuenow={Math.max(0, t.nilai ?? 0)}
      >
        <span style={{ width: `${isi}%` }} data-nada={laju.nada} />
      </div>
      <p className="dsb-laju">
        <span className="status" data-nada={laju.nada}>
          {laju.teks}
        </span>
        {laju.harapan !== null && <span className="redup kecil">Laju hari ini: {angka(laju.harapan)}</span>}
      </p>
      <Link to={t.tautan} className="tautan-panah kecil">
        Lihat data
        <Ikon nama="panah-kanan" />
      </Link>
    </li>
  );
}

function Roadmap({ p, admin }: { p: DataDasbor['program']; admin: boolean }) {
  if (!p.mulai || p.hariKe === null) {
    return (
      <Pemberitahuan nada="info">
        Tanggal mulai operasional belum diisi, jadi roadmap 100 hari belum bisa dihitung.{' '}
        {admin ? <Link to="/kelola/pengaturan?bagian=program">Isi di Pengaturan, bagian Program.</Link> : 'Minta administrator mengisinya di Pengaturan.'}
      </Pemberitahuan>
    );
  }
  const lewat = p.hariKe > 100;
  return (
    <section className="dsb-roadmap" aria-labelledby="judul-roadmap">
      <div className="kepala-bagian">
        <h2 id="judul-roadmap">Roadmap 100 hari pertama</h2>
        <p className="redup kecil">
          {p.hariKe < 1
            ? `Program dimulai ${tanggal(p.mulai + 'T05:00:00Z')}.`
            : lewat
              ? `Hari ke-${angka(p.hariKe)} sejak ${tanggal(p.mulai + 'T05:00:00Z')}. Roadmap 100 hari telah dilalui.`
              : `Hari ke-${angka(p.hariKe)} dari 100, sejak ${tanggal(p.mulai + 'T05:00:00Z')}.`}
        </p>
      </div>
      <ol className="dsb-tahap">
        {ROADMAP_100.map((t, i) => {
          const status = lewat || (p.hariKe ?? 0) > t.sampai ? 'lewat' : p.tahap === i ? 'kini' : 'nanti';
          const isi = status === 'lewat' ? 100 : status === 'kini' ? (((p.hariKe ?? 0) - t.dari + 1) / (t.sampai - t.dari + 1)) * 100 : 0;
          return (
            <li key={t.judul} data-status={status} aria-current={status === 'kini' ? 'step' : undefined}>
              <span className="dsb-tahap-garis" aria-hidden="true">
                <span style={{ width: `${isi}%` }} />
              </span>
              <span className="redup mikro angka">
                Hari {t.dari}–{t.sampai}
              </span>
              <strong>{t.judul}</strong>
              <span className="redup kecil">{t.isi}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Alur({ alur }: { alur: DataDasbor['alur'] }) {
  const maks = Math.max(1, ...alur.map((a) => a.nilai));
  return (
    <section className="bagian" aria-labelledby="judul-alur">
      <div className="kepala-bagian">
        <h2 id="judul-alur">Alur kerja: dari kurasi sampai evaluasi</h2>
        <p className="redup kecil">Jumlah UMKM yang sudah melewati setiap tahap.</p>
      </div>
      <ol className="dsb-alur">
        {alur.map((a, i) => {
          const sebelum = i > 0 ? alur[i - 1].nilai : null;
          return (
            <li key={a.kunci}>
              <span className="dsb-alur-tahap mikro">{a.tahap}</span>
              <span className="dsb-alur-label">{a.label}</span>
              <span className="dsb-alur-batang" aria-hidden="true">
                <span style={{ width: `${(a.nilai / maks) * 100}%` }} />
              </span>
              <span className="angka tebal">{angka(a.nilai)}</span>
              <span className="redup mikro angka">{sebelum ? `${Math.round((a.nilai / sebelum) * 100)}% dari tahap sebelumnya` : 'UMKM'}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function GrafikMingguan({ data }: { data: DataDasbor['penjualan']['mingguan'] }) {
  const maks = Math.max(1, ...data.map((d) => d.nilai));
  return (
    <figure className="dsb-grafik">
      <div className="batang dsb-batang-12" aria-hidden="true">
        {data.map((d, i) => (
          <div key={d.mulai} className="kolom-batang" title={`Pekan ${tanggal(d.mulai + 'T05:00:00Z')}: ${rupiah(d.nilai)}`}>
            <span className={i === data.length - 1 ? 'batang-isi hari-ini' : 'batang-isi'} style={{ height: `${Math.max(2, (d.nilai / maks) * 100)}%` }} />
            {i % 3 === 2 && (
              <span className="tgl angka">
                {new Date(d.mulai + 'T05:00:00Z').getUTCDate()}/{new Date(d.mulai + 'T05:00:00Z').getUTCMonth() + 1}
              </span>
            )}
          </div>
        ))}
      </div>
      <figcaption className="redup mikro">Nilai penjualan per pekan, 12 pekan terakhir. Batang gelap adalah pekan berjalan.</figcaption>
      <table className="sr-only">
        <caption>Penjualan per pekan</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.mulai}>
              <th scope="row">Pekan mulai {tanggal(d.mulai + 'T05:00:00Z')}</th>
              <td>{rupiah(d.nilai)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function DaftarBatang({ isi, kosong }: { isi: { label: string; nilai: number; tampil: string; sub?: string }[]; kosong: string }) {
  if (!isi.length) return <p className="redup kecil">{kosong}</p>;
  const maks = Math.max(1, ...isi.map((x) => x.nilai));
  return (
    <ul className="dsb-batang-daftar">
      {isi.map((x) => (
        <li key={x.label}>
          <span>
            {x.label}
            {x.sub && <span className="sub">{x.sub}</span>}
          </span>
          <span className="angka tebal">{x.tampil}</span>
          <span className="dsb-alur-batang" aria-hidden="true">
            <span style={{ width: `${(x.nilai / maks) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function TabelLaris({ judul, data }: { judul: string; data: ProdukLaris[] }) {
  return (
    <div className="dsb-laris">
      <h3>{judul}</h3>
      {data.length === 0 ? (
        <p className="redup kecil">Belum ada penjualan pada periode ini.</p>
      ) : (
        <ol>
          {data.map((p) => {
            const naik = p.sebelumnya ? Math.round(((p.jumlah - p.sebelumnya) / p.sebelumnya) * 100) : null;
            return (
              <li key={p.id}>
                <span>
                  {p.nama}
                  {p.prioritas && <span className="dsb-tanda">Prioritas</span>}
                  <span className="sub">{p.namaUsaha}</span>
                </span>
                <span className="kanan">
                  <span className="angka tebal">{angka(p.jumlah)} terjual</span>
                  <span className={['mikro', 'angka', naik === null ? 'redup' : naik >= 0 ? 'teks-ok' : 'teks-galat'].join(' ')}>
                    {naik === null ? 'Baru pada periode ini' : `${naik >= 0 ? '+' : ''}${naik}% dari periode sebelumnya`}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function Dasbor() {
  const { pengguna } = useSesi();
  const admin = pengguna?.peran === 'admin';
  const r = useData<DataDasbor>('/api/dasbor');
  useBerkala(() => void r.muatUlang(), 60_000);
  const d = r.data;

  return (
    <>
      <KepalaHalaman
        judul="Dasbor kinerja"
        keterangan="Kemajuan PCC terhadap target tahun pertama: penjualan nyata UMKM Kabupaten Pasuruan."
        aksi={
          admin ? (
            <TautanTombol ke="/kelola/pengaturan?bagian=program" ikon="sasaran">
              Atur target
            </TautanTombol>
          ) : undefined
        }
      />
      {r.galat && !d && <GalatMuat galat={r.galat} ulang={r.muatUlang} />}
      {!d && !r.galat && <Memuat />}
      {d && (
        <div className="dsb">
          <Roadmap p={d.program} admin={admin} />

          <section className="bagian" aria-labelledby="judul-target">
            <div className="kepala-bagian">
              <h2 id="judul-target">Target kinerja tahun pertama</h2>
              <p className="redup kecil">
                Tahun program berjalan hari ke-
                {angka(d.program.hariBerjalanTahun)} dari 365. Laju dihitung merata sepanjang tahun.
              </p>
            </div>
            <ul className="dsb-target-kisi">
              {d.target.map((t) => (
                <KartuTarget key={t.kunci} t={t} hariBerjalan={d.program.hariBerjalanTahun} />
              ))}
            </ul>
          </section>

          <Alur alur={d.alur} />

          <div className="dua-kolom">
            <section className="bagian" aria-labelledby="judul-penjualan">
              <div className="kepala-bagian">
                <h2 id="judul-penjualan">Penjualan nyata</h2>
                <Link to="/kelola/penjualan" className="tautan-panah">
                  Semua penjualan
                  <Ikon nama="panah-kanan" />
                </Link>
              </div>
              <dl className="dsb-angka-deret">
                <div>
                  <dt>30 hari terakhir</dt>
                  <dd className="angka">{rupiah(d.penjualan.nilai30)}</dd>
                </div>
                <div>
                  <dt>Dari siaran live</dt>
                  <dd className="angka">{d.penjualan.nilai30 ? persen((d.penjualan.nilaiLive30 / d.penjualan.nilai30) * 100) : '—'}</dd>
                </div>
                <div>
                  <dt>Retur</dt>
                  <dd className="angka">{rupiah(d.penjualan.retur30)}</dd>
                </div>
              </dl>
              <GrafikMingguan data={d.penjualan.mingguan} />
            </section>

            <div>
              <section className="bagian" aria-labelledby="judul-omzet">
                <div className="kepala-bagian">
                  <h2 id="judul-omzet">Kenaikan omzet UMKM binaan</h2>
                </div>
                {d.omzet.terukur === 0 ? (
                  <Kosong judul="Belum ada omzet yang bisa dibandingkan.">
                    Isi omzet awal setiap UMKM binaan, lalu catat laporan omzet bulanannya di halaman UMKM. Kenaikan dibandingkan terhadap omzet awal.
                  </Kosong>
                ) : (
                  <>
                    <p className="dsb-sorot">
                      <span className="angka">{angka(d.omzet.mencapai)}</span> dari {angka(d.omzet.terukur)} UMKM terukur naik minimal {d.program.target.kenaikanOmzet}%.
                    </p>
                    <ul className="daftar-ringkas">
                      {d.omzet.teratas.map((u) => (
                        <li key={u.id}>
                          <span>
                            <Link to={`/kelola/umkm/${u.id}`}>{u.namaUsaha}</Link>
                            <span className="sub">
                              {rupiah(u.awal)} → {rupiah(u.terakhir)} per bulan ({namaBulan(u.bulan)})
                            </span>
                          </span>
                          <span className={['angka', 'tebal', u.kenaikan >= d.program.target.kenaikanOmzet ? 'teks-ok' : u.kenaikan < 0 ? 'teks-galat' : ''].join(' ')}>
                            {u.kenaikan >= 0 ? '+' : ''}
                            {persen(u.kenaikan)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {d.omzet.tanpaAwal > 0 && <p className="redup kecil">{angka(d.omzet.tanpaAwal)} UMKM binaan belum punya omzet awal, jadi kenaikannya belum bisa dihitung.</p>}
              </section>
              <section className="bagian" aria-labelledby="judul-kanal">
                <div className="kepala-bagian">
                  <h2 id="judul-kanal">Kanal penjualan, 30 hari</h2>
                </div>
                <DaftarBatang
                  isi={d.penjualan.kanal.map((k) => ({
                    label: k.kanal,
                    nilai: k.nilai,
                    tampil: rupiah(k.nilai),
                    sub: k.daring ? 'Marketplace daring' : 'Luring',
                  }))}
                  kosong="Belum ada penjualan 30 hari terakhir. Catat penjualan dari setiap kanal agar terlihat di sini."
                />
              </section>
            </div>
          </div>

          <section className="bagian dsb-pilar-bagian" aria-labelledby="judul-pilar">
            <div className="kepala-bagian">
              <h2 id="judul-pilar">Rincian pilar</h2>
            </div>
            <div className="dsb-pilar-kisi">
              <article className="dsb-kartu" aria-labelledby="judul-pi">
                <p className="dsb-pilar">Pilar 1</p>
                <h3 id="judul-pi">Product Intelligence</h3>
                <p className="redup kecil">
                  {angka(d.produk.prioritas)} produk prioritas, {angka(d.produk.nasional)} sudah terjual di marketplace daring.
                </p>
                <TabelLaris judul="Terlaris 7 hari" data={d.produk.tujuh} />
                <TabelLaris judul="Terlaris 30 hari" data={d.produk.tigaPuluh} />
              </article>

              <article className="dsb-kartu" aria-labelledby="judul-lc">
                <p className="dsb-pilar">Pilar 5</p>
                <h3 id="judul-lc">Live Commerce Center</h3>
                <p className="redup kecil">
                  30 hari terakhir: {angka(d.live.sesi30)} sesi, {new Intl.NumberFormat('id-ID').format(d.live.jam30)} jam siaran, {angka(d.live.aktif)} dari {angka(d.live.total)}{' '}
                  studio aktif.
                </p>
                <DaftarBatang
                  isi={d.live.studio.map((s) => ({
                    label: `${s.kode} ${s.nama}`,
                    nilai: s.nilai,
                    tampil: rupiah(s.nilai),
                    sub: `${angka(s.sesi)} sesi · ${new Intl.NumberFormat('id-ID').format(s.jam)} jam${s.siaran ? ' · sedang siaran' : ''}`,
                  }))}
                  kosong="Belum ada studio siaran."
                />
              </article>

              <article className="dsb-kartu" aria-labelledby="judul-cf">
                <p className="dsb-pilar">Pilar 4</p>
                <h3 id="judul-cf">Content Factory</h3>
                <p className="redup kecil">
                  {angka(d.konten.tigaPuluh)} konten dalam 30 hari terakhir, {angka(d.konten.tahun)} sepanjang tahun program.
                </p>
                <div className="batang dsb-batang-6" aria-hidden="true">
                  {d.konten.bulanan.map((b, i) => {
                    const maks = Math.max(1, ...d.konten.bulanan.map((x) => x.n));
                    return (
                      <div key={b.bulan} className="kolom-batang" title={`${namaBulan(b.bulan)}: ${b.n} konten`}>
                        <span
                          className={i === d.konten.bulanan.length - 1 ? 'batang-isi hari-ini' : 'batang-isi'}
                          style={{
                            height: `${Math.max(2, (b.n / maks) * 100)}%`,
                          }}
                        />
                        <span className="tgl">{namaBulan(b.bulan)}</span>
                      </div>
                    );
                  })}
                </div>
                <table className="sr-only">
                  <caption>Konten per bulan</caption>
                  <tbody>
                    {d.konten.bulanan.map((b) => (
                      <tr key={b.bulan}>
                        <th scope="row">{namaBulan(b.bulan)}</th>
                        <td>{b.n} konten</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <DaftarBatang
                  isi={d.konten.jenis.map((j) => ({
                    label: JENIS_KONTEN[j.jenis as JenisKonten] ?? j.jenis,
                    nilai: j.n,
                    tampil: angka(j.n),
                  }))}
                  kosong="Belum ada konten tercatat. Catat setiap video, foto, dan materi yang diproduksi di halaman Content Factory."
                />
                <Link to="/kelola/konten" className="tautan-panah kecil">
                  Buka Content Factory
                  <Ikon nama="panah-kanan" />
                </Link>
              </article>

              <article className="dsb-kartu" aria-labelledby="judul-af">
                <p className="dsb-pilar">Pilar 6</p>
                <h3 id="judul-af">Affiliate Community</h3>
                <p className="redup kecil">
                  {angka(d.affiliate.aktif)} affiliate aktif, {angka(d.affiliate.baru30)} bergabung dalam 30 hari terakhir.
                </p>
                <DaftarBatang
                  isi={d.affiliate.platform.map((p) => ({
                    label: p.platform,
                    nilai: p.n,
                    tampil: `${angka(p.n)} orang`,
                  }))}
                  kosong="Belum ada affiliate. Daftarkan anggota komunitas affiliate lokal di halaman Affiliate."
                />
                <Link to="/kelola/affiliate" className="tautan-panah kecil">
                  Kelola affiliate
                  <Ikon nama="panah-kanan" />
                </Link>
              </article>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
