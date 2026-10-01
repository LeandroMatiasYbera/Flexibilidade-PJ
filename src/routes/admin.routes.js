const express = require("express");
const { z } = require("zod");
const { prisma } = require("../db");
const { requireAuth, requirePermissao, bloquearSenhaProvisoria } = require("../lib/middleware");
const { registrarLog } = require("../lib/audit");
const { hashPassword } = require("../lib/hash");
const { encerrarTodasSessoes } = require("../lib/session");
const { SENHA_PADRAO_PRIMEIRO_ACESSO } = require("../lib/config");

const router = express.Router();

// Autorização por PERMISSÃO (tabela `permissoes`), não por nome de perfil
// fixo no código — hoje só ADM tem essas permissões, mas a checagem em si
// não sabe disso: um perfil novo ganharia acesso só com uma linha na tabela.
router.use(requireAuth, bloquearSenhaProvisoria);

router.get("/perfis", requirePermissao("administracao"), async (_req, res) => {
  const perfis = await prisma.perfil.findMany({ orderBy: { id: "asc" } });
  res.json(perfis);
});

router.get("/usuarios", requirePermissao("administracao"), async (_req, res) => {
  const usuarios = await prisma.usuario.findMany({
    include: { perfil: true, gestor: true },
    orderBy: { nome: "asc" },
  });
  res.json(
    usuarios.map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      perfil: u.perfil.nome,
      gestor: u.gestor ? { id: u.gestor.id, nome: u.gestor.nome } : null,
      cargo: u.cargo,
      contratante: u.contratante,
      dataContrato: u.dataContrato,
      ativo: u.ativo,
      ultimoAcessoEm: u.ultimoAcessoEm,
      criadoEm: u.criadoEm,
    }))
  );
});

const criarUsuarioSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  perfil: z.enum(["ADM", "GESTOR", "PJ"]),
  gestorId: z.number().int().positive().nullable().optional(),
  cargo: z.string().optional().nullable(),
  contratante: z.enum(["B2C", "GYP"]).optional().nullable(),
  dataContrato: z.string().optional().nullable(),
});

// Toda conta nova nasce com a senha padrão de primeiro acesso e
// `senhaProvisoria: true` — a pessoa consegue logar, mas nada além de
// trocar a própria senha responde até ela definir uma nova (ver
// bloquearSenhaProvisoria). Não existe mais campo de "senha inicial" digitada
// pelo ADM — evita o próprio ADM escolhendo/sabendo a senha real de alguém.
router.post("/usuarios", requirePermissao("administracao"), async (req, res) => {
  const parsed = criarUsuarioSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erro: parsed.error.issues[0]?.message || "Dados inválidos." });
  }
  const d = parsed.data;
  const perfil = await prisma.perfil.findUnique({ where: { nome: d.perfil } });
  if (!perfil) return res.status(400).json({ erro: "Perfil inválido." });

  const existente = await prisma.usuario.findUnique({ where: { email: d.email.toLowerCase().trim() } });
  if (existente) return res.status(409).json({ erro: "Já existe um usuário com este e-mail." });

  const senhaHash = await hashPassword(SENHA_PADRAO_PRIMEIRO_ACESSO);
  const usuario = await prisma.usuario.create({
    data: {
      nome: d.nome,
      email: d.email.toLowerCase().trim(),
      senhaHash,
      senhaProvisoria: true,
      perfilId: perfil.id,
      gestorId: d.gestorId ?? null,
      cargo: d.cargo ?? null,
      contratante: d.contratante ?? null,
      dataContrato: d.dataContrato ? new Date(d.dataContrato) : null,
    },
  });

  await registrarLog({
    usuarioId: req.usuario.id,
    acao: "criou_usuario",
    entidade: "Usuario",
    entidadeId: usuario.id,
    valorNovo: { nome: usuario.nome, email: usuario.email, perfil: d.perfil },
  });

  res.status(201).json({ id: usuario.id, senhaPadrao: SENHA_PADRAO_PRIMEIRO_ACESSO });
});

const editarUsuarioSchema = z.object({
  nome: z.string().min(2).optional(),
  email: z.string().email().optional(),
  perfil: z.enum(["ADM", "GESTOR", "PJ"]).optional(),
  gestorId: z.number().int().positive().nullable().optional(),
  cargo: z.string().nullable().optional(),
  contratante: z.enum(["B2C", "GYP"]).nullable().optional(),
  dataContrato: z.string().nullable().optional(),
  ativo: z.boolean().optional(),
});

