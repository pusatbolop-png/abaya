// Staf yang hidup di maket: karakter Meshy berkerangka yang bekerja di tempatnya (berbicara ke kamera,
// duduk di meja, menelepon), lalu sesekali berdiri, berjalan lewat aula ke suatu tujuan, singgah, dan
// kembali duduk. Gerakannya berupa klip Meshy; arah dan langkah diatur di sini.
import * as THREE from 'three';
import { clone as klonKerangka } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { muatBerkas } from './model';
import type { PetaJalan } from './navigasi';

export type NamaStaf =
  | 'host-wanita'
  | 'host-pria'
  | 'resepsionis-wanita'
  | 'resepsionis-pria'
  | 'petugas-disperindag'
  | 'petugas-dinkes'
  | 'jack'
  | 'didin'
  | 'achmad'
  | 'devita';

export type Aksi = 'jalan' | 'diam' | 'bicara' | 'telepon' | 'duduk' | 'duduk-bicara' | 'bangkit' | 'duduk-turun';

/** Posisi pinggul relatif kursi saat duduk (satuan klip: cm, sumbu +Z ke depan karakter). */
const PINGGUL_DUDUK = new THREE.Vector2(0, -12);
const CM = 0.01;
const LAJU = 1.05;

interface AsetStaf {
  contoh: THREE.Object3D;
  klip: Map<Aksi, THREE.AnimationClip>;
  /** Geseran pinggul di akhir klip bangkit dan di awal klip duduk-turun, dalam meter. */
  akhirBangkit: THREE.Vector2;
  awalDuduk: THREE.Vector2;
}

const simpanan = new Map<NamaStaf, Promise<AsetStaf>>();

export function muatStaf(nama: NamaStaf): Promise<AsetStaf> {
  let janji = simpanan.get(nama);
  if (!janji) {
    janji = Promise.all([muatBerkas(`staf/${nama}`), muatBerkas(`staf/${nama}-gerak`)]).then(([rig, gerak]) => {
      rig.scene.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (!m.isMesh) return;
        m.castShadow = false;
        m.receiveShadow = true;
        m.frustumCulled = false;
      });
      const klip = new Map<Aksi, THREE.AnimationClip>();
      for (const k of gerak.animations) klip.set(k.name as Aksi, k);
      const aset: AsetStaf = { contoh: rig.scene, klip, akhirBangkit: new THREE.Vector2(), awalDuduk: new THREE.Vector2() };
      siapkanKlip(aset);
      return aset;
    });
    janji.catch(() => simpanan.delete(nama));
    simpanan.set(nama, janji);
  }
  return janji;
}

/**
 * Klip Meshy menyimpan posisi pinggul yang berbeda-beda (duduk idle dan duduk berbicara bisa bergeser
 * puluhan sentimeter). Samakan agar peralihan antarklip tidak melompat: klip berdiri dipusatkan,
 * klip duduk diletakkan di atas kursi, dan klip transisi disambungkan ke keduanya.
 */
function siapkanKlip(aset: AsetStaf) {
  for (const [nama, klip] of aset.klip) {
    const jejak = klip.tracks.find((t) => t.name.endsWith('Hips.position'));
    if (!jejak) continue;
    const v = jejak.values;
    const n = v.length / 3;
    const titik = (i: number) => new THREE.Vector2(v[i * 3], v[i * 3 + 2]);
    let acuan: THREE.Vector2;
    let tujuan = new THREE.Vector2();
    if (nama === 'bangkit') {
      acuan = titik(0);
      tujuan = PINGGUL_DUDUK.clone();
      aset.akhirBangkit.copy(titik(n - 1).sub(acuan).add(tujuan).multiplyScalar(CM));
    } else if (nama === 'duduk-turun') {
      acuan = titik(n - 1);
      tujuan = PINGGUL_DUDUK.clone();
      aset.awalDuduk.copy(titik(0).sub(acuan).add(tujuan).multiplyScalar(CM));
    } else {
      acuan = new THREE.Vector2();
      for (let i = 0; i < n; i++) acuan.add(titik(i));
      acuan.divideScalar(n);
      if (nama === 'duduk' || nama === 'duduk-bicara') tujuan = PINGGUL_DUDUK.clone();
    }
    for (let i = 0; i < n; i++) {
      v[i * 3] += tujuan.x - acuan.x;
      v[i * 3 + 2] += tujuan.y - acuan.y;
    }
  }
}

