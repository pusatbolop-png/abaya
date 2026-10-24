import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { useData } from '../../lib/data';
import { useToast } from '../../lib/konteks';
import {
  Area,
  Bidang,
  GalatMuat,
  KepalaHalaman,
  Konfirmasi,
  Kosong,
  Lembar,
  Masukan,
  MasukanRupiah,
  Memuat,
  onKlikBaris,
  Pemberitahuan,
  Pilihan,
  Status,
  Tombol,
  Uang,
  useKirim,
} from '../../ui/dasar';
import { Ikon } from '../../ui/Ikon';
import { angka, isoKeWibLokal, rupiah, tanggalJam, tanggalWib, wibLokalKeIso } from '../../../shared/format';
import { KANAL_PENJUALAN } from '../../../shared/konstanta';
import type { PosisiStok } from './Stok';
import { LembarRetur } from './Retur';
import { RentangTanggal } from './Laporan';

interface BarisPenjualan {
  id: number;
  nomor: string;
  kanal: string;
  nomorPesanan: string | null;
  pembeli: string | null;
  tanggal: string;
  total: number;
  status: string;
  sesiId: number | null;
  sesi: string | null;
  jumlahItem: number;
  nilaiRetur: number;
}

export interface DetailPenjualanData {
  id: number;
  nomor: string;
  kanal: string;
  nomorPesanan: string | null;
  pembeli: string | null;
  tanggal: string;
  total: number;
  status: string;
  alasanBatal: string | null;
  sesiId: number | null;
  sesi: string | null;
  oleh: string | null;
  item: { id: number; produkId: number; produk: string; sku: string; namaUsaha: string; jumlah: number; harga: number; subtotal: number; diretur: number }[];
  retur: { id: number; nomor: string; tanggal: string; alasan: string; total: number }[];
}

