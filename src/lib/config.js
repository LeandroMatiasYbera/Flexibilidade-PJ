// Senha padrão de primeiro acesso — toda conta criada pelo ADM ou por um
// import de dados nasce com ela e com `senhaProvisoria: true`, o que bloqueia
// qualquer rota além de auth/me/logout/trocar-senha (ver
// bloquearSenhaProvisoria em src/lib/middleware.js) até a pessoa definir a
// própria senha. Pode ser trocada via variável de ambiente antes de importar
// dados reais em produção.
const SENHA_PADRAO_PRIMEIRO_ACESSO = process.env.SENHA_PADRAO_PRIMEIRO_ACESSO || "TrocarSenha123!";

module.exports = { SENHA_PADRAO_PRIMEIRO_ACESSO };
