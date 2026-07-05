/* Amazon価格トラッカー フロントエンド（依存ライブラリなし） */
"use strict";

// ---------- i18n ----------
const I18N = {
  ja: {
    siteTitle: "ガジェット価格トラッカー",
    statTotal: "登録商品数", statDrops: "値下げ商品数", statUpdated: "最終更新", unitItems: "件",
    navHome: "ホーム", navRanking: "ランキング", navFavorites: "お気に入り", navSettings: "設定",
    searchPh: "商品名で絞り込み",
    sortRecommend: "おすすめ順（初期状態）", sortDrop: "値下げ率順",
    sortPriceAsc: "価格が安い順", sortPriceDesc: "価格が高い順", sortRank: "売れ筋順",
    reset: "元に戻す", fltGenre: "カテゴリ", fltTheme: "テーマ",
    fltDropLabel: "値下げ中", fltFavLabel: "お気に入り", fltLowLabel: "過去最安圏",
    fltFilter: "絞り込み", fltBrand: "ブランド", fltPrice: "価格",
    fltDropRate: "値下げ率", fltRating: "星評価", fltReviews: "レビュー数", fltRank: "売れ筋順位",
    phMin: "下限", phMax: "上限", noLimit: "指定なし", clearAll: "条件をすべて解除",
    optDrop: "{v}%以上", optRating: "★{v}以上", optReviews: "{v}件以上", optRank: "{v}位以内",
    more: "もっと見る", results: "全{n}件中 {s}件を表示",
    rankSales: "売れ筋", rankDrop: "値下げ率", rankViews: "閲覧数",
    favHint: "商品カードの☆でお気に入りに追加できます。お気に入り商品が値下げされるとここでハイライトされます。",
    favEmpty: "お気に入りはまだありません。",
    setLang: "言語 / Language", setNotify: "値下げ通知",
    setNotifyHint: "アプリ版でプッシュ通知に対応予定です。現在はお気に入り商品の値下げをお気に入りページでハイライト表示します。",
    setThreshold: "値下げ判定しきい値",
    btnAmazon: "Amazonで確認", btnDetail: "詳細データ",
    drop: "値下がり", point: "ポイント", fetched: "取得",
    curPrice: "現在価格", basePrice: "30日基準価格", lowPrice: "過去最安",
    chartHint: "価格は取得時点の観測値です。グラフは日々蓄積されます。",
    noHistory: "履歴データがまだありません。",
    prNote: "#PR 当サイトはAmazonアソシエイト・プログラムのアフィリエイトリンクを含みます。価格は取得時点のものであり、最新の価格はAmazonの商品ページでご確認ください。",
    rankUnit: "位", reviewsUnit: "件",
  },
  en: {
    siteTitle: "Gadget Price Tracker",
    statTotal: "Products", statDrops: "Price drops", statUpdated: "Updated", unitItems: "",
    navHome: "Home", navRanking: "Ranking", navFavorites: "Favorites", navSettings: "Settings",
    searchPh: "Filter by product name",
    sortRecommend: "Recommended (default)", sortDrop: "Biggest drop",
    sortPriceAsc: "Price: low to high", sortPriceDesc: "Price: high to low", sortRank: "Best sellers",
    reset: "Reset", fltGenre: "Category", fltTheme: "Theme",
    fltDropLabel: "On sale", fltFavLabel: "Favorites", fltLowLabel: "Near all-time low",
    fltFilter: "Filters", fltBrand: "Brand", fltPrice: "Price",
    fltDropRate: "Discount", fltRating: "Rating", fltReviews: "Reviews", fltRank: "Sales rank",
    phMin: "Min", phMax: "Max", noLimit: "Any", clearAll: "Clear all filters",
    optDrop: "{v}%+", optRating: "★{v}+", optReviews: "{v}+", optRank: "Top {v}",
    more: "Show more", results: "Showing {s} of {n} items",
    rankSales: "Best sellers", rankDrop: "Price drop %", rankViews: "Most viewed",
    favHint: "Tap the star on a product card to add favorites. Discounted favorites are highlighted here.",
    favEmpty: "No favorites yet.",
    setLang: "言語 / Language", setNotify: "Price drop alerts",
    setNotifyHint: "Push notifications are planned for the app version. For now, discounted favorites are highlighted on the Favorites page.",
    setThreshold: "Drop threshold",
    btnAmazon: "View on Amazon", btnDetail: "Price history",
    drop: "Drop", point: "pts", fetched: "Fetched",
    curPrice: "Current", basePrice: "30-day base", lowPrice: "All-time low",
    chartHint: "Prices are observed values at fetch time. History accumulates daily.",
    noHistory: "No history data yet.",
    prNote: "#PR This site contains Amazon Associates affiliate links. Prices are as of fetch time; check the Amazon product page for current prices.",
    rankUnit: "", reviewsUnit: "",
  },
};

