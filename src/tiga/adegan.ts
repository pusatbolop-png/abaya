import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buatMaterialLuar, buatPustaka, semuaMaterial, type Pustaka } from './material';
import { muatModel, type NamaModel } from './model';
import {
  muatGambar,
  siapkanHuruf,
  teksturDirektori,
  teksturInlay,
  teksturLogoDinding,
  teksturMonumen,
  teksturOnAir,
  teksturPapanNama,
  teksturPetunjukLantai,
} from './signage';

export type SisiPintu = 'depan' | 'belakang' | 'kiri' | 'kanan';

export interface DataRuang {
  id: number;
  kode: string;
  nama: string;
  jenis: string;
  lantai: number;
  /** Jarak dari dinding kiri gedung, sesuai sketsa (pintu masuk di atas). */
  x: number;
  /** Jarak dari dinding depan gedung (sisi pintu masuk). */
  z: number;
  lebar: number;
  panjang: number;
  kapasitas: number | null;
  sisiPintu: SisiPintu;
}

export interface DataDenah {
  lebar: number;
  panjang: number;
  tinggi: number;
  pintuMasuk: { x: number; lebar: number };
  /** Tangga ke lantai atas; `naik` = arah anak tangga naik (bawaan: ke belakang). */
  tangga: { x: number; z: number; lebar: number; panjang: number; naik?: 'depan' | 'belakang' };
}

export interface Identitas {
  nama: string;
  singkat: string;
  naungan: string;
  logo?: string;
}

export interface OpsiAdegan {
  ringan: boolean;
  gerakDikurangi: boolean;
  saatPilih: (id: number | null) => void;
  saatArah: (id: number | null) => void;
  saatIntroSelesai: () => void;
}

const RUANG_SIARAN = ['studio', 'podcast'];
const TINGGI_DINDING = 3.0;
const TEBAL = 0.12;
const AMBANG = 1.0; // tinggi potongan dinding luar, seperti maket arsitek

type Kurva = (t: number) => number;
const halus: Kurva = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const keluar: Kurva = (t) => 1 - Math.pow(1 - t, 3);

interface Tween {
  mulai: number;
  lama: number;
  kurva: Kurva;
  jalan: (t: number) => void;
  selesai?: () => void;
  kamera?: boolean;
}

interface DataLantai {
  grup: THREE.Group;
  material: THREE.Material[];
  asli: Map<THREE.Material, { opacity: number; transparent: boolean; depthWrite: boolean }>;
  lampu: THREE.PointLight[];
  luar: { grup: THREE.Group; normal: THREE.Vector3; skala: number }[];
  terlihat: number;
}

interface DataRuangMesh {
  data: DataRuang;
  lantai: THREE.Mesh;
  sorot: THREE.Mesh;
  onAir?: { mesh: THREE.Mesh; nyala: THREE.MeshStandardMaterial; mati: THREE.MeshStandardMaterial; cahaya: THREE.PointLight };
  ringLight?: THREE.MeshStandardMaterial;
  kunci?: THREE.PointLight;
  pusat: THREE.Vector3;
}

const SKY_VERT = `
varying vec3 vArah;
void main() {
  vArah = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAG = `
