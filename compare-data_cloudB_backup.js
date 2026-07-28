/* ========================================================================
   雪徑 SnowTrail — 二世谷滑雪學校 課程比價系統
   資料模型 (compare-data.js)

   資料來源：2026 年 7 月透過各校官方網站 (含官網 2026-27 雪季價目) 整理，
   實際報價請以各校官網 / 現場公告為準。

   ★ 顯示原則（重要）：任何「組合」若沒有官網公開資料可以佐證，一律回傳
     value = 0（前端會以灰色「無資料」呈現，不做推算/延伸/假設數字）。
     只有在該校官網明確寫出對應的價格時，才會顯示實際金額。

   等級 (level) 對應規則：
   - level 0 (不指定)：一律使用官網公開的「基本／不指定教練」價格
   - level 1 / 2：若該校有公開「指定教練」的固定加價（不分等級，只分
     「有無指定」），套用該加價金額於 Lv1 與 Lv2（兩者顯示相同數字，
     並註明原因）；若該校完全沒有指定教練相關的公開資料 → 0
   - level 3：若該校有公開「進階／資深／頂級認證教練」的獨立價目表，
     使用該表；若沒有此級別的產品或資料 → 0

   日期：2026-11-15 ~ 2027-04-30。部分學校官網僅公開特定期間的價格
   （例如球季尚未開賣、或淡季表末端未列出），落在未公開區間一律顯示 0。

   人數：若該校僅公開到特定人數上限的價目（如最多 4 人／5 人），超過
   上限沒有官網數字可用時一律顯示 0，不做等差 / 比例推算。
   ======================================================================== */

function inRange(date, start, end) {
  const d = date.getTime();
  return d >= new Date(start + "T00:00:00").getTime() && d <= new Date(end + "T23:59:59").getTime();
}

const NO_DATA = { value: 0, note: "此組合無官網公開資料" };

