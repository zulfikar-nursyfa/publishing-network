/**
 * Combines this project's numbered migrations for one-time Supabase setup.
 * Run: node build_schema.js
 * Output: supabase/_full_schema.sql
 *
 * Generates a file only; it never connects to or modifies the database.
 */
const fs = require("node:fs");
const path = require("node:path");

const migrationsDir = path.join(__dirname, "supabase", "migrations");
const outFile = path.join(__dirname, "supabase", "_full_schema.sql");

function buildSchema() {
  const files = fs.readdirSync(migrationsDir).filter((file) => /\.sql$/i.test(file));
  if (files.length === 0) throw new Error("No SQL migrations found in supabase/migrations.");

  const migrations = files.map((file) => {
    const match = /^(\d+)_[a-z0-9_]+\.sql$/.exec(file);
    if (!match) throw new Error(`Invalid migration filename: ${file}. Use NN_name.sql.`);
    const number = Number(match[1]);
    if (!Number.isSafeInteger(number)) throw new Error(`Invalid migration number: ${file}.`);
    return { file, number };
  }).sort((a, b) => a.number - b.number);

  // Reject duplicate numbers and gaps rather than silently omitting a migration.
  const body = migrations.map(({ file, number }, index) => {
    if (number !== index) {
      throw new Error(`Expected migration number ${index}, found ${file}. Check for missing or duplicate numbers.`);
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8").replace(/^\uFEFF/, "").trim();
    if (!sql) throw new Error(`Migration is empty: ${file}.`);
    const rule = "-".repeat(74);
    return `-- ${rule}\n-- [${index + 1}/${migrations.length}] ${file}\n-- ${rule}\n\n${sql}\n`;
  }).join("\n");

  const header = [
    "-- GENERATED FILE: do not edit. Regenerate with: node build_schema.js",
    `-- Source: supabase/migrations/ (${migrations.length} files, in numeric order)`,
    "-- Requires an existing Supabase project (auth schema and Supabase roles).",
    "-- Paste the entire file into the Supabase SQL Editor and run it once.",
    "-- FIRST-TIME SETUP ONLY: these migrations are not idempotent.",
    "-- Do not run against a project where any of these migrations are already applied.",
    "-- The transaction rolls back the schema changes if a statement fails.",
    "-- This file does not record Supabase CLI migration history.",
    "-- Filename order is checked; SQL validity must be checked by PostgreSQL.",
  ].join("\n");

  fs.writeFileSync(outFile, `${header}\n\nbegin;\n\n${body}\ncommit;\n`, "utf8");
  console.log(`Wrote ${outFile}`);
  console.log(`Combined ${migrations.length} migrations: ${migrations.map(({ file }) => file).join(", ")}`);
  console.log("Paste the whole file into your staging Supabase SQL Editor for first-time setup.");
}

try {
  buildSchema();
} catch (error) {
  console.error(`Schema build failed: ${error.message}`);
  process.exitCode = 1;
}
