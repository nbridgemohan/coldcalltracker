"use client";

import { useState } from "react";
import { logCall } from "@/app/actions";
import { FOLLOW_UP_DEFAULT_DAYS, STATUSES } from "@/lib/constants";

const OUTCOMES = STATUSES.filter((s) => s.value !== "new");

function defaultFollowUp(outcome: string) {
  const days = FOLLOW_UP_DEFAULT_DAYS[outcome];
  if (days === undefined) return "";
  // Trinidad is UTC-4 all year; suggest 10:00 local on the target day.
  const tt = new Date(Date.now() - 4 * 3600_000);
  tt.setUTCDate(tt.getUTCDate() + Math.max(days, 1));
  return `${tt.toISOString().slice(0, 10)}T10:00`;
}

export default function CallLogger({ leadId, queue }: { leadId: string; queue: string }) {
  const [outcome, setOutcome] = useState("");
  const [followUp, setFollowUp] = useState("");

  return (
    <form action={logCall} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="queue" value={queue} />
      <input type="hidden" name="outcome" value={outcome} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {OUTCOMES.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              setOutcome(o.value);
              setFollowUp(defaultFollowUp(o.value));
            }}
            className={`rounded-lg border px-2 py-2 text-sm transition ${
              outcome === o.value ? "border-slate-900 ring-2 ring-slate-900" : "border-slate-200 hover:border-slate-400"
            } ${o.color}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <textarea name="notes" rows={3} placeholder="What happened? Who did you speak to?" className="input" />
      <label className="block text-sm text-slate-600">
        Follow up (Trinidad time)
        <input
          type="datetime-local"
          name="followUp"
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value)}
          className="input mt-1"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button name="next" value="0" className="btn-ghost" disabled={!outcome}>
          Save
        </button>
        <button name="next" value="1" className="btn-primary" disabled={!outcome}>
          Save &amp; next lead →
        </button>
      </div>
    </form>
  );
}
