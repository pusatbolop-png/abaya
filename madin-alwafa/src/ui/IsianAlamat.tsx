import { useEffect, useId, useRef, useState } from 'react';
import { CircleCheck, MapPin } from 'lucide-react';
import { cariKecamatan, muatWilayah, type Kecamatan } from '../lib/wilayah';
import { Bidang } from './dasar';

export interface Alamat {
  alamat: string;
  desa: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  kodeWilayah: string;
}
export const ALAMAT_KOSONG: Alamat = { alamat: '', desa: '', kecamatan: '', kabupaten: '', provinsi: '', kodeWilayah: '' };

/** Isian alamat: ketik kecamatan, kabupaten/kota dan provinsi terisi otomatis. */
export function IsianAlamat({
  nilai,
  ubah,
  galat = {},
  wajibKecamatan,
}: {
  nilai: Alamat;
  ubah: (a: Alamat) => void;
  galat?: Partial<Record<keyof Alamat, string>>;
  wajibKecamatan?: boolean;
}) {
  const id = useId();
  const [data, setData] = useState<Kecamatan[] | null>(null);
  const [buka, setBuka] = useState(false);
  const [aktif, setAktif] = useState(0);
  const kotak = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let batal = false;
    muatWilayah().then((d) => !batal && setData(d));
    return () => {
      batal = true;
    };
  }, []);

  const saran = data && buka ? cariKecamatan(data, nilai.kecamatan) : [];
  const terpilih = !!nilai.kodeWilayah;

  const pilih = (k: Kecamatan) => {
    ubah({ ...nilai, kecamatan: k.kecamatan, kabupaten: k.kabupaten, provinsi: k.provinsi, kodeWilayah: k.kode });
    setBuka(false);
  };

  useEffect(() => {
    const klik = (e: MouseEvent) => {
      if (!kotak.current?.contains(e.target as Node)) setBuka(false);
    };
    document.addEventListener('mousedown', klik);
    return () => document.removeEventListener('mousedown', klik);
  }, []);

  return (
    <div className="isian-alamat">
      <Bidang label="Jalan / dusun, RT/RW" galat={galat.alamat} className="bentang-2">
        <input className="masukan" value={nilai.alamat} onChange={(e) => ubah({ ...nilai, alamat: e.target.value })} placeholder="Mis. Dusun Krajan RT 02/RW 01" autoComplete="street-address" />
      </Bidang>
      <Bidang label="Desa / kelurahan" galat={galat.desa}>
        <input className="masukan" value={nilai.desa} onChange={(e) => ubah({ ...nilai, desa: e.target.value })} placeholder="Mis. Kalirejo" />
      </Bidang>
      <div className="bidang isian-alamat__kecamatan" ref={kotak}>
        <label className="bidang__bungkus" htmlFor={`${id}-kec`}>
          <span className="bidang__label">
            Kecamatan{wajibKecamatan && <span className="wajib" aria-hidden>*</span>}
          </span>
        </label>
        <div className="isian-alamat__kotak">
        <div className="masukan-ikon">
          <MapPin />
          <input
            id={`${id}-kec`}
            className="masukan"
            role="combobox"
            aria-expanded={saran.length > 0}
            aria-controls={`${id}-daftar`}
            aria-autocomplete="list"
            aria-activedescendant={saran.length ? `${id}-s${aktif}` : undefined}
            aria-invalid={galat.kecamatan ? true : undefined}
            aria-describedby={`${id}-bantu`}
            value={nilai.kecamatan}
            placeholder={data ? 'Ketik nama kecamatan' : 'Memuat data wilayah…'}
            autoComplete="off"
            required={wajibKecamatan}
            onFocus={() => setBuka(true)}
            onChange={(e) => {
              // Kecamatan diubah manual: kabupaten dan provinsi dikosongkan sampai dipilih lagi.
              ubah({ ...nilai, kecamatan: e.target.value, kabupaten: '', provinsi: '', kodeWilayah: '' });
              setBuka(true);
              setAktif(0);
            }}
            onKeyDown={(e) => {
              if (!saran.length) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setAktif((a) => (a + 1) % saran.length);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setAktif((a) => (a - 1 + saran.length) % saran.length);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                pilih(saran[Math.min(aktif, saran.length - 1)]);
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                setBuka(false);
              }
            }}
          />
        </div>
        {saran.length > 0 && (
          <ul className="saran-wilayah" id={`${id}-daftar`} role="listbox" aria-label="Pilihan kecamatan">
            {saran.map((k, i) => (
              <li
                key={k.kode}
                id={`${id}-s${i}`}
                role="option"
                aria-selected={i === aktif}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pilih(k);
                }}
                onMouseEnter={() => setAktif(i)}
              >
                <b>{k.kecamatan}</b>
                <span>
                  {k.kabupaten}, {k.provinsi}
                </span>
              </li>
            ))}
          </ul>
        )}
        </div>
        {galat.kecamatan ? (
          <span className="bidang__galat" id={`${id}-bantu`} role="alert">
            {galat.kecamatan}
          </span>
        ) : (
          <span className="bidang__bantu" id={`${id}-bantu`}>
            {terpilih ? 'Kabupaten/kota dan provinsi terisi otomatis.' : 'Pilih dari daftar agar kabupaten/kota dan provinsi terisi otomatis.'}
          </span>
        )}
      </div>
      {(['kabupaten', 'provinsi'] as const).map((k) => (
        <div key={k} className="bidang">
          <label className="bidang__bungkus">
            <span className="bidang__label">{k === 'kabupaten' ? 'Kabupaten / kota' : 'Provinsi'}</span>
            <span className={`masukan-otomatis ${terpilih ? 'terisi' : ''}`}>
              <input className="masukan" readOnly tabIndex={-1} value={nilai[k]} placeholder="Terisi otomatis" />
              {terpilih && <CircleCheck aria-hidden />}
            </span>
          </label>
        </div>
      ))}
    </div>
  );
}
