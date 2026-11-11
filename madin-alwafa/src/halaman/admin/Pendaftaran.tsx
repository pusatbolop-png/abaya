import { useState } from 'react';
import { Check, MessageCircle, UserPlus, X } from 'lucide-react';
import { kirim } from '../../lib/api';
import { urlFoto } from '../../lib/foto';
import { usePakai } from '../../lib/pakai';
import { useSesi } from '../../lib/sesi';
import { useToast } from '../../lib/toast';
import { Avatar, Lencana, Memuat, Modal, Pesan, Tombol, useKonfirmasi } from '../../ui/dasar';
import { alamatLengkap, tautanWa, waktu } from '../../../shared/format';
import { PRATINJAU } from '../../lib/pratinjau';

interface Daftar {
  id: number;
  santriId: number;
  santri: string;
  nis: string;
  jk: string;
  fotoVersi: string | null;
  kelas: string | null;
  namaWali: string;
  hubungan: string;
  hp: string;
  hpTercatat: string | null;
  alamat: string | null;
  desa: string | null;
  kecamatan: string | null;
  kabupaten: string | null;
  provinsi: string | null;
  dibuat: string;
}

/** Pita di atas daftar santri bila ada wali yang mendaftar dengan nomor yang belum cocok. */
export function PitaPendaftaran({ berubah }: { berubah: () => void }) {
  const { data, muatUlang } = usePakai<{ daftar: Daftar[] }>('/api/admin/pendaftaran');
  const [buka, setBuka] = useState(false);
  const n = data?.daftar.length ?? 0;
  if (!n && !buka) return null;
  return (
    <>
      {n > 0 && (
        <div className="kaca kaca--rapat pita-pendaftaran">
          <span className="stat__ikon">
            <UserPlus />
          </span>
          <div className="isi-penuh">
            <b>{n} pendaftaran wali menunggu pemeriksaan</b>
            <div className="redup kecil">Nomor WhatsApp yang dipakai mendaftar belum sama dengan data madrasah.</div>
          </div>
          <Tombol varian="utama" ukuran="kecil" onClick={() => setBuka(true)}>
            Periksa
          </Tombol>
        </div>
      )}
      {buka && (
        <PeriksaPendaftaran
          daftar={data?.daftar ?? null}
          tutup={() => setBuka(false)}
          berubah={() => {
            muatUlang();
            berubah();
          }}
        />
      )}
    </>
  );
}

function PeriksaPendaftaran({ daftar, tutup, berubah }: { daftar: Daftar[] | null; tutup: () => void; berubah: () => void }) {
  const toast = useToast();
  const tanya = useKonfirmasi();
  const { lembaga } = useSesi();
  const [kabar, setKabar] = useState<{ hp: string; pesan: string; nama: string } | null>(null);
  const alamatAplikasi = PRATINJAU ? 'aplikasi madrasah' : location.origin;

  const setujui = async (d: Daftar) => {
    const ya = await tanya({
      judul: `Setujui ${d.namaWali}?`,
      pesan: `Pastikan Anda sudah menghubungi ${d.hp} dan yakin ia ${d.hubungan.toLowerCase()} dari ${d.santri}. Nomor wali di data santri diganti dengan nomor ini.`,
      ya: 'Setujui',
    });
    if (!ya) return;
    try {
      await kirim('POST', `/api/admin/pendaftaran/${d.id}/setujui`);
      setKabar({
        hp: d.hp,
        nama: d.namaWali,
        pesan:
          `Assalamu'alaikum ${d.namaWali}.\n\nPendaftaran akun wali untuk ananda *${d.santri}* di ${lembaga.nama} sudah disetujui. ` +
          `Silakan masuk di ${alamatAplikasi} dengan NIS *${d.nis}* dan sandi yang Bapak/Ibu buat saat mendaftar.\n\nJazakumullahu khairan.`,
      });
      toast.tampil(`Akun wali ${d.santri} aktif.`);
      berubah();
    } catch (e) {
      toast.galat(e);
    }
  };

  const tolak = async (d: Daftar) => {
    const ya = await tanya({ judul: `Tolak pendaftaran ${d.namaWali}?`, pesan: 'Sandi yang dibuat pendaftar tidak berlaku. Ia bisa mendaftar ulang dengan nomor yang benar.', ya: 'Tolak', bahaya: true });
    if (!ya) return;
    try {
      await kirim('POST', `/api/admin/pendaftaran/${d.id}/tolak`, { alasan: null });
      toast.tampil('Pendaftaran ditolak.');
      berubah();
    } catch (e) {
      toast.galat(e);
    }
  };

  return (
    <Modal judul="Pendaftaran wali" sub="Hubungi nomor pendaftar untuk memastikan ia benar orang tua atau wali santri." tutup={tutup} lebar>
      {kabar && (
        <Pesan jenis="ok" judul={`Kabari ${kabar.nama}`}>
          Akun sudah aktif. Kirim kabar lewat WhatsApp agar wali tahu bisa masuk.
          <div style={{ marginTop: 8 }}>
            <a className="tombol tombol--kecil tombol--utama" href={tautanWa(kabar.hp, kabar.pesan)} target="_blank" rel="noreferrer" onClick={() => setKabar(null)}>
              <MessageCircle /> Kirim kabar via WhatsApp
            </a>
          </div>
        </Pesan>
      )}
      {!daftar ? (
        <Memuat baris={2} tinggi={90} />
      ) : !daftar.length ? (
        <p className="redup">Tidak ada pendaftaran yang menunggu.</p>
      ) : (
        <ul className="daftar-pendaftaran">
          {daftar.map((d) => (
            <li key={d.id} className="panel">
              <div className="baris" style={{ gap: 12 }}>
                <Avatar nama={d.santri} jk={d.jk} ukuran={40} foto={urlFoto(d.santriId, d.fotoVersi)} />
                <div className="isi-penuh" style={{ minWidth: 0 }}>
                  <b>{d.santri}</b>
                  <div className="redup-2 kecil">
                    NIS <span className="angka">{d.nis}</span>
                    {d.kelas && ` · ${d.kelas}`} · {waktu(d.dibuat)}
                  </div>
                </div>
              </div>
              <dl className="daftar-data">
                <dt>Pendaftar</dt>
                <dd>
                  {d.namaWali} <Lencana>{d.hubungan}</Lencana>
                </dd>
                <dt>WhatsApp baru</dt>
                <dd>
                  <a href={tautanWa(d.hp, `Assalamu'alaikum ${d.namaWali}, kami dari ${lembaga.singkatan} ingin memastikan pendaftaran akun wali untuk ananda ${d.santri}. `)} target="_blank" rel="noreferrer" className="angka">
                    {d.hp}
                  </a>
                </dd>
                <dt>Nomor tercatat</dt>
                <dd className="angka">{d.hpTercatat ?? <span className="redup-2">belum ada</span>}</dd>
                <dt>Alamat</dt>
                <dd>{alamatLengkap(d) || '–'}</dd>
              </dl>
              <div className="baris baris--bungkus" style={{ gap: 8, justifyContent: 'flex-end' }}>
                <Tombol ukuran="kecil" varian="hantu" ikon={<X />} onClick={() => tolak(d)}>
                  Tolak
                </Tombol>
                <Tombol ukuran="kecil" varian="utama" ikon={<Check />} onClick={() => setujui(d)}>
                  Setujui
                </Tombol>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
