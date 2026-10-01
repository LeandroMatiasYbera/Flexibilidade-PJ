(function(){
  "use strict";
  window.PortalPJ = window.PortalPJ || {};
  window.PortalPJ.pages = window.PortalPJ.pages || {};

  window.PortalPJ.pages.relatorios = async function(){
    var esc = window.PortalPJ.flexHelpers.esc;
    var r = await api("/flexibilidade/relatorio");

    var statusRows = Object.keys(r.porStatus).map(function(st){
      return '<div class="stat"><div class="num mono">' + r.porStatus[st] + '</div><div class="label">' + esc(st) + '</div></div>';
    }).join("");

    var pjRows = r.porPj.map(function(p){
      var pct = Math.min(100, Math.round((p.diasUsados / p.diasLimite) * 100));
      return "<tr>" +
        "<td>" + esc(p.nome) + "<div class=\"hint\" style=\"margin:0;\">" + esc(p.cargo || "") + "</div></td>" +
        "<td class=\"mono\">" + p.diasUsados + " / " + p.diasLimite + "</td>" +
        "<td class=\"mono\">" + p.periodosUsados + " / " + p.periodosLimite + "</td>" +
        "<td>" + p.cicloInicio + " – " + p.cicloFim + "</td>" +
        "<td>" + (p.estourado ? '<span class="badge danger">Estourado</span>' : '<span class="badge ok">Dentro do limite</span>') + "</td>" +
      "</tr>";
    }).join("");

    return (
      '<div class="page-head"><h1>Relatórios</h1><p>Uso da Cláusula 1.4 por PJ no ciclo atual, e solicitações por status.</p></div>' +
      '<div class="card"><h2>Solicitações por status</h2><div class="stat-row">' + statusRows + '</div></div>' +
      '<div class="card"><h2>Uso do ciclo atual por PJ</h2>' +
      '<div class="tablewrap"><table><thead><tr><th>PJ</th><th>Dias úteis</th><th>Períodos</th><th>Ciclo</th><th>Situação</th></tr></thead><tbody>' + pjRows + '</tbody></table></div>' +
      '</div>'
    );
  };
})();
