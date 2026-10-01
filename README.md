# Portal PJ

Sistema único de login + RBAC (ADM / Gestor / Usuário PJ) que substitui os
dois artifacts Claude antigos (Controle de Flexibilidade PJ e Dossiê PJ),
implementado seguindo o documento **Requisitos — Portal PJ (Login, RBAC e
Módulos)**. Auditado linha por linha contra esse documento em 28/09/2026 —
ver "Conformidade com os requisitos" abaixo.

## Stack

- Node.js + Express (backend simples, sem framework de frontend)
- Prisma + SQLite em desenvolvimento (troque `DATABASE_URL` no `.env` para
  Postgres/MySQL em produção — o schema em `prisma/schema.prisma` é
  compatível, só o `provider` do datasource muda)
- Autenticação por sessão real (tabela `SessaoAtiva` + cookie `httpOnly`),
  senha com hash `bcryptjs`, permissões por tabela (`Permissao`)
- `helmet` para cabeçalhos de segurança (CSP, HSTS, X-Frame-Options)
- Frontend estático (HTML/CSS/JS puro, sem build step) em `public/`

## Como rodar localmente

Esta máquina não tinha Node.js, npm nem git instalados e não há permissão de
administrador disponível nesta sessão para instalar via `winget`/MSI. Uma
cópia portátil do Node.js (sem instalação) foi extraída em
`C:\Users\YBG-NTB-007\tools\node-v22.11.0-win-x64` — some esse passo se sua
máquina de desenvolvimento já tiver Node instalado normalmente.

```powershell
# se precisar do node portátil desta sessão:
$env:PATH = "C:\Users\YBG-NTB-007\tools\node-v22.11.0-win-x64;$env:PATH"

cd C:\Users\YBG-NTB-007\dev\portal-pj
copy .env.example .env        # já feito nesta sessão — ajuste JWT_SECRET antes de produção
npm install
npx prisma db push
node prisma/seed.js           # cria os perfis, a matriz de permissões e o usuário ADM inicial
npm run dev                   # inicia em http://localhost:3000
```

## Login inicial (seed)

- ADM: `adm@ybera.local`
- Gestor de exemplo: `gestor.exemplo@ybera.local`
- PJ de exemplo: `pj.exemplo@ybera.local` (vinculado ao gestor acima)

Todas as contas (seed, criadas pela Administração, ou importadas dos dados
reais) nascem com uma **senha padrão de primeiro acesso**
(`SENHA_PADRAO_PRIMEIRO_ACESSO` no `.env`, padrão `TrocarSenha123!`) e a flag
`senhaProvisoria: true`. Enquanto essa flag estiver ativa, a pessoa só vê a
tela "Defina sua senha" (nada de menu/navegação) até trocar por uma senha
própria — bloqueado também no servidor (`bloquearSenhaProvisoria` em
`src/lib/middleware.js`), então não dá pra pular a tela chamando a API
direto. Depois de definida, a senha é só da pessoa; um ADM pode redefinir
para a senha padrão de novo a qualquer momento pela tela de Administração
(o que também derruba todas as sessões daquela conta). Não há mais
redefinição por e-mail/token — tudo acontece direto no HTML/app.

## Dados reais importados (28/09/2026)

`prisma/import-real-data.js` traz o cadastro real (45 PJs + gestores,
extraído da coleção `pjs` do artifact Claude "Controle de Flexibilidade PJ")
e os 12 documentos reais do Dossiê PJ (substituindo os 3 de exemplo do seed).
É idempotente (roda de novo sem duplicar ou resetar senha de quem já existe).

- Alguém que aparece como `gestorImediato` de outra pessoa entrou como perfil
  **GESTOR** neste sistema, mesmo quando também tem contrato próprio de PJ
  (o sistema antigo suportava os dois papéis na mesma conta via vínculo
  manual). Essas 9 pessoas (ex.: Vando Oliveira, Rodolfo Rodrigo Araujo)
  conseguem lançar a própria ausência normalmente — a tela de Flexibilidade
  mostra o formulário de lançamento pessoal pra elas sempre que a conta tem
  `dataContrato` preenchido (contrato de PJ próprio), além das aprovações da
  equipe.
- 7 gestores citados no cadastro nunca tiveram e-mail capturado no sistema
  antigo (só apareciam em texto livre). Entraram com e-mail placeholder
  `nome.sobrenome@pendente.ybera.local` — correção manual pendente
  diretamente na tela de Administração antes de avisá-los, senão o convite
  vai para um endereço que não existe.
- Todas as contas criadas nesta importação (53 no total) usam a senha padrão
  de primeiro acesso descrita acima, com troca obrigatória no primeiro login
  — não existe mais CSV de senhas avulsas para distribuir nem apagar.
- As contas de exemplo do seed (`gestor.exemplo@ybera.local`,
  `pj.exemplo@ybera.local`) continuam no banco, misturadas com as reais —
  posso remover se preferir.

## Conformidade com os requisitos (auditoria de 28/09/2026)

Cada item do documento de requisitos foi conferido contra o código. Estado
atual:

