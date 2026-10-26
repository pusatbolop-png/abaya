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
/**
 * Tinggi sendi pinggul saat duduk, cm. Dudukan kursi kayu dan kursi kantor di maket sekitar 47 cm,
 * dan sendi pinggul berada sekitar 11 cm di atas dudukan.
 */
const TINGGI_DUDUK = 58;
const CM = 0.01;
/** Laju berjalan di aula, m/detik. Klip jalan diputar lebih lambat atau cepat agar langkahnya menapak pas. */
const LAJU = 1.1;
/** Laju putar badan, rad/detik: saat berjalan dan saat berbalik di tempat. */
const PUTAR_JALAN = 3.5;
const PUTAR_DIAM = 2.6;

interface AsetStaf {
  contoh: THREE.Object3D;
  klip: Map<Aksi, THREE.AnimationClip>;
  /** Geseran pinggul di akhir klip bangkit dan di awal klip duduk-turun, dalam meter. */
  akhirBangkit: THREE.Vector2;
  awalDuduk: THREE.Vector2;
  /** Laju alami klip jalan (kecepatan telapak saat menapak), m/detik. */
  lajuJalan: number;
  /** Tinggi sendi pergelangan kaki saat telapak rata di lantai (pose ikat), m. */
  kakiLantai: number;
  /** Tinggi pinggul rata-rata saat berdiri, cm (ruang kerangka). */
  pinggulBerdiri: number;
}

interface Kaki {
  paha: THREE.Object3D;
  betis: THREE.Object3D;
  telapak: THREE.Object3D;
}

interface Tulang {
  pinggul: THREE.Object3D;
  kaki: Kaki[];
}

function cariTulang(model: THREE.Object3D): Tulang | null {
  const nama = new Map<string, THREE.Object3D>();
  model.traverse((o) => {
    if ((o as THREE.Bone).isBone) nama.set(o.name, o);
  });
  const pinggul = nama.get('Hips');
  const kaki = ['Left', 'Right'].map((sisi) => ({ paha: nama.get(`${sisi}UpLeg`), betis: nama.get(`${sisi}Leg`), telapak: nama.get(`${sisi}Foot`) }));
  if (!pinggul || kaki.some((k) => !k.paha || !k.betis || !k.telapak)) return null;
  return { pinggul, kaki: kaki as Kaki[] };
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
      const aset: AsetStaf = {
        contoh: rig.scene,
        klip,
        akhirBangkit: new THREE.Vector2(),
        awalDuduk: new THREE.Vector2(),
        lajuJalan: 1.2,
        kakiLantai: 0.12,
        pinggulBerdiri: 88,
      };
      siapkanKlip(aset, tapakkanBerdiri(aset));
      ukurGerak(aset);
      return aset;
    });
    janji.catch(() => simpanan.delete(nama));
    simpanan.set(nama, janji);
  }
  return janji;
}

/**
 * Klip Meshy menyimpan posisi pinggul yang berbeda-beda (duduk idle dan duduk berbicara bisa bergeser
 * puluhan sentimeter, dan tingginya berbeda sampai 10 cm). Samakan agar peralihan antarklip tidak
 * melompat dan orang tidak melayang di atas kursi: klip berdiri dipusatkan, klip duduk diletakkan di
 * atas dudukan kursi, dan klip transisi disambungkan ke keduanya.
 */
function siapkanKlip(aset: AsetStaf, geserBerdiri: Map<Aksi, number>) {
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
    // Tinggi pinggul: klip duduk setinggi dudukan; klip bangkit dan duduk-turun berangsur dari tinggi
    // duduk itu ke tinggi berdiri aslinya, sehingga koreksinya hilang begitu orang tegak.
    if (nama === 'duduk' || nama === 'duduk-bicara') {
      let rata = 0;
      for (let i = 0; i < n; i++) rata += v[i * 3 + 1] / n;
      for (let i = 0; i < n; i++) v[i * 3 + 1] += TINGGI_DUDUK - rata;
    } else if (nama === 'bangkit' || nama === 'duduk-turun') {
      // Ujung berdirinya disambungkan ke klip yang menyusul (jalan) atau mendahului (diam).
      const yDuduk = v[(nama === 'bangkit' ? 0 : n - 1) * 3 + 1];
      const yBerdiri = v[(nama === 'bangkit' ? n - 1 : 0) * 3 + 1];
      const koreksi = TINGGI_DUDUK - yDuduk;
      const tegak = (nama === 'bangkit' ? geserBerdiri.get('jalan') : (geserBerdiri.get('diam') ?? geserBerdiri.get('telepon'))) ?? 0;
      for (let i = 0; i < n; i++) {
        const p = THREE.MathUtils.clamp((v[i * 3 + 1] - yDuduk) / (yBerdiri - yDuduk), 0, 1);
        v[i * 3 + 1] += koreksi * (1 - p) + tegak * p;
      }
    } else v.forEach((_, i) => i % 3 === 1 && (v[i] += geserBerdiri.get(nama) ?? 0));
  }
}

