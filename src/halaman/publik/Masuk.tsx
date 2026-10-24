import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { useInfo, useSesi, type Pengguna } from '../../lib/konteks';
import { Bidang, Masukan, Pemberitahuan, Tombol, useJudul, useKirim } from '../../ui/dasar';

export function Masuk() {
  useJudul('Masuk');
  const { pengguna, siap, setPengguna } = useSesi();
  const { info } = useInfo();
  const [cari] = useSearchParams();
  const navigasi = useNavigate();
  const [email, setEmail] = useState('');
  const [sandi, setSandi] = useState('');
  const { sibuk, galat, bidang, kirim, atur } = useKirim();
  const ke = cari.get('ke')?.startsWith('/kelola') ? cari.get('ke')! : '/kelola';

  if (info?.perluSetup) return <Navigate to="/siapkan" replace />;
  if (siap && pengguna) return <Navigate to={ke} replace />;

  const masuk = async (e: FormEvent) => {
    e.preventDefault();
    const g: Record<string, string> = {};
    if (!email.trim()) g.email = 'Isi email akun Anda.';
    if (!sandi) g.sandi = 'Isi kata sandi.';
    if (Object.keys(g).length) return atur('Lengkapi email dan kata sandi.', g);
    const r = await kirim(() => api<{ pengguna: Pengguna }>('POST', '/api/auth/masuk', { email, sandi }));
    if (r) {
      setPengguna(r.pengguna);
      navigasi(ke, { replace: true });
    }
  };

  return (
    <div className="halaman-sempit halaman-masuk">
      <h1>Masuk ruang kerja</h1>
      <p className="redup pengantar-kecil">Khusus petugas dan administrator {info?.organisasi.singkat ?? 'PCC'}.</p>
      {cari.get('habis') && <Pemberitahuan nada="tunggu">Sesi Anda sudah berakhir. Masuk kembali untuk melanjutkan pekerjaan.</Pemberitahuan>}
      <form className="formulir-ringkas" onSubmit={masuk} noValidate>
        {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
        <Bidang label="Email" galat={bidang.email}>
          {(a) => <Masukan {...a} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Bidang>
        <Bidang label="Kata sandi" galat={bidang.sandi}>
          {(a) => <Masukan {...a} type="password" autoComplete="current-password" value={sandi} onChange={(e) => setSandi(e.target.value)} />}
        </Bidang>
        <div>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            Masuk
          </Tombol>
        </div>
        <p className="redup kecil">Lupa kata sandi? Minta administrator PCC mengatur ulang dari menu Pengaturan.</p>
      </form>
    </div>
  );
}

export function Siapkan() {
  useJudul('Siapkan akun administrator');
  const { info, muatUlang } = useInfo();
  const { setPengguna } = useSesi();
  const navigasi = useNavigate();
  const [d, setD] = useState({ nama: '', email: '', sandi: '' });
  const { sibuk, galat, bidang, kirim, atur } = useKirim();

  useEffect(() => {
    if (info && !info.perluSetup) navigasi('/masuk', { replace: true });
  }, [info, navigasi]);

  const simpan = async (e: FormEvent) => {
    e.preventDefault();
    const g: Record<string, string> = {};
    if (!d.nama.trim()) g.nama = 'Isi nama Anda.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) g.email = 'Alamat email tidak valid.';
    if (d.sandi.length < 10) g.sandi = 'Kata sandi minimal 10 karakter.';
    else if (!/[A-Za-z]/.test(d.sandi) || !/\d/.test(d.sandi)) g.sandi = 'Gabungkan huruf dan angka agar kata sandi lebih kuat.';
    if (Object.keys(g).length) return atur('Ada isian yang perlu diperbaiki.', g);
    const r = await kirim(() => api<{ pengguna: Pengguna }>('POST', '/api/auth/siapkan', d));
    if (r) {
      setPengguna(r.pengguna);
      navigasi('/kelola/pengaturan', { replace: true });
      void muatUlang();
    }
  };

  return (
    <div className="halaman-sempit halaman-masuk">
      <h1>Siapkan akun administrator</h1>
      <p className="redup pengantar-kecil">
        Sistem ini belum punya pengguna. Akun pertama menjadi administrator dan bisa menambahkan petugas lain.
      </p>
      <form className="formulir-ringkas" onSubmit={simpan} noValidate>
        {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
        <Bidang label="Nama lengkap" galat={bidang.nama}>
          {(a) => <Masukan {...a} autoComplete="name" value={d.nama} onChange={(e) => setD({ ...d, nama: e.target.value })} />}
        </Bidang>
        <Bidang label="Email dinas" galat={bidang.email}>
          {(a) => <Masukan {...a} type="email" autoComplete="username" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />}
        </Bidang>
        <Bidang label="Kata sandi" galat={bidang.sandi} petunjuk="Minimal 10 karakter, gabungan huruf dan angka.">
          {(a) => <Masukan {...a} type="password" autoComplete="new-password" value={d.sandi} onChange={(e) => setD({ ...d, sandi: e.target.value })} />}
        </Bidang>
        <div>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            Buat akun administrator
          </Tombol>
        </div>
      </form>
    </div>
  );
}
