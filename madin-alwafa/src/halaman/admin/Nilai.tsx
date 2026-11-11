import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSaringan } from '../../lib/saringan';
import { ArrowLeft, Lock, NotebookPen, Save } from 'lucide-react';
import { kirim } from '../../lib/api';
import { usePakai } from '../../lib/pakai';
import { useToast } from '../../lib/toast';
import type { Periode } from '../../lib/tipe';
import { Avatar, Bilah, GalatMuat, KepalaHalaman, Kosong, Lencana, Memuat, Tombol, useJudul } from '../../ui/dasar';
import { nilaiAkhir, predikat, type Bobot } from '../../../shared/konstanta';
import { namaSemester } from '../../../shared/format';

interface Progres {
  periode: { id: number; tahunAjaran: string; semester: number };
  bobot: Bobot;
  daftar: { kelasId: number; kelas: string; mapelId: number; mapel: string; pengajar: string | null; santri: number; harian: number; uts: number; uas: number; lengkap: number }[];
}
interface DataNilai {
  kelas: { id: number; nama: string };
  mapel: { id: number; nama: string; namaArab: string | null; kkm: number; pengajar: string | null };
  periode: { id: number; tahunAjaran: string; semester: number };
  bobot: Bobot;
  daftar: { santriId: number; nis: string; nama: string; jk: string; harian: number | null; uts: number | null; uas: number | null; akhir: number | null; terkunci: boolean }[];
}

const KOMPONEN = [
  { k: 'harian', label: 'Harian' },
  { k: 'uts', label: 'UTS' },
  { k: 'uas', label: 'UAS' },
] as const;

export default function Nilai() {
  useJudul('Nilai');
  const [param, aturParam] = useSaringan();
  const kelas = param.get('kelas');
  const mapel = param.get('mapel');
  const periodeParam = param.get('periode');
  const { data: periode } = usePakai<{ daftar: Periode[] }>('/api/admin/periode');
  const periodeId = periodeParam ?? String(periode?.daftar.find((p) => p.aktif)?.id ?? periode?.daftar[0]?.id ?? '');
  // Masuk/keluar tabel nilai dicatat di riwayat agar tombol kembali peramban berfungsi.
  const atur = (v: Record<string, string | null>) => aturParam(v, { ganti: false });

  return (
    <>
      <KepalaHalaman
        kecil="Kegiatan belajar"
        judul="Nilai"
        sub="Isi nilai harian, ujian tengah semester, dan ujian akhir semester. Nilai akhir, predikat, dan terbilang dihitung otomatis untuk raport."
        aksi={
          periode && (
            <select className="masukan" value={periodeId} onChange={(e) => atur({ periode: e.target.value })} aria-label="Semester" style={{ minWidth: 230 }}>
              {periode.daftar.map((p) => (
                <option key={p.id} value={p.id}>
                  Semester {namaSemester(p.semester)} {p.tahunAjaran}
                  {p.aktif ? ' (aktif)' : ''}
                </option>
              ))}
            </select>
          )
        }
      />
      {periodeId &&
        (kelas && mapel ? (
          <InputNilai key={`${kelas}-${mapel}-${periodeId}`} kelasId={kelas} mapelId={mapel} periodeId={periodeId} kembali={() => atur({ kelas: null, mapel: null })} />
        ) : (
          <Ikhtisar periodeId={periodeId} pilih={(k, m) => atur({ kelas: String(k), mapel: String(m) })} />
        ))}
    </>
  );
}