export function Penjualan() {
  const [cari, setCari] = useSearchParams();
  const navigasi = useNavigate();
  const dari = cari.get('dari') ?? tanggalWib(new Date(Date.now() - 6 * 86_400_000));
  const sampai = cari.get('sampai') ?? tanggalWib();
  const r = useData<{ daftar: BarisPenjualan[]; ringkas: { jumlah: number; bruto: number; retur: number } }>(`/api/penjualan?dari=${dari}&sampai=${sampai}`);
  const [baru, setBaru] = useState(cari.get('baru') === '1');

  const aturRentang = (d: string, s: string) => setCari({ dari: d, sampai: s }, { replace: true });

  return (
    <>
      <KepalaHalaman
        judul="Penjualan"
        keterangan="Catat setiap pesanan dari siaran live atau penjualan langsung. Stok berkurang otomatis."
        aksi={
          <Tombol ragam="utama" ikon="tambah" onClick={() => setBaru(true)}>
            Catat penjualan
          </Tombol>
        }
      />
      <div className="bilah-saring">
        <RentangTanggal dari={dari} sampai={sampai} ubah={aturRentang} />
      </div>
      {r.galat && !r.data && <GalatMuat galat={r.galat} ulang={r.muatUlang} />}
      {!r.data && !r.galat && <Memuat />}
      {r.data && (
        <>
          <dl className="metrik-deret" style={{ ['--kolom' as string]: 3 }}>
            <div className="metrik">
              <dt>Penjualan kotor</dt>
              <dd>{rupiah(r.data.ringkas.bruto)}</dd>
              <dd className="ket">{angka(r.data.ringkas.jumlah)} pesanan selesai</dd>
            </div>
            <div className="metrik">
              <dt>Retur</dt>
              <dd>{rupiah(r.data.ringkas.retur)}</dd>
            </div>
            <div className="metrik">
              <dt>Penjualan bersih</dt>
              <dd>{rupiah(r.data.ringkas.bruto - r.data.ringkas.retur)}</dd>
            </div>
          </dl>
          {r.data.daftar.length === 0 ? (
            <div className="bingkai-tabel">
              <Kosong
                judul="Belum ada penjualan pada rentang tanggal ini."
                aksi={
                  <Tombol kecil ikon="tambah" onClick={() => setBaru(true)}>
                    Catat penjualan
                  </Tombol>
                }
              >
                Pesanan dari siaran live bisa dicatat langsung dari halaman sesi agar omzet tiap sesi terhitung.
              </Kosong>
            </div>
          ) : (
            <div className="bingkai-tabel">
              <table className="tabel tabel-susun">
                <thead>
                  <tr>
                    <th scope="col">Nomor</th>
                    <th scope="col">Waktu</th>
                    <th scope="col">Kanal</th>
                    <th scope="col" className="angka">
                      Barang
                    </th>
                    <th scope="col" className="angka">
                      Total
                    </th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {r.data.daftar.map((p) => (
                    <tr key={p.id} {...onKlikBaris(navigasi, `/kelola/penjualan/${p.id}`)} className={p.status !== 'selesai' ? 'nonaktif' : undefined}>
                      <td data-label="">
                        <Link to={`/kelola/penjualan/${p.id}`} className="utama mono">
                          {p.nomor}
                        </Link>
                        {p.nomorPesanan && <span className="sub">Pesanan {p.nomorPesanan}</span>}
                      </td>
                      <td data-label="Waktu" className="nowrap">
                        {tanggalJam(p.tanggal)}
                      </td>
                      <td data-label="Kanal">
                        {p.kanal}
                        {p.sesi && <span className="sub">{p.sesi}</span>}
                      </td>
                      <td data-label="Barang" className="angka sembunyi-hp">
                        {angka(p.jumlahItem)}
                      </td>
                      <td data-label="Total" className="angka tebal">
                        <Uang n={p.total} />
                        {p.nilaiRetur > 0 && (
                          <span className="sub">
                            retur <Uang n={p.nilaiRetur} />
                          </span>
                        )}
                      </td>
                      <td data-label="Status">
                        {p.status === 'selesai' ? (p.nilaiRetur > 0 ? <Status nada="tunggu">Ada retur</Status> : <Status nada="ok">Selesai</Status>) : <Status nada="mati">Dibatalkan</Status>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <LembarPenjualan
        buka={baru}
        tutup={() => {
          setBaru(false);
          if (cari.get('baru')) {
            const b = new URLSearchParams(cari);
            b.delete('baru');
            setCari(b, { replace: true });
          }
        }}
        selesai={r.muatUlang}
      />
    </>
  );
}

interface Baris {
  kunci: number;
  produkId: string;
  jumlah: string;
  harga: number | '';
}

let nomorBaris = 0;
const barisBaru = (produkId = ''): Baris => ({ kunci: ++nomorBaris, produkId, jumlah: '1', harga: '' });

interface SesiPilihan {
  id: number;
  judul: string;
  platform: string;
  status: string;
  ruangan: string;
}

export function LembarPenjualan({
  buka,
  tutup,
  selesai,
  sesi,
}: {
  buka: boolean;
  tutup: () => void;
  selesai: () => Promise<void> | void;
  sesi?: { id: number; judul: string; platform: string; produkIds: number[] };
}) {
  const toast = useToast();
  const produk = useData<{ daftar: PosisiStok[] }>(buka ? '/api/stok' : null);
  const sesiHariIni = useData<{ daftar: SesiPilihan[] }>(buka && !sesi ? `/api/live?dari=${tanggalWib()}` : null);
  const [kanal, setKanal] = useState('');
  const [sesiId, setSesiId] = useState('');
  const [nomorPesanan, setNomorPesanan] = useState('');
  const [pembeli, setPembeli] = useState('');
  const [waktu, setWaktu] = useState('');
  const [baris, setBaris] = useState<Baris[]>([barisBaru()]);
  const { sibuk, galat, bidang, kirim, atur } = useKirim();

  useEffect(() => {
    if (!buka) return;
    atur(null);
    setKanal(sesi?.platform ?? '');
    setSesiId(sesi ? String(sesi.id) : '');
    setNomorPesanan('');
    setPembeli('');
    setWaktu(isoKeWibLokal(new Date().toISOString()));
    setBaris([barisBaru()]);
  }, [buka, sesi, atur]);

  // Bila sesi dipilih dari daftar, kanal mengikuti platform sesi.
  useEffect(() => {
    if (sesi || !sesiId) return;
    const s = sesiHariIni.data?.daftar.find((x) => String(x.id) === sesiId);
    if (s) setKanal(s.platform);
  }, [sesiId, sesi, sesiHariIni.data]);

  const peta = useMemo(() => new Map((produk.data?.daftar ?? []).map((p) => [String(p.id), p])), [produk.data]);
  const urut = useMemo(() => {
    const d = [...(produk.data?.daftar ?? [])];
    if (sesi) d.sort((a, b) => Number(sesi.produkIds.includes(b.id)) - Number(sesi.produkIds.includes(a.id)));
    return d;
  }, [produk.data, sesi]);
  const hargaBaris = (b: Baris) => (b.harga === '' ? (peta.get(b.produkId)?.harga ?? 0) : b.harga);
  const total = baris.reduce((a, b) => a + hargaBaris(b) * (Number(b.jumlah) || 0), 0);
  const ubahBaris = (kunci: number, ubah: Partial<Baris>) => setBaris((bs) => bs.map((b) => (b.kunci === kunci ? { ...b, ...ubah } : b)));

  const simpan = async () => {
    const g: Record<string, string> = {};
    if (!kanal) g.kanal = 'Pilih kanal penjualan.';
    const isi = baris.filter((b) => b.produkId);
    if (!isi.length) g['item'] = 'Tambahkan minimal satu produk.';
    const perProduk = new Map<string, number>();
    for (const b of isi) perProduk.set(b.produkId, (perProduk.get(b.produkId) ?? 0) + (Number(b.jumlah) || 0));
    for (const b of isi) {
      const n = Number(b.jumlah);
      const p = peta.get(b.produkId);
      if (!Number.isInteger(n) || n < 1) g[`item.${b.kunci}`] = 'Jumlah minimal 1.';
      else if (p && (perProduk.get(b.produkId) ?? 0) > p.stok) g[`item.${b.kunci}`] = `Stok ${p.nama} tinggal ${p.stok}.`;
    }
    if (waktu && wibLokalKeIso(waktu) > new Date(Date.now() + 5 * 60_000).toISOString()) g.tanggal = 'Waktu tidak boleh di masa depan.';
    if (Object.keys(g).length) return atur('Ada isian yang perlu diperbaiki.', g);
    const hasil = await kirim(() =>
      api<{ nomor: string; total: number }>('POST', '/api/penjualan', {
        kanal,
        sesi_id: sesiId ? Number(sesiId) : null,
        nomor_pesanan: nomorPesanan,
        pembeli,
        tanggal: waktu ? wibLokalKeIso(waktu) : null,
        item: isi.map((b) => ({ produk_id: Number(b.produkId), jumlah: Number(b.jumlah), harga: b.harga === '' ? undefined : b.harga })),
      }),
    );
    if (hasil) {
      toast(`Penjualan ${hasil.nomor} sebesar ${rupiah(hasil.total)} tersimpan.`);
      tutup();
      await selesai();
    }
  };

  const tanpaProduk = produk.data && produk.data.daftar.length === 0;

  return (
    <Lembar
      buka={buka}
      tutup={tutup}
      lebar={640}
      judul="Catat penjualan"
      keterangan={sesi ? `Dari sesi ${sesi.judul}` : 'Pesanan dari siaran live atau pembelian langsung di galeri.'}
      onSubmit={simpan}
      kaki={
        <>
          <span className="total-lembar">
            <span className="redup kecil">Total</span>
            <strong className="angka">{rupiah(total)}</strong>
          </span>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" ragam="utama" sibuk={sibuk} disabled={!!tanpaProduk}>
            Simpan penjualan
          </Tombol>
        </>
      }
    >
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      {tanpaProduk && (
        <Pemberitahuan nada="tunggu">
          Belum ada produk dengan stok. Tambahkan produk dari halaman UMKM yang sudah diterima, lalu catat barang masuk.
        </Pemberitahuan>
      )}
      <div className="kisi-isian">
        {!sesi && (
          <Bidang label="Sesi live" opsional>
            {(a) => (
              <Pilihan {...a} value={sesiId} onChange={(e) => setSesiId(e.target.value)}>
                <option value="">Bukan dari sesi live</option>
                {(sesiHariIni.data?.daftar ?? [])
                  .filter((s) => s.status !== 'batal')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.judul} · {s.ruangan}
                    </option>
                  ))}
              </Pilihan>
            )}
          </Bidang>
        )}
        <Bidang label="Kanal" galat={bidang.kanal}>
          {(a) => (
            <Pilihan {...a} value={kanal} onChange={(e) => setKanal(e.target.value)}>
              <option value="">Pilih kanal</option>
              {KANAL_PENJUALAN.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </Pilihan>
          )}
        </Bidang>
        <Bidang label="Nomor pesanan di platform" opsional>
          {(a) => <Masukan {...a} value={nomorPesanan} onChange={(e) => setNomorPesanan(e.target.value)} className="mono" />}
        </Bidang>
        <Bidang label="Nama pembeli" opsional>
          {(a) => <Masukan {...a} value={pembeli} onChange={(e) => setPembeli(e.target.value)} />}
        </Bidang>
        <Bidang label="Waktu pesanan (WIB)" galat={bidang.tanggal}>
          {(a) => <Masukan {...a} type="datetime-local" value={waktu} onChange={(e) => setWaktu(e.target.value)} />}
        </Bidang>
      </div>

      <fieldset className="daftar-barang">
        <legend className="label">Barang</legend>
        {bidang.item && (
          <p className="pesan-galat">
            <Ikon nama="peringatan" />
            <span>{bidang.item}</span>
          </p>
        )}
        {baris.map((b, i) => {
          const p = peta.get(b.produkId);
          return (
            <div key={b.kunci} className="baris-barang">
              <Bidang label={`Produk ${i + 1}`} className="produk" galat={bidang[`item.${b.kunci}`]}>
                {(a) => (
                  <Pilihan {...a} value={b.produkId} onChange={(e) => ubahBaris(b.kunci, { produkId: e.target.value, harga: '' })}>
                    <option value="">Pilih produk</option>
                    {urut.map((x) => (
                      <option key={x.id} value={x.id} disabled={x.stok <= 0}>
                        {x.nama} · {x.namaUsaha} · stok {x.stok}
                      </option>
                    ))}
                  </Pilihan>
                )}
              </Bidang>
              <Bidang label="Jumlah" className="jumlah">
                {(a) => <Masukan {...a} value={b.jumlah} inputMode="numeric" className="angka" onChange={(e) => ubahBaris(b.kunci, { jumlah: e.target.value.replace(/\D/g, '') })} />}
              </Bidang>
              <Bidang label="Harga satuan" className="harga" petunjuk={p && b.harga !== '' && b.harga !== p.harga ? `Harga normal ${rupiah(p.harga)}` : undefined}>
                {(a) => <MasukanRupiah {...a} nilai={b.harga === '' ? (p?.harga ?? '') : b.harga} ubah={(v) => ubahBaris(b.kunci, { harga: v })} />}
              </Bidang>
              <Tombol
                ragam="halus"
                className="tombol-ikon hapus-baris"
                ikon="tutup"
                aria-label={`Hapus produk ${i + 1}`}
                disabled={baris.length === 1}
                onClick={() => setBaris((bs) => bs.filter((x) => x.kunci !== b.kunci))}
              />
            </div>
          );
        })}
        <div>
          <Tombol kecil ikon="tambah" onClick={() => setBaris((bs) => [...bs, barisBaru()])}>
            Tambah barang
          </Tombol>
        </div>
      </fieldset>
    </Lembar>
  );
}

export function DetailPenjualan() {
  const { id } = useParams();
  const r = useData<DetailPenjualanData>(`/api/penjualan/${id}`);
  const toast = useToast();
  const [retur, setRetur] = useState(false);
  const [batal, setBatal] = useState(false);
  const [alasan, setAlasan] = useState('');
  const { sibuk, galat, bidang, kirim, atur } = useKirim();
  const p = r.data;

  if (r.galat && !p) return <GalatMuat galat={r.galat} ulang={r.muatUlang} />;
  if (!p) return <Memuat />;

  const bisaRetur = p.status === 'selesai' && p.item.some((i) => i.jumlah > i.diretur);
  const totalRetur = p.retur.reduce((a, x) => a + x.total, 0);

  const batalkan = async () => {
    if (!alasan.trim()) return atur('Tuliskan alasan pembatalan.', { alasan: 'Alasan wajib diisi.' });
    const ok = await kirim(() => api('POST', `/api/penjualan/${p.id}/batal`, { alasan }));
    if (ok) {
      toast(`Penjualan ${p.nomor} dibatalkan dan stok dikembalikan.`);
      setBatal(false);
      await r.muatUlang();
    }
  };

  return (
    <>
      <KepalaHalaman
        remah={{ ke: '/kelola/penjualan', label: 'Penjualan' }}
        judul={p.nomor}
        keterangan={`${p.kanal} · ${tanggalJam(p.tanggal)}${p.oleh ? ` · dicatat oleh ${p.oleh}` : ''}`}
        aksi={
          p.status === 'selesai' && (
            <>
              {bisaRetur && (
                <Tombol ikon="retur" onClick={() => setRetur(true)}>
                  Catat retur
                </Tombol>
              )}
              {p.retur.length === 0 && (
                <Tombol ragam="bahaya" onClick={() => setBatal(true)}>
                  Batalkan penjualan
                </Tombol>
              )}
            </>
          )
        }
      />
      {p.status !== 'selesai' && (
        <Pemberitahuan nada="tunggu">
          Penjualan ini dibatalkan{p.alasanBatal ? `: ${p.alasanBatal}` : '.'} Stoknya sudah dikembalikan dan tidak dihitung dalam dana UMKM.
        </Pemberitahuan>
      )}
      <div className="dua-kolom lebar-kiri" style={{ marginTop: 24 }}>
        <section className="bagian">
          <h2>Barang</h2>
          <div className="bingkai-tabel">
            <table className="tabel tabel-susun">
              <thead>
                <tr>
                  <th scope="col">Produk</th>
                  <th scope="col" className="angka">
                    Jumlah
                  </th>
                  <th scope="col" className="angka">
                    Harga
                  </th>
                  <th scope="col" className="angka">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {p.item.map((i) => (
                  <tr key={i.id}>
                    <td data-label="">
                      <span className="tebal">{i.produk}</span>
                      <span className="sub">
                        {i.namaUsaha} · <span className="mono">{i.sku}</span>
                        {i.diretur > 0 && ` · ${i.diretur} diretur`}
                      </span>
                    </td>
                    <td data-label="Jumlah" className="angka">
                      {angka(i.jumlah)}
                    </td>
                    <td data-label="Harga" className="angka">
                      <Uang n={i.harga} />
                    </td>
                    <td data-label="Subtotal" className="angka">
                      <Uang n={i.subtotal} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total</td>
                  <td className="angka">
                    <Uang n={p.total} />
                  </td>
                </tr>
                {totalRetur > 0 && (
                  <tr>
                    <td colSpan={3}>Setelah retur</td>
                    <td className="angka">
                      <Uang n={p.total - totalRetur} />
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </section>
        <aside className="kolom-samping">
          <section className="bagian">
            <h2>Rincian</h2>
            <dl className="keterangan">
              <dt>Kanal</dt>
              <dd>{p.kanal}</dd>
              <dt>Sesi live</dt>
              <dd>{p.sesiId ? <Link to={`/kelola/live/${p.sesiId}`}>{p.sesi}</Link> : '—'}</dd>
              <dt>No. pesanan</dt>
              <dd className="mono">{p.nomorPesanan ?? '—'}</dd>
              <dt>Pembeli</dt>
              <dd>{p.pembeli ?? '—'}</dd>
            </dl>
          </section>
          <section className="bagian">
            <h2>Retur</h2>
            {p.retur.length === 0 ? (
              <p className="redup kecil">Belum ada retur untuk penjualan ini.</p>
            ) : (
              <ul className="daftar-ringkas">
                {p.retur.map((x) => (
                  <li key={x.id}>
                    <span>
                      <span className="mono">{x.nomor}</span>
                      <span className="sub">
                        {tanggalJam(x.tanggal)} · {x.alasan}
                      </span>
                    </span>
                    <Uang n={x.total} className="tebal" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
      <LembarRetur penjualan={retur ? p : null} tutup={() => setRetur(false)} selesai={r.muatUlang} />
      <Konfirmasi
        buka={batal}
        judul={`Batalkan ${p.nomor}?`}
        label="Batalkan penjualan"
        ragam="bahaya"
        sibuk={sibuk}
        ya={batalkan}
        batal={() => setBatal(false)}
      >
        <p className="redup">Stok semua barang dikembalikan dan penjualan ini tidak dihitung dalam dana UMKM. Tindakan ini tercatat di riwayat.</p>
        {galat && !bidang.alasan && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
        <Bidang label="Alasan pembatalan" galat={bidang.alasan}>
          {(a) => <Area {...a} value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={2} placeholder="Misalnya pembeli membatalkan sebelum dikirim" />}
        </Bidang>
      </Konfirmasi>
    </>
  );
}

