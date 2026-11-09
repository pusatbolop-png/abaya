import { usePakai } from '../../lib/pakai';
import type { Santri } from '../../lib/tipe';
import { Avatar, KepalaHalaman, LencanaJk, Memuat, useJudul } from '../../ui/dasar';
import { GantiSandi } from '../../ui/GantiSandi';
import { tanggalPanjang } from '../../../shared/format';

export default function AkunWali() {
  useJudul('Akun');
  const { data } = usePakai<{ santri: Santri & { waliKelas: string | null } }>('/api/wali/profil');
  const s = data?.santri;
  return (
    <>
      <KepalaHalaman kecil="Akun" judul="Akun & profil" sub="Data ananda tercatat di madrasah. Bila ada yang keliru, hubungi pengurus madrasah." />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="kaca kaca--pad">
          {!s ? (
            <Memuat baris={4} tinggi={30} />
          ) : (
            <div className="tumpuk">
              <div className="baris" style={{ gap: 14 }}>
                <Avatar nama={s.nama} jk={s.jk} ukuran={60} />
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
                <dd>{s.alamat ?? '–'}</dd>
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
    </>
  );
}
