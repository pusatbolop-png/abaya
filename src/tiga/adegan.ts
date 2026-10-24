import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buatPustaka, semuaMaterial, type Pustaka } from './material';
import { siapkanHuruf, teksturInlay, teksturMonumen, teksturOnAir, teksturPapanNama, teksturPetunjukLantai } from './signage';

export interface DataRuang {
  id: number;
  kode: string;
  nama: string;
  jenis: string;
  lantai: number;
  x: number;
  z: number;
  lebar: number;
  panjang: number;
  kapasitas: number | null;
}

export interface Identitas {
  nama: string;
  singkat: string;
  naungan: string;
}

export interface OpsiAdegan {
  ringan: boolean;
  gerakDikurangi: boolean;
  saatPilih: (id: number | null) => void;
  saatArah: (id: number | null) => void;
  saatIntroSelesai: () => void;
}

const PELAT = { lebar: 24, panjang: 16, tinggi: 3.4 };
const TINGGI_DINDING = 2.8;
const TEBAL = 0.1;
const KORIDOR_Z = 8; // garis tengah koridor
const TANGGA = { x: 22, z: 9, lebar: 2, panjang: 7 };
const PINTU_MASUK = { x1: 11.25, x2: 13.75 };

const wx = (x: number) => x - PELAT.lebar / 2;
const wz = (z: number) => z - PELAT.panjang / 2;
const dasarLantai = (n: number) => (n - 1) * PELAT.tinggi;

type Kurva = (t: number) => number;
const halus: Kurva = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const keluar: Kurva = (t) => 1 - Math.pow(1 - t, 3);

interface Tween {
  mulai: number;
  lama: number;
  kurva: Kurva;
  jalan: (t: number) => void;
  selesai?: () => void;
}

interface DataLantai {
  grup: THREE.Group;
  pustaka: Pustaka;
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
  pusat: THREE.Vector3;
}

function skalaUvKotak(g: THREE.BoxGeometry, w: number, h: number, d: number, ubin: number) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const ukuran = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * ukuran[f][0]) / ubin, (uv.getY(k) * ukuran[f][1]) / ubin);
    }
  }
  uv.needsUpdate = true;
}

const UBIN = new Map<string, number>();

export class AdeganGedung {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private kamera: THREE.PerspectiveCamera;
  private kendali: OrbitControls;
  private lantai = new Map<number, DataLantai>();
  private ruang = new Map<number, DataRuangMesh>();
  private tween: Tween[] = [];
  private perluRender = true;
  private bingkai = 0;
  private lantaiAktif = 1;
  private dipilih: number | null = null;
  private diarah: number | null = null;
  private raycaster = new THREE.Raycaster();
  private penunjuk = new THREE.Vector2();
  private tekan: { x: number; y: number } | null = null;
  private introBerjalan = false;
  /** Setelah pengguna memutar kamera, ukuran ulang kanvas tidak lagi mengatur ulang sudut pandang. */
  private disentuh = false;
  private introSelesaiFn: (() => void) | null = null;
  private teksturDibuat: THREE.Texture[] = [];
  private geometriDibuat: THREE.BufferGeometry[] = [];
  private amati: ResizeObserver;
  private terlihat = true;
  private pengamatLayar: IntersectionObserver;
  private matahari: THREE.DirectionalLight;
  private identitas: Identitas = { nama: 'Pasuruan Creative Center', singkat: 'PCC', naungan: '' };
  private siaran = new Set<number>();
  private grupLuar = new THREE.Group();
  /** Material di luar mekanisme pudar lantai: pelataran dan sorotan ruang. */
  private materialLain: THREE.Material[] = [];

