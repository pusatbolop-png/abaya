#!/usr/bin/env bash
# Perbarui aplikasi ke versi terbaru dari GitHub, tanpa menyentuh data.
#   sudo bash deploy/perbarui.sh
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ "$(id -u)" -eq 0 ] || { echo "Jalankan dengan sudo."; exit 1; }
cd "$APP_DIR"
echo "▶ Mencadangkan data dulu"
bash deploy/cadangan.sh
echo "▶ Mengambil versi terbaru"
git pull --ff-only
echo "▶ Membangun ulang"
npm ci --no-audit --no-fund
npm run build
chmod -R a+rX "$APP_DIR"
systemctl restart madin-alwafa
sleep 2
systemctl is-active --quiet madin-alwafa && echo "✓ Selesai. Aplikasi berjalan dengan versi terbaru." || { journalctl -u madin-alwafa -n 40 --no-pager; exit 1; }
