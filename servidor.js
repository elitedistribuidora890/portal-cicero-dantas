/* =========================================================
   Portal Cícero Dantas — servidor + painel administrativo
   ---------------------------------------------------------
   Requisitos: Node.js 18 ou mais novo. Sem dependências.
   Iniciar:    node servidor.js        (ou: npm start)
   Site:       http://localhost:3000
   Painel:     http://localhost:3000/admin
   Porta:      PORT=8080 node servidor.js
   Os dados ficam em ./dados/banco.json e as imagens em ./uploads/

   Variáveis de ambiente (hospedagem):
     PORT         porta (a hospedagem costuma definir sozinha)
     DATA_DIR     pasta PERMANENTE para banco.json e uploads (ex.: /data)
     ADMIN_SENHA  senha inicial do usuário admin (só no primeiro uso)
     TRUST_PROXY  "1" quando roda atrás de proxy/HTTPS da hospedagem
   ========================================================= */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");

const RAIZ = __dirname;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : null;
const PASTA_DADOS = DATA_DIR || path.join(RAIZ, "dados");
const ARQ_BANCO = path.join(PASTA_DADOS, "banco.json");
const PASTA_UPLOADS = DATA_DIR ? path.join(DATA_DIR, "uploads") : path.join(RAIZ, "uploads");
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const PORTA = Number(process.env.PORT) || 3000;
const DURACAO_SESSAO = 1000 * 60 * 60 * 12; // 12 horas

fs.mkdirSync(PASTA_DADOS, { recursive: true });
fs.mkdirSync(PASTA_UPLOADS, { recursive: true });

/* ---------------- Banco de dados (arquivo JSON) ---------------- */
let banco;

function hashSenha(senha, sal = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(senha), sal, 64).toString("hex");
  return `${sal}:${hash}`;
}
function conferirSenha(senha, guardado) {
  const [sal, hash] = String(guardado).split(":");
  if (!sal || !hash) return false;
  const teste = crypto.scryptSync(String(senha), sal, 64);
  const original = Buffer.from(hash, "hex");
  return original.length === teste.length && crypto.timingSafeEqual(original, teste);
}

function criarBancoInicial() {
  // Importa as notícias de exemplo de js/dados.js
  const ctx = {};
  const codigo = fs.readFileSync(path.join(RAIZ, "js", "dados.js"), "utf8") +
    "\n;this.r={SITE,EDITORIAS,CIDADES_TEMPO,PATROCINIOS,NOTICIAS};";
  vm.runInNewContext(codigo, ctx);
  const d = ctx.r;
  const agora = Date.now();
  const noticias = d.NOTICIAS.map(n => {
    const { horasAtras, ...resto } = n;
    return {
      ...resto,
      data: n.data ? new Date(n.data.replace(" ", "T")).toISOString() : new Date(agora - (horasAtras || 0) * 3600e3).toISOString(),
      status: "publicado",
      visualizacoes: 0,
      atualizadoEm: new Date().toISOString()
    };
  });
  const apoiadores = d.PATROCINIOS.apoiadores.map(nome => ({ nome, imagem: "", link: "anuncie.html" }));

  const senha = process.env.ADMIN_SENHA || crypto.randomBytes(6).toString("base64url");
  if (!process.env.ADMIN_SENHA) fs.writeFileSync(path.join(PASTA_DADOS, "SENHA-INICIAL.txt"),
    `Acesso inicial ao painel\nUsuário: admin\nSenha: ${senha}\n\nTroque a senha no primeiro acesso (menu Usuários) e apague este arquivo.\n`);
  console.log(process.env.ADMIN_SENHA
    ? "\n  Primeiro uso: usuário 'admin' criado com a senha definida em ADMIN_SENHA.\n"
    : `\n  Primeiro uso: usuário 'admin' criado. A senha está em ${path.join(PASTA_DADOS, "SENHA-INICIAL.txt")}\n`);

  return {
    site: d.SITE,
    editorias: d.EDITORIAS,
    cidadesTempo: d.CIDADES_TEMPO,
    patrocinios: { ...d.PATROCINIOS, apoiadores },
    noticias,
    usuarios: [{ usuario: "admin", nome: "Administrador", papel: "admin", senha: hashSenha(senha), trocarSenha: true }]
  };
}