  constructor(
    private kanvas: HTMLCanvasElement,
    private opsi: OpsiAdegan,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opsi.ringan ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;

    const latar = new THREE.Color('#171b18');
    this.scene.background = latar;
    this.scene.fog = new THREE.Fog(latar, 55, 120);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.32;
    pmrem.dispose();

    this.kamera = new THREE.PerspectiveCamera(34, 1, 0.1, 300);
    this.kamera.position.set(-20, 26, 32);
    this.kendali = new OrbitControls(this.kamera, kanvas);
    this.kendali.target.set(0, 0.6, 0);
    this.kendali.enableDamping = true;
    this.kendali.dampingFactor = 0.08;
    this.kendali.minDistance = 9;
    this.kendali.maxDistance = 80;
    this.kendali.minPolarAngle = 0.32;
    this.kendali.maxPolarAngle = 1.3;
    this.kendali.screenSpacePanning = true;
    this.kendali.zoomToCursor = true;
    this.kendali.addEventListener('change', () => this.minta());
    this.kendali.update();

    // Cahaya: matahari sore yang hangat dan langit lembut; ruang dalam diterangi lampu masing-masing.
    this.scene.add(new THREE.HemisphereLight('#f3ead9', '#1b1f1c', 0.75));
    this.matahari = new THREE.DirectionalLight('#ffd9b4', 2.4);
    this.matahari.position.set(-20, 30, 22);
    this.matahari.castShadow = true;
    this.matahari.shadow.mapSize.set(opsi.ringan ? 1024 : 2048, opsi.ringan ? 1024 : 2048);
    const sc = this.matahari.shadow.camera;
    sc.left = -22;
    sc.right = 22;
    sc.top = 22;
    sc.bottom = -22;
    sc.near = 5;
    sc.far = 90;
    this.matahari.shadow.bias = -0.0004;
    this.matahari.shadow.normalBias = 0.03;
    this.matahari.shadow.radius = 3;
    this.scene.add(this.matahari, this.matahari.target);
    const isi = new THREE.DirectionalLight('#c9d4cf', 0.35);
    isi.position.set(24, 14, -18);
    this.scene.add(isi);

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

  /** Posisi kamera awal yang memuat seluruh pelat lantai sesuai rasio layar. */
  private posisiAwal(lantai = this.lantaiAktif) {
    // Layar tegak: sudut lebih tinggi dan lebih frontal agar denah memenuhi lebar layar.
    const tegak = this.kamera.aspect < 0.9;
    const arah = (tegak ? new THREE.Vector3(-0.22, 0.95, 0.5) : new THREE.Vector3(-0.5, 0.62, 0.8)).normalize();
    const vfov = THREE.MathUtils.degToRad(this.kamera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.kamera.aspect);
    const radius = tegak ? 12.6 : 13.5;
    const jarak = radius / Math.sin(Math.min(vfov, hfov) / 2);
    const target = new THREE.Vector3(0.6, dasarLantai(lantai) + 0.4, 0.8);
    return { posisi: target.clone().add(arah.multiplyScalar(THREE.MathUtils.clamp(jarak, 30, 74))), target };
  }

  // ——— API publik ———

  async bangun(ruang: DataRuang[], identitas: Identitas) {
    await siapkanHuruf();
    this.identitas = identitas;
    this.bersihkanBangunan();
    this.bangunLuar();
    const nomorLantai = [...new Set([1, 2, ...ruang.map((r) => r.lantai)])].sort();
    for (const n of nomorLantai) this.bangunLantai(n, ruang.filter((r) => r.lantai === n));
    this.terapkanSiaran();
    this.aturVisibilitasLantai(true);
    this.renderer.shadowMap.needsUpdate = true;
    this.minta();
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
    if (id !== null && fokus) {
      const r = this.ruang.get(id);
      if (!r) return;
      if (r.data.lantai !== this.lantaiAktif) {
        this.lantaiAktif = r.data.lantai;
        this.aturVisibilitasLantai(false);
      }
      const arah = this.kamera.position.clone().sub(this.kendali.target).normalize();
      const jarak = THREE.MathUtils.clamp(Math.max(r.data.lebar, r.data.panjang) * 2.4, 14, 26);
      const target = r.pusat.clone().setY(dasarLantai(r.data.lantai) + 0.6);
      this.geserKamera(target.clone().add(arah.multiplyScalar(jarak)), target, 800);
    }
  }

  tampilanAwal() {
    const a = this.posisiAwal();
    this.geserKamera(a.posisi, a.target, 800);
  }

  /** Momen pembuka: dari pintu masuk menyapu naik ke seluruh ruangan. Hanya sekali dan bisa dilewati. */
  mulaiIntro(selesai: () => void) {
    this.introSelesaiFn = selesai;
    if (this.opsi.gerakDikurangi) {
      this.akhiriIntro();
      return;
    }
    this.introBerjalan = true;
    this.kendali.enabled = false;
    // Berdiri di pelataran menghadap fasad dan monumen nama, melangkah ke pintu, lalu naik melihat seluruh lantai.
    const titik = [
      new THREE.Vector3(wx(9.5), 1.7, wz(34)),
      new THREE.Vector3(wx(11.5), 1.8, wz(27)),
      new THREE.Vector3(wx(12.5), 3.2, wz(22.5)),
      new THREE.Vector3(wx(6), 11, wz(28)),
      this.posisiAwal(1).posisi,
    ];
    const lintasan = new THREE.CatmullRomCurve3(titik, false, 'centripetal');
    const sasaran = [
      new THREE.Vector3(wx(10), 1.6, wz(17)),
      new THREE.Vector3(wx(12.5), 1.5, wz(12)),
      new THREE.Vector3(wx(12), 0.8, wz(6)),
      this.posisiAwal(1).target,
    ];
    const lintasSasaran = new THREE.CatmullRomCurve3(sasaran, false, 'centripetal');
    this.kamera.position.copy(titik[0]);
    this.kendali.target.copy(sasaran[0]);
    this.kamera.lookAt(sasaran[0]);
    this.tween.push({
      mulai: performance.now() + 350,
      lama: Number(import.meta.env.VITE_PEMBUKA_MS) || 7000,
      kurva: halus,
      jalan: (t) => {
        this.kamera.position.copy(lintasan.getPoint(t));
        this.kendali.target.copy(lintasSasaran.getPoint(t));
        this.kamera.lookAt(this.kendali.target);
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
    this.akhiriIntro();
  }

  hancurkan() {
    cancelAnimationFrame(this.bingkai);
    this.amati.disconnect();
    this.pengamatLayar.disconnect();
    this.kanvas.removeEventListener('pointerdown', this.saatTekan);
    this.kanvas.removeEventListener('pointermove', this.saatGerak);
    this.kanvas.removeEventListener('pointerup', this.saatLepas);
    this.kanvas.removeEventListener('pointerleave', this.saatKeluar);
    this.bersihkanBangunan();
    this.kendali.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
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
    const id = this.ambilRuang(e);
    this.opsi.saatPilih(id);
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
    this.bingkai = requestAnimationFrame(this.putar);
    const kini = performance.now();
    if (this.tween.length) {
      this.perluRender = true;
      this.tween = this.tween.filter((tw) => {
        if (kini < tw.mulai) return true;
        const t = Math.min(1, (kini - tw.mulai) / tw.lama);
        tw.jalan(tw.kurva(t));
        if (t >= 1) {
          tw.selesai?.();
          return false;
        }
        return true;
      });
    }
    if (!this.introBerjalan) this.kendali.update();
    this.perbaruiPotongan();
    if (this.perluRender && this.terlihat) {
      this.perluRender = false;
      this.renderer.render(this.scene, this.kamera);
    }
  };

  private ukurUlang() {
    const induk = this.kanvas.parentElement ?? this.kanvas;
    const l = Math.max(1, induk.clientWidth);
    const t = Math.max(1, induk.clientHeight);
    this.renderer.setSize(l, t, false);
    this.kamera.aspect = l / t;
    // Layar sempit: lensa sedikit lebih lebar agar seluruh lantai tetap terlihat.
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
    const durasi = this.opsi.gerakDikurangi ? 1 : lama;
    this.tween = this.tween.filter((t) => !(t as Tween & { kamera?: boolean }).kamera);
    const tw: Tween & { kamera?: boolean } = {
      mulai: performance.now(),
      lama: durasi,
      kurva: keluar,
      kamera: true,
      jalan: (t) => {
        this.kamera.position.lerpVectors(p0, posisi, t);
        this.kendali.target.lerpVectors(t0, target, t);
      },
    };
    this.tween.push(tw);
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

  /** Dinding luar yang menghadap kamera diturunkan, seperti maket potongan arsitek. */
  private perbaruiPotongan() {
    const arah = new THREE.Vector3().subVectors(this.kamera.position, this.kendali.target).setY(0).normalize();
    let berubah = false;
    for (const l of this.lantai.values()) {
      for (const d of l.luar) {
        // Setinggi mata (momen pembuka) fasad tidak dipotong: pengunjung melihat menembus kaca.
        const menghadap = d.normal.dot(arah) > 0.28 && this.kamera.position.y - d.grup.position.y > 4.5;
        const tujuan = menghadap ? 0.26 : 1;
        if (Math.abs(d.skala - tujuan) > 0.002) {
          d.skala += (tujuan - d.skala) * 0.16;
          if (Math.abs(d.skala - tujuan) < 0.003) d.skala = tujuan;
          d.grup.scale.y = d.skala;
          berubah = true;
        }
      }
    }
    if (berubah) {
      this.renderer.shadowMap.needsUpdate = true;
      this.minta();
    }
  }

  private perbaruiSorot() {
    for (const [id, r] of this.ruang) {
      const m = r.sorot.material as THREE.MeshStandardMaterial;
      const target = id === this.dipilih ? 0.42 : id === this.diarah ? 0.2 : this.siaran.has(id) ? 0.22 : 0;
      m.opacity = target;
      m.emissiveIntensity = target * 1.6;
      r.sorot.visible = target > 0;
    }
    this.minta();
  }

  private terapkanSiaran() {
    for (const [id, r] of this.ruang) {
      const nyala = this.siaran.has(id);
      if (r.onAir) {
        r.onAir.mesh.material = nyala ? r.onAir.nyala : r.onAir.mati;
        r.onAir.cahaya.visible = nyala && r.data.lantai === this.lantaiAktif;
      }
      if (r.ringLight) r.ringLight.emissiveIntensity = nyala ? 3.2 : 0.15;
    }
    this.perbaruiSorot();
  }

  private aturVisibilitasLantai(langsung: boolean) {
    for (const [n, l] of this.lantai) {
      const tampak = n <= this.lantaiAktif ? 1 : 0;
      for (const lampu of l.lampu) lampu.visible = n === this.lantaiAktif;
      for (const r of this.ruang.values()) if (r.onAir && r.data.lantai === n) r.onAir.cahaya.visible = n === this.lantaiAktif && this.siaran.has(r.data.id);
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
            this.renderer.shadowMap.needsUpdate = true;
          },
        });
      }
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.minta();
  }

  // ——— Pembangunan ———

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

  private kotak(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, induk: THREE.Object3D, bayang = true, skalaUv = true) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (skalaUv) skalaUvKotak(g, w, h, d, UBIN.get(m.uuid) ?? 2);
    this.geometriDibuat.push(g);
    const mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = bayang;
    mesh.receiveShadow = true;
    induk.add(mesh);
    return mesh;
  }

  private silinder(rAtas: number, rBawah: number, h: number, m: THREE.Material, x: number, y: number, z: number, induk: THREE.Object3D, segmen = 24) {
    const g = new THREE.CylinderGeometry(rAtas, rBawah, h, segmen);
    this.geometriDibuat.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    induk.add(mesh);
    return mesh;
  }

  private daftarkanUbin(p: Pustaka) {
    UBIN.set(p.terrazzo.uuid, 3);
    UBIN.set(p.walnut.uuid, 1.4);
    UBIN.set(p.walnutMuda.uuid, 1.4);
    UBIN.set(p.kainHutan.uuid, 0.8);
    UBIN.set(p.kainLumut.uuid, 0.8);
    UBIN.set(p.kainPasir.uuid, 0.8);
    UBIN.set(p.plester.uuid, 3);
    UBIN.set(p.beton.uuid, 4);
    UBIN.set(p.betonLuar.uuid, 6);
    UBIN.set(p.logam.uuid, 0.6);
    UBIN.set(p.logamGelap.uuid, 0.6);
    UBIN.set(p.kuningan.uuid, 0.6);
  }

  private bangunLuar() {
    const p = buatPustaka(this.opsi.ringan);
    this.daftarkanUbin(p);
    const g = this.grupLuar;
    // Pelataran: beton gelap luas dan jalur masuk terrazzo.
    this.kotak(140, 0.3, 140, p.betonLuar, 0, -0.45, 0, g, false).castShadow = false;
    this.kotak(PELAT.lebar + 6, 0.12, 9, p.beton, 0, -0.24, wz(PELAT.panjang) + 4.8, g, false);
    this.kotak(3.2, 0.06, 4.6, p.terrazzo, wx(12.5), -0.15, wz(PELAT.panjang) + 2.6, g, false);

    // Monumen nama gedung.
    const tMon = teksturMonumen(this.identitas.nama, this.identitas.singkat, this.identitas.naungan);
    this.teksturDibuat.push(tMon);
    const sisiMon = new THREE.MeshStandardMaterial({ color: '#1f2a24', roughness: 0.6, metalness: 0.2 });
    const mukaMon = new THREE.MeshStandardMaterial({ map: tMon, roughness: 0.55, metalness: 0.15 });
    const gMon = new THREE.BoxGeometry(1.1, 2.2, 0.28);
    this.geometriDibuat.push(gMon);
    const mon = new THREE.Mesh(gMon, [sisiMon, sisiMon, sisiMon, sisiMon, mukaMon, sisiMon]);
    mon.position.set(wx(7.4), 1.0, wz(PELAT.panjang) + 4.2);
    mon.rotation.y = 0.18;
    mon.castShadow = true;
    g.add(mon);
    this.kotak(1.3, 0.12, 0.48, p.beton, wx(7.4), -0.12, wz(PELAT.panjang) + 4.2, g).rotation.y = 0.18;

    // Pohon peneduh, tafsiran ringan tegakan Kebun Raya Purwodadi.
    const pohon = [
      [-17, 4],
      [-16, -6],
      [17.5, -4],
      [18, 6.5],
      [-6, 14.5],
      [9.5, 15],
      [-15, 13],
    ];
    const gDaun = new THREE.IcosahedronGeometry(1, 1);
    this.geometriDibuat.push(gDaun);
    pohon.forEach(([x, z], i) => {
      const tinggi = 3.2 + (i % 3) * 0.6;
      this.silinder(0.09, 0.13, tinggi, p.walnut, x, tinggi / 2 - 0.3, z, g, 8);
      for (let k = 0; k < 3; k++) {
        const daun = new THREE.Mesh(gDaun, k % 2 ? p.daunTua : p.daun);
        const s = 1.25 - k * 0.22;
        daun.scale.set(s * 1.3, s * 0.85, s * 1.3);
        daun.position.set(x + Math.sin(i + k * 2) * 0.5, tinggi - 0.2 + k * 0.55, z + Math.cos(i + k) * 0.5);
        daun.castShadow = true;
        g.add(daun);
      }
    });
    this.materialLain.push(...semuaMaterial(p), sisiMon, mukaMon);
  }

  private bangunLantai(n: number, daftar: DataRuang[]) {
    const p = buatPustaka(this.opsi.ringan);
    this.daftarkanUbin(p);
    const grup = new THREE.Group();
    const y0 = dasarLantai(n);
    const tambahan: THREE.Material[] = [];
    const lampu: THREE.PointLight[] = [];
    const luar: DataLantai['luar'] = [];

    // Pelat lantai. Lantai atas berlubang di atas tangga.
    if (n === 1) {
      this.kotak(PELAT.lebar + 0.4, 0.3, PELAT.panjang + 0.4, p.terrazzo, 0, y0 - 0.15, 0, grup);
    } else {
      const lTangga = TANGGA.lebar;
      this.kotak(PELAT.lebar - lTangga + 0.2, 0.3, PELAT.panjang + 0.4, p.terrazzo, wx((PELAT.lebar - lTangga) / 2) - 0.1, y0 - 0.15, 0, grup);
      this.kotak(lTangga + 0.2, 0.3, TANGGA.z + 0.2, p.terrazzo, wx(PELAT.lebar - lTangga / 2) + 0.1, y0 - 0.15, wz(TANGGA.z / 2) - 0.1, grup);
      // Pagar void tangga.
      const kacaPagar = p.kacaBening;
      this.kotak(0.02, 1.0, TANGGA.panjang, kacaPagar, wx(TANGGA.x) + 0.02, y0 + 0.5, wz(TANGGA.z + TANGGA.panjang / 2), grup, false);
      this.kotak(0.06, 0.05, TANGGA.panjang, p.logam, wx(TANGGA.x) + 0.02, y0 + 1.02, wz(TANGGA.z + TANGGA.panjang / 2), grup);
    }

    // Dinding luar per sisi, dikelompokkan agar bisa dipotong saat menghadap kamera.
    const tinggiLuar = PELAT.tinggi - 0.3;
    const sisi = (normal: THREE.Vector3) => {
      const g = new THREE.Group();
      g.position.y = y0;
      grup.add(g);
      luar.push({ grup: g, normal, skala: 1 });
      return g;
    };
    const utara = sisi(new THREE.Vector3(0, 0, -1));
    this.kotak(PELAT.lebar + 0.4, tinggiLuar, 0.2, p.plester, 0, tinggiLuar / 2, wz(0) - 0.1, utara);
    const barat = sisi(new THREE.Vector3(-1, 0, 0));
    this.kotak(0.2, tinggiLuar, PELAT.panjang, p.plester, wx(0) - 0.1, tinggiLuar / 2, 0, barat);
    const timur = sisi(new THREE.Vector3(1, 0, 0));
    this.kotak(0.2, tinggiLuar, PELAT.panjang, p.plester, wx(PELAT.lebar) + 0.1, tinggiLuar / 2, 0, timur);
    // Fasad depan: dinding kaca dengan sirip walnut vertikal.
    const selatan = sisi(new THREE.Vector3(0, 0, 1));
    const zDepan = wz(PELAT.panjang) + 0.08;
    for (let x = 0; x <= PELAT.lebar + 0.01; x += 1.5) {
      const diPintu = n === 1 && x > PINTU_MASUK.x1 && x < PINTU_MASUK.x2;
      if (!diPintu) this.kotak(0.08, tinggiLuar, 0.32, p.walnut, wx(x), tinggiLuar / 2, zDepan + 0.1, selatan);
    }
    const segKaca = n === 1 ? [[0, PINTU_MASUK.x1], [PINTU_MASUK.x2, PELAT.lebar]] : [[0, PELAT.lebar]];
    for (const [a, b] of segKaca) this.kotak(b - a, tinggiLuar - 0.12, 0.03, p.kacaBening, wx((a + b) / 2), (tinggiLuar - 0.12) / 2, zDepan, selatan, false);
    this.kotak(PELAT.lebar + 0.4, 0.14, 0.34, p.logamGelap, 0, tinggiLuar - 0.07, zDepan + 0.1, selatan);

    // Ruangan.
    for (const r of daftar) this.bangunRuang(r, grup, p, y0, lampu, tambahan);

    // Tangga dan petunjuk lantai.
    if (n === 1) this.bangunTangga(grup, p, y0);
    const tPet = teksturPetunjukLantai(n);
    this.teksturDibuat.push(tPet);
    const mPet = new THREE.MeshStandardMaterial({ map: tPet, roughness: 0.5 });
    tambahan.push(mPet);
    const gPet = new THREE.PlaneGeometry(0.5, 0.5);
    this.geometriDibuat.push(gPet);
    const pet = new THREE.Mesh(gPet, mPet);
    pet.position.set(wx(TANGGA.x) - 0.06, y0 + 1.7, wz(TANGGA.z + 0.6));
    pet.rotation.y = -Math.PI / 2;
    grup.add(pet);

    this.scene.add(grup);
    const material = [...semuaMaterial(p).filter((m) => m !== p.sorot), ...tambahan];
    const asli = new Map<THREE.Material, { opacity: number; transparent: boolean; depthWrite: boolean }>();
    material.forEach((m) => asli.set(m, { opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite }));
    this.lantai.set(n, { grup, pustaka: p, material, asli, lampu, luar, terlihat: 1 });
  }

  private bangunTangga(grup: THREE.Group, p: Pustaka, y0: number) {
    const anak = 20;
    const naik = PELAT.tinggi / anak;
    const injak = (TANGGA.panjang - 0.4) / anak;
    for (let i = 0; i < anak; i++) {
      const z = TANGGA.z + TANGGA.panjang - 0.2 - (i + 0.5) * injak;
      this.kotak(TANGGA.lebar - 0.3, naik, injak + 0.01, p.walnut, wx(TANGGA.x + TANGGA.lebar / 2) + 0.05, y0 + naik * (i + 0.5), wz(z), grup);
    }
    // Pegangan tangan logam.
    const panjang = Math.hypot(TANGGA.panjang - 0.4, PELAT.tinggi);
    const sudut = Math.atan2(PELAT.tinggi, TANGGA.panjang - 0.4);
    const pegangan = this.kotak(0.05, 0.05, panjang, p.logam, wx(TANGGA.x) + 0.15, y0 + PELAT.tinggi / 2 + 0.95, wz(TANGGA.z + TANGGA.panjang / 2), grup);
    pegangan.rotation.x = sudut;
  }

  private bangunRuang(r: DataRuang, induk: THREE.Group, p: Pustaka, y0: number, lampu: THREE.PointLight[], tambahan: THREE.Material[]) {
    const g = new THREE.Group();
    induk.add(g);
    const x1 = r.x;
    const x2 = r.x + r.lebar;
    const z1 = r.z;
    const z2 = r.z + r.panjang;
    const cx = wx((x1 + x2) / 2);
    const cz = wz((z1 + z2) / 2);

    // Lantai ruang: material sesuai fungsi, juga bidang sasaran klik.
    const matLantai: Record<string, THREE.Material> = {
      studio: p.walnut,
      gudang: p.beton,
      kontrol: p.walnut,
      rapat: p.walnutMuda,
      kerja: p.walnutMuda,
    };
    const gLantai = new THREE.PlaneGeometry(r.lebar - 0.1, r.panjang - 0.1);
    const ubin = UBIN.get((matLantai[r.jenis] ?? p.terrazzo).uuid) ?? 2;
    const uv = gLantai.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * r.lebar) / ubin, (uv.getY(i) * r.panjang) / ubin);
    this.geometriDibuat.push(gLantai);
    const lantai = new THREE.Mesh(gLantai, matLantai[r.jenis] ?? p.terrazzo);
    lantai.rotation.x = -Math.PI / 2;
    lantai.position.set(cx, y0 + 0.004, cz);
    lantai.receiveShadow = true;
    lantai.userData.ruangId = r.id;
    g.add(lantai);

