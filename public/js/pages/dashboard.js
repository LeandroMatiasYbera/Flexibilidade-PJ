(function(){
  "use strict";
  window.PortalPJ = window.PortalPJ || {};
  window.PortalPJ.pages = window.PortalPJ.pages || {};

  function esc(s){ var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  function fmtBR(iso){ return window.PortalPJ.flexHelpers ? window.PortalPJ.flexHelpers.fmtBR(iso) : iso; }
  function fmtDT(iso){ if(!iso) return "—"; var d = new Date(iso); return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"}); }

  window.PortalPJ.pages.dashboard = async function(eu){
    var d = await api("/dashboard");
    var stats = d.indicadores.map(function(i){
      return '<div class="stat"><div class="num mono">' + esc(i.valor) + '</div><div class="label">' + esc(i.label) + '</div></div>';
    }).join("");

    var cicloHtml = "";
    if(d.ciclo){
      var pct = Math.min(100, Math.round((d.ciclo.diasUsados / d.ciclo.diasLimite) * 100));
      cicloHtml =
        '<div class="card"><h2>Seu ciclo atual</h2>' +
        '<p class="hint">' + d.ciclo.inicio + ' a ' + d.ciclo.fim + '</p>' +
        '<div class="mono" style="font-size:13px;">' + d.ciclo.diasUsados + ' / ' + d.ciclo.diasLimite + ' dias úteis · ' + d.ciclo.periodosUsados + ' / ' + d.ciclo.periodosLimite + ' períodos</div>' +
        '<div style="height:8px;border-radius:99px;background:var(--surface-3);margin-top:8px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--accent);"></div></div>' +
        '</div>';
    }

    var alertasHtml = "";
    if(d.alertasAdministrativos){
      alertasHtml = '<div class="card"><h2>Alertas administrativos</h2>' +
        (d.alertasAdministrativos.length === 0
          ? '<p class="hint" style="margin:0;">Nenhum PJ estourando o teto de dias úteis ou o limite de períodos no ciclo atual.</p>'
          : d.alertasAdministrativos.map(function(a){
              return '<div style="padding:8px 0;border-bottom:1px solid var(--border);">' + esc(a.nome) + ' — <span class="badge danger">' + a.diasUsados + ' dias / ' + a.periodosUsados + ' períodos</span></div>';
            }).join("")) +
        '</div>';
    }

    var movimentacoesHtml = "";
    if(d.ultimasMovimentacoes){
      movimentacoesHtml = '<div class="card"><h2>Últimas movimentações</h2>' +
        (d.ultimasMovimentacoes.length === 0
          ? '<p class="hint" style="margin:0;">Nada registrado ainda.</p>'
          : d.ultimasMovimentacoes.map(function(m){
              return '<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12.5px;">' + fmtDT(m.criadoEm) + ' · <b>' + esc(m.usuario || "sistema") + '</b> — ' + esc(m.acao) + (m.entidade ? ' (' + esc(m.entidade) + (m.entidadeId ? " #" + esc(m.entidadeId) : "") + ')' : '') + '</div>';
            }).join("")) +
        '</div>';
    }

    var proximasHtml = "";
    if(d.proximasOcorrencias){
      proximasHtml = '<div class="card"><h2>Próximas ocorrências</h2>' +
        (d.proximasOcorrencias.length === 0
          ? '<p class="hint" style="margin:0;">Nenhuma ausência aprovada agendada para os próximos dias.</p>'
          : d.proximasOcorrencias.map(function(o){
              return '<div style="padding:8px 0;border-bottom:1px solid var(--border);">' + (o.pjNome ? '<b>' + esc(o.pjNome) + '</b> — ' : '') + fmtBR(o.dataInicio) + ' a ' + fmtBR(o.dataFim) + '</div>';
            }).join("")) +
        '</div>';
    }

    return (
      '<div class="page-head"><h1>' + (eu.perfil === "PJ" ? "Início" : "Dashboard") + '</h1>' +
      '<p>Bem-vindo(a), ' + esc(eu.nome) + '.</p></div>' +
      '<div class="stat-row">' + stats + '</div>' +
      cicloHtml + proximasHtml + alertasHtml + movimentacoesHtml
    );
  };
})();
