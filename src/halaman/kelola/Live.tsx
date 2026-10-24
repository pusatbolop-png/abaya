import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { useBerkala, useData } from '../../lib/data';
import { useToast } from '../../lib/konteks';
import { Area, Bidang, GalatMuat, KepalaHalaman, Konfirmasi, Kosong, Lembar, Masukan, Memuat, Pemberitahuan, Pilihan, Status, Tombol, Uang, useKirim } from '../../ui/dasar';
import { Ikon } from '../../ui/Ikon';
import { angka, hari, isoKeWibLokal, jam, rupiah, tanggalJam, tanggalWib, wibLokalKeIso } from '../../../shared/format';
import { PLATFORM_LIVE, STATUS_SESI, type StatusSesi } from '../../../shared/konstanta';
import { nadaSesi } from './Ringkasan';
import { LembarPenjualan } from './Penjualan';
import type { PosisiStok } from './Stok';

interface BarisSesi {
  id: number;
  judul: string;
  platform: string;
  host: string;
  jadwalMulai: string;
  jadwalSelesai: string;
  status: StatusSesi;
  mulai: string | null;
  selesai: string | null;
  ruanganId: number;
  ruangan: string;
  kodeRuangan: string;
  jumlahProduk: number;
  omzet: number;
  jumlahPesanan: number;
}

interface DetailSesi {
  id: number;
  judul: string;
  platform: string;
  host: string;
  jadwalMulai: string;
  jadwalSelesai: string;
  status: StatusSesi;
  mulai: string | null;
  selesai: string | null;
  catatan: string | null;
  ruangan: { id: number; kode: string; nama: string };
  produk: { id: number; nama: string; sku: string; harga: number; satuan: string; namaUsaha: string; stok: number }[];
  penjualan: { id: number; nomor: string; total: number; status: string; tanggal: string; nomorPesanan: string | null; pembeli: string | null }[];
}

const geserHari = (ymd: string, n: number) => tanggalWib(new Date(Date.parse(`${ymd}T05:00:00Z`) + n * 86_400_000));

function useAksiSesi(selesai: () => Promise<void>) {
  const toast = useToast();
  const [sibuk, setSibuk] = useState<number | null>(null);
  const jalankan = async (id: number, aksi: 'mulai' | 'selesai' | 'batal', judul: string) => {
    setSibuk(id);
    try {
      await api('POST', `/api/live/${id}/${aksi}`);
      toast(aksi === 'mulai' ? `Siaran "${judul}" dimulai. Lampu ON AIR menyala.` : aksi === 'selesai' ? `Siaran "${judul}" diakhiri.` : `Sesi "${judul}" dibatalkan.`);
      await selesai();
    } catch (e) {
      toast((e as Error).message, 'galat');
    } finally {
      setSibuk(null);
    }
  };
  return { sibuk, jalankan };
}

