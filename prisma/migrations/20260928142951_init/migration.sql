-- CreateTable
CREATE TABLE "Perfil" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfilId" INTEGER NOT NULL,
    "gestorId" INTEGER,
    "cargo" TEXT,
    "contratante" TEXT,
    "dataContrato" DATETIME,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoAcessoEm" DATETIME,
    "resetTokenHash" TEXT,
    "resetTokenExp" DATETIME,
    "loginFalhasSeguidas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" DATETIME,
    CONSTRAINT "Usuario_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "Perfil" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Usuario_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Feriado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "data" DATETIME NOT NULL,
    "descricao" TEXT NOT NULL,
    "abrangencia" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Solicitacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pjId" INTEGER NOT NULL,
    "gestorId" INTEGER,
    "dataComunicacao" DATETIME NOT NULL,
    "dataInicio" DATETIME NOT NULL,
    "dataFim" DATETIME NOT NULL,
    "diasCorridos" INTEGER NOT NULL,
    "diasUteis" INTEGER NOT NULL,
    "cicloInicio" DATETIME NOT NULL,
    "cicloFim" DATETIME NOT NULL,
    "numeroPeriodo" INTEGER NOT NULL,
    "antecedenciaDias" INTEGER NOT NULL,
    "antecedenciaCumprida" BOOLEAN NOT NULL,
    "atravessaCiclo" BOOLEAN NOT NULL,
    "coincide" BOOLEAN NOT NULL DEFAULT false,
    "coincideObs" TEXT,
    "status" TEXT NOT NULL,
    "decisaoGestor" TEXT,
    "decisaoGestorPorId" INTEGER,
    "decisaoGestorEm" DATETIME,
    "decididoPorId" INTEGER,
    "dataDecisao" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Solicitacao_pjId_fkey" FOREIGN KEY ("pjId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Solicitacao_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Solicitacao_decididoPorId_fkey" FOREIGN KEY ("decididoPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titulo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 1,
    "confidencial" BOOLEAN NOT NULL DEFAULT false,
    "conteudoMarkdown" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" INTEGER,
    "acao" TEXT NOT NULL,
    "entidade" TEXT,
    "entidadeId" TEXT,
    "valorAnterior" TEXT,
    "valorNovo" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Perfil_nome_key" ON "Perfil"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");
