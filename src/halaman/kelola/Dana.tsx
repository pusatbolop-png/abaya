import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { useData } from '../../lib/data';
import { useSesi, useToast } from '../../lib/konteks';
import { Area, Bidang, GalatMuat, KepalaHalaman, Konfirmasi, Kosong, Lembar, Masukan, Memuat, Pemberitahuan, Status, Tombol, Uang, useKirim } from '../../ui/dasar';
import { rupiah, tanggal, tanggalJam, tanggalWib } from '../../../shared/format';
import { STATUS_PENCAIRAN, type StatusPencairan } from '../../../shared/konstanta';

interface Posisi {
  id: number;
  kode: string;
  namaUsaha: string;
  bank: string | null;
  noRekening: string | null;
  atasNama: string | null;
  rekeningLengkap: boolean;
  bruto: number;
  retur: number;
  neto: number;
  potongan: number;
  siapCair: number;
  sudahDibayar: number;
  menungguTransfer: number;
}
interface Pencairan {
  id: number;
  nomor: string;
  umkmId: number;
  namaUsaha: string;
  sampai: string;
  bruto: number;
  retur: number;
  potongan: number;
  jumlah: number;
  status: StatusPencairan;
  referensiTransfer: string | null;
  dibayar: string | null;
  catatan: string | null;
  dibuat: string;
}

const nadaCair = (s: StatusPencairan) => (s === 'dibayar' ? 'ok' : s === 'batal' ? 'mati' : 'tunggu');