uniform vec3 zenit;
uniform vec3 cakrawala;
uniform vec3 tanah;
uniform vec3 arahMatahari;
varying vec3 vArah;
void main() {
  vec3 d = normalize(vArah);
  float h = d.y;
  vec3 warna = h > 0.0 ? mix(cakrawala, zenit, pow(h, 0.55)) : mix(cakrawala, tanah, pow(-h, 0.4));
  float s = max(dot(d, normalize(arahMatahari)), 0.0);
  warna += vec3(1.0, 0.78, 0.55) * (pow(s, 12.0) * 0.35 + pow(s, 900.0) * 6.0);
  gl_FragColor = vec4(warna, 1.0);
}`;

function skalaUvKotak(g: THREE.BufferGeometry, w: number, h: number, d: number, ubin: number) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const ukuran = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  const perSisi = uv.count / 6;
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < perSisi; i++) {
      const k = f * perSisi + i;
      uv.setXY(k, (uv.getX(k) * ukuran[f][0]) / ubin, (uv.getY(k) * ukuran[f][1]) / ubin);
    }
  }
  uv.needsUpdate = true;
}

/** Bingkai lokal sebuah ruangan: X sepanjang dinding pintu, Z dari pintu (−) ke belakang (+). */
interface Bingkai {
  grup: THREE.Group;
  w: number;
  d: number;
}

export class AdeganGedung {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private gtao: GTAOPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private scene = new THREE.Scene();
  private kamera: THREE.PerspectiveCamera;
  private kendali: OrbitControls;
  private lantai = new Map<number, DataLantai>();
  private ruang = new Map<number, DataRuangMesh>();
  private tween: Tween[] = [];
  private perluRender = true;
  private bingkaiAnimasi = 0;
  private lantaiAktif = 1;
  private dipilih: number | null = null;
  private diarah: number | null = null;
  private raycaster = new THREE.Raycaster();
  private penunjuk = new THREE.Vector2();
  private tekan: { x: number; y: number } | null = null;
  private introBerjalan = false;
  private disentuh = false;
  private bayanganTertunda = false;
  private introSelesaiFn: (() => void) | null = null;
  private teksturDibuat: THREE.Texture[] = [];
  private geometriDibuat: THREE.BufferGeometry[] = [];
  private materialLain: THREE.Material[] = [];
  private amati: ResizeObserver;
  private terlihat = true;
  private pengamatLayar: IntersectionObserver;
  private identitas: Identitas = { nama: 'Pasuruan Creative Center', singkat: 'PCC', naungan: '' };
  private logo: HTMLImageElement | null = null;
  private siaran = new Set<number>();
  private grupLuar = new THREE.Group();
  private denah: DataDenah = { lebar: 18, panjang: 20, tinggi: 3.6, pintuMasuk: { x: 6.5, lebar: 3 }, tangga: { x: 7, z: 7.5, lebar: 2, panjang: 6, naik: 'depan' } };
  private semuaRuang: DataRuang[] = [];
  private matOrang = new Map<string, THREE.MeshStandardMaterial>();
  /** Tempat model Meshy: berisi versi prosedural sampai modelnya selesai dimuat. */
  private slot: { nama: NamaModel; grup: THREE.Group; lantai: number; ukuran: UkuranSlot }[] = [];
  private lantaiBangun = 0;
  private versiBangun = 0;
  private tambahanAktif: THREE.Material[] = [];

  constructor(
    private kanvas: HTMLCanvasElement,
    private opsi: OpsiAdegan,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: opsi.ringan, powerPreference: 'high-performance' });
    // Pascaproses sudah memakai MSAA, jadi rasio piksel dibatasi 1,5 agar tetap ringan di layar padat.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;

    this.kamera = new THREE.PerspectiveCamera(34, 1, 0.1, 1200);
    this.kamera.position.set(-20, 26, 32);
    this.kendali = new OrbitControls(this.kamera, kanvas);
    this.kendali.target.set(0, 0.6, 0);
    this.kendali.enableDamping = true;
    this.kendali.dampingFactor = 0.08;
    this.kendali.minDistance = 6;
    this.kendali.maxDistance = 85;
    this.kendali.minPolarAngle = 0.25;
    this.kendali.maxPolarAngle = 1.42;
    this.kendali.screenSpacePanning = true;
    this.kendali.zoomToCursor = true;
    this.kendali.addEventListener('change', () => this.minta());
    this.kendali.update();

    this.siapkanLingkungan();
    this.siapkanPascaproses();

    this.scene.add(this.grupLuar);
    kanvas.addEventListener('pointerdown', this.saatTekan);
    kanvas.addEventListener('pointermove', this.saatGerak);
    kanvas.addEventListener('pointerup', this.saatLepas);
    kanvas.addEventListener('pointerleave', this.saatKeluar);

    this.amati = new ResizeObserver(() => this.ukurUlang());
    this.amati.observe(kanvas.parentElement ?? kanvas);
    this.pengamatLayar = new IntersectionObserver(([e]) => {
      this.terlihat = e.isIntersecting;
      if (this.terlihat) this.minta();
    });
    this.pengamatLayar.observe(kanvas);
    this.ukurUlang();
    this.putar();
  }

  /** Langit, matahari sore, dan pantulan lingkungan dari langit yang sama agar pencahayaan menyatu. */
  private siapkanLingkungan() {
    const arahMatahari = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
    const langit = new THREE.Mesh(
      new THREE.SphereGeometry(600, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          zenit: { value: new THREE.Color('#4f86bd') },
          cakrawala: { value: new THREE.Color('#dfe5e3') },
          tanah: { value: new THREE.Color('#8d8573') },
          arahMatahari: { value: arahMatahari },
        },
      }),
    );
    langit.frustumCulled = false;
    this.scene.add(langit);

    // Lingkungan pantulan: langit yang sama, dirender sekali ke PMREM.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const adeganLangit = new THREE.Scene();
    adeganLangit.add(langit.clone());
    this.scene.environment = pmrem.fromScene(adeganLangit, 0.02).texture;
    this.scene.environmentIntensity = 0.75;
    pmrem.dispose();
    this.scene.fog = new THREE.Fog('#d9dfdc', 110, 420);

    this.scene.add(new THREE.HemisphereLight('#d4e0ea', '#7c705d', 0.85));
    const matahari = new THREE.DirectionalLight('#fff0dc', 3.4);
    matahari.position.copy(arahMatahari).multiplyScalar(45);
    matahari.castShadow = true;
    const ukuran = this.opsi.ringan ? 1024 : 2048;
    matahari.shadow.mapSize.set(ukuran, ukuran);
    const sc = matahari.shadow.camera;
    sc.left = -30;
    sc.right = 30;
    sc.top = 30;
    sc.bottom = -30;
    sc.near = 5;
    sc.far = 110;
    matahari.shadow.bias = -0.0003;
    matahari.shadow.normalBias = 0.025;
    matahari.shadow.radius = 4;
    this.scene.add(matahari, matahari.target);
  }

  private siapkanPascaproses() {
    if (this.opsi.ringan) return;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.kamera));
    this.gtao = new GTAOPass(this.scene, this.kamera, 1, 1);
    // Oklusi dihitung pada setengah resolusi lalu dibaurkan; selisih mutunya tidak tampak, bebannya seperempat.
    const gtao = this.gtao;
    const setSizeAsli = gtao.setSize.bind(gtao);
    gtao.setSize = (l: number, t: number) => setSizeAsli(Math.max(1, Math.round(l / 2)), Math.max(1, Math.round(t / 2)));
    this.gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    this.gtao.blendIntensity = 0.9;
    this.composer.addPass(this.gtao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.45, 1.6);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  // ——— API publik ———

  async bangun(ruang: DataRuang[], denah: DataDenah, identitas: Identitas) {
    await siapkanHuruf();
    this.logo = await muatGambar(identitas.logo);
    this.identitas = identitas;
    this.denah = denah;
    this.semuaRuang = ruang;
    this.bersihkanBangunan();
    this.versiBangun++;
    this.slot = [];
    this.lantaiBangun = 0;
    this.bangunLuar();
    const nomorLantai = [...new Set([1, ...ruang.map((r) => r.lantai)])].sort();
    for (const n of nomorLantai) this.bangunLantai(n, ruang.filter((r) => r.lantai === n));
    this.terapkanSiaran();
    this.aturVisibilitasLantai(true);
    if (!this.disentuh && !this.introBerjalan) {
      const a = this.posisiAwal();
      this.kamera.position.copy(a.posisi);
      this.kendali.target.copy(a.target);
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.minta();
    void this.pasangModel(this.versiBangun);
  }

  aturSiaran(idRuangSiaran: number[]) {
    this.siaran = new Set(idRuangSiaran);
    this.terapkanSiaran();
  }

  aturLantai(n: number) {
    if (n === this.lantaiAktif || !this.lantai.has(n)) return;
    this.lantaiAktif = n;
    this.aturVisibilitasLantai(false);
    const a = this.posisiAwal(n);
    this.geserKamera(a.posisi, a.target, 700);
  }

  pilih(id: number | null, fokus = true) {
    this.dipilih = id;
    this.perbaruiSorot();
    if (id === null || !fokus) return;
    const r = this.ruang.get(id);
    if (!r) return;
    if (r.data.lantai !== this.lantaiAktif) {
      this.lantaiAktif = r.data.lantai;
      this.aturVisibilitasLantai(false);
    }
    const arah = this.kamera.position.clone().sub(this.kendali.target).normalize();
    // Sudut cukup tinggi agar dinding ruangan di sekitarnya tidak menutupi isi ruangan.
    arah.y = 0;
    arah.normalize().multiplyScalar(0.62);
    arah.y = 0.78;
    arah.normalize();
    const jarak = THREE.MathUtils.clamp(Math.max(r.data.lebar, r.data.panjang) * 2.3, 12, 24);
    const target = r.pusat.clone().setY(this.dasar(r.data.lantai) + 0.6);
    this.geserKamera(target.clone().add(arah.multiplyScalar(jarak)), target, 800);
  }

  tampilanAwal() {
    const a = this.posisiAwal();
    this.geserKamera(a.posisi, a.target, 800);
  }

  /** Momen pembuka: dari pelataran menghadap fasad, melangkah ke pintu masuk, lalu naik melihat seluruh lantai. */
  mulaiIntro(selesai: () => void) {
    this.introSelesaiFn = selesai;
    if (this.opsi.gerakDikurangi) {
      this.akhiriIntro();
      return;
    }
    this.introBerjalan = true;
    this.kendali.enabled = false;
    const pm = this.denah.pintuMasuk;
    const pintu = this.dunia(pm.x + pm.lebar / 2, 0);
    const depan = pintu.z;
    const akhir = this.posisiAwal(1);
    const titik = [
      new THREE.Vector3(pintu.x - 3.5, 1.7, depan + 24),
      new THREE.Vector3(pintu.x - 1.2, 1.75, depan + 13),
      new THREE.Vector3(pintu.x, 3.2, depan + 3.5),
      new THREE.Vector3(pintu.x - 7, 13, depan + 18),
      akhir.posisi,
    ];
    const sasaran = [
      new THREE.Vector3(pintu.x, 2.2, depan),
      new THREE.Vector3(pintu.x, 1.6, depan - 4),
      new THREE.Vector3(pintu.x, 1.0, depan - 10),
      akhir.target,
    ];
    const lintasan = new THREE.CatmullRomCurve3(titik, false, 'centripetal');
    const lintasSasaran = new THREE.CatmullRomCurve3(sasaran, false, 'centripetal');
    // Dari pelataran gedung tampak utuh; lantai atas baru terangkat saat kamera naik melihat ke dalam.
    this.aturVisibilitasLantai(true, Math.max(...this.lantai.keys()));
    let lantaiAtasDibuka = false;
    this.kamera.position.copy(titik[0]);
    this.kendali.target.copy(sasaran[0]);
    this.kamera.lookAt(sasaran[0]);
    this.tween.push({
      mulai: performance.now() + 350,
      lama: Number(import.meta.env.VITE_PEMBUKA_MS) || 7500,
      kurva: halus,
      jalan: (t) => {
        this.kamera.position.copy(lintasan.getPoint(t));
        this.kendali.target.copy(lintasSasaran.getPoint(t));
        this.kamera.lookAt(this.kendali.target);
        if (!lantaiAtasDibuka && t > 0.42) {
          lantaiAtasDibuka = true;
          this.aturVisibilitasLantai(false);
        }
      },
      selesai: () => this.akhiriIntro(),
    });
    this.minta();
  }

  lewatiIntro() {
    if (!this.introBerjalan) return;
    this.tween = [];
    const a = this.posisiAwal();
    this.kamera.position.copy(a.posisi);
    this.kendali.target.copy(a.target);
    this.aturVisibilitasLantai(true);
    this.akhiriIntro();
  }

  hancurkan() {
    cancelAnimationFrame(this.bingkaiAnimasi);
    this.amati.disconnect();
    this.pengamatLayar.disconnect();
    this.kanvas.removeEventListener('pointerdown', this.saatTekan);
    this.kanvas.removeEventListener('pointermove', this.saatGerak);
    this.kanvas.removeEventListener('pointerup', this.saatLepas);
    this.kanvas.removeEventListener('pointerleave', this.saatKeluar);
    this.bersihkanBangunan();
    this.kendali.dispose();
    this.scene.environment?.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
  }

  // ——— Koordinat ———

  /** Denah (x dari kiri, z dari depan) ke dunia. Diputar 180° agar sisi depan menghadap kamera. */
  private dunia(x: number, z: number, y = 0) {
    return new THREE.Vector3(this.denah.lebar / 2 - x, y, this.denah.panjang / 2 - z);
  }

  private dasar(n: number) {
    return (n - 1) * this.denah.tinggi;
  }

  /** Arah keluar (dunia) dari sebuah sisi ruangan atau gedung. */
  private normalSisi(s: SisiPintu) {
    return { depan: new THREE.Vector3(0, 0, 1), belakang: new THREE.Vector3(0, 0, -1), kiri: new THREE.Vector3(1, 0, 0), kanan: new THREE.Vector3(-1, 0, 0) }[s];
  }

  private posisiAwal(lantai = this.lantaiAktif) {
    const tegak = this.kamera.aspect < 0.9;
    const arah = (tegak ? new THREE.Vector3(-0.22, 0.95, 0.5) : new THREE.Vector3(-0.55, 0.64, 0.78)).normalize();
    const vfov = THREE.MathUtils.degToRad(this.kamera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.kamera.aspect);
    const radius = Math.hypot(this.denah.lebar, this.denah.panjang) / 2 + (tegak ? 0.5 : 1.5);
    const jarak = radius / Math.sin(Math.min(vfov, hfov) / 2);
    const target = new THREE.Vector3(0, this.dasar(lantai) + 0.4, 0.8);
    return { posisi: target.clone().add(arah.multiplyScalar(THREE.MathUtils.clamp(jarak, 26, 80))), target };
  }

  // ——— Interaksi ———

  private saatTekan = (e: PointerEvent) => {
    this.disentuh = true;
    this.tekan = { x: e.clientX, y: e.clientY };
    if (this.introBerjalan) this.lewatiIntro();
  };

  private saatGerak = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || this.introBerjalan) return;
    const id = this.ambilRuang(e);
    if (id !== this.diarah) {
      this.diarah = id;
      this.kanvas.style.cursor = id !== null ? 'pointer' : 'grab';
      this.perbaruiSorot();
      this.opsi.saatArah(id);
    }
  };

  private saatLepas = (e: PointerEvent) => {
    if (!this.tekan) return;
    const geser = Math.hypot(e.clientX - this.tekan.x, e.clientY - this.tekan.y);
    this.tekan = null;
    if (geser > 6 || this.introBerjalan) return;
    this.opsi.saatPilih(this.ambilRuang(e));
  };

  private saatKeluar = () => {
    if (this.diarah !== null) {
      this.diarah = null;
      this.perbaruiSorot();
      this.opsi.saatArah(null);
    }
  };

  private ambilRuang(e: PointerEvent): number | null {
    const b = this.kanvas.getBoundingClientRect();
    this.penunjuk.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    this.raycaster.setFromCamera(this.penunjuk, this.kamera);
    const sasaran = [...this.ruang.values()].filter((r) => r.data.lantai === this.lantaiAktif).map((r) => r.lantai);
    const kena = this.raycaster.intersectObjects(sasaran, false)[0];
    return kena ? (kena.object.userData.ruangId as number) : null;
  }

  // ——— Siklus render ———

  private minta() {
    this.perluRender = true;
  }

  private putar = () => {
    this.bingkaiAnimasi = requestAnimationFrame(this.putar);
    const kini = performance.now();
    if (this.tween.length) {
      this.perluRender = true;
      // Animasi baru yang ditambahkan dari dalam callback masuk ke daftar baru, lalu digabung.
      const berjalan = this.tween;
      this.tween = [];
      const sisa = berjalan.filter((tw) => {
        if (kini < tw.mulai) return true;
        const t = Math.min(1, (kini - tw.mulai) / tw.lama);
        tw.jalan(tw.kurva(t));
        if (t >= 1) {
          tw.selesai?.();
          return false;
        }
        return true;
      });
      this.tween = [...sisa, ...this.tween];
    }
    if (!this.introBerjalan) this.kendali.update();
    this.perbaruiPotongan();
    if (this.perluRender && this.terlihat) {
      this.perluRender = false;
      if (this.composer) this.composer.render();
      else this.renderer.render(this.scene, this.kamera);
    }
  };

  private ukurUlang() {
    const induk = this.kanvas.parentElement ?? this.kanvas;
    const l = Math.max(1, induk.clientWidth);
    const t = Math.max(1, induk.clientHeight);
    this.renderer.setSize(l, t, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(l, t);
    }
    this.kamera.aspect = l / t;
    this.kamera.fov = l / t < 0.9 ? 46 : l / t < 1.3 ? 40 : 34;
    this.kamera.updateProjectionMatrix();
    if (!this.disentuh && !this.introBerjalan) {
      const a = this.posisiAwal();
      this.kamera.position.copy(a.posisi);
      this.kendali.target.copy(a.target);
    }
    this.minta();
  }

  private geserKamera(posisi: THREE.Vector3, target: THREE.Vector3, lama: number) {
    const p0 = this.kamera.position.clone();
    const t0 = this.kendali.target.clone();
    this.tween = this.tween.filter((t) => !t.kamera);
    this.tween.push({
      mulai: performance.now(),
      lama: this.opsi.gerakDikurangi ? 1 : lama,
      kurva: keluar,
      kamera: true,
      jalan: (t) => {
        this.kamera.position.lerpVectors(p0, posisi, t);
        this.kendali.target.lerpVectors(t0, target, t);
      },
    });
  }

  private akhiriIntro() {
    this.introBerjalan = false;
    this.kendali.enabled = true;
    this.kendali.update();
    this.minta();
    const fn = this.introSelesaiFn;
    this.introSelesaiFn = null;
    fn?.();
    this.opsi.saatIntroSelesai();
  }

  /** Dinding luar yang menghadap kamera dipotong setinggi ambang jendela, seperti maket potongan arsitek. */
  private perbaruiPotongan() {
    const arah = new THREE.Vector3().subVectors(this.kamera.position, this.kendali.target).setY(0).normalize();
    let berubah = false;
    for (const l of this.lantai.values()) {
      for (const d of l.luar) {
        // Setinggi mata (momen pembuka) fasad tidak dipotong: pengunjung melihat menembus kaca.
        const potong = d.normal.dot(arah) > 0.28 && this.kamera.position.y - d.grup.position.y > 3.5;
        const tujuan = potong ? 0 : 1;
        if (Math.abs(d.skala - tujuan) > 0.001) {
          d.skala += (tujuan - d.skala) * 0.18;
          if (Math.abs(d.skala - tujuan) < 0.004) d.skala = tujuan;
          d.grup.scale.y = Math.max(d.skala, 0.0001);
          d.grup.visible = d.skala > 0.01;
          berubah = true;
        }
      }
    }
    if (berubah) {
      this.bayanganTertunda = true;
      this.minta();
    } else if (this.bayanganTertunda && !this.tween.length) {
      // Peta bayangan dihitung ulang sekali setelah semua gerakan berhenti, bukan setiap bingkai.
      this.bayanganTertunda = false;
      this.renderer.shadowMap.needsUpdate = true;
      this.minta();
    }
  }

  private perbaruiSorot() {
    for (const [id, r] of this.ruang) {
      const m = r.sorot.material as THREE.MeshStandardMaterial;
      const target = id === this.dipilih ? 0.4 : id === this.diarah ? 0.2 : this.siaran.has(id) ? 0.16 : 0;
      m.opacity = target;
      m.emissiveIntensity = target * 1.4;
      r.sorot.visible = target > 0;
    }
    this.minta();
  }

  private terapkanSiaran() {
    for (const [id, r] of this.ruang) {
      const nyala = this.siaran.has(id);
      const aktif = r.data.lantai === this.lantaiAktif;
      if (r.onAir) {
        r.onAir.mesh.material = nyala ? r.onAir.nyala : r.onAir.mati;
        r.onAir.cahaya.visible = nyala && aktif;
      }
      if (r.ringLight) r.ringLight.emissiveIntensity = nyala ? 4 : 0.2;
      if (r.kunci) r.kunci.visible = nyala && aktif;
    }
    this.perbaruiSorot();
  }

  /** Tampilkan lantai sampai `batas` (bawaan: lantai aktif); lantai di atasnya terangkat dan memudar. */
  private aturVisibilitasLantai(langsung: boolean, batas = this.lantaiAktif) {
    for (const [n, l] of this.lantai) {
      const tampak = n <= batas ? 1 : 0;
      for (const lampu of l.lampu) lampu.visible = n === this.lantaiAktif;
      const awal = l.terlihat;
      const angkat = (t: number) => {
        l.terlihat = t;
        l.grup.position.y = (1 - t) * 4.5;
        l.grup.visible = t > 0.001;
        const transisi = t < 0.999;
        for (const m of l.material) {
          const a = l.asli.get(m);
          if (!a) continue;
          m.transparent = transisi || a.transparent;
          m.opacity = a.opacity * t;
          m.depthWrite = transisi ? false : a.depthWrite;
        }
      };
      if (langsung || this.opsi.gerakDikurangi) angkat(tampak);
      else if (Math.abs(awal - tampak) > 0.001) {
        this.tween.push({
          mulai: performance.now(),
          lama: 620,
          kurva: halus,
          jalan: (t) => angkat(awal + (tampak - awal) * t),
          selesai: () => {
            this.bayanganTertunda = true;
          },
        });
      }
    }
    this.terapkanSiaran();
    this.renderer.shadowMap.needsUpdate = true;
    this.minta();
  }

  // ——— Perkakas pembangunan ———

  private bersihkanBangunan() {
    for (const l of this.lantai.values()) {
      this.scene.remove(l.grup);
      l.material.forEach((m) => m.dispose());
    }
    this.lantai.clear();
    this.ruang.clear();
    this.grupLuar.clear();
    this.materialLain.forEach((m) => m.dispose());
    this.materialLain = [];
    this.teksturDibuat.forEach((t) => t.dispose());
    this.teksturDibuat = [];
    this.geometriDibuat.forEach((g) => g.dispose());
    this.geometriDibuat = [];
  }

  private catat<T extends THREE.BufferGeometry>(g: T): T {
    this.geometriDibuat.push(g);
    return g;
  }

  private mesh(g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, induk: THREE.Object3D, bayang = true) {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = bayang && !m.transparent;
    mesh.receiveShadow = true;
    induk.add(mesh);
    return mesh;
  }

  /** Kotak dengan UV berskala ukuran nyata. */
  private kotak(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, induk: THREE.Object3D, bayang = true) {
    const g = this.catat(new THREE.BoxGeometry(w, h, d));
    skalaUvKotak(g, w, h, d, (m.userData.ubin as number) ?? 2);
    return this.mesh(g, m, x, y, z, induk, bayang);
  }

  /** Kotak bersudut tumpul untuk perabot agar tidak tampak seperti balok CAD. */
  private bulat(w: number, h: number, d: number, r: number, m: THREE.Material, x: number, y: number, z: number, induk: THREE.Object3D) {
    const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    const g = this.catat(new RoundedBoxGeometry(w, h, d, 2, Math.max(rr, 0.001)));
    return this.mesh(g, m, x, y, z, induk);
  }

  private silinder(rAtas: number, rBawah: number, h: number, m: THREE.Material, x: number, y: number, z: number, induk: THREE.Object3D, segmen = 20) {
    return this.mesh(this.catat(new THREE.CylinderGeometry(rAtas, rBawah, h, segmen)), m, x, y, z, induk);
  }

  private bidangLantai(w: number, d: number, m: THREE.Material, x: number, y: number, z: number, induk: THREE.Object3D) {
    const g = this.catat(new THREE.PlaneGeometry(w, d));
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const ubin = (m.userData.ubin as number) ?? 2;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / ubin, (uv.getY(i) * d) / ubin);
    const p = new THREE.Mesh(g, m);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, y, z);
    p.receiveShadow = true;
    induk.add(p);
    return p;
  }

  /** Kotak dalam koordinat denah (x kiri→kanan, z depan→belakang). */
  private kotakDenah(x1: number, x2: number, z1: number, z2: number, y: number, h: number, m: THREE.Material, induk: THREE.Object3D, bayang = true) {
    const p = this.dunia((x1 + x2) / 2, (z1 + z2) / 2);
    return this.kotak(Math.abs(x2 - x1), h, Math.abs(z2 - z1), m, p.x, y + h / 2, p.z, induk, bayang);
  }

  /** Gabungkan mesh statis dalam satu grup per material agar jumlah panggilan gambar kecil. */
  private gabung(grup: THREE.Group) {
    // Tempat model tidak ikut digabung karena isinya akan diganti.
    const lepas: [THREE.Object3D, THREE.Object3D][] = [];
    grup.traverse((o) => {
      if (o.userData.slot && o.parent) lepas.push([o, o.parent]);
    });
    for (const [o, induk] of lepas) induk.remove(o);
    this.gabungIsi(grup);
    for (const [o, induk] of lepas) induk.add(o);
  }

  private gabungIsi(grup: THREE.Group) {
    grup.updateMatrixWorld(true);
    const balik = grup.matrixWorld.clone().invert();
    const kelompok = new Map<string, { m: THREE.Material; bayang: boolean; g: THREE.BufferGeometry[] }>();
    const buang: THREE.Mesh[] = [];
    grup.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.dinamis || Array.isArray(mesh.material)) return;
      const m = mesh.material as THREE.Material;
      const kunci = `${m.uuid}|${mesh.castShadow}`;
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(balik, mesh.matrixWorld));
      for (const nama of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(nama)) g.deleteAttribute(nama);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
      const k = kelompok.get(kunci) ?? { m, bayang: mesh.castShadow, g: [] };
      k.g.push(g);
      kelompok.set(kunci, k);
      buang.push(mesh);
    });
    for (const mesh of buang) mesh.parent?.remove(mesh);
    // Kosongkan grup turunan yang tidak lagi berisi apa pun.
    for (const k of kelompok.values()) {
      const gabungan = mergeGeometries(k.g, false);
      k.g.forEach((g) => g.dispose());
      if (!gabungan) continue;
      this.catat(gabungan);
      const mesh = new THREE.Mesh(gabungan, k.m);
      mesh.castShadow = k.bayang;
      mesh.receiveShadow = true;
      grup.add(mesh);
    }
  }

  /** Tempat model Meshy di (x, y, z) lokal induk; `cadangan` membangun versi prosedural di dalamnya. */
  private pasang(nama: NamaModel, induk: THREE.Object3D, x: number, y: number, z: number, hadap: number, ukuran: UkuranSlot, cadangan: (g: THREE.Group) => void) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = hadap;
    g.userData.slot = true;
    induk.add(g);
    cadangan(g);
    this.slot.push({ nama, grup: g, lantai: this.lantaiBangun, ukuran });
    return g;
  }

  /** Ganti isi prosedural setiap tempat dengan model Meshy begitu modelnya tersedia. */
  private async pasangModel(versi: number) {
    const bahan = new Map<string, THREE.Material>();
    const salinBahan = (m: THREE.Material, lantai: number) => {
      // Bahan disalin per lantai agar pemudaran satu lantai tidak memengaruhi lantai lain.
      const kunci = `${lantai}|${m.uuid}`;
      let b = bahan.get(kunci);
      if (!b) {
        b = m.clone();
        bahan.set(kunci, b);
        this.materialLain.push(b);
        const l = this.lantai.get(lantai);
        if (l) {
          l.material.push(b);
          l.asli.set(b, { opacity: b.opacity, transparent: b.transparent, depthWrite: b.depthWrite });
          if (l.terlihat < 0.999) {
            b.transparent = true;
            b.opacity *= l.terlihat;
            b.depthWrite = false;
          }
        }
      }
      return b;
    };
    const nama = [...new Set(this.slot.map((s) => s.nama))];
    await Promise.all(
      nama.map(async (n) => {
        const contoh = await muatModel(n).catch(() => null);
        if (!contoh || versi !== this.versiBangun) return;
        for (const s of this.slot.filter((x) => x.nama === n)) {
          // Bungkus salinan agar skala normalisasinya (tinggi 1) tetap utuh.
          const model = new THREE.Group();
          model.add(contoh.clone());
          const u = contoh.userData.ukuran as THREE.Vector3;
          // `lebar` diukur pada sisi datar terpanjang, karena tidak semua model memanjang di sumbu X.
          const skala = s.ukuran.lebar ? s.ukuran.lebar / Math.max(u.x, u.z) : (s.ukuran.tinggi ?? 1);
          model.scale.setScalar(skala);
          if (s.ukuran.geser) model.position.copy(s.ukuran.geser);
          if (s.ukuran.putar) model.rotation.y = s.ukuran.putar;
          model.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => salinBahan(m, s.lantai)) : salinBahan(mesh.material, s.lantai);
          });
          s.grup.clear();
          s.grup.add(model);
        }
        this.renderer.shadowMap.needsUpdate = true;
        this.minta();
      }),
    );
  }

  private dinamis<T extends THREE.Object3D>(o: T): T {
    o.userData.dinamis = true;
    return o;
  }

  // ——— Luar gedung ———

  private bangunLuar() {
    const m = buatMaterialLuar();
    const p = buatPustaka(this.opsi.ringan);
    this.materialLain.push(...Object.values(m), ...semuaMaterial(p));
    const g = new THREE.Group();
    this.grupLuar.add(g);
    const W = this.denah.lebar;
    const D = this.denah.panjang;
    const depan = D / 2;
    const yTanah = -0.32;

    this.bidangLantai(220, 220, m.rumput, 0, yTanah, 0, g);
    // Pelataran paving di sekeliling gedung dan halaman depan.
    this.bidangLantai(W + 7, D + 7, m.paving, 0, yTanah + 0.01, 0, g);
    this.bidangLantai(W + 14, 13, m.paving, 0, yTanah + 0.012, depan + 3.5 + 6.5, g);
    // Kanstin di tepi pelataran.
    for (const [w, d, x, z] of [
      [W + 14.3, 0.15, 0, depan + 16.6],
      [0.15, 13, -(W + 14) / 2, depan + 10],
      [0.15, 13, (W + 14) / 2, depan + 10],
    ])
      this.kotak(w, 0.12, d, m.beton, x, yTanah + 0.06, z, g);
    // Jalan, trotoar, dan marka.
    this.bidangLantai(220, 8, m.aspal, 0, yTanah + 0.005, depan + 21.5, g);
    this.kotak(220, 0.14, 2.4, m.beton, 0, yTanah + 0.07, depan + 17.4, g);
    for (let x = -100; x < 100; x += 6) this.kotak(3, 0.01, 0.14, m.garisJalan, x, yTanah + 0.012, depan + 21.5, g, false);

    // Alas bangunan setinggi lantai, dengan undakan masuk.
    this.kotak(W + 0.5, 0.3, D + 0.5, p.beton, 0, -0.15 - 0.02, 0, g);
    const pm = this.denah.pintuMasuk;
    const pintu = this.dunia(pm.x + pm.lebar / 2, 0);
    this.kotak(pm.lebar + 2.4, 0.16, 0.8, p.terrazzo, pintu.x, -0.08, depan + 0.65, g);
    this.kotak(pm.lebar + 3.2, 0.16, 1.6, p.terrazzo, pintu.x, -0.24, depan + 1.05, g);

    // Monumen nama gedung di pelataran.
    const tMon = teksturMonumen(this.identitas.nama, this.identitas.singkat, this.identitas.naungan, this.logo);
    this.teksturDibuat.push(tMon);
    const mukaMon = new THREE.MeshStandardMaterial({ map: tMon, roughness: 0.55, metalness: 0.1 });
    this.materialLain.push(mukaMon);
    const xMon = pintu.x - pm.lebar / 2 - 4.5;
    this.kotak(1.2, 2.4, 0.32, p.aluminium, xMon, yTanah + 1.2 + 0.25, depan + 6, g);
    this.mesh(this.catat(new THREE.PlaneGeometry(1.1, 2.2)), mukaMon, xMon, yTanah + 1.2 + 0.25, depan + 6 + 0.165, g, false);
    this.kotak(1.6, 0.25, 0.7, m.beton, xMon, yTanah + 0.125, depan + 6, g);

    // Tiang bendera Merah Putih, lazim di gedung pemerintah daerah.
    const xBendera = pintu.x + pm.lebar / 2 + 5;
    this.kotak(1.4, 0.3, 1.4, m.beton, xBendera, yTanah + 0.15, depan + 7, g);
    this.silinder(0.04, 0.06, 9, p.logam, xBendera, yTanah + 4.8, depan + 7, g, 12);
    const merah = new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 0.8, side: THREE.DoubleSide });
    const putih = new THREE.MeshStandardMaterial({ color: '#f2f0ea', roughness: 0.8, side: THREE.DoubleSide });
    this.materialLain.push(merah, putih);
    const kain = this.catat(new THREE.PlaneGeometry(1.5, 0.5, 8, 1));
    const pos = kain.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) + 0.75) * 3.2) * 0.08 * (pos.getX(i) + 0.75));
    kain.computeVertexNormals();
    this.mesh(kain, merah, xBendera + 0.78, yTanah + 8.75, depan + 7, g, false);
    this.mesh(kain, putih, xBendera + 0.78, yTanah + 8.25, depan + 7, g, false);

    // Lampu jalan.
    for (const x of [-22, -6, 10, 26]) {
      this.silinder(0.05, 0.08, 6, p.aluminium, x, yTanah + 3, depan + 17.2, g, 10);
      this.kotak(0.14, 0.08, 1.2, p.aluminium, x, yTanah + 6, depan + 17.7, g);
      this.kotak(0.18, 0.04, 0.5, p.lampu, x, yTanah + 5.95, depan + 18.1, g, false);
    }

    // Pepohonan dan perdu: tafsiran tegakan Kebun Raya Purwodadi.
    const pohon: [number, number, number][] = [
      [-W / 2 - 7, -4, 1.1],
      [-W / 2 - 8, 8, 0.9],
      [W / 2 + 7, -6, 1],
      [W / 2 + 8, 6, 1.15],
      [-W / 2 - 3, depan + 12, 0.85],
      [W / 2 + 4, depan + 12.5, 0.95],
      [-6, -D / 2 - 8, 1.2],
      [7, -D / 2 - 7, 1],
      [-W / 2 - 14, depan + 4, 1.3],
      [W / 2 + 15, depan + 2, 1.2],
    ];
    pohon.slice(0, this.opsi.ringan ? 6 : pohon.length).forEach(([x, z, s], i) =>
      this.pasang('pohon', g, x, yTanah, z, i * 1.7, { tinggi: 5.6 * s }, (t) => this.pohon(0, 0, 0, s, i, p, t)),
    );
    // Pagar tanaman rendah di tepi halaman depan.
    for (const sisi of [-1, 1]) {
      const x = sisi * ((W + 14) / 2 - 0.8);
      this.bulat(1.1, 0.8, 11, 0.35, p.daunTua, x, yTanah + 0.4, depan + 10, g);
    }
    for (let i = 0; i < 6; i++) {
      const x = -(W + 14) / 2 + 3 + i * ((W + 8) / 5);
      if (Math.abs(x - pintu.x) < pm.lebar) continue;
      this.bulat(1.8, 0.7, 0.9, 0.3, i % 2 ? p.daun : p.daunTua, x, yTanah + 0.35, depan + 15.6, g);
    }
    this.gabung(g);
  }

  /** Pohon peneduh: batang meruncing dan tajuk berbentuk gumpalan tak beraturan. */
  private pohon(x: number, y: number, z: number, s: number, benih: number, p: Pustaka, induk: THREE.Object3D) {
    const tinggi = 3.4 * s;
    this.silinder(0.1 * s, 0.18 * s, tinggi, p.batang, x, y + tinggi / 2, z, induk, 8);
    let acak = benih * 9301 + 49297;
    const r = () => ((acak = (acak * 9301 + 49297) % 233280) / 233280);
    const jumlah = 6;
    for (let k = 0; k < jumlah; k++) {
      // Satukan titik sudut agar normal halus, lalu gumpalkan permukaannya.
      const dasar = new THREE.IcosahedronGeometry(1, 3);
      dasar.deleteAttribute('normal');
      dasar.deleteAttribute('uv');
      const g = this.catat(mergeVertices(dasar));
      dasar.dispose();
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        const n = 1 + (Math.sin(v.x * 4 + benih) * Math.cos(v.y * 5 + k) * Math.sin(v.z * 3)) * 0.12;
        pos.setXYZ(i, v.x * n, v.y * n * 0.8, v.z * n);
      }
      g.computeVertexNormals();
      const ukuran = (1.2 + r() * 0.7) * s;
      const sudut = (k / jumlah) * Math.PI * 2;
      const jari = k === 0 ? 0 : (0.9 + r() * 0.5) * s;
      const daun = this.mesh(g, [p.daun, p.daunTua, p.daunMuda][(k + benih) % 3], x + Math.cos(sudut) * jari, y + tinggi + (0.2 + r() * 0.9) * s, z + Math.sin(sudut) * jari, induk);
      daun.scale.setScalar(ukuran);
    }
  }

  // ——— Lantai ———

  private bangunLantai(n: number, daftar: DataRuang[]) {
    const p = buatPustaka(this.opsi.ringan);
    const tambahan: THREE.Material[] = [];
    this.matOrang = new Map();
    this.tambahanAktif = tambahan;
    this.lantaiBangun = n;
    const grup = new THREE.Group();
    const statis = new THREE.Group();
    grup.add(statis);
    const y0 = this.dasar(n);
    const W = this.denah.lebar;
    const D = this.denah.panjang;
    const t = this.denah.tangga;
    const lampu: THREE.PointLight[] = [];
    const luar: DataLantai['luar'] = [];

    // Pelat lantai: inti beton dan permukaan terrazzo. Lantai atas berlubang di atas tangga.
    const pelat: [number, number, number, number][] =
      n === 1
        ? [[0, W, 0, D]]
        : [
            [0, t.x, 0, D],
            [t.x + t.lebar, W, 0, D],
            [t.x, t.x + t.lebar, 0, t.z],
            [t.x, t.x + t.lebar, t.z + t.panjang, D],
          ];
    for (const [x1, x2, z1, z2] of pelat) {
      if (x2 - x1 < 0.01 || z2 - z1 < 0.01) continue;
      this.kotakDenah(x1, x2, z1, z2, y0 - 0.3, 0.29, p.beton, statis);
      const c = this.dunia((x1 + x2) / 2, (z1 + z2) / 2);
      this.bidangLantai(x2 - x1, z2 - z1, p.terrazzo, c.x, y0 - 0.005, c.z, statis);
    }
    if (n > 1) {
      // Pagar kaca mengelilingi void tangga, terbuka di sisi kedatangan.
      const yb = y0 + 0.55;
      const zTutup = t.naik === 'depan' ? t.z + t.panjang : t.z;
      this.kotakDenah(t.x - 0.02, t.x + 0.02, t.z, t.z + t.panjang, yb - 0.55, 1.05, p.kacaBening, statis, false);
      this.kotakDenah(t.x + t.lebar - 0.02, t.x + t.lebar + 0.02, t.z, t.z + t.panjang, yb - 0.55, 1.05, p.kacaBening, statis, false);
      this.kotakDenah(t.x, t.x + t.lebar, zTutup - 0.02, zTutup + 0.02, yb - 0.55, 1.05, p.kacaBening, statis, false);
      for (const [x1, x2, z1, z2] of [
        [t.x - 0.03, t.x + 0.03, t.z, t.z + t.panjang],
        [t.x + t.lebar - 0.03, t.x + t.lebar + 0.03, t.z, t.z + t.panjang],
        [t.x, t.x + t.lebar, zTutup - 0.03, zTutup + 0.03],
      ])
        this.kotakDenah(x1, x2, z1, z2, y0 + 1.04, 0.05, p.logam, statis);
    }

    this.bangunDindingLuar(n, daftar, p, grup, statis, luar);
    for (const r of daftar) this.bangunRuang(r, statis, grup, p, y0, lampu, tambahan);
    this.dekorasiHall(n, daftar, p, statis, y0, tambahan);
    if (n === 1 && this.semuaRuang.some((r) => r.lantai > 1)) this.bangunTangga(p, statis, y0);

    // Petunjuk lantai di dinding dekat tangga.
    const tPet = teksturPetunjukLantai(n);
    this.teksturDibuat.push(tPet);
    const mPet = new THREE.MeshStandardMaterial({ map: tPet, roughness: 0.5 });
    tambahan.push(mPet);
    // Tiang petunjuk lantai di kaki tangga, menghadap aula.
    const posPet = this.dunia(t.x - 0.35, t.naik === 'depan' ? t.z + t.panjang - 0.3 : t.z + 0.3, y0);
    this.kotak(0.05, 1.9, 0.05, p.logamGelap, posPet.x, y0 + 0.95, posPet.z, statis);
    this.kotak(0.46, 0.46, 0.03, p.logamGelap, posPet.x, y0 + 1.65, posPet.z + 0.03, statis, false);
    this.mesh(this.catat(new THREE.PlaneGeometry(0.42, 0.42)), mPet, posPet.x, y0 + 1.65, posPet.z + 0.046, statis, false);

    this.gabung(statis);
    for (const l of luar) this.gabung(l.grup);
    this.scene.add(grup);
    const material = [...semuaMaterial(p).filter((m) => m !== p.sorot), ...tambahan];
    const asli = new Map<THREE.Material, { opacity: number; transparent: boolean; depthWrite: boolean }>();
    material.forEach((m) => asli.set(m, { opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite }));
    this.lantai.set(n, { grup, material, asli, lampu, luar, terlihat: 1 });
  }

  /** Ruangan berjenis tertutup (tanpa jendela) di titik tertentu, agar dinding luarnya pejal. */
  private ruangTertutupDi(n: number, x: number, z: number) {
    return this.semuaRuang.some(
      (r) => r.lantai === n && ['studio', 'podcast', 'toilet'].includes(r.jenis) && x > r.x - 0.1 && x < r.x + r.lebar + 0.1 && z > r.z - 0.1 && z < r.z + r.panjang + 0.1,
    );
  }

  /**
   * Dinding luar per sisi: bagian bawah (sampai ambang jendela) selalu tampak; bagian atas dipotong saat
   * menghadap kamera. Fasad depan berupa dinding kaca dengan mullion aluminium; sisi lain berplester dengan jendela.
   */
  private bangunDindingLuar(n: number, _daftar: DataRuang[], p: Pustaka, grup: THREE.Group, statis: THREE.Group, luar: DataLantai['luar']) {
    const y0 = this.dasar(n);
    const W = this.denah.lebar;
    const D = this.denah.panjang;
    const H = this.denah.tinggi - 0.3;
    const pm = this.denah.pintuMasuk;
    const sisi: { s: SisiPintu; panjang: number; titik: (u: number, tebalKe: number) => [number, number] }[] = [
      { s: 'depan', panjang: W, titik: (u, k) => [u, -k] },
      { s: 'belakang', panjang: W, titik: (u, k) => [u, D + k] },
      { s: 'kiri', panjang: D, titik: (u, k) => [-k, u] },
      { s: 'kanan', panjang: D, titik: (u, k) => [W + k, u] },
    ];
    for (const sd of sisi) {
      const atas = new THREE.Group();
      atas.position.y = y0 + AMBANG;
      grup.add(atas);
      luar.push({ grup: atas, normal: this.normalSisi(sd.s), skala: 1 });
      const sepanjangX = sd.s === 'depan' || sd.s === 'belakang';
      // Kotak dinding dari u1 ke u2, setebal 0.2 di luar garis pelat, dari ketinggian a ke b (relatif lantai).
      const segmen = (u1: number, u2: number, a: number, b: number, m: THREE.Material, induk: THREE.Group, tebal = 0.2, geser = 0.1) => {
        if (u2 - u1 < 0.01 || b - a < 0.01) return;
        const [x1, z1] = sd.titik(u1, geser);
        const [x2, z2] = sd.titik(u2, geser);
        const c = this.dunia((x1 + x2) / 2, (z1 + z2) / 2);
        const yBawah = induk === atas ? a - AMBANG : y0 + a;
        this.kotak(sepanjangX ? u2 - u1 : tebal, b - a, sepanjangX ? tebal : u2 - u1, m, c.x, yBawah + (b - a) / 2, c.z, induk, !m.transparent);
      };

      if (sd.s === 'depan') {
        // Fasad kaca: modul 1,5 m, pintu kaca ganda di lantai dasar.
        const pintu = n === 1 ? [pm.x, pm.x + pm.lebar] : null;
        segmen(0, W, 0, 0.12, p.aluminium, statis, 0.16, 0.08);
        for (let u = 0; u <= W + 0.001; u += 1.5) {
          if (pintu && u > pintu[0] + 0.05 && u < pintu[1] - 0.05) continue;
          segmen(u - 0.04, u + 0.04, 0.12, AMBANG, p.aluminium, statis, 0.18, 0.08);
          segmen(u - 0.04, u + 0.04, AMBANG, H, p.aluminium, atas, 0.18, 0.08);
        }
        const kaca: [number, number][] = pintu ? [[0, pintu[0]], [pintu[1], W]] : [[0, W]];
        for (const [a, b] of kaca) {
          segmen(a, b, 0.12, AMBANG, p.kacaFasad, statis, 0.03, 0.08);
          segmen(a, b, AMBANG, H - 0.05, p.kacaFasad, atas, 0.03, 0.08);
        }
        segmen(0, W, AMBANG - 0.03, AMBANG + 0.03, p.aluminium, atas, 0.16, 0.08);
        segmen(0, W, H - 0.1, H, p.aluminium, atas, 0.2, 0.08);
        if (pintu) {
          // Kusen dan daun pintu kaca, kanopi, serta papan nama di atas pintu.
          segmen(pintu[0] - 0.06, pintu[0], 0.12, AMBANG, p.aluminium, statis, 0.18, 0.08);
          segmen(pintu[1], pintu[1] + 0.06, 0.12, AMBANG, p.aluminium, statis, 0.18, 0.08);
          segmen(pintu[0] - 0.06, pintu[0], AMBANG, 2.4, p.aluminium, atas, 0.18, 0.08);
          segmen(pintu[1], pintu[1] + 0.06, AMBANG, 2.4, p.aluminium, atas, 0.18, 0.08);
          segmen(pintu[0], pintu[1], 2.36, 2.44, p.aluminium, atas, 0.18, 0.08);
          segmen(pintu[0], pintu[1], 2.44, H - 0.1, p.kacaFasad, atas, 0.03, 0.08);
          const tengah = (pintu[0] + pintu[1]) / 2;
          segmen(tengah - 0.02, tengah + 0.02, 0.05, 2.36, p.aluminium, atas, 0.06, 0.06);
          segmen(pintu[0] + 0.05, pintu[1] - 0.05, 0.05, 2.36, p.kacaBening, atas, 0.02, 0.06);
          for (const x of [tengah - 0.18, tengah + 0.18]) segmen(x - 0.015, x + 0.015, 0.9, 1.5, p.logam, atas, 0.08, 0.02);
          // Kanopi beton tipis di atas pintu masuk.
          const kanopi = this.dunia(tengah, -1.1);
          this.kotak(pm.lebar + 2.4, 0.16, 2.2, p.plesterLuar, kanopi.x, 2.75 - AMBANG + 0.08, kanopi.z, atas);
          this.kotak(pm.lebar + 2.4, 0.04, 2.2, p.aluminium, kanopi.x, 2.75 - AMBANG + 0.18, kanopi.z, atas);
          // Huruf timbul dan lambang di muka kanopi.
          const tLogo = teksturLogoDinding(this.identitas.nama, this.identitas.singkat, this.logo, false);
          this.teksturDibuat.push(tLogo);
          const mLogo = new THREE.MeshStandardMaterial({ map: tLogo, transparent: true, roughness: 0.4, metalness: 0.2 });
          this.materialLain.push(mLogo);
          const papan = this.mesh(this.catat(new THREE.PlaneGeometry(2.4, 0.6)), mLogo, kanopi.x, 2.75 - AMBANG + 0.55, kanopi.z + 1.111, atas, false);
          papan.userData.dinamis = false;
        }
      } else {
        // Dinding berplester dengan jendela 1,6 m setiap 3 m; pejal di samping studio dan toilet.
        segmen(0, sd.panjang, 0, AMBANG, p.plesterLuar, statis);
        const jendela: [number, number][] = [];
        for (let u = 1.5; u + 1.6 <= sd.panjang - 0.6; u += 3) {
          const tengah = u + 0.8;
          const [xd, zd] = sd.titik(tengah, -1);
          if (!this.ruangTertutupDi(n, xd, zd)) jendela.push([u, u + 1.6]);
        }
        let awal = 0;
        for (const [a, b] of jendela) {
          segmen(awal, a, AMBANG, H, p.plesterLuar, atas);
          segmen(a, b, 2.5, H, p.plesterLuar, atas);
          segmen(a, b, AMBANG, 2.5, p.kacaFasad, atas, 0.03, 0.12);
          segmen(a - 0.03, a + 0.03, AMBANG, 2.5, p.aluminium, atas, 0.1, 0.12);
          segmen(b - 0.03, b + 0.03, AMBANG, 2.5, p.aluminium, atas, 0.1, 0.12);
          segmen(a, b, AMBANG - 0.02, AMBANG + 0.04, p.aluminium, atas, 0.24, 0.1);
          awal = b;
        }
        segmen(awal, sd.panjang, AMBANG, H, p.plesterLuar, atas);
      }
      // Tepi pelat yang tampak dari luar dan lis atap pada lantai teratas.
      segmen(-0.2, sd.panjang + 0.2, H, H + 0.3, p.beton, atas, 0.22, 0.11);
    }
  }

  private bangunTangga(p: Pustaka, statis: THREE.Group, y0: number) {
    const t = this.denah.tangga;
    const anak = 20;
    const naik = this.denah.tinggi / anak;
    const injak = (t.panjang - 0.3) / anak;
    // Arah naik: +1 bila anak tangga naik ke belakang gedung, −1 bila ke depan.
    const arah = t.naik === 'depan' ? -1 : 1;
    const kaki = arah > 0 ? t.z + 0.15 : t.z + t.panjang - 0.15;
    const lebar = t.lebar - 0.16;
    // Badan tangga pejal berplester dengan profil bertangga, sehingga terbaca jelas dari sudut mana pun.
    const wz = (z: number) => this.denah.panjang / 2 - z;
    const profil = new THREE.Shape();
    profil.moveTo(wz(kaki), 0);
    for (let i = 0; i < anak; i++) {
      const h = naik * (i + 1) - 0.05;
      profil.lineTo(wz(kaki + arah * i * injak), h);
      profil.lineTo(wz(kaki + arah * (i + 1) * injak), h);
    }
    profil.lineTo(wz(kaki + arah * anak * injak), 0);
    profil.closePath();
    const badan = this.catat(new THREE.ExtrudeGeometry(profil, { depth: lebar, bevelEnabled: false }));
    badan.rotateY(-Math.PI / 2);
    const xTengah = this.dunia(t.x + t.lebar / 2, 0).x;
    this.mesh(badan, p.plester, xTengah + lebar / 2, y0, 0, statis);
    // Injakan walnut dengan bibir sedikit menonjol.
    for (let i = 0; i < anak; i++) {
      const c = this.dunia(t.x + t.lebar / 2, kaki + arah * (i + 0.5) * injak);
      this.kotak(lebar + 0.02, 0.05, injak + 0.03, p.walnut, c.x, y0 + naik * (i + 1) - 0.025, c.z - (arah * 0.015), statis);
    }
    // Pagar kaca dengan pegangan baja di kedua sisi.
    const panjang = Math.hypot(t.panjang - 0.3, this.denah.tinggi);
    const sudut = Math.atan2(this.denah.tinggi, t.panjang - 0.3);
    for (const dx of [0.05, t.lebar - 0.05]) {
      const c = this.dunia(t.x + dx, t.z + t.panjang / 2);
      const kaca = this.kotak(0.02, 0.9, panjang, p.kacaBening, c.x, y0 + this.denah.tinggi / 2 + 0.5, c.z, statis, false);
      kaca.rotation.x = arah * sudut;
      const pegangan = this.kotak(0.05, 0.05, panjang, p.logam, c.x, y0 + this.denah.tinggi / 2 + 0.97, c.z, statis);
      pegangan.rotation.x = arah * sudut;
    }
  }

  // ——— Ruangan ———

  /** Grup lokal ruangan: titik asal di tengah lantai ruangan, sumbu +Z mengarah dari pintu ke belakang. */
  private bingkai(r: DataRuang, induk: THREE.Group, y0: number): Bingkai {
    const grup = new THREE.Group();
    const c = this.dunia(r.x + r.lebar / 2, r.z + r.panjang / 2, y0);
    grup.position.copy(c);
    const keluar = this.normalSisi(r.sisiPintu);
    // Sumbu lokal +Z = ke dalam ruangan = berlawanan dengan arah keluar pintu.
    grup.rotation.y = Math.atan2(-keluar.x, -keluar.z);
    induk.add(grup);
    const sepanjangX = r.sisiPintu === 'depan' || r.sisiPintu === 'belakang';
    return { grup, w: sepanjangX ? r.lebar : r.panjang, d: sepanjangX ? r.panjang : r.lebar };
  }

  /** Sisi denah untuk sisi lokal ruangan: 'pintu', 'belakang', 'kiriLokal' (−X), 'kananLokal' (+X). */
  private sisiDenah(r: DataRuang, lokal: 'pintu' | 'belakang' | 'minX' | 'plusX'): SisiPintu {
    const urut: SisiPintu[] = ['depan', 'kanan', 'belakang', 'kiri']; // searah jarum jam dilihat dari atas sketsa
    const i = urut.indexOf(r.sisiPintu);
    if (lokal === 'pintu') return r.sisiPintu;
    if (lokal === 'belakang') return urut[(i + 2) % 4];
    // Arah lokal −X/+X dihitung dari putaran grup.
    const keluar = this.normalSisi(r.sisiPintu);
    const theta = Math.atan2(-keluar.x, -keluar.z);
    const plusX = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta));
    const arah = lokal === 'plusX' ? plusX : plusX.clone().negate();
    return (['depan', 'belakang', 'kiri', 'kanan'] as SisiPintu[]).find((s) => this.normalSisi(s).dot(arah) > 0.9)!;
  }

  private diTepiGedung(r: DataRuang, s: SisiPintu) {
    const e = 0.01;
    return (
      (s === 'kiri' && r.x < e) ||
      (s === 'kanan' && r.x + r.lebar > this.denah.lebar - e) ||
      (s === 'depan' && r.z < e) ||
      (s === 'belakang' && r.z + r.panjang > this.denah.panjang - e)
    );
  }

  /**
   * Sisi lokal ruangan yang dibiarkan tanpa dinding. Studio live berupa bilik terbuka ke arah aula
   * (sisi pintu dan sisi yang menghadap pintu masuk gedung); loket layanan terbuka di sisi depannya.
   */
  private sisiTerbuka(r: DataRuang) {
    const buka = new Set<'pintu' | 'minX' | 'plusX'>();
    if (r.jenis === 'studio' || r.jenis === 'layanan') buka.add('pintu');
    if (r.jenis === 'studio' && !this.diTepiGedung(r, 'depan'))
      for (const sisi of ['minX', 'plusX'] as const) if (this.sisiDenah(r, sisi) === 'depan') buka.add(sisi);
    return buka;
  }

  private bangunRuang(r: DataRuang, statis: THREE.Group, grup: THREE.Group, p: Pustaka, y0: number, lampu: THREE.PointLight[], tambahan: THREE.Material[]) {
    const b = this.bingkai(r, statis, y0);
    const buka = this.sisiTerbuka(r);
    const { w, d } = b;
    const L = b.grup;
    const siaran = RUANG_SIARAN.includes(r.jenis);
    const kaca = ['rapat', 'kelas', 'kerja'].includes(r.jenis);

    // Lantai ruangan dan bidang sasaran klik (dinamis, tidak digabung).
    const matLantai: Record<string, THREE.Material> = {
      studio: p.lantaiKayu,
      podcast: p.karpet,
      kelas: p.oak,
      kerja: p.oak,
      rapat: p.karpet,
      toilet: p.ubin,
    };
    const mLantai = matLantai[r.jenis];
    if (mLantai) this.bidangLantai(w - 0.04, d - 0.04, mLantai, 0, 0.004, 0, L);
    const target = new THREE.Mesh(this.catat(new THREE.PlaneGeometry(w, d)), new THREE.MeshBasicMaterial({ visible: false }));
    this.materialLain.push(target.material as THREE.Material);
    target.rotation.x = -Math.PI / 2;
    target.position.y = 0.02;
    target.userData.ruangId = r.id;
    this.dinamis(target);
    L.add(target);
    const sorotMat = p.sorot.clone();
    this.materialLain.push(sorotMat);
    const sorot = this.dinamis(new THREE.Mesh(this.catat(new THREE.PlaneGeometry(w - 0.1, d - 0.1)), sorotMat));
    sorot.rotation.x = -Math.PI / 2;
    sorot.position.y = 0.014;
    sorot.visible = false;
    sorot.renderOrder = 2;
    L.add(sorot);

    // Dinding: inti berplester, lapisan dalam sesuai fungsi ruangan.
    const H = TINGGI_DINDING;
    const lapisDalam: THREE.Material = r.jenis === 'toilet' ? p.ubinDinding : r.jenis === 'studio' || r.jenis === 'podcast' ? p.kainArang : p.plester;
    const lebarPintu = r.jenis === 'toilet' ? 0.8 : kaca ? 1.0 : 0.95;
    const xPintu = r.jenis === 'toilet' || buka.has('pintu') ? 0 : Math.min(w / 2 - lebarPintu / 2 - 0.4, Math.max(-w / 2 + lebarPintu / 2 + 0.4, -w / 2 + 1.2));
    const dindingX = (x1: number, x2: number, z: number, m: THREE.Material, a = 0, bb = H) => {
      if (x2 - x1 < 0.02) return;
      this.kotak(x2 - x1, bb - a, TEBAL, m, (x1 + x2) / 2, a + (bb - a) / 2, z, L, !m.transparent);
    };
    const dindingZ = (z1: number, z2: number, x: number, m: THREE.Material) => {
      if (z2 - z1 < 0.02) return;
      this.kotak(TEBAL, H, z2 - z1, m, x, H / 2, (z1 + z2) / 2, L);
    };
    if (r.jenis !== 'lobi') {
      const zP = -d / 2 + TEBAL / 2;
      const p1 = xPintu - lebarPintu / 2;
      const p2 = xPintu + lebarPintu / 2;
      if (!buka.has('pintu') && !this.diTepiGedung(r, this.sisiDenah(r, 'pintu'))) {
        if (kaca) {
          // Partisi kaca dengan rangka aluminium dan pita buram setinggi mata.
          dindingX(-w / 2, p1, zP, p.kacaBening);
          dindingX(p2, w / 2, zP, p.kacaBening);
          dindingX(-w / 2, p1, zP, p.kacaBuram, 1.05, 1.45);
          dindingX(p2, w / 2, zP, p.kacaBuram, 1.05, 1.45);
          dindingX(p1, p2, zP, p.kacaBening, 0, 2.2);
          dindingX(-w / 2, w / 2, zP, p.aluminium, 2.2, 2.28);
          dindingX(p1, p2, zP, p.kacaBening, 2.28, H);
          this.kotak(w, 0.06, 0.1, p.aluminium, 0, H - 0.03, zP, L);
          this.kotak(w, 0.05, 0.1, p.aluminium, 0, 0.025, zP, L);
          for (const x of [-w / 2 + 0.03, p1, p2, w / 2 - 0.03, ...Array.from({ length: Math.floor(w / 1.4) }, (_, i) => -w / 2 + (i + 1) * 1.4).filter((x) => x < p1 - 0.2 || x > p2 + 0.2)])
            this.kotak(0.05, H, 0.1, p.aluminium, x, H / 2, zP, L);
          this.kotak(0.02, 0.5, 0.03, p.logam, p2 - 0.12, 1.05, zP - 0.07, L);
        } else {
          dindingX(-w / 2, p1, zP, p.plester);
          dindingX(p2, w / 2, zP, p.plester);
          dindingX(p1, p2, zP, p.plester, 2.25, H);
          // Kusen dan daun pintu walnut tertutup (kedap suara untuk studio).
          this.kotak(lebarPintu + 0.1, 0.05, TEBAL + 0.04, p.aluminium, xPintu, 2.25, zP, L);
          this.kotak(0.05, 2.25, TEBAL + 0.04, p.aluminium, p1 - 0.025, 1.125, zP, L);
          this.kotak(0.05, 2.25, TEBAL + 0.04, p.aluminium, p2 + 0.025, 1.125, zP, L);
          this.kotak(lebarPintu - 0.02, 2.2, 0.05, p.walnut, xPintu, 1.11, zP, L);
          this.kotak(0.03, 0.03, 0.22, p.logam, p2 - 0.12, 1.05, zP - 0.05, L).rotation.x = Math.PI / 2;
        }
      }
      // Dinding belakang dan samping (kecuali yang berimpit dengan dinding luar gedung).
      if (!this.diTepiGedung(r, this.sisiDenah(r, 'belakang'))) dindingX(-w / 2, w / 2, d / 2 - TEBAL / 2, p.plester);
      if (!buka.has('minX') && !this.diTepiGedung(r, this.sisiDenah(r, 'minX'))) dindingZ(-d / 2, d / 2, -w / 2 + TEBAL / 2, p.plester);
      if (!buka.has('plusX') && !this.diTepiGedung(r, this.sisiDenah(r, 'plusX'))) dindingZ(-d / 2, d / 2, w / 2 - TEBAL / 2, p.plester);
      // Lapisan dalam (panel akustik atau keramik) di sisi samping dan belakang yang berdinding.
      if (lapisDalam !== p.plester) {
        this.kotak(w - 0.3, H - 0.1, 0.03, lapisDalam, 0, H / 2, d / 2 - TEBAL - 0.02, L);
        if (!buka.has('minX')) this.kotak(0.03, H - 0.1, d - 0.3, lapisDalam, -w / 2 + TEBAL + 0.02, H / 2, 0, L);
        if (!buka.has('plusX')) this.kotak(0.03, H - 0.1, d - 0.3, lapisDalam, w / 2 - TEBAL - 0.02, H / 2, 0, L);
      }
      // List kaki dinding.
      if (!kaca && !buka.has('pintu')) this.kotak(w - 0.25, 0.08, 0.015, p.walnut, 0, 0.04, -d / 2 + TEBAL + 0.008, L);
    }

    // Papan nama di dinding pintu sisi luar.
    if (r.jenis !== 'lobi') {
      const tPapan = teksturPapanNama(r.kode, r.nama);
      this.teksturDibuat.push(tPapan);
      const mPapan = new THREE.MeshStandardMaterial({ map: tPapan, roughness: 0.42, metalness: 0.2 });
      tambahan.push(mPapan);
      if (buka.has('pintu')) {
        // Ruang terbuka: papan nama digantung dari langit-langit di tengah bukaan, di bawah lampu ON AIR.
        const yPapan = siaran ? 2.2 : 2.45;
        const zPapan = -d / 2 + 0.06;
        for (const sx of [-1, 1]) this.silinder(0.006, 0.006, H - yPapan, p.logam, sx * 0.22, yPapan + (H - yPapan) / 2, zPapan, L, 6);
        this.kotak(0.58, 0.24, 0.03, p.logamGelap, 0, yPapan, zPapan, L, false);
        const pl = this.mesh(this.catat(new THREE.PlaneGeometry(0.56, 0.215)), mPapan, 0, yPapan, zPapan - 0.016, L, false);
        pl.rotation.y = Math.PI;
      } else {
        const xp = Math.min(xPintu + lebarPintu / 2 + 0.45, w / 2 - 0.35);
        const xPapan = xp + 0.3 > w / 2 ? xPintu - lebarPintu / 2 - 0.45 : xp;
        this.kotak(0.54, 0.22, 0.02, p.logamGelap, xPapan, 1.55, -d / 2 - 0.012, L, false);
        const pl = this.mesh(this.catat(new THREE.PlaneGeometry(0.52, 0.2)), mPapan, xPapan, 1.55, -d / 2 - 0.0235, L, false);
        pl.rotation.y = Math.PI;
      }
    }

    // Huruf kuningan tanam di ambang pintu, terbaca saat melangkah masuk.
    if (r.jenis !== 'lobi' && r.jenis !== 'toilet') {
      const tInlay = teksturInlay(r.kode, r.nama);
      this.teksturDibuat.push(tInlay);
      const mInlay = new THREE.MeshStandardMaterial({ color: '#c79566', metalness: 0.9, roughness: 0.3, alphaMap: tInlay, transparent: true, depthWrite: false });
      tambahan.push(mInlay);
      const lebarInlay = Math.min(1.8, w - 0.8);
      const inlay = this.dinamis(new THREE.Mesh(this.catat(new THREE.PlaneGeometry(lebarInlay, lebarInlay / 4)), mInlay));
      inlay.rotation.order = 'YXZ';
      inlay.rotation.set(-Math.PI / 2, Math.PI, 0);
      inlay.position.set(THREE.MathUtils.clamp(xPintu, -w / 2 + lebarInlay / 2 + 0.3, w / 2 - lebarInlay / 2 - 0.3), 0.012, -d / 2 + 0.75);
      inlay.renderOrder = 3;
      L.add(inlay);
    }

    // ON AIR di atas pintu studio dan ruang podcast.
    let onAir: DataRuangMesh['onAir'];
    if (siaran) {
      const tMati = teksturOnAir(false);
      const tNyala = teksturOnAir(true);
      this.teksturDibuat.push(tMati, tNyala);
      const mati = new THREE.MeshStandardMaterial({ map: tMati, roughness: 0.25, metalness: 0.2 });
      const nyala = new THREE.MeshStandardMaterial({ map: tNyala, emissive: '#ffffff', emissiveMap: tNyala, emissiveIntensity: 3.2, roughness: 0.3 });
      tambahan.push(mati, nyala);
      const zOnAir = buka.has('pintu') ? -d / 2 + 0.1 : -d / 2 - 0.05;
      this.kotak(0.68, 0.24, 0.1, p.logamGelap, xPintu, 2.6, zOnAir, L, false);
      const mesh = this.dinamis(new THREE.Mesh(this.catat(new THREE.PlaneGeometry(0.62, 0.194)), mati));
      mesh.position.set(xPintu, 2.6, zOnAir - 0.051);
      mesh.rotation.y = Math.PI;
      L.add(mesh);
      const cahaya = this.dinamis(new THREE.PointLight('#ff8a3a', 5, 5, 2));
      cahaya.position.set(xPintu, 2.4, -d / 2 - 0.6);
      cahaya.visible = false;
      L.add(cahaya);
      onAir = { mesh, nyala, mati, cahaya };
    }

    // Perabot sesuai fungsi.
    let ringLight: THREE.MeshStandardMaterial | undefined;
    let kunci: THREE.PointLight | undefined;
    const m = { L, w, d, p, tambahan, buka, r };
    switch (r.jenis) {
      case 'studio':
        ({ ringLight, kunci } = this.perabotStudio(m));
        break;
      case 'podcast':
        ({ ringLight, kunci } = this.perabotPodcast(m));
        break;
      case 'lobi':
        this.perabotResepsionis(m);
        break;
      case 'kelas':
        this.perabotKelas(m);
        break;
      case 'kerja':
        this.perabotTim(m);
        break;
      case 'rapat':
      case 'kurasi':
        this.perabotRapat(m);
        break;
      case 'toilet':
        this.perabotToilet(m);
        break;
      case 'layanan':
        this.perabotLayanan(m);
        break;
      default:
        break;
    }

    // Cahaya ruang yang hangat (kecuali di mode ringan).
    if (!this.opsi.ringan && r.jenis !== 'toilet') {
      const l = this.dinamis(new THREE.PointLight('#ffd9b0', r.jenis === 'lobi' ? 10 : 7, Math.max(w, d) * 1.2, 1.8));
      l.position.set(0, 2.7, 0);
      L.add(l);
      lampu.push(l);
    }
    if (kunci) lampu.push(kunci);

    const pusat = L.position.clone();
    this.ruang.set(r.id, { data: r, lantai: target, sorot, onAir, ringLight, kunci, pusat });
    void grup;
  }

  // ——— Perabot (koordinat lokal ruangan) ———

  private kursiKantor(L: THREE.Group, p: Pustaka, x: number, z: number, hadap: number, m = p.kainArang, polos = false): THREE.Group {
    if (!polos) return this.pasang('kursi-kantor', L, x, 0, z, hadap, { lebar: 0.62 }, (g) => this.kursiKantor(g, p, 0, 0, 0, m, true));
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = hadap;
    L.add(g);
    this.bulat(0.48, 0.08, 0.46, 0.03, m, 0, 0.47, 0, g);
    this.bulat(0.44, 0.5, 0.06, 0.03, m, 0, 0.8, 0.22, g).rotation.x = -0.12;
    this.silinder(0.025, 0.025, 0.36, p.logam, 0, 0.27, 0, g, 8);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const kaki = this.kotak(0.03, 0.025, 0.3, p.plastikHitam, Math.sin(a) * 0.14, 0.06, Math.cos(a) * 0.14, g);
      kaki.rotation.y = a;
      this.silinder(0.025, 0.025, 0.04, p.plastikHitam, Math.sin(a) * 0.28, 0.02, Math.cos(a) * 0.28, g, 6);
    }
    return g;
  }

  private kursiKayu(L: THREE.Group, p: Pustaka, x: number, z: number, hadap: number, jok = p.kainLumut, polos = false): THREE.Group {
    if (!polos) return this.pasang('kursi-kayu', L, x, 0, z, hadap, { lebar: 0.58 }, (g) => this.kursiKayu(g, p, 0, 0, 0, jok, true));
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = hadap;
    L.add(g);
    this.bulat(0.46, 0.06, 0.44, 0.02, p.oak, 0, 0.45, 0, g);
    this.bulat(0.42, 0.05, 0.4, 0.02, jok, 0, 0.5, 0, g);
    this.bulat(0.44, 0.28, 0.04, 0.015, p.oak, 0, 0.76, 0.2, g);
    for (const [dx, dz] of [
      [-0.19, -0.18],
      [0.19, -0.18],
      [-0.19, 0.18],
      [0.19, 0.18],
    ])
      this.kotak(0.035, 0.45, 0.035, p.oak, dx, 0.225, dz, g);
    return g;
  }

  private meja(L: THREE.Group, p: Pustaka, x: number, z: number, w: number, d: number, atas: THREE.Material = p.oak, kaki: THREE.Material = p.logamGelap, h = 0.74) {
    this.bulat(w, 0.035, d, 0.01, atas, x, h - 0.0175, z, L);
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      this.kotak(0.04, h - 0.035, 0.04, kaki, x + sx * (w / 2 - 0.06), (h - 0.035) / 2, z + sz * (d / 2 - 0.06), L);
  }

  private monitor(L: THREE.Group, p: Pustaka, x: number, y: number, z: number, hadap: number, menyala = true) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = hadap;
    L.add(g);
    this.bulat(0.56, 0.34, 0.025, 0.008, p.plastikHitam, 0, 0.3, 0, g);
    this.kotak(0.53, 0.3, 0.004, menyala ? p.layarMenyala : p.layar, 0, 0.3, -0.014, g, false);
    this.kotak(0.04, 0.14, 0.04, p.logam, 0, 0.09, 0.03, g);
    this.bulat(0.2, 0.015, 0.16, 0.005, p.logam, 0, 0.008, 0.03, g);
    this.kotak(0.42, 0.015, 0.13, p.plastikPutih, 0, 0.008, -0.22, g);
  }

  private tanaman(L: THREE.Group, p: Pustaka, x: number, z: number, s = 1, polos = false) {
    if (!polos) return void this.pasang('tanaman', L, x, 0, z, s * 5, { tinggi: 0.95 * s }, (g) => this.tanaman(g, p, 0, 0, s, true));
    const pot = this.silinder(0.24 * s, 0.18 * s, 0.5 * s, p.potTerakota, x, 0.25 * s, z, L, 18);
    void pot;
    this.silinder(0.22 * s, 0.22 * s, 0.02, p.tanah, x, 0.49 * s, z, L, 16);
    const daun = [p.daun, p.daunTua, p.daunMuda];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + s;
      const g = this.catat(new THREE.SphereGeometry(0.22 * s, 8, 6));
      const helai = this.mesh(g, daun[i % 3], x + Math.cos(a) * 0.2 * s, (0.75 + (i % 3) * 0.18) * s, z + Math.sin(a) * 0.2 * s, L);
      helai.scale.set(1.3, 0.35, 0.7);
      helai.rotation.set(0.4 * Math.cos(a), -a, 0.5);
    }
    for (let i = 0; i < 3; i++) this.silinder(0.01, 0.012, 0.6 * s, p.batang, x + (i - 1) * 0.05, 0.75 * s, z, L, 5);
  }

  private produkDiRak(L: THREE.Group, p: Pustaka, x0: number, x1: number, y: number, z: number, benih: number) {
    let x = x0 + 0.1;
    let i = benih;
    while (x < x1 - 0.12) {
      const m = p.produk[i % p.produk.length];
      if (i % 3 === 0) this.silinder(0.05, 0.05, 0.18, m, x, y + 0.09, z, L, 14);
      else if (i % 3 === 1) this.bulat(0.14, 0.2, 0.08, 0.01, m, x, y + 0.1, z, L);
      else this.bulat(0.12, 0.14, 0.12, 0.02, m, x, y + 0.07, z, L);
      x += 0.17 + (i % 2) * 0.05;
      i++;
    }
  }

  private perabotStudio({ L, w, d, p, tambahan, buka, r }: PerabotRuang) {
    const belakang = d / 2 - TEBAL - 0.05;
    // Dinding latar: bilah walnut vertikal dan rak produk.
    const lebarLatar = Math.min(w - 0.6, 3.6);
    for (let i = 0; i <= Math.floor(lebarLatar / 0.16); i++) this.kotak(0.06, H_LATAR, 0.05, p.walnut, -lebarLatar / 2 + i * 0.16, H_LATAR / 2 + 0.05, belakang - 0.03, L);
    for (const yRak of [1.0, 1.45, 1.9]) {
      this.kotak(lebarLatar * 0.62, 0.03, 0.26, p.oak, 0, yRak, belakang - 0.2, L);
      this.produkDiRak(L, p, -lebarLatar * 0.3, lebarLatar * 0.3, yRak + 0.015, belakang - 0.2, Math.round(yRak * 10));
    }
    // Lampu strip hangat di balik rak.
    this.kotak(lebarLatar * 0.62, 0.015, 0.02, p.lampu, 0, 2.2, belakang - 0.08, L, false);
    // Panel akustik di dinding samping yang tertutup, berselang warna.
    for (const sx of [-1, 1]) {
      if (buka.has(sx < 0 ? 'minX' : 'plusX')) continue;
      for (let j = 0; j < 3; j++)
        for (let i = 0; i < Math.floor((d - 1.6) / 0.66); i++) {
          const m = (i * 3 + j) % 5 === 0 ? p.kainLumut : p.kainHutan;
          this.bulat(0.04, 0.6, 0.6, 0.015, m, sx * (w / 2 - TEBAL - 0.06), 0.9 + j * 0.66, -d / 2 + 1.0 + i * 0.66, L);
        }
    }
    // Karpet, meja siaran, kursi host, dan produk di meja.
    const zMeja = belakang - 1.35;
    this.bulat(Math.min(w - 1, 3.2), 0.012, 2.4, 0.005, p.karpet, 0, 0.006, zMeja + 0.2, L);
    this.bulat(1.9, 0.05, 0.75, 0.02, p.walnut, 0, 0.76, zMeja, L);
    this.bulat(1.85, 0.62, 0.04, 0.01, p.walnut, 0, 0.42, zMeja - 0.34, L);
    for (const sx of [-1, 1]) this.bulat(0.05, 0.72, 0.68, 0.01, p.walnut, sx * 0.9, 0.36, zMeja, L);
    for (let i = 0; i < 5; i++) {
      const m = p.produk[(i * 2 + 1) % p.produk.length];
      const x = -0.7 + i * 0.35;
      if (i % 2) this.silinder(0.06, 0.06, 0.2, m, x, 0.885, zMeja + 0.12, L, 16);
      else this.bulat(0.16, 0.22, 0.1, 0.01, m, x, 0.895, zMeja + 0.12, L);
    }
    // Host berdiri di balik meja, memegang produk ke arah kamera ponsel.
    const urut = this.semuaRuang.filter((x) => x.jenis === 'studio').findIndex((x) => x.id === r.id);
    this.orang(L, 0, zMeja + 0.5, 0, { ...HOST[Math.max(0, urut) % HOST.length], pose: 'berdiri', pegang: p.produk[(urut + 2) % p.produk.length] });
    // Ring light dengan ponsel. Versi prosedural berdiri di tripod lantai; model Meshy berupa ring light meja
    // yang diletakkan di tepi depan meja siaran, menghadap host.
    const zRing = Math.max(-d / 2 + 1.1, zMeja - 1.5);
    const tripod = (g: THREE.Group, x: number, z: number, tinggi: number) => {
      this.silinder(0.012, 0.012, tinggi, p.plastikHitam, x, tinggi / 2, z, g, 8);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const kaki = this.silinder(0.01, 0.01, 0.75, p.plastikHitam, x + Math.sin(a) * 0.17, 0.32, z + Math.cos(a) * 0.17, g, 6);
        kaki.rotation.set(Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45);
      }
    };
    const ringMat = new THREE.MeshStandardMaterial({ color: '#fdf6ec', emissive: '#fff1de', emissiveIntensity: 0.2, roughness: 0.4 });
    tambahan.push(ringMat);
    this.pasang('ring-light', L, 0, 0, zRing, 0, { tinggi: 0.5, geser: new THREE.Vector3(0, 0.785, zMeja - 0.2 - zRing), putar: Math.PI }, (g) => {
      tripod(g, 0, 0, 1.5);
      const ring = this.dinamis(new THREE.Mesh(this.catat(new THREE.TorusGeometry(0.23, 0.022, 10, 48)), ringMat));
      ring.position.set(0, 1.55, 0);
      g.add(ring);
      this.bulat(0.075, 0.15, 0.01, 0.01, p.plastikHitam, 0, 1.55, 0, g);
    });
    // Dua lampu softbox di tripod, di kiri dan kanan meja agar tidak menghalangi pandangan ke host.
    for (const sx of [-1, 1]) {
      // Di studio sempit softbox mundur ke depan meja agar tidak menaungi host.
      const sempit = w < 4.5;
      const x = sx * (w / 2 - (sempit ? 0.4 : 0.55));
      const z = sempit ? zMeja - 0.75 : zMeja + 0.05;
      // Softbox menghadap host (+Z lokal diputar ke arah host).
      this.pasang('softbox', L, x, 0, z, Math.atan2(-x, zMeja + 0.5 - z), { tinggi: 1.4, putar: Math.PI }, (g) => {
        tripod(g, 0, 0, 1.75);
        this.bulat(0.6, 0.6, 0.22, 0.03, p.plastikHitam, 0, 1.95, 0, g);
        this.kotak(0.52, 0.52, 0.01, p.lampu, 0, 1.95, 0.12, g, false);
      });
    }
    // Lampu kunci yang menyala saat siaran.
    const kunci = this.dinamis(new THREE.PointLight('#fff4e4', 9, 5, 2));
    kunci.position.set(0, 1.6, zRing + 0.3);
    kunci.visible = false;
    L.add(kunci);
    return { ringLight: ringMat, kunci };
  }

  private perabotPodcast({ L, w, d, p, tambahan }: { L: THREE.Group; w: number; d: number; p: Pustaka; tambahan: THREE.Material[] }) {
    // Panel akustik penuh di dinding belakang.
    const belakang = d / 2 - TEBAL - 0.06;
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < Math.floor((w - 0.8) / 0.62); i++)
        this.bulat(0.58, 0.58, 0.05, 0.02, (i + j) % 3 ? p.kainHutan : p.kainPasir, -w / 2 + 0.7 + i * 0.62, 0.6 + j * 0.62, belakang, L);
    // Meja bundar, empat kursi, dan lengan mikrofon.
    const meja = this.silinder(0.75, 0.75, 0.05, p.walnut, 0, 0.74, 0.1, L, 40);
    void meja;
    this.silinder(0.08, 0.12, 0.72, p.logamGelap, 0, 0.36, 0.1, L, 16);
    this.silinder(0.35, 0.35, 0.02, p.logamGelap, 0, 0.01, 0.1, L, 24);
    const ringMat = new THREE.MeshStandardMaterial({ color: '#2b2b2b', emissive: '#ff9a50', emissiveIntensity: 0.2, roughness: 0.4 });
    tambahan.push(ringMat);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const kx = Math.sin(a) * 1.15;
      const kz = 0.1 + Math.cos(a) * 1.15;
      if (i % 2 === 0) this.orangDuduk(L, p, kx, kz, a, HOST[(i / 2 + 1) % HOST.length], p.kainLumut);
      else this.kursiKantor(L, p, kx, kz, a, p.kainLumut);
      // Mikrofon di lengan pada meja.
      const mx = Math.sin(a) * 0.55;
      const mz = 0.1 + Math.cos(a) * 0.55;
      this.silinder(0.012, 0.012, 0.35, p.logam, mx, 0.94, mz, L, 6);
      const mik = this.silinder(0.035, 0.03, 0.16, p.plastikHitam, mx, 1.12, mz, L, 12);
      mik.rotation.x = 0.5;
      // Lampu kecil pada mikrofon menyala saat merekam.
      this.dinamis(this.silinder(0.008, 0.008, 0.02, ringMat, mx, 1.21, mz, L, 6));
    }
    this.bulat(Math.min(w - 1.2, 4.5), 0.012, 3.0, 0.005, p.kainPasir, 0, 0.007, 0.1, L);
    this.tanaman(L, p, w / 2 - 0.6, d / 2 - 0.7, 1.1);
    this.tanaman(L, p, -w / 2 + 0.6, d / 2 - 0.7, 0.9);
    // Lampu kunci saat siaran.
    const kunci = this.dinamis(new THREE.PointLight('#ffe6c8', 7, 5, 2));
    kunci.position.set(0, 2.2, 0);
    kunci.visible = false;
    L.add(kunci);
    return { ringLight: ringMat, kunci };
  }

  private perabotResepsionis({ L, w, d, p, tambahan }: { L: THREE.Group; w: number; d: number; p: Pustaka; tambahan: THREE.Material[] }) {
    // Meja resepsionis walnut berbibir terrazzo, menghadap pengunjung yang masuk.
    const zMeja = -d / 2 + 1.5;
    this.bulat(Math.min(w - 1.2, 3.2), 1.05, 0.6, 0.06, p.walnut, 0, 0.525, zMeja, L);
    this.bulat(Math.min(w - 1.0, 3.4), 0.05, 0.75, 0.02, p.terrazzo, 0, 1.075, zMeja, L);
    this.kotak(Math.min(w - 1.3, 3.0), 0.02, 0.02, p.kuningan, 0, 0.98, zMeja - 0.31, L, false);
    this.monitor(L, p, -0.5, 0.75, zMeja + 0.2, Math.PI);
    this.kursiKantor(L, p, -0.5, zMeja + 1.15, 0);
    this.kursiKantor(L, p, 0.6, zMeja + 1.15, 0);
    // Dua resepsionis berseragam PCC menyambut pengunjung.
    for (const [i, x] of [-0.5, 0.65].entries()) this.orang(L, x, zMeja + 0.62, 0, { ...RESEPSIONIS[i], pose: 'berdiri' });
    // Dinding fitur dengan lambang dan nama lembaga.
    const zLatar = d / 2 - 0.35;
    const lebar = Math.min(w - 0.8, 3.6);
    for (let i = 0; i <= Math.floor(lebar / 0.12); i++) this.kotak(0.05, 2.6, 0.06, p.walnut, -lebar / 2 + i * 0.12, 1.3, zLatar, L);
    this.kotak(lebar, 2.6, 0.04, p.plastikHitam, 0, 1.3, zLatar + 0.05, L);
    const tLogo = teksturLogoDinding(this.identitas.nama, this.identitas.singkat, this.logo, true);
    this.teksturDibuat.push(tLogo);
    const mLogo = new THREE.MeshStandardMaterial({ map: tLogo, transparent: true, roughness: 0.35, metalness: 0.3, emissive: '#ffffff', emissiveMap: tLogo, emissiveIntensity: 0.25 });
    tambahan.push(mLogo);
    const papan = this.dinamis(new THREE.Mesh(this.catat(new THREE.PlaneGeometry(lebar * 0.86, lebar * 0.215)), mLogo));
    papan.position.set(0, 1.85, zLatar - 0.04);
    papan.rotation.y = Math.PI;
    L.add(papan);
    this.tanaman(L, p, -w / 2 + 0.55, d / 2 - 0.55, 1.4);
    this.tanaman(L, p, w / 2 - 0.55, d / 2 - 0.55, 1.2);
  }

  private perabotKelas({ L, w, d, p }: { L: THREE.Group; w: number; d: number; p: Pustaka }) {
    // Layar besar dan papan tulis di dinding belakang; deretan meja dengan komputer menghadap layar.
    const belakang = d / 2 - TEBAL - 0.04;
    this.bulat(2.0, 1.15, 0.06, 0.01, p.plastikHitam, -0.6, 1.55, belakang - 0.03, L);
    this.kotak(1.92, 1.08, 0.01, p.layarMenyala, -0.6, 1.55, belakang - 0.065, L, false);
    this.bulat(1.4, 1.0, 0.03, 0.01, p.plastikPutih, w / 2 - 1.1, 1.5, belakang - 0.02, L);
    const baris = Math.max(1, Math.floor((d - 2.4) / 1.45));
    for (let j = 0; j < baris; j++) {
      const z = belakang - 1.8 - j * 1.45;
      const lebarMeja = w - 1.2;
      this.meja(L, p, 0, z, lebarMeja, 0.6, p.oak);
      const kursi = Math.max(1, Math.floor(lebarMeja / 0.9));
      for (let i = 0; i < kursi; i++) {
        const x = -lebarMeja / 2 + 0.45 + i * (lebarMeja - 0.9) / Math.max(1, kursi - 1);
        this.monitor(L, p, x, 0.74, z + 0.12, 0, (i + j) % 3 !== 2);
        this.kursiKantor(L, p, x, z - 0.6, Math.PI);
      }
    }
    this.tanaman(L, p, -w / 2 + 0.5, -d / 2 + 0.6, 1);
  }

  private perabotTim({ L, w, d, p }: { L: THREE.Group; w: number; d: number; p: Pustaka }) {
    // Dua klaster meja kerja berhadapan, rak buku, dan meja diskusi kecil.
    const lebarKlaster = Math.min(3.0, w / 2 - 0.6);
    for (const sx of [-1, 1]) {
      const x = sx * (w / 4 + 0.1);
      const z = 0.3;
      this.meja(L, p, x, z, lebarKlaster, 1.4, p.oak);
      this.kotak(lebarKlaster - 0.1, 0.35, 0.03, p.kainLumut, x, 0.92, z, L);
      for (const sz of [-1, 1])
        for (const ox of [-lebarKlaster / 4, lebarKlaster / 4]) {
          this.monitor(L, p, x + ox, 0.74, z + sz * 0.25, sz > 0 ? Math.PI : 0);
          this.kursiKantor(L, p, x + ox, z + sz * 1.05, sz > 0 ? 0 : Math.PI);
        }
    }
    const belakang = d / 2 - TEBAL - 0.2;
    this.bulat(Math.min(3, w - 1.5), 1.9, 0.38, 0.02, p.walnut, -w / 2 + Math.min(3, w - 1.5) / 2 + 0.4, 0.95, belakang, L);
    for (const y of [0.45, 0.95, 1.45]) this.produkDiRak(L, p, -w / 2 + 0.5, -w / 2 + Math.min(3, w - 1.5) + 0.3, y, belakang - 0.05, Math.round(y * 7));
    this.silinder(0.45, 0.45, 0.04, p.walnut, w / 2 - 1.1, 0.72, belakang - 0.6, L, 32);
    this.silinder(0.05, 0.05, 0.7, p.logamGelap, w / 2 - 1.1, 0.35, belakang - 0.6, L, 10);
    this.kursiKayu(L, p, w / 2 - 1.7, belakang - 0.6, Math.PI / 2);
    this.kursiKayu(L, p, w / 2 - 0.5, belakang - 0.6, -Math.PI / 2);
    this.tanaman(L, p, w / 2 - 0.5, -d / 2 + 0.6, 1.2);
  }

  private perabotRapat({ L, w, d, p }: { L: THREE.Group; w: number; d: number; p: Pustaka }) {
    const panjangMeja = Math.min(w - 2.2, 4.4);
    this.bulat(panjangMeja, 0.05, 1.2, 0.04, p.walnut, 0, 0.75, 0.2, L);
    for (const sx of [-1, 1]) this.bulat(0.08, 0.72, 0.8, 0.02, p.logamGelap, sx * (panjangMeja / 2 - 0.5), 0.36, 0.2, L);
    const jumlah = Math.max(2, Math.floor(panjangMeja / 0.8));
    for (let i = 0; i < jumlah; i++) {
      const x = -panjangMeja / 2 + 0.4 + i * ((panjangMeja - 0.8) / Math.max(1, jumlah - 1));
      this.kursiKantor(L, p, x, 0.2 - 0.95, Math.PI);
      this.kursiKantor(L, p, x, 0.2 + 0.95, 0);
    }
    this.kursiKantor(L, p, -panjangMeja / 2 - 0.55, 0.2, -Math.PI / 2);
    // Layar presentasi dan kredenza di dinding samping.
    this.bulat(0.06, 1.0, 1.75, 0.01, p.plastikHitam, w / 2 - TEBAL - 0.05, 1.55, 0.2, L);
    this.kotak(0.01, 0.94, 1.68, p.layarMenyala, w / 2 - TEBAL - 0.085, 1.55, 0.2, L, false);
    this.tanaman(L, p, -w / 2 + 0.55, d / 2 - 0.55, 1.2);
    this.tanaman(L, p, w / 2 - 0.55, -d / 2 + 0.6, 1);
  }

  private perabotLayanan({ L, w, d, p, tambahan, r }: PerabotRuang) {
    // Loket layanan perizinan: meja loket berbibir terrazzo, petugas, dan papan nama instansi di dinding belakang.
    const zLoket = -d / 2 + 0.65;
    const lebarLoket = Math.min(w - 0.8, 3.4);
    this.bulat(lebarLoket, 1.0, 0.45, 0.04, p.walnut, 0, 0.5, zLoket, L);
    this.bulat(lebarLoket + 0.1, 0.04, 0.6, 0.015, p.terrazzo, 0, 1.02, zLoket, L);
    this.kotak(lebarLoket - 0.2, 0.02, 0.02, p.kuningan, 0, 0.92, zLoket - 0.23, L, false);
    this.meja(L, p, 0, zLoket + 0.55, lebarLoket - 0.4, 0.55, p.oak);
    this.monitor(L, p, -0.45, 0.74, zLoket + 0.5, Math.PI);
    this.orangDuduk(L, p, -0.45, zLoket + 1.15, 0, r.nama.toLowerCase().includes('dinkes') ? PETUGAS[1] : PETUGAS[0]);
    // Kursi tunggu pemohon di depan loket.
    for (const x of [-0.6, 0.6]) this.kursiKayu(L, p, x, -d / 2 - 0.55, Math.PI, p.kainHutan);
    // Papan nama instansi besar di dinding belakang.
    const tPapan = teksturPapanNama(r.kode, r.nama);
    this.teksturDibuat.push(tPapan);
    const mPapan = new THREE.MeshStandardMaterial({ map: tPapan, roughness: 0.42, metalness: 0.2 });
    tambahan.push(mPapan);
    const zDinding = d / 2 - TEBAL - 0.03;
    this.kotak(1.66, 0.66, 0.03, p.logamGelap, 0.3, 1.75, zDinding, L, false);
    this.mesh(this.catat(new THREE.PlaneGeometry(1.6, 0.6)), mPapan, 0.3, 1.75, zDinding - 0.017, L, false).rotation.y = Math.PI;
    // Rak brosur dan tanaman.
    this.bulat(0.5, 1.2, 0.25, 0.02, p.walnut, w / 2 - 0.55, 0.6, zDinding - 0.15, L);
    for (const y of [0.75, 1.0]) this.produkDiRak(L, p, w / 2 - 0.75, w / 2 - 0.35, y, zDinding - 0.2, Math.round(y * 9));
    this.tanaman(L, p, -w / 2 + 0.5, d / 2 - 0.5, 1.1);
  }

  /** Figur duduk di kursi kantor; model Meshy-nya sudah termasuk kursi. */
  private orangDuduk(L: THREE.Group, p: Pustaka, x: number, z: number, hadap: number, o: Figur, kursi = p.kainArang) {
    const isi = (g: THREE.Group) => {
      this.kursiKantor(g, p, 0, 0, 0, kursi, true);
      this.orang(g, 0, 0, 0, { ...o, pose: 'duduk' }, true);
    };
    if (o.modelDuduk) this.pasang(o.modelDuduk, L, x, 0, z, hadap, { tinggi: 1.3 }, isi);
    else {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = hadap;
      L.add(g);
      isi(g);
    }
  }

  /** Bahan pakaian dan kulit figur, dipakai bersama dalam satu lantai. */
  private bahanOrang(warna: string, kasar = 0.85) {
    let m = this.matOrang.get(warna);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: warna, roughness: kasar });
      this.matOrang.set(warna, m);
      this.tambahanAktif.push(m);
    }
    return m;
  }

  /**
   * Figur manusia skala 1:1 bergaya maket arsitektur: proporsi nyata, tanpa wajah. Menghadap −Z lokal;
   * `hadap` memutar seperti kursi. Pose duduk pas dengan dudukan kursiKantor.
   */
  private orang(L: THREE.Group, x: number, z: number, hadap: number, o: Figur & { pose: 'berdiri' | 'duduk'; pegang?: THREE.Material }, polos = false): THREE.Group {
    if (!polos && o.model && o.pose === 'berdiri')
      return this.pasang(o.model, L, x, 0, z, hadap, { tinggi: o.kerudung ? 1.62 : 1.7 }, (g) => this.orang(g, 0, 0, 0, o, true));
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = hadap;
    L.add(g);
    const kulit = this.bahanOrang(o.kulit, 0.6);
    const baju = this.bahanOrang(o.baju);
    const bawah = this.bahanOrang(o.bawah);
    const sepatu = this.bahanOrang('#1f1c1a', 0.5);
    const atas = new THREE.Vector3(0, 1, 0);
    const V = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c);
    const ruas = (a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material) => {
      const arah = b.clone().sub(a);
      const k = this.mesh(this.catat(new THREE.CapsuleGeometry(r, Math.max(0.01, arah.length()), 4, 10)), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, g);
      k.quaternion.setFromUnitVectors(atas, arah.normalize());
    };
    const duduk = o.pose === 'duduk';
    const yPinggul = duduk ? 0.56 : 0.92;
    // Kaki dan sepatu.
    for (const sx of [-1, 1]) {
      const pinggul = V(sx * 0.095, yPinggul, 0);
      const lutut = duduk ? V(sx * 0.1, yPinggul, -0.42) : V(sx * 0.1, 0.5, -0.01);
      const tumit = duduk ? V(sx * 0.1, 0.1, -0.46) : V(sx * 0.1, 0.1, 0);
      ruas(pinggul, lutut, 0.07, bawah);
      ruas(lutut, tumit, 0.058, bawah);
      this.bulat(0.1, 0.07, 0.25, 0.03, sepatu, tumit.x, 0.035, tumit.z - 0.05, g);
    }
    // Panggul, badan, dan gamis panjang untuk figur berkerudung.
    this.bulat(0.34, 0.16, 0.22, 0.07, bawah, 0, yPinggul + 0.02, 0, g);
    const badan = this.mesh(this.catat(new THREE.CapsuleGeometry(0.16, 0.3, 4, 12)), baju, 0, yPinggul + 0.3, 0, g);
    badan.scale.set(1.08, 1, 0.66);
    if (o.kerudung && !duduk) this.mesh(this.catat(new THREE.CylinderGeometry(0.17, 0.23, 0.55, 16)), baju, 0, yPinggul - 0.12, 0, g);
    // Leher dan kepala.
    const yKepala = yPinggul + 0.74;
    this.silinder(0.045, 0.05, 0.12, kulit, 0, yPinggul + 0.6, 0, g, 10);
    const kepala = this.mesh(this.catat(new THREE.SphereGeometry(0.1, 20, 14)), kulit, 0, yKepala, 0, g);
    kepala.scale.set(0.92, 1.12, 1);
    if (o.kerudung) {
      // Kerudung: penutup kepala dengan bukaan wajah dan selendang yang jatuh ke bahu.
      const mk = this.bahanOrang(o.kerudung, 0.9);
      this.mesh(this.catat(new THREE.SphereGeometry(0.122, 20, 8, 0, Math.PI * 2, 0, 0.8)), mk, 0, yKepala + 0.005, 0.005, g);
      const sisi = this.mesh(this.catat(new THREE.SphereGeometry(0.122, 20, 12, Math.PI * 1.5 + 0.75, Math.PI * 2 - 1.5, 0.8, Math.PI - 0.8)), mk, 0, yKepala + 0.005, 0.005, g);
      sisi.scale.y = 1.08;
      this.mesh(this.catat(new THREE.CylinderGeometry(0.1, 0.25, 0.2, 20)), mk, 0, yPinggul + 0.56, 0.005, g).scale.z = 0.75;
    } else if (o.rambut) {
      const rambut = this.mesh(this.catat(new THREE.SphereGeometry(0.106, 20, 10, 0, Math.PI * 2, 0, 1.75)), this.bahanOrang(o.rambut, 0.7), 0, yKepala + 0.012, 0.008, g);
      rambut.rotation.x = 0.35;
      rambut.scale.set(0.95, 1.08, 1);
    }
    // Lengan: bahu ke siku menggantung, lengan bawah ke depan; tangan bertemu bila memegang produk.
    const yBahu = yPinggul + 0.5;
    for (const sx of [-1, 1]) {
      const bahu = V(sx * 0.19, yBahu, 0);
      const siku = V(sx * 0.22, yBahu - 0.28, -0.04);
      const tangan = o.pegang ? V(sx * 0.08, yBahu - 0.18, -0.32) : V(sx * 0.17, yBahu - 0.3, -0.3);
      ruas(bahu, siku, 0.047, baju);
      ruas(siku, tangan, 0.04, baju);
      this.mesh(this.catat(new THREE.SphereGeometry(0.042, 12, 8)), kulit, tangan.x, tangan.y, tangan.z - 0.02, g);
    }
    if (o.pegang) this.bulat(0.1, 0.16, 0.06, 0.01, o.pegang, 0, yBahu - 0.12, -0.37, g);
    return g;
  }

  private perabotToilet({ L, w, d, p }: { L: THREE.Group; w: number; d: number; p: Pustaka }) {
    const belakang = d / 2 - TEBAL - 0.05;
    // Kloset duduk dengan tangki, wastafel, dan cermin.
    this.bulat(0.38, 0.4, 0.18, 0.04, p.keramik, 0, 0.75, belakang - 0.1, L);
    const mangkuk = this.silinder(0.2, 0.16, 0.4, p.keramik, 0, 0.2, belakang - 0.45, L, 24);
    mangkuk.scale.z = 1.35;
    this.silinder(0.21, 0.21, 0.03, p.plastikPutih, 0, 0.415, belakang - 0.45, L, 24).scale.z = 1.35;
    const xw = w / 2 - TEBAL - 0.3;
    this.bulat(0.45, 0.14, 0.4, 0.04, p.keramik, xw, 0.82, -0.2, L).rotation.y = Math.PI / 2;
    this.kotak(0.02, 0.7, 0.5, p.cermin, w / 2 - TEBAL - 0.05, 1.45, -0.2, L, false);
    this.silinder(0.015, 0.015, 0.16, p.logam, xw + 0.12, 0.95, -0.2, L, 8);
  }

  // ——— Ruang bersama (hall) ———

  private bebas(n: number, x1: number, x2: number, z1: number, z2: number) {
    const t = this.denah.tangga;
    const tabrak = (a: number[], b: number[]) => a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3];
    const area = [x1, x2, z1, z2];
    if (x1 < 0.3 || z1 < 0.3 || x2 > this.denah.lebar - 0.3 || z2 > this.denah.panjang - 0.3) return false;
    const kakiDepan = t.naik === 'depan';
    if (tabrak(area, [t.x - 0.3, t.x + t.lebar + 0.3, t.z - (kakiDepan ? 0.3 : 0.9), t.z + t.panjang + (kakiDepan ? 0.9 : 0.3)])) return false;
    return !this.semuaRuang.some((r) => r.lantai === n && tabrak(area, [r.x - 0.6, r.x + r.lebar + 0.6, r.z - 0.6, r.z + r.panjang + 0.6]));
  }

  private dekorasiHall(n: number, _daftar: DataRuang[], p: Pustaka, statis: THREE.Group, y0: number, tambahan: THREE.Material[]) {
    const G = new THREE.Group();
    G.position.y = y0;
    statis.add(G);
    const W = this.denah.lebar;
    const D = this.denah.panjang;
    const pm = this.denah.pintuMasuk;
    const taruh = (x: number, z: number, fn: (c: THREE.Vector3) => void) => {
      const c = this.dunia(x, z);
      fn(c);
    };

    if (n === 1) {
      // Keset masuk.
      const keset = this.dunia(pm.x + pm.lebar / 2, 1.0);
      this.bulat(pm.lebar - 0.2, 0.015, 1.6, 0.005, p.karpet, keset.x, 0.008, keset.z, G);
      // Papan direktori menghadap pengunjung yang masuk.
      const xDir = pm.x + pm.lebar + 1.0;
      if (this.bebas(1, xDir - 0.4, xDir + 0.4, 1.0, 1.6)) {
        const lantaiData = [...new Set(this.semuaRuang.map((r) => r.lantai))].sort().map((nomor) => ({
          nomor,
          ruang: this.semuaRuang.filter((r) => r.lantai === nomor).map((r) => ({ kode: r.kode, nama: r.nama })),
        }));
        const tDir = teksturDirektori('Direktori', lantaiData);
        this.teksturDibuat.push(tDir);
        const mDir = new THREE.MeshStandardMaterial({ map: tDir, roughness: 0.45 });
        tambahan.push(mDir);
        taruh(xDir, 1.3, (c) => {
          this.kotak(0.66, 1.75, 0.1, p.logamGelap, c.x, 0.95, c.z, G);
          this.kotak(0.5, 0.08, 0.3, p.logamGelap, c.x, 0.04, c.z, G);
          this.mesh(this.catat(new THREE.PlaneGeometry(0.6, 1.5)), mDir, c.x, 1.0, c.z + 0.051, G, false);
        });
      }
      // Ruang tunggu: sofa, kursi, meja rendah, dan karpet di tengah aula.
      for (const [cx, cz] of [
        [W / 2, 5],
        [W / 2, D / 2 - 1],
        [W / 2, D / 2 + 1.5],
        [W / 2, 6],
      ]) {
        if (!this.bebas(1, cx - 2, cx + 2, cz - 1.6, cz + 1.6)) continue;
        taruh(cx, cz, (c) => {
          this.bulat(3.4, 0.012, 2.6, 0.005, p.kainPasir, c.x, 0.007, c.z, G);
          // Sofa menghadap meja (+Z dunia); hadap π memutar arah −Z lokal ke sana.
          // Model sofa memanjang di sumbu Z, jadi diputar seperempat putaran.
          this.pasang('sofa', G, c.x, 0, c.z - 0.85, Math.PI, { lebar: 2.3, putar: Math.PI / 2 }, (g) => {
            this.bulat(2.2, 0.42, 0.85, 0.08, p.kainLumut, 0, 0.21, 0, g);
            this.bulat(2.2, 0.42, 0.18, 0.08, p.kainLumut, 0, 0.56, 0.35, g);
            for (const sx of [-1, 1]) this.bulat(0.2, 0.55, 0.85, 0.06, p.kainLumut, sx * 1.0, 0.36, 0, g);
          });
          for (const sx of [-1, 1]) {
            const kursi = this.kursiKayu(G, p, c.x + sx * 0.9, c.z + 0.9, sx * 0.3, p.kainHutan);
            kursi.scale.setScalar(1.15);
          }
          this.silinder(0.5, 0.5, 0.05, p.terrazzo, c.x, 0.4, c.z, G, 32);
          this.silinder(0.04, 0.06, 0.38, p.logamGelap, c.x, 0.19, c.z, G, 10);
          this.produkDiRak(G, p, c.x - 0.25, c.x + 0.3, 0.425, c.z, 3);
        });
        break;
      }
      // Etalase produk UMKM: alas pamer berpuncak terrazzo.
      let etalase = 0;
      for (let z = 4; z < D - 4 && etalase < 4; z += 2.2) {
        for (const x of [W / 2 - 2.3, W / 2 + 2.3]) {
          if (etalase >= 4 || !this.bebas(1, x - 0.5, x + 0.5, z - 0.5, z + 0.5)) continue;
          if (Math.abs(z - D / 2) < 2.2) continue;
          taruh(x, z, (c) => {
            const h = 0.8 + (etalase % 3) * 0.15;
            this.bulat(0.6, h, 0.6, 0.02, p.walnut, c.x, h / 2, c.z, G);
            this.bulat(0.64, 0.04, 0.64, 0.01, p.terrazzo, c.x, h + 0.02, c.z, G);
            this.produkDiRak(G, p, c.x - 0.25, c.x + 0.27, h + 0.04, c.z, etalase * 2);
          });
          etalase++;
        }
      }
    } else {
      // Bangku dan tanaman di koridor lantai atas.
      for (const [x, z] of [
        [W / 2, D / 2 - 0.5],
        [W / 2, 5.2],
      ]) {
        if (!this.bebas(n, x - 1, x + 1, z - 0.4, z + 0.4)) continue;
        taruh(x, z, (c) => {
          this.bulat(1.8, 0.08, 0.45, 0.02, p.oak, c.x, 0.45, c.z, G);
          for (const sx of [-1, 1]) this.kotak(0.05, 0.42, 0.4, p.logamGelap, c.x + sx * 0.8, 0.21, c.z, G);
        });
      }
    }
    // Tanaman besar di sudut-sudut aula yang lowong.
    for (const [x, z] of [
      [W / 2 - 2.6, 0.9],
      [W / 2 + 2.6, D - 1],
      [W / 2 - 2.6, D / 2],
      [W / 2 + 2.6, D / 2 + 3],
    ]) {
      if (!this.bebas(n, x - 0.4, x + 0.4, z - 0.4, z + 0.4)) continue;
      taruh(x, z, (c) => this.tanaman(G, p, c.x, c.z, 1.5));
    }
  }
}

const H_LATAR = 2.4;

interface PerabotRuang {
  L: THREE.Group;
  w: number;
  d: number;
  p: Pustaka;
  tambahan: THREE.Material[];
  buka: Set<'pintu' | 'minX' | 'plusX'>;
  r: DataRuang;
}

interface Figur {
  /** Model Meshy untuk pose berdiri dan duduk; tanpa model, figur prosedural dipakai. */
  model?: NamaModel;
  modelDuduk?: NamaModel;
  kulit: string;
  baju: string;
  bawah: string;
  rambut?: string;
  kerudung?: string;
}

/** Host live dan tamu podcast: warna kulit sawo matang, busana sehari-hari yang rapi. */
const HOST: Figur[] = [
  { model: 'host-wanita', modelDuduk: 'duduk-wanita', kulit: '#b07a52', baju: '#2f4a3c', bawah: '#2a2622', kerudung: '#d8c3a2' },
  { model: 'host-pria', modelDuduk: 'duduk-pria', kulit: '#8d5a3b', baju: '#7a4527', bawah: '#2b2f33', rambut: '#17120f' },
  { model: 'host-wanita', modelDuduk: 'duduk-wanita', kulit: '#c08b63', baju: '#e6dccb', bawah: '#3a3530', kerudung: '#7d2f2a' },
  { model: 'host-pria', modelDuduk: 'duduk-pria', kulit: '#9a6644', baju: '#26405a', bawah: '#22262a', rambut: '#120e0c' },
];

/** Seragam resepsionis PCC: blazer hijau tua, satu berkerudung jingga lembaga. */
const RESEPSIONIS: Figur[] = [
  { model: 'resepsionis-wanita', kulit: '#b5805a', baju: '#233b30', bawah: '#1f2321', kerudung: '#e2742a' },
  { model: 'resepsionis-pria', kulit: '#94603f', baju: '#233b30', bawah: '#1f2321', rambut: '#15110e' },
];

/** Petugas loket: seragam khaki ASN untuk Disperindag, jas putih untuk Dinkes. */
const PETUGAS: Figur[] = [
  { modelDuduk: 'duduk-pria', kulit: '#9d6a47', baju: '#8b7d55', bawah: '#3b3a33', rambut: '#15110e' },
  { modelDuduk: 'duduk-wanita', kulit: '#bb855e', baju: '#f1eee8', bawah: '#2d3a45', kerudung: '#3d5a7a' },
];

/** Ukuran model di tempatnya: tinggi atau lebar dalam meter, serta geseran dan putaran tambahan. */
interface UkuranSlot {
  tinggi?: number;
  /** Panjang sisi datar terpanjang. */
  lebar?: number;
  geser?: THREE.Vector3;
  putar?: number;
}
