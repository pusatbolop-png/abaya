import { useState } from 'react';
import { CalendarClock, ClipboardList, MessageCircle, RefreshCw, Send, Settings2, Trash2, Wallet, Zap } from 'lucide-react';
import { kirim } from '../../lib/api';
import { useKirim, usePakai } from '../../lib/pakai';
import { useToast } from '../../lib/toast';
import { Bidang, GalatMuat, KepalaHalaman, Kosong, Lencana, Memuat, Modal, Pesan, Sakelar, Tombol, useJudul, useKonfirmasi } from '../../ui/dasar';
import { rupiah, tanggalPanjang, tautanWa, waktu } from '../../../shared/format';

type Status = 'antre' | 'terkirim' | 'gagal';
type Jenis = 'laporan' | 'tagihan' | 'uji';

interface Data {
  daftar: { id: number; jenis: Jenis; tujuan: string; hp: string; isi: string; santriId: number | null; status: Status; galat: string | null; dibuat: string; dikirim: string | null }[];
  hitung: Record<Status, number>;
  pengaturan: {
    penyedia: 'manual' | 'fonnte';
    tokenTerisi: boolean;
    gatewayAktif: boolean;
    laporanAktif: boolean;
    laporanJam: string;
    tagihanAktif: boolean;
    tagihanJam: string;
    tagihanJeda: number;
    jatuhTempo: number;
    syahriahNominal: number;
  };
  jadwal: { jamSekarang: string; laporanTerakhir: string | null; tagihanTerakhir: string | null };
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

const NAMA_JENIS: Record<Jenis, string> = { laporan: 'Laporan harian', tagihan: 'Pengingat syahriah', uji: 'Pesan uji' };
const STATUS: Record<Status, { label: string; jenis: 'waspada' | 'ok' | 'bahaya' }> = {
  antre: { label: 'Menunggu dikirim', jenis: 'waspada' },
  terkirim: { label: 'Terkirim', jenis: 'ok' },
  gagal: { label: 'Gagal', jenis: 'bahaya' },
};

export default function PesanOtomatis() {
  useJudul('Pesan otomatis');
  const toast = useToast();
  const tanya = useKonfirmasi();
  const [status, setStatus] = useState<'' | Status>('');
  const [jenis, setJenis] = useState<'' | Jenis>('');
  const { data, galat, muatUlang } = usePakai<Data>(`/api/admin/pesan?${new URLSearchParams({ ...(status && { status }), ...(jenis && { jenis }) })}`);
  const [atur, setAtur] = useState(false);
  const [sibuk, setSibuk] = useState<'' | 'laporan' | 'tagihan'>('');
  const [buka, setBuka] = useState<number | null>(null);

  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!data) return <Memuat baris={4} tinggi={90} />;
  const p = data.pengaturan;

