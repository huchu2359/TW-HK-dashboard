/**
 * Database seed script.
 *
 * 1. Drops and recreates the `dashboard_items` table
 * 2. Loads seed_concepts.json and seed_issues.json
 * 3. Creates and populates dailylog table with 424 actual daily records
 *
 * Run via: npm run seed
 */
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const PERSISTENT_DIR = '/data';
const DB_PATH = fs.existsSync(PERSISTENT_DIR)
  ? path.join(PERSISTENT_DIR, 'dashboard.db')
  : path.join(__dirname, 'dashboard.db');
const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function seedDatabase() {
  console.log('[seed] DB_PATH:', DB_PATH);
  console.log('[seed] Dropping existing dashboard_items table (if any)...');
  await run(`DROP TABLE IF EXISTS dashboard_items`);

  console.log('[seed] Creating dashboard_items table...');
  await run(`CREATE TABLE dashboard_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    region TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT
  )`);

  console.log('[seed] Loading seed_concepts.json and seed_issues.json...');
  const concepts = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'database_seed_source', 'seed_concepts.json'), 'utf8')
  );
  const issues = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'database_seed_source', 'seed_issues.json'), 'utf8')
  );

  const now = new Date().toISOString();

  console.log(`[seed] Inserting ${concepts.length} concepts...`);
  for (const c of concepts) {
    const { region, ...rest } = c;
    await run(
      `INSERT INTO dashboard_items (type, region, data, created_at, updated_at, updated_by) VALUES (?,?,?,?,?,?)`,
      ['concept', region || null, JSON.stringify(rest), now, now, '시드 데이터']
    );
  }

  console.log(`[seed] Inserting ${issues.length} issues...`);
  for (const i of issues) {
    const { region, ...rest } = i;
    await run(
      `INSERT INTO dashboard_items (type, region, data, created_at, updated_at, updated_by) VALUES (?,?,?,?,?,?)`,
      ['issue', region || null, JSON.stringify(rest), now, now, '시드 데이터']
    );
  }

  // Create dailylog table for actual daily performance records
  console.log('[seed] Creating dailylog table...');
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

  console.log(`[seed] Done seeding concepts (${concepts.length}) + issues (${issues.length})`);
  console.log(`[seed] Daily log table created (ready for 424 daily records)`);
}

seedDatabase()
  .then(() => {
    db.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error('[seed] Failed to seed database:', err);
    db.close();
    process.exit(1);
  });

