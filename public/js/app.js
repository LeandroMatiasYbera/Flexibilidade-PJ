(function(){
  "use strict";

  window.PortalPJ = window.PortalPJ || {};
  var eu = null;
  var REDIRECT_KEY = "portalpj_redirect_hash";

  var toastTimer = null;
  window.PortalPJ.toast = function(msg){
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ el.classList.remove("show"); }, 2600);
  };

  function irParaLogin(){
    // Retomada da página: guarda o hash atual para reabrir depois do login
    // (Seção 3 dos requisitos — "redirecionamento automático... e retomada
    // da página que a pessoa tentava acessar").
    try{
      if(window.location.hash && window.location.hash !== "#dashboard"){
        sessionStorage.setItem(REDIRECT_KEY, window.location.hash);
      }
    }catch(err){ /* sessionStorage indisponível — segue sem retomada */ }
    window.location.href = "/login.html";
  }

  // Item de menu por perfil. Um item que o perfil atual não tem simplesmente
  // não é adicionado à lista abaixo — nunca aparece cinza/bloqueado. Um item
  // com `permissao` só entra se a permissão também aparecer em eu.permissoes
  // (tabela `permissoes`, ver Seção 4/11) — mas a proteção de verdade está na
  // API (src/lib/middleware.js), nunca só nesta lista.
  var MENUS = {
    ADM: [
      { hash: "dashboard", label: "Dashboard" },
      { hash: "flexibilidade", label: "Flexibilidade" },
      { hash: "dossie", label: "Dossiê PJ", permissao: "dossie" },
      { hash: "admin", label: "Administração", permissao: "administracao" },
      { hash: "relatorios", label: "Relatórios", permissao: "relatorios" },
      { hash: "perfil", label: "Meu Perfil" },
    ],
    GESTOR: [
      { hash: "dashboard", label: "Dashboard" },
      { hash: "flexibilidade", label: "Flexibilidade" },
      { hash: "equipe", label: "Minha Equipe" },
      { hash: "solicitacoes", label: "Solicitações" },
      { hash: "historico", label: "Histórico" },
      { hash: "perfil", label: "Meu Perfil" },
    ],
    PJ: [
      { hash: "dashboard", label: "Início" },
      { hash: "flexibilidade", label: "Flexibilidade" },
      { hash: "minhas-solicitacoes", label: "Minhas Solicitações" },
      { hash: "historico", label: "Histórico" },
      { hash: "perfil", label: "Meu Perfil" },
    ],
  };

  function itensPermitidos(){
    var base = MENUS[eu.perfil] || [];
    return base.filter(function(it){
      return !it.permissao || (eu.permissoes || []).indexOf(it.permissao) !== -1;
    });
  }

  var PAGES = {
    dashboard: function(){ return window.PortalPJ.pages.dashboard(eu); },
    flexibilidade: function(){ return window.PortalPJ.pages.flexibilidade(eu); },
    dossie: function(){ return window.PortalPJ.pages.dossie(eu); },
    admin: function(){ return window.PortalPJ.pages.admin(eu); },
    relatorios: function(){ return window.PortalPJ.pages.relatorios(eu); },
    equipe: function(){ return window.PortalPJ.pages.equipe(eu); },
    solicitacoes: function(){ return window.PortalPJ.pages.solicitacoes(eu); },
    "minhas-solicitacoes": function(){ return window.PortalPJ.pages["minhas-solicitacoes"](eu); },
    historico: function(){ return window.PortalPJ.pages.historico(eu); },
    perfil: function(){ return window.PortalPJ.pages.perfil(eu); },
  };

  function renderMenu(){
    var itens = itensPermitidos();
    var nav = document.getElementById("nav");
    nav.innerHTML = itens.map(function(it){
      return '<a href="#' + it.hash + '" data-hash="' + it.hash + '">' + it.label + '</a>';
    }).join("");
    document.getElementById("whoami").innerHTML =
      "<b></b><span></span>";
    document.getElementById("whoami").querySelector("b").textContent = eu.nome;
    document.getElementById("whoami").querySelector("span").textContent =
      eu.perfil === "ADM" ? "Administrador" : eu.perfil === "GESTOR" ? "Gestor" : "Usuário PJ";
  }

  function currentHash(){
    var h = (window.location.hash || "#dashboard").replace("#", "");
    // Bloqueio real de acesso direto por "URL" (hash): se o item não está
    // no menu deste perfil, cai para dashboard — mas a garantia de verdade é
    // que cada página chama a API, e a API (não este roteador) decide o que
    // cada perfil pode ler.
    var permitido = itensPermitidos().some(function(it){ return it.hash === h; });
    return permitido ? h : "dashboard";
  }

  async function route(){
    var h = currentHash();
    document.querySelectorAll("#nav a").forEach(function(a){
      a.classList.toggle("active", a.dataset.hash === h);
    });
    var main = document.getElementById("main");
    main.innerHTML = '<div class="empty">Carregando…</div>';
    try{
      var html = await PAGES[h]();
      main.innerHTML = html;
      if (window.PortalPJ.pages[h + "Mount"]) window.PortalPJ.pages[h + "Mount"](eu);
    }catch(err){
      if(err.status === 401){ irParaLogin(); return; }
      if(err.status === 403){
        main.innerHTML = '<div class="empty"><div class="big">Acesso restrito</div>Você não tem permissão para ver esta área.</div>';
        return;
      }
      main.innerHTML = '<div class="empty"><div class="big">Erro ao carregar</div>' + (err.message || "") + '</div>';
    }
  }

  window.addEventListener("hashchange", function(){ if(!eu || !eu.senhaProvisoria) route(); });

  // Troca obrigatória de senha no primeiro acesso (Seção 3 dos requisitos —
  // "senha padrão de primeiro acesso"). Nada do menu/roteador roda enquanto
  // `senhaProvisoria` for true — reforçado também no servidor
  // (bloquearSenhaProvisoria em src/lib/middleware.js), então mesmo chamando
  // a API direto não adianta pular esta tela.
  function renderTrocaObrigatoria(){
    document.getElementById("nav").innerHTML = "";
    document.getElementById("main").innerHTML =
      '<div class="page-head"><h1>Defina sua senha</h1><p>Sua conta ainda está com a senha padrão de primeiro acesso — defina uma senha só sua para continuar.</p></div>' +
      '<div class="card">' +
      '<div class="error-msg" id="senha-obrig-error"></div>' +
      '<div class="field"><label for="so-atual">Senha padrão atual</label><input type="password" id="so-atual"></div>' +
      '<div class="field"><label for="so-nova">Nova senha</label><input type="password" id="so-nova"></div>' +
      '<div class="field"><label for="so-confirmar">Confirmar nova senha</label><input type="password" id="so-confirmar"></div>' +
      '<button type="button" class="btn" id="btn-troca-obrigatoria" style="width:auto;">Definir senha e entrar</button>' +
      '</div>';
    document.getElementById("btn-troca-obrigatoria").addEventListener("click", async function(){
      var erroEl = document.getElementById("senha-obrig-error");
      erroEl.classList.remove("show");
      var atual = document.getElementById("so-atual").value;
      var nova = document.getElementById("so-nova").value;
      var confirmar = document.getElementById("so-confirmar").value;
      if(!atual || !nova){ erroEl.textContent = "Preencha os dois campos de senha."; erroEl.classList.add("show"); return; }
      if(nova !== confirmar){ erroEl.textContent = "A confirmação não bate com a nova senha."; erroEl.classList.add("show"); return; }
      try{
        await api("/auth/trocar-senha", { method: "POST", body: { senhaAtual: atual, novaSenha: nova } });
        eu.senhaProvisoria = false;
        window.PortalPJ.toast("Senha definida.");
        renderMenu();
        route();
      }catch(err){
        erroEl.textContent = err.message;
        erroEl.classList.add("show");
      }
    });
  }

  document.getElementById("btn-sair").addEventListener("click", async function(){
    try{ await api("/auth/logout", { method: "POST" }); }catch(err){}
    window.location.href = "/login.html";
  });

  async function init(){
    try{
      eu = await api("/auth/me");
    }catch(err){
      irParaLogin();
      return;
    }
    document.getElementById("gate").style.display = "none";
    document.getElementById("shell").style.display = "flex";

    if(eu.senhaProvisoria){
      document.getElementById("whoami").innerHTML = "<b></b>";
      document.getElementById("whoami").querySelector("b").textContent = eu.nome;
      renderTrocaObrigatoria();
      return;
    }

    renderMenu();

    // Retomada da página, se havia uma guardada de um redirecionamento
    // anterior por sessão expirada.
    try{
      var retomar = sessionStorage.getItem(REDIRECT_KEY);
      if(retomar){
        sessionStorage.removeItem(REDIRECT_KEY);
        if(window.location.hash !== retomar) window.location.hash = retomar;
      }
    }catch(err){ /* sessionStorage indisponível */ }

    route();
  }

  init();
})();