// ---------- 状態 ----------
function defaultFilters() {
  return {
    q: "", sort: "recommend",
    genres: new Set(), brands: new Set(),
    drop: false, fav: false, low: false,
    priceMin: null, priceMax: null,
    minDrop: 0, minRating: 0, minReviews: 0, maxRank: 0,
  };
}

const state = {
  lang: localStorage.getItem("lang") || "ja",
  threshold: parseFloat(localStorage.getItem("threshold") || "3"),
  favs: new Set(JSON.parse(localStorage.getItem("favs") || "[]")),
  products: [],
  meta: {},
  shown: 20,
  rankTab: "sales",
  filters: defaultFilters(),
};

const t = (key) => (I18N[state.lang][key] !== undefined ? I18N[state.lang][key] : I18N.ja[key] || key);
const $ = (id) => document.getElementById(id);
const yen = (n) => (n == null ? "-" : n.toLocaleString("ja-JP") + (state.lang === "ja" ? "円" : " JPY"));

function amazonUrl(asin) {
  const tag = state.meta.affiliate_tag;
  return `https://www.amazon.co.jp/dp/${asin}` + (tag ? `?tag=${encodeURIComponent(tag)}` : "");
}

function genreLabel(g) {
  const info = (state.meta.genres || {})[g];
  return info ? (state.lang === "ja" ? info.ja : info.en) : g;
}

function fmtTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------- 閲覧カウンター（任意・Cloudflare Worker） ----------
function beacon(kind, asin) {
  if (!state.meta.counter_url) return;
  try { navigator.sendBeacon(`${state.meta.counter_url}/hit?asin=${asin}&kind=${kind}`); } catch (e) {}
}

// ---------- 初期化 ----------
async function init() {
  const bust = `?v=${Math.floor(Date.now() / 300000)}`; // 5分キャッシュ
  const [meta, products] = await Promise.all([
    fetch(`data/meta.json${bust}`).then((r) => r.json()),
    fetch(`data/products.json${bust}`).then((r) => r.json()),
  ]);
  state.meta = meta;
  state.products = products;

  applyI18n();
  bindEvents();
  route();
}

function applyI18n() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  $("langSel").value = state.lang;
  $("thresholdSel").value = String(state.threshold);
  $("statTotal").textContent = state.meta.total ?? "-";
  $("statDrops").textContent = state.products.filter((p) => p.drop_pct >= state.threshold).length;
  $("statUpdated").textContent = fmtTime(state.meta.updated);
  $("tabViews").hidden = !state.meta.counter_url;
  buildFilterPanel();
  renderAll();
}

// ---------- 絞り込みパネル ----------
function checkRow(labelText, count, checked, onChange) {
  const label = document.createElement("label");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = checked;
  cb.addEventListener("change", () => onChange(cb.checked));
  const span = document.createElement("span");
  span.textContent = labelText;
  label.append(cb, span);
  if (count != null) {
    const cnt = document.createElement("span");
    cnt.className = "cnt";
    cnt.textContent = count.toLocaleString();
    label.appendChild(cnt);
  }
  return label;
}

function fillSelect(id, values, fmtKey, current) {
  const sel = $(id);
  sel.innerHTML = "";
  for (const v of values) {
    const opt = document.createElement("option");
    opt.value = String(v);
    opt.textContent = v === 0 ? t("noLimit") : t(fmtKey).replace("{v}", v.toLocaleString());
    sel.appendChild(opt);
  }
  sel.value = String(current);
}

