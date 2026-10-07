// MCP server (stdio) so Claude can look up leads and log calls/updates.
// Registered in .mcp.json; reads DATABASE_URL from .env.local like the other scripts.
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Resolve .env.local relative to the repo, since the client may start us from another cwd.
config({ path: new URL("../.env.local", import.meta.url), quiet: true });
config({ path: new URL("../.env", import.meta.url), quiet: true });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (run `vercel env pull .env.local` first)");
const sql = neon(url);

// Keep in sync with src/lib/constants.ts and src/lib/leads.ts.
const STATUSES = ["new", "no_answer", "voicemail", "callback", "interested", "meeting", "proposal", "won", "not_interested", "wrong_number", "do_not_call"];
const OUTCOMES = STATUSES.filter((s) => s !== "new");
const FOLLOW_UP_DEFAULT_DAYS = { no_answer: 1, voicemail: 2, callback: 1, interested: 2, meeting: 0, proposal: 3 };
const CLOSED = `('won','not_interested','wrong_number','do_not_call')`;
const TT_TOMORROW = `((date_trunc('day', now() at time zone 'America/Port_of_Spain') + interval '1 day') at time zone 'America/Port_of_Spain')`;
const TT_TODAY = `(date_trunc('day', now() at time zone 'America/Port_of_Spain') at time zone 'America/Port_of_Spain')`;
const LEAD_COLS = `id, business, phone, alt_phone, owner, role, category, area, website_status, website, priority, status,
  call_count, last_called_at, follow_up_at, rating, reviews`;

/** Accepts ISO or "YYYY-MM-DD[ HH:MM]" (treated as Trinidad time, UTC-4, no DST). */
function parseFollowUp(s) {
  if (!s) return null;
  const t = s.trim();
  const local = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?$/.test(t);
  const d = new Date(local ? `${t.slice(0, 10)}T${t.length > 10 ? t.slice(11, 16) : "10:00"}:00-04:00` : t);
  if (isNaN(d.getTime())) throw new Error(`Couldn't parse follow-up date "${s}"`);
  return d.toISOString();
}

/** Same suggestion as the call logger UI: 10:00 Trinidad time, N days out. */
function defaultFollowUp(outcome) {
  const days = FOLLOW_UP_DEFAULT_DAYS[outcome];
  if (days === undefined) return null;
  const tt = new Date(Date.now() - 4 * 3600_000);
  tt.setUTCDate(tt.getUTCDate() + Math.max(days, 1));
  return parseFollowUp(tt.toISOString().slice(0, 10));
}

/** Resolve a lead by id/phone digits, or by an unambiguous business name. */
async function resolveLead(ref) {
  const digits = ref.replace(/\D/g, "");
  if (digits.length >= 7) {
    const rows = await sql.query(`select ${LEAD_COLS} from leads where id = $1 or regexp_replace(phone, '\\D', '', 'g') like '%' || $1 or regexp_replace(coalesce(alt_phone, ''), '\\D', '', 'g') like '%' || $1 limit 2`, [digits]);
    if (rows.length === 1) return rows[0];
  }
  const rows = await sql.query(`select ${LEAD_COLS} from leads where business ilike $1 order by priority, reviews desc limit 6`, [`%${ref}%`]);
  const exact = rows.filter((r) => r.business.toLowerCase() === ref.toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new Error(`No lead matches "${ref}"`);
  throw new Error(`"${ref}" matches several leads — use an id:\n${rows.map((r) => `${r.id}  ${r.business} (${r.area ?? "?"})`).join("\n")}`);
}

const json = (value) => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const tool = (fn) => async (args) => {
  try {
    return await fn(args);
  } catch (e) {
    return { isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] };
  }
};

const server = new McpServer({ name: "coldcalltracker", version: "0.1.0" });

server.registerTool(
  "find_leads",
  {
    description: "Search leads by business name, phone, owner or address. Filters are optional.",
    inputSchema: {
      query: z.string().optional().describe("Text to search for"),
      status: z.enum([...STATUSES, "open"]).optional().describe("'open' = anything not closed"),
      area: z.string().optional(),
      category: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(10),
    },
    annotations: { readOnlyHint: true },
  },
  tool(async ({ query, status, area, category, limit }) => {
    const clauses = [];
    const params = [];
    const add = (s, v) => { params.push(v); clauses.push(s.replaceAll("?", `$${params.length}`)); };
    if (query) add(`(business ilike ? or phone ilike ? or owner ilike ? or address ilike ?)`, `%${query}%`);
    if (status === "open") clauses.push(`status not in ${CLOSED}`);
    else if (status) add("status = ?", status);
    if (area) add("area ilike ?", area);
    if (category) add("category ilike ?", category);
    const w = clauses.length ? `where ${clauses.join(" and ")}` : "";
    return json(await sql.query(`select ${LEAD_COLS} from leads ${w} order by priority, reviews desc, id limit ${limit}`, params));
  }),
);

server.registerTool(
  "get_lead",
  {
    description: "Full details and call history for one lead (id, phone number or business name).",
    inputSchema: { lead: z.string().describe("Lead id / phone digits, or business name") },
    annotations: { readOnlyHint: true },
  },
  tool(async ({ lead }) => {
    const { id } = await resolveLead(lead);
    const [[row], calls] = await Promise.all([
      sql`select * from leads where id = ${id}`,
      sql`select outcome, notes, follow_up_at, created_at from calls where lead_id = ${id} order by created_at desc limit 50`,
    ]);
    return json({ ...row, calls });
  }),
);