export interface RencanaStaf {
  nama: NamaStaf;
  /** Tempat kerja dalam koordinat lantai; `arah` = sudut putar dengan karakter menghadap +Z pada 0. */
  posisi: THREE.Vector3;
  arah: number;
  pose: 'berdiri' | 'duduk';
  /** Aksi kerja saat ini, misalnya berbicara hanya ketika studio sedang siaran. */
  kerja: () => Aksi[];
  /** Titik dari tempat kerja ke luar ruangan, koordinat lantai. */
  keluar: THREE.Vector3[];
  /** Kandidat tujuan jalan kaki di aula; kosong berarti tidak pernah meninggalkan tempat. */
  tujuan: THREE.Vector3[];
  /** Selama bernilai true, staf tetap di tempat (misalnya sedang siaran). */
  tahan?: () => boolean;
  /** Pembangkit acak tetap agar setiap staf punya ritme sendiri. */
  benih: number;
}

type Keadaan = 'kerja' | 'bangkit' | 'pergi' | 'singgah' | 'kembali' | 'berbalik' | 'duduk-turun';

export class Penghuni {
  readonly akar = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private aksi = new Map<Aksi, THREE.AnimationAction>();
  private aktif: THREE.AnimationAction | null = null;
  private keadaan: Keadaan = 'kerja';
  private timer: number;
  private gantiKerja = 0;
  private jalur: THREE.Vector3[] = [];
  private langkah = 0;
  private jalurPergi: THREE.Vector3[] = [];
  private acak: () => number;

