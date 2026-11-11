import { useEffect, useState } from 'react';
import { Check, MessageCircle, Plus, Save, Trash2, Wallet } from 'lucide-react';
import { urlFoto } from '../../lib/foto';
import { kirim } from '../../lib/api';
import { useKirim, usePakai } from '../../lib/pakai';
import { useSesi } from '../../lib/sesi';
import { useToast } from '../../lib/toast';
import type { Kelas, Periode } from '../../lib/tipe';
import { Avatar, Bidang, GalatMuat, KepalaHalaman, Kosong, Lencana, Memuat, Modal, Stat, Tombol, useIngat, useJudul, useKonfirmasi } from '../../ui/dasar';
import { METODE_BAYAR } from '../../../shared/konstanta';
import { hariIni, namaBulan, namaBulanPendek, rupiah, tanggalPendek, tautanWa } from '../../../shared/format';

interface Bayar {
  id: number;
  nominal: number;
  tanggal: string;
  metode: keyof typeof METODE_BAYAR;
  catatan: string | null;
}
interface DataSyahriah {
  kelas: { id: number; nama: string };
  tahunAjaran: string;
  bulan: string[];
  bulanIni: string;
  nominal: number;
  total: number;
  daftar: { santriId: number; nis: string; nama: string; jk: string; fotoVersi: string | null; hp: string | null; bayar: Record<string, Bayar> }[];
}

