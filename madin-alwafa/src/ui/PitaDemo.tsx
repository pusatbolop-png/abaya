import { Link } from 'react-router';
import { FlaskConical } from 'lucide-react';
import { useSesi } from '../lib/sesi';
import { PRATINJAU } from '../lib/pratinjau';

/** Pita mode demo. Hanya pada mode demo (bukan aplikasi sungguhan) ada pintasan ke halaman masuk guru dan pengurus. */
export function PitaDemo() {
  const { lembaga, pengurus, wali } = useSesi();
  if (!lembaga.demo) return null;
  return (
    <div className="pita-demo">
      <FlaskConical />
      <span>
        {PRATINJAU ? 'Pratinjau' : 'Mode demo'}
        <span className="sembunyi-ponsel">{PRATINJAU ? ': data contoh, perubahan hilang saat dimuat ulang.' : ': data contoh.'}</span>
        {!pengurus && !wali && (
          <span className="pita-demo__pintu">
            {' '}
            · Coba masuk sebagai <Link to="/">wali</Link> · <Link to="/guru">guru</Link> · <Link to="/pengurus">pengurus</Link>
          </span>
        )}
      </span>
    </div>
  );
}
