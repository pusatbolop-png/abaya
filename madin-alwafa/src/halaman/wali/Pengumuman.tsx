import { Megaphone, Star } from 'lucide-react';
import { usePakai } from '../../lib/pakai';
import type { Pengumuman } from '../../lib/tipe';
import { GalatMuat, KepalaHalaman, Kosong, Lencana, Memuat, useJudul } from '../../ui/dasar';
import { waktu } from '../../../shared/format';

export default function PengumumanWali() {
  useJudul('Pengumuman');
  const { data, galat, muatUlang } = usePakai<{ daftar: Pengumuman[] }>('/api/wali/pengumuman');
  return (
    <>
      <KepalaHalaman kecil="الإعلانات" judul="Pengumuman" sub="Kabar dan informasi dari madrasah untuk wali santri." />
      {galat ? (
        <GalatMuat galat={galat} ulang={muatUlang} />
      ) : !data ? (
        <Memuat baris={3} tinggi={110} />
      ) : !data.daftar.length ? (
        <div className="kaca">
          <Kosong ikon={<Megaphone />} judul="Belum ada pengumuman" />
        </div>
      ) : (
        <div className="tumpuk">
          {data.daftar.map((p) => (
            <article key={p.id} className={`kaca kaca--pad ${p.penting ? 'kaca--emas' : ''}`}>
              {!!p.penting && (
                <div style={{ marginBottom: 8 }}>
                  <Lencana jenis="emas">
                    <Star /> Penting
                  </Lencana>
                </div>
              )}
              <h2 style={{ fontSize: 19 }}>{p.judul}</h2>
              <p className="redup" style={{ whiteSpace: 'pre-line', marginTop: 8 }}>
                {p.isi}
              </p>
              <div className="redup-2 kecil" style={{ marginTop: 12 }}>
                {waktu(p.terbit)} WIB
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
