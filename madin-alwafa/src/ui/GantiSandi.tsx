import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { GalatApi, kirim } from '../lib/api';
import { useKirim } from '../lib/pakai';
import { useSesi } from '../lib/sesi';
import { useToast } from '../lib/toast';
import { Bidang, Tombol } from './dasar';

export function GantiSandi() {
  const toast = useToast();
  const { muatUlang } = useSesi();
  const { sibuk, bidang, setBidang, jalankan } = useKirim();
  const [f, setF] = useState({ lama: '', baru: '', ulang: '' });
  const simpan = () =>
    jalankan(async () => {
      if (f.baru !== f.ulang) {
        setBidang({ ulang: 'Tidak sama dengan sandi baru.' });
        throw new GalatApi(400, 'Ketik ulang sandi baru dengan sama persis.');
      }
      await kirim('POST', '/api/auth/ganti-sandi', { lama: f.lama, baru: f.baru });
      setF({ lama: '', baru: '', ulang: '' });
      toast.tampil('Sandi diganti. Perangkat lain yang memakai akun ini sudah dikeluarkan.');
      muatUlang();
    }).catch((e) => {
      if (e instanceof GalatApi && e.message.includes('sama persis')) setBidang({ ulang: 'Tidak sama dengan sandi baru.' });
      toast.galat(e);
    });
  return (
    <form
      className="tumpuk"
      onSubmit={(e) => {
        e.preventDefault();
        simpan();
      }}
    >
      <Bidang label="Sandi saat ini" wajib galat={bidang.lama}>
        <input className="masukan" type="password" value={f.lama} onChange={(e) => setF({ ...f, lama: e.target.value })} autoComplete="current-password" required />
      </Bidang>
      <Bidang label="Sandi baru" wajib galat={bidang.baru} bantu="Paling sedikit 8 karakter. Gabungkan huruf dan angka agar sulit ditebak.">
        <input className="masukan" type="password" value={f.baru} onChange={(e) => setF({ ...f, baru: e.target.value })} autoComplete="new-password" minLength={8} required />
      </Bidang>
      <Bidang label="Ketik ulang sandi baru" wajib galat={bidang.ulang}>
        <input className="masukan" type="password" value={f.ulang} onChange={(e) => setF({ ...f, ulang: e.target.value })} autoComplete="new-password" required />
      </Bidang>
      <div>
        <Tombol type="submit" varian="utama" ikon={<KeyRound />} sibuk={sibuk}>
          Ganti sandi
        </Tombol>
      </div>
    </form>
  );
}
