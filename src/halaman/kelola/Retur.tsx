import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, ambil } from '../../lib/api';
import { useData } from '../../lib/data';
import { useToast } from '../../lib/konteks';
import { Area, Bidang, GalatMuat, KepalaHalaman, Kosong, Lembar, Masukan, Memuat, Pemberitahuan, Pilihan, Tombol, Uang, useKirim } from '../../ui/dasar';
import { angka, rupiah, tanggalJam, tanggalWib } from '../../../shared/format';
import { KONDISI_RETUR, type KondisiRetur } from '../../../shared/konstanta';
import type { DetailPenjualanData } from './Penjualan';
import { RentangTanggal } from './Laporan';

interface BarisRetur {
  id: number;
  nomor: string;
  tanggal: string;
  alasan: string;
  total: number;
  penjualanId: number;
  nomorPenjualan: string;
  kanal: string;
  jumlahItem: number;
  jumlahRusak: number | null;
}

export function Retur() {
  const [cari, setCari] = useSearchParams();
  const dari = cari.get('dari') ?? tanggalWib(new Date(Date.now() - 29 * 86_400_000));
  const sampai = cari.get('sampai') ?? tanggalWib();
  const r = useData<{ daftar: BarisRetur[] }>(`/api/retur?dari=${dari}&sampai=${sampai}`);
  const [cariPenjualan, setCariPenjualan] = useState(false);
  const [penjualan, setPenjualan] = useState<DetailPenjualanData | null>(null);
  const total = r.data?.daftar.reduce((a, x) => a + x.total, 0) ?? 0;
  const rusak = r.data?.daftar.reduce((a, x) => a + (x.jumlahRusak ?? 0), 0) ?? 0;

  return (
    <>
      <KepalaHalaman
        judul="Retur"
        keterangan="Barang yang dikembalikan pembeli. Barang layak jual kembali ke stok; barang rusak dikembalikan ke UMKM."
        aksi={
          <Tombol ragam="utama" ikon="retur" onClick={() => setCariPenjualan(true)}>
            Catat retur
          </Tombol>
        }
      />
      <div className="bilah-saring">
        <RentangTanggal dari={dari} sampai={sampai} ubah={(d, s) => setCari({ dari: d, sampai: s }, { replace: true })} />
      </div>
      {r.galat && !r.data && <GalatMuat galat={r.galat} ulang={r.muatUlang} />}
      {!r.data && !r.galat && <Memuat />}
      {r.data && (
        <>
          <dl className="metrik-deret" style={{ ['--kolom' as string]: 3 }}>
            <div className="metrik">
              <dt>Nilai retur</dt>
              <dd>{rupiah(total)}</dd>
              <dd className="ket">{angka(r.data.daftar.length)} retur</dd>
            </div>
            <div className="metrik">
              <dt>Barang diretur</dt>
              <dd>{angka(r.data.daftar.reduce((a, x) => a + x.jumlahItem, 0))}</dd>
            </div>
            <div className="metrik">
              <dt>Rusak, perlu dikembalikan ke UMKM</dt>
              <dd>{angka(rusak)}</dd>
            </div>
          </dl>
          {r.data.daftar.length === 0 ? (
            <div className="bingkai-tabel">
              <Kosong
                judul="Tidak ada retur pada rentang tanggal ini."
                aksi={
                  <Tombol kecil ikon="retur" onClick={() => setCariPenjualan(true)}>
                    Catat retur
                  </Tombol>
                }
              >
                Retur selalu dikaitkan dengan nomor penjualannya agar nilai dana UMKM ikut terkoreksi.
              </Kosong>
            </div>
          ) : (
            <div className="bingkai-tabel">
              <table className="tabel tabel-susun">
                <thead>
                  <tr>
                    <th scope="col">Nomor</th>
                    <th scope="col">Waktu</th>
                    <th scope="col">Penjualan</th>
                    <th scope="col">Alasan</th>
                    <th scope="col" className="angka">
                      Barang
                    </th>
                    <th scope="col" className="angka">
                      Nilai
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.data.daftar.map((x) => (
                    <tr key={x.id}>
                      <td data-label="" className="mono tebal">
                        {x.nomor}
                      </td>
                      <td data-label="Waktu" className="nowrap">
                        {tanggalJam(x.tanggal)}
                      </td>
                      <td data-label="Penjualan">
                        <Link to={`/kelola/penjualan/${x.penjualanId}`} className="mono">
                          {x.nomorPenjualan}
                        </Link>
                        <span className="sub">{x.kanal}</span>
                      </td>
                      <td data-label="Alasan">{x.alasan}</td>
                      <td data-label="Barang" className="angka">
                        {angka(x.jumlahItem)}
                        {x.jumlahRusak ? <span className="sub">{x.jumlahRusak} rusak</span> : null}
                      </td>
                      <td data-label="Nilai" className="angka tebal">
                        <Uang n={x.total} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <LembarCariPenjualan
        buka={cariPenjualan}
        tutup={() => setCariPenjualan(false)}
        pilih={(p) => {
          setCariPenjualan(false);
          setPenjualan(p);
        }}
      />
      <LembarRetur penjualan={penjualan} tutup={() => setPenjualan(null)} selesai={r.muatUlang} />
    </>
  );
}

function LembarCariPenjualan({ buka, tutup, pilih }: { buka: boolean; tutup: () => void; pilih: (p: DetailPenjualanData) => void }) {
  const [q, setQ] = useState('');
  const [hasil, setHasil] = useState<{ id: number; nomor: string; tanggal: string; total: number; kanal: string; status: string; nomorPesanan: string | null }[] | null>(null);
  const { sibuk, galat, kirim, atur } = useKirim();
  useEffect(() => {
    if (buka) {
      setQ('');
      setHasil(null);
      atur(null);
    }
  }, [buka, atur]);
  const dari = tanggalWib(new Date(Date.now() - 90 * 86_400_000));
  const cari = async () => {
    if (!q.trim()) return atur('Isi nomor penjualan, nomor pesanan platform, atau nama pembeli.');
    const r = await kirim(() => ambil<{ daftar: NonNullable<typeof hasil> }>(`/api/penjualan?dari=${dari}&q=${encodeURIComponent(q.trim())}`));
    if (r) setHasil(r.daftar.filter((x) => x.status === 'selesai'));
  };
  const buka2 = async (id: number) => {
    const r = await kirim(() => ambil<DetailPenjualanData>(`/api/penjualan/${id}`));
    if (r) pilih(r);
  };
  return (
    <Lembar
      buka={buka}
      tutup={tutup}
      judul="Cari penjualan"
      keterangan="Retur dicatat terhadap penjualan dalam 90 hari terakhir."
      onSubmit={cari}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            Cari penjualan
          </Tombol>
        </>
      }
    >
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      <Bidang label="Nomor penjualan, nomor pesanan, atau nama pembeli">
        {(a) => <Masukan {...a} value={q} onChange={(e) => setQ(e.target.value)} placeholder="PJ-261024-0003" className="mono" />}
      </Bidang>
      {hasil && hasil.length === 0 && <p className="redup kecil">Tidak ada penjualan yang cocok. Periksa nomornya atau coba nomor pesanan dari platform.</p>}
      {hasil && hasil.length > 0 && (
        <ul className="daftar-pilih">
          {hasil.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => buka2(h.id)}>
                <span>
                  <span className="mono tebal">{h.nomor}</span>
                  <span className="sub">
                    {tanggalJam(h.tanggal)} · {h.kanal}
                    {h.nomorPesanan ? ` · ${h.nomorPesanan}` : ''}
                  </span>
                </span>
                <Uang n={h.total} className="tebal" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Lembar>
  );
}

export function LembarRetur({ penjualan, tutup, selesai }: { penjualan: DetailPenjualanData | null; tutup: () => void; selesai: () => Promise<void> }) {
  const toast = useToast();
  const [alasan, setAlasan] = useState('');
  const [jumlah, setJumlah] = useState<Record<number, string>>({});
  const [kondisi, setKondisi] = useState<Record<number, KondisiRetur>>({});
  const { sibuk, galat, bidang, kirim, atur } = useKirim();

  useEffect(() => {
    if (!penjualan) return;
    setAlasan('');
    setJumlah({});
    setKondisi({});
    atur(null);
  }, [penjualan, atur]);

  const item = penjualan?.item.filter((i) => i.jumlah > i.diretur) ?? [];
  const total = item.reduce((a, i) => a + (Number(jumlah[i.id]) || 0) * i.harga, 0);

  const simpan = async () => {
    const g: Record<string, string> = {};
    const isi = item.filter((i) => Number(jumlah[i.id]) > 0);
    if (!isi.length) g.item = 'Isi jumlah untuk minimal satu barang yang diretur.';
    for (const i of isi) if (Number(jumlah[i.id]) > i.jumlah - i.diretur) g[`j${i.id}`] = `Maksimal ${i.jumlah - i.diretur}.`;
    if (!alasan.trim()) g.alasan = 'Tuliskan alasan retur, misalnya kemasan rusak saat pengiriman.';
    if (Object.keys(g).length) return atur('Ada isian yang perlu diperbaiki.', g);
    const hasil = await kirim(() =>
      api<{ nomor: string; total: number }>('POST', '/api/retur', {
        penjualan_id: penjualan!.id,
        alasan,
        item: isi.map((i) => ({ item_penjualan_id: i.id, jumlah: Number(jumlah[i.id]), kondisi: kondisi[i.id] ?? 'layak_jual' })),
      }),
    );
    if (hasil) {
      toast(`Retur ${hasil.nomor} sebesar ${rupiah(hasil.total)} tersimpan.`);
      tutup();
      await selesai();
    }
  };

  return (
    <Lembar
      buka={!!penjualan}
      tutup={tutup}
      lebar={620}
      judul="Catat retur"
      keterangan={penjualan ? `Untuk penjualan ${penjualan.nomor}, ${tanggalJam(penjualan.tanggal)}` : undefined}
      onSubmit={simpan}
      kaki={
        <>
          <span className="total-lembar">
            <span className="redup kecil">Nilai retur</span>
            <strong className="angka">{rupiah(total)}</strong>
          </span>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            Simpan retur
          </Tombol>
        </>
      }
    >
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      {bidang.item && <p className="pesan-galat">{bidang.item}</p>}
      <ul className="daftar-retur">
        {item.map((i) => (
          <li key={i.id}>
            <div>
              <p className="tebal">{i.produk}</p>
              <p className="redup kecil">
                {i.namaUsaha} · {rupiah(i.harga)} · terjual {i.jumlah}
                {i.diretur ? `, sudah diretur ${i.diretur}` : ''}
              </p>
            </div>
            <Bidang label="Jumlah diretur" galat={bidang[`j${i.id}`]} className="jumlah">
              {(a) => (
                <Masukan
                  {...a}
                  value={jumlah[i.id] ?? ''}
                  inputMode="numeric"
                  className="angka"
                  placeholder="0"
                  onChange={(e) => setJumlah((x) => ({ ...x, [i.id]: e.target.value.replace(/\D/g, '') }))}
                />
              )}
            </Bidang>
            <Bidang label="Kondisi barang" className="kondisi">
              {(a) => (
                <Pilihan {...a} value={kondisi[i.id] ?? 'layak_jual'} onChange={(e) => setKondisi((x) => ({ ...x, [i.id]: e.target.value as KondisiRetur }))}>
                  {(Object.keys(KONDISI_RETUR) as KondisiRetur[]).map((k) => (
                    <option key={k} value={k}>
                      {KONDISI_RETUR[k]}
                    </option>
                  ))}
                </Pilihan>
              )}
            </Bidang>
          </li>
        ))}
      </ul>
      <Bidang label="Alasan retur" galat={bidang.alasan}>
        {(a) => <Area {...a} value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={2} />}
      </Bidang>
    </Lembar>
  );
}
