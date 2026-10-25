// Model 3D hasil Meshy AI (public/model/*.glb, verteks terkuantisasi dan tekstur WebP). Dimuat setelah maket
// prosedural tampil, lalu menggantikan figur dan perabot sederhana di tempatnya. Bila sebuah model
// gagal dimuat, versi prosedural tetap dipakai sehingga maket tidak pernah kosong.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PRATINJAU } from '../lib/pratinjau';

export type NamaModel = 'ring-light' | 'softbox' | 'tanaman' | 'sofa' | 'pohon' | 'kursi-kantor' | 'kursi-kayu';

// Tanpa dekoder WASM, dan tekstur dibaca lewat elemen gambar (img-src blob:) alih-alih fetch, agar
// tetap berjalan di bawah CSP yang ketat, termasuk pratinjau statis.
const pemuat = new GLTFLoader().register((parser) => {
  parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
  return { name: 'pcc_pemuat_tekstur' };
});

// Pratinjau statis memuat berkas yang diterbitkan di samping halamannya: alamatnya relatif, dan
// berupa JSON berisi GLB base64 karena tempat terbitnya tidak menyajikan .glb.
export async function muatBerkas(berkas: string) {
  if (!PRATINJAU) return pemuat.loadAsync(`/model/${berkas}.glb`);
  const { glb } = (await (await fetch(`model/${berkas}.json`)).json()) as { glb: string };
  return pemuat.parseAsync(Uint8Array.from(atob(glb), (c) => c.charCodeAt(0)).buffer, '');
}

const simpanan = new Map<NamaModel, Promise<THREE.Group>>();

/**
 * Model ternormalisasi: alas di y = 0, berpusat di sumbu tegak, menghadap −Z (arah hadap kursi dan
 * figur prosedural), tinggi 1 satuan. `userData.ukuran` menyimpan proporsinya. Disimpan sekali dan
 * dipakai ulang oleh semua adegan; jangan dibuang bersama adegan.
 */
export function muatModel(nama: NamaModel): Promise<THREE.Group> {
  let janji = simpanan.get(nama);
  if (!janji) {
    janji = muatBerkas(nama).then((gltf) => {
      const akar = gltf.scene;
      const kotak = new THREE.Box3().setFromObject(akar);
      const ukuran = kotak.getSize(new THREE.Vector3());
      const pusat = kotak.getCenter(new THREE.Vector3());
      akar.position.sub(new THREE.Vector3(pusat.x, kotak.min.y, pusat.z));
      akar.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
      });
      // Model Meshy menghadap +Z; putar agar menghadap −Z.
      const putar = new THREE.Group();
      putar.rotation.y = Math.PI;
      putar.add(akar);
      const wadah = new THREE.Group();
      wadah.add(putar);
      wadah.scale.setScalar(1 / ukuran.y);
      wadah.userData.ukuran = ukuran.divideScalar(ukuran.y);
      return wadah;
    });
    janji.catch(() => simpanan.delete(nama));
    simpanan.set(nama, janji);
  }
  return janji;
}

const pemuatGambar = new THREE.TextureLoader();
const simpananTekstur = new Map<string, Promise<THREE.Texture>>();

/**
 * Tekstur pakaian pengganti (WebP) untuk karakter berkerangka. Hasil retekstur Meshy memakai UV asli
 * karakter dasarnya, jadi cukup menukar peta warnanya. Disimpan sekali dan dipakai ulang.
 */
export function muatTekstur(berkas: string): Promise<THREE.Texture> {
  let janji = simpananTekstur.get(berkas);
  if (!janji) {
    janji = pemuatGambar.loadAsync(`${PRATINJAU ? '' : '/'}model/${berkas}.webp`).then((t) => {
      t.flipY = false;
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
    janji.catch(() => simpananTekstur.delete(berkas));
    simpananTekstur.set(berkas, janji);
  }
  return janji;
}
