import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BookOpenCheck, Plus, Save, Trash2 } from 'lucide-react';
import { kirim } from '../../lib/api';
import { useKirim, usePakai } from '../../lib/pakai';
import { useSaringan } from '../../lib/saringan';
import { useToast } from '../../lib/toast';
import type { Hafalan as THafalan, Kelas, Santri } from '../../lib/tipe';
import { Avatar, Bidang, GalatMuat, KepalaHalaman, Kosong, Lencana, Memuat, Modal, Stat, Tombol, useJudul, useKonfirmasi } from '../../ui/dasar';
import { JENIS_HAFALAN, PREDIKAT_HAFALAN, type PredikatHafalan } from '../../../shared/konstanta';
import { hariIni, tanggalPendek } from '../../../shared/format';

export const warnaPredikat = (p: PredikatHafalan) => (p === 'lancar' ? 'ok' : p === 'cukup' ? 'waspada' : 'bahaya');

export default function Hafalan() {
  useJudul('Hafalan');
  const toast = useToast();
  const tanya = useKonfirmasi();
  const [param, aturParam] = useSaringan();
  const santriParam = param.get('santri');
  const [kelas, setKelas] = useState('');
  const [jenis, setJenis] = useState('');
  const [catat, setCatat] = useState<number | 'baru' | null>(santriParam ? Number(santriParam) : null);
  const url = `/api/admin/hafalan?${new URLSearchParams({ ...(kelas && { kelas }), ...(jenis && { jenis }), ...(santriParam && { santri: santriParam }) })}`;
  const { data, galat, muatUlang } = usePakai<{ daftar: THafalan[]; ringkasan: { total: number; lancar: number; pekan: number } }>(url);
  const { data: dataKelas } = usePakai<{ daftar: Kelas[] }>('/api/admin/kelas');

  const hapus = async (h: THafalan) => {
    if (!(await tanya({ judul: 'Hapus catatan setoran?', pesan: `${h.nama}: ${h.materi} (${tanggalPendek(h.tanggal)})`, ya: 'Hapus', bahaya: true }))) return;
    try {
      await kirim('DELETE', `/api/admin/hafalan/${h.id}`);
      toast.tampil('Catatan dihapus.');
      muatUlang();
    } catch (e) {
      toast.galat(e);
    }
  };

  const namaSantri = santriParam && data?.daftar[0]?.nama;

  return (
    <>
      <KepalaHalaman
        kecil="Tahfidz"
        judul="Hafalan"
        sub="Catat setoran Al-Qur'an, nadzom, serta do'a dan hadits. Setoran yang lancar otomatis tampil sebagai capaian di raport."
        aksi={
          <Tombol varian="utama" ikon={<Plus />} onClick={() => setCatat(santriParam ? Number(santriParam) : 'baru')}>
            Catat setoran
          </Tombol>
        }
      />
      {data && (
        <div className="grid-3">
          <Stat ikon={<BookOpenCheck />} label="Seluruh setoran" nilai={data.ringkasan.total} sub="Sejak awal pencatatan" />
          <Stat ikon={<BookOpenCheck />} label="Lancar" nilai={data.ringkasan.total ? `${Math.round((data.ringkasan.lancar / data.ringkasan.total) * 100)}%` : '–'} sub={`${data.ringkasan.lancar} setoran lancar`} />
          <Stat ikon={<BookOpenCheck />} label="Sepekan terakhir" nilai={data.ringkasan.pekan} sub="Setoran dalam 7 hari" emas />
        </div>
      )}
      <div className="saringan">
        {santriParam ? (
          <Lencana jenis="emas">
            {namaSantri ?? 'Santri terpilih'}{' '}
            <button
              className="tombol-tutup-lencana"
              onClick={() => aturParam({ santri: null })}
              aria-label="Hapus saringan santri"
            >
              ×
            </button>
          </Lencana>
        ) : (
          <select className="masukan" value={kelas} onChange={(e) => setKelas(e.target.value)} aria-label="Kelas">
            <option value="">Semua kelas</option>
            {dataKelas?.daftar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        )}
        <div className="segmen" role="tablist">
          {['', ...JENIS_HAFALAN].map((j) => (
            <button key={j} role="tab" aria-selected={jenis === j} onClick={() => setJenis(j)}>
              {j || 'Semua'}
            </button>
          ))}
        </div>
      </div>
      <section className="kaca">
        {galat ? (
          <GalatMuat galat={galat} ulang={muatUlang} />
        ) : !data ? (
          <div style={{ padding: 16 }}>
            <Memuat baris={6} />
          </div>
        ) : !data.daftar.length ? (
          <Kosong
            ikon={<BookOpenCheck />}
            judul={kelas || jenis || santriParam ? 'Tidak ada setoran yang cocok' : 'Belum ada setoran'}
            pesan={kelas || jenis ? 'Ubah saringan kelas atau jenis hafalan.' : 'Catat setoran hafalan pertama.'}
          />
        ) : (
          <div className="tabel-bungkus">
            <table className="tabel tabel--responsif">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Santri</th>
                  <th>Materi</th>
                  <th>Predikat</th>
                  <th>Penyimak</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.daftar.map((h) => (
                  <tr key={h.id}>
                    <td className="angka nowrap" data-label="Tanggal">
                      {tanggalPendek(h.tanggal)}
                    </td>
                    <td data-sel="utama">
                      <Link to={`/admin/santri/${h.santriId}`} className="baris" style={{ color: 'inherit', textDecoration: 'none' }}>
                        <Avatar nama={h.nama!} jk={h.jk} ukuran={32} />
                        <span style={{ display: 'grid', minWidth: 0 }}>
                          <b className="potong">{h.nama}</b>
                          <span className="redup-2 kecil">{h.kelas}</span>
                        </span>
                      </Link>
                    </td>
                    <td data-label="Materi">
                      <div style={{ display: 'grid' }}>
                        <span>{h.materi}</span>
                        <span className="redup-2 kecil">
                          {h.jenis}
                          {h.catatan && ` · ${h.catatan}`}
                        </span>
                      </div>
                    </td>
                    <td data-label="Predikat">
                      <Lencana jenis={warnaPredikat(h.predikat)}>{PREDIKAT_HAFALAN[h.predikat]}</Lencana>
                    </td>
                    <td className="redup kecil" data-label="Penyimak">
                      {h.penyimak ?? '–'}
                    </td>
                    <td className="kanan">
                      <Tombol varian="hantu" ukuran="kecil" ikon={<Trash2 />} onClick={() => hapus(h)} aria-label="Hapus catatan" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {catat !== null && (
        <CatatSetoran
          santriAwal={catat === 'baru' ? null : catat}
          tutup={() => setCatat(null)}
          selesai={() => {
            muatUlang();
          }}
        />
      )}
    </>
  );
}

function CatatSetoran({ santriAwal, tutup, selesai }: { santriAwal: number | null; tutup: () => void; selesai: () => void }) {
  const toast = useToast();
  const { data: santri } = usePakai<{ daftar: Santri[] }>('/api/admin/santri');
  const { sibuk, bidang, jalankan } = useKirim();
  const [kelas, setKelas] = useState('');
  const [f, setF] = useState({ santriId: santriAwal ? String(santriAwal) : '', tanggal: hariIni(), jenis: JENIS_HAFALAN[0] as string, materi: '', predikat: 'lancar' as PredikatHafalan, catatan: '' });

  const daftarKelas = useMemo(() => [...new Map((santri?.daftar ?? []).filter((s) => s.kelasId).map((s) => [s.kelasId, s.kelasNama])).entries()], [santri]);
  useEffect(() => {
    if (santriAwal && santri) setKelas(String(santri.daftar.find((s) => s.id === santriAwal)?.kelasId ?? ''));
  }, [santriAwal, santri]);
  const pilihan = (santri?.daftar ?? []).filter((s) => !kelas || String(s.kelasId) === kelas);

  const simpan = (lagi: boolean) =>
    jalankan(async () => {
      await kirim('POST', '/api/admin/hafalan', { ...f, santriId: Number(f.santriId) });
      const nama = santri?.daftar.find((s) => String(s.id) === f.santriId)?.nama;
      toast.tampil(`Setoran ${nama ?? ''} dicatat.`);
      selesai();
      if (lagi) setF({ ...f, santriId: '', materi: '', catatan: '', predikat: 'lancar' });
      else tutup();
    }).catch(toast.galat);

  return (
    <Modal
      judul="Catat setoran hafalan"
      tutup={tutup}
      onSubmit={() => simpan(false)}
      kaki={
        <>
          <Tombol onClick={() => simpan(true)} sibuk={sibuk} disabled={!f.santriId || !f.materi}>
            Simpan & catat lagi
          </Tombol>
          <Tombol type="submit" varian="utama" ikon={<Save />} sibuk={sibuk} disabled={!f.santriId || !f.materi}>
            Simpan
          </Tombol>
        </>
      }
    >
      <div className="grid-2">
        <Bidang label="Kelas">
          <select className="masukan" value={kelas} onChange={(e) => setKelas(e.target.value)}>
            <option value="">Semua kelas</option>
            {daftarKelas.map(([id, nama]) => (
              <option key={id} value={id!}>
                {nama}
              </option>
            ))}
          </select>
        </Bidang>
        <Bidang label="Santri" wajib galat={bidang.santriId}>
          <select className="masukan" value={f.santriId} onChange={(e) => setF({ ...f, santriId: e.target.value })} required>
            <option value="">Pilih santri</option>
            {pilihan.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
              </option>
            ))}
          </select>
        </Bidang>
        <Bidang label="Jenis" wajib>
          <select className="masukan" value={f.jenis} onChange={(e) => setF({ ...f, jenis: e.target.value })}>
            {JENIS_HAFALAN.map((j) => (
              <option key={j}>{j}</option>
            ))}
          </select>
        </Bidang>
        <Bidang label="Tanggal" wajib galat={bidang.tanggal}>
          <input className="masukan" type="date" value={f.tanggal} max={hariIni()} onChange={(e) => setF({ ...f, tanggal: e.target.value })} />
        </Bidang>
        <Bidang label="Materi" wajib galat={bidang.materi} className="bentang-2" bantu="Contoh: Surat An-Naba' 1–20 · 'Aqidatul 'Awam bait 1–10 · Do'a sebelum belajar">
          <input className="masukan" value={f.materi} onChange={(e) => setF({ ...f, materi: e.target.value })} required />
        </Bidang>
        <Bidang label="Predikat" wajib className="bentang-2" grup>
          <div className="segmen" role="radiogroup" style={{ width: '100%' }}>
            {(Object.keys(PREDIKAT_HAFALAN) as PredikatHafalan[]).map((p) => (
              <button key={p} type="button" role="radio" aria-checked={f.predikat === p} onClick={() => setF({ ...f, predikat: p })} style={{ flex: 1, justifyContent: 'center' }}>
                {PREDIKAT_HAFALAN[p]}
              </button>
            ))}
          </div>
        </Bidang>
        <Bidang label="Catatan" className="bentang-2">
          <input className="masukan" value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })} placeholder="Mis. perbaiki makhraj huruf 'ain" />
        </Bidang>
      </div>
    </Modal>
  );
}
