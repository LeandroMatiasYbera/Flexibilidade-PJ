const express = require("express");
const { z } = require("zod");
const { prisma } = require("../db");
const { requireAuth, requirePermissao, bloquearSenhaProvisoria } = require("../lib/middleware");
const { registrarLog } = require("../lib/audit");
const {
  getCycle,
  businessDaysBetween,
  calendarDaysBetween,
  diffDays,
  cycleUsage,
  alertasSolicitacao,
  ANTECEDENCIA_MIN_DIAS,
  TETO_DIAS_UTEIS,
  MAX_PERIODOS,
} = require("../lib/cycle");

const router = express.Router();
router.use(requireAuth, bloquearSenhaProvisoria);

async function holidaySet() {
  const feriados = await prisma.feriado.findMany();
  return new Set(feriados.map((f) => f.data.toISOString().slice(0, 10)));
}

function serializeDate(d) {
  return d ? d.toISOString().slice(0, 10) : null;
}

function serializeSolicitacao(s) {
  return {
    id: s.id,
    pjId: s.pjId,
    pjNome: s.pj ? s.pj.nome : null,
    cargo: s.pj ? s.pj.cargo : null,
    gestorId: s.gestorId,
    gestorNome: s.gestor ? s.gestor.nome : null,
    dataComunicacao: serializeDate(s.dataComunicacao),
    dataInicio: serializeDate(s.dataInicio),
    dataFim: serializeDate(s.dataFim),
    diasCorridos: s.diasCorridos,
    diasUteis: s.diasUteis,
    cicloInicio: serializeDate(s.cicloInicio),
    cicloFim: serializeDate(s.cicloFim),
    numeroPeriodo: s.numeroPeriodo,
    antecedenciaDias: s.antecedenciaDias,
    antecedenciaCumprida: s.antecedenciaCumprida,
    atravessaCiclo: s.atravessaCiclo,
    coincide: s.coincide,
    coincideObs: s.coincideObs,
    status: s.status,
    decisaoGestor: s.decisaoGestor,
    decisaoGestorEm: s.decisaoGestorEm,
    decididoPorNome: s.decidido ? s.decidido.nome : null,
    dataDecisao: s.dataDecisao,
    criadoEm: s.criadoEm,
  };
}

// ---------- feriados ----------
router.get("/feriados", async (_req, res) => {
  const feriados = await prisma.feriado.findMany({ orderBy: { data: "asc" } });
  res.json(feriados.map((f) => ({ id: f.id, data: serializeDate(f.data), descricao: f.descricao, abrangencia: f.abrangencia })));
});

const feriadoSchema = z.object({
  data: z.string(),
  descricao: z.string().min(1),
  abrangencia: z.enum(["Nacional", "Estadual", "Municipal", "Recesso interno"]),
});

router.post("/feriados", requirePermissao("administracao"), async (req, res) => {
  const parsed = feriadoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: "Dados inválidos." });
  const f = await prisma.feriado.create({
    data: { data: new Date(parsed.data.data), descricao: parsed.data.descricao, abrangencia: parsed.data.abrangencia },
  });
  await registrarLog({ usuarioId: req.usuario.id, acao: "criou_feriado", entidade: "Feriado", entidadeId: f.id, valorNovo: parsed.data });
  res.status(201).json({ id: f.id });
});

router.delete("/feriados/:id", requirePermissao("administracao"), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.feriado.delete({ where: { id } }).catch(() => null);
  await registrarLog({ usuarioId: req.usuario.id, acao: "removeu_feriado", entidade: "Feriado", entidadeId: id });
  res.json({ ok: true });
});

// ---------- PJs (para seletor do ADM / lista da equipe do Gestor) ----------
// "PJ" aqui é quem tem contrato (dataContrato preenchido), não quem tem
// perfil RBAC "PJ" — um Gestor que também é PJ no cadastro antigo (contrato
// próprio) precisa aparecer nestas listas também.
router.get("/pjs", async (req, res) => {
  const where = { dataContrato: { not: null } };
  if (req.usuario.perfil.nome === "GESTOR") {
    where.gestorId = req.usuario.id;
  } else if (req.usuario.perfil.nome === "PJ") {
    where.id = req.usuario.id;
  }
  const pjs = await prisma.usuario.findMany({ where, orderBy: { nome: "asc" } });
  res.json(
    pjs.map((p) => ({
      id: p.id,
      nome: p.nome,
      cargo: p.cargo,
      contratante: p.contratante,
      dataContrato: serializeDate(p.dataContrato),
      gestorId: p.gestorId,
      ativo: p.ativo,
    }))
  );
});

