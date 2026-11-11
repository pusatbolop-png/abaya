import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BookMarked, CalendarClock, GraduationCap, Pencil, Plus, Save, School, Trash2, Users } from 'lucide-react';
import { urlFoto } from '../../lib/foto';
import { kirim } from '../../lib/api';
import { useKirim, usePakai } from '../../lib/pakai';
import { useSesi } from '../../lib/sesi';
import { useToast } from '../../lib/toast';
import type { Kelas as TKelas } from '../../lib/tipe';
import { Avatar, Bidang, GalatMuat, KepalaHalaman, Kosong, Lencana, Memuat, Modal, Sakelar, Tombol, useIngat, useJudul, useKonfirmasi } from '../../ui/dasar';
import { BAGIAN_KELAS, HARI, JENJANG } from '../../../shared/konstanta';

interface Mapel {
  id: number;
  nama: string;
  namaArab: string | null;
  kitab: string | null;
  urutan: number;
  kkm: number;
  jumlahKelas: number;
}

interface DetailKelas {
  kelas: Omit<TKelas, 'putra' | 'putri' | 'jumlahMapel'>;
  mapel: { mapelId: number; nama: string; namaArab: string | null; kitab: string | null; kkm: number; pengajar: string | null }[];
  jadwal: { id: number; hari: number; jamMulai: string; jamSelesai: string; mapelId: number; mapel: string; pengajar: string | null }[];
  santri: { id: number; nis: string; nama: string; jk: string; fotoVersi: string | null }[];
}

