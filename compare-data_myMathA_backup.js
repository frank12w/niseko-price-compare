/* ========================================================================
   雪徑 SnowTrail — 二世谷滑雪學校 課程比價系統
   資料模型 (compare-data.js)

   ★ 2026-07-25 更新：改為完全比照使用者原本 Python 版計算邏輯
   （C:\Users\-\Desktop\niseko-school-price\schools\*.py）逐校移植，
   數字、公式、季節判斷、人數/等級規則皆與 Python 版一致，不再套用
   前一版「官網無資料就顯示0」的保守原則（除非 Python 版本身就是回傳0）。

   等級對應：0=不指定(none) / 1=Lv1(L1) / 2=Lv2(L2) / 3=Lv3(L3)
   （Python 版另有 "Founder" 等級，前端未提供此選項，故不移植）

   Snow+ (snowplus) 在 Python 版沒有對應的學校類別，維持原本「無公開
   報價」狀態；其餘 8 校皆已改為 Python 版邏輯的等價 JS 移植。
   ======================================================================== */

function inRange(date, start, end) {
  const d = date.getTime();
  return d >= new Date(start + "T00:00:00").getTime() && d <= new Date(end + "T23:59:59").getTime();
}

const SCHOOLS = [
  // ---------------------------------------------------------------
  // Chase4Snow — 對應 schools/chase4snow.py
  {
    key: "chase4snow",
    name: "Chase4Snow",
    url: "https://chaseforsnow.com/lessons-niseko-en/",
    maxGroup: 6,
    season(d) {
      if (inRange(d, "2026-12-18", "2027-01-05") || inRange(d, "2027-01-21", "2027-02-10")) return "v2";
      if (inRange(d, "2026-12-01", "2026-12-17") || inRange(d, "2027-01-06", "2027-01-20") || inRange(d, "2027-02-11", "2027-04-07")) return "v1";
      if (inRange(d, "2027-04-08", "2027-04-30")) return "v0";
      return "v1";
    },
    price(season, duration, people, level) {
      const isFullDay = duration === "full";
      const priceMatrix = { v2: { full: 97000, half: 70000 }, v1: { full: 78000, half: 48000 }, v0: { full: 74000, half: 46000 } };
      const basePrice = (priceMatrix[season] || priceMatrix.v1)[isFullDay ? "full" : "half"];
      const pplFee = Math.max(0, people - 4) * 15000;
      let levelFee = 0;
      if (level > 2) levelFee = isFullDay ? 11000 : 7000;
      else if (level > 0) levelFee = isFullDay ? 10000 : 6000;
      return { value: basePrice + pplFee + levelFee, note: null };
    },
  },
  // ---------------------------------------------------------------
  // Snowman — 對應 schools/snowman.py
  {
    key: "snowman",
    name: "Snowman",
    url: "https://snowman-club.com/pricing/",
    maxGroup: 6,
    season(d) {
      if (inRange(d, "2026-12-18", "2027-01-05") || inRange(d, "2027-01-21", "2027-02-10")) return "v2";
      if (inRange(d, "2026-12-01", "2026-12-17") || inRange(d, "2027-01-06", "2027-01-20") || inRange(d, "2027-02-11", "2027-04-07")) return "v1";
      if (inRange(d, "2027-04-08", "2027-04-30")) return "v0";
      return "v1";
    },
    price(season, duration, people, level) {
      if (people >= 6) return { value: 0, note: "此校 6 人以上不提供服務" };
      const isFullDay = duration === "full";
      const isGroupGt3 = people > 3;
      const priceMap = {
        "v2|false|full": 98000, "v2|false|half": 58000, "v2|true|full": 110000, "v2|true|half": 68000,
        "v1|false|full": 90000, "v1|false|half": 54000, "v1|true|full": 100000, "v1|true|half": 63000,
        "v0|false|full": 78000, "v0|false|half": 48000, "v0|true|full": 90000, "v0|true|half": 56000,
      };
      const basePrice = priceMap[`${season}|${isGroupGt3}|${isFullDay ? "full" : "half"}`] || 0;
      const levelFeeMap = { "1|full": 5000, "1|half": 3000, "2|full": 10000, "2|half": 6000, "3|full": 20000, "3|half": 10000 };
      const levelFee = levelFeeMap[`${level}|${isFullDay ? "full" : "half"}`] || 0;
      return { value: basePrice + levelFee, note: null };
    },
  },
  // ---------------------------------------------------------------
  // Snow and Flow — 對應 schools/snowflow.py
  {
    key: "snowandflow",
    name: "Snow and Flow",
    url: "https://www.snowandflow.com/lesson-en",
    maxGroup: 4,
    season(d) {
      if (inRange(d, "2026-12-14", "2027-03-07")) return "v2";
      return "v1";
    },
    price(season, duration, people, level) {
      if (people >= 5) return { value: 0, note: "此校 5 人以上不提供服務" };
      if (level === 3) return { value: 0, note: "此校 Lv3 不提供服務" };
      const isFullDay = duration === "full";
      const priceMatrix = { v2: { full: 88000, half: 58000 }, v1: { full: 68000, half: 42000 } };
      const basePrice = (priceMatrix[season] || priceMatrix.v1)[isFullDay ? "full" : "half"];
      const pplFee = Math.max(0, people - 1) * 4000;
      let levelFee = 0;
      if (level === 1 || level === 2) levelFee = isFullDay ? 6000 : 5000;
      return { value: basePrice + pplFee + levelFee, note: null };
    },
  },
  // ---------------------------------------------------------------
  // Snow+ (SnowPlus) — Python 版沒有此學校，維持無公開報價
  {
    key: "snowplus",
    name: "Snow+ (SnowPlus)",
    url: "https://snowplus.school/",
    na: true,
    naNote: "此校在原 Python 版計算程式中沒有對應類別，無計算邏輯可移植。官網主要價目表為 PDF 圖層文字，也無法擷取實際數字。如需報價請洽官網或聯繫學校。",
  },
  // ---------------------------------------------------------------
  // Pinnacle Snowsports — 對應 schools/pinnacle.py
  {
    key: "pinnacle",
    name: "Pinnacle Snowsports",
    url: "https://pinnacle-snow.com/private-ski-snowboard-lessons/",
    maxGroup: 5,
    season(d) {
      if (inRange(d, "2026-12-01", "2026-12-02") || inRange(d, "2027-04-29", "2027-04-30")) return "v1";
      return "v2";
    },
    price(season, duration, people, level) {
      const isFullDay = duration === "full";
      let basePrice, pplFee;
      if (season === "v2") {
        if (people >= 5) return { value: 0, note: "此校旺季(v2) 5 人以上不提供服務" };
        basePrice = isFullDay ? 87000 : 62000;
        const feeMap = { 1: 0, 2: 3000, 3: 7000, 4: 12000 };
        pplFee = feeMap[people] || 0;
      } else {
        if (people > 5) return { value: 0, note: "此校 5 人以上不提供服務" };
        basePrice = isFullDay ? 75000 : 45000;
        pplFee = people >= 4 && !isFullDay ? 5000 : 0;
      }
      let levelFee = 0;
      if (level > 0 && level <= 2) levelFee = isFullDay ? 7000 : 6000;
      else if (level === 3) levelFee = isFullDay ? 20000 : 15000;
      return { value: basePrice + pplFee + levelFee, note: null };
    },
  },
  // ---------------------------------------------------------------
  // Fuyu Ski School — 對應 schools/fuyu.py
  {
    key: "fuyu",
    name: "Fuyu Ski School",
    url: "https://www.fuyuski.co/en/courses",
    maxGroup: 5,
    season(d) {
      if (inRange(d, "2026-12-15", "2027-03-14")) return "v2";
      if (d.getTime() >= new Date("2027-04-08T00:00:00").getTime()) return "v0";
      return "v1";
    },
    price(season, duration, people, level) {
      if (people > 5) return { value: 0, note: "此校最多接待 5 人，超過人數不提供服務" };
      if (level > 0) return { value: 0, note: "此校指定教練等級不提供服務" };
      const isFullDay = duration === "full";
      const priceMap = { v2: { full: 98000, half: 72000 }, v1: { full: 81000, half: 58000 }, v0: { full: 75000, half: 50000 } };
      return { value: priceMap[season][isFullDay ? "full" : "half"], note: null };
    },
  },
  // ---------------------------------------------------------------
  // Baddies — 對應 schools/baddies.py
  {
    key: "baddies",
    name: "Baddies",
    url: "https://www.thebaddiesxx.com/lesson-price",
    maxGroup: 3,
    season() {
      return "flat";
    },
    price(season, duration, people, level) {
      if (people > 3) return { value: 0, note: "此校最多接待 3 人，超過人數不提供服務" };
      const isFullDay = duration === "full";
      return { value: isFullDay ? 135000 : 81000, note: null };
    },
  },
  // ---------------------------------------------------------------
  // GoSnow Niseko — 對應 schools/gosnow.py
  {
    key: "gosnow",
    name: "GoSnow Niseko",
    url: "https://www.gosnowniseko.com/lessons/private-lessons",
    maxGroup: 6,
    season(d) {
      if (d.getTime() >= new Date("2027-04-12T00:00:00").getTime()) return "closed";
      if (inRange(d, "2026-12-21", "2027-01-03") || inRange(d, "2027-02-04", "2027-02-10")) return "v2";
      if (inRange(d, "2026-12-01", "2026-12-08") || inRange(d, "2027-03-01", "2027-04-11")) return "v0";
      return "v1";
    },
    price(season, duration, people, level) {
      if (season === "closed") return { value: 0, note: "此日期已超過 4/12（官網無報價）" };
      const isFullDay = duration === "full";
      const priceMap = {
        v2: { full: 130000, half: Math.round((99000 + 45000) / 2) },
        v1: { full: 110000, half: Math.round((87000 + 36000) / 2) },
        v0: { full: 81000, half: Math.round((64000 + 26000) / 2) },
      };
      return { value: priceMap[season][isFullDay ? "full" : "half"], note: "半天為官網「AM Private」與「PM Private」兩產品之平均價" };
    },
  },
  // ---------------------------------------------------------------
  // NISS（Hanazono Niseko）— 對應 schools/niss.py
  {
    key: "niss",
    name: "NISS（Hanazono Niseko）",
    url: "https://hanazononiseko.com/en/winter/ski-school/private",
    maxGroup: 6,
    season(d) {
      if (d.getTime() >= new Date("2027-04-12T00:00:00").getTime()) return "closed";
      if (inRange(d, "2026-12-14", "2027-01-03") || inRange(d, "2027-02-06", "2027-02-12")) return "v2";
      if (inRange(d, "2026-12-01", "2026-12-07") || inRange(d, "2027-03-01", "2027-04-11")) return "v0";
      return "v1";
    },
    price(season, duration, people, level) {
      if (season === "closed") return { value: 0, note: "此日期已超過 4/12（官網無報價）" };
      const isFullDay = duration === "full";
      const priceMap = {
        v2: { full: 120000, half: Math.round((93000 + 55000) / 2) },
        v1: { full: 93000, half: Math.round((71000 + 43000) / 2) },
        v0: { full: 87000, half: Math.round((59000 + 43000) / 2) },
      };
      return { value: priceMap[season][isFullDay ? "full" : "half"], note: "半天為官網「AM Lesson」與「PM Lesson」兩產品之平均價" };
    },
  },
];

const LEVEL_LABELS = ["不指定教練", "指定 Lv1 教練", "指定 Lv2 教練", "指定 Lv3 教練"];
const SEASON_LABELS = { v2: "旺季", v1: "一般季", v0: "淡季", flat: "全年單一價", closed: "已超出報價期間" };
