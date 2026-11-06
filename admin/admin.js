/* Painel administrativo — Portal Cícero Dantas */
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const urlImg = u => !u ? "" : /^(https?:|data:|\/)/.test(u) ? u : "/" + u;

let EU = null;
let DADOS = null;          // { site, editorias, patrocinios, noticias }
let alterado = false;      // alterações não salvas no editor

/* ---------------- API ---------------- */
async function api(metodo, rota, corpo) {
  const r = await fetch("/api" + rota, {
    method: metodo,
    headers: metodo !== "GET" ? { "Content-Type": "application/json" } : {},
    body: metodo !== "GET" ? JSON.stringify(corpo || {}) : undefined,
    credentials: "same-origin"
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && rota !== "/login" && rota !== "/eu/senha") { mostrarLogin(); throw new Error("Sessão expirada"); }
  if (!r.ok) throw new Error(j.erro || "Erro " + r.status);
  return j;
}
async function recarregar() { DADOS = await api("GET", "/painel"); }

function aviso(msg, tipo = "") {
  const a = $("#aviso");
  a.textContent = msg; a.className = "aviso mostrar " + tipo;
  clearTimeout(a._t); a._t = setTimeout(() => a.className = "aviso", 3000);
}

/* ---------------- Login ---------------- */
function mostrarLogin() { $("#app").hidden = true; $("#tela-login").hidden = false; }

$("#form-login").addEventListener("submit", async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  $("#erro-login").textContent = "";
  try {
    await api("POST", "/login", { usuario: f.get("usuario"), senha: f.get("senha") });
    e.target.reset();
    await iniciar();
  } catch (err) { $("#erro-login").textContent = err.message; }
});

$("#btn-sair").onclick = async () => { await api("POST", "/logout", {}).catch(() => {}); mostrarLogin(); };
$("#btn-menu").onclick = () => document.body.classList.toggle("menu-aberto");

async function iniciar() {
  try { EU = await api("GET", "/eu"); } catch { return mostrarLogin(); }
  await recarregar();
  $("#tela-login").hidden = true; $("#app").hidden = false;
  $("#quem").textContent = `${EU.nome} · ${EU.papel === "admin" ? "Administrador" : "Editor"}`;
  $$(".so-admin").forEach(a => a.hidden = EU.papel !== "admin");
  if (EU.trocarSenha) location.hash = "#senha";
  rotear();
}

/* ---------------- Rotas ---------------- */
const TELAS = {
  inicio: ["Visão geral", telaInicio],
  noticias: ["Notícias", telaNoticias],
  nova: ["Nova notícia", () => telaEditor(null)],
  editar: ["Editar notícia", id => telaEditor(id)],
  patrocinios: ["Patrocinadores", telaPatrocinios],
  configuracoes: ["Configurações do site", telaConfig],
  usuarios: ["Usuários", telaUsuarios],
  senha: ["Minha senha", telaSenha]
};
let hashAnterior = location.hash;
function rotear() {
  if (alterado && !confirm("Existem alterações não salvas. Sair mesmo assim?")) {
    history.replaceState(null, "", hashAnterior); return;
  }
  alterado = false;
  hashAnterior = location.hash;
  const [nome, param] = (location.hash.slice(1) || "inicio").split("/");
  const [titulo, fn] = TELAS[nome] || TELAS.inicio;
  $("#titulo-tela").textContent = titulo;
  $$(".lateral nav a").forEach(a => a.classList.toggle("ativo", a.dataset.r === nome));
  document.body.classList.remove("menu-aberto");
  scrollTo(0, 0);
  fn(param && decodeURIComponent(param));
}
addEventListener("hashchange", rotear);
addEventListener("beforeunload", e => { if (alterado) { e.preventDefault(); e.returnValue = ""; } });

