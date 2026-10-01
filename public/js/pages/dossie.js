(function(){
  "use strict";
  window.PortalPJ = window.PortalPJ || {};
  window.PortalPJ.pages = window.PortalPJ.pages || {};

  function esc(s){ var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }

  var CATS = {
    metodologia: "Metodologia",
    auditorias: "Auditorias",
    analises: "Análises de cláusulas",
    resumos: "Resumos executivos",
    ferramentas: "Ferramentas internas",
  };

  var state = { docs: [], ativo: null };

  function listaHtml(){
    if(state.docs.length === 0) return '<div class="empty">Nenhum documento cadastrado ainda. Use "Novo documento" para começar.</div>';
    var porCategoria = {};
    state.docs.forEach(function(d){ (porCategoria[d.categoria] = porCategoria[d.categoria] || []).push(d); });
    return Object.keys(CATS).map(function(cat){
      var itens = porCategoria[cat] || [];
      if(itens.length === 0) return "";
      return '<div style="margin-bottom:14px;"><div class="hint" style="text-transform:uppercase; letter-spacing:.04em; font-weight:700;">' + CATS[cat] + '</div>' +
        itens.map(function(d){
          return '<button type="button" data-abrir-doc="' + d.id + '" style="display:block; width:100%; text-align:left; background:none; border:none; padding:8px 6px; border-radius:8px; cursor:pointer; ' +
            (state.ativo === d.id ? 'background:var(--accent-soft);' : '') + '">' +
            esc(d.titulo) + (d.confidencial ? ' <span class="badge warn">Confidencial</span>' : '') + '</button>';
        }).join("") + '</div>';
    }).join("");
  }

  window.PortalPJ.pages.dossie = async function(){
    state.docs = await api("/dossie/documentos");
    return (
      '<div class="page-head"><h1>Dossiê PJ</h1><p>Metodologia, auditorias e pareceres — acesso exclusivo ao perfil ADM.</p></div>' +
      '<div class="grid-2" style="grid-template-columns:280px 1fr; align-items:start;">' +
        '<div class="card" id="dossie-lista">' +
          '<div class="field"><input type="text" id="dossie-busca" placeholder="Buscar por título…"></div>' +
          '<div id="dossie-lista-itens">' + listaHtml() + '</div>' +
          '<button type="button" class="btn secondary small" id="btn-novo-doc" style="margin-top:10px;">Novo documento</button></div>' +
        '<div class="card" id="dossie-conteudo"><div class="empty">Selecione um documento à esquerda.</div></div>' +
      '</div>'
    );
  };

  var buscaTimer = null;
  async function buscar(termo){
    state.docs = await api("/dossie/documentos" + (termo ? "?q=" + encodeURIComponent(termo) : ""));
    document.getElementById("dossie-lista-itens").innerHTML = listaHtml();
    bindLista();
  }

  async function abrirDoc(id){
    var doc = await api("/dossie/documentos/" + id);
    state.ativo = id;
    document.getElementById("dossie-lista-itens").innerHTML = listaHtml();
    bindLista();
    var body = (typeof marked !== "undefined") ? marked.parse(doc.conteudoMarkdown) : esc(doc.conteudoMarkdown);
    document.getElementById("dossie-conteudo").innerHTML =
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">' +
      '<h2>' + esc(doc.titulo) + (doc.confidencial ? ' <span class="badge warn">Confidencial</span>' : '') + '</h2>' +
      '<button type="button" class="linklike" data-excluir-doc="' + doc.id + '">Excluir</button></div>' +
      '<div style="max-width:74ch; margin-top:12px;">' + body + '</div>';
    document.querySelector("[data-excluir-doc]").addEventListener("click", async function(){
      if(!confirm("Excluir este documento?")) return;
      await api("/dossie/documentos/" + doc.id, { method: "DELETE" });
      window.PortalPJ.toast("Documento excluído.");
      var html = await window.PortalPJ.pages.dossie();
      document.getElementById("main").innerHTML = html;
      window.PortalPJ.pages.dossieMount();
    });
  }

  function bindLista(){
    document.querySelectorAll("[data-abrir-doc]").forEach(function(btn){
      btn.addEventListener("click", function(){ abrirDoc(Number(btn.dataset.abrirDoc)); });
    });
  }

  window.PortalPJ.pages.dossieMount = function(){
    bindLista();
    var buscaInput = document.getElementById("dossie-busca");
    if(buscaInput){
      buscaInput.addEventListener("input", function(){
        clearTimeout(buscaTimer);
        var termo = buscaInput.value;
        buscaTimer = setTimeout(function(){ buscar(termo); }, 200);
      });
    }
    var btnNovo = document.getElementById("btn-novo-doc");
    if(btnNovo){
      btnNovo.addEventListener("click", function(){
        var opts = Object.keys(CATS).map(function(c){ return '<option value="' + c + '">' + CATS[c] + '</option>'; }).join("");
        document.getElementById("dossie-conteudo").innerHTML =
          '<h2>Novo documento</h2>' +
          '<div class="field"><label>Título</label><input type="text" id="nd-titulo"></div>' +
          '<div class="field"><label>Categoria</label><select id="nd-categoria">' + opts + '</select></div>' +
          '<div class="field"><label class="hint" style="display:inline;"><input type="checkbox" id="nd-confidencial" style="width:auto; margin-right:6px;">Marcar como confidencial</label></div>' +
          '<div class="field"><label>Conteúdo (markdown)</label><textarea id="nd-conteudo" style="min-height:220px;"></textarea></div>' +
          '<button type="button" class="btn small" id="nd-salvar">Salvar documento</button>';
        document.getElementById("nd-salvar").addEventListener("click", async function(){
          var body = {
            titulo: document.getElementById("nd-titulo").value.trim(),
            categoria: document.getElementById("nd-categoria").value,
            confidencial: document.getElementById("nd-confidencial").checked,
            conteudoMarkdown: document.getElementById("nd-conteudo").value,
          };
          if(!body.titulo || !body.conteudoMarkdown){ window.PortalPJ.toast("Preencha título e conteúdo."); return; }
          try{
            var r = await api("/dossie/documentos", { method: "POST", body: body });
            window.PortalPJ.toast("Documento criado.");
            var html = await window.PortalPJ.pages.dossie();
            document.getElementById("main").innerHTML = html;
            window.PortalPJ.pages.dossieMount();
            abrirDoc(r.id);
          }catch(err){ window.PortalPJ.toast(err.message); }
        });
      });
    }
  };
})();
