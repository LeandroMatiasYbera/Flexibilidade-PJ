const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { prisma } = require("../db");

const SESSION_COOKIE = "portal_pj_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error("JWT_SECRET ausente ou fraco — defina uma string longa e aleatória no .env");
  }
  return s;
}

// Cria uma sessão "de verdade" no servidor (tabela SessaoAtiva) e devolve um
// JWT que só carrega o ponteiro (`jti`) para ela — logout/troca de senha
// derrubam a sessão apagando essa linha, não só descartando o cookie.
async function criarSessao(usuario) {
  const jti = crypto.randomBytes(24).toString("hex");
  const expiraEm = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.sessaoAtiva.create({ data: { id: jti, usuarioId: usuario.id, expiraEm } });
  const token = jwt.sign({ sub: usuario.id, perfil: usuario.perfil.nome, jti }, secret(), {
    expiresIn: Math.floor(SESSION_TTL_MS / 1000),
  });
  return token;
}

function verifyToken(token) {
  try {
    return jwt.verify(token, secret());
  } catch (err) {
    return null;
  }
}

// Confirma que a sessão apontada pelo token ainda existe e não expirou.
// Retorna null se inválida — cobre logout e troca de senha (que apagam a
// linha) além da expiração natural.
async function sessaoValida(payload) {
  if (!payload || !payload.jti) return false;
  const sessao = await prisma.sessaoAtiva.findUnique({ where: { id: payload.jti } });
  if (!sessao || sessao.expiraEm < new Date()) return false;
  return true;
}

async function encerrarSessao(jti) {
  await prisma.sessaoAtiva.delete({ where: { id: jti } }).catch(() => {});
}

// Derruba TODOS os dispositivos logados de um usuário — usado na troca de
// senha (própria ou feita pelo ADM), conforme os requisitos.
async function encerrarTodasSessoes(usuarioId) {
  await prisma.sessaoAtiva.deleteMany({ where: { usuarioId } });
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

module.exports = {
  SESSION_COOKIE,
  criarSessao,
  verifyToken,
  sessaoValida,
  encerrarSessao,
  encerrarTodasSessoes,
  setSessionCookie,
  clearSessionCookie,
};
