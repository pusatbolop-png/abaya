import { FlaskConical } from 'lucide-react';
import { useSesi } from '../lib/sesi';

export function PitaDemo() {
  const { lembaga } = useSesi();
  if (!lembaga.demo) return null;
  return (
    <div className="pita-demo">
      <FlaskConical />
      <span>
        Mode demo<span className="sembunyi-ponsel">: semua nama dan angka adalah data contoh.</span>
        <span className="tampil-ponsel"> · data contoh</span>
      </span>
    </div>
  );
}
