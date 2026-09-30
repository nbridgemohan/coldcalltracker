// Import leads from the lead-finder CSV (TT_Website_Leads_all.csv).
// Usage: npm run db:import -- "C:\Users\me\TT Website Leads\TT_Website_Leads_all.csv"
// Re-running is safe: lead details are refreshed, call tracking fields are kept.
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const file = process.argv[2];
if (!file) throw new Error("Pass the CSV path as the first argument");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (run `vercel env pull .env.local` first)");
const sql = neon(url);

const records = parse(readFileSync(file), { columns: true, bom: true, skip_empty_lines: true });
const clean = (v) => {
  const s = (v ?? "").toString().trim();
  return s && s !== "None" ? s : null;
};

const COLS = ["id", "business", "phone", "alt_phone", "website_status", "website", "owner", "role", "owner_source", "category", "area", "address", "rating", "reviews", "priority"];

const seen = new Set();
const rows = [];
for (const r of records) {
  const digits = (r["Phone"] ?? "").split("ext")[0].replace(/\D/g, "");
  if (digits.length !== 10 || seen.has(digits)) continue;
  seen.add(digits);
  const rating = Number(r["Google rating"]);
  rows.push([
    digits,
    clean(r["Business"]) ?? "(unnamed)",
    clean(r["Phone"]),
    clean(r["Alt phone"]),
    clean(r["Website status"]),
    clean(r["Website / Page"]),
    clean(r["Owner / Contact"]),
    clean(r["Role"]),
    clean(r["Owner source"]),
    clean(r["Category"]),
    clean(r["Area"])?.replace(/ \(area\)$/, "") ?? null,
    clean(r["Address"]),
    Number.isFinite(rating) && rating > 0 ? rating : null,
    Number(r["Reviews"]) || 0,
    ["A", "B", "C"].includes(r["Priority"]) ? r["Priority"] : "B",
  ]);
}

const BATCH = 500;
let done = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const params = [];
  const values = chunk.map((row) => {
    const ph = row.map((v) => {
      params.push(v);
      return `$${params.length}`;
    });
    return `(${ph.join(",")})`;
  });
  const updates = COLS.filter((c) => c !== "id")
    .map((c) => (c === "owner" || c === "role" || c === "owner_source"
      // keep owner details you've edited by hand
      ? `${c} = case when leads.owner_source = 'Manual' then leads.${c} else excluded.${c} end`
      : `${c} = excluded.${c}`))
    .join(", ");
  await sql.query(
    `insert into leads (${COLS.join(",")}) values ${values.join(",")}
     on conflict (id) do update set ${updates}, updated_at = now()`,
    params,
  );
  done += chunk.length;
  process.stdout.write(`\rImported ${done}/${rows.length}`);
}
console.log(`\nDone. ${rows.length} leads upserted.`);
