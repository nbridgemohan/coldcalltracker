import { NextResponse, type NextRequest } from "next/server";
import { nextLeadId, parseFilters } from "@/lib/leads";

// Jump to the next uncalled lead in the queue (respects list filters).
export async function GET(request: NextRequest) {
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const skip = sp.skip;
  delete sp.skip;
  delete sp.page;
  const f = parseFilters(sp);
  const id = await nextLeadId(f, skip);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  if (!id) return NextResponse.redirect(new URL(`/?${qs}&done=1`, request.url));
  return NextResponse.redirect(new URL(`/leads/${id}${qs ? `?${qs}` : ""}`, request.url));
}
