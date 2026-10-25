import { NavLink, Outlet, useLocation } from 'react-router';
import { useEffect } from 'react';
import { Merek } from '../../ui/Merek';
import { useInfo, useSesi } from '../../lib/konteks';
import { AKUN_PRATINJAU, PRATINJAU } from '../../lib/pratinjau';
import { tampilWa, tautanWa } from '../../../shared/format';

export function KerangkaPublik() {
  const { info } = useInfo();
  const { pengguna } = useSesi();
  const lokasi = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [lokasi.pathname]);
  const org = info?.organisasi;
  return (
    <div className="publik">
      <a href="#isi" className="lompat-isi">
        Lompat ke isi
      </a>
      {PRATINJAU ? (
        <div className="pita-demo">
          Pratinjau dengan data contoh. Untuk membuka ruang kerja, pilih Masuk lalu pakai {AKUN_PRATINJAU.email} dengan kata sandi {AKUN_PRATINJAU.sandi}.
        </div>
      ) : (
        info?.demo && <div className="pita-demo">Mode demo: semua data di sini adalah data contoh dan bukan data resmi.</div>
      )}
      <header className="kepala-publik">
        <Merek />
        <nav aria-label="Navigasi utama">
          <NavLink to="/daftar" className="sembunyi-hp">
            Daftarkan usaha
          </NavLink>
          <NavLink to="/status" className="sembunyi-hp">
            Cek status
          </NavLink>
          {pengguna ? (
            <NavLink to="/kelola" className="tombol tombol-kedua tombol-kecil">
              Buka ruang kerja
            </NavLink>
          ) : (
            <NavLink to="/masuk" className="tombol tombol-kedua tombol-kecil">
              Masuk petugas
            </NavLink>
          )}
        </nav>
      </header>
      <main id="isi" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="kaki-publik">
        <div>
          <p className="tebal" style={{ color: 'var(--arang)' }}>
            {org?.nama ?? 'Pasuruan Creative Center'}
          </p>
          {org?.alamat && <p>{org.alamat}</p>}
          {org?.jamLayanan && <p>Layanan {org.jamLayanan}</p>}
        </div>
        <div>
          {org?.whatsapp ? (
            <p>
              WhatsApp resmi{' '}
              <a href={tautanWa(org.whatsapp)} target="_blank" rel="noopener noreferrer">
                {tampilWa(org.whatsapp)}
              </a>
            </p>
          ) : (
            <p>Nomor WhatsApp resmi segera diumumkan.</p>
          )}
          {org?.email && (
            <p>
              Email <a href={`mailto:${org.email}`}>{org.email}</a>
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
