"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSessionToken, passwordMatches, SESSION_COOKIE } from "@/lib/auth";
import { STATUS_VALUES } from "@/lib/constants";

export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!passwordMatches(password)) return { error: "Wrong password" };
  const { token, expires } = await createSessionToken();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  const next = String(formData.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

function parseFollowUp(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  // <input type="datetime-local"> has no zone; treat it as Trinidad time (UTC-4, no DST).
  const d = new Date(s.length === 16 ? `${s}:00-04:00` : s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export async function logCall(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const followUp = parseFollowUp(formData.get("followUp"));
  if (!leadId || !STATUS_VALUES.includes(outcome) || outcome === "new") throw new Error("Invalid call");

  const sql = db();
  await sql.transaction([
    sql`insert into calls (lead_id, outcome, notes, follow_up_at) values (${leadId}, ${outcome}, ${notes}, ${followUp})`,
    sql`update leads set
          status = ${outcome},
          call_count = call_count + 1,
          last_called_at = now(),
          follow_up_at = ${followUp},
          notes = case when ${notes}::text is null then notes
                       else concat_ws(E'\n', notes, to_char(now() at time zone 'America/Port_of_Spain', 'DD Mon HH24:MI') || ' — ' || ${notes}::text) end,
          updated_at = now()
        where id = ${leadId}`,
  ]);

  revalidatePath("/");
  revalidatePath(`/leads/${leadId}`);
  const goNext = formData.get("next") === "1";
  if (goNext) {
    const qs = String(formData.get("queue") ?? "");
    redirect(`/next?${qs}${qs ? "&" : ""}skip=${encodeURIComponent(leadId)}`);
  }
}

export async function updateLead(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const text = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const status = String(formData.get("status") ?? "");
  if (!id || !STATUS_VALUES.includes(status)) throw new Error("Invalid update");

  await db()`update leads set
      owner = ${text("owner")},
      role = ${text("role")},
      owner_source = case when ${text("owner")}::text is distinct from owner then 'Manual' else owner_source end,
      alt_phone = ${text("alt_phone")},
      website = ${text("website")},
      notes = ${text("notes")},
      status = ${status},
      follow_up_at = ${parseFollowUp(formData.get("followUp"))},
      updated_at = now()
    where id = ${id}`;

  revalidatePath("/");
  revalidatePath(`/leads/${id}`);
}
