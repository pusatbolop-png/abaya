#!/usr/bin/env bash
# Cadangkan basis data madrasah dengan aman walau aplikasi sedang berjalan. Menyimpan 30 cadangan terakhir.
#   sudo bash deploy/cadangan.sh
set -euo pipefail
DATA_DIR="${DATA_DIR:-/var/lib/madin-alwafa}"
CADANGAN_DIR="${CADANGAN_DIR:-/var/backups/madin-alwafa}"
SIMPAN="${SIMPAN:-30}"
mkdir -p "$CADANGAN_DIR"
[ -f "$DATA_DIR/madin.db" ] || { echo "Belum ada basis data di $DATA_DIR (aplikasi belum dipakai)."; exit 0; }
WAKTU=$(date +%F-%H%M)
TUJUAN="$CADANGAN_DIR/madin-$WAKTU"
mkdir -p "$TUJUAN"
sqlite3 "$DATA_DIR/madin.db" ".backup '$TUJUAN/madin.db'"
# Folder lain di DATA_DIR (mis. foto santri) ikut disalin.
find "$DATA_DIR" -mindepth 1 -maxdepth 1 ! -name 'madin.db*' -exec cp -a {} "$TUJUAN/" \;
tar -C "$CADANGAN_DIR" -czf "$TUJUAN.tar.gz" "madin-$WAKTU" && rm -rf "$TUJUAN"
ls -1t "$CADANGAN_DIR"/madin-*.tar.gz | tail -n +$((SIMPAN + 1)) | xargs -r rm -f
echo "$(date '+%F %T') cadangan: $TUJUAN.tar.gz ($(du -h "$TUJUAN.tar.gz" | cut -f1))"
