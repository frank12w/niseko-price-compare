/* ========================================================================
   雪徑 SnowTrail — 課程比價系統 前端邏輯 (compare-app.js)
   圖表：ECharts（深色主題），資料模型來自 compare-data.js
   ======================================================================== */

const SEASON_START = new Date("2026-12-01T00:00:00");
const SEASON_END = new Date("2027-04-30T00:00:00");
const TOTAL_DAYS = Math.round((SEASON_END - SEASON_START) / 86400000);

const LEVEL_TAGS = ["不指定", "Lv1", "Lv2", "Lv3"];

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
  hoursVal: document.getElementById("hours-val"),
  durationBar: document.getElementById("duration-bar"),
  pplBar: document.getElementById("ppl-bar"),
  pplVal: document.getElementById("ppl-val"),
  levelBar: document.getElementById("level-bar"),
  levelVal: document.getElementById("level-val"),
  resetBtn: document.getElementById("reset-btn"),
  notesList: document.getElementById("notesList"),
  loadingSpinner: document.getElementById("loading-spinner"),
  dateTicks: document.getElementById("date-ticks"),
};

let isFullDay = true;

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

// 學校名稱若含括號附註（如 "GoSnow(Hirafu)"），在長條圖 X 軸標籤上分兩行顯示
function xAxisLabel(name) {
  const idx = name.indexOf("(");
  if (idx > 0) return name.slice(0, idx) + "\n" + name.slice(idx);
  return name;
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${y}-${m}-${day}（週${weekday}）`;
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
window.addEventListener("resize", () => chart.resize());

function setDurationMode(full) {
  isFullDay = full;
  els.durationBar.value = full ? 1 : 0;
  els.hoursVal.textContent = full ? "全天" : "半天";
  render();
}

function render() {
  showLoading(true);

  const dayIdx = Number(els.dateBar.value);
  const date = dayIndexToDate(dayIdx);
  const duration = isFullDay ? "full" : "half";
  const people = Number(els.pplBar.value);
  const level = Number(els.levelBar.value);

  els.dateVal.textContent = `[ ${formatDate(date)}]`;
  els.pplVal.textContent = `${people} 人`;
  els.levelVal.textContent = level === 0 ? "不指定教練" : `指定 ${LEVEL_TAGS[level]} 教練`;

  const names = [];
  const seriesData = [];
  const rows = [];

  SCHOOLS.forEach((school) => {
    names.push(xAxisLabel(school.name));
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

  const durationText = isFullDay ? "全天" : "半天";
  const levelText = level === 0 ? "不指定教練" : `指定${LEVEL_TAGS[level]}教練`;

  const option = {
    backgroundColor: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: "rgba(51, 65, 85, 0.35)" },
      { offset: 1, color: "rgba(15, 23, 42, 0.05)" },
    ]),
    title: {
      text: `${formatDate(date)}　｜　${durationText}・${people}人・${levelText}`,
      left: "center",
      top: 6,
      textStyle: { color: "#cbd5e1", fontSize: 22, fontWeight: "700" },
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
        const school = SCHOOLS[idx];
        const color = SCHOOL_COLORS[school.key] || "#6366f1";
        const raw = seriesData[idx];
        if (item.value === 0) {
          const reason = raw.naReason || "無官網公開資料";
          return `<div style="font-size:17px;font-weight:bold;border-bottom:1px solid #334155;padding-bottom:6px;margin-bottom:8px;color:${color}">${school.name}</div>
                  <div style="font-size:15px;color:#fda4af;max-width:280px;white-space:normal;">⚠️ ${reason}</div>`;
        }
        const note = rows[idx].note ? `<div style="font-size:15px;color:#94a3b8;max-width:280px;white-space:normal;margin-top:6px;">※ ${rows[idx].note}</div>` : "";
        return `<div style="font-size:17px;font-weight:bold;border-bottom:1px solid #334155;padding-bottom:6px;margin-bottom:8px;color:${color}">${school.name}</div>
                <div style="font-family:monospace;font-size:18px;">¥${item.value.toLocaleString()} JPY</div>${note}`;
      },
    },
    grid: { left: "4%", right: "4%", bottom: "13%", top: "14%", containLabel: true },
    xAxis: [
      {
        type: "category",
        data: names,
        axisLine: { lineStyle: { color: "#475569" } },
        axisTick: { show: false },
        axisLabel: { color: "#cbd5e1", fontSize: 16, fontWeight: "bold", interval: 0, rotate: 0, margin: 4, lineHeight: 18 },
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
          fontSize: 15,
          fontWeight: "bold",
          fontFamily: "monospace",
          formatter(params) {
            if (params.value === 0) return "N/A";
            return `¥${(params.value / 1000).toFixed(0)}k`;
          },
        },
      },
    ],
  };

  chart.setOption(option, true);
  renderNotes(rows, durationText);
  showLoading(false);
}

function renderNotes(rows, durationText) {
  els.notesList.innerHTML = "";
  rows.forEach(({ school, value, note, na, season }) => {
    const li = document.createElement("li");
    li.className = "flex items-start gap-3 border-b border-slate-700/40 pb-3 last:border-0";
    const color = SCHOOL_COLORS[school.key] || "#6366f1";
    const seasonLabel = season ? SEASON_LABELS[season] || season : null;

    let bodyHtml;
    if (na) {
      bodyHtml = `<span class="inline-block text-sm font-bold text-amber-300 bg-amber-900/50 border border-amber-700/50 rounded-full px-3 py-1 mr-2">尚無公開報價</span>${note}`;
    } else if (value === 0) {
      bodyHtml = `<span class="inline-block text-sm font-bold text-rose-300 bg-rose-900/50 border border-rose-700/50 rounded-full px-3 py-1 mr-2">此組合無資料</span>（${seasonLabel}・${durationText}）${note || ""}`;
    } else {
      bodyHtml = `（${seasonLabel}・${durationText}）<span class="font-mono font-bold text-slate-100">¥${value.toLocaleString()}</span>${note ? " — " + note : ""}`;
    }

    li.innerHTML = `
      <span class="mt-1.5 w-3.5 h-3.5 rounded-full shrink-0" style="background:${color}"></span>
      <span><b class="text-slate-100">${school.name}</b> ${bodyHtml}
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
els.durationBar.addEventListener("input", () => setDurationMode(Number(els.durationBar.value) === 1));
els.resetBtn.addEventListener("click", resetControls);

applyHeatmapToSlider(buildHeatmapValues());
renderDateTicks();
resetControls();
