const express = require("express");
const { z } = require("zod");
const { prisma } = require("../db");
const { requireAuth, requirePermissao, bloquearSenhaProvisoria } = require("../lib/middleware");
const { registrarLog } = require("../lib/audit");

const router = express.Router();

// Dossiê PJ é exclusivo de quem tem a permissão "dossie" (tabela
// `permissoes`, hoje só o perfil ADM) — a checagem roda no servidor em toda
// requisição desta API, então digitar a rota direto na URL do frontend nunca
// devolve o conteúdo dos documentos para quem não tem essa permissão.
router.use(requireAuth, bloquearSenhaProvisoria, requirePermissao("dossie"));

// Busca por título (Seção 10.2 dos requisitos): ?q=termo filtra client-side
// seria inseguro expor todo o conteúdo só pra filtrar depois — o filtro roda
// no servidor, sobre os títulos, e devolve só os que combinam.
router.get("/documentos", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const where = q ? { titulo: { contains: q } } : {};
  const docs = await prisma.documento.findMany({ where, orderBy: [{ categoria: "asc" }, { ordem: "asc" }] });
  res.json(
    docs.map((d) => ({
      id: d.id,
      titulo: d.titulo,
      categoria: d.categoria,
      ordem: d.ordem,
      confidencial: d.confidencial,
      atualizadoEm: d.atualizadoEm,
    }))
  );
});

router.get("/documentos/:id", async (req, res) => {
  const doc = await prisma.documento.findUnique({ where: { id: Number(req.params.id) } });
  if (!doc) return res.status(404).json({ erro: "Documento não encontrado." });
  res.json(doc);
});

const docSchema = z.object({
  titulo: z.string().min(1),
  categoria: z.enum(["metodologia", "auditorias", "analises", "resumos", "ferramentas"]),
  ordem: z.number().int().optional(),
  confidencial: z.boolean().optional(),
  conteudoMarkdown: z.string().min(1),
});

router.post("/documentos", async (req, res) => {
  const parsed = docSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: "Dados inválidos." });
  const doc = await prisma.documento.create({
    data: { ...parsed.data, ordem: parsed.data.ordem ?? 1, confidencial: !!parsed.data.confidencial },
  });
  await registrarLog({ usuarioId: req.usuario.id, acao: "criou_documento_dossie", entidade: "Documento", entidadeId: doc.id, valorNovo: { titulo: doc.titulo } });
  res.status(201).json({ id: doc.id });
});

router.patch("/documentos/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = docSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: "Dados inválidos." });
  const antes = await prisma.documento.findUnique({ where: { id } });
  if (!antes) return res.status(404).json({ erro: "Documento não encontrado." });
  await prisma.documento.update({ where: { id }, data: parsed.data });
  await registrarLog({
    usuarioId: req.usuario.id,
    acao: "editou_documento_dossie",
    entidade: "Documento",
    entidadeId: id,
    valorAnterior: { titulo: antes.titulo },
    valorNovo: parsed.data,
  });
  res.json({ ok: true });
});

router.delete("/documentos/:id", async (req, res) => {
  const id = Number(req.params.id);
  const doc = await prisma.documento.findUnique({ where: { id } });
  if (!doc) return res.status(404).json({ erro: "Documento não encontrado." });
  await prisma.documento.delete({ where: { id } });
  await registrarLog({ usuarioId: req.usuario.id, acao: "excluiu_documento_dossie", entidade: "Documento", entidadeId: id, valorAnterior: { titulo: doc.titulo } });
  res.json({ ok: true });
});

module.exports = router;
