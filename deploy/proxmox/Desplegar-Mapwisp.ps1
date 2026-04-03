# Despliegue completo Mapwisp: sube el repo a la VM Ubuntu y ejecuta bootstrap (nginx + ufw).
# Requisitos: OpenSSH Client en Windows; en la VM, usuario con sudo (p. ej. ubuntu) y acceso SSH.
#
# Uso:
#   cd C:\xampp\htdocs\wisp\deploy\proxmox
#   .\Desplegar-Mapwisp.ps1 -VmHost 192.168.13.xxx -VmUser ubuntu

param(
    [Parameter(Mandatory = $true, HelpMessage = "IP o hostname de la VM Ubuntu 24")]
    [string] $VmHost,

    [string] $VmUser = "ubuntu",

    [string] $RutaLocal = "C:\xampp\htdocs\wisp"
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

$scp = Get-Command scp -ErrorAction SilentlyContinue
$ssh = Get-Command ssh -ErrorAction SilentlyContinue
if (-not $scp -or -not $ssh) {
    throw "Falta OpenSSH (scp/ssh). Instala 'Cliente OpenSSH' en Windows: Configuracion > Aplicaciones > Caracteristicas opcionales."
}

$enviar = Join-Path $here "Enviar-Wisp-A-VM.ps1"
if (-not (Test-Path -LiteralPath $enviar)) {
    throw "No se encuentra Enviar-Wisp-A-VM.ps1 en $here"
}

Write-Host "==> Comprobando SSH a ${VmUser}@${VmHost} ..."
ssh -o ConnectTimeout=15 -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${VmUser}@${VmHost}" "echo ok" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Warning "SSH en modo BatchMode fallo (normal si pide contrasena la primera vez). Continuando: scp/ssh pueden pedir contrasena o usar tu clave."
}

Write-Host "==> Subiendo proyecto y bootstrap remoto ..."
& $enviar -VmHost $VmHost -VmUser $VmUser -RutaLocal $RutaLocal -RemoteBootstrap
if ($LASTEXITCODE -ne 0) {
    throw "Fallo Enviar-Wisp-A-VM.ps1 (codigo $LASTEXITCODE)"
}

Write-Host ""
Write-Host "Listo. Prueba en el navegador:"
Write-Host "  http://${VmHost}/mapwisp/users/login"
Write-Host ""