function Ikhtisar({ periodeId, pilih }: { periodeId: string; pilih: (kelas: number, mapel: number) => void }) {
  const { data, galat, muatUlang } = usePakai<Progres>(`/api/admin/nilai/progres?periode=${periodeId}`);
  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!data) return <Memuat baris={3} tinggi={160} />;
  if (!data.daftar.length)
    return (
      <div className="kaca">
        <Kosong ikon={<NotebookPen />} judul="Belum ada pelajaran di kelas mana pun" pesan="Atur pelajaran setiap kelas di menu Kelas & pelajaran." />
      </div>
    );
  const kelompok = new Map<number, Progres['daftar']>();
  data.daftar.forEach((d) => kelompok.set(d.kelasId, [...(kelompok.get(d.kelasId) ?? []), d]));
  const komponen = KOMPONEN.filter((k) => data.bobot[k.k] > 0);
  return (
    <div className="grid-2">
      {[...kelompok.values()].map((baris) => {
        const lengkap = baris.reduce((s, b) => s + b.lengkap, 0);
        const harus = baris.reduce((s, b) => s + b.santri, 0);
        return (
          <section key={baris[0].kelasId} className="kaca kaca--pad">
            <div className="kartu-judul">
              <h2>{baris[0].kelas}</h2>
              <Lencana jenis={harus && lengkap === harus ? 'ok' : 'waspada'}>{harus ? Math.round((lengkap / harus) * 100) : 0}% lengkap</Lencana>
            </div>
            <div className="tumpuk tumpuk--rapat">
              {baris.map((b) => (
                <button key={b.mapelId} className="baris-progres" onClick={() => pilih(b.kelasId, b.mapelId)}>
                  <span className="isi-penuh" style={{ display: 'grid', textAlign: 'left' }}>
                    <b>{b.mapel}</b>
                    <span className="redup-2 kecil">{b.pengajar ?? 'Pengajar belum diatur'}</span>
                  </span>
                  <span className="komponen-mini">
                    {komponen.map((k) => (
                      <span key={k.k} className={b[k.k] >= b.santri && b.santri ? 'penuh' : b[k.k] ? 'sebagian' : ''} title={`${k.label}: ${b[k.k]}/${b.santri}`}>
                        {k.label}
                      </span>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

type Isian = Record<number, { harian: string; uts: string; uas: string }>;

function InputNilai({ kelasId, mapelId, periodeId, kembali }: { kelasId: string; mapelId: string; periodeId: string; kembali: () => void }) {
  const toast = useToast();
  const { data, galat, muatUlang } = usePakai<DataNilai>(`/api/admin/nilai?kelas=${kelasId}&mapel=${mapelId}&periode=${periodeId}`);
  const { data: detailKelas } = usePakai<{ mapel: { mapelId: number; nama: string }[] }>(`/api/admin/kelas/${kelasId}`);
  const [, aturParam] = useSaringan();
  const [isian, setIsian] = useState<Isian>({});
  const [berubah, setBerubah] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const tabel = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (!data) return;
    setIsian(Object.fromEntries(data.daftar.map((d) => [d.santriId, { harian: d.harian?.toString() ?? '', uts: d.uts?.toString() ?? '', uas: d.uas?.toString() ?? '' }])));
    setBerubah(false);
  }, [data]);

  const angka = (s: string) => (s.trim() === '' ? null : Number(s));
  const akhir = (id: number) => (isian[id] && data ? nilaiAkhir({ harian: angka(isian[id].harian), uts: angka(isian[id].uts), uas: angka(isian[id].uas) }, data.bobot) : null);

  const statistik = useMemo(() => {
    if (!data) return null;
    const semua = data.daftar.map((d) => akhir(d.santriId)).filter((x): x is number => x !== null);
    if (!semua.length) return null;
    return {
      rata: Math.round((semua.reduce((a, b) => a + b, 0) / semua.length) * 10) / 10,
      maks: Math.max(...semua),
      min: Math.min(...semua),
      kurang: semua.filter((x) => x < data.mapel.kkm).length,
      jumlah: semua.length,
    };
  }, [isian, data]);

  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!data) return <Memuat baris={6} />;
  const komponen = KOMPONEN.filter((k) => data.bobot[k.k] > 0);
  const salah = (s: string) => s.trim() !== '' && (!/^\d{1,3}$/.test(s.trim()) || Number(s) > 100);
  const adaSalah = Object.values(isian).some((v) => komponen.some((k) => salah(v[k.k])));

  const simpan = async () => {
    if (adaSalah) return toast.tampil('Ada nilai yang tidak valid. Isi angka bulat 0–100.', 'galat');
    setSibuk(true);
    try {
      const r = await kirim<{ berubah: number }>('PUT', '/api/admin/nilai', {
        periodeId: Number(periodeId),
        kelasId: Number(kelasId),
        mapelId: Number(mapelId),
        daftar: data.daftar
          .filter((d) => !d.terkunci)
          .map((d) => ({ santriId: d.santriId, harian: angka(isian[d.santriId].harian), uts: angka(isian[d.santriId].uts), uas: angka(isian[d.santriId].uas) })),
      });
      toast.tampil(r.berubah ? `Nilai ${r.berubah} santri disimpan.` : 'Tidak ada perubahan.');
      muatUlang();
    } catch (e) {
      toast.galat(e);
    } finally {
      setSibuk(false);
    }
  };

  // Enter berpindah ke baris berikutnya pada kolom yang sama.
  const tekan = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const sel = e.currentTarget;
    const kolom = sel.dataset.kolom;
    const semua = [...(tabel.current?.querySelectorAll<HTMLInputElement>(`input[data-kolom="${kolom}"]:not(:disabled)`) ?? [])];
    const i = semua.indexOf(sel);
    const tujuan = semua[e.key === 'ArrowUp' ? i - 1 : i + 1];
    if (tujuan) {
      tujuan.focus();
      tujuan.select();
    } else if (e.key === 'Enter') {
      const kolomBerikut = komponen[komponen.findIndex((k) => k.k === kolom) + 1];
      const awal = kolomBerikut && tabel.current?.querySelector<HTMLInputElement>(`input[data-kolom="${kolomBerikut.k}"]:not(:disabled)`);
      awal?.focus();
      awal?.select();
    }
  };

  return (
    <>
      <div className="baris baris--bungkus">
        <Tombol varian="hantu" ikon={<ArrowLeft />} onClick={kembali}>
          Semua kelas
        </Tombol>
        <select
          className="masukan masukan--kecil"
          style={{ width: 'auto' }}
          value={mapelId}
          onChange={(e) => aturParam({ mapel: e.target.value })}
          aria-label="Pelajaran"
        >
          {(detailKelas?.mapel ?? [{ mapelId: data.mapel.id, nama: data.mapel.nama }]).map((m) => (
            <option key={m.mapelId} value={m.mapelId}>
              {m.nama}
            </option>
          ))}
        </select>
      </div>
      <section className="kaca">
        <div className="kepala-panel">
          <div className="baris" style={{ gap: 14 }}>
            <div>
              <div className="baris" style={{ gap: 12 }}>
                <b style={{ fontSize: 18 }}>{data.mapel.nama}</b>
                {data.mapel.namaArab && (
                  <span className="arab" style={{ fontSize: 20, color: 'var(--emas-300)' }}>
                    {data.mapel.namaArab}
                  </span>
                )}
              </div>
              <div className="redup-2 kecil">
                {data.kelas.nama} · {data.mapel.pengajar ?? 'pengajar belum diatur'} · KKM {data.mapel.kkm} · bobot {komponen.map((k) => `${k.label} ${data.bobot[k.k]}%`).join(', ')}
              </div>
            </div>
          </div>
          {statistik && (
            <div className="baris baris--bungkus kecil" style={{ gap: 6 }}>
              <Lencana jenis="emas">Rata-rata {statistik.rata.toLocaleString('id-ID')}</Lencana>
              <Lencana>
                {statistik.min}–{statistik.maks}
              </Lencana>
              {statistik.kurang > 0 && <Lencana jenis="bahaya">{statistik.kurang} di bawah KKM</Lencana>}
            </div>
          )}
        </div>
        <div className="tabel-bungkus">
          <table className="tabel tabel-nilai" ref={tabel}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Santri</th>
                {komponen.map((k) => (
                  <th key={k.k} className="tengah">
                    {k.label}
                  </th>
                ))}
                <th className="tengah">Akhir</th>
                <th>Predikat</th>
              </tr>
            </thead>
            <tbody>
              {data.daftar.map((d, i) => {
                const a = akhir(d.santriId);
                const p = a === null ? null : predikat(a);
                const v = isian[d.santriId];
                if (!v) return null;
                return (
                  <tr key={d.santriId} className={d.terkunci ? 'baris-terkunci' : ''}>
                    <td className="redup-2 angka">{i + 1}</td>
                    <td>
                      <div className="baris">
                        <Avatar nama={d.nama} jk={d.jk} ukuran={32} />
                        <span className="potong" style={{ maxWidth: 220 }}>
                          {d.nama}
                        </span>
                        {d.terkunci && (
                          <span title="Raport sudah terbit; tarik raport untuk mengubah nilai.">
                            <Lock style={{ width: 14, color: 'var(--emas-300)' }} />
                          </span>
                        )}
                      </div>
                    </td>
                    {komponen.map((k) => (
                      <td key={k.k} className="tengah">
                        <input
                          className="masukan masukan--kecil masukan-nilai angka"
                          inputMode="numeric"
                          data-kolom={k.k}
                          value={v[k.k]}
                          disabled={d.terkunci}
                          aria-invalid={salah(v[k.k]) || undefined}
                          aria-label={`${k.label} ${d.nama}`}
                          onFocus={(e) => e.currentTarget.select()}
                          onKeyDown={tekan}
                          onChange={(e) => {
                            setIsian({ ...isian, [d.santriId]: { ...v, [k.k]: e.target.value.replace(/[^\d]/g, '').slice(0, 3) } });
                            setBerubah(true);
                          }}
                        />
                      </td>
                    ))}
                    <td className="tengah">
                      <b className={`angka nilai-akhir ${a !== null && a < data.mapel.kkm ? 'nilai-akhir--kurang' : ''}`}>{a ?? '–'}</b>
                    </td>
                    <td>
                      {p ? (
                        <span className="baris" style={{ gap: 8 }}>
                          <span className="kecil">{p.nama}</span>
                          <span className="arab redup" style={{ fontSize: 16 }}>
                            {p.arab}
                          </span>
                        </span>
                      ) : (
                        <span className="redup-2">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="kaki-simpan">
          <div className="tumpuk tumpuk--rapat isi-penuh" style={{ gap: 6, maxWidth: 360 }}>
            <span className="kecil redup">
              {statistik?.jumlah ?? 0} dari {data.daftar.length} santri punya nilai akhir
            </span>
            <Bilah persen={((statistik?.jumlah ?? 0) / Math.max(1, data.daftar.length)) * 100} label="Santri yang sudah punya nilai akhir" />
          </div>
          <div className="baris">
            {berubah && <Lencana jenis="waspada">Belum disimpan</Lencana>}
            <Tombol varian="utama" ikon={<Save />} sibuk={sibuk} onClick={simpan}>
              Simpan nilai
            </Tombol>
          </div>
        </div>
      </section>
    </>
  );
}
