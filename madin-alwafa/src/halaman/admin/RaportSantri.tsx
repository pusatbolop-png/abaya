import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ChevronLeft, ChevronRight, Printer, Save, Send, Undo2 } from 'lucide-react';
import { kirim } from '../../lib/api';
import { usePakai } from '../../lib/pakai';
import { useSesi } from '../../lib/sesi';
import { useToast } from '../../lib/toast';
import type { DataRaport } from '../../lib/tipe';
import { Avatar, Bidang, GalatMuat, Lencana, Memuat, Pesan, Tombol, useJudul, useKonfirmasi } from '../../ui/dasar';
import { KertasSkala } from '../raport/KertasSkala';
import { LembarRaport } from '../raport/LembarRaport';
import type { DaftarRaport } from './Raport';
import { ASPEK_KEPRIBADIAN, NILAI_KEPRIBADIAN, type NilaiKepribadian } from '../../../shared/konstanta';
import { namaSemester, waktu } from '../../../shared/format';

const CONTOH_CATATAN = [
  "Alhamdulillah, ananda menunjukkan prestasi yang sangat baik dan akhlak yang terpuji. Pertahankan semangat belajar dan muraja'ah hafalannya.",
  "Ananda rajin dan tekun mengikuti pelajaran. Tingkatkan ketelitian menulis pegon dan perbanyak muraja'ah di rumah.",
  'Ananda perlu lebih giat belajar dan hadir tepat waktu. Mohon bimbingan Bapak/Ibu dalam mengulang pelajaran di rumah.',
];

