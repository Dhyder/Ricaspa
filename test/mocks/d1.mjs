// Mock Cloudflare D1 binding, backed by Node's built-in node:sqlite.
//
// Runs every REAL migration file in migrations/ (in filename order) so the
// schema under test is guaranteed to match production, not a hand-copied
// approximation of it. Exposes the same .prepare(sql).bind(...).run()/.first()
// surface that ledger.js/bookingLedger.js/contactLedger.js call against
// env.DB, so those modules are exercised completely unmodified.

import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "../../migrations");

export function createMockD1() {
  const sqlite = new DatabaseSync(":memory:");
  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of migrationFiles) {
    sqlite.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }

  return {
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      return {
        bind(...args) {
          return {
            async run() {
              const info = stmt.run(...args);
              return { meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
            },
            async first() {
              const row = stmt.get(...args);
              return row === undefined ? null : row;
            },
          };
        },
        // ledger.js never calls prepare(...).run()/.first() without bind()
        // first, but support it anyway for completeness.
        async run() {
          const info = stmt.run();
          return { meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
        },
        async first() {
          const row = stmt.get();
          return row === undefined ? null : row;
        },
      };
    },
    // Test-only helper for assertions — not part of the real D1 API.
    _raw(sql, ...args) {
      return sqlite.prepare(sql).all(...args);
    },
    _close() {
      sqlite.close();
    },
  };
}