function buildFilterPanel() {
  const f = state.filters;

  // カテゴリ（件数付き）
  const gWrap = $("fltGenres");
  gWrap.innerHTML = "";
  for (const g of Object.keys(state.meta.genres || {})) {
    const count = state.products.filter((p) => p.genre === g).length;
    gWrap.appendChild(checkRow(genreLabel(g), count, f.genres.has(g), (on) => {
      on ? f.genres.add(g) : f.genres.delete(g);
      state.shown = 20;
      buildBrandList();
      renderCards();
    }));
  }

  // セレクト群
  fillSelect("fltMinDrop", [0, 3, 5, 10, 20, 30], "optDrop", f.minDrop);
  fillSelect("fltMinRating", [0, 3.5, 4, 4.5], "optRating", f.minRating);
  fillSelect("fltMinReviews", [0, 50, 100, 500, 1000], "optReviews", f.minReviews);
  fillSelect("fltMaxRank", [0, 100, 1000, 10000], "optRank", f.maxRank);

  // テーマ・価格の現在値を反映
  $("fltDrop").checked = f.drop;
  $("fltFav").checked = f.fav;
  $("fltLow").checked = f.low;
  $("fltPriceMin").value = f.priceMin ?? "";
  $("fltPriceMax").value = f.priceMax ?? "";

  buildBrandList();
}

function buildBrandList() {
  const f = state.filters;
  const wrap = $("fltBrands");
  wrap.innerHTML = "";
  // 選択中カテゴリの範囲でブランドを集計（価格.com風に件数を添える）
  const scope = state.products.filter((p) => !f.genres.size || f.genres.has(p.genre));
  const counts = new Map();
  for (const p of scope) counts.set(p.brand, (counts.get(p.brand) || 0) + 1);
  const brands = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [brand, count] of brands) {
    wrap.appendChild(checkRow(brand, count, f.brands.has(brand), (on) => {
      on ? f.brands.add(brand) : f.brands.delete(brand);
      state.shown = 20;
      renderCards();
    }));
  }
}

function openFilter() {
  $("filterPanel").classList.add("open");
  $("filterOverlay").classList.add("show");
}
function closeFilter() {
  $("filterPanel").classList.remove("open");
  $("filterOverlay").classList.remove("show");
}

function resetFilters() {
  state.filters = defaultFilters();
  $("searchBox").value = "";
  $("sortSel").value = "recommend";
  state.shown = 20;
  buildFilterPanel();
  renderCards();
}

// ---------- ルーティング ----------
function route() {
  const hash = location.hash || "#/home";
  const page = hash.replace("#/", "") || "home";
  document.querySelectorAll(".page").forEach((s) => { s.hidden = true; });
  const target = $(`page-${page}`) || $("page-home");
  target.hidden = false;
  document.querySelectorAll(".drawer a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === hash);
  });
  closeDrawer();
  closeFilter();
  if (page === "ranking") renderRanking();
  if (page === "favorites") renderFavorites();
  window.scrollTo(0, 0);
}

function openDrawer() {
  $("drawer").classList.add("open");
  $("drawerOverlay").classList.add("show");
}
function closeDrawer() {
  $("drawer").classList.remove("open");
  $("drawerOverlay").classList.remove("show");
}

