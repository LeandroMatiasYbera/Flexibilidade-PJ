(function(){
  "use strict";

  function showError(msg){
    var el = document.getElementById("login-error");
    el.textContent = msg;
    el.classList.add("show");
    document.getElementById("login-ok").classList.remove("show");
  }
  function clearMsgs(){
    document.getElementById("login-error").classList.remove("show");
    document.getElementById("login-ok").classList.remove("show");
  }

  document.getElementById("toggle-senha").addEventListener("click", function(){
    var input = document.getElementById("senha");
    var isPw = input.type === "password";
    input.type = isPw ? "text" : "password";
    this.textContent = isPw ? "Ocultar" : "Mostrar";
  });

  document.getElementById("form-login").addEventListener("submit", async function(e){
    e.preventDefault();
    clearMsgs();
    var btn = document.getElementById("btn-entrar");
    btn.disabled = true;
    try{
      await api("/auth/login", {
        method: "POST",
        body: { email: document.getElementById("email").value.trim(), senha: document.getElementById("senha").value },
      });
      var retomar = "";
      try{ retomar = sessionStorage.getItem("portalpj_redirect_hash") || ""; }catch(err){}
      window.location.href = "/" + retomar;
    }catch(err){
      showError(err.message || "Não foi possível entrar.");
    }finally{
      btn.disabled = false;
    }
  });
})();
