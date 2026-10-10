"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveHomeContent } from "@/app/settings-actions";
import type { HomeContent } from "@/lib/home-content";
import { useToast } from "./Toast";

/** Resizes a picked photo to at most 480 px on its longer side and returns a JPEG data URL. */
function resize(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 480 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("unreadable"));
    img.src = URL.createObjectURL(file);
  });
}

/** Settings → Home page: the Dean's photo and profile, and the Faculty's mission and vision. */
export function HomeContentPanel({ initial }: { initial: HomeContent }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState(initial);
  const dean = (k: keyof HomeContent["dean"], x: string | null) => setV((s) => ({ ...s, dean: { ...s.dean, [k]: x } }));

  async function pick(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return toast("Choose a JPEG or PNG photo.", true);
    try {
      dean("photo", await resize(f));
    } catch {
      toast("That photo couldn't be read. Try another file.", true);
    }
  }

  return (
    <section className="card home-edit">
      <h2>Home page</h2>
      <p className="hint">Shown on the FaCoMS home page under the modules. The section stays hidden until something is filled in.</p>
      <div className="he-grid">
        <div className="he-photo">
          {v.dean.photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={v.dean.photo} alt="The Dean" />
          ) : (
            <div className="he-empty">No photo yet</div>
          )}
          <label className="btn">
            {v.dean.photo ? "Change photo" : "Add photo"}
            <input id="dean-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {v.dean.photo && (
            <button type="button" className="btn" onClick={() => dean("photo", null)}>
              Remove photo
            </button>
          )}
        </div>
        <div className="he-fields">
          <div className="row2">
            <label className="fld">
              <span>Dean&apos;s name</span>
              <input id="dean-name" value={v.dean.name} onChange={(e) => dean("name", e.target.value)} placeholder="Prof. A. B. Surname" />
            </label>
            <label className="fld">
              <span>Title</span>
              <input id="dean-title" value={v.dean.title} onChange={(e) => dean("title", e.target.value)} />
            </label>
          </div>
          <label className="fld">
            <span>Short profile (leave a blank line between paragraphs)</span>
            <textarea id="dean-profile" rows={6} value={v.dean.profile} onChange={(e) => dean("profile", e.target.value)} />
          </label>
          <label className="fld">
            <span>Mission of the Faculty</span>
            <textarea id="faculty-mission" rows={3} value={v.mission} onChange={(e) => setV({ ...v, mission: e.target.value })} />
          </label>
          <label className="fld">
            <span>Vision of the Faculty (optional)</span>
            <textarea id="faculty-vision" rows={3} value={v.vision} onChange={(e) => setV({ ...v, vision: e.target.value })} />
          </label>
          <div className="actions" style={{ padding: 0 }}>
            <button
              type="button"
              className="btn primary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await saveHomeContent(v);
                  toast(r.ok ? r.message ?? "Saved." : r.error, !r.ok);
                  if (r.ok) router.refresh();
                })
              }
            >
              {pending ? "Saving…" : "Save home page"}
            </button>
            <a className="btn" href="/" target="_blank" rel="noopener">
              View the home page
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