  const jalankan = async (apa: 'laporan' | 'tagihan') => {
    setSibuk(apa);
    try {
      const r = await kirim<{ dibuat: number; terkirim: number; gagal: number; dilewati?: number; tanpaNomor?: string[] }>('POST', `/api/admin/pesan/${apa}`);
      if (apa === 'laporan') {
        toast.tampil(r.dibuat ? `${r.dibuat} laporan harian dibuat${r.terkirim ? `, ${r.terkirim} terkirim` : ''}.` : 'Tidak ada laporan: hari ini tidak ada pelajaran atau guru belum punya nomor HP.');
      } else {
        const lewat = r.dilewati ? ` ${r.dilewati} wali sudah diingatkan dalam ${p.tagihanJeda} hari terakhir.` : '';
        toast.tampil(r.dibuat ? `${r.dibuat} pengingat syahriah dibuat.${lewat}` : `Tidak ada pengingat baru.${lewat}`);
      }
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
        sub={`Laporan santri untuk setiap guru pukul ${p.laporanJam} WIB, dan pengingat syahriah setiap ${p.tagihanJeda} hari sampai lunas.`}
        aksi={
          <Tombol ikon={<Settings2 />} onClick={() => setAtur(true)}>
            Pengaturan
          </Tombol>
        }
      />

      {!p.gatewayAktif && (
        <Pesan judul="Pengiriman masih manual">
          Pesan dibuat otomatis sesuai jadwal lalu menunggu di kotak keluar. Ketuk <b>Kirim via WhatsApp</b> untuk mengirim dari ponsel ini. Agar terkirim sendiri tanpa disentuh, isi token
          gateway WhatsApp (Fonnte) di <b>Pengaturan</b>.
        </Pesan>
      )}

      <div className="grid-3">
        <section className="kaca kaca--pad kartu-jadwal">
          <div className="kartu-jadwal__kepala">
            <span className="stat__ikon">
              <ClipboardList />
            </span>
            <Lencana jenis={p.laporanAktif ? 'ok' : undefined} titik>
              {p.laporanAktif ? 'Aktif' : 'Mati'}
            </Lencana>
          </div>
          <h2>Laporan harian guru</h2>
          <p className="redup kecil">
            Setiap hari pukul <b>{p.laporanJam} WIB</b>: kehadiran, izin, sakit, alpa, dan setoran hafalan per kelas yang diajar.
          </p>
          <div className="redup-2 kecil">
            Terakhir: {data.jadwal.laporanTerakhir ? tanggalPanjang(data.jadwal.laporanTerakhir) : 'belum pernah'} · {data.penerimaLaporan.length - tanpaHp.length} guru penerima
          </div>
          <Tombol ikon={<Zap />} sibuk={sibuk === 'laporan'} onClick={() => jalankan('laporan')}>
            Buat laporan hari ini
          </Tombol>
        </section>
        <section className="kaca kaca--pad kartu-jadwal">
          <div className="kartu-jadwal__kepala">
            <span className="stat__ikon">
              <Wallet />
            </span>
            <Lencana jenis={p.tagihanAktif ? 'ok' : undefined} titik>
              {p.tagihanAktif ? 'Aktif' : 'Mati'}
            </Lencana>
          </div>
          <h2>Pengingat syahriah</h2>
          <p className="redup kecil">
            Setiap <b>{p.tagihanJeda} hari</b> pukul {p.tagihanJam} WIB untuk wali yang belum membayar; jatuh tempo tanggal {p.jatuhTempo} setiap bulan.
          </p>
          <div className="redup-2 kecil">
            {p.syahriahNominal
              ? `${data.tunggakan.santri} santri menunggak · ${rupiah(data.tunggakan.jumlah)}${data.tunggakan.tanpaNomor ? ` · ${data.tunggakan.tanpaNomor} tanpa nomor wali` : ''}`
              : 'Isi nominal syahriah di Pengaturan agar pengingat bisa dibuat.'}
          </div>
          <Tombol ikon={<Zap />} sibuk={sibuk === 'tagihan'} onClick={() => jalankan('tagihan')} disabled={!p.syahriahNominal}>
            Proses pengingat sekarang
          </Tombol>
        </section>
        <section className="kaca kaca--pad kartu-jadwal">
          <div className="kartu-jadwal__kepala">
            <span className="stat__ikon">
              <MessageCircle />
            </span>
            <Lencana jenis={p.gatewayAktif ? 'ok' : 'waspada'} titik>
              {p.gatewayAktif ? 'Otomatis' : 'Manual'}
            </Lencana>
          </div>
          <h2>Pengiriman WhatsApp</h2>
          <p className="redup kecil">{p.gatewayAktif ? 'Pesan dikirim langsung lewat gateway Fonnte dari nomor madrasah.' : 'Pesan dikirim admin dengan sekali ketuk lewat aplikasi WhatsApp.'}</p>
          <div className="baris baris--bungkus" style={{ gap: 6 }}>
            <Lencana jenis="waspada">{data.hitung.antre} menunggu</Lencana>
            <Lencana jenis="ok">{data.hitung.terkirim} terkirim</Lencana>
            {data.hitung.gagal > 0 && <Lencana jenis="bahaya">{data.hitung.gagal} gagal</Lencana>}
          </div>
        </section>
      </div>

      {tanpaHp.length > 0 && (
        <Pesan jenis="waspada" judul="Guru tanpa nomor HP">
          {tanpaHp.map((g) => g.nama).join(', ')} belum menerima laporan harian. Isi nomor HP di Pengaturan › Akun pengurus.
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
              <option value="laporan">Laporan harian</option>
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
                  <span className="stat__ikon">{m.jenis === 'tagihan' ? <Wallet /> : m.jenis === 'laporan' ? <ClipboardList /> : <Send />}</span>
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
    laporanAktif: awal.laporanAktif,
    laporanJam: awal.laporanJam,
    tagihanAktif: awal.tagihanAktif,
    tagihanJam: awal.tagihanJam,
    tagihanJeda: String(awal.tagihanJeda),
    jatuhTempo: String(awal.jatuhTempo),
  });
  const [hpUji, setHpUji] = useState('');
  const [sibukUji, setSibukUji] = useState(false);

  const simpan = () =>
    jalankan(async () => {
      await kirim('PUT', '/api/admin/pesan/pengaturan', { ...f, tagihanJeda: Number(f.tagihanJeda), jatuhTempo: Number(f.jatuhTempo), token: f.token || undefined });
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
        <div className="grid-2">
          <div className="panel tumpuk" style={{ padding: 16 }}>
            <div className="baris baris--antara">
              <b className="baris" style={{ gap: 8 }}>
                <CalendarClock className="teks-ikon" /> Laporan harian guru
              </b>
              <Sakelar nyala={f.laporanAktif} ubah={(v) => setF({ ...f, laporanAktif: v })} label="Laporan harian aktif" />
            </div>
            <Bidang label="Dikirim pukul (WIB)" galat={bidang.laporanJam}>
              <input className="masukan angka" type="time" value={f.laporanJam} onChange={(e) => setF({ ...f, laporanJam: e.target.value })} />
            </Bidang>
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
