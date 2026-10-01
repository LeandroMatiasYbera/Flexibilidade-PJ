(function(){
  "use strict";
  window.PortalPJ = window.PortalPJ || {};
  window.PortalPJ.pages = window.PortalPJ.pages || {};

  function esc(s){ var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  function fmtDT(iso){ if(!iso) return "—"; var d = new Date(iso); return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"}); }

  var state = { usuarios: [], gestores: [] };

  function linhaUsuario(u){
    var acoes =
      '<button type="button" class="linklike" data-ver="' + u.id + '">Ver</button> · ' +
      '<button type="button" class="linklike" data-editar="' + u.id + '">Editar</button> · ' +
      '<button type="button" class="linklike" data-ativar="' + u.id + '" data-valor="' + (!u.ativo) + '">' + (u.ativo ? "Desativar" : "Ativar") + '</button> · ' +
      '<button type="button" class="linklike" data-redefinir="' + u.id + '">Redefinir senha</button> · ' +
      '<button type="button" class="linklike" data-excluir="' + u.id + '" style="color:var(--danger-text);">Excluir</button>';
    return "<tr>" +
      "<td><div style='font-weight:600;'>" + esc(u.nome) + "</div><div class='hint' style='margin:0;'>" + esc(u.email) + "</div></td>" +
      "<td><span class='badge neutral'>" + esc(u.perfil) + "</span></td>" +
      "<td>" + (u.gestor ? esc(u.gestor.nome) : "—") + "</td>" +
      "<td>" + (u.ativo ? "<span class='badge ok'>Ativo</span>" : "<span class='badge danger'>Inativo</span>") + "</td>" +
      "<td>" + fmtDT(u.ultimoAcessoEm) + "</td>" +
      "<td>" + fmtDT(u.criadoEm) + "</td>" +
      "<td style='white-space:nowrap;'>" + acoes + "</td>" +
    "</tr>";
  }

  function formNovoUsuarioHtml(){
    var gestorOpts = state.usuarios.filter(function(u){ return u.perfil === "GESTOR"; })
      .map(function(g){ return '<option value="' + g.id + '">' + esc(g.nome) + '</option>'; }).join("");
    return (
      '<div class="card"><h2>Novo usuário</h2>' +
      '<p class="hint">A conta nasce com a senha padrão de primeiro acesso — a pessoa é obrigada a trocar assim que entrar.</p>' +
      '<div class="grid-2"><div class="field"><label>Nome</label><input type="text" id="nu-nome"></div>' +
      '<div class="field"><label>E-mail</label><input type="email" id="nu-email"></div></div>' +
      '<div class="grid-3"><div class="field"><label>Perfil</label><select id="nu-perfil"><option value="PJ">Usuário PJ</option><option value="GESTOR">Gestor</option><option value="ADM">ADM</option></select></div>' +
      '<div class="field" id="nu-gestor-field"><label>Gestor responsável (se PJ)</label><select id="nu-gestor"><option value="">—</option>' + gestorOpts + '</select></div>' +
      '<div class="field" id="nu-cargo-field"><label>Cargo (se PJ)</label><input type="text" id="nu-cargo"></div></div>' +
      '<div class="grid-2" id="nu-pj-extra"><div class="field"><label>Contratante</label><select id="nu-contratante"><option value="B2C">B2C</option><option value="GYP">GYP</option></select></div>' +
      '<div class="field"><label>Data de assinatura do contrato</label><input type="date" id="nu-data-contrato" value="2026-07-01"></div></div>' +
      '<button type="button" class="btn small" id="btn-criar-usuario">Criar usuário</button>' +
      '</div>'
    );
  }

  window.PortalPJ.pages.admin = async function(){
    state.usuarios = await api("/admin/usuarios");
    var linhas = state.usuarios.map(linhaUsuario).join("");
    return (
      '<div class="page-head"><h1>Administração</h1><p>Usuários, perfis de acesso e associação Gestor × PJ.</p></div>' +
      formNovoUsuarioHtml() +
      '<div class="card"><h2>Usuários</h2>' +
      '<div class="tablewrap"><table><thead><tr><th>Nome</th><th>Perfil</th><th>Gestor</th><th>Status</th><th>Último acesso</th><th>Criado em</th><th>Ações</th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
      '</div>' +
      '<div class="card"><h2>Auditoria</h2><div id="admin-logs"></div></div>'
    );
  };

  async function recarregar(){
    var html = await window.PortalPJ.pages.admin();
    document.getElementById("main").innerHTML = html;
    window.PortalPJ.pages.adminMount();
  }

  async function carregarLogs(){
    var el = document.getElementById("admin-logs");
    if(!el) return;
    var logs = await api("/admin/logs?limite=100");
    if(logs.length === 0){ el.innerHTML = '<p class="hint">Nenhum evento registrado ainda.</p>'; return; }
    el.innerHTML =
      '<div class="tablewrap"><table><thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Registro</th></tr></thead><tbody>' +
      logs.map(function(l){
        return "<tr><td>" + fmtDT(l.criadoEm) + "</td><td>" + esc(l.usuario || "—") + "</td><td>" + esc(l.acao) + "</td><td>" + esc(l.entidade || "") + (l.entidadeId ? " #" + esc(l.entidadeId) : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  window.PortalPJ.pages.adminMount = function(){
    var selPerfil = document.getElementById("nu-perfil");
    function togglePjFields(){
      var isPj = selPerfil.value === "PJ";
      document.getElementById("nu-gestor-field").style.display = isPj ? "" : "none";
      document.getElementById("nu-cargo-field").style.display = isPj ? "" : "none";
      document.getElementById("nu-pj-extra").style.display = isPj ? "" : "none";
    }
    selPerfil.addEventListener("change", togglePjFields);
    togglePjFields();

    document.getElementById("btn-criar-usuario").addEventListener("click", async function(){
      var perfil = selPerfil.value;
      var body = {
        nome: document.getElementById("nu-nome").value.trim(),
        email: document.getElementById("nu-email").value.trim(),
        perfil: perfil,
      };
      if(perfil === "PJ"){
        var g = document.getElementById("nu-gestor").value;
        body.gestorId = g ? Number(g) : null;
        body.cargo = document.getElementById("nu-cargo").value.trim() || null;
        body.contratante = document.getElementById("nu-contratante").value;
        body.dataContrato = document.getElementById("nu-data-contrato").value || null;
      }
      if(!body.nome || !body.email){ window.PortalPJ.toast("Preencha nome e e-mail."); return; }
      try{
        var r = await api("/admin/usuarios", { method: "POST", body: body });
        window.PortalPJ.toast("Usuário criado. Senha padrão: " + r.senhaPadrao);
        recarregar();
      }catch(err){ window.PortalPJ.toast(err.message); }
    });

    document.querySelectorAll("[data-ativar]").forEach(function(btn){
      btn.addEventListener("click", async function(){
        try{
          await api("/admin/usuarios/" + btn.dataset.ativar, { method: "PATCH", body: { ativo: btn.dataset.valor === "true" } });
          recarregar();
        }catch(err){ window.PortalPJ.toast(err.message); }
      });
    });
    document.querySelectorAll("[data-redefinir]").forEach(function(btn){
      btn.addEventListener("click", async function(){
        var id = btn.dataset.redefinir;
        if(!confirm("Voltar a senha desta pessoa para a padrão de primeiro acesso? Ela vai precisar trocar assim que entrar de novo.")) return;
        try{
          var r = await api("/admin/usuarios/" + id + "/redefinir-senha", { method: "POST" });
          window.PortalPJ.toast("Senha padrão: " + r.senhaPadrao + " — avise a pessoa por fora (WhatsApp, presencial).");
        }catch(err){ window.PortalPJ.toast(err.message); }
      });
    });
    document.querySelectorAll("[data-excluir]").forEach(function(btn){
      btn.addEventListener("click", async function(){
        if(!confirm("Excluir este usuário definitivamente?")) return;
        try{
          await api("/admin/usuarios/" + btn.dataset.excluir, { method: "DELETE" });
          window.PortalPJ.toast("Usuário excluído.");
          recarregar();
        }catch(err){ window.PortalPJ.toast(err.message); }
      });
    });
    document.querySelectorAll("[data-editar]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var u = state.usuarios.find(function(x){ return x.id === Number(btn.dataset.editar); });
        if(!u) return;
        var gestorOpts = state.usuarios.filter(function(g){ return g.perfil === "GESTOR"; })
          .map(function(g){ return '<option value="' + g.id + '"' + (u.gestor && u.gestor.id === g.id ? " selected" : "") + '>' + esc(g.nome) + '</option>'; }).join("");
        var box = document.createElement("div");
        box.className = "modal-backdrop show";
        box.innerHTML =
          '<div class="modal"><h3>Editar ' + esc(u.nome) + '</h3>' +
          '<div class="field"><label>Nome</label><input type="text" id="ed-nome" value="' + esc(u.nome) + '"></div>' +
          '<div class="field"><label>E-mail</label><input type="email" id="ed-email" value="' + esc(u.email) + '"></div>' +
          '<div class="field"><label>Perfil</label><select id="ed-perfil">' +
            ["ADM","GESTOR","PJ"].map(function(p){ return '<option value="' + p + '"' + (p === u.perfil ? " selected" : "") + '>' + p + '</option>'; }).join("") +
          '</select></div>' +
          '<div class="field"><label>Gestor responsável</label><select id="ed-gestor"><option value="">—</option>' + gestorOpts + '</select></div>' +
          '<div class="field"><label>Cargo</label><input type="text" id="ed-cargo" value="' + esc(u.cargo || "") + '"></div>' +
          '<div class="grid-2">' +
          '<div class="field"><label>Contratante</label><select id="ed-contratante"><option value="">—</option>' +
            ["B2C","GYP"].map(function(c){ return '<option value="' + c + '"' + (c === u.contratante ? " selected" : "") + '>' + c + '</option>'; }).join("") +
          '</select></div>' +
          '<div class="field"><label>Data de assinatura do contrato</label><input type="date" id="ed-data-contrato" value="' + (u.dataContrato ? String(u.dataContrato).slice(0,10) : "") + '"></div>' +
          '</div>' +
          '<div style="display:flex; gap:8px; margin-top:14px;"><button class="btn small" id="ed-salvar">Salvar</button><button class="btn secondary small" id="ed-cancelar">Cancelar</button></div>' +
          '</div>';
        document.body.appendChild(box);
        box.querySelector("#ed-cancelar").addEventListener("click", function(){ box.remove(); });
        box.querySelector("#ed-salvar").addEventListener("click", async function(){
          var gestorVal = box.querySelector("#ed-gestor").value;
          var email = box.querySelector("#ed-email").value.trim();
          if(!email){ window.PortalPJ.toast("O e-mail não pode ficar em branco."); return; }
          try{
            await api("/admin/usuarios/" + u.id, {
              method: "PATCH",
              body: {
                nome: box.querySelector("#ed-nome").value.trim(),
                email: email,
                perfil: box.querySelector("#ed-perfil").value,
                gestorId: gestorVal ? Number(gestorVal) : null,
                cargo: box.querySelector("#ed-cargo").value.trim() || null,
                contratante: box.querySelector("#ed-contratante").value || null,
                dataContrato: box.querySelector("#ed-data-contrato").value || null,
              },
            });
            box.remove();
            window.PortalPJ.toast("Usuário atualizado.");
            recarregar();
          }catch(err){ window.PortalPJ.toast(err.message); }
        });
      });
    });

    document.querySelectorAll("[data-ver]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var u = state.usuarios.find(function(x){ return x.id === Number(btn.dataset.ver); });
        if(!u) return;
        var box = document.createElement("div");
        box.className = "modal-backdrop show";
        box.innerHTML =
          '<div class="modal"><h3>' + esc(u.nome) + '</h3>' +
          '<div class="field"><label>E-mail</label><div>' + esc(u.email) + '</div></div>' +
          '<div class="field"><label>Perfil</label><div><span class="badge neutral">' + esc(u.perfil) + '</span></div></div>' +
          '<div class="field"><label>Gestor responsável</label><div>' + (u.gestor ? esc(u.gestor.nome) : "—") + '</div></div>' +
          '<div class="field"><label>Cargo</label><div>' + esc(u.cargo || "—") + '</div></div>' +
          '<div class="field"><label>Contratante</label><div>' + esc(u.contratante || "—") + '</div></div>' +
          '<div class="field"><label>Contrato desde</label><div>' + fmtDT(u.dataContrato) + '</div></div>' +
          '<div class="field"><label>Status</label><div>' + (u.ativo ? '<span class="badge ok">Ativo</span>' : '<span class="badge danger">Inativo</span>') + '</div></div>' +
          '<div class="field"><label>Último acesso</label><div>' + fmtDT(u.ultimoAcessoEm) + '</div></div>' +
          '<div class="field"><label>Criado em</label><div>' + fmtDT(u.criadoEm) + '</div></div>' +
          '<button class="btn secondary small" id="ver-fechar">Fechar</button></div>';
        document.body.appendChild(box);
        box.querySelector("#ver-fechar").addEventListener("click", function(){ box.remove(); });
      });
    });

    carregarLogs();
  };
})();
