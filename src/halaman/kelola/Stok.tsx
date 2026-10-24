import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { useData } from '../../lib/data';
import { useToast } from '../../lib/konteks';
import { Area, Bidang, GalatMuat, KepalaHalaman, Kosong, Lembar, Masukan, Memuat, Pemberitahuan, Pilihan, TautanTombol, Tombol, Uang, useKirim } from '../../ui/dasar';
import { Ikon } from '../../ui/Ikon';
import { angka, rupiah, tanggalJam } from '../../../shared/format';
import { JENIS_MUTASI, MUTASI_MANUAL, STOK_MENIPIS, type JenisMutasi } from '../../../shared/konstanta';

export interface PosisiStok {
  id: number;
  nama: string;
  sku: string;
  harga: number;
  satuan: string;
  umkmId: number;
  namaUsaha: string;
  stok: number;
  mutasiTerakhir: string | null;
}
interface Mutasi {
  id: number;
  jenis: JenisMutasi;
  jumlah: number;
  catatan: string | null;
  dibuat: string;
  produk: string;
  sku: string;
  namaUsaha: string;
  oleh: string | null;
}

export function Stok() {
  const [cari, setCari] = useSearchParams();
  const tab = cari.get('tab') === 'riwayat' ? 'riwayat' : 'posisi';
  const r = useData<{ daftar: PosisiStok[]; total: { unit: number; nilai: number } }>('/api/stok');
  const m = useData<{ daftar: Mutasi[] }>(tab === 'riwayat' ? '/api/stok/mutasi' : null);
  const [q, setQ] = useState('');
  const [lembar, setLembar] = useState<{ produkId?: number } | null>(null);

  const daftar = useMemo(() => {
    const kata = q.trim().toLowerCase();
    return (r.data?.daftar ?? []).filter((p) => !kata || `${p.nama} ${p.sku} ${p.namaUsaha}`.toLowerCase().includes(kata));
  }, [r.data, q]);
  const menipis = r.data?.daftar.filter((p) => p.stok <= STOK_MENIPIS).length ?? 0;

  const muatUlang = async () => {
    await r.muatUlang();
    if (tab === 'riwayat') await m.muatUlang();
  };

  return (
    <>
      <KepalaHalaman
        judul="Produk dan stok"
        keterangan="Stok konsinyasi yang dititipkan UMKM di gudang PCC. Penjualan dan retur memperbarui stok secara otomatis."
        aksi={
          <Tombol ragam="utama" ikon="tambah" onClick={() => setLembar({})} disabled={!r.data?.daftar.length}>
            Catat barang masuk
          </Tombol>
        }
      />
      {r.galat && !r.data && <GalatMuat galat={r.galat} ulang={r.muatUlang} />}
      {!r.data && !r.galat && <Memuat />}
      {r.data && r.data.daftar.length === 0 && (
        <div className="bingkai-tabel">
          <Kosong judul="Belum ada produk konsinyasi." aksi={<TautanTombol ke="/kelola/umkm?status=diterima" kecil>Buka UMKM yang diterima</TautanTombol>}>
            Produk ditambahkan dari halaman UMKM yang sudah lolos seleksi, lengkap dengan stok awalnya.
          </Kosong>
        </div>
      )}
      {r.data && r.data.daftar.length > 0 && (
        <>
          <dl className="metrik-deret" style={{ ['--kolom' as string]: 3 }}>
            <div className="metrik">
              <dt>Unit di gudang</dt>
              <dd>{angka(r.data.total.unit)}</dd>
              <dd className="ket">{angka(r.data.daftar.length)} produk aktif</dd>
            </div>
            <div className="metrik">
              <dt>Nilai stok pada harga jual</dt>
              <dd>{rupiah(r.data.total.nilai)}</dd>
            </div>
            <div className="metrik">
              <dt>Menipis atau habis</dt>
              <dd>
                {angka(menipis)}
                <span className="satuan">produk</span>
              </dd>
              <dd className="ket">Stok {STOK_MENIPIS} atau kurang</dd>
            </div>
          </dl>

          <div className="bilah-saring">
            <div className="segmen" role="tablist" aria-label="Tampilan stok">
              <button type="button" role="tab" aria-selected={tab === 'posisi'} onClick={() => setCari({}, { replace: true })}>
                Posisi stok
              </button>
              <button type="button" role="tab" aria-selected={tab === 'riwayat'} onClick={() => setCari({ tab: 'riwayat' }, { replace: true })}>
                Riwayat mutasi
              </button>
            </div>
            {tab === 'posisi' && (
              <div className="kotak-cari">
                <Ikon nama="cari" />
                <Masukan aria-label="Cari produk, SKU, atau UMKM" placeholder="Cari produk, SKU, atau UMKM" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            )}
          </div>

          {tab === 'posisi' ? (
            daftar.length === 0 ? (
              <div className="bingkai-tabel">
                <Kosong judul="Tidak ada produk yang cocok." aksi={<Tombol kecil onClick={() => setQ('')}>Hapus pencarian</Tombol>}>
                  Periksa ejaan atau cari dengan SKU.
                </Kosong>
              </div>
            ) : (
              <div className="bingkai-tabel">
                <table className="tabel tabel-susun">
                  <thead>
                    <tr>
                      <th scope="col">Produk</th>
                      <th scope="col">UMKM</th>
                      <th scope="col" className="angka">
                        Harga
                      </th>
                      <th scope="col" className="angka">
                        Stok
                      </th>
                      <th scope="col" className="angka">
                        Nilai
                      </th>
                      <th scope="col">Terakhir bergerak</th>
                      <th scope="col">
                        <span className="sr-only">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {daftar.map((p) => (
                      <tr key={p.id}>
                        <td data-label="">
                          <span className="tebal">{p.nama}</span>
                          <span className="sub mono">{p.sku}</span>
                        </td>
                        <td data-label="UMKM">
                          <Link to={`/kelola/umkm/${p.umkmId}`}>{p.namaUsaha}</Link>
                        </td>
                        <td data-label="Harga" className="angka">
                          <Uang n={p.harga} />
                        </td>
                        <td data-label="Stok" className={['angka', 'tebal', p.stok === 0 ? 'teks-galat' : p.stok <= STOK_MENIPIS ? 'teks-peringatan' : ''].join(' ')}>
                          {p.stok === 0 ? 'Habis' : `${angka(p.stok)} ${p.satuan}`}
                        </td>
                        <td data-label="Nilai" className="angka">
                          <Uang n={p.stok * p.harga} />
                        </td>
                        <td data-label="Terakhir bergerak" className="nowrap redup">
                          {tanggalJam(p.mutasiTerakhir)}
                        </td>
                        <td data-label="" className="kanan">
                          <Tombol kecil ragam="halus" onClick={() => setLembar({ produkId: p.id })} aria-label={`Catat stok ${p.nama}`}>
                            Catat
                          </Tombol>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : !m.data ? (
            <Memuat />
          ) : m.data.daftar.length === 0 ? (
            <div className="bingkai-tabel">
              <Kosong judul="Belum ada mutasi stok.">Setiap barang masuk, terjual, retur, dan penyesuaian akan tercatat di sini.</Kosong>
            </div>
          ) : (
            <div className="bingkai-tabel">
              <table className="tabel tabel-susun">
                <thead>
                  <tr>
                    <th scope="col">Waktu</th>
                    <th scope="col">Produk</th>
                    <th scope="col">Jenis</th>
                    <th scope="col" className="angka">
                      Jumlah
                    </th>
                    <th scope="col">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {m.data.daftar.map((x) => (
                    <tr key={x.id}>
                      <td data-label="" className="nowrap">
                        {tanggalJam(x.dibuat)}
                        <span className="sub">{x.oleh ?? 'Sistem'}</span>
                      </td>
                      <td data-label="Produk">
                        {x.produk}
                        <span className="sub">{x.namaUsaha}</span>
                      </td>
                      <td data-label="Jenis">{JENIS_MUTASI[x.jenis]}</td>
                      <td data-label="Jumlah" className={['angka', 'tebal', x.jumlah > 0 ? 'teks-ok' : ''].join(' ')}>
                        {x.jumlah > 0 ? '+' : '−'}
                        {angka(Math.abs(x.jumlah))}
                      </td>
                      <td data-label="Catatan" className="redup">
                        {x.catatan ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <LembarMutasi buka={lembar} produk={r.data?.daftar ?? []} tutup={() => setLembar(null)} selesai={muatUlang} />
    </>
  );
}

const LABEL_SIMPAN: Record<string, string> = {
  masuk: 'Simpan barang masuk',
  kembali_umkm: 'Simpan pengembalian',
  rusak: 'Simpan barang rusak',
  penyesuaian: 'Simpan penyesuaian',
};

function LembarMutasi({ buka, produk, tutup, selesai }: { buka: { produkId?: number } | null; produk: PosisiStok[]; tutup: () => void; selesai: () => Promise<void> }) {
  const toast = useToast();
  const [produkId, setProdukId] = useState('');
  const [jenis, setJenis] = useState<string>('masuk');
  const [jumlah, setJumlah] = useState('');
  const [catatan, setCatatan] = useState('');
  const { sibuk, galat, bidang, kirim, atur } = useKirim();

  useEffect(() => {
    if (!buka) return;
    setProdukId(buka.produkId ? String(buka.produkId) : '');
    setJenis('masuk');
    setJumlah('');
    setCatatan('');
    atur(null);
  }, [buka, atur]);

  const grup = useMemo(() => {
    const m = new Map<string, PosisiStok[]>();
    for (const p of produk) m.set(p.namaUsaha, [...(m.get(p.namaUsaha) ?? []), p]);
    return [...m.entries()];
  }, [produk]);
  const terpilih = produk.find((p) => String(p.id) === produkId);
  const n = Number(jumlah);
  const tanda = jenis === 'masuk' ? 1 : jenis === 'penyesuaian' ? Math.sign(n) || 1 : -1;
  const sesudah = terpilih && jumlah && !Number.isNaN(n) ? terpilih.stok + (jenis === 'penyesuaian' ? n : tanda * Math.abs(n)) : null;

  const simpan = async () => {
    const g: Record<string, string> = {};
    if (!produkId) g.produk_id = 'Pilih produk.';
    if (!jumlah || Number.isNaN(n) || n === 0 || !Number.isInteger(n)) g.jumlah = 'Isi jumlah dengan bilangan bulat selain nol.';
    else if (jenis !== 'penyesuaian' && n < 0) g.jumlah = 'Isi jumlah dengan angka positif.';
    if (jenis === 'penyesuaian' && !catatan.trim()) g.catatan = 'Tuliskan alasan penyesuaian, misalnya hasil hitung fisik.';
    if (sesudah !== null && sesudah < 0) g.jumlah = `Stok tinggal ${terpilih!.stok}, tidak cukup untuk dikurangi ${Math.abs(n)}.`;
    if (Object.keys(g).length) return atur('Ada isian yang perlu diperbaiki.', g);
    const ok = await kirim(() => api('POST', '/api/stok/mutasi', { produk_id: Number(produkId), jenis, jumlah: n, catatan }));
    if (ok) {
      toast(`${JENIS_MUTASI[jenis as JenisMutasi]} untuk ${terpilih?.nama} tersimpan.`);
      tutup();
      await selesai();
    }
  };

  return (
    <Lembar
      buka={!!buka}
      tutup={tutup}
      judul="Catat stok"
      keterangan="Gunakan untuk barang masuk, pengembalian ke UMKM, barang rusak, atau hasil hitung fisik."
      onSubmit={simpan}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            {LABEL_SIMPAN[jenis]}
          </Tombol>
        </>
      }
    >
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      <Bidang label="Produk" galat={bidang.produk_id}>
        {(a) => (
          <Pilihan {...a} value={produkId} onChange={(e) => setProdukId(e.target.value)}>
            <option value="">Pilih produk</option>
            {grup.map(([umkm, daftar]) => (
              <optgroup key={umkm} label={umkm}>
                {daftar.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} — stok {p.stok}
                  </option>
                ))}
              </optgroup>
            ))}
          </Pilihan>
        )}
      </Bidang>
      <fieldset className="pilihan-jenis">
        <legend className="label">Jenis catatan</legend>
        {MUTASI_MANUAL.map((j) => (
          <label key={j} className="opsi-keputusan">
            <input type="radio" name="jenis" value={j} checked={jenis === j} onChange={() => setJenis(j)} />
            <span>
              <span className="tebal">{JENIS_MUTASI[j]}</span>
              <span className="redup kecil">
                {j === 'masuk'
                  ? 'Menambah stok.'
                  : j === 'kembali_umkm'
                    ? 'Mengurangi stok, barang diambil kembali oleh pemiliknya.'
                    : j === 'rusak'
                      ? 'Mengurangi stok, barang tidak layak dijual.'
                      : 'Menyamakan catatan dengan hasil hitung fisik. Gunakan angka negatif untuk mengurangi.'}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <Bidang label="Jumlah" galat={bidang.jumlah} petunjuk={sesudah !== null && sesudah >= 0 ? `Stok sesudahnya ${angka(sesudah)} ${terpilih?.satuan ?? ''}.` : undefined}>
        {(a) => <Masukan {...a} value={jumlah} onChange={(e) => setJumlah(e.target.value.replace(/[^\d-]/g, ''))} inputMode={jenis === 'penyesuaian' ? 'text' : 'numeric'} className="angka" />}
      </Bidang>
      <Bidang label="Catatan" opsional={jenis !== 'penyesuaian'} galat={bidang.catatan}>
        {(a) => <Area {...a} value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} placeholder={jenis === 'masuk' ? 'Misalnya titipan minggu kedua' : ''} />}
      </Bidang>
    </Lembar>
  );
}
