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
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function rowToItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    region: row.region,
    ...JSON.parse(row.data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by
  };
}

async function init() {
  await run(`CREATE TABLE IF NOT EXISTS dashboard_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    region TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT
  )`);
  const { count } = await get(`SELECT COUNT(*) as count FROM dashboard_items`);
  if (count === 0) {
    await seed();
  }
}

async function seed() {
  const concepts = JSON.parse(fs.readFileSync(path.join(__dirname, 'database_seed_source', 'seed_concepts.json'), 'utf8'));
  const issues = JSON.parse(fs.readFileSync(path.join(__dirname, 'database_seed_source', 'seed_issues.json'), 'utf8'));
  const now = new Date().toISOString();
  for (const c of concepts) {
    const { region, ...rest } = c;
    await run(
      `INSERT INTO dashboard_items (type, region, data, created_at, updated_at, updated_by) VALUES (?,?,?,?,?,?)`,
      ['concept', region, JSON.stringify(rest), now, now, '시드 데이터']
    );
  }
  for (const i of issues) {
    const { region, ...rest } = i;
    await run(
      `INSERT INTO dashboard_items (type, region, data, created_at, updated_at, updated_by) VALUES (?,?,?,?,?,?)`,
      ['issue', region, JSON.stringify(rest), now, now, '시드 데이터']
    );
  }
  console.log(`[db] seeded ${concepts.length} concepts + ${issues.length} issues`);
}

async function getAllItems() {
  const rows = await all(`SELECT * FROM dashboard_items ORDER BY id ASC`);
  return rows.map(rowToItem);
}

async function getItem(id) {
  const row = await get(`SELECT * FROM dashboard_items WHERE id = ?`, [id]);
  return rowToItem(row);
}

async function createItem({ type, region, updatedBy, ...fields }) {
  const now = new Date().toISOString();
  const { lastID } = await run(
    `INSERT INTO dashboard_items (type, region, data, created_at, updated_at, updated_by) VALUES (?,?,?,?,?,?)`,
    [type || 'concept', region || null, JSON.stringify(fields), now, now, updatedBy || null]
  );
  return getItem(lastID);
}

async function updateItem(id, patch) {
  const existing = await get(`SELECT * FROM dashboard_items WHERE id = ?`, [id]);
  if (!existing) return null;
  const currentData = JSON.parse(existing.data);
  const { region, updatedBy, type, ...fields } = patch;
  const mergedData = { ...currentData, ...fields };
  const now = new Date().toISOString();
  await run(
    `UPDATE dashboard_items SET data = ?, region = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
    [JSON.stringify(mergedData), region !== undefined ? region : existing.region, now, updatedBy || existing.updated_by, id]
  );
  return getItem(id);
}

async function deleteItem(id) {
  await run(`DELETE FROM dashboard_items WHERE id = ?`, [id]);
  return { id };
}

module.exports = { init, getAllItems, getItem, createItem, updateItem, deleteItem };
