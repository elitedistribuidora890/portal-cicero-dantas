/* =========================================================
   Portal Cícero Dantas — scripts do site
   (não é preciso editar este arquivo para publicar notícias;
    use js/dados.js)
   ========================================================= */

/* ---------- Utilidades ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const params = new URLSearchParams(location.search);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function dataDe(n) {
  if (n.data) return new Date(n.data.replace(" ", "T"));
  return new Date(Date.now() - (n.horasAtras || 0) * 3600 * 1000);
}

function tempoRelativo(d) {
  const min = Math.round((Date.now() - d) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} hora${h > 1 ? "s" : ""}`;
  const dias = Math.round(h / 24);
  if (dias < 7) return `há ${dias} dia${dias > 1 ? "s" : ""}`;
  return d.toLocaleDateString("pt-BR");
}

function dataCompleta(d) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
}

function tempoLeitura(n) {
  const palavras = (n.texto || []).join(" ").split(/\s+/).length;
  return Math.max(1, Math.round(palavras / 200));
}

const noticiasOrdenadas = () => [...NOTICIAS].sort((a, b) => dataDe(b) - dataDe(a));
const linkNoticia = n => `noticia.html?id=${encodeURIComponent(n.id)}`;
const linkEditoria = k => `editoria.html?e=${encodeURIComponent(k)}`;
const ed = n => EDITORIAS[n.editoria] || { nome: n.editoria, cor: "#0a2545" };

function img(src, alt, extra = "") {
  return `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" ${extra} onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 10%22%3E%3Crect width=%2216%22 height=%2210%22 fill=%22%230a2545%22/%3E%3C/svg%3E'">`;
}

/* ---------- Preferências do leitor ---------- */
function aplicarPreferencias() {
  if (localStorage.getItem("tema") === "escuro") document.documentElement.classList.add("escuro");
  const f = localStorage.getItem("fonte");
  if (f) document.documentElement.style.setProperty("--fonte-base", f + "px");
}
aplicarPreferencias();

function alternarTema() {
  const escuro = document.documentElement.classList.toggle("escuro");
  localStorage.setItem("tema", escuro ? "escuro" : "claro");
  $("#btn-tema").textContent = escuro ? "☀️ Claro" : "🌙 Escuro";
}

function mudarFonte(delta) {
  const atual = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--fonte-base")) || 17;
  const novo = Math.min(24, Math.max(14, atual + delta));
  document.documentElement.style.setProperty("--fonte-base", novo + "px");
  localStorage.setItem("fonte", novo);
}

/* ---------- Componentes comuns ---------- */
function anuncio(tipo, classe) {
  const a = PATROCINIOS[tipo];
  if (!a) return "";
  if (a.imagem) {
    return `<a class="anuncio ${classe}" href="${esc(a.link)}" target="_blank" rel="sponsored noopener" style="background:none;border:0">
      <img src="${esc(a.imagem)}" alt="Patrocinador" style="width:100%;height:100%;object-fit:cover"></a>`;
  }
  return `<div class="anuncio ${classe}"><b>${esc(a.texto)}</b><a href="${esc(a.link)}">Quero anunciar →</a></div>`;
}