/**
 * Klip berdiri dari Meshy tidak sama tingginya: saat berjalan kaki melayang sampai 3 cm, saat berbicara
 * kaki tenggelam sampai 5 cm. Hitung geser tegak pinggul (cm) agar pergelangan kaki terendah setiap klip
 * berdiri setinggi pose ikatnya, yaitu saat telapak rata di lantai.
 */
function tapakkanBerdiri(aset: AsetStaf) {
  const geser = new Map<Aksi, number>();
  const model = klonKerangka(aset.contoh);
  const t = cariTulang(model);
  if (!t) return geser;
  model.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const tinggiKaki = () => Math.min(...t.kaki.map((k) => v.setFromMatrixPosition(k.telapak.matrixWorld).y));
  aset.kakiLantai = tinggiKaki();
  const mixer = new THREE.AnimationMixer(model);
  for (const nama of ['diam', 'bicara', 'telepon', 'jalan'] as Aksi[]) {
    const klip = aset.klip.get(nama);
    if (!klip) continue;
    const a = mixer.clipAction(klip).play();
    let bawah = Infinity;
    for (let i = 0; i < 32; i++) {
      mixer.setTime((klip.duration * i) / 32);
      model.updateMatrixWorld(true);
      bawah = Math.min(bawah, tinggiKaki());
    }
    a.stop();
    geser.set(nama, (aset.kakiLantai - bawah) / CM);
  }
  return geser;
}

/**
 * Ukur dari klipnya sendiri: laju langkah alami (kecepatan telapak saat menapak pada klip jalan di
 * tempat) dan tinggi pinggul saat berdiri.
 */
function ukurGerak(aset: AsetStaf) {
  const model = klonKerangka(aset.contoh);
  const t = cariTulang(model);
  if (!t) return;
  const mixer = new THREE.AnimationMixer(model);
  const sampel = (klip: THREE.AnimationClip, n: number, ambil: () => void) => {
    const a = mixer.clipAction(klip).play();
    for (let i = 0; i < n; i++) {
      mixer.setTime((klip.duration * i) / n);
      model.updateMatrixWorld(true);
      ambil();
    }
    a.stop();
  };
  const berdiri = (['diam', 'telepon', 'bicara', 'jalan'] as Aksi[]).map((k) => aset.klip.get(k)).find(Boolean);
  if (berdiri) {
    let pinggul = 0;
    sampel(berdiri, 24, () => (pinggul += t.pinggul.position.y / 24));
    aset.pinggulBerdiri = pinggul;
  }
  const jalan = aset.klip.get('jalan');
  if (jalan) {
    const n = 48;
    const jejak = t.kaki.map(() => [] as THREE.Vector3[]);
    sampel(jalan, n, () => t.kaki.forEach((k, j) => jejak[j].push(new THREE.Vector3().setFromMatrixPosition(k.telapak.matrixWorld))));
    const laju: number[] = [];
    for (const titik of jejak) {
      const bawah = Math.min(...titik.map((p) => p.y)) + 0.015;
      for (let i = 0; i < n; i++) {
        const a = titik[i];
        const b = titik[(i + 1) % n];
        if (a.y < bawah && b.y < bawah) laju.push(Math.hypot(b.x - a.x, b.z - a.z) / (jalan.duration / n));
      }
    }
    laju.sort((a, b) => a - b);
    if (laju.length) aset.lajuJalan = THREE.MathUtils.clamp(laju[Math.floor(laju.length / 2)], 0.6, 2);
  }
}

