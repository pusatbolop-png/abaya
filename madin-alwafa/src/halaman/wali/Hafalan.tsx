import { BookOpenCheck } from 'lucide-react';
import { usePakai } from '../../lib/pakai';
import type { Hafalan } from '../../lib/tipe';
import { GalatMuat, KepalaHalaman, Kosong, Lencana, Memuat, useJudul } from '../../ui/dasar';
import { warnaPredikat } from '../admin/Hafalan';
import { PREDIKAT_HAFALAN } from '../../../shared/konstanta';
import { namaBulan, tanggalHari } from '../../../shared/format';

export default function HafalanWali() {
  useJudul('Hafalan');
  const { data, galat, muatUlang } = usePakai<{ daftar: Hafalan[]; perJenis: { jenis: string; jumlah: number; lancar: number }[] }>('/api/wali/hafalan');
  const perBulan = new Map<string, Hafalan[]>();
  data?.daftar.forEach((h) => perBulan.set(h.tanggal.slice(0, 7), [...(perBulan.get(h.tanggal.slice(0, 7)) ?? []), h]));
  return (
    <>
      <KepalaHalaman kecil="المحفوظات" judul="Hafalan" sub="Setoran hafalan Al-Qur'an, nadzom, serta do'a dan hadits yang disimak ustadz/ustadzah." />
      {galat ? (
        <GalatMuat galat={galat} ulang={muatUlang} />
      ) : !data ? (
        <Memuat baris={4} />
      ) : !data.daftar.length ? (
        <div className="kaca">
          <Kosong ikon={<BookOpenCheck />} judul="Belum ada setoran" pesan="Setoran hafalan ananda akan tampil di sini." />
        </div>
      ) : (
        <>
          <div className="grid-3">
            {data.perJenis.map((j) => (
              <div key={j.jenis} className="kaca stat">
                <div className="stat__label">
                  <span className="stat__ikon">
                    <BookOpenCheck />
                  </span>
                  {j.jenis}
                </div>
                <div className="stat__nilai">{j.lancar}</div>
                <div className="stat__sub">setoran lancar dari {j.jumlah} setoran</div>
              </div>
            ))}
          </div>
          <section className="kaca kaca--pad tumpuk tumpuk--lebar">
            {[...perBulan.entries()].map(([b, isi]) => (
              <div key={b} className="tumpuk tumpuk--rapat">
                <div className="mikro redup-2">{namaBulan(b)}</div>
                <ol className="linimasa">
                  {isi.map((h) => (
                    <li key={h.id}>
                      <span className={`linimasa__titik linimasa__titik--${h.predikat}`} />
                      <div className="isi-penuh">
                        <div className="baris baris--antara baris--atas" style={{ gap: 10 }}>
                          <div>
                            <b>{h.materi}</b>
                            <div className="redup-2 kecil">
                              {h.jenis} · {tanggalHari(h.tanggal)}
                              {h.penyimak && ` · disimak ${h.penyimak}`}
                            </div>
                            {h.catatan && <div className="kecil" style={{ color: 'var(--waspada)', marginTop: 2 }}>{h.catatan}</div>}
                          </div>
                          <Lencana jenis={warnaPredikat(h.predikat)}>{PREDIKAT_HAFALAN[h.predikat]}</Lencana>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}