function montarCabecalho(editoriaAtiva) {
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const escuro = document.documentElement.classList.contains("escuro");
  const menu = Object.entries(EDITORIAS).map(([k, e]) =>
    `<li><a href="${linkEditoria(k)}" class="${k === editoriaAtiva ? "ativo" : ""}">${esc(e.nome)}</a></li>`).join("");
  const gaveta = Object.entries(EDITORIAS).map(([k, e]) =>
    `<a href="${linkEditoria(k)}"><span class="bolinha" style="background:${e.cor}"></span>${esc(e.nome)}</a>`).join("");
  const ultimas = noticiasOrdenadas().slice(0, 6).map(n =>
    `<a href="${linkNoticia(n)}">${esc(n.titulo)}</a>`).join("");

  document.body.insertAdjacentHTML("afterbegin", `
    <div class="barra-leitura" id="barra-leitura"></div>
    <div class="topo-info"><div class="container">
      <span class="data">📍 Cícero Dantas – BA · ${hoje}</span>
      <span class="acoes">
        <span id="topo-tempo"></span>
        <button id="btn-tema" type="button">${escuro ? "☀️ Claro" : "🌙 Escuro"}</button>
        <a href="anuncie.html">Anuncie</a>
      </span>
    </div></div>
    <header class="cabecalho"><div class="container">
      <button class="btn-menu" id="btn-menu" aria-label="Abrir menu">☰</button>
      <a href="index.html" class="logo" aria-label="${esc(SITE.nome)} — página inicial">
        <img class="logo-img" src="img/logo-horizontal-escura.webp" alt="${esc(SITE.nome)}" width="208" height="46"></a>
      <form class="busca-form" action="busca.html" role="search">
        <input name="q" placeholder="Buscar notícias..." aria-label="Buscar" value="${esc(params.get("q") || "")}">
        <button aria-label="Buscar">🔍</button>
      </form>
    </div></header>
    <nav class="menu-editorias"><ul>
      <li><a href="index.html" class="${!editoriaAtiva && document.body.dataset.pagina === "home" ? "ativo" : ""}">início</a></li>${menu}
    </ul></nav>
    <div class="plantao"><div class="container">
      <strong>AO VIVO</strong><div class="faixa"><span>${ultimas}</span></div>
    </div></div>
    <div class="gaveta-fundo" id="gaveta-fundo"></div>
    <aside class="gaveta" id="gaveta">
      <form action="busca.html" style="padding:0 16px 12px"><input name="q" placeholder="Buscar..." class="tempo-cidade"></form>
      <a href="index.html">🏠 Página inicial</a>
      <h4>Editorias</h4>${gaveta}
      <h4>Portal</h4>
      <a href="sobre.html">ℹ️ Quem somos</a>
      <a href="anuncie.html">📣 Anuncie / Patrocine</a>
      <a href="https://wa.me/${SITE.whatsapp}" target="_blank" rel="noopener">💬 Envie sua notícia</a>
    </aside>`);

  $("#btn-tema").onclick = alternarTema;
  const abrir = () => document.body.classList.add("gaveta-aberta");
  const fechar = () => document.body.classList.remove("gaveta-aberta");
  $("#btn-menu").onclick = abrir;
  $("#gaveta-fundo").onclick = fechar;
  document.addEventListener("keydown", e => e.key === "Escape" && fechar());
}

function montarRodape() {
  const eds = Object.entries(EDITORIAS).map(([k, e]) => `<a href="${linkEditoria(k)}">${esc(e.nome)}</a>`);
  const metade = Math.ceil(eds.length / 2);
  const apoio = (PATROCINIOS.apoiadores || []).map(p => {
    if (typeof p === "string") p = { nome: p };
    const conteudo = p.imagem ? `<img src="${esc(p.imagem)}" alt="${esc(p.nome)}" style="max-height:56px;max-width:90%;object-fit:contain">` : esc(p.nome);
    const externo = p.link && /^https?:/.test(p.link) ? ' target="_blank" rel="sponsored noopener"' : "";
    return `<a href="${esc(p.link || "anuncie.html")}"${externo} title="${esc(p.nome)}">${conteudo}</a>`;
  }).join("");
  document.body.insertAdjacentHTML("beforeend", `
    <section class="patrocinadores"><div class="container">
      <h3>Apoiadores do jornalismo local</h3>
      <div class="lista">${apoio}</div>
    </div></section>
    <footer class="rodape"><div class="container">
      <div class="colunas">
        <div>
          <a href="index.html" aria-label="${esc(SITE.nome)}"><img class="logo-img" src="img/logo-horizontal-escura.webp" alt="${esc(SITE.nome)}" width="244" height="54"></a>
          <p>${esc(SITE.slogan)}. Jornalismo próximo de você, com informação de Cícero Dantas, do nordeste baiano e de toda a Bahia.</p>
          <p>📧 ${esc(SITE.email)}<br>💬 <a href="https://wa.me/${SITE.whatsapp}" style="display:inline">WhatsApp da redação</a></p>
        </div>
        <div><h4>Editorias</h4>${eds.slice(0, metade).join("")}</div>
        <div><h4>&nbsp;</h4>${eds.slice(metade).join("")}</div>
        <div><h4>Portal</h4>
          <a href="sobre.html">Quem somos</a>
          <a href="anuncie.html">Anuncie</a>
          <a href="https://wa.me/${SITE.whatsapp}">Envie sua notícia</a>
          <a href="${esc(SITE.instagram)}" target="_blank" rel="noopener">Instagram</a>
          <a href="${esc(SITE.facebook)}" target="_blank" rel="noopener">Facebook</a>
          <a href="${esc(SITE.youtube)}" target="_blank" rel="noopener">YouTube</a>
        </div>
      </div>
      <div class="copy">
        <span>© ${new Date().getFullYear()} ${esc(SITE.nome)}. Todos os direitos reservados.</span>
        <span>Previsão: Open-Meteo · Cotações: AwesomeAPI / brapi.dev</span>
      </div>
    </div></footer>
    <button class="voltar-topo" id="voltar-topo" aria-label="Voltar ao topo">↑</button>`);

  const btn = $("#voltar-topo");
  btn.onclick = () => scrollTo({ top: 0 });
  addEventListener("scroll", () => btn.classList.toggle("visivel", scrollY > 600), { passive: true });
}