function carregarBanco() {
  if (fs.existsSync(ARQ_BANCO)) banco = JSON.parse(fs.readFileSync(ARQ_BANCO, "utf8"));
  else { banco = criarBancoInicial(); salvarAgora(); }
}
function salvarAgora() {
  const tmp = ARQ_BANCO + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(banco, null, 2));
  fs.renameSync(tmp, ARQ_BANCO);
}
let timerSalvar = null;
function salvar(imediato = true) {
  if (imediato) { clearTimeout(timerSalvar); timerSalvar = null; return salvarAgora(); }
  if (!timerSalvar) timerSalvar = setTimeout(() => { timerSalvar = null; salvarAgora(); }, 3000);
}
carregarBanco();

/* ---------------- Sessões e segurança ---------------- */
const sessoes = new Map(); // token -> { usuario, expira }
const tentativas = new Map(); // ip -> { n, ate }

function lerCookie(req, nome) {
  const m = (req.headers.cookie || "").match(new RegExp("(?:^|;\\s*)" + nome + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}
function usuarioLogado(req) {
  const t = lerCookie(req, "sessao");
  const s = t && sessoes.get(t);
  if (!s || s.expira < Date.now()) { if (t) sessoes.delete(t); return null; }
  return banco.usuarios.find(u => u.usuario === s.usuario) || null;
}
function ipDe(req) {
  if (TRUST_PROXY && req.headers["x-forwarded-for"]) return String(req.headers["x-forwarded-for"]).split(",")[0].trim();
  return req.socket.remoteAddress || "?";
}
function ehHttps(req) { return TRUST_PROXY && String(req.headers["x-forwarded-proto"] || "").startsWith("https"); }

/* ---------------- Utilidades HTTP ---------------- */
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8"
};

function enviarJSON(res, status, obj, extraHeaders = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders });
  res.end(JSON.stringify(obj));
}
function erro(res, status, msg) { enviarJSON(res, status, { erro: msg }); }

function lerCorpo(req, limite = 12 * 1024 * 1024) {
  return new Promise((ok, falha) => {
    let tam = 0; const partes = [];
    req.on("data", c => {
      tam += c.length;
      if (tam > limite) { falha(Object.assign(new Error("Arquivo muito grande"), { status: 413 })); req.destroy(); }
      else partes.push(c);
    });
    req.on("end", () => {
      try { ok(partes.length ? JSON.parse(Buffer.concat(partes).toString("utf8")) : {}); }
      catch { falha(Object.assign(new Error("JSON inválido"), { status: 400 })); }
    });
    req.on("error", falha);
  });
}

