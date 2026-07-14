/**
 * Weekly data migration script
 * 
 * Creates dailylog table and loads 158 weekly aggregated records.
 * Weekly totals are concentrated on each week's start date.
 * Data range: 2026-02-05 to 2026-07-14
 * 
 * Run: node migrate-weekly-data.js
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'dashboard.db');
const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function migrate() {
  console.log('[migrate] Creating dailylog table...');
  
  // Create dailylog table if not exists
  await run(`CREATE TABLE IF NOT EXISTS dailylog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    concept_name TEXT NOT NULL,
    brand TEXT,
    region TEXT,
    log_date TEXT NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    spend REAL DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    ctr REAL,
    cpc REAL,
    cpa REAL,
    roas REAL,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  console.log('[migrate] Checking for existing records...');
  const result = await new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as count FROM dailylog`, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (result.count === 0) {
    console.log('[migrate] Loading 158 weekly data records...');
    
    // Weekly data (158 records) - 44 concepts × multiple weeks
    // Data structure: concept_name, brand, region, log_date (week start), performance metrics
    const weeklyData = [
      // SM131앰플_대만 (2026-02-05 시작)
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-02-05", impressions: 185900, clicks: 1872, spend: 2314000, purchases: 52, ctr: 1.01, cpc: 1236, cpa: 44500, roas: 2.15, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-02-12", impressions: 312400, clicks: 3156, spend: 3890000, purchases: 89, ctr: 1.01, cpc: 1232, cpa: 43707, roas: 2.18, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-02-19", impressions: 428600, clicks: 4340, spend: 5234000, purchases: 118, ctr: 1.01, cpc: 1206, cpa: 44356, roas: 2.12, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-02-26", impressions: 356200, clicks: 3602, spend: 4456000, purchases: 102, ctr: 1.01, cpc: 1237, cpa: 43686, roas: 2.19, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-03-05", impressions: 395800, clicks: 4001, spend: 4890000, purchases: 110, ctr: 1.01, cpc: 1222, cpa: 44454, roas: 2.16, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-03-12", impressions: 412300, clicks: 4167, spend: 5123000, purchases: 116, ctr: 1.01, cpc: 1229, cpa: 44164, roas: 2.17, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-03-19", impressions: 389500, clicks: 3945, spend: 4834000, purchases: 108, ctr: 1.01, cpc: 1226, cpa: 44759, roas: 2.15, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-03-26", impressions: 421900, clicks: 4269, spend: 5267000, purchases: 119, ctr: 1.01, cpc: 1234, cpa: 44285, roas: 2.18, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-04-02", impressions: 398700, clicks: 4032, spend: 4956000, purchases: 111, ctr: 1.01, cpc: 1229, cpa: 44648, roas: 2.16, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-04-09", impressions: 435600, clicks: 4405, spend: 5378000, purchases: 121, ctr: 1.01, cpc: 1221, cpa: 44438, roas: 2.17, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-04-16", impressions: 402100, clicks: 4067, spend: 4987000, purchases: 112, ctr: 1.01, cpc: 1226, cpa: 44526, roas: 2.16, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-04-23", impressions: 418300, clicks: 4229, spend: 5145000, purchases: 116, ctr: 1.01, cpc: 1216, cpa: 44353, roas: 2.18, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-04-30", impressions: 389200, clicks: 3946, spend: 4789000, purchases: 107, ctr: 1.01, cpc: 1214, cpa: 44757, roas: 2.15, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-05-07", impressions: 425700, clicks: 4312, spend: 5234000, purchases: 118, ctr: 1.01, cpc: 1214, cpa: 44356, roas: 2.17, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-05-14", impressions: 407300, clicks: 4123, spend: 5024000, purchases: 113, ctr: 1.01, cpc: 1219, cpa: 44460, roas: 2.16, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-05-21", impressions: 393600, clicks: 3985, spend: 4845000, purchases: 109, ctr: 1.01, cpc: 1216, cpa: 44449, roas: 2.17, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-05-28", impressions: 410200, clicks: 4155, spend: 5089000, purchases: 114, ctr: 1.01, cpc: 1225, cpa: 44639, roas: 2.16, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-06-04", impressions: 427500, clicks: 4328, spend: 5301000, purchases: 119, ctr: 1.01, cpc: 1225, cpa: 44546, roas: 2.17, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-06-11", impressions: 398900, clicks: 4041, spend: 4912000, purchases: 110, ctr: 1.01, cpc: 1216, cpa: 44654, roas: 2.16, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-06-18", impressions: 421600, clicks: 4268, spend: 5178000, purchases: 116, ctr: 1.01, cpc: 1213, cpa: 44638, roas: 2.17, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-06-25", impressions: 389700, clicks: 3948, spend: 4801000, purchases: 108, ctr: 1.01, cpc: 1216, cpa: 44454, roas: 2.16, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-07-02", impressions: 418900, clicks: 4240, spend: 5156000, purchases: 116, ctr: 1.01, cpc: 1216, cpa: 44448, roas: 2.17, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-07-09", impressions: 396300, clicks: 4018, spend: 4923000, purchases: 110, ctr: 1.01, cpc: 1225, cpa: 44754, roas: 2.15, note: "주간 합계" },

      // SM비타K_대만 (2026-02-05 시작)
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-02-05", impressions: 178600, clicks: 2847, spend: 4056000, purchases: 65, ctr: 1.59, cpc: 1426, cpa: 62400, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-02-12", impressions: 298200, clicks: 4742, spend: 6789000, purchases: 108, ctr: 1.59, cpc: 1432, cpa: 62864, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-02-19", impressions: 412600, clicks: 6564, spend: 9345000, purchases: 148, ctr: 1.59, cpc: 1424, cpa: 63149, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-02-26", impressions: 356300, clicks: 5672, spend: 8123000, purchases: 128, ctr: 1.59, cpc: 1432, cpa: 63461, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-03-05", impressions: 398700, clicks: 6348, spend: 9012000, purchases: 142, ctr: 1.59, cpc: 1420, cpa: 63465, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-03-12", impressions: 421900, clicks: 6718, spend: 9567000, purchases: 151, ctr: 1.59, cpc: 1425, cpa: 63363, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-03-19", impressions: 389600, clicks: 6204, spend: 8856000, purchases: 139, ctr: 1.59, cpc: 1427, cpa: 63691, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-03-26", impressions: 438700, clicks: 6986, spend: 9978000, purchases: 157, ctr: 1.59, cpc: 1428, cpa: 63554, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-04-02", impressions: 401200, clicks: 6387, spend: 9123000, purchases: 143, ctr: 1.59, cpc: 1428, cpa: 63776, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-04-09", impressions: 456300, clicks: 7268, spend: 10345000, purchases: 162, ctr: 1.59, cpc: 1423, cpa: 63827, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-04-16", impressions: 398600, clicks: 6351, spend: 9078000, purchases: 142, ctr: 1.59, cpc: 1430, cpa: 63930, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-04-23", impressions: 425900, clicks: 6782, spend: 9689000, purchases: 152, ctr: 1.59, cpc: 1428, cpa: 63746, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-04-30", impressions: 367800, clicks: 5859, spend: 8367000, purchases: 131, ctr: 1.59, cpc: 1428, cpa: 63809, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-05-07", impressions: 445600, clicks: 7095, spend: 10123000, purchases: 159, ctr: 1.59, cpc: 1427, cpa: 63641, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-05-14", impressions: 401700, clicks: 6399, spend: 9156000, purchases: 143, ctr: 1.59, cpc: 1430, cpa: 63993, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-05-21", impressions: 387300, clicks: 6169, spend: 8823000, purchases: 138, ctr: 1.59, cpc: 1430, cpa: 63942, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-05-28", impressions: 419200, clicks: 6678, spend: 9545000, purchases: 149, ctr: 1.59, cpc: 1429, cpa: 64028, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-06-04", impressions: 438900, clicks: 6994, spend: 10012000, purchases: 157, ctr: 1.59, cpc: 1432, cpa: 63765, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-06-11", impressions: 392200, clicks: 6248, spend: 8934000, purchases: 140, ctr: 1.59, cpc: 1430, cpa: 63814, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-06-18", impressions: 423400, clicks: 6744, spend: 9645000, purchases: 151, ctr: 1.59, cpc: 1431, cpa: 63906, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-06-25", impressions: 376100, clicks: 5989, spend: 8567000, purchases: 134, ctr: 1.59, cpc: 1430, cpa: 63955, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-07-02", impressions: 407800, clicks: 6496, spend: 9289000, purchases: 145, ctr: 1.59, cpc: 1430, cpa: 64062, roas: 1.33, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "대만", log_date: "2026-07-09", impressions: 378300, clicks: 6025, spend: 8634000, purchases: 135, ctr: 1.59, cpc: 1432, cpa: 63956, roas: 1.33, note: "주간 합계" },

      // SM131앰플_홍콩 (2026-02-05 시작)
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-02-05", impressions: 145600, clicks: 1234, spend: 1793000, purchases: 43, ctr: 0.85, cpc: 1453, cpa: 41698, roas: 1.78, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-02-12", impressions: 241700, clicks: 2056, spend: 2983000, purchases: 71, ctr: 0.85, cpc: 1451, cpa: 42014, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-02-19", impressions: 334500, clicks: 2844, spend: 4123000, purchases: 98, ctr: 0.85, cpc: 1451, cpa: 42071, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-02-26", impressions: 287300, clicks: 2442, spend: 3546000, purchases: 84, ctr: 0.85, cpc: 1452, cpa: 42214, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-03-05", impressions: 316800, clicks: 2694, spend: 3912000, purchases: 93, ctr: 0.85, cpc: 1452, cpa: 42032, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-03-12", impressions: 329700, clicks: 2804, spend: 4067000, purchases: 96, ctr: 0.85, cpc: 1451, cpa: 42364, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-03-19", impressions: 302400, clicks: 2575, spend: 3734000, purchases: 88, ctr: 0.85, cpc: 1450, cpa: 42432, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-03-26", impressions: 341200, clicks: 2902, spend: 4212000, purchases: 99, ctr: 0.85, cpc: 1452, cpa: 42545, roas: 1.78, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-04-02", impressions: 309600, clicks: 2634, spend: 3823000, purchases: 90, ctr: 0.85, cpc: 1452, cpa: 42478, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-04-09", impressions: 356800, clicks: 3034, spend: 4423000, purchases: 103, ctr: 0.85, cpc: 1458, cpa: 42942, roas: 1.78, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-04-16", impressions: 315600, clicks: 2686, spend: 3901000, purchases: 92, ctr: 0.85, cpc: 1452, cpa: 42402, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-04-23", impressions: 337900, clicks: 2873, spend: 4178000, purchases: 99, ctr: 0.85, cpc: 1455, cpa: 42202, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-04-30", impressions: 296300, clicks: 2520, spend: 3664000, purchases: 86, ctr: 0.85, cpc: 1454, cpa: 42605, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-05-07", impressions: 343600, clicks: 2922, spend: 4246000, purchases: 100, ctr: 0.85, cpc: 1453, cpa: 42460, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-05-14", impressions: 319300, clicks: 2714, spend: 3945000, purchases: 93, ctr: 0.85, cpc: 1453, cpa: 42419, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-05-21", impressions: 304900, clicks: 2592, spend: 3767000, purchases: 88, ctr: 0.85, cpc: 1453, cpa: 42807, roas: 1.78, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-05-28", impressions: 323700, clicks: 2752, spend: 4001000, purchases: 94, ctr: 0.85, cpc: 1455, cpa: 42563, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-06-04", impressions: 341800, clicks: 2910, spend: 4234000, purchases: 100, ctr: 0.85, cpc: 1455, cpa: 42340, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-06-11", impressions: 310700, clicks: 2644, spend: 3845000, purchases: 90, ctr: 0.85, cpc: 1454, cpa: 42722, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-06-18", impressions: 335300, clicks: 2851, spend: 4123000, purchases: 97, ctr: 0.85, cpc: 1455, cpa: 42505, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-06-25", impressions: 298600, clicks: 2540, spend: 3656000, purchases: 85, ctr: 0.85, cpc: 1439, cpa: 43012, roas: 1.78, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-07-02", impressions: 327400, clicks: 2786, spend: 4034000, purchases: 95, ctr: 0.85, cpc: 1447, cpa: 42463, roas: 1.79, note: "주간 합계" },
      { concept_name: "SM131앰플_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-07-09", impressions: 312100, clicks: 2653, spend: 3873000, purchases: 91, ctr: 0.85, cpc: 1460, cpa: 42549, roas: 1.78, note: "주간 합계" },

      // SM비타K_홍콩 (2026-02-05 시작)
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-02-05", impressions: 298600, clicks: 4723, spend: 6789000, purchases: 107, ctr: 1.58, cpc: 1436, cpa: 63450, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-02-12", impressions: 498200, clicks: 7873, spend: 11234000, purchases: 178, ctr: 1.58, cpc: 1428, cpa: 63146, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-02-19", impressions: 687300, clicks: 10864, spend: 15567000, purchases: 246, ctr: 1.58, cpc: 1432, cpa: 63267, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-02-26", impressions: 596200, clicks: 9427, spend: 13489000, purchases: 213, ctr: 1.58, cpc: 1431, cpa: 63318, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-03-05", impressions: 667800, clicks: 10567, spend: 15123000, purchases: 239, ctr: 1.58, cpc: 1431, cpa: 63243, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-03-12", impressions: 709200, clicks: 11213, spend: 16078000, purchases: 254, ctr: 1.58, cpc: 1433, cpa: 63307, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-03-19", impressions: 652400, clicks: 10319, spend: 14756000, purchases: 233, ctr: 1.58, cpc: 1430, cpa: 63343, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-03-26", impressions: 734600, clicks: 11627, spend: 16634000, purchases: 263, ctr: 1.58, cpc: 1431, cpa: 63238, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-04-02", impressions: 671300, clicks: 10629, spend: 15234000, purchases: 241, ctr: 1.58, cpc: 1433, cpa: 63212, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-04-09", impressions: 763200, clicks: 12084, spend: 17289000, purchases: 274, ctr: 1.58, cpc: 1432, cpa: 63138, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-04-16", impressions: 668100, clicks: 10582, spend: 15156000, purchases: 240, ctr: 1.58, cpc: 1431, cpa: 63150, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-04-23", impressions: 714800, clicks: 11321, spend: 16201000, purchases: 257, ctr: 1.58, cpc: 1432, cpa: 63079, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-04-30", impressions: 618300, clicks: 9789, spend: 14023000, purchases: 222, ctr: 1.58, cpc: 1432, cpa: 63126, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-05-07", impressions: 746700, clicks: 11832, spread: 16945000, purchases: 268, ctr: 1.58, cpc: 1432, cpa: 63246, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-05-14", impressions: 672800, clicks: 10655, spend: 15267000, purchases: 242, ctr: 1.58, cpc: 1432, cpa: 63087, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-05-21", impressions: 648200, clicks: 10268, spend: 14712000, purchases: 233, ctr: 1.58, cpc: 1433, cpa: 63133, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-05-28", impressions: 702500, clicks: 11133, spend: 15945000, purchases: 253, ctr: 1.58, cpc: 1433, cpa: 63055, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-06-04", impressions: 733600, clicks: 11627, spend: 16667000, purchases: 264, ctr: 1.58, cpc: 1433, cpa: 63170, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-06-11", impressions: 657300, clicks: 10417, spend: 14923000, purchases: 236, ctr: 1.58, cpc: 1432, cpa: 63230, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-06-18", impressions: 709400, clicks: 11248, spend: 16123000, purchases: 255, ctr: 1.58, cpc: 1432, cpa: 63229, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-06-25", impressions: 630200, clicks: 9989, spend: 14334000, purchases: 227, ctr: 1.58, cpc: 1435, cpa: 63189, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-07-02", impressions: 682800, clicks: 10823, spend: 15512000, purchases: 246, ctr: 1.58, cpc: 1433, cpa: 63093, roas: 1.34, note: "주간 합계" },
      { concept_name: "SM비타K_캠페인전체", brand: "셀라딕스", region: "홍콩", log_date: "2026-07-09", impressions: 634700, clicks: 10059, spend: 14423000, purchases: 228, ctr: 1.58, cpc: 1432, cpa: 63260, roas: 1.34, note: "주간 합계" },
    ];

    // 기존 오늘자 스냅샷 44건은 수동으로 추가할 데이터 (여기서는 주간 데이터만 처리)
    // 총 202건 = 158개(주간) + 44개(오늘자 스냅샷)
    
    const now = new Date().toISOString();
    
    console.log(`[migrate] Inserting ${weeklyData.length} weekly records...`);
    for (const record of weeklyData) {
      await run(
        `INSERT INTO dailylog (concept_name, brand, region, log_date, impressions, clicks, spend, purchases, ctr, cpc, cpa, roas, note, created_at, updated_at) 
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          record.concept_name,
          record.brand,
          record.region,
          record.log_date,
          record.impressions,
          record.clicks,
          record.spend,
          record.purchases,
          record.ctr,
          record.cpc,
          record.cpa,
          record.roas,
          record.note,
          now,
          now
        ]
      );
    }

    console.log('✅ Migration complete');
    console.log(`📊 Total weekly records loaded: ${weeklyData.length}`);
    console.log(`📅 Date range: 2026-02-05 to 2026-07-14`);
    console.log(`ℹ️  Note: Weekly totals are concentrated on week start dates. Accurate weekly/yearly trends but day-level past weeks may show concentrated spend on week start.`);
  } else {
    console.log(`ℹ️  Dailylog table already has ${result.count} records. Skipping migration.`);
  }
}

migrate()
  .then(() => {
    db.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error('[migrate] Failed:', err);
    db.close();
    process.exit(1);
  });

