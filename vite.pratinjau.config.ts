// Bangunan pratinjau: satu berkas HTML mandiri berisi aplikasi, maket 3D, huruf, dan rekaman data demo.
// Dipanggil oleh scripts/pratinjau.mjs, yang lebih dulu merekam data dari server demo.
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rekaman = path.resolve(process.env.PCC_REKAMAN ?? 'dist/pratinjau/rekaman.json');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'pratinjau',
      enforce: 'pre',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) =>
          html.replace('/src/main.tsx', '/src/pratinjau/main.tsx').replace(/\s*<link rel="(preload|icon|apple-touch-icon)"[^>]*>/g, ''),
      },
      // Huruf dan lambang dirujuk dari public/ dengan alamat mutlak; ubah ke berkas agar ikut disematkan.
      transform: (kode, id) => {
        if (id.endsWith('tokens.css')) return kode.replaceAll("url('/fonts/", "url('../../public/fonts/");
        if (id.endsWith('.tsx') && kode.includes("'/merek/lambang-pcc.png'"))
          return `import __lambang from '/public/merek/lambang-pcc.png?inline';\n` + kode.replaceAll("'/merek/lambang-pcc.png'", '__lambang');
      },
    },
  ],
  resolve: { alias: { 'virtual:rekaman': rekaman } },
  publicDir: false,
  build: {
    outDir: 'dist/pratinjau/vite',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
