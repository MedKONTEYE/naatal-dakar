# ---------------------------------------------------------------------------
# NAATAL DAKAR - Partage en ligne via un tunnel Cloudflare rapide
#
# Usage (depuis ce dossier) :
#   powershell -ExecutionPolicy Bypass -File .\partager-en-ligne.ps1
#
# Le script :
#   1. verifie que MySQL est demarre ;
#   2. demarre le backend (port 5000) et le frontend (port 5173) si besoin ;
#   3. ouvre un tunnel Cloudflare et affiche une URL publique https://xxx.trycloudflare.com
#
# L'URL change a chaque lancement et ne fonctionne que tant que ce script,
# votre ordinateur et votre connexion Internet restent actifs.
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'

$root         = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir  = Join-Path $root 'frontend'
$backendDir   = Join-Path $root 'backend'
$frontendPort = 5173
$backendPort  = 5000
$logDir       = Join-Path $root 'logs'
$tunnelLog    = Join-Path $logDir 'cloudflared.log'

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Test-PortOpen([int]$Port) {
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Wait-Port([int]$Port, [int]$TimeoutSeconds = 60) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-PortOpen $Port) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

Write-Host ""
Write-Host "=== NAATAL DAKAR - Partage en ligne ===" -ForegroundColor Cyan
Write-Host ""

# 1. MySQL ------------------------------------------------------------------
if (-not (Test-PortOpen 3306)) {
  Write-Host "MySQL n'est pas demarre (port 3306)." -ForegroundColor Red
  Write-Host "Demarrez MySQL (XAMPP/WAMP/MAMP ou service Windows), puis relancez ce script."
  exit 1
}
Write-Host "[OK] MySQL est demarre." -ForegroundColor Green

# 2. Backend ----------------------------------------------------------------
if (-not (Test-PortOpen $backendPort)) {
  Write-Host "[..] Demarrage du backend sur le port $backendPort..."
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'start' `
    -WorkingDirectory $backendDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'backend.out.log') `
    -RedirectStandardError  (Join-Path $logDir 'backend.err.log') | Out-Null

  if (-not (Wait-Port $backendPort 60)) {
    Write-Host "Le backend n'a pas demarre. Consultez logs\backend.err.log." -ForegroundColor Red
    exit 1
  }
  Write-Host "[OK] Backend demarre : http://localhost:$backendPort" -ForegroundColor Green
} else {
  Write-Host "[OK] Backend deja actif sur le port $backendPort." -ForegroundColor Green
}

# 3. Frontend ---------------------------------------------------------------
if (-not (Test-PortOpen $frontendPort)) {
  Write-Host "[..] Demarrage du frontend sur le port $frontendPort..."
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' `
    -WorkingDirectory $frontendDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'frontend.out.log') `
    -RedirectStandardError  (Join-Path $logDir 'frontend.err.log') | Out-Null

  if (-not (Wait-Port $frontendPort 60)) {
    Write-Host "Le frontend n'a pas demarre. Consultez logs\frontend.err.log." -ForegroundColor Red
    exit 1
  }
  Write-Host "[OK] Frontend demarre : http://localhost:$frontendPort" -ForegroundColor Green
} else {
  Write-Host "[OK] Frontend deja actif sur le port $frontendPort." -ForegroundColor Green
}

# 4. Tunnel Cloudflare ------------------------------------------------------
if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  Write-Host "cloudflared est introuvable dans le PATH." -ForegroundColor Red
  Write-Host "Installez-le avec : winget install --id Cloudflare.cloudflared"
  exit 1
}

if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }

Write-Host "[..] Ouverture du tunnel Cloudflare..."
$tunnel = Start-Process -FilePath 'cloudflared' `
  -ArgumentList 'tunnel','--url',"http://127.0.0.1:$frontendPort",'--protocol','http2','--no-autoupdate' `
  -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $logDir 'cloudflared.out.log') `
  -RedirectStandardError  $tunnelLog

$url = $null
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
  if (Test-Path $tunnelLog) {
    $match = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($match) {
      $url = [regex]::Match($match.Line, 'https://[a-z0-9-]+\.trycloudflare\.com').Value
      break
    }
  }
  if ($tunnel.HasExited) { break }
  Start-Sleep -Milliseconds 500
}

if (-not $url) {
  Write-Host "Impossible d'obtenir l'URL du tunnel. Consultez logs\cloudflared.log." -ForegroundColor Red
  if (-not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue }
  exit 1
}

try { Set-Clipboard -Value $url } catch { }

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Lien public a envoyer a votre camarade :" -ForegroundColor Cyan
Write-Host ""
Write-Host "  $url" -ForegroundColor Yellow
Write-Host ""
Write-Host "  (Le lien a ete copie dans le presse-papiers.)"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Laissez cette fenetre ouverte. Appuyez sur Ctrl+C pour fermer le tunnel."
Write-Host ""

try {
  Wait-Process -Id $tunnel.Id
} finally {
  if (-not $tunnel.HasExited) {
    Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue
  }
  Write-Host "Tunnel ferme." -ForegroundColor DarkGray
}