    const sorotMat = p.sorot.clone();
    this.materialLain.push(sorotMat);
    const sorot = new THREE.Mesh(gLantai, sorotMat);
    sorot.rotation.x = -Math.PI / 2;
    sorot.position.set(cx, y0 + 0.012, cz);
    sorot.visible = false;
    sorot.renderOrder = 2;
    g.add(sorot);

    // Sisi pintu: sisi yang paling dekat ke koridor.
    const pintuDiSelatan = Math.abs(z2 - KORIDOR_Z) < Math.abs(z1 - KORIDOR_Z);
    const zPintu = pintuDiSelatan ? z2 : z1;
    const arahKoridor = pintuDiSelatan ? 1 : -1;
    const lebarPintu = r.jenis === 'gudang' ? 1.8 : r.jenis === 'galeri' ? 2.6 : 1.0;
    const pusatPintu = r.jenis === 'galeri' || r.jenis === 'gudang' ? (x1 + x2) / 2 : x1 + Math.min(1.4, r.lebar / 3);

    const dindingMat: THREE.Material =
      r.jenis === 'studio' ? p.kainHutan : r.jenis === 'kontrol' ? p.kainLumut : p.plester;
    const sisiKoridorMat: THREE.Material =
      r.jenis === 'galeri' ? p.kacaBening : r.jenis === 'kurasi' || r.jenis === 'rapat' || r.jenis === 'kontrol' ? p.kacaBuram : dindingMat;
    const kaca = sisiKoridorMat === p.kacaBening || sisiKoridorMat === p.kacaBuram;
    const H = TINGGI_DINDING;

