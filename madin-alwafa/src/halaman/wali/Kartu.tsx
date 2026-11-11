import { usePakai } from '../../lib/pakai';
import type { DataKartu } from '../../lib/tipe';
import { GalatMuat, KepalaHalaman, Memuat, useJudul } from '../../ui/dasar';
import { KartuSantri } from '../../ui/KartuSantri';

export default function KartuWali() {
  useJudul('Kartu santri');
  const { data, galat, muatUlang } = usePakai<DataKartu>('/api/wali/kartu');
  return (
    <>
      <KepalaHalaman kecil="Identitas" judul="Kartu santri" sub="Tunjukkan dari ponsel bila diminta, atau cetak lalu laminasi. Ketuk kartu untuk membaca tata tertib di baliknya." />
      <section className="kaca kaca--pad kartu-halaman">
        {galat ? <GalatMuat galat={galat} ulang={muatUlang} /> : !data ? <Memuat baris={3} tinggi={150} /> : <KartuSantri d={data} />}
      </section>
    </>
  );
}
