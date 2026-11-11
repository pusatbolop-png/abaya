import { useState } from 'react';
import { Printer, RefreshCcw } from 'lucide-react';
import { urlFoto, useSumberFoto } from '../lib/foto';
import { PRATINJAU } from '../lib/pratinjau';
import type { DataKartu } from '../lib/tipe';
import { KodeQr } from '../halaman/raport/KodeQr';
import { Lambang } from './Lambang';
import { Tombol } from './dasar';
import { inisial, tanggalPanjang } from '../../shared/format';

const kodeTampil = (k: string) => `${k.slice(0, 4)}-${k.slice(4, 8)}-${k.slice(8)}`;

function Depan({ d }: { d: DataKartu }) {
  const s = d.santri;
  const foto = useSumberFoto(urlFoto(s.id, s.fotoVersi));
  const qr = PRATINJAU ? `KARTU-${d.kode}` : `${d.alamatAplikasi}/kartu/${d.kode}`;
  const ttl = [s.tempatLahir, s.tanggalLahir && tanggalPanjang(s.tanggalLahir)].filter(Boolean).join(', ');
  return (
    <div className="kartu__sisi kartu__depan">
      <div className="kartu__pola" aria-hidden />
      <header className="kartu__kepala">
        <Lambang className="kartu__lambang" />
        <div className="kartu__lembaga">
          <span className="kartu__jenis">Kartu {s.jk === 'P' ? 'Santriwati' : 'Santri'}</span>
          <b>{d.lembaga.nama}</b>
          {d.lembaga.namaArab && (
            <span className="kartu__arab" lang="ar">
              {d.lembaga.namaArab}
            </span>
          )}
        </div>
      </header>
      <div className={`kartu__foto ${s.jk === 'P' ? 'kartu__foto--P' : ''}`}>{foto ? <img src={foto} alt={`Foto ${s.nama}`} /> : <span aria-hidden>{inisial(s.nama)}</span>}</div>
      <div className="kartu__identitas">
        <h3 className="kartu__nama">{s.nama}</h3>
        <div className="kartu__nis">
          <span>NIS {s.nis}</span>
          {s.kelas && <span>{s.kelas}</span>}
        </div>
      </div>
      <dl className="kartu__data">
        {ttl && (
          <>
            <dt>Lahir</dt>
            <dd>{ttl}</dd>
          </>
        )}
        {s.wali && (
          <>
            <dt>Wali</dt>
            <dd>{s.wali}</dd>
          </>
        )}
        {s.alamat && (
          <>
            <dt>Alamat</dt>
            <dd>{s.alamat}</dd>
          </>
        )}
      </dl>
      <footer className="kartu__kaki">
        <div className="kartu__qr">
          <KodeQr teks={qr} warna="#073b3b" />
        </div>
        <div className="kartu__berlaku">
          <span>Berlaku</span>
          <b>{d.berlaku}</b>
          <span className="kartu__kode">{kodeTampil(d.kode)}</span>
        </div>
      </footer>
    </div>
  );
}

export function Belakang({ d }: { d: Pick<DataKartu, 'aturan' | 'lembaga'> }) {
  let nomor = 0;
  return (
    <div className="kartu__sisi kartu__belakang">
      <header className="kartu__kepala-belakang">
        <Lambang className="kartu__lambang-kecil" />
        <div>
          <b>Tata Tertib Santri</b>
          <span className="kartu__arab" lang="ar">
            آداب طالب العلم
          </span>
        </div>
      </header>
      <div className="kartu__aturan">
        {d.aturan.map((b, i) => (
          <section key={i}>
            {b.judul && <h4>{b.judul}</h4>}
            <ol start={nomor + 1}>
              {b.butir.map((t, j) => {
                nomor++;
                return <li key={j}>{t}</li>;
              })}
            </ol>
          </section>
        ))}
      </div>
      <footer className="kartu__kaki-belakang">
        <div className="kartu__ttd">
          <span>Kepala Madrasah</span>
          <b>{d.lembaga.kepala || '……………………'}</b>
        </div>
        <p>
          Bila menemukan kartu ini, mohon kembalikan ke {d.lembaga.singkatan}
          {d.lembaga.alamat && `, ${d.lembaga.alamat}`}
          {d.lembaga.telepon && ` · ${d.lembaga.telepon}`}.
        </p>
      </footer>
    </div>
  );
}

/** Kartu santri digital yang bisa dibalik (sentuh/klik) dan dicetak seukuran kartu ATM. */
export function KartuSantri({ d }: { d: DataKartu }) {
  const [balik, setBalik] = useState(false);
  const [cetak, setCetak] = useState(false);
  const cetakKartu = () => {
    setCetak(true);
    setTimeout(() => {
      window.print();
      setCetak(false);
    }, 300);
  };
  return (
    <div className="kartu-santri">
      {/* Sentuh kartu untuk membaliknya; pengguna papan ketik memakai tombol di bawah. */}
      <div className={`kartu-balik ${balik ? 'kartu-balik--belakang' : ''}`} onClick={() => setBalik(!balik)} title="Ketuk untuk membalik kartu">
        <div className="kartu-balik__isi">
          <div className="kartu kartu--depan-wadah" aria-hidden={balik}>
            <Depan d={d} />
          </div>
          <div className="kartu kartu--belakang-wadah" aria-hidden={!balik}>
            <Belakang d={d} />
          </div>
        </div>
      </div>
      <div className="baris baris--bungkus kartu-santri__aksi">
        <Tombol ikon={<RefreshCcw />} onClick={() => setBalik(!balik)}>
          {balik ? 'Lihat depan' : 'Lihat tata tertib'}
        </Tombol>
        <Tombol varian="utama" ikon={<Printer />} onClick={cetakKartu}>
          Cetak kartu
        </Tombol>
      </div>
      <p className="redup-2 kecil kartu-santri__catatan">
        Kartu dicetak seukuran kartu ATM (54 × 85,6 mm), depan dan belakang. Gunting di garis tepi lalu laminasi.
      </p>
      {cetak && (
        <div className="area-cetak cetak-kartu">
          <div className="cetak-kartu__baris">
            <div className="kartu kartu--cetak">
              <Depan d={d} />
            </div>
            <div className="kartu kartu--cetak">
              <Belakang d={d} />
            </div>
          </div>
          <p className="cetak-kartu__catatan">
            Kartu santri {d.santri.nama} · {d.lembaga.nama} · kode {kodeTampil(d.kode)}
          </p>
        </div>
      )}
    </div>
  );
}
