import * as THREE from 'three';

// Tekstur prosedural yang digambar di kanvas: tanpa berkas gambar eksternal,
// warnanya diturunkan langsung dari palet aplikasi.

function acak(benih: number) {
  let s = benih >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function kanvas(ukuran: number) {
  const c = document.createElement('canvas');
  c.width = c.height = ukuran;
  return { c, g: c.getContext('2d')! };
}

function jadikanTekstur(c: HTMLCanvasElement, ulang: [number, number], warna = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...ulang);
  t.anisotropy = 8;
  if (warna) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Terrazzo hangat: dasar pasir dengan serpihan abu vulkanik, lumut, arang, dan sedikit tembaga. */
function teksturTerrazzo(ukuran = 1024) {
  const { c, g } = kanvas(ukuran);
  const r = acak(7);
  g.fillStyle = '#e6dfd2';
  g.fillRect(0, 0, ukuran, ukuran);
  // Variasi halus pada semen dasar.
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${150 + r() * 60},${140 + r() * 50},${120 + r() * 40},${0.05 + r() * 0.06})`;
    g.fillRect(r() * ukuran, r() * ukuran, 2 + r() * 6, 2 + r() * 6);
  }
  const serpih = ['#bfb6a6', '#a59d8d', '#7d8a76', '#5f6b5a', '#3a3f3a', '#cfc7b8', '#9c6a4a', '#f2ede4'];
  const bobot = [16, 14, 8, 5, 4, 14, 2, 10];
  const total = bobot.reduce((a, b) => a + b, 0);
  const pilih = () => {
    let x = r() * total;
    for (let i = 0; i < serpih.length; i++) if ((x -= bobot[i]) < 0) return serpih[i];
    return serpih[0];
  };
  for (let i = 0; i < 2200; i++) {
    const x = r() * ukuran;
    const y = r() * ukuran;
    const s = r() < 0.08 ? 7 + r() * 9 : 1.5 + r() * 4.5;
    g.fillStyle = pilih();
    g.beginPath();
    const sisi = 4 + Math.floor(r() * 4);
    for (let k = 0; k < sisi; k++) {
      const a = (k / sisi) * Math.PI * 2 + r() * 0.6;
      const rr = s * (0.6 + r() * 0.5);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (k === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
  }
  return jadikanTekstur(c, [3, 3]);
}

/** Serat walnut: urat memanjang dengan variasi ton cokelat tua. */
function teksturWalnut(ukuran = 1024) {
  const { c, g } = kanvas(ukuran);
  const r = acak(21);
  g.fillStyle = '#4a3326';
  g.fillRect(0, 0, ukuran, ukuran);
  for (let i = 0; i < 260; i++) {
    const y = r() * ukuran;
    const tebal = 1 + r() * 5;
    const gelap = r() < 0.5;
    g.strokeStyle = gelap ? `rgba(30,18,12,${0.18 + r() * 0.3})` : `rgba(122,86,60,${0.12 + r() * 0.25})`;
    g.lineWidth = tebal;
    g.beginPath();
    let yy = y;
    g.moveTo(0, yy);
    for (let x = 0; x <= ukuran; x += 32) {
      yy += (r() - 0.5) * 3;
      g.lineTo(x, yy + Math.sin(x / (80 + r() * 60)) * 4);
    }
    g.stroke();
  }
  // Mata kayu sesekali.
  for (let i = 0; i < 5; i++) {
    const x = r() * ukuran;
    const y = r() * ukuran;
    for (let k = 0; k < 7; k++) {
      g.strokeStyle = `rgba(28,16,10,${0.25 - k * 0.03})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(x, y, 10 + k * 7, 3 + k * 2.4, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  return jadikanTekstur(c, [1, 1]);
}

/** Kain peredam akustik: anyaman halus, dipakai sebagai peta kekasaran dan warna. */
function teksturKain(dasar: string, ukuran = 256) {
  const { c, g } = kanvas(ukuran);
  const r = acak(3);
  g.fillStyle = dasar;
  g.fillRect(0, 0, ukuran, ukuran);
  for (let y = 0; y < ukuran; y += 2) {
    g.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.05})`;
    g.fillRect(0, y, ukuran, 1);
  }
  for (let x = 0; x < ukuran; x += 2) {
    g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`;
    g.fillRect(x, 0, 1, ukuran);
  }
  return jadikanTekstur(c, [4, 4]);
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
  return jadikanTekstur(c, [2, 2], false);
}