**Cumprido e testado de ponta a ponta:** login/logout com sessão real (tabela
`SessaoAtiva` — logout derruba só este dispositivo, troca de senha derruba
todos os dispositivos e reabre uma sessão nova só para quem trocou), RBAC por
tabela `Permissao` (não mais nome de perfil fixo no código — `requirePermissao()`
em `src/lib/middleware.js`), menu dinâmico completo por perfil (ADM: Dashboard/
Flexibilidade/Dossiê PJ/Administração/Relatórios/Meu Perfil; Gestor: Dashboard/
Flexibilidade/Minha Equipe/Solicitações/Histórico/Meu Perfil; PJ: Início/
Flexibilidade/Minhas Solicitações/Histórico/Meu Perfil), busca por título no
Dossiê PJ, dashboards com alertas administrativos/últimas movimentações (ADM) e
próximas ocorrências (Gestor/PJ), retomada da página após expirar sessão,
cabeçalhos de segurança (`helmet`: CSP, HSTS, X-Frame-Options), ação "Ver"
(somente leitura) na Administração, fluxo de flexibilidade em duas etapas com
todo o cálculo de ciclo/dias úteis/antecedência do sistema anterior.

**Migração dos dados reais**: já feita (ver "Dados reais importados" acima) —
`prisma/import-real-data.js` trouxe os 45 PJs reais e os 12 documentos reais
do Dossiê PJ. Esse script nunca é commitado (ver nota de privacidade abaixo).

## Rodando sempre nesta máquina (sem precisar do Claude aberto)

`scripts/start-service.ps1` mantém `node src/server.js` no ar em loop
(reinicia sozinho se cair) e um atalho em
`Iniciar > Programas > Inicialização` (`PortalPJ-Servidor.vbs`) dispara esse
script, oculto, a cada login neste Windows — não precisa de administrador
nem do Agendador de Tarefas (que negou acesso nesta máquina). Só funciona
enquanto este computador estiver ligado e alguém logado; para acesso de
fora (outros PJs, outro computador), veja a seção de produção abaixo.

## Produção (Render)

Sem Git nem permissão de administrador nesta máquina, o caminho mais simples
é o Render, via upload manual pelo site do GitHub (sem precisar instalar
nada aqui).

**⚠️ Privacidade — leia antes de subir qualquer coisa:** `prisma/import-real-data.js`
tem nome e e-mail pessoal de 45 pessoas reais, e por isso está no
`.gitignore` — **nunca** arraste esse arquivo (nem `prisma/normalizar-senhas-importadas.js`)
para o GitHub, mesmo em repositório privado. Os 12 documentos reais do
Dossiê PJ nem existem neste projeto (ficam num arquivo temporário local) —
também não vão para lá. Os passos abaixo rodam o import direto deste
computador para o banco de produção, sem passar pelo GitHub.

1. **Criar conta no GitHub** (github.com) e um repositório novo, **privado**
   (ex.: `portal-pj`).
2. **Subir os arquivos pelo site** (aba "Add file > Upload files", arrastar
   do Explorer) — **NÃO arraste**: a pasta `node_modules`, o arquivo `.env`,
   `prisma/dev.db`, a pasta `logs`, nem os dois scripts citados acima (o
   Render instala as dependências sozinho, não precisa do `node_modules`).
   Arraste o resto: `src/`, `public/`, `prisma/schema.prisma`,
   `prisma/schema.production.prisma`, `prisma/seed.js`,
   `prisma/migrations/`, `package.json`, `package-lock.json`, `render.yaml`,
   `.gitignore`, `.env.example`, `README.md`.
3. **Criar conta no Render** (render.com) e conectar sua conta do GitHub.
4. No painel do Render: **New > Blueprint**, aponte para o repositório —
   `render.yaml` já descreve o serviço web e o banco Postgres juntos, com
   `JWT_SECRET` gerado automaticamente e `COOKIE_SECURE=true`. Confirme e
   aguarde o primeiro deploy (a build já roda `prisma db push` + `seed.js`
   sozinha).
5. **Entrar com a conta ADM de exemplo** na URL que o Render deu
   (`adm@ybera.local` / `TrocarSenha123!`) — vai pedir para trocar a senha
   no primeiro acesso. Depois, pela tela de Administração, **crie a conta
   ADM real** (Gente & Gestão / e-mail real) e, se quiser, desative a de
   exemplo.
6. **Importar os PJs reais** — direto deste computador para o banco de
   produção, sem passar pelo Git:
   ```powershell
   $env:PATH = "C:\Users\YBG-NTB-007\tools\node-v22.11.0-win-x64;$env:PATH"
   cd C:\Users\YBG-NTB-007\dev\portal-pj
   $env:DATABASE_URL = "<External Database URL do Render, aba Connections do banco>"
   npx prisma generate --schema=prisma/schema.production.prisma
   node prisma/import-real-data.js
   npx prisma generate   # restaura o client para SQLite (dev local)
   ```

## O que falta antes de produção

- ~~Trocar SQLite por Postgres~~ — feito (`prisma/schema.production.prisma`,
  usado só no deploy do Render).
- ~~Definir um `JWT_SECRET` forte~~ — feito, o Render gera sozinho
  (`generateValue: true` no `render.yaml`).
- ~~Importar os dados reais~~ — feito localmente; ver "Produção (Render)"
  acima para repetir isso contra o banco de produção.
- ~~Configurar HTTPS/`COOKIE_SECURE=true`~~ — feito, o Render já serve HTTPS
  por padrão e `render.yaml` define `COOKIE_SECURE=true`.
- `git init` local continua não disponível nesta máquina — por isso o passo
  1 acima usa o upload manual do GitHub em vez de `git push`.
