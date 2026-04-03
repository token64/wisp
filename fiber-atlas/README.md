# Fiber Atlas

Herramienta web ligera para **señalizar en mapa** tus **cables de fibra**, **mufas** (empalmes) y **terminales** (CTO/cajas), con datos guardados en **SQLite** y API **PHP** (compatible con XAMPP).

## Requisitos

- XAMPP con Apache y PHP 8+ (extensión `pdo_sqlite` habilitada, suele venir por defecto).

## Cómo abrirlo

1. Coloca el proyecto bajo `htdocs` (por ejemplo ya está en `wisp/fiber-atlas`).
2. En el navegador entra a:

   `http://localhost/wisp/fiber-atlas/public/`

3. La base de datos se crea sola la primera vez en `fiber-atlas/data/network.sqlite` (no se versiona).

## Uso rápido

- **Mufa** / **Terminal**: elige modo y haz clic en el mapa; luego edita nombre y detalles en el panel.
- **Cable**: modo cable → clics para vértices del trazado → **Finalizar cable** → nombre, nº de fibras, color.
- Lista a la izquierda: seleccionar centra el mapa; **Editar** / **Borrar**.

## Seguridad

Pensado para **red local** o entorno controlado. No incluye usuarios ni login: no expongas esta carpeta a Internet sin proteger Apache (auth, VPN, etc.).

## Mapas

Usa teselas **OpenStreetMap** (CDN). Necesitas conexión a Internet para ver el fondo cartográfico.