    const dindingX = (xa: number, xb: number, z: number, m: THREE.Material, tinggi = H, yb = 0) => {
      if (xb - xa < 0.05) return;
      this.kotak(xb - xa, tinggi, TEBAL, m, wx((xa + xb) / 2), y0 + yb + tinggi / 2, wz(z), g, !(m === p.kacaBening || m === p.kacaBuram));
    };
    const dindingZ = (za: number, zb: number, x: number, m: THREE.Material) => {
      if (zb - za < 0.05) return;
      this.kotak(TEBAL, H, zb - za, m, wx(x), y0 + H / 2, wz((za + zb) / 2), g);
    };
    const inset = TEBAL / 2;
    const tepi = (v: number, batas: number) => Math.abs(v - batas) < 0.01;

    // Sisi samping (sepanjang z).
    if (!tepi(x1, 0)) dindingZ(z1 + inset, z2 - inset, x1 + inset, dindingMat);
    if (!tepi(x2, PELAT.lebar)) dindingZ(z1 + inset, z2 - inset, x2 - inset, dindingMat);
    // Sisi belakang (jauh dari koridor).
    const zBelakang = pintuDiSelatan ? z1 : z2;
    if (!tepi(zBelakang, 0) && !tepi(zBelakang, PELAT.panjang)) dindingX(x1 + inset, x2 - inset, zBelakang + (pintuDiSelatan ? inset : -inset), dindingMat);