// ---------- solicitações ----------
router.get("/solicitacoes", async (req, res) => {
  const where = {};
  if (req.usuario.perfil.nome === "PJ") {
    where.pjId = req.usuario.id;
  } else if (req.usuario.perfil.nome === "GESTOR") {
    // Um Gestor vê as solicitações da própria equipe (gestorId) e, quando
    // ele também tem contrato de PJ (dataContrato preenchido), as próprias
    // (pjId) — pessoa que acumula os dois papéis no cadastro antigo.
    where.OR = [{ gestorId: req.usuario.id }, { pjId: req.usuario.id }];
  }
  // ADM: sem filtro, vê tudo.
  const solicitacoes = await prisma.solicitacao.findMany({
    where,
    include: { pj: true, gestor: true, decidido: true },
    orderBy: { criadoEm: "desc" },
  });
  const hset = await holidaySet();
  const todas = await prisma.solicitacao.findMany();
  res.json(
    solicitacoes.map((s) => ({
      ...serializeSolicitacao(s),
      alertas: alertasSolicitacao(
        { ...s, cicloInicio: serializeDate(s.cicloInicio) },
        cycleUsage(
          todas.map((t) => ({ ...t, cicloInicio: serializeDate(t.cicloInicio) })),
          s.pjId,
          serializeDate(s.cicloInicio),
          s.id
        )
      ),
    }))
  );
});

const criarSolicitacaoSchema = z.object({
  pjId: z.number().int().positive().optional(), // só ADM pode informar outro PJ
  dataComunicacao: z.string(),
  dataInicio: z.string(),
  dataFim: z.string(),
  coincide: z.boolean().optional(),
  coincideObs: z.string().optional(),
});

router.post("/solicitacoes", async (req, res) => {
  const parsed = criarSolicitacaoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: "Dados inválidos." });
  const d = parsed.data;

  let pjId;
  if (req.usuario.perfil.nome === "PJ") {
    pjId = req.usuario.id;
  } else if (req.usuario.perfil.nome === "GESTOR") {
    // Gestor que também é PJ no cadastro antigo (tem contrato próprio)
    // lança a própria ausência normalmente; um gestor "puro" (sem
    // dataContrato) não tem cláusula 1.4 própria para invocar.
    if (!req.usuario.dataContrato) {
      return res.status(403).json({ erro: "Sua conta não tem contrato de PJ próprio — só é possível lançar em nome da equipe (ADM) ou de um contrato ativo." });
    }
    pjId = req.usuario.id;
  } else if (req.usuario.perfil.nome === "ADM") {
    if (!d.pjId) return res.status(400).json({ erro: "Informe o PJ em nome de quem está lançando." });
    pjId = d.pjId;
  } else {
    return res.status(403).json({ erro: "Perfil sem permissão para lançar solicitações." });
  }

  const pj = await prisma.usuario.findUnique({ where: { id: pjId } });
  if (!pj) return res.status(404).json({ erro: "PJ não encontrado." });

  if (new Date(d.dataFim) < new Date(d.dataInicio)) {
    return res.status(400).json({ erro: "A data final não pode ser antes da inicial." });
  }

  const hset = await holidaySet();
  const diasCorridos = calendarDaysBetween(d.dataInicio, d.dataFim);
  const diasUteis = businessDaysBetween(d.dataInicio, d.dataFim, hset);
  const cycle = getCycle(serializeDate(pj.dataContrato), d.dataInicio);
  const cycleFim = getCycle(serializeDate(pj.dataContrato), d.dataFim);
  const atravessaCiclo = cycle.start !== cycleFim.start;
  const antecedenciaDias = diffDays(d.dataInicio, d.dataComunicacao);
  const antecedenciaCumprida = antecedenciaDias >= ANTECEDENCIA_MIN_DIAS;

  const existentes = await prisma.solicitacao.findMany({ where: { pjId } });
  const usage = cycleUsage(
    existentes.map((s) => ({ ...s, cicloInicio: serializeDate(s.cicloInicio) })),
    pjId,
    cycle.start,
    null
  );
  const numeroPeriodo = usage.periodos + 1;

  const status = pj.gestorId ? "PendenteGestor" : "PendenteAdmin";

  const s = await prisma.solicitacao.create({
    data: {
      pjId,
      gestorId: pj.gestorId,
      dataComunicacao: new Date(d.dataComunicacao),
      dataInicio: new Date(d.dataInicio),
      dataFim: new Date(d.dataFim),
      diasCorridos,
      diasUteis,
      cicloInicio: new Date(cycle.start),
      cicloFim: new Date(cycle.end),
      numeroPeriodo,
      antecedenciaDias,
      antecedenciaCumprida,
      atravessaCiclo,
      coincide: !!d.coincide,
      coincideObs: d.coincideObs || null,
      status,
    },
  });

  await registrarLog({
    usuarioId: req.usuario.id,
    acao: "criou_solicitacao_flexibilidade",
    entidade: "Solicitacao",
    entidadeId: s.id,
    valorNovo: { pjId, dataInicio: d.dataInicio, dataFim: d.dataFim, status },
  });

  res.status(201).json({ id: s.id, status });
});