/** Beton halus atau plester: noda lembut berskala besar. */
function teksturBeton(dasar: string, benih: number, ukuran = 512) {
  const { c, g } = kanvas(ukuran);
  const r = acak(benih);
  g.fillStyle = dasar;
  g.fillRect(0, 0, ukuran, ukuran);
  for (let i = 0; i < 180; i++) {
    const x = r() * ukuran;
    const y = r() * ukuran;
    const rad = 20 + r() * 90;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.025 + r() * 0.035;
    const terang = r() < 0.5;
    grd.addColorStop(0, terang ? `rgba(255,255,255,${a})` : `rgba(40,36,30,${a})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = `rgba(30,28,24,${r() * 0.06})`;
    g.fillRect(r() * ukuran, r() * ukuran, 1, 1);
  }
  return jadikanTekstur(c, [2, 2]);
}

export interface Pustaka {
  terrazzo: THREE.MeshStandardMaterial;
  walnut: THREE.MeshStandardMaterial;
  walnutMuda: THREE.MeshStandardMaterial;
  logam: THREE.MeshStandardMaterial;
  logamGelap: THREE.MeshStandardMaterial;
  kuningan: THREE.MeshStandardMaterial;
  kainHutan: THREE.MeshStandardMaterial;
  kainLumut: THREE.MeshStandardMaterial;
  kainPasir: THREE.MeshStandardMaterial;
  plester: THREE.MeshStandardMaterial;
  beton: THREE.MeshStandardMaterial;
  betonLuar: THREE.MeshStandardMaterial;
  kacaBuram: THREE.MeshPhysicalMaterial;
  kacaBening: THREE.MeshPhysicalMaterial;
  layar: THREE.MeshStandardMaterial;
  lampu: THREE.MeshStandardMaterial;
  daun: THREE.MeshStandardMaterial;
  daunTua: THREE.MeshStandardMaterial;
  tanah: THREE.MeshStandardMaterial;
  kardus: THREE.MeshStandardMaterial;
  produk: THREE.MeshStandardMaterial[];
  sorot: THREE.MeshStandardMaterial;
}

let tekstur: Record<string, THREE.Texture> | null = null;
function semuaTekstur() {
  if (!tekstur) {
    tekstur = {
      terrazzo: teksturTerrazzo(),
      walnut: teksturWalnut(),
      kainHutan: teksturKain('#2b3f34'),
      kainLumut: teksturKain('#6f7c69'),
      kainPasir: teksturKain('#cfc6b4'),
      brushed: teksturBrushed(),
      plester: teksturBeton('#e9e3d8', 5),
      beton: teksturBeton('#a8a294', 9),
      betonLuar: teksturBeton('#2a2e2a', 13),
    };
  }
  return tekstur;
}

/** Buat satu set material. Setiap lantai memakai set sendiri agar bisa dipudarkan terpisah. */
export function buatPustaka(ringan: boolean): Pustaka {
  const t = semuaTekstur();
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const kaca = (p: THREE.MeshPhysicalMaterialParameters) =>
    new THREE.MeshPhysicalMaterial(
      ringan
        ? { color: p.color, roughness: p.roughness, metalness: 0, transparent: true, opacity: p.opacity ?? 0.35, depthWrite: false }
        : { ...p, transparent: true, depthWrite: false },
    );
  return {
    terrazzo: std({ map: t.terrazzo, roughness: 0.42, metalness: 0 }),
    walnut: std({ map: t.walnut, color: '#ffffff', roughness: 0.48, metalness: 0 }),
    walnutMuda: std({ map: t.walnut, color: '#d9b896', roughness: 0.55 }),
    logam: std({ color: '#b9b5ad', metalness: 1, roughness: 0.32, roughnessMap: t.brushed }),
    logamGelap: std({ color: '#2a2d2a', metalness: 0.85, roughness: 0.45, roughnessMap: t.brushed }),
    kuningan: std({ color: '#b98455', metalness: 1, roughness: 0.28, roughnessMap: t.brushed }),
    kainHutan: std({ map: t.kainHutan, roughness: 0.96 }),
    kainLumut: std({ map: t.kainLumut, roughness: 0.96 }),
    kainPasir: std({ map: t.kainPasir, roughness: 0.95 }),
    plester: std({ map: t.plester, roughness: 0.88 }),
    beton: std({ map: t.beton, roughness: 0.62 }),
    betonLuar: std({ map: t.betonLuar, color: '#8f8a80', roughness: 0.95 }),
    kacaBuram: kaca({ color: '#e8ece6', roughness: 0.55, metalness: 0, transmission: 0.92, thickness: 0.04, ior: 1.45, opacity: 0.55 }),
    kacaBening: kaca({ color: '#d9e2dc', roughness: 0.06, metalness: 0, transmission: 0.96, thickness: 0.02, ior: 1.5, opacity: 0.18 }),
    layar: std({ color: '#0f1311', emissive: '#30443a', emissiveIntensity: 0.6, roughness: 0.2 }),
    lampu: std({ color: '#fff4e2', emissive: '#ffd9a8', emissiveIntensity: 1.6 }),
    daun: std({ color: '#5f6f55', roughness: 0.85 }),
    daunTua: std({ color: '#3f4f3c', roughness: 0.85 }),
    tanah: std({ color: '#3b3128', roughness: 1 }),
    kardus: std({ color: '#b08f68', roughness: 0.9 }),
    produk: ['#d8cdb8', '#7d8a76', '#a4532b', '#e9e2d4', '#3e4a40', '#c9a77f'].map((c) => std({ color: c, roughness: 0.6 })),
    sorot: std({ color: '#f3e3d8', emissive: '#a4532b', emissiveIntensity: 0, transparent: true, opacity: 0, depthWrite: false }),
  };
}

export function semuaMaterial(p: Pustaka): THREE.Material[] {
  return Object.values(p).flatMap((v) => (Array.isArray(v) ? v : [v]));
}
