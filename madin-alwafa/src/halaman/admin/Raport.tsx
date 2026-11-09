import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { BadgeCheck, Eye, Printer, ScrollText, Send, SlidersHorizontal } from 'lucide-react';
import { kirim } from '../../lib/api';
import { usePakai } from '../../lib/pakai';
import { useSesi } from '../../lib/sesi';
import { useToast } from '../../lib/toast';
import type { Kelas, Periode } from '../../lib/tipe';
import { Avatar, GalatMuat, KepalaHalaman, Kosong, Lencana, Memuat, Modal, Pesan, Tombol, useIngat, useJudul, useKonfirmasi } from '../../ui/dasar';
import { ASPEK_KEPRIBADIAN, NILAI_KEPRIBADIAN } from '../../../shared/konstanta';
import { namaSemester, waktu } from '../../../shared/format';

export interface BarisRaport {
  santriId: number;
  nis: string;
  nama: string;
  jk: string;
  rataRata: number | null;
  peringkat: number | null;
  status: 'draf' | 'terbit';
  kode: string | null;
  kekurangan: string[];
  nilaiTerisi: number;
  jumlahMapel: number;
  dibacaWali: string | null;
  isian: { akhlak: string | null; kerajinan: string | null; kerapian: string | null; kedisiplinan: string | null; catatan: string | null; keputusan: string | null };
}
export interface DaftarRaport {
  kelas: { id: number; nama: string; waliKelas: string | null };
  periode: { id: number; tahunAjaran: string; semester: number };
  daftar: BarisRaport[];
}