// ---------- ホーム ----------
function filteredProducts() {
  const f = state.filters;
  let list = state.products.filter((p) => p.price != null);
  if (f.q) {
    const q = f.q.toLowerCase();
    list = list.filter((p) => p.title.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
  }
  if (f.genres.size) list = list.filter((p) => f.genres.has(p.genre));
  if (f.brands.size) list = list.filter((p) => f.brands.has(p.brand));
  if (f.drop) list = list.filter((p) => p.drop_pct >= state.threshold);
  if (f.fav) list = list.filter((p) => state.favs.has(p.asin));
  if (f.low) list = list.filter((p) => p.low != null && p.price <= p.low * 1.03);
  if (f.priceMin != null) list = list.filter((p) => p.price >= f.priceMin);
  if (f.priceMax != null) list = list.filter((p) => p.price <= f.priceMax);
  if (f.minDrop) list = list.filter((p) => p.drop_pct >= f.minDrop);
  if (f.minRating) list = list.filter((p) => (p.rating || 0) >= f.minRating);
  if (f.minReviews) list = list.filter((p) => (p.reviews || 0) >= f.minReviews);
  if (f.maxRank) list = list.filter((p) => p.sales_rank && p.sales_rank <= f.maxRank);

  const sorters = {
    drop: (a, b) => b.drop_pct - a.drop_pct,
    priceAsc: (a, b) => a.price - b.price,
    priceDesc: (a, b) => b.price - a.price,
    rank: (a, b) => (a.sales_rank || 9e9) - (b.sales_rank || 9e9),
    // おすすめ: 値下げ中を上に、その中で値下げ率→売れ筋
    recommend: (a, b) =>
      (b.drop_pct >= state.threshold) - (a.drop_pct >= state.threshold) ||
      b.drop_pct - a.drop_pct ||
      (a.sales_rank || 9e9) - (b.sales_rank || 9e9),
  };
  return list.sort(sorters[f.sort] || sorters.recommend);
}

function productCard(p, highlight) {
  const card = document.createElement("div");
  card.className = "card" + (highlight ? " highlight" : "");
  const hasDrop = p.drop_pct >= state.threshold;

  const head = document.createElement("div");
  head.className = "card-head";
  head.innerHTML = `<span class="tag">${genreLabel(p.genre)}</span>` +
    (hasDrop ? `<span class="badge-drop">${t("drop")} -${p.drop_pct}%</span>` : "");
  card.appendChild(head);

  const fav = document.createElement("button");
  fav.className = "fav-btn" + (state.favs.has(p.asin) ? " on" : "");
  fav.textContent = state.favs.has(p.asin) ? "★" : "☆";
  fav.addEventListener("click", () => {
    if (state.favs.has(p.asin)) state.favs.delete(p.asin); else state.favs.add(p.asin);
    localStorage.setItem("favs", JSON.stringify([...state.favs]));
    fav.classList.toggle("on");
    fav.textContent = state.favs.has(p.asin) ? "★" : "☆";
  });
  card.appendChild(fav);

  const title = document.createElement("p");
  title.className = "card-title";
  title.textContent = p.title;
  card.appendChild(title);

  const imgWrap = document.createElement("div");
  imgWrap.className = "card-img";
  if (p.image) {
    const img = document.createElement("img");
    img.src = p.image; img.loading = "lazy"; img.alt = p.title;
    imgWrap.appendChild(img);
  }
  card.appendChild(imgWrap);

  const priceLine = document.createElement("div");
  priceLine.className = "price-line";
  priceLine.innerHTML =
    (hasDrop && p.baseline ? `<span class="price-old">${yen(p.baseline)}</span>` : "") +
    `<span class="price-now">${yen(p.price)}</span>` +
    (hasDrop ? `<span class="price-pct">(-${p.drop_pct}%)</span>` : "");
  card.appendChild(priceLine);

  const meta = document.createElement("div");
  meta.className = "card-meta";
  const bits = [];
  if (p.rating) bits.push(`★${p.rating}` + (p.reviews ? ` (${p.reviews.toLocaleString()}${t("reviewsUnit")})` : ""));
  if (p.sales_rank) bits.push(`${t("rankSales")} ${p.sales_rank.toLocaleString()}${t("rankUnit")}`);
  bits.push(`${t("fetched")}: ${fmtTime(p.updated)}`);
  meta.textContent = bits.join(" | ");
  card.appendChild(meta);

  const btns = document.createElement("div");
  btns.className = "card-btns";
  const row = document.createElement("div");
  row.className = "btn-row";
  const az = document.createElement("a");
  az.className = "btn-amazon";
  az.textContent = t("btnAmazon");
  az.href = amazonUrl(p.asin);
  az.target = "_blank";
  az.rel = "nofollow noopener sponsored";
  az.addEventListener("click", () => beacon("click", p.asin));
  const dt = document.createElement("button");
  dt.className = "btn-detail";
  dt.textContent = t("btnDetail");
  dt.addEventListener("click", () => openModal(p));
  row.append(az, dt);
  btns.appendChild(row);
  card.appendChild(btns);

  return card;
}

function renderCards() {
  const list = filteredProducts();
  const wrap = $("cards");
  wrap.innerHTML = "";
  list.slice(0, state.shown).forEach((p) => wrap.appendChild(productCard(p)));
  $("resultCount").textContent = t("results")
    .replace("{n}", list.length).replace("{s}", Math.min(state.shown, list.length));
  $("moreBtn").style.display = list.length > state.shown ? "block" : "none";
}

// ---------- ランキング ----------
async function renderRanking() {
  const wrap = $("rankList");
  wrap.innerHTML = "";
  let list = state.products.filter((p) => p.price != null);

  if (state.rankTab === "sales") {
    list = list.filter((p) => p.sales_rank).sort((a, b) => a.sales_rank - b.sales_rank);
  } else if (state.rankTab === "drop") {
    list = list.filter((p) => p.drop_pct > 0).sort((a, b) => b.drop_pct - a.drop_pct);
  } else if (state.rankTab === "views") {
    try {
      const res = await fetch(`${state.meta.counter_url}/top?n=50`);
      const counts = await res.json(); // {asin: count}
      list = list.filter((p) => counts[p.asin])
        .sort((a, b) => counts[b.asin] - counts[a.asin])
        .map((p) => ({ ...p, _views: counts[p.asin] }));
    } catch (e) { list = []; }
  }

  list.slice(0, 50).forEach((p, i) => {
    const item = document.createElement("div");
    item.className = "rank-item";
    const sub = state.rankTab === "sales"
      ? `${t("rankSales")} ${p.sales_rank.toLocaleString()}${t("rankUnit")}`
      : state.rankTab === "drop"
        ? `${t("drop")} -${p.drop_pct}%`
        : `${p._views.toLocaleString()} views`;
    item.innerHTML =
      `<span class="rank-no${i < 3 ? " top" : ""}">${i + 1}</span>` +
      (p.image ? `<img src="${p.image}" loading="lazy" alt="">` : "") +
      `<div class="rank-info"><div class="rank-title"></div><div class="rank-sub">${sub}</div></div>` +
      `<span class="rank-price">${yen(p.price)}</span>`;
    item.querySelector(".rank-title").textContent = p.title;
    item.addEventListener("click", () => openModal(p));
    wrap.appendChild(item);
  });
}

// ---------- お気に入り ----------
function renderFavorites() {
  const wrap = $("favCards");
  wrap.innerHTML = "";
  const favs = state.products.filter((p) => state.favs.has(p.asin));
  if (!favs.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = t("favEmpty");
    wrap.appendChild(p);
    return;
  }
  favs.sort((a, b) => b.drop_pct - a.drop_pct)
    .forEach((p) => wrap.appendChild(productCard(p, p.drop_pct >= state.threshold)));
}

// ---------- 詳細モーダル ----------
async function openModal(p) {
  beacon("view", p.asin);
  $("modalTitle").textContent = p.title;
  $("modalStats").innerHTML =
    `<div class="cur">${t("curPrice")}<b>${yen(p.price)}</b></div>` +
    `<div>${t("basePrice")}<b>${yen(p.baseline)}</b></div>` +
    `<div>${t("lowPrice")}<b>${yen(p.low)}</b></div>`;
  const az = $("modalAmazon");
  az.href = amazonUrl(p.asin);
  az.textContent = t("btnAmazon");
  az.onclick = () => beacon("click", p.asin);
  $("modal").hidden = false;
  drawChart([]); // クリア
  try {
    const hist = await fetch(`data/history/${p.asin}.json`).then((r) => r.json());
    drawChart(hist);
  } catch (e) {
    drawChart([]);
  }
}

function drawChart(hist) {
  const svg = $("chart");
  svg.innerHTML = "";
  const W = 640, H = 260, PAD_L = 70, PAD_R = 14, PAD_T = 14, PAD_B = 30;
  if (!hist || hist.length === 0) {
    svg.innerHTML = `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="14" fill="#888">${t("noHistory")}</text>`;
    return;
  }
  const pts = hist.map(([ts, price]) => [new Date(ts).getTime(), price]);
  // 現在時刻まで最終価格を延長（階段状の見た目のため）
  pts.push([Date.now(), pts[pts.length - 1][1]]);

  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  if (yMin === yMax) { yMin *= 0.95; yMax *= 1.05; }
  const yPad = (yMax - yMin) * 0.1;
  yMin -= yPad; yMax += yPad;

  const X = (v) => PAD_L + ((v - xMin) / (xMax - xMin || 1)) * (W - PAD_L - PAD_R);
  const Y = (v) => H - PAD_B - ((v - yMin) / (yMax - yMin)) * (H - PAD_T - PAD_B);

  let g = "";
  // Y軸グリッド＋ラベル（4本）
  for (let i = 0; i <= 4; i++) {
    const v = yMin + ((yMax - yMin) * i) / 4;
    const y = Y(v);
    g += `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="#eee"/>`;
    g += `<text x="${PAD_L - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#888">${Math.round(v).toLocaleString()}</text>`;
  }
  // X軸ラベル（3点）
  for (let i = 0; i <= 2; i++) {
    const tms = xMin + ((xMax - xMin) * i) / 2;
    const d = new Date(tms);
    const lbl = `${d.getMonth() + 1}/${d.getDate()}`;
    const anchor = i === 0 ? "start" : i === 2 ? "end" : "middle";
    g += `<text x="${X(tms)}" y="${H - 8}" text-anchor="${anchor}" font-size="11" fill="#888">${lbl}</text>`;
  }
  // 階段状の価格ライン
  let dPath = `M ${X(pts[0][0])} ${Y(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    dPath += ` H ${X(pts[i][0])} V ${Y(pts[i][1])}`;
  }
  g += `<path d="${dPath}" fill="none" stroke="#cc4b00" stroke-width="2"/>`;
  // 観測点
  for (const [x, y] of pts.slice(0, -1)) {
    g += `<circle cx="${X(x)}" cy="${Y(y)}" r="3" fill="#cc4b00"/>`;
  }
  svg.innerHTML = g;
}

// ---------- レンダリング一括 ----------
function renderAll() {
  renderCards();
  const page = (location.hash || "#/home").replace("#/", "");
  if (page === "ranking") renderRanking();
  if (page === "favorites") renderFavorites();
}

// ---------- イベント ----------
function bindEvents() {
  $("menuBtn").addEventListener("click", () => {
    $("drawer").classList.contains("open") ? closeDrawer() : openDrawer();
  });
  $("drawerOverlay").addEventListener("click", closeDrawer);
  window.addEventListener("hashchange", route);

  $("searchBox").addEventListener("input", (e) => {
    state.filters.q = e.target.value.trim();
    state.shown = 20;
    renderCards();
  });
  $("sortSel").addEventListener("change", (e) => {
    state.filters.sort = e.target.value;
    renderCards();
  });
  $("resetBtn").addEventListener("click", resetFilters);
  $("clearFilters").addEventListener("click", resetFilters);
  $("moreBtn").addEventListener("click", () => { state.shown += 20; renderCards(); });

  // 絞り込みパネル（モバイル）
  $("filterBtn").addEventListener("click", openFilter);
  $("filterClose").addEventListener("click", closeFilter);
  $("filterOverlay").addEventListener("click", closeFilter);

  // テーマ
  [["fltDrop", "drop"], ["fltFav", "fav"], ["fltLow", "low"]].forEach(([id, key]) => {
    $(id).addEventListener("change", (e) => {
      state.filters[key] = e.target.checked;
      state.shown = 20;
      renderCards();
    });
  });

  // 価格帯
  const priceInput = (id, key) => {
    $(id).addEventListener("input", (e) => {
      const v = e.target.value === "" ? null : Math.max(0, parseInt(e.target.value, 10) || 0);
      state.filters[key] = v;
      state.shown = 20;
      renderCards();
    });
  };
  priceInput("fltPriceMin", "priceMin");
  priceInput("fltPriceMax", "priceMax");

  // セレクト群
  [["fltMinDrop", "minDrop"], ["fltMinRating", "minRating"],
   ["fltMinReviews", "minReviews"], ["fltMaxRank", "maxRank"]].forEach(([id, key]) => {
    $(id).addEventListener("change", (e) => {
      state.filters[key] = parseFloat(e.target.value) || 0;
      state.shown = 20;
      renderCards();
    });
  });

  // スワイプ: 左スワイプ=絞り込みパネル / 右スワイプ=メニュー（お気に入り・設定へ）
  let touchX = null, touchY = null;
  document.addEventListener("touchstart", (e) => {
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    touchX = touchY = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return; // 縦スクロールと区別
    const onHome = ((location.hash || "#/home").replace("#/", "") || "home") === "home";
    if (dx < 0) {
      // 左スワイプ
      if ($("drawer").classList.contains("open")) closeDrawer();
      else if (onHome && $("modal").hidden) openFilter();
    } else {
      // 右スワイプ
      if ($("filterPanel").classList.contains("open")) closeFilter();
      else openDrawer();
    }
  }, { passive: true });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      tab.classList.add("active");
      state.rankTab = tab.dataset.rank;
      renderRanking();
    });
  });

  $("modalClose").addEventListener("click", () => { $("modal").hidden = true; });
  $("modal").addEventListener("click", (e) => { if (e.target === $("modal")) $("modal").hidden = true; });

  $("langSel").addEventListener("change", (e) => {
    state.lang = e.target.value;
    localStorage.setItem("lang", state.lang);
    applyI18n();
  });
  $("thresholdSel").addEventListener("change", (e) => {
    state.threshold = parseFloat(e.target.value);
    localStorage.setItem("threshold", String(state.threshold));
    applyI18n();
  });
}

init().catch((e) => {
  document.getElementById("main").innerHTML =
    `<p style="padding:30px;text-align:center;color:#888">データの読み込みに失敗しました。時間をおいて再読み込みしてください。<br>${e}</p>`;
});
