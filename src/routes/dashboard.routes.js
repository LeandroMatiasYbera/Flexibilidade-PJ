const express = require("express");
const { prisma } = require("../db");
const { requireAuth, bloquearSenhaProvisoria } = require("../lib/middleware");
const { getCycle, cycleUsage, TETO_DIAS_UTEIS, MAX_PERIODOS } = require("../lib/cycle");

const router = express.Router();
router.use(requireAuth, bloquearSenhaProvisoria);

function serializeDate(d) {
  return d ? d.toISOString().slice(0, 10) : null;
}

router.get("/", async (req, res) => {
  const perfil = req.usuario.perfil.nome;
  const hoje = serializeDate(new Date());

  if (perfil === "ADM") {
    const gestorPerfil = await prisma.perfil.findUnique({ where: { nome: "GESTOR" } });
    // "PJ" aqui é quem tem contrato (dataContrato preenchido), não quem tem
    // perfil RBAC "PJ" — inclui os Gestores que também têm contrato próprio.
    const [totalPJs, totalGestores, solicitacoes, pjsAtivos, ultimosLogs] = await Promise.all([
      prisma.usuario.count({ where: { dataContrato: { not: null }, ativo: true } }),
      prisma.usuario.count({ where: { perfilId: gestorPerfil.id, ativo: true } }),
      prisma.solicitacao.findMany(),
      prisma.usuario.findMany({ where: { dataContrato: { not: null }, ativo: true } }),
      prisma.logAuditoria.findMany({ include: { usuario: true }, orderBy: { criadoEm: "desc" }, take: 8 }),
    ]);
    const abertas = solicitacoes.filter((s) => s.status === "PendenteGestor" || s.status === "PendenteAdmin").length;
    const aprovadas = solicitacoes.filter((s) => s.status === "Aprovado").length;
    const recusadas = solicitacoes.filter((s) => s.status === "Reprovado" || s.status === "ReprovadoGestor").length;

    // Alertas administrativos: PJs com o ciclo atual estourando o teto de
    // dias úteis ou o limite de períodos (Seção 6 dos requisitos).
    const alertasAdministrativos = pjsAtivos
      .map((pj) => {
        const cycle = getCycle(serializeDate(pj.dataContrato), hoje);
        const usage = cycleUsage(
          solicitacoes.map((s) => ({ ...s, cicloInicio: serializeDate(s.cicloInicio) })),
          pj.id,
          cycle.start,
          null
        );
        return { pjId: pj.id, nome: pj.nome, diasUsados: usage.dias, periodosUsados: usage.periodos, estourado: usage.dias > TETO_DIAS_UTEIS || usage.periodos > MAX_PERIODOS };
      })
      .filter((a) => a.estourado);

    return res.json({
      perfil,
      indicadores: [
        { label: "PJs ativos", valor: totalPJs },
        { label: "Gestores ativos", valor: totalGestores },
        { label: "Solicitações abertas", valor: abertas },
        { label: "Aprovadas", valor: aprovadas },
        { label: "Recusadas", valor: recusadas },
        { label: "Total de solicitações", valor: solicitacoes.length },
      ],
      alertasAdministrativos,
      ultimasMovimentacoes: ultimosLogs.map((l) => ({
        acao: l.acao,
        usuario: l.usuario ? l.usuario.nome : null,
        entidade: l.entidade,
        entidadeId: l.entidadeId,
        criadoEm: l.criadoEm,
      })),
    });
  }

  if (perfil === "GESTOR") {
    const [pjsDaEquipe, solicitacoesEquipe] = await Promise.all([
      prisma.usuario.count({ where: { gestorId: req.usuario.id } }),
      prisma.solicitacao.findMany({ where: { gestorId: req.usuario.id }, include: { pj: true } }),
    ]);
    const pendentes = solicitacoesEquipe.filter((s) => s.status === "PendenteGestor").length;
    const aprovadas = solicitacoesEquipe.filter((s) => s.status !== "PendenteGestor" && s.status !== "ReprovadoGestor").length;
    const reprovadasPorMim = solicitacoesEquipe.filter((s) => s.status === "ReprovadoGestor").length;
    const proximasOcorrencias = solicitacoesEquipe
      .filter((s) => s.status === "Aprovado" && serializeDate(s.dataInicio) >= hoje)
      .sort((a, b) => serializeDate(a.dataInicio).localeCompare(serializeDate(b.dataInicio)))
      .slice(0, 5)
      .map((s) => ({ pjNome: s.pj.nome, dataInicio: serializeDate(s.dataInicio), dataFim: serializeDate(s.dataFim) }));

    return res.json({
      perfil,
      indicadores: [
        { label: "PJs na sua equipe", valor: pjsDaEquipe },
        { label: "Aguardando sua aprovação", valor: pendentes },
        { label: "Aprovadas por você", valor: aprovadas },
        { label: "Reprovadas por você", valor: reprovadasPorMim },
      ],
      proximasOcorrencias,
    });
  }

  // PJ
  const minhas = await prisma.solicitacao.findMany({ where: { pjId: req.usuario.id } });
  const pendentes = minhas.filter((s) => s.status === "PendenteGestor" || s.status === "PendenteAdmin").length;
  const aprovadas = minhas.filter((s) => s.status === "Aprovado").length;
  const recusadas = minhas.filter((s) => s.status === "Reprovado" || s.status === "ReprovadoGestor").length;
  const proximasOcorrencias = minhas
    .filter((s) => s.status === "Aprovado" && serializeDate(s.dataInicio) >= hoje)
    .sort((a, b) => serializeDate(a.dataInicio).localeCompare(serializeDate(b.dataInicio)))
    .slice(0, 5)
    .map((s) => ({ dataInicio: serializeDate(s.dataInicio), dataFim: serializeDate(s.dataFim) }));

  const cycle = getCycle(serializeDate(req.usuario.dataContrato), hoje);
  const usage = cycleUsage(
    minhas.map((s) => ({ ...s, cicloInicio: serializeDate(s.cicloInicio) })),
    req.usuario.id,
    cycle.start,
    null
  );

  return res.json({
    perfil,
    indicadores: [
      { label: "Minhas solicitações", valor: minhas.length },
      { label: "Pendentes", valor: pendentes },
      { label: "Aprovadas", valor: aprovadas },
      { label: "Recusadas", valor: recusadas },
    ],
    proximasOcorrencias,
    ciclo: {
      inicio: cycle.start,
      fim: cycle.end,
      diasUsados: usage.dias,
      diasLimite: TETO_DIAS_UTEIS,
      periodosUsados: usage.periodos,
      periodosLimite: MAX_PERIODOS,
    },
  });
});

module.exports = router;