export default function RaportKelas() {
  useJudul('Raport');
  const { pengurus } = useSesi();
  const admin = pengurus?.peran === 'admin';
  const toast = useToast();
  const tanya = useKonfirmasi();
  const navigasi = useNavigate();
  const [param, setParam] = useSearchParams();
  const [kelasIngat, setKelasIngat] = useIngat('kelas-raport', '');
  const { data: kelas } = usePakai<{ daftar: Kelas[] }>('/api/admin/kelas');
  const { data: periode } = usePakai<{ daftar: Periode[] }>('/api/admin/periode');
  const kelasId = param.get('kelas') ?? kelasIngat;
  const periodeId = param.get('periode') ?? String(periode?.daftar.find((p) => p.aktif)?.id ?? periode?.daftar[0]?.id ?? '');
  const kelasAktif = (kelas?.daftar ?? []).filter((k) => k.aktif);
  useEffect(() => {
    if (!kelasId && kelasAktif.length) setKelasIngat(String(kelasAktif[0].id));
  }, [kelasId, kelasAktif, setKelasIngat]);
  const atur = (k: string, v: string) => {
    if (k === 'kelas') setKelasIngat(v);
    const p = new URLSearchParams(param);
    p.set(k, v);
    setParam(p, { replace: true });
  };

  const { data, galat, muatUlang } = usePakai<DaftarRaport>(kelasId && periodeId ? `/api/admin/raport?kelas=${kelasId}&periode=${periodeId}` : null);
  const [isiMassal, setIsiMassal] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<{ terbit: { nama: string }[]; gagal: { nama: string; alasan: string[] }[] } | null>(null);

  const siap = data?.daftar.filter((d) => d.status === 'draf' && !d.kekurangan.length) ?? [];
  const terbit = data?.daftar.filter((d) => d.status === 'terbit') ?? [];
  const belum = data?.daftar.filter((d) => d.status === 'draf' && d.kekurangan.length) ?? [];

  const terbitkan = async () => {
    if (!data || !siap.length) return;
    const ya = await tanya({
      judul: `Terbitkan ${siap.length} raport?`,
      pesan: (
        <>
          Raport yang terbit langsung bisa dilihat wali santri dan diberi kode verifikasi. Nilai dan isian raport terkunci sampai raport ditarik kembali.
          {belum.length > 0 && <> {belum.length} raport yang belum lengkap tidak ikut diterbitkan.</>}
        </>
      ),
      ya: 'Terbitkan',
    });
    if (!ya) return;
    setSibuk(true);
    try {
      const r = await kirim<{ terbit: { nama: string }[]; gagal: { nama: string; alasan: string[] }[] }>('POST', '/api/admin/raport/terbitkan', {
        periodeId: data.periode.id,
        santriIds: siap.map((s) => s.santriId),
      });
      setHasil(r);
      muatUlang();
    } catch (e) {
      toast.galat(e);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <>
      <KepalaHalaman
        kecil="Raport online"
        judul="Raport"
        sub="Lengkapi kepribadian dan catatan wali kelas, periksa pratinjau, lalu terbitkan. Wali santri menerima raport bersegel kode QR."
        aksi={
          data && (
            <>
              <Tombol ikon={<SlidersHorizontal />} onClick={() => setIsiMassal(true)} disabled={!data.daftar.some((d) => d.status === 'draf')}>
                Isi kepribadian
              </Tombol>
              <Tombol ikon={<Printer />} onClick={() => window.open(`/admin/raport/${data.kelas.id}/${data.periode.id}/cetak`, '_blank')} disabled={!data.daftar.length}>
                Cetak semua
              </Tombol>
              {admin && (
                <Tombol varian="utama" ikon={<Send />} onClick={terbitkan} disabled={!siap.length} sibuk={sibuk}>
                  Terbitkan {siap.length || ''}
                </Tombol>
              )}
            </>
          )
        }
      />
      <div className="saringan">
        <select className="masukan" value={kelasId} onChange={(e) => atur('kelas', e.target.value)} aria-label="Kelas">
          {!kelasId && <option value="">Pilih kelas</option>}
          {kelas?.daftar.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nama}
            </option>
          ))}
        </select>
        {periode && (
          <select className="masukan" value={periodeId} onChange={(e) => atur('periode', e.target.value)} aria-label="Semester">
            {periode.daftar.map((p) => (
              <option key={p.id} value={p.id}>
                Semester {namaSemester(p.semester)} {p.tahunAjaran}
              </option>
            ))}
          </select>
        )}
        {data && (
          <div className="baris baris--bungkus kecil" style={{ gap: 6 }}>
            <Lencana jenis="ok" titik>
              {terbit.length} terbit
            </Lencana>
            <Lencana jenis="emas" titik>
              {siap.length} siap terbit
            </Lencana>
            <Lencana jenis="waspada" titik>
              {belum.length} belum lengkap
            </Lencana>
          </div>
        )}
      </div>

      {hasil && (
        <Pesan jenis={hasil.gagal.length ? 'waspada' : 'ok'} judul={`${hasil.terbit.length} raport diterbitkan`}>
          {hasil.gagal.length ? `${hasil.gagal.length} belum bisa diterbitkan: ${hasil.gagal.map((g) => g.nama).join(', ')}.` : 'Wali santri sudah bisa membuka raport dari aplikasi.'}
        </Pesan>
      )}

      <section className="kaca">
        {galat ? (
          <GalatMuat galat={galat} ulang={muatUlang} />
        ) : !data ? (
          <div style={{ padding: 16 }}>
            <Memuat baris={6} />
          </div>
        ) : !data.daftar.length ? (
          <Kosong ikon={<ScrollText />} judul="Belum ada santri" pesan="Kelas ini belum punya santri pada semester ini." />
        ) : (
          <div className="tabel-bungkus">
            <table className="tabel tabel--responsif">
              <thead>
                <tr>
                  <th>Santri</th>
                  <th className="tengah">Nilai</th>
                  <th className="tengah">Rata-rata</th>
                  <th className="tengah">Peringkat</th>
                  <th>Status</th>
                  <th>Wali</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.daftar.map((d) => (
                  <tr key={d.santriId} className="bisa-klik" onClick={() => navigasi(`/admin/raport/${d.santriId}/${data.periode.id}`)}>
                    <td data-sel="utama">
                      <div className="baris">
                        <Avatar nama={d.nama} jk={d.jk} ukuran={36} />
                        <div style={{ display: 'grid', minWidth: 0 }}>
                          <b className="potong">{d.nama}</b>
                          <span className="redup-2 kecil angka">NIS {d.nis}</span>
                        </div>
                      </div>
                    </td>
                    <td className="tengah angka" data-label="Nilai">
                      {d.nilaiTerisi}/{d.jumlahMapel}
                    </td>
                    <td className="tengah angka tebal" data-label="Rata-rata">
                      {d.rataRata?.toLocaleString('id-ID') ?? '–'}
                    </td>
                    <td className="tengah angka" data-label="Peringkat">
                      {d.peringkat ?? '–'}
                    </td>
                    <td data-label="Status">
                      {d.status === 'terbit' ? (
                        <Lencana jenis="ok">
                          <BadgeCheck /> Terbit
                        </Lencana>
                      ) : d.kekurangan.length ? (
                        <span title={d.kekurangan.join('\n')}>
                          <Lencana jenis="waspada">Belum lengkap</Lencana>
                        </span>
                      ) : (
                        <Lencana jenis="emas">Siap terbit</Lencana>
                      )}
                    </td>
                    <td data-label="Wali" className="kecil redup">
                      {d.status === 'terbit' ? (d.dibacaWali ? `Dibuka ${waktu(d.dibacaWali)}` : 'Belum dibuka') : '–'}
                    </td>
                    <td className="kanan">
                      <Tombol varian="hantu" ukuran="kecil" ikon={<Eye />} aria-label={`Buka raport ${d.nama}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isiMassal && data && (
        <IsiKepribadian
          data={data}
          tutup={() => setIsiMassal(false)}
          selesai={() => {
            setIsiMassal(false);
            muatUlang();
          }}
        />
      )}
    </>
  );
}

function IsiKepribadian({ data, tutup, selesai }: { data: DaftarRaport; tutup: () => void; selesai: () => void }) {
  const toast = useToast();
  const draf = data.daftar.filter((d) => d.status === 'draf');
  const genap = data.periode.semester === 2;
  const [isian, setIsian] = useState(() => Object.fromEntries(draf.map((d) => [d.santriId, { ...d.isian }])));
  const [sibuk, setSibuk] = useState(false);
  const setel = (id: number, k: string, v: string | null) => setIsian({ ...isian, [id]: { ...isian[id], [k]: v } });

  const simpan = async () => {
    setSibuk(true);
    try {
      const r = await kirim<{ berubah: number }>('PUT', '/api/admin/raport/isian', {
        periodeId: data.periode.id,
        daftar: draf.map((d) => {
          const v = isian[d.santriId];
          return {
            santriId: d.santriId,
            akhlak: v.akhlak,
            kerajinan: v.kerajinan,
            kerapian: v.kerapian,
            kedisiplinan: v.kedisiplinan,
            ...(genap ? { keputusan: v.keputusan } : {}),
          };
        }),
      });
      toast.tampil(r.berubah ? `Isian ${r.berubah} raport disimpan.` : 'Tidak ada perubahan.');
      selesai();
    } catch (e) {
      toast.galat(e);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <Modal
      judul={`Kepribadian · ${data.kelas.nama}`}
      sub={`A: ${NILAI_KEPRIBADIAN.A} · B: ${NILAI_KEPRIBADIAN.B} · C: ${NILAI_KEPRIBADIAN.C} · D: ${NILAI_KEPRIBADIAN.D}`}
      tutup={tutup}
      lebar
      kaki={
        <>
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol varian="utama" sibuk={sibuk} onClick={simpan}>
            Simpan semua
          </Tombol>
        </>
      }
    >
      <div className="tabel-bungkus">
        <table className="tabel tabel--rapat">
          <thead>
            <tr>
              <th>Santri</th>
              {ASPEK_KEPRIBADIAN.map((a) => (
                <th key={a.kunci} className="tengah">
                  {a.label}
                </th>
              ))}
              {genap && <th>Keputusan</th>}
            </tr>
          </thead>
          <tbody>
            {draf.map((d) => (
              <tr key={d.santriId}>
                <td>
                  <span className="potong" style={{ display: 'block', maxWidth: 180 }}>
                    {d.nama}
                  </span>
                </td>
                {ASPEK_KEPRIBADIAN.map((a) => (
                  <td key={a.kunci} className="tengah">
                    <select
                      className="masukan masukan--kecil angka"
                      style={{ width: 64 }}
                      value={isian[d.santriId][a.kunci] ?? ''}
                      onChange={(e) => setel(d.santriId, a.kunci, e.target.value || null)}
                      aria-label={`${a.label} ${d.nama}`}
                    >
                      <option value="">–</option>
                      {Object.keys(NILAI_KEPRIBADIAN).map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </td>
                ))}
                {genap && (
                  <td>
                    <input
                      className="masukan masukan--kecil"
                      style={{ minWidth: 190 }}
                      value={isian[d.santriId].keputusan ?? ''}
                      onChange={(e) => setel(d.santriId, 'keputusan', e.target.value || null)}
                      placeholder="Naik ke kelas …"
                      aria-label={`Keputusan ${d.nama}`}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!draf.length && <p className="redup">Semua raport kelas ini sudah terbit.</p>}
    </Modal>
  );
}
