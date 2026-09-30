export const STATUSES = [
  { value: "new", label: "New", color: "bg-slate-100 text-slate-700" },
  { value: "no_answer", label: "No answer", color: "bg-amber-100 text-amber-800" },
  { value: "voicemail", label: "Voicemail", color: "bg-amber-100 text-amber-800" },
  { value: "callback", label: "Call back", color: "bg-sky-100 text-sky-800" },
  { value: "interested", label: "Interested", color: "bg-emerald-100 text-emerald-800" },
  { value: "meeting", label: "Meeting booked", color: "bg-violet-100 text-violet-800" },
  { value: "proposal", label: "Proposal sent", color: "bg-indigo-100 text-indigo-800" },
  { value: "won", label: "Won", color: "bg-green-600 text-white" },
  { value: "not_interested", label: "Not interested", color: "bg-rose-100 text-rose-800" },
  { value: "wrong_number", label: "Wrong number", color: "bg-zinc-200 text-zinc-700" },
  { value: "do_not_call", label: "Do not call", color: "bg-zinc-800 text-white" },
] as const;

export type Status = (typeof STATUSES)[number]["value"];

export const STATUS_VALUES = STATUSES.map((s) => s.value) as readonly string[];

export function statusMeta(value: string) {
  return STATUSES.find((s) => s.value === value) ?? STATUSES[0];
}

/** Outcomes that usually need a follow-up date. */
export const FOLLOW_UP_DEFAULT_DAYS: Record<string, number> = {
  no_answer: 1,
  voicemail: 2,
  callback: 1,
  interested: 2,
  meeting: 0,
  proposal: 3,
};

export const WEBSITE_FILTERS = [
  { value: "none", label: "No website", match: "No website" },
  { value: "social", label: "Social page only", match: "Social/booking page only" },
  { value: "has", label: "Has website", match: "Has website" },
] as const;

export const PAGE_SIZE = 50;
