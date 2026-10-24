import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api } from '../../lib/api';
import { useInfo } from '../../lib/konteks';
import { Bidang, Masukan, Pemberitahuan, Tombol, useJudul, useKirim } from '../../ui/dasar';
import { tanggal, tautanWa, tampilWa } from '../../../shared/format';
import type { StatusUmkm } from '../../../shared/konstanta';

interface Hasil {
  namaUsaha: string;
  status: StatusUmkm;
  label: string;
  catatan: string | null;
  dibuat: string;
  diputuskan: string | null;
}

const PENJELASAN: Record<StatusUmkm, string> = {
  diajukan: 'Pendaftaran Anda sudah masuk dan sedang menunggu giliran kurasi.',
  perlu_perbaikan: 'Ada yang perlu Anda lengkapi sebelum kurasi dilanjutkan. Baca catatan dari tim kurasi di bawah.',
  diterima: 'Selamat, usaha Anda lolos kurasi. Tim PCC akan menghubungi Anda untuk penitipan stok pertama.',
  ditolak: 'Usaha Anda belum lolos kurasi kali ini. Anda boleh mendaftar kembali setelah menindaklanjuti catatan tim.',
};

export function CekStatus() {
  useJudul('Cek status pendaftaran');
  const { info } = useInfo();
  const [kode, setKode] = useState('');
  const [wa, setWa] = useState('');
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const { sibuk, galat, bidang, kirim, atur } = useKirim();

  const cari = async (e: FormEvent) => {
    e.preventDefault();
    const g: Record<string, string> = {};
    if (!kode.trim()) g.kode = 'Isi kode pendaftaran, misalnya UMKM-26-0012.';
    if (!wa.trim()) g.whatsapp = 'Isi nomor WhatsApp yang dipakai saat mendaftar.';
    if (Object.keys(g).length) {
      atur('Lengkapi dua isian berikut untuk melihat status.', g);
      return;
    }
    setHasil(null);
    const r = await kirim(() => api<Hasil>('POST', '/api/publik/status', { kode: kode.trim(), whatsapp: wa }));
    if (r) setHasil(r);
  };

  const nada = hasil?.status === 'diterima' ? 'ok' : hasil?.status === 'diajukan' ? 'info' : 'tunggu';
  const waPcc = info?.organisasi.whatsapp;

  return (
    <div className="halaman-sempit">
      <h1>Cek status pendaftaran</h1>
      <p className="redup pengantar-kecil">Masukkan kode yang Anda terima setelah mendaftar dan nomor WhatsApp yang sama.</p>
      <form className="formulir-ringkas" onSubmit={cari} noValidate>
        {galat && <Pemberitahuan nada="galat">{galat}</Pemberitahuan>}
        <div className="kisi-isian">
          <Bidang label="Kode pendaftaran" galat={bidang.kode}>
            {(a) => <Masukan {...a} value={kode} onChange={(e) => setKode(e.target.value)} placeholder="UMKM-26-0012" autoCapitalize="characters" />}
          </Bidang>
          <Bidang label="Nomor WhatsApp" galat={bidang.whatsapp}>
            {(a) => <Masukan {...a} value={wa} onChange={(e) => setWa(e.target.value)} inputMode="tel" placeholder="0812 3456 7890" />}
          </Bidang>
        </div>
        <div>
          <Tombol type="submit" ragam="utama" sibuk={sibuk}>
            Lihat status
          </Tombol>
        </div>
      </form>

      {hasil && (
        <section className="hasil-status" aria-live="polite">
          <p className="redup kecil">{hasil.namaUsaha}</p>
          <h2>{hasil.label}</h2>
          <Pemberitahuan nada={nada}>
            <p>{PENJELASAN[hasil.status]}</p>
            {hasil.catatan && (
              <p style={{ marginTop: 8 }}>
                <span className="tebal">Catatan tim kurasi:</span> {hasil.catatan}
              </p>
            )}
          </Pemberitahuan>
          <dl className="keterangan">
            <dt>Terdaftar</dt>
            <dd>{tanggal(hasil.dibuat)}</dd>
            {hasil.diputuskan && (
              <>
                <dt>Diperbarui</dt>
                <dd>{tanggal(hasil.diputuskan)}</dd>
              </>
            )}
          </dl>
          {waPcc && (
            <a className="tautan-panah" href={tautanWa(waPcc, `Halo PCC, saya ingin bertanya tentang pendaftaran ${kode.toUpperCase()}.`)} target="_blank" rel="noopener noreferrer">
              Tanyakan ke {tampilWa(waPcc)}
            </a>
          )}
        </section>
      )}

      <p className="redup kecil" style={{ marginTop: 40 }}>
        Belum mendaftar? <Link to="/daftar">Daftarkan usaha Anda</Link>.
      </p>
    </div>
  );
}
