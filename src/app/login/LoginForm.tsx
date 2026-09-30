"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <input name="password" type="password" autoFocus required placeholder="Password" className="input" />
      {state?.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Checking…" : "Log in"}
      </button>
    </form>
  );
}
