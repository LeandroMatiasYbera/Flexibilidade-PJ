// Regras da Cláusula 1.4, portadas do artifact "Controle de Flexibilidade PJ":
// teto de 22 dias úteis por ciclo, máx. 2 períodos não consecutivos,
// antecedência mínima de 30 dias. Ciclo ancorado na data de assinatura do
// contrato (mês/dia), não no ano civil.

const TETO_DIAS_UTEIS = 22;
const MAX_PERIODOS = 2;
const ANTECEDENCIA_MIN_DIAS = 30;
const DEFAULT_CONTRACT_DATE = "2026-07-01";

function toUTC(dateStrOrDate) {
  if (dateStrOrDate instanceof Date) return dateStrOrDate;
  const [y, m, d] = dateStrOrDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(d) {
  return (
    d.getUTCFullYear() +
    "-" +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

function addDays(d, n) {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function diffDays(aStr, bStr) {
  return Math.round((toUTC(aStr) - toUTC(bStr)) / 86400000);
}

function isWeekend(d) {
  const w = d.getUTCDay();
  return w === 0 || w === 6;
}

function businessDaysBetween(startStr, endStr, holidaySet) {
  if (!startStr || !endStr) return 0;
  const start = toUTC(startStr);
  const end = toUTC(endStr);
  if (end < start) return 0;
  let count = 0;
  let cur = start;
  while (cur <= end) {
    if (!isWeekend(cur) && !holidaySet.has(fromUTC(cur))) count++;
    cur = addDays(cur, 1);
  }
  return count;
}

function calendarDaysBetween(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const d = diffDays(endStr, startStr) + 1;
  return d > 0 ? d : 0;
}

// ciclo = [inicio, fim], onde inicio tem o mesmo mês/dia do contrato e contém refDateStr
function getCycle(contractDateStr, refDateStr) {
  const contract = toUTC(contractDateStr || DEFAULT_CONTRACT_DATE);
  const ref = toUTC(refDateStr);
  const anchorMonth = contract.getUTCMonth();
  const anchorDay = contract.getUTCDate();
  const year = ref.getUTCFullYear();
  let cycleStart = new Date(Date.UTC(year, anchorMonth, anchorDay));
  if (cycleStart > ref) cycleStart = new Date(Date.UTC(year - 1, anchorMonth, anchorDay));
  const cycleEndExclusive = new Date(Date.UTC(cycleStart.getUTCFullYear() + 1, anchorMonth, anchorDay));
  const cycleEnd = addDays(cycleEndExclusive, -1);
  return { start: fromUTC(cycleStart), end: fromUTC(cycleEnd) };
}

// Uso do ciclo (períodos e dias úteis já lançados), excluindo reprovados e,
// opcionalmente, uma solicitação específica (para recalcular ao editar).
function cycleUsage(solicitacoes, pjId, cycleStart, excludeId) {
  let periodos = 0;
  let dias = 0;
  for (const s of solicitacoes) {
    if (s.pjId !== pjId) continue;
    if (excludeId && s.id === excludeId) continue;
    if (s.status === "Reprovado" || s.status === "ReprovadoGestor") continue;
    if (fromUTC(toUTC(s.cicloInicio)) !== cycleStart) continue;
    periodos++;
    dias += s.diasUteis || 0;
  }
  return { periodos, dias };
}

function alertasSolicitacao(s, usage) {
  const alerts = [];
  const totalDias = usage.dias + s.diasUteis;
  const totalPeriodos = usage.periodos + 1;
  if (totalDias > TETO_DIAS_UTEIS) alerts.push(`Saldo do ciclo estourado (${totalDias}/${TETO_DIAS_UTEIS})`);
  if (totalPeriodos > MAX_PERIODOS) alerts.push(`${totalPeriodos}º período no ciclo (limite ${MAX_PERIODOS})`);
  if (s.antecedenciaCumprida === false) alerts.push(`Antecedência de ${s.antecedenciaDias} dias (mín. ${ANTECEDENCIA_MIN_DIAS})`);
  if (s.atravessaCiclo) alerts.push("Atravessa a virada do ciclo — revisar manualmente");
  if (s.coincide) alerts.push("Coincide com outro gestor" + (s.coincideObs ? `: ${s.coincideObs}` : ""));
  return alerts;
}

module.exports = {
  TETO_DIAS_UTEIS,
  MAX_PERIODOS,
  ANTECEDENCIA_MIN_DIAS,
  DEFAULT_CONTRACT_DATE,
  toUTC,
  fromUTC,
  addDays,
  diffDays,
  businessDaysBetween,
  calendarDaysBetween,
  getCycle,
  cycleUsage,
  alertasSolicitacao,
};
