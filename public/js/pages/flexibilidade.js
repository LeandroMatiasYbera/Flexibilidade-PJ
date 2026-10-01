(function(){
  "use strict";
  window.PortalPJ = window.PortalPJ || {};
  window.PortalPJ.pages = window.PortalPJ.pages || {};

  function esc(s){ return window.PortalPJ.flexHelpers.esc(s); }

  var state = { pjs: [], solicitacoes: [] };

  function formLancarHtml(eu){
    var seletorPj = "";
    if(eu.perfil === "ADM"){
      var opts = state.pjs.map(function(p){ return '<option value="' + p.id + '">' + esc(p.nome) + " — " + esc(p.cargo || "") + '</option>'; }).join("");
      seletorPj = '<div class="field"><label for="f-pj">PJ (lançamento em nome de)</label><select id="f-pj">' + opts + '</select></div>';
    }
    return (
      '<div class="card"><h2>Programar uma ausência</h2>' +
      '<p class="hint">Cláusula 1.4 — até 22 dias úteis por ciclo, em no máx. 2 períodos, com 30 dias de antecedência.</p>' +
      seletorPj +
      '<div class="field"><label for="f-comunicacao">Data da comunicação prévia</label><input type="date" id="f-comunicacao"></div>' +
      '<div class="grid-2"><div class="field"><label for="f-inicio">Início do período</label><input type="date" id="f-inicio"></div>' +
      '<div class="field"><label for="f-fim">Fim do período</label><input type="date" id="f-fim"></div></div>' +
      '<button type="button" class="btn" id="btn-lancar" style="width:auto;">Enviar programação</button>' +
      '</div>'
    );
  }

  function feriadosHtml(){
    return (
      '<div class="card"><h2>Calendário de feriados e recessos</h2>' +
      '<p class="hint">Dias sem expediente contam como flexibilizados e são descontados do cálculo de dias úteis.</p>' +
      '<div class="grid-3"><div class="field"><label for="fer-data">Data</label><input type="date" id="fer-data"></div>' +
      '<div class="field"><label for="fer-desc">Descrição</label><input type="text" id="fer-desc"></div>' +
      '<div class="field"><label for="fer-abr">Abrangência</label><select id="fer-abr"><option>Nacional</option><option>Estadual</option><option>Municipal</option><option>Recesso interno</option></select></div></div>' +
      '<button type="button" class="btn secondary" id="btn-add-feriado" style="width:auto;">Adicionar data</button>' +
      '<div id="lista-feriados" style="margin-top:14px;"></div>' +
      '</div>'
    );
  }

  var CLAUSULA_HTML =
    '<div class="card"><h2>Cláusula 1.4 — Flexibilidade na Prestação dos Serviços</h2>' +
    '<p class="hint" style="margin-bottom:0;">A CONTRATADA pode suspender voluntariamente a execução dos serviços por até <b>22 dias úteis por ciclo contratual</b>, em no máximo <b>2 períodos não consecutivos</b>, mediante comunicação prévia com <b>antecedência mínima de 30 dias</b>. Dias sem expediente da CONTRATANTE dentro do período contam automaticamente como dias flexibilizados. Sem desconto na contraprestação; sem acúmulo de saldo para o ciclo seguinte.</p></div>';

  window.PortalPJ.pages.flexibilidade = async function(eu){
    // Gestor não lança/lista o time aqui — isso vive em "Solicitações"/
    // "Histórico" (Seção 5 dos requisitos). Mas um Gestor que também tem
    // contrato de PJ próprio (cadastro antigo acumulava os dois papéis)
    // ainda precisa lançar a PRÓPRIA ausência — mesmo formulário do PJ,
    // sem seletor (é sempre para si mesmo).
    if(eu.perfil === "GESTOR"){
      var formProprio = eu.temContratoProprio ? formLancarHtml(eu) : "";
      return '<div class="page-head"><h1>Flexibilidade</h1></div>' + CLAUSULA_HTML + formProprio;
    }

    var reqs = [api("/flexibilidade/solicitacoes")];
    if(eu.perfil === "ADM") reqs.push(api("/flexibilidade/pjs"));
    var results = await Promise.all(reqs);
    state.solicitacoes = results[0];
    state.pjs = eu.perfil === "ADM" ? results[1] : [];

    if(eu.perfil === "PJ"){
      // Para o PJ, a lista de solicitações mora em "Minhas Solicitações" /
      // "Histórico" — aqui só o formulário de lançar.
      return '<div class="page-head"><h1>Flexibilidade</h1></div>' + CLAUSULA_HTML + formLancarHtml(eu);
    }

    // ADM: hub completo — lançar em nome de qualquer PJ, ver tudo, feriados.
    return (
      '<div class="page-head"><h1>Flexibilidade PJ (Cláusula 1.4)</h1></div>' +
      formLancarHtml(eu) +
      '<div class="card"><h2>Todas as solicitações</h2>' + window.PortalPJ.flexHelpers.tabelaSolicitacoes(eu, state.solicitacoes) + '</div>' +
      feriadosHtml()
    );
  };

  async function recarregar(){
    var html = await window.PortalPJ.pages.flexibilidade(window.PortalPJ.eu);
    document.getElementById("main").innerHTML = html;
    window.PortalPJ.pages.flexibilidadeMount(window.PortalPJ.eu);
  }

  async function renderFeriadosLista(){
    var el = document.getElementById("lista-feriados");
    if(!el) return;
    var feriados = await api("/flexibilidade/feriados");
    if(feriados.length === 0){ el.innerHTML = '<p class="hint">Nenhum feriado cadastrado ainda.</p>'; return; }
    el.innerHTML = feriados.map(function(f){
      return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">' +
        '<span>' + window.PortalPJ.flexHelpers.fmtBR(f.data) + ' — ' + esc(f.descricao) + ' <span class="hint">(' + esc(f.abrangencia) + ')</span></span>' +
        '<button type="button" class="linklike" data-del-feriado="' + f.id + '">Remover</button></div>';
    }).join("");
    el.querySelectorAll("[data-del-feriado]").forEach(function(btn){
      btn.addEventListener("click", async function(){
        await api("/flexibilidade/feriados/" + btn.dataset.delFeriado, { method: "DELETE" });
        renderFeriadosLista();
      });
    });
  }

  window.PortalPJ.pages.flexibilidadeMount = function(eu){
    window.PortalPJ.eu = eu;

    var btnLancar = document.getElementById("btn-lancar");
    if(btnLancar){
      btnLancar.addEventListener("click", async function(){
        var body = {
          dataComunicacao: document.getElementById("f-comunicacao").value,
          dataInicio: document.getElementById("f-inicio").value,
          dataFim: document.getElementById("f-fim").value,
        };
        var pjSel = document.getElementById("f-pj");
        if(pjSel) body.pjId = Number(pjSel.value);
        if(!body.dataComunicacao || !body.dataInicio || !body.dataFim){
          window.PortalPJ.toast("Preencha as três datas.");
          return;
        }
        try{
          await api("/flexibilidade/solicitacoes", { method: "POST", body: body });
          window.PortalPJ.toast("Programação enviada.");
          recarregar();
        }catch(err){ window.PortalPJ.toast(err.message); }
      });
    }

    window.PortalPJ.flexHelpers.bindAcoes(eu, recarregar);

    var btnAddFeriado = document.getElementById("btn-add-feriado");
    if(btnAddFeriado){
      btnAddFeriado.addEventListener("click", async function(){
        var body = {
          data: document.getElementById("fer-data").value,
          descricao: document.getElementById("fer-desc").value.trim(),
          abrangencia: document.getElementById("fer-abr").value,
        };
        if(!body.data || !body.descricao){ window.PortalPJ.toast("Preencha data e descrição."); return; }
        try{
          await api("/flexibilidade/feriados", { method: "POST", body: body });
          window.PortalPJ.toast("Feriado adicionado.");
          document.getElementById("fer-data").value = "";
          document.getElementById("fer-desc").value = "";
          renderFeriadosLista();
        }catch(err){ window.PortalPJ.toast(err.message); }
      });
      renderFeriadosLista();
    }
  };
})();
