# Despliegue: Mapwisp (cliente estático) — localhost y Ubuntu 24 (Proxmox)

## Qué tienes ahora y qué falta

Este repo contiene **solo el front-end** (HTML/CSS/JS de AngularJS v1). Las pantallas llaman a rutas como `/mapwisp/projects/list_all`, `/mapwisp/users/prelogin`, CSRF, etc. Eso lo sirve un **backend PHP** (típicamente CakePHP) que **no está incluido** aquí.

| Capa | Estado |
|------|--------|
| Archivos estáticos (`mapwisp/`) | Listos para servir con Apache o nginx |
| Backend + base de datos | **Debes obtenerlo** del proveedor/licencia o tu propio deploy oficial |
| Mapas | Sustituye `YOUR_GOOGLE_MAPS_API_KEY` en `mapwisp/users/*` |

Sin backend, podrás abrir la página de login en el navegador, pero **no** iniciar sesión ni usar el mapa con datos reales.

---

## 1) Localhost con XAMPP (Windows)

1. Ruta del proyecto: `C:\xampp\htdocs\wisp\mapwisp\` (con `css`, `js`, `users`, etc.).

2. Alias Apache: ejecuta `deploy\xampp\instalar-alias.ps1` (como administrador) **o** añade al final de `httpd.conf`:

   ```apache
   Include conf/extra/mapwisp-alias.conf
   ```

   y copia `deploy\xampp\mapwisp-alias.conf` a `C:\xampp\apache\conf\extra\mapwisp-alias.conf`.

3. Reinicia Apache en el panel de XAMPP.

4. Navegador: `http://localhost/mapwisp/users/login`

5. Opcional en `hosts`: `127.0.0.1  mapwisp.local` — en `mapwisp/js/app/app.js` el entorno `dev` incluye `mapwisp.local`.

---

## 2) VM Ubuntu 24 en Proxmox

### Crear la VM

Guía paso a paso (ISO o imagen cloud, comandos en el nodo): **`deploy/proxmox/CREAR-VM-UBUNTU24.md`**.

### Desplegar Mapwisp desde Windows (recomendado)

Un solo comando sube el repo y ejecuta nginx + ufw en la VM (requiere **OpenSSH Client**):

```powershell
cd C:\xampp\htdocs\wisp\deploy\proxmox
.\Desplegar-Mapwisp.ps1 -VmHost IP_DE_LA_VM -VmUser ubuntu
```

Equivalente manual: `.\Enviar-Wisp-A-VM.ps1 -VmHost ... -RemoteBootstrap`.

En la VM, `bootstrap-ubuntu24.sh` deja el sitio en `http://IP/mapwisp/users/login`.

### Referencia cloud-init

Ejemplo YAML: `deploy/proxmox/cloud-init-ejemplo.yaml` (en Proxmox suele bastar la pestaña **Cloud-Init** con usuario + SSH).

### Copiar el proyecto a mano

```bash
scp -r C:\xampp\htdocs\wisp usuario@IP_VM:/tmp/wisp
```

En la VM:

```bash
sudo mkdir -p /var/www
sudo mv /tmp/wisp /var/www/wisp
sudo chown -R www-data:www-data /var/www/wisp
cd /var/www/wisp
sudo bash deploy/proxmox/bootstrap-ubuntu24.sh
```

(Equivalente anterior solo nginx, sin guest agent ni ufw automáticos: `sudo bash deploy/ubuntu-24/setup.sh`.)

`WEB_ROOT` alternativo: `sudo WEB_ROOT=/srv/miapp bash deploy/ubuntu-24/setup.sh` (debe existir `/srv/miapp/mapwisp/...`).

Prueba: `http://IP_VM/mapwisp/users/login`

### Firewall / HTTPS

Si usaste `bootstrap-ubuntu24.sh`, **ufw** ya quedó con SSH y `Nginx Full`. Solo necesitas **certbot** si quieres HTTPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mapwisp.tudominio.com
```

Si no usaste el bootstrap, abre el cortafuegos a mano:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

Sitio nginx: `/etc/nginx/sites-available/mapwisp`

---

## 3) Docker

```bash
cd deploy/docker
docker compose build && docker compose up -d
```

URL: `http://localhost:8080/mapwisp/users/login`

---

## 4) Backend PHP

```bash
sudo apt install -y php8.3-fpm php8.3-mysql php8.3-xml php8.3-mbstring php8.3-curl mysql-server
```

Adapta el bloque `fastcgi` en `deploy/ubuntu-24/nginx-mapwisp.conf` cuando tengas el webroot PHP.

---

## 5) Sanitizar strings antes de un push público

Si en tu copia local aún aparecen claves de Maps, IDs de Analytics, enlaces de WhatsApp u otros textos que no deben subirse al repositorio:

1. Copia `tools/sanitize_replacements.example.json` a **`tools/sanitize_replacements.local.json`** (este segundo archivo **no se versiona**; está en `.gitignore`).
2. Edita el `.local.json`: en `replacements` pon pares `["texto_real_en_tus_archivos", "placeholder_seguro"]` (mismo formato que el ejemplo).
3. Ejecuta desde la raíz del repo: `python tools/sanitize_assets.py`  
   Sin archivo `.local`, el script solo avisa y no aplica esos reemplazos; puede seguir ajustando la línea de dominio en `app.js` si coincide el patrón documentado en el propio script.

Para bajar assets desde un HTML “ver código fuente” guardado en disco, usa `python tools/extract_and_download.py RUTA_AL_HTML --base https://tu-origen` (ya no se asume ningún fichero concreto en el repo).

---

## 6) Checklist

- [ ] `YOUR_GOOGLE_MAPS_API_KEY` en `mapwisp/users/login`, `logout`, `forgot_password`
- [ ] `UA-REPLACE-WITH-YOUR-ID` o analytics según entorno
- [ ] WhatsApp en `interfaceController.js` y `chatService.js`
- [ ] Dominio en `mapwisp/js/app/app.js` (lista `production`) si aplica
- [ ] Backend y BD cuando quieras uso completo