  constructor(
    private aset: AsetStaf,
    private r: RencanaStaf,
    private peta: PetaJalan,
    salinBahan: (m: THREE.Material) => THREE.Material,
    bayangan: THREE.Material,
    diam: boolean,
  ) {
    let s = r.benih * 9301 + 49297;
    this.acak = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const model = klonKerangka(aset.contoh);
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map(salinBahan) : salinBahan(m.material);
    });
    this.akar.add(model);
    // Bayangan lembut di kaki; peta bayangan gedung tetap statis.
    const bulat = new THREE.Mesh(BAYANGAN, bayangan);
    bulat.rotation.x = -Math.PI / 2;
    bulat.position.y = 0.012;
    bulat.renderOrder = 1;
    this.akar.add(bulat);
    this.akar.position.copy(r.posisi);
    this.akar.rotation.y = r.arah;
    this.mixer = new THREE.AnimationMixer(model);
    for (const [nama, klip] of aset.klip) {
      const a = this.mixer.clipAction(klip);
      if (nama === 'bangkit' || nama === 'duduk-turun') {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.aksi.set(nama, a);
    }
    this.timer = 15 + this.acak() * 45;
    this.mainkanKerja(0);
    // Gerak dikurangi: satu pose kerja, tidak berjalan.
    if (diam) this.mixer.update(1.5);
  }

  private main(nama: Aksi, pudar = 0.35) {
    const a = this.aksi.get(nama);
    if (!a || a === this.aktif) return a ?? null;
    a.reset().setEffectiveWeight(1).play();
    if (this.aktif && pudar > 0) a.crossFadeFrom(this.aktif, pudar, false);
    else this.aktif?.stop();
    this.aktif = a;
    return a;
  }

  private mainkanKerja(pudar = 0.5) {
    const pilihan = this.r.kerja().filter((k) => this.aksi.has(k));
    const nama = pilihan[Math.floor(this.acak() * pilihan.length)] ?? (this.r.pose === 'duduk' ? 'duduk' : 'diam');
    const a = this.main(nama, pudar);
    // Mulai dari titik acak agar staf berklip sama tidak bergerak serempak.
    if (a && pudar === 0) a.time = this.acak() * a.getClip().duration;
    this.gantiKerja = 8 + this.acak() * 10;
  }

  private titikLokal(v: THREE.Vector2) {
    // Geseran (x, z) dalam arah hadap karakter, ke koordinat lantai.
    return new THREE.Vector3(v.x, 0, v.y).applyAxisAngle(SUMBU_Y, this.r.arah).add(this.r.posisi);
  }

  private rencanakanPergi() {
    if (!this.r.tujuan.length || this.r.tahan?.()) return false;
    const tujuan = this.r.tujuan[Math.floor(this.acak() * this.r.tujuan.length)];
    const pintu = this.r.keluar[this.r.keluar.length - 1] ?? this.r.posisi;
    const aula = this.peta.jalur(pintu, tujuan);
    if (!aula) return false;
    const mulai = this.r.pose === 'duduk' && this.aksi.has('bangkit') ? this.titikLokal(this.aset.akhirBangkit) : this.r.posisi.clone();
    this.jalurPergi = [mulai, ...this.r.keluar, ...aula.slice(1)];
    return true;
  }

  perbarui(dt: number) {
    this.mixer.update(dt);
    this.timer -= dt;
    switch (this.keadaan) {
      case 'kerja': {
        this.gantiKerja -= dt;
        if (this.gantiKerja <= 0) this.mainkanKerja();
        if (this.timer > 0) return;
        if (!this.rencanakanPergi()) {
          this.timer = 20 + this.acak() * 30;
          return;
        }
        if (this.r.pose === 'duduk' && this.aksi.has('bangkit')) {
          const a = this.main('bangkit', 0.3)!;
          this.keadaan = 'bangkit';
          this.timer = a.getClip().duration - 0.3;
        } else this.mulaiJalan('pergi');
        return;
      }
      case 'bangkit':
        if (this.timer <= 0) {
          this.akar.position.copy(this.jalurPergi[0]);
          this.mulaiJalan('pergi');
        }
        return;
      case 'pergi':
      case 'kembali':
        this.melangkah(dt);
        return;
      case 'singgah':
        if (this.timer > 0) return;
        {
          // Jalur pulang: kebalikan jalur pergi, berakhir di titik mulai duduk (atau tempat berdiri).
          const pulang = [...this.jalurPergi].reverse();
          pulang[pulang.length - 1] =
            this.r.pose === 'duduk' && this.aksi.has('duduk-turun') ? this.titikLokal(this.aset.awalDuduk) : this.r.posisi.clone();
          this.jalurPergi = pulang;
          this.mulaiJalan('kembali');
        }
        return;
      case 'berbalik': {
        const beda = sudutBeda(this.akar.rotation.y, this.r.arah);
        this.akar.rotation.y += THREE.MathUtils.clamp(beda, -4 * dt, 4 * dt);
        if (Math.abs(beda) > 0.04) return;
        this.akar.rotation.y = this.r.arah;
        if (this.r.pose === 'duduk' && this.aksi.has('duduk-turun')) {
          this.akar.position.copy(this.r.posisi);
          const a = this.main('duduk-turun', 0.25)!;
          this.keadaan = 'duduk-turun';
          this.timer = a.getClip().duration - 0.35;
        } else this.selesaiKembali();
        return;
      }
      case 'duduk-turun':
        if (this.timer <= 0) this.selesaiKembali();
        return;
    }
  }

  private selesaiKembali() {
    this.akar.position.copy(this.r.posisi);
    this.keadaan = 'kerja';
    this.timer = 30 + this.acak() * 60;
    this.mainkanKerja(0.4);
  }

  private mulaiJalan(arah: 'pergi' | 'kembali') {
    this.keadaan = arah;
    this.jalur = this.jalurPergi;
    this.langkah = 1;
    this.main('jalan', 0.3);
  }

  private melangkah(dt: number) {
    const sasaran = this.jalur[this.langkah];
    if (!sasaran) {
      if (this.keadaan === 'pergi') {
        this.keadaan = 'singgah';
        this.timer = 5 + this.acak() * 8;
        this.main(this.aksi.has('telepon') && this.acak() < 0.5 ? 'telepon' : 'diam', 0.4);
      } else this.keadaan = 'berbalik';
      return;
    }
    const p = this.akar.position;
    const dx = sasaran.x - p.x;
    const dz = sasaran.z - p.z;
    const jarak = Math.hypot(dx, dz);
    // Berbelok halus ke arah titik berikutnya; perlambat bila sudutnya tajam.
    const beda = sudutBeda(this.akar.rotation.y, Math.atan2(dx, dz));
    this.akar.rotation.y += THREE.MathUtils.clamp(beda, -5 * dt, 5 * dt);
    const laju = LAJU * (Math.abs(beda) > 1 ? 0.35 : 1);
    const maju = laju * dt;
    if (jarak <= maju) {
      p.x = sasaran.x;
      p.z = sasaran.z;
      this.langkah++;
    } else {
      p.x += (dx / jarak) * maju;
      p.z += (dz / jarak) * maju;
    }
  }

  buang() {
    this.mixer.stopAllAction();
    this.akar.removeFromParent();
  }
}

const SUMBU_Y = new THREE.Vector3(0, 1, 0);
const BAYANGAN = new THREE.CircleGeometry(0.32, 24);

function sudutBeda(dari: number, ke: number) {
  let d = (ke - dari) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Tekstur bayangan bundar lembut untuk kaki staf. */
export function teksturBayangan() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