/* ---------------- Utilidades ---------------- */
function statusDe(n) {
  if (n.status === "rascunho") return ["rascunho", "Rascunho"];
  if (new Date(n.data) > new Date()) return ["agendado", "Agendada"];
  return ["publicado", "Publicada"];
}
const fmtData = d => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
function paraInputData(iso) {
  const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function tagEditoria(k) {
  const e = DADOS.editorias[k] || { nome: k, cor: "#888" };
  return `<span class="tag-ed" style="background:${esc(e.cor)}">${esc(e.nome)}</span>`;
}

/* Seleciona imagem, reduz no navegador e envia */
function escolherImagem() {
  return new Promise(resolve => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/jpeg,image/png,image/webp,image/gif";
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return resolve(null);
      try {
        aviso("Enviando imagem…");
        const dados = f.type === "image/gif" ? await lerArquivo(f) : await reduzirImagem(f, 1600, 0.85);
        const r = await api("POST", "/upload", { dados });
        aviso("Imagem enviada ✓");
        resolve(r.url);
      } catch (e) { aviso(e.message, "erro"); resolve(null); }
    };
    inp.click();
  });
}
const lerArquivo = f => new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = falha; r.readAsDataURL(f); });
async function reduzirImagem(arquivo, largMax, qualidade) {
  const url = await lerArquivo(arquivo);
  const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error("Imagem inválida")); i.src = url; });
  const escala = Math.min(1, largMax / img.width);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
  const ctx = c.getContext("2d");
  if (arquivo.type === "image/png") return (ctx.drawImage(img, 0, 0, c.width, c.height), c.toDataURL("image/png"));
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", qualidade);
}
function ligarFoto(caixa, input) {
  const atualizar = () => {
    const u = input.value.trim();
    caixa.style.backgroundImage = u ? `url("${urlImg(u).replace(/"/g, "%22")}")` : "";
    caixa.classList.toggle("tem", !!u);
  };
  caixa.onclick = async () => { const u = await escolherImagem(); if (u) { input.value = u; atualizar(); input.dispatchEvent(new Event("input", { bubbles: true })); } };
  input.addEventListener("input", atualizar);
  atualizar();
}

/* ---------------- Tela: Visão geral ---------------- */
function telaInicio() {
  const ns = DADOS.noticias;
  const pub = ns.filter(n => statusDe(n)[0] === "publicado");
  const views = ns.reduce((s, n) => s + (n.visualizacoes || 0), 0);
  const top = [...pub].sort((a, b) => (b.visualizacoes || 0) - (a.visualizacoes || 0)).slice(0, 5);
  const hoje = pub.filter(n => new Date(n.data).toDateString() === new Date().toDateString()).length;
  $("#conteudo").innerHTML = `
    ${EU.trocarSenha ? `<div class="alerta">⚠️ Você está usando a senha inicial. <a href="#senha">Troque sua senha agora.</a></div>` : ""}
    <div class="stats">
      <div class="stat"><b>${pub.length}</b><span>Notícias publicadas</span></div>
      <div class="stat" style="border-color:var(--verde)"><b>${hoje}</b><span>Publicadas hoje</span></div>
      <div class="stat" style="border-color:var(--amarelo)"><b>${ns.length - pub.length}</b><span>Rascunhos e agendadas</span></div>
      <div class="stat" style="border-color:var(--vermelho)"><b>${views.toLocaleString("pt-BR")}</b><span>Visualizações totais</span></div>
    </div>
    <div class="linha" style="align-items:start">
      <div class="card"><h2>🔥 Mais lidas</h2>
        ${top.length ? `<table class="tabela"><tbody>${top.map(n => `<tr><td><a href="#editar/${esc(n.id)}" class="tit">${esc(n.titulo)}</a></td><td style="text-align:right;white-space:nowrap">${(n.visualizacoes || 0).toLocaleString("pt-BR")} 👁</td></tr>`).join("")}</tbody></table>` : `<p class="vazio">Nada ainda.</p>`}
      </div>
      <div class="card"><h2>🕒 Últimas alterações</h2>
        <table class="tabela"><tbody>${[...ns].sort((a, b) => new Date(b.atualizadoEm || 0) - new Date(a.atualizadoEm || 0)).slice(0, 5)
          .map(n => `<tr><td><a href="#editar/${esc(n.id)}" class="tit">${esc(n.titulo)}</a><div class="sub">${fmtData(n.atualizadoEm || n.data)}</div></td><td><span class="selo-status s-${statusDe(n)[0]}">${statusDe(n)[1]}</span></td></tr>`).join("")}</tbody></table>
      </div>
    </div>
    <div class="acoes"><a class="btn" href="#nova">➕ Escrever nova notícia</a><a class="btn sec" href="/" target="_blank">🌐 Ver o site</a></div>`;
}

