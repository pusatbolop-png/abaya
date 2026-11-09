import { FlaskConical } from 'lucide-react';
import { useSesi } from '../lib/sesi';
import { PRATINJAU } from '../lib/pratinjau';

export function PitaDemo() {
  const { lembaga } = useSesi();
  if (!lembaga.demo) return null;
  return (
    <div className="pita-demo">
      <FlaskConical />
      <span>
        {PRATINJAU ? 'Pratinjau' : 'Mode demo'}
        <span className="sembunyi-ponsel">
          {PRATINJAU ? ': data contoh, berjalan di peramban Anda. Perubahan hilang saat halaman dimuat ulang.' : ': semua nama dan angka adalah data contoh.'}
        </span>
        <span className="tampil-ponsel"> · data contoh</span>
      </span>
    </div>
  );
}
