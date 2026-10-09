/**
 * Combines this project's numbered migrations for the Supabase SQL Editor.
 * Run: node build_schema.js              → supabase/_full_schema.sql (new project, all migrations)
 *      node build_schema.js --from 11    → supabase/_update_from_11.sql (only 11 onwards, for a
 *                                          project that already has the earlier ones)
 *
 * Generates a file only; it never connects to or modifies the database.
 */
const fs = require("node:fs");
const path = require("node:path");

const migrationsDir = path.join(__dirname, "supabase", "migrations");

function parseFrom(argv) {
  const index = argv.indexOf("--from");
  if (index === -1) return null;
  const value = Number(argv[index + 1]);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("--from needs a migration number, e.g. --from 11");
  return value;
}

function buildSchema() {
  const from = parseFrom(process.argv.slice(2));
  const outFile = path.join(__dirname, "supabase", from === null ? "_full_schema.sql" : `_update_from_${from}.sql`);
  const files = fs.readdirSync(migrationsDir).filter((file) => /\.sql$/i.test(file));
  if (files.length === 0) throw new Error("No SQL migrations found in supabase/migrations.");

  const migrations = files
    .map((file) => {
      const match = /^(\d+)_[a-z0-9_]+\.sql$/.exec(file);
      if (!match) throw new Error(`Invalid migration filename: ${file}. Use NN_name.sql.`);
      const number = Number(match[1]);
      if (!Number.isSafeInteger(number)) throw new Error(`Invalid migration number: ${file}.`);
      return { file, number };
    })
    .sort((a, b) => a.number - b.number);

  // Reject duplicate numbers and gaps rather than silently omitting a migration.
  migrations.forEach(({ file, number }, index) => {
    if (number !== index) {
      throw new Error(`Expected migration number ${index}, found ${file}. Check for missing or duplicate numbers.`);
    }
  });

  const selected = from === null ? migrations : migrations.filter(({ number }) => number >= from);
  if (selected.length === 0) throw new Error(`No migrations numbered ${from} or higher.`);

  const body = selected
    .map(({ file }, index) => {
      const sql = fs
        .readFileSync(path.join(migrationsDir, file), "utf8")
        .replace(/^\uFEFF/, "")
        .trim();
      if (!sql) throw new Error(`Migration is empty: ${file}.`);
      const rule = "-".repeat(74);
      return `-- ${rule}\n-- [${index + 1}/${selected.length}] ${file}\n-- ${rule}\n\n${sql}\n`;
    })
    .join("\n");

  const first = selected[0].file;
  const last = selected[selected.length - 1].file;
  const header = [
    `-- GENERATED FILE: do not edit. Regenerate with: node build_schema.js${from === null ? "" : ` --from ${from}`}`,
    `-- Source: supabase/migrations/ ${first} \u2026 ${last} (${selected.length} files, in numeric order)`,
    "-- Requires an existing Supabase project (auth schema and Supabase roles).",
    "-- Paste the entire file into the Supabase SQL Editor and run it once.",
    from === null
      ? "-- FIRST-TIME SETUP ONLY: run against a project where none of these migrations are applied."
      : `-- UPDATE ONLY: run against a project that already has every migration before ${first}, and none from ${first} on.`,
    "-- These migrations are not idempotent.",
    "-- The transaction rolls back the schema changes if a statement fails.",
    "-- This file does not record Supabase CLI migration history.",
    "-- Filename order is checked; SQL validity must be checked by PostgreSQL.",
  ].join("\n");

  fs.writeFileSync(outFile, `${header}\n\nbegin;\n\n${body}\ncommit;\n`, "utf8");
  console.log(`Wrote ${outFile}`);
  console.log(`Combined ${selected.length} migrations: ${selected.map(({ file }) => file).join(", ")}`);
  console.log(
    from === null
      ? "NEW PROJECT ONLY: do not run this file if any migrations are already applied. Existing projects must generate only unapplied migrations with npm run db:schema -- --from <first-unapplied-number>."
      : `UPDATE ONLY: paste this file into a project with migrations 00-${String(from - 1).padStart(2, "0")} already applied and none of the selected migrations applied.`,
  );
}

try {
  buildSchema();
} catch (error) {
  console.error(`Schema build failed: ${error.message}`);
  process.exitCode = 1;
}