/** Tujuan yang sedang dituju atau ditempati, agar dua orang tidak berdiri di titik yang sama. */
const terpakai = new Set<string>();
const kunciTitik = (v: THREE.Vector3) => `${v.x.toFixed(2)}|${v.z.toFixed(2)}`;

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
  /** Lama bekerja di tempat sebelum berjalan lagi, detik: [paling singkat, rentang acak]. */
  selang?: [number, number];
  /** Aksi saat singgah di tujuan; bawaan: diam atau menelepon. */
  singgah?: Aksi[];
  /** Arah hadap saat singgah, sejajar dengan `tujuan` (misalnya pramusaji menghadap meja). */
  arahTujuan?: number[];
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
  private arahSinggah: number | null = null;
  private dipesan: string | null = null;
  private tulang: Tulang | null;
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
    this.tulang = cariTulang(model);
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
    this.timer = r.selang ? r.selang[0] + this.acak() * r.selang[1] : 15 + this.acak() * 45;
    this.mainkanKerja(0);
    // Gerak dikurangi: satu pose kerja, tidak berjalan.
    if (diam) {
      this.mixer.update(1.5);
      this.tanamKaki();
    }
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
    const bebas = this.r.tujuan.map((_, i) => i).filter((i) => !terpakai.has(kunciTitik(this.r.tujuan[i])));
    if (!bebas.length) return false;
    const ke = bebas[Math.floor(this.acak() * bebas.length)];
    const tujuan = this.r.tujuan[ke];
    const pintu = this.r.keluar[this.r.keluar.length - 1] ?? this.r.posisi;
    const aula = this.peta.jalur(pintu, tujuan);
    if (!aula) return false;
    this.arahSinggah = this.r.arahTujuan?.[ke] ?? null;
    this.dipesan = kunciTitik(tujuan);
    terpakai.add(this.dipesan);
    const mulai = this.r.pose === 'duduk' && this.aksi.has('bangkit') ? this.titikLokal(this.aset.akhirBangkit) : this.r.posisi.clone();
    this.jalurPergi = [mulai, ...this.r.keluar, ...aula.slice(1)];
    return true;
  }

  private lepasPesanan() {
    if (this.dipesan) terpakai.delete(this.dipesan);
    this.dipesan = null;
  }

  /** Pose berdiri tanpa melangkah, untuk berbalik di tempat (bukan berjalan di tempat). */
  private diamBerdiri(pudar: number) {
    const nama = (['diam', 'telepon', 'bicara'] as Aksi[]).find((k) => this.aksi.has(k));
    if (nama) this.main(nama, pudar);
  }

  /**
   * Saat duduk, tapakkan kedua kaki ke lantai dengan IK dua tulang (paha dan betis). Pinggul klip duduk
   * sudah diturunkan ke dudukan kursi, jadi tanpa ini kaki menembus lantai atau menggantung. Bobotnya
   * berangsur menurut tinggi pinggul, sehingga ikut halus saat bangkit dan duduk kembali.
   */
  private tanamKaki() {
    const t = this.tulang;
    if (!t) return;
    const atas = this.aset.pinggulBerdiri - 6;
    const w = THREE.MathUtils.clamp((atas - t.pinggul.position.y) / (atas - TINGGI_DUDUK), 0, 1);
    if (w < 0.02) return;
    this.akar.updateMatrixWorld(true);
    const lantai = this.akar.matrixWorld.elements[13] + this.aset.kakiLantai;
    for (const k of t.kaki) {
      k.telapak.matrixWorld.decompose(_kaki, _qKaki, _skala);
      const sasaran = _sasaran.copy(_kaki);
      sasaran.y += (lantai - _kaki.y) * w;
      if (Math.abs(sasaran.y - _kaki.y) < 0.002) continue;
      ikDuaTulang(k, sasaran);
      // Telapak tetap sejajar seperti pada klipnya.
      aturRotasiDunia(k.telapak, _qKaki);
    }
  }

  perbarui(dt: number) {
    this.mixer.update(dt);
    this.tanamKaki();
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
        if (this.arahSinggah !== null) {
          const beda = sudutBeda(this.akar.rotation.y, this.arahSinggah);
          this.akar.rotation.y += THREE.MathUtils.clamp(beda, -3 * dt, 3 * dt);
        }
        if (this.timer > 0) return;
        {
          this.lepasPesanan();
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
        this.akar.rotation.y += THREE.MathUtils.clamp(beda, -PUTAR_DIAM * dt, PUTAR_DIAM * dt);
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
    this.timer = this.r.selang ? this.r.selang[0] + this.acak() * this.r.selang[1] : 30 + this.acak() * 60;
    this.mainkanKerja(0.4);
  }

  private mulaiJalan(arah: 'pergi' | 'kembali') {
    this.keadaan = arah;
    this.jalur = this.jalurPergi;
    this.langkah = 1;
    this.main('jalan', 0.3)?.setEffectiveTimeScale(LAJU / this.aset.lajuJalan);
  }

  private melangkah(dt: number) {
    const sasaran = this.jalur[this.langkah];
    if (!sasaran) {
      if (this.keadaan === 'pergi') {
        this.keadaan = 'singgah';
        this.timer = 5 + this.acak() * 8;
        const pilihan = (this.r.singgah ?? (this.acak() < 0.5 ? ['telepon'] : ['diam'])).filter((k) => this.aksi.has(k));
        const nama = pilihan[Math.floor(this.acak() * pilihan.length)];
        if (nama) this.main(nama, 0.4);
        else this.diamBerdiri(0.4);
      } else {
        this.keadaan = 'berbalik';
        this.diamBerdiri(0.3);
      }
      return;
    }
    const p = this.akar.position;
    const dx = sasaran.x - p.x;
    const dz = sasaran.z - p.z;
    const jarak = Math.hypot(dx, dz);
    // Berbelok halus ke arah titik berikutnya dan perlambat di tikungan tajam. Klip jalan ikut melambat
    // sebanding, agar telapak tetap menapak dan tidak tergelincir.
    const beda = sudutBeda(this.akar.rotation.y, Math.atan2(dx, dz));
    this.akar.rotation.y += THREE.MathUtils.clamp(beda, -PUTAR_JALAN * dt, PUTAR_JALAN * dt);
    const laju = LAJU * THREE.MathUtils.clamp(1 - Math.abs(beda) / 1.8, 0.3, 1);
    this.aksi.get('jalan')?.setEffectiveTimeScale(laju / this.aset.lajuJalan);
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
    this.lepasPesanan();
    this.mixer.stopAllAction();
    this.akar.removeFromParent();
  }
}

