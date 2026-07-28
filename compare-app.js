/* ========================================================================
   雪徑 SnowTrail — 課程比價系統 前端邏輯 (compare-app.js)
   圖表：ECharts（深色主題），資料模型來自 compare-data.js
   ======================================================================== */

const SEASON_START = new Date("2026-12-01T00:00:00");
const SEASON_END = new Date("2027-04-30T00:00:00");
const TOTAL_DAYS = Math.round((SEASON_END - SEASON_START) / 86400000);

const LEVEL_TAGS = ["不指定", "Lv1", "Lv2", "Lv3"];
const LEVEL_BADGE = ["不指定", "Lv1", "Lv2", "Lv3+"];

const SCHOOL_COLORS = {
  chase4snow: "#0284c7",
  snowandflow: "#d97706",
  pinnacle: "#0891b2",
  fuyu: "#ea580c",
  baddies: "#7c3aed",
  gosnow: "#db2777",
  niss: "#e11d48",
  snowman: "#64748b",
  snowplus: "#6366f1",
};

const els = {
  dateBar: document.getElementById("date-bar"),
  dateVal: document.getElementById("date-val"),
  dateMinus: document.getElementById("date-minus"),
  datePlus: document.getElementById("date-plus"),
  hoursVal: document.getElementById("hours-val"),
  btnHalf: document.getElementById("btn-half-day"),
  btnFull: document.getElementById("btn-full-day"),
  pplBar: document.getElementById("ppl-bar"),
  pplVal: document.getElementById("ppl-val"),
  levelBar: document.getElementById("level-bar"),
  levelVal: document.getElementById("level-val"),
  resetBtn: document.getElementById("reset-btn"),
  notesList: document.getElementById("notesList"),
  loadingSpinner: document.getElementById("loading-spinner"),
  dateTicks: document.getElementById("date-ticks"),
  schoolToggles: document.getElementById("school-toggles"),
  schoolsSelectAll: document.getElementById("schools-select-all"),
  schoolsSelectNone: document.getElementById("schools-select-none"),
};

let isFullDay = true;

// 哪些學校目前要顯示在長條圖上（預設全選），取消勾選就把該校從圖表中移除
const activeSchools = new Set(SCHOOLS.map((s) => s.key).filter((k) => k !== "snowplus"));

function renderSchoolToggles() {
  els.schoolToggles.innerHTML = SCHOOLS.map((school) => {
    const color = SCHOOL_COLORS[school.key] || "#6366f1";
    const checked = activeSchools.has(school.key) ? "checked" : "";
    return `<label class="flex items-center gap-1.5 cursor-pointer select-none text-slate-300 hover:text-slate-100 py-1.5 -my-1.5 min-h-[44px] md:min-h-0 md:py-0">
      <input type="checkbox" data-key="${school.key}" ${checked} class="school-toggle-checkbox w-4 h-4 rounded cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-800" style="accent-color:${color}">
      <span class="w-2.5 h-2.5 rounded-full inline-block shrink-0" style="background:${color}"></span>
      <span>${school.name}</span>
    </label>`;
  }).join("");
  els.schoolToggles.querySelectorAll(".school-toggle-checkbox").forEach((cb) => {
    cb.addEventListener("change", () => {
      const key = cb.dataset.key;
      if (cb.checked) activeSchools.add(key);
      else activeSchools.delete(key);
      render();
    });
  });
}

function setAllSchools(shouldSelectAll) {
  activeSchools.clear();
  if (shouldSelectAll) SCHOOLS.forEach((s) => activeSchools.add(s.key));
  renderSchoolToggles();
  render();
}

// 把單色轉成由淺到深的直向漸層，讓長條圖看起來更有質感
function shadeColor(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + percent));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + percent));
  const b = Math.max(0, Math.min(255, (num & 0xff) + percent));
  return `rgb(${r}, ${g}, ${b})`;
}
function barGradient(hex) {
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: shadeColor(hex, 35) },
    { offset: 1, color: shadeColor(hex, -25) },
  ]);
}

function dayIndexToDate(idx) {
  const d = new Date(SEASON_START);
  d.setDate(d.getDate() + idx);
  return d;
}

