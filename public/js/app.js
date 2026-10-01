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

  // Ícones de linha (SVG inline, sem dependência externa) para cada item do
  // menu — "currentColor" herda a cor do link, inclusive no estado ativo.
  var ICONES = {
    dashboard: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10.5V20h12v-9.5"/></svg>',
    flexibilidade: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3.5v4M16 3.5v4"/></svg>',
    dossie: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M14 3.5V8h4M9 13h6M9 16.5h6"/></svg>',
    admin: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.4 7.4 0 0 0 0-3l1.6-1.2-1.5-2.6-1.9.6a7.5 7.5 0 0 0-2.6-1.5L16.6 3h-3l-.4 2.3a7.5 7.5 0 0 0-2.6 1.5l-1.9-.6-1.5 2.6 1.6 1.2a7.4 7.4 0 0 0 0 3L6.6 15l1.5 2.6 1.9-.6a7.5 7.5 0 0 0 2.6 1.5l.4 2.3h3l.4-2.3a7.5 7.5 0 0 0 2.6-1.5l1.9.6 1.5-2.6Z"/></svg>',
    relatorios: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M4 20h16"/></svg>',
    equipe: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 19a4.2 4.2 0 0 1 5-4"/></svg>',
    solicitacoes: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h3.5l1.5 2.5h6L16.5 12H20"/><path d="M5 12 6.3 5.6A1 1 0 0 1 7.3 5h9.4a1 1 0 0 1 1 .6L19 12v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-6Z"/></svg>',
    "minhas-solicitacoes": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h3.5l1.5 2.5h6L16.5 12H20"/><path d="M5 12 6.3 5.6A1 1 0 0 1 7.3 5h9.4a1 1 0 0 1 1 .6L19 12v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-6Z"/></svg>',
    historico: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/></svg>',
    perfil: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="3"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0"/></svg>',
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
      var icone = ICONES[it.hash] || "";
      return '<a href="#' + it.hash + '" data-hash="' + it.hash + '">' + icone + '<span>' + it.label + '</span></a>';
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
