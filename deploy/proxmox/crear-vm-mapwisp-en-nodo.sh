#!/usr/bin/env bash
# Crear VM Ubuntu 24.04 (cloud) para Mapwisp — EJECUTAR EN EL NODO PROXMOX como root (sin sudo).
#
# Uso:
#   bash crear-vm-mapwisp-en-nodo.sh 201
#
# Opcional (antes de ejecutar):
#   export STORAGE=local-lvm    # almacenamiento donde van los discos
#   export BRIDGE=vmbr0
#   export SSHKEY=/root/mapwisp.pub   # clave pública para usuario ubuntu (recomendado)
#
# Después: anota la IP de la VM y en Windows:
#   .\Desplegar-Mapwisp.ps1 -VmHost IP -VmUser ubuntu

set -euo pipefail

VMID="${1:-}"
STORAGE="${STORAGE:-local-lvm}"
BRIDGE="${BRIDGE:-vmbr0}"
SSHKEY="${SSHKEY:-}"
IMG_URL="https://cloud-images.ubuntu.com/releases/24.04/release/ubuntu-24.04-server-cloudimg-amd64.img"
IMG="/tmp/ubuntu-24.04-server-cloudimg-amd64.img"

if [[ -z "$VMID" ]]; then
  echo "Uso: bash crear-vm-mapwisp-en-nodo.sh <VMID>"
  echo "Ejemplo: bash crear-vm-mapwisp-en-nodo.sh 201"
  exit 1
fi

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Ejecuta como root en el servidor Proxmox (consola del nodo)."
  exit 1
fi

if command -v qm &>/dev/null && qm status "$VMID" &>/dev/null; then
  echo "ERROR: Ya existe la VM $VMID. Elige otro ID o elimínala en Proxmox."
  exit 1
fi

if ! pvesm status &>/dev/null; then
  echo "AVISO: No se pudo listar almacenamiento; comprueba que estás en un nodo Proxmox."
fi

echo "==> Descargando imagen cloud Ubuntu 24.04 ..."
wget -q --show-progress -O "$IMG" "$IMG_URL"

echo "==> Creando VM $VMID (mapwisp-web) ..."
qm create "$VMID" --name mapwisp-web --memory 2048 --cores 2 --net0 virtio,bridge="$BRIDGE" --agent enabled=1

echo "==> Importando disco a $STORAGE ..."
qm disk import "$VMID" "$IMG" "$STORAGE" --format raw

VOL="vm-${VMID}-disk-0"
echo "==> Asignando $STORAGE:$VOL a SCSI ..."
qm set "$VMID" --scsihw virtio-scsi-single --scsi0 "${STORAGE}:${VOL}"

echo "==> Ampliando disco (+17G sobre la imagen cloud) ..."
qm resize "$VMID" scsi0 +17G

echo "==> Cloud-Init (usuario ubuntu, DHCP) ..."
qm set "$VMID" --ide2 "${STORAGE}:cloudinit"
qm set "$VMID" --boot order=scsi0
qm set "$VMID" --serial0 socket --vga serial0
qm set "$VMID" --ciuser ubuntu --ipconfig0 ip=dhcp

if [[ -n "$SSHKEY" && -f "$SSHKEY" ]]; then
  qm set "$VMID" --sshkeys "$SSHKEY"
  echo "==> Claves SSH cargadas desde $SSHKEY"
else
  echo "==> Sin SSHKEY: tras arrancar, define clave en UI (Cloud-Init) o contraseña con:"
  echo "    qm set $VMID --cipassword \$(openssl passwd -6 'TU_CONTRASENA')"
  echo "    qm cloudinit update $VMID"
fi

echo "==> Regenerando cloud-init ..."
qm cloudinit update "$VMID"

echo "==> Arrancando VM $VMID ..."
qm start "$VMID"

echo ""
echo "Listo. En la UI: nodo → VM $VMID → Resumen → IP (o consola: ip a)."
echo "En tu PC (PowerShell):"
echo "  cd C:\\xampp\\htdocs\\wisp\\deploy\\proxmox"
echo "  .\\Desplegar-Mapwisp.ps1 -VmHost LA_IP -VmUser ubuntu"
