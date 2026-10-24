import { useState } from 'react';
import { KepalaHalaman, Masukan } from '../../ui/dasar';
import { Ikon } from '../../ui/Ikon';
import { tanggalWib } from '../../../shared/format';

function presetRentang() {
  const kini = tanggalWib();
  const [y, m] = kini.split('-').map(Number);
  const awalBulan = `${y}-${String(m).padStart(2, '0')}-01`;
  const lalu = new Date(Date.UTC(y, m - 2, 1));
  const akhirLalu = new Date(Date.UTC(y, m - 1, 0));
  const f = (d: Date) => d.toISOString().slice(0, 10);
  return [
    { label: '7 hari', dari: tanggalWib(new Date(Date.now() - 6 * 86_400_000)), sampai: kini },
    { label: '30 hari', dari: tanggalWib(new Date(Date.now() - 29 * 86_400_000)), sampai: kini },
    { label: 'Bulan ini', dari: awalBulan, sampai: kini },
    { label: 'Bulan lalu', dari: f(lalu), sampai: f(akhirLalu) },
  ];
}

export function RentangTanggal({ dari, sampai, ubah }: { dari: string; sampai: string; ubah: (dari: string, sampai: string) => void }) {
  const preset = presetRentang();
  return (
    <div className="rentang-tanggal">
      <div className="segmen" role="group" aria-label="Rentang cepat">
        {preset.map((p) => (
          <button key={p.label} type="button" aria-pressed={p.dari === dari && p.sampai === sampai} onClick={() => ubah(p.dari, p.sampai)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="tanggal-manual">
        <label>
          <span className="sr-only">Dari tanggal</span>
          <Masukan type="date" value={dari} max={sampai} onChange={(e) => e.target.value && ubah(e.target.value, sampai)} />
        </label>
        <span aria-hidden="true" className="redup">
          –
        </span>
        <label>
          <span className="sr-only">Sampai tanggal</span>
          <Masukan type="date" value={sampai} min={dari} max={tanggalWib()} onChange={(e) => e.target.value && ubah(dari, e.target.value)} />
        </label>
      </div>
    </div>
  );
}

const LAPORAN = [
  { jenis: 'penjualan', judul: 'Penjualan per barang', isi: 'Setiap barang terjual dengan kanal, sesi live, UMKM, harga, dan jumlah yang sudah diretur.', berperiode: true },
  { jenis: 'dana', judul: 'Dana dan pencairan UMKM', isi: 'Posisi hak setiap UMKM saat ini, ditambah riwayat pencairan pada periode terpilih.', berperiode: true },
  { jenis: 'retur', judul: 'Retur pembeli', isi: 'Barang yang dikembalikan, kondisinya, nilai, dan alasan retur.', berperiode: true },
  { jenis: 'live', judul: 'Sesi live', isi: 'Jadwal, studio, host, jumlah pesanan, dan omzet setiap sesi.', berperiode: true },
  { jenis: 'mutasi', judul: 'Riwayat mutasi stok', isi: 'Semua barang masuk, terjual, retur, rusak, dan penyesuaian beserta petugasnya.', berperiode: true },
  { jenis: 'stok', judul: 'Posisi stok', isi: 'Stok terkini setiap produk aktif dan nilainya pada harga jual.', berperiode: false },
  { jenis: 'umkm', judul: 'Daftar UMKM', isi: 'Seluruh pendaftar beserta status seleksi dan jumlah produk aktif.', berperiode: false },
];

export function Laporan() {
  const [dari, setDari] = useState(() => presetRentang()[2].dari);
  const [sampai, setSampai] = useState(tanggalWib());
  const q = `dari=${dari}&sampai=${sampai}`;
  return (
    <>
      <KepalaHalaman
        judul="Laporan dan ekspor"
        keterangan="Unduh data untuk pelaporan ke dinas, rekonsiliasi keuangan, atau arsip. Berkas Excel sudah berisi baris jumlah."
      />
      <div className="bilah-saring">
        <RentangTanggal
          dari={dari}
          sampai={sampai}
          ubah={(d, s) => {
            setDari(d);
            setSampai(s);
          }}
        />
      </div>
      <ul className="daftar-laporan">
        {LAPORAN.map((l) => (
          <li key={l.jenis}>
            <div>
              <h2>{l.judul}</h2>
              <p className="redup kecil">
                {l.isi} {l.berperiode ? '' : 'Tidak bergantung pada rentang tanggal.'}
              </p>
            </div>
            <div className="deret-tombol">
              <a className="tombol tombol-kedua tombol-kecil" href={`/api/ekspor/${l.jenis}?${q}&format=xlsx`} download>
                <Ikon nama="unduh" />
                Unduh Excel
              </a>
              <a className="tombol tombol-halus tombol-kecil" href={`/api/ekspor/${l.jenis}?${q}&format=csv`} download>
                Unduh CSV
              </a>
            </div>
          </li>
        ))}
      </ul>
      <p className="redup kecil" style={{ marginTop: 24 }}>
        CSV memakai titik koma sebagai pemisah dan pengodean UTF-8 agar langsung terbaca Excel berbahasa Indonesia. Semua waktu dalam WIB.
      </p>
    </>
  );
}
