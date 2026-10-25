// Peta jalan kaki per lantai: kisi 25 cm di atas pelat, sel terhalang oleh ruangan berdinding, tangga,
// dan perabot aula. Jalur dicari dengan A* delapan arah lalu dirapikan dengan garis pandang, sehingga
// staf berjalan lurus di aula dan berbelok hanya di sudut.
import * as THREE from 'three';

const SEL = 0.25;

export class PetaJalan {
  private kolom: number;
  private baris: number;
  private blok: Uint8Array;

  /** Lebar dan panjang pelat dalam meter; koordinat dunia berpusat di tengah pelat (x, z). */
  constructor(
    private lebar: number,
    private panjang: number,
  ) {
    this.kolom = Math.ceil(lebar / SEL);
    this.baris = Math.ceil(panjang / SEL);
    this.blok = new Uint8Array(this.kolom * this.baris);
    // Tepi pelat (dinding luar) selalu terhalang.
    this.halangi(-lebar / 2, -lebar / 2 + 0.35, -panjang / 2, panjang / 2);
    this.halangi(lebar / 2 - 0.35, lebar / 2, -panjang / 2, panjang / 2);
    this.halangi(-lebar / 2, lebar / 2, -panjang / 2, -panjang / 2 + 0.35);
    this.halangi(-lebar / 2, lebar / 2, panjang / 2 - 0.35, panjang / 2);
  }

  /** Tandai persegi panjang dunia (x1..x2, z1..z2) sebagai tidak bisa dilewati. */
  halangi(x1: number, x2: number, z1: number, z2: number) {
    const [c1, r1] = this.sel(Math.min(x1, x2), Math.min(z1, z2));
    const [c2, r2] = this.sel(Math.max(x1, x2), Math.max(z1, z2));
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) this.blok[r * this.kolom + c] = 1;
  }

  /** Buka kembali persegi panjang, misalnya ambang pintu sebuah ruangan. */
  buka(x1: number, x2: number, z1: number, z2: number) {
    const [c1, r1] = this.sel(Math.min(x1, x2), Math.min(z1, z2));
    const [c2, r2] = this.sel(Math.max(x1, x2), Math.max(z1, z2));
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) this.blok[r * this.kolom + c] = 0;
  }

  bebas(x: number, z: number) {
    const [c, r] = this.sel(x, z);
    return !this.blok[r * this.kolom + c];
  }

  /** Jalur dari a ke b (y diabaikan, hasil memakai y dari a). Null bila tidak tersambung. */
  jalur(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] | null {
    const mulai = this.terdekatBebas(...this.sel(a.x, a.z));
    const akhir = this.terdekatBebas(...this.sel(b.x, b.z));
    if (mulai < 0 || akhir < 0) return null;
    const n = this.kolom * this.baris;
    const g = new Float32Array(n).fill(Infinity);
    const asal = new Int32Array(n).fill(-1);
    const tutup = new Uint8Array(n);
    const antre: [number, number][] = [];
    const ac = akhir % this.kolom;
    const ar = Math.floor(akhir / this.kolom);
    const h = (i: number) => Math.hypot((i % this.kolom) - ac, Math.floor(i / this.kolom) - ar);
    g[mulai] = 0;
    antre.push([h(mulai), mulai]);
    while (antre.length) {
      // Antrean kecil (paling banyak beberapa ribu sel), jadi pencarian minimum linear sudah cukup.
      let k = 0;
      for (let i = 1; i < antre.length; i++) if (antre[i][0] < antre[k][0]) k = i;
      const [, i] = antre[k];
      antre[k] = antre[antre.length - 1];
      antre.pop();
      if (tutup[i]) continue;
      tutup[i] = 1;
      if (i === akhir) break;
      const c = i % this.kolom;
      const r = Math.floor(i / this.kolom);
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const cc = c + dc;
          const rr = r + dr;
          if (cc < 0 || rr < 0 || cc >= this.kolom || rr >= this.baris) continue;
          const j = rr * this.kolom + cc;
          if (this.blok[j] || tutup[j]) continue;
          // Jangan memotong sudut terhalang secara diagonal.
          if (dr && dc && (this.blok[r * this.kolom + cc] || this.blok[rr * this.kolom + c])) continue;
          const ng = g[i] + (dr && dc ? Math.SQRT2 : 1);
          if (ng < g[j]) {
            g[j] = ng;
            asal[j] = i;
            antre.push([ng + h(j), j]);
          }
        }
    }
    if (!tutup[akhir]) return null;
    const sel: number[] = [];
    for (let i = akhir; i !== -1; i = asal[i]) sel.push(i);
    sel.reverse();
    // Rapikan: lompati titik yang masih terlihat langsung dari titik terakhir yang diambil.
    const titik = sel.map((i) => this.pusat(i, a.y));
    const rapi = [titik[0]];
    let p = 0;
    while (p < titik.length - 1) {
      let q = titik.length - 1;
      while (q > p + 1 && !this.tampak(titik[p], titik[q])) q--;
      rapi.push(titik[q]);
      p = q;
    }
    rapi[rapi.length - 1] = new THREE.Vector3(b.x, a.y, b.z);
    return rapi;
  }

  private tampak(a: THREE.Vector3, b: THREE.Vector3) {
    const langkah = Math.ceil(a.distanceTo(b) / (SEL / 2));
    for (let i = 1; i < langkah; i++) {
      const t = i / langkah;
      if (!this.bebas(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  private sel(x: number, z: number): [number, number] {
    const c = THREE.MathUtils.clamp(Math.floor((x + this.lebar / 2) / SEL), 0, this.kolom - 1);
    const r = THREE.MathUtils.clamp(Math.floor((z + this.panjang / 2) / SEL), 0, this.baris - 1);
    return [c, r];
  }

  private pusat(i: number, y: number) {
    return new THREE.Vector3(((i % this.kolom) + 0.5) * SEL - this.lebar / 2, y, (Math.floor(i / this.kolom) + 0.5) * SEL - this.panjang / 2);
  }

  /** Sel bebas terdekat (pencarian melebar), agar titik di ambang pintu tetap tersambung. */
  private terdekatBebas(c: number, r: number) {
    for (let jari = 0; jari < 8; jari++)
      for (let dr = -jari; dr <= jari; dr++)
        for (let dc = -jari; dc <= jari; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== jari) continue;
          const cc = c + dc;
          const rr = r + dr;
          if (cc < 0 || rr < 0 || cc >= this.kolom || rr >= this.baris) continue;
          if (!this.blok[rr * this.kolom + cc]) return rr * this.kolom + cc;
        }
    return -1;
  }
}
