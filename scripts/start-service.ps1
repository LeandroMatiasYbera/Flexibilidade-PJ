# Mantém o Portal PJ rodando sempre nesta máquina: religa sozinho se o
# Windows reiniciar (via Agendador de Tarefas, gatilho "ao fazer logon") e
# reinicia o processo Node automaticamente se ele cair por qualquer motivo.
# Não precisa de direitos de administrador — roda só com a conta do usuário.
$ErrorActionPreference = "Continue"
$projeto = "C:\Users\YBG-NTB-007\dev\portal-pj"
$env:PATH = "C:\Users\YBG-NTB-007\tools\node-v22.11.0-win-x64;$env:PATH"
Set-Location $projeto

if (-not (Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" | Out-Null }

while ($true) {
    $agora = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path "logs\watchdog.log" -Value "$agora - iniciando node src/server.js"
    node src\server.js *>> "logs\server.log"
    $codigo = $LASTEXITCODE
    $agora = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path "logs\watchdog.log" -Value "$agora - processo encerrado (codigo $codigo), reiniciando em 3s"
    Start-Sleep -Seconds 3
}
