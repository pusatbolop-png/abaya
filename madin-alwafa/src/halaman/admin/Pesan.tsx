import { useState, type ReactNode } from 'react';
import { CalendarClock, ClipboardCheck, ClipboardList, Home, MessageCircle, PauseCircle, RefreshCw, Send, Settings2, Trash2, Wallet, Zap } from 'lucide-react';
import { kirim } from '../../lib/api';
import { useKirim, usePakai } from '../../lib/pakai';
import { useToast } from '../../lib/toast';
import { Bidang, GalatMuat, KepalaHalaman, Kosong, Lencana, Memuat, Modal, Pesan, Sakelar, Tombol, useJudul, useKonfirmasi } from '../../ui/dasar';
import { rupiah, tanggalPanjang, tautanWa, waktu } from '../../../shared/format';

type Status = 'antre' | 'terkirim' | 'gagal';
type Jenis = 'laporan' | 'rekap' | 'pengingat' | 'tagihan' | 'pulang' | 'uji';
type Tugas = 'pengingat' | 'pulang' | 'rekap' | 'tagihan';

interface Data {
  daftar: { id: number; jenis: Jenis; tujuan: string; hp: string; isi: string; santriId: number | null; status: Status; galat: string | null; dibuat: string; dikirim: string | null }[];
  hitung: Record<Status, number>;
  pengaturan: {
    penyedia: 'manual' | 'fonnte';
    tokenTerisi: boolean;
    gatewayAktif: boolean;
    nomor: string;
    batasInput: string;
    pengingatAktif: boolean;
    pengingatJam: string;
    laporanAktif: boolean;
    laporanJam: string;
    rekapKeGuru: boolean;
    pulangAktif: boolean;
    jamPulang: string;
    pulangMenit: number;
    jamKirimPulang: string;
    tagihanAktif: boolean;
    tagihanJam: string;
    tagihanJeda: number;
    jatuhTempo: number;
    syahriahNominal: number;
    jedaSampai: string | null;
  };
  jadwal: {
    hariIni: string;
    jamSekarang: string;
    libur: boolean;
    adaPelajaran: boolean;
    tagihanTerakhir: string | null;
    pengingatHariIni: number;
    pulangHariIni: number;
    rekapHariIni: number;
  };
  belumInput: { nama: string; punyaHp: boolean; nilai: number; absensi: number }[];
  pulang: { penerima: number };
  penerimaLaporan: { id: number; nama: string; peran: string; hp: string | null; punyaHp: boolean }[];
  tunggakan: { santri: number; tanpaNomor: number; jumlah: number };
}

/** Pratinjau format WhatsApp: *tebal* dan _miring_ (tanpa HTML mentah). */
function FormatWa({ teks }: { teks: string }) {
  const bagian = teks.split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
  return (
    <>
      {bagian.map((b, i) =>
        /^\*[^*]+\*$/.test(b) ? <b key={i}>{b.slice(1, -1)}</b> : /^_[^_]+_$/.test(b) ? <i key={i}>{b.slice(1, -1)}</i> : b,
      )}
    </>
  );
}

const jamTeks = (j: string) => j.replace(':', '.');
const NAMA_JENIS: Record<Jenis, string> = {
  laporan: 'Laporan harian',
  rekap: 'Rekap harian',
  pengingat: 'Pengingat input guru',
  tagihan: 'Pengingat syahriah',
  pulang: 'Pengingat jam pulang',
  uji: 'Pesan uji',
};
const IKON_JENIS: Record<Jenis, ReactNode> = {
  laporan: <ClipboardList />,
  rekap: <ClipboardList />,
  pengingat: <ClipboardCheck />,
  tagihan: <Wallet />,
  pulang: <Home />,
  uji: <Send />,
};
const STATUS: Record<Status, { label: string; jenis: 'waspada' | 'ok' | 'bahaya' }> = {
  antre: { label: 'Menunggu dikirim', jenis: 'waspada' },
  terkirim: { label: 'Terkirim', jenis: 'ok' },
  gagal: { label: 'Gagal', jenis: 'bahaya' },
};

