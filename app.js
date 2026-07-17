/* ============================================================
   神戶・京都 行程手帖 — 資料驅動渲染
   資料來源：Google Sheet「發布到網路」的 CSV
   ------------------------------------------------------------
   使用前：把下面兩個網址換成你自己 meta / schedule 分頁的
   「發布 CSV」網址（檔案 → 共用 → 發布到網路 → 選該分頁 → CSV）。
   格式範例：
   https://docs.google.com/spreadsheets/d/e/XXXX/pub?gid=0&single=true&output=csv
   ============================================================ */
const META_CSV_URL     = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3vflXzFsxsdLDzObMSTt86Ci-nan0KjZjtnGa4QYDLPhD-8OJqg9DyzpH3KbzwQQucBXA7D2p9RMS/pub?gid=0&single=true&output=csv";
const SCHEDULE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3vflXzFsxsdLDzObMSTt86Ci-nan0KjZjtnGa4QYDLPhD-8OJqg9DyzpH3KbzwQQucBXA7D2p9RMS/pub?gid=469937186&single=true&output=csv";
const SITE_CSV_URL     = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3vflXzFsxsdLDzObMSTt86Ci-nan0KjZjtnGa4QYDLPhD-8OJqg9DyzpH3KbzwQQucBXA7D2p9RMS/pub?gid=49395692&single=true&output=csv";
const RESV_CSV_URL     = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3vflXzFsxsdLDzObMSTt86Ci-nan0KjZjtnGa4QYDLPhD-8OJqg9DyzpH3KbzwQQucBXA7D2p9RMS/pub?gid=629136767&single=true&output=csv";

/* ---------- 小工具 ---------- */
const esc = s => (s == null ? "" : String(s)).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const BADGE = { fix: "班次", resv: "預約", free: "免費" };
const MEAL_LABEL = { lunch: "午餐 Lunch", dinner: "晚餐 Dinner", airport: "機場餐", note: "Note" };
const MEAL_ORDER = { lunch: 1, dinner: 2, airport: 2, note: 3 };

function loadCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true, header: true, skipEmptyLines: true,
      complete: r => resolve(r.data),
      error: err => reject(err)
    });
  });
}

/* ---------- 渲染片段 ---------- */
function badges(str) {
  if (!str) return "";
  return str.split("|").map(b => b.trim()).filter(Boolean)
    .map(b => `<span class="mini ${b}">${BADGE[b] || b}</span>`).join("");
}

function timelineRow(it) {
  const kind = it.kind;
  let dotClass = "", bodyClass = "", title = esc(it.title);

  if (kind === "hub") dotClass = "hub";
  else if (kind === "spot") dotClass = "spot";
  else if (kind === "move") { bodyClass = "move"; }
  else if (kind === "lunch" || kind === "dinner") {
    dotClass = "spot";
    title = (kind === "lunch" ? "午餐：" : "晚餐：") + title;
  }
  const cost = it.cost ? `<span class="cost">${esc(it.cost)}</span>` : "";
  const note = it.note ? `<div class="note">${esc(it.note)}</div>` : "";
  return `<div class="tt-row">
    <div class="tt-time">${esc(it.time)}</div>
    <div class="tt-rail"><div class="dot ${dotClass}"></div></div>
    <div class="tt-body ${bodyClass}"><div class="place">${title}${cost}${badges(it.badge)}</div>${note}</div>
  </div>`;
}

function mealCard(it) {
  const label = MEAL_LABEL[it.kind] || "餐";
  if ((it.status || "").trim() === "blank") {
    return `<div class="meal blank"><span class="lbl">${label} ・ 待填</span>
      <span class="val">＿＿＿＿＿＿ <span class="fillin"></span></span></div>`;
  }
  const cost = it.cost ? ` <small>${esc(it.cost)}</small>` : "";
  return `<div class="meal"><span class="lbl">${label}</span>
    <span class="val">${esc(it.title)}${cost}</span></div>`;
}

function dayCard(meta, items) {
  const tags = (meta.tags || "").split("|").map(t => t.trim()).filter(Boolean)
    .map(t => `<span class="pill">${esc(t)}</span>`).join("");

  // 時間軸：hub / move / spot，以及有填 time 的 lunch/dinner
  const tl = items.filter(it =>
    ["hub", "move", "spot"].includes(it.kind) ||
    (["lunch", "dinner"].includes(it.kind) && (it.time || "").trim() !== "")
  ).map(timelineRow).join("");

  // 餐食列：lunch / dinner / airport / note
  const meals = items
    .filter(it => ["lunch", "dinner", "airport", "note"].includes(it.kind))
    .sort((a, b) => (MEAL_ORDER[a.kind] || 9) - (MEAL_ORDER[b.kind] || 9))
    .map(mealCard).join("");

  let flag = "";
  if ((meta.flag_text || "").trim()) {
    const fx = (meta.flag_style || "").trim() === "fixed" ? " fixed" : "";
    flag = `<div class="flag${fx}">${esc(meta.flag_text)}</div>`;
  }

  return `<div class="day" id="d${esc(meta.day)}">
    <div class="day-head">
      <div class="day-no">${esc(meta.day)}</div>
      <div class="day-meta"><div class="d">${esc(meta.date)}</div><h3>${esc(meta.theme)}</h3></div>
      <div class="day-tags">${tags}</div>
    </div>
    <div class="tt">${tl}</div>
    ${flag}
    <div class="meals">${meals}</div>
  </div>`;
}