/* ---------------- Tela: Lista de notícias ---------------- */
function telaNoticias() {
  const opts = Object.entries(DADOS.editorias).map(([k, e]) => `<option value="${esc(k)}">${esc(e.nome)}</option>`).join("");
  $("#conteudo").innerHTML = `
    <div class="card">
      <div class="filtros">
        <input id="f-busca" placeholder="🔍 Buscar pelo título…">
        <select id="f-ed"><option value="">Todas as editorias</option>${opts}</select>
        <select id="f-st"><option value="">Todos os status</option><option value="publicado">Publicadas</option><option value="agendado">Agendadas</option><option value="rascunho">Rascunhos</option></select>
        <a class="btn" href="#nova">➕ Nova</a>
      </div>
      <div style="overflow-x:auto"><table class="tabela"><thead><tr>
        <th></th><th>Título</th><th class="col-opc">Editoria</th><th class="col-opc">Data</th><th>Status</th><th class="col-opc">👁</th><th></th>
      </tr></thead><tbody id="lista"></tbody></table></div>
    </div>`;
  const desenhar = () => {
    const q = $("#f-busca").value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const fe = $("#f-ed").value, fs = $("#f-st").value;
    const itens = DADOS.noticias.filter(n =>
      (!fe || n.editoria === fe) && (!fs || statusDe(n)[0] === fs) &&
      (!q || n.titulo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q)));
    $("#lista").innerHTML = itens.length ? itens.map(n => {
      const [cls, rot] = statusDe(n);
      return `<tr>
        <td><img class="mini" src="${esc(urlImg(n.imagem))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"></td>
        <td><a href="#editar/${esc(n.id)}" class="tit">${esc(n.titulo)}</a>${n.destaque ? ' <span title="Destaque na capa">⭐</span>' : ""}<div class="sub">${esc(n.autor || "")}</div></td>
        <td class="col-opc">${tagEditoria(n.editoria)}</td>
        <td class="col-opc sub">${fmtData(n.data)}</td>
        <td><span class="selo-status s-${cls}">${rot}</span></td>
        <td class="col-opc sub">${(n.visualizacoes || 0).toLocaleString("pt-BR")}</td>
        <td style="white-space:nowrap"><a class="btn sec peq" href="#editar/${esc(n.id)}">Editar</a>
          ${cls === "publicado" ? `<a class="btn sec peq" href="/noticia.html?id=${encodeURIComponent(n.id)}" target="_blank" title="Ver no site">↗</a>` : ""}</td>
      </tr>`;
    }).join("") : `<tr><td colspan="7" class="vazio">Nenhuma notícia encontrada.</td></tr>`;
  };
  ["f-busca", "f-ed", "f-st"].forEach(id => $("#" + id).addEventListener("input", desenhar));
  desenhar();
}

