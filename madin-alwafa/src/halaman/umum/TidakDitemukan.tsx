import { Compass } from 'lucide-react';
import { Kosong, TautanTombol, useJudul } from '../../ui/dasar';

export function TidakDitemukan() {
  useJudul('Halaman tidak ditemukan');
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="kaca kaca--pad" style={{ maxWidth: 460 }}>
        <Kosong
          ikon={<Compass />}
          judul="Halaman tidak ditemukan"
          pesan="Alamat yang Anda buka tidak ada atau sudah dipindahkan."
          aksi={<TautanTombol to="/" varian="utama">Kembali ke beranda</TautanTombol>}
        />
      </div>
    </div>
  );
}
