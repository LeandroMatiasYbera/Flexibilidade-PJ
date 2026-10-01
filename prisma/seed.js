const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { SENHA_PADRAO_PRIMEIRO_ACESSO } = require("../src/lib/config");

const prisma = new PrismaClient();

async function main() {
  const perfis = ["ADM", "GESTOR", "PJ"];
  const perfilPorNome = {};
  for (const nome of perfis) {
    perfilPorNome[nome] = await prisma.perfil.upsert({
      where: { nome },
      update: {},
      create: { nome, descricao: nome === "ADM" ? "Super usuário — acesso total" : nome === "GESTOR" ? "Gestor de equipe" : "Prestador PJ" },
    });
  }

  // Matriz de permissões (Seção 4 dos requisitos) — dados, não código.
  const MATRIZ = {
    ADM: ["administracao", "dossie", "logs", "relatorios", "configuracoes", "flexibilidade.propria", "flexibilidade.equipe"],
    GESTOR: ["flexibilidade.propria", "flexibilidade.equipe"],
    PJ: ["flexibilidade.propria"],
  };
  for (const nome of perfis) {
    for (const funcionalidade of MATRIZ[nome]) {
      await prisma.permissao.upsert({
        where: { perfilId_funcionalidade: { perfilId: perfilPorNome[nome].id, funcionalidade } },
        update: {},
        create: { perfilId: perfilPorNome[nome].id, funcionalidade },
      });
    }
  }

  const senhaAdmPlano = process.env.SEED_ADM_SENHA || SENHA_PADRAO_PRIMEIRO_ACESSO;
  const admExiste = await prisma.usuario.findUnique({ where: { email: "adm@ybera.local" } });
  if (!admExiste) {
    await prisma.usuario.create({
      data: {
        nome: "Administrador Gente & Gestão",
        email: "adm@ybera.local",
        senhaHash: await bcrypt.hash(senhaAdmPlano, 12),
        senhaProvisoria: true,
        perfilId: perfilPorNome.ADM.id,
      },
    });
    console.log(`Usuário ADM criado: adm@ybera.local / senha: ${senhaAdmPlano}  (troca obrigatória no primeiro acesso)`);
  }

  const gestorExiste = await prisma.usuario.findUnique({ where: { email: "gestor.exemplo@ybera.local" } });
  const gestor =
    gestorExiste ||
    (await prisma.usuario.create({
      data: {
        nome: "Gestor Exemplo",
        email: "gestor.exemplo@ybera.local",
        senhaHash: await bcrypt.hash(SENHA_PADRAO_PRIMEIRO_ACESSO, 12),
        senhaProvisoria: true,
        perfilId: perfilPorNome.GESTOR.id,
      },
    }));

  const pjExiste = await prisma.usuario.findUnique({ where: { email: "pj.exemplo@ybera.local" } });
  if (!pjExiste) {
    await prisma.usuario.create({
      data: {
        nome: "PJ Exemplo",
        email: "pj.exemplo@ybera.local",
        senhaHash: await bcrypt.hash(SENHA_PADRAO_PRIMEIRO_ACESSO, 12),
        senhaProvisoria: true,
        perfilId: perfilPorNome.PJ.id,
        gestorId: gestor.id,
        cargo: "Analista de Exemplo",
        contratante: "GYP",
        dataContrato: new Date("2026-07-01"),
      },
    });
  }

  const totalFeriados = await prisma.feriado.count();
  if (totalFeriados === 0) {
    await prisma.feriado.createMany({
      data: [
        { data: new Date("2026-01-01"), descricao: "Ano Novo", abrangencia: "Nacional" },
        { data: new Date("2026-12-25"), descricao: "Natal", abrangencia: "Nacional" },
      ],
    });
  }

  const totalDocs = await prisma.documento.count();
  if (totalDocs === 0) {
    // Conteúdo de EXEMPLO — os documentos reais e confidenciais do Dossiê PJ
    // (nomes, valores, CNPJs) devem ser importados depois do deploy, direto
    // pela tela de Administração, nunca commitados neste repositório.
    await prisma.documento.createMany({
      data: [
        {
          titulo: "Metodologia — Geração de Contratos de Prestadores PJ (exemplo)",
          categoria: "metodologia",
          ordem: 1,
          confidencial: false,
          conteudoMarkdown: "# Metodologia (exemplo)\n\nSubstitua este documento pelo conteúdo real via Administração > Dossiê PJ.",
        },
        {
          titulo: "Auditoria de Contratos PJ — rodada de exemplo",
          categoria: "auditorias",
          ordem: 1,
          confidencial: false,
          conteudoMarkdown: "# Auditoria (exemplo)\n\nConteúdo de exemplo — substitua pelo real.",
        },
        {
          titulo: "Resumo Executivo para o CEO (exemplo, confidencial)",
          categoria: "resumos",
          ordem: 1,
          confidencial: true,
          conteudoMarkdown: "# Resumo Executivo (exemplo)\n\nMarcado como confidencial de propósito — este é só um exemplo de como o badge aparece.",
        },
      ],
    });
  }

  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