server.registerTool(
  "log_call",
  {
    description:
      "Log a call against a lead: records it in call history, sets the lead's status to the outcome, bumps the call count and " +
      "appends notes. If follow_up isn't given, uses the app's default for that outcome (e.g. no_answer → tomorrow 10:00).",
    inputSchema: {
      lead: z.string().describe("Lead id / phone digits, or business name"),
      outcome: z.enum(OUTCOMES),
      notes: z.string().optional(),
      follow_up: z.string().optional().describe("ISO datetime, or 'YYYY-MM-DD [HH:MM]' in Trinidad time; 'none' to clear"),
    },
  },
  tool(async ({ lead, outcome, notes, follow_up }) => {
    const { id, business } = await resolveLead(lead);
    const note = notes?.trim() || null;
    const followUp = follow_up === "none" ? null : follow_up ? parseFollowUp(follow_up) : defaultFollowUp(outcome);
    await sql.transaction([
      sql`insert into calls (lead_id, outcome, notes, follow_up_at) values (${id}, ${outcome}, ${note}, ${followUp})`,
      sql`update leads set
            status = ${outcome},
            call_count = call_count + 1,
            last_called_at = now(),
            follow_up_at = ${followUp},
            notes = case when ${note}::text is null then notes
                         else concat_ws(E'\n', notes, to_char(now() at time zone 'America/Port_of_Spain', 'DD Mon HH24:MI') || ' — ' || ${note}::text) end,
            updated_at = now()
          where id = ${id}`,
    ]);
    return json({ ok: true, id, business, outcome, follow_up_at: followUp });
  }),
);

server.registerTool(
  "update_lead",
  {
    description: "Update lead details without logging a call. Only the fields you pass are changed.",
    inputSchema: {
      lead: z.string().describe("Lead id / phone digits, or business name"),
      status: z.enum(STATUSES).optional(),
      owner: z.string().optional(),
      role: z.string().optional(),
      alt_phone: z.string().optional(),
      website: z.string().optional(),
      follow_up: z.string().optional().describe("ISO datetime, or 'YYYY-MM-DD [HH:MM]' in Trinidad time; 'none' to clear"),
      add_note: z.string().optional().describe("Appended to the lead's notes with a timestamp"),
    },
  },
  tool(async ({ lead, status, owner, role, alt_phone, website, follow_up, add_note }) => {
    const { id, business } = await resolveLead(lead);
    const sets = [];
    const params = [id];
    const set = (s, v) => { params.push(v); sets.push(s.replaceAll("?", `$${params.length}`)); };
    if (status !== undefined) set("status = ?", status);
    if (owner !== undefined) set("owner_source = case when ?::text is distinct from owner then 'Manual' else owner_source end, owner = ?", owner || null);
    if (role !== undefined) set("role = ?", role || null);
    if (alt_phone !== undefined) set("alt_phone = ?", alt_phone || null);
    if (website !== undefined) set("website = ?", website || null);
    if (follow_up !== undefined) set("follow_up_at = ?", follow_up === "none" ? null : parseFollowUp(follow_up));
    if (add_note?.trim())
      set(`notes = concat_ws(E'\\n', notes, to_char(now() at time zone 'America/Port_of_Spain', 'DD Mon HH24:MI') || ' — ' || ?::text)`, add_note.trim());
    if (!sets.length) throw new Error("Nothing to update");
    const [row] = await sql.query(`update leads set ${sets.join(", ")}, updated_at = now() where id = $1 returning ${LEAD_COLS}, notes`, params);
    return json({ ok: true, business, lead: row });
  }),
);

server.registerTool(
  "follow_ups",
  {
    description: "Open leads with a follow-up due today/overdue, plus the next 7 days (Trinidad time).",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  tool(async () => {
    const [due, upcoming] = await Promise.all([
      sql.query(`select ${LEAD_COLS} from leads where follow_up_at < ${TT_TOMORROW} and status not in ${CLOSED} order by follow_up_at limit 100`),
      sql.query(`select ${LEAD_COLS} from leads where follow_up_at >= ${TT_TOMORROW} and follow_up_at < ${TT_TOMORROW} + interval '7 days' and status not in ${CLOSED} order by follow_up_at limit 100`),
    ]);
    return json({ due, upcoming });
  }),
);

server.registerTool(
  "stats",
  {
    description: "Calls today / this week / all time, and the pipeline count by status.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  tool(async () => {
    const [byStatus, [calls], [totals]] = await Promise.all([
      sql`select status, count(*)::int as n from leads group by status order by n desc`,
      sql.query(`select count(*) filter (where created_at >= ${TT_TODAY})::int as today,
          count(*) filter (where created_at >= ${TT_TODAY} - interval '6 days')::int as week,
          count(*)::int as all_time from calls`),
      sql.query(`select count(*)::int as leads,
          count(*) filter (where follow_up_at < ${TT_TOMORROW} and status not in ${CLOSED})::int as follow_ups_due from leads`),
    ]);
    return json({ calls, ...totals, by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.n])) });
  }),
);

await server.connect(new StdioServerTransport());
