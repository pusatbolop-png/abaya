import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { GalatApi, kirim } from '../../lib/api';
import { useKirim } from '../../lib/pakai';
import { useSesi } from '../../lib/sesi';
import { useToast } from '../../lib/toast';
import { Bidang, Tombol, useJudul } from '../../ui/dasar';
import { Lambang } from '../../ui/Lambang';

export default function Pasang() {
  useJudul('Pemasangan pertama');
  const { perluPasang, muatUlang, lembaga } = useSesi();
  const navigasi = useNavigate();
  const toast = useToast();
  const { sibuk, bidang, jalankan } = useKirim();
  const [f, setF] = useState({ nama: '', username: 'admin', sandi: '', ulang: '' });
  if (!perluPasang) return <Navigate to="/" replace />;

  const simpan = () =>
    jalankan(async () => {
      if (f.sandi !== f.ulang) throw new GalatApi(400, 'Ketik ulang sandi dengan sama persis.');
      await kirim('POST', '/api/auth/pasang', { nama: f.nama, username: f.username, sandi: f.sandi });
      await muatUlang();
      toast.tampil('Akun administrator dibuat. Lengkapi data madrasah di Pengaturan.');
      navigasi('/admin/pengaturan', { replace: true });
    }).catch((e) => toast.galat(e));

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <form
        className="kaca kaca--emas kaca--pad tumpuk"
        style={{ width: 'min(480px, 100%)', gap: 18 }}
        onSubmit={(e) => {
          e.preventDefault();
          simpan();
        }}
      >
        <div className="baris" style={{ gap: 14 }}>
          <Lambang className="merek__lambang" />
          <div>
            <div className="mikro redup-2">Pemasangan pertama</div>
            <h1 className="judul-hias" style={{ fontSize: 30 }}>
              {lembaga.singkatan}
            </h1>
          </div>
        </div>
        <p className="redup kecil">Buat akun administrator. Akun ini mengelola data santri, kelas, nilai, raport, dan akun pengurus lainnya.</p>
        <Bidang label="Nama lengkap" wajib galat={bidang.nama}>
          <input className="masukan" value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} placeholder="Mis. Ust. Ahmad Fauzi" required />
        </Bidang>
        <Bidang label="Nama pengguna" wajib galat={bidang.username}>
          <input className="masukan" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoCapitalize="none" required />
        </Bidang>
        <Bidang label="Sandi" wajib galat={bidang.sandi} bantu="Paling sedikit 8 karakter.">
          <input className="masukan" type="password" value={f.sandi} onChange={(e) => setF({ ...f, sandi: e.target.value })} autoComplete="new-password" required />
        </Bidang>
        <Bidang label="Ketik ulang sandi" wajib>
          <input className="masukan" type="password" value={f.ulang} onChange={(e) => setF({ ...f, ulang: e.target.value })} autoComplete="new-password" required />
        </Bidang>
        <Tombol type="submit" varian="utama" ukuran="besar" penuh sibuk={sibuk} ikon={<ShieldCheck />}>
          Buat akun administrator
        </Tombol>
      </form>
    </main>
  );
}