/* ---------------- Tela: Editor de notícia ---------------- */
function telaEditor(id) {
  const n = id ? DADOS.noticias.find(x => x.id === id) : null;
  if (id && !n) { $("#conteudo").innerHTML = `<p class="vazio">Notícia não encontrada.</p>`; return; }
  const v = n || { editoria: Object.keys(DADOS.editorias)[0], autor: EU.nome, data: new Date().toISOString(), status: "publicado" };
  const opts = Object.entries(DADOS.editorias).map(([k, e]) => `<option value="${esc(k)}" ${k === v.editoria ? "selected" : ""}>${esc(e.nome)}</option>`).join("");

  $("#conteudo").innerHTML = `
    <form id="form-noticia" class="editor" autocomplete="off">
      <div>
        <div class="card pilha">
          <label>Título <span class="contador" id="c-tit"></span>
            <input name="titulo" class="titulo-input" required maxlength="250" value="${esc(v.titulo)}" placeholder="Escreva um título claro e direto"></label>
          <label>Subtítulo (linha fina)
            <textarea name="subtitulo" rows="2" maxlength="400" placeholder="Complementa o título com mais informação">${esc(v.subtitulo)}</textarea></label>
          <label>Texto da notícia
            <span class="dica">Separe os parágrafos com uma linha em branco. Comece com <b>## </b> para intertítulo e <b>&gt; </b> para citação.</span>
            <div class="barra-ferr">
              <button type="button" data-ins="## ">Intertítulo</button>
              <button type="button" data-ins="> ">Citação</button>
            </div>
            <textarea name="texto" id="texto" rows="18" placeholder="Primeiro parágrafo…">${esc((v.texto || []).join("\n\n"))}</textarea>
            <span class="contador" id="c-texto"></span></label>
          <label>Resumo em tópicos (opcional)
            <span class="dica">Um tópico por linha — aparece num quadro no início da matéria.</span>
            <textarea name="resumo" rows="3">${esc((v.resumo || []).join("\n"))}</textarea></label>
        </div>
      </div>
      <div class="lado">
        <div class="card pilha">
          <div class="acoes">
            <button class="btn verde" data-status="publicado" type="submit">${n && n.status === "publicado" ? "💾 Salvar" : "🚀 Publicar"}</button>
            <button class="btn sec" data-status="rascunho" type="submit">Salvar rascunho</button>
          </div>
          ${n ? `<span class="selo-status s-${statusDe(n)[0]}" style="justify-self:start">${statusDe(n)[1]}</span>` : ""}
          <label>Data e hora de publicação
            <span class="dica">Data futura = notícia agendada.</span>
            <input type="datetime-local" name="data" value="${paraInputData(v.data)}"></label>
          <label>Editoria<select name="editoria">${opts}</select></label>
          <label>Chapéu <span class="dica">Palavra acima do título. Ex.: Obras, Futebol, Clima</span>
            <input name="chapeu" maxlength="40" value="${esc(v.chapeu)}"></label>
          <label>Autor<input name="autor" maxlength="80" value="${esc(v.autor)}"></label>
          <label class="check"><input type="checkbox" name="destaque" ${v.destaque ? "checked" : ""}> ⭐ Destaque na capa</label>
        </div>
        <div class="card pilha">
          <label>Foto principal</label>
          <div class="foto-preview" id="foto">📷 Clique para enviar uma foto</div>
          <input name="imagem" id="imagem" placeholder="ou cole o endereço da imagem" value="${esc(v.imagem)}">
          <label>Legenda / crédito<input name="legenda" maxlength="250" value="${esc(v.legenda)}" placeholder="Ex.: Foto: Fulano / Portal"></label>
        </div>
        <div class="card pilha">
          <label>Tags <span class="dica">Separadas por vírgula</span>
            <input name="tags" value="${esc((v.tags || []).join(", "))}"></label>
          ${n ? `<p class="sub" style="margin:0;font-size:13px;color:var(--suave)">👁 ${(n.visualizacoes || 0).toLocaleString("pt-BR")} visualizações<br>Atualizada em ${fmtData(n.atualizadoEm || n.data)}</p>
            <div class="acoes">
              ${statusDe(n)[0] === "publicado" ? `<a class="btn sec peq" href="/noticia.html?id=${encodeURIComponent(n.id)}" target="_blank">↗ Ver no site</a>` : ""}
              <button class="btn perigo peq" type="button" id="btn-excluir">🗑 Excluir</button>
            </div>` : ""}
        </div>
      </div>
    </form>`;

  const form = $("#form-noticia");
  ligarFoto($("#foto"), $("#imagem"));
  const contar = () => {
    $("#c-tit").textContent = `${form.titulo.value.length}/250`;
    const p = form.texto.value.trim().split(/\s+/).filter(Boolean).length;
    $("#c-texto").textContent = `${p} palavras · ~${Math.max(1, Math.round(p / 200))} min de leitura`;
  };
  form.addEventListener("input", () => { alterado = true; contar(); });
  contar();

  $$("[data-ins]", form).forEach(b => b.onclick = () => {
    const ta = $("#texto"), ini = ta.selectionStart;
    const antes = ta.value.slice(0, ini), pref = antes && !antes.endsWith("\n\n") ? (antes.endsWith("\n") ? "\n" : "\n\n") : "";
    ta.setRangeText(pref + b.dataset.ins, ini, ta.selectionEnd, "end");
    ta.focus(); alterado = true;
  });

  let statusEscolhido = "publicado";
  $$("[data-status]", form).forEach(b => b.addEventListener("click", () => statusEscolhido = b.dataset.status));

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(form);
    const corpo = {
      titulo: f.get("titulo"), subtitulo: f.get("subtitulo"), editoria: f.get("editoria"), chapeu: f.get("chapeu"),
      autor: f.get("autor"), data: new Date(f.get("data") || Date.now()).toISOString(), imagem: f.get("imagem"),
      legenda: f.get("legenda"), destaque: f.get("destaque") === "on", status: statusEscolhido,
      resumo: f.get("resumo").split("\n"), texto: f.get("texto").split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, " ").trim()),
      tags: f.get("tags")
    };
    $$("button", form).forEach(b => b.disabled = true);
    try {
      const salvo = n ? await api("PUT", "/noticias/" + n.id, corpo) : await api("POST", "/noticias", corpo);
      alterado = false;
      await recarregar();
      aviso(statusEscolhido === "rascunho" ? "Rascunho salvo ✓" : (new Date(salvo.data) > new Date() ? "Notícia agendada ✓" : "Notícia publicada ✓"));
      if (n) telaEditor(salvo.id); else location.hash = "#editar/" + salvo.id;
    } catch (err) { aviso(err.message, "erro"); $$("button", form).forEach(b => b.disabled = false); }
  });

  if (n) $("#btn-excluir").onclick = async () => {
    if (!confirm(`Excluir a notícia "${n.titulo}"?\nEssa ação não pode ser desfeita.`)) return;
    try { await api("DELETE", "/noticias/" + n.id); alterado = false; await recarregar(); aviso("Notícia excluída"); location.hash = "#noticias"; }
    catch (err) { aviso(err.message, "erro"); }
  };
}