/* ---------- Cartões de notícia ---------- */
function cardImagem(n, classe, nivel = "h3") {
  const e = ed(n);
  return `<a href="${linkNoticia(n)}" class="card-imagem ${classe}" style="--cor:${e.cor}">
    ${img(n.imagem, n.titulo)}
    <div class="sobre"><span class="chapeu">${esc(n.chapeu || e.nome)}</span><${nivel}>${esc(n.titulo)}</${nivel}></div>
  </a>`;
}

function itemFeed(n) {
  const e = ed(n);
  return `<article class="item-feed">
    <a href="${linkNoticia(n)}">
      <span class="chapeu" style="color:${e.cor}">${esc(n.chapeu || e.nome)}</span>
      <h3 class="titulo">${esc(n.titulo)}</h3>
      <p>${esc(n.subtitulo)}</p>
      <div class="meta"><span>${tempoRelativo(dataDe(n))}</span><span>·</span><span>${esc(e.nome)}</span><span>·</span><span>⏱ ${tempoLeitura(n)} min de leitura</span></div>
    </a>
    <a href="${linkNoticia(n)}">${img(n.imagem, n.titulo)}</a>
  </article>`;
}

function cardPequeno(n) {
  const e = ed(n);
  return `<a href="${linkNoticia(n)}" class="card">
    ${img(n.imagem, n.titulo)}
    <div class="corpo"><span class="chapeu" style="color:${e.cor}">${esc(n.chapeu || e.nome)}</span>
      <h3 class="titulo">${esc(n.titulo)}</h3>
      <div class="meta">${tempoRelativo(dataDe(n))}</div></div>
  </a>`;
}

/* Feed com anúncio a cada 4 notícias e botão "carregar mais" */
function feedPaginado(alvo, lista, porPagina = 8) {
  let mostradas = 0;
  const caixa = document.createElement("div");
  caixa.className = "feed";
  const btnBox = document.createElement("div");
  btnBox.className = "btn-centro";
  alvo.append(caixa, btnBox);

  function mais() {
    const fatia = lista.slice(mostradas, mostradas + porPagina);
    caixa.insertAdjacentHTML("beforeend", fatia.map((n, i) =>
      itemFeed(n) + ((mostradas + i + 1) % 4 === 0 ? anuncio("feed", "anuncio-feed") : "")).join(""));
    mostradas += fatia.length;
    btnBox.innerHTML = mostradas < lista.length ? `<button class="btn">Ver mais notícias</button>` : "";
    const b = btnBox.querySelector("button");
    if (b) b.onclick = mais;
  }
  if (!lista.length) caixa.innerHTML = `<div class="vazio">Nenhuma notícia encontrada.</div>`;
  else mais();
}

