# Carrega o DATABASE_URL de producao a partir de .env.production (nunca
# commitado - ver .gitignore) e gera o client do Prisma para Postgres.
# Rodar antes de qualquer script administrativo contra o banco de producao;
# depois de usar, restaurar o ambiente local com "npx prisma generate"
# (sem --schema) para voltar ao SQLite.
$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $raiz ".env.production"
if (-not (Test-Path $envFile)) {
    throw ".env.production nao encontrado em $envFile - copie a External Database URL do Render (portal-pj-db / Connections) e salve nesse arquivo como DATABASE_URL=...."
}
$linha = Get-Content $envFile | Where-Object { $_ -match "^DATABASE_URL=" } | Select-Object -First 1
if (-not $linha) { throw "Linha DATABASE_URL nao encontrada em $envFile" }
$env:DATABASE_URL = ($linha -replace '^DATABASE_URL="?', '') -replace '"$', ''
$env:PATH = "C:\Users\YBG-NTB-007\tools\node-v22.11.0-win-x64;$env:PATH"
Set-Location $raiz
npx prisma generate --schema=prisma/schema.production.prisma
Write-Output "Pronto - DATABASE_URL de producao carregado nesta sessao do PowerShell."
