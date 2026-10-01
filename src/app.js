const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const flexibilidadeRoutes = require("./routes/flexibilidade.routes");
const dossieRoutes = require("./routes/dossie.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

const app = express();

// Em produção (Render, atrás de um proxy reverso) o Express precisa saber
// que confia no primeiro salto do proxy — sem isso, `secure` no cookie de
// sessão e o identificador de IP do rate-limit de login não funcionam
// direito (o rate-limit chega a lançar erro se detectar X-Forwarded-For sem
// isso configurado). Em dev local (sem proxy) esta linha não tem efeito.
app.set("trust proxy", 1);

// Cabeçalhos de segurança padrão (Seção 8 dos requisitos): CSP restrita às
// origens que a página realmente usa (fontes do Google, script do cdnjs),
// X-Frame-Options (frameguard) e HSTS — HSTS só tem efeito quando o site é
// servido por HTTPS (produção); em HTTP local o navegador o ignora.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        // 'unsafe-inline' só para estilo, nunca para script: o frontend usa
        // muitos atributos style="..." (gerados em JS) em vez de um
        // framework CSS — inline STYLE não executa código, o risco real de
        // XSS que o CSP mitiga é em script-src, que segue estrito acima.
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 15552000, includeSubDomains: true },
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/flexibilidade", flexibilidadeRoutes);
app.use("/api/dossie", dossieRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Frontend estático. login.html é a única página servida sem exigir sessão;
// tudo dentro de /app é HTML/CSS/JS "burro" que só existe para chamar a API —
// a API é a única linha de defesa real (ver src/lib/middleware.js).
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

module.exports = app;
