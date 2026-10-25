// Model 3D hasil Meshy AI (public/model/*.glb, verteks terkuantisasi dan tekstur WebP). Dimuat setelah maket
// prosedural tampil, lalu menggantikan figur dan perabot sederhana di tempatnya. Bila sebuah model
// gagal dimuat, versi prosedural tetap dipakai sehingga maket tidak pernah kosong.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PRATINJAU } from '../lib/pratinjau';

export type NamaModel =
  | 'host-wanita'
  | 'host-pria'
  | 'resepsionis-wanita'
  | 'resepsionis-pria'
  | 'duduk-wanita'
  | 'duduk-pria'
  | 'ring-light'
  | 'softbox'
  | 'tanaman'
  | 'sofa'
  | 'pohon'
  | 'kursi-kantor'
  | 'kursi-kayu';

// Pratinjau statis memuat berkas yang diterbitkan di samping halamannya, jadi alamatnya relatif.
const ASAL = PRATINJAU ? 'model/' : '/model/';
// Tanpa dekoder WASM, dan tekstur dibaca lewat elemen gambar (img-src blob:) alih-alih fetch, agar
// tetap berjalan di bawah CSP yang ketat, termasuk pratinjau statis.
const pemuat = new GLTFLoader().register((parser) => {
  parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
  return { name: 'pcc_pemuat_tekstur' };
});
const simpanan = new Map<NamaModel, Promise<THREE.Group>>();

/**
 * Model ternormalisasi: alas di y = 0, berpusat di sumbu tegak, menghadap −Z (arah hadap kursi dan
 * figur prosedural), tinggi 1 satuan. `userData.ukuran` menyimpan proporsinya. Disimpan sekali dan
 * dipakai ulang oleh semua adegan; jangan dibuang bersama adegan.
 */
export function muatModel(nama: NamaModel): Promise<THREE.Group> {
  let janji = simpanan.get(nama);
  if (!janji) {
    janji = pemuat.loadAsync(`${ASAL}${nama}.glb`).then((gltf) => {
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
