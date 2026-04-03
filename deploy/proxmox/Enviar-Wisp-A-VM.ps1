# Sube el repo wisp a una VM Ubuntu (p. ej. en Proxmox) y opcionalmente ejecuta bootstrap.
# Requiere OpenSSH Client en Windows (Opciones > Aplicaciones > Caracteristicas opcionales).
#
# Ejemplo:
#   .\Enviar-Wisp-A-VM.ps1 -VmHost 192.168.1.50 -VmUser ubuntu -RemoteBootstrap

param(
    [Parameter(Mandatory = $true)]
    [string] $VmHost,

    [string] $VmUser = "ubuntu",

    [string] $RutaLocal = "C:\xampp\htdocs\wisp",

    [switch] $RemoteBootstrap
)

if (-not (Test-Path -LiteralPath $RutaLocal)) {
    throw "No existe la ruta local: $RutaLocal"
}

$mapwisp = Join-Path $RutaLocal "mapwisp"
if (-not (Test-Path -LiteralPath $mapwisp)) {
    throw "Falta la carpeta mapwisp bajo $RutaLocal"
}

Write-Host "==> Subiendo $RutaLocal a ${VmUser}@${VmHost}:/tmp/wisp ..."
scp -r "$RutaLocal" "${VmUser}@${VmHost}:/tmp/wisp"

if ($RemoteBootstrap) {
    Write-Host "==> Moviendo a /var/www/wisp y ejecutando bootstrap (sudo en la VM) ..."
    $remoteCmd = "sudo bash -c 'mkdir -p /var/www && rm -rf /var/www/wisp && mv /tmp/wisp /var/www/wisp && chown -R www-data:www-data /var/www/wisp && bash /var/www/wisp/deploy/proxmox/bootstrap-ubuntu24.sh'"
    ssh "${VmUser}@${VmHost}" $remoteCmd
}
else {
    Write-Host ""
    Write-Host "En la VM, ejecuta:"
    Write-Host "  sudo mkdir -p /var/www && sudo rm -rf /var/www/wisp && sudo mv /tmp/wisp /var/www/wisp"
    Write-Host "  sudo chown -R www-data:www-data /var/www/wisp"
    Write-Host "  cd /var/www/wisp && sudo bash deploy/proxmox/bootstrap-ubuntu24.sh"
}