/* ---------- Coluna lateral ---------- */
function colunaLateral() {
  const temVisitas = NOTICIAS.some(n => n.visualizacoes > 0);
  const mais = temVisitas
    ? [...NOTICIAS].sort((a, b) => (b.visualizacoes || 0) - (a.visualizacoes || 0)).slice(0, 5)
    : [...NOTICIAS].filter(n => n.maisLida).sort((a, b) => a.maisLida - b.maisLida).slice(0, 5);
  const opcoes = CIDADES_TEMPO.map((c, i) => `<option value="${i}">${esc(c.nome)}</option>`).join("");
  return `<aside class="coluna-lateral">
    <section class="widget" id="widget-tempo">
      <h3>☀️ Previsão do tempo <small>Open-Meteo</small></h3>
      <select class="tempo-cidade" id="tempo-cidade" aria-label="Escolher cidade">${opcoes}</select>
      <div id="tempo-conteudo">Carregando previsão…</div>
    </section>
    <section class="widget" id="widget-mercado">
      <h3>📈 Mercado <small id="mercado-hora"></small></h3>
      <div id="mercado-conteudo">Carregando cotações…</div>
    </section>
    ${anuncio("lateral", "anuncio-lateral")}
    <section class="widget mais-lidas">
      <h3>🔥 Mais lidas</h3>
      <ol>${mais.map(n => `<li><a href="${linkNoticia(n)}">${esc(n.titulo)}</a></li>`).join("")}</ol>
    </section>
    <div class="fixa">
      <section class="widget widget-whats">
        <h3>💬 Receba no WhatsApp</h3>
        <p>As principais notícias de Cícero Dantas e da Bahia direto no seu celular.</p>
        <a href="https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent("Quero receber as notícias do " + SITE.nome)}" target="_blank" rel="noopener">Quero receber</a>
      </section>
      ${anuncio("lateral", "anuncio-lateral")}
    </div>
  </aside>`;
}

/* ---------- Previsão do tempo (Open-Meteo, sem chave) ---------- */
const CODIGOS_TEMPO = {
  0: ["☀️", "Céu limpo"], 1: ["🌤️", "Predomínio de sol"], 2: ["⛅", "Parcialmente nublado"], 3: ["☁️", "Nublado"],
  45: ["🌫️", "Neblina"], 48: ["🌫️", "Neblina"], 51: ["🌦️", "Garoa fraca"], 53: ["🌦️", "Garoa"], 55: ["🌧️", "Garoa forte"],
  61: ["🌦️", "Chuva fraca"], 63: ["🌧️", "Chuva"], 65: ["🌧️", "Chuva forte"], 80: ["🌦️", "Pancadas de chuva"],
  81: ["🌧️", "Pancadas de chuva"], 82: ["⛈️", "Pancadas fortes"], 95: ["⛈️", "Trovoadas"], 96: ["⛈️", "Trovoadas"], 99: ["⛈️", "Trovoadas"]
};
const codigo = c => CODIGOS_TEMPO[c] || ["🌡️", "—"];

