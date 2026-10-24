import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { useInfo } from '../../lib/konteks';
import { useBerkala, useData } from '../../lib/data';
import { useJudul } from '../../ui/dasar';
import { Ikon } from '../../ui/Ikon';
import { tautanWa, tampilWa } from '../../../shared/format';
import type { DataRuang } from '../../tiga/adegan';
import type { SesiRuang } from '../../tiga/Gedung3D';

const Gedung3D = lazy(() => import('../../tiga/Gedung3D'));

interface DataGedung {
  ruangan: DataRuang[];
  sesi: SesiRuang[];
}

const LANGKAH = [
  ['Daftar daring', 'Isi formulir dan lampirkan dokumen izin usaha. Anda langsung menerima kode pendaftaran.'],
  ['Kurasi', 'Tim PCC menilai mutu produk, kemasan, kesiapan stok, dan daya tariknya untuk siaran.'],
  ['Titip stok', 'Produk yang lolos dititipkan di gudang konsinyasi. Setiap barang masuk dan keluar tercatat.'],
  ['Siaran langsung', 'Host PCC menjual produk Anda dari studio live di TikTok Shop, Shopee Live, dan kanal lain.'],
  ['Terima dana', 'Hasil penjualan, setelah dikurangi retur, ditransfer ke rekening Anda dengan rincian lengkap.'],
];

export function Beranda() {
  useJudul('Beranda');
  const { info } = useInfo();
  const gedung = useData<DataGedung>('/api/publik/gedung');
  useBerkala(() => void gedung.muatUlang(), 60_000);
  const org = info?.organisasi;
  const studio = gedung.data?.ruangan.filter((r) => r.jenis === 'studio').length ?? 0;
  const siaran = gedung.data?.sesi.filter((s) => s.status === 'berlangsung').length ?? 0;
  const terjadwal = gedung.data?.sesi.filter((s) => s.status !== 'batal').length ?? 0;

  return (
    <>
      <section className="pahlawan">
        <div className="pahlawan-teks">
          <h1 className="tampil">
            Ruang kreatif untuk produk terbaik <em>Pasuruan</em>.
          </h1>
          <p className="pengantar">
            {org?.nama ?? 'Pasuruan Creative Center'} mendampingi UMKM dari kurasi produk, penitipan stok, hingga siaran langsung di studio
            profesional. Setiap penjualan dicatat terbuka dan hasilnya disalurkan ke rekening Anda.
          </p>
          <div className="deret-tombol">
            <Link to="/daftar" className="tombol tombol-utama">
              Daftarkan usaha Anda
              <Ikon nama="panah-kanan" />
            </Link>
            <Link to="/status" className="tombol tombol-kedua">
              Cek status pendaftaran
            </Link>
          </div>
          {gedung.data && (
            <dl className="fakta">
              <div>
                <dt>Studio live</dt>
                <dd className="angka">{studio}</dd>
              </div>
              <div>
                <dt>Sesi hari ini</dt>
                <dd className="angka">{terjadwal}</dd>
              </div>
              <div>
                <dt>Sedang siaran</dt>
                <dd className="angka">
                  {siaran}
                  {siaran > 0 && <span className="on-air">ON AIR</span>}
                </dd>
              </div>
            </dl>
          )}
        </div>
        <div className="pahlawan-maket">
          {gedung.data ? (
            <Suspense fallback={<div className="gedung3d kosong-maket" />}>
              <Gedung3D
                ruangan={gedung.data.ruangan}
                sesi={gedung.data.sesi}
                identitas={{ nama: org?.nama ?? 'Pasuruan Creative Center', singkat: org?.singkat ?? 'PCC', naungan: org?.naungan ?? '' }}
                label={`Maket tiga dimensi gedung ${org?.nama ?? 'PCC'}`}
              />
            </Suspense>
          ) : (
            <div className="gedung3d kosong-maket">{gedung.galat && <p>Maket gedung belum bisa dimuat. Muat ulang halaman untuk mencoba lagi.</p>}</div>
          )}
        </div>
      </section>

      <section className="alur" aria-labelledby="judul-alur">
        <div className="alur-kepala">
          <h2 id="judul-alur">Lima langkah dari dapur Anda ke layar pembeli</h2>
          <p className="redup">Setiap langkah bisa Anda pantau lewat halaman Cek status dengan kode pendaftaran.</p>
        </div>
        <ol className="langkah">
          {LANGKAH.map(([judul, isi], i) => (
            <li key={judul}>
              <span className="nomor angka" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3>{judul}</h3>
              <p>{isi}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="siapkan" aria-labelledby="judul-siapkan">
        <div>
          <h2 id="judul-siapkan">Siapkan dokumen ini sebelum mendaftar</h2>
          <p className="redup">Berkas berupa PDF, JPG, atau PNG, masing-masing paling besar 5 MB. Foto yang jelas dari ponsel sudah cukup.</p>
        </div>
        <ul className="daftar-dokumen">
          {(info?.instansi ?? []).map((i) => (
            <li key={i.kunci}>
              <span className="tebal">{i.dokumen}</span>
              <span className="redup kecil">
                {i.instansi ? `Diterbitkan oleh ${i.instansi}. ` : ''}
                {i.wajib ? 'Wajib.' : 'Lampirkan bila produk Anda memerlukannya.'}
              </span>
            </li>
          ))}
          <li>
            <span className="tebal">Rekening bank atas nama usaha atau pemilik</span>
            <span className="redup kecil">Dipakai untuk menyalurkan hasil penjualan.</span>
          </li>
        </ul>
        <div className="siapkan-aksi">
          <Link to="/daftar" className="tautan-panah">
            Mulai pendaftaran
            <Ikon nama="panah-kanan" />
          </Link>
          {org?.whatsapp && (
            <a className="tautan-panah" href={tautanWa(org.whatsapp, 'Halo PCC, saya ingin bertanya tentang pendaftaran UMKM.')} target="_blank" rel="noopener noreferrer">
              Tanya lewat WhatsApp {tampilWa(org.whatsapp)}
              <Ikon nama="panah-kanan" />
            </a>
          )}
        </div>
      </section>
    </>
  );
}
