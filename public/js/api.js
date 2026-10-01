// Wrapper único de chamadas à API. Sempre envia cookies (sessão httpOnly) e
// trata 401 tratando a sessão como expirada — nunca guarda token no
// localStorage/sessionStorage (evita exposição a XSS).
async function api(path, options) {
  const opts = Object.assign({ credentials: "same-origin" }, options || {});
  opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
  if (opts.body && typeof opts.body !== "string") opts.body = JSON.stringify(opts.body);

  const res = await fetch("/api" + path, opts);
  let data = null;
  try { data = await res.json(); } catch (err) { data = null; }

  if (!res.ok) {
    const erro = (data && data.erro) || "Erro inesperado (" + res.status + ").";
    const e = new Error(erro);
    e.status = res.status;
    e.data = data;
    throw e;
  }
  return data;
}
