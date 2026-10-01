const express = require("express");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const { prisma } = require("../db");
const { hashPassword, verifyPassword } = require("../lib/hash");
const { criarSessao, setSessionCookie, clearSessionCookie, encerrarSessao, encerrarTodasSessoes } = require("../lib/session");
const { requireAuth } = require("../lib/middleware");
const { registrarLog } = require("../lib/audit");

const router = express.Router();

const MAX_TENTATIVAS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const JANELA_MINUTOS = Number(process.env.LOGIN_WINDOW_MINUTES || 15);

// Limite de tentativas por IP, em cima do bloqueio por conta abaixo — defesa
// em duas camadas contra força bruta (bloquear só por conta permite testar
// muitas contas diferentes do mesmo IP; só por IP permite testar uma conta
// de muitos IPs).
const loginRateLimiter = rateLimit({
  windowMs: JANELA_MINUTOS * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas de login deste endereço. Tente novamente mais tarde." },
});

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

router.post("/login", loginRateLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const senha = parsed.data.senha;

  const usuario = await prisma.usuario.findUnique({ where: { email }, include: { perfil: true } });

  // Mensagem de erro idêntica para "não existe" e "senha errada" — evita
  // que alguém descubra, por tentativa e erro, quais e-mails têm conta.
  const ERRO_GENERICO = { erro: "E-mail ou senha inválidos." };

  if (!usuario) {
    return res.status(401).json(ERRO_GENERICO);
  }
  if (!usuario.ativo) {
    return res.status(403).json({ erro: "Esta conta está desativada. Fale com o administrador." });
  }
  if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
    return res.status(429).json({ erro: "Conta temporariamente bloqueada por várias tentativas incorretas. Tente novamente mais tarde." });
  }

  const senhaOk = await verifyPassword(senha, usuario.senhaHash);
  if (!senhaOk) {
    const falhas = usuario.loginFalhasSeguidas + 1;
    const dadosBloqueio =
      falhas >= MAX_TENTATIVAS
        ? { loginFalhasSeguidas: 0, bloqueadoAte: new Date(Date.now() + JANELA_MINUTOS * 60 * 1000) }
        : { loginFalhasSeguidas: falhas };
    await prisma.usuario.update({ where: { id: usuario.id }, data: dadosBloqueio });
    await registrarLog({ usuarioId: usuario.id, acao: "login_falhou", entidade: "Usuario", entidadeId: usuario.id });
    return res.status(401).json(ERRO_GENERICO);
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { loginFalhasSeguidas: 0, bloqueadoAte: null, ultimoAcessoEm: new Date() },
  });

  const token = await criarSessao(usuario);
  setSessionCookie(res, token);
  await registrarLog({ usuarioId: usuario.id, acao: "login", entidade: "Usuario", entidadeId: usuario.id });

  res.json({
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil.nome,
      senhaProvisoria: usuario.senhaProvisoria,
    },
  });
});

router.post("/logout", requireAuth, async (req, res) => {
  await encerrarSessao(req.sessaoJti);
  await registrarLog({ usuarioId: req.usuario.id, acao: "logout", entidade: "Usuario", entidadeId: req.usuario.id });
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const u = req.usuario;
  const permissoes = await prisma.permissao.findMany({ where: { perfilId: u.perfilId } });
  res.json({
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil.nome,
    permissoes: permissoes.map((p) => p.funcionalidade),
    ehGestor: (await prisma.usuario.count({ where: { gestorId: u.id } })) > 0,
    // true quando o Gestor também tem contrato de PJ próprio (cadastro
    // antigo permitia acumular os dois papéis) — libera o formulário de
    // lançar a própria ausência mesmo sendo perfil GESTOR.
    temContratoProprio: !!u.dataContrato,
    senhaProvisoria: u.senhaProvisoria,
  });
});

// Troca de senha 100% dentro do próprio HTML — sem token, sem e-mail. A
// pessoa já está autenticada (tem sessão válida) e precisa confirmar a
// senha ATUAL antes de definir a nova, o que substitui a prova de
// identidade que um token de e-mail daria.
const trocarSenhaSchema = z.object({
  senhaAtual: z.string().min(1),
  novaSenha: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres."),
});

router.post("/trocar-senha", requireAuth, async (req, res) => {
  const parsed = trocarSenhaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erro: parsed.error.issues[0]?.message || "Dados inválidos." });
  }
  const { senhaAtual, novaSenha } = parsed.data;
  const ok = await verifyPassword(senhaAtual, req.usuario.senhaHash);
  if (!ok) return res.status(401).json({ erro: "Senha atual incorreta." });

  const senhaHash = await hashPassword(novaSenha);
  await prisma.usuario.update({
    where: { id: req.usuario.id },
    data: { senhaHash, loginFalhasSeguidas: 0, bloqueadoAte: null, senhaProvisoria: false },
  });
  // Derruba todas as sessões abertas (qualquer dispositivo) e cria uma nova
  // só para quem trocou a senha, para ele continuar logado nesta aba.
  await encerrarTodasSessoes(req.usuario.id);
  const novoToken = await criarSessao(req.usuario);
  setSessionCookie(res, novoToken);
  await registrarLog({ usuarioId: req.usuario.id, acao: "trocou_propria_senha", entidade: "Usuario", entidadeId: req.usuario.id });

  res.json({ ok: true, mensagem: "Senha alterada. Você continua logado aqui; outros dispositivos precisarão entrar de novo." });
});

module.exports = router;
