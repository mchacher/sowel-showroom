// The journals the reset keeps (spec 003, FR3), dumped before the wipe and loaded
// after the restore. Runs inside the Sowel container, on the image's own
// better-sqlite3, fed on stdin:
//
//   docker compose exec -T -e JOURNAL_TABLES="a b" sowel node - dump /tmp/journals.json < journals.cjs
//   docker compose exec -T -e JOURNAL_TABLES="a b" sowel node - load /tmp/journals.json < journals.cjs
//
// Rows go back by column name, intersected with the table as it is now, so a core
// upgrade that adds or drops a column does not break the reset. A row that is
// already there (the arbiter wrote it since the restore) is left alone.
const fs = require("fs");
const Database = require("/app/node_modules/better-sqlite3");

const [mode, file] = process.argv.slice(2);
const tables = (process.env.JOURNAL_TABLES || "").split(/\s+/).filter(Boolean);
const db = new Database(process.env.SQLITE_PATH || "/app/data/sowel.db");
const exists = (t) =>
  db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t) !== undefined;
const counts = {};

if (mode === "dump") {
  const out = {};
  for (const t of tables) {
    if (!exists(t)) continue;
    out[t] = db.prepare(`SELECT * FROM "${t}"`).all();
    counts[t] = out[t].length;
  }
  fs.writeFileSync(file, JSON.stringify(out));
} else if (mode === "load") {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  db.transaction(() => {
    for (const t of tables) {
      const rows = data[t];
      if (!rows || !exists(t)) continue;
      const columns = new Set(db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name));
      let n = 0;
      for (const row of rows) {
        const keys = Object.keys(row).filter((k) => columns.has(k));
        if (keys.length === 0) continue;
        const sql = `INSERT OR IGNORE INTO "${t}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`;
        n += db.prepare(sql).run(...keys.map((k) => row[k])).changes;
      }
      counts[t] = n;
    }
  })();
} else {
  process.stderr.write("usage: node - dump|load <file>\n");
  process.exit(2);
}
process.stdout.write(
  Object.entries(counts)
    .map(([t, n]) => `${t} ${n}`)
    .join(", ") || "nothing",
);