function renderHero(rows) {
  const m = {};
  rows.forEach(r => { if (r.key) m[r.key] = r.value; });

  const route = (m.route || "").split("|").map(s => s.trim()).filter(Boolean);
  const routeHtml = route.map((seg, i) => {
    const b = (i === 0 || i === route.length - 1) ? `<b>${esc(seg)}</b>` : esc(seg);
    const arw = i < route.length - 1 ? `<span class="arw">──</span>` : "";
    return b + arw;
  }).join("");

  let facts = "";
  for (let i = 1; i <= 8; i++) {
    const k = m["fact" + i + "_k"], v = m["fact" + i + "_v"];
    if (!k && !v) continue;
    const parts = (v || "").split("|");
    const main = esc(parts[0] || "");
    const small = parts[1] ? ` <small>${esc(parts[1])}</small>` : "";
    facts += `<div class="fact"><div class="k">${esc(k)}</div><div class="v">${main}${small}</div></div>`;
  }

  document.getElementById("hero").innerHTML = `
    <div class="eyebrow">${esc(m.eyebrow)}</div>
    <h1>${esc(m.title)}<span class="sub">${esc(m.subtitle)}</span></h1>
    <div class="route-line">${routeHtml}</div>
    <div class="facts">${facts}</div>`;
}

function renderResv(rows) {
  const host = document.getElementById("resv");
  if (!host) return;

  // 依 group 分組，保留出現順序
  const groups = [];
  const map = {};
  rows.forEach(r => {
    if (!r.id) return;
    if (!map[r.group]) { map[r.group] = { name: r.group, color: r.group_color, items: [] }; groups.push(map[r.group]); }
    map[r.group].items.push(r);
  });

  host.innerHTML = groups.map(g => `
    <div class="ck-group">
      <h3><span class="ck-dot" style="background:${esc(g.color) || "#888"}"></span>${esc(g.name)}</h3>
      ${g.items.map(it => {
        const checked = String(it.done).trim().toUpperCase() === "TRUE";
        const when = it.when ? `<span class="when">${esc(it.when)}</span>` : "";
        const sub  = it.sub ? `<span class="sub">${esc(it.sub)}</span>` : "";
        return `<label class="ck">
          <input type="checkbox" class="chk" id="${esc(it.id)}" ${checked ? "checked" : ""}>
          <span class="txt"><b>${esc(it.title)}</b>${when}${sub}</span>
        </label>`;
      }).join("")}
    </div>`).join("");

  // 勾選存本機（之後可換成 GAS 寫回）
  host.querySelectorAll(".chk").forEach(cb => {
    const k = "resv_" + cb.id;
    try { const v = localStorage.getItem(k); if (v !== null) cb.checked = v === "1"; } catch (e) {}
    cb.addEventListener("change", () => { try { localStorage.setItem(k, cb.checked ? "1" : "0"); } catch (e) {} });
  });
}

/* ---------- 主流程 ---------- */
async function init() {
  const host = document.getElementById("days");
  try {
    const [site, meta, sched, resv] = await Promise.all([
       loadCSV(SITE_CSV_URL), loadCSV(META_CSV_URL), loadCSV(SCHEDULE_CSV_URL), loadCSV(RESV_CSV_URL)
    ]);
    renderHero(site);
    renderResv(resv);
    // 依 day 分組 schedule，並依 seq 排序
    const byDay = {};
    sched.forEach(it => {
      const d = String(it.day || "").trim();
      if (!d) return;
      (byDay[d] = byDay[d] || []).push(it);
    });
    Object.values(byDay).forEach(arr =>
      arr.sort((a, b) => (parseInt(a.seq, 10) || 0) - (parseInt(b.seq, 10) || 0)));

    const html = meta
      .filter(m => String(m.day || "").trim())
      .sort((a, b) => (parseInt(a.day, 10) || 0) - (parseInt(b.day, 10) || 0))
      .map(m => dayCard(m, byDay[String(m.day).trim()] || []))
      .join("");

    host.innerHTML = html || `<div class="state err">沒有讀到任何行程資料，請確認分頁與發布設定。</div>`;
    reveal();
  } catch (e) {
    host.innerHTML = `<div class="state err">讀取失敗：請確認 app.js 裡的兩個 CSV 網址已填、且分頁已「發布到網路」。<br>${esc(e && e.message || e)}</div>`;
  }
}

function reveal() {
  const els = document.querySelectorAll(".day");
  if (!("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    els.forEach(e => e.classList.add("reveal-in")); return;
  }
  const io = new IntersectionObserver(ents => {
    ents.forEach(x => { if (x.isIntersecting) { x.target.classList.add("reveal-in"); io.unobserve(x.target); } });
  }, { threshold: .06 });
  els.forEach(e => io.observe(e));
}

init();
