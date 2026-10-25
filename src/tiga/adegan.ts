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
import { muatModel, muatTekstur, type NamaModel } from './model';
import { PetaJalan } from './navigasi';
import { muatStaf, Penghuni, teksturBayangan, type Aksi, type NamaStaf, type RencanaStaf } from './penghuni';
import {
  muatGambar,
  siapkanHuruf,
  teksturDirektori,
  teksturInlay,
  teksturLogoDinding,
  teksturMenuKafe,
  teksturMerekKafe,
  teksturMonumen,
  teksturNeonKafe,
  teksturNamaMeja,
  teksturOnAir,
  teksturPapanNama,
  teksturPetunjukLantai,
} from './signage';

export type SisiPintu = 'depan' | 'belakang' | 'kiri' | 'kanan';

export interface DataRuang {
  id: number;
  staf?: { nama: string; perempuan: boolean }[];
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
  /**
   * Tangga luar ke lantai 2, menempel fasad depan: kaki di `x`, anak tangga naik searah sumbu x denah
   * sepanjang `panjang`, lalu bordes sepanjang `bordes` di depan pintu lantai 2. Lebar tangga `lebar`,
   * berjarak `jarak` dari kaca fasad.
   */
  tangga: { x: number; panjang: number; lebar: number; jarak: number; bordes: number };
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
  private denah: DataDenah = { lebar: 18, panjang: 20, tinggi: 3.6, pintuMasuk: { x: 6.5, lebar: 3 }, tangga: { x: 10.7, panjang: 5.4, lebar: 1.2, jarak: 0.3, bordes: 1.9 } };
  private semuaRuang: DataRuang[] = [];
  private matOrang = new Map<string, THREE.MeshStandardMaterial>();
  /** Tempat model Meshy: berisi versi prosedural sampai modelnya selesai dimuat. */
  private slot: { nama: NamaModel; grup: THREE.Group; lantai: number; ukuran: UkuranSlot }[] = [];
  private lantaiBangun = 0;
  private versiBangun = 0;
  /** Staf yang menunggu karakternya dimuat, dan staf yang sudah bergerak. */
  private rencanaStaf: { rencana: RencanaStaf; lantai: number; cadangan: THREE.Group; varian?: string }[] = [];
  /** Dinding atas bangunan di halaman (kedai kopi) yang ikut dipotong saat menghadap kamera. */
  private potonganLuar: DataLantai['luar'] = [];
  private penghuni: { p: Penghuni; lantai: number }[] = [];
  private petaJalan = new Map<number, PetaJalan>();
  private tujuanJalan = new Map<number, THREE.Vector3[]>();
  private bahanLantai = new Map<string, THREE.Material>();
  private waktuStaf = 0;
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
    this.rencanaStaf = [];
    this.bahanLantai.clear();
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
    void this.pasangStaf(this.versiBangun);
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
    // Titik yang harus tampak: sudut gedung pada lantai ini, dan di lantai dasar juga kedai kopi di halaman.
    const W = this.denah.lebar / 2 + (tegak ? 0.3 : 1);
    const D = this.denah.panjang / 2 + (tegak ? 0.3 : 1);
    const y0 = this.dasar(lantai);
    const titik: THREE.Vector3[] = [];
    for (const x of [-W, W]) for (const z of [-D, D]) for (const y of [y0, y0 + 3]) titik.push(new THREE.Vector3(x, y, z));
    if (lantai === 1) for (const x of [4, 14.6]) for (const z of [12.6, 24.9]) titik.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 3.4, z));
    // Bingkai dihitung pada bidang layar (proyeksi sejajar), lalu dijauhkan sedikit untuk perspektif.
    const mundur = arah.clone().negate();
    const kanan = new THREE.Vector3().crossVectors(mundur, new THREE.Vector3(0, 1, 0)).normalize();
    const atas = new THREE.Vector3().crossVectors(kanan, mundur).normalize();
    let [x1, x2, y1, y2] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const t of titik) {
      x1 = Math.min(x1, t.dot(kanan));
      x2 = Math.max(x2, t.dot(kanan));
      y1 = Math.min(y1, t.dot(atas));
      y2 = Math.max(y2, t.dot(atas));
    }
    const tengah = kanan.clone().multiplyScalar((x1 + x2) / 2).add(atas.clone().multiplyScalar((y1 + y2) / 2));
    // Sasaran putar di lantai, pada garis pandang yang melewati tengah bingkai.
    const target = tengah.clone().sub(arah.clone().multiplyScalar((tengah.y - y0 - 0.4) / arah.y));
    const jarak = Math.max((x2 - x1) / 2 / Math.tan(hfov / 2), (y2 - y1) / 2 / Math.tan(vfov / 2)) * 1.12;
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
    // Staf bergerak dengan laju sekitar 30 bingkai per detik, hanya di lantai yang tampak.
    if (this.penghuni.length && this.terlihat && !this.opsi.gerakDikurangi && kini - this.waktuStaf >= 33) {
      const dt = Math.min(0.25, (kini - this.waktuStaf) / 1000);
      this.waktuStaf = kini;
      for (const { p, lantai } of this.penghuni) if (lantai === 0 || this.lantai.get(lantai)?.grup.visible) p.perbarui(dt);
      this.perluRender = true;
    }
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
    for (const d of [...[...this.lantai.values()].flatMap((l) => l.luar), ...this.potonganLuar]) {
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
    this.penghuni.forEach(({ p }) => p.buang());
    this.penghuni = [];
    this.potonganLuar = [];
    this.petaJalan.clear();
    this.tujuanJalan.clear();
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
  /** Bahan disalin per lantai agar pemudaran satu lantai tidak memengaruhi lantai lain. */
  private salinBahan(m: THREE.Material, lantai: number) {
    const kunci = `${lantai}|${m.uuid}`;
    let b = this.bahanLantai.get(kunci);
    if (!b) {
      b = m.clone();
      this.bahanLantai.set(kunci, b);
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
  }

  private async pasangModel(versi: number) {
    const salinBahan = (m: THREE.Material, lantai: number) => this.salinBahan(m, lantai);
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

  /** Ganti figur prosedural staf dengan karakter Meshy yang bergerak, begitu karakternya termuat. */
  private async pasangStaf(versi: number) {
    if (!this.rencanaStaf.length) return;
    const tBayangan = teksturBayangan();
    this.teksturDibuat.push(tBayangan);
    const bayangan = new THREE.MeshBasicMaterial({ map: tBayangan, transparent: true, depthWrite: false });
    this.materialLain.push(bayangan);
    await Promise.all(
      this.rencanaStaf.map(async ({ rencana, lantai, cadangan, varian }) => {
        const [aset, kain] = await Promise.all([
          muatStaf(rencana.nama).catch(() => null),
          varian ? muatTekstur(`staf/varian/${varian}`).catch(() => null) : null,
        ]);
        // Lantai 0 = halaman (kedai kopi), di luar grup lantai gedung.
        const induk = lantai === 0 ? this.grupLuar : this.lantai.get(lantai)?.grup;
        const peta = this.petaJalan.get(lantai);
        if (!aset || !induk || !peta || versi !== this.versiBangun) return;
        // Karakter bervarian memakai bahan sendiri dengan peta warna pakaiannya; transformasi UV disalin dari peta asal.
        const salin = (m: THREE.Material) => {
          const b = this.salinBahan(m, lantai) as THREE.MeshStandardMaterial;
          if (!kain || !b.map) return b;
          const v = b.clone();
          const t = kain.clone();
          t.offset.copy(b.map.offset);
          t.repeat.copy(b.map.repeat);
          t.center.copy(b.map.center);
          t.rotation = b.map.rotation;
          t.channel = b.map.channel;
          t.needsUpdate = true;
          v.map = t;
          this.materialLain.push(v);
          this.teksturDibuat.push(t);
          return v;
        };
        const p = new Penghuni(aset, rencana, peta, salin, this.salinBahan(bayangan, lantai), this.opsi.gerakDikurangi);
        cadangan.removeFromParent();
        induk.add(p.akar);
        this.penghuni.push({ p, lantai });
        this.minta();
      }),
    );
  }

  /**
   * Daftarkan staf di tempat kerjanya. Koordinat dalam bingkai ruangan L (−Z ke arah pintu); `hadap`
   * mengikuti figur prosedural (menghadap −Z pada 0). Figur prosedural tampil sampai karakternya termuat.
   */
  private daftarStaf(
    L: THREE.Group,
    s: {
      nama: NamaStaf;
      x: number;
      z: number;
      hadap: number;
      pose: 'berdiri' | 'duduk';
      kerja: () => Aksi[];
      keluar?: [number, number][];
      /** Tujuan jalan sendiri (koordinat bingkai L), menggantikan tujuan aula lantai. */
      tujuan?: [number, number][];
      tahan?: () => boolean;
      selang?: [number, number];
      singgah?: Aksi[];
      /** Arah hadap di setiap tujuan, dengan konvensi `hadap` (menghadap −Z lokal pada 0). */
      hadapTujuan?: number[];
      /** Nama tekstur pakaian pengganti di model/staf/varian. */
      varian?: string;
      figur: Figur;
    },
  ) {
    L.updateMatrix();
    const keLantai = (x: number, z: number) => new THREE.Vector3(x, 0, z).applyMatrix4(L.matrix);
    const arah = new THREE.Vector3(-Math.sin(s.hadap), 0, -Math.cos(s.hadap)).applyAxisAngle(new THREE.Vector3(0, 1, 0), L.rotation.y);
    const cadangan = new THREE.Group();
    cadangan.position.set(s.x, 0, s.z);
    cadangan.rotation.y = s.hadap;
    cadangan.userData.slot = true;
    L.add(cadangan);
    this.orang(cadangan, 0, 0, 0, { ...s.figur, pose: s.pose });
    this.rencanaStaf.push({
      lantai: this.lantaiBangun,
      cadangan,
      varian: s.varian,
      rencana: {
        nama: s.nama,
        posisi: keLantai(s.x, s.z),
        arah: Math.atan2(arah.x, arah.z),
        pose: s.pose,
        kerja: s.kerja,
        keluar: (s.keluar ?? []).map(([x, z]) => keLantai(x, z)),
        tujuan: s.tujuan ? s.tujuan.map(([x, z]) => keLantai(x, z)) : s.keluar?.length ? (this.tujuanJalan.get(this.lantaiBangun) ?? []) : [],
        tahan: s.tahan,
        selang: s.selang,
        singgah: s.singgah,
        arahTujuan: s.hadapTujuan?.map((h) => {
          const v = new THREE.Vector3(-Math.sin(h), 0, -Math.cos(h)).applyAxisAngle(new THREE.Vector3(0, 1, 0), L.rotation.y);
          return Math.atan2(v.x, v.z);
        }),
        benih: this.rencanaStaf.length * 7 + 3,
      },
    });
  }

  /** Halangi persegi panjang denah (koordinat sketsa) di peta jalan kaki lantai yang sedang dibangun. */
  private halangiAula(x1: number, x2: number, z1: number, z2: number, tepi = 0.2) {
    const peta = this.petaJalan.get(this.lantaiBangun);
    if (!peta) return;
    const a = this.dunia(x1 - tepi, z1 - tepi);
    const b = this.dunia(x2 + tepi, z2 + tepi);
    peta.halangi(a.x, b.x, a.z, b.z);
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
    // Teras pintu cukup dalam untuk menjadi kaki tangga luar di sebelahnya.
    this.kotak(pm.lebar + 2.4, 0.16, 1.3, p.terrazzo, pintu.x, -0.08, depan + 0.9, g);
    this.kotak(pm.lebar + 3.2, 0.16, 2.0, p.terrazzo, pintu.x, -0.24, depan + 1.25, g);

    // Monumen nama gedung di pelataran.
    const tMon = teksturMonumen(this.identitas.nama, this.identitas.singkat, this.identitas.naungan, this.logo);
    this.teksturDibuat.push(tMon);
    const mukaMon = new THREE.MeshStandardMaterial({ map: tMon, roughness: 0.55, metalness: 0.1 });
    this.materialLain.push(mukaMon);
    const xMon = pintu.x - pm.lebar / 2 - 4.5;
    this.kotak(1.2, 2.4, 0.32, p.aluminium, xMon, yTanah + 1.2 + 0.25, depan + 6, g);
    this.mesh(this.catat(new THREE.PlaneGeometry(1.1, 2.2)), mukaMon, xMon, yTanah + 1.2 + 0.25, depan + 6 + 0.165, g, false);
    this.kotak(1.6, 0.25, 0.7, m.beton, xMon, yTanah + 0.125, depan + 6, g);

    // Tiang bendera Merah Putih, lazim di gedung pemerintah daerah: di sudut kiri halaman, karena sisi kanan
    // ditempati kedai kopi dan tiangnya tidak boleh menutupi tangga luar.
    const xBendera = -W / 2 - 4.5;
    const zBendera = depan + 4.5;
    this.kotak(1.4, 0.3, 1.4, m.beton, xBendera, yTanah + 0.15, zBendera, g);
    this.silinder(0.04, 0.06, 9, p.logam, xBendera, yTanah + 4.8, zBendera, g, 12);
    const merah = new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 0.8, side: THREE.DoubleSide });
    const putih = new THREE.MeshStandardMaterial({ color: '#f2f0ea', roughness: 0.8, side: THREE.DoubleSide });
    this.materialLain.push(merah, putih);
    const kain = this.catat(new THREE.PlaneGeometry(1.5, 0.5, 8, 1));
    const pos = kain.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) + 0.75) * 3.2) * 0.08 * (pos.getX(i) + 0.75));
    kain.computeVertexNormals();
    this.mesh(kain, merah, xBendera + 0.78, yTanah + 8.75, zBendera, g, false);
    this.mesh(kain, putih, xBendera + 0.78, yTanah + 8.25, zBendera, g, false);

    // Lampu jalan.
    for (const x of [-22, -6, 15, 26]) {
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
      [W / 2 + 8.5, depan + 13.5, 0.95],
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
      // Celah di depan pintu gedung dan pintu kedai kopi.
      if (Math.abs(x - pintu.x) < pm.lebar || Math.abs(x - (W / 2 + 0.2)) < 2.5) continue;
      this.bulat(1.8, 0.7, 0.9, 0.3, i % 2 ? p.daun : p.daunTua, x, yTanah + 0.35, depan + 15.6, g);
    }
    this.bangunKafe(g, p);
    this.gabung(g);
    for (const d of this.potonganLuar) this.gabung(d.grup);
  }

  /** Bata ekspos dengan nat semen, diulang sesuai ukuran bidang (satu ubin = 1,2 × 0,6 m). */
  private bahanBata(simpan: Map<string, THREE.MeshStandardMaterial>, lebar: number, tinggi: number) {
    const kunci = `${lebar.toFixed(2)}x${tinggi.toFixed(2)}`;
    let m = simpan.get(kunci);
    if (m) return m;
    let dasar = simpan.get('dasar');
    if (!dasar) {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 256;
      const g = c.getContext('2d')!;
      g.fillStyle = '#cfc6b8';
      g.fillRect(0, 0, 512, 256);
      let acak = 7;
      const r = () => ((acak = (acak * 9301 + 49297) % 233280) / 233280);
      const warna = ['#9c4f35', '#a85a3c', '#8f4630', '#b06446', '#97503a', '#a3563b'];
      // Delapan baris bata ikatan setengah: 1,2 m × 0,6 m per ubin tekstur.
      for (let b = 0; b < 8; b++) {
        const geser = b % 2 ? 32 : 0;
        for (let k = -1; k < 8; k++) {
          g.fillStyle = warna[Math.floor(r() * warna.length)];
          g.fillRect(k * 64 + geser + 2, b * 32 + 2, 60, 28);
          g.fillStyle = 'rgba(0,0,0,0.07)';
          g.fillRect(k * 64 + geser + 2, b * 32 + 24, 60, 6);
        }
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      this.teksturDibuat.push(t);
      dasar = new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 });
      simpan.set('dasar', dasar);
      this.materialLain.push(dasar);
    }
    m = dasar.clone();
    m.map = dasar.map!.clone();
    m.map.repeat.set(lebar / 1.2, tinggi / 0.6);
    m.map.needsUpdate = true;
    this.teksturDibuat.push(m.map);
    this.materialLain.push(m);
    simpan.set(kunci, m);
    return m;
  }

  /**
   * GARUDA Coffee Shop di halaman depan, sisi kanan pintu masuk: paviliun kaca berangka baja dengan dinding
   * bata ekspos, meja bar, empat meja bundar yang masing-masing dikelilingi lima kursi, dua barista,
   * tiga pramusaji, dan dua belas tamu muda. Bingkai lokal: −Z ke pintu kedai (arah jalan), +Z ke meja
   * bar (membelakangi gedung). Lantai kedai 15 cm di atas pelataran.
   */
  private bangunKafe(g: THREE.Group, p: Pustaka) {
    const W = 10.4;
    const D = 11;
    const H = 3.2;
    const T = 0.12;
    const pusat = new THREE.Vector3(this.denah.lebar / 2 + 0.2, -0.17, this.denah.panjang / 2 + 8.2);
    const K = new THREE.Group();
    K.position.copy(pusat);
    K.rotation.y = Math.PI;
    g.add(K);
    K.updateMatrix();
    // Figur cadangan memakai bahan halaman, bukan bahan lantai terakhir yang dibangun.
    this.matOrang = new Map();
    this.tambahanAktif = this.materialLain;
    const bata = new Map<string, THREE.MeshStandardMaterial>();
    const dunia = (x: number, z: number) => new THREE.Vector3(x, 0, z).applyMatrix4(K.matrix);
    const normal = (x: number, z: number) => new THREE.Vector3(x, 0, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), K.rotation.y);

    // Alas beton, teras kecil di depan pintu, dan lantai papan kayu.
    this.kotak(W + 0.3, 0.15, D + 1.3, p.beton, 0, -0.075, -0.5, K);
    this.bidangLantai(W, D, p.lantaiKayu, 0, 0.003, 0, K);
    this.bidangLantai(W + 0.3, 1.0, p.terrazzo, 0, 0.003, -D / 2 - 0.65, K);

    // Peta jalan pramusaji dan barista: sejajar sumbu dunia, karena kedai hanya diputar setengah putaran.
    const peta = new PetaJalan(W, D, pusat.x, pusat.z);
    this.petaJalan.set(0, peta);
    const halangi = (x1: number, x2: number, z1: number, z2: number, tepi = 0.1) => {
      const a = dunia(x1 - tepi, z1 - tepi);
      const b = dunia(x2 + tepi, z2 + tepi);
      peta.halangi(a.x, b.x, a.z, b.z);
    };

    // ——— Dinding: kaca berangka baja menghadap jalan dan pelataran, bata ekspos di sisi bar ———
    const sisi = [
      { n: [0, -1], panjang: W, kaca: true, titik: (u: number, k: number) => [u - W / 2, -D / 2 - k] },
      { n: [0, 1], panjang: W, kaca: false, titik: (u: number, k: number) => [u - W / 2, D / 2 + k] },
      { n: [-1, 0], panjang: D, kaca: false, titik: (u: number, k: number) => [-W / 2 - k, u - D / 2] },
      { n: [1, 0], panjang: D, kaca: true, titik: (u: number, k: number) => [W / 2 + k, u - D / 2] },
    ];
    const pintu: [number, number] = [W / 2 - 0.85, W / 2 + 0.85];
    for (const [i, sd] of sisi.entries()) {
      const atas = new THREE.Group();
      atas.position.set(pusat.x, pusat.y + AMBANG, pusat.z);
      atas.rotation.y = K.rotation.y;
      this.grupLuar.add(atas);
      this.potonganLuar.push({ grup: atas, normal: normal(sd.n[0], sd.n[1]), skala: 1 });
      const sepanjangX = sd.n[1] !== 0;
      const seg = (u1: number, u2: number, a: number, b: number, m: THREE.Material, tebal = T, geser = T / 2) => {
        if (u2 - u1 < 0.01 || b - a < 0.01) return;
        const [x, z] = sd.titik((u1 + u2) / 2, geser);
        const induk = a >= AMBANG - 0.001 ? atas : K;
        const y = induk === atas ? a - AMBANG : a;
        this.kotak(sepanjangX ? u2 - u1 : tebal, b - a, sepanjangX ? tebal : u2 - u1, m, x, y + (b - a) / 2, z, induk, !m.transparent);
      };
      const L = sd.panjang;
      if (sd.kaca) {
        const celah = i === 0 ? pintu : null;
        seg(0, L, 0, 0.35, p.logamGelap, 0.1);
        const modul = L / Math.round(L / 1.35);
        for (let u = 0; u <= L + 0.001; u += modul) {
          if (celah && u > celah[0] - 0.05 && u < celah[1] + 0.05) continue;
          seg(u - 0.035, u + 0.035, 0.35, AMBANG, p.logamGelap, 0.09);
          seg(u - 0.035, u + 0.035, AMBANG, H, p.logamGelap, 0.09);
        }
        const bidang: [number, number][] = celah ? [[0, celah[0]], [celah[1], L]] : [[0, L]];
        for (const [a, b] of bidang) {
          seg(a, b, 0.35, AMBANG, p.kacaBening, 0.02);
          seg(a, b, AMBANG, H - 0.32, p.kacaBening, 0.02);
        }
        seg(0, L, 2.37, 2.43, p.logamGelap, 0.08);
        seg(0, L, H - 0.32, H, p.logamGelap, 0.16);
        if (celah) {
          // Pintu kaca ganda berkusen baja dengan gagang kuningan panjang.
          for (const u of [celah[0], celah[1]]) {
            seg(u - 0.05, u + 0.05, 0.0, AMBANG, p.logamGelap, 0.12);
            seg(u - 0.05, u + 0.05, AMBANG, 2.4, p.logamGelap, 0.12);
          }
          const tengah = (celah[0] + celah[1]) / 2;
          seg(celah[0] + 0.05, celah[1] - 0.05, 0.02, AMBANG, p.kacaBening, 0.02);
          seg(celah[0] + 0.05, celah[1] - 0.05, AMBANG, 2.37, p.kacaBening, 0.02);
          seg(celah[0], celah[1], 2.43, H - 0.32, p.kacaBening, 0.02);
          seg(tengah - 0.02, tengah + 0.02, 0.02, AMBANG, p.logamGelap, 0.05);
          seg(tengah - 0.02, tengah + 0.02, AMBANG, 2.37, p.logamGelap, 0.05);
          for (const u of [tengah - 0.12, tengah + 0.12]) seg(u - 0.015, u + 0.015, 0.7, AMBANG, p.kuningan, 0.06, -0.03);
          for (const u of [tengah - 0.12, tengah + 0.12]) seg(u - 0.015, u + 0.015, AMBANG, 1.6, p.kuningan, 0.06, -0.03);
        }
      } else {
        seg(0, L, 0, AMBANG, this.bahanBata(bata, L, AMBANG));
        seg(0, L, AMBANG, H, this.bahanBata(bata, L, H - AMBANG));
      }
      // Balok ring baja di puncak dinding.
      seg(-T, L + T, H, H + 0.16, p.logamGelap, 0.2);
    }
    // Papan nama di atas pintu, berdiri di balok depan.
    const tMerek = teksturMerekKafe();
    this.teksturDibuat.push(tMerek);
    const mMerek = new THREE.MeshStandardMaterial({ map: tMerek, roughness: 0.4, metalness: 0.25 });
    this.materialLain.push(mMerek);
    const atasDepan = this.potonganLuar[this.potonganLuar.length - 4].grup;
    this.kotak(2.5, 0.96, 0.08, p.logamGelap, 0, H + 0.62 - AMBANG, -D / 2 - 0.06, atasDepan);
    this.mesh(this.catat(new THREE.PlaneGeometry(2.4, 0.9)), mMerek, 0, H + 0.62 - AMBANG, -D / 2 - 0.101, atasDepan, false).rotation.y = Math.PI;
    // Balok atap terbuka (pergola) tempat lampu gantung, melintang di atas dua deret meja.
    const meja: [number, number][] = [
      [-2.6, -3.5],
      [2.6, -3.5],
      [-2.6, -0.1],
      [2.6, -0.1],
    ];
    for (const z of [-3.5, -0.1, 2.9]) this.kotak(W, 0.14, 0.1, p.logamGelap, 0, H + 0.08, z, K);

    // ——— Meja bar: muka kayu berlekuk, puncak terrazzo ———
    const xBar = [-W / 2, 2.6];
    const zBar = [3.2, 3.85];
    const tengahBar = (xBar[0] + xBar[1]) / 2;
    const panjangBar = xBar[1] - xBar[0];
    this.kotak(panjangBar, 1.0, zBar[1] - zBar[0], p.walnut, tengahBar, 0.5, (zBar[0] + zBar[1]) / 2, K);
    for (let x = xBar[0] + 0.06; x < xBar[1] - 0.03; x += 0.09) this.kotak(0.05, 0.86, 0.03, p.oak, x, 0.53, zBar[0] - 0.012, K);
    this.kotak(panjangBar, 0.1, 0.06, p.logamGelap, tengahBar, 0.05, zBar[0] + 0.02, K);
    this.kotak(panjangBar + 0.05, 0.05, zBar[1] - zBar[0] + 0.12, p.terrazzo, tengahBar, 1.025, (zBar[0] + zBar[1]) / 2 - 0.04, K);
    halangi(xBar[0], xBar[1], zBar[0], zBar[1]);
    // Kasir: tablet di dudukan dan laci uang.
    this.kotak(0.36, 0.08, 0.3, p.plastikHitam, -3.7, 1.09, 3.55, K);
    const tablet = this.kotak(0.26, 0.18, 0.015, p.layarMenyala, -3.7, 1.24, 3.5, K);
    tablet.rotation.x = 0.35;
    // Etalase kue: kotak kaca dua susun.
    this.kotak(1.0, 0.5, 0.5, p.kacaBening, -2.0, 1.3, 3.5, K, false);
    for (const y of [1.07, 1.3]) {
      this.kotak(0.96, 0.015, 0.46, p.logam, -2.0, y, 3.5, K);
      for (let k = 0; k < 4; k++) this.bulat(0.14, 0.07, 0.11, 0.03, [p.kardus, p.oak, p.potTerakota, p.kainPasir][(k + Math.round(y * 10)) % 4], -2.35 + k * 0.23, y + 0.045, 3.45, K);
    }
    // Gelas bawa pulang di tempat pengambilan.
    for (let k = 0; k < 3; k++) {
      this.silinder(0.045, 0.035, 0.15, p.plastikPutih, 0.8 + k * 0.17, 1.125, 3.4, K, 14);
      this.silinder(0.047, 0.042, 0.05, p.kardus, 0.8 + k * 0.17, 1.12, 3.4, K, 14);
    }

    // ——— Meja belakang bar: mesin espreso, penggiling, lemari pendingin, rak biji kopi ———
    const zBelakang = D / 2 - 0.3;
    this.kotak(W - 1.1 - 1.8, 0.9, 0.6, p.walnut, -W / 2 + 1.1 + (W - 1.1 - 1.8) / 2, 0.45, zBelakang, K);
    this.kotak(W - 1.1 - 1.8 + 0.04, 0.04, 0.64, p.terrazzo, -W / 2 + 1.1 + (W - 1.1 - 1.8) / 2, 0.92, zBelakang, K);
    halangi(-W / 2, W / 2 - 1.8, zBelakang - 0.3, D / 2);
    // Mesin espreso dua grup berlapis krom.
    this.bulat(0.8, 0.46, 0.5, 0.04, p.logam, 0.9, 1.17, zBelakang, K);
    this.kotak(0.82, 0.05, 0.36, p.logamGelap, 0.9, 0.97, zBelakang - 0.25, K);
    for (const dx of [-0.2, 0.2]) {
      this.silinder(0.05, 0.05, 0.08, p.logam, 0.9 + dx, 1.05, zBelakang - 0.28, K, 14);
      this.kotak(0.04, 0.03, 0.2, p.plastikHitam, 0.9 + dx, 1.02, zBelakang - 0.42, K);
    }
    for (let k = 0; k < 5; k++) this.silinder(0.035, 0.03, 0.06, p.keramik, 0.62 + k * 0.14, 1.43, zBelakang + 0.05, K, 12);
    // Penggiling kopi dengan corong biji.
    for (const x of [-0.15, -0.55]) {
      this.kotak(0.18, 0.36, 0.24, p.logamGelap, x, 1.12, zBelakang, K);
      this.silinder(0.1, 0.05, 0.22, p.kacaBening, x, 1.41, zBelakang, K, 14);
      this.silinder(0.085, 0.045, 0.14, p.walnut, x, 1.37, zBelakang, K, 14);
    }
    // Keran dan bak cuci, teko susu.
    this.silinder(0.015, 0.015, 0.3, p.logam, -1.5, 1.08, zBelakang + 0.15, K, 8);
    for (const x of [-1.9, -2.05]) this.silinder(0.045, 0.05, 0.12, p.logam, x, 1.0, zBelakang - 0.1, K, 12);
    // Lemari pendingin kaca di ujung meja belakang.
    const xDingin = -W / 2 + 0.55;
    this.kotak(1.0, 1.95, 0.62, p.logamGelap, xDingin, 0.975, zBelakang, K);
    this.kotak(0.86, 1.7, 0.02, p.kacaBening, xDingin, 1.0, zBelakang - 0.32, K, false);
    for (const y of [0.45, 0.95, 1.45]) {
      this.kotak(0.86, 0.02, 0.5, p.logam, xDingin, y, zBelakang, K);
      for (let k = 0; k < 5; k++) this.silinder(0.035, 0.035, 0.24, p.produk[(k + y * 4) % p.produk.length | 0], xDingin - 0.32 + k * 0.16, y + 0.13, zBelakang - 0.12, K, 10);
    }
    // Rak kayu melayang dan papan menu di dinding bata.
    for (const y of [1.55, 1.95]) {
      this.kotak(5.8, 0.04, 0.26, p.oak, -0.6, y, D / 2 - 0.13, K);
      for (let k = 0; k < 14; k++) {
        const x = -3.3 + k * 0.4;
        if (k % 3 === 0) this.silinder(0.06, 0.06, 0.2, p.kacaBening, x, y + 0.12, D / 2 - 0.13, K, 12);
        else if (k % 3 === 1) this.silinder(0.04, 0.035, 0.08, p.keramik, x, y + 0.06, D / 2 - 0.13, K, 12);
        else this.bulat(0.13, 0.2, 0.08, 0.02, p.produk[k % p.produk.length], x, y + 0.12, D / 2 - 0.13, K);
      }
    }
    const tMenu = teksturMenuKafe();
    this.teksturDibuat.push(tMenu);
    const mMenu = new THREE.MeshStandardMaterial({ map: tMenu, roughness: 0.8 });
    this.materialLain.push(mMenu);
    this.kotak(1.84, 0.94, 0.04, p.walnut, -0.6, 2.62, D / 2 - 0.02, K);
    this.mesh(this.catat(new THREE.PlaneGeometry(1.76, 0.86)), mMenu, -0.6, 2.62, D / 2 - 0.045, K, false).rotation.y = Math.PI;
    // Sudut di samping lorong barista: rak barang dagangan dan tanaman besar.
    this.bulat(1.2, 1.9, 0.4, 0.02, p.oak, W / 2 - 0.75, 0.95, D / 2 - 0.25, K);
    for (const y of [0.55, 1.05, 1.55]) this.produkDiRak(K, p, W / 2 - 1.3, W / 2 - 0.2, y, D / 2 - 0.3, Math.round(y * 5));
    this.tanaman(K, p, W / 2 - 0.6, zBar[0] + 0.3, 1.3);
    halangi(W / 2 - 1.8, W / 2, zBar[0], D / 2);

    // Neon di dinding bata samping, menghadap ruang duduk.
    const tNeon = teksturNeonKafe();
    this.teksturDibuat.push(tNeon);
    const mNeon = new THREE.MeshStandardMaterial({ map: tNeon, emissiveMap: tNeon, emissive: '#ffb36b', emissiveIntensity: 1.6, transparent: true, depthWrite: false });
    this.materialLain.push(mNeon);
    this.mesh(this.catat(new THREE.PlaneGeometry(3.6, 0.9)), mNeon, -W / 2 + 0.02, 2.1, -1.8, K, false).rotation.y = Math.PI / 2;

    // ——— Empat meja bundar, masing-masing dikelilingi lima kursi kayu ———
    const lampuMat = new THREE.MeshStandardMaterial({ color: '#fff3dc', emissive: '#ffcf8a', emissiveIntensity: 2.2 });
    this.materialLain.push(lampuMat);
    const kursiMeja: { x: number; z: number; a: number }[][] = [];
    for (const [tx, tz] of meja) {
      this.silinder(0.55, 0.55, 0.045, p.oak, tx, 0.745, tz, K, 40);
      this.silinder(0.045, 0.06, 0.72, p.logamGelap, tx, 0.36, tz, K, 14);
      this.silinder(0.26, 0.28, 0.03, p.logamGelap, tx, 0.015, tz, K, 24);
      // Celah antarkursi menghadap lorong tengah, tempat pramusaji melayani.
      const celah = tx > 0 ? -Math.PI / 2 : Math.PI / 2;
      const kursi = [];
      for (let k = 0; k < 5; k++) {
        const a = celah + Math.PI / 5 + (k * 2 * Math.PI) / 5;
        const x = tx + Math.sin(a) * 0.9;
        const z = tz + Math.cos(a) * 0.9;
        this.kursiKayu(K, p, x, z, a, p.kainPasir);
        kursi.push({ x, z, a });
      }
      kursiMeja.push(kursi);
      halangi(tx - 1.15, tx + 1.15, tz - 1.15, tz + 1.15, 0);
      // Lampu gantung rotan di atas meja.
      this.silinder(0.006, 0.006, H - 2.25, p.logamGelap, tx, (H + 2.25) / 2, tz, K, 6);
      this.silinder(0.05, 0.24, 0.24, p.kainPasir, tx, 2.13, tz, K, 20);
      this.dinamis(this.mesh(this.catat(new THREE.SphereGeometry(0.06, 12, 8)), lampuMat, tx, 2.02, tz, K, false));
    }
    // Lampu gantung di atas meja bar.
    for (const x of [-3.2, -1.2, 0.8]) {
      this.silinder(0.006, 0.006, H - 2.4, p.logamGelap, x, (H + 2.4) / 2, zBar[0] + 0.3, K, 6);
      this.silinder(0.04, 0.12, 0.18, p.logamGelap, x, 2.31, zBar[0] + 0.3, K, 16);
      this.dinamis(this.mesh(this.catat(new THREE.SphereGeometry(0.045, 10, 8)), lampuMat, x, 2.22, zBar[0] + 0.3, K, false));
    }
    // Tanaman di sudut ruang duduk dan di teras.
    for (const [x, z, s] of [
      [-W / 2 + 0.5, -D / 2 + 0.5, 1.4],
      [W / 2 - 0.5, -D / 2 + 0.5, 1.4],
      [-W / 2 + 0.5, 1.7, 1.2],
    ] as [number, number, number][]) {
      this.tanaman(K, p, x, z, s);
      halangi(x - 0.35, x + 0.35, z - 0.35, z + 0.35, 0);
    }
    for (const x of [-1.6, 1.6]) this.tanaman(K, p, x, -D / 2 - 0.65, 1.1);
    // Papan menu lipat di teras.
    // Papan menu lipat (bentuk A) di teras: dua papan kapur berbingkai kayu yang bertemu di puncak.
    for (const s of [-1, 1]) {
      const papan = this.kotak(0.55, 0.85, 0.03, p.walnut, 3.0, 0.41, -D / 2 - 0.65 + s * 0.11, K);
      papan.rotation.x = -s * 0.26;
      const muka = this.kotak(0.47, 0.72, 0.01, p.plastikHitam, 3.0, 0.42, -D / 2 - 0.65 + s * 0.127, K, false);
      muka.rotation.x = -s * 0.26;
    }

    // ——— Tamu: tiga orang di setiap meja dengan isi meja di depannya ———
    const tamu: [NamaStaf, string, number][][] = [
      [['jack', 'tamu-1', 0], ['devita', 'tamu-9', 2], ['achmad', 'tamu-3', 3]],
      [['didin', 'tamu-2', 1], ['host-wanita', 'tamu-8', 2], ['host-wanita', 'tamu-12', 4]],
      [['host-pria', 'tamu-4', 0], ['devita', 'tamu-11', 1], ['petugas-disperindag', 'tamu-5', 3]],
      [['jack', 'tamu-6', 1], ['petugas-dinkes', 'tamu-10', 3], ['achmad', 'tamu-7', 4]],
    ];
    tamu.forEach((kelompok, iMeja) => {
      const [tx, tz] = meja[iMeja];
      kelompok.forEach(([nama, varian, iKursi], j) => {
        const k = kursiMeja[iMeja][iKursi];
        this.daftarStaf(K, {
          nama,
          x: k.x,
          z: k.z,
          hadap: k.a,
          pose: 'duduk',
          kerja: () => ['duduk', 'duduk-bicara'],
          varian,
          figur: TAMU[(iMeja * 3 + j) % TAMU.length],
        });
        // Kopi panas atau es kopi susu di depan setiap tamu, ponsel di sebagian meja.
        const cx = tx + Math.sin(k.a) * 0.36;
        const cz = tz + Math.cos(k.a) * 0.36;
        if ((iMeja + j) % 2) {
          this.silinder(0.07, 0.07, 0.01, p.keramik, cx, 0.773, cz, K, 16);
          this.silinder(0.042, 0.035, 0.07, p.keramik, cx, 0.81, cz, K, 14);
        } else {
          this.silinder(0.038, 0.032, 0.15, p.kacaBening, cx, 0.843, cz, K, 14);
          this.silinder(0.034, 0.03, 0.1, p.kardus, cx, 0.82, cz, K, 14);
        }
        if ((iMeja + j) % 3 === 0) this.kotak(0.075, 0.008, 0.15, p.plastikHitam, cx + Math.cos(k.a) * 0.14, 0.772, cz - Math.sin(k.a) * 0.14, K);
      });
    });
    // Laptop terbuka di dua meja: tempat nugas dan rapat kecil.
    for (const iMeja of [0, 3]) {
      const [tx, tz] = meja[iMeja];
      const a = kursiMeja[iMeja][tamu[iMeja][0][2]].a;
      const lx = tx + Math.sin(a) * 0.12;
      const lz = tz + Math.cos(a) * 0.12;
      const alas = this.kotak(0.32, 0.012, 0.22, p.aluminium, lx, 0.775, lz, K);
      alas.rotation.y = a;
      const layar = this.kotak(0.32, 0.21, 0.008, p.layarMenyala, lx - Math.sin(a) * 0.11, 0.88, lz - Math.cos(a) * 0.11, K);
      layar.rotation.set(0, a, 0);
      layar.rotateX(-0.25);
    }

    // ——— Barista di balik meja bar ———
    const zBarista = (zBar[1] + zBelakang - 0.3) / 2;
    this.daftarStaf(K, {
      nama: 'host-pria',
      x: 0.9,
      z: zBarista,
      hadap: Math.PI,
      pose: 'berdiri',
      kerja: () => ['diam'],
      tujuan: [
        [-0.35, zBarista],
        [1.5, zBarista],
        [-2.0, zBarista],
      ],
      hadapTujuan: [Math.PI, 0, 0],
      selang: [7, 8],
      singgah: ['diam', 'bicara'],
      varian: 'barista-pria',
      figur: BARISTA[0],
    });
    this.daftarStaf(K, {
      nama: 'resepsionis-wanita',
      x: -3.7,
      z: zBarista,
      hadap: 0,
      pose: 'berdiri',
      kerja: () => ['bicara', 'diam'],
      tujuan: [
        [-2.3, zBarista],
        [-1.6, zBarista],
        [-4.0, zBarista],
      ],
      hadapTujuan: [0, Math.PI, Math.PI],
      selang: [9, 10],
      singgah: ['diam'],
      varian: 'barista-wanita',
      figur: BARISTA[1],
    });

    // ——— Pramusaji: menunggu di depan bar, lalu mengantar pesanan ke meja ———
    const layan: [number, number][] = [];
    const hadapLayan: number[] = [];
    for (const [tx, tz] of meja) {
      layan.push([Math.sign(tx) * 1.25, tz]);
      hadapLayan.push(tx > 0 ? -Math.PI / 2 : Math.PI / 2);
      if (tz > -1) {
        layan.push([tx, tz + 1.4]);
        hadapLayan.push(Math.PI);
      }
    }
    layan.push([0.9, zBar[0] - 0.45]);
    hadapLayan.push(Math.PI);
    const pramusaji: [NamaStaf, string, number, number, Aksi[]][] = [
      ['didin', 'pramusaji-1', 1.3, 2.5, ['diam']],
      ['devita', 'pramusaji-2', -1.3, 2.5, ['diam']],
      ['host-pria', 'pramusaji-3', 3.4, 1.8, ['diam', 'bicara']],
    ];
    pramusaji.forEach(([nama, varian, x, z, gerak], i) => {
      this.daftarStaf(K, {
        nama,
        x,
        z,
        hadap: 0,
        pose: 'berdiri',
        kerja: () => ['diam'],
        tujuan: layan,
        hadapTujuan: hadapLayan,
        selang: [3 + i, 5],
        singgah: gerak,
        varian,
        figur: PRAMUSAJI[i],
      });
    });

    // Tiang papan nama di pelataran, menghadap jalan dan pengunjung dari gedung.
    const tiang = new THREE.Group();
    const posTiang = dunia(W / 2 + 1.2, -D / 2 + 0.6);
    tiang.position.set(posTiang.x, -0.32, posTiang.z);
    tiang.rotation.y = -0.45;
    g.add(tiang);
    for (const x of [-1.05, 1.05]) this.kotak(0.08, 2.5, 0.08, p.logamGelap, x, 1.25, 0, tiang);
    this.kotak(2.3, 0.9, 0.1, p.logamGelap, 0, 2.05, 0, tiang);
    this.mesh(this.catat(new THREE.PlaneGeometry(2.2, 0.82)), mMerek, 0, 2.05, 0.051, tiang, false);
    this.kotak(2.6, 0.2, 0.5, p.beton, 0, 0.1, 0, tiang);
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

    // Pelat lantai: inti beton dan permukaan terrazzo. Tangga berada di luar, jadi pelat utuh.
    this.kotakDenah(0, W, 0, D, y0 - 0.3, 0.29, p.beton, statis);
    const cPelat = this.dunia(W / 2, D / 2);
    this.bidangLantai(W, D, p.terrazzo, cPelat.x, y0 - 0.005, cPelat.z, statis);

    // Peta jalan kaki: ruangan terhalang; perabot aula ditambahkan saat dipasang.
    this.petaJalan.set(n, new PetaJalan(W, D));
    for (const r of daftar) this.halangiAula(r.x, r.x + r.lebar, r.z, r.z + r.panjang);
    const tujuan: [number, number][] =
      n === 1
        ? [
            [10.6, 2.6],
            [7.75, 16.0],
            [14, 16.0],
            [11.2, 8.5],
            [6.2, 8.5],
          ]
        : [
            [9.6, 5.5],
            [9.8, 15.2],
            [13, 14.6],
            [8.2, 14.6],
            [15.6, 2.4],
          ];
    this.tujuanJalan.set(
      n,
      tujuan.filter(([x, z]) => x < W && z < D).map(([x, z]) => this.dunia(x, z, y0)),
    );

    this.bangunDindingLuar(n, daftar, p, grup, statis, luar);
    for (const r of daftar) this.bangunRuang(r, statis, grup, p, y0, lampu, tambahan);
    this.dekorasiHall(n, daftar, p, statis, y0, tambahan);
    const adaAtas = this.semuaRuang.some((r) => r.lantai > 1);
    if (n === 1 && adaAtas) this.bangunTangga(p, statis);

    // Tiang petunjuk: di kaki tangga luar (menuju lantai 2) dan di bordes, di samping pintu lantai 2.
    if (adaAtas && n <= 2) {
      const tPet = teksturPetunjukLantai(2, n === 1);
      this.teksturDibuat.push(tPet);
      const mPet = new THREE.MeshStandardMaterial({ map: tPet, roughness: 0.5 });
      tambahan.push(mPet);
      const posPet = n === 1 ? this.dunia(t.x - 0.3, -t.jarak - t.lebar + 0.15, y0) : this.dunia(t.x + t.panjang + t.bordes - 0.18, -0.3, y0);
      this.kotak(0.05, 1.9, 0.05, p.logamGelap, posPet.x, y0 + 0.95, posPet.z, statis);
      this.kotak(0.46, 0.46, 0.03, p.logamGelap, posPet.x, y0 + 1.65, posPet.z + 0.03, statis, false);
      this.mesh(this.catat(new THREE.PlaneGeometry(0.42, 0.42)), mPet, posPet.x, y0 + 1.65, posPet.z + 0.046, statis, false);
    }

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
        // Fasad kaca: modul 1,5 m, pintu kaca ganda di lantai dasar dan pintu tunggal ke bordes tangga di lantai 2.
        const pintu = n === 1 ? [pm.x, pm.x + pm.lebar] : n === 2 ? this.pintuAtas() : null;
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
          segmen(pintu[0] + 0.05, pintu[1] - 0.05, 0.05, 2.36, p.kacaBening, atas, 0.02, 0.06);
          if (n > 1) {
            // Pintu tunggal ke bordes, dengan kanopi kaca kecil di atasnya.
            segmen(pintu[1] - 0.2, pintu[1] - 0.17, 0.9, 1.5, p.logam, atas, 0.08, 0.02);
            const kp = this.dunia(tengah, -0.55);
            this.kotak(pintu[1] - pintu[0] + 0.7, 0.06, 1.1, p.aluminium, kp.x, 2.6 - AMBANG, kp.z, atas);
            this.kotak(pintu[1] - pintu[0] + 0.6, 0.02, 1.0, p.kacaBening, kp.x, 2.64 - AMBANG, kp.z, atas, false);
          }
        }
        if (pintu && n === 1) {
          const tengah = (pintu[0] + pintu[1]) / 2;
          segmen(tengah - 0.02, tengah + 0.02, 0.05, 2.36, p.aluminium, atas, 0.06, 0.06);
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

  /** Bentang pintu kaca lantai 2 (sumbu x denah) yang membuka ke bordes tangga luar. */
  private pintuAtas(): [number, number] {
    const t = this.denah.tangga;
    const awal = t.x + t.panjang + 0.35;
    return [awal, Math.min(awal + 1.2, this.denah.lebar - 0.2)];
  }

  /**
   * Tangga luar baja di kiri pintu masuk: injakan beton pracetak tanpa tegakan di atas dua balok
   * ibu baja, pagar kaca berpegangan baja di kedua sisi, dan bordes bertiang di depan pintu lantai 2.
   * Kaki tangga di teras pintu masuk (setinggi lantai 1), jadi seluruh ukuran relatif lantai 1.
   */
  private bangunTangga(p: Pustaka, statis: THREE.Group) {
    const t = this.denah.tangga;
    const H = this.denah.tinggi;
    const anak = Math.round(H / 0.18);
    const naik = H / anak;
    const injak = t.panjang / anak;
    const zDalam = -t.jarak;
    const zLuar = -t.jarak - t.lebar;
    const zTengah = (zDalam + zLuar) / 2;
    const xBordes = t.x + t.panjang;
    const xUjung = xBordes + t.bordes;
    const yTanah = -0.32;
    const miring = Math.atan2(H, t.panjang);
    const panjangMiring = Math.hypot(t.panjang, H);
    const xTengah = t.x + t.panjang / 2;

    // Injakan: anak tangga terakhir sudah berupa bordes.
    for (let i = 0; i < anak - 1; i++) {
      const c = this.dunia(t.x + (i + 0.5) * injak, zTengah);
      this.kotak(injak + 0.03, 0.06, t.lebar, p.terrazzo, c.x, naik * (i + 1) - 0.03, c.z, statis);
      // Lis antislip gelap di hidung injakan.
      const hidung = this.dunia(t.x + i * injak + 0.04, zTengah);
      this.kotak(0.04, 0.005, t.lebar - 0.1, p.logamGelap, hidung.x, naik * (i + 1) + 0.003, hidung.z, statis, false);
    }
    // Dua balok ibu baja miring di bawah injakan. Sumbu panjang kotak = x dunia, yang naik ke arah −x.
    for (const z of [zDalam - 0.04, zLuar + 0.04]) {
      const c = this.dunia(xTengah, z);
      const balok = this.kotak(panjangMiring, 0.3, 0.06, p.logamGelap, c.x, H / 2 - 0.12, c.z, statis);
      balok.rotation.z = -miring;
    }
    // Bordes: pelat beton menempel fasad, ditopang tiang baja bundar.
    const cb = this.dunia((xBordes - injak + xUjung) / 2, zLuar / 2);
    this.kotak(xUjung - xBordes + injak, 0.22, -zLuar, p.beton, cb.x, H - 0.11, cb.z, statis);
    this.bidangLantai(xUjung - xBordes + injak, -zLuar, p.terrazzo, cb.x, H + 0.003, cb.z, statis);
    const tiang: [number, number, number][] = [
      [xBordes + 0.2, zLuar + 0.15, H - 0.22],
      [xUjung - 0.2, zLuar + 0.15, H - 0.22],
      // Tiang tengah bentang di bawah balok ibu sisi luar.
      [t.x + t.panjang * 0.5, zLuar + 0.04, (t.panjang * 0.5 * H) / t.panjang - 0.3],
    ];
    for (const [x, z, atas] of tiang) {
      const c = this.dunia(x, z);
      this.silinder(0.07, 0.07, atas - yTanah, p.logamGelap, c.x, (atas + yTanah) / 2, c.z, statis, 14);
      this.kotak(0.32, 0.04, 0.32, p.beton, c.x, yTanah + 0.02, c.z, statis);
    }
    // Pagar kaca berpegangan baja: miring di kedua sisi tangga, lurus mengelilingi bordes.
    for (const z of [zDalam - 0.02, zLuar + 0.02]) {
      const c = this.dunia(xTengah, z);
      const kaca = this.kotak(panjangMiring - 0.1, 0.9, 0.02, p.kacaBening, c.x, H / 2 + 0.5, c.z, statis, false);
      kaca.rotation.z = -miring;
      const pegangan = this.kotak(panjangMiring + 0.1, 0.05, 0.05, p.logam, c.x, H / 2 + 0.97, c.z, statis);
      pegangan.rotation.z = -miring;
    }
    const pagarBordes: [number, number, number, number][] = [
      [xBordes, xUjung, zLuar + 0.02, zLuar + 0.02],
      [xUjung - 0.02, xUjung - 0.02, zLuar, -0.05],
    ];
    for (const [x1, x2, z1, z2] of pagarBordes) {
      const c = this.dunia((x1 + x2) / 2, (z1 + z2) / 2);
      const w = Math.max(0.02, x2 - x1);
      const d = Math.max(0.02, z2 - z1);
      this.kotak(w, 0.9, d, p.kacaBening, c.x, H + 0.5, c.z, statis, false);
      this.kotak(w + (x2 > x1 ? 0.05 : 0), 0.05, d + (z2 > z1 ? 0.05 : 0), p.logam, c.x, H + 0.97, c.z, statis);
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
    const m = { L, w, d, p, tambahan, buka, r, xPintu };
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
    const siaran = () => this.siaran.has(r.id);
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
    // Host berdiri di balik meja menghadap ring light. Saat siaran ia berbicara ke kamera dan tidak
    // meninggalkan studio; di luar jadwal ia sesekali keluar ke aula.
    const urut = Math.max(0, this.semuaRuang.filter((x) => x.jenis === 'studio').findIndex((x) => x.id === r.id));
    const xLorong = 1.15;
    this.daftarStaf(L, {
      nama: urut % 2 === 0 ? 'host-wanita' : 'host-pria',
      x: 0,
      z: zMeja + 0.5,
      hadap: 0,
      pose: 'berdiri',
      kerja: () => (siaran() ? ['bicara'] : ['diam', 'diam', 'bicara']),
      tahan: siaran,
      keluar: [
        [xLorong, zMeja + 0.5],
        [xLorong, -d / 2 + 0.5],
        [xLorong, -d / 2 - 0.75],
      ],
      figur: { ...HOST[urut % HOST.length], pegang: p.produk[(urut + 2) % p.produk.length] },
    });
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

  private perabotPodcast({ L, w, d, p, tambahan, r }: PerabotRuang) {
    const siaran = () => this.siaran.has(r.id);
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
      this.kursiKantor(L, p, kx, kz, a, p.kainLumut);
      // Dua pengisi podcast duduk berhadapan dan berbincang, lebih aktif saat sedang merekam.
      if (i % 2 === 0)
        this.daftarStaf(L, {
          nama: i === 0 ? 'host-pria' : 'host-wanita',
          x: kx,
          z: kz,
          hadap: a,
          pose: 'duduk',
          kerja: () => (siaran() ? ['duduk-bicara'] : ['duduk', 'duduk-bicara']),
          figur: HOST[i === 0 ? 1 : 0],
        });
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
    // Dua resepsionis berseragam PCC. Satu selalu berjaga; yang lain sesekali mengantar tamu ke aula.
    for (const [i, x] of [-0.5, 0.65].entries())
      this.daftarStaf(L, {
        nama: i === 0 ? 'resepsionis-wanita' : 'resepsionis-pria',
        x,
        z: zMeja + 0.62,
        hadap: 0,
        pose: 'berdiri',
        kerja: () => (i === 0 ? ['diam', 'bicara'] : ['diam', 'diam', 'telepon']),
        keluar:
          i === 0
            ? undefined
            : [
                [Math.sign(x) * (Math.min(w - 1.2, 3.2) / 2 + 0.35), zMeja + 0.62],
                [Math.sign(x) * (Math.min(w - 1.2, 3.2) / 2 + 0.35), -d / 2 - 0.75],
              ],
        figur: RESEPSIONIS[i],
      });
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

  private perabotTim({ L, w, d, p, tambahan, r, xPintu }: PerabotRuang) {
    // Dua klaster meja kerja berhadapan, rak buku, dan meja diskusi kecil. Staf ruangan menempati kursi
    // di sisi pintu lebih dulu, dengan papan nama di meja masing-masing.
    const lebarKlaster = Math.min(3.0, w / 2 - 0.6);
    const kursi: { x: number; z: number; sz: number; xKlaster: number }[] = [];
    for (const sx of [-1, 1]) {
      const x = sx * (w / 4 + 0.1);
      const z = 0.3;
      this.meja(L, p, x, z, lebarKlaster, 1.4, p.oak);
      this.kotak(lebarKlaster - 0.1, 0.35, 0.03, p.kainLumut, x, 0.92, z, L);
      for (const sz of [-1, 1])
        for (const ox of [-lebarKlaster / 4, lebarKlaster / 4]) {
          this.monitor(L, p, x + ox, 0.74, z + sz * 0.25, sz > 0 ? Math.PI : 0);
          this.kursiKantor(L, p, x + ox, z + sz * 1.05, sz > 0 ? 0 : Math.PI);
          kursi.push({ x: x + ox, z: z + sz * 1.05, sz, xKlaster: x });
        }
    }
    kursi.sort((a, b) => a.sz - b.sz || Math.abs(a.x - xPintu) - Math.abs(b.x - xPintu));
    const pria: NamaStaf[] = ['jack', 'didin', 'achmad'];
    let iPria = 0;
    (r.staf ?? []).slice(0, kursi.length).forEach((orang, i) => {
      const k = kursi[i];
      const nama: NamaStaf = orang.perempuan ? 'devita' : pria[iPria++ % pria.length];
      // Papan nama akrilik di tepi meja, menghadap kursinya.
      const tNama = teksturNamaMeja(orang.nama);
      this.teksturDibuat.push(tNama);
      const mNama = new THREE.MeshStandardMaterial({ map: tNama, roughness: 0.35 });
      tambahan.push(mNama);
      const zPapan = k.z - k.sz * 0.62;
      this.kotak(0.3, 0.09, 0.04, p.plastikHitam, k.x + 0.32, 0.79, zPapan, L, false);
      const muka = this.mesh(this.catat(new THREE.PlaneGeometry(0.29, 0.083)), mNama, k.x + 0.32, 0.79, zPapan + k.sz * 0.0205, L, false);
      if (k.sz > 0) muka.rotation.y = Math.PI;
      // Keluar lewat celah antarkursi di tengah klaster, lalu ke pintu.
      const zBerdiri = k.z - k.sz * 0.3;
      const zLorong = k.sz < 0 ? Math.min(k.z - 0.85, -d / 2 + 1.3) : k.z + 0.85;
      this.daftarStaf(L, {
        nama,
        x: k.x,
        z: k.z,
        hadap: k.sz > 0 ? 0 : Math.PI,
        pose: 'duduk',
        kerja: () => ['duduk', 'duduk-bicara'],
        keluar: [
          [k.xKlaster, zBerdiri],
          [k.xKlaster, zLorong],
          [xPintu, -d / 2 + 0.6],
          [xPintu, -d / 2 - 0.75],
        ],
        figur: orang.perempuan ? FIGUR_STAF[1] : FIGUR_STAF[0],
      });
    });
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
    this.kursiKantor(L, p, -0.45, zLoket + 1.15, 0);
    const dinkes = r.nama.toLowerCase().includes('dinkes');
    const xSisi = -(lebarLoket / 2 + Math.min(0.25, (w / 2 - TEBAL - lebarLoket / 2) / 2));
    this.daftarStaf(L, {
      nama: dinkes ? 'petugas-dinkes' : 'petugas-disperindag',
      x: -0.45,
      z: zLoket + 1.15,
      hadap: 0,
      pose: 'duduk',
      kerja: () => ['duduk', 'duduk-bicara'],
      keluar: [
        [xSisi, zLoket + 0.88],
        [xSisi, -d / 2 - 0.8],
      ],
      figur: dinkes ? PETUGAS[1] : PETUGAS[0],
    });
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
  private orang(L: THREE.Group, x: number, z: number, hadap: number, o: Figur & { pose: 'berdiri' | 'duduk' }): THREE.Group {
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
    const tabrak = (a: number[], b: number[]) => a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3];
    const area = [x1, x2, z1, z2];
    if (x1 < 0.3 || z1 < 0.3 || x2 > this.denah.lebar - 0.3 || z2 > this.denah.panjang - 0.3) return false;
    // Jalur masuk dari pintu tangga luar di lantai 2 dibiarkan lapang.
    const [a, b] = this.pintuAtas();
    if (n === 2 && tabrak(area, [a - 0.5, b + 0.5, 0, 1.8])) return false;
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
        this.halangiAula(xDir - 0.35, xDir + 0.35, 1.15, 1.45);
        taruh(xDir, 1.3, (c) => {
          this.kotak(0.66, 1.75, 0.1, p.logamGelap, c.x, 0.95, c.z, G);
          this.kotak(0.5, 0.08, 0.3, p.logamGelap, c.x, 0.04, c.z, G);
          this.mesh(this.catat(new THREE.PlaneGeometry(0.6, 1.5)), mDir, c.x, 1.0, c.z + 0.051, G, false);
        });
      }
      // Ruang tunggu: sofa, kursi, meja rendah, dan karpet di tengah aula.
      for (const [cx, cz] of [
        [W / 2, D / 2 - 1],
        [W / 2, D / 2 + 1.5],
        [W / 2, 5],
        [W / 2, 6],
      ]) {
        if (!this.bebas(1, cx - 2, cx + 2, cz - 1.6, cz + 1.6)) continue;
        this.halangiAula(cx - 1.75, cx + 1.75, cz - 1.45, cz + 1.45);
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
          this.halangiAula(x - 0.32, x + 0.32, z - 0.32, z + 0.32);
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
        this.halangiAula(x - 0.95, x + 0.95, z - 0.25, z + 0.25);
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
      this.halangiAula(x - 0.35, x + 0.35, z - 0.35, z + 0.35);
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
  xPintu: number;
}

/** Figur prosedural: tampil sampai karakter Meshy termuat, dan dipakai bila pemuatan gagal. */
interface Figur {
  kulit: string;
  baju: string;
  bawah: string;
  rambut?: string;
  kerudung?: string;
  pegang?: THREE.Material;
}

/** Host live dan tamu podcast: warna kulit sawo matang, busana sehari-hari yang rapi. */
const HOST: Figur[] = [
  { kulit: '#b07a52', baju: '#2f4a3c', bawah: '#2a2622', kerudung: '#d8c3a2' },
  { kulit: '#8d5a3b', baju: '#7a4527', bawah: '#2b2f33', rambut: '#17120f' },
  { kulit: '#c08b63', baju: '#e6dccb', bawah: '#3a3530', kerudung: '#7d2f2a' },
  { kulit: '#9a6644', baju: '#26405a', bawah: '#22262a', rambut: '#120e0c' },
];

/** Seragam resepsionis PCC: blazer hijau tua, satu berkerudung jingga lembaga. */
const RESEPSIONIS: Figur[] = [
  { kulit: '#b5805a', baju: '#233b30', bawah: '#1f2321', kerudung: '#e2742a' },
  { kulit: '#94603f', baju: '#233b30', bawah: '#1f2321', rambut: '#15110e' },
];

/** Staf ruang kerja (pria, wanita berkerudung). */
const FIGUR_STAF: Figur[] = [
  { kulit: '#9b6846', baju: '#1f2326', bawah: '#2c3a52', rambut: '#120e0c' },
  { kulit: '#b9845d', baju: '#e9dfcf', bawah: '#26324a', kerudung: '#c99a9a' },
];

/** Petugas loket: seragam khaki ASN untuk Disperindag, jas putih untuk Dinkes. */
const PETUGAS: Figur[] = [
  { kulit: '#9d6a47', baju: '#8b7d55', bawah: '#3b3a33', rambut: '#15110e' },
  { kulit: '#bb855e', baju: '#f1eee8', bawah: '#2d3a45', kerudung: '#3d5a7a' },
];

/** Barista GARUDA Coffee Shop: kaus hitam dan celemek kanvas. */
const BARISTA: Figur[] = [
  { kulit: '#a06b48', baju: '#1c1c1c', bawah: '#6b4a30', rambut: '#14100d' },
  { kulit: '#b9845d', baju: '#1c1c1c', bawah: '#6b4a30', rambut: '#1a1410' },
];

/** Pramusaji: kemeja hitam dan celemek, satu berkerudung marun. */
const PRAMUSAJI: Figur[] = [
  { kulit: '#98633f', baju: '#151515', bawah: '#2a2a2a', rambut: '#120e0c' },
  { kulit: '#b88660', baju: '#151515', bawah: '#2a2a2a', kerudung: '#6e1f2f' },
  { kulit: '#a7714d', baju: '#c9b08a', bawah: '#1f1f1f', rambut: '#16110e' },
];

/** Tamu muda kedai: busana sehari-hari ala Gen Z yang berbeda-beda. */
const TAMU: Figur[] = [
  { kulit: '#a87250', baju: '#b9b2dd', bawah: '#5d7894', rambut: '#120e0c' },
  { kulit: '#c08b63', baju: '#e7d3d8', bawah: '#7d95b5', kerudung: '#c9a7b9' },
  { kulit: '#8f5c3c', baju: '#4b5236', bawah: '#1d1d1d', rambut: '#15110e' },
  { kulit: '#9b6846', baju: '#bfa98a', bawah: '#6b5440', rambut: '#120e0c' },
  { kulit: '#b5805a', baju: '#8a9a86', bawah: '#e9e4da', kerudung: '#d8d2c4' },
  { kulit: '#c3906a', baju: '#c8b8e0', bawah: '#efe8f4', kerudung: '#b7a6d6' },
  { kulit: '#a06b48', baju: '#9cb9cf', bawah: '#d9cbb3', rambut: '#14100d' },
  { kulit: '#b07a52', baju: '#a7c0d6', bawah: '#f0e3d6', kerudung: '#e8c7c0' },
  { kulit: '#94603f', baju: '#1f4a45', bawah: '#151515', rambut: '#120e0c' },
  { kulit: '#8d5a3b', baju: '#ef7b1f', bawah: '#181818', rambut: '#15110e' },
  { kulit: '#bb855e', baju: '#6b4a32', bawah: '#2b2622', kerudung: '#3b2b22' },
  { kulit: '#9a6644', baju: '#1d2a44', bawah: '#7aa0c4', rambut: '#120e0c' },
];

/** Ukuran model di tempatnya: tinggi atau lebar dalam meter, serta geseran dan putaran tambahan. */
interface UkuranSlot {
  tinggi?: number;
  /** Panjang sisi datar terpanjang. */
  lebar?: number;
  geser?: THREE.Vector3;
  putar?: number;
}
