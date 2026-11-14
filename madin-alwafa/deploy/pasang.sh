#!/usr/bin/env bash
# Pasang Madin Al Wafa’ di VPS Ubuntu/Debian dengan satu perintah.
#
#   sudo bash deploy/pasang.sh madin.alwafa.sch.id admin@contoh.com   # dengan domain + HTTPS otomatis
#   sudo bash deploy/pasang.sh                                        # tanpa domain: http://IP-VPS:3012
#
# Aman dijalankan ulang. Data tersimpan di /var/lib/madin-alwafa dan tidak pernah dihapus skrip ini.
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
PORT="${PORT:-3012}"
DATA_DIR="/var/lib/madin-alwafa"
CADANGAN_DIR="/var/backups/madin-alwafa"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PENGGUNA="madin"

info() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
gagal() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || gagal "Jalankan dengan sudo: sudo bash deploy/pasang.sh ..."
command -v apt-get >/dev/null || gagal "Skrip ini untuk Ubuntu/Debian (butuh apt-get)."
[ -f "$APP_DIR/package.json" ] || gagal "Tidak menemukan aplikasi di $APP_DIR"

info "Memasang paket dasar"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates git sqlite3 build-essential python3 >/dev/null

info "Zona waktu server: Asia/Jakarta (WIB)"
timedatectl set-timezone Asia/Jakarta 2>/dev/null || ln -sf /usr/share/zoneinfo/Asia/Jakarta /etc/localtime

NODE_MAYOR=$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)
if [ "${NODE_MAYOR:-0}" -lt 20 ]; then
  info "Memasang Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "Node.js $(node -v)"

info "Membuat pengguna sistem dan folder data"
id "$PENGGUNA" >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin "$PENGGUNA"
mkdir -p "$DATA_DIR" "$CADANGAN_DIR"
chown -R "$PENGGUNA:$PENGGUNA" "$DATA_DIR"
chmod 750 "$DATA_DIR" "$CADANGAN_DIR"

info "Memasang dependensi dan membangun aplikasi (beberapa menit)"
cd "$APP_DIR"
npm ci --no-audit --no-fund
npm run build
chmod -R a+rX "$APP_DIR"

if [ -n "$DOMAIN" ]; then HOST_DENGAR="127.0.0.1"; else HOST_DENGAR="0.0.0.0"; fi

info "Membuat layanan madin-alwafa (hidup otomatis saat VPS menyala)"
cat > /etc/systemd/system/madin-alwafa.service <<UNIT
[Unit]
Description=Madin Al Wafa' - sistem informasi madrasah
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=HOST=$HOST_DENGAR
Environment=DATA_DIR=$DATA_DIR
Environment=TRUST_PROXY=$([ -n "$DOMAIN" ] && echo 1 || echo 0)
ExecStart=$(command -v node) dist/server/index.js
Restart=always
RestartSec=3
User=$PENGGUNA
Group=$PENGGUNA
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now madin-alwafa >/dev/null
systemctl restart madin-alwafa

if [ -n "$DOMAIN" ]; then
  info "Memasang Caddy untuk HTTPS otomatis di https://$DOMAIN"
  if ! command -v caddy >/dev/null; then
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https gnupg >/dev/null
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq && apt-get install -y -qq caddy >/dev/null
  fi
  {
    [ -n "$EMAIL" ] && printf '{\n\temail %s\n}\n\n' "$EMAIL"
    printf '%s {\n\tencode zstd gzip\n\treverse_proxy 127.0.0.1:%s\n}\n' "$DOMAIN" "$PORT"
  } > /etc/caddy/Caddyfile
  systemctl enable --now caddy >/dev/null
  systemctl reload caddy || systemctl restart caddy
fi

info "Cadangan otomatis setiap hari pukul 02.30 WIB (disimpan 30 hari)"
cat > /etc/cron.d/madin-alwafa <<CRON
SHELL=/bin/bash
30 2 * * * root bash $APP_DIR/deploy/cadangan.sh >> /var/log/madin-alwafa-cadangan.log 2>&1
CRON
chmod 644 /etc/cron.d/madin-alwafa

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  info "Membuka port di firewall"
  ufw allow OpenSSH >/dev/null
  if [ -n "$DOMAIN" ]; then ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; else ufw allow "$PORT"/tcp >/dev/null; fi
fi

info "Memeriksa aplikasi"
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/"; then OK=1; break; fi
  sleep 1
done
[ "${OK:-0}" = 1 ] || { journalctl -u madin-alwafa -n 40 --no-pager; gagal "Aplikasi belum merespons. Lihat log di atas."; }

IP=$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
printf '\n\033[1;32m✓ Madin Al Wafa’ sudah berjalan.\033[0m\n'
if [ -n "$DOMAIN" ]; then
  echo "  Alamat     : https://$DOMAIN   (pastikan DNS domain mengarah ke $IP)"
  echo "  Guru       : https://$DOMAIN/guru"
  echo "  Pengurus   : https://$DOMAIN/pengurus"
else
  echo "  Alamat     : http://$IP:$PORT   (tanpa HTTPS, untuk uji coba)"
fi
echo "  Data       : $DATA_DIR"
echo "  Cadangan   : $CADANGAN_DIR (harian, 30 hari)"
echo "  Log        : journalctl -u madin-alwafa -f"
echo
echo "Buka alamat di atas, lalu buat akun administrator di layar pemasangan pertama."