    // Sisi koridor dengan bukaan pintu. Lobi terbuka penuh ke koridor.
    const zK = zPintu - arahKoridor * inset;
    const p1 = pusatPintu - lebarPintu / 2;
    const p2 = pusatPintu + lebarPintu / 2;
    if (r.jenis !== 'lobi') {
      dindingX(x1 + inset, p1, zK, sisiKoridorMat);
      dindingX(p2, x2 - inset, zK, sisiKoridorMat);
      dindingX(p1, p2, zK, kaca ? p.logamGelap : dindingMat, 0.5, 2.3);
      if (kaca) {
        // Rangka logam tipis untuk dinding kaca.
        this.kotak(r.lebar - 0.1, 0.05, 0.12, p.logamGelap, cx, y0 + H - 0.025, wz(zK), g);
        this.kotak(r.lebar - 0.1, 0.05, 0.12, p.logamGelap, cx, y0 + 0.025, wz(zK), g);
        for (const xm of [x1 + 0.08, p1, p2, x2 - 0.08]) this.kotak(0.05, H, 0.12, p.logamGelap, wx(xm), y0 + H / 2, wz(zK), g);
      }
      if (r.jenis === 'studio') {
        // Daun pintu walnut tertutup rapat untuk menjaga kedap suara.
        this.kotak(lebarPintu - 0.04, 2.26, 0.06, p.walnut, wx(pusatPintu), y0 + 1.13, wz(zK), g);
        this.kotak(0.03, 0.4, 0.03, p.logam, wx(p2 - 0.12), y0 + 1.05, wz(zK + arahKoridor * 0.05), g);
      }
    }