function KartuJadwal({
  ikon,
  judul,
  aktif,
  jam,
  children,
  info,
  tombol,
  sibuk,
  jalankan,
  nonaktif,
}: {
  ikon: ReactNode;
  judul: string;
  aktif: boolean;
  jam: string;
  children: ReactNode;
  info?: ReactNode;
  tombol: string;
  sibuk: boolean;
  jalankan: () => void;
  nonaktif?: boolean;
}) {
  return (
    <section className="kaca kaca--pad kartu-jadwal">
      <div className="kartu-jadwal__kepala">
        <span className="stat__ikon">{ikon}</span>
        <Lencana jenis={aktif ? 'ok' : undefined} titik>
          {aktif ? `Aktif · ${jam} WIB` : 'Mati'}
        </Lencana>
      </div>
      <h2>{judul}</h2>
      <p className="redup kecil">{children}</p>
      {info && <div className="redup-2 kecil">{info}</div>}
      <Tombol ikon={<Zap />} sibuk={sibuk} onClick={jalankan} disabled={nonaktif}>
        {tombol}
      </Tombol>
    </section>
  );
}

export default function PesanOtomatis() {
  useJudul('Pesan otomatis');
  const toast = useToast();
  const tanya = useKonfirmasi();
  const [status, setStatus] = useState<'' | Status>('');
  const [jenis, setJenis] = useState<'' | Jenis>('');
  const { data, galat, muatUlang } = usePakai<Data>(`/api/admin/pesan?${new URLSearchParams({ ...(status && { status }), ...(jenis && { jenis }) })}`);
  const [atur, setAtur] = useState(false);
  const [sibuk, setSibuk] = useState<'' | Tugas>('');
  const [buka, setBuka] = useState<number | null>(null);

  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!data) return <Memuat baris={4} tinggi={90} />;
  const p = data.pengaturan;
  const j = data.jadwal;

  const jalankan = async (apa: Tugas) => {
    if (apa === 'pulang' && !(await tanya({ judul: 'Kirim pengingat jam pulang sekarang?', pesan: `${data.pulang.penerima} wali santri akan menerima pesan bahwa ananda selesai belajar pukul ${jamTeks(p.jamPulang)} WIB. Setiap wali hanya menerima satu pesan per hari.`, ya: 'Buat pesan' }))) return;
    setSibuk(apa);
    try {
      const r = await kirim<{ dibuat: number; terkirim: number; gagal: number; dilewati?: number }>('POST', `/api/admin/pesan/${apa}`);
      const terkirim = r.terkirim ? `, ${r.terkirim} terkirim` : '';
      const pesan: Record<Tugas, string> = {
        pengingat: r.dibuat ? `${r.dibuat} guru diingatkan${terkirim}.` : 'Tidak ada pengingat baru: semua guru sudah lengkap, atau sudah diingatkan hari ini.',
        pulang: r.dibuat ? `${r.dibuat} pengingat jam pulang dibuat${terkirim}.` : 'Tidak ada pesan baru: hari ini tidak ada pelajaran, atau wali sudah menerimanya.',
        rekap: r.dibuat ? `Rekap harian dibuat${terkirim}.` : 'Tidak ada rekap baru: hari ini tidak ada pelajaran, atau rekap sudah dibuat.',
        tagihan: r.dibuat
          ? `${r.dibuat} pengingat syahriah dibuat${terkirim}.${r.dilewati ? ` ${r.dilewati} wali sudah diingatkan dalam ${p.tagihanJeda} hari terakhir.` : ''}`
          : `Tidak ada pengingat baru.${r.dilewati ? ` ${r.dilewati} wali sudah diingatkan dalam ${p.tagihanJeda} hari terakhir.` : ''}`,
      };
      toast.tampil(pesan[apa]);
      muatUlang();
    } catch (e) {
      toast.galat(e);
    } finally {
      setSibuk('');
    }
  };

  const tandai = async (id: number) => {
    try {
      await kirim('POST', `/api/admin/pesan/${id}/tandai`);
      muatUlang();
    } catch (e) {
      toast.galat(e);
    }
  };

  const ulang = async (id: number) => {
    try {
      const r = await kirim<{ terkirim: number }>('POST', `/api/admin/pesan/${id}/ulang`);
      toast.tampil(r.terkirim ? 'Pesan terkirim.' : 'Masih gagal. Periksa token dan saldo gateway.', r.terkirim ? 'ok' : 'galat');
      muatUlang();
    } catch (e) {
      toast.galat(e);
    }
  };

  const hapus = async (id: number) => {
    if (!(await tanya({ judul: 'Batalkan pesan ini?', pesan: 'Pesan dihapus dari kotak keluar dan tidak dikirim.', ya: 'Batalkan pesan', bahaya: true }))) return;
    try {
      await kirim('DELETE', `/api/admin/pesan/${id}`);
      muatUlang();
    } catch (e) {
      toast.galat(e);
    }
  };

  const tanpaHp = data.penerimaLaporan.filter((g) => !g.punyaHp);

  return (
    <>
      <KepalaHalaman
        kecil="Madrasah"
        judul="Pesan otomatis"
        sub="Pesan WhatsApp yang santun untuk guru dan wali santri, sekali per penerima per hari."
        aksi={
          <Tombol ikon={<Settings2 />} onClick={() => setAtur(true)}>
            Pengaturan
          </Tombol>
        }
      />

      {j.libur ? (
        <Pesan jenis="waspada" judul="Libur: pesan otomatis dihentikan">
          Semua pesan terjadwal berhenti sampai {tanggalPanjang(p.jedaSampai)}. Ubah di <b>Pengaturan</b>.
        </Pesan>
      ) : (
        !p.gatewayAktif && (
          <Pesan judul="Pengiriman masih manual">
            Pesan dibuat otomatis sesuai jadwal lalu menunggu di kotak keluar. Ketuk <b>Kirim via WhatsApp</b> untuk mengirim dari ponsel ini. Agar terkirim sendiri dari nomor WhatsApp
            madrasah, isi token gateway (Fonnte) di <b>Pengaturan</b>.
          </Pesan>
        )
      )}

      <div className="baris baris--bungkus" style={{ gap: 8 }}>
        <Lencana jenis={p.gatewayAktif ? 'ok' : 'waspada'} titik>
          {p.gatewayAktif ? 'Terkirim otomatis' : 'Kirim manual'}
          {p.nomor && ` · dari ${p.nomor}`}
        </Lencana>
        <Lencana jenis="waspada">{data.hitung.antre} menunggu</Lencana>
        <Lencana jenis="ok">{data.hitung.terkirim} terkirim</Lencana>
        {data.hitung.gagal > 0 && <Lencana jenis="bahaya">{data.hitung.gagal} gagal</Lencana>}
      </div>

      <div className="grid-jadwal">
        <KartuJadwal
          ikon={<ClipboardCheck />}
          judul="Pengingat input guru"
          aktif={p.pengingatAktif}
          jam={jamTeks(p.pengingatJam)}
          tombol="Ingatkan sekarang"
          sibuk={sibuk === 'pengingat'}
          jalankan={() => jalankan('pengingat')}
          info={
            !j.adaPelajaran
              ? 'Hari ini tidak ada pelajaran.'
              : data.belumInput.length
                ? `Belum lengkap: ${data.belumInput.map((g) => g.nama).join(', ')}`
                : 'Semua guru sudah melengkapi input hari ini.'
          }
        >
          Hanya untuk guru yang nilai harian atau absensinya belum lengkap, sebelum batas pukul <b>{jamTeks(p.batasInput)} WIB</b>.
          {j.pengingatHariIni > 0 && ` Hari ini sudah ${j.pengingatHariIni} guru diingatkan.`}
        </KartuJadwal>
        <KartuJadwal
          ikon={<Home />}
          judul="Pengingat jam pulang"
          aktif={p.pulangAktif}
          jam={jamTeks(p.jamKirimPulang)}
          tombol="Buat pesan hari ini"
          sibuk={sibuk === 'pulang'}
          jalankan={() => jalankan('pulang')}
          nonaktif={!j.adaPelajaran}
          info={j.adaPelajaran ? `${data.pulang.penerima} wali santri · ${j.pulangHariIni ? `${j.pulangHariIni} sudah dibuat hari ini` : 'belum dikirim hari ini'}` : 'Hari ini tidak ada pelajaran.'}
        >
          {p.pulangMenit} menit sebelum pulang pukul <b>{jamTeks(p.jamPulang)} WIB</b>, satu pesan per wali per hari. Santri yang izin, sakit, atau alpa dilewati.
        </KartuJadwal>
        <KartuJadwal
          ikon={<Wallet />}
          judul="Pengingat syahriah"
          aktif={p.tagihanAktif}
          jam={jamTeks(p.tagihanJam)}
          tombol="Proses pengingat sekarang"
          sibuk={sibuk === 'tagihan'}
          jalankan={() => jalankan('tagihan')}
          nonaktif={!p.syahriahNominal}
          info={
            p.syahriahNominal
              ? `${data.tunggakan.santri} santri belum lunas · ${rupiah(data.tunggakan.jumlah)}${data.tunggakan.tanpaNomor ? ` · ${data.tunggakan.tanpaNomor} tanpa nomor wali` : ''}`
              : 'Isi nominal syahriah di Pengaturan agar pengingat bisa dibuat.'
          }
        >
          Setiap <b>{p.tagihanJeda} hari</b> dengan sapaan nama wali, sejak tanggal {p.jatuhTempo} setiap bulan. Berhenti sendiri begitu pengurus mencatatnya lunas.
        </KartuJadwal>
        <KartuJadwal
          ikon={<ClipboardList />}
          judul="Rekap harian"
          aktif={p.laporanAktif}
          jam={jamTeks(p.laporanJam)}
          tombol="Kirim rekap sekarang"
          sibuk={sibuk === 'rekap'}
          jalankan={() => jalankan('rekap')}
          info={p.rekapKeGuru ? 'Untuk administrator dan semua guru (kelas masing-masing).' : 'Untuk administrator.'}
        >
          Setelah batas input: kehadiran, kelengkapan nilai harian per pelajaran, syahriah yang masuk, dan pendaftaran yang menunggu.
        </KartuJadwal>
      </div>

      {tanpaHp.length > 0 && (
        <Pesan jenis="waspada" judul="Guru tanpa nomor WhatsApp">
          {tanpaHp.map((g) => g.nama).join(', ')} tidak bisa menerima pengingat. Isi nomornya di Pengaturan › Akun pengurus.
        </Pesan>
      )}

      <section className="kaca">
        <div className="kepala-panel">
          <div>
            <b>Kotak keluar</b>
            <div className="redup-2 kecil">200 pesan terbaru</div>
          </div>
          <div className="baris baris--bungkus" style={{ gap: 8 }}>
            <select className="masukan masukan--kecil" style={{ width: 'auto' }} value={jenis} onChange={(e) => setJenis(e.target.value as '' | Jenis)} aria-label="Jenis pesan">
              <option value="">Semua jenis</option>
              <option value="pengingat">Pengingat guru</option>
              <option value="rekap">Rekap harian</option>
              <option value="pulang">Jam pulang</option>
              <option value="tagihan">Pengingat syahriah</option>
              <option value="uji">Pesan uji</option>
            </select>
            <div className="segmen" role="tablist" aria-label="Status pesan">
              {(
                [
                  ['', 'Semua'],
                  ['antre', 'Menunggu'],
                  ['terkirim', 'Terkirim'],
                  ['gagal', 'Gagal'],
                ] as const
              ).map(([v, l]) => (
                <button key={v} role="tab" aria-selected={status === v} onClick={() => setStatus(v)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
        {!data.daftar.length ? (
          <Kosong ikon={<Send />} judul="Kotak keluar kosong" pesan="Pesan yang dibuat jadwal atau tombol di atas akan tampil di sini." />
        ) : (
          <ul className="daftar-pesan">
            {data.daftar.map((m) => (
              <li key={m.id} className={`daftar-pesan__item daftar-pesan__item--${m.status}`}>
                <div className="daftar-pesan__kepala">
                  <span className="stat__ikon">{IKON_JENIS[m.jenis]}</span>
                  <div className="isi-penuh" style={{ minWidth: 0 }}>
                    <b className="potong" style={{ display: 'block' }}>
                      {m.tujuan}
                    </b>
                    <span className="redup-2 kecil">
                      {NAMA_JENIS[m.jenis]} · <span className="angka">{m.hp}</span> · {waktu(m.dibuat)}
                    </span>
                  </div>
                  <Lencana jenis={STATUS[m.status].jenis}>{STATUS[m.status].label}</Lencana>
                </div>
                <button type="button" className={`daftar-pesan__isi ${buka === m.id ? 'terbuka' : ''}`} onClick={() => setBuka(buka === m.id ? null : m.id)} aria-expanded={buka === m.id}>
                  <FormatWa teks={m.isi} />
                </button>
                {m.galat && <div className="kecil" style={{ color: 'var(--bahaya)' }}>{m.galat}</div>}
                {m.status !== 'terkirim' && (
                  <div className="baris baris--bungkus daftar-pesan__aksi">
                    <a className="tombol tombol--kecil tombol--utama" href={tautanWa(m.hp, m.isi)} target="_blank" rel="noreferrer" onClick={() => tandai(m.id)}>
                      <MessageCircle /> Kirim via WhatsApp
                    </a>
                    {m.status === 'gagal' && p.gatewayAktif && (
                      <Tombol ukuran="kecil" ikon={<RefreshCw />} onClick={() => ulang(m.id)}>
                        Kirim ulang
                      </Tombol>
                    )}
                    <Tombol ukuran="kecil" varian="hantu" ikon={<Trash2 />} onClick={() => hapus(m.id)}>
                      Batalkan
                    </Tombol>
                  </div>
                )}
                {m.dikirim && <div className="redup-2 kecil">Terkirim {waktu(m.dikirim)}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {atur && (
        <PengaturanPesan
          awal={p}
          tutup={() => setAtur(false)}
          selesai={() => {
            setAtur(false);
            muatUlang();
          }}
        />
      )}
    </>
  );
}

function PengaturanPesan({ awal, tutup, selesai }: { awal: Data['pengaturan']; tutup: () => void; selesai: () => void }) {
  const toast = useToast();
  const { sibuk, bidang, jalankan } = useKirim();
  const [f, setF] = useState({
    penyedia: awal.penyedia,
    token: '',
    hapusToken: false,
    nomor: awal.nomor,
    batasInput: awal.batasInput,
    pengingatAktif: awal.pengingatAktif,
    pengingatJam: awal.pengingatJam,
    laporanAktif: awal.laporanAktif,
    laporanJam: awal.laporanJam,
    rekapKeGuru: awal.rekapKeGuru,
    pulangAktif: awal.pulangAktif,
    jamPulang: awal.jamPulang,
    pulangMenit: String(awal.pulangMenit),
    jedaSampai: awal.jedaSampai ?? '',
    tagihanAktif: awal.tagihanAktif,
    tagihanJam: awal.tagihanJam,
    tagihanJeda: String(awal.tagihanJeda),
    jatuhTempo: String(awal.jatuhTempo),
  });
  const [hpUji, setHpUji] = useState('');
  const [sibukUji, setSibukUji] = useState(false);

  const simpan = () =>
    jalankan(async () => {
      await kirim('PUT', '/api/admin/pesan/pengaturan', { ...f, tagihanJeda: Number(f.tagihanJeda), jatuhTempo: Number(f.jatuhTempo), pulangMenit: Number(f.pulangMenit), jedaSampai: f.jedaSampai || null, token: f.token || undefined });
      toast.tampil('Pengaturan pesan otomatis disimpan.');
      selesai();
    }).catch(toast.galat);

  const uji = async () => {
    setSibukUji(true);
    try {
      const r = await kirim<{ status: Status; galat: string | null }>('POST', '/api/admin/pesan/uji', { hp: hpUji });
      if (r.status === 'terkirim') toast.tampil('Pesan uji terkirim. Periksa WhatsApp di nomor tujuan.');
      else if (r.status === 'gagal') toast.tampil(`Pesan uji gagal: ${r.galat}`, 'galat');
      else toast.tampil('Pesan uji menunggu di kotak keluar. Kirim lewat tombol WhatsApp.');
    } catch (e) {
      toast.galat(e);
    } finally {
      setSibukUji(false);
    }
  };

  return (
    <Modal
      judul="Pengaturan pesan otomatis"
      tutup={tutup}
      onSubmit={simpan}
      lebar
      kaki={
        <Tombol type="submit" varian="utama" sibuk={sibuk}>
          Simpan
        </Tombol>
      }
    >
      <div className="tumpuk">
        <Bidang label="Cara mengirim" grup>
          <div className="segmen" role="radiogroup" style={{ width: '100%' }}>
            {(
              [
                ['manual', 'Manual lewat WhatsApp admin'],
                ['fonnte', 'Otomatis lewat gateway Fonnte'],
              ] as const
            ).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={f.penyedia === v} onClick={() => setF({ ...f, penyedia: v })} style={{ flex: 1, justifyContent: 'center' }}>
                {l}
              </button>
            ))}
          </div>
        </Bidang>
        {f.penyedia === 'fonnte' && (
          <div className="panel tumpuk" style={{ padding: 16 }}>
            <p className="redup kecil" style={{ margin: 0 }}>
              Daftar di fonnte.com, hubungkan nomor WhatsApp madrasah dengan memindai QR di dasbor Fonnte, lalu salin token perangkatnya ke sini. Token disimpan di server dan tidak
              pernah ditampilkan lagi.
            </p>
            <Bidang
              label="Token Fonnte"
              galat={bidang.token}
              bantu={awal.tokenTerisi && !f.hapusToken ? 'Token sudah tersimpan. Kosongkan bila tidak ingin menggantinya.' : undefined}
            >
              <input className="masukan" type="password" autoComplete="off" value={f.token} onChange={(e) => setF({ ...f, token: e.target.value, hapusToken: false })} />
            </Bidang>
            {awal.tokenTerisi && (
              <label className="baris kecil" style={{ gap: 8 }}>
                <input type="checkbox" checked={f.hapusToken} onChange={(e) => setF({ ...f, hapusToken: e.target.checked, penyedia: e.target.checked ? 'manual' : f.penyedia })} />
                Hapus token tersimpan
              </label>
            )}
          </div>
        )}
        <Bidang label="Nomor WhatsApp madrasah (pengirim)" galat={bidang.nomor} bantu="Nomor yang terhubung ke gateway dan dicantumkan di pesan untuk wali yang ingin bertanya.">
          <input className="masukan angka" type="tel" inputMode="tel" placeholder="0812-…" value={f.nomor} onChange={(e) => setF({ ...f, nomor: e.target.value })} />
        </Bidang>
        <div className="grid-2">
          <div className="panel tumpuk" style={{ padding: 16 }}>
            <div className="baris baris--antara">
              <b className="baris" style={{ gap: 8 }}>
                <ClipboardCheck className="teks-ikon" /> Input harian guru
              </b>
              <Sakelar nyala={f.pengingatAktif} ubah={(v) => setF({ ...f, pengingatAktif: v })} label="Pengingat input guru aktif" />
            </div>
            <div className="grid-2">
              <Bidang label="Pengingat pukul" galat={bidang.pengingatJam}>
                <input className="masukan angka" type="time" value={f.pengingatJam} onChange={(e) => setF({ ...f, pengingatJam: e.target.value })} />
              </Bidang>
              <Bidang label="Batas input" galat={bidang.batasInput}>
                <input className="masukan angka" type="time" value={f.batasInput} onChange={(e) => setF({ ...f, batasInput: e.target.value })} />
              </Bidang>
            </div>
          </div>
          <div className="panel tumpuk" style={{ padding: 16 }}>
            <div className="baris baris--antara">
              <b className="baris" style={{ gap: 8 }}>
                <Home className="teks-ikon" /> Jam pulang
              </b>
              <Sakelar nyala={f.pulangAktif} ubah={(v) => setF({ ...f, pulangAktif: v })} label="Pengingat jam pulang aktif" />
            </div>
            <div className="grid-2">
              <Bidang label="Pulang pukul" galat={bidang.jamPulang}>
                <input className="masukan angka" type="time" value={f.jamPulang} onChange={(e) => setF({ ...f, jamPulang: e.target.value })} />
              </Bidang>
              <Bidang label="Menit sebelumnya" galat={bidang.pulangMenit}>
                <input className="masukan angka" type="number" min={5} max={120} value={f.pulangMenit} onChange={(e) => setF({ ...f, pulangMenit: e.target.value })} />
              </Bidang>
            </div>
          </div>
          <div className="panel tumpuk" style={{ padding: 16 }}>
            <div className="baris baris--antara">
              <b className="baris" style={{ gap: 8 }}>
                <Wallet className="teks-ikon" /> Pengingat syahriah
              </b>
              <Sakelar nyala={f.tagihanAktif} ubah={(v) => setF({ ...f, tagihanAktif: v })} label="Pengingat syahriah aktif" />
            </div>
            <div className="grid-2">
              <Bidang label="Diulang setiap (hari)" galat={bidang.tagihanJeda}>
                <input className="masukan angka" type="number" min={1} max={30} value={f.tagihanJeda} onChange={(e) => setF({ ...f, tagihanJeda: e.target.value })} />
              </Bidang>
              <Bidang label="Jatuh tempo (tanggal)" galat={bidang.jatuhTempo}>
                <input className="masukan angka" type="number" min={1} max={28} value={f.jatuhTempo} onChange={(e) => setF({ ...f, jatuhTempo: e.target.value })} />
              </Bidang>
            </div>
            <Bidang label="Dikirim pukul (WIB)" galat={bidang.tagihanJam}>
              <input className="masukan angka" type="time" value={f.tagihanJam} onChange={(e) => setF({ ...f, tagihanJam: e.target.value })} />
            </Bidang>
          </div>
          <div className="panel tumpuk" style={{ padding: 16 }}>
            <div className="baris baris--antara">
              <b className="baris" style={{ gap: 8 }}>
                <CalendarClock className="teks-ikon" /> Rekap harian
              </b>
              <Sakelar nyala={f.laporanAktif} ubah={(v) => setF({ ...f, laporanAktif: v })} label="Rekap harian aktif" />
            </div>
            <Bidang label="Dikirim pukul (WIB)" galat={bidang.laporanJam}>
              <input className="masukan angka" type="time" value={f.laporanJam} onChange={(e) => setF({ ...f, laporanJam: e.target.value })} />
            </Bidang>
            <label className="baris kecil" style={{ gap: 8 }}>
              <input type="checkbox" checked={f.rekapKeGuru} onChange={(e) => setF({ ...f, rekapKeGuru: e.target.checked })} />
              Kirim juga ke semua guru (kelas masing-masing)
            </label>
          </div>
        </div>
        <div className="panel tumpuk" style={{ padding: 16 }}>
          <b className="baris" style={{ gap: 8 }}>
            <PauseCircle className="teks-ikon" /> Libur
          </b>
          <Bidang label="Hentikan semua pesan otomatis sampai tanggal" galat={bidang.jedaSampai} bantu="Kosongkan bila tidak sedang libur. Pada hari tanpa jadwal pelajaran, pengingat guru dan jam pulang tidak dikirim.">
            <input className="masukan angka" type="date" value={f.jedaSampai} onChange={(e) => setF({ ...f, jedaSampai: e.target.value })} />
          </Bidang>
        </div>
        <div className="panel tumpuk" style={{ padding: 16 }}>
          <b>Kirim pesan uji</b>
          <div className="baris">
            <input className="masukan angka" type="tel" inputMode="tel" placeholder="0812-…" value={hpUji} onChange={(e) => setHpUji(e.target.value)} aria-label="Nomor WhatsApp uji" />
            <Tombol ikon={<Send />} sibuk={sibukUji} onClick={uji} disabled={!hpUji.trim()}>
              Kirim
            </Tombol>
          </div>
          <span className="redup-2 kecil">Simpan pengaturan dulu bila baru mengisi token.</span>
        </div>
      </div>
    </Modal>
  );
}