export function Live() {
  const [cari, setCari] = useSearchParams();
  const tgl = cari.get('tanggal') ?? tanggalWib();
  const r = useData<{ daftar: BarisSesi[] }>(`/api/live?dari=${tgl}`);
  useBerkala(() => void r.muatUlang(), 30_000);
  const [lembar, setLembar] = useState<{ ruang?: number } | null>(cari.get('baru') ? { ruang: Number(cari.get('ruang')) || undefined } : null);
  const [konfirmasi, setKonfirmasi] = useState<BarisSesi | null>(null);
  const { sibuk, jalankan } = useAksiSesi(r.muatUlang);
  const hariIni = tgl === tanggalWib();
  const daftar = r.data?.daftar ?? [];

  const aturTanggal = (t: string) => setCari(t === tanggalWib() ? {} : { tanggal: t }, { replace: true });
  const tutupLembar = () => {
    setLembar(null);
    if (cari.get('baru')) {
      const b = new URLSearchParams(cari);
      b.delete('baru');
      b.delete('ruang');
      setCari(b, { replace: true });
    }
  };

  return (
    <>
      <KepalaHalaman
        judul="Sesi live"
        keterangan="Jadwal siaran per studio. Mulai siaran untuk menyalakan lampu ON AIR di denah gedung."
        aksi={
          <Tombol ragam="utama" ikon="tambah" onClick={() => setLembar({})}>
            Jadwalkan sesi
          </Tombol>
        }
      />
      <div className="bilah-saring">
        <div className="navigasi-hari">
          <Tombol ragam="kedua" className="tombol-ikon" ikon="panah-kiri" aria-label="Hari sebelumnya" onClick={() => aturTanggal(geserHari(tgl, -1))} />
          <label className="pilih-hari">
            <span className="sr-only">Pilih tanggal</span>
            <span aria-hidden="true">{hariIni ? 'Hari ini, ' : ''}{hari(`${tgl}T05:00:00Z`)}</span>
            <input type="date" value={tgl} onChange={(e) => e.target.value && aturTanggal(e.target.value)} />
          </label>
          <Tombol ragam="kedua" className="tombol-ikon" ikon="panah-kanan" aria-label="Hari berikutnya" onClick={() => aturTanggal(geserHari(tgl, 1))} />
          {!hariIni && (
            <Tombol ragam="halus" kecil onClick={() => aturTanggal(tanggalWib())}>
              Kembali ke hari ini
            </Tombol>
          )}
        </div>
      </div>
      {r.galat && !r.data && <GalatMuat galat={r.galat} ulang={r.muatUlang} />}
      {!r.data && !r.galat && <Memuat />}
      {r.data && daftar.length === 0 && (
        <div className="bingkai-tabel">
          <Kosong
            judul={hariIni ? 'Belum ada sesi live hari ini.' : 'Belum ada sesi live pada tanggal ini.'}
            aksi={
              <Tombol kecil ikon="tambah" onClick={() => setLembar({})}>
                Tambah sesi
              </Tombol>
            }
          >
            Pilih studio, host, dan produk yang akan dijual. Jadwal yang bentrok di studio yang sama akan ditolak otomatis.
          </Kosong>
        </div>
      )}
      {r.data && daftar.length > 0 && (
        <ol className="papan-sesi">
          {daftar.map((s) => (
            <li key={s.id} data-status={s.status}>
              <div className="waktu angka">
                <span>{jam(s.jadwalMulai)}</span>
                <span className="redup">{jam(s.jadwalSelesai)}</span>
              </div>
              <div className="isi-sesi">
                <div className="baris-judul">
                  {s.status === 'berlangsung' ? <span className="on-air">ON AIR</span> : <Status nada={nadaSesi(s.status)}>{STATUS_SESI[s.status]}</Status>}
                  <Link to={`/kelola/live/${s.id}`} className="judul-sesi">
                    {s.judul}
                  </Link>
                </div>
                <p className="redup kecil">
                  {s.kodeRuangan} {s.ruangan} · {s.platform} · host {s.host} · {angka(s.jumlahProduk)} produk
                </p>
              </div>
              <div className="angka-sesi">
                <span className="angka tebal">{rupiah(s.omzet)}</span>
                <span className="redup mikro">{angka(s.jumlahPesanan)} pesanan</span>
              </div>
              <div className="aksi-sesi">
                {s.status === 'terjadwal' && (
                  <>
                    <Tombol ragam="siaran" kecil ikon="siaran" sibuk={sibuk === s.id} onClick={() => jalankan(s.id, 'mulai', s.judul)}>
                      Mulai siaran
                    </Tombol>
                  </>
                )}
                {s.status === 'berlangsung' && (
                  <>
                    <Link to={`/kelola/live/${s.id}?jual=1`} className="tombol tombol-utama tombol-kecil">
                      Catat penjualan
                    </Link>
                    <Tombol kecil sibuk={sibuk === s.id} onClick={() => setKonfirmasi(s)}>
                      Akhiri siaran
                    </Tombol>
                  </>
                )}
                {(s.status === 'selesai' || s.status === 'batal') && (
                  <Link to={`/kelola/live/${s.id}`} className="tombol tombol-halus tombol-kecil">
                    Lihat rincian
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      <LembarSesi buka={lembar} tanggal={tgl} tutup={tutupLembar} selesai={r.muatUlang} />
      <Konfirmasi
        buka={!!konfirmasi}
        judul="Akhiri siaran ini?"
        label="Akhiri siaran"
        sibuk={sibuk === konfirmasi?.id}
        ya={async () => {
          if (konfirmasi) await jalankan(konfirmasi.id, 'selesai', konfirmasi.judul);
          setKonfirmasi(null);
        }}
        batal={() => setKonfirmasi(null)}
      >
        <p className="redup">
          Lampu ON AIR di {konfirmasi?.ruangan} akan padam. Pesanan yang masuk setelah ini tetap bisa dicatat ke sesi ini dari halaman rinciannya.
        </p>
      </Konfirmasi>
    </>
  );
}

export function DetailLive() {
  const { id } = useParams();
  const [cari, setCari] = useSearchParams();
  const r = useData<DetailSesi>(`/api/live/${id}`);
  useBerkala(() => void r.muatUlang(), 30_000);
  const { sibuk, jalankan } = useAksiSesi(r.muatUlang);
  const [jual, setJual] = useState(cari.get('jual') === '1');
  const [ubah, setUbah] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState<'selesai' | 'batal' | null>(null);
  const s = r.data;
  const sesiJual = useMemo(() => (s ? { id: s.id, judul: s.judul, platform: s.platform, produkIds: s.produk.map((p) => p.id) } : undefined), [s]);

  if (r.galat && !s) return <GalatMuat galat={r.galat} ulang={r.muatUlang} />;
  if (!s) return <Memuat />;

  const omzet = s.penjualan.filter((p) => p.status === 'selesai').reduce((a, p) => a + p.total, 0);
  const pesanan = s.penjualan.filter((p) => p.status === 'selesai').length;
  const durasi = s.mulai ? Math.round(((s.selesai ? Date.parse(s.selesai) : Date.now()) - Date.parse(s.mulai)) / 60_000) : null;

  return (
    <>
      <KepalaHalaman
        remah={{ ke: '/kelola/live', label: 'Sesi live' }}
        judul={s.judul}
        keterangan={`${s.ruangan.kode} ${s.ruangan.nama} · ${s.platform} · host ${s.host} · ${tanggalJam(s.jadwalMulai)}–${jam(s.jadwalSelesai)}`}
        aksi={
          <>
            {s.status === 'terjadwal' && (
              <>
                <Tombol ragam="siaran" ikon="siaran" sibuk={sibuk === s.id} onClick={() => jalankan(s.id, 'mulai', s.judul)}>
                  Mulai siaran
                </Tombol>
                <Tombol ikon="ubah" onClick={() => setUbah(true)}>
                  Ubah jadwal
                </Tombol>
                <Tombol ragam="bahaya" onClick={() => setKonfirmasi('batal')}>
                  Batalkan sesi
                </Tombol>
              </>
            )}
            {s.status === 'berlangsung' && (
              <>
                <Tombol ragam="utama" ikon="tambah" onClick={() => setJual(true)}>
                  Catat penjualan
                </Tombol>
                <Tombol onClick={() => setKonfirmasi('selesai')}>Akhiri siaran</Tombol>
              </>
            )}
            {s.status === 'selesai' && (
              <Tombol ikon="tambah" onClick={() => setJual(true)}>
                Catat pesanan susulan
              </Tombol>
            )}
          </>
        }
      />
      {s.status === 'berlangsung' && (
        <div className="pita-siaran" role="status">
          <span className="on-air">ON AIR</span>
          <span>
            Sedang siaran di {s.ruangan.nama} sejak pukul {jam(s.mulai)}
            {durasi !== null && ` · ${durasi} menit`}
          </span>
        </div>
      )}
      {s.status === 'batal' && <Pemberitahuan nada="tunggu">Sesi ini dibatalkan dan tidak memakai studio.</Pemberitahuan>}

      <dl className="metrik-deret" style={{ ['--kolom' as string]: 3, marginTop: 24 }}>
        <div className="metrik">
          <dt>Omzet sesi</dt>
          <dd>{rupiah(omzet)}</dd>
        </div>
        <div className="metrik">
          <dt>Pesanan</dt>
          <dd>{angka(pesanan)}</dd>
        </div>
        <div className="metrik">
          <dt>Durasi siaran</dt>
          <dd>
            {durasi !== null ? angka(durasi) : '—'}
            {durasi !== null && <span className="satuan">menit</span>}
          </dd>
          <dd className="ket">{s.mulai ? `Mulai ${jam(s.mulai)}${s.selesai ? `, selesai ${jam(s.selesai)}` : ''}` : 'Belum dimulai'}</dd>
        </div>
      </dl>

      <div className="dua-kolom">
        <section className="bagian">
          <div className="kepala-bagian">
            <h2>Produk yang dijual</h2>
            {s.status === 'terjadwal' && (
              <Tombol kecil ragam="halus" onClick={() => setUbah(true)}>
                Atur produk
              </Tombol>
            )}
          </div>
          {s.produk.length === 0 ? (
            <p className="redup kecil">Belum ada produk dipilih. Atur produk agar host tahu apa yang ditawarkan.</p>
          ) : (
            <ul className="daftar-ringkas">
              {s.produk.map((p) => (
                <li key={p.id}>
                  <span>
                    {p.nama}
                    <span className="sub">{p.namaUsaha}</span>
                  </span>
                  <span className="kanan">
                    <Uang n={p.harga} className="tebal" />
                    <span className={['sub', p.stok <= 5 && 'teks-peringatan'].filter(Boolean).join(' ')}>stok {angka(p.stok)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="bagian">
          <h2>Pesanan dari sesi ini</h2>
          {s.penjualan.length === 0 ? (
            <p className="redup kecil">
              {s.status === 'berlangsung' ? 'Belum ada pesanan. Catat setiap pesanan yang masuk dari kolom komentar atau keranjang.' : 'Belum ada pesanan tercatat.'}
            </p>
          ) : (
            <ul className="daftar-ringkas">
              {s.penjualan.map((p) => (
                <li key={p.id} className={p.status !== 'selesai' ? 'nonaktif' : undefined}>
                  <span>
                    <Link to={`/kelola/penjualan/${p.id}`} className="mono">
                      {p.nomor}
                    </Link>
                    <span className="sub">
                      {jam(p.tanggal)}
                      {p.pembeli ? ` · ${p.pembeli}` : ''}
                      {p.status !== 'selesai' ? ' · dibatalkan' : ''}
                    </span>
                  </span>
                  <Uang n={p.total} className="tebal" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <LembarPenjualan
        buka={jual}
        sesi={sesiJual}
        tutup={() => {
          setJual(false);
          if (cari.get('jual')) setCari({}, { replace: true });
        }}
        selesai={r.muatUlang}
      />
      <LembarSesi buka={ubah ? {} : null} sesi={s} tanggal={tanggalWib(s.jadwalMulai)} tutup={() => setUbah(false)} selesai={r.muatUlang} />
      <Konfirmasi
        buka={!!konfirmasi}
        judul={konfirmasi === 'batal' ? 'Batalkan sesi ini?' : 'Akhiri siaran ini?'}
        label={konfirmasi === 'batal' ? 'Batalkan sesi' : 'Akhiri siaran'}
        ragam={konfirmasi === 'batal' ? 'bahaya' : 'utama'}
        sibuk={sibuk === s.id}
        ya={async () => {
          if (konfirmasi) await jalankan(s.id, konfirmasi, s.judul);
          setKonfirmasi(null);
        }}
        batal={() => setKonfirmasi(null)}
      >
        <p className="redup">
          {konfirmasi === 'batal'
            ? `${s.ruangan.nama} akan tersedia lagi untuk jadwal lain pada jam tersebut.`
            : `Lampu ON AIR di ${s.ruangan.nama} akan padam. Pesanan susulan tetap bisa dicatat ke sesi ini.`}
        </p>
      </Konfirmasi>
    </>
  );
}

function LembarSesi({
  buka,
  sesi,
  tanggal,
  tutup,
  selesai,
}: {
  buka: { ruang?: number } | null;
  sesi?: DetailSesi;
  tanggal: string;
  tutup: () => void;
  selesai: () => Promise<void>;
}) {
  const toast = useToast();
  const ruang = useData<{ ruangan: { id: number; kode: string; nama: string; jenis: string }[] }>(buka ? '/api/gedung' : null);
  const produk = useData<{ daftar: PosisiStok[] }>(buka ? '/api/stok' : null);
  const [d, setD] = useState({ judul: '', ruangan_id: '', platform: '', host: '', tgl: tanggal, mulai: '', selesai: '', catatan: '' });
  const [pilihan, setPilihan] = useState<Set<number>>(new Set());
  const [saring, setSaring] = useState('');
  const { sibuk, galat, bidang, kirim, atur } = useKirim();
  const studio = (ruang.data?.ruangan ?? []).filter((r) => r.jenis === 'studio');

  useEffect(() => {
    if (!buka) return;
    atur(null);
    setSaring('');
    if (sesi) {
      const m = isoKeWibLokal(sesi.jadwalMulai);
      const s = isoKeWibLokal(sesi.jadwalSelesai);
      setD({ judul: sesi.judul, ruangan_id: String(sesi.ruangan.id), platform: sesi.platform, host: sesi.host, tgl: m.slice(0, 10), mulai: m.slice(11), selesai: s.slice(11), catatan: sesi.catatan ?? '' });
      setPilihan(new Set(sesi.produk.map((p) => p.id)));
    } else {
      // Bawaan: satu jam ke depan, dibulatkan ke 30 menit berikutnya.
      const kini = new Date(Math.ceil(Date.now() / 1_800_000) * 1_800_000);
      const lokal = isoKeWibLokal(kini.toISOString());
      const akhir = isoKeWibLokal(new Date(kini.getTime() + 2 * 3600_000).toISOString());
      const pakaiHariIni = tanggal === tanggalWib();
      setD({ judul: '', ruangan_id: buka.ruang ? String(buka.ruang) : '', platform: '', host: '', tgl: pakaiHariIni ? lokal.slice(0, 10) : tanggal, mulai: pakaiHariIni ? lokal.slice(11) : '10:00', selesai: pakaiHariIni ? akhir.slice(11) : '12:00', catatan: '' });
      setPilihan(new Set());
    }
  }, [buka, sesi, tanggal, atur]);

  const grup = useMemo(() => {
    const kata = saring.trim().toLowerCase();
    const m = new Map<string, PosisiStok[]>();
    for (const p of produk.data?.daftar ?? []) {
      if (kata && !`${p.nama} ${p.namaUsaha}`.toLowerCase().includes(kata)) continue;
      m.set(p.namaUsaha, [...(m.get(p.namaUsaha) ?? []), p]);
    }
    return [...m.entries()];
  }, [produk.data, saring]);

  const ubahD = (k: keyof typeof d) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));

  const simpan = async () => {
    const g: Record<string, string> = {};
    if (!d.judul.trim()) g.judul = 'Beri judul sesi, misalnya Promo Kopi Lereng Arjuno.';
    if (!d.ruangan_id) g.ruangan_id = 'Pilih studio.';
    if (!d.platform) g.platform = 'Pilih platform siaran.';
    if (!d.host.trim()) g.host = 'Isi nama host.';
    if (!d.tgl || !d.mulai) g.jadwal_mulai = 'Isi tanggal dan jam mulai.';
    if (!d.selesai) g.jadwal_selesai = 'Isi jam selesai.';
    else if (d.mulai && d.selesai <= d.mulai) g.jadwal_selesai = 'Jam selesai harus setelah jam mulai.';
    if (Object.keys(g).length) return atur('Ada isian yang perlu diperbaiki.', g);
    const isi = {
      judul: d.judul,
      ruangan_id: Number(d.ruangan_id),
      platform: d.platform,
      host: d.host,
      jadwal_mulai: wibLokalKeIso(`${d.tgl}T${d.mulai}`),
      jadwal_selesai: wibLokalKeIso(`${d.tgl}T${d.selesai}`),
      produk_ids: [...pilihan],
      catatan: d.catatan,
    };
    const ok = await kirim(() => (sesi ? api('PATCH', `/api/live/${sesi.id}`, isi) : api('POST', '/api/live', isi)));
    if (ok) {
      toast(sesi ? `Jadwal "${d.judul}" diperbarui.` : `Sesi "${d.judul}" dijadwalkan pukul ${d.mulai.replace(':', '.')}.`);
      tutup();
      await selesai();
    }
  };

  return (
    <Lembar
      buka={!!buka}
      tutup={tutup}
      lebar={600}
      judul={sesi ? 'Ubah jadwal sesi' : 'Jadwalkan sesi live'}
      keterangan="Waktu dalam WIB."
      onSubmit={simpan}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            {sesi ? 'Simpan perubahan jadwal' : 'Simpan jadwal'}
          </Tombol>
        </>
      }
    >
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      <Bidang label="Judul sesi" galat={bidang.judul}>
        {(a) => <Masukan {...a} value={d.judul} onChange={ubahD('judul')} />}
      </Bidang>
      <div className="kisi-isian">
        <Bidang label="Studio" galat={bidang.ruangan_id}>
          {(a) => (
            <Pilihan {...a} value={d.ruangan_id} onChange={ubahD('ruangan_id')}>
              <option value="">Pilih studio</option>
              {studio.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.kode} {r.nama}
                </option>
              ))}
            </Pilihan>
          )}
        </Bidang>
        <Bidang label="Platform" galat={bidang.platform}>
          {(a) => (
            <Pilihan {...a} value={d.platform} onChange={ubahD('platform')}>
              <option value="">Pilih platform</option>
              {PLATFORM_LIVE.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Pilihan>
          )}
        </Bidang>
        <Bidang label="Host" galat={bidang.host} className="penuh">
          {(a) => <Masukan {...a} value={d.host} onChange={ubahD('host')} />}
        </Bidang>
      </div>
      <div className="kisi-waktu">
        <Bidang label="Tanggal" galat={bidang.jadwal_mulai}>
          {(a) => <Masukan {...a} type="date" value={d.tgl} onChange={ubahD('tgl')} />}
        </Bidang>
        <Bidang label="Mulai">
          {(a) => <Masukan {...a} type="time" value={d.mulai} onChange={ubahD('mulai')} step={300} />}
        </Bidang>
        <Bidang label="Selesai" galat={bidang.jadwal_selesai}>
          {(a) => <Masukan {...a} type="time" value={d.selesai} onChange={ubahD('selesai')} step={300} />}
        </Bidang>
      </div>
      <fieldset className="pilih-produk">
        <legend className="label">
          Produk yang dijual <span className="opsional">({pilihan.size} dipilih)</span>
        </legend>
        {(produk.data?.daftar.length ?? 0) > 6 && (
          <div className="kotak-cari">
            <Ikon nama="cari" />
            <Masukan aria-label="Saring produk" placeholder="Saring produk atau UMKM" value={saring} onChange={(e) => setSaring(e.target.value)} />
          </div>
        )}
        {produk.data && produk.data.daftar.length === 0 && <p className="redup kecil">Belum ada produk dengan stok. Produk bisa dipilih belakangan.</p>}
        <div className="grup-produk">
          {grup.map(([umkm, daftar]) => (
            <div key={umkm}>
              <p className="nama-grup">{umkm}</p>
              {daftar.map((p) => (
                <label key={p.id} className="centang">
                  <input
                    type="checkbox"
                    checked={pilihan.has(p.id)}
                    onChange={(e) =>
                      setPilihan((s) => {
                        const n = new Set(s);
                        if (e.target.checked) n.add(p.id);
                        else n.delete(p.id);
                        return n;
                      })
                    }
                  />
                  <span>
                    {p.nama}
                    <span className="redup kecil"> · {rupiah(p.harga)} · stok {p.stok}</span>
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </fieldset>
      <Bidang label="Catatan untuk host" opsional>
        {(a) => <Area {...a} value={d.catatan} onChange={ubahD('catatan')} rows={2} placeholder="Misalnya diskon bundel untuk 30 menit pertama" />}
      </Bidang>
    </Lembar>
  );
}
