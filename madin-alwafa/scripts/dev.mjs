// Jalankan server API (dengan pemantauan berkas) dan Vite bersamaan. `--demo` memakai data contoh.
import { spawn } from 'node:child_process';

const demo = process.argv.includes('--demo');
const proses = [
  spawn('npx', ['tsx', 'watch', demo ? 'server/demo.ts' : 'server/index.ts'], { stdio: 'inherit', env: { ...process.env, WEB_DIR: 'tidak-ada' } }),
  spawn('npx', ['vite'], { stdio: 'inherit' }),
];
const hentikan = () => proses.forEach((p) => p.kill('SIGTERM'));
process.on('SIGINT', hentikan);
process.on('SIGTERM', hentikan);
proses.forEach((p) => p.on('exit', (kode) => { hentikan(); process.exitCode = kode ?? 0; }));
