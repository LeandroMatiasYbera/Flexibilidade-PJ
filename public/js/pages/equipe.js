(function(){
  "use strict";
  window.PortalPJ = window.PortalPJ || {};
  window.PortalPJ.pages = window.PortalPJ.pages || {};

  window.PortalPJ.pages.equipe = async function(){
    var esc = window.PortalPJ.flexHelpers.esc;
    var pjs = await api("/flexibilidade/pjs");
    var linhas = pjs.length === 0
      ? '<div class="empty">Nenhum PJ associado a você ainda. Peça para o ADM te associar na tela de Administração.</div>'
      : '<div class="tablewrap"><table><thead><tr><th>Nome</th><th>Cargo</th><th>Contratante</th><th>Contrato desde</th><th>Status</th></tr></thead><tbody>' +
        pjs.map(function(p){
          return "<tr><td>" + esc(p.nome) + "</td><td>" + esc(p.cargo || "—") + "</td><td>" + esc(p.contratante || "—") + "</td><td>" + window.PortalPJ.flexHelpers.fmtBR(p.dataContrato) + "</td><td>" + (p.ativo ? '<span class="badge ok">Ativo</span>' : '<span class="badge danger">Inativo</span>') + "</td></tr>";
        }).join("") + "</tbody></table></div>";

    return (
      '<div class="page-head"><h1>Minha Equipe</h1><p>PJs sob sua gestão.</p></div>' +
      '<div class="card">' + linhas + '</div>'
    );
  };
})();
