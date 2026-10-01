(function(){
  "use strict";
  window.PortalPJ = window.PortalPJ || {};

  function esc(s){ var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  function fmtBR(iso){ if(!iso) return "—"; return iso.slice(8,10) + "/" + iso.slice(5,7) + "/" + iso.slice(0,4); }

  function statusBadge(s){
    if(s === "Aprovado") return '<span class="badge ok">Aprovado</span>';
    if(s === "Reprovado") return '<span class="badge danger">Reprovado</span>';
    if(s === "ReprovadoGestor") return '<span class="badge danger">Reprovado pelo gestor</span>';
    if(s === "PendenteGestor") return '<span class="badge neutral">Aguardando gestor</span>';
    return '<span class="badge warn">Aguardando Gente &amp; Gestão</span>';
  }

  function alertasHtml(alertas){
    if(!alertas || !alertas.length) return '<span class="badge ok">Sem alertas</span>';
    return alertas.map(function(a){ return '<span class="badge warn" style="display:block;margin-bottom:3px;">' + esc(a) + '</span>'; }).join("");
  }

  var TERMINAL = ["Aprovado", "Reprovado", "ReprovadoGestor"];
  function ehTerminal(status){ return TERMINAL.indexOf(status) !== -1; }

  function acoesHtml(eu, s){
    var terminal = ehTerminal(s.status);
    // Um Gestor que também é PJ pode ver a própria solicitação nesta mesma
    // lista (pjId = ele) — só mostra os botões de aprovar/reprovar quando ele
    // é de fato o aprovador dela (gestorId = ele), nunca na própria.
    if(eu.perfil === "GESTOR" && s.status === "PendenteGestor" && s.gestorId === eu.id){
      return '<div style="display:flex;gap:6px;"><button class="btn small" data-gestor-aprovar="' + s.id + '">Aprovar</button><button class="btn secondary small" data-gestor-reprovar="' + s.id + '">Reprovar</button></div>';
    }
    if(eu.perfil === "GESTOR" && s.pjId === eu.id){
      return s.status === "PendenteGestor" ? "<span class=\"badge neutral\">Aguardando " + esc(s.gestorNome || "gestor") + "</span>" : "—";
    }
    if(eu.perfil === "ADM" && !terminal){
      return '<div style="display:flex;gap:6px;"><button class="btn small" data-admin-aprovar="' + s.id + '">Aprovar</button><button class="btn secondary small" data-admin-reprovar="' + s.id + '">Reprovar</button></div>';
    }
    if(eu.perfil === "ADM" && terminal){
      return '<button type="button" class="linklike" data-admin-reabrir="' + s.id + '">Alterar decisão</button>';
    }
    return "—";
  }

  function tabelaSolicitacoes(eu, lista){
    if(lista.length === 0){
      return '<div class="empty"><div class="big">Nada aqui</div>Nenhuma solicitação para mostrar.</div>';
    }
    var rows = lista.map(function(s){
      return "<tr>" +
        '<td><div style="font-weight:600;">' + esc(s.pjNome) + '</div><div class="hint" style="margin:0;">' + esc(s.cargo || "") + (s.gestorNome ? " · " + esc(s.gestorNome) : "") + '</div></td>' +
        '<td>' + fmtBR(s.dataInicio) + ' – ' + fmtBR(s.dataFim) + '<div class="hint" style="margin:0;">comunicado em ' + fmtBR(s.dataComunicacao) + '</div></td>' +
        '<td class="mono">' + s.diasUteis + '<div class="hint" style="margin:0;">' + s.diasCorridos + ' corridos</div></td>' +
        '<td>' + s.numeroPeriodo + 'º período</td>' +
        '<td>' + alertasHtml(s.alertas) + '</td>' +
        '<td>' + statusBadge(s.status) + '</td>' +
        '<td>' + acoesHtml(eu, s) + '</td>' +
      "</tr>";
    }).join("");
    return (
      '<div class="tablewrap"><table><thead><tr><th>PJ</th><th>Período</th><th>Dias úteis</th><th>Ciclo</th><th>Alertas</th><th>Status</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div>'
    );
  }

  function bindAcoes(eu, onChanged){
    document.querySelectorAll("[data-gestor-aprovar]").forEach(function(btn){
      btn.addEventListener("click", async function(){
        await api("/flexibilidade/solicitacoes/" + btn.dataset.gestorAprovar + "/decidir-gestor", { method: "POST", body: { decisao: "Aprovado" } });
        window.PortalPJ.toast("Aprovado — segue para a Gente & Gestão.");
        onChanged();
      });
    });
    document.querySelectorAll("[data-gestor-reprovar]").forEach(function(btn){
      btn.addEventListener("click", async function(){
        await api("/flexibilidade/solicitacoes/" + btn.dataset.gestorReprovar + "/decidir-gestor", { method: "POST", body: { decisao: "Reprovado" } });
        window.PortalPJ.toast("Reprovado.");
        onChanged();
      });
    });
    document.querySelectorAll("[data-admin-aprovar]").forEach(function(btn){
      btn.addEventListener("click", async function(){
        await api("/flexibilidade/solicitacoes/" + btn.dataset.adminAprovar + "/decidir-admin", { method: "POST", body: { decisao: "Aprovado" } });
        window.PortalPJ.toast("Aprovado.");
        onChanged();
      });
    });
    document.querySelectorAll("[data-admin-reprovar]").forEach(function(btn){
      btn.addEventListener("click", async function(){
        await api("/flexibilidade/solicitacoes/" + btn.dataset.adminReprovar + "/decidir-admin", { method: "POST", body: { decisao: "Reprovado" } });
        window.PortalPJ.toast("Reprovado.");
        onChanged();
      });
    });
    document.querySelectorAll("[data-admin-reabrir]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var id = btn.dataset.adminReabrir;
        btn.outerHTML =
          '<div style="display:flex;gap:6px;"><button class="btn small" data-admin-aprovar="' + id + '">Aprovar</button><button class="btn secondary small" data-admin-reprovar="' + id + '">Reprovar</button></div>';
        bindAcoes(eu, onChanged);
      });
    });
  }

  window.PortalPJ.flexHelpers = { esc, fmtBR, statusBadge, alertasHtml, acoesHtml, tabelaSolicitacoes, bindAcoes, ehTerminal };
})();
