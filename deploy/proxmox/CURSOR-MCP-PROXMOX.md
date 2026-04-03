# Proxmox MCP en Cursor (Windows)

## Qué fallaba

En `C:\Users\txtrd\.cursor\mcp.json` el servidor **proxmox** apuntaba a `http://127.0.0.1:8811/sse`. No había ningún proceso escuchando en el **8811**, por eso el log mostraba `ECONNREFUSED` y Cursor marcaba el MCP en error.

Las credenciales reales del API (host `192.168.13.215`, token, etc.) estaban en `proxmox.credentials.json`, pero **no se usaban** mientras el puente SSE no estuviera arrancado.

## Qué se configuró

1. **`mcp.json`** — El servidor **proxmox** se lanza por **stdio** con PowerShell ejecutando un script launcher (sin depender del puerto 8811).
2. **`proxmox-mcp-launch.ps1`** (en la misma carpeta `.cursor`) — Lee `proxmox.credentials.json`, exporta `PROXMOX_*` y ejecuta el binario `proxmox-mcp-server` (PyPI).
3. **Paquete Python** — `proxmox-mcp-server` instalado con Python 3.11+ (en este equipo: `py -3.13 -m pip install --user proxmox-mcp-server`).

## Qué tienes que hacer tú

1. **Cierra y vuelve a abrir Cursor** (o recarga ventana) para que cargue el nuevo `mcp.json`.
2. Comprueba en **Ajustes → MCP** que **proxmox** pasa a estado conectado.
3. Si cambias IP, puerto o token, edita solo **`C:\Users\txtrd\.cursor\proxmox.credentials.json`** (no pegues tokens en chats).
4. Si alguna vez publicaste el token, **revócalo** en Proxmox y genera uno nuevo en ese JSON.

## Rutas

| Archivo | Uso |
|--------|-----|
| `C:\Users\txtrd\.cursor\mcp.json` | Definición del servidor MCP para Cursor |
| `C:\Users\txtrd\.cursor\proxmox-mcp-launch.ps1` | Arranque + variables de entorno |
| `C:\Users\txtrd\.cursor\proxmox.credentials.json` | Host, puerto, usuario, token API |
