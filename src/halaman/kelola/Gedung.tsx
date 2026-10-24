import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { useInfo } from '../../lib/konteks';
import { useBerkala, useData } from '../../lib/data';
import { GalatMuat, KepalaHalaman, Memuat } from '../../ui/dasar';
import { Ikon } from '../../ui/Ikon';
import type { DataRuang } from '../../tiga/adegan';
import type { SesiRuang } from '../../tiga/Gedung3D';

const Gedung3D = lazy(() => import('../../tiga/Gedung3D'));

export function HalamanGedung() {
  const { info } = useInfo();
  const g = useData<{ ruangan: DataRuang[]; sesi: SesiRuang[] }>('/api/gedung');
  useBerkala(() => void g.muatUlang(), 20_000);
  const org = info?.organisasi;
  const siaran = g.data?.sesi.filter((s) => s.status === 'berlangsung').length ?? 0;
  return (
    <>
      <KepalaHalaman
        judul="Gedung"
        keterangan={
          siaran
            ? `${siaran} studio sedang siaran. Lampu ON AIR menyala di atas pintu studio yang dipakai.`
            : 'Tidak ada studio yang sedang siaran. Pilih ruangan untuk melihat jadwal hari ini.'
        }
      />
      {g.galat && !g.data && <GalatMuat galat={g.galat} ulang={g.muatUlang} />}
      {!g.data && !g.galat && <Memuat label="Memuat denah gedung" />}
      {g.data && (
        <Suspense fallback={<div className="gedung3d kosong-maket halaman-gedung" />}>
          <Gedung3D
            className="halaman-gedung"
            ruangan={g.data.ruangan}
            sesi={g.data.sesi}
            identitas={{ nama: org?.nama ?? 'Pasuruan Creative Center', singkat: org?.singkat ?? 'PCC', naungan: org?.naungan ?? '' }}
            aksiRuang={(r, st) =>
              r.jenis !== 'studio' ? null : st.berlangsung ? (
                <Link className="tautan-panah" to={`/kelola/live/${st.berlangsung.id}`}>
                  Buka sesi yang sedang siaran
                  <Ikon nama="panah-kanan" />
                </Link>
              ) : st.berikutnya ? (
                <Link className="tautan-panah" to={`/kelola/live/${st.berikutnya.id}`}>
                  Siapkan sesi berikutnya
                  <Ikon nama="panah-kanan" />
                </Link>
              ) : (
                <Link className="tautan-panah" to={`/kelola/live?baru=1&ruang=${r.id}`}>
                  Jadwalkan sesi di studio ini
                  <Ikon nama="panah-kanan" />
                </Link>
              )
            }
          />
        </Suspense>
      )}
      <p className="redup kecil" style={{ marginTop: 16 }}>
        Ukuran ruangan mengikuti data di Pengaturan. Denah diperbarui otomatis setiap kali data ruangan diubah.
      </p>
    </>
  );
}
