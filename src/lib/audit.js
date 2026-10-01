const { prisma } = require("../db");

// Log de auditoria append-only. Nunca lança se a escrita do log falhar sem
// ter certeza — mas também nunca deixa uma falha de log quebrar a ação
// principal que está sendo auditada.
async function registrarLog({ usuarioId, acao, entidade, entidadeId, valorAnterior, valorNovo }) {
  try {
    await prisma.logAuditoria.create({
      data: {
        usuarioId: usuarioId ?? null,
        acao,
        entidade: entidade ?? null,
        entidadeId: entidadeId != null ? String(entidadeId) : null,
        valorAnterior: valorAnterior != null ? JSON.stringify(valorAnterior) : null,
        valorNovo: valorNovo != null ? JSON.stringify(valorNovo) : null,
      },
    });
  } catch (err) {
    console.error("[audit] falha ao registrar log:", err.message);
  }
}

module.exports = { registrarLog };