/* ---------------- Tela: Patrocinadores ---------------- */
function telaPatrocinios() {
  const p = DADOS.patrocinios;
  const SLOTS = [
    ["topo", "Banner do topo", "970x90 px — aparece no alto de todas as páginas"],
    ["lateral", "Banner lateral", "300x250 px — coluna da direita (aparece 2 vezes)"],
    ["feed", "Banner no feed", "Largura total, ~130 px de altura — a cada 4 notícias"],
    ["artigo", "Banner dentro da matéria", "Largura total, ~140 px de altura — no meio do texto"]
  ];
  $("#conteudo").innerHTML = `
    <form id="form-pat">
      <div class="card"><h2>Espaços de anúncio</h2>
        <p class="sub" style="color:var(--suave);margin-top:-6px">Sem imagem, o espaço mostra um convite "Anuncie aqui" com o texto abaixo.</p>
        ${SLOTS.map(([k, nome, dica]) => `<div class="slot">
          <div><div class="foto-preview" id="foto-${k}">📷 Enviar banner</div>
            <button type="button" class="btn sec peq" style="margin-top:6px" data-limpar="${k}">Remover imagem</button></div>
          <div class="pilha">
            <b>${nome}</b><span class="sub" style="color:var(--suave);font-size:13px;margin-top:-10px">${dica}</span>
            <input type="hidden" name="${k}-imagem" id="img-${k}" value="${esc(p[k]?.imagem)}">
            <label>Link do anunciante<input name="${k}-link" value="${esc(p[k]?.link)}" placeholder="https://… ou https://wa.me/55…"></label>
            <label>Texto (quando não há imagem)<input name="${k}-texto" value="${esc(p[k]?.texto)}"></label>
          </div></div>`).join("")}
      </div>
      <div class="card"><h2>Apoiadores (rodapé)</h2>
        <div id="apoiadores"></div>
        <button type="button" class="btn sec" id="add-apoiador">➕ Adicionar apoiador</button>
      </div>
      <button class="btn verde">💾 Salvar patrocinadores</button>
    </form>`;

  SLOTS.forEach(([k]) => ligarFoto($("#foto-" + k), $("#img-" + k)));
  $$("[data-limpar]").forEach(b => b.onclick = () => { const i = $("#img-" + b.dataset.limpar); i.value = ""; i.dispatchEvent(new Event("input")); });

  const lista = $("#apoiadores");
  const addApoiador = (a = {}) => {
    const d = document.createElement("div");
    d.className = "apoiador";
    d.innerHTML = `<div class="foto-preview">Logo</div><input type="hidden" class="a-img" value="${esc(a.imagem)}">
      <input class="a-nome" placeholder="Nome" value="${esc(a.nome)}">
      <input class="a-link" placeholder="Link (opcional)" value="${esc(a.link)}">
      <button type="button" class="btn sec peq">✕</button>`;
    lista.append(d);
    ligarFoto($(".foto-preview", d), $(".a-img", d));
    $("button", d).onclick = () => d.remove();
  };
  (p.apoiadores || []).forEach(a => addApoiador(typeof a === "string" ? { nome: a } : a));
  $("#add-apoiador").onclick = () => addApoiador();

  $("#form-pat").addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const corpo = { apoiadores: $$(".apoiador").map(d => ({ nome: $(".a-nome", d).value, link: $(".a-link", d).value, imagem: $(".a-img", d).value })) };
    SLOTS.forEach(([k]) => corpo[k] = { imagem: f.get(k + "-imagem"), link: f.get(k + "-link"), texto: f.get(k + "-texto") });
    try { await api("PUT", "/patrocinios", corpo); await recarregar(); aviso("Patrocinadores salvos ✓"); telaPatrocinios(); }
    catch (err) { aviso(err.message, "erro"); }
  });
}

