import * as THREE from 'three';

// Signage digambar dengan huruf yang sama dengan aplikasi, lalu dipasang sebagai pelat fisik:
// papan nama berlapis cat bubuk, huruf kuningan tanam di lantai, kotak lampu ON AIR, dan monumen nama gedung.

const SANS = '"Plus Jakarta Sans", system-ui, sans-serif';
const SERIF = '"Newsreader", Georgia, serif';

export async function siapkanHuruf() {
  if (!('fonts' in document)) return;
  await Promise.all([
    document.fonts.load(`600 64px ${SANS}`),
    document.fonts.load(`700 64px ${SANS}`),
    document.fonts.load(`450 64px ${SERIF}`),
  ]).catch(() => {});
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

/** Papan nama ruangan: hijau hutan, kode tembaga muda, nama huruf pasir. Rasio 2,6 : 1. */
export function teksturPapanNama(kode: string, nama: string) {
  const { c, g } = kanvas(1040, 400);
  g.fillStyle = '#24372e';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#e3a27c';
  g.font = `600 64px ${SANS}`;
  g.textBaseline = 'alphabetic';
  g.fillText(kode, 80, 140);
  g.fillStyle = 'rgba(227,162,124,0.55)';
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
  const t = tekstur(c, false);
  return t;
}

/** Kotak lampu ON AIR. Saat mati tampak seperti kaca asap; saat menyala bercahaya tembaga hangat. */
export function teksturOnAir(nyala: boolean) {
  const { c, g } = kanvas(640, 200);
  g.fillStyle = nyala ? '#b2552a' : '#1a1c1a';
  g.fillRect(0, 0, c.width, c.height);
  if (nyala) {
    const grd = g.createRadialGradient(320, 100, 10, 320, 100, 340);
    grd.addColorStop(0, 'rgba(255,214,170,0.55)');
    grd.addColorStop(1, 'rgba(255,214,170,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, c.width, c.height);
  }
  g.strokeStyle = nyala ? 'rgba(255,240,226,0.5)' : 'rgba(255,255,255,0.08)';
  g.lineWidth = 4;
  g.strokeRect(14, 14, c.width - 28, c.height - 28);
  g.fillStyle = nyala ? '#fff6ec' : '#3a3d39';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 104px ${SANS}`;
  // Jarak antarhuruf lebar seperti signage siaran klasik.
  const huruf = 'ON AIR'.split('');
  const jarak = 22;
  const lebar = huruf.reduce((a, h) => a + g.measureText(h).width, 0) + jarak * (huruf.length - 1);
  let x = 320 - lebar / 2;
  g.textAlign = 'left';
  for (const h of huruf) {
    g.fillText(h, x, 106);
    x += g.measureText(h).width + jarak;
  }
  return tekstur(c);
}

/** Monumen nama gedung di pelataran depan. */
export function teksturMonumen(nama: string, singkat: string, naungan: string) {
  const { c, g } = kanvas(640, 1280);
  g.fillStyle = '#1f2a24';
  g.fillRect(0, 0, c.width, c.height);
  // Tanda: garis gunung dan titik fajar, sama dengan favicon aplikasi.
  g.strokeStyle = '#d9d2c4';
  g.lineWidth = 7;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(96, 330);
  g.lineTo(206, 160);
  g.lineTo(262, 236);
  g.lineTo(318, 140);
  g.lineTo(436, 330);
  g.closePath();
  g.stroke();
  g.fillStyle = '#e3a27c';
  g.beginPath();
  g.arc(420, 130, 22, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = '#f4f1ea';
  g.textBaseline = 'alphabetic';
  g.font = `450 112px ${SERIF}`;
  g.fillText(singkat, 92, 520);
  g.fillStyle = 'rgba(217,210,196,0.5)';
  g.fillRect(96, 566, 120, 3);
  const kata = nama.split(' ');
  g.fillStyle = '#e9e3d8';
  g.font = `600 58px ${SANS}`;
  kata.forEach((k, i) => g.fillText(k, 96, 680 + i * 76));
  g.fillStyle = 'rgba(233,227,216,0.62)';
  g.font = `500 30px ${SANS}`;
  const baris = naungan.split(' ');
  let b = '';
  let y = 680 + kata.length * 76 + 70;
  for (const kt of baris) {
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

/** Papan petunjuk lantai di dekat tangga. */
export function teksturPetunjukLantai(lantai: number) {
  const { c, g } = kanvas(512, 512);
  g.fillStyle = '#24372e';
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#e3a27c';
  g.font = `600 44px ${SANS}`;
  g.fillText('Lantai', 64, 140);
  g.fillStyle = '#f4f1ea';
  g.font = `450 260px ${SERIF}`;
  g.fillText(String(lantai), 56, 410);
  return tekstur(c);
}
