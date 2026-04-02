# Ejecutar en PowerShell como administrador (opcional):
#   cd C:\xampp\htdocs\wisp\deploy\xampp
#   .\instalar-alias.ps1

$XamppApache = "C:\xampp\apache"
$Extra = Join-Path $XamppApache "conf\extra\mapwisp-alias.conf"
$Httpd = Join-Path $XamppApache "conf\httpd.conf"

if (-not (Test-Path $XamppApache)) {
    Write-Error "No se encontro XAMPP en C:\xampp. Edita este script con tu ruta."
    exit 1
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Copy-Item -Path (Join-Path $here "mapwisp-alias.conf") -Destination $Extra -Force
Write-Host "Copiado: $Extra"

$incNew = "Include conf/extra/mapwisp-alias.conf"
$incOld = "Include conf/extra/tomodat-alias.conf"

if (Test-Path $Httpd) {
    $txt = Get-Content $Httpd -Raw
    if ($txt -match [regex]::Escape($incOld)) {
        $txt = $txt.Replace($incOld, $incNew)
        Set-Content -Path $Httpd -Value $txt.TrimEnd() -NoNewline
        Write-Host "Reemplazado Include tomodat -> mapwisp en httpd.conf"
    } elseif ($txt -notmatch [regex]::Escape($incNew)) {
        Add-Content -Path $Httpd -Value "`n$incNew`n"
        Write-Host "Anadido Include al final de httpd.conf"
    } else {
        Write-Host "httpd.conf ya incluye mapwisp-alias.conf"
    }
}
Write-Host "Reinicia Apache desde el panel de XAMPP y abre http://localhost/mapwisp/users/login"