router.post("/solicitacoes/:id/decidir-gestor", requirePermissao("flexibilidade.equipe"), async (req, res) => {
  const id = Number(req.params.id);
  const decisao = req.body.decisao;
  if (decisao !== "Aprovado" && decisao !== "Reprovado") return res.status(400).json({ erro: "Decisão inválida." });

  const s = await prisma.solicitacao.findUnique({ where: { id } });
  if (!s) return res.status(404).json({ erro: "Solicitação não encontrada." });
  if (req.usuario.perfil.nome === "GESTOR" && s.gestorId !== req.usuario.id) {
    return res.status(403).json({ erro: "Esta solicitação não é da sua equipe." });
  }
  if (s.status !== "PendenteGestor") {
    return res.status(400).json({ erro: "Esta solicitação já saiu da etapa do gestor." });
  }

  const novoStatus = decisao === "Aprovado" ? "PendenteAdmin" : "ReprovadoGestor";
  await prisma.solicitacao.update({
    where: { id },
    data: { status: novoStatus, decisaoGestor: decisao, decisaoGestorPorId: req.usuario.id, decisaoGestorEm: new Date() },
  });
  await registrarLog({
    usuarioId: req.usuario.id,
    acao: "gestor_decidiu_solicitacao",
    entidade: "Solicitacao",
    entidadeId: id,
    valorAnterior: { status: s.status },
    valorNovo: { status: novoStatus },
  });
  res.json({ ok: true, status: novoStatus });
});

router.post("/solicitacoes/:id/decidir-admin", requirePermissao("administracao"), async (req, res) => {
  const id = Number(req.params.id);
  const decisao = req.body.decisao;
  if (decisao !== "Aprovado" && decisao !== "Reprovado") return res.status(400).json({ erro: "Decisão inválida." });

  const s = await prisma.solicitacao.findUnique({ where: { id } });
  if (!s) return res.status(404).json({ erro: "Solicitação não encontrada." });

  // O ADM tem autonomia para decidir em qualquer etapa (mesmo PendenteGestor)
  // e para rever uma decisão já tomada — ver Seção 4/10.1 dos requisitos.
  await prisma.solicitacao.update({
    where: { id },
    data: { status: decisao, decididoPorId: req.usuario.id, dataDecisao: new Date() },
  });
  await registrarLog({
    usuarioId: req.usuario.id,
    acao: "admin_decidiu_solicitacao",
    entidade: "Solicitacao",
    entidadeId: id,
    valorAnterior: { status: s.status },
    valorNovo: { status: decisao },
  });
  res.json({ ok: true, status: decisao });
});

// ---------- relatório (ADM) ----------
// Uso do ciclo atual por PJ + contagem de solicitações por status — a
// página "Relatórios" do menu do ADM (Seção 5 dos requisitos).
router.get("/relatorio", requirePermissao("relatorios"), async (_req, res) => {
  const [pjs, todas] = await Promise.all([
    prisma.usuario.findMany({ where: { dataContrato: { not: null } }, orderBy: { nome: "asc" } }),
    prisma.solicitacao.findMany(),
  ]);
  const hoje = serializeDate(new Date());
  const porPj = pjs.map((pj) => {
    const cycle = getCycle(serializeDate(pj.dataContrato), hoje);
    const usage = cycleUsage(
      todas.map((t) => ({ ...t, cicloInicio: serializeDate(t.cicloInicio) })),
      pj.id,
      cycle.start,
      null
    );
    return {
      pjId: pj.id,
      nome: pj.nome,
      cargo: pj.cargo,
      ativo: pj.ativo,
      cicloInicio: cycle.start,
      cicloFim: cycle.end,
      diasUsados: usage.dias,
      diasLimite: TETO_DIAS_UTEIS,
      periodosUsados: usage.periodos,
      periodosLimite: MAX_PERIODOS,
      estourado: usage.dias > TETO_DIAS_UTEIS || usage.periodos > MAX_PERIODOS,
    };
  });
  const porStatus = {};
  todas.forEach((s) => { porStatus[s.status] = (porStatus[s.status] || 0) + 1; });
  res.json({ porPj, porStatus, totalSolicitacoes: todas.length });
});

module.exports = router;
