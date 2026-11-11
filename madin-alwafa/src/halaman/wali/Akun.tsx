import { useState } from 'react';
import { MapPin, Save } from 'lucide-react';
import { kirim } from '../../lib/api';
import { urlFoto } from '../../lib/foto';
import { useKirim, usePakai } from '../../lib/pakai';
import { useToast } from '../../lib/toast';
import type { Santri } from '../../lib/tipe';
import { Avatar, KepalaHalaman, LencanaJk, Memuat, Modal, Tombol, useJudul } from '../../ui/dasar';
import { GantiSandi } from '../../ui/GantiSandi';
import { ALAMAT_KOSONG, IsianAlamat, type Alamat } from '../../ui/IsianAlamat';
import { alamatLengkap, tanggalPanjang } from '../../../shared/format';

export default function AkunWali() {
  useJudul('Akun');
  const { data, muatUlang } = usePakai<{ santri: Santri & { waliKelas: string | null } }>('/api/wali/profil');
  const [ubahAlamat, setUbahAlamat] = useState(false);
  const s = data?.santri;
  return (
    <>
      <KepalaHalaman kecil="Akun" judul="Akun & profil" sub="Data ananda tercatat di madrasah. Alamat bisa Anda perbarui sendiri; data lain hubungi madrasah." />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="kaca kaca--pad">
          {!s ? (
            <Memuat baris={4} tinggi={30} />
          ) : (
            <div className="tumpuk">
              <div className="baris" style={{ gap: 14 }}>
                <Avatar nama={s.nama} jk={s.jk} ukuran={60} foto={urlFoto(s.id, s.fotoVersi)} />
                <div className="tumpuk tumpuk--rapat" style={{ gap: 4 }}>
                  <b style={{ fontSize: 18 }}>{s.nama}</b>
                  <LencanaJk jk={s.jk} />
                </div>
              </div>
              <dl className="daftar-data">
                <dt>NIS</dt>
                <dd className="angka">{s.nis}</dd>
                <dt>Kelas</dt>
                <dd>{s.kelasNama ?? '–'}</dd>
                <dt>Wali kelas</dt>
                <dd>{s.waliKelas ?? '–'}</dd>
                <dt>Tempat, tanggal lahir</dt>
                <dd>{[s.tempatLahir, s.tanggalLahir && tanggalPanjang(s.tanggalLahir)].filter(Boolean).join(', ') || '–'}</dd>
                <dt>Alamat</dt>
                <dd>
                  {alamatLengkap(s) || '–'}
                  <div style={{ marginTop: 6 }}>
                    <Tombol ukuran="kecil" ikon={<MapPin />} onClick={() => setUbahAlamat(true)}>
                      Perbarui alamat
                    </Tombol>
                  </div>
                </dd>
                <dt>Ayah</dt>
                <dd>{s.namaAyah ?? '–'}</dd>
                <dt>Ibu</dt>
                <dd>{s.namaIbu ?? '–'}</dd>
                <dt>HP wali</dt>
                <dd className="angka">{s.hpWali ?? '–'}</dd>
              </dl>
            </div>
          )}
        </section>
        <section className="kaca kaca--pad">
          <div className="kartu-judul">
            <h2>Ganti sandi</h2>
          </div>
          <GantiSandi />
        </section>
      </div>
      {ubahAlamat && s && (
        <UbahAlamat
          awal={{
            alamat: s.alamat ?? '',
            desa: s.desa ?? '',
            kecamatan: s.kecamatan ?? '',
            kabupaten: s.kabupaten ?? '',
            provinsi: s.provinsi ?? '',
            kodeWilayah: s.kodeWilayah ?? '',
          }}
          tutup={() => setUbahAlamat(false)}
          selesai={() => {
            setUbahAlamat(false);
            muatUlang();
          }}
        />
      )}
    </>
  );
}

function UbahAlamat({ awal, tutup, selesai }: { awal: Alamat; tutup: () => void; selesai: () => void }) {
  const toast = useToast();
  const { sibuk, bidang, jalankan } = useKirim();
  const [a, setA] = useState<Alamat>({ ...ALAMAT_KOSONG, ...awal });
  const simpan = () =>
    jalankan(async () => {
      await kirim('PUT', '/api/wali/kontak', a);
      toast.tampil('Alamat diperbarui.');
      selesai();
    }).catch(toast.galat);
  return (
    <Modal
      judul="Perbarui alamat"
      sub="Ketik kecamatan, lalu pilih dari daftar. Kabupaten/kota dan provinsi terisi otomatis."
      tutup={tutup}
      onSubmit={simpan}
      kaki={
        <Tombol type="submit" varian="utama" ikon={<Save />} sibuk={sibuk}>
          Simpan alamat
        </Tombol>
      }
    >
      <IsianAlamat nilai={a} ubah={setA} galat={bidang} />
    </Modal>
  );
}
