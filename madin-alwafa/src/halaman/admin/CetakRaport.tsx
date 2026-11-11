import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Printer, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useSesi } from '../../lib/sesi';
import type { DataRaport } from '../../lib/tipe';
import { Bilah, Pesan, Tombol, useJudul } from '../../ui/dasar';
import { LembarRaport } from '../raport/LembarRaport';
import type { DaftarRaport } from './Raport';

/** Semua raport satu kelas dalam satu halaman untuk dicetak sekaligus. */
export default function CetakRaport() {
  const { kelasId, periodeId } = useParams();
  const { pengurus } = useSesi();
  const navigasi = useNavigate();
  const [daftar, setDaftar] = useState<DataRaport[]>([]);
  const [total, setTotal] = useState(0);
  const [galat, setGalat] = useState('');
  const [kelas, setKelas] = useState('');
  useJudul(kelas ? `Cetak raport ${kelas}` : 'Cetak raport');

  useEffect(() => {
    if (!pengurus) return;
    let batal = false;
    (async () => {
      try {
        const d = await api<DaftarRaport>('GET', `/api/admin/raport?kelas=${kelasId}&periode=${periodeId}`);
        setKelas(d.kelas.nama);
        setTotal(d.daftar.length);
        const hasil: DataRaport[] = [];
        for (const s of d.daftar) {
          if (batal) return;
          hasil.push(await api<DataRaport>('GET', `/api/admin/raport/${s.santriId}/${periodeId}`));
          setDaftar([...hasil]);
        }
      } catch (e) {
        setGalat((e as Error).message);
      }
    })();
    return () => {
      batal = true;
    };
  }, [kelasId, periodeId, pengurus]);

  if (!pengurus) return <Navigate to="/" replace />;
  const selesai = total > 0 && daftar.length === total;
  const draf = daftar.filter((d) => d.status !== 'terbit').length;

  return (
    <div className="halaman-cetak">
      <div className="kaca kaca--rapat bilah-cetak">
        <div className="isi-penuh tumpuk tumpuk--rapat" style={{ gap: 6 }}>
          <b>
            Raport {kelas} · {daftar.length}/{total || '…'}
          </b>
          {!selesai && <Bilah persen={total ? (daftar.length / total) * 100 : 5} label="Raport yang sudah disiapkan untuk dicetak" />}
          {selesai && draf > 0 && <span className="kecil redup">{draf} raport masih draf dan dicetak dengan tanda DRAF.</span>}
        </div>
        <Tombol ikon={<X />} onClick={() => (window.opener ? window.close() : navigasi(-1))}>
          Tutup
        </Tombol>
        <Tombol varian="utama" ikon={<Printer />} onClick={() => window.print()} disabled={!selesai}>
          Cetak {total} raport
        </Tombol>
      </div>
      {galat && <Pesan jenis="bahaya">{galat}</Pesan>}
      <div className="area-cetak">
        <div className="tumpukan-lembar">
          {daftar.map((d) => (
            <LembarRaport key={d.santri.id} d={d} />
          ))}
        </div>
      </div>
    </div>
  );
}
