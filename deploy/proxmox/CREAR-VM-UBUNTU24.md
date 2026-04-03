# Crear VM Ubuntu 24.04 para Mapwisp en Proxmox

Elige **una** de las dos formas.

---

## Opción A — Asistente web (ISO, la más visual)

1. Sube a almacenamiento del nodo la ISO **Ubuntu Server 24.04 LTS** ([descargas oficiales](https://ubuntu.com/download/server)).
2. **Crear VM** → ID libre (p. ej. `201`), nombre `mapwisp-web`.
3. **Sistema**: QEMU Guest Agent **activado**.
4. **Discos**: VirtIO SCSI, ≥ 20 GB.
5. **CPU** 2, **RAM** 2048 MB (o más).
6. **Red**: VirtIO, bridge `vmbr0` (o el tuyo).
7. En **CD/DVD** elige la ISO; arranca e instala Ubuntu Server (marca **OpenSSH server**).
8. Crea usuario (p. ej. `ubuntu`) con sudo. Anota la **IP** (`ip a`).

---

## Opción B — Imagen cloud en el nodo Proxmox (rápida, consola `root`)

### Un solo script (recomendado)

Copia `deploy/proxmox/crear-vm-mapwisp-en-nodo.sh` al nodo (o clona el repo allí) y como **root**:

```bash
# Opcional: export STORAGE=local-lvm BRIDGE=vmbr0
# Opcional: export SSHKEY=/root/tu-clave-publica.pub
bash crear-vm-mapwisp-en-nodo.sh 201
```

Usa un **VMID libre** (número que no exista en tu Proxmox). Cursor **no puede** ejecutar esto en tu nodo por ti: hace falta pegarlo en la consola del servidor.

### Pasos manuales (equivalente)

Sustituye `VMID` (p. ej. `201`), `STORAGE` (`local-lvm` o el que veas en **Datacenter → Almacenamiento**) y `BRIDGE` (`vmbr0`).

```bash
VMID=201
STORAGE=local-lvm
BRIDGE=vmbr0
IMG=/tmp/ubuntu-24.04-server-cloudimg-amd64.img

wget -O "$IMG" https://cloud-images.ubuntu.com/releases/24.04/release/ubuntu-24.04-server-cloudimg-amd64.img

qm create $VMID --name mapwisp-web --memory 2048 --cores 2 --net0 virtio,bridge=$BRIDGE --agent enabled=1
qm disk import $VMID "$IMG" $STORAGE --format raw
# Anota el volumen que muestra el import (p. ej. local-lvm:vm-201-disk-0)
qm set $VMID --scsihw virtio-scsi-single --scsi0 $STORAGE:vm-${VMID}-disk-0
# Si el import usó otro nombre de volumen, mira la salida de qm disk import o: qm config $VMID
qm resize $VMID scsi0 +18G

qm set $VMID --ide2 $STORAGE:cloudinit
qm set $VMID --boot order=scsi0
qm set $VMID --serial0 socket --vga serial0
qm set $VMID --ciuser ubuntu --ipconfig0 ip=dhcp
```

**Clave SSH (recomendado)** — desde tu PC genera o usa `id_rsa.pub` y en el nodo:

```bash
qm set $VMID --sshkeys /root/mapwisp-vm-sshkey.pub
```

(o pega la clave en la VM: **Hardware → Cloud-Init → Clave pública SSH** en la UI).

Arranca:

```bash
qm start $VMID
```

Espera ~1 minuto; la IP aparece en **Resumen** de la VM o con `qm guest cmd $VMID network-get-interfaces` si el agente ya responde.

---

## Después de tener IP y SSH

En **Windows** (PowerShell), desde el repo:

```powershell
cd C:\xampp\htdocs\wisp\deploy\proxmox
.\Desplegar-Mapwisp.ps1 -VmHost IP_DE_LA_VM -VmUser ubuntu
```

Abre `http://IP_DE_LA_VM/mapwisp/users/login`.