export default function Kelas() {
  useJudul('Kelas & pelajaran');
  const { pengurus } = useSesi();
  const admin = pengurus?.peran === 'admin';
  const [tab, setTab] = useIngat<'kelas' | 'mapel'>('tab-kelas', 'kelas');
  const kelas = usePakai<{ daftar: TKelas[] }>('/api/admin/kelas');
  const mapel = usePakai<{ daftar: Mapel[] }>('/api/admin/mapel');
  const [buka, setBuka] = useState<number | 'baru' | null>(null);
  const [formMapel, setFormMapel] = useState<Mapel | 'baru' | null>(null);

  return (
    <>
      <KepalaHalaman
        kecil="Struktur madrasah"
        judul="Kelas & pelajaran"
        sub="Atur kelas putra dan putri, mata pelajaran beserta kitabnya, pengajar, dan jadwal pekanan."
        aksi={
          admin &&
          (tab === 'kelas' ? (
            <Tombol varian="utama" ikon={<Plus />} onClick={() => setBuka('baru')}>
              Tambah kelas
            </Tombol>
          ) : (
            <Tombol varian="utama" ikon={<Plus />} onClick={() => setFormMapel('baru')}>
              Tambah pelajaran
            </Tombol>
          ))
        }
      />
      <div className="segmen" role="tablist">
        <button role="tab" aria-selected={tab === 'kelas'} onClick={() => setTab('kelas')}>
          <School /> Kelas
        </button>
        <button role="tab" aria-selected={tab === 'mapel'} onClick={() => setTab('mapel')}>
          <BookMarked /> Mata pelajaran
        </button>
      </div>

      {tab === 'kelas' ? (
        kelas.galat ? (
          <GalatMuat galat={kelas.galat} ulang={kelas.muatUlang} />
        ) : !kelas.data ? (
          <Memuat baris={3} tinggi={120} />
        ) : !kelas.data.daftar.length ? (
          <div className="kaca">
            <Kosong ikon={<School />} judul="Belum ada kelas" pesan="Buat kelas, misalnya Ula 1 Putra dan Ula 1 Putri." />
          </div>
        ) : (
          <div className="grid-kelas">
            {kelas.data.daftar.map((k) => (
              <button key={k.id} className={`kaca kartu-kelas ${k.aktif ? '' : 'kartu-kelas--nonaktif'}`} onClick={() => setBuka(k.id)}>
                <div className="baris baris--antara">
                  <Lencana jenis={k.bagian === 'putri' ? 'putri' : k.bagian === 'putra' ? 'putra' : 'emas'}>{BAGIAN_KELAS[k.bagian]}</Lencana>
                  {!k.aktif && <Lencana>Nonaktif</Lencana>}
                </div>
                <div>
                  <div className="kartu-kelas__nama">{k.nama}</div>
                  <div className="redup-2 kecil">
                    {k.jenjang} · tingkat {k.tingkat}
                    {k.ruang && ` · ${k.ruang}`}
                  </div>
                </div>
                <div className="kartu-kelas__wali">
                  <GraduationCap />
                  <span className="potong">{k.waliKelas ?? 'Wali kelas belum diatur'}</span>
                </div>
                <div className="kartu-kelas__angka">
                  <span>
                    <b className="angka">{k.putra + k.putri}</b> santri
                  </span>
                  <span>
                    <b className="angka">{k.jumlahMapel}</b> pelajaran
                  </span>
                </div>
              </button>
            ))}
          </div>
        )
      ) : mapel.galat ? (
        <GalatMuat galat={mapel.galat} ulang={mapel.muatUlang} />
      ) : !mapel.data ? (
        <Memuat />
      ) : (
        <section className="kaca">
          {mapel.data.daftar.length ? (
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Mata pelajaran</th>
                    <th>Kitab</th>
                    <th className="tengah">KKM</th>
                    <th className="tengah">Dipakai</th>
                    {admin && <th />}
                  </tr>
                </thead>
                <tbody>
                  {mapel.data.daftar.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="baris baris--antara" style={{ gap: 16 }}>
                          <b>{m.nama}</b>
                          {m.namaArab && (
                            <span className="arab" style={{ fontSize: 19, color: 'var(--emas-300)' }}>
                              {m.namaArab}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="redup">{m.kitab ?? '–'}</td>
                      <td className="tengah angka">{m.kkm}</td>
                      <td className="tengah redup">{m.jumlahKelas} kelas</td>
                      {admin && (
                        <td className="kanan">
                          <Tombol varian="hantu" ukuran="kecil" ikon={<Pencil />} onClick={() => setFormMapel(m)} aria-label={`Ubah ${m.nama}`} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Kosong ikon={<BookMarked />} judul="Belum ada mata pelajaran" pesan="Tambahkan pelajaran seperti Al-Qur'an, Fiqih, Tauhid, dan Nahwu." />
          )}
        </section>
      )}

      {buka !== null && (
        <LaciKelas
          id={buka}
          admin={admin}
          semuaMapel={mapel.data?.daftar ?? []}
          tutup={() => setBuka(null)}
          berubah={() => {
            kelas.muatUlang();
            mapel.muatUlang();
          }}
          dibuat={(id) => setBuka(id)}
        />
      )}
      {formMapel && (
        <FormMapel
          mapel={formMapel === 'baru' ? undefined : formMapel}
          tutup={() => setFormMapel(null)}
          selesai={() => {
            setFormMapel(null);
            mapel.muatUlang();
          }}
        />
      )}
    </>
  );
}

function FormMapel({ mapel, tutup, selesai }: { mapel?: Mapel; tutup: () => void; selesai: () => void }) {
  const toast = useToast();
  const tanya = useKonfirmasi();
  const { sibuk, bidang, jalankan } = useKirim();
  const [f, setF] = useState({
    nama: mapel?.nama ?? '',
    namaArab: mapel?.namaArab ?? '',
    kitab: mapel?.kitab ?? '',
    urutan: String(mapel?.urutan ?? 100),
    kkm: String(mapel?.kkm ?? 65),
  });
  const simpan = () =>
    jalankan(async () => {
      const isi = { ...f, urutan: Number(f.urutan) || 0, kkm: Number(f.kkm) };
      if (mapel) await kirim('PUT', `/api/admin/mapel/${mapel.id}`, isi);
      else await kirim('POST', '/api/admin/mapel', isi);
      toast.tampil(`${f.nama} disimpan.`);
      selesai();
    }).catch(toast.galat);
  const hapus = async () => {
    if (!mapel || !(await tanya({ judul: `Hapus ${mapel.nama}?`, pesan: 'Pelajaran yang sudah dipakai kelas atau punya nilai tidak bisa dihapus.', ya: 'Hapus', bahaya: true }))) return;
    try {
      await kirim('DELETE', `/api/admin/mapel/${mapel.id}`);
      toast.tampil(`${mapel.nama} dihapus.`);
      selesai();
    } catch (e) {
      toast.galat(e);
    }
  };
  return (
    <Modal
      judul={mapel ? `Ubah ${mapel.nama}` : 'Tambah mata pelajaran'}
      tutup={tutup}
      onSubmit={simpan}
      kaki={
        <>
          {mapel && (
            <Tombol varian="hantu" ikon={<Trash2 />} onClick={hapus} style={{ marginRight: 'auto' }}>
              Hapus
            </Tombol>
          )}
          <Tombol onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" varian="utama" sibuk={sibuk} ikon={<Save />}>
            Simpan
          </Tombol>
        </>
      }
    >
      <div className="grid-2">
        <Bidang label="Nama pelajaran" wajib galat={bidang.nama}>
          <input className="masukan" value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} placeholder="Fiqih" required />
        </Bidang>
        <Bidang label="Nama Arab" galat={bidang.namaArab}>
          <input className="masukan arab" dir="rtl" value={f.namaArab} onChange={(e) => setF({ ...f, namaArab: e.target.value })} placeholder="الفقه" style={{ fontSize: 19 }} />
        </Bidang>
        <Bidang label="Kitab" galat={bidang.kitab} className="bentang-2">
          <input className="masukan" value={f.kitab} onChange={(e) => setF({ ...f, kitab: e.target.value })} placeholder="Safinatun Najah" />
        </Bidang>
        <Bidang label="KKM" wajib galat={bidang.kkm} bantu="Nilai minimal tuntas (0–100).">
          <input className="masukan angka" type="number" min={0} max={100} value={f.kkm} onChange={(e) => setF({ ...f, kkm: e.target.value })} required />
        </Bidang>
        <Bidang label="Urutan di raport" galat={bidang.urutan} bantu="Angka kecil tampil lebih dulu.">
          <input className="masukan angka" type="number" min={0} max={999} value={f.urutan} onChange={(e) => setF({ ...f, urutan: e.target.value })} />
        </Bidang>
      </div>
    </Modal>
  );
}

function LaciKelas({
  id,
  admin,
  semuaMapel,
  tutup,
  berubah,
  dibuat,
}: {
  id: number | 'baru';
  admin: boolean;
  semuaMapel: Mapel[];
  tutup: () => void;
  berubah: () => void;
  dibuat: (id: number) => void;
}) {
  const toast = useToast();
  const tanya = useKonfirmasi();
  const baru = id === 'baru';
  const { data, muatUlang } = usePakai<DetailKelas>(baru ? null : `/api/admin/kelas/${id}`);
  const [tab, setTab] = useState<'data' | 'mapel' | 'jadwal' | 'santri'>(baru ? 'data' : 'mapel');
  const { sibuk, bidang, jalankan } = useKirim();

  const [f, setF] = useState({ nama: '', jenjang: 'Ula', tingkat: '1', bagian: 'putra', waliKelas: '', ruang: '', aktif: true });
  const [pilihMapel, setPilihMapel] = useState<Record<number, { pakai: boolean; pengajar: string }>>({});
  const [jadwal, setJadwal] = useState<{ hari: number; jamMulai: string; jamSelesai: string; mapelId: number }[]>([]);

  useEffect(() => {
    if (!data) return;
    const k = data.kelas;
    setF({ nama: k.nama, jenjang: k.jenjang, tingkat: String(k.tingkat), bagian: k.bagian, waliKelas: k.waliKelas ?? '', ruang: k.ruang ?? '', aktif: !!k.aktif });
    setPilihMapel(Object.fromEntries(data.mapel.map((m) => [m.mapelId, { pakai: true, pengajar: m.pengajar ?? '' }])));
    setJadwal(data.jadwal.map((j) => ({ hari: j.hari, jamMulai: j.jamMulai, jamSelesai: j.jamSelesai, mapelId: j.mapelId })));
  }, [data]);

  const simpanData = () =>
    jalankan(async () => {
      const isi = { ...f, tingkat: Number(f.tingkat) };
      if (baru) {
        const r = await kirim<{ id: number }>('POST', '/api/admin/kelas', isi);
        toast.tampil(`Kelas ${f.nama} dibuat. Lanjutkan dengan memilih pelajarannya.`);
        berubah();
        dibuat(r.id);
        setTab('mapel');
      } else {
        await kirim('PUT', `/api/admin/kelas/${id}`, isi);
        toast.tampil('Data kelas disimpan.');
        berubah();
        muatUlang();
      }
    }).catch(toast.galat);

  const simpanMapel = () =>
    jalankan(async () => {
      const daftar = semuaMapel.filter((m) => pilihMapel[m.id]?.pakai).map((m) => ({ mapelId: m.id, pengajar: pilihMapel[m.id].pengajar }));
      await kirim('PUT', `/api/admin/kelas/${id}/mapel`, { daftar });
      toast.tampil(`${daftar.length} pelajaran diatur untuk kelas ini.`);
      berubah();
      muatUlang();
    }).catch(toast.galat);

  const simpanJadwal = () =>
    jalankan(async () => {
      await kirim('PUT', `/api/admin/kelas/${id}/jadwal`, { daftar: jadwal });
      toast.tampil('Jadwal disimpan.');
      muatUlang();
    }).catch(toast.galat);

  const hapus = async () => {
    if (!(await tanya({ judul: `Hapus kelas ${f.nama}?`, pesan: 'Kelas yang masih punya santri atau riwayat absensi tidak bisa dihapus; nonaktifkan saja.', ya: 'Hapus', bahaya: true }))) return;
    try {
      await kirim('DELETE', `/api/admin/kelas/${id}`);
      toast.tampil('Kelas dihapus.');
      berubah();
      tutup();
    } catch (e) {
      toast.galat(e);
    }
  };

  const mapelKelas = data?.mapel ?? [];
  const kaki =
    !admin || tab === 'santri' ? undefined : (
      <>
        {tab === 'data' && !baru && (
          <Tombol varian="hantu" ikon={<Trash2 />} onClick={hapus} style={{ marginRight: 'auto' }}>
            Hapus
          </Tombol>
        )}
        <Tombol onClick={tutup}>Tutup</Tombol>
        <Tombol varian="utama" sibuk={sibuk} ikon={<Save />} onClick={tab === 'data' ? simpanData : tab === 'mapel' ? simpanMapel : simpanJadwal}>
          {tab === 'data' && baru ? 'Buat kelas' : 'Simpan'}
        </Tombol>
      </>
    );

  return (
    <Modal laci judul={baru ? 'Kelas baru' : (data?.kelas.nama ?? 'Memuat…')} sub={data ? `${data.santri.length} santri · ${data.mapel.length} pelajaran` : undefined} tutup={tutup} kaki={kaki}>
      <div className="tumpuk">
        {!baru && (
          <div className="segmen" role="tablist" style={{ width: '100%' }}>
            {(
              [
                ['mapel', 'Pelajaran', BookMarked],
                ['jadwal', 'Jadwal', CalendarClock],
                ['santri', 'Santri', Users],
                ['data', 'Data kelas', School],
              ] as const
            ).map(([k, l, I]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{ flex: 1, justifyContent: 'center' }}>
                <I /> {l}
              </button>
            ))}
          </div>
        )}

        {!baru && !data ? (
          <Memuat />
        ) : tab === 'data' ? (
          <fieldset disabled={!admin} className="grid-2" style={{ border: 0, padding: 0, margin: 0 }}>
            <Bidang label="Nama kelas" wajib galat={bidang.nama} className="bentang-2">
              <input className="masukan" value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} placeholder="Ula 1 Putra" />
            </Bidang>
            <Bidang label="Jenjang" wajib galat={bidang.jenjang}>
              <select className="masukan" value={f.jenjang} onChange={(e) => setF({ ...f, jenjang: e.target.value })}>
                {JENJANG.map((j) => (
                  <option key={j}>{j}</option>
                ))}
              </select>
            </Bidang>
            <Bidang label="Tingkat" wajib galat={bidang.tingkat} bantu="Untuk urutan kelas dan kenaikan.">
              <input className="masukan angka" type="number" min={1} max={12} value={f.tingkat} onChange={(e) => setF({ ...f, tingkat: e.target.value })} />
            </Bidang>
            <Bidang label="Bagian" wajib galat={bidang.bagian}>
              <select className="masukan" value={f.bagian} onChange={(e) => setF({ ...f, bagian: e.target.value })}>
                {Object.entries(BAGIAN_KELAS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Bidang>
            <Bidang label="Ruang" galat={bidang.ruang}>
              <input className="masukan" value={f.ruang} onChange={(e) => setF({ ...f, ruang: e.target.value })} placeholder="Ruang 1" />
            </Bidang>
            <Bidang label="Wali kelas" galat={bidang.waliKelas} className="bentang-2" bantu="Tampil di raport sebagai penanda tangan.">
              <input className="masukan" value={f.waliKelas} onChange={(e) => setF({ ...f, waliKelas: e.target.value })} placeholder="Ust. …" />
            </Bidang>
            {!baru && (
              <div className="baris bentang-2 panel" style={{ padding: '12px 14px' }}>
                <div className="isi-penuh">
                  <b>Kelas aktif</b>
                  <div className="redup-2 kecil">Kelas nonaktif tidak muncul di absensi, nilai, dan dasbor.</div>
                </div>
                <Sakelar nyala={f.aktif} ubah={(v) => setF({ ...f, aktif: v })} label="Kelas aktif" />
              </div>
            )}
          </fieldset>
        ) : tab === 'mapel' ? (
          <div className="tumpuk tumpuk--rapat">
            <p className="redup kecil">Centang pelajaran yang diajarkan di kelas ini dan isi nama pengajarnya. Urutan di raport mengikuti pengaturan mata pelajaran.</p>
            {semuaMapel.map((m) => {
              const p = pilihMapel[m.id] ?? { pakai: false, pengajar: '' };
              return (
                <div key={m.id} className={`baris-mapel ${p.pakai ? 'baris-mapel--pakai' : ''}`}>
                  <label className="centang isi-penuh">
                    <input type="checkbox" checked={p.pakai} disabled={!admin} onChange={(e) => setPilihMapel({ ...pilihMapel, [m.id]: { ...p, pakai: e.target.checked } })} />
                    <span style={{ display: 'grid' }}>
                      <b>{m.nama}</b>
                      <span className="redup-2 kecil">{m.kitab ?? '—'}</span>
                    </span>
                  </label>
                  {p.pakai && (
                    <input
                      className="masukan masukan--kecil"
                      style={{ maxWidth: 210 }}
                      value={p.pengajar}
                      disabled={!admin}
                      onChange={(e) => setPilihMapel({ ...pilihMapel, [m.id]: { ...p, pengajar: e.target.value } })}
                      placeholder="Pengajar"
                      aria-label={`Pengajar ${m.nama}`}
                    />
                  )}
                </div>
              );
            })}
            {!semuaMapel.length && <p className="redup kecil">Tambahkan mata pelajaran lebih dulu di tab Mata pelajaran.</p>}
          </div>
        ) : tab === 'jadwal' ? (
          <div className="tumpuk">
            {!mapelKelas.length ? (
              <p className="redup kecil">Pilih pelajaran kelas ini lebih dulu.</p>
            ) : (
              <>
                {[6, 7, 1, 2, 3, 4, 5].map((h) => {
                  const hariIni = jadwal.map((j, i) => ({ ...j, i })).filter((j) => j.hari === h);
                  return (
                    <div key={h} className="hari-jadwal">
                      <div className="baris baris--antara">
                        <b>{HARI[h]}</b>
                        {admin && (
                          <Tombol
                            ukuran="kecil"
                            varian="hantu"
                            ikon={<Plus />}
                            onClick={() => {
                              const akhir = hariIni.at(-1)?.jamSelesai ?? '14:00';
                              setJadwal([...jadwal, { hari: h, jamMulai: akhir, jamSelesai: tambahMenit(akhir, 70), mapelId: mapelKelas[0].mapelId }]);
                            }}
                          >
                            Jam
                          </Tombol>
                        )}
                      </div>
                      {hariIni.map((j) => (
                        <div key={j.i} className="baris baris-jadwal">
                          <input className="masukan masukan--kecil angka" type="time" value={j.jamMulai} disabled={!admin} onChange={(e) => setJadwal(jadwal.map((x, i) => (i === j.i ? { ...x, jamMulai: e.target.value } : x)))} aria-label="Jam mulai" />
                          <span className="redup-2">–</span>
                          <input className="masukan masukan--kecil angka" type="time" value={j.jamSelesai} disabled={!admin} onChange={(e) => setJadwal(jadwal.map((x, i) => (i === j.i ? { ...x, jamSelesai: e.target.value } : x)))} aria-label="Jam selesai" />
                          <select className="masukan masukan--kecil isi-penuh" value={j.mapelId} disabled={!admin} onChange={(e) => setJadwal(jadwal.map((x, i) => (i === j.i ? { ...x, mapelId: Number(e.target.value) } : x)))} aria-label="Pelajaran">
                            {mapelKelas.map((m) => (
                              <option key={m.mapelId} value={m.mapelId}>
                                {m.nama}
                              </option>
                            ))}
                          </select>
                          {admin && <Tombol varian="hantu" ukuran="kecil" ikon={<Trash2 />} onClick={() => setJadwal(jadwal.filter((_, i) => i !== j.i))} aria-label="Hapus jam" />}
                        </div>
                      ))}
                      {!hariIni.length && <span className="redup-2 kecil">Libur</span>}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ) : (
          <div className="tumpuk tumpuk--rapat">
            {data?.santri.map((s) => (
              <Link key={s.id} to={`/admin/santri/${s.id}`} className="baris panel baris-tautan">
                <Avatar nama={s.nama} jk={s.jk} ukuran={34} foto={urlFoto(s.id, s.fotoVersi)} />
                <span className="isi-penuh potong">{s.nama}</span>
                <span className="redup-2 kecil angka">{s.nis}</span>
              </Link>
            ))}
            {!data?.santri.length && <p className="redup kecil">Belum ada santri di kelas ini. Atur kelas santri di halaman Data santri.</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}

function tambahMenit(jam: string, menit: number) {
  const [h, m] = jam.split(':').map(Number);
  const t = Math.min(23 * 60 + 59, h * 60 + m + menit);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