const SCHOOLS = [
  // ---------------------------------------------------------------
  {
    key: "chase4snow",
    name: "Chase4Snow",
    url: "https://chaseforsnow.com/lessons-niseko-en/",
    maxGroup: 6,
    season(d) {
      if (inRange(d, "2026-12-18", "2027-01-05") || inRange(d, "2027-01-21", "2027-02-10")) return "peak";
      if (inRange(d, "2027-04-08", "2027-04-30")) return "spring";
      return "regular";
    },
    price(season, duration, people, level) {
      const base = { regular: { half: 48000, full: 78000 }, peak: { half: 70000, full: 97000 }, spring: { half: 46000, full: 74000 } };
      const extra = Math.max(0, Math.min(people, 6) - 4) * 15000; // 官網明訂：第5、6人各加¥15,000，上限6人
      const standard = base[season][duration] + extra;

      if (level === 0) return { value: standard, note: null };

      if (level === 1 || level === 2) {
        // 官網公開「指定教練（非資深）」固定加價，未區分Lv1/Lv2
        const fee = duration === "half" ? 6000 : 10000;
        return { value: standard + fee, note: level === 2 ? "此校無獨立 Lv2 報價，套用官網「指定教練」加價費率" : "套用官網「指定教練」加價費率" };
      }
      // level 3 — 官網公開「頂級認證教練」獨立分人數級距價目
      const top = {
        regular: { 1: { half: 55000, full: 89000 }, 5: { half: 70000, full: 104000 }, 6: { half: 85000, full: 119000 } },
        peak: { 1: { half: 77000, full: 108000 }, 5: { half: 92000, full: 123000 }, 6: { half: 107000, full: 138000 } },
        spring: { 1: { half: 53000, full: 85000 }, 5: { half: 68000, full: 100000 }, 6: { half: 83000, full: 115000 } },
      };
      const band = people >= 6 ? 6 : people === 5 ? 5 : 1;
      return { value: top[season][band][duration], note: "Lv3 為官網「頂級認證教練」價格" };
    },
  },
  // ---------------------------------------------------------------
  {
    key: "snowandflow",
    name: "Snow and Flow",
    url: "https://www.snowandflow.com/lesson-en",
    maxGroup: 6,
    season(d) {
      if (inRange(d, "2026-12-14", "2027-03-07")) return "peak";
      return "regular"; // 官網：開season起~12/13 及 3/8~season結束（含延伸至4/30）
    },
    price(season, duration, people, level) {
      const table = {
        regular: { 1: { half: 42000, full: 68000 }, 2: { half: 46000, full: 72000 }, 3: { half: 50000, full: 76000 }, 4: { half: 54000, full: 80000 } },
        peak: { 1: { half: 58000, full: 88000 }, 2: { half: 62000, full: 92000 }, 3: { half: 72000, full: 98000 }, 4: { half: 76000, full: 102000 } },
      };
      if (people > 4) return { value: 0, note: "此校官網僅公開至 4 人報價，超過人數無公開資料" };
      const standard = table[season][people][duration];

      if (level === 0) return { value: standard, note: null };
      if (level === 1 || level === 2) {
        // 官網公開「指定教練姓名」固定加價，未區分Lv1/Lv2
        const fee = duration === "half" ? 5000 : 6000;
        return { value: standard + fee, note: level === 2 ? "此校無獨立 Lv2 報價，套用官網「指定教練」加價費率" : "套用官網「指定教練」加價費率" };
      }
      // level 3：此校沒有頂級／資深教練分級產品
      return { value: 0, note: "此校無最高等級（Lv3）教練選項，無官網公開資料" };
    },
  },
  // ---------------------------------------------------------------
  {
    key: "pinnacle",
    name: "Pinnacle Snowsports",
    url: "https://pinnacle-snow.com/private-ski-snowboard-lessons/",
    maxGroup: 5,
    seasonAssumed: true,
    season(d) {
      // 官網分「Peak／Regular」兩級，但確切日期未能自官網擷取，
      // 暫採與 Chase4Snow 相近的旺季區間，僅為推估分類（非價格本身）
      if (inRange(d, "2026-12-18", "2027-01-05") || inRange(d, "2027-01-21", "2027-02-10")) return "peak";
      return "regular";
    },
    price(season, duration, people, level) {
      const nonDesignated = {
        peak: { 1: { half: 62000, full: 87000 }, 2: { half: 65000, full: 90000 }, 3: { half: 69000, full: 94000 }, 4: { half: 74000, full: 99000 } },
        regular: { 1: { half: 45000, full: 75000 }, 2: { half: 45000, full: 75000 }, 3: { half: 45000, full: 75000 }, 4: { half: 50000, full: 75000 }, 5: { half: 50000, full: 75000 } },
      };
      const lvl12 = {
        peak: { 1: { half: 68000, full: 94000 }, 2: { half: 71000, full: 97000 }, 3: { half: 75000, full: 101000 }, 4: { half: 80000, full: 106000 } },
        regular: { 1: { half: 51000, full: 82000 }, 2: { half: 51000, full: 82000 }, 3: { half: 51000, full: 82000 }, 4: { half: 56000, full: 82000 }, 5: { half: 56000, full: 82000 } },
      };
      const lvl34 = {
        peak: { 1: { half: 77000, full: 107000 }, 2: { half: 80000, full: 110000 }, 3: { half: 84000, full: 114000 }, 4: { half: 89000, full: 119000 } },
        regular: { 1: { half: 60000, full: 95000 }, 2: { half: 60000, full: 95000 }, 3: { half: 60000, full: 95000 }, 4: { half: 65000, full: 95000 }, 5: { half: 65000, full: 95000 } },
      };
      const table = level === 0 ? nonDesignated : level === 3 ? lvl34 : lvl12;
      const p = Math.min(people, 5);
      const seasonTable = table[season];
      if (!seasonTable[p]) return { value: 0, note: "此校此季節未公開該人數之報價" };
      let note = level === 2 ? "此校 Lv1／Lv2 為官網同一價格級距" : null;
      if (this.seasonAssumed) note = (note ? note + "；" : "") + "季節區間為推估(官網未公開確切日期，價格本身為官網數字)";
      return { value: seasonTable[p][duration], note };
    },
  },
  // ---------------------------------------------------------------
  {
    key: "fuyu",
    name: "Fuyu Ski School",
    url: "https://www.fuyuski.co/en/courses",
    maxGroup: 5,
    season(d) {
      if (inRange(d, "2026-12-01", "2026-12-14")) return "low";
      if (inRange(d, "2026-12-15", "2027-03-14")) return "peak";
      if (inRange(d, "2027-03-15", "2027-04-07")) return "low";
      if (inRange(d, "2027-04-08", "2027-04-30")) return "spring";
      return "none"; // 2026-12-01 之前官網無公開報價
    },
    price(season, duration, people, level) {
      if (season === "none") return { value: 0, note: "此日期早於官網公開之報價期間（官網報價自 12/1 起）" };
      if (people > 5) return { value: 0, note: "此校最多接待 5 人，超過人數無公開資料" };
      if (level > 0) return { value: 0, note: "此校未公開指定教練等級之加價方案，無官網資料" };
      const table = { peak: { half: 72000, full: 98000 }, low: { half: 58000, full: 81000 }, spring: { half: 50000, full: 75000 } };
      return { value: table[season][duration], note: "官網無等級加價，最多 5 人整組固定價" };
    },
  },
  // ---------------------------------------------------------------
  {
    key: "baddies",
    name: "Baddies",
    url: "https://www.thebaddiesxx.com/lesson-price",
    maxGroup: 3,
    season() {
      return "flat";
    },
    price(season, duration, people, level) {
      if (people > 3) return { value: 0, note: "此校最多接待 3 人，超過人數無公開資料" };
      let val = duration === "half" ? 81000 : 135000;
      if (level === 0) return { value: val, note: "此校為每日固定價，1–3 人皆同價" };
      if (level === 1 || level === 2) {
        return { value: val + 8000, note: level === 2 ? "此校無獨立 Lv2 報價，套用官網「指定教練」加價費率 +¥8,000" : "套用官網「指定教練」加價費率 +¥8,000" };
      }
      // level 3：此校沒有頂級／資深教練分級產品
      return { value: 0, note: "此校無最高等級（Lv3）教練選項，無官網公開資料" };
    },
  },
  // ---------------------------------------------------------------
  {
    key: "gosnow",
    name: "GoSnow Niseko",
    url: "https://www.gosnowniseko.com/lessons/private-lessons",
    maxGroup: 6,
    season(d) {
      if (inRange(d, "2026-11-15", "2026-11-27")) return "none"; // 早於官網公開的優惠季起始(11/28)
      if (inRange(d, "2027-04-12", "2027-04-30")) return "none"; // 晚於官網公開的優惠季結束(4/11)
      if (inRange(d, "2026-12-21", "2027-01-03") || inRange(d, "2027-02-04", "2027-02-10")) return "peak";
      if (inRange(d, "2027-03-01", "2027-04-11") || inRange(d, "2026-11-28", "2026-12-08")) return "value";
      return "regular";
    },
    price(season, duration, people, level) {
      if (season === "none") return { value: 0, note: "此日期超出官網公開的私人課程季節區間（11/28–4/11）" };
      if (level > 0) return { value: 0, note: "此校未公開指定教練等級之加價方案，無官網資料" };
      const table = { value: { half: 64000, full: 81000 }, regular: { half: 87000, full: 110000 }, peak: { half: 99000, full: 130000 } };
      return { value: table[season][duration], note: '半天採用官網「AM Private」4 小時方案（無 3 小時方案）；整組固定價，1–6 人同價' };
    },
  },
  // ---------------------------------------------------------------
  {
    key: "niss",
    name: "NISS（Hanazono Niseko）",
    url: "https://hanazononiseko.com/en/winter/ski-school/private",
    maxGroup: 6,
    season(d) {
      if (inRange(d, "2026-11-15", "2026-11-27")) return "none"; // 早於官網公開的球季起始(11/28)
      if (inRange(d, "2027-04-12", "2027-04-30")) return "none"; // 晚於官網公開的球季結束(4/11)
      if (inRange(d, "2026-12-14", "2027-01-03") || inRange(d, "2027-02-06", "2027-02-12")) return "peak";
      if (inRange(d, "2026-11-28", "2026-12-07") || inRange(d, "2027-03-01", "2027-04-11")) return "early";
      return "regular";
    },
    price(season, duration, people, level) {
      if (season === "none") return { value: 0, note: "此日期超出官網公開的私人課程球季區間（11/28–4/11）" };
      if (level > 0) return { value: 0, note: "此校未公開指定教練等級之加價方案，無官網資料" };
      const table = { peak: { half: 93000, full: 120000 }, regular: { half: 71000, full: 93000 }, early: { half: 59000, full: 87000 } };
      return { value: table[season][duration], note: "半天採用官網「AM Lesson」2.5 小時方案；整組固定價，最多 6 人同價" };
    },
  },
  // ---------------------------------------------------------------
  {
    key: "snowman",
    name: "Snowman",
    url: "https://snowman-club.com/pricing/",
    na: true,
    naNote: "官網基礎課程費率以前端程式動態載入，無法取得公開數字（僅公開教練指定加價：Lv1 +¥5,000/3,000、Lv2 +¥10,000/6,000、Lv3 +¥20,000/10,000，全天/半天，但缺少基本費率無法算出總價）。如需報價請洽官網或聯繫學校。",
  },
  // ---------------------------------------------------------------
  {
    key: "snowplus",
    name: "Snow+ (SnowPlus)",
    url: "https://snowplus.school/",
    na: true,
    naNote: "官網主要價目表為 PDF 圖層文字，本次無法擷取實際數字（已知有 1–2／3–4／5–6 人分級與淡旺季分級架構，另加購項目「多一人 +¥5,000」可確認，但核心課程費用數字缺失）。如需報價請洽官網或聯繫學校。",
  },
];

const LEVEL_LABELS = ["不指定教練", "指定 Lv1 教練", "指定 Lv2 教練", "指定 Lv3 教練"];
const SEASON_LABELS = { regular: "一般季", peak: "旺季／尖峰季", spring: "春季", low: "淡季", value: "優惠季", early: "早／晚季", flat: "全年單一價", none: "無公開資料期間" };
