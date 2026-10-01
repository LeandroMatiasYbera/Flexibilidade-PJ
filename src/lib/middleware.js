const { prisma } = require("../db");
const { SESSION_COOKIE, verifyToken, sessaoValida } = require("./session");

// Bloqueia QUALQUER rota/API que não tenha sessão válida — a checagem roda
// no servidor a cada requisição, nunca só no frontend. Also protects against
// a stale/expired session pointing at a deleted or deactivated account.
async function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return res.status(401).json({ erro: "Sessão inválida ou expirada. Faça login novamente." });
  }
  // Sessão "invalidada no servidor" de verdade: logout apaga a linha
  // SessaoAtiva deste dispositivo, troca de senha apaga as de todos os
  // dispositivos — nos dois casos o token para de funcionar imediatamente,
  // mesmo que ainda não tenha expirado.
  if (!(await sessaoValida(payload))) {
    return res.status(401).json({ erro: "Sessão encerrada. Faça login novamente." });
  }
  const usuario = await prisma.usuario.findUnique({
    where: { id: payload.sub },
    include: { perfil: true },
  });
  if (!usuario || !usuario.ativo) {
    return res.status(401).json({ erro: "Conta inexistente ou desativada." });
  }
  req.usuario = usuario;
  req.sessaoJti = payload.jti;
  next();
}

// Autorização por perfil — validada no servidor. Uma rota como
// requireRole("ADM") nunca é a única defesa: cada handler ainda deve
// confirmar, quando aplicável, que o registro pedido pertence a quem pediu
// (ver rotas de flexibilidade e de administração).
function requireRole(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !perfisPermitidos.includes(req.usuario.perfil.nome)) {
      return res.status(403).json({ erro: "Você não tem permissão para acessar este recurso." });
    }
    next();
  };
}

// Autorização por PERMISSÃO (tabela `permissoes`, não nome de perfil fixo no
// código) — um perfil novo criado no futuro só precisa de linhas na tabela
// para ganhar acesso a um módulo, sem alterar nenhuma rota.
function requirePermissao(funcionalidade) {
  return async (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ erro: "Sessão inválida." });
    const tem = await prisma.permissao.findUnique({
      where: { perfilId_funcionalidade: { perfilId: req.usuario.perfilId, funcionalidade } },
    });
    if (!tem) {
      return res.status(403).json({ erro: "Você não tem permissão para acessar este recurso." });
    }
    next();
  };
}

// Trava de senha provisória: aplicada em todo router exceto o de auth. Uma
// conta criada/redefinida com a senha padrão de primeiro acesso consegue
// autenticar (requireAuth passa), mas não acessa nenhum outro dado até
// trocar a própria senha — reforçado no servidor, não só escondido na tela.
function bloquearSenhaProvisoria(req, res, next) {
  if (req.usuario && req.usuario.senhaProvisoria) {
    return res.status(403).json({ erro: "Defina sua própria senha antes de continuar.", senhaProvisoria: true });
  }
  next();
}

module.exports = { requireAuth, requireRole, requirePermissao, bloquearSenhaProvisoria };