    // Papan nama di dinding koridor, di samping pintu.
    if (r.jenis !== 'lobi') {
      const tPapan = teksturPapanNama(r.kode, r.nama);
      this.teksturDibuat.push(tPapan);
      const mPapan = new THREE.MeshStandardMaterial({ map: tPapan, roughness: 0.42, metalness: 0.25 });
      tambahan.push(mPapan);
      const xPapan = p2 + 0.42;
      const papan = this.kotak(0.52, 0.2, 0.02, p.logamGelap, wx(Math.min(xPapan, x2 - 0.4)), y0 + 1.55, wz(zK + arahKoridor * 0.07), g, false, false);
      papan.material = [p.logamGelap, p.logamGelap, p.logamGelap, p.logamGelap, arahKoridor > 0 ? mPapan : p.logamGelap, arahKoridor < 0 ? mPapan : p.logamGelap];
    }

    // Huruf kuningan tanam di ambang pintu, terbaca dari koridor.
    const tInlay = teksturInlay(r.kode, r.nama);
    this.teksturDibuat.push(tInlay);
    const mInlay = new THREE.MeshStandardMaterial({ color: '#c79566', metalness: 0.9, roughness: 0.3, alphaMap: tInlay, transparent: true, depthWrite: false });
    tambahan.push(mInlay);
    const lebarInlay = Math.min(2.2, r.lebar - 0.6);
    const gInlay = new THREE.PlaneGeometry(lebarInlay, lebarInlay / 4);
    this.geometriDibuat.push(gInlay);
    const inlay = new THREE.Mesh(gInlay, mInlay);
    inlay.rotation.x = -Math.PI / 2;
    // Terbaca dari arah orang datang: koridor, atau pintu masuk utama untuk lobi.
    if (!pintuDiSelatan && r.jenis !== 'lobi') inlay.rotation.z = Math.PI;
    const zInlay = r.jenis === 'lobi' ? z2 - 1.2 : zPintu - arahKoridor * 0.75;
    const xInlay = r.jenis === 'lobi' ? (x1 + x2) / 2 : Math.min(Math.max(pusatPintu + lebarInlay / 2 - 0.5, x1 + lebarInlay / 2 + 0.3), x2 - lebarInlay / 2 - 0.3);
    inlay.position.set(wx(xInlay), y0 + 0.01, wz(zInlay));
    inlay.renderOrder = 3;
    g.add(inlay);

    // ON AIR di atas pintu studio.
    let onAir: DataRuangMesh['onAir'];
    let ringLight: THREE.MeshStandardMaterial | undefined;
    if (r.jenis === 'studio') {
      const tMati = teksturOnAir(false);
      const tNyala = teksturOnAir(true);
      this.teksturDibuat.push(tMati, tNyala);
      const mati = new THREE.MeshStandardMaterial({ map: tMati, roughness: 0.25, metalness: 0.2 });
      const nyala = new THREE.MeshStandardMaterial({ map: tNyala, emissive: '#ffffff', emissiveMap: tNyala, emissiveIntensity: 1.25, roughness: 0.3 });
      tambahan.push(mati, nyala);
      const gOn = new THREE.PlaneGeometry(0.62, 0.194);
      this.geometriDibuat.push(gOn);
      this.kotak(0.68, 0.24, 0.08, p.logamGelap, wx(pusatPintu), y0 + 2.52, wz(zK + arahKoridor * 0.09), g, false);
      const mesh = new THREE.Mesh(gOn, mati);
      mesh.position.set(wx(pusatPintu), y0 + 2.52, wz(zK + arahKoridor * 0.135));
      if (arahKoridor < 0) mesh.rotation.y = Math.PI;
      g.add(mesh);
      const cahaya = new THREE.PointLight('#ff9a5c', 6, 6, 2);
      cahaya.position.set(wx(pusatPintu), y0 + 2.3, wz(zK + arahKoridor * 0.6));
      cahaya.visible = false;
      g.add(cahaya);
      onAir = { mesh, nyala, mati, cahaya };
      ringLight = this.perabotStudio(r, g, p, y0, pintuDiSelatan, tambahan);
    } else {
      this.perabot(r, g, p, y0, pintuDiSelatan);
    }

    // Lampu gantung linear dan cahaya ruang yang hangat.
    if (r.jenis !== 'gudang') {
      const panjangLampu = Math.min(r.lebar - 1.4, 3.2);
      this.kotak(panjangLampu, 0.05, 0.12, p.lampu, cx, y0 + 2.62, cz, g, false);
    }
    if (!this.opsi.ringan || r.jenis === 'studio' || r.jenis === 'lobi') {
      const l = new THREE.PointLight(r.jenis === 'gudang' ? '#f2efe6' : '#ffd3a3', r.jenis === 'lobi' || r.jenis === 'galeri' ? 26 : 18, Math.max(r.lebar, r.panjang) * 1.15, 1.6);
      l.position.set(cx, y0 + 2.45, cz);
      g.add(l);
      lampu.push(l);
    }

