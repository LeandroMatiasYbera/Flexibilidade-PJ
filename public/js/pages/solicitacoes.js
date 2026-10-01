(function(){
  "use strict";
  window.PortalPJ = window.PortalPJ || {};
  window.PortalPJ.pages = window.PortalPJ.pages || {};

  window.PortalPJ.pages.solicitacoes = async function(eu){
    var todas = await api("/flexibilidade/solicitacoes");
    var pendentes = todas.filter(function(s){ return !window.PortalPJ.flexHelpers.ehTerminal(s.status); });
    return (
      '<div class="page-head"><h1>Solicitações</h1><p>Pedidos de flexibilidade da sua equipe, em qualquer etapa aberta.</p></div>' +
      '<div class="card">' + window.PortalPJ.flexHelpers.tabelaSolicitacoes(eu, pendentes) + '</div>'
    );
  };

  window.PortalPJ.pages.solicitacoesMount = function(eu){
    window.PortalPJ.eu = eu;
    window.PortalPJ.flexHelpers.bindAcoes(eu, async function(){
      var html = await window.PortalPJ.pages.solicitacoes(eu);
      document.getElementById("main").innerHTML = html;
      window.PortalPJ.pages.solicitacoesMount(eu);
    });
  };
})();