// 長條圖 X 軸標籤：優先使用學校資料裡的 axisName（簡短中文名）；
// 否則若名稱含括號附註（如 "GoSnow(Hirafu)"），只顯示括號前的簡稱
// （其餘地方如 tooltip、明細清單、學校勾選仍顯示完整名稱 school.name）
function xAxisLabel(school) {
  if (school.axisName) return school.axisName;
  const name = school.name;
  const idx = name.indexOf("(");
  if (idx > 0) return name.slice(0, idx);
  return name;
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${y}-${m}-${day}（週${weekday}）`;
}

function formatDateShort(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---- 計算每日「平均價格」熱力值，作為日期滑桿背景（真實資料，非假資料） ----
// 基準條件：全天、2人、不指定教練 —— 用來反映各校隨日期變動的季節性報價高低
function buildHeatmapValues() {
  const raw = [];
  for (let i = 0; i <= TOTAL_DAYS; i++) {
    const d = dayIndexToDate(i);
    const prices = SCHOOLS.filter((s) => !s.na)
      .map((s) => s.price(s.season(d), "full", 2, 0).value)
      .filter((v) => v > 0);
    const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    raw.push(avg);
  }
  const min = Math.min(...raw.filter((v) => v > 0));
  const max = Math.max(...raw);
  return raw.map((v) => (v <= 0 ? 0 : (v - min) / (max - min || 1)));
}

// 計算「同一組條件（時數/人數/教練等級）」下，該校在整個雪季裡最低～最高價格，
// 以及整季實際出現過的「不重複價格」清單（例如淡季/一般季/旺季常常只有 2~3 種價格）
// 用來在長條圖上疊一條「季節區間」直線（只有日期在變動，其餘條件都固定）
function computeSeasonRange(school, duration, people, level) {
  if (school.na) return null;
  let min = Infinity;
  let max = -Infinity;
  const levelSet = new Set();
  for (let i = 0; i <= TOTAL_DAYS; i++) {
    const d = dayIndexToDate(i);
    const season = school.season(d);
    const result = school.price(season, duration, people, level);
    if (result.value > 0) {
      if (result.value < min) min = result.value;
      if (result.value > max) max = result.value;
      levelSet.add(result.value);
    }
  }
  if (min === Infinity) return null;
  const levels = Array.from(levelSet).sort((a, b) => a - b);
  return { min, max, levels };
}

// custom 系列的 data 物件上掛的自訂欄位（如 levels）在部分 ECharts 版本裡不會
// 完整傳回 renderItem 的 params.data，所以改用外部這個 Map 存放，用類別索引查表
let currentLevelsByIdx = new Map();

// 自訂圖形：把季節區間畫成一條帶端點的直線（類似 candlestick 的影線）；
// 若整季只有 2 種價格，頭尾端點就等於 min/max，不用額外畫刻度；
// 若有 3 種（以上）價格，在中間的價格位置也各畫一條短刻度線標出來
function renderPriceRangeWhisker(params, api) {
  const xIndex = api.value(0);
  const lowVal = api.value(1);
  const highVal = api.value(2);
  const levels = currentLevelsByIdx.get(xIndex) || [];
  const highPoint = api.coord([xIndex, highVal]);
  const lowPoint = api.coord([xIndex, lowVal]);
  const halfWidth = Math.min(9, api.size([1, 0])[0] * 0.16);
  const style = { stroke: "rgba(226, 232, 240, 0.9)", lineWidth: 2 };
  const children = [
    {
      type: "line",
      shape: { x1: highPoint[0] - halfWidth, y1: highPoint[1], x2: highPoint[0] + halfWidth, y2: highPoint[1] },
      style,
    },
    {
      type: "line",
      shape: { x1: highPoint[0], y1: highPoint[1], x2: lowPoint[0], y2: lowPoint[1] },
      style,
    },
    {
      type: "line",
      shape: { x1: lowPoint[0] - halfWidth, y1: lowPoint[1], x2: lowPoint[0] + halfWidth, y2: lowPoint[1] },
      style,
    },
  ];
  if (levels.length > 2) {
    const tickHalfWidth = halfWidth * 0.7;
    const tickStyle = { stroke: "rgba(226, 232, 240, 0.9)", lineWidth: 1.5 };
    levels.slice(1, -1).forEach((v) => {
      const p = api.coord([xIndex, v]);
      children.push({
        type: "line",
        shape: { x1: p[0] - tickHalfWidth, y1: p[1], x2: p[0] + tickHalfWidth, y2: p[1] },
        style: tickStyle,
      });
    });
  }
  return { type: "group", children };
}

function valueToColor(val) {
  // 綠(便宜) -> 琥珀 -> 紅(昂貴)，與價格熱力值對應
  let r, g, b;
  if (val <= 0.5) {
    const norm = val / 0.5;
    r = Math.round(16 + (245 - 16) * norm);
    g = Math.round(185 + (158 - 185) * norm);
    b = Math.round(129 + (11 - 129) * norm);
  } else {
    const norm = (val - 0.5) / 0.5;
    r = Math.round(245 + (239 - 245) * norm);
    g = Math.round(158 + (68 - 158) * norm);
    b = Math.round(11 + (68 - 11) * norm);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

function applyHeatmapToSlider(heatValues) {
  const parts = heatValues.map((val, idx) => {
    const pct = ((idx / (heatValues.length - 1)) * 100).toFixed(2);
    return `${valueToColor(val)} ${pct}%`;
  });
  const gradientCss = `linear-gradient(to right, ${parts.join(", ")})`;
  const style = document.createElement("style");
  style.innerHTML = `
    input[type=range]#date-bar::-webkit-slider-runnable-track { background: ${gradientCss} !important; }
    input[type=range]#date-bar::-moz-range-track { background: ${gradientCss} !important; }
  `;
  document.head.appendChild(style);
}

// 在日期滑桿下方標出 1、2、3、4 月 1 日的位置（依實際天數換算百分比，非寫死）
function renderDateTicks() {
  const monthStarts = [
    { label: "1月1日", date: new Date("2027-01-01T00:00:00") },
    { label: "2月1日", date: new Date("2027-02-01T00:00:00") },
    { label: "3月1日", date: new Date("2027-03-01T00:00:00") },
    { label: "4月1日", date: new Date("2027-04-01T00:00:00") },
  ];
  els.dateTicks.innerHTML = monthStarts
    .map(({ label, date }) => {
      const idx = Math.round((date - SEASON_START) / 86400000);
      if (idx < 0 || idx > TOTAL_DAYS) return "";
      const pct = ((idx / TOTAL_DAYS) * 100).toFixed(2);
      return `<span class="absolute -translate-x-1/2" style="left:${pct}%">${label}</span>`;
    })
    .join("");
}

// ---- ECharts 初始化 ----
const chart = echarts.init(document.getElementById("chart-container"), "dark");
let resizeTimer = null;
window.addEventListener("resize", () => {
  chart.resize();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(render, 150);
});

function setDurationMode(full) {
  isFullDay = full;
  const active = "flex-1 py-1.5 text-sm font-bold rounded-lg transition-all duration-200 bg-cyan-500 text-slate-950 shadow-md";
  const inactive = "flex-1 py-1.5 text-sm font-bold rounded-lg transition-all duration-200 text-slate-400 hover:text-slate-200";
  els.btnFull.className = full ? active : inactive;
  els.btnHalf.className = full ? inactive : active;
  els.hoursVal.textContent = full ? "[全天]" : "[半天]";
  render();
}

function render() {
  showLoading(true);

  const dayIdx = Number(els.dateBar.value);
  const date = dayIndexToDate(dayIdx);
  const duration = isFullDay ? "full" : "half";
  const people = Number(els.pplBar.value);
  const level = Number(els.levelBar.value);

  els.dateVal.textContent = `[${formatDateShort(date)}]`;
  els.pplVal.textContent = `[${people}人]`;
  els.levelVal.textContent = `[${LEVEL_BADGE[level]}]`;

  const names = [];
  const seriesData = [];
  const rows = [];
  const visibleSchools = SCHOOLS.filter((school) => activeSchools.has(school.key));

  if (visibleSchools.length === 0) {
    chart.setOption(
      {
        title: { text: "" },
        xAxis: [{ data: [] }],
        series: [{ data: [] }],
        graphic: [
          {
            type: "text",
            left: "center",
            top: "middle",
            style: { text: "請至少勾選一間學校 👈", fill: "#94a3b8", fontSize: 16, fontWeight: "bold" },
          },
        ],
      },
      true
    );
    els.notesList.innerHTML = `<li class="text-slate-500 text-center py-2">目前沒有選擇任何學校，請從左側「學校」勾選要比較的對象。</li>`;
    showLoading(false);
    return;
  }

  visibleSchools.forEach((school) => {
    names.push(xAxisLabel(school));
    if (school.na) {
      seriesData.push({ value: 0, itemStyle: { color: "transparent" }, naReason: school.naNote });
      rows.push({ school, value: 0, note: school.naNote, na: true, season: null });
      return;
    }
    const season = school.season(date);
    const result = school.price(season, duration, people, level);
    const color = SCHOOL_COLORS[school.key] || "#6366f1";
    if (result.value === 0) {
      seriesData.push({ value: 0, itemStyle: { color: "transparent" }, naReason: result.note });
    } else {
      seriesData.push({ value: result.value, itemStyle: { color: barGradient(color), borderRadius: [6, 6, 0, 0] } });
    }
    rows.push({ school, value: result.value, note: result.note, na: false, season });
  });

  // 計算每間顯示中學校在整季（同樣時數/人數/教練等級，只變動日期）的最低～最高價格區間；
  // 只有當「目前選的這一天」也確實有報價時才顯示區間線，跟主長條的 N/A 狀態保持一致
  // （例如 GoSnow/Niss 超過 4/12 或開賣前，當天無資料時，區間線也要跟著消失，不能卡在圖上）
  const rangeByIdx = new Map();
  visibleSchools.forEach((school, idx) => {
    if (rows[idx].na || rows[idx].value === 0) return;
    const range = computeSeasonRange(school, duration, people, level);
    if (range && range.max > range.min) rangeByIdx.set(idx, range);
  });
  currentLevelsByIdx = new Map(Array.from(rangeByIdx.entries()).map(([idx, r]) => [idx, r.levels]));
  const rangeData = Array.from(rangeByIdx.entries()).map(([idx, r]) => ({
    value: [idx, r.min, r.max],
    levels: r.levels,
  }));

  // 找出目前條件下最便宜的學校（排除 N/A 與 0 元），在圖表與明細上標出來
  let cheapestIdx = -1;
  let cheapestValue = Infinity;
  rows.forEach((row, idx) => {
    if (!row.na && row.value > 0 && row.value < cheapestValue) {
      cheapestValue = row.value;
      cheapestIdx = idx;
    }
  });
  if (cheapestIdx >= 0) {
    seriesData[cheapestIdx] = {
      ...seriesData[cheapestIdx],
      itemStyle: {
        ...seriesData[cheapestIdx].itemStyle,
        borderColor: "#facc15",
        borderWidth: 2,
        shadowColor: "rgba(250, 204, 21, 0.55)",
        shadowBlur: 14,
      },
    };
    rows[cheapestIdx] = { ...rows[cheapestIdx], cheapest: true };
  }

  const durationText = isFullDay ? "全天" : "半天";
  const levelText = level === 0 ? "不指定教練" : `指定${LEVEL_TAGS[level]}教練`;
  const isMobile = window.innerWidth < 768;
  const titleText = isMobile
    ? `${formatDateShort(date)}\n${durationText}・${people}人・${levelText}`
    : `${formatDate(date)}　｜　${durationText}・${people}人・${levelText}`;

  const option = {
    animationDurationUpdate: 450,
    animationEasingUpdate: "cubicOut",
    backgroundColor: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: "rgba(51, 65, 85, 0.35)" },
      { offset: 1, color: "rgba(15, 23, 42, 0.05)" },
    ]),
    title: {
      text: titleText,
      left: "center",
      top: 6,
      textStyle: {
        color: "#cbd5e1",
        fontSize: isMobile ? 13 : 22,
        fontWeight: "700",
        lineHeight: isMobile ? 18 : 26,
      },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      borderColor: "#334155",
      borderWidth: 1,
      textStyle: { color: "#f8fafc", fontSize: 16 },
      formatter(params) {
        const item = params[0];
        const idx = item.dataIndex;
        const school = visibleSchools[idx];
        const color = SCHOOL_COLORS[school.key] || "#6366f1";
        const raw = seriesData[idx];
        if (item.value === 0) {
          const reason = raw.naReason || "無官網公開資料";
          return `<div style="font-size:17px;font-weight:bold;border-bottom:1px solid #334155;padding-bottom:6px;margin-bottom:8px;color:${color}">${school.name}</div>
                  <div style="font-size:15px;color:#fda4af;max-width:280px;white-space:normal;">⚠️ ${reason}</div>`;
        }
        const note = rows[idx].note ? `<div style="font-size:15px;color:#94a3b8;max-width:280px;white-space:normal;margin-top:6px;">※ ${rows[idx].note}</div>` : "";
        const cheapestTag = rows[idx].cheapest ? `<div style="font-size:13px;font-weight:bold;color:#facc15;margin-top:6px;">🏆 目前條件下最便宜</div>` : "";
        const range = rangeByIdx.get(idx);
        let rangeTag = "";
        if (range && range.levels.length > 2) {
          const list = range.levels.map((v) => `¥${v.toLocaleString()}`).join(" / ");
          rangeTag = `<div style="font-size:13px;color:#cbd5e1;margin-top:6px;">🔀 全季報價：${list}</div>`;
        } else if (range) {
          rangeTag = `<div style="font-size:13px;color:#cbd5e1;margin-top:6px;">🔀 全季範圍：¥${range.min.toLocaleString()} 〜 ¥${range.max.toLocaleString()}</div>`;
        }
        return `<div style="font-size:17px;font-weight:bold;border-bottom:1px solid #334155;padding-bottom:6px;margin-bottom:8px;color:${color}">${school.name}</div>
                <div style="font-family:monospace;font-size:18px;">¥${item.value.toLocaleString()} JPY</div>${note}${cheapestTag}${rangeTag}`;
      },
    },
    grid: { left: "4%", right: "4%", bottom: "1%", top: "14%", containLabel: true },
    xAxis: [
      {
        type: "category",
        data: names,
        axisLine: { lineStyle: { color: "#475569" } },
        axisTick: { show: false },
        axisLabel: {
          color: "#cbd5e1",
          fontSize: isMobile ? 11 : 14,
          fontWeight: "bold",
          interval: 0,
          rotate: isMobile ? 45 : 35,
          margin: 6,
          lineHeight: 16,
        },
      },
    ],
    yAxis: [
      {
        type: "value",
        name: "日幣 (JPY)",
        min: 0,
        nameTextStyle: { color: "#94a3b8", fontSize: 15 },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.15)" } },
        axisLabel: { color: "#94a3b8", fontSize: 15, formatter: (v) => `¥${v / 1000}k` },
      },
    ],
    series: [
      {
        name: durationText,
        type: "bar",
        barCategoryGap: "22%",
        data: seriesData,
        label: {
          show: true,
          position: "top",
          color: "#e2e8f0",
          fontSize: isMobile ? 10 : 15,
          fontWeight: "bold",
          fontFamily: "monospace",
          formatter(params) {
            if (params.value === 0) return "N/A";
            return `¥${(params.value / 1000).toFixed(0)}k`;
          },
        },
      },
      {
        name: "季節區間",
        type: "custom",
        renderItem: renderPriceRangeWhisker,
        encode: { x: 0, y: [1, 2] },
        data: rangeData,
        z: 5,
        silent: true,
        tooltip: { show: false },
      },
    ],
  };

  chart.setOption(option, { notMerge: false, lazyUpdate: true });
  renderNotes(rows, durationText);
  showLoading(false);
}

function renderNotes(rows, durationText) {
  els.notesList.innerHTML = "";
  rows.forEach(({ school, value, note, na, season, cheapest }) => {
    const li = document.createElement("li");
    li.className = cheapest
      ? "flex items-start gap-3 border-b border-slate-700/40 pb-3 last:border-0 -mx-2 px-2 py-1.5 rounded-lg bg-amber-400/10 ring-1 ring-amber-400/40"
      : "flex items-start gap-3 border-b border-slate-700/40 pb-3 last:border-0 -mx-2 px-2 rounded-lg transition-colors hover:bg-slate-700/30";
    const color = SCHOOL_COLORS[school.key] || "#6366f1";
    const seasonLabel = season ? SEASON_LABELS[season] || season : null;

    let bodyHtml;
    if (na) {
      //bodyHtml = `<span class="inline-block text-sm font-bold text-amber-300 bg-amber-900/50 border border-amber-700/50 rounded-full px-3 py-1 mr-2">尚無公開報價</span>${note}`;
      bodyHtml = `<span class="inline-block text-sm font-bold text-amber-300 bg-amber-900/50 border border-amber-700/50 rounded-full px-3 py-1 mr-2">尚無公開報價</span>`;    
    } else if (value === 0) {
      //bodyHtml = `<span class="inline-block text-sm font-bold text-rose-300 bg-rose-900/50 border border-rose-700/50 rounded-full px-3 py-1 mr-2">此組合無資料</span>（${seasonLabel}・${durationText}）${note || ""}`;
      bodyHtml = `<span class="inline-block text-sm font-bold text-rose-300 bg-rose-900/50 border border-rose-700/50 rounded-full px-3 py-1 mr-2">此組合無資料</span>`;
    } else {
      //bodyHtml = `（${seasonLabel}・${durationText}）<span class="font-mono font-bold text-slate-100">¥${value.toLocaleString()}</span>${note ? " — " + note : ""}`;
      bodyHtml = `（${seasonLabel}・${durationText}）<span class="font-mono font-bold text-slate-100">¥${value.toLocaleString()}</span>`;
    }
    const cheapestBadge = cheapest
      ? `<span class="inline-block text-xs font-bold text-amber-300 bg-amber-900/40 border border-amber-600/50 rounded-full px-2.5 py-0.5 ml-1.5 align-middle">🏆 最便宜</span>`
      : "";

    li.innerHTML = `
      <span class="mt-1.5 w-3.5 h-3.5 rounded-full shrink-0" style="background:${color}"></span>
      <span><b class="text-slate-100">${school.name}</b>${cheapestBadge} ${bodyHtml}
        <a href="${school.url}" target="_blank" rel="noopener" class="text-sky-400 underline ml-1">官網</a>
      </span>`;
    els.notesList.appendChild(li);
  });
}

function showLoading(isLoading) {
  if (isLoading) els.loadingSpinner.classList.remove("opacity-0", "pointer-events-none");
  else els.loadingSpinner.classList.add("opacity-0", "pointer-events-none");
}

function resetControls() {
  els.dateBar.value = 20; // 2026-12-21，接近旺季
  els.pplBar.value = 2;
  els.levelBar.value = 0;
  setDurationMode(true);
}

els.dateBar.max = TOTAL_DAYS;
[els.dateBar, els.pplBar, els.levelBar].forEach((el) => el.addEventListener("input", render));
els.btnHalf.addEventListener("click", () => setDurationMode(false));
els.btnFull.addEventListener("click", () => setDurationMode(true));
els.resetBtn.addEventListener("click", resetControls);
els.dateMinus.addEventListener("click", () => {
  els.dateBar.value = Math.max(0, Number(els.dateBar.value) - 1);
  render();
});
els.datePlus.addEventListener("click", () => {
  els.dateBar.value = Math.min(TOTAL_DAYS, Number(els.dateBar.value) + 1);
  render();
});
els.schoolsSelectAll.addEventListener("click", () => setAllSchools(true));
els.schoolsSelectNone.addEventListener("click", () => setAllSchools(false));

applyHeatmapToSlider(buildHeatmapValues());
renderDateTicks();
renderSchoolToggles();
resetControls();