// Edição de qualquer campo do cadastro — só o ADM chega aqui
// (requirePermissao("administracao") acima). Inclui e-mail, que antes só
// dava para definir na criação da conta.
router.patch("/usuarios/:id", requirePermissao("administracao"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = editarUsuarioSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues[0]?.message || "Dados inválidos." });
  const antes = await prisma.usuario.findUnique({ where: { id }, include: { perfil: true } });
  if (!antes) return res.status(404).json({ erro: "Usuário não encontrado." });

  const d = parsed.data;
  const data = {};
  if (d.nome !== undefined) data.nome = d.nome;
  if (d.gestorId !== undefined) data.gestorId = d.gestorId;
  if (d.cargo !== undefined) data.cargo = d.cargo;
  if (d.contratante !== undefined) data.contratante = d.contratante;
  if (d.dataContrato !== undefined) data.dataContrato = d.dataContrato ? new Date(d.dataContrato) : null;
  if (d.ativo !== undefined) data.ativo = d.ativo;
  if (d.email !== undefined) {
    const emailNorm = d.email.toLowerCase().trim();
    const existente = await prisma.usuario.findUnique({ where: { email: emailNorm } });
    if (existente && existente.id !== id) return res.status(409).json({ erro: "Já existe um usuário com este e-mail." });
    data.email = emailNorm;
  }
  if (d.perfil !== undefined) {
    const perfil = await prisma.perfil.findUnique({ where: { nome: d.perfil } });
    if (!perfil) return res.status(400).json({ erro: "Perfil inválido." });
    data.perfilId = perfil.id;
  }
  if (id === req.usuario.id && d.perfil && d.perfil !== "ADM") {
    return res.status(400).json({ erro: "Você não pode remover o próprio perfil de ADM." });
  }
  if (id === req.usuario.id && d.ativo === false) {
    return res.status(400).json({ erro: "Você não pode desativar a própria conta." });
  }

  const depois = await prisma.usuario.update({ where: { id }, data, include: { perfil: true } });

  await registrarLog({
    usuarioId: req.usuario.id,
    acao: "editou_usuario",
    entidade: "Usuario",
    entidadeId: id,
    valorAnterior: { nome: antes.nome, email: antes.email, perfil: antes.perfil.nome, ativo: antes.ativo, gestorId: antes.gestorId, cargo: antes.cargo, contratante: antes.contratante, dataContrato: antes.dataContrato },
    valorNovo: { nome: depois.nome, email: depois.email, perfil: depois.perfil.nome, ativo: depois.ativo, gestorId: depois.gestorId, cargo: depois.cargo, contratante: depois.contratante, dataContrato: depois.dataContrato },
  });

  res.json({ ok: true });
});

// Redefinição de senha feita pelo ADM diretamente pela tela — sem token,
// sem e-mail. Volta para a senha padrão de primeiro acesso e marca
// `senhaProvisoria: true` de novo, forçando a pessoa a definir uma nova
// senha própria assim que entrar — o ADM nunca escolhe/sabe a senha real
// de outra pessoa.
router.post("/usuarios/:id/redefinir-senha", requirePermissao("administracao"), async (req, res) => {
  const id = Number(req.params.id);
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });

  const senhaHash = await hashPassword(SENHA_PADRAO_PRIMEIRO_ACESSO);
  await prisma.usuario.update({
    where: { id },
    data: { senhaHash, senhaProvisoria: true, loginFalhasSeguidas: 0, bloqueadoAte: null },
  });
  // Redefinição de senha invalida sessões abertas anteriores dessa pessoa
  // (todos os dispositivos onde ela estava logada).
  await encerrarTodasSessoes(id);

  await registrarLog({ usuarioId: req.usuario.id, acao: "redefiniu_senha_de_outro", entidade: "Usuario", entidadeId: id });
  res.json({ ok: true, mensagem: "Senha voltou para a padrão de primeiro acesso.", senhaPadrao: SENHA_PADRAO_PRIMEIRO_ACESSO });
});

router.delete("/usuarios/:id", requirePermissao("administracao"), async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.usuario.id) return res.status(400).json({ erro: "Você não pode excluir a própria conta." });
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });

  await prisma.usuario.delete({ where: { id } });
  await registrarLog({
    usuarioId: req.usuario.id,
    acao: "excluiu_usuario",
    entidade: "Usuario",
    entidadeId: id,
    valorAnterior: { nome: usuario.nome, email: usuario.email },
  });
  res.json({ ok: true });
});

router.get("/logs", requirePermissao("logs"), async (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 100, 500);
  const logs = await prisma.logAuditoria.findMany({
    include: { usuario: true },
    orderBy: { criadoEm: "desc" },
    take: limite,
  });
  res.json(
    logs.map((l) => ({
      id: l.id,
      usuario: l.usuario ? l.usuario.nome : null,
      acao: l.acao,
      entidade: l.entidade,
      entidadeId: l.entidadeId,
      valorAnterior: l.valorAnterior ? JSON.parse(l.valorAnterior) : null,
      valorNovo: l.valorNovo ? JSON.parse(l.valorNovo) : null,
      criadoEm: l.criadoEm,
    }))
  );
});

module.exports = router;