async function carregarTempo(indice = 0) {
  const c = CIDADES_TEMPO[indice];
  const alvo = $("#tempo-conteudo");
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FBahia&forecast_days=5`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    const [ic, desc] = codigo(d.current.weather_code);
    const dias = d.daily.time.map((t, i) => {
      const nome = i === 0 ? "Hoje" : new Date(t + "T12:00").toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      return `<div><b>${nome}</b><span class="ic">${codigo(d.daily.weather_code[i])[0]}</span><br>
        ${Math.round(d.daily.temperature_2m_max[i])}° <span style="opacity:.6">${Math.round(d.daily.temperature_2m_min[i])}°</span>
        <br><span style="color:#2563eb">💧${d.daily.precipitation_probability_max[i] ?? 0}%</span></div>`;
    }).join("");
    if (alvo) alvo.innerHTML = `
      <div class="tempo-atual"><span class="icone">${ic}</span>
        <div><div class="temp">${Math.round(d.current.temperature_2m)}°C</div><div class="desc">${desc}</div></div></div>
      <div class="tempo-extra"><span>Sensação ${Math.round(d.current.apparent_temperature)}°</span>
        <span>Umidade ${d.current.relative_humidity_2m}%</span><span>Vento ${Math.round(d.current.wind_speed_10m)} km/h</span></div>
      <div class="tempo-dias">${dias}</div>`;
    if (indice === 0) $("#topo-tempo").textContent = `${ic} ${Math.round(d.current.temperature_2m)}°C`;
  } catch (e) {
    if (alvo) alvo.innerHTML = `<p class="desc">Previsão indisponível no momento.</p>`;
  }
}

/* ---------- Cotações (AwesomeAPI + brapi.dev) ---------- */
function linhaMercado(nome, sub, valor, variacao) {
  const v = Number(variacao);
  const classe = v >= 0 ? "alta" : "baixa";
  return `<div class="mercado-linha"><span>${esc(nome)}<small>${esc(sub)}</small></span>
    <span class="valor">${valor}<br><span class="${classe}">${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(2).replace(".", ",")}%</span></span></div>`;
}
const brl = (v, casas = 2) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });

async function carregarMercado() {
  const alvo = $("#mercado-conteudo");
  let html = "";
  try {
    const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,BTC-BRL");
    const d = await r.json();
    if (d.USDBRL) html += linhaMercado("Dólar", "USD / BRL", brl(d.USDBRL.bid, 3), d.USDBRL.pctChange);
    if (d.EURBRL) html += linhaMercado("Euro", "EUR / BRL", brl(d.EURBRL.bid, 3), d.EURBRL.pctChange);
    if (d.BTCBRL) html += linhaMercado("Bitcoin", "BTC / BRL", brl(d.BTCBRL.bid * (d.BTCBRL.bid < 1000 ? 1000 : 1), 0), d.BTCBRL.pctChange);
  } catch (e) { /* segue para as ações */ }
  try {
    const token = SITE.brapiToken ? `?token=${SITE.brapiToken}` : "";
    const lista = SITE.brapiToken ? "^BVSP,PETR4,VALE3,ITUB4" : "PETR4,VALE3,ITUB4,MGLU3";
    const r = await fetch(`https://brapi.dev/api/quote/${lista}${token}`);
    const d = await r.json();
    (d.results || []).forEach(a => {
      const nome = a.symbol === "^BVSP" ? "Ibovespa" : a.symbol;
      const valor = a.symbol === "^BVSP" ? Math.round(a.regularMarketPrice).toLocaleString("pt-BR") + " pts" : brl(a.regularMarketPrice);
      html += linhaMercado(nome, a.shortName || "B3", valor, a.regularMarketChangePercent);
    });
  } catch (e) { /* ignora */ }
  alvo.innerHTML = html || `<p class="desc">Cotações indisponíveis no momento.</p>`;
  $("#mercado-hora").textContent = "Atualizado " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function ativarWidgets() {
  const sel = $("#tempo-cidade");
  if (sel) {
    sel.value = localStorage.getItem("cidade") || "0";
    sel.onchange = () => { localStorage.setItem("cidade", sel.value); carregarTempo(+sel.value); };
    carregarTempo(+sel.value);
    if (sel.value !== "0") carregarTempo(0); // mantém a temperatura de Cícero Dantas no topo
  } else carregarTempo(0);
  if ($("#mercado-conteudo")) { carregarMercado(); setInterval(carregarMercado, 5 * 60 * 1000); }
}

/* =========================================================
   PÁGINAS
   ========================================================= */
function paginaHome(main) {
  const todas = noticiasOrdenadas();
  const destaques = todas.filter(n => n.destaque).slice(0, 3);
  const resto = todas.filter(n => !destaques.includes(n));

  main.innerHTML = `
    <div class="container">
      ${anuncio("topo", "anuncio-topo")}
      <section class="destaques">
        ${destaques[0] ? cardImagem(destaques[0], "principal", "h2") : ""}
        <div class="lado">${destaques.slice(1).map(n => cardImagem(n, "")).join("")}</div>
      </section>
      <div class="layout">
        <div>
          <div class="secao-titulo"><h2>Últimas notícias</h2></div>
          <div id="feed-home"></div>
          ${["cicero-dantas", "esportes", "agro"].map(k => {
            const lista = todas.filter(n => n.editoria === k).slice(0, 3);
            if (!lista.length) return "";
            return `<div class="secao-titulo" style="--cor:${EDITORIAS[k].cor}"><h2>${esc(EDITORIAS[k].nome)}</h2><a href="${linkEditoria(k)}">Ver tudo →</a></div>
              <div class="grade">${lista.map(cardPequeno).join("")}</div>`;
          }).join("")}
        </div>
        ${colunaLateral()}
      </div>
    </div>`;
  feedPaginado($("#feed-home"), resto, 8);
}

