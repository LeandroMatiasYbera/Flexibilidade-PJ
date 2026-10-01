(function(){
  "use strict";
  window.PortalPJ = window.PortalPJ || {};
  window.PortalPJ.pages = window.PortalPJ.pages || {};

  window.PortalPJ.pages.historico = async function(eu){
    var todas = await api("/flexibilidade/solicitacoes");
    var decididas = todas.filter(function(s){ return window.PortalPJ.flexHelpers.ehTerminal(s.status); });
    var titulo = eu.perfil === "GESTOR" ? "Histórico da equipe" : "Histórico";
    return (
      '<div class="page-head"><h1>' + titulo + '</h1><p>Solicitações já decididas.</p></div>' +
      '<div class="card">' + window.PortalPJ.flexHelpers.tabelaSolicitacoes(eu, decididas) + '</div>'
    );
  };
})();
