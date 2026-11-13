import { FlaskConical } from 'lucide-react';
import { useSesi } from '../lib/sesi';
import { PRATINJAU } from '../lib/pratinjau';

/** Pita mode demo: penanda bahwa data yang tampil hanyalah contoh. */
export function PitaDemo() {
  const { lembaga } = useSesi();
  if (!lembaga.demo) return null;
  return (
    <div className="pita-demo">
      <FlaskConical />
      <span>
        {PRATINJAU ? 'Pratinjau' : 'Mode demo'}
        <span className="sembunyi-ponsel">{PRATINJAU ? ': data contoh, perubahan hilang saat dimuat ulang.' : ': data contoh.'}</span>
      </span>
    </div>
  );
}
