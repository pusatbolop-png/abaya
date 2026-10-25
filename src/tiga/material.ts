import * as THREE from 'three';

// Tekstur prosedural yang digambar di kanvas: tanpa berkas gambar eksternal,
// warnanya diturunkan dari palet aplikasi dan material bangunan nyata.

function acak(benih: number) {
  let s = benih >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function kanvas(ukuran: number, tinggi = ukuran) {
  const c = document.createElement('canvas');
  c.width = ukuran;
  c.height = tinggi;
  return { c, g: c.getContext('2d')! };
}

function jadikanTekstur(c: HTMLCanvasElement, warna = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (warna) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Noda lembut berskala besar untuk variasi alami permukaan. */
function noda(g: CanvasRenderingContext2D, ukuran: number, r: () => number, jumlah: number, terang: string, gelap: string, rad: [number, number]) {
  for (let i = 0; i < jumlah; i++) {
    const x = r() * ukuran;
    const y = r() * ukuran;
    const rr = rad[0] + r() * (rad[1] - rad[0]);
    const grd = g.createRadialGradient(x, y, 0, x, y, rr);
    grd.addColorStop(0, r() < 0.5 ? terang : gelap);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
}

/** Terrazzo hangat: dasar pasir dengan serpihan abu vulkanik, lumut, arang, dan sedikit jingga. */
function teksturTerrazzo(ukuran = 1024) {
  const { c, g } = kanvas(ukuran);
  const r = acak(7);
  g.fillStyle = '#e8e2d6';
  g.fillRect(0, 0, ukuran, ukuran);
  noda(g, ukuran, r, 120, 'rgba(255,255,255,0.05)', 'rgba(120,100,80,0.05)', [40, 160]);
  const serpih = ['#bfb6a6', '#a59d8d', '#7d8a76', '#5f6b5a', '#3a3f3a', '#cfc7b8', '#c8783e', '#f2ede4'];
  const bobot = [16, 14, 8, 5, 4, 14, 2, 10];
  const total = bobot.reduce((a, b) => a + b, 0);
  const pilih = () => {
    let x = r() * total;
    for (let i = 0; i < serpih.length; i++) if ((x -= bobot[i]) < 0) return serpih[i];
    return serpih[0];
  };
  for (let i = 0; i < 2600; i++) {
    const x = r() * ukuran;
    const y = r() * ukuran;
    const s = r() < 0.08 ? 6 + r() * 8 : 1.5 + r() * 4;
    g.fillStyle = pilih();
    g.beginPath();
    const sisi = 4 + Math.floor(r() * 4);
    for (let k = 0; k < sisi; k++) {
      const a = (k / sisi) * Math.PI * 2 + r() * 0.6;
      const rr = s * (0.6 + r() * 0.5);
      if (k === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }
  return jadikanTekstur(c);
}

/** Serat kayu: urat memanjang dengan variasi ton. */
function teksturKayu(dasar: string, gelap: string, terang: string, benih: number, papan = 0, ukuran = 1024) {
  const { c, g } = kanvas(ukuran);
  const r = acak(benih);
  g.fillStyle = dasar;
  g.fillRect(0, 0, ukuran, ukuran);
  const tinggiPapan = papan ? ukuran / papan : ukuran;
  for (let p = 0; p < (papan || 1); p++) {
    // Tiap bilah lantai sedikit berbeda ton.
    if (papan) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
      g.fillRect(0, p * tinggiPapan, ukuran, tinggiPapan);
    }
    for (let i = 0; i < 70; i++) {
      const y = p * tinggiPapan + r() * tinggiPapan;
      g.strokeStyle = r() < 0.55 ? gelap : terang;
      g.globalAlpha = 0.12 + r() * 0.28;
      g.lineWidth = 0.8 + r() * 3.5;
      g.beginPath();
      let yy = y;
      g.moveTo(0, yy);
      for (let x = 0; x <= ukuran; x += 32) {
        yy += (r() - 0.5) * 2.4;
        g.lineTo(x, yy + Math.sin(x / (90 + r() * 60)) * 3);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
    if (papan) {
      g.fillStyle = 'rgba(20,12,8,0.45)';
      g.fillRect(0, p * tinggiPapan, ukuran, 2);
      // Sambungan ujung bilah.
      const xs = r() * ukuran;
      g.fillRect(xs, p * tinggiPapan, 2, tinggiPapan);
    }
  }
  return jadikanTekstur(c);
}

/** Kain: anyaman halus untuk pelapis dan panel akustik. */
function teksturKain(dasar: string, benih = 3, ukuran = 256) {
  const { c, g } = kanvas(ukuran);
  const r = acak(benih);
  g.fillStyle = dasar;
  g.fillRect(0, 0, ukuran, ukuran);
  for (let y = 0; y < ukuran; y += 2) {
    g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`;
    g.fillRect(0, y, ukuran, 1);
  }
  for (let x = 0; x < ukuran; x += 2) {
    g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`;
    g.fillRect(x, 0, 1, ukuran);
  }
  return jadikanTekstur(c);
}

/** Goresan logam brushed untuk peta kekasaran. */
function teksturBrushed(ukuran = 512) {
  const { c, g } = kanvas(ukuran);
  const r = acak(11);
  g.fillStyle = '#7a7a7a';
  g.fillRect(0, 0, ukuran, ukuran);
  for (let i = 0; i < 1400; i++) {
    const v = 90 + r() * 90;
    g.strokeStyle = `rgba(${v},${v},${v},0.35)`;
    g.lineWidth = r() * 1.4;
    const y = r() * ukuran;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(ukuran, y + (r() - 0.5) * 2);
    g.stroke();
  }
  return jadikanTekstur(c, false);
}

/** Plester atau beton halus. */
function teksturBeton(dasar: string, benih: number, ukuran = 512) {
  const { c, g } = kanvas(ukuran);
  const r = acak(benih);
  g.fillStyle = dasar;
  g.fillRect(0, 0, ukuran, ukuran);
  noda(g, ukuran, r, 180, 'rgba(255,255,255,0.045)', 'rgba(40,36,30,0.045)', [20, 110]);
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = `rgba(30,28,24,${r() * 0.05})`;
    g.fillRect(r() * ukuran, r() * ukuran, 1, 1);
  }
  return jadikanTekstur(c);
}

/** Rumput tropis: lapisan hijau dengan helai pendek dan bercak kering. */
function teksturRumput(ukuran = 1024) {
  const { c, g } = kanvas(ukuran);
  const r = acak(31);
  g.fillStyle = '#5d7342';
  g.fillRect(0, 0, ukuran, ukuran);
  noda(g, ukuran, r, 260, 'rgba(140,160,90,0.18)', 'rgba(40,60,30,0.2)', [30, 140]);
  for (let i = 0; i < 26000; i++) {
    const x = r() * ukuran;
    const y = r() * ukuran;
    const h = 3 + r() * 7;
    const v = r();
    g.strokeStyle = v < 0.3 ? 'rgba(48,70,34,0.55)' : v < 0.85 ? 'rgba(112,140,72,0.5)' : 'rgba(170,170,110,0.45)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 3, y - h);
    g.stroke();
  }
  return jadikanTekstur(c);
}

/** Paving blok persegi panjang berpola susun bata dengan nat. */
function teksturPaving(ukuran = 1024) {
  const { c, g } = kanvas(ukuran);
  const r = acak(41);
  g.fillStyle = '#7e786c';
  g.fillRect(0, 0, ukuran, ukuran);
  const pl = ukuran / 8;
  const pt = ukuran / 16;
  for (let j = 0; j < 16; j++) {
    for (let i = -1; i < 9; i++) {
      const x = i * pl + (j % 2 ? pl / 2 : 0);
      const y = j * pt;
      const t = 176 + r() * 30;
      g.fillStyle = `rgb(${t},${t - 6},${t - 16})`;
      g.fillRect(x + 2, y + 2, pl - 4, pt - 4);
      g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`;
      g.fillRect(x + 2 + r() * pl * 0.5, y + 2, pl * 0.4, pt - 4);
    }
  }
  noda(g, ukuran, r, 60, 'rgba(255,255,255,0.04)', 'rgba(30,25,20,0.06)', [40, 160]);
  return jadikanTekstur(c);
}

/** Aspal dengan agregat halus. */
function teksturAspal(ukuran = 512) {
  const { c, g } = kanvas(ukuran);
  const r = acak(51);
  g.fillStyle = '#3d3f3d';
  g.fillRect(0, 0, ukuran, ukuran);
  for (let i = 0; i < 9000; i++) {
    const v = 40 + r() * 60;
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.fillRect(r() * ukuran, r() * ukuran, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  noda(g, ukuran, r, 50, 'rgba(255,255,255,0.03)', 'rgba(0,0,0,0.06)', [30, 120]);
  return jadikanTekstur(c);
}

/** Ubin keramik 30 cm dengan nat tipis. */
function teksturUbin(dasar: string, ukuran = 512) {
  const { c, g } = kanvas(ukuran);
  const r = acak(61);
  g.fillStyle = '#c9c4ba';
  g.fillRect(0, 0, ukuran, ukuran);
  const n = 4;
  const s = ukuran / n;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      g.fillStyle = dasar;
      g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
      g.fillStyle = `rgba(0,0,0,${r() * 0.04})`;
      g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    }
  return jadikanTekstur(c);
}

export interface Pustaka {
  terrazzo: THREE.MeshPhysicalMaterial;
  walnut: THREE.MeshStandardMaterial;
  oak: THREE.MeshStandardMaterial;
  lantaiKayu: THREE.MeshStandardMaterial;
  logam: THREE.MeshStandardMaterial;
  logamGelap: THREE.MeshStandardMaterial;
  kuningan: THREE.MeshStandardMaterial;
  kainHutan: THREE.MeshStandardMaterial;
  kainLumut: THREE.MeshStandardMaterial;
  kainPasir: THREE.MeshStandardMaterial;
  kainArang: THREE.MeshStandardMaterial;
  karpet: THREE.MeshStandardMaterial;
  plester: THREE.MeshStandardMaterial;
  plesterLuar: THREE.MeshStandardMaterial;
  beton: THREE.MeshStandardMaterial;
  ubin: THREE.MeshStandardMaterial;
  ubinDinding: THREE.MeshStandardMaterial;
  keramik: THREE.MeshPhysicalMaterial;
  cermin: THREE.MeshStandardMaterial;
  kacaBuram: THREE.MeshPhysicalMaterial;
  kacaBening: THREE.MeshPhysicalMaterial;
  kacaFasad: THREE.MeshPhysicalMaterial;
  aluminium: THREE.MeshStandardMaterial;
  layar: THREE.MeshStandardMaterial;
  layarMenyala: THREE.MeshStandardMaterial;
  lampu: THREE.MeshStandardMaterial;
  plastikHitam: THREE.MeshStandardMaterial;
  plastikPutih: THREE.MeshStandardMaterial;
  daun: THREE.MeshStandardMaterial;
  daunTua: THREE.MeshStandardMaterial;
  daunMuda: THREE.MeshStandardMaterial;
  batang: THREE.MeshStandardMaterial;
  tanah: THREE.MeshStandardMaterial;
  potTerakota: THREE.MeshStandardMaterial;
  kardus: THREE.MeshStandardMaterial;
  produk: THREE.MeshStandardMaterial[];
  sorot: THREE.MeshStandardMaterial;
}

let tekstur: Record<string, THREE.Texture> | null = null;
export function semuaTekstur() {
  if (!tekstur) {
    tekstur = {
      terrazzo: teksturTerrazzo(),
      walnut: teksturKayu('#4c3427', 'rgba(26,15,9,1)', 'rgba(124,88,62,1)', 21),
      oak: teksturKayu('#b58f68', 'rgba(110,76,48,1)', 'rgba(222,190,150,1)', 23),
      lantaiKayu: teksturKayu('#8a6446', 'rgba(60,38,24,1)', 'rgba(170,128,92,1)', 27, 8),
      kainHutan: teksturKain('#2b3f34', 3),
      kainLumut: teksturKain('#6f7c69', 4),
      kainPasir: teksturKain('#d4cbb9', 5),
      kainArang: teksturKain('#2f3330', 6),
      karpet: teksturKain('#3a403b', 7, 512),
      brushed: teksturBrushed(),
      plester: teksturBeton('#ece7de', 5),
      plesterLuar: teksturBeton('#e4ddd0', 8),
      beton: teksturBeton('#a8a294', 9),
      rumput: teksturRumput(),
      paving: teksturPaving(),
      aspal: teksturAspal(),
      ubin: teksturUbin('#e9e6df'),
      ubinDinding: teksturUbin('#f3f1ec'),
    };
  }
  return tekstur;
}

/** Ukuran satu ulangan tekstur dalam meter, dipakai untuk menskalakan UV sesuai ukuran nyata. */
export const UBIN_TEKSTUR: Record<string, number> = {
  terrazzo: 3,
  walnut: 1.4,
  oak: 1.4,
  lantaiKayu: 2.4,
  kainHutan: 0.8,
  kainLumut: 0.8,
  kainPasir: 0.8,
  kainArang: 0.8,
  karpet: 1.6,
  plester: 3,
  plesterLuar: 4,
  beton: 4,
  rumput: 6,
  paving: 3.2,
  aspal: 5,
  ubin: 1.2,
  ubinDinding: 1.2,
  logam: 0.6,
  logamGelap: 0.6,
  kuningan: 0.6,
};

/** Buat satu set material. Setiap lantai memakai set sendiri agar bisa dipudarkan terpisah. */
export function buatPustaka(ringan: boolean): Pustaka {
  const t = semuaTekstur();
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const fis = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p);
  const kaca = (warna: string, opasitas: number, kasar: number) =>
    fis({ color: warna, roughness: kasar, metalness: 0, transparent: true, opacity: opasitas, depthWrite: false, envMapIntensity: 1.6, specularIntensity: 1, ior: 1.5, side: THREE.DoubleSide });
  const p: Pustaka = {
    terrazzo: fis({ map: t.terrazzo, roughness: 0.32, metalness: 0, clearcoat: ringan ? 0 : 0.35, clearcoatRoughness: 0.25 }),
    walnut: std({ map: t.walnut, roughness: 0.5 }),
    oak: std({ map: t.oak, roughness: 0.55 }),
    lantaiKayu: std({ map: t.lantaiKayu, roughness: 0.45 }),
    logam: std({ color: '#c3bfb7', metalness: 1, roughness: 0.3, roughnessMap: t.brushed }),
    logamGelap: std({ color: '#2a2d2a', metalness: 0.8, roughness: 0.42, roughnessMap: t.brushed }),
    kuningan: std({ color: '#c08a58', metalness: 1, roughness: 0.28, roughnessMap: t.brushed }),
    kainHutan: std({ map: t.kainHutan, roughness: 0.97 }),
    kainLumut: std({ map: t.kainLumut, roughness: 0.97 }),
    kainPasir: std({ map: t.kainPasir, roughness: 0.96 }),
    kainArang: std({ map: t.kainArang, roughness: 0.97 }),
    karpet: std({ map: t.karpet, roughness: 1 }),
    plester: std({ map: t.plester, roughness: 0.9 }),
    plesterLuar: std({ map: t.plesterLuar, roughness: 0.92 }),
    beton: std({ map: t.beton, roughness: 0.7 }),
    ubin: std({ map: t.ubin, roughness: 0.25 }),
    ubinDinding: std({ map: t.ubinDinding, roughness: 0.2 }),
    keramik: fis({ color: '#f6f5f1', roughness: 0.12, clearcoat: 0.6 }),
    cermin: std({ color: '#d9dfdd', metalness: 1, roughness: 0.04 }),
    kacaBuram: kaca('#eef1ec', 0.62, 0.55),
    kacaBening: kaca('#cfdcd6', 0.16, 0.04),
    kacaFasad: kaca('#9fb3ad', 0.28, 0.03),
    aluminium: std({ color: '#3b3a36', metalness: 0.7, roughness: 0.35 }),
    layar: std({ color: '#0d100f', roughness: 0.18, metalness: 0.2 }),
    layarMenyala: std({ color: '#0d100f', emissive: '#7fa1b8', emissiveIntensity: 0.5, roughness: 0.2 }),
    lampu: std({ color: '#fff6e8', emissive: '#ffe2bd', emissiveIntensity: 2.2 }),
    plastikHitam: std({ color: '#1c1e1d', roughness: 0.5 }),
    plastikPutih: std({ color: '#ecebe6', roughness: 0.45 }),
    daun: std({ color: '#4f6b3b', roughness: 0.8 }),
    daunTua: std({ color: '#355030', roughness: 0.82 }),
    daunMuda: std({ color: '#71894d', roughness: 0.8 }),
    batang: std({ color: '#5a4636', roughness: 0.9 }),
    tanah: std({ color: '#3b3128', roughness: 1 }),
    potTerakota: std({ color: '#a8673f', roughness: 0.85 }),
    kardus: std({ color: '#b08f68', roughness: 0.9 }),
    produk: ['#d8cdb8', '#7d8a76', '#c46a2c', '#e9e2d4', '#3e4a40', '#c9a77f', '#8f3b2a'].map((c) => std({ color: c, roughness: 0.55 })),
    sorot: std({ color: '#fbe6d6', emissive: '#ef6c12', emissiveIntensity: 0, transparent: true, opacity: 0, depthWrite: false }),
  };
  for (const [k, m] of Object.entries(p)) if (m instanceof THREE.Material && UBIN_TEKSTUR[k]) m.userData.ubin = UBIN_TEKSTUR[k];
  return p;
}

/** Material luar ruangan (tanah, jalan) yang tidak ikut memudar per lantai. */
export function buatMaterialLuar() {
  const t = semuaTekstur();
  const m = {
    rumput: new THREE.MeshStandardMaterial({ map: t.rumput, roughness: 1 }),
    paving: new THREE.MeshStandardMaterial({ map: t.paving, roughness: 0.85 }),
    aspal: new THREE.MeshStandardMaterial({ map: t.aspal, roughness: 0.95 }),
    beton: new THREE.MeshStandardMaterial({ map: t.beton, roughness: 0.75 }),
    garisJalan: new THREE.MeshStandardMaterial({ color: '#e8e4da', roughness: 0.7 }),
  };
  m.rumput.userData.ubin = UBIN_TEKSTUR.rumput;
  m.paving.userData.ubin = UBIN_TEKSTUR.paving;
  m.aspal.userData.ubin = UBIN_TEKSTUR.aspal;
  m.beton.userData.ubin = UBIN_TEKSTUR.beton;
  return m;
}

export function semuaMaterial(p: Pustaka): THREE.Material[] {
  return Object.values(p).flatMap((v) => (Array.isArray(v) ? v : [v]));
}