function paginaEditoria(main) {
  const k = params.get("e");
  const e = EDITORIAS[k];
  if (!e) return paginaNaoEncontrada(main);
  document.title = `${e.nome} | ${SITE.nome}`;
  const lista = noticiasOrdenadas().filter(n => n.editoria === k);
  main.innerHTML = `
    <div class="cab-editoria" style="--cor:${e.cor}"><div class="container"><h1>${esc(e.nome)}</h1><p>${esc(e.desc)}</p></div></div>
    <div class="container">
      ${anuncio("topo", "anuncio-topo")}
      ${lista[0] ? `<section class="destaques" style="margin-top:0">
          ${cardImagem(lista[0], "principal", "h2")}
          <div class="lado">${lista.slice(1, 3).map(n => cardImagem(n, "")).join("")}</div></section>` : ""}
      <div class="layout"><div id="feed-editoria"></div>${colunaLateral()}</div>
    </div>`;
  feedPaginado($("#feed-editoria"), lista.slice(3), 8);
}

function formatarTexto(paragrafos) {
  return paragrafos.map(p => {
    if (p.startsWith("## ")) return `<h2>${esc(p.slice(3))}</h2>`;
    if (p.startsWith("> ")) return `<blockquote>${esc(p.slice(2))}</blockquote>`;
    return `<p>${esc(p)}</p>`;
  });
}

function paginaNoticia(main) {
  const n = NOTICIAS.find(x => x.id === params.get("id"));
  if (!n) return paginaNaoEncontrada(main);
  const e = ed(n);
  document.title = `${n.titulo} | ${SITE.nome}`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.content = n.subtitulo;

  const blocos = formatarTexto(n.texto || []);
  // anúncio no meio da matéria
  if (blocos.length > 2) blocos.splice(Math.ceil(blocos.length / 2), 0, anuncio("artigo", "anuncio-artigo"));

  const relacionadas = noticiasOrdenadas().filter(x => x.id !== n.id && x.editoria === n.editoria).slice(0, 3);
  const outras = noticiasOrdenadas().filter(x => x.id !== n.id && !relacionadas.includes(x)).slice(0, 6 - relacionadas.length);
  const url = location.href;
  const txtShare = encodeURIComponent(`${n.titulo} — ${url}`);

  main.innerHTML = `
    <div class="container">
      ${anuncio("topo", "anuncio-topo")}
      <div class="layout">
        <div>
          <article class="artigo">
            <a href="${linkEditoria(n.editoria)}" class="chapeu" style="color:${e.cor}">${esc(e.nome)} · ${esc(n.chapeu || "")}</a>
            <h1>${esc(n.titulo)}</h1>
            <p class="subtitulo">${esc(n.subtitulo)}</p>
            <div class="assinatura">
              <span>Por <b>${esc(n.autor || "Redação")}</b>, ${esc(SITE.nome)}<br>
                ${dataCompleta(dataDe(n))} · ⏱ ${tempoLeitura(n)} min de leitura</span>
              <span class="ferramentas">
                <button type="button" onclick="mudarFonte(-1)" aria-label="Diminuir letra">A−</button>
                <button type="button" onclick="mudarFonte(1)" aria-label="Aumentar letra">A+</button>
                <a class="whats" href="https://wa.me/?text=${txtShare}" target="_blank" rel="noopener">WhatsApp</a>
                <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener">Facebook</a>
                <button type="button" id="btn-copiar">🔗 Copiar link</button>
              </span>
            </div>
            <figure>${img(n.imagem, n.titulo)}${n.legenda ? `<figcaption>${esc(n.legenda)}</figcaption>` : ""}</figure>
            ${n.resumo ? `<div class="resumo"><h4>Resumo</h4><ul>${n.resumo.map(r => `<li>${esc(r)}</li>`).join("")}</ul></div>` : ""}
            <div class="conteudo">${blocos.join("")}</div>
            ${n.tags ? `<div class="tags">${n.tags.map(t => `<a href="busca.html?q=${encodeURIComponent(t)}">#${esc(t)}</a>`).join("")}</div>` : ""}
          </article>
          ${relacionadas.length ? `<div class="secao-titulo" style="--cor:${e.cor}"><h2>Mais de ${esc(e.nome)}</h2><a href="${linkEditoria(n.editoria)}">Ver tudo →</a></div>
            <div class="grade">${relacionadas.map(cardPequeno).join("")}</div>` : ""}
          <div class="secao-titulo"><h2>Veja também</h2></div>
          <div class="grade">${outras.map(cardPequeno).join("")}</div>
        </div>
        ${colunaLateral()}
      </div>
    </div>`;

  // conta a visita (somente quando o site roda pelo servidor do painel)
  if (location.protocol.startsWith("http") && !sessionStorage.getItem("v-" + n.id)) {
    sessionStorage.setItem("v-" + n.id, "1");
    fetch("api/visualizar/" + encodeURIComponent(n.id), { method: "POST" }).catch(() => {});
  }

  $("#btn-copiar").onclick = async () => {
    try { await navigator.clipboard.writeText(url); $("#btn-copiar").textContent = "✅ Copiado"; }
    catch { prompt("Copie o link:", url); }
  };
  const barra = $("#barra-leitura");
  const art = $(".artigo");
  addEventListener("scroll", () => {
    const total = art.offsetTop + art.offsetHeight - innerHeight;
    barra.style.width = Math.min(100, Math.max(0, scrollY / total * 100)) + "%";
  }, { passive: true });
}

