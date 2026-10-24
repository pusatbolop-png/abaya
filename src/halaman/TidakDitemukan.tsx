import { Link } from 'react-router';
import { useJudul } from '../ui/dasar';

export function TidakDitemukan({ publik }: { publik?: boolean }) {
  useJudul('Halaman tidak ditemukan');
  return (
    <div className={publik ? 'halaman-sempit' : undefined} style={{ paddingTop: publik ? 96 : 0 }}>
      <h1>Halaman ini tidak ditemukan</h1>
      <p className="redup" style={{ margin: '12px 0 24px' }}>
        Tautannya mungkin keliru atau halaman sudah dipindahkan.
      </p>
      <Link to={publik ? '/' : '/kelola'} className="tombol tombol-kedua">
        {publik ? 'Kembali ke beranda' : 'Kembali ke ringkasan'}
      </Link>
    </div>
  );
}
