(function(){
  "use strict";
  window.PortalPJ = window.PortalPJ || {};
  window.PortalPJ.pages = window.PortalPJ.pages || {};

  window.PortalPJ.pages["minhas-solicitacoes"] = async function(eu){
    var todas = await api("/flexibilidade/solicitacoes");
    var ativas = todas.filter(function(s){ return !window.PortalPJ.flexHelpers.ehTerminal(s.status); });
    return (
      '<div class="page-head"><h1>Minhas Solicitações</h1><p>Suas programações de ausência ainda em andamento.</p></div>' +
      '<div class="card">' + window.PortalPJ.flexHelpers.tabelaSolicitacoes(eu, ativas) + '</div>'
    );
  };
})();