function slug(txt) {
  return String(txt).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "noticia";
}
function linkSeguro(url) {
  url = String(url || "").trim();
  if (!url) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) return url;
  if (/^[a-z0-9_\-./?=&#%]+$/i.test(url) && !url.includes(":")) return url; // link relativo
  return "";
}
const texto = (v, max = 500) => String(v ?? "").trim().slice(0, max);
const lista = (v, max = 50) => (Array.isArray(v) ? v : String(v || "").split("\n")).map(s => String(s).trim()).filter(Boolean).slice(0, max);

/* ---------------- Notícias ---------------- */
function noticiaPublica(n) {
  return n.status === "publicado" && new Date(n.data).getTime() <= Date.now();
}

function limparNoticia(entrada, existente = {}) {
  const n = {
    ...existente,
    titulo: texto(entrada.titulo, 250),
    subtitulo: texto(entrada.subtitulo, 400),
    editoria: banco.editorias[entrada.editoria] ? entrada.editoria : Object.keys(banco.editorias)[0],
    chapeu: texto(entrada.chapeu, 40),
    autor: texto(entrada.autor, 80) || "Redação",
    data: isNaN(new Date(entrada.data)) ? new Date().toISOString() : new Date(entrada.data).toISOString(),
    imagem: linkSeguro(entrada.imagem),
    legenda: texto(entrada.legenda, 250),
    destaque: !!entrada.destaque,
    status: entrada.status === "rascunho" ? "rascunho" : "publicado",
    resumo: lista(entrada.resumo, 6),
    texto: lista(entrada.texto, 300).map(p => p.slice(0, 5000)),
    tags: lista(Array.isArray(entrada.tags) ? entrada.tags : String(entrada.tags || "").split(","), 15).map(t => t.slice(0, 40)),
    atualizadoEm: new Date().toISOString()
  };
  if (!n.resumo.length) delete n.resumo;
  if (!n.titulo) throw Object.assign(new Error("O título é obrigatório"), { status: 400 });
  return n;
}

/* Gera o js/dados.js que o site público usa */
function gerarDadosJS() {
  const publicas = banco.noticias.filter(noticiaPublica).map(({ status, atualizadoEm, criadoPor, ...n }) => n);
  return "/* Gerado automaticamente pelo painel. Não edite. */\n" +
    `const SITE = ${JSON.stringify(banco.site)};\n` +
    `const EDITORIAS = ${JSON.stringify(banco.editorias)};\n` +
    `const CIDADES_TEMPO = ${JSON.stringify(banco.cidadesTempo)};\n` +
    `const PATROCINIOS = ${JSON.stringify(banco.patrocinios)};\n` +
    `const NOTICIAS = ${JSON.stringify(publicas)};\n`;
}

/* ---------------- Rotas da API ---------------- */
async function api(req, res, url) {
  const rota = url.pathname;
  const m = req.method;

  // ---- públicas ----
  if (rota === "/api/login" && m === "POST") {
    const ip = ipDe(req);
    const t = tentativas.get(ip);
    if (t && t.n >= 5 && t.ate > Date.now()) return erro(res, 429, "Muitas tentativas. Aguarde 5 minutos.");
    const { usuario, senha } = await lerCorpo(req);
    const u = banco.usuarios.find(x => x.usuario === String(usuario || "").trim().toLowerCase());
    if (!u || !conferirSenha(senha, u.senha)) {
      const n = (t && t.ate > Date.now() ? t.n : 0) + 1;
      tentativas.set(ip, { n, ate: Date.now() + 5 * 60e3 });
      return erro(res, 401, "Usuário ou senha incorretos");
    }
    tentativas.delete(ip);
    const token = crypto.randomBytes(32).toString("hex");
    sessoes.set(token, { usuario: u.usuario, expira: Date.now() + DURACAO_SESSAO });
    return enviarJSON(res, 200, { ok: true }, {
      "Set-Cookie": `sessao=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${DURACAO_SESSAO / 1000}${ehHttps(req) ? "; Secure" : ""}`
    });
  }
  if (rota === "/api/logout" && m === "POST") {
    sessoes.delete(lerCookie(req, "sessao"));
    return enviarJSON(res, 200, { ok: true }, { "Set-Cookie": "sessao=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
  }
  const mv = rota.match(/^\/api\/visualizar\/([a-z0-9-]+)$/);
  if (mv && m === "POST") {
    const n = banco.noticias.find(x => x.id === mv[1]);
    if (n && noticiaPublica(n)) { n.visualizacoes = (n.visualizacoes || 0) + 1; salvar(false); }
    return enviarJSON(res, 200, { ok: true });
  }

  // ---- daqui para baixo precisa de login ----
  const eu = usuarioLogado(req);
  if (!eu) return erro(res, 401, "Faça login");
  if (m !== "GET" && !String(req.headers["content-type"] || "").includes("application/json"))
    return erro(res, 415, "Envie JSON");
  const ehAdmin = eu.papel === "admin";

  if (rota === "/api/eu" && m === "GET")
    return enviarJSON(res, 200, { usuario: eu.usuario, nome: eu.nome, papel: eu.papel, trocarSenha: !!eu.trocarSenha });

  if (rota === "/api/eu/senha" && m === "POST") {
    const { atual, nova } = await lerCorpo(req);
    if (!conferirSenha(atual, eu.senha)) return erro(res, 400, "Senha atual incorreta");
    if (String(nova || "").length < 8) return erro(res, 400, "A nova senha precisa ter pelo menos 8 caracteres");
    eu.senha = hashSenha(nova); delete eu.trocarSenha; salvar();
    return enviarJSON(res, 200, { ok: true });
  }

  // Painel: tudo de uma vez
  if (rota === "/api/painel" && m === "GET") {
    return enviarJSON(res, 200, {
      site: banco.site, editorias: banco.editorias, patrocinios: banco.patrocinios,
      noticias: [...banco.noticias].sort((a, b) => new Date(b.data) - new Date(a.data))
    });
  }

  // Notícias
  if (rota === "/api/noticias" && m === "POST") {
    const n = limparNoticia(await lerCorpo(req));
    let id = slug(n.titulo), i = 2;
    while (banco.noticias.some(x => x.id === id)) id = `${slug(n.titulo)}-${i++}`;
    Object.assign(n, { id, visualizacoes: 0, criadoPor: eu.usuario });
    banco.noticias.unshift(n); salvar();
    return enviarJSON(res, 201, n);
  }
  const mn = rota.match(/^\/api\/noticias\/([a-z0-9-]+)$/);
  if (mn) {
    const idx = banco.noticias.findIndex(x => x.id === mn[1]);
    if (idx < 0) return erro(res, 404, "Notícia não encontrada");
    if (m === "PUT") {
      banco.noticias[idx] = limparNoticia(await lerCorpo(req), banco.noticias[idx]);
      salvar(); return enviarJSON(res, 200, banco.noticias[idx]);
    }
    if (m === "DELETE") {
      banco.noticias.splice(idx, 1); salvar();
      return enviarJSON(res, 200, { ok: true });
    }
  }

  // Upload de imagem (base64)
  if (rota === "/api/upload" && m === "POST") {
    const { dados } = await lerCorpo(req);
    const mm = String(dados || "").match(/^data:image\/(jpeg|png|webp|gif);base64,(.+)$/);
    if (!mm) return erro(res, 400, "Envie uma imagem JPG, PNG, WEBP ou GIF");
    const buf = Buffer.from(mm[2], "base64");
    if (buf.length > 8 * 1024 * 1024) return erro(res, 413, "Imagem muito grande (máx. 8 MB)");
    const ext = mm[1] === "jpeg" ? "jpg" : mm[1];
    const nome = `${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    fs.writeFileSync(path.join(PASTA_UPLOADS, nome), buf);
    return enviarJSON(res, 201, { url: `uploads/${nome}` });
  }

  // ---- só administradores ----
  if (!ehAdmin) return erro(res, 403, "Somente administradores");

  if (rota === "/api/configuracoes" && m === "PUT") {
    const b = await lerCorpo(req);
    const s = b.site || {};
    banco.site = {
      ...banco.site,
      nome: texto(s.nome, 80) || banco.site.nome, slogan: texto(s.slogan, 120), sigla: texto(s.sigla, 3) || "CD",
      whatsapp: String(s.whatsapp || "").replace(/\D/g, "").slice(0, 15), email: texto(s.email, 120),
      instagram: linkSeguro(s.instagram), facebook: linkSeguro(s.facebook), youtube: linkSeguro(s.youtube),
      brapiToken: texto(s.brapiToken, 80)
    };
    salvar(); return enviarJSON(res, 200, { ok: true });
  }

  if (rota === "/api/patrocinios" && m === "PUT") {
    const b = await lerCorpo(req);
    const slot = x => ({ texto: texto(x && x.texto, 120), imagem: linkSeguro(x && x.imagem), link: linkSeguro(x && x.link) || "anuncie.html" });
    banco.patrocinios = {
      topo: slot(b.topo), lateral: slot(b.lateral), feed: slot(b.feed), artigo: slot(b.artigo),
      apoiadores: (Array.isArray(b.apoiadores) ? b.apoiadores : []).slice(0, 24)
        .map(a => ({ nome: texto(a.nome, 60), imagem: linkSeguro(a.imagem), link: linkSeguro(a.link) }))
        .filter(a => a.nome || a.imagem)
    };
    salvar(); return enviarJSON(res, 200, { ok: true });
  }

  if (rota === "/api/usuarios" && m === "GET")
    return enviarJSON(res, 200, banco.usuarios.map(({ senha, ...u }) => u));

  if (rota === "/api/usuarios" && m === "POST") {
    const b = await lerCorpo(req);
    const usuario = String(b.usuario || "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return erro(res, 400, "Usuário inválido (use letras, números, ponto ou traço)");
    if (banco.usuarios.some(u => u.usuario === usuario)) return erro(res, 400, "Esse usuário já existe");
    if (String(b.senha || "").length < 8) return erro(res, 400, "A senha precisa ter pelo menos 8 caracteres");
    banco.usuarios.push({ usuario, nome: texto(b.nome, 80) || usuario, papel: b.papel === "admin" ? "admin" : "editor", senha: hashSenha(b.senha), trocarSenha: true });
    salvar(); return enviarJSON(res, 201, { ok: true });
  }
  const mu = rota.match(/^\/api\/usuarios\/([a-z0-9._-]+)$/);
  if (mu && m === "DELETE") {
    if (mu[1] === eu.usuario) return erro(res, 400, "Você não pode excluir a si mesmo");
    const idx = banco.usuarios.findIndex(u => u.usuario === mu[1]);
    if (idx < 0) return erro(res, 404, "Usuário não encontrado");
    banco.usuarios.splice(idx, 1);
    for (const [t, s] of sessoes) if (s.usuario === mu[1]) sessoes.delete(t);
    salvar(); return enviarJSON(res, 200, { ok: true });
  }

  return erro(res, 404, "Rota não encontrada");
}

/* ---------------- Arquivos estáticos ---------------- */
const BLOQUEADOS = /^\/(dados|node_modules)(\/|$)|^\/(servidor\.js|package(-lock)?\.json)$|\/\./;

function estatico(req, res, url) {
  let rota = decodeURIComponent(url.pathname);
  if (rota === "/js/dados.js") {
    res.writeHead(200, { "Content-Type": TIPOS[".js"], "Cache-Control": "no-store" });
    return res.end(gerarDadosJS());
  }
  if (rota === "/admin") { res.writeHead(301, { Location: "/admin/" }); return res.end(); }
  if (rota.endsWith("/")) rota += "index.html";
  if (BLOQUEADOS.test(rota)) { res.writeHead(404); return res.end("Não encontrado"); }
  const base = rota.startsWith("/uploads/") ? PASTA_UPLOADS : RAIZ;
  const arq = path.normalize(path.join(base, rota.startsWith("/uploads/") ? rota.slice(9) : rota));
  if (!arq.startsWith(base + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(arq, (e, st) => {
    if (e || !st.isFile()) {
      res.writeHead(404, { "Content-Type": TIPOS[".html"] });
      return res.end(`<meta charset="utf-8"><p style="font-family:sans-serif;padding:40px">Página não encontrada. <a href="/">Voltar ao início</a></p>`);
    }
    const ext = path.extname(arq).toLowerCase();
    res.writeHead(200, {
      "Content-Type": TIPOS[ext] || "application/octet-stream",
      "Cache-Control": rota.startsWith("/uploads/") ? "public, max-age=604800" : "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    });
    fs.createReadStream(arq).pipe(res);
  });
}

/* ---------------- Servidor ---------------- */
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) await api(req, res, url);
    else estatico(req, res, url);
  } catch (e) {
    if (!res.headersSent) erro(res, e.status || 500, e.status ? e.message : "Erro interno");
    if (!e.status) console.error(e);
  }
}).listen(PORTA, () => {
  console.log(`\n  Portal no ar:  http://localhost:${PORTA}`);
  console.log(`  Painel admin:  http://localhost:${PORTA}/admin\n`);
});

process.on("SIGINT", () => { if (timerSalvar) salvarAgora(); process.exit(0); });
process.on("SIGTERM", () => { if (timerSalvar) salvarAgora(); process.exit(0); });