const SUMBU_Y = new THREE.Vector3(0, 1, 0);
const _kaki = new THREE.Vector3();
const _sasaran = new THREE.Vector3();
const _skala = new THREE.Vector3();
const _qKaki = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _u = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qDunia = new THREE.Quaternion();
const _qInduk = new THREE.Quaternion();

/** Ganti rotasi tulang sehingga rotasi dunianya menjadi `q`. */
function aturRotasiDunia(tulang: THREE.Object3D, q: THREE.Quaternion) {
  tulang.parent!.matrixWorld.decompose(_u, _qInduk, _skala);
  tulang.quaternion.copy(_qInduk.invert().multiply(q));
  tulang.updateMatrixWorld(true);
}

/** Putar tulang sebesar `q` dalam ruang dunia, di sekitar sendinya sendiri. */
function putarDunia(tulang: THREE.Object3D, q: THREE.Quaternion) {
  tulang.matrixWorld.decompose(_u, _qDunia, _skala);
  aturRotasiDunia(tulang, _qDunia.premultiply(q));
}

/**
 * IK dua tulang analitis: tekuk lutut sampai jarak pinggul–pergelangan sama dengan jarak ke sasaran
 * (hukum kosinus), lalu ayunkan paha agar pergelangan tepat di sasaran. Bidang tekuk lutut dipertahankan.
 */
function ikDuaTulang(k: Kaki, sasaran: THREE.Vector3) {
  const a = _a.setFromMatrixPosition(k.paha.matrixWorld);
  const b = _b.setFromMatrixPosition(k.betis.matrixWorld);
  const c = _c.setFromMatrixPosition(k.telapak.matrixWorld);
  const l1 = a.distanceTo(b);
  const l2 = b.distanceTo(c);
  const d = THREE.MathUtils.clamp(a.distanceTo(sasaran), Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
  const ba = new THREE.Vector3().subVectors(a, b);
  const bc = new THREE.Vector3().subVectors(c, b);
  const sumbu = new THREE.Vector3().crossVectors(ba, bc);
  if (sumbu.lengthSq() > 1e-12) {
    const kini = ba.angleTo(bc);
    const mau = Math.acos(THREE.MathUtils.clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
    putarDunia(k.betis, _q.setFromAxisAngle(sumbu.normalize(), mau - kini));
  }
  c.setFromMatrixPosition(k.telapak.matrixWorld);
  putarDunia(k.paha, _q.setFromUnitVectors(_u.subVectors(c, a).normalize(), _w.subVectors(sasaran, a).normalize()));
}
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
