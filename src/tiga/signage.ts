import * as THREE from 'three';

// Signage digambar dengan huruf yang sama dengan aplikasi, lalu dipasang sebagai elemen fisik gedung:
// papan nama berlapis cat bubuk, huruf kuningan tanam di lantai, kotak lampu ON AIR, papan direktori,
// monumen nama gedung, dan lambang PCC di dinding resepsionis.

const SANS = '"Plus Jakarta Sans", system-ui, sans-serif';
const SERIF = '"Newsreader", Georgia, serif';
const JINGGA = '#ef6c12';
const JINGGA_MUDA = '#f28a3c';

export async function siapkanHuruf() {
  if (!('fonts' in document)) return;
  await Promise.all([
    document.fonts.load(`600 64px ${SANS}`),
    document.fonts.load(`700 64px ${SANS}`),
    document.fonts.load(`450 64px ${SERIF}`),
  ]).catch(() => {});
}

/** Muat gambar logo; gagal dimuat berarti signage memakai teks saja. */
export async function muatGambar(url: string | undefined): Promise<HTMLImageElement | null> {
  if (!url) return null;
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

function kanvas(l: number, t: number) {
  const c = document.createElement('canvas');
  c.width = l;
  c.height = t;
  return { c, g: c.getContext('2d')! };
}

function tekstur(c: HTMLCanvasElement, warna = true) {
  const t = new THREE.CanvasTexture(c);
  if (warna) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function pasLebar(g: CanvasRenderingContext2D, teks: string, maks: number, ukuran: number, gaya: string) {
  let u = ukuran;
  g.font = gaya.replace('{u}', String(u));
  while (g.measureText(teks).width > maks && u > 12) {
    u -= 2;
    g.font = gaya.replace('{u}', String(u));
  }
  return u;
}

function gambarLogo(g: CanvasRenderingContext2D, logo: HTMLImageElement, x: number, y: number, tinggi: number) {
  const lebar = (logo.naturalWidth / logo.naturalHeight) * tinggi;
  g.drawImage(logo, x, y, lebar, tinggi);
  return lebar;
}

/** Papan nama ruangan: hijau hutan, kode jingga, nama huruf pasir. Rasio 2,6 : 1. */
export function teksturPapanNama(kode: string, nama: string) {
  const { c, g } = kanvas(1040, 400);
  g.fillStyle = '#24372e';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = JINGGA_MUDA;
  g.font = `600 64px ${SANS}`;
  g.textBaseline = 'alphabetic';
  g.fillText(kode, 80, 140);
  g.fillStyle = 'rgba(242,138,60,0.6)';
  g.fillRect(80, 172, 72, 4);
  g.fillStyle = '#f4f1ea';
  pasLebar(g, nama, c.width - 160, 96, `600 {u}px ${SANS}`);
  g.fillText(nama, 80, 300);
  return tekstur(c);
}

/** Huruf kuningan tanam di lantai: putih di atas hitam, dipakai sebagai alphaMap. */
export function teksturInlay(kode: string, nama: string) {
  const { c, g } = kanvas(1024, 256);
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff';
  g.textBaseline = 'middle';
  g.font = `600 84px ${SANS}`;
  g.fillText(kode, 24, 128);
  const lebarKode = g.measureText(kode).width;
  g.fillRect(24 + lebarKode + 36, 70, 4, 116);
  pasLebar(g, nama, c.width - (lebarKode + 110), 84, `450 {u}px ${SERIF}`);
  g.fillText(nama, 24 + lebarKode + 76, 132);
  return tekstur(c, false);
}

/** Kotak lampu ON AIR. Saat mati tampak seperti kaca asap; saat menyala bercahaya jingga hangat. */
export function teksturOnAir(nyala: boolean) {
  const { c, g } = kanvas(640, 200);
  g.fillStyle = nyala ? '#e8650f' : '#1a1c1a';
  g.fillRect(0, 0, c.width, c.height);
  if (nyala) {
    const grd = g.createRadialGradient(320, 100, 10, 320, 100, 340);
    grd.addColorStop(0, 'rgba(255,226,190,0.6)');
    grd.addColorStop(1, 'rgba(255,226,190,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, c.width, c.height);
  }
  g.strokeStyle = nyala ? 'rgba(255,244,232,0.55)' : 'rgba(255,255,255,0.08)';
  g.lineWidth = 4;
  g.strokeRect(14, 14, c.width - 28, c.height - 28);
  g.fillStyle = nyala ? '#fff8ef' : '#3a3d39';
  g.textBaseline = 'middle';
  g.font = `700 104px ${SANS}`;
  const huruf = 'ON AIR'.split('');
  const jarak = 22;
  const lebar = huruf.reduce((a, h) => a + g.measureText(h).width, 0) + jarak * (huruf.length - 1);
  let x = 320 - lebar / 2;
  for (const h of huruf) {
    g.fillText(h, x, 106);
    x += g.measureText(h).width + jarak;
  }
  return tekstur(c);
}

/** Monumen nama gedung di pelataran: lambang resmi, singkatan, nama, dan penaung. */
export function teksturMonumen(nama: string, singkat: string, naungan: string, logo: HTMLImageElement | null) {
  const { c, g } = kanvas(640, 1280);
  g.fillStyle = '#1f2a24';
  g.fillRect(0, 0, c.width, c.height);
  if (logo) gambarLogo(g, logo, 92, 110, 280);
  g.fillStyle = logo ? JINGGA : '#f4f1ea';
  g.textBaseline = 'alphabetic';
  g.font = `700 120px ${SANS}`;
  g.fillText(singkat, 88, 540);
  g.fillStyle = 'rgba(217,210,196,0.5)';
  g.fillRect(96, 580, 120, 3);
  const kata = nama.split(' ');
  g.fillStyle = '#e9e3d8';
  g.font = `600 58px ${SANS}`;
  kata.forEach((k, i) => g.fillText(k, 96, 690 + i * 76));
  g.fillStyle = 'rgba(233,227,216,0.62)';
  g.font = `500 30px ${SANS}`;
  let b = '';
  let y = 690 + kata.length * 76 + 70;
  for (const kt of naungan.split(' ')) {
    if (g.measureText(b + kt).width > 440) {
      g.fillText(b.trim(), 96, y);
      y += 44;
      b = '';
    }
    b += kt + ' ';
  }
  if (b.trim()) g.fillText(b.trim(), 96, y);
  return tekstur(c);
}

/** Lambang dan nama lembaga untuk dinding fitur resepsionis dan fasad (latar transparan). */
export function teksturLogoDinding(nama: string, singkat: string, logo: HTMLImageElement | null, terang: boolean) {
  const { c, g } = kanvas(1600, 400);
  g.clearRect(0, 0, c.width, c.height);
  let x = 40;
  if (logo) x += gambarLogo(g, logo, 40, 30, 340) + 50;
  g.textBaseline = 'alphabetic';
  g.fillStyle = JINGGA;
  g.font = `700 190px ${SANS}`;
  g.fillText(singkat, x, 230);
  g.fillStyle = terang ? '#f4f1ea' : '#2b2f2c';
  pasLebar(g, nama, c.width - x - 40, 64, `600 {u}px ${SANS}`);
  g.fillText(nama, x + 6, 330);
  return tekstur(c);
}

/** Papan direktori lantai di dekat pintu masuk. */
export function teksturDirektori(judul: string, lantai: { nomor: number; ruang: { kode: string; nama: string }[] }[]) {
  const { c, g } = kanvas(600, 1500);
  g.fillStyle = '#24372e';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = JINGGA_MUDA;
  g.fillRect(60, 80, 80, 6);
  g.fillStyle = '#f4f1ea';
  g.font = `450 58px ${SERIF}`;
  g.fillText(judul, 60, 170);
  let y = 270;
  for (const l of lantai) {
    g.fillStyle = JINGGA_MUDA;
    g.font = `600 30px ${SANS}`;
    g.fillText(`Lantai ${l.nomor}`, 60, y);
    y += 22;
    g.fillStyle = 'rgba(244,241,234,0.25)';
    g.fillRect(60, y, 480, 2);
    y += 52;
    for (const r of l.ruang) {
      g.fillStyle = 'rgba(244,241,234,0.6)';
      g.font = `600 28px ${SANS}`;
      g.fillText(r.kode, 60, y);
      g.fillStyle = '#f4f1ea';
      pasLebar(g, r.nama, 380, 32, `500 {u}px ${SANS}`);
      g.fillText(r.nama, 150, y);
      y += 58;
    }
    y += 40;
  }
  return tekstur(c);
}

/** Papan petunjuk lantai di dekat tangga. */
export function teksturPetunjukLantai(lantai: number) {
  const { c, g } = kanvas(512, 512);
  g.fillStyle = '#24372e';
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = JINGGA_MUDA;
  g.font = `600 44px ${SANS}`;
  g.fillText('Lantai', 64, 140);
  g.fillStyle = '#f4f1ea';
  g.font = `450 260px ${SERIF}`;
  g.fillText(String(lantai), 56, 410);
  return tekstur(c);
}

/** Papan nama meja: balok akrilik gelap dengan nama staf berhuruf pasir. Rasio 3,5 : 1. */
export function teksturNamaMeja(nama: string) {
  const { c, g } = kanvas(560, 160);
  g.fillStyle = '#1f2a24';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = JINGGA;
  g.fillRect(0, c.height - 10, c.width, 10);
  g.fillStyle = '#f4f1ea';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  pasLebar(g, nama, c.width - 60, 76, `600 {u}px ${SANS}`);
  g.fillText(nama, c.width / 2, c.height / 2 - 4);
  return tekstur(c);
}
