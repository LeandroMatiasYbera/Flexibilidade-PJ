(function(){
  "use strict";
  window.PortalPJ = window.PortalPJ || {};
  window.PortalPJ.pages = window.PortalPJ.pages || {};

  function esc(s){ var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }

  window.PortalPJ.pages.perfil = async function(eu){
    return (
      '<div class="page-head"><h1>Meu Perfil</h1></div>' +
      '<div class="card"><h2>Dados</h2>' +
      '<div class="field"><label>Nome</label><div>' + esc(eu.nome) + '</div></div>' +
      '<div class="field"><label>E-mail</label><div>' + esc(eu.email) + '</div></div>' +
      '<div class="field"><label>Perfil</label><div><span class="badge neutral">' + esc(eu.perfil) + '</span>' + (eu.ehGestor ? ' <span class="badge ok">também é gestor</span>' : '') + '</div></div>' +
      '</div>' +
      '<div class="card"><h2>Trocar minha senha</h2>' +
      '<p class="hint">Feito direto aqui, sem token nem e-mail — só confirmando sua senha atual.</p>' +
      '<div class="error-msg" id="senha-error"></div>' +
      '<div class="ok-msg" id="senha-ok"></div>' +
      '<div class="field"><label for="ps-atual">Senha atual</label><input type="password" id="ps-atual"></div>' +
      '<div class="field"><label for="ps-nova">Nova senha</label><input type="password" id="ps-nova"></div>' +
      '<div class="field"><label for="ps-confirmar">Confirmar nova senha</label><input type="password" id="ps-confirmar"></div>' +
      '<button type="button" class="btn small" id="btn-trocar-senha">Trocar senha</button>' +
      '</div>'
    );
  };

  window.PortalPJ.pages.perfilMount = function(){
    var btn = document.getElementById("btn-trocar-senha");
    if(!btn) return;
    btn.addEventListener("click", async function(){
      var erroEl = document.getElementById("senha-error");
      var okEl = document.getElementById("senha-ok");
      erroEl.classList.remove("show");
      okEl.classList.remove("show");

      var atual = document.getElementById("ps-atual").value;
      var nova = document.getElementById("ps-nova").value;
      var confirmar = document.getElementById("ps-confirmar").value;

      if(!atual || !nova){ erroEl.textContent = "Preencha a senha atual e a nova senha."; erroEl.classList.add("show"); return; }
      if(nova !== confirmar){ erroEl.textContent = "A confirmação não bate com a nova senha."; erroEl.classList.add("show"); return; }

      try{
        var r = await api("/auth/trocar-senha", { method: "POST", body: { senhaAtual: atual, novaSenha: nova } });
        okEl.textContent = r.mensagem || "Senha alterada.";
        okEl.classList.add("show");
        document.getElementById("ps-atual").value = "";
        document.getElementById("ps-nova").value = "";
        document.getElementById("ps-confirmar").value = "";
      }catch(err){
        erroEl.textContent = err.message;
        erroEl.classList.add("show");
      }
    });
  };
})();
