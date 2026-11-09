import { useSesi } from '../../lib/sesi';
import { Avatar, KepalaHalaman, Lencana, useJudul } from '../../ui/dasar';
import { GantiSandi } from '../../ui/GantiSandi';
import { PERAN_PENGURUS } from '../../../shared/konstanta';

export default function AkunSaya() {
  useJudul('Akun saya');
  const { pengurus } = useSesi();
  if (!pengurus) return null;
  return (
    <>
      <KepalaHalaman kecil="Akun" judul="Akun saya" />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="kaca kaca--pad baris" style={{ gap: 16 }}>
          <Avatar nama={pengurus.nama} emas ukuran={64} />
          <div className="tumpuk tumpuk--rapat">
            <b style={{ fontSize: 20 }}>{pengurus.nama}</b>
            <span className="redup">@{pengurus.username}</span>
            <Lencana jenis="emas">{PERAN_PENGURUS[pengurus.peran]}</Lencana>
          </div>
        </section>
        <section className="kaca kaca--pad">
          <div className="kartu-judul">
            <h2>Ganti sandi</h2>
          </div>
          <GantiSandi />
        </section>
      </div>
    </>
  );
}