/* ---------------- Tela: Configurações ---------------- */
function telaConfig() {
  const s = DADOS.site;
  const campo = (n, rot, dica = "", tipo = "text") =>
    `<label>${rot}${dica ? ` <span class="dica">${dica}</span>` : ""}<input name="${n}" type="${tipo}" value="${esc(s[n])}"></label>`;
  $("#conteudo").innerHTML = `
    <form id="form-cfg">
      <div class="card"><h2>Identidade</h2><div class="linha">
        ${campo("nome", "Nome do portal")}${campo("slogan", "Slogan")}${campo("sigla", "Sigla do logo", "até 3 letras")}
      </div></div>
      <div class="card"><h2>Contato e redes sociais</h2><div class="linha">
        ${campo("whatsapp", "WhatsApp da redação", "com DDI e DDD, só números: 5575999999999")}
        ${campo("email", "E-mail", "", "email")}
        ${campo("instagram", "Instagram (link)")}${campo("facebook", "Facebook (link)")}${campo("youtube", "YouTube (link)")}
      </div></div>
      <div class="card"><h2>Cotações</h2>
        ${campo("brapiToken", "Chave do brapi.dev (opcional)", "Gratuita em brapi.dev — com ela o quadro de Mercado mostra também o Ibovespa")}
      </div>
      <button class="btn verde">💾 Salvar configurações</button>
    </form>`;
  $("#form-cfg").addEventListener("submit", async e => {
    e.preventDefault();
    try { await api("PUT", "/configuracoes", { site: Object.fromEntries(new FormData(e.target)) }); await recarregar(); aviso("Configurações salvas ✓"); }
    catch (err) { aviso(err.message, "erro"); }
  });
}

