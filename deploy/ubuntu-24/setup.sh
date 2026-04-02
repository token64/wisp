#!/usr/bin/env bash
set -euo pipefail

# Uso en VM Ubuntu 24 (Proxmox): sudo bash deploy/ubuntu-24/setup.sh
# Antes: copia el proyecto (carpeta wisp con mapwisp dentro) a /var/www/wisp

WEB_ROOT="${WEB_ROOT:-/var/www/wisp}"
CONF_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/nginx-mapwisp.conf"

echo "==> Instalando nginx (Ubuntu 24)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx

echo "==> Comprobando $WEB_ROOT/mapwisp ..."
if [[ ! -d "$WEB_ROOT/mapwisp" ]]; then
  echo "ERROR: No existe $WEB_ROOT/mapwisp"
  echo "Copia el contenido del repo para que quede: $WEB_ROOT/mapwisp/{css,js,img,users,...}"
  exit 1
fi

chown -R www-data:www-data "$WEB_ROOT" || true

echo "==> Instalando sitio nginx..."
install -m 0644 "$CONF_SRC" /etc/nginx/sites-available/mapwisp
sed -i "s|root /var/www/wisp;|root $WEB_ROOT;|g" /etc/nginx/sites-available/mapwisp
ln -sfn /etc/nginx/sites-available/mapwisp /etc/nginx/sites-enabled/mapwisp
if [[ -f /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
fi

nginx -t
systemctl enable --now nginx

echo "==> Listo. Prueba: http://$(hostname -I | awk '{print $1}')/mapwisp/users/login"
echo "Opcional TLS: apt install -y certbot python3-certbot-nginx && certbot --nginx -d tu.dominio.com"
echo "Firewall: ufw allow 'Nginx Full' || true"
