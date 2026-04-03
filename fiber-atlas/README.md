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

### Pestaña **Mapa**

- **Mufa** / **Terminal**: modo + clic en el mapa; en mufas puedes enlazar **site** (cabecera) y **PON** de la red.
- **Cable / manga**: trazado por clics → **Finalizar cable** → elige **4 / 6 / 8 / 12 / 24 / 48 / 72** fibras (TIA-598), nombre de manga, **empalmes** en ese tramo.
- En la lista de cables: **Fibras** abre la **ilustración por colores**; toca cada pelo para enlazarlo a un **PON** o **mufa** y anotar notas (splitters, continuidad, etc.).

### Pestaña **Site / OLT / PON**

Orden recomendado: **Site** → **OLT** → **Tarjeta** (slot) → **PON** (número de puerto).  
En cada **PON** registras **lecturas de potencia (dBm)** por etapa (OLT, tras splitter, en mufa…).

### Pestaña **Presupuesto**

- **Catálogo de precios**: fibra (m), caja/NAP, mufa, manga, preparación de palo…
- **Proyectos**: crea un proyecto y añade **líneas** (cantidad × precio); el total se muestra abajo para estimar un despliegue nuevo.

## Seguridad

Pensado para **red local** o entorno controlado. No incluye usuarios ni login: no expongas esta carpeta a Internet sin proteger Apache (auth, VPN, etc.).

## Mapas

Usa teselas **OpenStreetMap** (CDN). Necesitas conexión a Internet para ver el fondo cartográfico.