export function Dana() {
  const [cari, setCari] = useSearchParams();
  const tab = cari.get('tab') === 'riwayat' ? 'riwayat' : 'posisi';
  const { pengguna } = useSesi();
  const admin = pengguna?.peran === 'admin';
  const r = useData<{ persen: number; daftar: Posisi[]; total: { siapCair: number; menunggu: number; dibayar: number } }>('/api/dana');
  const c = useData<{ daftar: Pencairan[] }>('/api/dana/pencairan');
  const [siapkan, setSiapkan] = useState<Posisi | null>(null);
  const [bayar, setBayar] = useState<Pencairan | null>(null);
  const [batal, setBatal] = useState<Pencairan | null>(null);
  const toast = useToast();
  const [sibukBatal, setSibukBatal] = useState(false);

  const muatUlang = async () => {
    await Promise.all([r.muatUlang(), c.muatUlang()]);
  };
  const menunggu = c.data?.daftar.filter((p) => p.status === 'disiapkan').length ?? 0;

  return (
    <>
      <KepalaHalaman
        judul="Dana UMKM"
        keterangan={
          r.data
            ? `Hak UMKM dihitung dari penjualan dikurangi retur${r.data.persen > 0 ? `, lalu dipotong jasa pengelola ${String(r.data.persen).replace('.', ',')}%` : ', tanpa potongan jasa'}.`
            : undefined
        }
      />
      {r.galat && !r.data && <GalatMuat galat={r.galat} ulang={r.muatUlang} />}
      {!r.data && !r.galat && <Memuat />}
      {r.data && (
        <>
          <dl className="metrik-deret" style={{ ['--kolom' as string]: 3 }}>
            <div className="metrik">
              <dt>Siap dicairkan</dt>
              <dd>{rupiah(r.data.total.siapCair)}</dd>
              <dd className="ket">{r.data.daftar.filter((d) => d.siapCair > 0).length} UMKM</dd>
            </div>
            <div className="metrik">
              <dt>Menunggu transfer</dt>
              <dd>{rupiah(r.data.total.menunggu)}</dd>
              <dd className="ket">{menunggu ? `${menunggu} pencairan perlu ditransfer` : 'Tidak ada yang tertunda'}</dd>
            </div>
            <div className="metrik">
              <dt>Sudah ditransfer</dt>
              <dd>{rupiah(r.data.total.dibayar)}</dd>
            </div>
          </dl>

          <div className="bilah-saring">
            <div className="segmen" role="tablist" aria-label="Tampilan dana">
              <button type="button" role="tab" aria-selected={tab === 'posisi'} onClick={() => setCari({}, { replace: true })}>
                Posisi per UMKM
              </button>
              <button type="button" role="tab" aria-selected={tab === 'riwayat'} onClick={() => setCari({ tab: 'riwayat' }, { replace: true })}>
                Riwayat pencairan {menunggu > 0 && <span className="hitung">{menunggu} menunggu</span>}
              </button>
            </div>
          </div>

          {tab === 'posisi' &&
            (r.data.daftar.length === 0 ? (
              <div className="bingkai-tabel">
                <Kosong judul="Belum ada UMKM binaan.">Posisi dana muncul setelah ada UMKM yang diterima dan produknya terjual.</Kosong>
              </div>
            ) : (
              <div className="bingkai-tabel">
                <table className="tabel tabel-susun">
                  <thead>
                    <tr>
                      <th scope="col">UMKM</th>
                      <th scope="col" className="angka">
                        Penjualan
                      </th>
                      <th scope="col" className="angka">
                        Retur
                      </th>
                      {r.data.persen > 0 && (
                        <th scope="col" className="angka">
                          Potongan
                        </th>
                      )}
                      <th scope="col" className="angka">
                        Siap dicairkan
                      </th>
                      <th scope="col">
                        <span className="sr-only">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.data.daftar.map((d) => (
                      <tr key={d.id}>
                        <td data-label="">
                          <Link to={`/kelola/umkm/${d.id}`} className="utama">
                            {d.namaUsaha}
                          </Link>
                          <span className="sub">{d.rekeningLengkap ? `${d.bank} · ${d.noRekening}` : <span className="teks-peringatan">Rekening belum lengkap</span>}</span>
                        </td>
                        <td data-label="Penjualan" className="angka">
                          <Uang n={d.bruto} />
                        </td>
                        <td data-label="Retur" className="angka">
                          {d.retur ? <Uang n={-d.retur} /> : '—'}
                        </td>
                        {r.data!.persen > 0 && (
                          <td data-label="Potongan" className="angka">
                            {d.potongan ? <Uang n={-d.potongan} /> : '—'}
                          </td>
                        )}
                        <td data-label="Siap dicairkan" className="angka tebal">
                          <Uang n={d.siapCair} />
                          {d.menungguTransfer > 0 && (
                            <span className="sub">
                              + <Uang n={d.menungguTransfer} /> menunggu
                            </span>
                          )}
                        </td>
                        <td data-label="" className="kanan">
                          {admin && d.siapCair > 0 && (
                            <Tombol kecil onClick={() => setSiapkan(d)}>
                              Siapkan pencairan
                            </Tombol>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

          {tab === 'riwayat' &&
            (!c.data ? (
              <Memuat />
            ) : c.data.daftar.length === 0 ? (
              <div className="bingkai-tabel">
                <Kosong judul="Belum ada pencairan.">Siapkan pencairan dari tab Posisi per UMKM saat dana sudah tersedia.</Kosong>
              </div>
            ) : (
              <div className="bingkai-tabel">
                <table className="tabel tabel-susun">
                  <thead>
                    <tr>
                      <th scope="col">Nomor</th>
                      <th scope="col">UMKM</th>
                      <th scope="col">Penjualan sampai</th>
                      <th scope="col" className="angka">
                        Jumlah
                      </th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="sr-only">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.data.daftar.map((p) => (
                      <tr key={p.id} className={p.status === 'batal' ? 'nonaktif' : undefined}>
                        <td data-label="" className="mono tebal">
                          {p.nomor}
                          <span className="sub">dibuat {tanggalJam(p.dibuat)}</span>
                        </td>
                        <td data-label="UMKM">{p.namaUsaha}</td>
                        <td data-label="Penjualan sampai" className="nowrap">
                          {tanggal(`${p.sampai}T05:00:00Z`)}
                        </td>
                        <td data-label="Jumlah" className="angka tebal">
                          <Uang n={p.jumlah} />
                        </td>
                        <td data-label="Status">
                          <Status nada={nadaCair(p.status)}>{STATUS_PENCAIRAN[p.status]}</Status>
                          {p.referensiTransfer && <span className="sub mono">{p.referensiTransfer}</span>}
                        </td>
                        <td data-label="" className="kanan">
                          {admin && p.status === 'disiapkan' && (
                            <div className="deret-tombol" style={{ justifyContent: 'flex-end' }}>
                              <Tombol kecil ragam="utama" onClick={() => setBayar(p)}>
                                Tandai sudah ditransfer
                              </Tombol>
                              <Tombol kecil ragam="halus" onClick={() => setBatal(p)}>
                                Batalkan
                              </Tombol>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </>
      )}
      <LembarSiapkan posisi={siapkan} persen={r.data?.persen ?? 0} tutup={() => setSiapkan(null)} selesai={muatUlang} />
      <LembarBayar pencairan={bayar} tutup={() => setBayar(null)} selesai={muatUlang} />
      <Konfirmasi
        buka={!!batal}
        judul={`Batalkan ${batal?.nomor ?? ''}?`}
        label="Batalkan pencairan"
        ragam="bahaya"
        sibuk={sibukBatal}
        batal={() => setBatal(null)}
        ya={async () => {
          if (!batal) return;
          setSibukBatal(true);
          try {
            await api('POST', `/api/dana/pencairan/${batal.id}/batal`);
            toast(`Pencairan ${batal.nomor} dibatalkan. Dananya kembali ke saldo siap dicairkan.`);
            setBatal(null);
            await muatUlang();
          } catch (e) {
            toast((e as Error).message, 'galat');
          } finally {
            setSibukBatal(false);
          }
        }}
      >
        <p className="redup">Gunakan bila transfer gagal atau data rekening keliru. Dana {rupiah(batal?.jumlah)} akan kembali ke saldo {batal?.namaUsaha}.</p>
      </Konfirmasi>
    </>
  );
}

function LembarSiapkan({ posisi, persen, tutup, selesai }: { posisi: Posisi | null; persen: number; tutup: () => void; selesai: () => Promise<void> }) {
  const toast = useToast();
  const [sampai, setSampai] = useState(tanggalWib());
  const [catatan, setCatatan] = useState('');
  const { sibuk, galat, kirim, atur } = useKirim();
  useEffect(() => {
    if (!posisi) return;
    setSampai(tanggalWib());
    setCatatan('');
    atur(null);
  }, [posisi, atur]);

  const simpan = async () => {
    const r = await kirim(() => api<{ nomor: string; jumlah: number }>('POST', '/api/dana/pencairan', { umkm_id: posisi!.id, sampai, catatan }));
    if (r) {
      toast(`Pencairan ${r.nomor} sebesar ${rupiah(r.jumlah)} disiapkan. Tandai setelah transfer dilakukan.`);
      tutup();
      await selesai();
    }
  };

  return (
    <Lembar
      buka={!!posisi}
      tutup={tutup}
      judul="Siapkan pencairan"
      keterangan={posisi?.namaUsaha}
      onSubmit={simpan}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" ragam="utama" sibuk={sibuk} disabled={!posisi?.rekeningLengkap}>
            Siapkan pencairan {posisi && sampai === tanggalWib() ? rupiah(posisi.siapCair) : ''}
          </Tombol>
        </>
      }
    >
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      {posisi && !posisi.rekeningLengkap && (
        <Pemberitahuan nada="tunggu">
          Data rekening belum lengkap. <Link to={`/kelola/umkm/${posisi.id}`}>Lengkapi di halaman UMKM</Link> sebelum menyiapkan pencairan.
        </Pemberitahuan>
      )}
      {posisi && (
        <dl className="rincian-uang">
          <dt>Penjualan belum dicairkan</dt>
          <dd className="angka">{rupiah(posisi.bruto)}</dd>
          <dt>Retur</dt>
          <dd className="angka">{rupiah(-posisi.retur)}</dd>
          {persen > 0 && (
            <>
              <dt>Potongan jasa {String(persen).replace('.', ',')}%</dt>
              <dd className="angka">{rupiah(-posisi.potongan)}</dd>
            </>
          )}
          <dt className="jumlah">Dicairkan</dt>
          <dd className="angka jumlah">{rupiah(posisi.siapCair)}</dd>
        </dl>
      )}
      {posisi?.rekeningLengkap && (
        <p className="kecil">
          Ditransfer ke {posisi.bank} <span className="mono">{posisi.noRekening}</span> atas nama {posisi.atasNama}.
        </p>
      )}
      <Bidang label="Hitung penjualan sampai tanggal" petunjuk="Rincian di atas dihitung sampai hari ini. Tanggal lebih awal akan dihitung ulang saat disimpan.">
        {(a) => <Masukan {...a} type="date" value={sampai} max={tanggalWib()} onChange={(e) => setSampai(e.target.value)} />}
      </Bidang>
      <Bidang label="Catatan" opsional>
        {(a) => <Area {...a} value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} placeholder="Misalnya pencairan pekan ketiga Oktober" />}
      </Bidang>
    </Lembar>
  );
}

function LembarBayar({ pencairan, tutup, selesai }: { pencairan: Pencairan | null; tutup: () => void; selesai: () => Promise<void> }) {
  const toast = useToast();
  const [ref, setRef] = useState('');
  const { sibuk, galat, bidang, kirim, atur } = useKirim();
  useEffect(() => {
    if (!pencairan) return;
    setRef('');
    atur(null);
  }, [pencairan, atur]);
  const simpan = async () => {
    if (!ref.trim()) return atur('Isi nomor referensi transfer dari bukti bank.', { ref: 'Nomor referensi wajib diisi.' });
    const ok = await kirim(() => api('POST', `/api/dana/pencairan/${pencairan!.id}/bayar`, { referensi_transfer: ref }));
    if (ok) {
      toast(`Pencairan ${pencairan!.nomor} ditandai sudah ditransfer.`);
      tutup();
      await selesai();
    }
  };
  return (
    <Lembar
      buka={!!pencairan}
      tutup={tutup}
      judul="Tandai sudah ditransfer"
      keterangan={pencairan ? `${pencairan.nomor} · ${pencairan.namaUsaha} · ${rupiah(pencairan.jumlah)}` : undefined}
      onSubmit={simpan}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            Simpan bukti transfer
          </Tombol>
        </>
      }
    >
      {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
      <Bidang label="Nomor referensi transfer" galat={bidang.ref} petunjuk="Salin dari bukti transfer atau mutasi rekening instansi.">
        {(a) => <Masukan {...a} value={ref} onChange={(e) => setRef(e.target.value)} className="mono" />}
      </Bidang>
    </Lembar>
  );
}