function normalizar(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function paginaBusca(main) {
  const q = (params.get("q") || "").trim();
  const termos = normalizar(q).split(/\s+/).filter(Boolean);
  const lista = termos.length ? noticiasOrdenadas().filter(n => {
    const alvo = normalizar([n.titulo, n.subtitulo, n.chapeu, ed(n).nome, ...(n.tags || []), ...(n.texto || [])].join(" "));
    return termos.every(t => alvo.includes(t));
  }) : [];
  document.title = `Busca: ${q} | ${SITE.nome}`;
  main.innerHTML = `
    <div class="container">
      <div class="layout">
        <div>
          <div class="secao-titulo"><h2>${q ? `${lista.length} resultado(s) para “${esc(q)}”` : "Buscar notícias"}</h2></div>
          <form action="busca.html" style="display:flex;gap:8px;margin-bottom:16px">
            <input name="q" value="${esc(q)}" placeholder="Digite o que procura..." class="tempo-cidade" style="margin:0;flex:1;font-size:16px">
            <button class="btn">Buscar</button>
          </form>
          <div id="feed-busca"></div>
        </div>
        ${colunaLateral()}
      </div>
    </div>`;
  feedPaginado($("#feed-busca"), lista, 10);
}

function paginaNaoEncontrada(main) {
  main.innerHTML = `<div class="container"><div class="vazio">
    <h1>Página não encontrada</h1><p>O conteúdo que você procura não existe ou foi removido.</p>
    <a class="btn" href="index.html">Voltar para o início</a></div></div>`;
}

/* Páginas estáticas (sobre, anuncie): conteúdo já está no HTML; só adiciona a lateral */
function paginaEstatica(main) {
  const filhos = [...main.childNodes];
  main.innerHTML = `<div class="container"><div class="layout"><div class="pagina"></div>${colunaLateral()}</div></div>`;
  $(".pagina", main).append(...filhos);
}

/* ---------- Inicialização ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const pagina = document.body.dataset.pagina;
  montarCabecalho(pagina === "editoria" ? params.get("e") : (pagina === "noticia" ? (NOTICIAS.find(x => x.id === params.get("id")) || {}).editoria : null));
  const main = $("main");
  ({ home: paginaHome, editoria: paginaEditoria, noticia: paginaNoticia, busca: paginaBusca, estatica: paginaEstatica }[pagina] || paginaNaoEncontrada)(main);
  montarRodape();
  ativarWidgets();
});
