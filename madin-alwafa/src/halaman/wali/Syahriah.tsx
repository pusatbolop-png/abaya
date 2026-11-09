import { useState } from 'react';
import { Check, Clock, Wallet } from 'lucide-react';
import { usePakai } from '../../lib/pakai';
import { GalatMuat, KepalaHalaman, Kosong, Memuat, Stat, useJudul } from '../../ui/dasar';
import { METODE_BAYAR } from '../../../shared/konstanta';
import { namaBulan, rupiah, tanggalPendek } from '../../../shared/format';

interface Data {
  tahunAjaran: string | null;
  pilihan: string[];
  nominal: number;
  bulanIni: string;
  bulan: { bulan: string; bayar: { nominal: number; tanggal: string; metode: keyof typeof METODE_BAYAR } | null }[];
}

export default function SyahriahWali() {
  useJudul('Syahriah');
  const [ta, setTa] = useState('');
  const { data, galat, muatUlang } = usePakai<Data>(`/api/wali/syahriah${ta ? `?tahunAjaran=${encodeURIComponent(ta)}` : ''}`);
  const lunas = data?.bulan.filter((b) => b.bayar) ?? [];
  const lewat = data?.bulan.filter((b) => b.bulan <= data.bulanIni) ?? [];
  const tunggak = lewat.filter((b) => !b.bayar);
  return (
    <>
      <KepalaHalaman
        kecil="Iuran bulanan"
        judul="Syahriah"
        sub="Status pembayaran syahriah setiap bulan. Pembayaran dicatat oleh pengurus madrasah."
        aksi={
          data &&
          data.pilihan.length > 1 && (
            <select className="masukan" value={data.tahunAjaran ?? ''} onChange={(e) => setTa(e.target.value)} aria-label="Tahun ajaran">
              {data.pilihan.map((p) => (
                <option key={p} value={p}>
                  Tahun ajaran {p}
                </option>
              ))}
            </select>
          )
        }
      />
      {galat ? (
        <GalatMuat galat={galat} ulang={muatUlang} />
      ) : !data ? (
        <Memuat baris={3} />
      ) : !data.tahunAjaran ? (
        <div className="kaca">
          <Kosong ikon={<Wallet />} judul="Belum ada tahun ajaran" />
        </div>
      ) : (
        <>
          <div className="grid-3">
            <Stat ikon={<Check />} label="Bulan lunas" nilai={`${lunas.length}/12`} sub={`Tahun ajaran ${data.tahunAjaran}`} emas />
            <Stat ikon={<Wallet />} label="Total dibayar" nilai={rupiah(lunas.reduce((s, b) => s + (b.bayar?.nominal ?? 0), 0))} sub={data.nominal ? `Iuran ${rupiah(data.nominal)}/bulan` : undefined} />
            <Stat ikon={<Clock />} label="Belum tercatat" nilai={tunggak.length} sub={tunggak.length ? tunggak.map((b) => namaBulan(b.bulan).split(' ')[0]).join(', ') : 'Semua bulan berjalan lunas'} />
          </div>
          <div className="grid-bulan">
            {data.bulan.map((b) => {
              const akanDatang = b.bulan > data.bulanIni;
              return (
                <div key={b.bulan} className={`kaca kartu-bulan ${b.bayar ? 'kartu-bulan--lunas' : akanDatang ? 'kartu-bulan--nanti' : 'kartu-bulan--tunggak'}`}>
                  <div className="baris baris--antara">
                    <b>{namaBulan(b.bulan)}</b>
                    {b.bayar ? <Check style={{ width: 18, color: 'var(--ok)' }} /> : !akanDatang && <Clock style={{ width: 18, color: 'var(--waspada)' }} />}
                  </div>
                  {b.bayar ? (
                    <span className="kecil redup">
                      {rupiah(b.bayar.nominal)} · {METODE_BAYAR[b.bayar.metode]} · {tanggalPendek(b.bayar.tanggal)}
                    </span>
                  ) : (
                    <span className="kecil redup-2">{akanDatang ? 'Belum jatuh tempo' : 'Belum tercatat'}</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="redup-2 kecil">Bila Anda sudah membayar tetapi belum tercatat, hubungi pengurus madrasah dengan menyertakan bukti pembayaran.</p>
        </>
      )}
    </>
  );
}
