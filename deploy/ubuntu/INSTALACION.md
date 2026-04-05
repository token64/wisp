# Instalar Fiber Atlas en Ubuntu (Proxmox u otra VM)

Guía pensada para **quien no es programador**: copiar y pegar los comandos en orden. Si algo falla, anote el mensaje en rojo.

## Qué vas a conseguir

Una página web en tu red con el mapa y el inventario de fibra. La base de datos se guarda **dentro de la VM** (archivo SQLite).

## 1. Crear la máquina virtual en Proxmox

1. En Proxmox: **Create VM**.
2. **ISO**: descarga [Ubuntu Server 22.04 LTS](https://ubuntu.com/download/server) (64 bits) y súbelo a Proxmox (local → ISO images) si no lo tienes.
3. **Recursos recomendados**: 2 GB RAM, 2 núcleos, disco 20 GB o más.
4. **Red**: la red por defecto (bridge **vmbr0**) suele dar IP automática por DHCP.
5. Arranca la VM y **instala Ubuntu**:
   - Crea un usuario y contraseña.
   - Activa **OpenSSH** (servidor SSH) cuando el instalador lo pregunte.
6. Al terminar, en Proxmox anota la **IP de la VM** (o en tu router mira el dispositivo).

## 2. Entrar a la VM desde tu PC (Windows)

1. Abre **PowerShell** o **Terminal**.
2. Conéctate (cambia `usuario` e `IP`):

   ```bash
   ssh usuario@192.168.x.x
   ```

3. Si pregunta “Are you sure…”, escribe `yes` y Enter.

## 3. Actualizar Ubuntu e instalar lo necesario

Pega **todo el bloque** y pulsa Enter (pedirá tu contraseña de sudo):

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y apache2 php php-sqlite3 php-json libapache2-mod-php git
```

Comprueba que PHP funciona:

```bash
php -v
```

Debería decir PHP 8.x.

## 4. Descargar el proyecto desde GitHub

```bash
cd /var/www
sudo git clone https://github.com/token64/wisp.git
```

(Si el repositorio cambió de nombre o lo copiaste a tu cuenta, cambia la URL por la que te dé GitHub en el botón verde **Code**.)

## 5. Carpeta de datos (la base SQLite)

La aplicación guarda aquí la base de datos. Hay que dejar que el servidor web pueda escribir:

```bash
sudo mkdir -p /var/www/wisp/fiber-atlas/data
sudo chown -R www-data:www-data /var/www/wisp/fiber-atlas/data
sudo chmod 775 /var/www/wisp/fiber-atlas/data
```

## 6. Configurar Apache (sitio web)

1. Copia el ejemplo al sitio de Apache:

   ```bash
   sudo cp /var/www/wisp/deploy/ubuntu/apache-fiber-atlas.conf.example /etc/apache2/sites-available/fiber-atlas.conf
   ```

2. Activa el sitio y el módulo de reescritura (por si hace falta el `.htaccess`):

   ```bash
   sudo a2enmod rewrite
   sudo a2ensite fiber-atlas.conf
   sudo a2dissite 000-default.conf
   ```

3. Revisa que la configuración no tenga errores:

   ```bash
   sudo apache2ctl configtest
   ```

   Debe decir **Syntax OK**.

4. Reinicia Apache:

   ```bash
   sudo systemctl reload apache2
   ```

## 7. Abrir en el navegador

En tu PC, en Chrome o Edge, entra a:

```text
http://IP_DE_LA_VM
```

(sin `/wisp` ni `/public`: el sitio ya apunta a la carpeta `public`.)

Si no carga, comprueba firewall en la VM:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Apache'
sudo ufw enable
```

( Si `ufw` no estaba activo, `enable` pregunta; confirma con `y`.)

## 8. Mapas (Google / Internet)

- Para ver **mapas de fondo** hace falta **Internet** desde la VM (o al menos desde el navegador de quien abre la página).
- **Google Maps** con API oficial: en la propia aplicación, despliega la sección de clave y pulsa **Guardar** (o edita `config.local.js` en el servidor si un técnico os lo deja preparado).

## 9. Copias de seguridad

Lo importante es el archivo:

```text
/var/www/wisp/fiber-atlas/data/network.sqlite
```

Proxmox puede hacer **backup de la VM** entera; además podéis copiar ese archivo a otro sitio de vez en cuando.

## Seguridad (importante)

Esta aplicación **no tiene usuario y contraseña**. Úsala en **red interna** (oficina, VPN) o detrás de un firewall. No la expongas a Internet abierto sin protección.

## Si algo sale mal

- **Página en blanco o error 500**: mira el log:

  ```bash
  sudo tail -50 /var/log/apache2/error.log
  ```

- **No encuentra la API**: el `DocumentRoot` debe ser exactamente `.../fiber-atlas/public` como en el archivo de ejemplo.

---

*Ruta del ejemplo de Apache en el repo: `deploy/ubuntu/apache-fiber-atlas.conf.example`.*