/* ---------------- Tela: Usuários ---------------- */
async function telaUsuarios() {
  const us = await api("GET", "/usuarios");
  $("#conteudo").innerHTML = `
    <div class="card"><h2>Equipe</h2>
      <table class="tabela"><thead><tr><th>Nome</th><th>Usuário</th><th>Permissão</th><th></th></tr></thead><tbody>
      ${us.map(u => `<tr><td class="tit">${esc(u.nome)}</td><td>${esc(u.usuario)}</td>
        <td>${u.papel === "admin" ? "Administrador" : "Editor"}</td>
        <td style="text-align:right">${u.usuario !== EU.usuario ? `<button class="btn sec peq" data-del="${esc(u.usuario)}">Remover</button>` : "<i class='sub'>você</i>"}</td></tr>`).join("")}
      </tbody></table>
      <p style="color:var(--suave);font-size:13px">Editores escrevem e publicam notícias. Administradores também mexem em patrocinadores, configurações e usuários.</p>
    </div>
    <form class="card" id="form-user"><h2>Adicionar pessoa</h2>
      <div class="linha">
        <label>Nome<input name="nome" required></label>
        <label>Usuário (login)<input name="usuario" required pattern="[a-zA-Z0-9._\\-]{3,30}"></label>
        <label>Senha provisória<input name="senha" type="password" minlength="8" required autocomplete="new-password"></label>
        <label>Permissão<select name="papel"><option value="editor">Editor</option><option value="admin">Administrador</option></select></label>
      </div><br>
      <button class="btn">➕ Adicionar</button>
    </form>`;
  $$("[data-del]").forEach(b => b.onclick = async () => {
    if (!confirm(`Remover o acesso de "${b.dataset.del}"?`)) return;
    try { await api("DELETE", "/usuarios/" + b.dataset.del); aviso("Usuário removido"); telaUsuarios(); } catch (err) { aviso(err.message, "erro"); }
  });
  $("#form-user").addEventListener("submit", async e => {
    e.preventDefault();
    try { await api("POST", "/usuarios", Object.fromEntries(new FormData(e.target))); aviso("Usuário criado ✓ — ele deverá trocar a senha no primeiro acesso"); telaUsuarios(); }
    catch (err) { aviso(err.message, "erro"); }
  });
}

/* ---------------- Tela: Minha senha ---------------- */
function telaSenha() {
  $("#conteudo").innerHTML = `
    ${EU.trocarSenha ? `<div class="alerta">⚠️ Por segurança, defina uma senha nova antes de continuar.</div>` : ""}
    <form class="card pilha" id="form-senha" style="max-width:420px">
      <label>Senha atual<input type="password" name="atual" required autocomplete="current-password"></label>
      <label>Nova senha <span class="dica">mínimo 8 caracteres</span><input type="password" name="nova" minlength="8" required autocomplete="new-password"></label>
      <label>Repita a nova senha<input type="password" name="nova2" minlength="8" required autocomplete="new-password"></label>
      <button class="btn">Salvar nova senha</button>
    </form>`;
  $("#form-senha").addEventListener("submit", async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (f.nova !== f.nova2) return aviso("As senhas não conferem", "erro");
    try { await api("POST", "/eu/senha", { atual: f.atual, nova: f.nova }); EU.trocarSenha = false; aviso("Senha alterada ✓"); location.hash = "#inicio"; }
    catch (err) { aviso(err.message, "erro"); }
  });
}

iniciar();
