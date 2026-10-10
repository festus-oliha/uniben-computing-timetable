"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, resetUserPassword, updateUser, type UserActionResult } from "@/app/user-actions";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { DEPARTMENTS, FACULTY_DEPTS } from "@/lib/timetable";
import { useToast } from "./Toast";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  dept: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

const ROLES: Role[] = ["admin", "dept_officer", "viewer"];

export function UsersPanel({ rows, meId }: { rows: UserRow[]; meId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<{ name: string; email: string; role: Role; dept: string }>({
    name: "",
    email: "",
    role: "dept_officer",
    dept: FACULTY_DEPTS[0],
  });
  const [issued, setIssued] = useState<{ who: string; email: string; password: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);

  const after = (r: UserActionResult, who?: { name: string; email: string }) => {
    if (!r.ok) return toast(r.error, true);
    toast(r.message);
    if (r.tempPassword && who) setIssued({ who: who.name, email: who.email, password: r.tempPassword });
    router.refresh();
  };

  return (
    <>
      {issued && (
        <section className="card issued" role="status">
          <h2>Temporary password for {issued.who}</h2>
          <p>
            Give these to {issued.who} privately. They&apos;ll be asked to choose their own password the first time they sign in.
            This password won&apos;t be shown again.
          </p>
          <dl>
            <dt>Email</dt>
            <dd>{issued.email}</dd>
            <dt>Temporary password</dt>
            <dd className="code">{issued.password}</dd>
          </dl>
          <div className="actions" style={{ padding: 0 }}>
            <button
              type="button"
              className="btn"
              onClick={() =>
                navigator.clipboard
                  .writeText(`FaCoMS (Faculty of Computing)\nEmail: ${issued.email}\nTemporary password: ${issued.password}`)
                  .then(() => toast("Copied."))
                  .catch(() => toast("Couldn't copy — select the text instead.", true))
              }
            >
              Copy details
            </button>
            <button type="button" className="btn" onClick={() => setIssued(null)}>
              Done
            </button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Users</h2>
        <p className="hint">
          <b>Faculty Time-Table Officer</b>: everything. <b>Department Officer</b>: their department&apos;s course lectures,
          courses and lecturers only. <b>Viewer</b>: can look and download, not change.
        </p>
        <div className="tblwrap">
          <table className="t">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.name}</b>
                    {u.id === meId && <span className="hint"> (you)</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      aria-label={`${u.name} role`}
                      value={u.role}
                      disabled={pending}
                      onChange={(e) =>
                        startTransition(async () => {
                          const role = e.target.value as Role;
                          after(await updateUser({ id: u.id, role, dept: role === "dept_officer" ? u.dept ?? FACULTY_DEPTS[0] : null, isActive: u.isActive }));
                        })
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {u.role === "dept_officer" ? (
                      <select
                        aria-label={`${u.name} department`}
                        value={u.dept ?? ""}
                        disabled={pending}
                        onChange={(e) => startTransition(async () => after(await updateUser({ id: u.id, role: u.role, dept: e.target.value, isActive: u.isActive })))}
                      >
                        {FACULTY_DEPTS.map((d) => (
                          <option key={d} value={d}>
                            {DEPARTMENTS[d]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="hint">—</span>
                    )}
                  </td>
                  <td>
                    {!u.isActive ? (
                      <span className="pill warn">Switched off</span>
                    ) : u.mustChangePassword ? (
                      <span className="pill warn">Temporary password</span>
                    ) : (
                      <span className="pill ok">Active</span>
                    )}
                  </td>
                  <td className="hint">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-GB") : "Never"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className={`btn${confirmReset === u.id ? " danger sure" : ""}`}
                      disabled={pending}
                      onClick={() => {
                        if (confirmReset !== u.id) return setConfirmReset(u.id);
                        setConfirmReset(null);
                        startTransition(async () => after(await resetUserPassword(u.id), u));
                      }}
                    >
                      {confirmReset === u.id ? "Confirm reset" : "Reset password"}
                    </button>{" "}
                    {u.id !== meId && (
                      <button
                        type="button"
                        className={`btn${u.isActive ? " danger" : ""}`}
                        disabled={pending}
                        onClick={() => startTransition(async () => after(await updateUser({ id: u.id, role: u.role, dept: u.dept, isActive: !u.isActive })))}
                      >
                        {u.isActive ? "Switch off" : "Switch on"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form
          className="addrow"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const r = await createUser({ ...form, dept: form.role === "dept_officer" ? form.dept : null });
              after(r, { name: form.name, email: form.email });
              if (r.ok) setForm((f) => ({ ...f, name: "", email: "" }));
            });
          }}
        >
          <label className="fld">
            <span>Name</span>
            <input id="new-user-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dr. A. B. Surname" />
          </label>
          <label className="fld">
            <span>Email</span>
            <input id="new-user-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="fld">
            <span>Role</span>
            <select id="new-user-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          {form.role === "dept_officer" && (
            <label className="fld">
              <span>Department</span>
              <select id="new-user-dept" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })}>
                {FACULTY_DEPTS.map((d) => (
                  <option key={d} value={d}>
                    {DEPARTMENTS[d]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="btn primary" type="submit" disabled={pending}>
            Create account
          </button>
        </form>
      </section>
    </>
  );
}