export default function RaportSantri() {
  const { santriId, periodeId } = useParams();
  const { pengurus } = useSesi();
  const admin = pengurus?.peran === 'admin';
  const toast = useToast();
  const tanya = useKonfirmasi();
  const navigasi = useNavigate();
  const { data, galat, muatUlang } = usePakai<DataRaport>(`/api/admin/raport/${santriId}/${periodeId}`);
  const { data: kelasRaport } = usePakai<DaftarRaport>(data?.kelas ? `/api/admin/raport?kelas=${data.kelas.id}&periode=${periodeId}` : null);
  useJudul(data ? `Raport ${data.santri.nama}` : 'Raport');

  const [f, setF] = useState<{ nilai: Record<string, NilaiKepribadian | null>; catatan: string; keputusan: string }>({ nilai: {}, catatan: '', keputusan: '' });
  const [berubah, setBerubah] = useState(false);
  const [sibuk, setSibuk] = useState<'simpan' | 'terbit' | 'tarik' | null>(null);

  useEffect(() => {
    if (!data) return;
    setF({
      nilai: Object.fromEntries(data.kepribadian.map((k) => [k.kunci, k.nilai])),
      catatan: data.catatan ?? '',
      keputusan: data.keputusan ?? '',
    });
    setBerubah(false);
  }, [data]);

  if (galat) return <GalatMuat galat={galat} ulang={muatUlang} />;
  if (!data) return <Memuat baris={4} tinggi={120} />;

  const terbit = data.status === 'terbit';
  const urutan = kelasRaport?.daftar ?? [];
  const posisi = urutan.findIndex((d) => d.santriId === Number(santriId));
  const sebelum = posisi > 0 ? urutan[posisi - 1] : null;
  const sesudah = posisi >= 0 && posisi < urutan.length - 1 ? urutan[posisi + 1] : null;

  // Pratinjau langsung memakai isian yang sedang diketik.
  const pratinjau: DataRaport = terbit
    ? data
    : {
        ...data,
        kepribadian: data.kepribadian.map((k) => ({ ...k, nilai: f.nilai[k.kunci] ?? null, keterangan: f.nilai[k.kunci] ? NILAI_KEPRIBADIAN[f.nilai[k.kunci]!] : null })),
        catatan: f.catatan.trim() || null,
        keputusan: f.keputusan.trim() || null,
      };

  const simpan = async () => {
    setSibuk('simpan');
    try {
      await kirim('PUT', '/api/admin/raport/isian', {
        periodeId: Number(periodeId),
        daftar: [{ santriId: Number(santriId), ...f.nilai, catatan: f.catatan, ...(data.periode.semester === 2 ? { keputusan: f.keputusan } : {}) }],
      });
      toast.tampil('Isian raport disimpan.');
      muatUlang();
      return true;
    } catch (e) {
      toast.galat(e);
      return false;
    } finally {
      setSibuk(null);
    }
  };

  const terbitkan = async () => {
    if (berubah && !(await simpan())) return;
    if (!(await tanya({ judul: `Terbitkan raport ${data.santri.nama}?`, pesan: 'Wali santri langsung bisa membuka raport ini. Nilai dan isian raport terkunci sampai raport ditarik.', ya: 'Terbitkan' }))) return;
    setSibuk('terbit');
    try {
      const r = await kirim<{ terbit: unknown[]; gagal: { alasan: string[] }[] }>('POST', '/api/admin/raport/terbitkan', { periodeId: Number(periodeId), santriIds: [Number(santriId)] });
      if (r.gagal.length) toast.tampil(r.gagal[0].alasan.join(' '), 'galat');
      else toast.tampil('Raport diterbitkan dan bisa dilihat wali santri.');
      muatUlang();
    } catch (e) {
      toast.galat(e);
    } finally {
      setSibuk(null);
    }
  };

  const tarik = async () => {
    if (!(await tanya({ judul: 'Tarik raport untuk diperbaiki?', pesan: 'Wali santri tidak bisa membuka raport ini sampai diterbitkan kembali. Kode verifikasinya tetap sama dan akan menampilkan status "sedang diperbaiki".', ya: 'Tarik raport', bahaya: true }))) return;
    setSibuk('tarik');
    try {
      await kirim('POST', '/api/admin/raport/tarik', { periodeId: Number(periodeId), santriId: Number(santriId) });
      toast.tampil('Raport ditarik. Nilai dan isian bisa diubah kembali.');
      muatUlang();
    } catch (e) {
      toast.galat(e);
    } finally {
      setSibuk(null);
    }
  };

  return (
    <>
      <div className="baris baris--antara baris--bungkus">
        <Link to={`/admin/raport?kelas=${data.kelas?.id ?? ''}&periode=${periodeId}`} className="tautan-kembali">
          <ArrowLeft /> Raport {data.kelas?.nama}
        </Link>
        {urutan.length > 1 && (
          <div className="baris">
            <Tombol ukuran="kecil" varian="hantu" ikon={<ChevronLeft />} disabled={!sebelum} onClick={() => sebelum && navigasi(`/admin/raport/${sebelum.santriId}/${periodeId}`)}>
              Sebelumnya
            </Tombol>
            <span className="redup-2 kecil angka">
              {posisi + 1}/{urutan.length}
            </span>
            <Tombol ukuran="kecil" varian="hantu" onClick={() => sesudah && navigasi(`/admin/raport/${sesudah.santriId}/${periodeId}`)} disabled={!sesudah}>
              Berikutnya <ChevronRight />
            </Tombol>
          </div>
        )}
      </div>

      <section className="kaca kaca--pad kepala-raport">
        <Avatar nama={data.santri.nama} jk={data.santri.jk} ukuran={56} />
        <div className="isi-penuh tumpuk tumpuk--rapat" style={{ gap: 4 }}>
          <div className="baris baris--bungkus" style={{ gap: 8 }}>
            {terbit ? <Lencana jenis="ok">Terbit {waktu(data.diterbitkan)}</Lencana> : data.kekurangan.length ? <Lencana jenis="waspada">Draf · belum lengkap</Lencana> : <Lencana jenis="emas">Draf · siap terbit</Lencana>}
          </div>
          <h1 className="judul-hias" style={{ fontSize: 32 }}>
            {data.santri.nama}
          </h1>
          <div className="redup kecil">
            Semester {namaSemester(data.periode.semester)} {data.periode.tahunAjaran} · {data.kelas?.nama} · rata-rata <b className="angka">{data.rataRata?.toLocaleString('id-ID') ?? '–'}</b>
            {data.peringkat && ` · peringkat ${data.peringkat} dari ${data.jumlahSantri}`}
          </div>
        </div>
        <div className="baris baris--bungkus">
          <Tombol ikon={<Printer />} onClick={() => window.print()}>
            Cetak
          </Tombol>
          {admin && terbit && (
            <Tombol varian="bahaya" ikon={<Undo2 />} onClick={tarik} sibuk={sibuk === 'tarik'}>
              Tarik
            </Tombol>
          )}
          {admin && !terbit && (
            <Tombol varian="utama" ikon={<Send />} onClick={terbitkan} sibuk={sibuk === 'terbit'} disabled={data.kekurangan.length > 0}>
              Terbitkan
            </Tombol>
          )}
        </div>
      </section>

      <div className="tata-raport">
        {!terbit && (
          <section className="kaca kaca--pad tumpuk" style={{ alignSelf: 'start' }}>
            {data.kekurangan.length > 0 && (
              <Pesan jenis="waspada" judul="Belum bisa diterbitkan">
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {data.kekurangan.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </Pesan>
            )}
            <div className="kartu-judul" style={{ marginBottom: 0 }}>
              <h2>Kepribadian</h2>
            </div>
            {ASPEK_KEPRIBADIAN.map((a) => (
              <div key={a.kunci} className="baris baris--antara">
                <span>
                  {a.label}{' '}
                  <span className="arab redup-2" style={{ fontSize: 16 }}>
                    {a.arab}
                  </span>
                </span>
                <div className="segmen" role="radiogroup" aria-label={a.label}>
                  {(Object.keys(NILAI_KEPRIBADIAN) as NilaiKepribadian[]).map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={f.nilai[a.kunci] === n}
                      title={NILAI_KEPRIBADIAN[n]}
                      onClick={() => {
                        setF({ ...f, nilai: { ...f.nilai, [a.kunci]: n } });
                        setBerubah(true);
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Bidang label="Catatan wali kelas">
              <textarea
                className="masukan"
                rows={4}
                value={f.catatan}
                onChange={(e) => {
                  setF({ ...f, catatan: e.target.value });
                  setBerubah(true);
                }}
                placeholder="Pesan untuk santri dan wali…"
              />
            </Bidang>
            <div className="baris baris--bungkus" style={{ gap: 6 }}>
              {CONTOH_CATATAN.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  className="tombol tombol--kecil tombol--hantu"
                  onClick={() => {
                    setF({ ...f, catatan: c });
                    setBerubah(true);
                  }}
                  title={c}
                >
                  Contoh {i + 1}
                </button>
              ))}
            </div>
            {data.periode.semester === 2 && (
              <Bidang label="Keputusan" bantu="Contoh: Naik ke kelas Ula 2 Putri / Tinggal di kelas Ula 1 Putri / Lulus.">
                <input
                  className="masukan"
                  value={f.keputusan}
                  onChange={(e) => {
                    setF({ ...f, keputusan: e.target.value });
                    setBerubah(true);
                  }}
                />
              </Bidang>
            )}
            <Tombol varian="zamrud" ikon={<Save />} sibuk={sibuk === 'simpan'} onClick={simpan} disabled={!berubah}>
              Simpan isian
            </Tombol>
            <p className="redup-2 kecil">Nilai mata pelajaran diisi di menu Nilai. Kehadiran dan hafalan diambil otomatis dari catatan semester ini.</p>
          </section>
        )}
        <div className="area-cetak">
          <KertasSkala>
            <LembarRaport d={pratinjau} />
          </KertasSkala>
        </div>
      </div>
    </>
  );
}
