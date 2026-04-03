#!/usr/bin/env bash
# Aprovisiona Ubuntu 24 en Proxmox: guest agent, nginx (setup existente), firewall.
# Prerrequisito: repo completo en /var/www/wisp (carpeta mapwisp/ visible).
# Uso: sudo bash deploy/proxmox/bootstrap-ubuntu24.sh
#      WEB_ROOT=/srv/wisp sudo -E bash deploy/proxmox/bootstrap-ubuntu24.sh

set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  exec sudo bash "$0" "$@"
fi

WEB_ROOT="${WEB_ROOT:-/var/www/wisp}"
SETUP_SH="$WEB_ROOT/deploy/ubuntu-24/setup.sh"

if [[ ! -d "$WEB_ROOT/mapwisp" ]]; then
  echo "ERROR: No existe $WEB_ROOT/mapwisp"
  echo "Copia el repo para que quede: $WEB_ROOT/mapwisp/{css,js,users,...}"
  exit 1
fi

if [[ ! -f "$SETUP_SH" ]]; then
  echo "ERROR: No se encuentra $SETUP_SH"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
echo "==> Paquetes base (guest agent, firewall)..."
apt-get update -y
apt-get install -y qemu-guest-agent ufw
systemctl enable qemu-guest-agent
systemctl start qemu-guest-agent || true

echo "==> Nginx y sitio mapwisp..."
WEB_ROOT="$WEB_ROOT" bash "$SETUP_SH"

echo "==> Firewall (SSH + HTTP/HTTPS)..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
yes | ufw enable || true

IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
echo ""
echo "==> Listo. Abre en el navegador:"
echo "    http://${IP}/mapwisp/users/login"
echo "TLS: apt install -y certbot python3-certbot-nginx && certbot --nginx -d tu.dominio.com"
