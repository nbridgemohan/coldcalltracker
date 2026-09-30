// Apply db/schema.sql to DATABASE_URL.  Usage: npm run db:migrate
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (run `vercel env pull .env.local` first)");
const sql = neon(url);

const statements = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
  .split(/;\s*$/m)
  .map((s) => s.replace(/--.*$/gm, "").trim())
  .filter(Boolean);

for (const stmt of statements) await sql.query(stmt);
console.log(`Applied ${statements.length} statements.`);