export default function Syahriah() {
  useJudul('Syahriah');
  const toast = useToast();
  const tanya = useKonfirmasi();
  const { lembaga } = useSesi();
  const [kelasId, setKelasId] = useIngat('kelas-syahriah', '');
  const [ta, setTa] = useState('');
  const { data: kelas } = usePakai<{ daftar: Kelas[] }>('/api/admin/kelas');
  const { data: periode } = usePakai<{ daftar: Periode[] }>('/api/admin/periode');
  const tahunAjaran = [...new Set(periode?.daftar.map((p) => p.tahunAjaran) ?? [])];
  const taAktif = ta || periode?.daftar.find((p) => p.aktif)?.tahunAjaran || tahunAjaran[0] || '';
  useEffect(() => {
    const aktif = kelas?.daftar.filter((k) => k.aktif) ?? [];
    if (!kelasId && aktif.length) setKelasId(String(aktif[0].id));
  }, [kelas, kelasId, setKelasId]);

  const { data, galat, muatUlang } = usePakai<DataSyahriah>(kelasId && taAktif ? `/api/admin/syahriah?kelas=${kelasId}&tahunAjaran=${encodeURIComponent(taAktif)}` : null);
  const [catat, setCatat] = useState<{ santriId: number; bulan: string } | null>(null);
  const [lihat, setLihat] = useState<{ nama: string; bulan: string; bayar: Bayar } | null>(null);

  const tunggakan = (s: DataSyahriah['daftar'][number]) => (data ? data.bulan.filter((b) => b <= data.bulanIni && !s.bayar[b]) : []);
  const lunasBulanIni = data?.daftar.filter((s) => s.bayar[data.bulanIni]).length ?? 0;

  const batalkan = async () => {
    if (!lihat) return;
    if (!(await tanya({ judul: 'Batalkan catatan pembayaran?', pesan: `${lihat.nama} · ${namaBulan(lihat.bulan)} · ${rupiah(lihat.bayar.nominal)}`, ya: 'Batalkan', bahaya: true }))) return;
    try {
      await kirim('DELETE', `/api/admin/syahriah/${lihat.bayar.id}`);
      toast.tampil('Catatan pembayaran dibatalkan.');
      setLihat(null);
      muatUlang();
    } catch (e) {
      toast.galat(e);
    }
  };

  return (
    <>
      <KepalaHalaman kecil="Keuangan" judul="Syahriah" sub="Catat iuran bulanan santri. Wali santri melihat status lunas setiap bulan dari aplikasinya." />
      <div className="saringan">
        <select className="masukan" value={kelasId} onChange={(e) => setKelasId(e.target.value)} aria-label="Kelas">
          {kelas?.daftar
            .filter((k) => k.aktif)
            .map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
        </select>
        <select className="masukan" value={taAktif} onChange={(e) => setTa(e.target.value)} aria-label="Tahun ajaran">
          {tahunAjaran.map((t) => (
            <option key={t} value={t}>
              Tahun ajaran {t}
            </option>
          ))}
        </select>
      </div>
      {data && (
        <div className="grid-3">
          <Stat ikon={<Wallet />} label={`Terkumpul ${data.tahunAjaran}`} nilai={rupiah(data.total)} sub={data.kelas.nama} emas />
          <Stat ikon={<Check />} label={`Lunas ${namaBulan(data.bulanIni)}`} nilai={`${lunasBulanIni}/${data.daftar.length}`} sub="santri sudah membayar bulan ini" />
          <Stat ikon={<Wallet />} label="Iuran per bulan" nilai={data.nominal ? rupiah(data.nominal) : '–'} sub={data.nominal ? 'Ubah di Pengaturan' : 'Atur nominal di Pengaturan'} />
        </div>
      )}
      <section className="kaca">
        {galat ? (
          <GalatMuat galat={galat} ulang={muatUlang} />
        ) : !data ? (
          <div style={{ padding: 16 }}>
            <Memuat baris={6} />
          </div>
        ) : !data.daftar.length ? (
          <Kosong ikon={<Wallet />} judul="Kelas ini belum punya santri" />
        ) : (
          <div className="tabel-bungkus">
            <table className="tabel tabel--rapat tabel-syahriah">
              <thead>
                <tr>
                  <th className="kolom-tetap">Santri</th>
                  {data.bulan.map((b) => (
                    <th key={b} className={`tengah ${b === data.bulanIni ? 'kolom-kini' : ''}`}>
                      {namaBulanPendek(b)}
                    </th>
                  ))}
                  <th className="kanan">Tunggakan</th>
                </tr>
              </thead>
              <tbody>
                {data.daftar.map((s) => {
                  const kurang = tunggakan(s);
                  return (
                    <tr key={s.santriId}>
                      <td className="kolom-tetap">
                        <div className="baris">
                          <Avatar nama={s.nama} jk={s.jk} ukuran={30} foto={urlFoto(s.santriId, s.fotoVersi)} />
                          <span className="potong" style={{ maxWidth: 170 }}>
                            {s.nama}
                          </span>
                        </div>
                      </td>
                      {data.bulan.map((b) => {
                        const x = s.bayar[b];
                        return (
                          <td key={b} className={`tengah ${b === data.bulanIni ? 'kolom-kini' : ''}`}>
                            {x ? (
                              <button className="sel-bayar sel-bayar--lunas" onClick={() => setLihat({ nama: s.nama, bulan: b, bayar: x })} title={`${rupiah(x.nominal)} · ${tanggalPendek(x.tanggal)}`} aria-label={`${namaBulan(b)} lunas`}>
                                <Check />
                              </button>
                            ) : (
                              <button
                                className={`sel-bayar ${b <= data.bulanIni ? 'sel-bayar--tunggak' : ''}`}
                                onClick={() => setCatat({ santriId: s.santriId, bulan: b })}
                                aria-label={`Catat ${namaBulan(b)} untuk ${s.nama}`}
                              >
                                <Plus />
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="kanan nowrap">
                        {kurang.length ? (
                          <span className="baris" style={{ justifyContent: 'flex-end', gap: 6 }}>
                            <Lencana jenis="bahaya">{kurang.length} bulan</Lencana>
                            {s.hp && (
                              <a
                                className="tombol tombol--kecil tombol--hantu tombol--ikon"
                                href={tautanWa(
                                  s.hp,
                                  `Assalamu'alaikum, Bapak/Ibu wali ${s.nama}. Kami mengingatkan syahriah ${lembaga.singkatan} bulan ${kurang.map(namaBulan).join(', ')} belum tercatat` +
                                    (data.nominal ? ` (${rupiah(data.nominal)}/bulan)` : '') +
                                    `. Bila sudah membayar, mohon abaikan pesan ini. Jazakumullahu khairan.`,
                                )}
                                target="_blank"
                                rel="noreferrer"
                                title="Ingatkan lewat WhatsApp"
                                aria-label={`Ingatkan wali ${s.nama}`}
                              >
                                <MessageCircle />
                              </a>
                            )}
                          </span>
                        ) : (
                          <Lencana jenis="ok">Lunas</Lencana>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {catat && data && (
        <CatatBayar
          data={data}
          santriId={catat.santriId}
          bulanAwal={catat.bulan}
          tutup={() => setCatat(null)}
          selesai={() => {
            setCatat(null);
            muatUlang();
          }}
        />
      )}
      {lihat && (
        <Modal
          judul={`${namaBulan(lihat.bulan)} · lunas`}
          sub={lihat.nama}
          tutup={() => setLihat(null)}
          kaki={
            <>
              <Tombol varian="bahaya" ikon={<Trash2 />} onClick={batalkan}>
                Batalkan catatan
              </Tombol>
              <Tombol onClick={() => setLihat(null)}>Tutup</Tombol>
            </>
          }
        >
          <dl className="daftar-data">
            <dt>Nominal</dt>
            <dd className="angka">{rupiah(lihat.bayar.nominal)}</dd>
            <dt>Tanggal bayar</dt>
            <dd>{tanggalPendek(lihat.bayar.tanggal)}</dd>
            <dt>Metode</dt>
            <dd>{METODE_BAYAR[lihat.bayar.metode]}</dd>
            {lihat.bayar.catatan && (
              <>
                <dt>Catatan</dt>
                <dd>{lihat.bayar.catatan}</dd>
              </>
            )}
          </dl>
        </Modal>
      )}
    </>
  );
}

function CatatBayar({ data, santriId, bulanAwal, tutup, selesai }: { data: DataSyahriah; santriId: number; bulanAwal: string; tutup: () => void; selesai: () => void }) {
  const toast = useToast();
  const s = data.daftar.find((x) => x.santriId === santriId)!;
  const { sibuk, bidang, jalankan } = useKirim();
  const [bulan, setBulan] = useState<Set<string>>(new Set([bulanAwal]));
  const [f, setF] = useState({ nominal: String(data.nominal || ''), tanggalBayar: hariIni(), metode: 'tunai', catatan: '' });
  const simpan = () =>
    jalankan(async () => {
      await kirim('POST', '/api/admin/syahriah', { santriId, bulan: [...bulan].sort(), nominal: Number(f.nominal), tanggalBayar: f.tanggalBayar, metode: f.metode, catatan: f.catatan });
      toast.tampil(`Syahriah ${s.nama} untuk ${bulan.size} bulan dicatat.`);
      selesai();
    }).catch(toast.galat);
  return (
    <Modal
      judul="Catat pembayaran syahriah"
      sub={s.nama}
      tutup={tutup}
      onSubmit={simpan}
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" varian="utama" ikon={<Save />} sibuk={sibuk} disabled={!bulan.size}>
            Simpan {bulan.size > 1 ? `${bulan.size} bulan · ${rupiah(Number(f.nominal || 0) * bulan.size)}` : ''}
          </Tombol>
        </>
      }
    >
      <div className="tumpuk">
        <Bidang label="Bulan yang dibayar" galat={bidang.bulan} grup>
          <div className="pilih-bulan">
            {data.bulan.map((b) => {
              const lunas = !!s.bayar[b];
              return (
                <button
                  key={b}
                  type="button"
                  disabled={lunas}
                  aria-pressed={bulan.has(b)}
                  className={lunas ? 'lunas' : ''}
                  onClick={() => {
                    const n = new Set(bulan);
                    if (n.has(b)) n.delete(b);
                    else n.add(b);
                    setBulan(n);
                  }}
                >
                  {namaBulanPendek(b)}
                  <small>{b.slice(2, 4)}</small>
                </button>
              );
            })}
          </div>
        </Bidang>
        <div className="grid-2">
          <Bidang label="Nominal per bulan" wajib galat={bidang.nominal}>
            <input className="masukan angka" inputMode="numeric" value={f.nominal} onChange={(e) => setF({ ...f, nominal: e.target.value.replace(/\D/g, '') })} required />
          </Bidang>
          <Bidang label="Tanggal bayar" wajib galat={bidang.tanggalBayar}>
            <input className="masukan" type="date" value={f.tanggalBayar} max={hariIni()} onChange={(e) => setF({ ...f, tanggalBayar: e.target.value })} />
          </Bidang>
          <Bidang label="Metode">
            <select className="masukan" value={f.metode} onChange={(e) => setF({ ...f, metode: e.target.value })}>
              {Object.entries(METODE_BAYAR).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Bidang>
          <Bidang label="Catatan">
            <input className="masukan" value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })} />
          </Bidang>
        </div>
      </div>
    </Modal>
  );
}