    this.ruang.set(r.id, { data: r, lantai, sorot, onAir, ringLight, pusat: new THREE.Vector3(cx, y0, cz) });
  }

  private perabotStudio(r: DataRuang, g: THREE.Group, p: Pustaka, y0: number, pintuDiSelatan: boolean, tambahan: THREE.Material[]) {
    const x1 = r.x;
    const x2 = r.x + r.lebar;
    const cx = (x1 + x2) / 2;
    const belakang = pintuDiSelatan ? r.z + 0.35 : r.z + r.panjang - 0.35;
    const maju = pintuDiSelatan ? 1 : -1;
    // Dinding latar: panel bilah walnut dengan kain pasir.
    for (let i = 0; i < 9; i++) {
      this.kotak(0.06, 2.4, 0.06, p.walnut, wx(cx - 1.6 + i * 0.4), y0 + 1.25, wz(belakang), g);
    }
    this.kotak(3.4, 2.4, 0.04, p.kainPasir, wx(cx), y0 + 1.25, wz(belakang - maju * 0.05), g);
    // Meja produk walnut dengan kaki logam.
    const zMeja = belakang + maju * 1.6;
    this.kotak(2.2, 0.06, 0.8, p.walnut, wx(cx), y0 + 0.92, wz(zMeja), g);
    for (const dx of [-1, 1]) this.kotak(0.04, 0.9, 0.7, p.logamGelap, wx(cx + dx * 1.0), y0 + 0.45, wz(zMeja), g);
    for (let i = 0; i < 4; i++) {
      const m = p.produk[(r.id + i) % p.produk.length];
      if (i % 2) this.silinder(0.07, 0.07, 0.2, m, wx(cx - 0.7 + i * 0.45), y0 + 1.05, wz(zMeja), g, 16);
      else this.kotak(0.18, 0.24, 0.12, m, wx(cx - 0.7 + i * 0.45), y0 + 1.07, wz(zMeja), g);
    }
    // Ring light di tiang logam, menghadap meja.
    const zRing = zMeja + maju * 1.6;
    this.silinder(0.015, 0.015, 1.6, p.logam, wx(cx), y0 + 0.8, wz(zRing), g, 8);
    this.silinder(0.25, 0.3, 0.03, p.logamGelap, wx(cx), y0 + 0.015, wz(zRing), g, 20);
    const ringMat = new THREE.MeshStandardMaterial({ color: '#fdf6ec', emissive: '#fff1de', emissiveIntensity: 0.15, roughness: 0.4 });
    tambahan.push(ringMat);
    const gRing = new THREE.TorusGeometry(0.3, 0.025, 10, 48);
    this.geometriDibuat.push(gRing);
    const ring = new THREE.Mesh(gRing, ringMat);
    ring.position.set(wx(cx), y0 + 1.62, wz(zRing));
    g.add(ring);
    // Lampu softbox di kedua sisi.
    for (const dx of [-1.9, 1.9]) {
      const xs = cx + dx;
      if (xs < x1 + 0.4 || xs > x2 - 0.4) continue;
      this.silinder(0.012, 0.012, 1.9, p.logam, wx(xs), y0 + 0.95, wz(zMeja + maju * 0.8), g, 6);
      const box = this.kotak(0.55, 0.55, 0.12, p.lampu, wx(xs), y0 + 1.95, wz(zMeja + maju * 0.8), g, false);
      box.rotation.y = dx < 0 ? 0.6 : -0.6;
    }
    // Kursi host.
    this.kotak(0.5, 0.06, 0.5, p.kainLumut, wx(cx), y0 + 0.5, wz(zMeja + maju * 0.75), g);
    this.silinder(0.03, 0.03, 0.45, p.logam, wx(cx), y0 + 0.24, wz(zMeja + maju * 0.75), g, 8);
    return ringMat;
  }

  private perabot(r: DataRuang, g: THREE.Group, p: Pustaka, y0: number, pintuDiSelatan: boolean) {
    const x1 = r.x;
    const x2 = r.x + r.lebar;
    const z1 = r.z;
    const z2 = r.z + r.panjang;
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const tanaman = (x: number, z: number, s = 1) => {
      this.silinder(0.22 * s, 0.17 * s, 0.45 * s, p.beton, wx(x), y0 + 0.225 * s, wz(z), g, 16);
      const gDaun = new THREE.IcosahedronGeometry(0.42 * s, 1);
      this.geometriDibuat.push(gDaun);
      for (let i = 0; i < 3; i++) {
        const d = new THREE.Mesh(gDaun, i % 2 ? p.daunTua : p.daun);
        d.position.set(wx(x) + Math.sin(i * 2.1) * 0.16 * s, y0 + (0.75 + i * 0.22) * s, wz(z) + Math.cos(i * 2.1) * 0.16 * s);
        d.scale.set(1, 0.8, 1);
        d.castShadow = true;
        g.add(d);
      }
    };
    const kursi = (x: number, z: number, m: THREE.Material = p.kainLumut) => {
      this.kotak(0.46, 0.06, 0.46, m, wx(x), y0 + 0.46, wz(z), g);
      this.kotak(0.04, 0.44, 0.04, p.logamGelap, wx(x), y0 + 0.22, wz(z), g);
    };

    switch (r.jenis) {
      case 'galeri': {
        // Alas pamer walnut berpuncak terrazzo, dan rak dinding.
        const kol = Math.max(2, Math.floor((r.lebar - 2) / 2.2));
        for (let i = 0; i < kol; i++) {
          for (let j = 0; j < 2; j++) {
            const x = x1 + 1.6 + i * ((r.lebar - 3.2) / Math.max(1, kol - 1));
            const z = z1 + 2.2 + j * 2.4;
            const h = 0.75 + ((i + j) % 3) * 0.15;
            this.kotak(0.7, h, 0.7, p.walnut, wx(x), y0 + h / 2, wz(z), g);
            this.kotak(0.74, 0.04, 0.74, p.terrazzo, wx(x), y0 + h + 0.02, wz(z), g);
            const m = p.produk[(i * 2 + j) % p.produk.length];
            if ((i + j) % 2) this.silinder(0.09, 0.11, 0.26, m, wx(x), y0 + h + 0.17, wz(z), g, 18);
            else this.kotak(0.22, 0.28, 0.16, m, wx(x), y0 + h + 0.18, wz(z), g);
          }
        }
        const zRak = pintuDiSelatan ? z1 + 0.3 : z2 - 0.3;
        for (let k = 0; k < 3; k++) this.kotak(r.lebar - 1.6, 0.04, 0.32, p.walnut, wx(cx), y0 + 0.9 + k * 0.5, wz(zRak), g);
        for (let k = 0; k < 10; k++) {
          const m = p.produk[k % p.produk.length];
          this.kotak(0.16, 0.22, 0.14, m, wx(x1 + 1.2 + k * ((r.lebar - 2.4) / 9)), y0 + 1.04 + (k % 3) * 0.5, wz(zRak), g);
        }
        tanaman(x2 - 0.7, pintuDiSelatan ? z2 - 0.8 : z1 + 0.8, 1.2);
        break;
      }
      case 'lobi': {
        // Meja resepsionis melengkung dari walnut dengan bibir kuningan.
        const gMeja = new THREE.CylinderGeometry(1.6, 1.6, 1.05, 40, 1, false, Math.PI * 0.15, Math.PI * 0.7);
        this.geometriDibuat.push(gMeja);
        const meja = new THREE.Mesh(gMeja, p.walnut);
        meja.position.set(wx(cx), y0 + 0.525, wz(z1 + 2.4));
        meja.rotation.y = Math.PI;
        meja.castShadow = meja.receiveShadow = true;
        g.add(meja);
        const gBibir = new THREE.TorusGeometry(1.6, 0.02, 6, 40, Math.PI * 0.7);
        this.geometriDibuat.push(gBibir);
        const bibir = new THREE.Mesh(gBibir, p.kuningan);
        bibir.rotation.x = Math.PI / 2;
        bibir.rotation.z = Math.PI * 0.15 + Math.PI;
        bibir.position.set(wx(cx), y0 + 1.06, wz(z1 + 2.4));
        g.add(bibir);
        // Sofa tunggu dan meja rendah.
        const zSofa = z2 - 2.4;
        this.kotak(2.4, 0.42, 0.85, p.kainLumut, wx(x1 + 1.8), y0 + 0.21, wz(zSofa), g);
        this.kotak(2.4, 0.4, 0.2, p.kainLumut, wx(x1 + 1.8), y0 + 0.6, wz(zSofa - 0.35), g);
        this.silinder(0.42, 0.42, 0.38, p.terrazzo, wx(x1 + 1.8), y0 + 0.19, wz(zSofa + 1.0), g, 32);
        tanaman(x2 - 0.8, z2 - 1.2, 1.4);
        tanaman(x1 + 0.6, z1 + 0.8, 1.1);
        break;
      }
      case 'gudang': {
        // Rak logam berisi kardus konsinyasi.
        const baris = Math.floor((r.panjang - 2) / 1.6);
        for (let j = 0; j < baris; j++) {
          const z = z1 + 1.0 + j * 1.6;
          const lebarRak = r.lebar - 2.2;
          for (let k = 0; k < 4; k++) this.kotak(lebarRak, 0.03, 0.6, p.logam, wx(cx + 0.4), y0 + 0.15 + k * 0.6, wz(z), g);
          for (const dx of [-lebarRak / 2, lebarRak / 2]) this.kotak(0.04, 2.1, 0.6, p.logamGelap, wx(cx + 0.4 + dx), y0 + 1.05, wz(z), g);
          for (let k = 0; k < 4; k++) {
            for (let i = 0; i < Math.floor(lebarRak / 0.55); i++) {
              if ((i * 7 + k * 3 + j) % 5 === 0) continue;
              const h = 0.3 + ((i + k) % 3) * 0.06;
              this.kotak(0.46, h, 0.5, p.kardus, wx(cx + 0.4 - lebarRak / 2 + 0.3 + i * 0.55), y0 + 0.17 + k * 0.6 + h / 2, wz(z), g);
            }
          }
        }
        break;
      }
      case 'kurasi':
      case 'rapat': {
        const panjangMeja = Math.min(r.lebar - 2.4, 4.2);
        this.kotak(panjangMeja, 0.06, 1.2, p.walnut, wx(cx), y0 + 0.75, wz(cz), g);
        for (const dx of [-0.42, 0.42]) this.kotak(0.06, 0.72, 0.9, p.logamGelap, wx(cx + dx * panjangMeja), y0 + 0.36, wz(cz), g);
        const jumlah = Math.max(2, Math.floor(panjangMeja / 0.8));
        for (let i = 0; i < jumlah; i++) {
          const x = cx - panjangMeja / 2 + 0.4 + i * ((panjangMeja - 0.8) / Math.max(1, jumlah - 1));
          kursi(x, cz - 0.95);
          kursi(x, cz + 0.95);
        }
        if (r.jenis === 'kurasi') {
          for (let i = 0; i < 5; i++) this.kotak(0.16, 0.2, 0.12, p.produk[i], wx(cx - 1 + i * 0.5), y0 + 0.88, wz(cz + 0.1), g);
        } else {
          this.kotak(2.2, 1.25, 0.05, p.layar, wx(cx), y0 + 1.5, wz(pintuDiSelatan ? z1 + 0.15 : z2 - 0.15), g, false);
        }
        tanaman(x2 - 0.7, pintuDiSelatan ? z1 + 0.7 : z2 - 0.7);
        break;
      }
      case 'kontrol': {
        const zMeja = pintuDiSelatan ? z1 + 1.2 : z2 - 1.2;
        this.kotak(r.lebar - 0.8, 0.06, 0.8, p.walnut, wx(cx), y0 + 0.75, wz(zMeja), g);
        this.kotak(r.lebar - 0.8, 0.7, 0.05, p.logamGelap, wx(cx), y0 + 0.37, wz(zMeja - (pintuDiSelatan ? 0.35 : -0.35)), g);
        for (let i = 0; i < 3; i++) {
          const layar = this.kotak(0.72, 0.42, 0.03, p.layar, wx(cx - 0.9 + i * 0.9), y0 + 1.12, wz(zMeja - (pintuDiSelatan ? 0.2 : -0.2)), g, false);
          layar.rotation.y = (i - 1) * 0.25 * (pintuDiSelatan ? -1 : 1);
        }
        kursi(cx - 0.6, zMeja + (pintuDiSelatan ? 0.9 : -0.9));
        kursi(cx + 0.6, zMeja + (pintuDiSelatan ? 0.9 : -0.9));
        break;
      }
      case 'kerja': {
        const kolom = Math.floor((r.lebar - 1.6) / 2.4);
        for (let i = 0; i < kolom; i++) {
          for (let j = 0; j < 2; j++) {
            const x = x1 + 1.6 + i * 2.4;
            const z = z1 + 2.0 + j * 2.8;
            this.kotak(1.8, 0.05, 0.9, p.walnutMuda, wx(x), y0 + 0.74, wz(z), g);
            this.kotak(0.04, 0.72, 0.8, p.logamGelap, wx(x - 0.85), y0 + 0.36, wz(z), g);
            this.kotak(0.04, 0.72, 0.8, p.logamGelap, wx(x + 0.85), y0 + 0.36, wz(z), g);
            kursi(x - 0.4, z + 0.75);
            kursi(x + 0.4, z - 0.75);
            this.kotak(0.4, 0.28, 0.02, p.layar, wx(x - 0.4), y0 + 0.92, wz(z - 0.15), g, false);
          }
        }
        tanaman(x2 - 0.8, z2 - 0.8, 1.3);
        tanaman(x1 + 0.7, z1 + 0.7, 1.1);
        break;
      }
      default:
        break;
    }
  }
}
