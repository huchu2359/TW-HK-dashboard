/**
 * Database seed script.
 *
 * Drops and recreates the `dashboard_items` table, then loads
 * database_seed_source/seed_concepts.json and seed_issues.json,
 * inserting concepts with type='concept' and issues with type='issue'.
 *
 * Run via: npm run seed
 */
const path = require('path');
const fs = require('fs');
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

async function seedDatabase() {
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

  console.log(`[seed] Done. Seeded ${concepts.length} concepts + ${issues.length} issues.`);
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
