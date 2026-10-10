"use client";

import { useActionState } from "react";
import { changeOwnPassword, login, setupFirstAdmin } from "@/app/auth-actions";
import type { FormState } from "@/app/auth-actions";

function Feedback({ state }: { state: FormState | null }) {
  if (!state) return null;
  return state.ok ? <p className="form-ok">{state.message}</p> : <p className="form-error" role="alert">{state.error}</p>;
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <label className="fld">
        <span>Email</span>
        <input id="login-email" name="email" type="email" autoComplete="username" required autoFocus defaultValue={state?.values?.email} key={state?.values?.email} />
      </label>
      <label className="fld">
        <span>Password</span>
        <input id="login-password" name="password" type="password" autoComplete="current-password" required />
      </label>
      <Feedback state={state} />
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function SetupForm() {
  const [state, action, pending] = useActionState(setupFirstAdmin, null);
  return (
    <form action={action}>
      <label className="fld">
        <span>Your name (as printed on the timetable)</span>
        <input id="setup-name" name="name" required autoFocus placeholder="F. O. Oliha, PhD." defaultValue={state?.values?.name} key={`n${state?.values?.name}`} />
      </label>
      <label className="fld">
        <span>Email</span>
        <input id="setup-email" name="email" type="email" autoComplete="username" required defaultValue={state?.values?.email} key={`e${state?.values?.email}`} />
      </label>
      <label className="fld">
        <span>Password (10+ characters, letters and numbers)</span>
        <input id="setup-password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </label>
      <label className="fld">
        <span>Type the password again</span>
        <input id="setup-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
      </label>
      <Feedback state={state} />
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create Faculty Officer account"}
      </button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPassword, null);
  return (
    <form action={action}>
      <label className="fld">
        <span>Current password</span>
        <input id="pw-current" name="current" type="password" autoComplete="current-password" required />
      </label>
      <label className="fld">
        <span>New password (10+ characters, letters and numbers)</span>
        <input id="pw-new" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </label>
      <label className="fld">
        <span>Type the new password again</span>
        <input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
      </label>
      <Feedback state={state} />
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
